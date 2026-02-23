import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import type { AuditLog } from '@nexa/db';
import { z } from 'zod';

import {
  auditLogQuerySchema,
  auditLogEntityParamsSchema,
  auditLogListResponseSchema,
} from './audit-log.schema.js';
import type { AuditLogQuery, AuditLogEntityParams } from './audit-log.schema.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert Prisma AuditLog records for JSON serialization.
 * Prisma Decimal fields (aiConfidence) are returned as Decimal objects whose
 * toJSON() produces a string. Convert to number to match the API contract.
 */
function serializeAuditRecords(records: AuditLog[]) {
  return records.map((r) => ({
    ...r,
    aiConfidence: r.aiConfidence !== null && r.aiConfidence !== undefined ? Number(r.aiConfidence) : null,
  }));
}

// ---------------------------------------------------------------------------
// Audit log query routes plugin
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
async function auditLogRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /audit-log — filtered, cursor-paginated audit log query
  fastify.get<{ Querystring: AuditLogQuery }>(
    '/audit-log',
    {
      schema: {
        querystring: auditLogQuerySchema,
        response: { 200: auditLogListResponseSchema },
      },
      preHandler: createPermissionGuard('system.audit-log.list', 'view'),
    },
    async (request, reply) => {
      const { entityType, entityId, action, userId, dateFrom, dateTo, cursor, limit } =
        request.query;

      // Build where clause — always scoped by companyId
      const where: {
        companyId: string;
        entityType?: string;
        entityId?: string;
        action?: string;
        userId?: string;
        timestamp?: { gte?: Date; lte?: Date };
      } = {
        companyId: request.companyId,
      };

      if (entityType) where.entityType = entityType;
      if (entityId) where.entityId = entityId;
      if (action) where.action = action;
      if (userId) where.userId = userId;

      if (dateFrom || dateTo) {
        const timestampFilter: { gte?: Date; lte?: Date } = {};
        if (dateFrom) timestampFilter.gte = new Date(dateFrom);
        if (dateTo) timestampFilter.lte = new Date(dateTo);
        where.timestamp = timestampFilter;
      }

      // Transaction ensures count and query see a consistent snapshot.
      // Fetch limit+1 to reliably detect hasMore without an extra query on the last page.
      const [total, rows] = await prisma.$transaction([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: limit + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        }),
      ]);

      const hasMore = rows.length > limit;
      const records = hasMore ? rows.slice(0, limit) : rows;
      const lastRecord = records[records.length - 1];
      const nextCursor = hasMore && lastRecord ? lastRecord.id : null;

      return sendSuccess(reply, serializeAuditRecords(records), {
        cursor: nextCursor,
        hasMore,
        total,
      });
    },
  );

  // GET /audit-log/:entityType/:entityId — full change history for a specific entity
  fastify.get<{ Params: AuditLogEntityParams; Querystring: Pick<AuditLogQuery, 'cursor' | 'limit'> }>(
    '/audit-log/:entityType/:entityId',
    {
      schema: {
        params: auditLogEntityParamsSchema,
        querystring: z.object({
          cursor: z.uuid().optional(),
          limit: z.coerce.number().int().min(1).max(200).default(50),
        }),
        response: { 200: auditLogListResponseSchema },
      },
      preHandler: createPermissionGuard('system.audit-log.list', 'view'),
    },
    async (request, reply) => {
      const { entityType, entityId } = request.params;
      const { cursor, limit } = request.query;

      const where = {
        companyId: request.companyId,
        entityType,
        entityId,
      };

      // Transaction ensures count and query see a consistent snapshot.
      // Fetch limit+1 to reliably detect hasMore.
      const [total, rows] = await prisma.$transaction([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
          where,
          orderBy: { timestamp: 'asc' }, // Chronological order for entity history
          take: limit + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        }),
      ]);

      const hasMore = rows.length > limit;
      const records = hasMore ? rows.slice(0, limit) : rows;
      const lastRec = records[records.length - 1];
      const nextCursor = hasMore && lastRec ? lastRec.id : null;

      return sendSuccess(reply, serializeAuditRecords(records), {
        cursor: nextCursor,
        hasMore,
        total,
      });
    },
  );
}

export const auditLogRoutesPlugin = auditLogRoutes;
