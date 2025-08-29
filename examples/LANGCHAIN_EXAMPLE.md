# LangChain-style summarization example (copy-paste)

This library is framework-agnostic. Here’s how you might adapt a LangChain-style chat model to `SlimContextChatModel` and use `SummarizeCompressor`.

```ts
import {
  SummarizeCompressor,
  type SlimContextChatModel,
  type SlimContextMessage,
  type SlimContextModelResponse,
} from 'slimcontext';
import { ChatOpenAI } from '@langchain/openai'; // or any LangChain chat model

// Create a LangChain model (reads from env, e.g., OPENAI_API_KEY)
const lc = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });

class LangChainModel implements SlimContextChatModel {
  async invoke(messages: SlimContextMessage[]): Promise<SlimContextModelResponse> {
    // Map slimcontext messages to LangChain's format
    const lcMessages = messages.map((m) => {
      const role = m.role === 'human' ? 'user' : m.role;
      return { role, content: m.content } as {
        role: 'system' | 'user' | 'assistant';
        content: string;
      };
    });

    const res = await lc.invoke(lcMessages);
    const content =
      typeof res?.content === 'string'
        ? res.content
        : Array.isArray(res?.content)
          ? res.content.map((c: any) => c?.text ?? '').join('\n')
          : '';
    return { content };
  }
}

async function compress(history: SlimContextMessage[]) {
  const summarize = new SummarizeCompressor({
    model: new LangChainModel(),
    maxModelTokens: 8192,
    thresholdPercent: 0.75,
    minRecentMessages: 4,
  });
  return summarize.compress(history);
}

// Usage example:
// const history: SlimContextMessage[] = [ { role: 'system', content: 'You are helpful' }, ... ];
// const compact = await compress(history);
```

Notes:

- Choose any LangChain chat model; `ChatOpenAI` is just an example.
- Make sure to map roles properly (convert `'human'` to `'user'` if it appears).
- Keep the first system message, slimcontext will insert a summary when over the threshold.
