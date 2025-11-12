

# Two-Way Secret Synchronization

Comprehensive guide for setting up bidirectional secret synchronization between GitHub, on-premises servers, and multiple devices using 1Password as the source of truth.

## Architecture

```
                    1Password (Source of Truth)
                              │
                              ├─────────────────┐
                              ▼                 ▼
                        GitHub Actions    On-Prem Server
                              │                 │
                         (Build Trigger) (Webhook Receiver)
                              │                 │
                              └────────┬────────┘
                                       ▼
                            Device Sync Service
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
                Device 1            Device 2          Device N
              (Your Laptop)      (Desktop Mac)     (Linux Server)
```

## How It Works

### 1. GitHub → On-Prem (Build-Triggered Sync)

When you request a build on GitHub:
1. **GitHub Actions workflow** triggers on `workflow_run` event
2. Workflow loads secrets from **1Password** using service account
3. Sends webhook to **on-premises receiver** with sync request
4. On-prem server syncs secrets from 1Password
5. All local services get updated credentials

### 2. On-Prem → GitHub (Local Change Sync)

When secrets change on your local machine:
1. **Device sync service** monitors watched files (`.env.local`, `credentials.json`)
2. Detects changes and uploads to **1Password** (source of truth)
3. Notifies other devices via webhook
4. GitHub Actions cache invalidated on next build
5. All devices stay synchronized

### 3. Multi-Device Synchronization

All devices stay in sync through 1Password:
1. Device A changes secret
2. Uploads to 1Password
3. Notifies Device B, C, D...
4. Each device pulls latest from 1Password
5. All devices now have updated secrets

## Setup Guide

### Prerequisites

```bash
# Install required tools
brew install node jq 1password-cli

# Optional but recommended
brew install gh  # GitHub CLI
```

### Step 1: Initial Setup

```bash
# Run setup script
bash scripts/sync-service/setup-sync.sh
```

This will:
- Generate device ID
- Configure webhook receiver port
- Create webhook secret
- Setup sync interval
- Configure 1Password account

### Step 2: Configure GitHub Secrets

Add these secrets to your GitHub repository:

#### Option A: Using GitHub CLI

```bash
# 1. Webhook secret (from setup output)
echo "YOUR_WEBHOOK_SECRET" | gh secret set WEBHOOK_SECRET

# 2. On-prem webhook URLs (comma-separated)
echo "https://your-domain.com:3000/sync" | gh secret set ONPREM_WEBHOOK_URLS

# 3. Status URLs
echo "https://your-domain.com:3000/status" | gh secret set ONPREM_STATUS_URLS

# 4. 1Password service account token
# Create at: https://my.1password.com/lucidigital/settings/service-accounts
echo "YOUR_OP_TOKEN" | gh secret set OP_SERVICE_ACCOUNT_TOKEN
```

#### Option B: Via GitHub Web UI

1. Go to: `https://github.com/YOUR_ORG/luci-metabase-mcp/settings/secrets/actions`
2. Add each secret manually

### Step 3: Start Sync Services

```bash
# Start webhook receiver (listens for GitHub webhooks)
bash scripts/sync-service/start-webhook-receiver.sh --daemon

# Start device sync (monitors local changes)
bash scripts/sync-service/start-device-sync.sh --daemon
```

### Step 4: Test Setup

```bash
# Test all components
bash scripts/sync-service/test-sync.sh

# Trigger manual sync from GitHub
gh workflow run "Sync Secrets on Build"
```

## Adding Additional Devices

### On First Device (Already Setup)

```bash
# Add new device to sync network
bash scripts/sync-service/add-device.sh
```

Provide:
- Device ID: `macbook-pro-2024`
- Hostname: `daryl-macbook.local`
- Platform: `macos`
- Sync URL: `https://macbook.example.com:3000/sync`

### On New Device

