// ---------------------------------------------------------------------------
// Admin AI Usage Routes — Cross-tenant usage dashboard, per-tenant usage,
// feature breakdown, and CSV export
// Source: API Contracts §21.5, FR207, FR210
// Story: E13b.4 Task 1
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { getPlatformPrisma } from '../../client.js';
import { Prisma } from '../../../generated/platform-prisma/client.js';
import { requirePlatformRole } from '../../core/auth/platform-role.guard.js';
import { AppError, NotFoundError } from '../../core/errors/app-error.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { encryptApiKey, getEncryptionKey } from '../../core/utils/encryption.js';
import { sendSuccess } from '../../core/utils/response.js';
import { SpikeDetectionService } from '../../services/spike-detection.service.js';
import {
  tenantIdParamsSchema,
  alertIdParamsSchema,
  providerIdParamsSchema,
  tenantProviderParamsSchema,
  aiExportQuerySchema,
  aiAlertsQuerySchema,
  updateProviderKeyBodySchema,
  addByokKeyBodySchema,
  toggleActiveBodySchema,
  aiUsageSummaryResponseSchema,
  aiTenantUsageResponseSchema,
  aiUsageByFeatureResponseSchema,
  aiAlertsResponseSchema,
  aiAlertAcknowledgeResponseSchema,
  spikeDetectionBodySchema,
  spikeDetectionResponseSchema,
  aiProvidersResponseSchema,
  updateProviderKeyResponseSchema,
  toggleProviderResponseSchema,
  tenantByokResponseSchema,
  addByokKeyResponseSchema,
  deleteByokKeyResponseSchema,
  toggleByokKeyResponseSchema,
  type TenantIdParams,
  type AlertIdParams,
  type ProviderIdParams,
  type TenantProviderParams,
  type AiAlertsQuery,
  type AiExportQuery,
  type SpikeDetectionBody,
  type UpdateProviderKeyBody,
  type AddByokKeyBody,
  type ToggleActiveBody,
} from './ai.schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Start of today (midnight UTC) */
function startOfTodayUTC(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Start of current month (1st day, midnight UTC) */
function startOfMonthUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Format a number as a GBP cost string with 6 decimal places */
function formatCost(value: number | null | undefined): string {
  return (value ?? 0).toFixed(6);
}

/** Format a date as YYYY-MM-DD */
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

async function adminAiRoutes(fastify: FastifyInstance): Promise<void> {
  const viewerOrAdmin = requirePlatformRole('PLATFORM_ADMIN', 'PLATFORM_VIEWER');
  const adminOnly = requirePlatformRole('PLATFORM_ADMIN');

  // -------------------------------------------------------------------------
  // GET /admin/ai/usage/summary (AC #1)
  // Cross-tenant aggregate: total tokens today, this month, cost, trend, top consumers
  // -------------------------------------------------------------------------
  fastify.get(
    '/admin/ai/usage/summary',
    {
      preHandler: [viewerOrAdmin],
      schema: {
        response: { 200: successEnvelope(aiUsageSummaryResponseSchema) },
      },
    },
    async (_request, reply) => {
      const prisma = getPlatformPrisma();
      const todayStart = startOfTodayUTC();
      const monthStart = startOfMonthUTC();
      const now = new Date();

      // 30-day trend start
      const trendStart = new Date(todayStart);
      trendStart.setUTCDate(trendStart.getUTCDate() - 29);

      const [todayAgg, monthAgg, dailyTrendRaw, topConsumersRaw] = await Promise.all([
        // Today's total tokens + cost
        prisma.tenantAiUsage.aggregate({
          where: { timestamp: { gte: todayStart, lt: now } },
          _sum: { totalTokens: true, costEstimate: true },
        }),
        // This month's total tokens + cost
        prisma.tenantAiUsage.aggregate({
          where: { timestamp: { gte: monthStart, lt: now } },
          _sum: { totalTokens: true, costEstimate: true },
        }),
        // Daily trend (30 days) — raw SQL for date grouping
        prisma.$queryRaw<Array<{ day: string | Date; tokens: bigint; cost: string }>>(
          Prisma.sql`SELECT DATE(timestamp AT TIME ZONE 'UTC') AS day,
                  SUM(total_tokens)::bigint AS tokens,
                  SUM(cost_estimate)::text AS cost
             FROM tenant_ai_usage
            WHERE timestamp >= ${trendStart}
            GROUP BY day
            ORDER BY day ASC`,
        ),
        // Top 10 consumers this month
        prisma.tenantAiUsage.groupBy({
          by: ['tenantId'],
          where: { timestamp: { gte: monthStart, lt: now } },
          _sum: { totalTokens: true },
          orderBy: { _sum: { totalTokens: 'desc' } },
          take: 10,
        }),
      ]);

      // Resolve tenant names for top consumers
      const tenantIds = topConsumersRaw.map((r) => r.tenantId);
      const tenants =
        tenantIds.length > 0
          ? await prisma.tenant.findMany({
              where: { id: { in: tenantIds } },
              select: { id: true, code: true, displayName: true },
            })
          : [];
      const tenantMap = new Map(tenants.map((t) => [t.id, t]));

      const topConsumers = topConsumersRaw.map((row) => {
        const tenant = tenantMap.get(row.tenantId);
        return {
          tenantId: row.tenantId,
          tenantCode: tenant?.code ?? 'unknown',
          tenantName: tenant?.displayName ?? 'Unknown Tenant',
          tokens: row._sum.totalTokens ?? 0,
        };
      });

      // Build daily trend array (fill missing days with 0)
      // Normalize day key: PostgreSQL DATE() may return Date object or various string formats
      const dailyTrendMap = new Map(
        dailyTrendRaw.map((r) => {
          const dayKey = r.day instanceof Date ? formatDate(r.day) : String(r.day).slice(0, 10);
          return [dayKey, { tokens: Number(r.tokens), cost: r.cost }];
        }),
      );
      const dailyTrend: Array<{ date: string; tokens: number; cost: string }> = [];
      const cursor = new Date(trendStart);
      while (cursor <= todayStart) {
        const key = formatDate(cursor);
        const entry = dailyTrendMap.get(key);
        dailyTrend.push({
          date: key,
          tokens: entry?.tokens ?? 0,
          cost: entry ? parseFloat(entry.cost).toFixed(6) : '0.000000',
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }

      return sendSuccess(reply, {
        tokensToday: todayAgg._sum.totalTokens ?? 0,
        tokensThisMonth: monthAgg._sum.totalTokens ?? 0,
        costEstimateToday: formatCost(Number(todayAgg._sum.costEstimate ?? 0)),
        costEstimateThisMonth: formatCost(Number(monthAgg._sum.costEstimate ?? 0)),
        dailyTrend,
        topConsumers,
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /admin/tenants/:id/ai/usage (AC #2)
  // Per-tenant usage dashboard: tokens today, this month, cost, 30-day trend,
  // by-provider breakdown, BYOK split
  // -------------------------------------------------------------------------
  fastify.get<{ Params: TenantIdParams }>(
    '/admin/tenants/:id/ai/usage',
    {
      preHandler: [viewerOrAdmin],
      schema: {
        params: tenantIdParamsSchema,
        response: { 200: successEnvelope(aiTenantUsageResponseSchema) },
      },
    },
    async (request, reply) => {
      const { id: tenantId } = request.params;
      const prisma = getPlatformPrisma();

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        throw new NotFoundError('TENANT_NOT_FOUND', `Tenant ${tenantId} not found`);
      }

      const todayStart = startOfTodayUTC();
      const monthStart = startOfMonthUTC();
      const now = new Date();

      const trendStart = new Date(todayStart);
      trendStart.setUTCDate(trendStart.getUTCDate() - 29);

      const [todayAgg, monthAgg, dailyTrendRaw, providerAgg, byokAgg] = await Promise.all([
        prisma.tenantAiUsage.aggregate({
          where: { tenantId, timestamp: { gte: todayStart, lt: now } },
          _sum: { totalTokens: true, costEstimate: true },
        }),
        prisma.tenantAiUsage.aggregate({
          where: { tenantId, timestamp: { gte: monthStart, lt: now } },
          _sum: { totalTokens: true, costEstimate: true },
        }),
        prisma.$queryRaw<Array<{ day: string | Date; tokens: bigint; cost: string }>>(
          Prisma.sql`SELECT DATE(timestamp AT TIME ZONE 'UTC') AS day,
                  SUM(total_tokens)::bigint AS tokens,
                  SUM(cost_estimate)::text AS cost
             FROM tenant_ai_usage
            WHERE tenant_id = ${tenantId} AND timestamp >= ${trendStart}
            GROUP BY day
            ORDER BY day ASC`,
        ),
        prisma.tenantAiUsage.groupBy({
          by: ['provider'],
          where: { tenantId, timestamp: { gte: monthStart, lt: now } },
          _sum: { totalTokens: true },
        }),
        prisma.tenantAiUsage.groupBy({
          by: ['isByok'],
          where: { tenantId, timestamp: { gte: monthStart, lt: now } },
          _sum: { totalTokens: true },
        }),
      ]);

      // Provider breakdown with percentages
      const totalProviderTokens = providerAgg.reduce(
        (sum, r) => sum + (r._sum.totalTokens ?? 0),
        0,
      );
      const byProvider = providerAgg.map((row) => ({
        provider: row.provider,
        tokens: row._sum.totalTokens ?? 0,
        pct:
          totalProviderTokens > 0
            ? Math.round(((row._sum.totalTokens ?? 0) / totalProviderTokens) * 100 * 100) / 100
            : 0,
      }));

      // BYOK split
      const byokRow = byokAgg.find((r) => r.isByok === true);
      const vendorRow = byokAgg.find((r) => r.isByok === false);
      const byokTokens = byokRow?._sum.totalTokens ?? 0;
      const vendorTokens = vendorRow?._sum.totalTokens ?? 0;
      const totalByokSplit = byokTokens + vendorTokens;

      // Daily trend — normalize day key for consistent Map lookups
      const dailyTrendMap = new Map(
        dailyTrendRaw.map((r) => {
          const dayKey = r.day instanceof Date ? formatDate(r.day) : String(r.day).slice(0, 10);
          return [dayKey, { tokens: Number(r.tokens), cost: r.cost }];
        }),
      );
      const dailyTrend: Array<{ date: string; tokens: number; cost: string }> = [];
      const cursor = new Date(trendStart);
      while (cursor <= todayStart) {
        const key = formatDate(cursor);
        const entry = dailyTrendMap.get(key);
        dailyTrend.push({
          date: key,
          tokens: entry?.tokens ?? 0,
          cost: entry ? parseFloat(entry.cost).toFixed(6) : '0.000000',
        });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }

      return sendSuccess(reply, {
        tokensToday: todayAgg._sum.totalTokens ?? 0,
        tokensThisMonth: monthAgg._sum.totalTokens ?? 0,
        costEstimate: formatCost(Number(monthAgg._sum.costEstimate ?? 0)),
        dailyTrend,
        byProvider,
        byokSplit: {
          byokTokens,
          vendorTokens,
          byokPct:
            totalByokSplit > 0 ? Math.round((byokTokens / totalByokSplit) * 100 * 100) / 100 : 0,
        },
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /admin/tenants/:id/ai/usage/by-feature (AC #2)
  // Usage breakdown by featureKey for current billing period
  // -------------------------------------------------------------------------
  fastify.get<{ Params: TenantIdParams }>(
    '/admin/tenants/:id/ai/usage/by-feature',
    {
      preHandler: [viewerOrAdmin],
      schema: {
        params: tenantIdParamsSchema,
        response: { 200: successEnvelope(aiUsageByFeatureResponseSchema) },
      },
    },
    async (request, reply) => {
      const { id: tenantId } = request.params;
      const prisma = getPlatformPrisma();

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        throw new NotFoundError('TENANT_NOT_FOUND', `Tenant ${tenantId} not found`);
      }

      const monthStart = startOfMonthUTC();
      const now = new Date();

      const featureAgg = await prisma.tenantAiUsage.groupBy({
        by: ['featureKey'],
        where: { tenantId, timestamp: { gte: monthStart, lt: now } },
        _sum: { totalTokens: true },
        _count: true,
      });

      const totalTokens = featureAgg.reduce((sum, r) => sum + (r._sum.totalTokens ?? 0), 0);

      const features = featureAgg.map((row) => ({
        featureKey: row.featureKey,
        tokens: row._sum.totalTokens ?? 0,
        pct:
          totalTokens > 0
            ? Math.round(((row._sum.totalTokens ?? 0) / totalTokens) * 100 * 100) / 100
            : 0,
        calls: row._count,
      }));

      return sendSuccess(reply, { features });
    },
  );

  // -------------------------------------------------------------------------
  // GET /admin/ai/usage/export (AC #5)
  // CSV export of per-tenant, per-day usage data for a date range
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: AiExportQuery }>(
    '/admin/ai/usage/export',
    {
      preHandler: [adminOnly],
      schema: {
        querystring: aiExportQuerySchema,
      },
      config: {
        audit: {
          action: 'ai.usage.exported',
          targetType: 'ai_usage',
        },
      },
    },
    async (request, reply) => {
      const { startDate, endDate } = request.query;
      const prisma = getPlatformPrisma();

      const start = new Date(startDate + 'T00:00:00.000Z');
      const end = new Date(endDate + 'T23:59:59.999Z');

      // Validate date range — max 90 days to prevent unbounded memory usage
      const MAX_EXPORT_DAYS = 90;
      const MAX_EXPORT_ROWS = 50_000;
      if (start > end) {
        throw new AppError('INVALID_DATE_RANGE', 'startDate must be before endDate', 400);
      }
      const rangeDays = Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
      if (rangeDays > MAX_EXPORT_DAYS) {
        throw new AppError(
          'DATE_RANGE_TOO_LARGE',
          `Export date range cannot exceed ${MAX_EXPORT_DAYS} days`,
          400,
        );
      }

      // Raw SQL for efficient date-grouped export with tenant details
      const rows = await prisma.$queryRaw<
        Array<{
          day: string | Date;
          tenant_code: string;
          tenant_name: string;
          feature_key: string;
          total_tokens: bigint;
          cost_estimate: string;
          is_byok: boolean;
        }>
      >(
        Prisma.sql`SELECT DATE(u.timestamp AT TIME ZONE 'UTC') AS day,
                t.code AS tenant_code,
                t.display_name AS tenant_name,
                u.feature_key,
                SUM(u.total_tokens)::bigint AS total_tokens,
                SUM(u.cost_estimate)::text AS cost_estimate,
                u.is_byok
           FROM tenant_ai_usage u
           JOIN tenants t ON t.id = u.tenant_id
          WHERE u.timestamp >= ${start} AND u.timestamp <= ${end}
          GROUP BY day, t.code, t.display_name, u.feature_key, u.is_byok
          ORDER BY day ASC, tenant_code ASC, feature_key ASC
          LIMIT ${MAX_EXPORT_ROWS + 1}`,
      );

      if (rows.length > MAX_EXPORT_ROWS) {
        throw new AppError(
          'EXPORT_TOO_LARGE',
          `Export exceeds ${MAX_EXPORT_ROWS.toLocaleString('en-GB')} rows. Narrow the date range.`,
          400,
        );
      }

      // Escape CSV field: quote if it contains commas, quotes, newlines, or
      // starts with formula characters (=, +, -, @) to prevent CSV injection
      const escapeCsvField = (val: string): string => {
        if (/[,"\r\n]/.test(val) || /^[=+\-@]/.test(val)) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      };

      // Build CSV
      const csvHeader = 'date,tenantCode,tenantName,featureKey,totalTokens,costEstimate,isByok';
      const csvRows = rows.map((row) => {
        // Normalize day: PostgreSQL DATE() may return Date object or string
        const dayStr = row.day instanceof Date ? formatDate(row.day) : String(row.day).slice(0, 10);
        return [
          dayStr,
          escapeCsvField(row.tenant_code),
          escapeCsvField(row.tenant_name),
          escapeCsvField(row.feature_key),
          row.total_tokens.toString(),
          parseFloat(row.cost_estimate).toFixed(6),
          row.is_byok ? 'true' : 'false',
        ].join(',');
      });

      const csv = [csvHeader, ...csvRows].join('\n');

      return reply
        .status(200)
        .header('Content-Type', 'text/csv')
        .header(
          'Content-Disposition',
          `attachment; filename="ai-usage-${startDate}-to-${endDate}.csv"`,
        )
        .send(csv);
    },
  );

  // -------------------------------------------------------------------------
  // GET /admin/ai/alerts (AC #3, #4)
  // List active alerts with optional type and acknowledged filters
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: AiAlertsQuery }>(
    '/admin/ai/alerts',
    {
      preHandler: [viewerOrAdmin],
      schema: {
        querystring: aiAlertsQuerySchema,
        response: { 200: successEnvelope(aiAlertsResponseSchema) },
      },
    },
    async (request, reply) => {
      const prisma = getPlatformPrisma();
      const { type, acknowledged } = request.query;

      const where: Record<string, unknown> = {};
      if (type) where.type = type;
      if (acknowledged !== undefined) where.acknowledged = acknowledged;

      const alerts = await prisma.platformAiAlert.findMany({
        where,
        include: {
          tenant: { select: { code: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });

      const result = alerts.map((alert) => ({
        id: alert.id,
        type: alert.type,
        tenantId: alert.tenantId,
        tenantCode: alert.tenant.code,
        tenantName: alert.tenant.displayName,
        message: alert.message,
        usagePct: alert.usagePct,
        threshold: alert.threshold,
        dailyTokens: alert.dailyTokens !== null ? Number(alert.dailyTokens) : null,
        rollingAvgTokens: alert.rollingAvgTokens !== null ? Number(alert.rollingAvgTokens) : null,
        acknowledged: alert.acknowledged,
        acknowledgedBy: alert.acknowledgedBy,
        acknowledgedAt: alert.acknowledgedAt?.toISOString() ?? null,
        createdAt: alert.createdAt.toISOString(),
      }));

      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // POST /admin/ai/alerts/:id/acknowledge (AC #3, #4)
  // Mark an alert as acknowledged. PLATFORM_ADMIN only.
  // -------------------------------------------------------------------------
  fastify.post<{ Params: AlertIdParams }>(
    '/admin/ai/alerts/:id/acknowledge',
    {
      preHandler: [adminOnly],
      schema: {
        params: alertIdParamsSchema,
        response: { 200: successEnvelope(aiAlertAcknowledgeResponseSchema) },
      },
      config: {
        audit: {
          action: 'ai.alert.acknowledged',
          targetType: 'platform_ai_alert',
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const prisma = getPlatformPrisma();

      const alert = await prisma.platformAiAlert.findUnique({ where: { id } });
      if (!alert) {
        throw new NotFoundError('ALERT_NOT_FOUND', `Alert ${id} not found`);
      }

      const now = new Date();
      const updated = await prisma.platformAiAlert.update({
        where: { id },
        data: {
          acknowledged: true,
          acknowledgedBy: request.platformUserId,
          acknowledgedAt: now,
        },
      });

      return sendSuccess(reply, {
        id: updated.id,
        acknowledged: updated.acknowledged,
        acknowledgedBy: updated.acknowledgedBy!,
        acknowledgedAt: updated.acknowledgedAt!.toISOString(),
      });
    },
  );

  // -------------------------------------------------------------------------
  // POST /admin/ai/spike-detection (AC #4)
  // Trigger daily spike detection — checks each tenant's usage against
  // 3x their rolling 7-day average (BR-PLT-011)
  // -------------------------------------------------------------------------
  fastify.post<{ Body: SpikeDetectionBody }>(
    '/admin/ai/spike-detection',
    {
      preHandler: [adminOnly],
      schema: {
        body: spikeDetectionBodySchema,
        response: { 200: successEnvelope(spikeDetectionResponseSchema) },
      },
      config: {
        audit: {
          action: 'ai.spike_detection.triggered',
          targetType: 'platform_ai_alert',
        },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const targetDate = body.date ? new Date(body.date) : undefined;
      const spikeService = new SpikeDetectionService(getPlatformPrisma(), fastify.log);
      const result = await spikeService.detectSpikes(targetDate);
      return sendSuccess(reply, result);
    },
  );

  // =========================================================================
  // PROVIDER MANAGEMENT ENDPOINTS (E13b.4 Task 3)
  // =========================================================================

  // -------------------------------------------------------------------------
  // GET /admin/ai/providers (AC #6)
  // List vendor-level AI providers with masked key info
  // -------------------------------------------------------------------------
  fastify.get(
    '/admin/ai/providers',
    {
      preHandler: [viewerOrAdmin],
      schema: {
        response: { 200: successEnvelope(aiProvidersResponseSchema) },
      },
    },
    async (_request, reply) => {
      const prisma = getPlatformPrisma();

      const providers = await prisma.vendorProviderCredential.findMany({
        orderBy: { displayName: 'asc' },
      });

      const result = providers.map((p) => ({
        providerId: p.providerId,
        displayName: p.displayName,
        isActive: p.isActive,
        hasApiKey: p.encryptedKey !== '' && p.encryptedKey.length > 0,
        lastUsedAt: p.lastUsedAt?.toISOString() ?? null,
      }));

      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // PUT /admin/ai/providers/:providerId/key (AC #6)
  // Update vendor-level API key — encrypts with AES-256 before storage
  // -------------------------------------------------------------------------
  fastify.put<{ Params: ProviderIdParams; Body: UpdateProviderKeyBody }>(
    '/admin/ai/providers/:providerId/key',
    {
      preHandler: [adminOnly],
      schema: {
        params: providerIdParamsSchema,
        body: updateProviderKeyBodySchema,
        response: { 200: successEnvelope(updateProviderKeyResponseSchema) },
      },
      config: {
        audit: {
          action: 'ai.provider.key_updated',
          targetType: 'vendor_provider_credential',
        },
      },
    },
    async (request, reply) => {
      const { providerId } = request.params;
      const { apiKey } = request.body;
      const prisma = getPlatformPrisma();

      const provider = await prisma.vendorProviderCredential.findUnique({
        where: { providerId },
      });
      if (!provider) {
        throw new NotFoundError('PROVIDER_NOT_FOUND', `Provider ${providerId} not found`);
      }

      const encryptionKey = getEncryptionKey();
      const encryptedKey = encryptApiKey(apiKey, encryptionKey);

      const updated = await prisma.vendorProviderCredential.update({
        where: { providerId },
        data: { encryptedKey },
      });

      return sendSuccess(reply, {
        success: true as const,
        providerId: updated.providerId,
        updatedAt: updated.updatedAt.toISOString(),
      });
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /admin/ai/providers/:providerId (AC #6)
  // Toggle active/inactive status for a vendor provider
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: ProviderIdParams; Body: ToggleActiveBody }>(
    '/admin/ai/providers/:providerId',
    {
      preHandler: [adminOnly],
      schema: {
        params: providerIdParamsSchema,
        body: toggleActiveBodySchema,
        response: { 200: successEnvelope(toggleProviderResponseSchema) },
      },
      config: {
        audit: {
          action: 'ai.provider.toggled',
          targetType: 'vendor_provider_credential',
        },
      },
    },
    async (request, reply) => {
      const { providerId } = request.params;
      const { isActive } = request.body;
      const prisma = getPlatformPrisma();

      const provider = await prisma.vendorProviderCredential.findUnique({
        where: { providerId },
      });
      if (!provider) {
        throw new NotFoundError('PROVIDER_NOT_FOUND', `Provider ${providerId} not found`);
      }

      const updated = await prisma.vendorProviderCredential.update({
        where: { providerId },
        data: { isActive },
      });

      return sendSuccess(reply, {
        providerId: updated.providerId,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt.toISOString(),
      });
    },
  );

  // =========================================================================
  // BYOK MANAGEMENT ENDPOINTS (E13b.4 Task 3)
  // =========================================================================

  // -------------------------------------------------------------------------
  // GET /admin/tenants/:id/ai/byok (AC #7)
  // List BYOK keys for an Enterprise tenant
  // -------------------------------------------------------------------------
  fastify.get<{ Params: TenantIdParams }>(
    '/admin/tenants/:id/ai/byok',
    {
      preHandler: [viewerOrAdmin],
      schema: {
        params: tenantIdParamsSchema,
        response: { 200: successEnvelope(tenantByokResponseSchema) },
      },
    },
    async (request, reply) => {
      const { id: tenantId } = request.params;
      const prisma = getPlatformPrisma();

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        throw new NotFoundError('TENANT_NOT_FOUND', `Tenant ${tenantId} not found`);
      }

      const credentials = await prisma.tenantProviderCredential.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
      });

      const result = credentials.map((c) => ({
        providerId: c.providerId,
        isActive: c.isActive,
        createdAt: c.createdAt.toISOString(),
        lastUsedAt: null as string | null, // TenantProviderCredential has no lastUsedAt field
      }));

      return sendSuccess(reply, result);
    },
  );

  // -------------------------------------------------------------------------
  // PUT /admin/tenants/:id/ai/byok/:providerId (AC #7)
  // Add or update a BYOK key for a tenant+provider. Enterprise plan only (FR224).
  // -------------------------------------------------------------------------
  fastify.put<{ Params: TenantProviderParams; Body: AddByokKeyBody }>(
    '/admin/tenants/:id/ai/byok/:providerId',
    {
      preHandler: [adminOnly],
      schema: {
        params: tenantProviderParamsSchema,
        body: addByokKeyBodySchema,
        response: { 200: successEnvelope(addByokKeyResponseSchema) },
      },
      config: {
        audit: {
          action: 'ai.byok.key_updated',
          targetType: 'tenant_provider_credential',
        },
      },
    },
    async (request, reply) => {
      const { id: tenantId, providerId } = request.params;
      const { apiKey } = request.body;
      const prisma = getPlatformPrisma();

      // Validate tenant exists and is on Enterprise plan (FR224)
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { plan: { select: { code: true } } },
      });
      if (!tenant) {
        throw new NotFoundError('TENANT_NOT_FOUND', `Tenant ${tenantId} not found`);
      }
      if (!tenant.plan || tenant.plan.code !== 'enterprise') {
        throw new AppError(
          'BYOK_ENTERPRISE_ONLY',
          'BYOK keys are only available for Enterprise plan tenants (FR224)',
          403,
        );
      }

      const encryptionKey = getEncryptionKey();
      const encryptedKey = encryptApiKey(apiKey, encryptionKey);

      const credential = await prisma.tenantProviderCredential.upsert({
        where: {
          tenantId_providerId: { tenantId, providerId },
        },
        update: { encryptedKey },
        create: {
          tenantId,
          providerId,
          encryptedKey,
          isActive: true,
        },
      });

      return sendSuccess(reply, {
        tenantId: credential.tenantId,
        providerId: credential.providerId,
        isActive: credential.isActive,
        createdAt: credential.createdAt.toISOString(),
      });
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /admin/tenants/:id/ai/byok/:providerId (AC #7)
  // Remove a tenant's BYOK key
  // -------------------------------------------------------------------------
  fastify.delete<{ Params: TenantProviderParams }>(
    '/admin/tenants/:id/ai/byok/:providerId',
    {
      preHandler: [adminOnly],
      schema: {
        params: tenantProviderParamsSchema,
        response: { 200: successEnvelope(deleteByokKeyResponseSchema) },
      },
      config: {
        audit: {
          action: 'ai.byok.key_deleted',
          targetType: 'tenant_provider_credential',
        },
      },
    },
    async (request, reply) => {
      const { id: tenantId, providerId } = request.params;
      const prisma = getPlatformPrisma();

      const credential = await prisma.tenantProviderCredential.findFirst({
        where: { tenantId, providerId },
      });
      if (!credential) {
        throw new NotFoundError(
          'BYOK_KEY_NOT_FOUND',
          `BYOK key for provider ${providerId} not found on tenant ${tenantId}`,
        );
      }

      await prisma.tenantProviderCredential.delete({
        where: { id: credential.id },
      });

      return sendSuccess(reply, {
        tenantId,
        providerId,
        deleted: true as const,
      });
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /admin/tenants/:id/ai/byok/:providerId (AC #7)
  // Toggle active/inactive on a tenant's BYOK key
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: TenantProviderParams; Body: ToggleActiveBody }>(
    '/admin/tenants/:id/ai/byok/:providerId',
    {
      preHandler: [adminOnly],
      schema: {
        params: tenantProviderParamsSchema,
        body: toggleActiveBodySchema,
        response: { 200: successEnvelope(toggleByokKeyResponseSchema) },
      },
      config: {
        audit: {
          action: 'ai.byok.toggled',
          targetType: 'tenant_provider_credential',
        },
      },
    },
    async (request, reply) => {
      const { id: tenantId, providerId } = request.params;
      const { isActive } = request.body;
      const prisma = getPlatformPrisma();

      const credential = await prisma.tenantProviderCredential.findFirst({
        where: { tenantId, providerId },
      });
      if (!credential) {
        throw new NotFoundError(
          'BYOK_KEY_NOT_FOUND',
          `BYOK key for provider ${providerId} not found on tenant ${tenantId}`,
        );
      }

      const updated = await prisma.tenantProviderCredential.update({
        where: { id: credential.id },
        data: { isActive },
      });

      return sendSuccess(reply, {
        tenantId,
        providerId,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt.toISOString(),
      });
    },
  );
}

export const adminAiRoutesPlugin = fp(adminAiRoutes, {
  name: 'admin-ai-routes',
  dependencies: ['platform-jwt-verify', 'platform-audit'],
});
