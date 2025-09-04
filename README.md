# slimcontext

Lightweight, model-agnostic chat history compression utilities for AI assistants. Bring Your Own Model (BYOM) and use simple strategies to keep conversations concise while preserving context.

![CI](https://github.com/agentailor/slimcontext/actions/workflows/ci.yml/badge.svg)


## Examples

- OpenAI: see [examples/OPENAI_EXAMPLE.md](https://github.com/agentailor/slimcontext/blob/main/examples/OPENAI_EXAMPLE.md) (copy-paste snippet; BYOM, no deps added here).
- LangChain: see [examples/LANGCHAIN_EXAMPLE.md](https://github.com/agentailor/slimcontext/blob/main/examples/LANGCHAIN_EXAMPLE.md) and [examples/LANGCHAIN_COMPRESS_HISTORY.md](https://github.com/agentailor/slimcontext/blob/main/examples/LANGCHAIN_COMPRESS_HISTORY.md).

## Features

- Trim strategy: token-aware trimming based on your model's max tokens and a threshold.
- Summarize strategy: token-aware summarization of older messages using your own chat model.
- Framework agnostic: plug in any model wrapper implementing a minimal `invoke()` interface.
- Optional LangChain adapter with a one-call helper for compressing histories.

## Installation

```bash
npm install slimcontext
```

## Migration

Upgrading from an earlier version? See the Migration notes in the changelog:

- CHANGELOG: ./CHANGELOG.md#migration

## Core Concepts

Provide a model that implements:

```ts
interface SlimContextMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'human';
  content: string;
}
interface SlimContextModelResponse {
  content: string;
}
interface SlimContextChatModel {
  invoke(messages: SlimContextMessage[]): Promise<SlimContextModelResponse>;
}
```

`slimcontext` handles message arrays shaped as:

```ts
interface SlimContextMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'human';
  content: string;
}
```

## Usage

### TrimCompressor

```ts
import { TrimCompressor, SlimContextMessage } from 'slimcontext';

// Configure token-aware trimming
const compressor = new TrimCompressor({
  // Optional: defaults shown
  maxModelTokens: 8192, // your model's context window
  thresholdPercent: 0.7, // start trimming after 70% of maxModelTokens
  minRecentMessages: 2, // always keep at least last 2 messages
  // Optional estimator; default is a len/4 heuristic
  // estimateTokens: (m) => yourCustomTokenCounter(m),
});

let history: SlimContextMessage[] = [
  { role: 'system', content: 'You are a helpful assistant.' },
  // ... conversation grows
];

history = await compressor.compress(history);
```

### SummarizeCompressor

```ts
import {
  SummarizeCompressor,
  SlimContextMessage,
  SlimContextChatModel,
  SlimContextModelResponse,
} from 'slimcontext';

class MyModel implements SlimContextChatModel {
  async invoke(messages: SlimContextMessage[]): Promise<SlimContextModelResponse> {
    // Call out to your LLM provider (OpenAI, Anthropic, etc.)
    const userContent = messages.find((m) => m.role === 'user')?.content || '';
    return { content: 'Summary: ' + userContent.slice(0, 100) };
  }
}

const model = new MyModel();
const compressor = new SummarizeCompressor({
  model,
  // Optional: defaults shown
  maxModelTokens: 8192,
  thresholdPercent: 0.7, // summarize once total tokens exceed 70%
  minRecentMessages: 4, // keep at least last 4 messages verbatim
  // estimateTokens: (m) => yourCustomTokenCounter(m),
  // prompt: '...custom summarization instructions...'
});

let history: SlimContextMessage[] = [
  { role: 'system', content: 'You are a helpful assistant.' },
  // ... conversation grows
];

history = await compressor.compress(history);
```

Notes about summarization behavior

- When the estimated total tokens exceed the threshold, the oldest portion (excluding a leading system message) is summarized into a single system message inserted before the recent tail.
- The most recent `minRecentMessages` are always preserved verbatim.

### Strategy Combination Example

You can chain strategies depending on token thresholds or other heuristics.


## Example Integration

- See [examples/OPENAI_EXAMPLE.md](https://github.com/agentailor/slimcontext/blob/main/examples/OPENAI_EXAMPLE.md) for an OpenAI copy-paste snippet.
- See [examples/LANGCHAIN_EXAMPLE.md](https://github.com/agentailor/slimcontext/blob/main/examples/LANGCHAIN_EXAMPLE.md) for a LangChain-style integration.
- See [examples/LANGCHAIN_COMPRESS_HISTORY.md](https://github.com/agentailor/slimcontext/blob/main/examples/LANGCHAIN_COMPRESS_HISTORY.md) for a one-call LangChain history compression helper.

## Adapters

### LangChain

If you already use LangChain chat models, you can use the built-in adapter. It’s exported in two ways:

- Namespaced: `import { langchain } from 'slimcontext'`
- Direct path: `import * as langchain from 'slimcontext/adapters/langchain'`

Common helpers:

- `compressLangChainHistory(history, options)` – one-call compression for LangChain `BaseMessage[]`.
- `toSlimModel(llm)` – wrap a LangChain `BaseChatModel` for `SummarizeCompressor`.

Example (one-call history compression):

```ts
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import { langchain } from 'slimcontext';

const lc = new ChatOpenAI({ model: 'gpt-5-mini', temperature: 0 });

const history = [
  new SystemMessage('You are helpful.'),
  new HumanMessage('Please summarize the discussion so far.'),
  new AIMessage('Certainly!'),
  // ...more messages
];

const compact = await langchain.compressLangChainHistory(history, {
  strategy: 'summarize',
  llm: lc, // BaseChatModel
  maxModelTokens: 8192,
  thresholdPercent: 0.8, // summarize beyond 80% of context window
  minRecentMessages: 4,
});
```

See [examples/LANGCHAIN_COMPRESS_HISTORY.md](https://github.com/agentailor/slimcontext/blob/main/examples/LANGCHAIN_COMPRESS_HISTORY.md) for a fuller copy-paste example.

## API

### Classes

- `TrimCompressor({ maxModelTokens?, thresholdPercent?, estimateTokens?, minRecentMessages? })`
- `SummarizeCompressor({ model, maxModelTokens?, thresholdPercent?, estimateTokens?, minRecentMessages?, prompt? })`

### Interfaces

- `SlimContextMessage`
- `SlimContextChatModel`
- `SlimContextCompressor`
- `SlimContextModelResponse`

## License

MIT
