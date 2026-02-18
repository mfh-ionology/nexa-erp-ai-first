import { config } from 'dotenv';
import { resolve } from 'path';
import { defineConfig } from 'prisma/config';

config({ path: resolve(__dirname, '../../.env') });

// Prisma's env() throws if the variable is missing (it does NOT return falsy),
// so we read from process.env directly to support the DIRECT_URL fallback.
const datasourceUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!datasourceUrl) {
  throw new Error('Neither DIRECT_URL nor DATABASE_URL is set');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Prisma CLI uses DIRECT_URL (bypasses PgBouncer) for DDL commands like migrate/introspect.
    // Falls back to DATABASE_URL if DIRECT_URL is not set.
    // Runtime Prisma Client uses DATABASE_URL (PgBouncer) via the driver adapter in src/client.ts.
    url: datasourceUrl,
  },
});
