# MCP Server Package (TypeScript/Node.js)
# Provides Metabase analytics access via Model Context Protocol
{ pkgs, lib, version ? "1.0.1", src }:

pkgs.buildNpmPackage {
  pname = "luci-metabase-mcp";
  inherit version src;

  # Hash will be computed on first build
  # Run: nix build .#mcp-server 2>&1 | grep "got:"
  npmDepsHash = lib.fakeSha256;

  # Node.js version requirement
  nodejs = pkgs.nodejs_20;

  # Build configuration
  npmBuildScript = "build:fast";

  # Environment
  NODE_ENV = "production";

  # Install phase
  installPhase = ''
    runHook preInstall

    mkdir -p $out/lib/node_modules/luci-metabase-mcp
    cp -r build/* $out/lib/node_modules/luci-metabase-mcp/
    cp package.json $out/lib/node_modules/luci-metabase-mcp/
    cp -r node_modules $out/lib/node_modules/luci-metabase-mcp/

    # Create executable wrapper
    mkdir -p $out/bin
    cat > $out/bin/luci-metabase-mcp <<'EOF'
#!/usr/bin/env bash
exec node "$out/lib/node_modules/luci-metabase-mcp/src/index.js" "$@"
EOF
    substituteInPlace $out/bin/luci-metabase-mcp \
      --replace '$out' "$out"
    chmod +x $out/bin/luci-metabase-mcp

    runHook postInstall
  '';

  # Metadata
  meta = with lib; {
    description = "MCP server providing AI assistants with optimized access to Metabase analytics data";
    homepage = "https://github.com/luci-digital/luci-metabase-mcp";
    license = licenses.mit;
    platforms = platforms.all;
    mainProgram = "luci-metabase-mcp";
  };
}
