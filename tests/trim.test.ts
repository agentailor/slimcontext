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

  it('skips compression when last message is not from user', async () => {
    const estimate = (_m: SlimContextMessage) => 100;
    const trim = new TrimCompressor({
      maxModelTokens: 400,
      thresholdPercent: 0.5, // threshold = 200
      estimateTokens: estimate,
      minRecentMessages: 2,
    });

    const history: SlimContextMessage[] = [
      { role: 'user', content: 'u1' }, // 100
      { role: 'assistant', content: 'a1' }, // 100
      { role: 'user', content: 'u2' }, // 100
      { role: 'tool', content: 'tool result' }, // 100 - last message is tool
    ]; // total 400 > threshold 200

    const result = await trim.compress(history);
    // Should return unchanged since last message is tool
    expect(result).toEqual(history);
    expect(result.length).toBe(4);
  });

  it('skips compression when last message is from assistant', async () => {
    const estimate = (_m: SlimContextMessage) => 100;
    const trim = new TrimCompressor({
      maxModelTokens: 400,
      thresholdPercent: 0.5, // threshold = 200
      estimateTokens: estimate,
      minRecentMessages: 2,
    });

    const history: SlimContextMessage[] = [
      { role: 'user', content: 'u1' }, // 100
      { role: 'assistant', content: 'a1' }, // 100
      { role: 'user', content: 'u2' }, // 100
      { role: 'assistant', content: 'a2' }, // 100 - last message is assistant
    ]; // total 400 > threshold 200

    const result = await trim.compress(history);
    // Should return unchanged since last message is assistant
    expect(result).toEqual(history);
    expect(result.length).toBe(4);
  });

  it('compresses normally when last message is from user', async () => {
    const estimate = (_m: SlimContextMessage) => 100;
    const trim = new TrimCompressor({
      maxModelTokens: 400,
      thresholdPercent: 0.5, // threshold = 200
      estimateTokens: estimate,
      minRecentMessages: 2,
    });

    const history: SlimContextMessage[] = [
      { role: 'assistant', content: 'a1' }, // 100
      { role: 'user', content: 'u1' }, // 100
      { role: 'assistant', content: 'a2' }, // 100
      { role: 'user', content: 'u2' }, // 100 - last message is user
    ]; // total 400 > threshold 200

    const result = await trim.compress(history);
    // Should compress since last message is user
    expect(result.length).toBe(2); // Only last 2 messages preserved
    expect(result[0]).toEqual({ role: 'assistant', content: 'a2' });
    expect(result[1]).toEqual({ role: 'user', content: 'u2' });
  });

  it('compresses normally when last message is human role', async () => {
    const estimate = (_m: SlimContextMessage) => 100;
    const trim = new TrimCompressor({
      maxModelTokens: 400,
      thresholdPercent: 0.5, // threshold = 200
      estimateTokens: estimate,
      minRecentMessages: 2,
    });

    const history: SlimContextMessage[] = [
      { role: 'assistant', content: 'a1' }, // 100
      { role: 'user', content: 'u1' }, // 100
      { role: 'assistant', content: 'a2' }, // 100
      { role: 'human', content: 'h1' }, // 100 - last message is human (user equivalent)
    ]; // total 400 > threshold 200

    const result = await trim.compress(history);
    // Should compress since last message is human (equivalent to user)
    expect(result.length).toBe(2); // Only last 2 messages preserved
    expect(result[0]).toEqual({ role: 'assistant', content: 'a2' });
    expect(result[1]).toEqual({ role: 'human', content: 'h1' });
  });
});
