// Core interfaces for slimcontext

// Single message shape used across the library and adapters.
// Includes 'human' (alias some frameworks use) and 'tool' for compatibility.
export interface SlimContextMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'human';
  content: string;
}

export interface SlimContextModelResponse {
  content: string;
}

export interface SlimContextChatModel {
  invoke(messages: SlimContextMessage[]): Promise<SlimContextModelResponse>;
}

export interface SlimContextCompressor {
  compress(messages: SlimContextMessage[]): Promise<SlimContextMessage[]>;
}

export interface TokenBudgetConfig {
  /** Model's maximum token context window. Default: 8192. */
  maxModelTokens?: number;
  /** Percentage threshold to trigger compression (0-1). Default: 0.7. */
  thresholdPercent?: number;
  /** Custom token estimator for messages. Default: len/4 heuristic. */
  estimateTokens?: TokenEstimator;
  /** Minimum recent messages to always preserve. Strategy-specific default. */
  minRecentMessages?: number;
}

// Token estimation callback for model-agnostic budgeting.
// Return an estimated token count for a single message.
export type TokenEstimator = (message: SlimContextMessage) => number;
