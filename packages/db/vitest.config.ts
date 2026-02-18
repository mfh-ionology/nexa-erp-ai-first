import { config } from 'dotenv';
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

// Load .env from monorepo root (same pattern as prisma.config.ts)
config({ path: resolve(__dirname, '../../.env') });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
