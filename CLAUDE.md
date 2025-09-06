# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**slimcontext** is a TypeScript npm library for chat history compression in AI assistants. It provides model-agnostic strategies to keep conversations concise while preserving context using a "Bring Your Own Model" (BYOM) approach.

## Development Commands

### Package Management

Use **pnpm** as the primary package manager (version 10.14.0), with npm as fallback:

```bash
pnpm install           # Primary method
npm install            # Fallback if pnpm unavailable
```

### Core Development Workflow

```bash
pnpm run build         # Compile TypeScript to dist/
pnpm run test          # Run vitest tests
pnpm run test:watch    # Run tests in watch mode
pnpm run lint          # ESLint with TypeScript rules
pnpm run lint:fix      # Auto-fix linting issues
pnpm run format        # Format code with Prettier
pnpm run format:check  # Check formatting without changes
```

### Required Validation Sequence

Always run these commands after making changes:

```bash
pnpm run test          # All tests must pass
pnpm run lint          # No linting errors
pnpm run format:check  # Code must be formatted
pnpm run build         # Must compile successfully
```

## Architecture

### Core Design Principles

- **Model-agnostic**: Core library has zero runtime dependencies
- **Token-aware**: Uses configurable token budgets with threshold-based compression
- **Framework-independent**: Optional adapters (currently LangChain) without core dependencies
- **Message preservation**: Always preserves system messages and recent conversation tail

### Key Interfaces (src/interfaces.ts)

- `SlimContextMessage`: Standard message format with role and content
- `SlimContextChatModel`: BYOM interface requiring only `invoke(messages) -> response`
- `SlimContextCompressor`: Strategy interface for compression implementations
- `TokenBudgetConfig`: Shared configuration for token-threshold behavior

### Compression Strategies (src/strategies/)

**TrimCompressor** (src/strategies/trim.ts):

- Drops oldest non-system messages when over token threshold
- Preserves system messages and recent tail (configurable `minRecentMessages`)
- Simple token-based pruning without AI model dependency

**SummarizeCompressor** (src/strategies/summarize.ts):

- Uses provided chat model to summarize old conversation segments
- Injects summary as system message before preserved recent messages
- Complex message alignment and boundary detection logic

**Shared utilities** (src/strategies/common.ts):

- Token estimation defaults and configuration normalization
- `DEFAULT_MAX_MODEL_TOKENS = 8192`, `DEFAULT_THRESHOLD_PERCENT = 0.7`

### Adapter Pattern (src/adapters/)

- **LangChain adapter** (src/adapters/langchain.ts):
  - `toSlimModel()`: Wraps LangChain chat models
  - `compressLangChainHistory()`: One-call compression helper
  - Message format conversions between LangChain and slimcontext

## File Structure

```
src/
├── index.ts                    # Main exports
├── interfaces.ts              # Core type definitions
├── strategies/               # Compression implementations
│   ├── common.ts            # Shared utilities and defaults
│   ├── trim.ts              # Token-based trimming strategy
│   └── summarize.ts         # AI-powered summarization strategy
└── adapters/                # Framework integrations
    └── langchain.ts         # LangChain integration and helpers

tests/                        # vitest test files
examples/                     # Markdown documentation only
dist/                         # Compiled output (generated)
```

## Testing

- **Framework**: vitest
- **Coverage**: TrimCompressor, SummarizeCompressor, LangChain adapter
- **Test files**: tests/\*.test.ts corresponding to src/ structure

## Build Configuration

- **TypeScript**: Target ES2020, output CommonJS modules
- **Output**: dist/ directory with .js and .d.ts files
- **Exports**: Main library + separate LangChain adapter path
- **ESLint**: TypeScript rules with import ordering and unused import detection

## Important Notes

- The `prepare` script automatically runs build after npm install
- Examples directory contains documentation only, not executable code
- LangChain integration is optional (peer dependency)
- All compression strategies share token budget configuration pattern
