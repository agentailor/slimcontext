import { describe, it, expect } from 'vitest';

import {
  SummarizeCompressor,
  SlimContextChatModel,
  SlimContextMessage,
  SlimContextModelResponse,
} from '../src';

describe('SummarizeCompressor', () => {
  it('inserts a summary and respects maxMessages', async () => {
    const fakeModel: SlimContextChatModel = {
      async invoke(_msgs: SlimContextMessage[]): Promise<SlimContextModelResponse> {
        return { content: 'fake summary' };
      },
    };

    const summarize = new SummarizeCompressor({ model: fakeModel, maxMessages: 6 });

    const history: SlimContextMessage[] = [
      { role: 'system', content: 'sys' },
      ...Array.from({ length: 10 }, (_, i) => ({ role: 'user' as const, content: `u${i}` })),
    ];

    const result = await summarize.compress(history);
    expect(result.length).toBeLessThanOrEqual(6);
    expect(result[0].content).toBe('sys');
    expect(result[1].content).toContain('fake summary');
  });

  it("works when first message isn't system; only reserves summary", async () => {
    const fakeModel: SlimContextChatModel = {
      async invoke(_msgs: SlimContextMessage[]): Promise<SlimContextModelResponse> {
        return { content: 'fake summary' };
      },
    };

    const summarize = new SummarizeCompressor({ model: fakeModel, maxMessages: 6 });

    // Start with user instead of system, then alternate and end with user
    const history: SlimContextMessage[] = [];
    for (let i = 0; i < 10; i++) {
      const role = i % 2 === 0 ? 'user' : 'assistant';
      history.push({ role: role as 'user' | 'assistant', content: `${role[0]}${i}` });
    }

    const result = await summarize.compress(history);
    expect(result.length).toBeLessThanOrEqual(6);
    expect(result[0].role).toBe('system'); // summary system (no original system preserved)
    expect(result[0].content).toContain('fake summary');
    expect(result[1].role).toBe('user'); // first kept remains aligned to user
  });
});

describe('SummarizeCompressor split alignment', () => {
  const fakeModel: SlimContextChatModel = {
    async invoke(_msgs: SlimContextMessage[]): Promise<SlimContextModelResponse> {
      return { content: 'fake summary' };
    },
  };

  it('shifts forward by 1 so the first kept message is a user (<= maxMessages)', async () => {
    // Use a strictly alternating conversation ending with user.
    // For maxMessages = 6 => baseRecentBudget = 4 => startIdx = len - 4.
    // With len = 10, startIdx = 6 (assistant), so forward shift to 7 (user).
    const summarize = new SummarizeCompressor({ model: fakeModel, maxMessages: 6 });
    const history: SlimContextMessage[] = [
      { role: 'system', content: 'sys' }, // 0
      { role: 'user', content: 'u1' }, // 1
      { role: 'assistant', content: 'a1' }, // 2
      { role: 'user', content: 'u2' }, // 3
      { role: 'assistant', content: 'a2' }, // 4
      { role: 'user', content: 'u3' }, // 5
      { role: 'assistant', content: 'a3' }, // 6 <- base startIdx (assistant)
      { role: 'user', content: 'u4' }, // 7 <- candidate forward (user)
      { role: 'assistant', content: 'a4' }, // 8
      { role: 'user', content: 'u5' }, // 9 (ends with user)
    ]; // len = 10

    const result = await summarize.compress(history);
    // After system + summary, the first kept should be a user
    expect(result[2].role).toBe('user');
    // Forward shift reduces total by 1
    expect(result.length).toBe(5); // maxMessages - 1
  });

  it('shifts backward by 1 when forward is not user, allowing maxMessages + 1', async () => {
    // maxMessages = 6 => baseRecentBudget = 4 => startIdx = len - 4
    const summarize = new SummarizeCompressor({ model: fakeModel, maxMessages: 6 });
    const history: SlimContextMessage[] = [
      { role: 'system', content: 'sys' }, // 0
      { role: 'user', content: 'u1' }, // 1
      { role: 'assistant', content: 'a1' }, // 2
      { role: 'user', content: 'u2' }, // 3
      { role: 'user', content: 'u2b' }, // 4 <- candidate backward (user)
      { role: 'assistant', content: 'a3' }, // 5 <- base startIdx (assistant)
      { role: 'assistant', content: 'a4' }, // 6 <- candidate forward (assistant)
      { role: 'user', content: 'u3' }, // 7
      { role: 'assistant', content: 'a5' }, // 8
    ]; // len = 9, startIdx = 5

    const result = await summarize.compress(history);
    // After system + summary, the first kept should be a user (from index 4)
    expect(result[2].role).toBe('user');
    // Backward shift increases total by 1
    expect(result.length).toBe(7); // maxMessages + 1
  });

  it('ensures first kept message is user for alternating history (maxMessages=12)', async () => {
    const summarize = new SummarizeCompressor({ model: fakeModel, maxMessages: 12 });

    // Build an alternating conversation: system, user, assistant, user, ... ending with user
    const history: SlimContextMessage[] = [{ role: 'system', content: 'sys' }];
    for (let i = 1; i <= 25; i++) {
      const role = i % 2 === 1 ? 'user' : 'assistant';
      history.push({ role: role as 'user' | 'assistant', content: `${role[0]}${i}` });
    }

    const result = await summarize.compress(history);
    expect(result[0].role).toBe('system'); // original system
    expect(result[1].role).toBe('system'); // summary system
    expect(result[2].role).toBe('user'); // first kept must be user
    // For alternating history ending with user: total becomes maxMessages - 1 (11)
    expect(result.length).toBe(11);
  });

  it('keeps exactly maxMessages when base split already lands on user', async () => {
    const summarize = new SummarizeCompressor({ model: fakeModel, maxMessages: 12 });
    // Construct length so startIdx = len - (12-2) = len - 10 is odd (user at that index)
    // Let len = 27 => startIdx = 17 (odd). Build alternating ending with user.
    const history: SlimContextMessage[] = [{ role: 'system', content: 'sys' }];
    for (let i = 1; i <= 26; i++) {
      const role = i % 2 === 1 ? 'user' : 'assistant';
      history.push({ role: role as 'user' | 'assistant', content: `${role[0]}${i}` });
    }
    const result = await summarize.compress(history);
    expect(result[0].role).toBe('system');
    expect(result[1].role).toBe('system');
    expect(result[2].role).toBe('user');
    expect(result.length).toBe(12);
  });
});
