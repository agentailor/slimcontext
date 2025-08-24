import { SlimContextCompressor, SlimContextChatModel, SlimContextMessage } from '../interfaces';

const DEFAULT_SUMMARY_PROMPT =
  'You are an expert conversation summarizer. Condense the following dialogue into a concise paragraph, retaining all key facts, entities, decisions, and user intent. Output only the summary.';

export interface SummarizeConfig {
  model: SlimContextChatModel;
  maxMessages: number; // total messages desired after compression (including system + summary + retained recent messages)
  prompt?: string;
}

/**
 * SummarizeCompressor summarizes the middle portion of the conversation when it grows beyond maxMessages.
 * It keeps the original first system message, injects a synthetic summary system message, and retains
 * the most recent messages up to the maxMessages budget.
 */
export class SummarizeCompressor implements SlimContextCompressor {
  private readonly model: SlimContextChatModel;
  private readonly maxMessages: number;
  private readonly summaryPrompt: string;

  constructor(config: SummarizeConfig) {
    if (config.maxMessages < 4) {
      throw new Error(
        'maxMessages should be at least 4 to allow system + summary + 2 recent messages',
      );
    }
    this.model = config.model;
    this.maxMessages = config.maxMessages;
    this.summaryPrompt = config.prompt || DEFAULT_SUMMARY_PROMPT;
  }

  async compress(messages: SlimContextMessage[]): Promise<SlimContextMessage[]> {
    if (messages.length <= this.maxMessages) {
      return messages;
    }

    const systemMessage = messages[0];
    // Decide where the kept tail should start (ensuring it starts with a user message when possible)
    const startIdx = this.computeKeepStartIndex(messages);
    const messagesToKeep = messages.slice(startIdx);

    // Everything between the first system message and the slice we keep is summarized
    const endOfSummarizedIndex = startIdx; // non-inclusive
    const messagesToSummarize = messages.slice(1, endOfSummarizedIndex);

    const conversationText = messagesToSummarize
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n---\n');

    const promptMessages: SlimContextMessage[] = [
      { role: 'system', content: this.summaryPrompt },
      { role: 'user', content: conversationText },
    ];

    const response = await this.model.invoke(promptMessages);
    const summaryText = response.content;

    const summaryMessage: SlimContextMessage = {
      role: 'system',
      content: `[Context from a summarized portion of the conversation between you and the user]: ${summaryText}`,
    };

    return [systemMessage, summaryMessage, ...messagesToKeep];
  }

  /**
   * Compute the start index of the kept tail after inserting a summary.
   * Default budget keeps: system + summary + (maxMessages - 2) recent messages.
   * To keep conversation turn consistency, we try to ensure the first kept message is a 'user'.
   * If the default split lands on a non-user, we first try shifting forward by 1 (<= maxMessages),
   * otherwise we try shifting backward by 1 (allowing maxMessages + 1 total).
   */
  private computeKeepStartIndex(messages: SlimContextMessage[]): number {
    const baseRecentBudget = this.maxMessages - 2;
    let startIdx = messages.length - baseRecentBudget;

    // Guardrails: ensure startIdx within [1, messages.length)
    if (startIdx < 1) startIdx = 1;
    if (startIdx >= messages.length) startIdx = messages.length - 1;

    const firstKept = messages[startIdx];
    if (firstKept && firstKept.role !== 'user') {
      // Try shifting forward by 1 (dropping one more from summarized middle)
      if (startIdx + 1 < messages.length) {
        const candidate = messages[startIdx + 1];
        if (candidate.role === 'user') {
          return startIdx + 1;
        }
      }
      // Otherwise, try shifting backward by 1 (keeping one more, allowing +1 over max)
      if (startIdx - 1 >= 1) {
        const candidateBack = messages[startIdx - 1];
        if (candidateBack.role === 'user') {
          return startIdx - 1;
        }
      }
    }
    return startIdx;
  }
}
