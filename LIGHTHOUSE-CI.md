# Lighthouse CI Integration

Comprehensive quality gates and security scanning using Google Chrome's Lighthouse CI integrated with the two-way sync system.

## Overview

This integration adds **automated quality gates** to your CI/CD pipeline:

- **🔐 Secret Exposure Detection** - Scans for exposed API keys, tokens, and credentials
- **⚡ Performance Monitoring** - Tracks build times and sync operation performance
- **🛡️ Security Audits** - Detects vulnerabilities and best practice violations
- **📊 Quality Gates** - Prevents deployments that fail quality standards
- **🔗 Sync Integration** - Notifies on-prem devices after successful audits

## Architecture

```
GitHub Push/PR
      │
      ▼
┌─────────────────────────────────────────┐
│      Load Secrets from 1Password        │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│         Build Project                    │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│   Pre-Audit Secret Detection            │
│   - Scan build artifacts                │
│   - Check for exposed secrets           │
│   - Fail if critical found              │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│      Run Lighthouse CI Audits           │
│   - Performance                          │
│   - Accessibility                        │
│   - Best Practices                       │
│   - SEO                                  │
│   - Security                             │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│   Post-Audit Secret Detection            │
│   - Scan HTTP responses                 │
│   - Check console errors                │
│   - Verify no leaks in network          │
└─────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│    Notify On-Prem Devices                │
│    (Only if audit passes)                │
└─────────────────────────────────────────┘
      │
      ▼
   ✅ Deploy
```

## Features

### 1. Secret Exposure Detection

**Custom Node.js scanner** (`scripts/lighthouse/secret-detector.js`) that detects:

#### 1Password Secrets
- 1Password secret references (`op://...`)
- 1Password Connect tokens
- Service account tokens

#### API Keys & Tokens
- Generic API keys (32+ chars)
- Metabase API keys
- Bearer tokens
- GitHub personal access tokens (ghp_, gho_, etc.)

#### Cloud Provider Credentials
- AWS Access Keys (AKIA...)
- AWS Secret Keys
- Azure credentials
- GCP service account keys

#### Private Keys
- RSA/DSA/ECDSA private keys
- SSH private keys
- PGP private keys

#### Other Sensitive Data
- Hardcoded passwords
- Database connection strings
- JWT tokens
- Slack tokens

**Severity Levels**:
- 🔴 **Critical** - Immediate action required (fails build)
- 🟠 **High** - Should be fixed soon (fails build)
- 🟡 **Medium** - Should be reviewed (warning only)
- 🟢 **Low** - Informational (warning only)

### 2. Performance Monitoring

**Performance Budgets** configured in `lighthouserc.js`:

```javascript
{
  'categories:performance': ['error', { minScore: 0.9 }],
  'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
  'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
  'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
  'total-blocking-time': ['warn', { maxNumericValue: 300 }],
}
```

**Resource Budgets**:
- JavaScript: 200KB max
- CSS: 50KB max
- Images: 500KB max
- Total page weight: 1MB max

### 3. Security Audits

**Automated security checks**:
- ✅ HTTPS enforcement
- ✅ Vulnerable library detection
- ✅ CSP (Content Security Policy) validation
- ✅ Console error analysis for exposed secrets
- ✅ Network request inspection

### 4. Quality Gates

**Build-blocking checks**:
- Performance score < 90% → ❌ Fail
- Accessibility score < 90% → ❌ Fail
- Best practices score < 90% → ❌ Fail
- Vulnerabilities detected → ❌ Fail
- Critical/High secrets found → ❌ Fail

