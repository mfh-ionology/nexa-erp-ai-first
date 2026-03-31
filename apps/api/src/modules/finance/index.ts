import type { FastifyInstance } from 'fastify';

import { settingsRoutesPlugin } from './settings.routes.js';
import { accountsRoutesPlugin } from './accounts.routes.js';
import { periodsRoutesPlugin } from './periods.routes.js';
import { accountMappingsRoutesPlugin } from './account-mappings.routes.js';
import { journalsRoutesPlugin } from './journals.routes.js';

async function financeModule(fastify: FastifyInstance): Promise<void> {
  await fastify.register(settingsRoutesPlugin);
  await fastify.register(accountsRoutesPlugin);
  await fastify.register(periodsRoutesPlugin);
  await fastify.register(accountMappingsRoutesPlugin);
  await fastify.register(journalsRoutesPlugin);
}

export const financeModulePlugin = financeModule;
