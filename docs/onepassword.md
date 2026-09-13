# 1Password integration

The server never stores credentials in git. Secrets are referenced by
1Password item paths and resolved in one of two ways.

## References

A reference has the form `op://<vault>/<item>/<field>` or
`op://<vault>/<item>/<section>/<field>`. Segments start with a letter or
digit and may contain spaces, dots, underscores, and hyphens.

| Vault | Purpose | Items |
|-------|---------|-------|
| `Lucia-AI-Secrets` | Runtime secrets for LuciVerse services (COMN tier) | `Metabase` with fields `url`, `api_key`, `password` |
| `Repository-Access-luci-metabase-mcp` | Repository access tokens (declared in `.lds-vault-access`) | managed by vault-keeper |

## Workflow 1: inject at setup (recommended)

```sh
npm run env:inject
```

runs `op inject -f -i .env.example -o .env` after checking that the `op`
CLI is installed and signed in. The resulting `.env` is git-ignored and
contains literal values, so the server needs no `op` at runtime.

## Workflow 2: resolve at startup

If an environment value still starts with `op://` when the server starts
(for example in `examples/mcp.json.example`), `src/config.ts` resolves it
with `src/utils/onePassword.ts`:

- the reference is validated against the strict pattern above;
- `op read --no-newline <ref>` is executed with `execFileSync` and an
  argument array, never through a shell;
- a missing binary, a non-zero exit, or an empty result throws and the
  server does not start.

Only `METABASE_URL`, `METABASE_API_KEY`, `METABASE_USER_EMAIL`, and
`METABASE_PASSWORD` are resolved. In a container, mount the CLI or prefer
workflow 1 and pass `--env-file .env`.

## GUI-launched clients (Claude Desktop)

A GUI client does not start the server from the repository, so workflow 1's
`.env` is never read, and workflow 2 only works if the Desktop process can
find `op` on its PATH with a valid session. Options, most robust first:

1. Install the MCP Bundle (`npm run mcpb:build`) and enter the values in
   Claude Desktop's extension settings; sensitive fields go to the OS
   keychain.
2. Put literal values in `claude_desktop_config.json`
   (`examples/claude_desktop_config.example.json`), obtained with
   `op read op://Lucia-AI-Secrets/Metabase/api_key`. The file is outside the
   repository and never committed.
3. Keep `op://` references in the config and set `OP_SERVICE_ACCOUNT_TOKEN`
   as a user-level environment variable so workflow 2 can resolve them
   without an interactive sign-in.

## Pre-commit protection

`scripts/validate-secrets.sh` (run by the husky pre-commit hook) blocks
commits containing credential-shaped values. `op://` references and the
documented placeholders in `.env.example` are allowed.
