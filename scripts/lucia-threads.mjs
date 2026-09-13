#!/usr/bin/env node
/**
 * Generate .lucia/threads links from .lucia/threads/threads.json.
 *
 * Output matches the luci-vcs ThreadIndex on-disk format
 * (lucia_tooling_omzsh/modules/scm/luci-vcs/src/thread_index.rs):
 *   thread_id = "thread-" + blake3_hex(parts.join(":"))
 *   cid       = "bafk-blake3-" + blake3_hex(file bytes)
 *   thread-map.json = { "<thread_id>": { thread_id, links: [...] } }
 *   frequency-shards/<hz>/<thread_id>.json = { thread_id, links: [...] }
 *
 * Usage:
 *   node scripts/lucia-threads.mjs [--target <repo-root>] [--check]
 *
 * --target writes the thread files into another repository's .lucia/threads
 * (for example the system-config repo) so both sides of a thread resolve.
 * --check regenerates in memory and exits 1 if the committed files differ.
 * Repository roots come from the env vars named in threads.json or their
 * defaults relative to this repository.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { blake3 } from '@noble/hashes/blake3';
import { bytesToHex } from '@noble/hashes/utils';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const specPath = join(repoRoot, '.lucia', 'threads', 'threads.json');

const args = process.argv.slice(2);
const check = args.includes('--check');
const targetIndex = args.indexOf('--target');
const targetRoot = targetIndex >= 0 ? resolve(args[targetIndex + 1]) : repoRoot;
const threadsDir = join(targetRoot, '.lucia', 'threads');

const spec = JSON.parse(readFileSync(specPath, 'utf-8'));

function repoRootFor(key) {
  const repo = spec.repos[key];
  if (!repo) {
    throw new Error(`unknown repo key ${key}`);
  }
  const fromEnv = process.env[repo.root_env];
  return resolve(repoRoot, fromEnv || repo.default_root);
}

function hex(bytes) {
  return bytesToHex(blake3(bytes));
}

function threadId(parts) {
  return `thread-${hex(new TextEncoder().encode(parts.join(':')))}`;
}

function buildEntries() {
  const entries = {};
  for (const thread of spec.threads) {
    const id = threadId(thread.parts);
    const links = [];
    for (const link of thread.links) {
      const repo = spec.repos[link.repo];
      const file = join(repoRootFor(link.repo), link.path);
      if (!existsSync(file)) {
        throw new Error(`missing file for thread ${thread.parts.join(':')}: ${file}`);
      }
      const cid = `bafk-blake3-${hex(readFileSync(file))}`;
      if (links.some(existing => existing.did === repo.did && existing.cid === cid)) {
        continue;
      }
      links.push({
        did: repo.did,
        cid,
        frequency_hz: link.frequency_hz ?? repo.frequency_hz,
        timestamp_ns: 0,
        path: link.path,
      });
    }
    entries[id] = { thread_id: id, parts: thread.parts, links };
  }
  return entries;
}

function render(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function expectedFiles(entries) {
  const files = new Map();
  files.set(join(threadsDir, 'thread-map.json'), render(entries));
  for (const entry of Object.values(entries)) {
    const byFrequency = new Map();
    for (const link of entry.links) {
      if (!byFrequency.has(link.frequency_hz)) {
        byFrequency.set(link.frequency_hz, []);
      }
      byFrequency.get(link.frequency_hz).push(link);
    }
    for (const [hz, links] of byFrequency) {
      files.set(
        join(threadsDir, 'frequency-shards', String(hz), `${entry.thread_id}.json`),
        render({ thread_id: entry.thread_id, parts: entry.parts, links })
      );
    }
  }
  return files;
}

const entries = buildEntries();
const files = expectedFiles(entries);

if (check) {
  let drift = 0;
  for (const [file, content] of files) {
    const current = existsSync(file) ? readFileSync(file, 'utf-8') : null;
    if (current !== content) {
      drift += 1;
      process.stderr.write(`[lucia-threads] drift: ${file}\n`);
    }
  }
  const shardDir = join(threadsDir, 'frequency-shards');
  if (existsSync(shardDir)) {
    for (const hz of readdirSync(shardDir)) {
      const dir = join(shardDir, hz);
      for (const name of readdirSync(dir)) {
        const file = join(dir, name);
        if (name.startsWith('thread-') && !files.has(file)) {
          drift += 1;
          process.stderr.write(`[lucia-threads] stale shard: ${file}\n`);
        }
      }
    }
  }
  if (drift > 0) {
    process.stderr.write(`[lucia-threads] ${drift} file(s) differ; run: npm run lucia:threads\n`);
    process.exit(1);
  }
  process.stdout.write(`[lucia-threads] ${Object.keys(entries).length} threads up to date\n`);
} else {
  for (const [file, content] of files) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  const linkCount = Object.values(entries).reduce((n, e) => n + e.links.length, 0);
  process.stdout.write(
    `[lucia-threads] wrote ${Object.keys(entries).length} threads, ${linkCount} links to ${threadsDir}\n`
  );
}
