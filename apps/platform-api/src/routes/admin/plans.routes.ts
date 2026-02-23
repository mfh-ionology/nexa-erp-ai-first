// ---------------------------------------------------------------------------
// Plan CRUD Routes — Create, list, update subscription plans
// Source: API Contracts §21.4, FR-PLT-xxx, BR-PLT-017
// Story: E3b.5 Task 1
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { getPlatformPrisma } from '../../client.js';
import { requirePlatformRole } from '../../core/auth/platform-role.guard.js';
import { AppError, NotFoundError } from '../../core/errors/app-error.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { sendSuccess } from '../../core/utils/response.js';

import {
  createPlanSchema,
  updatePlanSchema,
  planIdParamsSchema,
  listPlansQuerySchema,
  planResponseSchema,
  planListResponseSchema,
  type CreatePlanInput,
  type UpdatePlanInput,
  type PlanIdParams,
  type ListPlansQuery,
} from './plans.schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a Plan record for API responses — serialises BigInt fields */
function formatPlan(plan: {
  id: string;
  code: string;
  displayName: string;
  maxUsers: number;
  maxCompanies: number;
  monthlyAiTokenAllowance: bigint;
  aiHardLimit: boolean;
  enabledModules: unknown; // Prisma JsonValue — validated as string[] on input
  apiRateLimit: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: plan.id,
    code: plan.code,
    displayName: plan.displayName,
    maxUsers: plan.maxUsers,
    maxCompanies: plan.maxCompanies,
    monthlyAiTokenAllowance: plan.monthlyAiTokenAllowance.toString(),
    aiHardLimit: plan.aiHardLimit,
    enabledModules: plan.enabledModules as string[],
    apiRateLimit: plan.apiRateLimit,
    isActive: plan.isActive,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function plansRoutes(fastify: FastifyInstance): Promise<void> {
  const prisma = getPlatformPrisma();
  const adminOnly = requirePlatformRole('PLATFORM_ADMIN');
  const viewerOrAdmin = requirePlatformRole(
    'PLATFORM_VIEWER',
    'PLATFORM_ADMIN',
  );

  // -------------------------------------------------------------------------
  // GET /admin/plans — list all plans (PLATFORM_VIEWER+)
  // -------------------------------------------------------------------------
  fastify.get(
    '/admin/plans',
    {
      preHandler: [viewerOrAdmin],
      schema: {
        querystring: listPlansQuerySchema,
        response: {
          200: successEnvelope(planListResponseSchema),
        },
      },
    },
    async (request, reply) => {
      const { active } = request.query as ListPlansQuery;

      const where: Record<string, unknown> = {};
      if (active !== undefined) {
        where.isActive = active;
      }

      const plans = await prisma.plan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      return sendSuccess(reply, plans.map(formatPlan));
    },
  );

  // -------------------------------------------------------------------------
  // POST /admin/plans — create a plan (PLATFORM_ADMIN)
  // -------------------------------------------------------------------------
  fastify.post(
    '/admin/plans',
    {
      preHandler: [adminOnly],
      schema: {
        body: createPlanSchema,
        response: { 201: successEnvelope(planResponseSchema) },
      },
    },
    async (request, reply) => {
      const body = request.body as CreatePlanInput;

      let plan;
      try {
        plan = await prisma.plan.create({
          data: {
            code: body.code,
            displayName: body.displayName,
            maxUsers: body.maxUsers,
            maxCompanies: body.maxCompanies,
            monthlyAiTokenAllowance: BigInt(body.monthlyAiTokenAllowance),
            aiHardLimit: body.aiHardLimit,
            enabledModules: body.enabledModules,
            apiRateLimit: body.apiRateLimit,
          },
        });
      } catch (err) {
        // Handle unique constraint violation on code
        if (
          err instanceof Error &&
          'code' in err &&
          (err as Record<string, unknown>).code === 'P2002'
        ) {
          throw new AppError(
            'CONFLICT',
            'A plan with this code already exists',
            409,
          );
        }
        throw err;
      }

      // Audit log (BR-PLT-017)
      try {
        await fastify.platformAudit.log({
          platformUserId: request.platformUserId,
          action: 'plan.created',
          targetType: 'plan',
          targetId: plan.id,
          details: {
            code: plan.code,
            displayName: plan.displayName,
            maxUsers: plan.maxUsers,
            maxCompanies: plan.maxCompanies,
          },
          ipAddress: request.ip ?? 'unknown',
          userAgent: request.headers['user-agent'],
        });
      } catch {
        request.log.error('Failed to create audit log for plan.created');
      }

      return sendSuccess(reply, formatPlan(plan), undefined, 201);
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /admin/plans/:id — update a plan (PLATFORM_ADMIN)
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: PlanIdParams }>(
    '/admin/plans/:id',
    {
      preHandler: [adminOnly],
      schema: {
        params: planIdParamsSchema,
        body: updatePlanSchema,
        response: { 200: successEnvelope(planResponseSchema) },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const body = request.body as UpdatePlanInput;

      // Validate plan exists
      const existing = await prisma.plan.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!existing) {
        throw new NotFoundError('PLAN_NOT_FOUND', 'Plan not found');
      }

      // Build update data with proper typing
      const updateData: {
        displayName?: string;
        maxUsers?: number;
        maxCompanies?: number;
        monthlyAiTokenAllowance?: bigint;
        aiHardLimit?: boolean;
        enabledModules?: string[];
        apiRateLimit?: number;
        isActive?: boolean;
      } = {};
      if (body.displayName !== undefined) updateData.displayName = body.displayName;
      if (body.maxUsers !== undefined) updateData.maxUsers = body.maxUsers;
      if (body.maxCompanies !== undefined) updateData.maxCompanies = body.maxCompanies;
      if (body.monthlyAiTokenAllowance !== undefined) {
        updateData.monthlyAiTokenAllowance = BigInt(body.monthlyAiTokenAllowance);
      }
      if (body.aiHardLimit !== undefined) updateData.aiHardLimit = body.aiHardLimit;
      if (body.enabledModules !== undefined) updateData.enabledModules = body.enabledModules;
      if (body.apiRateLimit !== undefined) updateData.apiRateLimit = body.apiRateLimit;
      if (body.isActive !== undefined) updateData.isActive = body.isActive;

      const plan = await prisma.plan.update({
        where: { id },
        data: updateData,
      });

      // Audit log (BR-PLT-017)
      try {
        await fastify.platformAudit.log({
          platformUserId: request.platformUserId,
          action: 'plan.updated',
          targetType: 'plan',
          targetId: plan.id,
          details: { updatedFields: Object.keys(updateData) },
          ipAddress: request.ip ?? 'unknown',
          userAgent: request.headers['user-agent'],
        });
      } catch {
        request.log.error('Failed to create audit log for plan.updated');
      }

      return sendSuccess(reply, formatPlan(plan));
    },
  );
}

export const plansRoutesPlugin = fp(plansRoutes, {
  name: 'plans-routes',
  dependencies: ['platform-jwt-verify', 'platform-audit'],
});