**Warnings** (doesn't block):
- SEO score < 80%
- Performance metrics exceed budget
- Resource sizes exceed budget

### 5. Sync Integration

After **successful audits**, on-prem devices are notified:
- Audit results sent via webhook
- Devices can trigger deployment
- Full audit traceability

## Setup

### Prerequisites

```bash
# Install Node.js and npm
brew install node

# Install Lighthouse CI globally
npm install -g @lhci/cli@0.13.x

# Or use setup script
bash scripts/lighthouse/setup.sh
```

### GitHub Configuration

Add these secrets to your GitHub repository:

#### 1. LHCI_GITHUB_APP_TOKEN (Optional)

Create a GitHub token for Lighthouse CI:
1. Go to: https://github.com/settings/tokens/new
2. Select scope: `repo`
3. Description: `Lighthouse CI`
4. Generate and copy token

```bash
# Add to GitHub
gh secret set LHCI_GITHUB_APP_TOKEN
```

#### 2. OP_SERVICE_ACCOUNT_TOKEN

Already configured if using 1Password integration.

#### 3. ONPREM_WEBHOOK_URLS & WEBHOOK_SECRET

Already configured for two-way sync.

### Local Configuration

#### lighthouserc.js

Main configuration file for Lighthouse CI. Customize:

**URLs to audit**:
```javascript
url: [
  'http://localhost:3000/health',
  'http://localhost:3000/status',
  // Add your URLs here
],
```

**Performance budgets**:
```javascript
'categories:performance': ['error', { minScore: 0.9 }],
// Adjust minScore as needed
```

**Resource budgets**:
```javascript
'resource-summary:script:size': ['warn', { maxNumericValue: 200000 }],
// Adjust maxNumericValue (in bytes)
```

## Usage

### Running Locally

```bash
# 1. Build project
npm run build

# 2. Start webhook receiver (if testing sync endpoints)
bash scripts/sync-service/start-webhook-receiver.sh

# 3. Run Lighthouse CI
lhci autorun

# 4. View reports
open .lighthouseci/*/report.html
```

### Running Secret Detection Only

```bash
# Scan build artifacts
node scripts/lighthouse/secret-detector.js

# Scan specific Lighthouse results
node scripts/lighthouse/secret-detector.js .lighthouseci/lhr-*.json
```

### Testing Configuration

```bash
# Test all components
bash scripts/lighthouse/test.sh
```

### GitHub Actions

**Automatic triggers**:
- Push to `main`, `master`, `develop`, or `claude/*` branches
- Pull requests to `main` or `master`
- Manual workflow dispatch

**Manual trigger**:
```bash
gh workflow run "Lighthouse CI"
```

## Workflow Integration

### With Two-Way Sync

```yaml
# .github/workflows/sync-secrets-on-build.yml
on:
  workflow_run:
    workflows: ["Lighthouse CI"]
    types: [completed]
```

Secrets only sync to on-prem **after Lighthouse CI passes**.

### With Deployments

```yaml
# Deploy only after quality gate
jobs:
  deploy:
    needs: [lighthouse-ci]
    if: success()
    steps:
      - name: Deploy
        run: |
          # Deployment logic
```

## Interpreting Results

### Secret Detection Report

**Output location**: `.lighthouse/secret-detection-report.json`

```json
[
  {
    "file": "src/config.ts",
    "line": 42,
    "pattern": "Generic API Key",
    "severity": "high",
    "match": "api_key=abcd1234...",
    "context": "const API_KEY = 'abcd1234...'"
  }
]
```

**Exit codes**:
- `0` - No secrets or only low/medium severity
- `1` - Critical or high severity secrets found

### Lighthouse Reports

**Output location**: `.lighthouseci/*/report.html`

Open in browser to see:
- Performance metrics
- Accessibility issues
- Best practice violations
- SEO recommendations
- Security findings

### PR Comments

Lighthouse CI automatically comments on PRs with:
- Secret detection summary
- Performance metrics
- Link to full reports

Example:
```markdown
## 🔦 Lighthouse CI Results

### 🔐 Secret Exposure Detection

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 1 |
| 🟢 Low | 0 |

✅ No critical secrets found!

### 📊 Performance Metrics

- Performance: 95/100
- Accessibility: 98/100
- Best Practices: 92/100
- SEO: 85/100
```

## Customization

### Adding Custom Secret Patterns

Edit `scripts/lighthouse/secret-detector.js`:

```javascript
const SECRET_PATTERNS = [
  // Your custom pattern
  {
    name: 'My Custom Secret',
    pattern: /custom-pattern-here/g,
    severity: 'high',
  },
  // ... existing patterns
];
```

### Adjusting Performance Budgets

Edit `lighthouserc.js`:

```javascript
assertions: {
  // Stricter performance requirements
  'categories:performance': ['error', { minScore: 0.95 }],

  // More lenient requirements
  'categories:seo': ['warn', { minScore: 0.7 }],

  // Custom metric budgets
  'first-contentful-paint': ['error', { maxNumericValue: 1500 }],
}
```

### Excluding Files from Secret Scanning

Edit `scripts/lighthouse/secret-detector.js`:

```javascript
const findings = await scanDirectory('.', [
  'node_modules',
  '.git',
  // Add your exclusions
  'test-fixtures',
  'documentation',
]);
```

### Custom Assertions

Add custom Lighthouse assertions in `lighthouserc.js`:

```javascript
assertions: {
  // Custom security header check
  'content-security-policy': ['error', { minScore: 1 }],

  // Custom performance metric
  'interactive': ['warn', { maxNumericValue: 3000 }],
}
```

## Troubleshooting

### "Lighthouse CI not found"

```bash
# Install globally
npm install -g @lhci/cli@0.13.x

# Or use npx
npx @lhci/cli autorun
```

### "No URLs to audit"

Check your `lighthouserc.js` URLs. If testing local server:

```bash
# Start server first
bash scripts/sync-service/start-webhook-receiver.sh

# Then run audit
lhci autorun
```

### "Secret detector false positives"

Adjust patterns in `scripts/lighthouse/secret-detector.js`:

```javascript
// Make pattern more specific
pattern: /api[_-]?key\s*[:=]\s*['\"]?[A-Za-z0-9_-]{32,}['\"]?/gi,
// Change to
pattern: /api[_-]?key\s*[:=]\s*['\"]([A-Za-z0-9_-]{32,})['\"]$/gi,
```

Or exclude specific files (see Customization section).

### "Performance score too low"

Common issues:
- **Large JavaScript bundles** - Code split or tree shake
- **Unoptimized images** - Compress and use modern formats
- **Render-blocking resources** - Defer non-critical CSS/JS
- **Slow server response** - Optimize backend or add caching

Check `.lighthouseci/*/report.html` for specific recommendations.

### "GitHub Actions failing"

Check these:
1. **OP_SERVICE_ACCOUNT_TOKEN** is set
2. **LHCI_GITHUB_APP_TOKEN** is set (if using)
3. Build succeeds locally
4. All dependencies installed
5. Check Actions logs for specific errors

## Advanced Usage

### Lighthouse CI Server

For persistent storage and historical tracking:

```bash
# Install Lighthouse CI server
npm install -g @lhci/server

# Start server
lhci server --port=9001

# Configure lighthouserc.js
module.exports = {
  ci: {
    upload: {
      target: 'lhci',
      serverBaseUrl: 'http://localhost:9001',
      token: 'YOUR_TOKEN',
    },
  },
};
```

### Custom Lighthouse Config

Create `lighthouse-config.js`:

```javascript
module.exports = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['performance', 'accessibility'],
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
    },
  },
};
```

Reference in `lighthouserc.js`:

```javascript
settings: {
  configPath: './lighthouse-config.js',
}
```

### Multi-URL Audits

Audit multiple environments:

```javascript
url: [
  // Development
  'http://localhost:3000',

  // Staging
  'https://staging.example.com',

  // Production (read-only checks)
  'https://example.com',
],
```

### Conditional Secret Scanning

Scan only specific branches:

```yaml
# .github/workflows/lighthouse-ci.yml
- name: Run secret detection
  if: github.ref == 'refs/heads/main' || github.event_name == 'pull_request'
  run: node scripts/lighthouse/secret-detector.js
```

## Integration with Other Tools

### With Jest/Testing

```json
{
  "scripts": {
    "test": "jest && node scripts/lighthouse/secret-detector.js"
  }
}
```

### With Pre-commit Hooks

```bash
# .husky/pre-commit
node scripts/lighthouse/secret-detector.js
```

### With Docker

```dockerfile
FROM node:20

RUN npm install -g @lhci/cli@0.13.x

COPY . /app
WORKDIR /app

RUN npm ci
RUN npm run build

CMD ["lhci", "autorun"]
```

### With Other CI Systems

**GitLab CI**:
```yaml
lighthouse:
  stage: test
  script:
    - npm install -g @lhci/cli@0.13.x
    - npm run build
    - lhci autorun
```

**CircleCI**:
```yaml
jobs:
  lighthouse:
    steps:
      - run: npm install -g @lhci/cli@0.13.x
      - run: npm run build
      - run: lhci autorun
```

## Performance Tips

### Reduce Audit Time

```javascript
// lighthouserc.js
collect: {
  numberOfRuns: 1, // Reduce from 3 to 1 for faster feedback
  settings: {
    onlyCategories: ['performance'], // Audit only what matters
  },
}
```

### Parallel Audits

```javascript
// Audit multiple URLs concurrently
url: [
  'http://localhost:3000/health',
  'http://localhost:3000/status',
],
numberOfRuns: 1,
// Lighthouse will audit these in parallel
```

### Cache Dependencies

```yaml
# .github/workflows/lighthouse-ci.yml
- uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
```

## Security Best Practices

### Secret Management
- ✅ **Never hardcode secrets** - Use 1Password or environment variables
- ✅ **Scan before commit** - Pre-commit hooks
- ✅ **Scan before deploy** - CI/CD integration
- ✅ **Regular audits** - Scheduled secret scans

### Token Security
- ✅ **Rotate tokens** regularly
- ✅ **Minimum permissions** - Give tokens only required scopes
- ✅ **Monitor usage** - Check GitHub token usage
- ✅ **Revoke unused** - Clean up old tokens

### Audit Results
- ✅ **Private artifacts** - Don't expose audit results publicly
- ✅ **Sensitive data** - Redact from reports if needed
- ✅ **Access control** - Limit who can view results

## Resources

### Documentation
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Lighthouse Docs](https://developers.google.com/web/tools/lighthouse)
- [Getting Started](https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/getting-started.md)

### Related Guides
- [TWO-WAY-SYNC.md](TWO-WAY-SYNC.md) - Two-way sync system
- [ONEPASSWORD-INTEGRATION.md](ONEPASSWORD-INTEGRATION.md) - 1Password integration
- [HOOKS-SUMMARY.md](HOOKS-SUMMARY.md) - Automatic hooks

### Support
- [Lighthouse CI Issues](https://github.com/GoogleChrome/lighthouse-ci/issues)
- [Project Issues](https://github.com/luci-digital/luci-metabase-mcp/issues)

---

**Last Updated**: 2025-11-12
**Version**: 1.0.0
**Maintainer**: luci-digital
