#!/usr/bin/env bash
# List all registered devices

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEVICES_FILE="$PROJECT_ROOT/.sync-service/devices.json"

if [ ! -f "$DEVICES_FILE" ]; then
    echo -e "${YELLOW}No devices registered yet${NC}"
    exit 0
fi

echo -e "${GREEN}=== Registered Devices ===${NC}\n"

DEVICE_COUNT=$(jq '.devices | length' "$DEVICES_FILE")
echo -e "Total devices: $DEVICE_COUNT\n"

jq -r '.devices[] | "[\(.id)]
  Hostname: \(.hostname)
  Platform: \(.platform) (\(.arch))
  Registered: \(.registeredAt)
  Last Seen: \(.lastSeen)
  Sync URL: \(.syncUrl // "not configured")
"' "$DEVICES_FILE"
