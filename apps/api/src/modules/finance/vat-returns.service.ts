import type { PrismaClient } from '@nexa/db';
import { Prisma } from '@nexa/db';
import type { CreateVatReturnInput, ListVatReturnsQuery } from './vat-returns.schema.js';
import { AppError, NotFoundError } from '../../core/errors/index.js';
import type { PaginationMeta } from '../../core/utils/response.js';

// ---------------------------------------------------------------------------
// Prisma select shapes
// ---------------------------------------------------------------------------

const LIST_SELECT = {
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
} as const;

const DETAIL_SELECT = {
  ...LIST_SELECT,
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
// listVatReturns (AC-1)
// ---------------------------------------------------------------------------

export async function listVatReturns(
  prisma: PrismaClient,
  companyId: string,
  query: ListVatReturnsQuery,
) {
  const { cursor, limit, status } = query;

  const where: Record<string, unknown> = { companyId };
  if (status !== undefined) where.status = status;

  const [items, total] = await Promise.all([
    prisma.vatReturn.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { periodStart: 'desc' },
      select: LIST_SELECT,
    }),
    prisma.vatReturn.count({ where }),
  ]);

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  const mapped = data.map((row) => normaliseVatReturn(row as unknown as Record<string, unknown>));

  const meta: PaginationMeta = { cursor: nextCursor, hasMore, total };

  return { data: mapped, meta };
}

// ---------------------------------------------------------------------------
// getVatReturnById (AC-4)
// ---------------------------------------------------------------------------

