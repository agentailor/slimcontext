import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  isAIMessage,
  SystemMessage,
  ToolMessage,
  isHumanMessage,
  isSystemMessage,
  isToolMessage,
  AIMessageFields,
  SystemMessageFields,
  HumanMessageFields,
} from '@langchain/core/messages';

import {
  SummarizeCompressor,
  type SummarizeConfig,
  TrimCompressor,
  type TrimConfig,
  type SlimContextChatModel,
  type SlimContextCompressor,
  type SlimContextMessage,
  type SlimContextModelResponse,
} from '..';

/**
 * Extract plain text from a LangChain message content, which may be a string
 * or an array of content parts that could include text entries.
 * Only text content is extracted; other content types (such as images or non-text parts) are ignored.
 */
export function extractContent(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    const parts = content
      .map((c) => {
        if (typeof c === 'string') return c;
        if (typeof c === 'object' && c !== null && 'text' in c) {
          const v = (c as { text?: unknown }).text;
          return typeof v === 'string' ? v : '';
        }
        return '';
      })
      .filter(Boolean);
    return parts.join('\n').trim();
  }
  return '';
}

/**
 * Normalize LangChain BaseMessage.getType() (e.g., 'ai', 'human', or 'AIMessage', 'HumanMessage')
 * to a SlimContext role.
 */
export function roleFromMessageType(type: string): 'user' | 'assistant' | 'system' | 'tool' {
  switch (type) {
    case 'ai':
      return 'assistant';
    case 'system':
      return 'system';
    case 'tool':
      return 'tool';
    case 'human':
    default:
      return 'user';
  }
}

/**
 * Determine a LangChain BaseMessage type
 * @param msg
 * @returns
 */
export function getLangChainMessageType(msg: BaseMessage): string {
  if (isAIMessage(msg)) return 'ai';
  if (isHumanMessage(msg)) return 'human';
  if (isSystemMessage(msg)) return 'system';
  if (isToolMessage(msg)) return 'tool';

  return 'human';
}

/** Convert a LangChain BaseMessage to a SlimContextMessage used by compression. */
export function baseToSlim(msg: BaseMessage): SlimContextMessage {
  const type = getLangChainMessageType(msg);

  // Collect all metadata fields to preserve during conversion
  const metadata: Record<string, unknown> = {};

  // Preserve common BaseMessage fields
  if (msg.id !== undefined) metadata.id = msg.id;
  if (msg.name !== undefined) metadata.name = msg.name;
  if (msg.additional_kwargs && Object.keys(msg.additional_kwargs).length > 0) {
    metadata.additional_kwargs = msg.additional_kwargs;
  }
  if (msg.response_metadata && Object.keys(msg.response_metadata).length > 0) {
    metadata.response_metadata = msg.response_metadata;
  }

  // Preserve tool-specific fields
  if (isToolMessage(msg)) {
    metadata.tool_call_id = msg.tool_call_id;
    if (msg.status !== undefined) metadata.status = msg.status;
    if (msg.artifact !== undefined) metadata.artifact = msg.artifact;
    if (msg.metadata !== undefined) metadata.langchain_metadata = msg.metadata;
  }

  const extractedContent = extractContent(msg.content as unknown);

  // If extractContent returns empty but original content exists, preserve original content
  // Note: msg.content can be undefined, empty string, or have content that extractContent can't process
  if (!extractedContent && msg.content !== undefined && msg.content !== null) {
    metadata.original_content = msg.content;
  }

  const result: SlimContextMessage = {
    role: roleFromMessageType(type),
    content: extractedContent,
  };

  // Only add metadata if there are fields to preserve
  if (Object.keys(metadata).length > 0) {
    result.metadata = metadata;
  }

  return result;
}

