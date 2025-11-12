#!/usr/bin/env bash
# Start device sync service

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Starting Device Sync Service ===${NC}\n"

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load configuration
CONFIG_FILE="$PROJECT_ROOT/.sync-service/config.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}✗ Configuration not found${NC}"
    echo -e "Run: bash scripts/sync-service/start-webhook-receiver.sh first"
    exit 1
fi

# Read configuration
DEVICE_ID=$(jq -r '.deviceId // null' "$CONFIG_FILE")
SYNC_INTERVAL=$(jq -r '.syncInterval // 300000' "$CONFIG_FILE")
OP_ACCOUNT=$(jq -r '.opAccount // "lucidigital"' "$CONFIG_FILE")
SYNC_URL=$(jq -r '.syncUrl // null' "$CONFIG_FILE")

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js detected${NC}"

# Check 1Password authentication
if ! op account list &> /dev/null; then
    echo -e "${YELLOW}⚠ Not signed in to 1Password${NC}"
    echo -e "Sign in with: op signin --account $OP_ACCOUNT"
    exit 1
fi

echo -e "${GREEN}✓ 1Password authenticated${NC}\n"

# Export environment variables
export DEVICE_ID="$DEVICE_ID"
export SYNC_INTERVAL="$SYNC_INTERVAL"
export OP_ACCOUNT="$OP_ACCOUNT"
export SYNC_URL="$SYNC_URL"

# Create log directory
LOG_DIR="$PROJECT_ROOT/.sync-service/logs"
mkdir -p "$LOG_DIR"

# Start device sync
echo -e "${BLUE}Starting device sync service...${NC}"
echo -e "  Device ID: $DEVICE_ID"
echo -e "  Sync Interval: $(($SYNC_INTERVAL / 60000)) minutes"
echo -e "  Account: $OP_ACCOUNT"
echo -e "  Logs: $LOG_DIR/device-sync.log\n"

# Start in background or foreground
if [ "${1:-}" = "--daemon" ]; then
    nohup node "$SCRIPT_DIR/src/device-sync.js" > "$LOG_DIR/device-sync.log" 2>&1 &
    PID=$!
    echo $PID > "$PROJECT_ROOT/.sync-service/device-sync.pid"
    echo -e "${GREEN}✓ Device sync service started (PID: $PID)${NC}"
    echo -e "  View logs: tail -f $LOG_DIR/device-sync.log"
    echo -e "  Stop: bash scripts/sync-service/stop-device-sync.sh"
else
    echo -e "${YELLOW}Running in foreground (Ctrl+C to stop)${NC}\n"
    node "$SCRIPT_DIR/src/device-sync.js" | tee "$LOG_DIR/device-sync.log"
fi
