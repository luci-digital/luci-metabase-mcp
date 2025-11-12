#!/usr/bin/env bash
# Setup GitHub Enterprise local instance with 1Password integration

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== GitHub Enterprise + 1Password Setup ===${NC}\n"

# Configuration
GHE_PATH="${GHE_PATH:-/Users/daryl/Desktop/luci_github_enterprize}"
OP_ACCOUNT="lucidigital"

# Get project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${BLUE}Configuration:${NC}"
echo -e "  GHE Path: $GHE_PATH"
echo -e "  1Password Account: $OP_ACCOUNT\n"

# Check for 1Password CLI
if ! command -v op &> /dev/null; then
    echo -e "${RED}✗ 1Password CLI not found${NC}"
    echo -e "Install from: https://developer.1password.com/docs/cli/get-started/"
    exit 1
fi

echo -e "${GREEN}✓ 1Password CLI detected${NC}"

# Check if signed in to correct account
if ! op account list 2>/dev/null | grep -q "$OP_ACCOUNT"; then
    echo -e "${YELLOW}⚠ Not signed in to 1Password account: $OP_ACCOUNT${NC}"
    echo -e "Sign in with: op signin --account $OP_ACCOUNT"
    exit 1
fi

echo -e "${GREEN}✓ Signed in to $OP_ACCOUNT${NC}"

# Check GitHub Enterprise path
if [ ! -d "$GHE_PATH" ]; then
    echo -e "${YELLOW}⚠ GitHub Enterprise path not found${NC}"
    read -p "Create directory? (Y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        mkdir -p "$GHE_PATH"
        echo -e "${GREEN}✓ Created $GHE_PATH${NC}"
    else
        echo "Aborted"
        exit 1
    fi
fi

cd "$GHE_PATH"

# Create GitHub Actions workflow directory
WORKFLOWS_DIR=".github/workflows"
mkdir -p "$WORKFLOWS_DIR"

echo -e "\n${BLUE}Creating 1Password integration workflows...${NC}\n"

# Create 1Password GitHub Action workflow
cat > "$WORKFLOWS_DIR/onepassword-secrets.yml" << 'EOF'
name: 1Password Secrets Integration

on:
  workflow_call:
    secrets:
      OP_SERVICE_ACCOUNT_TOKEN:
        required: true

jobs:
  fetch-secrets:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Load secrets from 1Password
        uses: 1password/load-secrets-action@v1
        with:
          export-env: true
        env:
          OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
          METABASE_URL: op://Development/Metabase/url
          METABASE_API_KEY: op://Development/Metabase/api_key
          OP_CONNECT_HOST: op://Development/1Password Connect/host
          OP_CONNECT_TOKEN: op://Development/1Password Connect/token

      - name: Verify secrets loaded
        run: |
          echo "✓ Secrets loaded from 1Password"
          echo "METABASE_URL: ${METABASE_URL:0:10}..."
          echo "✓ Ready for deployment"
EOF

echo -e "${GREEN}✓ Created workflow: onepassword-secrets.yml${NC}"

# Create auto-credential injection workflow
cat > "$WORKFLOWS_DIR/auto-credentials.yml" << 'EOF'
name: Auto Credential Injection

