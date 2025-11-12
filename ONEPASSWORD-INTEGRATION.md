# 1Password Integration Guide

Complete integration of 1Password with GitHub Enterprise, passkey authentication, and credential federation for the luci-metabase-mcp project.

## Overview

This integration provides:

- **Automatic Credential Management**: All credentials stored and managed through 1Password
- **Passkey Authentication**: Single biometric authentication for all services
- **GitHub Enterprise Integration**: Automatic credential injection into all builds
- **Web2/Web3 Federation**: Unified authentication across traditional and blockchain services
- **Zero Phishable Credentials**: No passwords, only passkeys and biometric authentication
- **Automated Secret Scanning**: Pre-commit hooks prevent accidental secret exposure

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    1Password (lucidigital)                   │
│  ┌──────────┬──────────────┬─────────────┬────────────────┐│
│  │Development│ Production  │     Web3     │ Authentication ││
│  │   Vault   │    Vault    │    Vault     │     Vault      ││
│  └──────────┴──────────────┴─────────────┴────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Single Passkey + Biometric Auth                 │
│    (Face ID / Touch ID / Fingerprint / 1Password)            │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                     ▼                      ▼
┌──────────────┐    ┌──────────────────┐   ┌──────────────┐
│   GitHub     │    │   Web2 Services  │   │  Web3 Wallets│
│  Enterprise  │    │  (OAuth, SAML)   │   │ (ETH, SOL)   │
│              │    │                  │   │              │
│ - Auto Inject│    │ - GitHub         │   │ - Ethereum   │
│ - Build Hooks│    │ - Google         │   │ - Solana     │
│ - CI/CD      │    │ - Others         │   │ - Polygon    │
└──────────────┘    └──────────────────┘   └──────────────┘
```

## Quick Start

### 1. Install Prerequisites

```bash
# 1Password CLI
brew install 1password-cli

# Optional tools
brew install jq fswatch
```

### 2. Sign in to 1Password

```bash
op signin --account lucidigital
```

### 3. Run Session Start Hook

```bash
bash .claude/hooks/session-start.sh
```

This will:
- Check all dependencies
- Verify 1Password authentication
- Setup repository directories
- Display available commands

## Core Components

### Session Start Hook

**Location**: `.claude/hooks/session-start.sh`

Automatically runs when starting a Claude Code session. It:
- Validates environment and dependencies
- Checks 1Password authentication status
- Verifies repository status
- Provides quick access to all commands

### Repository Management

#### Clone Repositories

```bash
bash scripts/onepass/clone-repos.sh
```

Clones all 1Password-related repositories:
- `luci-onepass-os` - 1Password for Open Source management
- `luci-onepassword-operator` - Kubernetes operator for 1Password
- `luci-passage-swift` - Swift SDK for passwordless authentication

#### Update Repositories

```bash
# One-time update
bash scripts/onepass/update-repos.sh

# Watch mode (continuous updates)
bash scripts/onepass/watch-repos.sh

# Setup automatic updates (launchd/systemd)
bash scripts/onepass/setup-auto-update.sh
```

### Secret Management

#### Sync Secrets from 1Password

```bash
bash scripts/onepass/sync-secrets.sh
```

Creates `.env.local` with secrets fetched from 1Password vaults. Never commits this file.

#### Validate Secrets

```bash
bash scripts/onepass/validate-secrets.sh
```

Scans staged files for potential secret exposure. Automatically runs in pre-commit hook.

**Detected patterns**:
- 1Password secret references
- API keys and tokens
- Passwords and credentials
- Private keys
- AWS credentials
- GitHub tokens

### GitHub Enterprise Integration

#### Setup GitHub Enterprise

```bash
# Set custom path (default: /Users/daryl/Desktop/luci_github_enterprize)
export GHE_PATH=/path/to/your/github-enterprise

bash scripts/onepass/setup-github-enterprise.sh
```

This creates:
- **GitHub Actions workflows** for automatic credential injection
- **Git hooks** for pre-push validation
- **Credential injection script** for local builds
- **1Password configuration** for the GHE instance

#### Features

**Automatic Credential Injection**:
- All GitHub Actions workflows automatically load secrets from 1Password
- No manual secret management in GitHub
- Credentials never stored in repository

**Pre-Push Validation**:
- Validates 1Password authentication before push
- Scans for exposed secrets
- Prevents accidental credential leaks

**Local Build Integration**:
```bash
cd /Users/daryl/Desktop/luci_github_enterprize
./inject-credentials.sh
npm run build  # Credentials automatically available
```

### Passkey Authentication

#### Setup Passkey System

```bash
bash scripts/onepass/setup-passkey-auth.sh
```

Creates a complete passkey authentication system with:
- Single passkey for all authentication
- Biometric authentication (Face ID, Touch ID, Fingerprint)
- 1Password backup and sync
- Web2 and Web3 federation

#### Usage

**Register Passkey**:
```bash
bash .passkey/auth-helper.sh register
```

**Authenticate**:
```bash
bash .passkey/auth-helper.sh authenticate
```

**Federate Accounts**:
```bash
# Web2
bash .passkey/auth-helper.sh federate github
bash .passkey/auth-helper.sh federate google

