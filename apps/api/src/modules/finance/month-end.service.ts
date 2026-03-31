import type { PrismaClient } from '@nexa/db';
import type { EventBus } from '../../core/events/event-bus.js';
import type { MonthEndChecklist, MonthEndStepCode, MonthEndStep } from './month-end.schema.js';
import { AppError, DomainError, NotFoundError } from '../../core/errors/index.js';
import { closePeriod } from './periods.service.js';

// ---------------------------------------------------------------------------
// Month-End Step Definitions (AC-3)
// ---------------------------------------------------------------------------

interface StepDefinition {
  code: MonthEndStepCode;
  name: string;
  autoCheck: boolean;
}

const MONTH_END_STEPS: StepDefinition[] = [
  { code: 'RECONCILE_BANKS', name: 'Reconcile all bank accounts', autoCheck: true },
  { code: 'REVIEW_UNPOSTED', name: 'Review and post/delete draft journals', autoCheck: true },
  { code: 'REVIEW_ACCRUALS', name: 'Review accruals and prepayments', autoCheck: false },
  { code: 'REVIEW_FIXED_ASSETS', name: 'Run depreciation (if applicable)', autoCheck: false },
  { code: 'REVIEW_VAT', name: 'Review VAT return', autoCheck: false },
  { code: 'CLOSE_PERIOD', name: 'Close the financial period', autoCheck: false },
];

// ---------------------------------------------------------------------------
// In-memory checklist state store (keyed by periodId)
// In production this would be stored in SystemSetting or a dedicated table.
// For now, re-derived from database state + in-memory manual completions.
// ---------------------------------------------------------------------------

interface StepCompletion {
  completedAt: string;
  completedBy: string;
}

interface MonthEndState {
  startedAt: string;
  startedBy: string;
  manualCompletions: Map<MonthEndStepCode, StepCompletion>;
  completedAt: string | null;
  completedBy: string | null;
}

/** In-memory state per period. Survives within the process lifetime. */
const monthEndStates = new Map<string, MonthEndState>();

// ---------------------------------------------------------------------------
// Auto-check helpers
// ---------------------------------------------------------------------------

/**
 * RECONCILE_BANKS: Check that all active bank accounts for the company have
 * at least one COMPLETED reconciliation with a statement date within the
 * period's date range.
 */
