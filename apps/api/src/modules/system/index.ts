import type { FastifyInstance } from 'fastify';

import { companyRoutesPlugin } from './company.routes.js';
import { userRoutesPlugin } from './user.routes.js';
import { companyProfileRoutesPlugin } from './company-profile.routes.js';

// ---------------------------------------------------------------------------
// Unified System module plugin
// Registers all system sub-plugins under the /system prefix.
//
// Route layout:
//   POST /system/companies/:id/switch   (company switch)
//   GET|POST|PATCH /system/company-profile
//   GET|POST|PATCH|DELETE /system/users[/:id[/role|/modules]]
// ---------------------------------------------------------------------------

async function systemModule(fastify: FastifyInstance): Promise<void> {
  await fastify.register(companyRoutesPlugin);
  await fastify.register(userRoutesPlugin);
  await fastify.register(companyProfileRoutesPlugin);
}

export const systemModulePlugin = systemModule;
