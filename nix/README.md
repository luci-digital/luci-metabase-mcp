# Nix Flake Architecture

This directory contains the modular Nix flake configuration following the "Lego services" pattern.

## Structure

```
nix/
├── packages/           # Individual service packages
│   ├── mcp-server.nix      # TypeScript MCP server
│   ├── swift-bridge.nix    # Swift HTTP/WebSocket bridge
│   └── personal-ai-container.nix  # Security components
├── images/             # OCI image definitions
│   ├── mcp-server.nix      # MCP server container
│   ├── swift-bridge.nix    # Swift bridge container
│   └── combined.nix        # Full stack container
├── devShells/          # Development environments
│   └── default.nix         # All shell definitions
├── checks/             # CI/CD validation
│   └── default.nix         # Lint, test, SBOM checks
└── lib/                # Helper functions
    └── helpers.nix         # Utility functions
```

## Quick Start

```bash
# Enter development shell
nix develop

# Build specific package
nix build .#mcp-server
nix build .#swift-bridge

# Build OCI image
nix build .#mcp-server-image

# Run checks
nix flake check

# Use specific dev shell
nix develop .#node    # Node.js only
nix develop .#swift   # Swift only
nix develop .#ops     # Operations tools
```

## Packages

| Package | Description |
|---------|-------------|
| `mcp-server` | TypeScript MCP server for Metabase |
| `swift-bridge` | Swift HTTP/WebSocket bridge |
| `personal-ai-container` | Security/isolation components |
| `mcp-server-image` | OCI image for MCP server |

## Dev Shells

| Shell | Tools Included |
|-------|---------------|
| `default` | Everything (Node, Python, Terraform, K8s, containers) |
| `node` | Node.js, npm, TypeScript, ESLint, Prettier |
| `swift` | Swift toolchain setup guidance |
| `ops` | Terraform, Ansible, kubectl, Helm, security scanners |
| `ci` | Minimal CI environment |

## Checks

| Check | Purpose |
|-------|---------|
| `lint` | ESLint validation |
| `typecheck` | TypeScript type checking |
| `format` | Prettier format check |
| `test` | Unit tests |
| `test-coverage` | Coverage with 80% threshold |
| `security-audit` | npm security audit |
| `sbom` | SBOM generation (SPDX + CycloneDX) |

## NixOS Module

Enable the MCP server as a systemd service:

```nix
{
  services.luci-metabase-mcp = {
    enable = true;
    metabaseUrl = "https://metabase.example.com";
    apiKeyFile = /run/secrets/metabase-api-key;
  };
}
```

## Adding New Packages

1. Create `nix/packages/your-package.nix`
2. Import in `flake.nix` under the packages section
3. Add OCI image if needed in `nix/images/`

## Swift Note

Swift is not well-supported in Nix. The `swift-bridge` package provides source code for external building. Use:

```bash
./scripts/build-static-swift.sh x86_64 release
```

Or install Swift via swiftly:

```bash
curl -L https://swiftlang.github.io/swiftly/swiftly-install.sh | bash
swiftly install latest
```
