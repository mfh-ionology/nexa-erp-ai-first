import type { PrismaClient } from '@nexa/db';
import { Prisma } from '@nexa/db';
import type {
  CreateExchangeRateInput,
  FetchExchangeRatesInput,
  ListExchangeRatesQuery,
} from './exchange-rates.schema.js';
import { AppError, NotFoundError } from '../../core/errors/index.js';
import type { PaginationMeta } from '../../core/utils/response.js';

// ---------------------------------------------------------------------------
// Prisma select shape — only return API-contract-defined fields
// ---------------------------------------------------------------------------

const RATE_SELECT = {
  id: true,
  currencyCode: true,
  rateDate: true,
  buyRate: true,
  sellRate: true,
  midRate: true,
  source: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert Prisma Decimal fields to numbers for JSON serialisation */
function toNumber(val: Prisma.Decimal | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  return typeof val === 'number' ? val : Number(val);
}

/** Normalise a raw Prisma exchange rate row to the API shape */
function normaliseRate(row: Record<string, unknown>) {
  return {
    ...row,
    buyRate: toNumber(row.buyRate as Prisma.Decimal),
    sellRate: toNumber(row.sellRate as Prisma.Decimal),
    midRate: toNumber(row.midRate as Prisma.Decimal),
  };
}

// ---------------------------------------------------------------------------
// listExchangeRates (AC-1)
// ---------------------------------------------------------------------------

export async function listExchangeRates(
  prisma: PrismaClient,
  companyId: string,
  query: ListExchangeRatesQuery,
) {
  const { cursor, limit, currencyCode, dateFrom, dateTo, source } = query;

  const where: Record<string, unknown> = { companyId };
  if (currencyCode !== undefined) where.currencyCode = currencyCode;
  if (source !== undefined) where.source = source;

  // Date range filter
  if (dateFrom || dateTo) {
    const rateDateFilter: Record<string, Date> = {};
    if (dateFrom) rateDateFilter.gte = dateFrom;
    if (dateTo) rateDateFilter.lte = dateTo;
    where.rateDate = rateDateFilter;
  }

  const [items, total] = await Promise.all([
    prisma.exchangeRate.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: [{ rateDate: 'desc' }, { currencyCode: 'asc' }],
      select: RATE_SELECT,
    }),
    prisma.exchangeRate.count({ where }),
  ]);

  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, -1) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

  const mapped = data.map((row) => normaliseRate(row as unknown as Record<string, unknown>));

  const meta: PaginationMeta = { cursor: nextCursor, hasMore, total };

  return { data: mapped, meta };
}

// ---------------------------------------------------------------------------
// getLatestRate (AC-4)
// ---------------------------------------------------------------------------

export async function getLatestRate(prisma: PrismaClient, companyId: string, currencyCode: string) {
  const rate = await prisma.exchangeRate.findFirst({
    where: { companyId, currencyCode },
    orderBy: { rateDate: 'desc' },
    select: RATE_SELECT,
  });

  if (!rate) {
    throw new NotFoundError('NOT_FOUND', `No exchange rate found for currency ${currencyCode}`);
  }

  return normaliseRate(rate as unknown as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// createExchangeRate (AC-2)
// ---------------------------------------------------------------------------

export async function createExchangeRate(
  prisma: PrismaClient,
  companyId: string,
  data: CreateExchangeRateInput,
) {
  try {
    const rate = await prisma.exchangeRate.create({
      data: {
        companyId,
        currencyCode: data.currencyCode,
        rateDate: data.rateDate,
        buyRate: data.buyRate,
        sellRate: data.sellRate,
        midRate: data.midRate,
        source: data.source ?? 'MANUAL',
      },
      select: RATE_SELECT,
    });

    return normaliseRate(rate as unknown as Record<string, unknown>);
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      throw new AppError(
        'DUPLICATE_RATE',
        `Exchange rate already exists for ${data.currencyCode} on ${data.rateDate.toISOString().split('T')[0]}`,
        409,
      );
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// fetchBoeRates — stub for MVP (AC-3)
// ---------------------------------------------------------------------------

/**
 * BOE rate fetch stub — returns mock data for MVP.
 * In production this would call the Bank of England Statistical Interactive
 * Database API to retrieve daily spot exchange rates.
 */
export async function fetchBoeRates(
  prisma: PrismaClient,
  companyId: string,
  input: FetchExchangeRatesInput,
) {
  const today = new Date();
  // Zero out time portion for date-only comparison
  const rateDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const currencies = input.currencies ?? ['USD', 'EUR'];

  // Mock BOE rates — realistic approximate values
  const mockRates: Record<string, { buy: number; sell: number; mid: number }> = {
    USD: { buy: 1.262, sell: 1.268, mid: 1.265 },
    EUR: { buy: 1.168, sell: 1.174, mid: 1.171 },
    JPY: { buy: 189.5, sell: 190.5, mid: 190.0 },
    CHF: { buy: 1.118, sell: 1.124, mid: 1.121 },
    CAD: { buy: 1.715, sell: 1.721, mid: 1.718 },
    AUD: { buy: 1.928, sell: 1.934, mid: 1.931 },
    NZD: { buy: 2.108, sell: 2.114, mid: 2.111 },
    SEK: { buy: 13.15, sell: 13.25, mid: 13.2 },
    NOK: { buy: 13.55, sell: 13.65, mid: 13.6 },
    DKK: { buy: 8.72, sell: 8.78, mid: 8.75 },
  };

  const created: Array<Record<string, unknown>> = [];

  for (const code of currencies) {
    const rates = mockRates[code];
    if (!rates) continue;

    try {
      const rate = await prisma.exchangeRate.create({
        data: {
          companyId,
          currencyCode: code,
          rateDate,
          buyRate: rates.buy,
          sellRate: rates.sell,
          midRate: rates.mid,
          source: 'BOE',
        },
        select: RATE_SELECT,
      });
      created.push(normaliseRate(rate as unknown as Record<string, unknown>));
    } catch (error: unknown) {
      // Skip duplicates — rate for this currency/date already exists
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        continue;
      }
      throw error;
    }
  }

  return { fetched: created.length, rates: created };
}