# Web3
bash .passkey/auth-helper.sh federate ethereum
bash .passkey/auth-helper.sh federate solana
```

**List Federated Accounts**:
```bash
bash .passkey/auth-helper.sh list
```

### Web3 Integration

#### Enable Passkey Signing

```bash
bash .passkey/web3-integration.sh
```

Features:
- Sign blockchain transactions with biometric authentication
- No private keys stored locally
- Automatic backup to 1Password
- Multi-chain support (Ethereum, Polygon, Arbitrum, Solana)
- Built-in phishing protection

#### Complete Federation

```bash
bash .passkey/federate-credentials.sh
```

Federates all credentials (Web2 + Web3) under a single passkey.

### Kubernetes Operator Integration

#### Manage 1Password Operator

```bash
# Check status
bash scripts/onepass/connect-operator.sh status

# Install operator
bash scripts/onepass/connect-operator.sh install

# Create OnePasswordItem
bash scripts/onepass/connect-operator.sh create

# List items
bash scripts/onepass/connect-operator.sh list

# View logs
bash scripts/onepass/connect-operator.sh logs
```

## Git Hooks

### Pre-Commit Hook

**Location**: `.husky/pre-commit`

Automatically runs on every commit:
1. **Secret Validation** - Scans for exposed secrets
2. **Type Checking** - Validates TypeScript types
3. **Linting** - Checks code quality
4. **Formatting** - Validates code formatting
5. **Tests** - Runs test suite

To bypass (use with caution):
```bash
git commit --no-verify
```

### Pre-Push Hook (GitHub Enterprise)

**Location**: `/Users/daryl/Desktop/luci_github_enterprize/.git/hooks/pre-push`

Runs before pushing to remote:
1. Verifies 1Password authentication
2. Validates no secrets in code
3. Ensures credentials are available

## Configuration Files

### `.claude/onepass-config.json`

Main configuration for repository management and 1Password integration.

```json
{
  "repos": [
    {
      "name": "luci-onepass-os",
      "url": "https://github.com/luci-digital/luci-onepass-os.git",
      "description": "1Password for Open Source management"
    },
    {
      "name": "luci-onepassword-operator",
      "url": "https://github.com/luci-digital/luci-onepassword-operator.git",
      "description": "Kubernetes operator for 1Password"
    },
    {
      "name": "luci-passage-swift",
      "url": "https://github.com/luci-digital/luci-passage-swift.git",
      "description": "Swift SDK for passwordless auth"
    }
  ],
  "onepassword": {
    "connect_host": "${OP_CONNECT_HOST}",
    "connect_token": "${OP_CONNECT_TOKEN}",
    "vault": "${OP_VAULT}"
  },
  "paths": {
    "repos_dir": "luci_onepass_repos/repos",
    "logs_dir": "luci_onepass_repos/logs"
  },
  "auto_update": {
    "enabled": true,
    "interval_minutes": 60
  }
}
```

### `.passkey/config.json`

Passkey authentication configuration with Web2/Web3 federation.

### `.op-config.json` (GitHub Enterprise)

1Password configuration for GitHub Enterprise instance.

## Environment Variables

### Required for Full Functionality

```bash
# 1Password Connect (for programmatic access)
export OP_CONNECT_HOST="https://your-connect-instance.com"
export OP_CONNECT_TOKEN="your-connect-token"
export OP_VAULT="Development"

# GitHub Enterprise (optional, has defaults)
export GHE_PATH="/Users/daryl/Desktop/luci_github_enterprize"

# Passage (for passkey auth)
export PASSAGE_APP_ID="your-app-id"
export PASSAGE_API_KEY="your-api-key"
```

### Setting Up Environment

Create `.env.local` (gitignored):
```bash
bash scripts/onepass/sync-secrets.sh
```

Or manually:
```bash
cat > .env.local << 'EOF'
OP_CONNECT_HOST=https://your-connect-instance.com
OP_CONNECT_TOKEN=your-token
PASSAGE_APP_ID=your-app-id
PASSAGE_API_KEY=your-key
EOF
```

## GitHub Actions Integration

### Workflow: 1Password Secrets

**File**: `.github/workflows/onepassword-secrets.yml`

Reusable workflow for loading secrets from 1Password.

Usage in other workflows:
```yaml
jobs:
  my-job:
    uses: ./.github/workflows/onepassword-secrets.yml
    secrets:
      OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
