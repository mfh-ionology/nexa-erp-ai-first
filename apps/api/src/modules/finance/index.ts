import type { FastifyInstance } from 'fastify';

import { settingsRoutesPlugin } from './settings.routes.js';

async function financeModule(fastify: FastifyInstance): Promise<void> {
  await fastify.register(settingsRoutesPlugin);
}

export const financeModulePlugin = financeModule;
