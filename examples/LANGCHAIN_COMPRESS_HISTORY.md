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
  maxMessages: 12, // target total messages after compression (system + summary + recent)
});

// Alternatively, use trimming without an LLM:
const trimmed = await langchain.compressLangChainHistory(history, {
  strategy: 'trim',
  messagesToKeep: 8,
});

console.log('Original size:', history.length);
console.log('Summarized size:', compact.length);
console.log('Trimmed size:', trimmed.length);
```

Notes

- `@langchain/core` is an optional peer dependency. Install it only if you use the adapter.
- `maxMessages` must be at least 4 for summarize (system + summary + 2 recent).
