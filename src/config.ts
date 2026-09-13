/**
 * Configuration management with environment variable validation
 */

import 'dotenv/config';
import { z } from 'zod';
import { homedir } from 'os';
import { join } from 'path';
import { resolveEnvironmentSecrets, OnePasswordOptions } from './utils/onePassword.js';

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

// Environment variables that may hold 1Password references
export const SECRET_ENV_KEYS = [
  'METABASE_URL',
  'METABASE_API_KEY',
  'METABASE_USER_EMAIL',
  'METABASE_PASSWORD',
] as const;

export type ValidatedConfig = z.infer<typeof envSchema>;

/**
 * Treat empty-string variables as unset. GUI clients such as Claude Desktop
 * pass every declared setting, blank ones included, so an API-key-only
 * bundle install would otherwise fail on METABASE_USER_EMAIL="".
 */
function withoutEmptyValues(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
}

/**
 * Resolve op:// references and validate the environment. Throws with a
 * readable message on any failure; the server must not start half-configured.
 */
export function validateEnvironment(
  env: NodeJS.ProcessEnv = process.env,
  onePassword: OnePasswordOptions = {}
): ValidatedConfig {
  const resolvedEnv = resolveEnvironmentSecrets(
    withoutEmptyValues(env),
    SECRET_ENV_KEYS,
    onePassword
  );
  const result = envSchema.safeParse(resolvedEnv);
  if (!result.success) {
    const errorMessages = result.error.issues.map(
      issue => `${issue.path.join('.')}: ${issue.message}`
    );
    throw new Error(`Environment validation failed:\n${errorMessages.join('\n')}`);
  }
  return result.data;
}

// Create default test config for test environment
export function createTestConfig(): ValidatedConfig {
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
