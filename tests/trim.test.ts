import { describe, it, expect } from 'vitest';

import { TrimCompressor, SlimContextMessage } from '../src';

describe('TrimCompressor', () => {
  it('drops oldest non-system messages until under threshold (preserves system + recent)', async () => {
    const estimate = (_m: SlimContextMessage) => 100; // deterministic
    const trim = new TrimCompressor({
      maxModelTokens: 400,
      thresholdPercent: 0.5, // threshold = 200
      estimateTokens: estimate,
      minRecentMessages: 2,
    });
    const history: SlimContextMessage[] = [
      { role: 'system', content: 'sys' }, // 100
      { role: 'user', content: 'u1' }, // 100
      { role: 'assistant', content: 'a1' }, // 100
      { role: 'user', content: 'u2' }, // 100
      { role: 'assistant', content: 'a2' }, // 100
      { role: 'user', content: 'u3' }, // 100
    ]; // total 600 > threshold 200

    const trimmed = await trim.compress(history);
    // We expect to preserve the system and last 2 messages when possible
    expect(trimmed[0]).toEqual({ role: 'system', content: 'sys' });
    expect(trimmed.at(-2)).toEqual({ role: 'assistant', content: 'a2' });
    expect(trimmed.at(-1)).toEqual({ role: 'user', content: 'u3' });
    // Older non-system messages should be dropped
    expect(trimmed.length).toBe(3);
  });
});
