import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { z } from 'zod';

import { getPlatformPrisma } from '../../client.js';
import { serviceTokenGuard } from '../../core/auth/service-token.guard.js';
import { NotFoundError } from '../../core/errors/app-error.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { sendSuccess } from '../../core/utils/response.js';
import {
  tenantIdParams,
  aiCheckRequestSchema,
  aiCheckResponseSchema,
  aiRecordRequestSchema,
  aiRecordResponseSchema,
  aiUsageResponseSchema,
} from './ai.schema.js';

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

async function aiRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // POST /platform/tenants/:tenantId/ai/check (AC #2, #3)
  // Pre-flight quota check before an AI call
  // -------------------------------------------------------------------------
  fastify.post<{
    Params: z.infer<typeof tenantIdParams>;
    Body: z.infer<typeof aiCheckRequestSchema>;
  }>(
    '/platform/tenants/:tenantId/ai/check',
    {
      preHandler: [serviceTokenGuard],
      schema: {
        params: tenantIdParams,
        body: aiCheckRequestSchema,
        response: { 200: successEnvelope(aiCheckResponseSchema) },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.params;
      const { estimatedTokens, featureKey: _featureKey } = request.body;
      const prisma = getPlatformPrisma();

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { plan: true, aiQuota: true },
      });

      if (!tenant) {
        throw new NotFoundError('TENANT_NOT_FOUND', `Tenant ${tenantId} not found`);
      }

      // If no quota record exists, treat as unlimited (allowed)
      if (!tenant.aiQuota) {
        return sendSuccess(reply, {
          allowed: true,
          remainingTokens: Number(tenant.plan.monthlyAiTokenAllowance),
          quotaPct: 0,
          warning: undefined,
        });
      }

      const quota = tenant.aiQuota;
      const tokensUsed = Number(quota.tokensUsed);
      const tokenAllowance = Number(quota.tokenAllowance);

      // ISSUE #15 FIX: When tokenAllowance is zero, treat as hard-limited
      // (a "zero tokens" plan should block AI calls, not allow unlimited)
      const currentPct = tokenAllowance > 0 ? (tokensUsed / tokenAllowance) * 100 : (tokensUsed > 0 ? 100 : 0);
      const projectedPct =
        tokenAllowance > 0
          ? ((tokensUsed + estimatedTokens) / tokenAllowance) * 100
          : (estimatedTokens > 0 ? 100 : 0);

      const remainingTokens = Math.max(0, tokenAllowance - tokensUsed);

      // ISSUE #14 FIX: Use >= not > so exactly 100% is also blocked
      if (projectedPct >= quota.hardLimitPct && tenant.plan.aiHardLimit) {
        return sendSuccess(reply, {
          allowed: false,
          remainingTokens,
          quotaPct: Math.round(currentPct * 100) / 100,
          warning: undefined,
        });
      }

      // Soft limit warning — use projected usage to warn before exceeding
      let warning: string | undefined;
      if (projectedPct >= quota.softLimitPct) {
        warning = `Approaching AI quota limit (${Math.round(projectedPct)}%)`;
      }

      return sendSuccess(reply, {
        allowed: true,
        remainingTokens,
        quotaPct: Math.round(currentPct * 100) / 100,
        warning,
      });
    },
  );

  // -------------------------------------------------------------------------
  // POST /platform/tenants/:tenantId/ai/record (AC #4)
  // Record AI usage after a successful call
  // -------------------------------------------------------------------------
  fastify.post<{
    Params: z.infer<typeof tenantIdParams>;
    Body: z.infer<typeof aiRecordRequestSchema>;
  }>(
    '/platform/tenants/:tenantId/ai/record',
    {
      preHandler: [serviceTokenGuard],
      schema: {
        params: tenantIdParams,
        body: aiRecordRequestSchema,
        response: { 200: successEnvelope(aiRecordResponseSchema) },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.params;
      const body = request.body;
      const prisma = getPlatformPrisma();

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { aiQuota: true },
      });

      if (!tenant) {
        throw new NotFoundError('TENANT_NOT_FOUND', `Tenant ${tenantId} not found`);
      }

      // ISSUE #9 FIX: Handle duplicate requestId (P2002) as idempotent success
      let quotaPct: number;
      try {
        quotaPct = await prisma.$transaction(async (tx) => {
          // Append-only usage record
          await tx.tenantAiUsage.create({
            data: {
              tenantId,
              userId: body.userId,
              featureKey: body.featureKey,
              provider: body.provider,
              model: body.model,
              promptTokens: body.promptTokens,
              completionTokens: body.completionTokens,
              totalTokens: body.totalTokens,
              costEstimate: body.costEstimate,
              requestId: body.requestId,
              isByok: body.isByok,
              latencyMs: body.latencyMs,
              fallbackUsed: body.fallbackUsed,
              fallbackFrom: body.fallbackFrom,
            },
          });

          // ISSUE #8 FIX: Guard against null aiQuota for both BYOK and non-BYOK paths
          if (!tenant.aiQuota) return 0;

          // Atomically increment tokensUsed — skip if BYOK (tenant uses own API key)
          if (!body.isByok) {
            const updated = await tx.tenantAiQuota.update({
              where: { id: tenant.aiQuota.id },
              data: {
                tokensUsed: {
                  increment: body.totalTokens,
                },
              },
            });

            const tokenAllowance = Number(updated.tokenAllowance);
            const pct = tokenAllowance > 0
              ? Math.round((Number(updated.tokensUsed) / tokenAllowance) * 100 * 100) / 100
              : 0;

            // ISSUE #16 FIX: Use post-increment tokensUsed for threshold detection
            // to reduce TOCTOU race window (compute prevPct from the authoritative updated value)
            const prevTokensUsed = Number(updated.tokensUsed) - body.totalTokens;
            const prevPct = tokenAllowance > 0
              ? (prevTokensUsed / tokenAllowance) * 100
              : 0;

            if (prevPct < tenant.aiQuota.softLimitPct && pct >= tenant.aiQuota.softLimitPct) {
              request.log.warn(
                { tenantId, quotaPct: pct, threshold: tenant.aiQuota.softLimitPct },
                'tenant.quota_warning: AI usage crossed soft limit',
              );
            }
            if (prevPct < tenant.aiQuota.hardLimitPct && pct >= tenant.aiQuota.hardLimitPct) {
              request.log.warn(
                { tenantId, quotaPct: pct, threshold: tenant.aiQuota.hardLimitPct },
                'tenant.quota_exceeded: AI usage crossed hard limit',
              );
            }

            return pct;
          }

          // BYOK: compute current quotaPct without incrementing
          const tokenAllowance = Number(tenant.aiQuota.tokenAllowance);
          return tokenAllowance > 0
            ? Math.round((Number(tenant.aiQuota.tokensUsed) / tokenAllowance) * 100 * 100) / 100
            : 0;
        });
      } catch (err) {
        // ISSUE #9 FIX: Prisma P2002 unique constraint violation = duplicate requestId
        // Return idempotent success (the record was already created by a prior attempt)
        const prismaError = err as { code?: string };
        if (prismaError.code === 'P2002') {
          request.log.info(
            { tenantId, requestId: body.requestId },
            'ai/record: duplicate requestId — returning idempotent success',
          );
          // Return current quota percentage from the existing quota record
          const currentPct = tenant.aiQuota
            ? (Number(tenant.aiQuota.tokenAllowance) > 0
              ? Math.round((Number(tenant.aiQuota.tokensUsed) / Number(tenant.aiQuota.tokenAllowance)) * 100 * 100) / 100
              : 0)
            : 0;
          return sendSuccess(reply, {
            recorded: true as const,
            quotaPct: currentPct,
          });
        }
        throw err;
      }

      return sendSuccess(reply, {
        recorded: true as const,
        quotaPct,
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /platform/tenants/:tenantId/ai/usage
  // Current period usage summary
  // -------------------------------------------------------------------------
  fastify.get<{
    Params: z.infer<typeof tenantIdParams>;
  }>(
    '/platform/tenants/:tenantId/ai/usage',
    {
      preHandler: [serviceTokenGuard],
      schema: {
        params: tenantIdParams,
        response: { 200: successEnvelope(aiUsageResponseSchema) },
      },
    },
    async (request, reply) => {
      const { tenantId } = request.params;
      const prisma = getPlatformPrisma();

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { aiQuota: true },
      });

      if (!tenant) {
        throw new NotFoundError('TENANT_NOT_FOUND', `Tenant ${tenantId} not found`);
      }

      if (!tenant.aiQuota) {
        return sendSuccess(reply, {
          period: { start: '', end: '' },
          summary: {
            tokensUsed: 0,
            tokenAllowance: 0,
            quotaPct: 0,
            totalRequests: 0,
            totalCost: 0,
          },
          byFeature: [],
          byProvider: [],
          warnings: [],
        });
      }

      const quota = tenant.aiQuota;
      const periodStart = quota.periodStart;
      const periodEnd = quota.periodEnd;

      // Aggregate usage for current period using Prisma groupBy
      // Use lt (exclusive) for periodEnd to avoid boundary overlap between periods
      // ISSUE #26 FIX: Exclude BYOK records from aggregations so totals are
      // consistent with tokensUsed from TenantAiQuota (which only tracks platform quota)
      const periodWhere = {
        tenantId,
        timestamp: {
          gte: periodStart,
          lt: periodEnd,
        },
        isByok: false,
      };

      const [featureAgg, providerAgg, totalAgg] = await Promise.all([
        prisma.tenantAiUsage.groupBy({
          by: ['featureKey'],
          where: periodWhere,
          _sum: { totalTokens: true, costEstimate: true },
          _count: true,
        }),
        prisma.tenantAiUsage.groupBy({
          by: ['provider'],
          where: periodWhere,
          _sum: { totalTokens: true, costEstimate: true },
          _count: true,
        }),
        prisma.tenantAiUsage.aggregate({
          where: periodWhere,
          _sum: { costEstimate: true },
          _count: true,
        }),
      ]);

      const tokensUsed = Number(quota.tokensUsed);
      const tokenAllowance = Number(quota.tokenAllowance);
      const quotaPct = tokenAllowance > 0
        ? Math.round((tokensUsed / tokenAllowance) * 100 * 100) / 100
        : 0;

      const totalCost = Number(totalAgg._sum.costEstimate ?? 0);
      const totalRequests = totalAgg._count;

      // Build warnings
      const warnings: string[] = [];
      if (quotaPct >= quota.hardLimitPct) {
        warnings.push(`AI quota exceeded (${Math.round(quotaPct)}%)`);
      } else if (quotaPct >= quota.softLimitPct) {
        warnings.push(`Approaching AI quota limit (${Math.round(quotaPct)}%)`);
      }

      return sendSuccess(reply, {
        period: {
          start: periodStart.toISOString(),
          end: periodEnd.toISOString(),
        },
        summary: {
          tokensUsed,
          tokenAllowance,
          quotaPct,
          totalRequests,
          totalCost: Math.round(totalCost * 1_000_000) / 1_000_000,
        },
        byFeature: featureAgg.map((row) => ({
          featureKey: row.featureKey,
          totalTokens: row._sum.totalTokens ?? 0,
          requestCount: row._count,
          totalCost: Math.round(Number(row._sum.costEstimate ?? 0) * 1_000_000) / 1_000_000,
        })),
        byProvider: providerAgg.map((row) => ({
          provider: row.provider,
          totalTokens: row._sum.totalTokens ?? 0,
          requestCount: row._count,
          totalCost: Math.round(Number(row._sum.costEstimate ?? 0) * 1_000_000) / 1_000_000,
        })),
        warnings,
      });
    },
  );
}

export const aiRoutesPlugin = fp(aiRoutes, {
  name: 'platform-ai-routes',
});
