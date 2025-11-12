#!/usr/bin/env node
/**
 * Device Sync Service
 * Monitors local secret changes and syncs across devices via 1Password
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const { watch } = require('fs');

const execAsync = promisify(exec);

// Configuration
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const DEVICE_ID = process.env.DEVICE_ID || require('os').hostname();
const SYNC_INTERVAL = parseInt(process.env.SYNC_INTERVAL || '300000'); // 5 minutes
const OP_ACCOUNT = process.env.OP_ACCOUNT || 'lucidigital';

// Files to watch
const WATCH_FILES = [
  '.env.local',
  'credentials.json',
  'secrets.json'
];

// Logging
const log = {
  info: (msg, data = {}) => console.log(JSON.stringify({ level: 'info', timestamp: new Date().toISOString(), deviceId: DEVICE_ID, message: msg, ...data })),
  error: (msg, error = {}) => console.error(JSON.stringify({ level: 'error', timestamp: new Date().toISOString(), deviceId: DEVICE_ID, message: msg, error: error.message, stack: error.stack })),
  warn: (msg, data = {}) => console.warn(JSON.stringify({ level: 'warn', timestamp: new Date().toISOString(), deviceId: DEVICE_ID, message: msg, ...data }))
};

/**
 * Get all registered devices
 */
async function getRegisteredDevices() {
  const devicesFile = path.join(PROJECT_ROOT, '.sync-service', 'devices.json');

  try {
    const content = await fs.readFile(devicesFile, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return { devices: [] };
  }
}

/**
 * Register this device
 */
async function registerDevice() {
  const devicesFile = path.join(PROJECT_ROOT, '.sync-service', 'devices.json');
  await fs.mkdir(path.dirname(devicesFile), { recursive: true });

  const devices = await getRegisteredDevices();

  const deviceInfo = {
    id: DEVICE_ID,
    hostname: require('os').hostname(),
    platform: process.platform,
    arch: process.arch,
    registeredAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    syncUrl: process.env.SYNC_URL || null
  };

  // Update or add device
  const existingIndex = devices.devices.findIndex(d => d.id === DEVICE_ID);
  if (existingIndex >= 0) {
    devices.devices[existingIndex] = { ...devices.devices[existingIndex], ...deviceInfo };
  } else {
    devices.devices.push(deviceInfo);
  }

  await fs.writeFile(devicesFile, JSON.stringify(devices, null, 2));
  log.info('Device registered', deviceInfo);

  return deviceInfo;
}

/**
 * Update device heartbeat
 */
async function updateHeartbeat() {
  const devices = await getRegisteredDevices();
  const device = devices.devices.find(d => d.id === DEVICE_ID);

  if (device) {
    device.lastSeen = new Date().toISOString();
    const devicesFile = path.join(PROJECT_ROOT, '.sync-service', 'devices.json');
    await fs.writeFile(devicesFile, JSON.stringify(devices, null, 2));
  }
}

/**
 * Check if 1Password CLI is available and authenticated
 */
async function check1PasswordAuth() {
  try {
    const { stdout } = await execAsync('op account list');
    return stdout.includes(OP_ACCOUNT);
  } catch (error) {
    return false;
  }
}

/**
 * Upload secret to 1Password
 */
async function uploadSecretToOnePassword(filePath, vaultName = 'Development') {
  const fileName = path.basename(filePath);
  const itemName = `${DEVICE_ID}-${fileName}`;

  log.info('Uploading secret to 1Password', { file: fileName, vault: vaultName });

  try {
    const content = await fs.readFile(filePath, 'utf8');

    // Create or update document in 1Password
    const command = `op document create --title "${itemName}" --vault "${vaultName}" --file-name "${fileName}" - <<< '${content.replace(/'/g, "'\\''")}' || op document edit "${itemName}" --file-name "${fileName}" - <<< '${content.replace(/'/g, "'\\''")}'`;

    await execAsync(command);
    log.info('Secret uploaded successfully', { item: itemName });

    return { success: true, item: itemName };
  } catch (error) {
    log.error('Failed to upload secret', error);
    return { success: false, error: error.message };
  }
}

/**
 * Notify other devices of change
 */
async function notifyDevices(changedFile) {
  const devices = await getRegisteredDevices();

  log.info('Notifying other devices', {
    totalDevices: devices.devices.length,
    changedFile
  });

  const notifications = devices.devices
    .filter(d => d.id !== DEVICE_ID && d.syncUrl)
    .map(async device => {
      try {
        const response = await fetch(device.syncUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: DEVICE_ID,
            deviceId: device.id,
            changedFile,
            timestamp: new Date().toISOString()
          })
        });

        if (response.ok) {
          log.info('Device notified', { deviceId: device.id });
          return { deviceId: device.id, success: true };
        } else {
          log.warn('Device notification failed', { deviceId: device.id, status: response.status });
          return { deviceId: device.id, success: false, status: response.status };
        }
      } catch (error) {
        log.error('Failed to notify device', { deviceId: device.id, error: error.message });
        return { deviceId: device.id, success: false, error: error.message };
      }
    });

  return Promise.all(notifications);
}

