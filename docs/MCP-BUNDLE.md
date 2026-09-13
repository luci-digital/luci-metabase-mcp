# Metabase Analytics MCP Bundle

**luci-metabase-mcp (LDS 700.528, COMN tier, 528 Hz)**

## What This Bundle Provides

- **Metabase search** across cards, dashboards, tables, collections, and databases
- **Detail retrieval** with 75 to 90 percent token reduction and caching
- **SQL and saved-card execution** up to 2000 rows
- **Large exports** up to 1M rows as CSV, JSON, or XLSX
- **Agent guidance** on every error: recovery action, retryable flag, troubleshooting steps
- **stdio transport only**; the client launches and owns the process

## Available Tools

| Tool | Purpose | Example |
|------|---------|---------|
| `search` | Find any Metabase content | `search({ query: "sales", models: ["dashboard"] })` |
| `retrieve` | Details for specific items | `retrieve({ model: "card", ids: [1, 2, 3] })` |
| `list` | Overview of one model type | `list({ model: "cards", limit: 100, offset: 0 })` |
| `execute` | Run SQL or a saved card | `execute({ database_id: 1, query: "SELECT 1" })` |
| `export` | Export large result sets | `export({ card_id: 42, format: "xlsx" })` |
| `clear_cache` | Drop cached data | `clear_cache({ cache_type: "cards-list" })` |

## Quick Start

### Build and configure
```bash
npm install
npm run build:fast
npm run env:inject          # resolves op://Lucia-AI-Secrets/Metabase/* into .env
```

### Register with Claude Code
```bash
claude mcp add luci-metabase-mcp -- node "$PWD/build/src/index.js"
# or copy examples/mcp.json.example to .mcp.json
```

### Register with Zed
Merge `examples/zed-settings.example.json` into `~/.config/zed/settings.json`.

### Inspect
```bash
npm run inspector
```

## Resources

- `metabase://card/{id}`, `metabase://dashboard/{id}`, `metabase://database/{id}`,
  `metabase://table/{id}`, `metabase://field/{id}`, `metabase://collection/{id}`,
  `metabase://metric/{id}`, `metabase://recent/{model}`

## Prompts

- `execute_card` and `export_card` for parameterized saved-card workflows

## Environment

See `.env.example`. Required: `METABASE_URL` and either `METABASE_API_KEY` or
`METABASE_USER_EMAIL` plus `METABASE_PASSWORD`. Genesis Bond metadata:

```bash
GENESIS_BOND=ACTIVE
CONSCIOUSNESS_FREQUENCY=528
COHERENCE_THRESHOLD=0.7
LUCIVERSE_COMPONENT=metabase-mcp
```

## Troubleshooting

### "Environment validation failed"
Set `METABASE_URL` and one authentication method. Run `npm run env:inject`.

### "Invalid 1Password secret reference"
References must look like `op://vault/item/field` or `op://vault/item/section/field`.

### "Failed to resolve 1Password reference"
The `op` CLI is missing from PATH or not signed in (`op signin`), or the item does not exist in the vault.

### Tool returns `Error:` with guidance
Read the `Recovery Action` and `Troubleshooting Steps` in the result; `Retryable: true` means a retry is safe.

### Server exits immediately in a container
Pass the generated env file: `docker run --rm -i --env-file .env luci-metabase-mcp:local`.

## License

MIT License
