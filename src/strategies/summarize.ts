import {
  SlimContextCompressor,
  SlimContextChatModel,
  SlimContextMessage,
  type TokenBudgetConfig,
} from '../interfaces';
import { normalizeBudgetConfig, computeThresholdTokens } from './common';

const DEFAULT_SUMMARY_PROMPT = `
You are a conversation summarizer.
You will receive a transcript of a conversation in the following format:

<format>
user : user message
assistant : assistant message
...
</format>

Your task is to produce a concise summary of the conversation that can be used as a system message for continuing the dialogue.

Guidelines:

- Capture all important facts, decisions, user goals, and assistant outputs.

- Preserve any constraints, preferences, or instructions given by the user.

- Omit small talk, filler, or irrelevant details.

- Be concise, but include enough information so the assistant can seamlessly continue the conversation without the full transcript.

- Write the summary in neutral, factual style (not conversational).

Output format (only the summary, no additional text): <summary here>

Example:
Input transcript:
user : I want to build an AI agent in TypeScript that can search Google and store notes in Notion.  
assistant : You could use LangGraph.js with a Google Search tool and a Notion connector. Do you want me to scaffold an example?  
user : Yes, but make it simple first without authentication.  
assistant : Sure, I’ll prepare a minimal scaffold with those two tools integrated.  

Output:
The user wants an AI agent in TypeScript using LangGraph.js with Google Search and Notion integration.  
They prefer a simple scaffold without authentication.  
The assistant suggested creating an example, and the user agreed.  

`;

export interface SummarizeConfig extends TokenBudgetConfig {
  model: SlimContextChatModel;
  /** Prompt used to produce the summary */
  prompt?: string;
}

/**
 * SummarizeCompressor summarizes older messages when the estimated total tokens exceed
 * a configurable threshold of the model's max context window. It preserves the leading
 * system message (if present), injects a synthetic system summary, and retains the most
 * recent `minRecentMessages` verbatim.
 */
export class SummarizeCompressor implements SlimContextCompressor {
  private readonly model: SlimContextChatModel;
  private readonly summaryPrompt: string;
  private cfg: ReturnType<typeof normalizeBudgetConfig>;

  constructor(config: SummarizeConfig) {
    this.model = config.model;
    this.cfg = normalizeBudgetConfig(config, { minRecentDefault: 4 });
    this.summaryPrompt = config.prompt || DEFAULT_SUMMARY_PROMPT;
  }

  /**
   * Compress the conversation history by summarizing the middle portion.
   */
  async compress(messages: SlimContextMessage[]): Promise<SlimContextMessage[]> {
    const thresholdTokens = computeThresholdTokens(
      this.cfg.maxModelTokens,
      this.cfg.thresholdPercent,
    );
    const tokenCounts = messages.map((m) => this.cfg.estimateTokens(m));
    const total = tokenCounts.reduce((a, b) => a + b, 0);

    if (total <= thresholdTokens) return messages;

    // We'll keep the last `minRecentMessages` untouched, and summarize everything before them
    const keepTailStart = Math.max(0, messages.length - this.cfg.minRecentMessages);
    const hasSystemFirst = messages[0]?.role === 'system';
    const systemMessage = hasSystemFirst ? messages[0] : undefined;

    // Exclude leading system from summary input; we re-insert it unchanged
    const summarizeStart = hasSystemFirst ? 1 : 0;
    const messagesToSummarize = messages.slice(summarizeStart, keepTailStart);

    // If there is barely anything to summarize, just return messages
    if (messagesToSummarize.length === 0) return messages;

    const conversationText = messagesToSummarize
      .map((msg) => `${msg.role}: ${msg.content}`)
      .join('\n---\n');

    const promptMessages: SlimContextMessage[] = [
      { role: 'system', content: this.summaryPrompt },
      { role: 'user', content: `Input transcript: \n ${conversationText}` },
    ];

    const response = await this.model.invoke(promptMessages);
    const summaryText = response.content;

    const summaryMessage: SlimContextMessage = {
      role: 'system',
      content: `${summaryText}`,
    };

    const keptTail = messages.slice(keepTailStart);
    const result: SlimContextMessage[] = [];
    if (systemMessage) result.push(systemMessage);
    result.push(summaryMessage, ...keptTail);

    return result;
  }
}
