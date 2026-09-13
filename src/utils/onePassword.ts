/**
 * 1Password secret reference resolution.
 *
 * Values of the form op://vault/item/[section/]field are resolved with the
 * 1Password CLI at startup. The CLI is invoked with an argument array, never
 * through a shell, and any failure aborts startup instead of silently using
 * the literal reference as a credential.
 */

import { execFileSync } from 'node:child_process';

// op://<vault>/<item>/<field> or op://<vault>/<item>/<section>/<field>.
// Segments start with a letter or digit and may contain spaces (1Password
// allows them). No shell is involved, so the pattern only has to reject
// traversal, query strings, control characters, and shell metacharacters.
const SEGMENT = '[A-Za-z0-9][A-Za-z0-9 ._-]*';
const OP_REFERENCE = new RegExp(`^op://${SEGMENT}/${SEGMENT}(?:/${SEGMENT}){1,2}$`);

export interface ExecOptions {
  encoding: 'utf-8';
  timeout: number;
  stdio: ['ignore', 'pipe', 'pipe'];
}

export type ExecFileSyncLike = (
  file: string,
  args: readonly string[],
  options: ExecOptions
) => string;

export interface OnePasswordOptions {
  /** Injectable process runner (tests). Defaults to child_process.execFileSync. */
  exec?: ExecFileSyncLike;
  /** Timeout for a single op read, in milliseconds. */
  timeoutMs?: number;
}

export function isOnePasswordReference(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('op://');
}

export function assertValidOnePasswordReference(ref: string): void {
  if (!OP_REFERENCE.test(ref)) {
    throw new Error(
      `Invalid 1Password secret reference (expected op://vault/item/[section/]field): ${ref}`
    );
  }
}

export function resolveOnePasswordReference(ref: string, options: OnePasswordOptions = {}): string {
  assertValidOnePasswordReference(ref);
  const exec: ExecFileSyncLike = options.exec ?? (execFileSync as unknown as ExecFileSyncLike);

  let output: string;
  try {
    output = exec('op', ['read', '--no-newline', ref], {
      encoding: 'utf-8',
      timeout: options.timeoutMs ?? 30_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException & { stderr?: string | Buffer };
    const reason =
      err.code === 'ENOENT'
        ? '1Password CLI (op) not found on PATH'
        : err.stderr?.toString().trim() || err.message || 'unknown error';
    throw new Error(`Failed to resolve 1Password reference ${ref}: ${reason}`);
  }

  const value = output.trim();
  if (!value) {
    throw new Error(`1Password reference ${ref} resolved to an empty value`);
  }
  return value;
}

/**
 * Return a copy of env in which every listed key holding an op:// reference
 * has been resolved. Keys with plain values are passed through untouched.
 */
export function resolveEnvironmentSecrets(
  env: NodeJS.ProcessEnv,
  keys: readonly string[],
  options: OnePasswordOptions = {}
): NodeJS.ProcessEnv {
  const resolved: NodeJS.ProcessEnv = { ...env };
  for (const key of keys) {
    const value = resolved[key];
    if (isOnePasswordReference(value)) {
      resolved[key] = resolveOnePasswordReference(value, options);
    }
  }
  return resolved;
}
