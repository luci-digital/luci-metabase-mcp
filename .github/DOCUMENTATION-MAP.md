# Documentation Map

```
luci-metabase-mcp/
├── README.md                     entry point: tools, wiring, configuration, alignment
├── ARCHITECTURE.md               request path, caching, optimization, errors, identity
├── CLAUDE.md                     Claude Code development guide
├── AGENTS.md                     agent-facing behaviour: error guidance, recovery actions
├── CHANGELOG.md                  release record (format checked by scripts/check-changelog.sh)
├── docs/
│   ├── MCP-BUNDLE.md             bundle spec in the LuciVerse .mcp-bundles shape
│   ├── onepassword.md            secret references and injection
│   ├── enhanced-error-handling.md error categories and agent guidance
│   └── responses/                raw versus optimized response references
├── examples/                     Claude Code, Claude Desktop, and Zed wiring
└── .lucia/                       LuciVerse identity, peers, thread links
```

Cross-repository references:

- `luciverse-system-config/documentation/MCP_SERVER_PATTERN.md` defines the pattern this server implements.
- `luciverse-system-config/documentation/CLAUDE.md` and `NETWORK_REFERENCE.md` register it.
- `lucia_tooling_omzsh/aifam-mcp` is the sibling TypeScript MCP server whose conventions are shared here.

**Last Updated**: 2026-09-13
