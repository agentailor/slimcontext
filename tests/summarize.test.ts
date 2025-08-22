import { describe, it, expect } from 'vitest';
import { SummarizeCompressor, IChatModel, BaseMessage, ModelResponse, Message } from '../src';

describe('SummarizeCompressor', () => {
  it('inserts a summary and respects maxMessages', async () => {
    const fakeModel: IChatModel = {
      async invoke(_msgs: BaseMessage[]): Promise<ModelResponse> {
        return { content: 'fake summary' };
      }
    };

    const summarize = new SummarizeCompressor({ model: fakeModel, maxMessages: 6 });

    const history: Message[] = [
      { role: 'system', content: 'sys' },
      ...Array.from({ length: 10 }, (_, i) => ({ role: 'user' as const, content: `u${i}` }))
    ];

    const result = await summarize.compress(history);
    expect(result.length).toBeLessThanOrEqual(6);
    expect(result[0].content).toBe('sys');
    expect(result[1].content).toContain('fake summary');
  });
});
