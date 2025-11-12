#!/usr/bin/env node
/**
 * Secret Exposure Detector for Lighthouse CI
 * Scans build artifacts and responses for exposed secrets
 */

const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const { exec } = require('child_process');

const execAsync = promisify(exec);

// Secret patterns to detect
const SECRET_PATTERNS = [
  // 1Password
  {
    name: '1Password Secret Reference',
    pattern: /op:\/\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/g,
    severity: 'low', // References are OK, but should be reviewed
  },
  {
    name: '1Password Connect Token',
    pattern: /OP_CONNECT_TOKEN\s*[:=]\s*['\"]?[A-Za-z0-9_-]{40,}['\"]?/g,
    severity: 'critical',
  },
  {
    name: '1Password Service Account Token',
    pattern: /OP_SERVICE_ACCOUNT_TOKEN\s*[:=]\s*['\"]?[A-Za-z0-9_-]{40,}['\"]?/g,
    severity: 'critical',
  },

  // API Keys and Tokens
  {
    name: 'Generic API Key',
    pattern: /api[_-]?key\s*[:=]\s*['\"]?[A-Za-z0-9_-]{32,}['\"]?/gi,
    severity: 'high',
  },
  {
    name: 'Metabase API Key',
    pattern: /METABASE_API_KEY\s*[:=]\s*['\"]?[A-Za-z0-9_-]{32,}['\"]?/g,
    severity: 'critical',
  },
  {
    name: 'Bearer Token',
    pattern: /Bearer\s+[A-Za-z0-9_-]{32,}/g,
    severity: 'high',
  },
  {
    name: 'GitHub Token',
    pattern: /(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36,}/g,
    severity: 'critical',
  },

  // AWS
  {
    name: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: 'critical',
  },
  {
    name: 'AWS Secret Key',
    pattern: /aws_secret_access_key\s*[:=]\s*['\"]?[A-Za-z0-9/+=]{40}['\"]?/gi,
    severity: 'critical',
  },

  // Private Keys
  {
    name: 'Private Key',
    pattern: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/g,
    severity: 'critical',
  },
  {
    name: 'SSH Private Key',
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/g,
    severity: 'critical',
  },

  // Passwords
  {
    name: 'Hardcoded Password',
    pattern: /password\s*[:=]\s*['\"][^'\"]{8,}['\"](?!.*\$\{)/gi,
    severity: 'high',
  },

  // Database Connection Strings
  {
    name: 'Database Connection String',
    pattern: /(mongodb|mysql|postgresql|postgres):\/\/[^\s]+:[^\s]+@[^\s]+/gi,
    severity: 'critical',
  },

  // Slack Tokens
  {
    name: 'Slack Token',
    pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[A-Za-z0-9]{24,32}/g,
    severity: 'high',
  },

  // JWT Tokens
  {
    name: 'JWT Token',
    pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
    severity: 'medium',
  },
];

// Severity levels
const SEVERITY = {
  critical: { level: 4, emoji: '🔴', label: 'CRITICAL' },
  high: { level: 3, emoji: '🟠', label: 'HIGH' },
  medium: { level: 2, emoji: '🟡', label: 'MEDIUM' },
  low: { level: 1, emoji: '🟢', label: 'LOW' },
};

// Logging
const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  warn: (msg) => console.warn(`⚠️  ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
};

/**
 * Scan file for secret patterns
 */
async function scanFile(filePath) {
  const findings = [];

  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');

    for (const patternDef of SECRET_PATTERNS) {
      const matches = content.matchAll(patternDef.pattern);

      for (const match of matches) {
        const lineNumber = content.substring(0, match.index).split('\n').length;
        const lineContent = lines[lineNumber - 1].trim();

        findings.push({
          file: filePath,
          line: lineNumber,
          column: match.index - content.lastIndexOf('\n', match.index),
          pattern: patternDef.name,
          severity: patternDef.severity,
          match: match[0].substring(0, 50) + (match[0].length > 50 ? '...' : ''),
          context: lineContent.substring(0, 100),
        });
      }
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      log.warn(`Failed to scan ${filePath}: ${error.message}`);
    }
  }

  return findings;
}

/**
 * Scan directory recursively
 */
async function scanDirectory(dirPath, exclude = []) {
  const findings = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(process.cwd(), fullPath);

      // Check if should exclude
      if (exclude.some(pattern => relativePath.includes(pattern))) {
        continue;
      }

      if (entry.isDirectory()) {
        const subFindings = await scanDirectory(fullPath, exclude);
        findings.push(...subFindings);
      } else if (entry.isFile()) {
        // Only scan text files
        const ext = path.extname(entry.name);
        const textExtensions = ['.js', '.ts', '.json', '.yml', '.yaml', '.env', '.sh', '.md', '.html', '.css'];

        if (textExtensions.includes(ext) || entry.name.startsWith('.env')) {
          const fileFindings = await scanFile(fullPath);
          findings.push(...fileFindings);
        }
      }
    }
  } catch (error) {
    log.warn(`Failed to scan directory ${dirPath}: ${error.message}`);
  }

  return findings;
}

/**
 * Scan build artifacts
 */
async function scanBuildArtifacts() {
  log.info('Scanning build artifacts for exposed secrets...');

  const findings = await scanDirectory('.', [
    'node_modules',
    '.git',
    '.sync-service/logs',
    'luci_onepass_repos',
    'coverage',
    '.lighthouse',
  ]);

  return findings;
}

/**
 * Scan HTTP responses (from Lighthouse trace)
 */
async function scanLighthouseResults(resultsPath) {
  log.info('Scanning Lighthouse results for exposed secrets in responses...');

  const findings = [];

  try {
    const results = JSON.parse(await fs.readFile(resultsPath, 'utf8'));

    // Check network requests
    if (results.audits && results.audits['network-requests']) {
      const requests = results.audits['network-requests'].details?.items || [];

      for (const request of requests) {
        if (request.url && (request.url.includes('api') || request.url.includes('auth'))) {
          // Check URL for exposed secrets
          for (const patternDef of SECRET_PATTERNS) {
            const matches = request.url.matchAll(patternDef.pattern);

            for (const match of matches) {
              findings.push({
                type: 'network-request',
                url: request.url,
                pattern: patternDef.name,
                severity: patternDef.severity,
                match: match[0],
              });
            }
          }
        }
      }
    }

    // Check console errors for exposed secrets
    if (results.audits && results.audits['errors-in-console']) {
      const errors = results.audits['errors-in-console'].details?.items || [];

      for (const error of errors) {
        const message = error.description || '';

        for (const patternDef of SECRET_PATTERNS) {
          const matches = message.matchAll(patternDef.pattern);

          for (const match of matches) {
            findings.push({
              type: 'console-error',
              message: message.substring(0, 200),
              pattern: patternDef.name,
              severity: patternDef.severity,
              match: match[0],
            });
          }
        }
      }
    }
  } catch (error) {
    log.warn(`Failed to scan Lighthouse results: ${error.message}`);
  }

  return findings;
}

/**
 * Generate report
 */
function generateReport(findings) {
  if (findings.length === 0) {
    log.success('No secrets found! 🎉');
    return 0;
  }

  // Group by severity
  const bySeverity = {
    critical: findings.filter(f => f.severity === 'critical'),
    high: findings.filter(f => f.severity === 'high'),
    medium: findings.filter(f => f.severity === 'medium'),
    low: findings.filter(f => f.severity === 'low'),
  };

  console.log('\n' + '='.repeat(80));
  console.log('SECRET EXPOSURE DETECTION REPORT');
  console.log('='.repeat(80) + '\n');

  let exitCode = 0;

  for (const [severity, items] of Object.entries(bySeverity)) {
    if (items.length === 0) continue;

    const severityInfo = SEVERITY[severity];
    console.log(`${severityInfo.emoji} ${severityInfo.label}: ${items.length} finding(s)\n`);

    for (const finding of items.slice(0, 10)) { // Show first 10
      if (finding.file) {
        console.log(`  File: ${finding.file}:${finding.line}`);
        console.log(`  Pattern: ${finding.pattern}`);
        console.log(`  Match: ${finding.match}`);
        console.log(`  Context: ${finding.context}`);
      } else if (finding.url) {
        console.log(`  URL: ${finding.url}`);
        console.log(`  Pattern: ${finding.pattern}`);
        console.log(`  Match: ${finding.match}`);
      } else {
        console.log(`  Type: ${finding.type}`);
        console.log(`  Pattern: ${finding.pattern}`);
        console.log(`  Match: ${finding.match}`);
      }
      console.log('');
    }

    if (items.length > 10) {
      console.log(`  ... and ${items.length - 10} more\n`);
    }

    // Set exit code based on severity
    if (severity === 'critical' || severity === 'high') {
      exitCode = 1;
    }
  }

  console.log('='.repeat(80));
  console.log(`Total findings: ${findings.length}`);
  console.log('='.repeat(80) + '\n');

  if (exitCode !== 0) {
    log.error('Critical or high severity secrets found! Build should fail.');
  }

  return exitCode;
}

/**
 * Main
 */
async function main() {
  const args = process.argv.slice(2);
  const lighthouseResults = args[0];

  console.log('\n🔍 Secret Exposure Detection\n');

  let findings = [];

  // Scan build artifacts
  const artifactFindings = await scanBuildArtifacts();
  findings.push(...artifactFindings);

  // Scan Lighthouse results if provided
  if (lighthouseResults) {
    const lighthouseFindings = await scanLighthouseResults(lighthouseResults);
    findings.push(...lighthouseFindings);
  }

  // Generate report
  const exitCode = generateReport(findings);

  // Save report
  const reportPath = path.join(process.cwd(), '.lighthouse', 'secret-detection-report.json');
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(findings, null, 2));
  log.info(`Report saved to: ${reportPath}`);

  process.exit(exitCode);
}

main().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
