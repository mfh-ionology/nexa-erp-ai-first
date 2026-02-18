import { config } from 'dotenv';
import { resolve } from 'path';
import { defineConfig } from 'prisma/config';

config({ path: resolve(__dirname, '../../.env') });

const datasourceUrl = process.env.PLATFORM_DATABASE_URL;
if (!datasourceUrl) {
  throw new Error('PLATFORM_DATABASE_URL environment variable is not set');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: datasourceUrl,
  },
});
