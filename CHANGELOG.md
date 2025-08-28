# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [2.1.0] - 2025-08-27

### Added

- LangChain adapter under `src/adapters/langchain.ts` with helpers:
  - `extractContent`, `roleFromMessageType`, `baseToSlim`, `slimToLangChain`
  - `toSlimModel(llm)` wrapper to use LangChain `BaseChatModel` with `SummarizeCompressor`.
  - `compressLangChainHistory(history, options)` high-level helper for one-call compression on `BaseMessage[]`.
- Tests for adapter behavior in `tests/langchain.test.ts`.
- Examples:
  - `examples/LANGCHAIN_EXAMPLE.md`: adapting a LangChain model to `SlimContextChatModel`.
  - `examples/LANGCHAIN_COMPRESS_HISTORY.md`: using `compressLangChainHistory` directly.

### Changed

- README updated with a LangChain adapter section and one-call usage sample.

### Notes

- The adapter treats LangChain `tool` messages as `assistant` during compression.
- `@langchain/core` is an optional peer dependency; only needed if you use the adapter.

## [2.0.0] - 2025-08-24

### Breaking

- Unified message types: replaced `Message` and `BaseMessage` with a single `SlimContextMessage`.
  - `IChatModel.invoke(messages: SlimContextMessage[])` (was `BaseMessage[]`).
  - `ICompressor.compress(messages: SlimContextMessage[])` (was `Message[]`).
  - Strategies (`TrimCompressor`, `SummarizeCompressor`) now use `SlimContextMessage`.
- Rationale: avoid naming clashes with other frameworks and have one canonical message shape. `role` now supports `'system' | 'user' | 'assistant' | 'tool' | 'human'`.

- Interface renames for clarity and to avoid clashes:
  - `ModelResponse` -> `SlimContextModelResponse`
  - `IChatModel` -> `SlimContextChatModel`
  - `ICompressor` -> `SlimContextCompressor`

Migration notes:

- Import and use `SlimContextMessage` everywhere you previously used `Message` or `BaseMessage`.
- Update any custom `IChatModel` implementations to accept `SlimContextMessage[]`.
- Where applicable, map any external "human" role to `'user'` for providers that do not support it directly.

### Added

- `examples/OPENAI_EXAMPLE.md`: copy-paste OpenAI example demonstrating `SummarizeCompressor` without adding dependencies to this repo.
- `examples/LANGCHAIN_EXAMPLE.md`: copy-paste LangChain-style example.

### Changed

- README examples and API docs updated to reference `SlimContextMessage` and new `IChatModel` signature.

### Removed

- `examples/with-openai.ts` and `examples/with-langchain.ts` TypeScript files in favor of Markdown examples.

### Behavior

- SummarizeCompressor alignment: after summarization, the first kept message following the summary is enforced to be a `user` message to maintain dialogue consistency. To achieve this while preserving recent context, the resulting message count may be `maxMessages - 1`, `maxMessages`, or `maxMessages + 1` depending on the split position.
