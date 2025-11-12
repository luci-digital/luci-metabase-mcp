#!/usr/bin/env bash
# Clone 1Password-related repositories

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Cloning 1Password Repositories ===${NC}\n"

# Get project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REPOS_DIR="$PROJECT_ROOT/luci_onepass_repos/repos"

# Create directory
mkdir -p "$REPOS_DIR"
cd "$REPOS_DIR"

# Repository list
declare -A REPOS=(
    ["luci-onepass-os"]="https://github.com/luci-digital/luci-onepass-os.git"
    ["luci-onepassword-operator"]="https://github.com/luci-digital/luci-onepassword-operator.git"
    ["luci-passage-swift"]="https://github.com/luci-digital/luci-passage-swift.git"
)

CLONED=0
SKIPPED=0
FAILED=0

for repo_name in "${!REPOS[@]}"; do
    repo_url="${REPOS[$repo_name]}"

    echo -e "${BLUE}Processing: $repo_name${NC}"

    if [ -d "$repo_name/.git" ]; then
        echo -e "${YELLOW}  ⊘ Already cloned${NC}\n"
        SKIPPED=$((SKIPPED + 1))
        continue
    fi

    echo -e "  Cloning from: $repo_url"

    if git clone "$repo_url" "$repo_name" 2>&1 | sed 's/^/  /'; then
        echo -e "${GREEN}  ✓ Cloned successfully${NC}\n"
        CLONED=$((CLONED + 1))
    else
        echo -e "${RED}  ✗ Clone failed${NC}\n"
        FAILED=$((FAILED + 1))
    fi
done

# Summary
echo -e "${GREEN}=== Summary ===${NC}"
echo -e "Cloned: ${GREEN}$CLONED${NC}"
echo -e "Skipped: ${YELLOW}$SKIPPED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"

if [ $FAILED -gt 0 ]; then
    exit 1
fi

echo -e "\n${GREEN}All repositories ready!${NC}"
echo -e "Location: $REPOS_DIR"
