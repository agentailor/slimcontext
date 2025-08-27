import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

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
 * Normalize LangChain BaseMessage.getType() to SlimContext role.
 * Tool messages are treated as assistant for compression purposes.
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

/** Convert a LangChain BaseMessage to a SlimContextMessage used by compression. */
export function baseToSlim(msg: BaseMessage): SlimContextMessage {
  const t = msg as unknown as { _getType?: () => string; getType?: () => string };
  const type = t._getType?.() ?? t.getType?.() ?? 'human';
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
    const res = await this.llm.invoke(lcMessages as unknown as BaseMessage[]);
    const content = extractContent((res as unknown as { content?: unknown })?.content);
    return { content };
  }
}

/** Create a SlimContextChatModel from a LangChain BaseChatModel. */
export function toSlimModel(llm: BaseChatModel): SlimContextChatModel {
  return new LangChainSlimModel(llm);
}

/** Convenience: build a SummarizeCompressor for LangChain models. */
export function createSummarizeCompressorForLangChain(
  llm: BaseChatModel,
  config: Omit<SummarizeConfig, 'model'>,
): SummarizeCompressor {
  return new SummarizeCompressor({ model: toSlimModel(llm), ...config });
}

/** Convenience: build a TrimCompressor. */
export function createTrimCompressor(config: TrimConfig): TrimCompressor {
  return new TrimCompressor(config);
}

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
