# Swift Bridge Package
# HTTP/WebSocket bridge for Apple ecosystem integration
{ pkgs, lib, version ? "1.0.1", src }:

# Note: Native Swift builds in Nix are experimental.
# This package uses pre-built binaries or external Swift toolchain.
# For full static builds, use: ./scripts/build-static-swift.sh

pkgs.stdenv.mkDerivation {
  pname = "luci-metabase-bridge";
  inherit version;
  src = "${src}/swift-bridge";

  # Build inputs
  nativeBuildInputs = with pkgs; [
    # Swift is not well-supported in nixpkgs
    # Using external toolchain via swiftly
  ];

  # Skip build if Swift not available, use pre-built binary
  buildPhase = ''
    if command -v swift &> /dev/null; then
      echo "Building with Swift..."
      swift build -c release \
        -Xswiftc -O \
        -Xlinker -s
    else
      echo "Swift not available in Nix. Use external build:"
      echo "  ./scripts/build-static-swift.sh x86_64 release"
      echo ""
      echo "Or install Swift via swiftly:"
      echo "  ./scripts/setup-toolchain.sh"
      exit 0
    fi
  '';

  installPhase = ''
    mkdir -p $out/bin $out/lib $out/share/doc

    # Copy binary if built
    if [ -f .build/release/LuciMetabaseBridge ]; then
      cp .build/release/LuciMetabaseBridge $out/bin/luci-metabase-bridge
      chmod +x $out/bin/luci-metabase-bridge
    fi

    # Copy source for reference
    mkdir -p $out/src
    cp -r Sources $out/src/
    cp Package.swift $out/src/

    # Documentation
    cat > $out/share/doc/README.md <<'EOF'
# Luci Metabase Bridge

Swift-based HTTP/WebSocket bridge for Metabase MCP.

## Building

For static Linux binaries:
```bash
./scripts/build-static-swift.sh x86_64 release
```

For macOS:
```bash
cd swift-bridge && swift build -c release
```

## Running

```bash
luci-metabase-bridge --host 0.0.0.0 --port 8001
```
EOF
  '';

  # Metadata
  meta = with lib; {
    description = "Swift HTTP/WebSocket bridge for Metabase MCP with Apple ecosystem integration";
    homepage = "https://github.com/luci-digital/luci-metabase-mcp";
    license = licenses.mit;
    platforms = platforms.linux ++ platforms.darwin;
    mainProgram = "luci-metabase-bridge";
  };
}
