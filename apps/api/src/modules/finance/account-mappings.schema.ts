import { z } from 'zod';

// ---------------------------------------------------------------------------
// 27 FRS 102 Mapping Types
// ---------------------------------------------------------------------------

export const MAPPING_TYPES = [
  'AR_CONTROL',
  'AP_CONTROL',
  'SALES_REVENUE',
  'SALES_SERVICES',
  'SALES_PRODUCTS',
  'COST_OF_SALES',
  'PURCHASE_EXPENSE',
  'VAT_INPUT',
  'VAT_OUTPUT',
  'VAT_LIABILITY',
  'BANK_CHARGES',
  'EXCHANGE_GAIN',
  'EXCHANGE_LOSS',
  'RETAINED_EARNINGS',
  'SHARE_CAPITAL',
  'PAYE_NI',
  'PENSION',
  'CORPORATION_TAX',
  'INTEREST_PAYABLE',
  'INTEREST_RECEIVABLE',
  'BAD_DEBTS',
  'DEPRECIATION_EXPENSE',
  'SALARIES',
  'EMPLOYER_NI',
  'EMPLOYER_PENSION',
  'SUSPENSE',
  'ROUNDING',
] as const;

export type MappingType = (typeof MAPPING_TYPES)[number];

export const mappingTypeSchema = z.enum(MAPPING_TYPES);

// ---------------------------------------------------------------------------
// Response — single account mapping item
// ---------------------------------------------------------------------------

export const accountMappingItemSchema = z.object({
  id: z.string().uuid(),
  mappingType: z.string(),
  accountCode: z.string(),
  accountName: z.string().optional(),
  departmentCode: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const accountMappingsListSchema = z.array(accountMappingItemSchema);

// ---------------------------------------------------------------------------
// Request — batch update
// ---------------------------------------------------------------------------

export const accountMappingUpdateItemSchema = z.object({
  mappingType: mappingTypeSchema,
  accountCode: z.string().min(1).max(20),
  departmentCode: z.string().max(20).optional(),
});

export const batchUpdateAccountMappingsSchema = z.array(accountMappingUpdateItemSchema).min(1);

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type AccountMappingItem = z.infer<typeof accountMappingItemSchema>;
export type AccountMappingUpdateItem = z.infer<typeof accountMappingUpdateItemSchema>;
export type BatchUpdateAccountMappingsInput = z.infer<typeof batchUpdateAccountMappingsSchema>;
