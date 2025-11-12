# Unified Consolidated Frontend

Complete integration of Plesk server management and Doctrine-style ORM (TypeORM) with 1Password, two-way sync, and Lighthouse CI into a unified control panel.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Unified Dashboard                          │
│                   (React Frontend)                           │
└─────────────────────────────────────────────────────────────┘
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
        ┌──────────────┐      ┌─────────────────┐
        │  REST API    │      │  WebSocket      │
        │  (Express)   │      │  (Real-time)    │
        └──────────────┘      └─────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐  ┌──────────────┐
│   TypeORM    │   │    Plesk     │  │  1Password   │
│  (Doctrine)  │   │  API Client  │  │  Integration │
└──────────────┘   └──────────────┘  └──────────────┘
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐  ┌──────────────┐
│   SQLite DB  │   │Plesk Servers │  │   Secrets    │
│  (Entities)  │   │  (Deploy)    │  │   (Vault)    │
└──────────────┘   └──────────────┘  └──────────────┘
```

## Key Components

### 1. Doctrine-Style Entities (TypeORM)

**Six core entities** managing all data:

#### Device Entity
- Tracks all synced devices
- Platform information (macOS, Linux, Windows)
- Sync status and health
- Webhook URLs

#### Secret Entity
- 1Password vault references
- Secret metadata and types
- Rotation schedules
- Usage tracking

#### SyncLog Entity
- All sync operations logged
- Success/failure tracking
- Performance metrics
- Device correlation

#### LighthouseAudit Entity
- CI audit results
- Performance scores
- Secret exposure findings
- Quality gate status

#### PleskServer Entity
- Server inventory
- API credentials (via 1Password)
- Health monitoring
- Domain management

#### Deployment Entity
- Deployment history
- Quality gate correlation
- Rollback capabilities
- Performance tracking

### 2. Plesk Integration

**Features**:
- ✅ Server management via XML-RPC API
- ✅ Domain deployment
- ✅ SSL certificate installation
- ✅ Health monitoring
- ✅ Automatic OS upgrades
- ✅ Virus scanning integration

**Security**:
- API keys stored in 1Password
- Automatic credential rotation
- Secure secret injection
- Audit logging

### 3. Unified Dashboard

**Consolidated view**:
- All devices and their status
- Sync operations in real-time
- Lighthouse CI results
- Plesk server health
- Secret rotation schedules
- Deployment history

## Setup

### Prerequisites

```bash
# Install dependencies
cd frontend
npm install

# Install TypeORM CLI globally
npm install -g typeorm
```

### Database Configuration

**Location**: `frontend/config/database.ts`

Uses **better-sqlite3** for lightweight, embedded database:
```typescript
{
  type: 'better-sqlite3',
  database: './data/luci-unified.db',
  entities: [Device, Secret, SyncLog, ...],
  synchronize: true, // Dev only
  migrations: ['./migrations/*.ts'],
}
```

### Environment Variables

Create `frontend/.env`:
```bash
# Database
DATABASE_PATH=./data/luci-unified.db

# API Server
API_PORT=4000
API_HOST=localhost

# Plesk (for testing)
PLESK_API_KEY=test-key

# 1Password
OP_ACCOUNT=lucidigital

# Sync Service
SYNC_SERVICE_URL=http://localhost:3000

# Lighthouse CI
LHCI_SERVER_URL=http://localhost:9001
```

### Initialize Database

```bash
# Run migrations
npm run doctrine:migrate

# Load fixtures (optional)
npm run doctrine:fixtures
```

## Usage

### Starting the System

```bash
# Start all services
cd frontend
npm start

# Or individually:
npm run api      # Backend API only
npm run dev      # Frontend only
```

This starts:
1. **API Server** on port 4000
2. **Frontend** on port 5173 (Vite dev server)
3. **Database** (SQLite, auto-created)

### Managing Plesk Servers

#### Register a Server

```bash
POST /api/plesk/servers
{
  "hostname": "server1.example.com",
  "apiUrl": "https://server1.example.com:8443",
  "apiKeyVault": "Production",
  "apiKeyItem": "Plesk Server 1",
  "apiKeyField": "api_key"
}
```

API key is fetched from 1Password automatically.

#### Deploy to Server

```bash
POST /api/plesk/deploy
{
  "serverId": "uuid",
  "domain": "example.com",
  "gitUrl": "https://github.com/luci-digital/luci-metabase-mcp",
  "branch": "main",
  "requiresAudit": true
}
```

**Flow**:
1. Check if Lighthouse audit passed for this commit
2. Load secrets from 1Password
3. Deploy to Plesk server
4. Log deployment in database
5. Notify all synced devices

#### Health Check

```bash
GET /api/plesk/servers/:id/health
```

Returns:
```json
{
  "status": "healthy",
  "version": "18.0.47",
  "domains": 15,
  "lastCheck": "2025-11-12T10:30:00Z"
}
```

### Viewing Dashboard

Navigate to `http://localhost:5173`

**Sections**:

1. **Overview**
   - System health
   - Active devices
   - Recent syncs
   - Latest audits

