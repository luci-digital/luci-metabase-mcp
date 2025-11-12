#!/usr/bin/env bash
# Test sync functionality

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Testing Sync Functionality ===${NC}\n"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_FILE="$PROJECT_ROOT/.sync-service/config.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}✗ Configuration not found${NC}"
    echo -e "Run: bash scripts/sync-service/setup-sync.sh first"
    exit 1
fi

PORT=$(jq -r '.port // 3000' "$CONFIG_FILE")
WEBHOOK_SECRET=$(jq -r '.webhookSecret // ""' "$CONFIG_FILE")

# Test 1: Health check
echo -e "${BLUE}Test 1: Health Check${NC}"
RESPONSE=$(curl -s http://localhost:$PORT/health || echo "FAILED")

if echo "$RESPONSE" | jq -e '.status == "healthy"' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "$RESPONSE" | jq '.'
else
    echo -e "${RED}✗ Health check failed${NC}"
    echo "$RESPONSE"
fi

echo ""

# Test 2: Device status
echo -e "${BLUE}Test 2: Device Status${NC}"
RESPONSE=$(curl -s http://localhost:$PORT/status || echo "FAILED")

if echo "$RESPONSE" | jq -e '.deviceId' > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Status check passed${NC}"
    echo "$RESPONSE" | jq '.'
else
    echo -e "${YELLOW}⊘ No status available yet${NC}"
fi

echo ""

# Test 3: Manual sync
echo -e "${BLUE}Test 3: Manual Sync${NC}"

PAYLOAD='{"source":"test","deviceId":"test-device"}'

if [ -n "$WEBHOOK_SECRET" ]; then
    SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | sed 's/^.* //')

    RESPONSE=$(curl -s -X POST http://localhost:$PORT/sync \
        -H "Content-Type: application/json" \
        -H "X-Hub-Signature-256: sha256=$SIGNATURE" \
        -d "$PAYLOAD" || echo "FAILED")
else
    RESPONSE=$(curl -s -X POST http://localhost:$PORT/sync \
        -H "Content-Type: application/json" \
        -d "$PAYLOAD" || echo "FAILED")
fi

if echo "$RESPONSE" | jq -e '.message' > /dev/null 2>&1; then
    STATUS=$(echo "$RESPONSE" | jq -r '.message')
    if [[ "$STATUS" == *"completed"* || "$STATUS" == *"successful"* ]]; then
        echo -e "${GREEN}✓ Manual sync passed${NC}"
    else
        echo -e "${YELLOW}⊘ Manual sync completed with warnings${NC}"
    fi
    echo "$RESPONSE" | jq '.'
else
    echo -e "${RED}✗ Manual sync failed${NC}"
    echo "$RESPONSE"
fi

echo ""

# Test 4: Check logs
echo -e "${BLUE}Test 4: Recent Logs${NC}"
LOG_FILE="$PROJECT_ROOT/.sync-service/logs/webhook-receiver.log"

if [ -f "$LOG_FILE" ]; then
    echo -e "${GREEN}Last 5 log entries:${NC}"
    tail -n 5 "$LOG_FILE" | while read -r line; do
        echo "$line" | jq '.' 2>/dev/null || echo "$line"
    done
else
    echo -e "${YELLOW}⊘ No logs available yet${NC}"
fi

echo ""
echo -e "${GREEN}=== Test Complete ===${NC}"
