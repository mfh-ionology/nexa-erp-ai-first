import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import {
  createJournalSchema,
  updateJournalSchema,
  listJournalsQuerySchema,
  searchJournalsQuerySchema,
  journalParamsSchema,
  journalDetailSchema,
  journalListItemSchema,
} from './journals.schema.js';
import type { ListJournalsQuery, SearchJournalsQuery } from './journals.schema.js';
import {
  createJournalEntry,
  updateJournalEntry,
  postJournalEntry,
  reverseJournalEntry,
  getJournalEntryById,
  listJournalEntries,
  searchJournalEntries,
} from './journals.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';
import { AppError, DomainError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const journalDetailEnvelope = successEnvelope(journalDetailSchema);

const journalSearchEnvelope = z.object({
  success: z.literal(true),
  data: z.array(journalListItemSchema),
});

// ---------------------------------------------------------------------------
// Journal Entry routes plugin
// ---------------------------------------------------------------------------

async function journalsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /journals/search — text search on entryNumber, description, reference
  // Registered BEFORE /:id to avoid path conflict
  fastify.get<{ Querystring: SearchJournalsQuery }>(
    '/journals/search',
    {
      schema: {
        querystring: searchJournalsQuerySchema,
        response: { 200: journalSearchEnvelope },
      },
      preHandler: createPermissionGuard('finance.journals', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const data = await searchJournalEntries(prisma, ctx.companyId, request.query);
      return sendSuccess(reply, data);
    },
  );

  // GET /journals — list journal entries with filters and pagination (AC-11)
  fastify.get<{ Querystring: ListJournalsQuery }>(
    '/journals',
    {
      schema: {
        querystring: listJournalsQuerySchema,
      },
      preHandler: createPermissionGuard('finance.journals', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { data, meta } = await listJournalEntries(prisma, ctx.companyId, request.query);
      return sendSuccess(
        reply,
        data,
        meta as { cursor?: string; hasMore?: boolean; total?: number },
      );
    },
  );

  // GET /journals/:id — journal entry detail with lines and dimensions
  fastify.get<{ Params: { id: string } }>(
    '/journals/:id',
    {
      schema: {
        params: journalParamsSchema,
        response: { 200: journalDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.journals', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getJournalEntryById(prisma, ctx.companyId, request.params.id);
      return sendSuccess(reply, result);
    },
  );

  // POST /journals — create a draft journal entry (AC-1)
  fastify.post(
    '/journals',
    {
      schema: {
        body: createJournalSchema,
        response: { 201: journalDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.journals', 'new'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createJournalEntry(
        prisma,
        request.server.eventBus,
        ctx.companyId,
        request.body as z.infer<typeof createJournalSchema>,
        ctx.userId,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );

  // PATCH /journals/:id — update a draft journal entry (AC-2, AC-9)
  fastify.patch<{ Params: { id: string } }>(
    '/journals/:id',
    {
      schema: {
        params: journalParamsSchema,
        body: updateJournalSchema,
        response: { 200: journalDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.journals', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      try {
        const result = await updateJournalEntry(
          prisma,
          request.server.eventBus,
          ctx.companyId,
          request.params.id,
          request.body as z.infer<typeof updateJournalSchema>,
          ctx.userId,
        );
        return sendSuccess(reply, result);
      } catch (error) {
        if (error instanceof DomainError && error.code === 'ENTRY_IMMUTABLE') {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );

  // POST /journals/:id/post — post a draft journal entry (AC-3, AC-4, AC-5, AC-6, AC-8, AC-12, AC-13)
  fastify.post<{ Params: { id: string } }>(
    '/journals/:id/post',
    {
      schema: {
        params: journalParamsSchema,
        response: { 200: journalDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.journals', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      try {
        const result = await postJournalEntry(
          prisma,
          request.server.eventBus,
          ctx.companyId,
          request.params.id,
          ctx.userId,
        );
        return sendSuccess(reply, result);
      } catch (error) {
        if (
          error instanceof DomainError &&
          [
            'ENTRY_NOT_BALANCED',
            'PERIOD_NOT_OPEN',
            'INVALID_STATUS_TRANSITION',
            'ACCOUNT_NOT_POSTABLE',
            'CONTROL_ACCOUNT_MANUAL_POST',
            'DIMENSION_REQUIRED',
            'DIMENSION_SINGLE_SELECT',
            'ACCOUNT_INACTIVE',
          ].includes(error.code)
        ) {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );

  // POST /journals/:id/reverse — reverse a posted journal entry (AC-7)
  fastify.post<{ Params: { id: string } }>(
    '/journals/:id/reverse',
    {
      schema: {
        params: journalParamsSchema,
        response: { 200: journalDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.journals', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      try {
        const result = await reverseJournalEntry(
          prisma,
          request.server.eventBus,
          ctx.companyId,
          request.params.id,
          ctx.userId,
        );
        return sendSuccess(reply, result);
      } catch (error) {
        if (
          error instanceof DomainError &&
          ['INVALID_STATUS_TRANSITION', 'PERIOD_NOT_OPEN'].includes(error.code)
        ) {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );
}

export const journalsRoutesPlugin = journalsRoutes;
