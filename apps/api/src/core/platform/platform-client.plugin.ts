import type { FastifyInstance } from 'fastify';
import type { Logger } from 'pino';
import fp from 'fastify-plugin';
import { createPlatformClient, type PlatformClient } from '@nexa/platform-client';

declare module 'fastify' {
  interface FastifyInstance {
    platformClient: PlatformClient | null;
  }
}

const platformClientPluginFn = async (fastify: FastifyInstance): Promise<void> => {
  const platformApiUrl = process.env.PLATFORM_API_URL ?? 'http://localhost:3001/api/v1';
  const serviceToken = process.env.PLATFORM_SERVICE_TOKEN;

  if (!serviceToken) {
    fastify.log.warn('PLATFORM_SERVICE_TOKEN not set — PlatformClient disabled');
    fastify.decorate('platformClient', null);
    return;
  }

  const client = createPlatformClient({
    platformApiUrl,
    serviceToken,
    redisUrl: process.env.REDIS_URL,
    logger: fastify.log as unknown as Logger,
  });

  fastify.decorate('platformClient', client);

  // Gracefully close Redis and other connections on server shutdown
  fastify.addHook('onClose', async () => {
    await client.destroy();
  });
};

export const platformClientPlugin = fp(platformClientPluginFn, {
  name: 'platform-client',
});
