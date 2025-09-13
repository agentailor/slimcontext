import { SlimContextCompressor, SlimContextMessage, type TokenBudgetConfig } from '../interfaces';
import { normalizeBudgetConfig, computeThresholdTokens, shouldAllowCompression } from './common';

/**
 * Trim configuration options for the TrimCompressor using token thresholding.
 */
export type TrimConfig = TokenBudgetConfig;

/**
 * TrimCompressor drops the oldest non-system messages until the estimated token
 * usage falls below the configured threshold, preserving any system messages and
 * the most recent conversation turns.
 */
export class TrimCompressor implements SlimContextCompressor {
  private cfg: ReturnType<typeof normalizeBudgetConfig>;

  constructor(config: TrimConfig) {
    this.cfg = normalizeBudgetConfig(config, { minRecentDefault: 2 });
  }

  async compress(messages: SlimContextMessage[]): Promise<SlimContextMessage[]> {
    // Only compress when the last message is from a user to avoid disrupting tool use cycles
    if (!shouldAllowCompression(messages)) {
      return messages;
    }

    const thresholdTokens = computeThresholdTokens(
      this.cfg.maxModelTokens,
      this.cfg.thresholdPercent,
    );

    // Compute total tokens
    const tokenCounts = messages.map((m) => this.cfg.estimateTokens(m));
    let total = tokenCounts.reduce((a, b) => a + b, 0);
    if (total <= thresholdTokens) return messages;

    // Determine the earliest index we are allowed to drop up to, preserving recent messages
    const preserveFromIndex = Math.max(0, messages.length - this.cfg.minRecentMessages);

    const keepMask = new Array(messages.length).fill(true);

    // Drop from the oldest non-system messages forward until under threshold,
    // but never drop system messages or any message within the last `minRecentMessages`.
    for (let i = 0; i < messages.length && total > thresholdTokens; i++) {
      const msg = messages[i];
      const isRecentProtected = i >= preserveFromIndex;
      const isSystem = msg.role === 'system';
      if (isRecentProtected || isSystem) continue;
      // Drop it
      keepMask[i] = false;
      total -= tokenCounts[i];
    }

    // If still over threshold (e.g., many system messages or very long recent messages),
    // continue dropping from the left side before the preserved tail, still skipping systems.
    for (let i = 0; i < preserveFromIndex && total > thresholdTokens; i++) {
      if (!keepMask[i]) continue;
      const msg = messages[i];
      if (msg.role === 'system') continue;
      keepMask[i] = false;
      total -= tokenCounts[i];
    }

    const result: SlimContextMessage[] = [];
    for (let i = 0; i < messages.length; i++) {
      if (keepMask[i]) result.push(messages[i]);
    }
    return result;
  }
}
