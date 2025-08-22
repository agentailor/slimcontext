# slimcontext

Lightweight, model-agnostic chat history compression utilities for AI assistants. Bring Your Own Model (BYOM) and use simple strategies to keep conversations concise while preserving context.

![CI](https://github.com/agentailor/slimcontext/actions/workflows/ci.yml/badge.svg)

## Features (v1.0)

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
interface BaseMessage { role: 'system' | 'user' | 'human' | 'assistant'; content: string; }
interface ModelResponse { content: string; }
interface IChatModel { invoke(messages: BaseMessage[]): Promise<ModelResponse>; }
```

`slimcontext` handles message arrays shaped as:

```ts
interface Message { role: 'user' | 'assistant' | 'system' | 'tool'; content: string; }
```

## Usage

### TrimCompressor

```ts
import { TrimCompressor, Message } from 'slimcontext';

const compressor = new TrimCompressor({ messagesToKeep: 8 });

let history: Message[] = [
  { role: 'system', content: 'You are a helpful assistant.' },
  // ... conversation grows
];

history = await compressor.compress(history);
```

### SummarizeCompressor

```ts
import { SummarizeCompressor, Message, IChatModel, BaseMessage, ModelResponse } from 'slimcontext';

class MyModel implements IChatModel {
  async invoke(messages: BaseMessage[]): Promise<ModelResponse> {
    // Call out to your LLM provider (OpenAI, Anthropic, etc.)
    const userContent = messages.find(m => m.role === 'user')?.content || '';
    return { content: 'Summary: ' + userContent.slice(0, 100) };
  }
}

const model = new MyModel();
const compressor = new SummarizeCompressor({ model, maxMessages: 12 });

let history: Message[] = [
  { role: 'system', content: 'You are a helpful assistant.' },
  // ... conversation grows
];

history = await compressor.compress(history);
```

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

See `examples/with-langchain.ts` for a runnable mock integration with a LangChain-style model.

## API

### Classes

- `TrimCompressor({ messagesToKeep })`
- `SummarizeCompressor({ model, maxMessages, prompt? })`

### Interfaces

- `Message`
- `BaseMessage`
- `IChatModel`
- `ICompressor`

## License

MIT
