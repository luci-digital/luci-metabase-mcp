#!/usr/bin/env node
/**
 * On-Premises Webhook Receiver
 * Receives sync requests from GitHub and updates local secrets
 */

const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

// Configuration
const PORT = process.env.SYNC_PORT || 3000;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const DEVICE_ID = process.env.DEVICE_ID || 'default';

// Logging
const log = {
  info: (msg, data = {}) => console.log(JSON.stringify({ level: 'info', timestamp: new Date().toISOString(), message: msg, ...data })),
  error: (msg, error = {}) => console.error(JSON.stringify({ level: 'error', timestamp: new Date().toISOString(), message: msg, error: error.message, stack: error.stack })),
  warn: (msg, data = {}) => console.warn(JSON.stringify({ level: 'warn', timestamp: new Date().toISOString(), message: msg, ...data }))
};

/**
 * Verify webhook signature
 */
function verifySignature(payload, signature) {
  if (!WEBHOOK_SECRET) {
    log.warn('No webhook secret configured - skipping verification');
    return true;
  }

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch (error) {
    return false;
  }
}

/**
 * Sync secrets from 1Password
 */
async function syncSecretsFromOnePassword() {
  log.info('Syncing secrets from 1Password');

  try {
    const syncScript = path.join(PROJECT_ROOT, 'scripts/onepass/sync-secrets.sh');
    const { stdout, stderr } = await execAsync(`bash ${syncScript}`);

    if (stderr) {
      log.warn('Sync script warnings', { stderr });
    }

    log.info('Secrets synced successfully', { output: stdout });
    return { success: true, output: stdout };
  } catch (error) {
    log.error('Failed to sync secrets', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update device sync status
 */
async function updateDeviceStatus(status) {
  const statusFile = path.join(PROJECT_ROOT, '.sync-service', 'device-status.json');

  try {
    await fs.mkdir(path.dirname(statusFile), { recursive: true });

    const deviceStatus = {
      deviceId: DEVICE_ID,
      lastSync: new Date().toISOString(),
      status,
      hostname: require('os').hostname(),
      platform: process.platform
    };

    await fs.writeFile(statusFile, JSON.stringify(deviceStatus, null, 2));
    log.info('Device status updated', deviceStatus);
  } catch (error) {
    log.error('Failed to update device status', error);
  }
}

/**
 * Handle GitHub build webhook
 */
async function handleBuildWebhook(payload) {
  log.info('Received build webhook', {
    action: payload.action,
    workflow: payload.workflow?.name,
    repository: payload.repository?.full_name,
    sender: payload.sender?.login
  });

  // Sync secrets when build is requested
  if (payload.action === 'requested' || payload.action === 'rerequested') {
    const result = await syncSecretsFromOnePassword();
    await updateDeviceStatus(result.success ? 'synced' : 'sync_failed');

    return {
      status: result.success ? 200 : 500,
      body: {
        message: result.success ? 'Secrets synced successfully' : 'Secret sync failed',
        deviceId: DEVICE_ID,
        timestamp: new Date().toISOString(),
        result
      }
    };
  }

  return {
    status: 200,
    body: { message: 'Webhook received but no action taken', deviceId: DEVICE_ID }
  };
}

/**
 * Handle push webhook (for secret updates)
 */
async function handlePushWebhook(payload) {
  log.info('Received push webhook', {
    ref: payload.ref,
    repository: payload.repository?.full_name,
    commits: payload.commits?.length
  });

  // Check if .env files or secret-related files were modified
  const secretFiles = ['.env.local', '.env', 'secrets.json', 'credentials.json'];
  const modifiedFiles = new Set();

  payload.commits?.forEach(commit => {
    commit.added?.forEach(file => modifiedFiles.add(file));
    commit.modified?.forEach(file => modifiedFiles.add(file));
  });

  const secretsModified = [...modifiedFiles].some(file =>
    secretFiles.some(secret => file.includes(secret))
  );

  if (secretsModified) {
    log.info('Secret files modified, syncing from 1Password');
    const result = await syncSecretsFromOnePassword();
    await updateDeviceStatus(result.success ? 'synced' : 'sync_failed');

    return {
      status: result.success ? 200 : 500,
      body: {
        message: 'Secrets updated from 1Password',
        deviceId: DEVICE_ID,
        modifiedFiles: [...modifiedFiles],
        result
      }
    };
  }

  return {
    status: 200,
    body: { message: 'Push received but no secrets modified', deviceId: DEVICE_ID }
  };
}

/**
 * Handle sync request
 */
async function handleSyncRequest(payload) {
  log.info('Received sync request', { source: payload.source, deviceId: payload.deviceId });

  const result = await syncSecretsFromOnePassword();
  await updateDeviceStatus(result.success ? 'synced' : 'sync_failed');

  return {
    status: result.success ? 200 : 500,
    body: {
      message: result.success ? 'Manual sync completed' : 'Manual sync failed',
      deviceId: DEVICE_ID,
      timestamp: new Date().toISOString(),
      result
    }
  };
}

/**
 * HTTP Server
 */
const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Hub-Signature-256');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      deviceId: DEVICE_ID,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Device status
  if (req.method === 'GET' && req.url === '/status') {
    try {
      const statusFile = path.join(PROJECT_ROOT, '.sync-service', 'device-status.json');
      const status = JSON.parse(await fs.readFile(statusFile, 'utf8'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(status));
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No status available' }));
    }
    return;
  }

  // Webhook endpoints
  if (req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        // Verify signature
        const signature = req.headers['x-hub-signature-256'];
        if (WEBHOOK_SECRET && signature && !verifySignature(body, signature)) {
          log.warn('Invalid webhook signature');
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid signature' }));
          return;
        }

        const payload = JSON.parse(body);
        let response;

        // Route based on event type
        const eventType = req.headers['x-github-event'];

        switch (eventType) {
          case 'workflow_run':
          case 'workflow_job':
            response = await handleBuildWebhook(payload);
            break;

          case 'push':
            response = await handlePushWebhook(payload);
            break;

          default:
            // Manual sync request
            if (req.url === '/sync') {
              response = await handleSyncRequest(payload);
            } else {
              response = {
                status: 200,
                body: { message: 'Event received but not handled', eventType, deviceId: DEVICE_ID }
              };
            }
        }

        res.writeHead(response.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response.body));

      } catch (error) {
        log.error('Request handling error', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message, deviceId: DEVICE_ID }));
      }
    });

    return;
  }

  // Not found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// Start server
server.listen(PORT, () => {
  log.info('Webhook receiver started', {
    port: PORT,
    deviceId: DEVICE_ID,
    platform: process.platform,
    hostname: require('os').hostname(),
    webhookSecretConfigured: !!WEBHOOK_SECRET
  });

  // Initial sync on startup
  syncSecretsFromOnePassword().then(result => {
    updateDeviceStatus(result.success ? 'initialized' : 'initialization_failed');
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    log.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    log.info('Server closed');
    process.exit(0);
  });
});
