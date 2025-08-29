# Copilot Instructions for slimcontext

## Repository Overview

**slimcontext** is a lightweight, model-agnostic chat history compression library for AI assistants. It provides simple strategies to keep conversations concise while preserving context using a "Bring Your Own Model" (BYOM) approach.

### High-Level Repository Information

- **Type**: TypeScript npm library/package
- **Languages**: TypeScript (primary), JavaScript (compiled output)
- **Target Runtime**: Node.js (CommonJS modules)
- **Framework**: Model-agnostic core; optional adapters (LangChain)
- **Package Manager**: pnpm (preferred) or npm (fallback)
- **Testing**: vitest
- **Linting**: ESLint with TypeScript support
- **Formatting**: Prettier

## Build Instructions and Development Workflow

### Prerequisites and Environment Setup

- **Node.js**: Version 20+ (recommended)
- **Package Manager**: pnpm 10.14.0 (preferred) or npm (fallback)

### Critical Build Steps (Always Follow This Order)

1. **Install Dependencies**

   ```bash
   # Preferred method (if pnpm available):
   pnpm install --frozen-lockfile

   # Fallback method (always works):
   npm install
   ```

   **Always run install before any other commands.** The `prepare` script automatically runs build after install.

2. **Build the Project**

   ```bash
   pnpm run build
   # Compiles TypeScript to dist/ directory
   ```

3. **Run Tests**

   ```bash
   pnpm run test
   # Runs all vitest tests
   # All tests should pass
   ```

4. **Format Code**

   ```bash
   pnpm run format        # Auto-format code
   pnpm run format:check  # Check formatting without changes
   ```

5. **Lint Code (Known Issue)**
   ```bash
   pnpm run lint
   ```

### Complete Development Workflow

```bash
# Clean start (recommended for agents):
rm -rf node_modules dist
pnpm install           # Always use pnpm for reliability
pnpm run test         # Verify tests pass
pnpm run format:check # Verify formatting
pnpm run build        # Final build
```

### CI/CD Pipeline Validation

The repository uses GitHub Actions CI that runs:

1. `pnpm install --frozen-lockfile`
2. `pnpm run lint`
3. `pnpm run format:check`
4. `pnpm run build`
5. `pnpm test`

**Note**: CI works because it runs in a different environment where the ESLint path issue doesn't occur.

## Project Layout and Architecture

### Core Directory Structure

```
/
├── src/                           # TypeScript source code
│   ├── index.ts                  # Main exports (trim, summarize, interfaces, adapters namespace)
│   ├── interfaces.ts             # Core type definitions (SlimContextMessage, etc.)
│   ├── adapters/                 # Integration adapters (optional)
│   │   └── langchain.ts          # LangChain adapter + helpers (compressLangChainHistory, toSlimModel)
│   └── strategies/               # Compression strategy implementations
│       ├── common.ts             # Shared token-budget utilities & defaults (thresholds, estimator)
│       ├── trim.ts               # TrimCompressor: token-threshold trimming (preserve system + recent)
│       └── summarize.ts          # SummarizeCompressor: token-threshold summarization (inject summary)
├── tests/                        # vitest test files
│   ├── trim.test.ts             # Tests for TrimCompressor
│   ├── summarize.test.ts        # Tests for SummarizeCompressor
│   └── langchain.test.ts        # Tests for LangChain adapter + helper
├── examples/                    # Documentation-only examples (not code)
│   ├── OPENAI_EXAMPLE.md        # Copy-paste OpenAI integration
│   ├── LANGCHAIN_EXAMPLE.md     # Copy-paste LangChain integration
│   └── LANGCHAIN_COMPRESS_HISTORY.md # One-call compressLangChainHistory usage
├── dist/                        # Compiled JavaScript output (generated)
└── package.json                # npm package configuration
```

### Configuration Files

- **tsconfig.json**: TypeScript compiler configuration (target: ES2019, CommonJS)
- **tsconfig.eslint.json**: Extended config for ESLint (includes tests)
- **.eslintrc.json**: ESLint configuration with TypeScript, import rules
- **.prettierrc.json**: Code formatting rules (single quotes, trailing commas)
- **.github/workflows/ci.yml**: CI/CD pipeline definition

### Key Architecture Elements

**Core Interfaces** (src/interfaces.ts):

