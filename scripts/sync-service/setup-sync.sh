#!/usr/bin/env bash
# Setup two-way sync between GitHub and on-premises

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Two-Way Sync Setup ===${NC}\n"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${BLUE}This will set up two-way secret synchronization between:${NC}"
echo -e "  - GitHub (your account)"
echo -e "  - On-premises (this machine)"
echo -e "  - Other devices (optional)\n"

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

MISSING=()

if ! command -v node &> /dev/null; then
    MISSING+=("Node.js")
fi

if ! command -v jq &> /dev/null; then
    MISSING+=("jq")
fi

if ! command -v op &> /dev/null; then
    MISSING+=("1Password CLI")
fi

if ! command -v gh &> /dev/null; then
    echo -e "${YELLOW}⚠ GitHub CLI not found (optional, but recommended)${NC}"
fi

if [ ${#MISSING[@]} -gt 0 ]; then
    echo -e "${RED}✗ Missing required tools: ${MISSING[*]}${NC}\n"
    echo -e "Install:"
    echo -e "  Node.js: https://nodejs.org/"
    echo -e "  jq: brew install jq"
    echo -e "  1Password CLI: brew install 1password-cli"
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites installed${NC}\n"

# Create directories
mkdir -p "$PROJECT_ROOT/.sync-service/logs"

# Configuration
echo -e "${BLUE}Configuration:${NC}\n"

# Device ID
read -p "Device ID (press Enter to auto-generate): " DEVICE_ID
if [ -z "$DEVICE_ID" ]; then
    DEVICE_ID=$(hostname)-$(date +%s)
    echo -e "Generated: $DEVICE_ID"
fi

# Port
read -p "Webhook receiver port (default: 3000): " PORT
PORT=${PORT:-3000}

# Webhook secret
read -p "Webhook secret (press Enter to generate): " -s WEBHOOK_SECRET
echo
if [ -z "$WEBHOOK_SECRET" ]; then
    WEBHOOK_SECRET=$(openssl rand -hex 32)
    echo -e "Generated: ${WEBHOOK_SECRET:0:10}..."
fi

# Sync interval
read -p "Sync interval in minutes (default: 5): " SYNC_MINUTES
SYNC_MINUTES=${SYNC_MINUTES:-5}
SYNC_INTERVAL=$((SYNC_MINUTES * 60000))

# Sync URL
read -p "Public webhook URL (e.g., https://your-domain.com:$PORT, press Enter to skip): " SYNC_URL

# Create configuration
CONFIG_FILE="$PROJECT_ROOT/.sync-service/config.json"

cat > "$CONFIG_FILE" << EOF
{
  "deviceId": "$DEVICE_ID",
  "port": $PORT,
  "webhookSecret": "$WEBHOOK_SECRET",
  "syncInterval": $SYNC_INTERVAL,
  "syncUrl": ${SYNC_URL:+\"$SYNC_URL\"},
  "opAccount": "lucidigital",
  "logLevel": "info",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo -e "\n${GREEN}✓ Configuration saved to: $CONFIG_FILE${NC}\n"

# GitHub secrets setup
echo -e "${BLUE}GitHub Secrets Setup:${NC}\n"

echo -e "You need to add these secrets to your GitHub repository:\n"

echo -e "${YELLOW}1. OP_SERVICE_ACCOUNT_TOKEN${NC}"
echo -e "   Create a 1Password service account:"
echo -e "   https://my.1password.com/lucidigital/settings/service-accounts\n"

echo -e "${YELLOW}2. WEBHOOK_SECRET${NC}"
echo -e "   Value: $WEBHOOK_SECRET\n"

echo -e "${YELLOW}3. ONPREM_WEBHOOK_URLS${NC}"
if [ -n "$SYNC_URL" ]; then
    echo -e "   Value: $SYNC_URL"
else
    echo -e "   Value: http://your-public-ip:$PORT/sync"
fi
echo -e "   (Comma-separated for multiple devices)\n"

echo -e "${YELLOW}4. ONPREM_STATUS_URLS${NC}"
if [ -n "$SYNC_URL" ]; then
    echo -e "   Value: ${SYNC_URL}/status"
else
    echo -e "   Value: http://your-public-ip:$PORT/status"
fi
echo -e "   (Comma-separated for multiple devices)\n"

if command -v gh &> /dev/null; then
    read -p "Add secrets to GitHub now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "\n${BLUE}Adding secrets to GitHub...${NC}\n"

        echo "$WEBHOOK_SECRET" | gh secret set WEBHOOK_SECRET

        if [ -n "$SYNC_URL" ]; then
            echo "$SYNC_URL" | gh secret set ONPREM_WEBHOOK_URLS
            echo "${SYNC_URL}/status" | gh secret set ONPREM_STATUS_URLS
        fi

        echo -e "${GREEN}✓ Secrets added${NC}"
        echo -e "${YELLOW}Note: You still need to manually add OP_SERVICE_ACCOUNT_TOKEN${NC}\n"
    fi
fi

# Test configuration
echo -e "${BLUE}Testing configuration...${NC}\n"

# Check 1Password authentication
if op account list &> /dev/null; then
    echo -e "${GREEN}✓ 1Password authenticated${NC}"
else
    echo -e "${YELLOW}⚠ Not signed in to 1Password${NC}"
    echo -e "Sign in with: op signin --account lucidigital\n"
fi

# Summary
echo -e "\n${GREEN}=== Setup Complete ===${NC}\n"

echo -e "${BLUE}Next Steps:${NC}\n"

echo -e "1. ${YELLOW}Start webhook receiver:${NC}"
echo -e "   bash scripts/sync-service/start-webhook-receiver.sh --daemon\n"

echo -e "2. ${YELLOW}Start device sync:${NC}"
echo -e "   bash scripts/sync-service/start-device-sync.sh --daemon\n"

echo -e "3. ${YELLOW}Test webhook:${NC}"
echo -e "   curl -X POST http://localhost:$PORT/health\n"

echo -e "4. ${YELLOW}View logs:${NC}"
echo -e "   tail -f .sync-service/logs/webhook-receiver.log"
echo -e "   tail -f .sync-service/logs/device-sync.log\n"

echo -e "5. ${YELLOW}Trigger GitHub build to test sync:${NC}"
echo -e "   gh workflow run 'Sync Secrets on Build'\n"

if [ -z "$SYNC_URL" ]; then
    echo -e "${YELLOW}Note: You need to expose port $PORT for GitHub webhooks to reach this machine${NC}"
    echo -e "Options:"
    echo -e "  - Use ngrok: ngrok http $PORT"
    echo -e "  - Setup port forwarding on your router"
    echo -e "  - Use a VPS with reverse proxy"
fi

echo -e "\n${GREEN}Configuration saved to: $CONFIG_FILE${NC}"
