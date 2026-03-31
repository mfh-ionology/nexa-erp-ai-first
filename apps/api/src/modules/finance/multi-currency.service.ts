import type { PrismaClient } from '@nexa/db';
import { Prisma } from '@nexa/db';
import { AppError, DomainError } from '../../core/errors/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CurrencyConversionResult {
  /** The foreign currency code (e.g. USD, EUR) */
  currencyCode: string;
  /** The original amount in foreign currency */
  foreignAmount: number;
  /** The exchange rate used (foreign → base) */
  exchangeRate: number;
  /** The base-currency debit amount */
  debit: number;
  /** The base-currency credit amount */
  credit: number;
}

export interface ExchangeGainLossResult {
  /** Positive = gain, negative = loss */
  amount: number;
  /** The original exchange rate at transaction time */
  originalRate: number;
  /** The settlement exchange rate */
  settlementRate: number;
  /** The foreign currency code */
  currencyCode: string;
}

// ---------------------------------------------------------------------------
// Exchange rate lookup
// ---------------------------------------------------------------------------

/**
 * Look up the latest exchange rate for a currency on or before a given date.
 * Uses the midRate by default. Returns the rate as a number.
 *
 * @param tx - Prisma transaction client or PrismaClient
 * @param companyId - The company ID for tenant isolation
 * @param currencyCode - The foreign currency code (e.g. 'USD')
 * @param date - The transaction date; finds the latest rate on or before this date
 * @returns The mid exchange rate as a number
 * @throws DomainError if no exchange rate is found
 */
export async function lookupExchangeRate(
  tx: PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  companyId: string,
  currencyCode: string,
  date: Date,
): Promise<number> {
  // Find the latest rate on or before the transaction date
  const rate = await (tx as PrismaClient).exchangeRate.findFirst({
    where: {
      companyId,
      currencyCode,
      rateDate: { lte: date },
    },
    orderBy: { rateDate: 'desc' },
    select: { midRate: true, rateDate: true },
  });

  if (!rate) {
    throw new DomainError(
      'EXCHANGE_RATE_NOT_FOUND',
      `No exchange rate found for ${currencyCode} on or before ${date.toISOString().slice(0, 10)}. Please add an exchange rate first.`,
    );
  }

  return toNumber(rate.midRate as unknown as Prisma.Decimal);
}

// ---------------------------------------------------------------------------
// Currency conversion
// ---------------------------------------------------------------------------

/**
 * Convert a journal line's foreign currency amount to base currency.
 *
 * When a line has `currencyCode` set (not null, not the base currency):
 * - If `exchangeRate` is provided, use it directly
 * - If `exchangeRate` is not provided, look it up from the ExchangeRate table
 * - Calculate base currency: foreignAmount * exchangeRate
 * - The result replaces the line's debit/credit with base currency equivalents
 *
 * The caller determines whether the foreign amount is a debit or credit based on
 * which field (debit/credit) is non-zero on the original line, or by the sign
 * convention where positive foreignAmount maps to debit and negative to credit.
 *
 * @param tx - Prisma transaction client
 * @param companyId - The company ID
 * @param baseCurrencyCode - The company's base currency code (e.g. 'GBP')
 * @param transactionDate - The transaction date for rate lookup
 * @param line - The journal line input with optional currency fields
 * @returns The line with base currency debit/credit calculated, or unchanged if no foreign currency
 */
export async function convertLineToBaseCurrency(
  tx: PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  companyId: string,
  baseCurrencyCode: string,
  transactionDate: Date,
  line: {
    accountCode: string;
    description?: string | null;
    debit: number;
    credit: number;
    vatCode?: string | null;
    currencyCode?: string | null;
    foreignAmount?: number | null;
    exchangeRate?: number | null;
    dimensions?: Array<{ dimensionValueId: string }>;
  },
): Promise<{
  accountCode: string;
  description?: string | null;
  debit: number;
  credit: number;
  vatCode?: string | null;
  currencyCode: string | null;
  foreignAmount: number | null;
  exchangeRate: number | null;
  dimensions?: Array<{ dimensionValueId: string }>;
}> {
  // No foreign currency — pass through unchanged
  if (!line.currencyCode || line.currencyCode === baseCurrencyCode) {
    return {
      ...line,
      currencyCode: line.currencyCode ?? null,
      foreignAmount: line.foreignAmount ?? null,
      exchangeRate: line.exchangeRate ?? null,
    };
  }

  // Foreign currency line must have foreignAmount
  if (line.foreignAmount == null || line.foreignAmount === 0) {
    throw new DomainError(
      'FOREIGN_AMOUNT_REQUIRED',
      `Line for account "${line.accountCode}" has currencyCode "${line.currencyCode}" but no foreignAmount. Foreign currency lines require a foreignAmount.`,
    );
  }

  // Determine exchange rate: use provided or look up
  let rate = line.exchangeRate;
  if (rate == null || rate === 0) {
    rate = await lookupExchangeRate(tx, companyId, line.currencyCode, transactionDate);
  }

  if (rate <= 0) {
    throw new DomainError(
      'INVALID_EXCHANGE_RATE',
      `Exchange rate must be positive, got ${String(rate)} for ${line.currencyCode}`,
    );
  }

  // Calculate base currency amount
  const baseAmount = roundToFour(Math.abs(line.foreignAmount) * rate);

  // Determine debit/credit direction based on the original line
  // If the original line has debit > 0, this is a debit line in foreign currency
  // If the original line has credit > 0, this is a credit line
  // If both are 0, use the sign of foreignAmount (positive = debit, negative = credit)
  let debit: number;
  let credit: number;

  if (line.debit > 0 && line.credit === 0) {
    // Explicit debit line
    debit = baseAmount;
    credit = 0;
  } else if (line.credit > 0 && line.debit === 0) {
    // Explicit credit line
    debit = 0;
    credit = baseAmount;
  } else if (line.debit === 0 && line.credit === 0) {
    // Direction from foreignAmount sign
    if (line.foreignAmount > 0) {
      debit = baseAmount;
      credit = 0;
    } else {
      debit = 0;
      credit = baseAmount;
    }
  } else {
    // Both debit and credit are set — use them as-is (caller knows best)
    debit = line.debit;
    credit = line.credit;
  }

  return {
    accountCode: line.accountCode,
    description: line.description,
    debit,
    credit,
    vatCode: line.vatCode,
    currencyCode: line.currencyCode,
    foreignAmount: line.foreignAmount,
    exchangeRate: rate,
    dimensions: line.dimensions,
  };
}