/** Map SlimContextMessage back to a LangChain BaseMessage class. */
export function slimToLangChain(msg: SlimContextMessage): BaseMessage {
  // Use original content if preserved, otherwise use processed content
  const content = msg.metadata?.original_content || msg.content;

  // Prepare fields with preserved metadata
  const fields: Record<string, unknown> = {
    content,
  };

  // Restore preserved metadata fields
  if (msg.metadata) {
    if (msg.metadata.id !== undefined) fields.id = msg.metadata.id;
    if (msg.metadata.name !== undefined) fields.name = msg.metadata.name;
    if (msg.metadata.additional_kwargs !== undefined) {
      fields.additional_kwargs = msg.metadata.additional_kwargs;
    }
    if (msg.metadata.response_metadata !== undefined) {
      fields.response_metadata = msg.metadata.response_metadata;
    }
  }

  switch (msg.role) {
    case 'assistant':
      return new AIMessage(fields as AIMessageFields);
    case 'system':
      return new SystemMessage(fields as SystemMessageFields);
    case 'tool': {
      // For tool messages, we need the tool_call_id and other tool-specific fields
      const toolFields = { ...fields };
      if (msg.metadata?.tool_call_id) {
        toolFields.tool_call_id = msg.metadata.tool_call_id;
      } else {
        // Fallback to empty string if no tool_call_id preserved (shouldn't happen with new logic)
        toolFields.tool_call_id = '';
      }
      if (msg.metadata?.status !== undefined) toolFields.status = msg.metadata.status;
      if (msg.metadata?.artifact !== undefined) toolFields.artifact = msg.metadata.artifact;
      if (msg.metadata?.langchain_metadata !== undefined) {
        toolFields.metadata = msg.metadata.langchain_metadata;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new ToolMessage(toolFields as any);
    }
    case 'user':
    case 'human':
    default:
      return new HumanMessage(fields as HumanMessageFields);
  }
}

/** Preprocess LangChain messages into SlimContext messages. */
export function preprocessToSlim(messages: BaseMessage[]): SlimContextMessage[] {
  return messages.map(baseToSlim);
}

/** Postprocess SlimContext messages back into LangChain messages. */
export function postprocessToLangChain(messages: SlimContextMessage[]): BaseMessage[] {
  return messages.map(slimToLangChain);
}

/**
 * Lightweight adapter to bridge a LangChain BaseChatModel to SlimContext's model interface.
 */
export class LangChainSlimModel implements SlimContextChatModel {
  private llm: BaseChatModel;

  constructor(llm: BaseChatModel) {
    this.llm = llm;
  }

  async invoke(messages: SlimContextMessage[]): Promise<SlimContextModelResponse> {
    // Convert to LangChain BaseMessage instances
    const lcMessages = messages.map(slimToLangChain);
    const res = await this.llm.invoke(lcMessages);
    const content = extractContent((res as unknown as { content?: unknown })?.content);
    return { content };
  }
}

/** Create a SlimContextChatModel from a LangChain BaseChatModel. */
export function toSlimModel(llm: BaseChatModel): SlimContextChatModel {
  return new LangChainSlimModel(llm);
}

/** Convenience: build a SummarizeCompressor for LangChain models (token-threshold based). */
export function createSummarizeCompressorForLangChain(
  llm: BaseChatModel,
  config: Omit<SummarizeConfig, 'model'>,
): SummarizeCompressor {
  return new SummarizeCompressor({ model: toSlimModel(llm), ...config });
}

/** Convenience: build a TrimCompressor (token-threshold based). */
export function createTrimCompressor(config: TrimConfig): TrimCompressor {
  return new TrimCompressor(config);
}

/**
 * Options for compressLangChainHistory (token-threshold based).
 *
 * Provide one of:
 * - { compressor }: a pre-built SlimContextCompressor instance
 * - summarize: { strategy?: 'summarize', llm, maxModelTokens?, thresholdPercent?, estimateTokens?, minRecentMessages?, prompt? }
 * - trim: { strategy: 'trim', maxModelTokens?, thresholdPercent?, estimateTokens?, minRecentMessages? }
 */
export type CompressLangChainOptions =
  | { compressor: SlimContextCompressor }
  | ({
      strategy?: 'summarize';
      llm: BaseChatModel;
    } & Omit<SummarizeConfig, 'model'>)
  | ({ strategy: 'trim' } & TrimConfig);

/**
 * High-level helper: compress a LangChain message history in one call.
 * - Converts LC -> SlimContext, runs a compressor, and converts the result back.
 * - Strategies trigger when estimated total tokens exceed `thresholdPercent * maxModelTokens`.
 * - For summarize, older content is summarized and a system summary is inserted before recent messages.
 * - For trim, oldest non-system messages are dropped until under threshold, preserving system + recent.
 */
export async function compressLangChainHistory(
  history: BaseMessage[],
  options: CompressLangChainOptions,
): Promise<BaseMessage[]> {
  const slimHistory = preprocessToSlim(history);

  let compressor: SlimContextCompressor;

  if ('compressor' in options) {
    compressor = options.compressor;
  } else if (options.strategy === 'trim') {
    compressor = new TrimCompressor(options);
  } else {
    const { llm, ...summarizeOptions } = options;
    compressor = new SummarizeCompressor({
      model: toSlimModel(llm),
      ...summarizeOptions,
    });
  }

  const compressed = await compressor.compress(slimHistory);
  return postprocessToLangChain(compressed);
}