/**
 * Handle file change
 */
async function handleFileChange(filePath) {
  const fileName = path.basename(filePath);

  log.info('File change detected', { file: fileName });

  // Check if file exists and has content
  try {
    const stats = await fs.stat(filePath);
    if (stats.size === 0) {
      log.warn('File is empty, skipping sync', { file: fileName });
      return;
    }
  } catch (error) {
    log.warn('File no longer exists', { file: fileName });
    return;
  }

  // Check 1Password authentication
  const isAuthenticated = await check1PasswordAuth();
  if (!isAuthenticated) {
    log.error('Not authenticated with 1Password, cannot sync');
    return;
  }

  // Upload to 1Password
  const result = await uploadSecretToOnePassword(filePath);

  if (result.success) {
    // Notify other devices
    await notifyDevices(fileName);

    // Update sync status
    await updateSyncStatus({
      lastSync: new Date().toISOString(),
      lastFile: fileName,
      status: 'synced'
    });
  } else {
    await updateSyncStatus({
      lastSync: new Date().toISOString(),
      lastFile: fileName,
      status: 'failed',
      error: result.error
    });
  }
}

/**
 * Update sync status
 */
async function updateSyncStatus(status) {
  const statusFile = path.join(PROJECT_ROOT, '.sync-service', 'sync-status.json');

  try {
    await fs.mkdir(path.dirname(statusFile), { recursive: true });

    const syncStatus = {
      deviceId: DEVICE_ID,
      ...status
    };

    await fs.writeFile(statusFile, JSON.stringify(syncStatus, null, 2));
  } catch (error) {
    log.error('Failed to update sync status', error);
  }
}

/**
 * Setup file watchers
 */
function setupWatchers() {
  log.info('Setting up file watchers', { files: WATCH_FILES });

  const watchers = WATCH_FILES.map(file => {
    const filePath = path.join(PROJECT_ROOT, file);

    return watch(filePath, (eventType) => {
      if (eventType === 'change') {
        handleFileChange(filePath);
      }
    });
  });

  return watchers;
}

/**
 * Periodic sync
 */
async function periodicSync() {
  log.info('Running periodic sync');

  try {
    const syncScript = path.join(PROJECT_ROOT, 'scripts/onepass/sync-secrets.sh');
    const { stdout, stderr } = await execAsync(`bash ${syncScript}`);

    if (stderr) {
      log.warn('Periodic sync warnings', { stderr });
    }

    log.info('Periodic sync completed', { output: stdout });

    await updateSyncStatus({
      lastPeriodicSync: new Date().toISOString(),
      status: 'synced'
    });
  } catch (error) {
    log.error('Periodic sync failed', error);

    await updateSyncStatus({
      lastPeriodicSync: new Date().toISOString(),
      status: 'failed',
      error: error.message
    });
  }

  await updateHeartbeat();
}

/**
 * Main
 */
async function main() {
  log.info('Starting device sync service', {
    deviceId: DEVICE_ID,
    syncInterval: SYNC_INTERVAL,
    account: OP_ACCOUNT
  });

  // Register device
  await registerDevice();

  // Check 1Password authentication
  const isAuthenticated = await check1PasswordAuth();
  if (!isAuthenticated) {
    log.error('Not authenticated with 1Password', { account: OP_ACCOUNT });
    log.info('Please sign in: op signin --account ' + OP_ACCOUNT);
    process.exit(1);
  }

  log.info('1Password authentication verified');

  // Setup file watchers
  const watchers = setupWatchers();

  // Initial sync
  await periodicSync();

  // Setup periodic sync
  const syncTimer = setInterval(periodicSync, SYNC_INTERVAL);

  // Graceful shutdown
  const shutdown = () => {
    log.info('Shutting down device sync service');

    watchers.forEach(watcher => watcher.close());
    clearInterval(syncTimer);

    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  log.info('Device sync service running');
}

// Start
main().catch(error => {
  log.error('Fatal error', error);
  process.exit(1);
});
