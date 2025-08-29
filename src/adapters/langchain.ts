import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  isAIMessage,
  SystemMessage,
  isHumanMessage,
  isSystemMessage,
  isToolMessage,
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
  return {
    role: roleFromMessageType(type),
    content: extractContent(msg.content as unknown),
  };
}

/** Map SlimContextMessage back to a LangChain BaseMessage class. */
export function slimToLangChain(msg: SlimContextMessage): BaseMessage {
  switch (msg.role) {
    case 'assistant':
      return new AIMessage(msg.content);
    case 'system':
      return new SystemMessage(msg.content);
    case 'user':
    case 'human':
    default:
      return new HumanMessage(msg.content);
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
