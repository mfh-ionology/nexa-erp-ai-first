import type { PrismaClient } from '@nexa/db';
import { Prisma, nextNumber } from '@nexa/db';

import type {
  CreateSimulationInput,
  UpdateSimulationInput,
  ListSimulationsQuery,
} from './simulations.schema.js';
import { AppError, DomainError, NotFoundError } from '../../core/errors/index.js';
import type { EventBus } from '../../core/events/event-bus.js';
import type { PaginationMeta } from '../../core/utils/response.js';
import { createJournalEntry } from './journals.service.js';
import type { CreateJournalInput } from './journals.schema.js';

// ---------------------------------------------------------------------------
// Prisma select shapes
// ---------------------------------------------------------------------------

const LINE_SELECT = {
  id: true,
  lineNumber: true,
  accountCode: true,
  description: true,
  debit: true,
  credit: true,
  vatCode: true,
  dimensionValues: true,
  account: { select: { name: true } },
} as const;

const LIST_SELECT = {
  id: true,
  entryNumber: true,
  transactionDate: true,
  description: true,
  reference: true,
  status: true,
  periodId: true,
  totalDebit: true,
  totalCredit: true,
  transferredToId: true,
  createdAt: true,
  updatedAt: true,
  createdBy: true,
  updatedBy: true,
} as const;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  lines: {
    select: LINE_SELECT,
    orderBy: { lineNumber: 'asc' as const },
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert Prisma Decimal fields to numbers for JSON serialisation */
function toNumber(val: Prisma.Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return typeof val === 'number' ? val : Number(val);
}

/** Extract YYYY-MM-DD from a Date */
function toDateString(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/** Normalise a simulation line for API response */
function normaliseLine(line: Record<string, unknown>) {
  const account = line.account as { name: string } | null | undefined;
  return {
    ...line,
    accountName: account?.name ?? null,
    account: undefined,
    debit: toNumber(line.debit as Prisma.Decimal),
    credit: toNumber(line.credit as Prisma.Decimal),
  };
}

/** Normalise a simulation list item for API response */
function normaliseListItem(row: Record<string, unknown>) {
  return {
    ...row,
    transactionDate:
      row.transactionDate instanceof Date
        ? toDateString(row.transactionDate)
        : String(row.transactionDate),
    totalDebit: toNumber(row.totalDebit as Prisma.Decimal),
    totalCredit: toNumber(row.totalCredit as Prisma.Decimal),
  };
}

/** Normalise a simulation detail for API response */
function normaliseDetail(row: Record<string, unknown>) {
  const lines = (row.lines as Array<Record<string, unknown>> | undefined) ?? [];
  return {
    ...normaliseListItem(row),
    lines: lines.map(normaliseLine),
  };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate that lines balance (total debit == total credit).
 * Simulations enforce balance on create/update (not just on posting like journals).
 */
function validateLinesBalance(lines: Array<{ debit: number; credit: number }>) {
  const totalDebit = lines.reduce((sum, l) => sum + (l.debit ?? 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit ?? 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.0001) {
    throw new DomainError(
      'ENTRY_NOT_BALANCED',
      `Simulation is not balanced: debits (${String(totalDebit)}) != credits (${String(totalCredit)})`,
    );
  }
  return { totalDebit, totalCredit };
}

/**
 * Validate period exists, belongs to company, and is OPEN.
 */
async function validatePeriodOpen(
  tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  companyId: string,
  periodId: string,
) {
  const period = await tx.financialPeriod.findFirst({
    where: { id: periodId, companyId },
    select: { id: true, status: true },
  });
  if (!period) {
    throw new NotFoundError('PERIOD_NOT_FOUND', 'Financial period not found');
  }
  if (period.status === 'CLOSED' || period.status === 'LOCKED') {
    throw new DomainError(
      'PERIOD_NOT_OPEN',
      `Cannot create simulation in ${period.status.toLowerCase()} period`,
    );
  }
  return period;
}

/**
 * Validate all account codes exist and belong to the company.
 */
async function validateAccountCodes(
  tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  companyId: string,
  accountCodes: string[],
) {
  const uniqueCodes = [...new Set(accountCodes)];
  const accounts = await tx.chartOfAccount.findMany({
    where: { companyId, code: { in: uniqueCodes } },
    select: { code: true },
  });
  const foundCodes = new Set(accounts.map((a) => a.code));
  for (const code of uniqueCodes) {
    if (!foundCodes.has(code)) {
      throw new AppError('ACCOUNT_NOT_FOUND', `Account code "${code}" not found`, 400);
    }
  }
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

export async function listSimulations(
  prisma: PrismaClient,
  companyId: string,
  query: ListSimulationsQuery,
): Promise<{ data: unknown[]; meta: PaginationMeta }> {
  const where: Record<string, unknown> = { companyId };
  if (query.status) where.status = query.status;
  if (query.periodId) where.periodId = query.periodId;
  if (query.cursor) where.id = { lt: query.cursor };

  const rows = await prisma.simulation.findMany({
    where,
    select: LIST_SELECT,
    orderBy: { createdAt: 'desc' },
    take: query.limit + 1,
  });

  const hasMore = rows.length > query.limit;
  const data = (hasMore ? rows.slice(0, -1) : rows).map((r) =>
    normaliseListItem(r as unknown as Record<string, unknown>),
  );

  return {
    data,
    meta: {
      cursor: data.length > 0 ? (data[data.length - 1] as { id: string }).id : undefined,
      hasMore,
    },
  };
}

export async function getSimulationById(prisma: PrismaClient, companyId: string, id: string) {
  const row = await prisma.simulation.findFirst({
    where: { id, companyId },
    select: DETAIL_SELECT,
  });
  if (!row) {
    throw new NotFoundError('NOT_FOUND', 'Simulation not found');
  }
  return normaliseDetail(row as unknown as Record<string, unknown>);
}

export async function createSimulation(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  data: CreateSimulationInput,
  userId: string,
) {
  // Validate balance up-front
  const { totalDebit, totalCredit } = validateLinesBalance(data.lines);

  const result = await prisma.$transaction(async (tx) => {
    // Validate period is OPEN
    await validatePeriodOpen(tx, companyId, data.periodId);

    // Validate account codes
    await validateAccountCodes(
      tx,
      companyId,
      data.lines.map((l) => l.accountCode),
    );

    // Generate entry number
    const entryNumber = await nextNumber(tx, companyId, 'SIMULATION');

    // Create simulation header
    const simulation = await tx.simulation.create({
      data: {
        companyId,
        entryNumber,
        transactionDate: data.transactionDate,
        description: data.description,
        reference: data.reference ?? null,
        status: 'ACTIVE',
        periodId: data.periodId,
        totalDebit,
        totalCredit,
        createdBy: userId,
        updatedBy: userId,
      },
      select: { id: true },
    });

    // Create lines
    for (let i = 0; i < data.lines.length; i++) {
      const line = data.lines[i]!;
      await tx.simulationLine.create({
        data: {
          simulationId: simulation.id,
          lineNumber: i + 1,
          accountCode: line.accountCode,
          companyId,
          description: line.description ?? null,
          debit: line.debit ?? 0,
          credit: line.credit ?? 0,
          vatCode: line.vatCode ?? null,
          dimensionValues: line.dimensionValues ?? Prisma.JsonNull,
        },
      });
    }

    // Fetch complete simulation for response
    return tx.simulation.findUniqueOrThrow({
      where: { id: simulation.id },
      select: DETAIL_SELECT,
    });
  });

  // Emit event
  eventBus.emit('simulation.created', {
    simulationId: result.id,
    entryNumber: result.entryNumber,
    companyId,
    createdBy: userId,
  });

  return normaliseDetail(result as unknown as Record<string, unknown>);
}

export async function updateSimulation(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  id: string,
  data: UpdateSimulationInput,
  userId: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.simulation.findFirst({
      where: { id, companyId },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundError('NOT_FOUND', 'Simulation not found');
    }
    if (existing.status !== 'ACTIVE') {
      throw new DomainError(
        'SIMULATION_NOT_ACTIVE',
        `Cannot update simulation with status ${existing.status}`,
      );
    }

    // If periodId is changing, validate new period is OPEN
    if (data.periodId) {
      await validatePeriodOpen(tx, companyId, data.periodId);
    }

    // If lines provided, validate balance and accounts
    let totalDebit: number | undefined;
    let totalCredit: number | undefined;
    if (data.lines) {
      const totals = validateLinesBalance(data.lines);
      totalDebit = totals.totalDebit;
      totalCredit = totals.totalCredit;

      await validateAccountCodes(
        tx,
        companyId,
        data.lines.map((l) => l.accountCode),
      );
    }

    // Update header
    const updateData: Record<string, unknown> = { updatedBy: userId };
    if (data.transactionDate !== undefined) updateData.transactionDate = data.transactionDate;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.reference !== undefined) updateData.reference = data.reference;
    if (data.periodId !== undefined) updateData.periodId = data.periodId;
    if (totalDebit !== undefined) updateData.totalDebit = totalDebit;
    if (totalCredit !== undefined) updateData.totalCredit = totalCredit;

    await tx.simulation.update({
      where: { id },
      data: updateData,
    });

    // Replace lines if provided
    if (data.lines) {
      await tx.simulationLine.deleteMany({ where: { simulationId: id } });
      for (let i = 0; i < data.lines.length; i++) {
        const line = data.lines[i]!;
        await tx.simulationLine.create({
          data: {
            simulationId: id,
            lineNumber: i + 1,
            accountCode: line.accountCode,
            companyId,
            description: line.description ?? null,
            debit: line.debit ?? 0,
            credit: line.credit ?? 0,
            vatCode: line.vatCode ?? null,
            dimensionValues: line.dimensionValues ?? Prisma.JsonNull,
          },
        });
      }
    }

    return tx.simulation.findUniqueOrThrow({
      where: { id },
      select: DETAIL_SELECT,
    });
  });

  eventBus.emit('simulation.updated', {
    simulationId: result.id,
    companyId,
    updatedBy: userId,
  });

  return normaliseDetail(result as unknown as Record<string, unknown>);
}

export async function deleteSimulation(prisma: PrismaClient, companyId: string, id: string) {
  const existing = await prisma.simulation.findFirst({
    where: { id, companyId },
    select: { id: true, status: true },
  });
  if (!existing) {
    throw new NotFoundError('NOT_FOUND', 'Simulation not found');
  }
  if (existing.status === 'TRANSFERRED') {
    throw new DomainError('SIMULATION_TRANSFERRED', 'Cannot delete a transferred simulation');
  }
  // onDelete: Cascade on SimulationLine handles line cleanup
  await prisma.simulation.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Convert & Invalidate
// ---------------------------------------------------------------------------

/**
 * Convert an ACTIVE simulation to a DRAFT journal entry.
 * Creates the journal via createJournalEntry (reuses all GL logic), then
 * marks the simulation as TRANSFERRED with a link to the new journal.
 */
export async function convertSimulation(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  id: string,
  userId: string,
) {
  // Fetch simulation with lines
  const simulation = await prisma.simulation.findFirst({
    where: { id, companyId },
    select: {
      ...DETAIL_SELECT,
      status: true,
    },
  });

  if (!simulation) {
    throw new NotFoundError('NOT_FOUND', 'Simulation not found');
  }
  if (simulation.status !== 'ACTIVE') {
    throw new DomainError(
      'SIMULATION_NOT_ACTIVE',
      `Cannot convert simulation with status ${simulation.status}`,
    );
  }

  // Build journal input from simulation data
  const journalLines = simulation.lines.map((line) => {
    const dims = line.dimensionValues as Array<{ dimensionValueId: string }> | null;
    return {
      accountCode: line.accountCode,
      debit: toNumber(line.debit as unknown as Prisma.Decimal),
      credit: toNumber(line.credit as unknown as Prisma.Decimal),
      description: line.description ?? undefined,
      vatCode: line.vatCode ?? undefined,
      dimensions: dims ? dims.map((d) => ({ dimensionValueId: d.dimensionValueId })) : undefined,
    };
  });

  const journalInput: CreateJournalInput = {
    transactionDate: simulation.transactionDate as Date,
    description: simulation.description,
    reference: simulation.reference ?? undefined,
    periodId: simulation.periodId,
    lines: journalLines,
  };

  // Create journal entry (this generates its own entry number, validates period/accounts)
  const journalResult = await createJournalEntry(prisma, eventBus, companyId, journalInput, userId);

  // Mark simulation as TRANSFERRED
  await prisma.simulation.update({
    where: { id },
    data: {
      status: 'TRANSFERRED',
      transferredToId: journalResult.id as string,
      updatedBy: userId,
    },
  });

  // Emit event
  eventBus.emit('simulation.converted', {
    simulationId: id,
    journalEntryId: journalResult.id,
    companyId,
    convertedBy: userId,
  });

  return journalResult;
}

/**
 * Mark an ACTIVE simulation as INVALID.
 */
export async function invalidateSimulation(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  id: string,
  userId: string,
) {
  const existing = await prisma.simulation.findFirst({
    where: { id, companyId },
    select: { id: true, status: true },
  });
  if (!existing) {
    throw new NotFoundError('NOT_FOUND', 'Simulation not found');
  }
  if (existing.status !== 'ACTIVE') {
    throw new DomainError(
      'SIMULATION_NOT_ACTIVE',
      `Cannot invalidate simulation with status ${existing.status}`,
    );
  }

  const result = await prisma.simulation.update({
    where: { id },
    data: {
      status: 'INVALID',
      updatedBy: userId,
    },
    select: DETAIL_SELECT,
  });

  eventBus.emit('simulation.invalidated', {
    simulationId: id,
    companyId,
    invalidatedBy: userId,
  });

  return normaliseDetail(result as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Report aggregation helper
// ---------------------------------------------------------------------------

/**
 * Aggregate simulation line amounts by account code for ACTIVE simulations
 * in the given periods. Used by report services when includeSimulations=true.
 *
 * Returns a Map of accountCode -> { debit, credit } totals.
 */
export async function getSimulationLineAggregations(
  prisma: PrismaClient,
  companyId: string,
  periodIds: string[],
): Promise<Map<string, { debit: number; credit: number }>> {
  if (periodIds.length === 0) return new Map();

  const aggregations = await prisma.simulationLine.groupBy({
    by: ['accountCode'],
    where: {
      companyId,
      simulation: {
        companyId,
        status: 'ACTIVE',
        periodId: { in: periodIds },
      },
    },
    _sum: {
      debit: true,
      credit: true,
    },
  });

  const result = new Map<string, { debit: number; credit: number }>();
  for (const row of aggregations) {
    result.set(row.accountCode, {
      debit: toNumber(row._sum.debit),
      credit: toNumber(row._sum.credit),
    });
  }
  return result;
}
