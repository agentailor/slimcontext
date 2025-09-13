import { describe, it, expect } from 'vitest';

import {
  SummarizeCompressor,
  SlimContextChatModel,
  SlimContextMessage,
  SlimContextModelResponse,
} from '../src';

describe('SummarizeCompressor', () => {
  it('inserts a summary before recent messages when over token threshold', async () => {
    const fakeModel: SlimContextChatModel = {
      async invoke(_msgs: SlimContextMessage[]): Promise<SlimContextModelResponse> {
        return { content: 'fake summary' };
      },
    };

    const summarize = new SummarizeCompressor({
      model: fakeModel,
      maxModelTokens: 400,
      thresholdPercent: 0.5, // 200 tokens
      estimateTokens: () => 50, // each message 50 tokens
      minRecentMessages: 2,
    });

    const history: SlimContextMessage[] = [
      { role: 'system', content: 'sys' },
      ...Array.from({ length: 10 }, (_, i) => ({ role: 'user' as const, content: `u${i}` })),
    ];

    const result = await summarize.compress(history);
    // Should be: system, summary, last 2 user messages
    expect(result[0].content).toBe('sys');
    expect(result[1].content).toContain('fake summary');
    expect(result.at(-2)?.content).toBe('u8');
    expect(result.at(-1)?.content).toBe('u9');
  });

  it("works when first message isn't system; only adds summary before recent messages", async () => {
    const fakeModel: SlimContextChatModel = {
      async invoke(_msgs: SlimContextMessage[]): Promise<SlimContextModelResponse> {
        return { content: 'fake summary' };
      },
    };

    const summarize = new SummarizeCompressor({
      model: fakeModel,
      maxModelTokens: 300,
      thresholdPercent: 0.5,
      estimateTokens: () => 50,
      minRecentMessages: 2,
    });

    // Start with user instead of system, then alternate and end with user
    const history: SlimContextMessage[] = [];
    for (let i = 0; i < 11; i++) {
      // Changed to 11 to ensure it ends with user
      const role = i % 2 === 0 ? 'user' : 'assistant';
      history.push({ role: role as 'user' | 'assistant', content: `${role[0]}${i}` });
    }

    const result = await summarize.compress(history);
    expect(result[0].role).toBe('system'); // summary system (no original system preserved)
    expect(result[0].content).toContain('fake summary');
    expect(result.at(-2)?.role).toBe('assistant');
    expect(result.at(-1)?.role).toBe('user');
  });

  it('skips compression when last message is not from user', async () => {
    const fakeModel: SlimContextChatModel = {
      async invoke(_msgs: SlimContextMessage[]): Promise<SlimContextModelResponse> {
        return { content: 'fake summary' };
      },
    };

    const summarize = new SummarizeCompressor({
      model: fakeModel,
      maxModelTokens: 400,
      thresholdPercent: 0.5, // 200 tokens
      estimateTokens: () => 100, // each message 100 tokens
      minRecentMessages: 2,
    });

    const history: SlimContextMessage[] = [
      { role: 'user', content: 'u1' }, // 100
      { role: 'assistant', content: 'a1' }, // 100
      { role: 'user', content: 'u2' }, // 100
      { role: 'tool', content: 'tool result' }, // 100 - last message is tool
    ]; // total 400 > threshold 200

    const result = await summarize.compress(history);
    // Should return unchanged since last message is tool
    expect(result).toEqual(history);
    expect(result.length).toBe(4);
  });

  it('skips compression when last message is from assistant', async () => {
    const fakeModel: SlimContextChatModel = {
      async invoke(_msgs: SlimContextMessage[]): Promise<SlimContextModelResponse> {
        return { content: 'fake summary' };
      },
    };

    const summarize = new SummarizeCompressor({
      model: fakeModel,
      maxModelTokens: 400,
      thresholdPercent: 0.5, // 200 tokens
      estimateTokens: () => 100, // each message 100 tokens
      minRecentMessages: 2,
    });

    const history: SlimContextMessage[] = [
      { role: 'user', content: 'u1' }, // 100
      { role: 'assistant', content: 'a1' }, // 100
      { role: 'user', content: 'u2' }, // 100
      { role: 'assistant', content: 'a2' }, // 100 - last message is assistant
    ]; // total 400 > threshold 200

    const result = await summarize.compress(history);
    // Should return unchanged since last message is assistant
    expect(result).toEqual(history);
    expect(result.length).toBe(4);
  });

  it('compresses normally when last message is from user', async () => {
    const fakeModel: SlimContextChatModel = {
      async invoke(_msgs: SlimContextMessage[]): Promise<SlimContextModelResponse> {
        return { content: 'fake summary' };
      },
    };

    const summarize = new SummarizeCompressor({
      model: fakeModel,
      maxModelTokens: 400,
      thresholdPercent: 0.5, // 200 tokens
      estimateTokens: () => 100, // each message 100 tokens
      minRecentMessages: 2,
    });

    const history: SlimContextMessage[] = [
      { role: 'assistant', content: 'a1' }, // 100
      { role: 'user', content: 'u1' }, // 100
      { role: 'assistant', content: 'a2' }, // 100
      { role: 'user', content: 'u2' }, // 100 - last message is user
    ]; // total 400 > threshold 200

    const result = await summarize.compress(history);
    // Should compress since last message is user
    expect(result.length).toBe(3); // summary + last 2 messages
    expect(result[0].role).toBe('system'); // summary
    expect(result[0].content).toContain('fake summary');
    expect(result[1]).toEqual({ role: 'assistant', content: 'a2' });
    expect(result[2]).toEqual({ role: 'user', content: 'u2' });
  });

  it('compresses normally when last message is human role', async () => {
    const fakeModel: SlimContextChatModel = {
      async invoke(_msgs: SlimContextMessage[]): Promise<SlimContextModelResponse> {
        return { content: 'fake summary' };
      },
    };

    const summarize = new SummarizeCompressor({
      model: fakeModel,
      maxModelTokens: 400,
      thresholdPercent: 0.5, // 200 tokens
      estimateTokens: () => 100, // each message 100 tokens
      minRecentMessages: 2,
    });

    const history: SlimContextMessage[] = [
      { role: 'assistant', content: 'a1' }, // 100
      { role: 'user', content: 'u1' }, // 100
      { role: 'assistant', content: 'a2' }, // 100
      { role: 'human', content: 'h1' }, // 100 - last message is human (user equivalent)
    ]; // total 400 > threshold 200

    const result = await summarize.compress(history);
    // Should compress since last message is human (equivalent to user)
    expect(result.length).toBe(3); // summary + last 2 messages
    expect(result[0].role).toBe('system'); // summary
    expect(result[0].content).toContain('fake summary');
    expect(result[1]).toEqual({ role: 'assistant', content: 'a2' });
    expect(result[2]).toEqual({ role: 'human', content: 'h1' });
  });
});