- `SlimContextMessage`: Standard message format with role ('system'|'user'|'assistant'|'tool'|'human') and content
- `SlimContextChatModel`: BYOM interface requiring only `invoke(messages) -> response`
- `SlimContextCompressor`: Strategy interface for compression implementations
- `TokenEstimator`: `(message) => number` callback used for model-agnostic token budgeting

**Compression Strategies**:

- Token-threshold based design using the model’s max token window and a configurable threshold (default 70%).
- Shared config shape (TokenBudgetConfig): `{ maxModelTokens?, thresholdPercent?, estimateTokens?, minRecentMessages? }`.
- **TrimCompressor**: Drops the oldest non-system messages until estimated tokens fall below the threshold, while always preserving any system message(s) and at least the most recent `minRecentMessages`.
- **SummarizeCompressor**: When over threshold, summarizes all messages before the recent tail (excluding the leading system message if present) and inserts a synthetic system summary just before the preserved recent messages.

**Shared Utilities** (src/strategies/common.ts):

- Defaults: `DEFAULT_MAX_MODEL_TOKENS = 8192`, `DEFAULT_THRESHOLD_PERCENT = 0.7`, `DEFAULT_MIN_RECENT_MESSAGES = 2`.
- Estimator: `DEFAULT_ESTIMATOR` (~`len/4 + 2`) plus `computeThresholdTokens`, `normalizeBudgetConfig` helpers.

**Framework Independence**: Core library has no framework dependencies. An optional LangChain adapter is provided for convenience; core remains BYOM.

### Dependencies and Build Artifacts

- **Production**: Zero runtime dependencies (framework-agnostic design)
- **Development**: TypeScript, ESLint, Prettier, vitest, various type definitions
- **Optional peer**: `@langchain/core` (only if using the LangChain adapter). The adapter is exported under `slimcontext/adapters/langchain` and as a `langchain` namespace from the root export.
- **Ignored Files**: dist/, node_modules/, examples/ (linting), \*.tgz
- **Distributed Files**: Only dist/ directory (compiled JS + .d.ts files)

## Validation and Testing

### Running Tests

```bash
pnpm run test
# Expects: All tests to pass
# Tests cover TrimCompressor, SummarizeCompressor, and the LangChain adapter/helper
```

### Manual Verification Steps

1. Check that dist/ contains compiled .js and .d.ts files after build
2. Verify examples/ directory contains markdown documentation (not executable code)
3. Ensure src/ exports work by checking dist/index.js contains proper CommonJS exports

### Common Issues and Workarounds

1. **ESLint Path Error**: Use npm instead of pnpm locally, or ignore lint failures for development (CI handles this correctly)
2. **Missing pnpm**: Always fall back to npm install - works identically for this project
3. **Build Failures**: Always run `npm install` first - the prepare script ensures build runs after dependency installation

## Key Files Reference

### Root Directory Files

- **README.md**: Comprehensive usage documentation with examples
- **package.json**: Defines scripts, dependencies, and npm package metadata
- **CHANGELOG.md**: Version history and breaking changes documentation
- **LICENSE**: MIT license
- **pnpm-lock.yaml**: pnpm lockfile (prefer npm for compatibility)

### Source Code Entry Points

- **src/index.ts**: Main library exports - start here for code changes
- **src/interfaces.ts**: Core type definitions - modify for interface changes
- **src/strategies/trim.ts**: Simple compression logic
- **src/strategies/summarize.ts**: AI-powered compression with alignment logic
- **src/adapters/langchain.ts**: LangChain adapter and helpers (`compressLangChainHistory`, `toSlimModel`, conversions)

### Adapters

- LangChain adapter import options:
  - Recommended (works across module systems): `import * as langchain from 'slimcontext/adapters/langchain'`
  - Root namespace (available as a property on the root export; usage differs by module system):
    - CommonJS: `const { langchain } = require('slimcontext')`
    - ESM/TypeScript: `import * as slim from 'slimcontext'; const { langchain } = slim;`
  - Note: `import { langchain } from 'slimcontext'` may not work in all environments due to CJS/ESM interop. Prefer one of the patterns above.
  - Includes a one-call history helper: `compressLangChainHistory(history, options)` where `options` accepts the token-threshold fields (`maxModelTokens`, `thresholdPercent`, `estimateTokens`, `minRecentMessages`) and either `strategy: 'trim'` or `strategy: 'summarize'` with `llm` for the latter.

---

**Trust these instructions first** - only search for additional information if these instructions are incomplete or found to be incorrect. The documented commands and workflows have been validated in the development environment.
