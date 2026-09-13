/**
 * Locate and read package.json so the server advertises the version it was
 * built from. Walks up from this file so it works from src/ under vitest,
 * from build/src/ at runtime, and from inside an MCPB bundle.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface PackageInfo {
  name: string;
  version: string;
}

export function findPackageJson(startDir: string, maxDepth = 5): string {
  let dir = startDir;
  for (let i = 0; i <= maxDepth; i++) {
    const candidate = join(dir, 'package.json');
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error(`package.json not found above ${startDir}`);
}

export function readPackageInfo(startDir = dirname(fileURLToPath(import.meta.url))): PackageInfo {
  const raw = JSON.parse(readFileSync(findPackageJson(startDir), 'utf-8')) as Partial<PackageInfo>;
  if (!raw.name || !raw.version) {
    throw new Error('package.json is missing name or version');
  }
  return { name: raw.name, version: raw.version };
}

export const PACKAGE_INFO: PackageInfo = readPackageInfo();
