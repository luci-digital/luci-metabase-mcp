# luci-metabase-mcp CHANGELOG

Historical record of releases and structural changes. Format validated by
`scripts/check-changelog.sh` (shared with luciverse-system-config).

**Current Version**: v1.1.0
**Last Updated**: 2026-09-13

---

## 2026-09 September Updates

### 2026-09-13: Repair and refactor, LuciVerse alignment (COMN 528 Hz)

- Removed orphaned subsystems that never built: Swift bridge, bridging-architecture, 89 empty submodule gitlinks, Nix flake, frontend/ansible/terraform stubs, Lighthouse CI, secret-sync workflow, VS Code theme, and session-summary documents. History is retained in git.
- Upgraded `@modelcontextprotocol/sdk` 0.6.1 to 1.30 and zod to 3.25. Tools are registered on `McpServer` with zod input schemas (`src/tools`) and delegate to the existing handlers; resources and prompts stay on the low-level handlers.
- Hardened 1Password resolution in `src/config.ts`: `op://` references are validated, resolved with `execFileSync` and an argument array (no shell), and any failure aborts startup instead of using the literal reference as a credential. `METABASE_URL` is now resolvable.
- Replaced the double-printing logger with a JSON-lines stderr logger; the advertised server version is read from `package.json`; `run()` accepts an injected transport and is covered by an in-memory SDK handshake test.
- Made the coverage gate real (`thresholds.global` matched no files) and pinned it at the measured floor: 79 percent lines, 74 percent branches, 90 percent functions, with `src/api.ts` excluded per the handler-level testing policy.
- Package renamed to `@luci-digital/luci-metabase-mcp` v1.1.0 (MIT, original author Jericho Sequitin credited as contributor).
- Added the `.lucia/` identity scaffold (`did:luci:luci-metabase-mcp`, 528 Hz, LDS 700.528, vault `Repository-Access-luci-metabase-mcp`) and `.lucia/threads` links to the related MCP paths in `luciverse-system-config` and `lucia_tooling_omzsh`.
- `.env.example` uses `op://Lucia-AI-Secrets/Metabase/*` references with `npm run env:inject`; added Claude Code and Zed wiring examples under `examples/`.
- Dockerfile reduced to a single internal-only stage with OCI labels and Genesis Bond defaults; no ports, no registry.
- CI consolidated into one workflow (Node 20 and 22, SHA-pinned actions); MCPB bundles are uploaded as workflow artifacts on tags, never published as releases.
- Refreshed the `.lucia/threads` cids for `modules/scm/luci-vcs/src/bin/mcp.rs` and `modules/scm/luci-vcs/examples/mcp.json.example` after lucia_tooling_omzsh corrected their stale `core/vcs/` paths (luci-digital/lucia_tooling_omzsh#14); thread ids are unchanged and identical across the three repos.

## 2026-03 March Updates

### 2026-03-10: 1Password op:// parsing

- Added native `op://` resolution in `src/config.ts` (superseded by the hardened resolver above).

## 2025-10 October Updates

### 2025-10-06: Fork baseline

- Forked from jerichosequitin/metabase-mcp at v1.0.1.
