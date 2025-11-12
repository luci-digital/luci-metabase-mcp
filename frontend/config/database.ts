import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Device } from '../entities/Device';
import { Secret } from '../entities/Secret';
import { SyncLog } from '../entities/SyncLog';
import { LighthouseAudit } from '../entities/LighthouseAudit';
import { PleskServer } from '../entities/PleskServer';
import { Deployment } from '../entities/Deployment';

/**
 * TypeORM DataSource (Doctrine equivalent)
 * Configures database connection and ORM settings
 */
export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: process.env.DATABASE_PATH || './data/luci-unified.db',
  synchronize: process.env.NODE_ENV === 'development', // Auto-sync schema in dev
  logging: process.env.NODE_ENV === 'development',
  entities: [
    Device,
    Secret,
    SyncLog,
    LighthouseAudit,
    PleskServer,
    Deployment,
  ],
  migrations: ['./migrations/*.ts'],
  subscribers: [],
});

/**
 * Initialize database connection
 */
export async function initializeDatabase() {
  try {
    await AppDataSource.initialize();
    console.log('✓ Database initialized');

    // Run migrations if needed
    if (process.env.NODE_ENV !== 'development') {
      await AppDataSource.runMigrations();
      console.log('✓ Migrations applied');
    }

    return AppDataSource;
  } catch (error) {
    console.error('✗ Database initialization failed:', error);
    throw error;
  }
}

/**
 * Get repository for entity (Doctrine equivalent of EntityManager)
 */
export function getRepository<T>(entity: any) {
  return AppDataSource.getRepository<T>(entity);
}
