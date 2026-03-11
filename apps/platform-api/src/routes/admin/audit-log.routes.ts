// ---------------------------------------------------------------------------
// Audit Log Query Routes — Immutable platform audit log reader
// Source: API Contracts §21.7, FR214, BR-PLT-016 (immutable), BR-PLT-017 (read-only, no audit)
// Story: E13b.6 Task 1.2
// ---------------------------------------------------------------------------

import { PassThrough } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { requirePlatformRole } from '../../core/auth/platform-role.guard.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { sendSuccess } from '../../core/utils/response.js';
import { NotFoundError } from '../../core/errors/app-error.js';
import { getPlatformPrisma } from '../../client.js';

import {
  listAuditLogQuerySchema,
  exportAuditLogQuerySchema,
  auditLogIdParamsSchema,
  auditLogListResponseSchema,
  auditLogDetailSchema,
  type ListAuditLogQuery,
  type ExportAuditLogQuery,
  type AuditLogIdParams,
} from './audit-log.schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Build Prisma where clause from audit log filter params. */
function buildAuditLogWhere(filters: {
  action?: string;
  targetType?: string;
  targetId?: string;
  platformUserId?: string;
  from?: string;
  to?: string;
}): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  if (filters.action) where.action = filters.action;
  if (filters.targetType) where.targetType = filters.targetType;
  if (filters.targetId) where.targetId = filters.targetId;
  if (filters.platformUserId) where.platformUserId = filters.platformUserId;

  if (filters.from || filters.to) {
    const timestampFilter: Record<string, Date> = {};
    if (filters.from) timestampFilter.gte = new Date(filters.from);
    if (filters.to) timestampFilter.lte = new Date(filters.to);
    where.timestamp = timestampFilter;
  }

  return where;
}

function serializeListItem(entry: Record<string, unknown>) {
  const e = entry as {
    id: string;
    platformUser: { id: string; email: string; displayName: string };
    action: string;
    targetType: string | null;
    targetId: string | null;
    ipAddress: string;
    timestamp: Date;
  };
  return {
    id: e.id,
    platformUser: e.platformUser,
    action: e.action,
    targetType: e.targetType,
    targetId: e.targetId,
    ipAddress: e.ipAddress,
    timestamp: e.timestamp.toISOString(),
  };
}

function serializeDetail(entry: Record<string, unknown>) {
  const e = entry as {
    id: string;
    platformUser: { id: string; email: string; displayName: string };
    action: string;
    targetType: string | null;
    targetId: string | null;
    details: unknown;
    ipAddress: string;
    userAgent: string | null;
    timestamp: Date;
    createdAt: Date;
  };
  return {
    id: e.id,
    platformUser: e.platformUser,
    action: e.action,
    targetType: e.targetType,
    targetId: e.targetId,
    details: e.details ?? null,
    ipAddress: e.ipAddress,
    userAgent: e.userAgent,
    timestamp: e.timestamp.toISOString(),
    createdAt: e.createdAt.toISOString(),
  };
}