```bash
# 1. Clone repository
git clone https://github.com/luci-digital/luci-metabase-mcp.git
cd luci-metabase-mcp

# 2. Sign in to 1Password
op signin --account lucidigital

# 3. Run setup (use SAME webhook secret)
bash scripts/sync-service/setup-sync.sh

# 4. Start services
bash scripts/sync-service/start-webhook-receiver.sh --daemon
bash scripts/sync-service/start-device-sync.sh --daemon

# 5. Test
bash scripts/sync-service/test-sync.sh
```

## Usage

### Manual Sync from Command Line

```bash
# Sync secrets from 1Password
bash scripts/onepass/sync-secrets.sh

# Trigger device sync
curl -X POST http://localhost:3000/sync \
  -H "Content-Type: application/json" \
  -d '{"source":"manual","deviceId":"current"}'
```

### Trigger Sync from GitHub

```bash
# Via GitHub CLI
gh workflow run "Sync Secrets on Build"

# Via GitHub UI
# Go to Actions → Sync Secrets on Build → Run workflow
```

### Monitor Sync Status

```bash
# Check webhook receiver status
curl http://localhost:3000/health | jq '.'

# Check device sync status
curl http://localhost:3000/status | jq '.'

# List all registered devices
bash scripts/sync-service/list-devices.sh

# View logs
tail -f .sync-service/logs/webhook-receiver.log
tail -f .sync-service/logs/device-sync.log
```

## Configuration

### Main Configuration File

**Location**: `.sync-service/config.json`

```json
{
  "deviceId": "hostname-timestamp",
  "port": 3000,
  "webhookSecret": "generated-secret",
  "syncInterval": 300000,
  "syncUrl": "https://your-domain.com:3000/sync",
  "opAccount": "lucidigital",
  "logLevel": "info"
}
```

### Watched Files

The device sync service monitors these files for changes:
- `.env.local`
- `credentials.json`
- `secrets.json`

When any of these files change, they're automatically:
1. Uploaded to 1Password
2. Synced to other devices
3. Available in next GitHub build

### Environment Variables

**Webhook Receiver**:
```bash
SYNC_PORT=3000                    # Webhook receiver port
DEVICE_ID=your-device-id          # Unique device identifier
WEBHOOK_SECRET=your-secret        # Webhook signature verification
```

**Device Sync**:
```bash
DEVICE_ID=your-device-id          # Same as webhook receiver
SYNC_INTERVAL=300000              # Sync interval (ms)
OP_ACCOUNT=lucidigital            # 1Password account
SYNC_URL=http://localhost:3000    # This device's webhook URL
```

## Exposing On-Prem to GitHub

GitHub needs to reach your on-premises webhook receiver. Options:

### Option 1: ngrok (Development/Testing)

```bash
# Install ngrok
brew install ngrok

# Expose webhook receiver
ngrok http 3000

# Use the ngrok URL in GitHub secrets
# Example: https://abc123.ngrok.io
echo "https://abc123.ngrok.io/sync" | gh secret set ONPREM_WEBHOOK_URLS
```

### Option 2: VPS Reverse Proxy (Production)

Setup a VPS with public IP:

```bash
# On VPS (nginx config)
server {
    listen 443 ssl;
    server_name sync.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://your-onprem-ip:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### Option 3: Router Port Forwarding

1. Configure router to forward port 3000 to your machine
2. Get public IP: `curl ifconfig.me`
3. Use in GitHub secrets: `http://YOUR_PUBLIC_IP:3000/sync`
4. Ensure firewall allows incoming connections

## Security

### Webhook Signature Verification

All webhooks from GitHub are verified using HMAC-SHA256:

```bash
# Signature is in X-Hub-Signature-256 header
# Format: sha256=<hex_signature>

# Verification happens automatically in webhook-receiver.js
```

### Secret Storage

- **1Password**: Source of truth, encrypted at rest
- **GitHub Secrets**: Encrypted by GitHub
- **Local `.env.local`**: Gitignored, should be in encrypted file system
- **Never commit**: All secret files are gitignored

### Access Control

- Webhook secret required for all sync requests
- 1Password service account has read-only access
- Device registration requires manual approval
- All sync operations logged

