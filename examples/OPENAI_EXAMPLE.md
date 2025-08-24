# OpenAI summarization example (copy-paste)

This project is BYOM (bring your own model). To use OpenAI for summarization without adding deps to this repo, copy the snippet below into your app and install `openai` there.

```ts
import {
  SummarizeCompressor,
  type SlimContextChatModel,
  type SlimContextMessage,
  type SlimContextModelResponse,
} from 'slimcontext';
import OpenAI from 'openai';

const client = new OpenAI();

class OpenAIModel implements SlimContextChatModel {
  async invoke(msgs: SlimContextMessage[]): Promise<SlimContextModelResponse> {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: msgs.map((m) => ({
        role: m.role === 'human' ? 'user' : (m.role as 'system' | 'user' | 'assistant'),
        content: m.content,
      })),
    });
    return { content: response.choices?.[0]?.message?.content ?? '' };
  }
}

async function main() {
  const history: SlimContextMessage[] = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Hello' },
    // ... conversation grows
  ];

  const summarize = new SummarizeCompressor({ model: new OpenAIModel(), maxMessages: 10 });
  const compressed = await summarize.compress(history);

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: compressed
      .filter((m) => m.role !== 'tool')
      .map((m) => ({ role: m.role as 'system' | 'user' | 'assistant', content: m.content })),
  });

  console.log(completion.choices?.[0]?.message?.content ?? '');
}

main();
```

Notes:

- Set `OPENAI_API_KEY` in your environment.
- Pick any chat model available in your account (e.g., `gpt-4o`, `gpt-4.1-mini`, etc.).
- You can swap OpenAI for any provider by implementing `SlimContextChatModel`.
