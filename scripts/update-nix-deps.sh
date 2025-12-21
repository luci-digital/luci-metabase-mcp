#!/usr/bin/env bash
# Update Nix flake dependencies and hashes
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "Updating Nix flake..."
echo ""

# Check if nix is available
if ! command -v nix &> /dev/null; then
    echo "Error: Nix is not installed."
    echo ""
    echo "Install Nix:"
    echo "  curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install"
    echo ""
    echo "Or:"
    echo "  sh <(curl -L https://nixos.org/nix/install) --daemon"
    exit 1
fi

# Enable flakes if not already
export NIX_CONFIG="experimental-features = nix-command flakes"

echo "Step 1: Updating flake.lock..."
nix flake update

echo ""
echo "Step 2: Getting npmDepsHash..."
echo "Attempting build to extract hash..."

# Try to build and capture the hash
BUILD_OUTPUT=$(nix build .#mcp-server 2>&1 || true)

if echo "$BUILD_OUTPUT" | grep -q "got:"; then
    HASH=$(echo "$BUILD_OUTPUT" | grep "got:" | sed 's/.*got: *//')
    echo ""
    echo "Found hash: $HASH"
    echo ""
    echo "Update flake.nix line:"
    echo "  npmDepsHash = \"$HASH\";"
    echo ""

    # Optionally auto-update
    read -p "Auto-update flake.nix? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sed -i.bak "s|npmDepsHash = \"sha256-.*\"|npmDepsHash = \"$HASH\"|" flake.nix
        rm -f flake.nix.bak
        echo "Updated flake.nix"

        echo ""
        echo "Step 3: Rebuilding..."
        nix build .#mcp-server
        echo "Build successful!"
    fi
else
    echo "Could not extract hash. Build output:"
    echo "$BUILD_OUTPUT"
    echo ""
    echo "Manual steps:"
    echo "1. Run: nix build .#mcp-server 2>&1 | grep 'got:'"
    echo "2. Copy the hash"
    echo "3. Update flake.nix: npmDepsHash = \"<hash>\";"
fi

echo ""
echo "Step 4: Testing dev shell..."
echo "Run: nix develop"
