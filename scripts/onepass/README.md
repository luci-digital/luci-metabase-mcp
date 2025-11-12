# 1Password Integration Scripts

Automated tools for 1Password credential management, GitHub Enterprise integration, and passkey authentication.

## Quick Reference

### Repository Management
```bash
bash clone-repos.sh          # Clone all 1Password repositories
bash update-repos.sh         # Update all repositories
bash watch-repos.sh          # Watch and auto-update
bash setup-auto-update.sh    # Setup launchd/systemd automation
```

### Secret Management
```bash
bash sync-secrets.sh         # Sync secrets from 1Password to .env.local
bash validate-secrets.sh     # Scan for exposed secrets in git
```

### GitHub Enterprise
```bash
bash setup-github-enterprise.sh   # Setup GHE with 1Password integration
cd /Users/daryl/Desktop/luci_github_enterprize
./inject-credentials.sh           # Inject credentials for local builds
```

### Passkey Authentication
```bash
bash setup-passkey-auth.sh        # Setup passkey system
bash ../.passkey/auth-helper.sh register    # Register new passkey
bash ../.passkey/auth-helper.sh federate github  # Federate account
```

### Kubernetes Operator
```bash
bash connect-operator.sh status    # Check operator status
bash connect-operator.sh install   # Install operator
bash connect-operator.sh create    # Create OnePasswordItem
bash connect-operator.sh list      # List all items
```

## Script Details

### clone-repos.sh
Clones all 1Password-related repositories to `luci_onepass_repos/repos/`:
- luci-onepass-os
- luci-onepassword-operator
- luci-passage-swift

**Usage**: `bash clone-repos.sh`

### update-repos.sh
Updates all cloned repositories with latest changes from remote.

Features:
- Fetches and pulls latest changes
- Logs all updates
- Handles conflicts gracefully
- Provides summary statistics

**Usage**: `bash update-repos.sh`

### watch-repos.sh
Continuously monitors repositories and auto-updates when changes detected.

Features:
- Real-time monitoring with fswatch (if available)
- Fallback to periodic checks
- Configurable update interval
- Clean exit handling

**Usage**:
```bash
# Default interval (1 hour)
bash watch-repos.sh

# Custom interval (30 minutes)
UPDATE_INTERVAL=1800 bash watch-repos.sh
```

### setup-auto-update.sh
Sets up automatic repository updates using system services.

Platform Support:
- **macOS**: launchd
- **Linux**: systemd

**Usage**: `bash setup-auto-update.sh`

### sync-secrets.sh
Syncs secrets from 1Password to local `.env.local` file.

Features:
- Fetches secrets using 1Password CLI
- Creates `.env.local` with all credentials
- Automatically adds to .gitignore
- Handles missing secrets gracefully

**Usage**: `bash sync-secrets.sh`

**Required**: 1Password CLI installed and authenticated

### validate-secrets.sh
Scans staged git files for potential secret exposure.

Detects:
- 1Password secret references
- API keys and tokens
- Passwords
- Private keys
- AWS credentials
- GitHub tokens

**Usage**:
```bash
# Manual scan
bash validate-secrets.sh

# Automatically runs in pre-commit hook
git commit -m "your changes"
```

### setup-github-enterprise.sh
Configures GitHub Enterprise instance with 1Password integration.

Creates:
- GitHub Actions workflows
- Git hooks for validation
- Credential injection scripts
- 1Password configuration

**Usage**:
```bash
# Use default path
bash setup-github-enterprise.sh

# Custom path
GHE_PATH=/custom/path bash setup-github-enterprise.sh
```

### setup-passkey-auth.sh
Sets up complete passkey authentication system.

Features:
- Single passkey for all services
- Biometric authentication
- Web2/Web3 federation
- 1Password backup

**Usage**: `bash setup-passkey-auth.sh`

### connect-operator.sh
Manages 1Password Kubernetes Operator.

Commands:
- `status` - Check deployment status
- `install` - Install operator with Helm
- `uninstall` - Remove operator
- `logs` - View operator logs
- `create` - Create sample OnePasswordItem
- `list` - List all OnePasswordItems

**Usage**: `bash connect-operator.sh <command>`

## Environment Variables

### Required
```bash
OP_CONNECT_HOST=https://your-connect.1password.com
OP_CONNECT_TOKEN=your-token
```