function formatCsvRow(entry: Record<string, unknown>): string {
  const e = entry as {
    platformUser: { email: string; displayName: string };
    action: string;
    targetType: string | null;
    targetId: string | null;
    details: unknown;
    ipAddress: string;
    userAgent: string | null;
    timestamp: Date;
  };
  return [
    e.timestamp.toISOString(),
    csvEscape(e.platformUser.email),
    csvEscape(e.platformUser.displayName),
    csvEscape(e.action),
    csvEscape(e.targetType ?? ''),
    csvEscape(e.targetId ?? ''),
    csvEscape(e.ipAddress),
    csvEscape(e.userAgent ?? ''),
    csvEscape(e.details != null ? JSON.stringify(e.details) : ''),
  ].join(',');
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

async function auditLogRoutesFn(fastify: FastifyInstance): Promise<void> {
  // -----------------------------------------------------------------------
  // GET /admin/audit-log — List audit log entries with filters + pagination
  // No audit config: read-only route, no state change (BR-PLT-017)
  // -----------------------------------------------------------------------
  fastify.get<{ Querystring: ListAuditLogQuery }>(
    '/admin/audit-log',
    {
      schema: {
        querystring: listAuditLogQuerySchema,
        response: { 200: successEnvelope(auditLogListResponseSchema) },
      },
      preHandler: [requirePlatformRole('PLATFORM_ADMIN', 'PLATFORM_VIEWER')],
    },
    async (request, reply) => {
      const { cursor, limit, ...filters } = request.query;
      const prisma = getPlatformPrisma();
      const where = buildAuditLogWhere(filters);

      const entries = await prisma.platformAuditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit + 1, // Fetch one extra to determine hasMore
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        include: {
          platformUser: {
            select: { id: true, email: true, displayName: true },
          },
        },
      });

      const hasMore = entries.length > limit;
      const page = hasMore ? entries.slice(0, limit) : entries;
      const nextCursor = hasMore && page.length > 0 ? page[page.length - 1]!.id : null;

      return sendSuccess(
        reply,
        page.map((e: Record<string, unknown>) => serializeListItem(e)),
        { cursor: nextCursor, hasMore },
      );
    },
  );

  // -----------------------------------------------------------------------
  // GET /admin/audit-log/export — CSV export of filtered audit log entries
  // Registered BEFORE /:id to avoid path conflict
  // No audit config: read-only route, no state change (BR-PLT-017)
  // -----------------------------------------------------------------------
  fastify.get<{ Querystring: ExportAuditLogQuery }>(
    '/admin/audit-log/export',
    {
      schema: {
        querystring: exportAuditLogQuerySchema,
      },
      preHandler: [requirePlatformRole('PLATFORM_ADMIN', 'PLATFORM_VIEWER')],
    },
    async (request, reply) => {
      const prisma = getPlatformPrisma();
      const where = buildAuditLogWhere(request.query);

      const MAX_EXPORT_ROWS = 10_000;

      const entries = await prisma.platformAuditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: MAX_EXPORT_ROWS,
        include: {
          platformUser: {
            select: { id: true, email: true, displayName: true },
          },
        },
      });

      const truncated = entries.length >= MAX_EXPORT_ROWS;

      const today = new Date().toISOString().slice(0, 10);
      const filename = `platform-audit-log-${today}.csv`;

      void reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', `attachment; filename="${filename}"`);

      if (truncated) {
        void reply.header('X-Truncated', 'true');
        void reply.header('X-Truncated-Limit', String(MAX_EXPORT_ROWS));
      }

      const csvHeader =
        'timestamp,adminEmail,adminName,action,targetType,targetId,ipAddress,userAgent,details';

      const stream = new PassThrough();

      stream.write(csvHeader);
      for (const entry of entries) {
        stream.write('\n' + formatCsvRow(entry as Record<string, unknown>));
      }
      stream.end();

      return reply.send(stream);
    },
  );

  // -----------------------------------------------------------------------
  // GET /admin/audit-log/:id — Single audit log entry detail
  // No audit config: read-only route, no state change (BR-PLT-017)
  // -----------------------------------------------------------------------
  fastify.get<{ Params: AuditLogIdParams }>(
    '/admin/audit-log/:id',
    {
      schema: {
        params: auditLogIdParamsSchema,
        response: { 200: successEnvelope(auditLogDetailSchema) },
      },
      preHandler: [requirePlatformRole('PLATFORM_ADMIN', 'PLATFORM_VIEWER')],
    },
    async (request, reply) => {
      const { id } = request.params;
      const prisma = getPlatformPrisma();

      const entry = await prisma.platformAuditLog.findUnique({
        where: { id },
        include: {
          platformUser: {
            select: { id: true, email: true, displayName: true },
          },
        },
      });

      if (!entry) {
        throw new NotFoundError('AUDIT_LOG_NOT_FOUND', 'Audit log entry not found');
      }

      return sendSuccess(reply, serializeDetail(entry as Record<string, unknown>));
    },
  );
}

export const auditLogRoutesPlugin = fp(auditLogRoutesFn, {
  name: 'audit-log-routes',
});
