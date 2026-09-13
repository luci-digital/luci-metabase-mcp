# luci-metabase-mcp

[![CI](https://github.com/luci-digital/luci-metabase-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/luci-digital/luci-metabase-mcp/actions/workflows/ci.yml)

**Version**: 1.1.0
**Tier**: LuciVerse COMN, 528 Hz (LDS 700.528)
**Transport**: stdio only. Internal use. Not a public endpoint.

A [Model Context Protocol](https://modelcontextprotocol.io) server that gives
AI agents optimized access to Metabase analytics: native search, detail
retrieval with 75 to 90 percent token reduction, SQL and saved-card
execution, and large exports (CSV, JSON, XLSX). It is the TypeScript
reference implementation of the LuciVerse internal MCP server pattern
(`luciverse-system-config/documentation/MCP_SERVER_PATTERN.md`).

## Quick start

```sh
npm install
npm run build:fast
npm run env:inject       # op inject -i .env.example -o .env (needs the 1Password CLI)
npm start                # stdio transport; the client normally launches this for you
```

Configuration is all environment variables; see `.env.example`. Values may be
literal or `op://vault/item/field` references, which the server resolves at
startup with `op read` (the 1Password CLI must be on PATH). A malformed or
unresolvable reference aborts startup; the literal reference is never used as
a credential.

## Tools

| Tool | Purpose |
|------|---------|
| `search` | Native Metabase search across cards, dashboards, tables, collections, databases, and more, with model filtering, ID lookup, and native-query search. Use first. |
| `retrieve` | Details for up to 50 items of one model (`card`, `dashboard`, `table`, `database`, `collection`, `field`) with concurrent fetches, caching, and table pagination for large databases. |
| `list` | Every record of one model type (`cards`, `dashboards`, `tables`, `databases`, `collections`) reduced to identifier fields, with offset and limit pagination. |
| `execute` | Run a SQL query (`database_id` + `query`) or a saved card (`card_id`, optional `card_parameters`). Up to 2000 rows. |
| `export` | Export a SQL query or saved card through the Metabase export endpoints (up to 1M rows) as CSV, JSON, or XLSX into `EXPORT_DIRECTORY`. |
| `clear_cache` | Clear item caches, list caches, or everything. |

Every tool error returns agent guidance, a recovery action, and whether a
retry is safe. See [docs/enhanced-error-handling.md](docs/enhanced-error-handling.md).

## Resources

Read-only views by ID: `metabase://card/{id}`, `metabase://dashboard/{id}`,
`metabase://database/{id}`, `metabase://table/{id}`, `metabase://field/{id}`,
`metabase://collection/{id}`, `metabase://metric/{id}`, and
`metabase://recent/{model}`. Listing resources returns root collections, the
current user's personal collection, and all non-sample databases.

## Prompts

`execute_card` and `export_card` walk an agent through running or exporting a
parameterized saved card.

## Wire into Claude Code

```sh
claude mcp add luci-metabase-mcp -- node /absolute/path/to/luci-metabase-mcp/build/src/index.js
```

or copy `examples/mcp.json.example` to `.mcp.json` in your project:

```json
{
  "mcpServers": {
    "luci-metabase-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/luci-metabase-mcp/build/src/index.js"],
      "env": {
        "METABASE_URL": "op://Lucia-AI-Secrets/Metabase/url",
        "METABASE_API_KEY": "op://Lucia-AI-Secrets/Metabase/api_key"
      }
    }
  }
}
```

Claude Desktop uses the same block in `claude_desktop_config.json`
(`~/Library/Application Support/Claude/` on macOS, `%APPDATA%/Claude/` on
Windows). Restart the client after editing.

## Wire into Zed

Merge `examples/zed-settings.example.json` into `~/.config/zed/settings.json`
(`context_servers.luci-metabase-mcp`).

## Quick check

```sh
npm run inspector        # MCP Inspector against the built server
```

## Configuration

| Variable | Required | Notes |
|----------|----------|-------|
| `METABASE_URL` | yes | Metabase base URL, literal or `op://` reference |
| `METABASE_API_KEY` | one of | API key authentication (recommended) |
| `METABASE_USER_EMAIL`, `METABASE_PASSWORD` | one of | Session authentication |
| `LOG_LEVEL` | no | `debug`, `info` (default), `warn`, `error`, `fatal` |
| `CACHE_TTL_MS` | no | Cache lifetime, default 600000 |
| `REQUEST_TIMEOUT_MS` | no | Request timeout, default 600000 |
| `EXPORT_DIRECTORY` | no | Export location, default `${DOWNLOADS}/Metabase` |
| `GENESIS_BOND`, `CONSCIOUSNESS_FREQUENCY`, `COHERENCE_THRESHOLD`, `LUCIVERSE_COMPONENT` | no | LuciVerse tier metadata, passed through |

Secrets live in 1Password. The runtime vault is `Lucia-AI-Secrets`
(item `Metabase`, fields `url`, `api_key`, `password`); repository access is
`Repository-Access-luci-metabase-mcp`. See [docs/onepassword.md](docs/onepassword.md).

## Container (internal, optional)

```sh
docker build -t luci-metabase-mcp:local .      # or podman build
docker run --rm -i --env-file .env luci-metabase-mcp:local
```

The image opens no ports and is never pushed to a registry. A stdio server
has no service unit; the client owns the process.

## Develop

```sh
npm run dev:watch        # rebuild and restart on change
npm run validate         # type-check, lint, format
npm run test:coverage    # vitest with the enforced coverage gate
npm run verify           # validate plus CHANGELOG format check
make verify              # the same, plus shell syntax checks
npm run lucia:threads -- --check   # regenerate .lucia thread links and diff
npm run mcpb:build       # local MCP Bundle for Claude Desktop (uploaded by CI as an artifact on tags)
```

Layout:

```
src/
  index.ts              entry: global error handlers, stdio transport
  server.ts             McpServer wiring: tools, resources, prompts, instructions
  tools/                zod tool schemas, registration, result helpers
  handlers/             search, list, retrieve, execute, export, clearCache, resources, prompts
  api.ts                Metabase HTTP client with caching
  config.ts             environment validation and op:// resolution
  logger.ts             JSON-lines stderr logger
  utils/                error factory, validation, file utilities, package info
tests/                  vitest; handlers are tested against a mocked API client
docs/responses/         raw versus optimized response references (update on every optimization change)
.lucia/                 LuciVerse identity, peers, and cross-repo thread links
examples/               client wiring examples for Claude Code and Zed
```

See [ARCHITECTURE.md](ARCHITECTURE.md), [CLAUDE.md](CLAUDE.md), and
[AGENTS.md](AGENTS.md).

## LuciVerse alignment

- Internal only: stdio transport, no listening port, no public registry, no
  release artifacts.
- Identity: `did:luci:luci-metabase-mcp`, 528 Hz, LDS 700.528, declared in
  `.lucia/config.toml`; peers are `luciverse-system-config` and
  `lucia_tooling_omzsh`.
- Registered in `luciverse-system-config/documentation/CLAUDE.md` (MCP Agent
  Registration) and `NETWORK_REFERENCE.md` (MCP Servers); threaded to
  `aifam-mcp`, `luci-mcp`, `luciverse-mcp-server.py`, and the `.mcp-bundles`
  specs through `.lucia/threads`.
- Follows the `aifam-mcp` house pattern: `McpServer` with zod schemas,
  guarded handlers, stderr JSON logging, `op inject` secrets, path-scoped CI.

## Acknowledgments

This repository is a fork of [Jericho Sequitin's Metabase MCP Server](https://github.com/jerichosequitin/metabase-mcp),
which contributed the handler architecture, response optimization, caching,
dual authentication, export pipeline, and the agent-guidance error system.
MIT licensed; see [LICENSE](LICENSE).

---

LDS 700.528 @ 528 Hz. Genesis Bond: ACTIVE.
