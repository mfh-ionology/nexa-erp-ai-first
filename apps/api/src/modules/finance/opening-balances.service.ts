import type { PrismaClient } from '@nexa/db';

import type { OpeningBalanceLine } from './opening-balances.schema.js';
import { createGlPosting, type GlPostingInput } from './journals.service.js';
import { AppError, DomainError } from '../../core/errors/index.js';
import type { EventBus } from '../../core/events/event-bus.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SUSPENSE_CODE = '9999';
const OPENING_BALANCE_DESCRIPTION = 'Opening Balances';

// ---------------------------------------------------------------------------
// CSV Parser
// ---------------------------------------------------------------------------

/**
 * Parse CSV with columns: AccountCode, Debit, Credit.
 * Header row is required. Returns validated lines.
 */
export function parseOpeningBalancesCsv(content: string): OpeningBalanceLine[] {
  const rawLines = content.split(/\r?\n/);

  // Filter out leading/trailing blank lines but keep the structure
  // so we can distinguish "header only" from "header + empty rows"
  const headerLine = rawLines[0]?.trim();
  if (!headerLine) {
    throw new AppError('INVALID_CSV', 'CSV must have a header row', 400);
  }

  // Check there is at least one line after the header (even if blank)
  const dataLines = rawLines.slice(1);
  const hasAnyDataLine = dataLines.some((l) => l.trim().length > 0);
  if (rawLines.length < 2 || !hasAnyDataLine) {
    // If only the header remains after removing blank lines, distinguish
    // "header only" from "header + blank data rows"
    if (dataLines.length > 0) {
      // There were data lines but they were all blank/whitespace
      throw new AppError('EMPTY_CSV', 'CSV contains no valid data rows', 400);
    }
    throw new AppError('INVALID_CSV', 'CSV must have a header row and at least one data row', 400);
  }

  // Validate header (case-insensitive, whitespace-tolerant)
  const header = headerLine.toLowerCase().replace(/\s+/g, '');
  if (!header.startsWith('accountcode,debit,credit')) {
    throw new AppError(
      'INVALID_CSV_HEADER',
      'CSV header must contain: AccountCode, Debit, Credit',
      400,
    );
  }

  const lines: OpeningBalanceLine[] = [];

  for (let i = 1; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    if (!rawLine) continue;
    const line = rawLine.trim();
    if (!line) continue;

    const fields = parseCSVLine(line);

    if (fields.length < 3) {
      throw new AppError(
        'INVALID_CSV_ROW',
        `Row ${i + 1}: expected at least 3 fields (AccountCode, Debit, Credit), got ${fields.length}`,
        400,
      );
    }

    const accountCode = (fields[0] ?? '').trim();
    const debitStr = (fields[1] ?? '').trim();
    const creditStr = (fields[2] ?? '').trim();

    if (!accountCode) {
      throw new AppError('INVALID_CSV_ROW', `Row ${i + 1}: AccountCode is required`, 400);
    }

    const debit = debitStr === '' ? 0 : parseFloat(debitStr);
    const credit = creditStr === '' ? 0 : parseFloat(creditStr);

    if (isNaN(debit)) {
      throw new AppError(
        'INVALID_CSV_AMOUNT',
        `Row ${i + 1}: invalid debit amount "${debitStr}"`,
        400,
      );
    }
    if (isNaN(credit)) {
      throw new AppError(
        'INVALID_CSV_AMOUNT',
        `Row ${i + 1}: invalid credit amount "${creditStr}"`,
        400,
      );
    }
    if (debit < 0) {
      throw new AppError('INVALID_CSV_AMOUNT', `Row ${i + 1}: debit must be >= 0`, 400);
    }
    if (credit < 0) {
      throw new AppError('INVALID_CSV_AMOUNT', `Row ${i + 1}: credit must be >= 0`, 400);
    }
    if (debit === 0 && credit === 0) {
      // Skip zero lines
      continue;
    }

    lines.push({ accountCode, debit, credit });
  }

  if (lines.length === 0) {
    throw new AppError('EMPTY_CSV', 'CSV contains no valid data rows', 400);
  }

  return lines;
}

/**
 * Parse a single CSV line, handling quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Look up the suspense account code from the SUSPENSE account mapping.
 * Falls back to DEFAULT_SUSPENSE_CODE if no mapping is configured.
 */
async function getSuspenseAccountCode(prisma: PrismaClient, companyId: string): Promise<string> {
  const mapping = await prisma.accountMapping.findFirst({
    where: { companyId, mappingType: 'SUSPENSE' },
    select: { accountCode: true },
  });

  return mapping?.accountCode ?? DEFAULT_SUSPENSE_CODE;
}

/**
 * Get the start date of the current fiscal year for a company.
 * Looks at the earliest open period.
 */
