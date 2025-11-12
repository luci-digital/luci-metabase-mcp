#!/usr/bin/env bash
# Session Start Hook for Claude Code
# Auto-setup 1Password integration environment

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=== Claude Code Session Start ===${NC}"
echo -e "${BLUE}Initializing 1Password Integration Environment${NC}\n"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load configuration
CONFIG_FILE="$PROJECT_ROOT/.claude/onepass-config.json"
if [ -f "$CONFIG_FILE" ]; then
    echo -e "${GREEN}✓ Configuration found${NC}"
else
    echo -e "${YELLOW}⚠ Configuration not found. Creating default config...${NC}"
    cat > "$CONFIG_FILE" << 'EOF'
{
  "repos": [
    {
      "name": "luci-onepass-os",
      "url": "https://github.com/luci-digital/luci-onepass-os.git",
      "description": "1Password for Open Source management"
    },
    {
      "name": "luci-onepassword-operator",
      "url": "https://github.com/luci-digital/luci-onepassword-operator.git",
      "description": "Kubernetes operator for 1Password"
    },
    {
      "name": "luci-passage-swift",
      "url": "https://github.com/luci-digital/luci-passage-swift.git",
      "description": "Swift SDK for passwordless auth"
    }
  ],
  "onepassword": {
    "connect_host": "${OP_CONNECT_HOST:-}",
    "connect_token": "${OP_CONNECT_TOKEN:-}",
    "vault": "${OP_VAULT:-}"
  },
  "paths": {
    "repos_dir": "luci_onepass_repos/repos",
    "logs_dir": "luci_onepass_repos/logs"
  },
  "auto_update": {
    "enabled": true,
    "interval_minutes": 60
  }
}
EOF
    echo -e "${GREEN}✓ Created default configuration${NC}"
fi

# Check for required tools
echo -e "\n${BLUE}Checking dependencies...${NC}"

MISSING_TOOLS=()

if ! command -v git &> /dev/null; then
    MISSING_TOOLS+=("git")
fi

if ! command -v node &> /dev/null; then
    MISSING_TOOLS+=("node")
fi

if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠ jq not found (optional, but recommended for JSON parsing)${NC}"
fi

if [ ${#MISSING_TOOLS[@]} -gt 0 ]; then
    echo -e "${RED}✗ Missing required tools: ${MISSING_TOOLS[*]}${NC}"
    exit 1
else
    echo -e "${GREEN}✓ All required tools available${NC}"
fi

# Check for 1Password CLI (optional)
if command -v op &> /dev/null; then
    echo -e "${GREEN}✓ 1Password CLI detected${NC}"
    OP_VERSION=$(op --version 2>/dev/null || echo "unknown")
    echo -e "  Version: $OP_VERSION"
else
    echo -e "${YELLOW}⚠ 1Password CLI not found (optional)${NC}"
    echo -e "  Install: https://developer.1password.com/docs/cli/get-started/"
fi

# Check environment variables
echo -e "\n${BLUE}Checking environment variables...${NC}"

ENV_WARNINGS=()

if [ -z "${OP_CONNECT_HOST:-}" ]; then
    ENV_WARNINGS+=("OP_CONNECT_HOST not set")
fi

if [ -z "${OP_CONNECT_TOKEN:-}" ]; then
    ENV_WARNINGS+=("OP_CONNECT_TOKEN not set")
fi

if [ ${#ENV_WARNINGS[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠ Optional environment variables not set:${NC}"
    for warning in "${ENV_WARNINGS[@]}"; do
        echo -e "  - $warning"
    done
    echo -e "\n${YELLOW}Set these in your .env file or environment for full functionality${NC}"
else
    echo -e "${GREEN}✓ 1Password Connect configuration detected${NC}"
fi

# Setup repository directory
REPOS_DIR="$PROJECT_ROOT/luci_onepass_repos/repos"
mkdir -p "$REPOS_DIR"
echo -e "\n${GREEN}✓ Repository directory ready: $REPOS_DIR${NC}"

# Check repository status
echo -e "\n${BLUE}Checking 1Password repositories...${NC}"

REPOS_TO_CLONE=()

for repo_name in "luci-onepass-os" "luci-onepassword-operator" "luci-passage-swift"; do
    if [ -d "$REPOS_DIR/$repo_name/.git" ]; then
        echo -e "${GREEN}✓ $repo_name${NC} - cloned"

        # Check if updates available (non-blocking)
        cd "$REPOS_DIR/$repo_name"
        if git fetch --quiet 2>/dev/null; then
            LOCAL=$(git rev-parse @ 2>/dev/null)
            REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "")

            if [ -n "$REMOTE" ] && [ "$LOCAL" != "$REMOTE" ]; then
                echo -e "  ${YELLOW}↻ Updates available${NC}"
            fi
        fi
        cd "$PROJECT_ROOT"
    else
        echo -e "${YELLOW}⚠ $repo_name${NC} - not cloned"
        REPOS_TO_CLONE+=("$repo_name")
    fi
done

# Offer to clone missing repos
if [ ${#REPOS_TO_CLONE[@]} -gt 0 ]; then
    echo -e "\n${YELLOW}Missing repositories: ${REPOS_TO_CLONE[*]}${NC}"
    echo -e "Run: ${BLUE}bash scripts/onepass/clone-repos.sh${NC} to clone them"
fi

# Show available commands
echo -e "\n${GREEN}=== Available Commands ===${NC}"
echo -e "${BLUE}Repository Management:${NC}"
echo -e "  bash scripts/onepass/clone-repos.sh      - Clone missing repositories"
echo -e "  bash scripts/onepass/update-repos.sh     - Update all repositories"
echo -e "  bash scripts/onepass/watch-repos.sh      - Watch and auto-update"
echo -e "\n${BLUE}1Password Integration:${NC}"
echo -e "  bash scripts/onepass/sync-secrets.sh     - Sync secrets from 1Password"
echo -e "  bash scripts/onepass/validate-secrets.sh - Validate local secrets"
echo -e "\n${BLUE}Automation:${NC}"
echo -e "  bash scripts/onepass/setup-auto-update.sh - Setup automatic updates"

echo -e "\n${GREEN}=== Session Ready ===${NC}\n"
