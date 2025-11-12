#!/usr/bin/env bash
# Stop webhook receiver

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PID_FILE="$PROJECT_ROOT/.sync-service/webhook-receiver.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "Webhook receiver is not running"
    exit 0
fi

PID=$(cat "$PID_FILE")

if kill -0 "$PID" 2>/dev/null; then
    echo "Stopping webhook receiver (PID: $PID)..."
    kill "$PID"
    rm "$PID_FILE"
    echo "✓ Webhook receiver stopped"
else
    echo "Webhook receiver is not running (stale PID file removed)"
    rm "$PID_FILE"
fi
