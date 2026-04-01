import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';

import {
  trialBalanceQuerySchema,
  trialBalanceResponseSchema,
  reportQuerySchema,
  profitAndLossResponseSchema,
  balanceSheetResponseSchema,
  transactionJournalQuerySchema,
  transactionJournalResponseSchema,
  budgetVarianceQuerySchema,
  budgetVarianceResponseSchema,
  glDetailQuerySchema,
  glDetailResponseSchema,
  generalLedgerQuerySchema,
  generalLedgerResponseSchema,
  departmentalPnlQuerySchema,
  departmentalPnlResponseSchema,
} from './reports.schema.js';
import type {
  TrialBalanceQuery,
  ReportQuery,
  TransactionJournalQuery,
  BudgetVarianceQuery,
  GLDetailQuery,
  GeneralLedgerQuery,
  DepartmentalPnlQuery,
} from './reports.schema.js';
import {
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getTransactionJournal,
  getBudgetVariance,
  getGLDetail,
  getGeneralLedger,
  getDepartmentalPnl,
} from './reports.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const trialBalanceEnvelope = successEnvelope(trialBalanceResponseSchema);
const profitAndLossEnvelope = successEnvelope(profitAndLossResponseSchema);
const balanceSheetEnvelope = successEnvelope(balanceSheetResponseSchema);
const transactionJournalEnvelope = successEnvelope(transactionJournalResponseSchema);
const budgetVarianceEnvelope = successEnvelope(budgetVarianceResponseSchema);
const glDetailEnvelope = successEnvelope(glDetailResponseSchema);
const generalLedgerEnvelope = successEnvelope(generalLedgerResponseSchema);
const departmentalPnlEnvelope = successEnvelope(departmentalPnlResponseSchema);

// ---------------------------------------------------------------------------
// Finance Reports routes plugin
// ---------------------------------------------------------------------------

async function reportsRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /reports/trial-balance — trial balance report (AC-1, AC-2)
  fastify.get<{ Querystring: TrialBalanceQuery }>(
    '/reports/trial-balance',
    {
      schema: {
        querystring: trialBalanceQuerySchema,
        response: { 200: trialBalanceEnvelope },
      },
      preHandler: createPermissionGuard('finance.reports', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getTrialBalance(prisma, ctx.companyId, request.query);
      return sendSuccess(reply, result);
    },
  );

  // GET /reports/profit-and-loss — P&L report (S10 AC-1, AC-3, AC-4, AC-6)
  fastify.get<{ Querystring: ReportQuery }>(
    '/reports/profit-and-loss',
    {
      schema: {
        querystring: reportQuerySchema,
        response: { 200: profitAndLossEnvelope },
      },
      preHandler: createPermissionGuard('finance.reports', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getProfitAndLoss(prisma, ctx.companyId, request.query);
      return sendSuccess(reply, result);
    },
  );

  // GET /reports/balance-sheet — Balance Sheet report (S10 AC-2, AC-3, AC-5, AC-6)
  fastify.get<{ Querystring: ReportQuery }>(
    '/reports/balance-sheet',
    {
      schema: {
        querystring: reportQuerySchema,
        response: { 200: balanceSheetEnvelope },
      },
      preHandler: createPermissionGuard('finance.reports', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getBalanceSheet(prisma, ctx.companyId, request.query);
      return sendSuccess(reply, result);
    },
  );

  // GET /reports/transaction-journal — Transaction journal report (E14-S22)
  fastify.get<{ Querystring: TransactionJournalQuery }>(
    '/reports/transaction-journal',
    {
      schema: {
        querystring: transactionJournalQuerySchema,
        response: { 200: transactionJournalEnvelope },
      },
      preHandler: createPermissionGuard('finance.reports', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getTransactionJournal(prisma, ctx.companyId, request.query);
      return sendSuccess(reply, result);
    },
  );

  // GET /reports/budget-variance — Budget variance report (E14-S22)
  fastify.get<{ Querystring: BudgetVarianceQuery }>(
    '/reports/budget-variance',
    {
      schema: {
        querystring: budgetVarianceQuerySchema,
        response: { 200: budgetVarianceEnvelope },
      },
      preHandler: createPermissionGuard('finance.reports', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getBudgetVariance(prisma, ctx.companyId, request.query);
      return sendSuccess(reply, result);
    },
  );

  // GET /reports/gl-detail — GL Detail / Account Activity report (F5-6.1)
  fastify.get<{ Querystring: GLDetailQuery }>(
    '/reports/gl-detail',
    {
      schema: {
        querystring: glDetailQuerySchema,
        response: { 200: glDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.reports', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getGLDetail(prisma, ctx.companyId, request.query);
      return sendSuccess(reply, result);
    },
  );

  // GET /reports/general-ledger — General Ledger report (F5-6.2)
  fastify.get<{ Querystring: GeneralLedgerQuery }>(
    '/reports/general-ledger',
    {
      schema: {
        querystring: generalLedgerQuerySchema,
        response: { 200: generalLedgerEnvelope },
      },
      preHandler: createPermissionGuard('finance.reports', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getGeneralLedger(prisma, ctx.companyId, request.query);
      return sendSuccess(reply, result);
    },
  );

  // GET /reports/departmental-pnl — Departmental P&L report (F5-2.6)
  fastify.get<{ Querystring: DepartmentalPnlQuery }>(
    '/reports/departmental-pnl',
    {
      schema: {
        querystring: departmentalPnlQuerySchema,
        response: { 200: departmentalPnlEnvelope },
      },
      preHandler: createPermissionGuard('finance.reports', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const result = await getDepartmentalPnl(prisma, ctx.companyId, request.query);
      return sendSuccess(reply, result);
    },
  );
}

export const reportsRoutesPlugin = reportsRoutes;