2. **Devices**
   - All registered devices
   - Sync status
   - Last seen
   - Platform info

3. **Secrets**
   - All secrets from 1Password
   - Usage tracking
   - Rotation schedules
   - Expiration warnings

4. **Lighthouse**
   - Recent audits
   - Performance trends
   - Secret exposures
   - Quality gates

5. **Plesk**
   - Server inventory
   - Domain list
   - Deployment history
   - Health status

6. **Deployments**
   - Recent deployments
   - Success rate
   - Rollback history
   - Quality correlation

## API Endpoints

### Devices

```
GET    /api/devices              # List all devices
GET    /api/devices/:id          # Get device
POST   /api/devices              # Register device
PUT    /api/devices/:id          # Update device
DELETE /api/devices/:id          # Remove device
```

### Secrets

```
GET    /api/secrets              # List secrets
GET    /api/secrets/:id          # Get secret
POST   /api/secrets              # Create secret ref
PUT    /api/secrets/:id/rotate   # Trigger rotation
```

### Sync

```
GET    /api/sync/logs            # Sync history
POST   /api/sync/trigger         # Manual sync
GET    /api/sync/status          # Current status
```

### Lighthouse

```
GET    /api/lighthouse/audits    # Audit history
GET    /api/lighthouse/:id       # Get audit
POST   /api/lighthouse/trigger   # Run audit
```

### Plesk

```
GET    /api/plesk/servers        # List servers
POST   /api/plesk/servers        # Register server
GET    /api/plesk/servers/:id    # Get server
POST   /api/plesk/deploy         # Deploy to server
GET    /api/plesk/deployments    # Deployment history
```

### Deployments

```
GET    /api/deployments          # List deployments
GET    /api/deployments/:id      # Get deployment
POST   /api/deployments/:id/rollback  # Rollback
```

## Integration with Existing Systems

### 1Password Integration

All secrets fetched via existing `op` CLI:

```typescript
// Automatic secret resolution
const secret = await secretRepo.findOne({ id: 'uuid' });
const value = execSync(`op read "op://${secret.vault}/${secret.item}/${secret.field}"`);
```

### Sync Service Integration

Monitors sync webhook receiver:

```typescript
// Real-time sync monitoring
const syncStatus = await fetch('http://localhost:3000/status');
// Update Device entity with latest status
```

### Lighthouse CI Integration

Ingests audit results:

```typescript
// After Lighthouse run
const results = JSON.parse(fs.readFileSync('.lighthouseci/report.json'));
const audit = auditRepo.create({
  url: results.requestedUrl,
  performanceScore: results.categories.performance.score,
  secretsFound: results.customAudits.secretDetection.findings,
  // ... all metrics
});
```

### Deployment Flow

**Complete automated pipeline**:

```
1. Code pushed to GitHub
      ↓
2. Lighthouse CI runs
      ↓
3. Quality gates checked
      ↓ (if pass)
4. Secrets synced to on-prem
      ↓
5. Unified frontend notified
      ↓
6. Deployment triggered to Plesk
      ↓
7. Health check performed
      ↓
8. All devices notified
```

## Dashboard Features

### Real-Time Updates

**WebSocket integration** for live updates:
- Device status changes
- Sync operations
- Deployment progress
- Audit results

### Performance Metrics

**Charts and graphs**:
- Lighthouse scores over time
- Sync operation duration
- Deployment success rate
- Server health trends

### Secret Management

**Rotation automation**:
- Automatic rotation schedules
- Expiration warnings
- Usage tracking
- 1Password sync status

### Deployment Management

**One-click deployment**:
- Select server
- Choose branch/commit
- Quality gate validation
- Automatic rollback on failure

## Database Schema

### TypeORM Entities (Doctrine style)

**Auto-generated tables**:

```sql
-- devices table
CREATE TABLE devices (
  id VARCHAR(36) PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE,
  hostname VARCHAR(255),
  platform VARCHAR(50),
  status VARCHAR(50),
  last_seen DATETIME,
  last_sync DATETIME,
  created_at DATETIME,
  updated_at DATETIME
);

-- secrets table
CREATE TABLE secrets (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255),
  vault VARCHAR(255),
  item VARCHAR(255),
  field VARCHAR(255),
  type VARCHAR(50),
  is_rotated BOOLEAN,
  last_rotated DATETIME,
  created_at DATETIME
);

-- lighthouse_audits table
CREATE TABLE lighthouse_audits (
  id VARCHAR(36) PRIMARY KEY,
  url VARCHAR(500),
  branch VARCHAR(100),
  commit VARCHAR(40),
  performance_score FLOAT,
  accessibility_score FLOAT,
  passed BOOLEAN,
  created_at DATETIME
);

-- plesk_servers table
CREATE TABLE plesk_servers (
  id VARCHAR(36) PRIMARY KEY,
  hostname VARCHAR(255),
  api_url VARCHAR(500),
  api_key_id VARCHAR(36),
  status VARCHAR(50),
  version VARCHAR(50),
  created_at DATETIME
);

-- deployments table
CREATE TABLE deployments (
  id VARCHAR(36) PRIMARY KEY,
  server_id VARCHAR(36),
  device_id VARCHAR(36),
  branch VARCHAR(100),
  commit VARCHAR(40),
  status VARCHAR(50),
  quality_gate_passed BOOLEAN,
  created_at DATETIME
);
```

