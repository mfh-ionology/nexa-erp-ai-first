import { buildApp } from './app.js';
import { getPlatformPrisma } from './client.js';

const DEFAULT_PORT = 5101;

async function start() {
  const port = Number(process.env.PLATFORM_PORT) || DEFAULT_PORT;

  const app = await buildApp();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Received shutdown signal, draining connections…');
    await app.close();
    try {
      const prisma = getPlatformPrisma();
      await prisma.$disconnect();
    } catch {
      // Prisma may not have been initialised — ignore
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`Platform API listening on port ${port}`);
}

start().catch((err) => {
  console.error('Failed to start Platform API:', err);
  process.exit(1);
});
