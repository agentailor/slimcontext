# LangChain one-call history compression

This example shows how to use `compressLangChainHistory` to compress a LangChain message history in a single call.

```ts
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { langchain } from 'slimcontext';

// 1) Create your LangChain chat model (any BaseChatModel works)
const llm = new ChatOpenAI({ model: 'gpt-4o-mini', temperature: 0 });

// 2) Build your existing LangChain-compatible history
const history = [
  new SystemMessage('You are a helpful assistant.'),
  new HumanMessage('Hi! Help me plan a 3-day trip to Tokyo.'),
  new AIMessage('Sure, what are your interests?'),
  // ... many more messages
];

// 3) Compress with either summarize (default) or trim strategy
const compact = await langchain.compressLangChainHistory(history, {
  strategy: 'summarize',
  llm, // pass your BaseChatModel
  maxModelTokens: 8192,
  thresholdPercent: 0.8,
  minRecentMessages: 4,
});

// Alternatively, use trimming without an LLM:
const trimmed = await langchain.compressLangChainHistory(history, {
  strategy: 'trim',
  maxModelTokens: 8192,
  thresholdPercent: 0.8,
  minRecentMessages: 4,
});

console.log('Original size:', history.length);
console.log('Summarized size:', compact.length);
console.log('Trimmed size:', trimmed.length);
```

Notes

- `@langchain/core` is an optional peer dependency. Install it only if you use the adapter.
- Summarize strategy summarizes older content when total tokens exceed `thresholdPercent * maxModelTokens`.
