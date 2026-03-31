import type { PrismaClient } from '@nexa/db';
import type { ListPeriodsQuery, PeriodResponse, FiscalYearGroup } from './periods.schema.js';
import { AppError, DomainError, NotFoundError } from '../../core/errors/index.js';
import type { EventBus } from '../../core/events/event-bus.js';
import { getFinanceSettings } from './settings.service.js';

// ---------------------------------------------------------------------------
// Prisma select shape — only return API-contract-defined fields
// ---------------------------------------------------------------------------

const PERIOD_SELECT = {
  id: true,
  name: true,
  periodNumber: true,
  fiscalYear: true,
  startDate: true,
  endDate: true,
  status: true,
  closedAt: true,
  closedBy: true,
  lockedAt: true,
  lockedBy: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Month names for period naming */
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/**
 * Get the number of days in a given month/year.
 * Month is 1-based (1 = January).
 */
function daysInMonth(year: number, month: number): number {
  // Use Date constructor: month is 0-based, day 0 = last day of prev month
  return new Date(year, month, 0).getDate();
}

/**
 * Normalise a Prisma FinancialPeriod row to the API response shape.
 * Converts Date objects to ISO date strings for startDate/endDate/closedAt/lockedAt.
 */
/** Extract YYYY-MM-DD from a Date */
function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function normalisePeriod(row: Record<string, unknown>): PeriodResponse {
  return {
    id: row.id as string,
    name: row.name as string,
    periodNumber: row.periodNumber as number,
    fiscalYear: row.fiscalYear as number,
    startDate: row.startDate instanceof Date ? toDateString(row.startDate) : String(row.startDate),
    endDate: row.endDate instanceof Date ? toDateString(row.endDate) : String(row.endDate),
    status: row.status as 'OPEN' | 'CLOSED' | 'LOCKED',
    closedAt:
      row.closedAt instanceof Date ? row.closedAt.toISOString() : (row.closedAt as string | null),
    closedBy: row.closedBy as string | null,
    lockedAt:
      row.lockedAt instanceof Date ? row.lockedAt.toISOString() : (row.lockedAt as string | null),
    lockedBy: row.lockedBy as string | null,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  };
}

// ---------------------------------------------------------------------------
// createFiscalYear (AC-1)
// ---------------------------------------------------------------------------

/**
 * Create all monthly periods for a fiscal year, plus optional Period 13.
 * Reads fiscalYearStartMonth from finance settings.
 *
 * Example: fiscalYear=2026, startMonth=4 (April)
 *   Period 1: April 1 2026 - April 30 2026
 *   Period 2: May 1 2026 - May 31 2026
 *   ...
 *   Period 12: March 1 2027 - March 31 2027
 *   Period 13 (optional): March 31 2027 - March 31 2027
 */
export async function createFiscalYear(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  fiscalYear: number,
  includeP13: boolean,
  userId: string,
): Promise<PeriodResponse[]> {
  // Get fiscal year start month from finance settings
  const settings = await getFinanceSettings(prisma, companyId);
  const startMonth = settings.general.fiscalYearStartMonth; // 1-12

  // Check for duplicate year (AC-6)
  const existing = await prisma.financialPeriod.findFirst({
    where: { companyId, fiscalYear },
    select: { id: true },
  });

  if (existing) {
    throw new AppError(
      'DUPLICATE_FISCAL_YEAR',
      `Fiscal year ${String(fiscalYear)} already exists for this company`,
      409,
    );
  }

  // Build period data
  const periodsData: Array<{
    companyId: string;
    name: string;
    periodNumber: number;
    fiscalYear: number;
    startDate: Date;
    endDate: Date;
  }> = [];

  for (let i = 0; i < 12; i++) {
    const periodNumber = i + 1;
    // Calculate the actual month (1-based) and year for this period
    const actualMonth = ((startMonth - 1 + i) % 12) + 1;
    const actualYear = startMonth + i > 12 ? fiscalYear + 1 : fiscalYear;

    const startDate = new Date(Date.UTC(actualYear, actualMonth - 1, 1));
    const endDay = daysInMonth(actualYear, actualMonth);
    const endDate = new Date(Date.UTC(actualYear, actualMonth - 1, endDay));

    const monthName = MONTH_NAMES[actualMonth - 1];
    const name = `${monthName} ${String(actualYear)}`;

    periodsData.push({
      companyId,
      name,
      periodNumber,
      fiscalYear,
      startDate,
      endDate,
    });
  }

  // Period 13: year-end adjustments (optional)
  if (includeP13 && periodsData.length > 0) {
    const lastPeriod = periodsData[periodsData.length - 1]!;
    const firstPeriod = periodsData[0]!;
    const endYear = lastPeriod.endDate.getUTCFullYear();
    const startYear = firstPeriod.startDate.getUTCFullYear();

    const p13Name =
      startYear === endYear
        ? `Year-End Adjustments ${String(fiscalYear)}`
        : `Year-End Adjustments ${String(startYear)}/${String(endYear).slice(2)}`;

    periodsData.push({
      companyId,
      name: p13Name,
      periodNumber: 13,
      fiscalYear,
      startDate: lastPeriod.endDate, // Same day as last period end
      endDate: lastPeriod.endDate,
    });
  }

  // Create all periods in a transaction
  const created = await prisma.$transaction(async (tx) => {
    const results: Array<Record<string, unknown>> = [];

    for (const data of periodsData) {
      const period = await tx.financialPeriod.create({
        data,
        select: PERIOD_SELECT,
      });
      results.push(period as unknown as Record<string, unknown>);
    }

    return results;
  });

  // Emit event
  eventBus.emit('financialPeriod.yearCreated', {
    companyId,
    fiscalYear,
    periodCount: created.length,
    includeP13,
    createdBy: userId,
  });

  return created.map(normalisePeriod);
}

// ---------------------------------------------------------------------------
// listPeriods (AC-2)
// ---------------------------------------------------------------------------

/**
 * List all financial periods, optionally filtered, grouped by fiscal year.
 */
export async function listPeriods(
  prisma: PrismaClient,
  companyId: string,
  query: ListPeriodsQuery,
): Promise<FiscalYearGroup[]> {
  const where: Record<string, unknown> = { companyId };
  if (query.fiscalYear !== undefined) where.fiscalYear = query.fiscalYear;
  if (query.status !== undefined) where.status = query.status;

  const periods = await prisma.financialPeriod.findMany({
    where,
    orderBy: [{ fiscalYear: 'desc' }, { periodNumber: 'asc' }],
    select: PERIOD_SELECT,
  });

  // Group by fiscal year
  const groupMap = new Map<number, PeriodResponse[]>();
  for (const period of periods) {
    const row = period as unknown as Record<string, unknown>;
    const fy = row.fiscalYear as number;
    if (!groupMap.has(fy)) {
      groupMap.set(fy, []);
    }
    groupMap.get(fy)!.push(normalisePeriod(row));
  }

  // Build response with summaries
  const result: FiscalYearGroup[] = [];
  for (const [fy, fyPeriods] of groupMap) {
    result.push({
      fiscalYear: fy,
      periods: fyPeriods,
      summary: {
        total: fyPeriods.length,
        open: fyPeriods.filter((p) => p.status === 'OPEN').length,
        closed: fyPeriods.filter((p) => p.status === 'CLOSED').length,
        locked: fyPeriods.filter((p) => p.status === 'LOCKED').length,
      },
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// closePeriod (AC-3)
// ---------------------------------------------------------------------------

/**
 * Transition a period from OPEN to CLOSED.
 */
export async function closePeriod(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  periodId: string,
  userId: string,
): Promise<PeriodResponse> {
  const updated = await prisma.$transaction(async (tx) => {
    const period = await tx.financialPeriod.findFirst({
      where: { id: periodId, companyId },
      select: PERIOD_SELECT,
    });

    if (!period) {
      throw new NotFoundError('NOT_FOUND', 'Financial period not found');
    }

    if (period.status !== 'OPEN') {
      throw new DomainError(
        'INVALID_STATUS_TRANSITION',
        `Cannot close period: current status is ${period.status}, must be OPEN`,
      );
    }

    return tx.financialPeriod.update({
      where: { id: periodId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        closedBy: userId,
      },
      select: PERIOD_SELECT,
    });
  });

  eventBus.emit('financialPeriod.closed', {
    periodId,
    companyId,
    fiscalYear: updated.fiscalYear,
    periodNumber: updated.periodNumber,
    closedBy: userId,
  });

  return normalisePeriod(updated as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// reopenPeriod (AC-4)
// ---------------------------------------------------------------------------

/**
 * Transition a period from CLOSED to OPEN.
 * Cannot reopen a LOCKED period (BR-FIN-016).
 */
export async function reopenPeriod(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  periodId: string,
  userId: string,
): Promise<PeriodResponse> {
  const updated = await prisma.$transaction(async (tx) => {
    const period = await tx.financialPeriod.findFirst({
      where: { id: periodId, companyId },
      select: PERIOD_SELECT,
    });

    if (!period) {
      throw new NotFoundError('NOT_FOUND', 'Financial period not found');
    }

    if (period.status === 'LOCKED') {
      throw new DomainError(
        'PERIOD_LOCKED',
        'Cannot reopen a locked period (BR-FIN-016: locking is irreversible)',
      );
    }

    if (period.status !== 'CLOSED') {
      throw new DomainError(
        'INVALID_STATUS_TRANSITION',
        `Cannot reopen period: current status is ${period.status}, must be CLOSED`,
      );
    }

    return tx.financialPeriod.update({
      where: { id: periodId },
      data: {
        status: 'OPEN',
        closedAt: null,
        closedBy: null,
      },
      select: PERIOD_SELECT,
    });
  });

  // Use existing event type from event bus
  eventBus.emit('period.unlocked', {
    periodId,
    year: updated.fiscalYear,
    periodNumber: updated.periodNumber,
    unlockedBy: userId,
  });

  return normalisePeriod(updated as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// lockPeriod (AC-5)
// ---------------------------------------------------------------------------

/**
 * Transition a period from CLOSED to LOCKED. Irreversible (BR-FIN-016).
 * Cannot lock an OPEN period directly — must close first (AC-6).
 */
export async function lockPeriod(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  periodId: string,
  userId: string,
): Promise<PeriodResponse> {
  const updated = await prisma.$transaction(async (tx) => {
    const period = await tx.financialPeriod.findFirst({
      where: { id: periodId, companyId },
      select: PERIOD_SELECT,
    });

    if (!period) {
      throw new NotFoundError('NOT_FOUND', 'Financial period not found');
    }

    if (period.status === 'LOCKED') {
      throw new DomainError('PERIOD_ALREADY_LOCKED', 'Period is already locked');
    }

    if (period.status === 'OPEN') {
      throw new DomainError(
        'CANNOT_LOCK_OPEN_PERIOD',
        'Cannot lock an OPEN period — close it first',
      );
    }

    return tx.financialPeriod.update({
      where: { id: periodId },
      data: {
        status: 'LOCKED',
        lockedAt: new Date(),
        lockedBy: userId,
      },
      select: PERIOD_SELECT,
    });
  });

  // Use existing event type from event bus
  eventBus.emit('period.locked', {
    periodId,
    year: updated.fiscalYear,
    periodNumber: updated.periodNumber,
    lockedBy: userId,
  });

  return normalisePeriod(updated as unknown as Record<string, unknown>);
}
