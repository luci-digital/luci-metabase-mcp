#!/usr/bin/env bash
# Validate that no secrets are being committed

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Validating secrets in staged files...${NC}"

# Get staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [ -z "$STAGED_FILES" ]; then
    echo -e "${GREEN}✓ No files staged${NC}"
    exit 0
fi

# Patterns to check for secrets
PATTERNS=(
    # 1Password
    "op://[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+"                    # 1Password secret references
    "OP_CONNECT_TOKEN=['\"]?[A-Za-z0-9_-]{40,}['\"]?"      # 1Password Connect tokens
    "OP_SERVICE_ACCOUNT_TOKEN=['\"]?[A-Za-z0-9_-]{40,}"    # 1Password service account tokens

    # Generic secrets
    "METABASE_API_KEY=['\"]?[A-Za-z0-9_-]{32,}['\"]?"      # Metabase API keys
    "METABASE_PASSWORD=['\"]?[^'\"\s]{8,}['\"]?"           # Metabase passwords
    "password['\"]?\s*[:=]\s*['\"]?[^'\"\s]{8,}['\"]?"     # Generic password fields

    # API tokens and keys
    "['\"]?[A-Za-z0-9_-]{32,}['\"]?\s*#.*[Aa][Pp][Ii].*[Kk]ey"  # API keys with comments
    "Bearer [A-Za-z0-9_-]{32,}"                            # Bearer tokens
    "ghp_[A-Za-z0-9]{36,}"                                 # GitHub personal access tokens
    "gho_[A-Za-z0-9]{36,}"                                 # GitHub OAuth tokens

    # AWS
    "AKIA[0-9A-Z]{16}"                                     # AWS Access Key ID
    "['\"]?aws_secret_access_key['\"]?\s*[:=]"             # AWS Secret Access Key

    # Private keys
    "-----BEGIN [A-Z]+ PRIVATE KEY-----"                   # Private key headers
)

# Files to always check
ALWAYS_CHECK=(
    ".env"
    ".env.local"
    ".env.production"
    "credentials.json"
    "secrets.json"
)

ISSUES_FOUND=0
SUSPICIOUS_FILES=()

# Check each staged file
for file in $STAGED_FILES; do
    if [ ! -f "$file" ]; then
        continue
    fi

    # Always flag certain files
    for check_file in "${ALWAYS_CHECK[@]}"; do
        if [[ "$file" == *"$check_file"* ]]; then
            echo -e "${RED}✗ Sensitive file detected: $file${NC}"
            SUSPICIOUS_FILES+=("$file")
            ISSUES_FOUND=$((ISSUES_FOUND + 1))
            break
        fi
    done

    # Check for secret patterns
    for pattern in "${PATTERNS[@]}"; do
        if grep -qE "$pattern" "$file" 2>/dev/null; then
            MATCHES=$(grep -nE "$pattern" "$file" | head -5)
            echo -e "${RED}✗ Potential secret in: $file${NC}"
            echo -e "${YELLOW}Pattern: $pattern${NC}"
            echo -e "Matches:"
            echo "$MATCHES" | while read -r line; do
                echo -e "  ${YELLOW}$line${NC}"
            done
            echo ""
            SUSPICIOUS_FILES+=("$file")
            ISSUES_FOUND=$((ISSUES_FOUND + 1))
            break
        fi
    done
done

# Summary
if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓ No secrets detected${NC}"
    exit 0
else
    echo -e "${RED}=== Secret Validation Failed ===${NC}"
    echo -e "${RED}Found $ISSUES_FOUND potential issue(s)${NC}\n"

    echo -e "${YELLOW}Suspicious files:${NC}"
    for file in "${SUSPICIOUS_FILES[@]}"; do
        echo -e "  - $file"
    done

    echo -e "\n${YELLOW}What to do:${NC}"
    echo -e "1. Remove secrets from these files"
    echo -e "2. Use 1Password secret references instead: op://vault/item/field"
    echo -e "3. Add sensitive files to .gitignore"
    echo -e "4. Use environment variables or .env files (not committed)"
    echo -e "\n${YELLOW}If you're certain these aren't secrets:${NC}"
    echo -e "  git commit --no-verify (use with caution!)"

    exit 1
fi
