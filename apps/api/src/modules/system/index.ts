import type { FastifyInstance } from 'fastify';

import { companyRoutesPlugin } from './company.routes.js';
import { userRoutesPlugin } from './user.routes.js';
import { companyProfileRoutesPlugin } from './company-profile.routes.js';
import { resourceRoutesPlugin } from './resources.routes.js';
import { accessGroupRoutesPlugin } from './access-groups.routes.js';
import { userAccessGroupRoutesPlugin } from './user-access-groups.routes.js';
import { myPermissionsRoutesPlugin } from './my-permissions.routes.js';
import { auditLogRoutesPlugin } from './audit-log.routes.js';
import { deadLetterRoutesPlugin } from './dead-letter.routes.js';

// ---------------------------------------------------------------------------
// Unified System module plugin
// Registers all system sub-plugins under the /system prefix.
//
// Route layout:
//   GET  /system/companies              (list accessible companies)
//   POST /system/companies/:id/switch   (company switch)
//   GET|POST|PATCH /system/company-profile
//   GET|POST|PATCH|DELETE /system/users[/:id[/role|/modules]]
//   GET /system/resources
//   GET|POST|PATCH|DELETE /system/access-groups[/:id[/permissions]]
//   GET|PUT /system/users/:id/access-groups
//   GET /system/my-permissions
//   GET /system/audit-log
//   GET /system/audit-log/:entityType/:entityId
//   GET /system/dead-letter-queue
//   POST /system/dead-letter-queue/:id/reprocess
// ---------------------------------------------------------------------------

async function systemModule(fastify: FastifyInstance): Promise<void> {
  await fastify.register(companyRoutesPlugin);
  await fastify.register(userRoutesPlugin);
  await fastify.register(companyProfileRoutesPlugin);
  await fastify.register(resourceRoutesPlugin);
  await fastify.register(accessGroupRoutesPlugin);
  await fastify.register(userAccessGroupRoutesPlugin);
  await fastify.register(myPermissionsRoutesPlugin);
  await fastify.register(auditLogRoutesPlugin);
  await fastify.register(deadLetterRoutesPlugin);
}

export const systemModulePlugin = systemModule;
