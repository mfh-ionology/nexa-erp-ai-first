import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { Prisma } from '@nexa/db';
import { z } from 'zod';

import { connectAccount, syncTransactions, disconnectAccount } from './open-banking.client.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';
import { NotFoundError, AppError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const openBankingParamsSchema = z.object({
  id: z.uuid(),
});

const connectBodySchema = z.object({
  provider: z.string().min(1, 'Provider is required').max(50),
});

const connectResultSchema = z.object({
  connectionId: z.string(),
  provider: z.string(),
  status: z.string(),
});

const syncResultSchema = z.object({
  syncedAt: z.string(),
  total: z.number(),
  imported: z.number(),
  duplicatesSkipped: z.number(),
});

const disconnectResultSchema = z.object({
  disconnected: z.boolean(),
});

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const connectEnvelope = successEnvelope(connectResultSchema);
const syncEnvelope = successEnvelope(syncResultSchema);
const disconnectEnvelope = successEnvelope(disconnectResultSchema);

// ---------------------------------------------------------------------------
// Open Banking routes plugin
// ---------------------------------------------------------------------------

async function openBankingRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /bank-accounts/:id/open-banking/connect — initiate Open Banking connection (AC-1)
  fastify.post<{ Params: { id: string }; Body: z.infer<typeof connectBodySchema> }>(
    '/bank-accounts/:id/open-banking/connect',
    {
      schema: {
        params: openBankingParamsSchema,
        body: connectBodySchema,
        response: { 200: connectEnvelope },
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { id } = request.params;
      const { provider } = request.body;

      // Validate bank account exists and belongs to the company
      const bankAccount = await prisma.bankAccount.findFirst({
        where: { id, companyId: ctx.companyId },
        select: { id: true, openBankingStatus: true, openBankingConnId: true },
      });

      if (!bankAccount) {
        throw new NotFoundError('NOT_FOUND', 'Bank account not found');
      }

      // Prevent connecting an already-connected account
      if (bankAccount.openBankingStatus === 'CONNECTED') {
        throw new AppError(
          'ALREADY_CONNECTED',
          'Bank account is already connected to Open Banking. Disconnect first.',
          409,
        );
      }

      // Connect via Open Banking provider (stub)
      const connection = await connectAccount(id, provider);

      // Update bank account with Open Banking details (AC-4)
      await prisma.bankAccount.update({
        where: { id },
        data: {
          openBankingStatus: connection.status,
          openBankingProvider: connection.provider,
          openBankingConnId: connection.connectionId,
          updatedBy: ctx.userId,
        },
      });

      return sendSuccess(reply, {
        connectionId: connection.connectionId,
        provider: connection.provider,
        status: connection.status,
      });
    },
  );

  // POST /bank-accounts/:id/open-banking/sync — trigger transaction sync (AC-2)
  fastify.post<{ Params: { id: string } }>(
    '/bank-accounts/:id/open-banking/sync',
    {
      schema: {
        params: openBankingParamsSchema,
        response: { 200: syncEnvelope },
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { id } = request.params;

      // Validate bank account exists and is connected
      const bankAccount = await prisma.bankAccount.findFirst({
        where: { id, companyId: ctx.companyId },
        select: { id: true, openBankingStatus: true, openBankingConnId: true },
      });

      if (!bankAccount) {
        throw new NotFoundError('NOT_FOUND', 'Bank account not found');
      }

      if (bankAccount.openBankingStatus !== 'CONNECTED' || !bankAccount.openBankingConnId) {
        throw new AppError(
          'NOT_CONNECTED',
          'Bank account is not connected to Open Banking. Connect first.',
          409,
        );
      }

      // Fetch transactions from Open Banking provider (stub — returns empty array)
      const obTransactions = await syncTransactions(bankAccount.openBankingConnId);

      // AC-5: Create BankTransaction records with duplicate detection (same as import)
      const syncedAt = new Date();
      let imported = 0;
      let duplicatesSkipped = 0;

      if (obTransactions.length > 0) {
        // Generate externalIds for duplicate detection
        const externalIds = obTransactions.map((t) => t.externalId);

        const existingTransactions = await prisma.bankTransaction.findMany({
          where: {
            bankAccountId: id,
            externalId: { in: externalIds },
          },
          select: { externalId: true },
        });

        const existingExternalIds = new Set(existingTransactions.map((t) => t.externalId));

        const newTransactions = obTransactions.filter(
          (t) => !existingExternalIds.has(t.externalId),
        );

        duplicatesSkipped = obTransactions.length - newTransactions.length;

        // Create new transactions atomically
        await prisma.$transaction(async (tx) => {
          for (const txn of newTransactions) {
            const amount = txn.amount;
            const type: 'CREDIT' | 'DEBIT' = amount >= 0 ? 'CREDIT' : 'DEBIT';

            await tx.bankTransaction.create({
              data: {
                companyId: ctx.companyId,
                bankAccountId: id,
                externalId: txn.externalId,
                transactionDate: new Date(txn.date),
                description: txn.description,
                amount: new Prisma.Decimal(amount.toFixed(4)),
                reference: txn.reference ?? null,
                type,
                importBatchId: `OB-SYNC-${syncedAt.toISOString()}`,
                importedAt: syncedAt,
                isMatched: false,
              },
            });
          }
        });

        imported = newTransactions.length;
      }

      // AC-4: Update openBankingLastSync timestamp
      await prisma.bankAccount.update({
        where: { id },
        data: {
          openBankingLastSync: syncedAt,
          updatedBy: ctx.userId,
        },
      });

      return sendSuccess(reply, {
        syncedAt: syncedAt.toISOString(),
        total: obTransactions.length,
        imported,
        duplicatesSkipped,
      });
    },
  );

  // POST /bank-accounts/:id/open-banking/disconnect — disconnect bank feed (AC-3)
  fastify.post<{ Params: { id: string } }>(
    '/bank-accounts/:id/open-banking/disconnect',
    {
      schema: {
        params: openBankingParamsSchema,
        response: { 200: disconnectEnvelope },
      },
      preHandler: createPermissionGuard('finance.bankAccounts', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { id } = request.params;

      // Validate bank account exists and belongs to the company
      const bankAccount = await prisma.bankAccount.findFirst({
        where: { id, companyId: ctx.companyId },
        select: { id: true, openBankingStatus: true, openBankingConnId: true },
      });

      if (!bankAccount) {
        throw new NotFoundError('NOT_FOUND', 'Bank account not found');
      }

      if (bankAccount.openBankingStatus === 'DISCONNECTED') {
        throw new AppError(
          'ALREADY_DISCONNECTED',
          'Bank account is not connected to Open Banking.',
          409,
        );
      }

      // Disconnect via Open Banking provider (stub)
      if (bankAccount.openBankingConnId) {
        await disconnectAccount(bankAccount.openBankingConnId);
      }

      // AC-4: Reset Open Banking fields on bank account
      await prisma.bankAccount.update({
        where: { id },
        data: {
          openBankingStatus: 'DISCONNECTED',
          openBankingProvider: null,
          openBankingConnId: null,
          openBankingLastSync: null,
          updatedBy: ctx.userId,
        },
      });

      return sendSuccess(reply, { disconnected: true });
    },
  );
}

export const openBankingRoutesPlugin = openBankingRoutes;
