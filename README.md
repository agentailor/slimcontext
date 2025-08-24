# slimcontext

Lightweight, model-agnostic chat history compression utilities for AI assistants. Bring Your Own Model (BYOM) and use simple strategies to keep conversations concise while preserving context.

![CI](https://github.com/agentailor/slimcontext/actions/workflows/ci.yml/badge.svg)

## Examples

- OpenAI: see `examples/OPENAI_EXAMPLE.md` (copy-paste snippet; BYOM, no deps added here).
- LangChain: see `examples/LANGCHAIN_EXAMPLE.md` (adapts a LangChain chat model to `SlimContextChatModel`).

## Features

- Trim strategy: keep the first (system) message and last N messages.
- Summarize strategy: summarize the middle portion using your own chat model.
- Framework agnostic: plug in any model wrapper implementing a minimal `invoke()` interface.

## Installation

```bash
npm install slimcontext
```

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

const compressor = new TrimCompressor({ messagesToKeep: 8 });

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
const compressor = new SummarizeCompressor({ model, maxMessages: 12 });

let history: SlimContextMessage[] = [
  { role: 'system', content: 'You are a helpful assistant.' },
  // ... conversation grows
];

history = await compressor.compress(history);
```

Notes about summarization behavior

- Alignment: after compression, messages will start with `[system, summary, ...]`, and the first kept message after the summary is always a `user` turn. This preserves dialogue consistency.
- Size: to keep this alignment and preserve recency, the output length can be `maxMessages - 1`, `maxMessages`, or `maxMessages + 1`.
  - Preference: if the default split lands on an assistant, we first try shifting forward by 1 (staying within `maxMessages`). If that still isn’t a user, we shift backward by 1 (allowing `maxMessages + 1`).

### Strategy Combination Example

You can chain strategies depending on size thresholds:

```ts
if (history.length > 50) {
  history = await summarizeCompressor.compress(history);
} else if (history.length > 25) {
  history = await trimCompressor.compress(history);
}
```

## Example Integration

See `examples/LANGCHAIN_EXAMPLE.md` for a LangChain-style example.
See `examples/OPENAI_EXAMPLE.md` for an OpenAI example (copy-paste snippet).

## API

### Classes

- `TrimCompressor({ messagesToKeep })`
- `SummarizeCompressor({ model, maxMessages, prompt? })`

### Interfaces

- `SlimContextMessage`
- `SlimContextChatModel`
- `SlimContextCompressor`
- `SlimContextModelResponse`

## License

MIT