### Optional
```bash
GHE_PATH=/path/to/github-enterprise  # Default: /Users/daryl/Desktop/luci_github_enterprize
UPDATE_INTERVAL=3600                  # Update interval in seconds (default: 1 hour)
OP_ACCOUNT=lucidigital               # 1Password account name
```

## Prerequisites

### Required
- Git
- Bash 4.0+
- 1Password CLI (`op`)

### Optional
- jq (for JSON parsing)
- fswatch (for real-time file watching)
- kubectl (for Kubernetes operator)
- helm (for operator installation)

### Installation
```bash
# macOS
brew install 1password-cli jq fswatch kubectl helm

# Linux (Ubuntu/Debian)
# Follow 1Password CLI installation: https://developer.1password.com/docs/cli/get-started/
sudo apt install jq fswatch kubectl

# Install Helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
```

## Directory Structure

```
scripts/onepass/
├── README.md                      # This file
├── clone-repos.sh                 # Clone repositories
├── update-repos.sh                # Update repositories
├── watch-repos.sh                 # Watch and auto-update
├── setup-auto-update.sh           # Setup system automation
├── sync-secrets.sh                # Sync secrets from 1Password
├── validate-secrets.sh            # Scan for exposed secrets
├── setup-github-enterprise.sh     # Setup GitHub Enterprise
├── setup-passkey-auth.sh          # Setup passkey authentication
└── connect-operator.sh            # Kubernetes operator management

Related directories:
luci_onepass_repos/
├── repos/                         # Cloned repositories
│   ├── luci-onepass-os/
│   ├── luci-onepassword-operator/
│   └── luci-passage-swift/
└── logs/                          # Update logs

.passkey/
├── config.json                    # Passkey configuration
├── auth-helper.sh                 # Authentication helper
├── web3-integration.sh            # Web3 integration
└── federate-credentials.sh        # Credential federation
```

## Common Workflows

### Initial Setup
```bash
# 1. Sign in to 1Password
op signin --account lucidigital

# 2. Clone repositories
bash clone-repos.sh

# 3. Sync secrets
bash sync-secrets.sh

# 4. Setup GitHub Enterprise
bash setup-github-enterprise.sh

# 5. Setup passkey authentication
bash setup-passkey-auth.sh

# 6. Enable automatic updates
bash setup-auto-update.sh
```

### Daily Development
```bash
# Update repositories
bash update-repos.sh

# Sync latest secrets
bash sync-secrets.sh

# Validate before commit (automatic in pre-commit hook)
bash validate-secrets.sh
```

### Credential Management
```bash
# Sync from 1Password
bash sync-secrets.sh

# Inject into GitHub Enterprise build
cd /Users/daryl/Desktop/luci_github_enterprize
./inject-credentials.sh
npm run build
```

### Kubernetes Deployment
```bash
# Check operator status
bash connect-operator.sh status

# Install if not present
bash connect-operator.sh install

# Create secret reference
bash connect-operator.sh create

# Monitor
bash connect-operator.sh logs
```

## Security Notes

### Never Commit
- `.env.local`
- `credentials.json`
- `secrets.json`
- Private keys
- API tokens

### Always Use
- 1Password secret references: `op://vault/item/field`
- Service accounts for CI/CD
- Passkeys instead of passwords
- Pre-commit hooks for validation

### Regular Maintenance
- Rotate credentials quarterly
- Review vault access monthly
- Update scripts to latest versions
- Monitor logs for suspicious activity

## Troubleshooting

### "op: command not found"
Install 1Password CLI:
```bash
brew install 1password-cli
```

### "not signed in"
Sign in to 1Password:
```bash
op signin --account lucidigital
```

### "Permission denied"
Make scripts executable:
```bash
chmod +x *.sh
```

### "Repository not found"
Check network connection and GitHub access:
```bash
ssh -T git@github.com
```

### "fswatch not found"
Install fswatch or script will fall back to periodic updates:
```bash
brew install fswatch  # macOS
sudo apt install fswatch  # Linux
```

## Support

For issues or questions:
1. Check [ONEPASSWORD-INTEGRATION.md](../../ONEPASSWORD-INTEGRATION.md)
2. Review script output and logs
3. Open GitHub issue with details

## License

MIT License - See parent project LICENSE file
