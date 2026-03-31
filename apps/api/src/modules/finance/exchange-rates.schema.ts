import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum constants (matching Prisma-generated ExchangeRateSource)
// ---------------------------------------------------------------------------

export const EXCHANGE_RATE_SOURCES = ['BOE', 'ECB', 'MANUAL'] as const;

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createExchangeRateSchema = z.object({
  currencyCode: z
    .string()
    .length(3, 'Currency code must be exactly 3 characters')
    .regex(/^[A-Z]{3}$/, 'Currency code must be 3 uppercase letters'),
  rateDate: z.coerce.date(),
  buyRate: z.number().positive('Buy rate must be positive'),
  sellRate: z.number().positive('Sell rate must be positive'),
  midRate: z.number().positive('Mid rate must be positive'),
  source: z.enum(EXCHANGE_RATE_SOURCES).default('MANUAL'),
});

export const fetchExchangeRatesSchema = z.object({
  baseCurrency: z
    .string()
    .length(3, 'Currency code must be exactly 3 characters')
    .regex(/^[A-Z]{3}$/, 'Currency code must be 3 uppercase letters')
    .default('GBP'),
  currencies: z
    .array(
      z
        .string()
        .length(3)
        .regex(/^[A-Z]{3}$/),
    )
    .min(1, 'At least one currency must be specified')
    .optional(),
});

// ---------------------------------------------------------------------------
// Params & Query Schemas
// ---------------------------------------------------------------------------

export const exchangeRateParamsSchema = z.object({
  currencyCode: z
    .string()
    .length(3, 'Currency code must be exactly 3 characters')
    .regex(/^[A-Z]{3}$/, 'Currency code must be 3 uppercase letters'),
});

export const listExchangeRatesQuerySchema = z.object({
  currencyCode: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/)
    .optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  source: z.enum(EXCHANGE_RATE_SOURCES).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const exchangeRateItemSchema = z.object({
  id: z.string().uuid(),
  currencyCode: z.string(),
  rateDate: z.coerce.date(),
  buyRate: z.number(),
  sellRate: z.number(),
  midRate: z.number(),
  source: z.enum(EXCHANGE_RATE_SOURCES),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const exchangeRateDetailSchema = exchangeRateItemSchema;

export const fetchResultSchema = z.object({
  fetched: z.number(),
  rates: z.array(exchangeRateItemSchema),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateExchangeRateInput = z.infer<typeof createExchangeRateSchema>;
export type FetchExchangeRatesInput = z.infer<typeof fetchExchangeRatesSchema>;
export type ListExchangeRatesQuery = z.infer<typeof listExchangeRatesQuerySchema>;
export type ExchangeRateItem = z.infer<typeof exchangeRateItemSchema>;
