import { buildApp } from './app.js';

const DEFAULT_PORT = 3000;

async function start(): Promise<void> {
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  const host = process.env.HOST ?? '0.0.0.0';

  const app = await buildApp();

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'Received shutdown signal, closing server');
    await app.close();
    // eslint-disable-next-line n/no-process-exit -- Entry point graceful shutdown
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ port, host });
}

start().catch((err: unknown) => {
  process.stderr.write(`Failed to start server: ${String(err)}\n`);
  // eslint-disable-next-line n/no-process-exit -- Fatal startup failure
  process.exit(1);
});
