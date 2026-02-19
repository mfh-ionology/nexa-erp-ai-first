import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { createRequire } from 'node:module';

import { sendSuccess } from '../utils/response.js';

const require = createRequire(import.meta.url);
const pkg = require('../../../package.json') as { version: string };

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', (_request, reply) => {
    sendSuccess(reply, {
      status: 'ok',
      version: pkg.version,
      uptime: process.uptime(),
    });
  });
}

export const healthRoutesPlugin = fp(healthRoutes, {
  name: 'health-routes',
});
