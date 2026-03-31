import type { FastifyInstance } from 'fastify';

import { settingsRoutesPlugin } from './settings.routes.js';
import { accountsRoutesPlugin } from './accounts.routes.js';

async function financeModule(fastify: FastifyInstance): Promise<void> {
  await fastify.register(settingsRoutesPlugin);
  await fastify.register(accountsRoutesPlugin);
}

export const financeModulePlugin = financeModule;
