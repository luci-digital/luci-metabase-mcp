/**
 * Configuration management with environment variable validation
 */

import 'dotenv/config';
import { z } from 'zod';
import { homedir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

// Helper function to expand system variables
function expandSystemVariables(path: string | undefined): string {
  // If no path is provided, use default
  if (!path) {
    return join(homedir(), 'Downloads', 'Metabase');
  }

  const homeDir = homedir();
  const desktopDir = join(homeDir, 'Desktop');
  const documentsDir = join(homeDir, 'Documents');
  const downloadsDir = join(homeDir, 'Downloads');

  return path
    .replace(/\$\{HOME\}/g, homeDir)
    .replace(/\$\{DESKTOP\}/g, desktopDir)
    .replace(/\$\{DOCUMENTS\}/g, documentsDir)
    .replace(/\$\{DOWNLOADS\}/g, downloadsDir)
    .replace(/\$HOME/g, homeDir)
    .replace(/^~/, homeDir);
}

// Environment variable schema
const envSchema = z
  .object({
    METABASE_URL: z.string().url('METABASE_URL must be a valid URL'),
    METABASE_API_KEY: z.string().optional(),
    METABASE_USER_EMAIL: z.string().email().optional(),
    METABASE_PASSWORD: z.string().min(1).optional(),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),
    CACHE_TTL_MS: z
      .string()
      .default('600000')
      .transform(val => parseInt(val, 10))
      .pipe(z.number().positive()), // 10 minutes
    REQUEST_TIMEOUT_MS: z
      .string()
      .default('600000')
      .transform(val => parseInt(val, 10))
      .pipe(z.number().positive()), // 10 minutes
    EXPORT_DIRECTORY: z.string().default('${DOWNLOADS}/Metabase').transform(expandSystemVariables),
  })
  .refine(data => data.METABASE_API_KEY || (data.METABASE_USER_EMAIL && data.METABASE_PASSWORD), {
    message:
      'Either METABASE_API_KEY or both METABASE_USER_EMAIL and METABASE_PASSWORD must be provided',
    path: ['METABASE_API_KEY'],
  });

// Parse and validate environment variables
function validateEnvironment() {
  try {
    // Intercept and resolve any 1Password 'op://' URIs before schema validation
    const resolveOnePassword = (val: string | undefined): string | undefined => {
      if (val && val.startsWith('op://')) {
        try {
          return execSync(`op read "${val}"`, { encoding: 'utf-8' }).trim();
        } catch (e: any) {
          console.error(`[1Password] Failed to resolve ${val}: ${e.message}`);
          return val;
        }
      }
      return val;
    };

    const resolvedEnv = { ...process.env };

    // Resolve potentially secret fields
    if (resolvedEnv.METABASE_API_KEY) {
      resolvedEnv.METABASE_API_KEY = resolveOnePassword(resolvedEnv.METABASE_API_KEY);
    }
    if (resolvedEnv.METABASE_PASSWORD) {
      resolvedEnv.METABASE_PASSWORD = resolveOnePassword(resolvedEnv.METABASE_PASSWORD);
    }

    return envSchema.parse(resolvedEnv);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Environment validation failed:\n${errorMessages.join('\n')}`);
    }
    throw error;
  }
}

// Create default test config for test environment
function createTestConfig() {
  return {
    METABASE_URL: 'http://localhost:3000',
    METABASE_API_KEY: 'test-api-key',
    METABASE_USER_EMAIL: undefined,
    METABASE_PASSWORD: undefined,
    NODE_ENV: 'test' as const,
    LOG_LEVEL: 'info' as const,
    CACHE_TTL_MS: 600000,
    REQUEST_TIMEOUT_MS: 600000,
    EXPORT_DIRECTORY: join(homedir(), 'Downloads', 'Metabase'),
  };
}

// Export validated configuration or test config
export const config =
  process.env.NODE_ENV === 'test' || process.env.VITEST
    ? createTestConfig()
    : validateEnvironment();

// Authentication method enum
export enum AuthMethod {
  SESSION = 'session',
  API_KEY = 'api_key',
}

// Logger level enum
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

// Determine authentication method
export const authMethod: AuthMethod = config.METABASE_API_KEY
  ? AuthMethod.API_KEY
  : AuthMethod.SESSION;

export default config;
