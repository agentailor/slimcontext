import { describe, it, expect } from 'vitest';
import { TrimCompressor, Message } from '../src';

describe('TrimCompressor', () => {
  it('keeps first system and last N-1 messages', async () => {
    const trim = new TrimCompressor({ messagesToKeep: 5 });
    const history: Message[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'u1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'u2' },
      { role: 'assistant', content: 'a2' },
      { role: 'user', content: 'u3' },
    ];

    const trimmed = await trim.compress(history);
    expect(trimmed.length).toBe(5);
    expect(trimmed[0]).toEqual({ role: 'system', content: 'sys' });
    expect(trimmed.at(-1)).toEqual({ role: 'user', content: 'u3' });
  });
});