export async function getVatReturnById(prisma: PrismaClient, companyId: string, id: string) {
  const vatReturn = await prisma.vatReturn.findFirst({
    where: { id, companyId },
    select: DETAIL_SELECT,
  });

  if (!vatReturn) {
    throw new NotFoundError('NOT_FOUND', 'VAT return not found');
  }

  return normaliseVatReturn(vatReturn as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// createVatReturn (AC-2, AC-5)
// ---------------------------------------------------------------------------

export async function createVatReturn(
  prisma: PrismaClient,
  companyId: string,
  data: CreateVatReturnInput,
  userId: string,
) {
  const { periodStart, periodEnd } = data;

  // Validate period: start must be before end
  if (periodStart >= periodEnd) {
    throw new AppError('INVALID_PERIOD', 'Period start must be before period end', 400);
  }

  // AC-5: Check for overlapping VAT returns in the same company
  const overlapping = await prisma.vatReturn.findFirst({
    where: {
      companyId,
      AND: [{ periodStart: { lte: periodEnd } }, { periodEnd: { gte: periodStart } }],
    },
    select: { id: true },
  });

  if (overlapping) {
    throw new AppError(
      'OVERLAPPING_PERIOD',
      'A VAT return already exists that overlaps with this period',
      409,
    );
  }

  const vatReturn = await prisma.vatReturn.create({
    data: {
      companyId,
      periodStart,
      periodEnd,
      status: 'DRAFT',
      createdBy: userId,
    },
    select: DETAIL_SELECT,
  });

  return normaliseVatReturn(vatReturn as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// calculateVatReturn (AC-3)
// ---------------------------------------------------------------------------

export async function calculateVatReturn(prisma: PrismaClient, companyId: string, id: string) {
  // Fetch the VAT return
  const vatReturn = await prisma.vatReturn.findFirst({
    where: { id, companyId },
    select: { id: true, status: true, periodStart: true, periodEnd: true },
  });

  if (!vatReturn) {
    throw new NotFoundError('NOT_FOUND', 'VAT return not found');
  }

  // Only DRAFT or CALCULATED returns can be (re)calculated
  if (!['DRAFT', 'CALCULATED'].includes(vatReturn.status)) {
    throw new AppError(
      'INVALID_STATUS',
      `Cannot calculate a VAT return with status ${vatReturn.status}`,
      409,
    );
  }

  // Fetch all VAT codes for this company to classify input vs output
  const vatCodes = await prisma.vatCode.findMany({
    where: { companyId, isActive: true },
    select: {
      code: true,
      type: true,
      rate: true,
      salesAccountCode: true,
      purchaseAccountCode: true,
    },
  });

  // Build lookup: code → VatCode record
  const vatCodeMap = new Map(vatCodes.map((vc) => [vc.code, vc]));

  // Build sets of VAT account codes for direct-account-based detection (BUG-4 FIX).
  // This enables VAT calculation even when journal lines don't have vatCode set.
  const salesVatAccountCodes = new Set<string>();
  const purchaseVatAccountCodes = new Set<string>();
  const vatAccountToRate = new Map<string, number>();

  for (const vc of vatCodes) {
    const rate = toNumber(vc.rate as unknown as Prisma.Decimal);
    if (vc.salesAccountCode) {
      salesVatAccountCodes.add(vc.salesAccountCode);
      vatAccountToRate.set(vc.salesAccountCode, rate);
    }
    if (vc.purchaseAccountCode) {
      purchaseVatAccountCodes.add(vc.purchaseAccountCode);
      vatAccountToRate.set(vc.purchaseAccountCode, rate);
    }
  }

  // BUG-4 FIX: Query ALL posted journal lines within the period, not just those
  // with vatCode set. Many journal lines are created without vatCode on the lines
  // but still post to VAT accounts (e.g., 2200 for output VAT, 1500 for input VAT).
  // We detect VAT by checking whether the line posts to a known VAT account.
  const journalLines = await prisma.journalLine.findMany({
    where: {
      companyId,
      journalEntry: {
        status: 'POSTED',
        transactionDate: {
          gte: vatReturn.periodStart,
          lte: vatReturn.periodEnd,
        },
      },
    },
    select: {
      journalEntryId: true,
      accountCode: true,
      debit: true,
      credit: true,
      vatCode: true,
    },
  });

  // Accumulate box values
  let box1 = 0; // Output VAT on sales
  let box4 = 0; // Input VAT on purchases
  let box6 = 0; // Total sales excl VAT
  let box7 = 0; // Total purchases excl VAT

  // Track which journal entries have VAT lines, so we can find their net amounts
  const journalEntriesWithOutputVat = new Set<string>();
  const journalEntriesWithInputVat = new Set<string>();

  // First pass: identify VAT lines (posted to VAT accounts or with vatCode)
  for (const line of journalLines) {
    const lineDebit = toNumber(line.debit as unknown as Prisma.Decimal);
    const lineCredit = toNumber(line.credit as unknown as Prisma.Decimal);

    // Check if this line posts to a known VAT account (primary detection method)
    const isSalesVatAccount = salesVatAccountCodes.has(line.accountCode);
    const isPurchaseVatAccount = purchaseVatAccountCodes.has(line.accountCode);

    // Also check via vatCode field if set (secondary detection method)
    if (!isSalesVatAccount && !isPurchaseVatAccount && line.vatCode) {
      const vc = vatCodeMap.get(line.vatCode);
      if (vc) {
        const rate = toNumber(vc.rate as unknown as Prisma.Decimal);
        const matchesSalesAccount = vc.salesAccountCode && line.accountCode === vc.salesAccountCode;
        const matchesPurchaseAccount =
          vc.purchaseAccountCode && line.accountCode === vc.purchaseAccountCode;

        if (matchesSalesAccount) {
          const vatAmount = lineCredit - lineDebit;
          box1 += vatAmount;
          if (rate > 0) {
            box6 += vatAmount / (rate / 100);
          }
          journalEntriesWithOutputVat.add(line.journalEntryId);
        } else if (matchesPurchaseAccount) {
          const vatAmount = lineDebit - lineCredit;
          box4 += vatAmount;
          if (rate > 0) {
            box7 += vatAmount / (rate / 100);
          }
          journalEntriesWithInputVat.add(line.journalEntryId);
        }
        continue;
      }
    }

    if (isSalesVatAccount) {
      // Output VAT: amount posted to sales VAT account (typically a credit)
      const vatAmount = lineCredit - lineDebit;
      box1 += vatAmount;
      const rate = vatAccountToRate.get(line.accountCode) ?? 0;
      if (rate > 0) {
        box6 += vatAmount / (rate / 100);
      }
      journalEntriesWithOutputVat.add(line.journalEntryId);
    } else if (isPurchaseVatAccount) {
      // Input VAT: amount posted to purchase VAT account (typically a debit)
      const vatAmount = lineDebit - lineCredit;
      box4 += vatAmount;
      const rate = vatAccountToRate.get(line.accountCode) ?? 0;
      if (rate > 0) {
        box7 += vatAmount / (rate / 100);
      }
      journalEntriesWithInputVat.add(line.journalEntryId);
    }
  }

  // Box 2, 8, 9 = 0 for MVP (EU-related, post-Brexit minimal)
  const box2 = 0;
  const box8 = 0;
  const box9 = 0;

  // Box 3 = Box 1 + Box 2
  const box3 = box1 + box2;

  // Box 5 = Box 3 - Box 4 (positive = owe HMRC, negative = refund)
  const box5 = box3 - box4;

  // Round all to 2 decimal places for currency
  const round2 = (n: number) => Math.round(n * 100) / 100;

  const updated = await prisma.vatReturn.update({
    where: { id },
    data: {
      box1: round2(box1),
      box2: round2(box2),
      box3: round2(box3),
      box4: round2(box4),
      box5: round2(box5),
      box6: round2(box6),
      box7: round2(box7),
      box8: round2(box8),
      box9: round2(box9),
      status: 'CALCULATED',
      calculatedAt: new Date(),
    },
    select: DETAIL_SELECT,
  });

  return normaliseVatReturn(updated as unknown as Record<string, unknown>);
}
