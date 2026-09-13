import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findPackageJson, readPackageInfo, PACKAGE_INFO } from '../../src/utils/packageInfo.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

describe('packageInfo', () => {
  it('finds the repository package.json from a nested directory', () => {
    expect(findPackageJson(here)).toBe(resolve(repoRoot, 'package.json'));
  });

  it('reads the version that package.json declares', () => {
    const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf-8'));
    expect(readPackageInfo(here)).toEqual({ name: pkg.name, version: pkg.version });
    expect(PACKAGE_INFO.version).toBe(pkg.version);
  });

  it('throws when no package.json is reachable within the depth limit', () => {
    expect(() => findPackageJson('/nonexistent/deep/path', 1)).toThrow(/package.json not found/);
  });

  it('rejects a package.json without name or version', () => {
    expect(() => readPackageInfo('/')).toThrow();
  });
});
