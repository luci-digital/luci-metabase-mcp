import { describe, it, expect, vi } from 'vitest';
import {
  isOnePasswordReference,
  assertValidOnePasswordReference,
  resolveOnePasswordReference,
  resolveEnvironmentSecrets,
  type ExecFileSyncLike,
} from '../../src/utils/onePassword.js';

const okExec = (): ExecFileSyncLike => vi.fn(() => 'resolved-secret\n') as unknown as ExecFileSyncLike;

describe('isOnePasswordReference', () => {
  it('detects op:// strings and rejects everything else', () => {
    expect(isOnePasswordReference('op://a/b/c')).toBe(true);
    expect(isOnePasswordReference('https://x')).toBe(false);
    expect(isOnePasswordReference(undefined)).toBe(false);
    expect(isOnePasswordReference(42)).toBe(false);
  });
});

describe('assertValidOnePasswordReference', () => {
  it.each([
    'op://Vault/Item/field',
    'op://Lucia-AI-Secrets/Metabase/api_key',
    'op://Lucia AI Secrets/Metabase/section/field',
    'op://v_1/i.2/f-3',
  ])('accepts %s', ref => {
    expect(() => assertValidOnePasswordReference(ref)).not.toThrow();
  });

  it.each([
    'op://only-vault',
    'op://vault/item',
    'op://v/i/f/extra/too-many',
    'op://v/i/f;rm -rf ~',
    'op://v/i/f?x=1',
    'op://../i/f',
    'op://v/i/f`id`',
    'op://v/i/$(id)',
    'op://v/i/f\n',
    'op://v/i/f|cat',
    'op:///i/f',
  ])('rejects %j', ref => {
    expect(() => assertValidOnePasswordReference(ref)).toThrow(/Invalid 1Password secret reference/);
  });
});

describe('resolveOnePasswordReference', () => {
  it('invokes op with an argument array, never a shell string', () => {
    const exec = okExec();
    const value = resolveOnePasswordReference('op://V/I/f', { exec });
    expect(value).toBe('resolved-secret');
    expect(exec).toHaveBeenCalledWith(
      'op',
      ['read', '--no-newline', 'op://V/I/f'],
      expect.objectContaining({ encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] })
    );
  });

  it('honours a custom timeout', () => {
    const exec = okExec();
    resolveOnePasswordReference('op://V/I/f', { exec, timeoutMs: 5 });
    expect(exec).toHaveBeenCalledWith('op', expect.any(Array), expect.objectContaining({ timeout: 5 }));
  });

  it('does not invoke op for an invalid reference', () => {
    const exec = okExec();
    expect(() => resolveOnePasswordReference('op://bad', { exec })).toThrow(/Invalid/);
    expect(exec).not.toHaveBeenCalled();
  });

  it('includes stderr when op exits non-zero', () => {
    const exec = vi.fn(() => {
      const err = new Error('exit 1') as Error & { stderr?: string };
      err.stderr = '[ERROR] item not found';
      throw err;
    }) as unknown as ExecFileSyncLike;
    expect(() => resolveOnePasswordReference('op://V/I/f', { exec })).toThrow(/item not found/);
  });

  it('explains a missing op binary', () => {
    const exec = vi.fn(() => {
      const err = new Error('spawn op ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    }) as unknown as ExecFileSyncLike;
    expect(() => resolveOnePasswordReference('op://V/I/f', { exec })).toThrow(/not found on PATH/);
  });

  it('falls back to the error message when there is no stderr', () => {
    const exec = vi.fn(() => {
      throw new Error('timed out');
    }) as unknown as ExecFileSyncLike;
    expect(() => resolveOnePasswordReference('op://V/I/f', { exec })).toThrow(/timed out/);
  });

  it('rejects an empty resolution', () => {
    const exec = vi.fn(() => '  \n') as unknown as ExecFileSyncLike;
    expect(() => resolveOnePasswordReference('op://V/I/f', { exec })).toThrow(/empty value/);
  });
});

describe('resolveEnvironmentSecrets', () => {
  it('resolves only listed keys holding op:// values and passes others through', () => {
    const exec = okExec();
    const env = {
      METABASE_URL: 'https://mb.example.com',
      METABASE_API_KEY: 'op://V/Metabase/api_key',
      OTHER: 'op://V/Other/field',
    };
    const out = resolveEnvironmentSecrets(env, ['METABASE_URL', 'METABASE_API_KEY'], { exec });
    expect(out.METABASE_URL).toBe('https://mb.example.com');
    expect(out.METABASE_API_KEY).toBe('resolved-secret');
    expect(out.OTHER).toBe('op://V/Other/field');
    expect(exec).toHaveBeenCalledTimes(1);
  });

  it('does not mutate the input', () => {
    const env = { METABASE_API_KEY: 'op://V/I/f' };
    resolveEnvironmentSecrets(env, ['METABASE_API_KEY'], { exec: okExec() });
    expect(env.METABASE_API_KEY).toBe('op://V/I/f');
  });

  it('propagates resolution failures', () => {
    const exec = vi.fn(() => {
      throw new Error('nope');
    }) as unknown as ExecFileSyncLike;
    expect(() => resolveEnvironmentSecrets({ K: 'op://V/I/f' }, ['K'], { exec })).toThrow(/nope/);
  });
});
