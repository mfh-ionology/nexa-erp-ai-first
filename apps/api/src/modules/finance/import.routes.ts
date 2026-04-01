import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { prisma } from '@nexa/db';

import {
  accountImportRowSchema,
  journalImportRowSchema,
  budgetImportRowSchema,
  exchangeRateImportRowSchema,
  importResultSchema,
} from './import.schema.js';
import type { ImportResult } from './import.schema.js';
import { parseCsv, processBatch, readUploadedFile } from './import.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// Response envelope
// ---------------------------------------------------------------------------

const _importResultEnvelope = successEnvelope(importResultSchema);

// ---------------------------------------------------------------------------
// Import routes plugin
// ---------------------------------------------------------------------------

async function importRoutes(fastify: FastifyInstance): Promise<void> {
  // Register multipart support for file uploads
  await fastify.register(multipart, {
    limits: { fileSize: 10_000_000 }, // 10 MB
  });

  // ---------------------------------------------------------------------------
  // POST /accounts/import — bulk import chart of accounts from CSV
  // ---------------------------------------------------------------------------

  fastify.post(
    '/accounts/import',
    {
      preHandler: createPermissionGuard('finance.accounts', 'create'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const file = await request.file();
      if (!file) {
        return reply
          .status(400)
          .send({ success: false, error: { code: 'NO_FILE', message: 'No file uploaded' } });
      }

      const buffer = await readUploadedFile(file);
      const rawRows = parseCsv(buffer);

      // Validate and type each row
      const validatedRows: Array<{
        row: number;
        data: ReturnType<typeof accountImportRowSchema.parse>;
      }> = [];
      const errors: ImportResult['errors'] = [];

      for (let i = 0; i < rawRows.length; i++) {
        const parsed = accountImportRowSchema.safeParse(rawRows[i]);
        if (parsed.success) {
          validatedRows.push({ row: i + 2, data: parsed.data });
        } else {
          errors.push({
            row: i + 2,
            message: parsed.error.issues.map((is) => is.message).join('; '),
          });
        }
      }

      // Process valid rows via upsert (create or update if code exists)
      const result = await processBatch(
        prisma,
        ctx.companyId,
        validatedRows,
        async (db, companyId, { data }) => {
          await db.chartOfAccount.upsert({
            where: {
              uq_chart_of_account_company_code: { companyId, code: data.code },
            },
            create: {
              companyId,
              code: data.code,
              name: data.name,
              accountType: data.accountType,
              normalBalance: data.normalBalance,
              isPostable: data.isPostable,
              isActive: true,
              createdBy: ctx.userId,
              updatedBy: ctx.userId,
            },
            update: {
              name: data.name,
              accountType: data.accountType,
              normalBalance: data.normalBalance,
              isPostable: data.isPostable,
              updatedBy: ctx.userId,
            },
          });
        },
      );

      result.errors.push(...errors);
      return sendSuccess(reply, result);
    },
  );

  // ---------------------------------------------------------------------------
  // POST /journals/import — bulk import journal entries from CSV
  // ---------------------------------------------------------------------------

  fastify.post(
    '/journals/import',
    {
      preHandler: createPermissionGuard('finance.journals', 'create'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const file = await request.file();
      if (!file) {
        return reply
          .status(400)
          .send({ success: false, error: { code: 'NO_FILE', message: 'No file uploaded' } });
      }

      const buffer = await readUploadedFile(file);
      const rawRows = parseCsv(buffer);
      const errors: ImportResult['errors'] = [];

      // Validate rows
      const validRows: Array<{
        index: number;
        data: ReturnType<typeof journalImportRowSchema.parse>;
      }> = [];
      for (let i = 0; i < rawRows.length; i++) {
        const parsed = journalImportRowSchema.safeParse(rawRows[i]);
        if (parsed.success) {
          validRows.push({ index: i + 2, data: parsed.data });
        } else {
          errors.push({
            row: i + 2,
            message: parsed.error.issues.map((is) => is.message).join('; '),
          });
        }
      }

      // Group lines by transactionDate + description + reference into journal entries
      const groups = new Map<string, typeof validRows>();
      for (const row of validRows) {
        const key = `${row.data.transactionDate}|${row.data.description}|${row.data.reference ?? ''}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(row);
      }

      let imported = 0;

      // Create one journal entry per group
      for (const [, groupRows] of groups) {
        try {
          const firstLine = groupRows[0].data;

          // Find the financial period for the transaction date
          const period = await prisma.financialPeriod.findFirst({
            where: {
              companyId: ctx.companyId,
              startDate: { lte: new Date(firstLine.transactionDate) },
              endDate: { gte: new Date(firstLine.transactionDate) },
            },
          });

          if (!period) {
            for (const r of groupRows) {
              errors.push({
                row: r.index,
                message: 'No financial period found for transaction date',
              });
            }
            continue;
          }

          // Validate debit/credit balance
          const totalDebit = groupRows.reduce((s, r) => s + r.data.debit, 0);
          const totalCredit = groupRows.reduce((s, r) => s + r.data.credit, 0);
          if (Math.abs(totalDebit - totalCredit) > 0.005) {
            for (const r of groupRows) {
              errors.push({
                row: r.index,
                message: `Journal unbalanced: debit=${totalDebit}, credit=${totalCredit}`,
              });
            }
            continue;
          }

          // Create journal entry with lines
          await prisma.journalEntry.create({
            data: {
              companyId: ctx.companyId,
              entryNumber: `IMP-${Date.now()}-${imported}`,
              transactionDate: new Date(firstLine.transactionDate),
              description: firstLine.description,
              reference: firstLine.reference || null,
              status: 'DRAFT',
              source: 'MANUAL',
              periodId: period.id,
              totalDebit,
              totalCredit,
              createdBy: ctx.userId,
              updatedBy: ctx.userId,
              lines: {
                create: groupRows.map((r, idx) => ({
                  companyId: ctx.companyId,
                  lineNumber: idx + 1,
                  accountCode: r.data.accountCode,
                  description: r.data.description,
                  debit: r.data.debit,
                  credit: r.data.credit,
                })),
              },
            },
          });

          imported++;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          for (const r of groupRows) {
            errors.push({ row: r.index, message });
          }
        }
      }

      return sendSuccess(reply, { imported, skipped: 0, errors });
    },
  );

  // ---------------------------------------------------------------------------
  // POST /budgets/import — import budget lines from CSV
  // ---------------------------------------------------------------------------

  fastify.post(
    '/budgets/import',
    {
      preHandler: createPermissionGuard('finance.budgets', 'create'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const data = await request.file();
      if (!data) {
        return reply
          .status(400)
          .send({ success: false, error: { code: 'NO_FILE', message: 'No file uploaded' } });
      }

      // Read budgetId from multipart fields
      const fields = data.fields;
      let budgetId: string | undefined;
      for (const [key, field] of Object.entries(fields)) {
        if (key === 'budgetId' && field && typeof field === 'object' && 'value' in field) {
          budgetId = (field as { value: string }).value;
        }
      }

      if (!budgetId) {
        return reply
          .status(400)
          .send({
            success: false,
            error: { code: 'MISSING_BUDGET_ID', message: 'budgetId field is required' },
          });
      }

      // Validate budget exists and belongs to company
      const budget = await prisma.budget.findFirst({
        where: { id: budgetId, companyId: ctx.companyId },
        select: { id: true },
      });

      if (!budget) {
        return reply
          .status(404)
          .send({ success: false, error: { code: 'NOT_FOUND', message: 'Budget not found' } });
      }

      const buffer = await readUploadedFile(data);
      const rawRows = parseCsv(buffer);
      const errors: ImportResult['errors'] = [];
      const validRows: Array<{
        index: number;
        data: ReturnType<typeof budgetImportRowSchema.parse>;
      }> = [];

      for (let i = 0; i < rawRows.length; i++) {
        const parsed = budgetImportRowSchema.safeParse(rawRows[i]);
        if (parsed.success) {
          validRows.push({ index: i + 2, data: parsed.data });
        } else {
          errors.push({
            row: i + 2,
            message: parsed.error.issues.map((is) => is.message).join('; '),
          });
        }
      }

      // Process: each row becomes a BudgetLine (upsert by budget+accountCode)
      const result = await processBatch(
        prisma,
        ctx.companyId,
        validRows,
        async (db, companyId, { data: rowData }) => {
          // Validate account exists
          const account = await db.chartOfAccount.findFirst({
            where: { companyId, code: rowData.accountCode },
            select: { id: true },
          });
          if (!account) {
            throw new Error(`Account ${rowData.accountCode} not found`);
          }

          const totalAmount =
            rowData.period1 +
            rowData.period2 +
            rowData.period3 +
            rowData.period4 +
            rowData.period5 +
            rowData.period6 +
            rowData.period7 +
            rowData.period8 +
            rowData.period9 +
            rowData.period10 +
            rowData.period11 +
            rowData.period12;

          await db.budgetLine.upsert({
            where: {
              uq_budget_line_budget_account: {
                budgetId: budgetId!,
                accountCode: rowData.accountCode,
              },
            },
            create: {
              budgetId: budgetId!,
              companyId,
              accountCode: rowData.accountCode,
              period1: rowData.period1,
              period2: rowData.period2,
              period3: rowData.period3,
              period4: rowData.period4,
              period5: rowData.period5,
              period6: rowData.period6,
              period7: rowData.period7,
              period8: rowData.period8,
              period9: rowData.period9,
              period10: rowData.period10,
              period11: rowData.period11,
              period12: rowData.period12,
              totalAmount,
            },
            update: {
              period1: rowData.period1,
              period2: rowData.period2,
              period3: rowData.period3,
              period4: rowData.period4,
              period5: rowData.period5,
              period6: rowData.period6,
              period7: rowData.period7,
              period8: rowData.period8,
              period9: rowData.period9,
              period10: rowData.period10,
              period11: rowData.period11,
              period12: rowData.period12,
              totalAmount,
            },
          });
        },
      );

      result.errors.push(...errors);
      return sendSuccess(reply, result);
    },
  );

  // ---------------------------------------------------------------------------
  // POST /exchange-rates/import — import historical exchange rates from CSV
  // ---------------------------------------------------------------------------

  fastify.post(
    '/exchange-rates/import',
    {
      preHandler: createPermissionGuard('finance.exchangeRates', 'create'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const file = await request.file();
      if (!file) {
        return reply
          .status(400)
          .send({ success: false, error: { code: 'NO_FILE', message: 'No file uploaded' } });
      }

      const buffer = await readUploadedFile(file);
      const rawRows = parseCsv(buffer);
      const errors: ImportResult['errors'] = [];
      const validRows: Array<{
        index: number;
        data: ReturnType<typeof exchangeRateImportRowSchema.parse>;
      }> = [];

      for (let i = 0; i < rawRows.length; i++) {
        const parsed = exchangeRateImportRowSchema.safeParse(rawRows[i]);
        if (parsed.success) {
          validRows.push({ index: i + 2, data: parsed.data });
        } else {
          errors.push({
            row: i + 2,
            message: parsed.error.issues.map((is) => is.message).join('; '),
          });
        }
      }

      // Process: upsert exchange rates by company+currency+date
      const result = await processBatch(
        prisma,
        ctx.companyId,
        validRows,
        async (db, companyId, { data: rowData }) => {
          // Validate source is a valid ExchangeRateSource enum value
          const validSources = ['BOE', 'ECB', 'MANUAL'];
          const source = validSources.includes(rowData.source) ? rowData.source : 'MANUAL';

          await db.exchangeRate.upsert({
            where: {
              uq_exchange_rates_company_currency_date: {
                companyId,
                currencyCode: rowData.currencyCode,
                rateDate: new Date(rowData.rateDate),
              },
            },
            create: {
              companyId,
              currencyCode: rowData.currencyCode,
              rateDate: new Date(rowData.rateDate),
              buyRate: rowData.buyRate,
              sellRate: rowData.sellRate,
              midRate: rowData.midRate,
              source: source as 'BOE' | 'ECB' | 'MANUAL',
            },
            update: {
              buyRate: rowData.buyRate,
              sellRate: rowData.sellRate,
              midRate: rowData.midRate,
              source: source as 'BOE' | 'ECB' | 'MANUAL',
            },
          });
        },
      );

      result.errors.push(...errors);
      return sendSuccess(reply, result);
    },
  );
}

export const importRoutesPlugin = importRoutes;
