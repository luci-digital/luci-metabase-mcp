#!/usr/bin/env node

/**
 * Validate manifest.json (MCP Bundle manifest) against the repository:
 *  - required top-level fields are present and the version matches package.json
 *  - server.entry_point is the file the server args launch
 *  - every ${user_config.x} placeholder in server.mcp_config.env names a
 *    declared user_config key, and every user_config key is wired into env
 *  - the built entry point exists when a build/ directory is present
 *
 * Exit code 1 with a readable list of problems on failure.
 */

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const manifestPath = path.join(root, 'manifest.json');
const packagePath = path.join(root, 'package.json');

function fail(problems) {
  console.error('[validate-manifest] FAIL');
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

function main() {
  const problems = [];

  if (!fs.existsSync(manifestPath)) {
    fail(['manifest.json not found in the current directory']);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const pkg = fs.existsSync(packagePath)
    ? JSON.parse(fs.readFileSync(packagePath, 'utf8'))
    : {};

  for (const field of ['manifest_version', 'name', 'version', 'description', 'author', 'server']) {
    if (manifest[field] === undefined) {
      problems.push(`missing required field "${field}"`);
    }
  }

  if (pkg.version && manifest.version !== pkg.version) {
    problems.push(
      `version mismatch: manifest.json ${manifest.version} vs package.json ${pkg.version}`
    );
  }

  const server = manifest.server || {};
  const mcpConfig = server.mcp_config || {};
  const args = Array.isArray(mcpConfig.args) ? mcpConfig.args : [];
  const launched = args.map(arg => String(arg).replace(/^\$\{__dirname\}\//, ''));
  if (server.entry_point && !launched.includes(server.entry_point)) {
    problems.push(
      `server.entry_point "${server.entry_point}" is not launched by server.mcp_config.args`
    );
  }
  if (server.entry_point && fs.existsSync(path.join(root, 'build'))) {
    if (!fs.existsSync(path.join(root, server.entry_point))) {
      problems.push(`server.entry_point "${server.entry_point}" does not exist (run the build)`);
    }
  }

  const userConfig = manifest.user_config || {};
  const declared = new Set(Object.keys(userConfig));
  const referenced = new Set();
  for (const [envName, value] of Object.entries(mcpConfig.env || {})) {
    const match = /^\$\{user_config\.([A-Za-z0-9_]+)\}$/.exec(String(value));
    if (!match) {
      continue;
    }
    referenced.add(match[1]);
    if (!declared.has(match[1])) {
      problems.push(`env ${envName} references undeclared user_config key "${match[1]}"`);
    }
  }
  for (const key of declared) {
    if (!referenced.has(key)) {
      problems.push(`user_config key "${key}" is declared but not wired into server.mcp_config.env`);
    }
  }

  for (const [key, spec] of Object.entries(userConfig)) {
    if (!spec || typeof spec !== 'object' || !spec.type || !spec.title) {
      problems.push(`user_config key "${key}" needs at least "type" and "title"`);
    }
  }

  if (problems.length > 0) {
    fail(problems);
  }
  console.log(
    `[validate-manifest] OK: ${manifest.name} ${manifest.version}, ` +
      `${declared.size} user_config keys wired, entry point ${server.entry_point}`
  );
}

main();
