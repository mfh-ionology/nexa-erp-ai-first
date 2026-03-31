import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { z } from 'zod';

import {
  createExchangeRateSchema,
  fetchExchangeRatesSchema,
  listExchangeRatesQuerySchema,
  exchangeRateParamsSchema,
  exchangeRateDetailSchema,
  exchangeRateItemSchema,
  fetchResultSchema,
} from './exchange-rates.schema.js';
import type { ListExchangeRatesQuery } from './exchange-rates.schema.js';
import {
  listExchangeRates,
  getLatestRate,
  createExchangeRate,
  fetchBoeRates,
} from './exchange-rates.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const exchangeRateDetailEnvelope = successEnvelope(exchangeRateDetailSchema);

const exchangeRateListEnvelope = z.object({
  success: z.literal(true),
  data: z.array(exchangeRateItemSchema),
  meta: z
    .object({
      cursor: z.string().nullable().optional(),
      hasMore: z.boolean().optional(),
      total: z.number().optional(),
    })
    .optional(),
});

const fetchResultEnvelope = successEnvelope(fetchResultSchema);

// ---------------------------------------------------------------------------
// Exchange Rate routes plugin
// ---------------------------------------------------------------------------

async function exchangeRatesRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /exchange-rates/fetch — BOE rate fetch stub (AC-3)
  // Registered BEFORE /:currencyCode to avoid path conflict
  fastify.post(
    '/exchange-rates/fetch',
    {
      schema: {
        body: fetchExchangeRatesSchema,
        response: { 200: fetchResultEnvelope },
      },
      preHandler: createPermissionGuard('finance.exchangeRates', 'new'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await fetchBoeRates(
        prisma,
        ctx.companyId,
        request.body as z.infer<typeof fetchExchangeRatesSchema>,
      );
      return sendSuccess(reply, result);
    },
  );

  // GET /exchange-rates/latest/:currencyCode — latest rate for a currency (AC-4)
  fastify.get<{ Params: { currencyCode: string } }>(
    '/exchange-rates/latest/:currencyCode',
    {
      schema: {
        params: exchangeRateParamsSchema,
        response: { 200: exchangeRateDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.exchangeRates', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getLatestRate(prisma, ctx.companyId, request.params.currencyCode);
      return sendSuccess(reply, result);
    },
  );

  // GET /exchange-rates — list rates with filters (AC-1)
  fastify.get<{ Querystring: ListExchangeRatesQuery }>(
    '/exchange-rates',
    {
      schema: {
        querystring: listExchangeRatesQuerySchema,
        response: { 200: exchangeRateListEnvelope },
      },
      preHandler: createPermissionGuard('finance.exchangeRates', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { data, meta } = await listExchangeRates(prisma, ctx.companyId, request.query);
      return sendSuccess(
        reply,
        data,
        meta as { cursor?: string; hasMore?: boolean; total?: number },
      );
    },
  );

  // POST /exchange-rates — create manual rate entry (AC-2)
  fastify.post(
    '/exchange-rates',
    {
      schema: {
        body: createExchangeRateSchema,
        response: { 201: exchangeRateDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.exchangeRates', 'new'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await createExchangeRate(
        prisma,
        ctx.companyId,
        request.body as z.infer<typeof createExchangeRateSchema>,
      );
      return sendSuccess(reply, result, undefined, 201);
    },
  );
}

export const exchangeRatesRoutesPlugin = exchangeRatesRoutes;
