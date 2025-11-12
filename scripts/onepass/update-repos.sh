#!/usr/bin/env bash
# Update all 1Password repositories

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Updating 1Password Repositories ===${NC}"
echo -e "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')\n"

# Get project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPOS_DIR="$PROJECT_ROOT/luci_onepass_repos/repos"
LOGS_DIR="$PROJECT_ROOT/luci_onepass_repos/logs"

# Create logs directory
mkdir -p "$LOGS_DIR"

# Log file
LOG_FILE="$LOGS_DIR/update-$(date '+%Y%m%d-%H%M%S').log"

# Redirect output to log and console
exec > >(tee -a "$LOG_FILE")
exec 2>&1

if [ ! -d "$REPOS_DIR" ]; then
    echo -e "${RED}✗ Repository directory not found: $REPOS_DIR${NC}"
    echo -e "Run: bash scripts/onepass/clone-repos.sh first"
    exit 1
fi

cd "$REPOS_DIR"

UPDATED=0
NO_CHANGES=0
FAILED=0
NOT_CLONED=0

for repo_name in "luci-onepass-os" "luci-onepassword-operator" "luci-passage-swift"; do
    echo -e "${BLUE}Checking: $repo_name${NC}"

    if [ ! -d "$repo_name/.git" ]; then
        echo -e "${RED}  ✗ Not cloned${NC}\n"
        NOT_CLONED=$((NOT_CLONED + 1))
        continue
    fi

    cd "$repo_name"

    # Get current branch
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    echo -e "  Branch: $CURRENT_BRANCH"

    # Fetch latest changes
    if ! git fetch --quiet 2>/dev/null; then
        echo -e "${RED}  ✗ Fetch failed${NC}\n"
        FAILED=$((FAILED + 1))
        cd "$REPOS_DIR"
        continue
    fi

    # Compare local and remote
    LOCAL=$(git rev-parse @ 2>/dev/null)
    REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "")

    if [ -z "$REMOTE" ]; then
        echo -e "${YELLOW}  ⊘ No upstream branch${NC}\n"
        NO_CHANGES=$((NO_CHANGES + 1))
    elif [ "$LOCAL" = "$REMOTE" ]; then
        echo -e "${GREEN}  ✓ Up to date${NC}\n"
        NO_CHANGES=$((NO_CHANGES + 1))
    else
        # Show what will be updated
        COMMITS_BEHIND=$(git rev-list --count HEAD..@{u} 2>/dev/null || echo "unknown")
        echo -e "  ${YELLOW}↻ $COMMITS_BEHIND commit(s) behind${NC}"

        # Pull changes
        if git pull --ff-only --quiet 2>/dev/null; then
            NEW_HASH=$(git rev-parse --short HEAD)
            echo -e "${GREEN}  ✓ Updated to $NEW_HASH${NC}\n"
            UPDATED=$((UPDATED + 1))
        else
            echo -e "${RED}  ✗ Update failed (conflicts or non-fast-forward)${NC}\n"
            FAILED=$((FAILED + 1))
        fi
    fi

    cd "$REPOS_DIR"
done

# Summary
echo -e "${GREEN}=== Summary ===${NC}"
echo -e "Updated: ${GREEN}$UPDATED${NC}"
echo -e "Up to date: ${GREEN}$NO_CHANGES${NC}"
echo -e "Not cloned: ${YELLOW}$NOT_CLONED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $NOT_CLONED -gt 0 ]; then
    echo -e "\n${YELLOW}Run: bash scripts/onepass/clone-repos.sh to clone missing repos${NC}"
fi

echo -e "\nLog saved: $LOG_FILE"

# Exit with error if any failures
if [ $FAILED -gt 0 ]; then
    exit 1
fi
