#!/usr/bin/env bash
# Add a new device to sync network

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Add Device to Sync Network ===${NC}\n"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEVICES_FILE="$PROJECT_ROOT/.sync-service/devices.json"

# Get device information
read -p "Device ID: " DEVICE_ID
read -p "Hostname: " HOSTNAME
read -p "Platform (macos/linux/windows): " PLATFORM
read -p "Sync URL (webhook endpoint): " SYNC_URL

# Create or load devices file
if [ -f "$DEVICES_FILE" ]; then
    DEVICES=$(cat "$DEVICES_FILE")
else
    mkdir -p "$(dirname "$DEVICES_FILE")"
    DEVICES='{"devices":[]}'
fi

# Add device
NEW_DEVICE=$(cat <<EOF
{
  "id": "$DEVICE_ID",
  "hostname": "$HOSTNAME",
  "platform": "$PLATFORM",
  "syncUrl": "$SYNC_URL",
  "registeredAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "lastSeen": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "addedManually": true
}
EOF
)

UPDATED=$(echo "$DEVICES" | jq ".devices += [$NEW_DEVICE]")
echo "$UPDATED" | jq '.' > "$DEVICES_FILE"

echo -e "\n${GREEN}✓ Device added successfully${NC}"
echo -e "\nDevice information:"
echo "$NEW_DEVICE" | jq '.'

echo -e "\n${BLUE}Next steps on the new device:${NC}"
echo -e "1. Clone this repository"
echo -e "2. Run: bash scripts/sync-service/setup-sync.sh"
echo -e "3. Use the same webhook secret across all devices"
