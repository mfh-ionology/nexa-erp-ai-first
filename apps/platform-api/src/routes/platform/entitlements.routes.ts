import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';

import { getPlatformPrisma } from '../../client.js';
import { serviceTokenGuard } from '../../core/auth/service-token.guard.js';
import { NotFoundError } from '../../core/errors/app-error.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { sendSuccess } from '../../core/utils/response.js';

// ---------------------------------------------------------------------------
// Param / query schemas
// ---------------------------------------------------------------------------

const tenantIdParams = z.object({
  tenantId: z.uuid(),
});

const moduleAccessParams = z.object({
  tenantId: z.uuid(),
  moduleKey: z.string().min(1).max(50),
});

const userQuotaQuery = z.object({
  currentCount: z.coerce.number().int().min(0),
});

// ---------------------------------------------------------------------------
// Response schemas (for Fastify serialization)
// ---------------------------------------------------------------------------

const entitlementResponseSchema = successEnvelope(
  z.object({
    status: z.string(),
    planCode: z.string(),
    billingStatus: z.string(),
    enforcementAction: z.string(),
    maxUsers: z.number(),
    maxCompanies: z.number(),
    enabledModules: z.array(z.string()),
    featureFlags: z.record(z.string(), z.boolean()),
  }),
);

const statusResponseSchema = successEnvelope(
  z.object({
    status: z.string(),
    billingStatus: z.string(),
    enforcementAction: z.string(),
    sandboxEnabled: z.boolean(),
  }),
);

const moduleAccessResponseSchema = successEnvelope(
  z.object({
    allowed: z.boolean(),
    reason: z.string().optional(),
  }),
);

const userQuotaResponseSchema = successEnvelope(
  z.object({
    currentCount: z.number(),
    maxUsers: z.number(),
    canAddUser: z.boolean(),
  }),
);

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

async function entitlementRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // GET /platform/tenants/:tenantId/entitlements (4.2)
  // -------------------------------------------------------------------------
  fastify.get<{ Params: z.infer<typeof tenantIdParams> }>(
    '/platform/tenants/:tenantId/entitlements',
    {
      preHandler: [serviceTokenGuard],
      schema: {
        params: tenantIdParams,
        response: { 200: entitlementResponseSchema },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.params;
      const prisma = getPlatformPrisma();

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          plan: true,
          billing: true,
          moduleOverrides: true,
          featureFlags: true,
        },
      });

      if (!tenant) {
        throw new NotFoundError('TENANT_NOT_FOUND', `Tenant ${tenantId} not found`);
      }

      // Build enabled modules: start from plan, apply overrides
      const planModules = Array.isArray(tenant.plan.enabledModules)
        ? (tenant.plan.enabledModules as string[])
        : [];

      const moduleSet = new Set(planModules);
      for (const override of tenant.moduleOverrides) {
        if (override.enabled) {
          moduleSet.add(override.moduleKey);
        } else {
          moduleSet.delete(override.moduleKey);
        }
      }

      // Build feature flags
      const featureFlags: Record<string, boolean> = {};
      for (const flag of tenant.featureFlags) {
        featureFlags[flag.featureKey] = flag.enabled;
      }

      // Cache headers for efficient ERP caching (5 min)
      void reply.header('Cache-Control', 'private, max-age=300');

      return sendSuccess(reply, {
        status: tenant.status,
        planCode: tenant.plan.code,
        billingStatus: tenant.billingStatus,
        enforcementAction: tenant.billing?.enforcementAction ?? 'NONE',
        maxUsers: tenant.plan.maxUsers,
        maxCompanies: tenant.plan.maxCompanies,
        enabledModules: [...moduleSet].sort(),
        featureFlags,
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /platform/tenants/:tenantId/status (4.3)
  // -------------------------------------------------------------------------
  fastify.get<{ Params: z.infer<typeof tenantIdParams> }>(
    '/platform/tenants/:tenantId/status',
    {
      preHandler: [serviceTokenGuard],
      schema: {
        params: tenantIdParams,
        response: { 200: statusResponseSchema },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.params;
      const prisma = getPlatformPrisma();

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { billing: true },
      });

      if (!tenant) {
        throw new NotFoundError('TENANT_NOT_FOUND', `Tenant ${tenantId} not found`);
      }

      void reply.header('Cache-Control', 'private, max-age=60');

      return sendSuccess(reply, {
        status: tenant.status,
        billingStatus: tenant.billingStatus,
        enforcementAction: tenant.billing?.enforcementAction ?? 'NONE',
        sandboxEnabled: tenant.sandboxEnabled,
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /platform/tenants/:tenantId/modules/:moduleKey/access (4.4)
  // -------------------------------------------------------------------------
  fastify.get<{ Params: z.infer<typeof moduleAccessParams> }>(
    '/platform/tenants/:tenantId/modules/:moduleKey/access',
    {
      preHandler: [serviceTokenGuard],
      schema: {
        params: moduleAccessParams,
        response: { 200: moduleAccessResponseSchema },
      },
    },
    async (request, reply) => {
      const { tenantId, moduleKey } = request.params;
      const prisma = getPlatformPrisma();

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          plan: true,
          moduleOverrides: {
            where: { moduleKey },
          },
        },
      });

      if (!tenant) {
        throw new NotFoundError('TENANT_NOT_FOUND', `Tenant ${tenantId} not found`);
      }

      // Check override first
      const override = tenant.moduleOverrides[0];
      if (override) {
        return sendSuccess(reply, {
          allowed: override.enabled,
          reason: override.enabled
            ? undefined
            : 'Module disabled by admin',
        });
      }

      // Fall back to plan modules
      const planModules = Array.isArray(tenant.plan.enabledModules)
        ? (tenant.plan.enabledModules as string[])
        : [];

      const allowed = planModules.includes(moduleKey);

      return sendSuccess(reply, {
        allowed,
        reason: allowed ? undefined : 'Module not included in your plan',
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /platform/tenants/:tenantId/users/quota (4.5)
  // -------------------------------------------------------------------------
  fastify.get<{
    Params: z.infer<typeof tenantIdParams>;
    Querystring: z.infer<typeof userQuotaQuery>;
  }>(
    '/platform/tenants/:tenantId/users/quota',
    {
      preHandler: [serviceTokenGuard],
      schema: {
        params: tenantIdParams,
        querystring: userQuotaQuery,
        response: { 200: userQuotaResponseSchema },
      },
    },
    async (
      request: FastifyRequest<{
        Params: z.infer<typeof tenantIdParams>;
        Querystring: z.infer<typeof userQuotaQuery>;
      }>,
      reply,
    ) => {
      const { tenantId } = request.params;
      const { currentCount } = request.query;
      const prisma = getPlatformPrisma();

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { plan: true },
      });

      if (!tenant) {
        throw new NotFoundError('TENANT_NOT_FOUND', `Tenant ${tenantId} not found`);
      }

      const maxUsers = tenant.plan.maxUsers;

      return sendSuccess(reply, {
        currentCount,
        maxUsers,
        canAddUser: currentCount < maxUsers,
      });
    },
  );
}

export const entitlementRoutesPlugin = fp(entitlementRoutes, {
  name: 'platform-entitlement-routes',
});
