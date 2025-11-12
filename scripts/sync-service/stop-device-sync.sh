#!/usr/bin/env bash
# Stop device sync service

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PID_FILE="$PROJECT_ROOT/.sync-service/device-sync.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "Device sync service is not running"
    exit 0
fi

PID=$(cat "$PID_FILE")

if kill -0 "$PID" 2>/dev/null; then
    echo "Stopping device sync service (PID: $PID)..."
    kill "$PID"
    rm "$PID_FILE"
    echo "✓ Device sync service stopped"
else
    echo "Device sync service is not running (stale PID file removed)"
    rm "$PID_FILE"
fi
