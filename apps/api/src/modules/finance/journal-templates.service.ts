import type { PrismaClient } from '@nexa/db';
import { nextNumber } from '@nexa/db';

import type {
  CreateTemplateInput,
  UpdateTemplateInput,
  ExecuteTemplateInput,
  ListTemplatesQuery,
  TemplateLine,
} from './journal-templates.schema.js';
import { AppError, NotFoundError } from '../../core/errors/index.js';
import type { EventBus } from '../../core/events/event-bus.js';
import type { PaginationMeta } from '../../core/utils/response.js';

// ---------------------------------------------------------------------------
// Prisma select shapes
// ---------------------------------------------------------------------------

const LIST_SELECT = {
  id: true,
  name: true,
  description: true,
  frequency: true,
  isActive: true,
  nextDueDate: true,
  lastExecutedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  templateLines: true,
  createdBy: true,
  updatedBy: true,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a Date to ISO string or null */
function toDateStringOrNull(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === 'string') return d;
  return d.toISOString();
}

/** Convert a Date to YYYY-MM-DD string or null */
function toDateOnlyOrNull(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/** Normalise a template list item for API response */
function normaliseListItem(row: Record<string, unknown>) {
  return {
    ...row,
    nextDueDate: toDateOnlyOrNull(row.nextDueDate as Date | null),
    lastExecutedAt: toDateStringOrNull(row.lastExecutedAt as Date | null),
  };
}

/** Normalise a template detail for API response */
function normaliseDetail(row: Record<string, unknown>) {
  return {
    ...normaliseListItem(row),
    templateLines: row.templateLines,
  };
}

// ---------------------------------------------------------------------------
// Next due date calculation
// ---------------------------------------------------------------------------

export function calculateNextDueDate(frequency: string, fromDate: Date): Date {
  const next = new Date(fromDate);
  switch (frequency) {
    case 'DAILY':
      next.setDate(next.getDate() + 1);
      break;
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'QUARTERLY':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }
  return next;
}

// ---------------------------------------------------------------------------
// listTemplates (AC-1) — list templates with pagination
// ---------------------------------------------------------------------------

export async function listTemplates(
  prisma: PrismaClient,
  companyId: string,
  query: ListTemplatesQuery,
): Promise<{ data: unknown[]; meta: PaginationMeta }> {
  const where: Record<string, unknown> = { companyId };

  if (query.frequency) where.frequency = query.frequency;
  if (query.isActive !== undefined) where.isActive = query.isActive;

  const take = query.limit + 1;
  const findArgs: Record<string, unknown> = {
    where,
    select: LIST_SELECT,
    orderBy: { createdAt: 'desc' },
    take,
  };

  if (query.cursor) {
    findArgs.cursor = { id: query.cursor };
    findArgs.skip = 1;
  }

  const rows = (await (
    prisma.journalTemplate as unknown as {
      findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    }
  ).findMany(findArgs)) as Record<string, unknown>[];

  const hasMore = rows.length > query.limit;
  if (hasMore) rows.pop();

  const data = rows.map(normaliseListItem);
  const cursor = rows.length > 0 ? (rows[rows.length - 1]!.id as string) : undefined;

  return {
    data,
    meta: { cursor, hasMore, total: undefined },
  };
}

// ---------------------------------------------------------------------------
// getTemplateById — single template detail
// ---------------------------------------------------------------------------

export async function getTemplateById(prisma: PrismaClient, companyId: string, id: string) {
  const row = await (
    prisma.journalTemplate as unknown as {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    }
  ).findFirst({
    where: { id, companyId },
    select: DETAIL_SELECT,
  });

  if (!row) {
    throw new NotFoundError('TEMPLATE_NOT_FOUND', 'Journal template not found');
  }

  return normaliseDetail(row);
}

// ---------------------------------------------------------------------------
// createTemplate (AC-2)
// ---------------------------------------------------------------------------

export async function createTemplate(
  prisma: PrismaClient,
  companyId: string,
  data: CreateTemplateInput,
  userId: string,
) {
  const row = await (
    prisma.journalTemplate as unknown as {
      create: (args: unknown) => Promise<Record<string, unknown>>;
    }
  ).create({
    data: {
      companyId,
      name: data.name,
      description: data.description ?? null,
      frequency: data.frequency,
      isActive: true,
      templateLines: data.templateLines,
      nextDueDate: data.nextDueDate ?? null,
      createdBy: userId,
      updatedBy: userId,
    },
    select: DETAIL_SELECT,
  });

  return normaliseDetail(row);
}

// ---------------------------------------------------------------------------
// updateTemplate (AC-3)
// ---------------------------------------------------------------------------

export async function updateTemplate(
  prisma: PrismaClient,
  companyId: string,
  id: string,
  data: UpdateTemplateInput,
  userId: string,
) {
  // Verify exists
  const existing = await (
    prisma.journalTemplate as unknown as {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    }
  ).findFirst({
    where: { id, companyId },
    select: { id: true },
  });

  if (!existing) {
    throw new NotFoundError('TEMPLATE_NOT_FOUND', 'Journal template not found');
  }

  const updateData: Record<string, unknown> = { updatedBy: userId };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.frequency !== undefined) updateData.frequency = data.frequency;
  if (data.templateLines !== undefined) updateData.templateLines = data.templateLines;
  if (data.nextDueDate !== undefined) updateData.nextDueDate = data.nextDueDate;

  const row = await (
    prisma.journalTemplate as unknown as {
      update: (args: unknown) => Promise<Record<string, unknown>>;
    }
  ).update({
    where: { id },
    data: updateData,
    select: DETAIL_SELECT,
  });

  return normaliseDetail(row);
}