```

### Workflow: Auto Credentials

**File**: `.github/workflows/auto-credentials.yml`

Automatically runs on push/PR:
- Loads secrets from 1Password
- Builds project with injected credentials
- Runs tests with credentials
- Performs security scan

## Security Features

### Automatic Secret Scanning

Pre-commit hook scans for:
- 1Password secret references
- API keys and tokens
- Passwords
- Private keys
- AWS credentials
- GitHub tokens
- Bearer tokens

### Protected Files

These files always trigger warnings:
- `.env`
- `.env.local`
- `.env.production`
- `credentials.json`
- `secrets.json`

### Domain Binding

Passkeys are bound to specific domains, preventing phishing attacks.

### Attestation

Direct attestation ensures passkeys are genuine and not tampered with.

### Biometric Fallback

If biometric authentication fails, falls back to:
1. Device PIN
2. 1Password master password

## Best Practices

### Never Commit Secrets

Always use 1Password secret references:
```bash
# ✗ Bad
METABASE_API_KEY="mb_1234567890abcdef"

# ✓ Good
METABASE_API_KEY="op://Development/Metabase/api_key"
```

### Use Service Accounts

For CI/CD, use 1Password Service Accounts instead of personal credentials.

### Rotate Credentials

Regularly rotate credentials in 1Password. All systems will automatically use new credentials.

### Review Access

Periodically review vault access and federated accounts.

### Backup Passkeys

Passkeys are automatically backed up to 1Password, but ensure:
- 1Password account is secure
- Emergency kit is stored safely
- Recovery contacts are configured

## Troubleshooting

### "1Password CLI not found"

Install 1Password CLI:
```bash
brew install 1password-cli
```

### "Not signed in to 1Password"

Sign in:
```bash
op signin --account lucidigital
```

### "Repository not found"

Clone repositories:
```bash
bash scripts/onepass/clone-repos.sh
```

### "Secret validation failed"

Review flagged files and remove secrets:
```bash
git diff --cached
# Remove secrets, then commit again
```

### "Passkey registration failed"

Ensure:
- Device supports biometric authentication
- 1Password CLI is signed in
- Passage credentials are configured

### "GitHub Actions secrets not loading"

1. Create 1Password Service Account
2. Add service account token to GitHub secrets:
   ```bash
   gh secret set OP_SERVICE_ACCOUNT_TOKEN
   ```

## Maintenance

### Update Repositories

```bash
# Manual update
bash scripts/onepass/update-repos.sh

# Setup automatic updates
bash scripts/onepass/setup-auto-update.sh
```

### View Logs

```bash
# Repository update logs
tail -f luci_onepass_repos/logs/auto-update.log

# GitHub Enterprise logs
tail -f /Users/daryl/Desktop/luci_github_enterprize/.github/logs/
```

### Sync Secrets

When secrets change in 1Password:
```bash
# Sync to local environment
bash scripts/onepass/sync-secrets.sh

# GitHub Actions will automatically use new secrets
```

## Advanced Usage

### Custom Secret References

Edit `scripts/onepass/sync-secrets.sh` to add custom secrets:
```bash
SECRETS=(
    "ENV_VAR_NAME|op://vault/item/field"
    "CUSTOM_API_KEY|op://Production/CustomService/api_key"
)
```

### Multi-Vault Support

Configure multiple vaults in `.claude/onepass-config.json`:
```json
"vaults": {
  "development": "Development",
  "production": "Production",
  "shared": "Shared"
}
```

### Custom Update Intervals

Change update frequency in setup scripts:
```bash
UPDATE_INTERVAL=1800  # 30 minutes instead of 1 hour
```

## Integration with Metabase MCP

This integration enhances the Metabase MCP server with:
- Automatic credential injection
- Secure secret storage
- Passwordless authentication
- CI/CD integration

Example usage:
```bash
# Sync Metabase credentials
bash scripts/onepass/sync-secrets.sh

# Start server with injected credentials
npm run dev
```

Credentials are automatically loaded from:
- `.env.local` (created by sync-secrets.sh)
- Environment variables (set by GitHub Actions)
- 1Password Connect API (direct integration)

## Resources

### Documentation
- [1Password CLI](https://developer.1password.com/docs/cli/)
- [1Password Connect](https://developer.1password.com/docs/connect/)
- [Passage Documentation](https://docs.passage.id/)
- [WebAuthn Guide](https://webauthn.guide/)

### Repositories
- [luci-onepass-os](https://github.com/luci-digital/luci-onepass-os)
- [luci-onepassword-operator](https://github.com/luci-digital/luci-onepassword-operator)
- [luci-passage-swift](https://github.com/luci-digital/luci-passage-swift)

### Support
- 1Password Support: support@1password.com
- GitHub Issues: Use repository issues for bugs/features

## License

This integration follows the same license as the parent project (MIT).

## Contributing

Contributions welcome! Please:
1. Test all changes locally
2. Update documentation
3. Follow existing patterns
4. Ensure security best practices

---

**Last Updated**: 2025-11-12
**Version**: 1.0.0
**Maintainer**: luci-digital
