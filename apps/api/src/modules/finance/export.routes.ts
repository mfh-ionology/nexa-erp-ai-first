import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';

import { exportQuerySchema } from './export.schema.js';
import { sendExportFile } from './export.service.js';
import type { ExportColumn } from './export.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// Import report query schemas
import {
  trialBalanceQuerySchema,
  reportQuerySchema,
  transactionJournalQuerySchema,
  budgetVarianceQuerySchema,
  glDetailQuerySchema,
  generalLedgerQuerySchema,
  departmentalPnlQuerySchema,
} from './reports.schema.js';

// Import report service functions
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

// ---------------------------------------------------------------------------
// Report Export routes plugin
// ---------------------------------------------------------------------------

async function exportRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // GET /reports/trial-balance/export
  // -------------------------------------------------------------------------
  fastify.get(
    '/reports/trial-balance/export',
    {
      schema: {
        querystring: trialBalanceQuerySchema.merge(exportQuerySchema),
      },
      preHandler: createPermissionGuard('finance.reports', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { format, ...query } = request.query as any;
      const result = await getTrialBalance(prisma, ctx.companyId, query);

      const columns: ExportColumn[] = [
        { header: 'Account Code', key: 'accountCode', width: 15 },
        { header: 'Account Name', key: 'accountName', width: 30 },
        { header: 'Account Type', key: 'accountType', width: 12 },
        { header: 'Opening Balance', key: 'openingBalance', width: 18, format: 'currency' },
        { header: 'Total Debit', key: 'totalDebit', width: 18, format: 'currency' },
        { header: 'Total Credit', key: 'totalCredit', width: 18, format: 'currency' },
        { header: 'Closing Balance', key: 'closingBalance', width: 18, format: 'currency' },
      ];

      await sendExportFile(
        reply,
        format,
        'trial-balance',
        'Trial Balance',
        columns,
        result.accounts,
      );
    },
  );

  // -------------------------------------------------------------------------
  // GET /reports/profit-and-loss/export
  // -------------------------------------------------------------------------
  fastify.get(
    '/reports/profit-and-loss/export',
    {
      schema: {
        querystring: reportQuerySchema.merge(exportQuerySchema),
      },
      preHandler: createPermissionGuard('finance.reports', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { format, ...query } = request.query as any;
      const result = await getProfitAndLoss(prisma, ctx.companyId, query);

      // Flatten sections -> rows
      const columns: ExportColumn[] = [
        { header: 'Section', key: 'classification', width: 20 },
        { header: 'Account Code', key: 'accountCode', width: 15 },
        { header: 'Account Name', key: 'accountName', width: 30 },
        { header: 'Opening Balance', key: 'openingBalance', width: 18, format: 'currency' },
        { header: 'Debits', key: 'debits', width: 18, format: 'currency' },
        { header: 'Credits', key: 'credits', width: 18, format: 'currency' },
        { header: 'Balance', key: 'balance', width: 18, format: 'currency' },
      ];

      const rows: Record<string, unknown>[] = [];
      for (const section of result.sections) {
        for (const account of section.accounts) {
          rows.push({
            classification: section.classification,
            accountCode: account.accountCode,
            accountName: account.accountName,
            openingBalance: account.openingBalance,
            debits: account.debits,
            credits: account.credits,
            balance: account.balance,
          });
        }
      }

      // Add summary rows
      rows.push(
        {
          classification: 'SUMMARY',
          accountCode: '',
          accountName: 'Gross Profit',
          balance: result.grossProfit,
        },
        {
          classification: 'SUMMARY',
          accountCode: '',
          accountName: 'Operating Profit',
          balance: result.operatingProfit,
        },
        {
          classification: 'SUMMARY',
          accountCode: '',
          accountName: 'Profit Before Tax',
          balance: result.profitBeforeTax,
        },
        {
          classification: 'SUMMARY',
          accountCode: '',
          accountName: 'Net Profit',
          balance: result.netProfit,
        },
      );

      await sendExportFile(reply, format, 'profit-and-loss', 'Profit & Loss', columns, rows);
    },
  );

  // -------------------------------------------------------------------------
  // GET /reports/balance-sheet/export
  // -------------------------------------------------------------------------
  fastify.get(
    '/reports/balance-sheet/export',
    {
      schema: {
        querystring: reportQuerySchema.merge(exportQuerySchema),
      },
      preHandler: createPermissionGuard('finance.reports', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { format, ...query } = request.query as any;
      const result = await getBalanceSheet(prisma, ctx.companyId, query);

      const columns: ExportColumn[] = [
        { header: 'Section', key: 'classification', width: 20 },
        { header: 'Account Code', key: 'accountCode', width: 15 },
        { header: 'Account Name', key: 'accountName', width: 30 },
        { header: 'Opening Balance', key: 'openingBalance', width: 18, format: 'currency' },
        { header: 'Debits', key: 'debits', width: 18, format: 'currency' },
        { header: 'Credits', key: 'credits', width: 18, format: 'currency' },
        { header: 'Balance', key: 'balance', width: 18, format: 'currency' },
      ];

      const rows: Record<string, unknown>[] = [];
      for (const section of result.sections) {
        for (const account of section.accounts) {
          rows.push({
            classification: section.classification,
            accountCode: account.accountCode,
            accountName: account.accountName,
            openingBalance: account.openingBalance,
            debits: account.debits,
            credits: account.credits,
            balance: account.balance,
          });
        }
      }

      // Add summary rows
      rows.push(
        {
          classification: 'SUMMARY',
          accountCode: '',
          accountName: 'Total Assets',
          balance: result.totalAssets,
        },
        {
          classification: 'SUMMARY',
          accountCode: '',
          accountName: 'Total Liabilities',
          balance: result.totalLiabilities,
        },
        {
          classification: 'SUMMARY',
          accountCode: '',
          accountName: 'Total Equity',
          balance: result.totalEquity,
        },
      );

      await sendExportFile(reply, format, 'balance-sheet', 'Balance Sheet', columns, rows);
    },
  );

  // -------------------------------------------------------------------------
  // GET /reports/transaction-journal/export
  // -------------------------------------------------------------------------
  fastify.get(
    '/reports/transaction-journal/export',
    {
      schema: {
        querystring: transactionJournalQuerySchema.merge(exportQuerySchema),
      },
      preHandler: createPermissionGuard('finance.reports', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { format, ...query } = request.query as any;
      const result = await getTransactionJournal(prisma, ctx.companyId, query);

      // Flatten entries -> one row per journal line
      const columns: ExportColumn[] = [
        { header: 'Entry Number', key: 'entryNumber', width: 15 },
        { header: 'Date', key: 'transactionDate', width: 12 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Reference', key: 'reference', width: 20 },
        { header: 'Source', key: 'source', width: 15 },
        { header: 'Line #', key: 'lineNumber', width: 8 },
        { header: 'Account Code', key: 'accountCode', width: 15 },
        { header: 'Account Name', key: 'accountName', width: 25 },
        { header: 'Line Description', key: 'lineDescription', width: 25 },
        { header: 'Debit', key: 'debit', width: 15, format: 'currency' },
        { header: 'Credit', key: 'credit', width: 15, format: 'currency' },
      ];

      const rows: Record<string, unknown>[] = [];
      for (const entry of result.entries) {
        for (const line of entry.lines) {
          rows.push({
            entryNumber: entry.entryNumber,
            transactionDate: entry.transactionDate,
            description: entry.description,
            reference: entry.reference ?? '',
            source: entry.source,
            lineNumber: line.lineNumber,
            accountCode: line.accountCode,
            accountName: line.accountName,
            lineDescription: line.description ?? '',
            debit: line.debit,
            credit: line.credit,
          });
        }
      }

      await sendExportFile(
        reply,
        format,
        'transaction-journal',
        'Transaction Journal',
        columns,
        rows,
      );
    },
  );

  // -------------------------------------------------------------------------
  // GET /reports/budget-variance/export
  // -------------------------------------------------------------------------
  fastify.get(
    '/reports/budget-variance/export',
    {
      schema: {
        querystring: budgetVarianceQuerySchema.merge(exportQuerySchema),
      },
      preHandler: createPermissionGuard('finance.reports', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { format, ...query } = request.query as any;
      const result = await getBudgetVariance(prisma, ctx.companyId, query);

      const columns: ExportColumn[] = [
        { header: 'Account Code', key: 'accountCode', width: 15 },
        { header: 'Account Name', key: 'accountName', width: 30 },
        { header: 'Budget Amount', key: 'budgetAmount', width: 18, format: 'currency' },
        { header: 'Actual Amount', key: 'actualAmount', width: 18, format: 'currency' },
        { header: 'Variance', key: 'variance', width: 18, format: 'currency' },
        { header: 'Variance %', key: 'variancePercentage', width: 12, format: 'percentage' },
      ];

      await sendExportFile(
        reply,
        format,
        'budget-variance',
        'Budget Variance',
        columns,
        result.accounts,
      );
    },
  );

  // -------------------------------------------------------------------------
  // GET /reports/gl-detail/export
  // -------------------------------------------------------------------------
  fastify.get(
    '/reports/gl-detail/export',
    {
      schema: {
        querystring: glDetailQuerySchema.merge(exportQuerySchema),
      },
      preHandler: createPermissionGuard('finance.reports', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { format, ...query } = request.query as any;
      const result = await getGLDetail(prisma, ctx.companyId, query);

      const columns: ExportColumn[] = [
        { header: 'Date', key: 'transactionDate', width: 12 },
        { header: 'Entry Number', key: 'entryNumber', width: 15 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Reference', key: 'reference', width: 20 },
        { header: 'Source', key: 'source', width: 15 },
        { header: 'Debit', key: 'debit', width: 15, format: 'currency' },
        { header: 'Credit', key: 'credit', width: 15, format: 'currency' },
        { header: 'Running Balance', key: 'runningBalance', width: 18, format: 'currency' },
      ];

      // Prepend opening balance row
      const rows: Record<string, unknown>[] = [
        {
          transactionDate: '',
          entryNumber: '',
          description: 'Opening Balance',
          reference: '',
          source: '',
          debit: 0,
          credit: 0,
          runningBalance: result.openingBalance,
        },
        ...result.entries.map((e) => ({
          transactionDate: e.transactionDate,
          entryNumber: e.entryNumber,
          description: e.description,
          reference: e.reference ?? '',
          source: e.source,
          debit: e.debit,
          credit: e.credit,
          runningBalance: e.runningBalance,
        })),
      ];

      const filename = `gl-detail-${result.accountCode}`;
      await sendExportFile(
        reply,
        format,
        filename,
        `GL Detail - ${result.accountCode}`,
        columns,
        rows,
      );
    },
  );

  // -------------------------------------------------------------------------
  // GET /reports/general-ledger/export
  // -------------------------------------------------------------------------
  fastify.get(
    '/reports/general-ledger/export',
    {
      schema: {
        querystring: generalLedgerQuerySchema.merge(exportQuerySchema),
      },
      preHandler: createPermissionGuard('finance.reports', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { format, ...query } = request.query as any;
      const result = await getGeneralLedger(prisma, ctx.companyId, query);

      // Flatten: one row per entry line, grouped by account
      const columns: ExportColumn[] = [
        { header: 'Account Code', key: 'accountCode', width: 15 },
        { header: 'Account Name', key: 'accountName', width: 25 },
        { header: 'Account Type', key: 'accountType', width: 12 },
        { header: 'Date', key: 'transactionDate', width: 12 },
        { header: 'Entry Number', key: 'entryNumber', width: 15 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Debit', key: 'debit', width: 15, format: 'currency' },
        { header: 'Credit', key: 'credit', width: 15, format: 'currency' },
        { header: 'Running Balance', key: 'runningBalance', width: 18, format: 'currency' },
      ];

      const rows: Record<string, unknown>[] = [];
      for (const account of result.accounts) {
        // Opening balance row for each account
        rows.push({
          accountCode: account.accountCode,
          accountName: account.accountName,
          accountType: account.accountType,
          transactionDate: '',
          entryNumber: '',
          description: 'Opening Balance',
          debit: 0,
          credit: 0,
          runningBalance: account.openingBalance,
        });

        for (const entry of account.entries) {
          rows.push({
            accountCode: account.accountCode,
            accountName: account.accountName,
            accountType: account.accountType,
            transactionDate: entry.transactionDate,
            entryNumber: entry.entryNumber,
            description: entry.description,
            debit: entry.debit,
            credit: entry.credit,
            runningBalance: entry.runningBalance,
          });
        }
      }

      await sendExportFile(reply, format, 'general-ledger', 'General Ledger', columns, rows);
    },
  );

  // -------------------------------------------------------------------------
  // GET /reports/departmental-pnl/export
  // -------------------------------------------------------------------------
  fastify.get(
    '/reports/departmental-pnl/export',
    {
      schema: {
        querystring: departmentalPnlQuerySchema.merge(exportQuerySchema),
      },
      preHandler: createPermissionGuard('finance.reports', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { format, ...query } = request.query as any;
      const result = await getDepartmentalPnl(prisma, ctx.companyId, query);

      // Dynamic columns: fixed columns + one per dimension value + total
      const columns: ExportColumn[] = [
        { header: 'Section', key: 'classification', width: 20 },
        { header: 'Account Code', key: 'accountCode', width: 15 },
        { header: 'Account Name', key: 'accountName', width: 25 },
      ];

      for (const col of result.columns) {
        columns.push({
          header: col.dimensionValueName,
          key: `dim_${col.dimensionValueCode}`,
          width: 15,
          format: 'currency',
        });
      }
      columns.push({ header: 'Total', key: 'total', width: 18, format: 'currency' });

      const rows: Record<string, unknown>[] = [];
      for (const section of result.sections) {
        for (const account of section.accounts) {
          const row: Record<string, unknown> = {
            classification: section.classification,
            accountCode: account.accountCode,
            accountName: account.accountName,
            total: account.total,
          };
          for (let i = 0; i < result.columns.length; i++) {
            const col = result.columns[i];
            if (col) {
              row[`dim_${col.dimensionValueCode}`] = account.values[i] ?? 0;
            }
          }
          rows.push(row);
        }
      }

      await sendExportFile(reply, format, 'departmental-pnl', 'Departmental P&L', columns, rows);
    },
  );
}

export const exportRoutesPlugin = exportRoutes;
