import type { FastifyInstance } from 'fastify';
import { prisma } from '@nexa/db';
import { Prisma } from '@nexa/db';

import { vatReturnParamsSchema, vatReturnDetailSchema } from './vat-returns.schema.js';
import { submitVatReturn } from './hmrc-mtd.client.js';
import { createPermissionGuard } from '../../core/rbac/index.js';
import { sendSuccess } from '../../core/utils/response.js';
import { successEnvelope } from '../../core/schemas/envelope.js';
import { extractRequestContext } from '../../core/types/request-context.js';
import { AppError, NotFoundError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// Prisma select shape (matches vat-returns.service.ts DETAIL_SELECT)
// ---------------------------------------------------------------------------

const DETAIL_SELECT = {
  id: true,
  periodStart: true,
  periodEnd: true,
  status: true,
  box1: true,
  box2: true,
  box3: true,
  box4: true,
  box5: true,
  box6: true,
  box7: true,
  box8: true,
  box9: true,
  calculatedAt: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  submittedAt: true,
  submittedBy: true,
  hmrcSubmissionId: true,
  hmrcResponse: true,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert Prisma Decimal fields to numbers for JSON serialisation */
function toNumber(val: Prisma.Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return typeof val === 'number' ? val : Number(val);
}

/** Normalise a raw Prisma VatReturn row — convert all box Decimal fields */
function normaliseVatReturn(row: Record<string, unknown>) {
  return {
    ...row,
    box1: toNumber(row.box1 as Prisma.Decimal),
    box2: toNumber(row.box2 as Prisma.Decimal),
    box3: toNumber(row.box3 as Prisma.Decimal),
    box4: toNumber(row.box4 as Prisma.Decimal),
    box5: toNumber(row.box5 as Prisma.Decimal),
    box6: toNumber(row.box6 as Prisma.Decimal),
    box7: toNumber(row.box7 as Prisma.Decimal),
    box8: toNumber(row.box8 as Prisma.Decimal),
    box9: toNumber(row.box9 as Prisma.Decimal),
  };
}

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

const vatReturnDetailEnvelope = successEnvelope(vatReturnDetailSchema);

// ---------------------------------------------------------------------------
// HMRC MTD routes plugin
// ---------------------------------------------------------------------------

async function hmrcMtdRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /vat-returns/:id/submit — submit VAT return to HMRC MTD (AC-1)
  fastify.post<{ Params: { id: string } }>(
    '/vat-returns/:id/submit',
    {
      schema: {
        params: vatReturnParamsSchema,
        response: { 200: vatReturnDetailEnvelope },
      },
      preHandler: createPermissionGuard('finance.vatReturns', 'edit'),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);

      // 1. Load VAT return and verify it belongs to this company
      const vatReturn = await prisma.vatReturn.findFirst({
        where: { id: request.params.id, companyId: ctx.companyId },
        select: DETAIL_SELECT,
      });

      if (!vatReturn) {
        throw new NotFoundError('NOT_FOUND', 'VAT return not found');
      }

      // 2. AC-2: Validate status is CALCULATED before submission
      if (vatReturn.status !== 'CALCULATED') {
        throw new AppError(
          'INVALID_STATUS',
          `Cannot submit a VAT return with status ${vatReturn.status}. Must be CALCULATED.`,
          409,
        );
      }

      // 3. Call HMRC MTD client stub
      const result = await submitVatReturn({
        periodStart: vatReturn.periodStart as unknown as Date,
        periodEnd: vatReturn.periodEnd as unknown as Date,
        box1: toNumber(vatReturn.box1 as unknown as Prisma.Decimal),
        box2: toNumber(vatReturn.box2 as unknown as Prisma.Decimal),
        box3: toNumber(vatReturn.box3 as unknown as Prisma.Decimal),
        box4: toNumber(vatReturn.box4 as unknown as Prisma.Decimal),
        box5: toNumber(vatReturn.box5 as unknown as Prisma.Decimal),
        box6: toNumber(vatReturn.box6 as unknown as Prisma.Decimal),
        box7: toNumber(vatReturn.box7 as unknown as Prisma.Decimal),
        box8: toNumber(vatReturn.box8 as unknown as Prisma.Decimal),
        box9: toNumber(vatReturn.box9 as unknown as Prisma.Decimal),
      });

      // 4. AC-3 & AC-4: Update VAT return based on HMRC response
      if (result.success) {
        const updated = await prisma.vatReturn.update({
          where: { id: request.params.id },
          data: {
            status: 'SUBMITTED',
            hmrcSubmissionId: result.submissionId ?? null,
            hmrcResponse: { success: true, submissionId: result.submissionId },
            submittedAt: new Date(),
            submittedBy: ctx.userId,
          },
          select: DETAIL_SELECT,
        });

        return sendSuccess(
          reply,
          normaliseVatReturn(updated as unknown as Record<string, unknown>),
        );
      } else {
        // HMRC rejected the submission
        const updated = await prisma.vatReturn.update({
          where: { id: request.params.id },
          data: {
            status: 'REJECTED',
            hmrcResponse: { success: false, error: result.error },
          },
          select: DETAIL_SELECT,
        });

        return sendSuccess(
          reply,
          normaliseVatReturn(updated as unknown as Record<string, unknown>),
        );
      }
    },
  );
}

export const hmrcMtdRoutesPlugin = hmrcMtdRoutes;
