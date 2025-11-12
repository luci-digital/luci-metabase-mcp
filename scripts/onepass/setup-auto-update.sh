#!/usr/bin/env bash
# Setup automatic updates for 1Password repositories
# Supports: launchd (macOS), systemd (Linux)

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Setup Automatic Repository Updates ===${NC}\n"

# Get project root and paths
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
UPDATE_SCRIPT="$SCRIPT_DIR/update-repos.sh"
LOGS_DIR="$PROJECT_ROOT/luci_onepass_repos/logs"

# Create logs directory
mkdir -p "$LOGS_DIR"

# Detect platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="macos"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    PLATFORM="linux"
else
    echo -e "${RED}✗ Unsupported platform: $OSTYPE${NC}"
    echo -e "Supported: macOS, Linux"
    exit 1
fi

echo -e "${BLUE}Detected platform: $PLATFORM${NC}\n"

# Configuration
UPDATE_INTERVAL=3600  # 1 hour
SERVICE_NAME="luci-onepass-auto-update"

if [ "$PLATFORM" = "macos" ]; then
    # macOS: launchd
    echo -e "${BLUE}Setting up launchd service...${NC}"

    PLIST_DIR="$HOME/Library/LaunchAgents"
    PLIST_FILE="$PLIST_DIR/com.luci.onepass.auto-update.plist"

    mkdir -p "$PLIST_DIR"

    cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.luci.onepass.auto-update</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>$UPDATE_SCRIPT</string>
    </array>

    <key>StartInterval</key>
    <integer>$UPDATE_INTERVAL</integer>

    <key>RunAtLoad</key>
    <true/>

    <key>StandardOutPath</key>
    <string>$LOGS_DIR/auto-update.log</string>

    <key>StandardErrorPath</key>
    <string>$LOGS_DIR/auto-update.error.log</string>

    <key>WorkingDirectory</key>
    <string>$PROJECT_ROOT</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
</dict>
</plist>
EOF

    echo -e "${GREEN}✓ Created launchd configuration${NC}"

    # Unload if already loaded
    launchctl unload "$PLIST_FILE" 2>/dev/null || true

    # Load the service
    if launchctl load "$PLIST_FILE"; then
        echo -e "${GREEN}✓ Service loaded successfully${NC}"
    else
        echo -e "${YELLOW}⚠ Could not load service${NC}"
    fi

    # Show status
    echo -e "\n${BLUE}Service Status:${NC}"
    launchctl list | grep "luci.onepass" || echo "Service will start on next interval or reboot"

    echo -e "\n${GREEN}=== Setup Complete ===${NC}"
    echo -e "Update interval: Every $(($UPDATE_INTERVAL / 60)) minutes"
    echo -e "\nLogs:"
    echo -e "  Output: $LOGS_DIR/auto-update.log"
    echo -e "  Errors: $LOGS_DIR/auto-update.error.log"
    echo -e "\nUseful commands:"
    echo -e "  View logs: tail -f $LOGS_DIR/auto-update.log"
    echo -e "  Check status: launchctl list | grep luci.onepass"
    echo -e "  Stop service: launchctl unload $PLIST_FILE"
    echo -e "  Start service: launchctl load $PLIST_FILE"
    echo -e "  Manual update: bash $UPDATE_SCRIPT"

elif [ "$PLATFORM" = "linux" ]; then
    # Linux: systemd
    echo -e "${BLUE}Setting up systemd service...${NC}"

    SERVICE_FILE="$HOME/.config/systemd/user/$SERVICE_NAME.service"
    TIMER_FILE="$HOME/.config/systemd/user/$SERVICE_NAME.timer"

    mkdir -p "$HOME/.config/systemd/user"

    # Create service
    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=1Password Repository Auto-Update
After=network.target

[Service]
Type=oneshot
ExecStart=/bin/bash $UPDATE_SCRIPT
WorkingDirectory=$PROJECT_ROOT
StandardOutput=append:$LOGS_DIR/auto-update.log
StandardError=append:$LOGS_DIR/auto-update.error.log

[Install]
WantedBy=default.target
EOF

    # Create timer
    cat > "$TIMER_FILE" << EOF
[Unit]
Description=1Password Repository Auto-Update Timer
Requires=$SERVICE_NAME.service

[Timer]
OnBootSec=1min
OnUnitActiveSec=$(($UPDATE_INTERVAL))s

[Install]
WantedBy=timers.target
EOF

    echo -e "${GREEN}✓ Created systemd service and timer${NC}"

    # Reload systemd
    systemctl --user daemon-reload

    # Enable and start timer
    systemctl --user enable "$SERVICE_NAME.timer"
    systemctl --user start "$SERVICE_NAME.timer"

    echo -e "${GREEN}✓ Service enabled and started${NC}"

    # Show status
    echo -e "\n${BLUE}Service Status:${NC}"
    systemctl --user status "$SERVICE_NAME.timer" --no-pager || true

    echo -e "\n${GREEN}=== Setup Complete ===${NC}"
    echo -e "Update interval: Every $(($UPDATE_INTERVAL / 60)) minutes"
    echo -e "\nLogs:"
    echo -e "  Output: $LOGS_DIR/auto-update.log"
    echo -e "  Errors: $LOGS_DIR/auto-update.error.log"
    echo -e "\nUseful commands:"
    echo -e "  View logs: tail -f $LOGS_DIR/auto-update.log"
    echo -e "  Check status: systemctl --user status $SERVICE_NAME.timer"
    echo -e "  Stop timer: systemctl --user stop $SERVICE_NAME.timer"
    echo -e "  Start timer: systemctl --user start $SERVICE_NAME.timer"
    echo -e "  Disable: systemctl --user disable $SERVICE_NAME.timer"
    echo -e "  Manual update: bash $UPDATE_SCRIPT"
fi
