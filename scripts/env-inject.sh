#!/usr/bin/env bash
# Generate .env from .env.example by resolving 1Password references.
# Requires the 1Password CLI (op) and a signed-in account.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE="${REPO_ROOT}/.env.example"
OUTPUT="${REPO_ROOT}/.env"

if ! command -v op >/dev/null 2>&1; then
    echo "[env-inject] 1Password CLI (op) is not installed."
    echo "  macOS:  brew install 1password-cli"
    echo "  Linux:  https://developer.1password.com/docs/cli/get-started/"
    exit 1
fi

if ! op account get >/dev/null 2>&1; then
    echo "[env-inject] Not signed in to 1Password. Run: op signin"
    exit 1
fi

op inject -f -i "${TEMPLATE}" -o "${OUTPUT}"
chmod 600 "${OUTPUT}"
echo "[env-inject] Wrote ${OUTPUT} (git-ignored)."
