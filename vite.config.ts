import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    // Several suites run hundreds of thousands of deterministic simulation steps.
    // Cap worker parallelism so these CPU-bound files are not oversubscribed on
    // many-core machines, and allow generous headroom before a timeout is treated
    // as a failure. Individual long-run tests may still raise their own timeout.
    testTimeout: 60000,
    maxWorkers: 5,
  },
});
