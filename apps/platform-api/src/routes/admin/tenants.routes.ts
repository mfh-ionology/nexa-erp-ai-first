// ---------------------------------------------------------------------------
// Tenant CRUD Routes — Create, list, detail, update tenants
// Source: API Contracts §21.1, FR193-FR196, BR-PLT-017
// Story: E3b.2 Tasks 4, 5, 6
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { EnforcementAction } from '../../../generated/platform-prisma/client';

import { getPlatformPrisma } from '../../client.js';
import { requirePlatformRole } from '../../core/auth/platform-role.guard.js';
import { AppError, NotFoundError } from '../../core/errors/app-error.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { sendSuccess } from '../../core/utils/response.js';
import { BillingEnforcementService } from '../../services/billing-enforcement.service.js';
import { TenantLifecycleService } from '../../services/tenant-lifecycle.service.js';
import { WebhookServiceImpl } from '../../services/webhook.service.js';

import {
  createTenantRequestSchema,
  updateTenantRequestSchema,
  suspendTenantRequestSchema,
  modulesRequestSchema,
  featureFlagsRequestSchema,
  assignPlanRequestSchema,
  assignPlanResponseSchema,
  billingResponseSchema,
  enforcementUpdateSchema,
  enforcementResponseSchema,
  aiQuotaResponseSchema,
  updateAiQuotaSchema,
  tenantIdParamsSchema,
  listTenantsQuerySchema,
  tenantListItemSchema,
  tenantDetailSchema,
  tenantSummarySchema,
  moduleOverrideListSchema,
  featureFlagListSchema,
  type CreateTenantRequest,
  type UpdateTenantRequest,
  type SuspendTenantRequest,
  type ModulesRequest,
  type FeatureFlagsRequest,
  type ListTenantsQuery,
  type AssignPlanRequest,
  type EnforcementUpdateRequest,
  type UpdateAiQuotaRequest,
} from './tenants.schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map Zod-validated enforcement action string to Prisma EnforcementAction enum */
const ENFORCEMENT_ACTION_MAP: Record<string, EnforcementAction> = {
  NONE: EnforcementAction.NONE,
  WARNING: EnforcementAction.WARNING,
  READ_ONLY: EnforcementAction.READ_ONLY,
  SUSPENDED: EnforcementAction.SUSPENDED,
};

/** Format a tenant record for list responses — strips internal infra fields */
function formatTenantListItem(tenant: {
  id: string;
  code: string;
  displayName: string;
  legalName: string | null;
  status: string;
  billingStatus: string;
  region: string;
  sandboxEnabled: boolean;
  lastActivityAt: Date | null;
  createdAt: Date;
  plan: { id: string; code: string; displayName: string };
  _count?: { moduleOverrides: number };
}) {
  return {
    id: tenant.id,
    code: tenant.code,
    displayName: tenant.displayName,
    legalName: tenant.legalName,
    status: tenant.status,
    billingStatus: tenant.billingStatus,
    region: tenant.region,
    sandboxEnabled: tenant.sandboxEnabled,
    lastActivityAt: tenant.lastActivityAt?.toISOString() ?? null,
    createdAt: tenant.createdAt.toISOString(),
    plan: tenant.plan,
    moduleOverrideCount: tenant._count?.moduleOverrides ?? 0,
  };
}

/** Format a tenant record for detail responses — includes related data */
function formatTenantDetail(tenant: {
  id: string;
  code: string;
  displayName: string;
  legalName: string | null;
  status: string;
  billingStatus: string;
  region: string;
  sandboxEnabled: boolean;
  lastActivityAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  plan: { id: string; code: string; displayName: string };
  moduleOverrides: Array<{
    id: string;
    moduleKey: string;
    enabled: boolean;
    reason: string | null;
    changedBy: string;
    changedAt: Date;
  }>;
  featureFlags: Array<{
    id: string;
    featureKey: string;
    enabled: boolean;
    changedBy: string;
    changedAt: Date;
  }>;
  billing: {
    subscriptionStatus: string | null;
    currentPeriodEnd: Date | null;
    gracePeriodDays: number;
    dunningLevel: number;
    enforcementAction: string;
  } | null;
  aiQuota: {
    periodStart: Date;
    periodEnd: Date;
    tokensUsed: bigint;
    tokenAllowance: bigint;
    softLimitPct: number;
    hardLimitPct: number;
  } | null;
}) {
  return {
    id: tenant.id,
    code: tenant.code,
    displayName: tenant.displayName,
    legalName: tenant.legalName,
    status: tenant.status,
    billingStatus: tenant.billingStatus,
    region: tenant.region,
    sandboxEnabled: tenant.sandboxEnabled,
    lastActivityAt: tenant.lastActivityAt?.toISOString() ?? null,
    createdAt: tenant.createdAt.toISOString(),
    updatedAt: tenant.updatedAt.toISOString(),
    plan: tenant.plan,
    moduleOverrides: tenant.moduleOverrides.map((m) => ({
      id: m.id,
      moduleKey: m.moduleKey,
      enabled: m.enabled,
      reason: m.reason,
      changedBy: m.changedBy,
      changedAt: m.changedAt.toISOString(),
    })),
    featureFlags: tenant.featureFlags.map((f) => ({
      id: f.id,
      featureKey: f.featureKey,
      enabled: f.enabled,
      changedBy: f.changedBy,
      changedAt: f.changedAt.toISOString(),
    })),
    billing: tenant.billing
      ? {
          subscriptionStatus: tenant.billing.subscriptionStatus,
          currentPeriodEnd:
            tenant.billing.currentPeriodEnd?.toISOString() ?? null,
          gracePeriodDays: tenant.billing.gracePeriodDays,
          dunningLevel: tenant.billing.dunningLevel,
          enforcementAction: tenant.billing.enforcementAction,
        }
      : null,
    aiQuota: tenant.aiQuota
      ? {
          periodStart: tenant.aiQuota.periodStart.toISOString(),
          periodEnd: tenant.aiQuota.periodEnd.toISOString(),
          tokensUsed: tenant.aiQuota.tokensUsed.toString(),
          tokenAllowance: tenant.aiQuota.tokenAllowance.toString(),
          softLimitPct: tenant.aiQuota.softLimitPct,
          hardLimitPct: tenant.aiQuota.hardLimitPct,
        }
      : null,
  };
}