// ---------------------------------------------------------------------------
// deleteTemplate (AC-4) — soft-delete via isActive=false
// ---------------------------------------------------------------------------

export async function deleteTemplate(
  prisma: PrismaClient,
  companyId: string,
  id: string,
  userId: string,
) {
  const existing = await (
    prisma.journalTemplate as unknown as {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    }
  ).findFirst({
    where: { id, companyId },
    select: { id: true },
  });

  if (!existing) {
    throw new NotFoundError('TEMPLATE_NOT_FOUND', 'Journal template not found');
  }

  const row = await (
    prisma.journalTemplate as unknown as {
      update: (args: unknown) => Promise<Record<string, unknown>>;
    }
  ).update({
    where: { id },
    data: { isActive: false, updatedBy: userId },
    select: DETAIL_SELECT,
  });

  return normaliseDetail(row);
}

// ---------------------------------------------------------------------------
// executeTemplate (AC-5, AC-6) — create journal entry from template lines
// ---------------------------------------------------------------------------

export async function executeTemplate(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  id: string,
  data: ExecuteTemplateInput,
  userId: string,
) {
  const template = await (
    prisma.journalTemplate as unknown as {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    }
  ).findFirst({
    where: { id, companyId, isActive: true },
    select: DETAIL_SELECT,
  });

  if (!template) {
    throw new NotFoundError('TEMPLATE_NOT_FOUND', 'Active journal template not found');
  }

  const templateLines = template.templateLines as TemplateLine[];
  const transactionDate = data.transactionDate ?? new Date();

  // Execute in a transaction: create journal entry + update template
  const entry = await prisma.$transaction(async (tx) => {
    // Validate period exists and belongs to company
    const period = await tx.financialPeriod.findFirst({
      where: { id: data.periodId, companyId },
      select: { id: true },
    });
    if (!period) {
      throw new NotFoundError('PERIOD_NOT_FOUND', 'Financial period not found');
    }

    // Validate all account codes exist
    const accountCodes = templateLines.map((l) => l.accountCode);
    const uniqueCodes = [...new Set(accountCodes)];
    const accounts = await tx.chartOfAccount.findMany({
      where: { companyId, code: { in: uniqueCodes } },
      select: { code: true },
    });
    const foundCodes = new Set(accounts.map((a: { code: string }) => a.code));
    for (const code of uniqueCodes) {
      if (!foundCodes.has(code)) {
        throw new AppError('ACCOUNT_NOT_FOUND', `Account code "${code}" not found`, 400);
      }
    }

    // Generate entry number
    const entryNumber = await nextNumber(tx, companyId, 'JOURNAL');

    // Calculate totals
    const totalDebit = templateLines.reduce((sum, l) => sum + (l.debit ?? 0), 0);
    const totalCredit = templateLines.reduce((sum, l) => sum + (l.credit ?? 0), 0);

    // Create journal entry
    const journalEntry = await tx.journalEntry.create({
      data: {
        companyId,
        entryNumber,
        transactionDate,
        description: `From template: ${template.name as string}`,
        source: 'MANUAL',
        status: 'DRAFT',
        periodId: data.periodId,
        templateId: id,
        totalDebit,
        totalCredit,
        createdBy: userId,
        updatedBy: userId,
      },
      select: { id: true },
    });

    // Create lines
    for (let i = 0; i < templateLines.length; i++) {
      const line = templateLines[i]!;
      await tx.journalLine.create({
        data: {
          journalEntryId: journalEntry.id,
          lineNumber: i + 1,
          accountCode: line.accountCode,
          companyId,
          description: line.description ?? null,
          debit: line.debit ?? 0,
          credit: line.credit ?? 0,
          vatCode: line.vatCode ?? null,
        },
        select: { id: true },
      });
    }

    // Update template: lastExecutedAt + calculate next due date (AC-6)
    const now = new Date();
    const nextDueDate = calculateNextDueDate(template.frequency as string, now);
    await (tx.journalTemplate as unknown as { update: (args: unknown) => Promise<unknown> }).update(
      {
        where: { id },
        data: {
          lastExecutedAt: now,
          nextDueDate,
          updatedBy: userId,
        },
      },
    );

    // Fetch the complete journal entry for response
    return tx.journalEntry.findUniqueOrThrow({
      where: { id: journalEntry.id },
      select: {
        id: true,
        entryNumber: true,
        transactionDate: true,
        description: true,
        reference: true,
        source: true,
        sourceReference: true,
        status: true,
        periodId: true,
        totalDebit: true,
        totalCredit: true,
        postedAt: true,
        postedBy: true,
        reversalOfId: true,
        isAutoGenerated: true,
        sourceId: true,
        templateId: true,
        createdAt: true,
        updatedAt: true,
        createdBy: true,
        updatedBy: true,
        lines: {
          select: {
            id: true,
            lineNumber: true,
            accountCode: true,
            description: true,
            debit: true,
            credit: true,
            vatCode: true,
            currencyCode: true,
            foreignAmount: true,
            exchangeRate: true,
          },
          orderBy: { lineNumber: 'asc' as const },
        },
      },
    });
  });

  // Emit event
  eventBus.emit('journal.created', {
    journalEntryId: entry.id,
    entryNumber: entry.entryNumber,
    companyId,
    source: 'MANUAL',
    createdBy: userId,
  });

  // Normalise journal entry for response
  const normalised = {
    ...entry,
    transactionDate:
      entry.transactionDate instanceof Date
        ? entry.transactionDate.toISOString().slice(0, 10)
        : String(entry.transactionDate),
    totalDebit: typeof entry.totalDebit === 'number' ? entry.totalDebit : Number(entry.totalDebit),
    totalCredit:
      typeof entry.totalCredit === 'number' ? entry.totalCredit : Number(entry.totalCredit),
    postedAt:
      entry.postedAt instanceof Date
        ? entry.postedAt.toISOString()
        : (entry.postedAt as string | null),
    lines: (entry.lines as Array<Record<string, unknown>>).map((line) => ({
      ...line,
      debit: typeof line.debit === 'number' ? line.debit : Number(line.debit),
      credit: typeof line.credit === 'number' ? line.credit : Number(line.credit),
      foreignAmount: line.foreignAmount ? Number(line.foreignAmount) : null,
      exchangeRate: line.exchangeRate ? Number(line.exchangeRate) : null,
    })),
  };

  return normalised;
}
