import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum constants
// ---------------------------------------------------------------------------

export const OPEN_BANKING_STATUSES = ['DISCONNECTED', 'CONNECTED', 'PENDING', 'ERROR'] as const;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Sort code: exactly 6 digits */
const sortCodeSchema = z.string().regex(/^\d{6}$/, 'Sort code must be exactly 6 digits');

/** Account number: exactly 8 digits */
const accountNumberSchema = z.string().regex(/^\d{8}$/, 'Account number must be exactly 8 digits');

/** IBAN: 2 letter country code + 2 check digits + up to 30 alphanumeric */
const ibanSchema = z
  .string()
  .max(34, 'IBAN must not exceed 34 characters')
  .regex(
    /^[A-Z]{2}\d{2}[A-Za-z0-9]{1,30}$/,
    'IBAN must be 2-letter country code + 2 check digits + up to 30 alphanumeric characters',
  );

/** SWIFT/BIC: 8 or 11 alphanumeric characters */
const swiftBicSchema = z
  .string()
  .max(11, 'SWIFT/BIC must not exceed 11 characters')
  .regex(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/, 'Invalid SWIFT/BIC format');

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createBankAccountSchema = z.object({
  name: z.string().min(1, 'Bank account name is required').max(255),
  sortCode: sortCodeSchema.optional(),
  accountNumber: accountNumberSchema.optional(),
  iban: ibanSchema.optional(),
  swiftBic: swiftBicSchema.optional(),
  currencyCode: z.string().max(3).default('GBP'),
  glAccountCode: z.string().min(1, 'GL account code is required').max(20),
  isActive: z.boolean().default(true),
});

export const updateBankAccountSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    sortCode: sortCodeSchema.nullable().optional(),
    accountNumber: accountNumberSchema.nullable().optional(),
    iban: ibanSchema.nullable().optional(),
    swiftBic: swiftBicSchema.nullable().optional(),
    currencyCode: z.string().max(3).optional(),
    glAccountCode: z.string().min(1).max(20).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided for update',
  });

// ---------------------------------------------------------------------------
// Params & Query Schemas
// ---------------------------------------------------------------------------

export const bankAccountParamsSchema = z.object({
  id: z.uuid(),
});

export const listBankAccountsQuerySchema = z.object({
  search: z.string().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  currencyCode: z.string().max(3).optional(),
  openBankingStatus: z.enum(OPEN_BANKING_STATUSES).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

export const searchBankAccountsQuerySchema = z.object({
  search: z.string().min(1, 'Search term is required'),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const bankAccountListItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  sortCode: z.string().nullable(),
  accountNumber: z.string().nullable(),
  currencyCode: z.string(),
  glAccountCode: z.string(),
  currentBalance: z.number(),
  lastReconciledDate: z.date().nullable(),
  openBankingStatus: z.string(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const glAccountSummarySchema = z.object({
  code: z.string(),
  name: z.string(),
  accountType: z.string(),
});

export const bankAccountDetailSchema = bankAccountListItemSchema.extend({
  iban: z.string().nullable(),
  swiftBic: z.string().nullable(),
  openBankingProvider: z.string().nullable(),
  openBankingConnId: z.string().nullable(),
  openBankingLastSync: z.date().nullable(),
  createdBy: z.string(),
  updatedBy: z.string(),
  glAccount: glAccountSummarySchema.nullable().optional(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;
export type ListBankAccountsQuery = z.infer<typeof listBankAccountsQuerySchema>;
export type SearchBankAccountsQuery = z.infer<typeof searchBankAccountsQuerySchema>;
export type BankAccountListItem = z.infer<typeof bankAccountListItemSchema>;
export type BankAccountDetail = z.infer<typeof bankAccountDetailSchema>;
