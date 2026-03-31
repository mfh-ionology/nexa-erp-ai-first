import { z } from 'zod';

// ---------------------------------------------------------------------------
// Tab Schemas — Zod validation for each finance settings tab (AC-4)
// ---------------------------------------------------------------------------

export const generalSettingsSchema = z.object({
  fiscalYearStartMonth: z.number().int().min(1).max(12).default(1),
  baseCurrency: z.string().min(1).max(3).default('GBP'),
  defaultPaymentTerms: z.number().int().min(0).max(365).default(30),
  retainedEarningsAccount: z.string().max(20).optional(),
});

export const vatSettingsSchema = z.object({
  vatScheme: z.enum(['STANDARD', 'FLAT_RATE', 'NONE']).default('STANDARD'),
  vatRegistrationNumber: z.string().max(20).optional(),
  mtdEnabled: z.boolean().default(false),
  flatRatePercentage: z.number().min(0).max(100).optional(),
});

export const subSystemsSettingsSchema = z.object({
  arEnabled: z.boolean().default(true),
  apEnabled: z.boolean().default(true),
  stockEnabled: z.boolean().default(true),
  payrollEnabled: z.boolean().default(false),
});

export const tagsSettingsSchema = z.object({
  enableDepartments: z.boolean().default(false),
  enableCostCentres: z.boolean().default(false),
  enableProjects: z.boolean().default(false),
});

export const dataEntrySettingsSchema = z.object({
  requireDescription: z.boolean().default(false),
  autoPopulateVat: z.boolean().default(true),
  defaultSource: z.enum(['MANUAL', 'IMPORT', 'API']).default('MANUAL'),
  warnUnbalanced: z.boolean().default(true),
});

export const reconciliationSettingsSchema = z.object({
  autoMatchEnabled: z.boolean().default(true),
  autoMatchThreshold: z.number().int().min(0).max(100).default(95),
  suggestThreshold: z.number().int().min(0).max(100).default(60),
});

export const multiCurrencySettingsSchema = z.object({
  multiCurrencyEnabled: z.boolean().default(false),
  autoFetchRates: z.boolean().default(false),
  rateSource: z.enum(['BOE', 'ECB', 'MANUAL']).default('BOE'),
});

export const reportingSettingsSchema = z.object({
  defaultReportFormat: z.enum(['PDF', 'EXCEL', 'CSV']).default('PDF'),
  includeZeroBalances: z.boolean().default(false),
  showAccountCodes: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Combined Settings Schema — all 8 tabs grouped
// ---------------------------------------------------------------------------

export const financeSettingsSchema = z.object({
  general: generalSettingsSchema,
  vat: vatSettingsSchema,
  subSystems: subSystemsSettingsSchema,
  tags: tagsSettingsSchema,
  dataEntry: dataEntrySettingsSchema,
  reconciliation: reconciliationSettingsSchema,
  multiCurrency: multiCurrencySettingsSchema,
  reporting: reportingSettingsSchema,
});

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

/** PUT /finance/settings — update finance settings (all or partial tabs) */
export const updateFinanceSettingsSchema = z.object({
  general: generalSettingsSchema.partial().optional(),
  vat: vatSettingsSchema.partial().optional(),
  subSystems: subSystemsSettingsSchema.partial().optional(),
  tags: tagsSettingsSchema.partial().optional(),
  dataEntry: dataEntrySettingsSchema.partial().optional(),
  reconciliation: reconciliationSettingsSchema.partial().optional(),
  multiCurrency: multiCurrencySettingsSchema.partial().optional(),
  reporting: reportingSettingsSchema.partial().optional(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const financeSettingsResponseSchema = financeSettingsSchema;

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type FinanceSettings = z.infer<typeof financeSettingsSchema>;
export type UpdateFinanceSettingsInput = z.infer<typeof updateFinanceSettingsSchema>;
export type GeneralSettings = z.infer<typeof generalSettingsSchema>;
export type VatSettings = z.infer<typeof vatSettingsSchema>;
export type SubSystemsSettings = z.infer<typeof subSystemsSettingsSchema>;
export type TagsSettings = z.infer<typeof tagsSettingsSchema>;
export type DataEntrySettings = z.infer<typeof dataEntrySettingsSchema>;
export type ReconciliationSettings = z.infer<typeof reconciliationSettingsSchema>;
export type MultiCurrencySettings = z.infer<typeof multiCurrencySettingsSchema>;
export type ReportingSettings = z.infer<typeof reportingSettingsSchema>;
