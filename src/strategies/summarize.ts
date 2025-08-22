import { ICompressor, IChatModel, Message, BaseMessage } from '../interfaces';

const DEFAULT_SUMMARY_PROMPT = 'You are an expert conversation summarizer. Condense the following dialogue into a concise paragraph, retaining all key facts, entities, decisions, and user intent. Output only the summary.';

export interface SummarizeConfig {
  model: IChatModel;
  maxMessages: number; // total messages desired after compression (including system + summary + retained recent messages)
  prompt?: string;
}

/**
 * SummarizeCompressor summarizes the middle portion of the conversation when it grows beyond maxMessages.
 * It keeps the original first system message, injects a synthetic summary system message, and retains
 * the most recent messages up to the maxMessages budget.
 */
export class SummarizeCompressor implements ICompressor {
  private readonly model: IChatModel;
  private readonly maxMessages: number;
  private readonly summaryPrompt: string;

  constructor(config: SummarizeConfig) {
    if (config.maxMessages < 4) {
      throw new Error('maxMessages should be at least 4 to allow system + summary + 2 recent messages');
    }
    this.model = config.model;
    this.maxMessages = config.maxMessages;
    this.summaryPrompt = config.prompt || DEFAULT_SUMMARY_PROMPT;
  }

  async compress(messages: Message[]): Promise<Message[]> {
    if (messages.length <= this.maxMessages) {
      return messages;
    }

    const systemMessage = messages[0];
    // We'll keep: system, summary, and (maxMessages - 2) recent messages
    const recentBudget = this.maxMessages - 2;
    const messagesToKeep = messages.slice(-recentBudget);

    // Everything between the first system message and the slice we keep is summarized
    const endOfSummarizedIndex = messages.length - recentBudget; // non-inclusive
    const messagesToSummarize = messages.slice(1, endOfSummarizedIndex);

    const conversationText = messagesToSummarize
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n---\n');

    const promptMessages: BaseMessage[] = [
      { role: 'system', content: this.summaryPrompt },
      { role: 'user', content: conversationText },
    ];

    const response = await this.model.invoke(promptMessages);
    const summaryText = response.content;

    const summaryMessage: Message = {
      role: 'system',
      content: `[Context from a summarized portion of the conversation]: ${summaryText}`,
    };

    return [systemMessage, summaryMessage, ...messagesToKeep];
  }
}
