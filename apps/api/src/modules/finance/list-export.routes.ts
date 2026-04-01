import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';

import { exportQuerySchema } from './export.schema.js';
import { sendExportFile } from './export.service.js';
import type { ExportColumn } from './export.service.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { extractRequestContext } from '../../core/types/request-context.js';

// ---------------------------------------------------------------------------
// List Export routes plugin
// ---------------------------------------------------------------------------

async function listExportRoutes(fastify: FastifyInstance): Promise<void> {
  // -------------------------------------------------------------------------
  // GET /accounts/export
  // -------------------------------------------------------------------------
  fastify.get(
    '/accounts/export',
    {
      schema: { querystring: exportQuerySchema },
      preHandler: createPermissionGuard('finance.accounts', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { format } = request.query as any;

      const accounts = await (prisma as any).chartOfAccount.findMany({
        where: { companyId: ctx.companyId },
        orderBy: { code: 'asc' },
        take: 10000,
        select: {
          code: true,
          name: true,
          accountType: true,
          normalBalance: true,
          isPostable: true,
          isActive: true,
          parentCode: true,
          openingBalance: true,
          currentBalance: true,
        },
      });

      const columns: ExportColumn[] = [
        { header: 'Code', key: 'code', width: 12 },
        { header: 'Name', key: 'name', width: 30 },
        { header: 'Account Type', key: 'accountType', width: 12 },
        { header: 'Normal Balance', key: 'normalBalance', width: 12 },
        { header: 'Parent Code', key: 'parentCode', width: 12 },
        { header: 'Postable', key: 'isPostable', width: 8 },
        { header: 'Active', key: 'isActive', width: 8 },
        { header: 'Opening Balance', key: 'openingBalance', width: 18, format: 'currency' },
        { header: 'Current Balance', key: 'currentBalance', width: 18, format: 'currency' },
      ];

      // Normalise Decimal fields for export
      const rows = accounts.map((a: Record<string, unknown>) => ({
        ...a,
        openingBalance: Number(a.openingBalance ?? 0),
        currentBalance: Number(a.currentBalance ?? 0),
      }));

      await sendExportFile(reply, format, 'chart-of-accounts', 'Chart of Accounts', columns, rows);
    },
  );

  // -------------------------------------------------------------------------
  // GET /journals/export
  // -------------------------------------------------------------------------
  fastify.get(
    '/journals/export',
    {
      schema: { querystring: exportQuerySchema },
      preHandler: createPermissionGuard('finance.journals', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { format } = request.query as any;

      const journals = await (prisma as any).journalEntry.findMany({
        where: { companyId: ctx.companyId },
        orderBy: { transactionDate: 'desc' },
        take: 10000,
        select: {
          entryNumber: true,
          transactionDate: true,
          description: true,
          reference: true,
          status: true,
          source: true,
          totalDebit: true,
          totalCredit: true,
        },
      });

      const columns: ExportColumn[] = [
        { header: 'Entry Number', key: 'entryNumber', width: 15 },
        { header: 'Date', key: 'transactionDate', width: 12 },
        { header: 'Description', key: 'description', width: 30 },
        { header: 'Reference', key: 'reference', width: 20 },
        { header: 'Status', key: 'status', width: 10 },
        { header: 'Source', key: 'source', width: 15 },
        { header: 'Total Debit', key: 'totalDebit', width: 18, format: 'currency' },
        { header: 'Total Credit', key: 'totalCredit', width: 18, format: 'currency' },
      ];

      // Normalise date + Decimal fields
      const rows = journals.map((j: Record<string, unknown>) => ({
        ...j,
        transactionDate:
          j.transactionDate instanceof Date
            ? (j.transactionDate as Date).toISOString().slice(0, 10)
            : String(j.transactionDate ?? ''),
        reference: j.reference ?? '',
        totalDebit: Number(j.totalDebit ?? 0),
        totalCredit: Number(j.totalCredit ?? 0),
      }));

      await sendExportFile(reply, format, 'journals', 'Journal Entries', columns, rows);
    },
  );

  // -------------------------------------------------------------------------
  // GET /bank-accounts/export
  // -------------------------------------------------------------------------
  fastify.get(
    '/bank-accounts/export',
    {
      schema: { querystring: exportQuerySchema },
      preHandler: createPermissionGuard('finance.accounts', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { format } = request.query as any;

      const bankAccounts = await (prisma as any).bankAccount.findMany({
        where: { companyId: ctx.companyId },
        orderBy: { name: 'asc' },
        take: 10000,
        select: {
          name: true,
          sortCode: true,
          accountNumber: true,
          currencyCode: true,
          glAccountCode: true,
          currentBalance: true,
          isActive: true,
        },
      });

      const columns: ExportColumn[] = [
        { header: 'Account Name', key: 'name', width: 25 },
        { header: 'Sort Code', key: 'sortCode', width: 12 },
        { header: 'Account Number', key: 'accountNumber', width: 15 },
        { header: 'Currency', key: 'currencyCode', width: 10 },
        { header: 'GL Account', key: 'glAccountCode', width: 12 },
        { header: 'Current Balance', key: 'currentBalance', width: 18, format: 'currency' },
        { header: 'Active', key: 'isActive', width: 8 },
      ];

      const rows = bankAccounts.map((b: Record<string, unknown>) => ({
        ...b,
        currentBalance: Number(b.currentBalance ?? 0),
      }));

      await sendExportFile(reply, format, 'bank-accounts', 'Bank Accounts', columns, rows);
    },
  );

  // -------------------------------------------------------------------------
  // GET /budgets/export
  // -------------------------------------------------------------------------
  fastify.get(
    '/budgets/export',
    {
      schema: { querystring: exportQuerySchema },
      preHandler: createPermissionGuard('finance.accounts', 'view'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { format } = request.query as any;

      const budgets = await (prisma as any).budget.findMany({
        where: { companyId: ctx.companyId },
        orderBy: { fiscalYear: 'desc' },
        take: 10000,
        select: {
          name: true,
          fiscalYear: true,
          status: true,
          totalAmount: true,
          createdAt: true,
        },
      });

      const columns: ExportColumn[] = [
        { header: 'Name', key: 'name', width: 30 },
        { header: 'Fiscal Year', key: 'fiscalYear', width: 12 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Total Amount', key: 'totalAmount', width: 18, format: 'currency' },
        { header: 'Created', key: 'createdAt', width: 12 },
      ];

      const rows = budgets.map((b: Record<string, unknown>) => ({
        ...b,
        totalAmount: Number(b.totalAmount ?? 0),
        createdAt:
          b.createdAt instanceof Date
            ? (b.createdAt as Date).toISOString().slice(0, 10)
            : String(b.createdAt ?? ''),
      }));

      await sendExportFile(reply, format, 'budgets', 'Budgets', columns, rows);
    },
  );
}

export const listExportRoutesPlugin = listExportRoutes;
