// @nexa/platform-api — PlatformPrismaClient singleton with pg adapter (lazy)
import { PrismaClient } from '../generated/platform-prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

let _instance: PrismaClient | undefined;

/** Returns the PlatformPrismaClient singleton, creating it on first call. */
export function getPlatformPrisma(): PrismaClient {
  if (!_instance) {
    const connectionString = process.env.PLATFORM_DATABASE_URL;
    if (!connectionString) {
      throw new Error('PLATFORM_DATABASE_URL environment variable is not set');
    }
    const adapter = new PrismaPg({ connectionString });
    _instance = new PrismaClient({ adapter });
  }
  return _instance;
}

/** Type alias for the generated PrismaClient — use getPlatformPrisma() for the configured instance. */
export type PlatformPrismaClient = PrismaClient;
