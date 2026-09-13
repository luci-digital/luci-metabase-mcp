# Architecture

**luci-metabase-mcp** is a stdio Model Context Protocol server. One client
process launches it, talks JSON-RPC over stdin and stdout, and owns its
lifetime. Everything the server logs goes to stderr as JSON lines.

```
client (Claude Code, Claude Desktop, Zed, Inspector)
   | stdio JSON-RPC
   v
src/index.ts ---> src/server.ts (McpServer)
                     |-- tools/       registerTool x6, zod schemas, guard()
                     |-- handlers/    search, list, retrieve, execute, export, clearCache
                     |-- resources/   metabase:// templates, hierarchical listing
                     |-- prompts/     execute_card, export_card
                     v
                  src/api.ts (MetabaseApiClient: auth, caching, rate limiting)
                     v
                  Metabase HTTP API (internal instance)
```

## Request path

1. `McpServer` validates tool arguments against the zod shape in
   `src/tools/schemas.ts`. Invalid input never reaches a handler.
2. `src/tools/index.ts` rebuilds the `tools/call` request the handler layer
   consumes and calls the handler with bound logger callbacks.
3. Handlers validate semantics (model names, ID ranges, SQL and card mode
   exclusivity), call the API client, and optimize the response.
4. `guard()` in `src/tools/helpers.ts` turns a thrown `McpError` into an
   error result that keeps the agent guidance, recovery action, retryable
   flag, retry delay, and troubleshooting steps. Any other error becomes a
   plain `Error:` result. The process never crashes on a tool error.

## Caching

`MetabaseApiClient` keeps separate caches for individual items (`cards`,
`dashboards`, `tables`, `databases`, `collections`, `fields`) and for lists
(`*-list`), each with the configurable `CACHE_TTL_MS`. `clear_cache` clears
any subset.

## Response optimization

`handlers/*/optimizers.ts` strip raw Metabase payloads down to the fields
agents use. The raw versus optimized structures and the token savings are
documented in `docs/responses/`; every optimization change updates that
directory.

## Errors

`src/utils/errorFactory.ts` builds `McpError` instances with a category,
`agentGuidance`, `recoveryAction`, `retryable`, optional `retryAfterMs`, and
`troubleshootingSteps` (see `src/types/core.ts`). API failures are mapped
by `src/utils/errorHandling.ts`.

## Configuration and secrets

`src/config.ts` validates the environment with zod. Values that start with
`op://` are resolved by `src/utils/onePassword.ts` using `execFileSync('op',
['read', '--no-newline', ref])`: no shell, strict reference syntax, loud
failure. The recommended workflow is `npm run env:inject`, which writes a
git-ignored `.env` from `.env.example` with `op inject`.

## Identity

`.lucia/config.toml` declares the repository DID, tier, and peers in the
format the LuciVerse VCS substrate (`luci-vcs`) loads. `.lucia/threads/`
links this server to the related MCP paths in `luciverse-system-config` and
`lucia_tooling_omzsh`; `scripts/lucia-threads.mjs` regenerates the links.

## Non-goals

No HTTP transport, no listening port, no registry image, no public release.
The server is a reference pattern for internal LuciVerse MCP servers and is
started only by a client that attaches to it.

---

LDS 700.528 @ 528 Hz. Genesis Bond: ACTIVE.