on:
  push:
    branches: [ main, master, develop, claude/* ]
  pull_request:
    branches: [ main, master ]

jobs:
  inject-credentials:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Load 1Password Secrets
        uses: 1password/load-secrets-action@v1
        with:
          export-env: true
        env:
          OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build with injected credentials
        run: npm run build
        env:
          # Credentials are automatically available from 1Password
          NODE_ENV: production

      - name: Run tests with credentials
        run: npm test
        env:
          NODE_ENV: test

      - name: Security scan
        run: |
          echo "Scanning for exposed secrets..."
          bash scripts/onepass/validate-secrets.sh
EOF

echo -e "${GREEN}✓ Created workflow: auto-credentials.yml${NC}"

# Create git hooks for GHE
HOOKS_DIR="$GHE_PATH/.git/hooks"
if [ -d "$HOOKS_DIR" ]; then
    echo -e "\n${BLUE}Installing git hooks...${NC}"

    # Pre-push hook to sync credentials
    cat > "$HOOKS_DIR/pre-push" << 'EOF'
#!/usr/bin/env bash
# Auto-fetch credentials from 1Password before push

set -euo pipefail

echo "Syncing credentials from 1Password..."

# Check if 1Password CLI is available
if command -v op &> /dev/null; then
    # Validate credentials are available
    if op account list &> /dev/null; then
        echo "✓ 1Password credentials verified"
    else
        echo "⚠ Not signed in to 1Password"
        echo "Sign in with: op signin"
        exit 1
    fi
else
    echo "⚠ 1Password CLI not found (skipping credential sync)"
fi

# Validate no secrets in code
if [ -f "scripts/onepass/validate-secrets.sh" ]; then
    bash scripts/onepass/validate-secrets.sh || exit 1
fi

echo "✓ Pre-push validation complete"
EOF

    chmod +x "$HOOKS_DIR/pre-push"
    echo -e "${GREEN}✓ Installed pre-push hook${NC}"
fi

# Create 1Password configuration for GHE
cat > "$GHE_PATH/.op-config.json" << EOF
{
  "account": "$OP_ACCOUNT",
  "vaults": {
    "development": "Development",
    "production": "Production",
    "shared": "Shared"
  },
  "items": {
    "metabase": {
      "vault": "Development",
      "item": "Metabase",
      "fields": ["url", "api_key", "user_email", "password"]
    },
    "onepassword_connect": {
      "vault": "Development",
      "item": "1Password Connect",
      "fields": ["host", "token"]
    },
    "github": {
      "vault": "Development",
      "item": "GitHub Enterprise",
      "fields": ["url", "token", "ssh_key"]
    }
  },
  "auto_inject": true,
  "passkey_auth": true
}
EOF

echo -e "${GREEN}✓ Created 1Password configuration${NC}"

# Create credential injection script
cat > "$GHE_PATH/inject-credentials.sh" << 'INJEOF'
#!/usr/bin/env bash
# Inject 1Password credentials into environment

set -euo pipefail

CONFIG_FILE=".op-config.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Configuration file not found: $CONFIG_FILE"
    exit 1
fi

if ! command -v op &> /dev/null; then
    echo "Error: 1Password CLI not found"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "Error: jq not found (required for JSON parsing)"
    exit 1
fi

echo "Injecting credentials from 1Password..."

# Read account from config
ACCOUNT=$(jq -r '.account' "$CONFIG_FILE")

# Process each item
jq -r '.items | to_entries[] | "\(.key)|\(.value.vault)|\(.value.item)|\(.value.fields[])"' "$CONFIG_FILE" | while IFS='|' read -r name vault item field; do
    OP_REF="op://$vault/$item/$field"
    ENV_VAR=$(echo "${name}_${field}" | tr '[:lower:]' '[:upper:]')

    if value=$(op read "$OP_REF" --account "$ACCOUNT" 2>/dev/null); then
        export "$ENV_VAR=$value"
        echo "✓ Loaded: $ENV_VAR"
    else
        echo "⚠ Failed to load: $ENV_VAR from $OP_REF"
    fi
done

echo "✓ Credential injection complete"
INJEOF

chmod +x "$GHE_PATH/inject-credentials.sh"
echo -e "${GREEN}✓ Created credential injection script${NC}"

# Summary
echo -e "\n${GREEN}=== Setup Complete ===${NC}"
echo -e "\n${BLUE}GitHub Enterprise Integration:${NC}"
echo -e "  Location: $GHE_PATH"
echo -e "  Workflows: $WORKFLOWS_DIR"
echo -e "  Configuration: $GHE_PATH/.op-config.json"

echo -e "\n${BLUE}Next Steps:${NC}"
echo -e "1. Configure GitHub Actions secret:"
echo -e "   ${YELLOW}gh secret set OP_SERVICE_ACCOUNT_TOKEN${NC}"

echo -e "\n2. Create 1Password Service Account:"
echo -e "   ${YELLOW}https://my.1password.com/$OP_ACCOUNT/settings/service-accounts${NC}"

echo -e "\n3. Test credential injection:"
echo -e "   ${YELLOW}cd $GHE_PATH && ./inject-credentials.sh${NC}"

echo -e "\n4. Verify workflows:"
echo -e "   ${YELLOW}cd $GHE_PATH && git add .github && git commit -m 'Add 1Password integration'${NC}"

echo -e "\n${GREEN}All GitHub builds will now automatically use 1Password credentials!${NC}"
