#!/usr/bin/env bash
# Start on-premises webhook receiver

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Starting Webhook Receiver ===${NC}\n"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load configuration
CONFIG_FILE="$PROJECT_ROOT/.sync-service/config.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}⚠ Configuration not found, creating default...${NC}"
    mkdir -p "$(dirname "$CONFIG_FILE")"

    cat > "$CONFIG_FILE" << 'EOF'
{
  "port": 3000,
  "deviceId": null,
  "webhookSecret": null,
  "syncInterval": 300000,
  "opAccount": "lucidigital",
  "logLevel": "info"
}
EOF

    echo -e "${GREEN}✓ Created default configuration${NC}"
    echo -e "${YELLOW}Please edit $CONFIG_FILE to configure your setup${NC}\n"
fi

# Read configuration
PORT=$(jq -r '.port // 3000' "$CONFIG_FILE")
DEVICE_ID=$(jq -r '.deviceId // null' "$CONFIG_FILE")
WEBHOOK_SECRET=$(jq -r '.webhookSecret // ""' "$CONFIG_FILE")

# Generate device ID if not set
if [ "$DEVICE_ID" = "null" ] || [ -z "$DEVICE_ID" ]; then
    DEVICE_ID=$(hostname)-$(date +%s)
    echo -e "${YELLOW}Generated device ID: $DEVICE_ID${NC}"

    # Update config
    jq ".deviceId = \"$DEVICE_ID\"" "$CONFIG_FILE" > "$CONFIG_FILE.tmp" && mv "$CONFIG_FILE.tmp" "$CONFIG_FILE"
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found${NC}"
    echo -e "Install Node.js: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✓ Node.js detected${NC}"

# Check if 1Password CLI is installed
if ! command -v op &> /dev/null; then
    echo -e "${YELLOW}⚠ 1Password CLI not found${NC}"
    echo -e "Install: brew install 1password-cli"
    exit 1
fi

echo -e "${GREEN}✓ 1Password CLI detected${NC}"

# Check 1Password authentication
if ! op account list &> /dev/null; then
    echo -e "${YELLOW}⚠ Not signed in to 1Password${NC}"
    echo -e "Sign in with: op signin --account lucidigital"
    exit 1
fi

echo -e "${GREEN}✓ 1Password authenticated${NC}\n"

# Export environment variables
export SYNC_PORT="$PORT"
export DEVICE_ID="$DEVICE_ID"
export WEBHOOK_SECRET="$WEBHOOK_SECRET"

# Create log directory
LOG_DIR="$PROJECT_ROOT/.sync-service/logs"
mkdir -p "$LOG_DIR"

# Start webhook receiver
echo -e "${BLUE}Starting webhook receiver...${NC}"
echo -e "  Port: $PORT"
echo -e "  Device ID: $DEVICE_ID"
echo -e "  Logs: $LOG_DIR/webhook-receiver.log\n"

# Start in background or foreground
if [ "${1:-}" = "--daemon" ]; then
    nohup node "$SCRIPT_DIR/src/webhook-receiver.js" > "$LOG_DIR/webhook-receiver.log" 2>&1 &
    PID=$!
    echo $PID > "$PROJECT_ROOT/.sync-service/webhook-receiver.pid"
    echo -e "${GREEN}✓ Webhook receiver started (PID: $PID)${NC}"
    echo -e "  View logs: tail -f $LOG_DIR/webhook-receiver.log"
    echo -e "  Stop: bash scripts/sync-service/stop-webhook-receiver.sh"
else
    echo -e "${YELLOW}Running in foreground (Ctrl+C to stop)${NC}\n"
    node "$SCRIPT_DIR/src/webhook-receiver.js" | tee "$LOG_DIR/webhook-receiver.log"
fi
