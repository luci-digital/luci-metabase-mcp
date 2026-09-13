# AGENTS.md

Project-specific guardrails for AI agents that use or develop
**luci-metabase-mcp**. Read [CLAUDE.md](CLAUDE.md) for the development guide
and [ARCHITECTURE.md](ARCHITECTURE.md) for the request path.

## What this server is

- An internal, stdio-only MCP server for Metabase analytics. It is launched
  by the client that attaches to it and opens no ports.
- The TypeScript reference implementation of the LuciVerse internal MCP
  server pattern (`luciverse-system-config/documentation/MCP_SERVER_PATTERN.md`).
- COMN tier, 528 Hz, LDS 700.528, `did:luci:luci-metabase-mcp`.

## Tools

| Tool | Use it when |
|------|-------------|
| `search` | You need to find content and do not have IDs. Start here. |
| `retrieve` | You have IDs and need details (up to 50 per call, one model type). |
| `list` | You need an overview of everything of one type; paginate with `offset` and `limit`. |
| `execute` | You need rows now: SQL (`database_id` + `query`) or a saved card (`card_id`). Up to 2000 rows. |
| `export` | The result is large (up to 1M rows) or must be a file (CSV, JSON, XLSX). |
| `clear_cache` | Data changed in Metabase and cached responses are stale. |

Mode rules: `execute` and `export` are either SQL mode or card mode, never
both. `search` with `models: ["database"]` cannot be combined with other
models. `retrieve` takes one model per call. Get card parameter structures by
retrieving the card first.

## Error contract

Every tool failure returns an error result (never a crash). The text
contains, in order:

```
Error: <message>
Guidance: <what to do, when it differs from the message>
Recovery Action: <recovery_action>
Retryable: <true|false>
Retry After: <ms>            (only when rate limited)
Troubleshooting Steps:       (numbered, when available)
```

The values come from `McpError` in `src/types/core.ts`:

```typescript
interface ErrorDetails {
  category: ErrorCategory;          // authentication, authorization, resource_not_found,
                                    // validation, rate_limit, timeout, network, database,
                                    // query_execution, export_processing, ...
  agentGuidance: string;            // what the agent should do
  recoveryAction: RecoveryAction;   // see below
  retryable: boolean;
  retryAfterMs?: number;
  troubleshootingSteps?: string[];
  userMessage: string;
  httpStatus?: number;
}
```

Recovery actions and how to act on them:

| `recoveryAction` | Do |
|------------------|----|
| `retry_immediately` | Call again once. |
| `retry_with_backoff`, `wait_and_retry` | Wait (`retryAfterMs` if given), then retry. |
| `validate_input` | Fix the arguments; the schema or semantic check rejected them. |
| `check_credentials`, `verify_permissions` | Stop and report; a human must fix configuration or access. |
| `check_resource_exists` | The ID is wrong; `search` for it. |
| `reduce_query_complexity`, `use_smaller_dataset` | Add filters or limits, or switch from `execute` to `export`. |
| `switch_to_alternative` | Use the alternative the guidance names (for example card mode instead of SQL). |
| `clear_cache` | Call `clear_cache`, then retry. |
| `contact_admin`, `no_retry` | Do not retry; report the message. |

Arguments that fail the zod schema are rejected before any handler runs with
`Invalid arguments for tool <name>: ...`; fix the arguments rather than
retrying.

## Cache awareness

Item and list caches live for `CACHE_TTL_MS` (default 10 minutes). Responses
report `source: cache | api` where relevant. After you know data changed,
call `clear_cache` for the affected type.

## Developing agents against this server

- Wire it over stdio (`examples/mcp.json.example`, `examples/zed-settings.example.json`).
- Never write to stdout from server code; use `Logger` (stderr JSON lines).
- New tools go in `src/tools/schemas.ts` (zod shape, description on every field) and `src/tools/index.ts`; handlers keep the `(request, requestId, apiClient, log...)` contract so they stay unit-testable with the mocked client in `tests/setup.ts`.
- Every optimizer change updates `docs/responses/`.
- Secrets are `op://` references only; see `docs/onepassword.md`.

## Rules that do not change

- Internal only: no HTTP transport, no listening port, no registry push, no public release.
- Resources are for static reads by ID; tools are for dynamic operations. Never implement the same thing as both.
- No emojis in code, docs, comments, or tool descriptions.

---

LDS 700.528 @ 528 Hz. Genesis Bond: ACTIVE.