async function getFiscalYearStartDate(prisma: PrismaClient, companyId: string): Promise<Date> {
  const firstPeriod = await prisma.financialPeriod.findFirst({
    where: { companyId, status: 'OPEN' },
    orderBy: [{ fiscalYear: 'asc' }, { periodNumber: 'asc' }],
    select: { startDate: true, fiscalYear: true },
  });

  if (!firstPeriod) {
    throw new AppError(
      'NO_OPEN_PERIOD',
      'No open financial period found. Create fiscal year periods before importing opening balances.',
      400,
    );
  }

  return firstPeriod.startDate;
}

/**
 * Check whether an OPENING_BALANCE journal already exists for the given fiscal year.
 * AC-5: Only one opening balance import per fiscal year.
 */
async function checkExistingOpeningBalance(
  prisma: PrismaClient,
  companyId: string,
  transactionDate: Date,
): Promise<void> {
  // Find the fiscal year of the transaction date
  const period = await prisma.financialPeriod.findFirst({
    where: {
      companyId,
      startDate: { lte: transactionDate },
      endDate: { gte: transactionDate },
    },
    select: { fiscalYear: true },
  });

  if (!period) {
    throw new AppError(
      'NO_PERIOD_FOR_DATE',
      'No financial period found for the specified transaction date',
      400,
    );
  }

  // Check for existing OPENING_BALANCE journals in any period of this fiscal year
  const allPeriodsInYear = await prisma.financialPeriod.findMany({
    where: { companyId, fiscalYear: period.fiscalYear },
    select: { id: true },
  });

  const periodIds = allPeriodsInYear.map((p) => p.id);

  const existing = await prisma.journalEntry.findFirst({
    where: {
      companyId,
      source: 'OPENING_BALANCE',
      periodId: { in: periodIds },
    },
    select: { id: true, entryNumber: true },
  });

  if (existing) {
    throw new DomainError(
      'OPENING_BALANCE_EXISTS',
      `Opening balance already exists for fiscal year ${String(period.fiscalYear)} (journal ${existing.entryNumber}). Only one opening balance import per fiscal year is allowed.`,
    );
  }
}

/**
 * Import opening balances by creating a journal entry with source=OPENING_BALANCE.
 *
 * - Validates all account codes exist and are postable (AC-3)
 * - Checks that no OPENING_BALANCE journal already exists for the fiscal year (AC-5)
 * - Adds a suspense line if debits != credits (AC-4)
 * - Creates the journal via createGlPosting()
 */
export async function importOpeningBalances(
  prisma: PrismaClient,
  eventBus: EventBus,
  companyId: string,
  userId: string,
  lines: OpeningBalanceLine[],
  transactionDate?: Date,
  description?: string,
): Promise<{
  journalEntry: Record<string, unknown>;
  lineCount: number;
  suspenseAdded: boolean;
  suspenseAmount: number;
}> {
  // Determine transaction date: use provided or fiscal year start
  const effectiveDate = transactionDate ?? (await getFiscalYearStartDate(prisma, companyId));

  // AC-5: Check for existing opening balance in this fiscal year
  await checkExistingOpeningBalance(prisma, companyId, effectiveDate);

  // Calculate totals
  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of lines) {
    totalDebit += line.debit;
    totalCredit += line.credit;
  }

  // Build GL posting lines
  const glLines: GlPostingInput['lines'] = lines.map((line) => ({
    accountCode: line.accountCode,
    debit: line.debit,
    credit: line.credit,
    description: 'Opening Balance',
  }));

  // AC-4: Add suspense line if unbalanced
  let suspenseAdded = false;
  let suspenseAmount = 0;
  const diff = Math.abs(totalDebit - totalCredit);

  if (diff > 0.0001) {
    const suspenseCode = await getSuspenseAccountCode(prisma, companyId);
    suspenseAmount = Math.round(diff * 100) / 100; // round to 2dp

    if (totalDebit > totalCredit) {
      // Need more credit to balance
      glLines.push({
        accountCode: suspenseCode,
        debit: 0,
        credit: suspenseAmount,
        description: 'Opening Balance — Suspense (auto-balance)',
      });
    } else {
      // Need more debit to balance
      glLines.push({
        accountCode: suspenseCode,
        debit: suspenseAmount,
        credit: 0,
        description: 'Opening Balance — Suspense (auto-balance)',
      });
    }
    suspenseAdded = true;
  }

  // Create journal entry via shared GL posting function
  const postingInput: GlPostingInput = {
    transactionDate: effectiveDate,
    description: description ?? OPENING_BALANCE_DESCRIPTION,
    source: 'OPENING_BALANCE',
    sourceReference: 'OPENING_BALANCE_IMPORT',
    lines: glLines,
  };

  const journalEntry = await createGlPosting(prisma, eventBus, companyId, postingInput, userId);

  return {
    journalEntry: journalEntry as unknown as Record<string, unknown>,
    lineCount: lines.length,
    suspenseAdded,
    suspenseAmount,
  };
}