async function checkBanksReconciled(
  prisma: PrismaClient,
  companyId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<boolean> {
  // Get all active bank accounts for the company
  const bankAccounts = await prisma.bankAccount.findMany({
    where: { companyId, isActive: true },
    select: { id: true },
  });

  if (bankAccounts.length === 0) {
    // No bank accounts means nothing to reconcile — step is satisfied
    return true;
  }

  // For each bank account, check if a COMPLETED reconciliation exists within period
  for (const ba of bankAccounts) {
    const reconciliation = await prisma.bankReconciliation.findFirst({
      where: {
        bankAccountId: ba.id,
        companyId,
        status: 'COMPLETED',
        statementDate: { gte: periodStart, lte: periodEnd },
      },
      select: { id: true },
    });

    if (!reconciliation) {
      return false;
    }
  }

  return true;
}

/**
 * REVIEW_UNPOSTED: Check that no DRAFT journal entries exist for this period.
 */
async function checkNoDraftJournals(
  prisma: PrismaClient,
  companyId: string,
  periodId: string,
): Promise<boolean> {
  const draftCount = await prisma.journalEntry.count({
    where: {
      companyId,
      periodId,
      status: 'DRAFT',
    },
  });

  return draftCount === 0;
}

// ---------------------------------------------------------------------------
// Service: startMonthEnd (AC-1)
// ---------------------------------------------------------------------------

/**
 * Initiate month-end close for a period.
 * Creates an in-memory checklist state and returns the initial checklist.
 */
export async function startMonthEnd(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  periodId: string,
  userId: string,
): Promise<MonthEndChecklist> {
  // Validate period exists and belongs to company
  const period = await prisma.financialPeriod.findFirst({
    where: { id: periodId, companyId },
    select: {
      id: true,
      name: true,
      fiscalYear: true,
      periodNumber: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  });

  if (!period) {
    throw new NotFoundError('NOT_FOUND', 'Financial period not found');
  }

  if (period.status !== 'OPEN') {
    throw new DomainError(
      'PERIOD_NOT_OPEN',
      `Cannot start month-end close: period status is ${period.status}, must be OPEN`,
    );
  }

  // Check if already started
  if (monthEndStates.has(periodId)) {
    throw new AppError(
      'MONTH_END_ALREADY_STARTED',
      'Month-end close has already been started for this period',
      409,
    );
  }

  // Create state
  const now = new Date().toISOString();
  const state: MonthEndState = {
    startedAt: now,
    startedBy: userId,
    manualCompletions: new Map(),
    completedAt: null,
    completedBy: null,
  };
  monthEndStates.set(periodId, state);

  eventBus.emit('financialPeriod.closed', {
    periodId,
    companyId,
    fiscalYear: period.fiscalYear,
    periodNumber: period.periodNumber,
    closedBy: userId,
  });

  return buildChecklist(prisma, companyId, period, state);
}

// ---------------------------------------------------------------------------
// Service: getMonthEndChecklist (AC-2)
// ---------------------------------------------------------------------------

/**
 * Get the current month-end checklist for a period.
 * Auto-check steps are re-derived from database state each time.
 */
export async function getMonthEndChecklist(
  prisma: PrismaClient,
  companyId: string,
  periodId: string,
): Promise<MonthEndChecklist> {
  // Validate period exists
  const period = await prisma.financialPeriod.findFirst({
    where: { id: periodId, companyId },
    select: {
      id: true,
      name: true,
      fiscalYear: true,
      periodNumber: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  });

  if (!period) {
    throw new NotFoundError('NOT_FOUND', 'Financial period not found');
  }

  const state = monthEndStates.get(periodId) ?? null;

  return buildChecklist(prisma, companyId, period, state);
}

// ---------------------------------------------------------------------------
// Service: completeStep (AC-4)
// ---------------------------------------------------------------------------

/**
 * Mark a manual month-end step as done.
 */
export async function completeStep(
  prisma: PrismaClient,
  companyId: string,
  periodId: string,
  stepCode: MonthEndStepCode,
  userId: string,
): Promise<MonthEndChecklist> {
  // Validate period
  const period = await prisma.financialPeriod.findFirst({
    where: { id: periodId, companyId },
    select: {
      id: true,
      name: true,
      fiscalYear: true,
      periodNumber: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  });

  if (!period) {
    throw new NotFoundError('NOT_FOUND', 'Financial period not found');
  }

  const state = monthEndStates.get(periodId);
  if (!state) {
    throw new AppError(
      'MONTH_END_NOT_STARTED',
      'Month-end close has not been started for this period. Call POST /month-end/start first.',
      400,
    );
  }

  if (state.completedAt) {
    throw new AppError(
      'MONTH_END_ALREADY_COMPLETED',
      'Month-end close has already been completed for this period',
      409,
    );
  }

  // Validate step code is a valid manual step
  const stepDef = MONTH_END_STEPS.find((s) => s.code === stepCode);
  if (!stepDef) {
    throw new AppError('INVALID_STEP', `Unknown step code: ${stepCode}`, 400);
  }

  if (stepDef.autoCheck) {
    throw new DomainError(
      'STEP_AUTO_CHECKED',
      `Step ${stepCode} is auto-checked from database state and cannot be manually completed`,
    );
  }

  // Mark as completed
  state.manualCompletions.set(stepCode, {
    completedAt: new Date().toISOString(),
    completedBy: userId,
  });

  return buildChecklist(prisma, companyId, period, state);
}

// ---------------------------------------------------------------------------
// Service: closeMonthEnd (AC-5)
// ---------------------------------------------------------------------------

/**
 * Close the period after all month-end checklist steps are complete.
 * Delegates to periodsService.closePeriod for the actual period status change.
 */
export async function closeMonthEnd(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  periodId: string,
  userId: string,
): Promise<MonthEndChecklist> {
  // Validate period
  const period = await prisma.financialPeriod.findFirst({
    where: { id: periodId, companyId },
    select: {
      id: true,
      name: true,
      fiscalYear: true,
      periodNumber: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  });

  if (!period) {
    throw new NotFoundError('NOT_FOUND', 'Financial period not found');
  }

  const state = monthEndStates.get(periodId);
  if (!state) {
    throw new AppError(
      'MONTH_END_NOT_STARTED',
      'Month-end close has not been started for this period. Call POST /month-end/start first.',
      400,
    );
  }

  if (state.completedAt) {
    throw new AppError(
      'MONTH_END_ALREADY_COMPLETED',
      'Month-end close has already been completed for this period',
      409,
    );
  }

  // Build checklist to verify all steps are done
  const checklist = await buildChecklist(prisma, companyId, period, state);
  const incompleteSteps = checklist.steps.filter((s) => !s.completed);

  // Exclude CLOSE_PERIOD itself from the completeness check —
  // it gets marked done by THIS action
  const nonCloseIncomplete = incompleteSteps.filter((s) => s.code !== 'CLOSE_PERIOD');

  if (nonCloseIncomplete.length > 0) {
    const names = nonCloseIncomplete.map((s) => s.name).join(', ');
    throw new DomainError(
      'STEPS_INCOMPLETE',
      `Cannot close period: the following steps are not complete: ${names}`,
    );
  }

  // Close the period using the existing periods service
  await closePeriod(prisma, eventBus, companyId, periodId, userId);

  // Mark CLOSE_PERIOD step and overall completion
  const now = new Date().toISOString();
  state.manualCompletions.set('CLOSE_PERIOD', {
    completedAt: now,
    completedBy: userId,
  });
  state.completedAt = now;
  state.completedBy = userId;

  // Refresh period data after close
  const updatedPeriod = await prisma.financialPeriod.findFirst({
    where: { id: periodId, companyId },
    select: {
      id: true,
      name: true,
      fiscalYear: true,
      periodNumber: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  });

  return buildChecklist(prisma, companyId, updatedPeriod ?? period, state);
}

// ---------------------------------------------------------------------------
// Internal: Build the checklist response (re-derives auto-check status)
// ---------------------------------------------------------------------------

type PeriodInfo = {
  id: string;
  name: string;
  fiscalYear: number;
  periodNumber: number;
  startDate: Date;
  endDate: Date;
  status: string;
};

async function buildChecklist(
  prisma: PrismaClient,
  companyId: string,
  period: PeriodInfo,
  state: MonthEndState | null,
): Promise<MonthEndChecklist> {
  const steps: MonthEndStep[] = [];

  for (const stepDef of MONTH_END_STEPS) {
    let completed = false;
    let completedAt: string | null = null;
    let completedBy: string | null = null;

    if (stepDef.autoCheck && state) {
      // Auto-check from database
      if (stepDef.code === 'RECONCILE_BANKS') {
        completed = await checkBanksReconciled(prisma, companyId, period.startDate, period.endDate);
      } else if (stepDef.code === 'REVIEW_UNPOSTED') {
        completed = await checkNoDraftJournals(prisma, companyId, period.id);
      }
    } else if (state) {
      // Manual completion from in-memory state
      const completion = state.manualCompletions.get(stepDef.code);
      if (completion) {
        completed = true;
        completedAt = completion.completedAt;
        completedBy = completion.completedBy;
      }
    }

    steps.push({
      code: stepDef.code,
      name: stepDef.name,
      autoCheck: stepDef.autoCheck,
      completed,
      completedAt,
      completedBy,
    });
  }

  // Determine overall status
  let status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' = 'NOT_STARTED';
  if (state) {
    const allDone = steps.every((s) => s.completed);
    status = allDone ? 'COMPLETED' : 'IN_PROGRESS';
  }

  return {
    periodId: period.id,
    periodName: period.name,
    fiscalYear: period.fiscalYear,
    periodNumber: period.periodNumber,
    status,
    steps,
    startedAt: state?.startedAt ?? null,
    startedBy: state?.startedBy ?? null,
    completedAt: state?.completedAt ?? null,
    completedBy: state?.completedBy ?? null,
  };
}

// ---------------------------------------------------------------------------
// Testing utility: reset in-memory state
// ---------------------------------------------------------------------------

/** @internal — only for testing */
export function _resetMonthEndStates(): void {
  monthEndStates.clear();
}
