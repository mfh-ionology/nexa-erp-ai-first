import type { FastifyInstance } from 'fastify';

import { companyRoutesPlugin } from './company.routes.js';
import { userRoutesPlugin } from './user.routes.js';
import { companyProfileRoutesPlugin } from './company-profile.routes.js';
import { resourceRoutesPlugin } from './resource.routes.js';
import { accessGroupRoutesPlugin } from './access-group.routes.js';
import { myPermissionsRoutesPlugin } from './my-permissions.routes.js';

// ---------------------------------------------------------------------------
// Unified System module plugin
// Registers all system sub-plugins under the /system prefix.
//
// Route layout:
//   POST /system/companies/:id/switch   (company switch)
//   GET|POST|PATCH /system/company-profile
//   GET|POST|PATCH|DELETE /system/users[/:id[/role|/modules|/access-groups]]
//   GET /system/resources
//   GET|POST|PATCH|DELETE /system/access-groups[/:id[/permissions|/field-overrides]]
//   GET /system/my-permissions
// ---------------------------------------------------------------------------

async function systemModule(fastify: FastifyInstance): Promise<void> {
  await fastify.register(companyRoutesPlugin);
  await fastify.register(userRoutesPlugin);
  await fastify.register(companyProfileRoutesPlugin);
  await fastify.register(resourceRoutesPlugin);
  await fastify.register(accessGroupRoutesPlugin);
  await fastify.register(myPermissionsRoutesPlugin);
}

export const systemModulePlugin = systemModule;
