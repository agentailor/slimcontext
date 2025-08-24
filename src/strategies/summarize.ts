import { SlimContextCompressor, SlimContextChatModel, SlimContextMessage } from '../interfaces';

const DEFAULT_SUMMARY_PROMPT = `
You are an expert conversation summarizer. You'll receive an excerpt of a chat transcript to condense.

Goals:
- Be concise while retaining key facts, entities, user intent, decisions, follow-ups, and resolutions.
- Preserve important numbers, dates, IDs (truncate if long), and constraints.

When tool messages are present (role: tool or similar):
- Briefly note which tool(s) were called, why (the user/assistant intent), and the high-level outcome.
- Do NOT copy raw JSON, logs, or code. Extract only salient fields (e.g., status, count/total, top IDs, amounts, dates, error messages).
- If outputs are very long, compress to 1–2 sentences. Truncate long IDs (e.g., abc…123) and omit secrets.
- If multiple tools were called for the same purpose, summarize them together.
- If a tool failed or contradicted prior assumptions, note the discrepancy.

Output format:
- Output only the summary as a single concise paragraph (2–5 sentences). No preface, no headings.

Examples:
Input (excerpt):
user: Please find docs about OAuth token errors in our KB
assistant: I will search the knowledge base
assistant: calling search_kb with query "OAuth token expired"
tool: { "results": [ { "title": "Token expired", "fix": "Refresh or sync clock" }, { "title": "Clock skew", "fix": "NTP sync" } ] }
assistant: The docs suggest refreshing tokens and checking clock skew

Summary:
User requested guidance on OAuth token errors. Assistant searched the KB; the tool returned articles about token expiration and clock skew. Assistant advised refreshing tokens and ensuring time sync.
`;

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

  /**
   * Compress the conversation history by summarizing the middle portion.
   */
  async compress(messages: SlimContextMessage[]): Promise<SlimContextMessage[]> {
    if (messages.length <= this.maxMessages) {
      return messages;
    }

    const hasSystemFirst = messages[0]?.role === 'system';
    const systemMessage = hasSystemFirst ? messages[0] : undefined;
    // Decide where the kept tail should start (ensuring it starts with a user message when possible)
    const startIdx = this.computeKeepStartIndex(messages, hasSystemFirst);
    const messagesToKeep = messages.slice(startIdx);

    // Everything between the first system message and the slice we keep is summarized
    const endOfSummarizedIndex = startIdx; // non-inclusive
    const summarizeStart = hasSystemFirst ? 1 : 0;
    const messagesToSummarize = messages.slice(summarizeStart, endOfSummarizedIndex);

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

    if (hasSystemFirst && systemMessage) {
      return [systemMessage, summaryMessage, ...messagesToKeep];
    }
    return [summaryMessage, ...messagesToKeep];
  }

  /**
   * Compute the start index of the kept tail after inserting a summary.
   * Default budget keeps: system + summary + (maxMessages - 2) recent messages.
   * To keep conversation turn consistency, we try to ensure the first kept message is a 'user'.
   * If the default split lands on a non-user, we first try shifting forward by 1 (<= maxMessages),
   * otherwise we try shifting backward by 1 (allowing maxMessages + 1 total).
   */
  private computeKeepStartIndex(messages: SlimContextMessage[], hasSystemFirst: boolean): number {
    const reservedSlots = hasSystemFirst ? 2 : 1; // system? + summary
    const baseRecentBudget = this.maxMessages - reservedSlots;
    let startIdx = messages.length - baseRecentBudget;

    // Guardrails: ensure startIdx within [minStart, messages.length)
    const minStart = hasSystemFirst ? 1 : 0;
    if (startIdx < minStart) startIdx = minStart;
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
      if (startIdx - 1 >= minStart) {
        const candidateBack = messages[startIdx - 1];
        if (candidateBack.role === 'user') {
          return startIdx - 1;
        }
      }
    }
    return startIdx;
  }
}
