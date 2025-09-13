import type { SlimContextMessage, TokenBudgetConfig, TokenEstimator } from '../interfaces';

// Default constants for token budgeting
export const DEFAULT_MAX_MODEL_TOKENS = 8192;
export const DEFAULT_THRESHOLD_PERCENT = 0.7; // 70%
export const DEFAULT_MIN_RECENT_MESSAGES = 10; // strategy-specific override allowed
export const DEFAULT_ESTIMATOR_TOKEN_BIAS = 2;

/** Common token-budget fields shared by strategies. */
export interface NormalizedBudgetConfig {
  maxModelTokens: number;
  thresholdPercent: number;
  estimateTokens: TokenEstimator;
  minRecentMessages: number;
}
/** Default token estimator: rough approximation len/4 + 2. */
export const DEFAULT_ESTIMATOR: TokenEstimator = (m: SlimContextMessage) =>
  Math.ceil(m.content.length / 4) + DEFAULT_ESTIMATOR_TOKEN_BIAS;

/** Normalize token-budget config with strategy-specific defaults. */
export function normalizeBudgetConfig(
  config: TokenBudgetConfig,
  options?: { minRecentDefault?: number },
): NormalizedBudgetConfig {
  const minRecentDefault = options?.minRecentDefault ?? DEFAULT_MIN_RECENT_MESSAGES;
  return {
    maxModelTokens: config.maxModelTokens ?? DEFAULT_MAX_MODEL_TOKENS,
    thresholdPercent: config.thresholdPercent ?? DEFAULT_THRESHOLD_PERCENT,
    estimateTokens: config.estimateTokens ?? DEFAULT_ESTIMATOR,
    minRecentMessages: Math.max(0, config.minRecentMessages ?? minRecentDefault),
  };
}

/** Compute threshold token budget. */
export function computeThresholdTokens(maxModelTokens: number, thresholdPercent: number): number {
  return Math.floor(maxModelTokens * thresholdPercent);
}

/** Estimate the total tokens for an array of messages. */
export function estimateTotalTokens(
  messages: SlimContextMessage[],
  estimateTokens: TokenEstimator,
): number {
  if (messages.length === 0) return 0;
  let total = 0;
  for (const m of messages) total += estimateTokens(m);
  return total;
}

/**
 * Check if compression should be allowed based on the last message type.
 * Only compress when the last message is from a user to avoid disrupting tool use cycles.
 */
export function shouldAllowCompression(messages: SlimContextMessage[]): boolean {
  if (messages.length === 0) return false;
  const lastMessage = messages[messages.length - 1];
  return lastMessage.role === 'user' || lastMessage.role === 'human';
}