**Relationships**:
- Device → SyncLogs (1:many)
- Device → Deployments (1:many)
- PleskServer → Deployments (1:many)
- Secret → PleskServer (1:1 for API key)

### Migrations

**TypeORM migrations** (Doctrine style):

```bash
# Generate migration
npm run typeorm migration:generate -- -n AddDeploymentTable

# Run migrations
npm run doctrine:migrate

# Revert migration
npm run typeorm migration:revert
```

## Advanced Features

### Automatic Rollback

**Quality gate failure** triggers automatic rollback:

```typescript
if (!deployment.qualityGatePassed) {
  await pleskClient.deploySite(
    deployment.domain,
    deployment.gitUrl,
    deployment.rollbackInfo.previousCommit
  );
}
```

### Secret Rotation

**Scheduled rotation** with 1Password:

```typescript
// Check for expiring secrets
const expiring = await secretRepo
  .createQueryBuilder('secret')
  .where('secret.next_rotation < :now', { now: new Date() })
  .getMany();

// Trigger rotation in 1Password
for (const secret of expiring) {
  await rotateSecret(secret);
  await notifyAllDevices(secret);
}
```

### Multi-Tenancy

**Support multiple environments**:

```typescript
// Development servers
const devServers = await pleskServerRepo.find({
  where: { metadata: { environment: 'development' } }
});

// Production servers
const prodServers = await pleskServerRepo.find({
  where: { metadata: { environment: 'production' } }
});
```

## Security

### Authentication

- **API Key** authentication for external requests
- **Session** authentication for dashboard
- **1Password** integration for all secrets

### Authorization

- **Role-based access** control
- **Audit logging** for all operations
- **Secret exposure** prevention

### Encryption

- **Secrets** encrypted at rest (1Password)
- **API keys** never logged
- **TLS** for all external connections

## Monitoring

### Health Checks

**Automated monitoring**:
- All Plesk servers (every 5 minutes)
- All devices (heartbeat)
- Sync service availability
- Lighthouse CI server
- Database health

### Alerts

**Configurable alerts** for:
- Server downtime
- Failed deployments
- Secret expiration
- Quality gate failures
- Device offline

### Metrics

**Collected metrics**:
- Deployment frequency
- Success rate
- Average duration
- Quality scores
- Secret rotation rate

## Troubleshooting

### Database Issues

```bash
# Reset database
rm frontend/data/luci-unified.db
npm run doctrine:migrate

# Check migrations
npm run typeorm migration:show
```

### Plesk Connection

```bash
# Test Plesk API
curl -k https://server.example.com:8443/api/v2/server \
  -H "X-API-Key: your-key"
```

### Frontend Not Loading

```bash
# Clear Vite cache
rm -rf frontend/node_modules/.vite
npm run dev
```

## Development

### Adding New Entity

1. Create entity file in `frontend/entities/`
2. Add to `database.ts`
3. Generate migration
4. Run migration

```bash
npm run typeorm migration:generate -- -n AddNewEntity
npm run doctrine:migrate
```

### Adding API Endpoint

1. Create controller in `frontend/src/api/controllers/`
2. Add routes in `frontend/src/api/server.ts`
3. Update frontend client in `frontend/src/api/client.ts`

### Custom Plesk Integration

**Extend PleskClient**:

```typescript
class CustomPleskClient extends PleskClient {
  async customMethod() {
    // Your custom Plesk API call
  }
}
```

## Benefits

### Unified Management
- ✅ Single dashboard for all systems
- ✅ Consolidated logging
- ✅ Cross-system correlation
- ✅ Holistic view of infrastructure

### Automation
- ✅ Automatic deployments
- ✅ Secret rotation
- ✅ Health monitoring
- ✅ Quality enforcement

### Integration
- ✅ 1Password for secrets
- ✅ Plesk for hosting
- ✅ Lighthouse for quality
- ✅ Two-way sync for devices

### Developer Experience
- ✅ Doctrine-style ORM (familiar PHP patterns)
- ✅ Type-safe TypeScript
- ✅ Modern React UI
- ✅ Real-time updates

## Resources

### Documentation
- [TypeORM](https://typeorm.io/) - Doctrine equivalent for Node.js
- [Plesk API](https://docs.plesk.com/en-US/obsidian/api-rpc/) - XML-RPC API docs
- [React](https://react.dev/) - Frontend framework
- [Vite](https://vitejs.dev/) - Build tool

### Related Guides
- [TWO-WAY-SYNC.md](TWO-WAY-SYNC.md) - Two-way sync system
- [LIGHTHOUSE-CI.md](LIGHTHOUSE-CI.md) - Quality gates
- [ONEPASSWORD-INTEGRATION.md](ONEPASSWORD-INTEGRATION.md) - Secret management

---

**Last Updated**: 2025-11-12
**Version**: 1.0.0
**Maintainer**: luci-digital