/** Format a tenant summary (for create/lifecycle responses) */
function formatTenantSummary(tenant: {
  id: string;
  code: string;
  displayName: string;
  status: string;
  region: string;
  createdAt: Date;
  plan: { id: string; code: string; displayName: string };
}) {
  return {
    id: tenant.id,
    code: tenant.code,
    displayName: tenant.displayName,
    status: tenant.status,
    region: tenant.region,
    createdAt: tenant.createdAt.toISOString(),
    plan: tenant.plan,
  };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function tenantRoutes(fastify: FastifyInstance): Promise<void> {
  const prisma = getPlatformPrisma();
  const adminOnly = requirePlatformRole('PLATFORM_ADMIN');
  const viewerOrAdmin = requirePlatformRole(
    'PLATFORM_VIEWER',
    'PLATFORM_ADMIN',
  );

  // Instantiate services
  const webhookService = new WebhookServiceImpl(fastify.log);
  const lifecycleService = new TenantLifecycleService(
    fastify.platformAudit,
    webhookService,
  );
  const billingEnforcementService = new BillingEnforcementService(
    fastify.platformAudit,
    webhookService,
    fastify.log,
  );

  // -------------------------------------------------------------------------
  // GET /admin/tenants — list tenants (PLATFORM_VIEWER+)
  // -------------------------------------------------------------------------
  fastify.get(
    '/admin/tenants',
    {
      preHandler: [viewerOrAdmin],
      schema: {
        querystring: listTenantsQuerySchema,
        response: {
          200: successEnvelope(tenantListItemSchema.array()),
        },
      },
    },
    async (request, reply) => {
      const { limit, offset, status, planId, search } =
        request.query as ListTenantsQuery;

      // Build where clause
      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (planId) where.planId = planId;
      if (search) {
        where.OR = [
          { code: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } },
          { legalName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [tenants, total] = await Promise.all([
        prisma.tenant.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            code: true,
            displayName: true,
            legalName: true,
            status: true,
            billingStatus: true,
            region: true,
            sandboxEnabled: true,
            lastActivityAt: true,
            createdAt: true,
            plan: {
              select: { id: true, code: true, displayName: true },
            },
            _count: { select: { moduleOverrides: true } },
          },
        }),
        prisma.tenant.count({ where }),
      ]);

      return sendSuccess(
        reply,
        tenants.map(formatTenantListItem),
        { total, hasMore: offset + tenants.length < total },
      );
    },
  );

  // -------------------------------------------------------------------------
  // GET /admin/tenants/:id — tenant detail (PLATFORM_VIEWER+)
  // -------------------------------------------------------------------------
  fastify.get<{ Params: { id: string } }>(
    '/admin/tenants/:id',
    {
      preHandler: [viewerOrAdmin],
      schema: {
        params: tenantIdParamsSchema,
        response: { 200: successEnvelope(tenantDetailSchema) },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      const tenant = await prisma.tenant.findUnique({
        where: { id },
        select: {
          id: true,
          code: true,
          displayName: true,
          legalName: true,
          status: true,
          billingStatus: true,
          region: true,
          sandboxEnabled: true,
          lastActivityAt: true,
          createdAt: true,
          updatedAt: true,
          plan: {
            select: { id: true, code: true, displayName: true },
          },
          moduleOverrides: {
            select: {
              id: true,
              moduleKey: true,
              enabled: true,
              reason: true,
              changedBy: true,
              changedAt: true,
            },
            orderBy: { moduleKey: 'asc' },
          },
          featureFlags: {
            select: {
              id: true,
              featureKey: true,
              enabled: true,
              changedBy: true,
              changedAt: true,
            },
            orderBy: { featureKey: 'asc' },
          },
          billing: {
            select: {
              subscriptionStatus: true,
              currentPeriodEnd: true,
              gracePeriodDays: true,
              dunningLevel: true,
              enforcementAction: true,
            },
          },
          aiQuota: {
            select: {
              periodStart: true,
              periodEnd: true,
              tokensUsed: true,
              tokenAllowance: true,
              softLimitPct: true,
              hardLimitPct: true,
            },
          },
        },
      });

      if (!tenant) {
        throw new NotFoundError('TENANT_NOT_FOUND', 'Tenant not found');
      }

      return sendSuccess(reply, formatTenantDetail(tenant));
    },
  );

  // -------------------------------------------------------------------------
  // POST /admin/tenants — create tenant (PLATFORM_ADMIN)
  // -------------------------------------------------------------------------
  fastify.post(
    '/admin/tenants',
    {
      preHandler: [adminOnly],
      schema: {
        body: createTenantRequestSchema,
        response: { 201: successEnvelope(tenantSummarySchema) },
      },
      // No config.audit — we log explicitly below to capture the created tenant ID
    },
    async (request, reply) => {
      const body = request.body as CreateTenantRequest;

      // Check code uniqueness
      const existing = await prisma.tenant.findUnique({
        where: { code: body.code },
        select: { id: true },
      });

      if (existing) {
        throw new AppError(
          'CONFLICT',
          'A tenant with this code already exists',
          409,
        );
      }

      // Validate planId exists and is active (also fetch monthlyAiTokenAllowance for service)
      const plan = await prisma.plan.findUnique({
        where: { id: body.planId },
        select: { id: true, isActive: true, monthlyAiTokenAllowance: true },
      });

      if (!plan) {
        throw new NotFoundError('PLAN_NOT_FOUND', 'Plan not found');
      }

      if (!plan.isActive) {
        throw new AppError(
          'PLAN_INACTIVE',
          'Cannot assign tenant to an inactive plan',
          400,
        );
      }

      // Delegate to lifecycle service (pass token allowance to avoid redundant plan lookup)
      let tenant;
      try {
        tenant = await lifecycleService.createTenant(
          { ...body, monthlyAiTokenAllowance: plan.monthlyAiTokenAllowance },
          {
            platformUserId: request.platformUserId,
            ipAddress: request.ip ?? 'unknown',
            userAgent: request.headers['user-agent'],
          },
        );
      } catch (err) {
        // Handle race condition: concurrent request created a tenant with the
        // same code between our uniqueness check and the actual insert.
        if (
          err instanceof Error &&
          'code' in err &&
          (err as Record<string, unknown>).code === 'P2002'
        ) {
          throw new AppError(
            'CONFLICT',
            'A tenant with this code already exists',
            409,
          );
        }
        throw err;
      }

      return sendSuccess(reply, formatTenantSummary(tenant), undefined, 201);
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /admin/tenants/:id — update settings (PLATFORM_ADMIN)
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: { id: string } }>(
    '/admin/tenants/:id',
    {
      preHandler: [adminOnly],
      schema: {
        params: tenantIdParamsSchema,
        body: updateTenantRequestSchema,
        response: { 200: successEnvelope(tenantSummarySchema) },
      },
      // Explicit audit below (not config.audit) so we can capture old/new values
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body as UpdateTenantRequest;

      // Wrap read + update in a transaction to ensure audit captures consistent
      // old/new values even under concurrent modification.
      const { tenant, changes } = await prisma.$transaction(async (tx) => {
        // Fetch current values for audit comparison
        const existingTenant = await tx.tenant.findUnique({
          where: { id },
          select: {
            id: true,
            displayName: true,
            legalName: true,
            region: true,
            sandboxEnabled: true,
          },
        });

        if (!existingTenant) {
          throw new NotFoundError('TENANT_NOT_FOUND', 'Tenant not found');
        }

        // Build update data and track changes for audit
        const updateData: Record<string, unknown> = {};
        const fieldChanges: Record<string, { from: unknown; to: unknown }> = {};

        if (body.displayName !== undefined) {
          updateData.displayName = body.displayName;
          if (body.displayName !== existingTenant.displayName) {
            fieldChanges.displayName = { from: existingTenant.displayName, to: body.displayName };
          }
        }
        if (body.legalName !== undefined) {
          updateData.legalName = body.legalName;
          if (body.legalName !== existingTenant.legalName) {
            fieldChanges.legalName = { from: existingTenant.legalName, to: body.legalName };
          }
        }
        if (body.region !== undefined) {
          updateData.region = body.region;
          if (body.region !== existingTenant.region) {
            fieldChanges.region = { from: existingTenant.region, to: body.region };
          }
        }
        if (body.sandboxEnabled !== undefined) {
          updateData.sandboxEnabled = body.sandboxEnabled;
          if (body.sandboxEnabled !== existingTenant.sandboxEnabled) {
            fieldChanges.sandboxEnabled = { from: existingTenant.sandboxEnabled, to: body.sandboxEnabled };
          }
        }

        const updated = await tx.tenant.update({
          where: { id },
          data: updateData,
          select: {
            id: true,
            code: true,
            displayName: true,
            status: true,
            region: true,
            createdAt: true,
            plan: {
              select: { id: true, code: true, displayName: true },
            },
          },
        });

        return { tenant: updated, changes: fieldChanges };
      });

      // Explicit audit log with old/new values (BR-PLT-017)
      // Runs outside the transaction so audit failures don't roll back the update.
      try {
        await fastify.platformAudit.log({
          platformUserId: request.platformUserId,
          action: 'tenant.update',
          targetType: 'tenant',
          targetId: id,
          details: { changes },
          ipAddress: request.ip ?? 'unknown',
          userAgent: request.headers['user-agent'],
        });
      } catch {
        // Audit failures must not break operations (BR-PLT-017)
      }

      return sendSuccess(reply, formatTenantSummary(tenant));
    },
  );

  // -------------------------------------------------------------------------
  // POST /admin/tenants/:id/activate — PROVISIONING -> ACTIVE (PLATFORM_ADMIN)
  // -------------------------------------------------------------------------
  fastify.post<{ Params: { id: string } }>(
    '/admin/tenants/:id/activate',
    {
      preHandler: [adminOnly],
      schema: {
        params: tenantIdParamsSchema,
        response: { 200: successEnvelope(tenantSummarySchema) },
      },
    },
    async (request, reply) => {
      const tenant = await lifecycleService.activateTenant(
        request.params.id,
        {
          platformUserId: request.platformUserId,
          ipAddress: request.ip ?? 'unknown',
          userAgent: request.headers['user-agent'],
        },
      );

      return sendSuccess(reply, formatTenantSummary(tenant));
    },
  );

  // -------------------------------------------------------------------------
  // POST /admin/tenants/:id/suspend — ACTIVE/READ_ONLY -> SUSPENDED (PLATFORM_ADMIN)
  // Requires reason in body (mandatory per BR-PLT-001)
  // -------------------------------------------------------------------------
  fastify.post<{ Params: { id: string } }>(
    '/admin/tenants/:id/suspend',
    {
      preHandler: [adminOnly],
      schema: {
        params: tenantIdParamsSchema,
        body: suspendTenantRequestSchema,
        response: { 200: successEnvelope(tenantSummarySchema) },
      },
    },
    async (request, reply) => {
      const { reason } = request.body as SuspendTenantRequest;

      const tenant = await lifecycleService.suspendTenant(
        request.params.id,
        reason,
        {
          platformUserId: request.platformUserId,
          ipAddress: request.ip ?? 'unknown',
          userAgent: request.headers['user-agent'],
        },
      );

      return sendSuccess(reply, formatTenantSummary(tenant));
    },
  );

  // -------------------------------------------------------------------------
  // POST /admin/tenants/:id/reactivate — SUSPENDED/READ_ONLY -> ACTIVE (PLATFORM_ADMIN)
  // -------------------------------------------------------------------------
  fastify.post<{ Params: { id: string } }>(
    '/admin/tenants/:id/reactivate',
    {
      preHandler: [adminOnly],
      schema: {
        params: tenantIdParamsSchema,
        response: { 200: successEnvelope(tenantSummarySchema) },
      },
    },
    async (request, reply) => {
      const tenant = await lifecycleService.reactivateTenant(
        request.params.id,
        {
          platformUserId: request.platformUserId,
          ipAddress: request.ip ?? 'unknown',
          userAgent: request.headers['user-agent'],
        },
      );

      return sendSuccess(reply, formatTenantSummary(tenant));
    },
  );

  // -------------------------------------------------------------------------
  // POST /admin/tenants/:id/archive — SUSPENDED -> ARCHIVED (PLATFORM_ADMIN)
  // ARCHIVED is irrecoverable from UI (BR-PLT-003)
  // -------------------------------------------------------------------------
  fastify.post<{ Params: { id: string } }>(
    '/admin/tenants/:id/archive',
    {
      preHandler: [adminOnly],
      schema: {
        params: tenantIdParamsSchema,
        response: { 200: successEnvelope(tenantSummarySchema) },
      },
    },
    async (request, reply) => {
      const tenant = await lifecycleService.archiveTenant(
        request.params.id,
        {
          platformUserId: request.platformUserId,
          ipAddress: request.ip ?? 'unknown',
          userAgent: request.headers['user-agent'],
        },
      );

      return sendSuccess(reply, formatTenantSummary(tenant));
    },
  );

  // -------------------------------------------------------------------------
  // PUT /admin/tenants/:id/modules — upsert module overrides (PLATFORM_ADMIN)
  // Source: AC #7, Event Catalog §19 (tenant.modules_changed)
  // -------------------------------------------------------------------------
  fastify.put<{ Params: { id: string } }>(
    '/admin/tenants/:id/modules',
    {
      preHandler: [adminOnly],
      schema: {
        params: tenantIdParamsSchema,
        body: modulesRequestSchema,
        response: { 200: successEnvelope(moduleOverrideListSchema) },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { modules } = request.body as ModulesRequest;

      // Validate tenant exists (6.2)
      const tenant = await prisma.tenant.findUnique({
        where: { id },
        select: { id: true, code: true },
      });

      if (!tenant) {
        throw new NotFoundError('TENANT_NOT_FOUND', 'Tenant not found');
      }

      // Upsert module overrides in a transaction for atomicity (6.3).
      // Track which modules actually changed to avoid spurious webhooks.
      const { overrides, changedModules } = await prisma.$transaction(async (tx) => {
        // Query existing overrides to detect actual changes
        const existing = await tx.tenantModuleOverride.findMany({
          where: {
            tenantId: id,
            moduleKey: { in: modules.map((m) => m.moduleKey) },
          },
          select: { moduleKey: true, enabled: true },
        });
        const existingMap = new Map(existing.map((e) => [e.moduleKey, e.enabled]));

        const results = [];
        const changed: typeof modules = [];

        for (const mod of modules) {
          const upserted = await tx.tenantModuleOverride.upsert({
            where: {
              tenantId_moduleKey: {
                tenantId: id,
                moduleKey: mod.moduleKey,
              },
            },
            update: {
              enabled: mod.enabled,
              reason: mod.reason ?? null,
              changedBy: request.platformUserId,
              changedAt: new Date(),
            },
            create: {
              tenantId: id,
              moduleKey: mod.moduleKey,
              enabled: mod.enabled,
              reason: mod.reason ?? null,
              changedBy: request.platformUserId,
            },
            select: {
              id: true,
              moduleKey: true,
              enabled: true,
              reason: true,
              changedBy: true,
              changedAt: true,
            },
          });
          results.push(upserted);

          // Only mark as changed if this is a new override or the enabled state differs
          const prevEnabled = existingMap.get(mod.moduleKey);
          if (prevEnabled === undefined || prevEnabled !== mod.enabled) {
            changed.push(mod);
          }
        }

        return { overrides: results, changedModules: changed };
      });

      // Audit log (BR-PLT-017)
      try {
        await fastify.platformAudit.log({
          platformUserId: request.platformUserId,
          action: 'tenant.modules_update',
          targetType: 'tenant',
          targetId: id,
          details: {
            modules: modules.map((m) => ({
              moduleKey: m.moduleKey,
              enabled: m.enabled,
            })),
          },
          ipAddress: request.ip ?? 'unknown',
          userAgent: request.headers['user-agent'],
        });
      } catch {
        // Audit failures must not break operations (BR-PLT-017)
      }

      // Push tenant.modules_changed webhook only for actually changed modules (AC #7)
      for (const mod of changedModules) {
        webhookService
          .pushWebhook(tenant.code, 'tenant.modules_changed', {
            tenantId: id,
            moduleKey: mod.moduleKey,
            enabled: mod.enabled,
            changedBy: request.platformUserId,
          })
          .catch(() => {
            // Webhook service already logs failures — this catch prevents unhandled rejection
          });
      }

      return sendSuccess(
        reply,
        overrides.map((o) => ({
          id: o.id,
          moduleKey: o.moduleKey,
          enabled: o.enabled,
          reason: o.reason,
          changedBy: o.changedBy,
          changedAt: o.changedAt.toISOString(),
        })),
      );
    },
  );

  // -------------------------------------------------------------------------
  // PUT /admin/tenants/:id/feature-flags — upsert feature flags (PLATFORM_ADMIN)
  // Source: AC #8, BR-PLT-017
  // -------------------------------------------------------------------------
  fastify.put<{ Params: { id: string } }>(
    '/admin/tenants/:id/feature-flags',
    {
      preHandler: [adminOnly],
      schema: {
        params: tenantIdParamsSchema,
        body: featureFlagsRequestSchema,
        response: { 200: successEnvelope(featureFlagListSchema) },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const { flags } = request.body as FeatureFlagsRequest;

      // Validate tenant exists (6.2)
      const tenant = await prisma.tenant.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!tenant) {
        throw new NotFoundError('TENANT_NOT_FOUND', 'Tenant not found');
      }

      // Upsert feature flags in a transaction for atomicity (6.3)
      const featureFlags = await prisma.$transaction(async (tx) => {
        const results = [];

        for (const flag of flags) {
          const upserted = await tx.tenantFeatureFlag.upsert({
            where: {
              tenantId_featureKey: {
                tenantId: id,
                featureKey: flag.featureKey,
              },
            },
            update: {
              enabled: flag.enabled,
              changedBy: request.platformUserId,
              changedAt: new Date(),
            },
            create: {
              tenantId: id,
              featureKey: flag.featureKey,
              enabled: flag.enabled,
              changedBy: request.platformUserId,
            },
            select: {
              id: true,
              featureKey: true,
              enabled: true,
              changedBy: true,
              changedAt: true,
            },
          });
          results.push(upserted);
        }

        return results;
      });

      // Audit log (BR-PLT-017)
      try {
        await fastify.platformAudit.log({
          platformUserId: request.platformUserId,
          action: 'tenant.feature_flags_update',
          targetType: 'tenant',
          targetId: id,
          details: {
            flags: flags.map((f) => ({
              featureKey: f.featureKey,
              enabled: f.enabled,
            })),
          },
          ipAddress: request.ip ?? 'unknown',
          userAgent: request.headers['user-agent'],
        });
      } catch {
        // Audit failures must not break operations (BR-PLT-017)
      }

      return sendSuccess(
        reply,
        featureFlags.map((f) => ({
          id: f.id,
          featureKey: f.featureKey,
          enabled: f.enabled,
          changedBy: f.changedBy,
          changedAt: f.changedAt.toISOString(),
        })),
      );
    },
  );

  // -------------------------------------------------------------------------
  // POST /admin/tenants/:id/assign-plan — change tenant plan (PLATFORM_ADMIN)
  // Source: AC #2, #6, Event Catalog §19 (tenant.plan_changed), BR-PLT-006
  // Story: E3b.5 Task 2
  // -------------------------------------------------------------------------
  fastify.post<{ Params: { id: string } }>(
    '/admin/tenants/:id/assign-plan',
    {
      preHandler: [adminOnly],
      schema: {
        params: tenantIdParamsSchema,
        body: assignPlanRequestSchema,
        response: { 200: successEnvelope(assignPlanResponseSchema) },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body as AssignPlanRequest;

      // All validation and mutations inside a single transaction to prevent TOCTOU races
      const { tenant, oldPlan, newPlan, wasIdempotent } = await prisma.$transaction(async (tx) => {
        // Validate tenant exists
        const t = await tx.tenant.findUnique({
          where: { id },
          select: {
            id: true,
            code: true,
            planId: true,
            plan: {
              select: {
                id: true,
                code: true,
                displayName: true,
                maxUsers: true,
                maxCompanies: true,
                monthlyAiTokenAllowance: true,
                apiRateLimit: true,
              },
            },
          },
        });

        if (!t) {
          throw new NotFoundError('TENANT_NOT_FOUND', 'Tenant not found');
        }

        // Idempotent: already on this plan — no update needed
        if (t.planId === body.planId) {
          // Still need plan details for the response
          const currentPlan = await tx.plan.findUnique({
            where: { id: body.planId },
            select: {
              id: true, code: true, displayName: true, maxUsers: true,
              maxCompanies: true, monthlyAiTokenAllowance: true,
              apiRateLimit: true, isActive: true, enabledModules: true,
            },
          });
          return { tenant: t, oldPlan: t.plan, newPlan: currentPlan!, wasIdempotent: true };
        }

        // Validate new plan exists and is active (inside transaction to prevent TOCTOU)
        const np = await tx.plan.findUnique({
          where: { id: body.planId },
          select: {
            id: true, code: true, displayName: true, maxUsers: true,
            maxCompanies: true, monthlyAiTokenAllowance: true,
            apiRateLimit: true, isActive: true, enabledModules: true,
          },
        });

        if (!np) {
          throw new NotFoundError('PLAN_NOT_FOUND', 'Plan not found');
        }

        if (!np.isActive) {
          throw new AppError(
            'PLAN_INACTIVE',
            'Cannot assign tenant to an inactive plan',
            400,
          );
        }

        // Update tenant planId
        await tx.tenant.update({
          where: { id },
          data: { planId: body.planId },
        });

        // Sync TenantAiQuota.tokenAllowance with new plan's allowance (BR-PLT-006)
        const existingQuota = await tx.tenantAiQuota.findUnique({
          where: { tenantId: id },
          select: { tenantId: true },
        });

        if (existingQuota) {
          await tx.tenantAiQuota.update({
            where: { tenantId: id },
            data: { tokenAllowance: np.monthlyAiTokenAllowance },
          });
        }

        return { tenant: t, oldPlan: t.plan, newPlan: np, wasIdempotent: false };
      });

      const changedAt = new Date();

      // Idempotent: if already on this plan, return no-op response
      if (wasIdempotent) {
        return sendSuccess(reply, {
          tenantId: id,
          oldPlanCode: oldPlan.code,
          newPlanCode: newPlan.code,
          oldPlanLimits: {
            maxUsers: oldPlan.maxUsers,
            maxCompanies: oldPlan.maxCompanies,
            monthlyAiTokenAllowance: oldPlan.monthlyAiTokenAllowance.toString(),
            apiRateLimit: oldPlan.apiRateLimit,
          },
          newPlanLimits: {
            maxUsers: newPlan.maxUsers,
            maxCompanies: newPlan.maxCompanies,
            monthlyAiTokenAllowance: newPlan.monthlyAiTokenAllowance.toString(),
            apiRateLimit: newPlan.apiRateLimit,
          },
          changedAt: changedAt.toISOString(),
        });
      }

      // Push tenant.plan_changed webhook (fire-and-forget, BR-PLT-006)
      webhookService
        .pushWebhook(
          tenant.code,
          'tenant.plan_changed',
          {
            tenantId: id,
            oldPlanCode: oldPlan.code,
            newPlanCode: newPlan.code,
            changedBy: request.platformUserId,
            enabledModules: newPlan.enabledModules,
          },
        )
        .catch(() => {
          // Webhook service already logs failures — this catch prevents unhandled rejection
        });

      // Audit log (BR-PLT-017)
      try {
        await fastify.platformAudit.log({
          platformUserId: request.platformUserId,
          action: 'tenant.plan_changed',
          targetType: 'tenant',
          targetId: id,
          details: {
            oldPlanId: oldPlan.id,
            oldPlanCode: oldPlan.code,
            newPlanId: newPlan.id,
            newPlanCode: newPlan.code,
            reason: body.reason,
          },
          ipAddress: request.ip ?? 'unknown',
          userAgent: request.headers['user-agent'],
        });
      } catch {
        request.log.error('Failed to create audit log for tenant.plan_changed');
      }

      return sendSuccess(reply, {
        tenantId: id,
        oldPlanCode: oldPlan.code,
        newPlanCode: newPlan.code,
        oldPlanLimits: {
          maxUsers: oldPlan.maxUsers,
          maxCompanies: oldPlan.maxCompanies,
          monthlyAiTokenAllowance: oldPlan.monthlyAiTokenAllowance.toString(),
          apiRateLimit: oldPlan.apiRateLimit,
        },
        newPlanLimits: {
          maxUsers: newPlan.maxUsers,
          maxCompanies: newPlan.maxCompanies,
          monthlyAiTokenAllowance: newPlan.monthlyAiTokenAllowance.toString(),
          apiRateLimit: newPlan.apiRateLimit,
        },
        changedAt: changedAt.toISOString(),
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /admin/tenants/:id/billing — billing status (PLATFORM_VIEWER+)
  // Source: AC #3, BR-PLT-004
  // Story: E3b.5 Task 3
  // -------------------------------------------------------------------------
  fastify.get<{ Params: { id: string } }>(
    '/admin/tenants/:id/billing',
    {
      preHandler: [viewerOrAdmin],
      schema: {
        params: tenantIdParamsSchema,
        response: { 200: successEnvelope(billingResponseSchema) },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      // Validate tenant exists
      const tenant = await prisma.tenant.findUnique({
        where: { id },
        select: { id: true, billingStatus: true },
      });

      if (!tenant) {
        throw new NotFoundError('TENANT_NOT_FOUND', 'Tenant not found');
      }

      // Query TenantBilling; create default if none exists.
      // Handles concurrent GET race: if two requests try to create simultaneously,
      // the second will hit P2002 and fall back to findUnique.
      let billing = await prisma.tenantBilling.findUnique({
        where: { tenantId: id },
      });

      if (!billing) {
        try {
          billing = await prisma.tenantBilling.create({
            data: {
              tenantId: id,
              enforcementAction: 'NONE',
              dunningLevel: 0,
              gracePeriodDays: 14,
            },
          });
        } catch (err) {
          // Handle concurrent create race — another request created the record first
          if (
            err instanceof Error &&
            'code' in err &&
            (err as Record<string, unknown>).code === 'P2002'
          ) {
            billing = await prisma.tenantBilling.findUnique({
              where: { tenantId: id },
            });
          }
          if (!billing) throw err;
        }
      }

      return sendSuccess(reply, {
        tenantId: id,
        billingStatus: tenant.billingStatus,
        stripeCustomerId: billing.stripeCustomerId,
        subscriptionStatus: billing.subscriptionStatus,
        currentPeriodEnd: billing.currentPeriodEnd?.toISOString() ?? null,
        gracePeriodDays: billing.gracePeriodDays,
        lastPaymentAt: billing.lastPaymentAt?.toISOString() ?? null,
        dunningLevel: billing.dunningLevel,
        enforcementAction: billing.enforcementAction,
      });
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /admin/tenants/:id/billing/enforcement — change enforcement (PLATFORM_ADMIN)
  // Source: AC #4, #5, BR-PLT-004, State Machine §20.2
  // Story: E3b.5 Task 4
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: { id: string } }>(
    '/admin/tenants/:id/billing/enforcement',
    {
      preHandler: [adminOnly],
      schema: {
        params: tenantIdParamsSchema,
        body: enforcementUpdateSchema,
        response: { 200: successEnvelope(enforcementResponseSchema) },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body as EnforcementUpdateRequest;

      const enforcementAction = ENFORCEMENT_ACTION_MAP[body.enforcementAction];
      if (!enforcementAction) {
        throw new AppError(
          'INVALID_ENFORCEMENT_ACTION',
          `Invalid enforcement action: ${body.enforcementAction}`,
          400,
        );
      }

      const result = await billingEnforcementService.transitionEnforcement(
        id,
        enforcementAction,
        body.reason,
        {
          platformUserId: request.platformUserId,
          ipAddress: request.ip ?? 'unknown',
          userAgent: request.headers['user-agent'],
        },
        body.gracePeriodDays,
      );

      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // GET /admin/tenants/:id/ai/quota — AI quota status (PLATFORM_VIEWER+)
  // Source: AC #1, API Contracts §21.5
  // Story: E3b.5 Task 5
  // -------------------------------------------------------------------------
  fastify.get<{ Params: { id: string } }>(
    '/admin/tenants/:id/ai/quota',
    {
      preHandler: [viewerOrAdmin],
      schema: {
        params: tenantIdParamsSchema,
        response: { 200: successEnvelope(aiQuotaResponseSchema) },
      },
    },
    async (request, reply) => {
      const { id } = request.params;

      // Validate tenant exists and fetch plan code
      const tenant = await prisma.tenant.findUnique({
        where: { id },
        select: {
          id: true,
          plan: { select: { code: true, monthlyAiTokenAllowance: true } },
        },
      });

      if (!tenant) {
        throw new NotFoundError('TENANT_NOT_FOUND', 'Tenant not found');
      }

      // Query TenantAiQuota
      const quota = await prisma.tenantAiQuota.findUnique({
        where: { tenantId: id },
      });

      if (!quota) {
        throw new NotFoundError(
          'AI_QUOTA_NOT_FOUND',
          'AI quota record not found for this tenant',
        );
      }

      const tokenAllowanceNum = Number(quota.tokenAllowance);
      const tokensUsedNum = Number(quota.tokensUsed);
      const quotaPct = tokenAllowanceNum > 0
        ? Math.round((tokensUsedNum / tokenAllowanceNum) * 10000) / 100
        : 0;

      return sendSuccess(reply, {
        tenantId: id,
        planCode: tenant.plan.code,
        tokenAllowance: quota.tokenAllowance.toString(),
        tokensUsed: quota.tokensUsed.toString(),
        quotaPct,
        softLimitPct: quota.softLimitPct,
        hardLimitPct: quota.hardLimitPct,
        burstAllowance: quota.burstAllowance !== null
          ? quota.burstAllowance.toString()
          : null,
        periodStart: quota.periodStart.toISOString(),
        periodEnd: quota.periodEnd.toISOString(),
      });
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /admin/tenants/:id/ai/quota — update AI quota (PLATFORM_ADMIN)
  // Source: AC #1, API Contracts §21.5
  // Story: E3b.5 Task 5
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: { id: string } }>(
    '/admin/tenants/:id/ai/quota',
    {
      preHandler: [adminOnly],
      schema: {
        params: tenantIdParamsSchema,
        body: updateAiQuotaSchema,
        response: { 200: successEnvelope(aiQuotaResponseSchema) },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body as UpdateAiQuotaRequest;

      // Build update data with proper typing (exclude reason)
      const { reason, ...updateFields } = body;
      const updateData: {
        tokenAllowance?: bigint;
        softLimitPct?: number;
        hardLimitPct?: number;
        burstAllowance?: bigint | null;
      } = {};

      if (updateFields.tokenAllowance !== undefined) {
        updateData.tokenAllowance = BigInt(updateFields.tokenAllowance);
      }
      if (updateFields.softLimitPct !== undefined) {
        updateData.softLimitPct = updateFields.softLimitPct;
      }
      if (updateFields.hardLimitPct !== undefined) {
        updateData.hardLimitPct = updateFields.hardLimitPct;
      }
      if (updateFields.burstAllowance !== undefined) {
        updateData.burstAllowance = updateFields.burstAllowance !== null
          ? BigInt(updateFields.burstAllowance)
          : null;
      }

      // All reads + update inside a transaction to prevent TOCTOU race
      const { planCode, updatedQuota } = await prisma.$transaction(async (tx) => {
        // Validate tenant exists and fetch plan code
        const tenant = await tx.tenant.findUnique({
          where: { id },
          select: {
            id: true,
            plan: { select: { code: true } },
          },
        });

        if (!tenant) {
          throw new NotFoundError('TENANT_NOT_FOUND', 'Tenant not found');
        }

        // Validate quota record exists
        const existingQuota = await tx.tenantAiQuota.findUnique({
          where: { tenantId: id },
        });

        if (!existingQuota) {
          throw new NotFoundError(
            'AI_QUOTA_NOT_FOUND',
            'AI quota record not found for this tenant',
          );
        }

        const updated = await tx.tenantAiQuota.update({
          where: { tenantId: id },
          data: updateData,
        });

        return { planCode: tenant.plan.code, updatedQuota: updated };
      });

      // Audit log (BR-PLT-017)
      try {
        await fastify.platformAudit.log({
          platformUserId: request.platformUserId,
          action: 'tenant.ai_quota_updated',
          targetType: 'tenant',
          targetId: id,
          details: {
            changes: updateFields,
            reason,
          },
          ipAddress: request.ip ?? 'unknown',
          userAgent: request.headers['user-agent'],
        });
      } catch {
        request.log.error('Failed to create audit log for tenant.ai_quota_updated');
      }

      const tokenAllowanceNum = Number(updatedQuota.tokenAllowance);
      const tokensUsedNum = Number(updatedQuota.tokensUsed);
      const quotaPct = tokenAllowanceNum > 0
        ? Math.round((tokensUsedNum / tokenAllowanceNum) * 10000) / 100
        : 0;

      return sendSuccess(reply, {
        tenantId: id,
        planCode,
        tokenAllowance: updatedQuota.tokenAllowance.toString(),
        tokensUsed: updatedQuota.tokensUsed.toString(),
        quotaPct,
        softLimitPct: updatedQuota.softLimitPct,
        hardLimitPct: updatedQuota.hardLimitPct,
        burstAllowance: updatedQuota.burstAllowance !== null
          ? updatedQuota.burstAllowance.toString()
          : null,
        periodStart: updatedQuota.periodStart.toISOString(),
        periodEnd: updatedQuota.periodEnd.toISOString(),
      });
    },
  );
}

export const tenantRoutesPlugin = fp(tenantRoutes, {
  name: 'platform-tenant-routes',
  dependencies: ['platform-jwt-verify', 'platform-audit'],
});
