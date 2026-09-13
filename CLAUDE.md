# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript-based Model Context Protocol (MCP) server that provides AI assistants with optimized access to Metabase analytics data. The server acts as a bridge between AI systems (like Claude) and Metabase instances, offering high-performance data retrieval with intelligent caching and response optimization.

**LuciVerse alignment**: this is the TypeScript reference implementation of the internal MCP server pattern (`luciverse-system-config/documentation/MCP_SERVER_PATTERN.md`). It is internal and stdio-only: no listening port, no public registry, no release artifacts. Identity: `did:luci:luci-metabase-mcp`, COMN tier, 528 Hz, LDS 700.528 (`.lucia/config.toml`). Agent-facing behaviour is in [AGENTS.md](AGENTS.md).

## Key Architecture

### Core Components

- **Entry Point**: `src/index.ts` - Main server entry with global error handling
- **Server**: `src/server.ts` - McpServer wiring: tools, resources, prompts, instructions
- **Tools**: `src/tools/` - zod input schemas, registration, result helpers (guard, mcpErrorResult)
- **Logger**: `src/logger.ts` - JSON-lines stderr logger with child scopes (stdout is the protocol stream)
- **API Client**: `src/api.ts` - Metabase API client with caching and authentication
- **Handlers**: `src/handlers/` - Tool-specific request handlers (search, list, retrieve, etc.)
- **Types**: `src/types/` - TypeScript definitions for core types and optimized responses
- **Configuration**: `src/config.ts` - Environment validation and `op://` resolution (`src/utils/onePassword.ts`)

### Handler Architecture

The server uses a modular handler system:
- `list/` - List all resources of a type (cards, dashboards, tables, databases, collections)
- `retrieve/` - Fetch detailed information for specific items with concurrent processing
- `search.ts` - Native Metabase search with advanced filtering
- `execute/` - Execute SQL queries or saved cards with row limits
- `export/` - Export large datasets in CSV/JSON/XLSX formats
- `resources/`, `prompts/` - metabase:// resources and card workflow prompts
- `clearCache.ts` - Cache management utilities

## Common Development Commands

### Build and Development
```bash
# Full build with validation and tests
npm run build

# Fast build without validation (development only)
npm run build:fast

# Clean build from scratch
npm run build:clean

# Development with auto-rebuild and server restart
npm run dev:watch

# Single development run
npm run dev

# Build versioned MCPB package (local; CI uploads it as an artifact on tags)
npm run mcpb:build
```

### Verification
```bash
# validate plus CHANGELOG format check
npm run verify

# the same plus shell syntax checks (mirrors luciverse-system-config)
make verify

# regenerate .lucia thread links and fail if they differ
npm run lucia:threads -- --check

# generate .env from .env.example with the 1Password CLI
npm run env:inject
```

### Code Quality
```bash
# Run all quality checks (type-check, lint, format)
npm run validate

# TypeScript type checking
npm run type-check

# ESLint
npm run lint
npm run lint:fix

# Prettier formatting
npm run format
npm run format:check
```

### Testing
```bash
# Run all tests
npm test

# Run tests with coverage (80% threshold enforced)
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run comprehensive test suite
npm run test:all
```

### Server Operations
```bash
# Start built server
npm start

# Debug with MCP Inspector
npm run inspector

# Clean build artifacts
npm run clean
```

## Configuration

The server supports two authentication methods controlled by environment variables:

Values may be literal or `op://vault/item/field` references. References are resolved at startup with `execFileSync('op', ['read', ...])`; a malformed or unresolvable reference aborts startup. The recommended workflow is `npm run env:inject`.

### API Key Authentication (Recommended)
```bash
METABASE_URL=op://Lucia-AI-Secrets/Metabase/url
METABASE_API_KEY=op://Lucia-AI-Secrets/Metabase/api_key
```

### Session Authentication
```bash
METABASE_URL=https://your-metabase-instance.com
METABASE_USER_EMAIL=your_email@example.com
METABASE_PASSWORD=your_password
```

### Optional Settings
```bash
LOG_LEVEL=info                 # debug, info, warn, error, fatal
CACHE_TTL_MS=600000           # 10 minutes default
REQUEST_TIMEOUT_MS=600000     # 10 minutes default
```

## MCPB Package Management

The project includes MCPB (MCP Bundle) package management for easy distribution.

### Building MCPB Packages
```bash
# Build versioned MCPB package (packs with npx @anthropic-ai/mcpb, no global install)
npm run mcpb:build

# Validate manifest structure and user_config wiring (scripts/validate-manifest.cjs)
npm run mcpb:validate
```

Claude Desktop installs the bundle from Settings > Extensions. The hand-edited alternative is `examples/claude_desktop_config.example.json`. Desktop passes blank optional settings as empty strings, which `validateEnvironment` treats as unset.

### Platform Compatibility
The MCPB package supports cross-platform deployment:
- **macOS** (darwin)
- **Windows** (win32)  
- **Linux** (linux)

Platform compatibility is declared in `manifest.json` with runtime requirements:
```json
"compatibility": {
  "claude_desktop": ">=0.11.0",
  "platforms": ["darwin", "win32", "linux"],
  "runtimes": {
    "node": ">=20.0.0"
  }
}
```

## Testing Architecture

The project uses Vitest with comprehensive test coverage:
- **Unit Tests**: All handlers have extensive test coverage
- **Mock Infrastructure**: Complete Metabase API simulation
- **Coverage Enforcement**: thresholds pinned at the measured floor in `vitest.config.ts` (79% lines, 74% branches, 90% functions); `src/api.ts` is excluded because it is only exercised through mocked handler tests
- **Server Tests**: `tests/server.test.ts` runs the real SDK handshake over `InMemoryTransport`
- **CI Integration**: Node.js 20.x and 22.x

