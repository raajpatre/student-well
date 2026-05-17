import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests live next to the code they cover, or in a tests/ tree.
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // The current suite covers pure functions only — no DB, no network.
    // Stub env vars at the test boundary if a future test pulls in a
    // module that touches config/env.ts.
    environment: 'node',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
  },
});
