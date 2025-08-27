# Copilot Instructions for slimcontext

## Repository Overview

**slimcontext** is a lightweight, model-agnostic chat history compression library for AI assistants. It provides simple strategies to keep conversations concise while preserving context using a "Bring Your Own Model" (BYOM) approach.

### High-Level Repository Information

- **Type**: TypeScript npm library/package
- **Size**: ~24 source files, compiles to ~106MB total (including node_modules)
- **Languages**: TypeScript (primary), JavaScript (compiled output)
- **Target Runtime**: Node.js (CommonJS modules)
- **Framework**: Model-agnostic, no AI framework dependencies
- **Package Manager**: pnpm (preferred) or npm (fallback)
- **Testing**: vitest
- **Linting**: ESLint with TypeScript support
- **Formatting**: Prettier

## Build Instructions and Development Workflow

### Prerequisites and Environment Setup

- **Node.js**: Version 20+ (as specified in CI)
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
   npm run build
   # Compiles TypeScript to dist/ directory
   # Duration: ~5-10 seconds
   ```

3. **Run Tests**

   ```bash
   npm run test
   # Runs all vitest tests
   # Duration: ~5-10 seconds
   # Should show: "Test Files 2 passed (2), Tests 7 passed (7)"
   ```

4. **Format Code**

   ```bash
   npm run format        # Auto-format code
   npm run format:check  # Check formatting without changes
   ```

5. **Lint Code (Known Issue)**
   ```bash
   npm run lint
   ```
   **KNOWN ISSUE**: ESLint currently fails with "parserOptions.tsconfigRootDir must be an absolute path" error. This is a configuration bug but doesn't affect build or tests. The code itself is properly linted in CI environment.

### Complete Development Workflow

```bash
# Clean start (recommended for agents):
rm -rf node_modules dist
npm install           # Always use npm for reliability
npm run test         # Verify tests pass
npm run format:check # Verify formatting
npm run build        # Final build
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
├── src/                      # TypeScript source code
│   ├── index.ts             # Main exports (TrimCompressor, SummarizeCompressor, interfaces)
│   ├── interfaces.ts        # Core type definitions (SlimContextMessage, etc.)
│   └── strategies/          # Compression strategy implementations
│       ├── trim.ts          # TrimCompressor: keeps first + last N messages
│       └── summarize.ts     # SummarizeCompressor: AI-powered summarization
├── tests/                   # vitest test files
│   ├── trim.test.ts        # Tests for TrimCompressor
│   └── summarize.test.ts   # Tests for SummarizeCompressor
├── examples/               # Documentation-only examples (not code)
│   ├── OPENAI_EXAMPLE.md  # Copy-paste OpenAI integration
│   └── LANGCHAIN_EXAMPLE.md # Copy-paste LangChain integration
├── dist/                   # Compiled JavaScript output (generated)
└── package.json           # npm package configuration
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

**Compression Strategies**:

- **TrimCompressor**: Simple strategy keeping first (system) message + last N-1 messages
- **SummarizeCompressor**: AI-powered strategy that summarizes middle conversations when exceeding maxMessages

**Framework Independence**: No dependencies on OpenAI, LangChain, or other AI frameworks. Users implement the minimal `SlimContextChatModel` interface to connect their preferred model.

### Dependencies and Build Artifacts

- **Production**: Zero dependencies (framework-agnostic design)
- **Development**: TypeScript, ESLint, Prettier, vitest, various type definitions
- **Ignored Files**: dist/, node_modules/, examples/ (linting), \*.tgz
- **Distributed Files**: Only dist/ directory (compiled JS + .d.ts files)

## Validation and Testing

### Running Tests

```bash
npm run test
# Expects: 7 tests across 2 files, all passing
# Tests cover both TrimCompressor and SummarizeCompressor functionality
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

---

**Trust these instructions first** - only search for additional information if these instructions are incomplete or found to be incorrect. The documented commands and workflows have been validated in the development environment.