Test files are located in `tests/` directory with structure mirroring `src/handlers/`.

### Testing Patterns
- **API Client Testing**: Do NOT create dedicated tests for individual API client methods (e.g., `tests/api.test.ts`)
- **Handler-Level Mocking**: All API interactions should be mocked at the handler level in handler tests
- **Consistent Pattern**: Follow the established pattern where `tests/handlers/` contains tests that mock the entire API client
- **No Redundant Tests**: Avoid creating separate API client tests when the methods are already tested through handler tests

## Performance Optimizations

### Caching System
- **Multi-layer Caching**: Separate caches for individual items and bulk lists
- **Cache Types**: `cards`, `dashboards`, `tables`, `databases`, `collections`, `fields`
- **List Caches**: `cards-list`, `dashboards-list`, etc.
- **Configurable TTL**: Default 10 minutes, controlled by `CACHE_TTL_MS`

### Response Optimization
The server implements aggressive response optimization to reduce token usage:
- **Cards**: ~90% token reduction
- **Dashboards**: ~85% token reduction  
- **Tables**: ~80% token reduction
- **Databases**: ~75% token reduction
- **Collections**: ~15% token reduction
- **Fields**: ~75% token reduction

### Concurrent Processing
- **Batch Operations**: Controlled concurrency for retrieve operations
- **Rate Limiting**: Prevents API overload
- **Performance Metrics**: Real-time processing statistics

## MCP Design Patterns: Resources vs Tools

### Core Distinction
Per MCP documentation, there's a fundamental difference between Resources and Tools:

**Resources (Application-Controlled)**
- Users/clients explicitly select and read them
- Represent passive, relatively stable data
- Read-only access to specific content
- Good for: file contents, database records, API responses
- Examples: `metabase://dashboard/123`, `metabase://table/456`

**Tools (Model-Controlled)**
- AI models automatically invoke them
- Enable dynamic actions and computations
- Can modify state or interact with external systems
- Good for: search operations, data processing, workflow actions
- Examples: `search`, `execute`, `export`

### Design Rule: Avoid Overlap
**NEVER implement the same functionality as both a Resource and Tool**. This violates MCP principles and creates confusion. For example:
- Wrong: Having both a `search` tool AND a `metabase://search/{query}` resource
- Right: Search as tool only (dynamic operation), specific items as resources

### When to Use Each
**Use Resources for:**
- Static data access by ID
- User-specific views (e.g., user's dashboards)
- Content that doesn't require processing
- Reference data

**Use Tools for:**
- Dynamic operations requiring parameters
- Search, filtering, or querying
- Data transformation or processing
- Any operation that modifies state

## MCP Tools Available

### Core Data Access
- **`search`** - Native Metabase search with model filtering
- **`list`** - Fetch all records for a resource type  
- **`retrieve`** - Get detailed information for specific items (supports multiple IDs)

### Query Execution
- **`execute`** - Execute SQL queries or saved cards (up to 2K rows)
- **`export`** - Export large datasets (up to 1M rows) in CSV/JSON/XLSX

### Utilities
- **`clear_cache`** - Cache management with granular control

## Development Notes

### Code Style
- Strict TypeScript configuration with `noImplicitAny`, `noUnusedLocals`, `noUnusedParameters`
- ESLint with TypeScript support
- Prettier for consistent formatting
- Modular architecture with clean separation of concerns
- **NO EMOJIS**: Never use emojis in code, documentation, comments, or tool descriptions
- **RESPONSE OPTIMIZATION DOCUMENTATION**: For every raw response -> optimized response task, always update docs/responses/ with optimization details including token savings analysis

### Error Handling
- Comprehensive error handling with structured logging
- Custom `McpError` class for consistent error responses with `agentGuidance` field
- Global error handlers in entry point
- Detailed error messages with context and recovery actions
- AI agent-specific error guidance (see [AGENTS.md](AGENTS.md#agent-error-handling))

### Build Process
1. TypeScript compilation to `build/` (`tsconfig.build.json` compiles `src/` only)
2. Executable permission on `build/src/index.js`
3. `npm run build` also runs validation and tests

### Container
A single-stage `Dockerfile` (docker or podman) builds `luci-metabase-mcp:local` for internal use. No `EXPOSE`, no registry, no service unit: a stdio server is owned by its client.

### LuciVerse conventions
- Genesis Bond quartet in the environment (`GENESIS_BOND`, `CONSCIOUSNESS_FREQUENCY=528`, `COHERENCE_THRESHOLD`, `LUCIVERSE_COMPONENT=metabase-mcp`)
- `.lucia/config.toml`, `.lucia/handles/local.toml`, `.lucia/threads/peers.toml` follow the `luci-vcs` format; `.lucia/threads/` links related MCP paths in `luciverse-system-config` and `lucia_tooling_omzsh` and is regenerated by `scripts/lucia-threads.mjs`
- `CHANGELOG.md` must pass `scripts/check-changelog.sh` (shared with luciverse-system-config)
- Registered in `luciverse-system-config/documentation/CLAUDE.md` and `NETWORK_REFERENCE.md`

## Debugging

Use the MCP Inspector for debugging MCP communications:
```bash
npm run inspector
```

This provides a browser-based interface for monitoring requests, responses, and performance metrics.

## AI Agent Integration

All tool errors include `agentGuidance`, a `recoveryAction`, a `retryable` flag, and optional `troubleshootingSteps` (see `src/types/core.ts`). The tool layer renders them into the error result text so any MCP client sees them. See **[AGENTS.md](AGENTS.md)** for the agent-facing contract.