import { describe, it, expect, vi } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { validateEnvironment, createTestConfig, SECRET_ENV_KEYS, AuthMethod, authMethod } from '../src/config.js';
import type { ExecFileSyncLike } from '../src/utils/onePassword.js';

const base = {
  METABASE_URL: 'https://mb.example.com',
  METABASE_API_KEY: 'plain-key',
};

describe('validateEnvironment', () => {
  it('accepts API key authentication and applies defaults', () => {
    const cfg = validateEnvironment(base);
    expect(cfg.METABASE_URL).toBe('https://mb.example.com');
    expect(cfg.NODE_ENV).toBe('development');
    expect(cfg.LOG_LEVEL).toBe('info');
    expect(cfg.CACHE_TTL_MS).toBe(600000);
    expect(cfg.EXPORT_DIRECTORY).toBe(join(homedir(), 'Downloads', 'Metabase'));
  });

  it('accepts session authentication', () => {
    const cfg = validateEnvironment({
      METABASE_URL: 'https://mb.example.com',
      METABASE_USER_EMAIL: 'user@example.com',
      METABASE_PASSWORD: 'secret-value',
    });
    expect(cfg.METABASE_API_KEY).toBeUndefined();
    expect(cfg.METABASE_USER_EMAIL).toBe('user@example.com');
  });

  it('fails loudly when no authentication is configured', () => {
    expect(() => validateEnvironment({ METABASE_URL: 'https://mb.example.com' })).toThrow(
      /Environment validation failed[\s\S]*METABASE_API_KEY/
    );
  });

  it('rejects an invalid URL and a non-positive TTL', () => {
    expect(() => validateEnvironment({ ...base, METABASE_URL: 'not a url' })).toThrow(/valid URL/);
    expect(() => validateEnvironment({ ...base, CACHE_TTL_MS: '-5' })).toThrow(/CACHE_TTL_MS/);
  });

  it('coerces numeric strings and expands the export directory', () => {
    const cfg = validateEnvironment({
      ...base,
      CACHE_TTL_MS: '1000',
      REQUEST_TIMEOUT_MS: '2000',
      EXPORT_DIRECTORY: '${HOME}/exports',
    });
    expect(cfg.CACHE_TTL_MS).toBe(1000);
    expect(cfg.REQUEST_TIMEOUT_MS).toBe(2000);
    expect(cfg.EXPORT_DIRECTORY).toBe(join(homedir(), 'exports'));
  });

  it('resolves op:// references for every secret key before validation', () => {
    const exec = vi.fn((_file: string, args: readonly string[]) =>
      args[2] === 'op://V/Metabase/url' ? 'https://resolved.example.com' : 'resolved-key'
    ) as unknown as ExecFileSyncLike;
    const cfg = validateEnvironment(
      { METABASE_URL: 'op://V/Metabase/url', METABASE_API_KEY: 'op://V/Metabase/api_key' },
      { exec }
    );
    expect(cfg.METABASE_URL).toBe('https://resolved.example.com');
    expect(cfg.METABASE_API_KEY).toBe('resolved-key');
    expect(exec).toHaveBeenCalledTimes(2);
    expect(SECRET_ENV_KEYS).toContain('METABASE_PASSWORD');
  });

  it('never calls op for plain values', () => {
    const exec = vi.fn() as unknown as ExecFileSyncLike;
    validateEnvironment(base, { exec });
    expect(exec).not.toHaveBeenCalled();
  });

  it('throws before schema validation when an op:// reference is malformed', () => {
    const exec = vi.fn() as unknown as ExecFileSyncLike;
    expect(() => validateEnvironment({ ...base, METABASE_API_KEY: 'op://bad' }, { exec })).toThrow(
      /Invalid 1Password secret reference/
    );
    expect(exec).not.toHaveBeenCalled();
  });

  it('exposes a test configuration under vitest', () => {
    expect(createTestConfig().NODE_ENV).toBe('test');
    expect(authMethod).toBe(AuthMethod.API_KEY);
  });
});