## Troubleshooting

### Webhook Receiver Not Starting

```bash
# Check if port is in use
lsof -i :3000

# Check 1Password authentication
op account list

# View logs
cat .sync-service/logs/webhook-receiver.log
```

### Secrets Not Syncing

```bash
# Test 1Password CLI
op item list --vault Development

# Test manual sync
bash scripts/onepass/sync-secrets.sh

# Check sync status
curl http://localhost:3000/status | jq '.'
```

### GitHub Webhook Failing

```bash
# Check GitHub webhook deliveries
# Go to: Settings → Webhooks → Recent Deliveries

# Test webhook locally
bash scripts/sync-service/test-sync.sh

# Check webhook secret matches
cat .sync-service/config.json | jq '.webhookSecret'
gh secret list | grep WEBHOOK_SECRET
```

### Device Not Syncing

```bash
# Check if device is registered
bash scripts/sync-service/list-devices.sh

# Check device sync logs
tail -f .sync-service/logs/device-sync.log

# Restart device sync
bash scripts/sync-service/stop-device-sync.sh
bash scripts/sync-service/start-device-sync.sh
```

### File Changes Not Detected

```bash
# Check if file is being watched
cat scripts/sync-service/src/device-sync.js | grep WATCH_FILES

# Test manual change
echo "# test" >> .env.local

# Check logs for detection
tail .sync-service/logs/device-sync.log
```

## Multi-Device Scenarios

### Scenario 1: Laptop + Desktop

**Laptop** (Device 1):
- Runs webhook receiver on port 3000
- Runs device sync service
- Exposed via ngrok: `https://laptop.ngrok.io`

**Desktop** (Device 2):
- Runs webhook receiver on port 3001
- Runs device sync service
- Exposed via ngrok: `https://desktop.ngrok.io`

**GitHub Secrets**:
```bash
ONPREM_WEBHOOK_URLS=https://laptop.ngrok.io/sync,https://desktop.ngrok.io/sync
ONPREM_STATUS_URLS=https://laptop.ngrok.io/status,https://desktop.ngrok.io/status
```

**Flow**:
1. Build triggered on GitHub
2. Both laptop AND desktop receive webhook
3. Both sync secrets from 1Password
4. Local changes on laptop notify desktop
5. Desktop pulls updated secrets

### Scenario 2: Multiple Developers

**Developer A** (Device 1):
- Device ID: `alice-macbook`
- Sync URL: `https://alice.example.com:3000/sync`

**Developer B** (Device 2):
- Device ID: `bob-linux`
- Sync URL: `https://bob.example.com:3000/sync`

**Shared GitHub**:
- Both devices in `ONPREM_WEBHOOK_URLS`
- Secrets stay synced across team
- Each developer has independent 1Password access

### Scenario 3: CI/CD Pipeline

**Production Server**:
- Runs webhook receiver in Docker
- Automated secret rotation
- Notifies all development machines

**Development Machines**:
- Pull secrets on build
- Test with production-like secrets
- No manual secret management

## Advanced Usage

### Custom Sync Logic

Edit `scripts/sync-service/src/device-sync.js` to add custom sync logic:

```javascript
// Add custom file watchers
const WATCH_FILES = [
  '.env.local',
  'credentials.json',
  'secrets.json',
  'custom-secrets.yml'  // Your custom file
];

// Add custom upload logic
async function uploadCustomSecret(filePath) {
  // Your custom logic here
}
```

### Conditional Sync

Only sync on specific conditions:

```javascript
async function handleFileChange(filePath) {
  // Only sync during business hours
  const hour = new Date().getHours();
  if (hour < 9 || hour > 17) {
    log.info('Outside business hours, skipping sync');
    return;
  }

  // Original sync logic...
}
```

### Multiple 1Password Vaults

Configure different vaults for different environments:

