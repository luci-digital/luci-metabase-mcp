#!/usr/bin/env bash
# Watch and auto-update 1Password repositories

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
UPDATE_SCRIPT="$SCRIPT_DIR/update-repos.sh"
UPDATE_INTERVAL=${UPDATE_INTERVAL:-3600}  # Default: 1 hour

echo -e "${GREEN}=== 1Password Repository Watcher ===${NC}"
echo -e "Update interval: $UPDATE_INTERVAL seconds ($(($UPDATE_INTERVAL / 60)) minutes)"
echo -e "Press Ctrl+C to stop\n"

# Trap for clean exit
trap 'echo -e "\n${YELLOW}Stopping watcher...${NC}"; exit 0' INT TERM

# Check if fswatch is available (for real-time watching)
if command -v fswatch &> /dev/null; then
    echo -e "${GREEN}Using fswatch for real-time monitoring${NC}\n"
    USE_FSWATCH=true
else
    echo -e "${YELLOW}fswatch not found. Using periodic updates${NC}"
    echo -e "Install with: brew install fswatch (macOS) or apt install fswatch (Linux)\n"
    USE_FSWATCH=false
fi

# Update function
update_repos() {
    echo -e "\n${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] Running update...${NC}"
    if bash "$UPDATE_SCRIPT"; then
        echo -e "${GREEN}Update completed${NC}"
    else
        echo -e "${RED}Update failed (see logs for details)${NC}"
    fi
}

if [ "$USE_FSWATCH" = true ]; then
    # Use fswatch for real-time monitoring
    REPOS_DIR="$PROJECT_ROOT/luci_onepass_repos/repos"

    if [ ! -d "$REPOS_DIR" ]; then
        echo -e "${RED}✗ Repository directory not found${NC}"
        echo -e "Run: bash scripts/onepass/clone-repos.sh first"
        exit 1
    fi

    # Initial update
    update_repos

    # Watch for changes with interval-based updates
    fswatch -0 -r -l "$UPDATE_INTERVAL" "$REPOS_DIR" | while read -d "" event; do
        update_repos
    done
else
    # Fallback to periodic updates
    while true; do
        update_repos
        echo -e "\n${BLUE}Next update in $(($UPDATE_INTERVAL / 60)) minutes...${NC}"
        sleep "$UPDATE_INTERVAL"
    done
fi