/**
 * Convert all lines in a journal entry, resolving foreign currency amounts to base currency.
 * Lines without currencyCode (or with base currency) are returned unchanged.
 */
export async function convertLinesToBaseCurrency(
  tx: PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  companyId: string,
  baseCurrencyCode: string,
  transactionDate: Date,
  lines: Array<{
    accountCode: string;
    description?: string | null;
    debit: number;
    credit: number;
    vatCode?: string | null;
    currencyCode?: string | null;
    foreignAmount?: number | null;
    exchangeRate?: number | null;
    dimensions?: Array<{ dimensionValueId: string }>;
  }>,
): Promise<
  Array<{
    accountCode: string;
    description?: string | null;
    debit: number;
    credit: number;
    vatCode?: string | null;
    currencyCode: string | null;
    foreignAmount: number | null;
    exchangeRate: number | null;
    dimensions?: Array<{ dimensionValueId: string }>;
  }>
> {
  const converted = [];
  for (const line of lines) {
    converted.push(
      await convertLineToBaseCurrency(tx, companyId, baseCurrencyCode, transactionDate, line),
    );
  }
  return converted;
}

/**
 * Fetch the base currency code for a company from CompanyProfile.
 */
export async function getBaseCurrencyCode(
  tx: PrismaClient | Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  companyId: string,
): Promise<string> {
  const company = await (tx as PrismaClient).companyProfile.findUnique({
    where: { id: companyId },
    select: { baseCurrencyCode: true },
  });

  if (!company) {
    throw new AppError('COMPANY_NOT_FOUND', `Company ${companyId} not found`, 404);
  }

  return company.baseCurrencyCode;
}

// ---------------------------------------------------------------------------
// Exchange gain/loss stub (AC-4)
// ---------------------------------------------------------------------------

/**
 * Calculate exchange rate gain/loss on settlement.
 *
 * This is a stub for future use. When a foreign currency transaction is settled
 * (e.g. a payment against an invoice), the difference between the original rate
 * and the settlement rate creates a gain or loss.
 *
 * Formula: foreignAmount * (settlementRate - originalRate)
 *   Positive result = gain (favourable rate movement)
 *   Negative result = loss (unfavourable rate movement)
 *
 * @param foreignAmount - The original foreign currency amount
 * @param originalRate - The exchange rate at transaction time
 * @param settlementRate - The exchange rate at settlement time
 * @param currencyCode - The foreign currency code
 * @returns The gain/loss details
 */
export function calculateExchangeGainLoss(
  foreignAmount: number,
  originalRate: number,
  settlementRate: number,
  currencyCode: string,
): ExchangeGainLossResult {
  const amount = roundToFour(foreignAmount * (settlementRate - originalRate));

  return {
    amount,
    originalRate,
    settlementRate,
    currencyCode,
  };
}

/**
 * Create a GL posting for exchange gain/loss.
 *
 * STUB: This will be fully implemented when settlement flows are built.
 * The gain/loss should be posted to the configured exchange gain/loss accounts
 * from FinanceSettings.
 *
 * @param _companyId - Company ID
 * @param _gainLoss - The gain/loss calculation result
 * @param _gainAccountCode - Account code for exchange gains
 * @param _lossAccountCode - Account code for exchange losses
 * @returns The journal lines for the gain/loss posting (empty for now)
 */
export function createExchangeGainLossLines(
  _companyId: string,
  _gainLoss: ExchangeGainLossResult,
  _gainAccountCode: string,
  _lossAccountCode: string,
): Array<{
  accountCode: string;
  debit: number;
  credit: number;
  description: string;
  currencyCode: string;
  foreignAmount: number;
  exchangeRate: number;
}> {
  // STUB: Will be implemented with settlement flows in future stories
  // The implementation will:
  // 1. If gain (amount > 0): credit the gain account, debit the settlement account
  // 2. If loss (amount < 0): debit the loss account, credit the settlement account
  // 3. Return the journal lines for posting via createGlPosting
  return [];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round to 4 decimal places (matching Prisma Decimal(19,4)) */
function roundToFour(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/** Convert Prisma Decimal to number */
function toNumber(val: Prisma.Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return typeof val === 'number' ? val : Number(val);
}