```javascript
const VAULT_MAP = {
  '.env.local': 'Development',
  '.env.production': 'Production',
  '.env.staging': 'Staging'
};

async function uploadSecretToOnePassword(filePath) {
  const fileName = path.basename(filePath);
  const vaultName = VAULT_MAP[fileName] || 'Development';
  // Upload to appropriate vault...
}
```

## API Reference

### Webhook Receiver Endpoints

#### `GET /health`
Health check endpoint.

**Response**:
```json
{
  "status": "healthy",
  "deviceId": "device-123",
  "uptime": 12345.67,
  "timestamp": "2025-11-12T10:30:00Z"
}
```

#### `GET /status`
Device sync status.

**Response**:
```json
{
  "deviceId": "device-123",
  "lastSync": "2025-11-12T10:25:00Z",
  "status": "synced",
  "hostname": "macbook-pro",
  "platform": "darwin"
}
```

#### `POST /sync`
Manual sync trigger.

**Request**:
```json
{
  "source": "manual",
  "deviceId": "device-123"
}
```

**Response**:
```json
{
  "message": "Manual sync completed",
  "deviceId": "device-123",
  "timestamp": "2025-11-12T10:30:00Z",
  "result": {
    "success": true,
    "output": "Synced 5 secrets"
  }
}
```

## Maintenance

### Regular Tasks

**Daily**:
- Check sync logs for errors
- Verify devices are online

**Weekly**:
- Review sync statistics
- Update webhook URLs if needed

**Monthly**:
- Rotate webhook secret
- Audit device registrations
- Update 1Password service account permissions

### Updating Webhook Secret

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -hex 32)

# 2. Update GitHub secret
echo "$NEW_SECRET" | gh secret set WEBHOOK_SECRET

# 3. Update local config on each device
jq ".webhookSecret = \"$NEW_SECRET\"" .sync-service/config.json > .sync-service/config.json.tmp
mv .sync-service/config.json.tmp .sync-service/config.json

# 4. Restart services
bash scripts/sync-service/stop-webhook-receiver.sh
bash scripts/sync-service/start-webhook-receiver.sh --daemon
```

### Log Rotation

```bash
# Add to crontab
0 0 * * * cd /path/to/project && find .sync-service/logs -name "*.log" -mtime +7 -delete
```

## Performance Tuning

### Adjust Sync Interval

```bash
# Edit config
jq '.syncInterval = 600000' .sync-service/config.json > .sync-service/config.json.tmp
mv .sync-service/config.json.tmp .sync-service/config.json

# Restart device sync
bash scripts/sync-service/stop-device-sync.sh
bash scripts/sync-service/start-device-sync.sh --daemon
```

### Reduce Watched Files

Edit `device-sync.js` to watch fewer files:

```javascript
const WATCH_FILES = [
  '.env.local'  // Only watch essential files
];
```

### Batch Notifications

Prevent notification storms by batching:

```javascript
let pendingNotifications = [];
let notificationTimer = null;

function scheduleNotification(changedFile) {
  pendingNotifications.push(changedFile);

  clearTimeout(notificationTimer);
  notificationTimer = setTimeout(() => {
    notifyDevices(pendingNotifications);
    pendingNotifications = [];
  }, 5000); // Batch for 5 seconds
}
```

## Resources

### Documentation
- [1Password CLI](https://developer.1password.com/docs/cli/)
- [GitHub Actions Webhooks](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#workflow_run)
- [Node.js Crypto](https://nodejs.org/api/crypto.html)

### Related Guides
- [ONEPASSWORD-INTEGRATION.md](ONEPASSWORD-INTEGRATION.md) - Main integration guide
- [HOOKS-SUMMARY.md](HOOKS-SUMMARY.md) - Automatic hooks summary
- [scripts/onepass/README.md](scripts/onepass/README.md) - Scripts reference

### Support
- GitHub Issues: [luci-digital/luci-metabase-mcp](https://github.com/luci-digital/luci-metabase-mcp/issues)
- 1Password Support: support@1password.com

---

**Last Updated**: 2025-11-12
**Version**: 1.0.0
**Maintainer**: luci-digital
