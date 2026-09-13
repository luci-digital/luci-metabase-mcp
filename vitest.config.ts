import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      include: ['src/**/*.ts'],
      // src/index.ts is the process entry point (covered by the startup
      // smoke test in CI). src/api.ts is the Metabase HTTP client, which
      // CLAUDE.md says must only be exercised through mocked handler tests.
      exclude: ['src/index.ts', 'src/api.ts'],
      // Measured floor with a real (non-global) threshold config; raise as
      // coverage improves, never lower.
      thresholds: {
        branches: 73,
        functions: 85,
        lines: 78,
        statements: 78,
      },
    },
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['node_modules/**', 'build/**', 'dist/**'],
  },
  esbuild: {
    target: 'node20',
  },
});
