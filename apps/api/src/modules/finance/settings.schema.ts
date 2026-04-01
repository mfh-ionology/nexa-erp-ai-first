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

// ---------------------------------------------------------------------------
// Dimensions Settings Tab
// ---------------------------------------------------------------------------

export const dimensionsSettingsSchema = z.object({
  enableDimensions: z.boolean().default(false),
  requireDimensionsOnManualJournals: z.boolean().default(false),
  defaultDimensionBehavior: z.enum(['NONE', 'SUGGEST', 'REQUIRE']).default('NONE'),
  maxDimensionTypes: z.number().int().min(1).max(20).default(10),
});

export const dataEntrySettingsSchema = z.object({
  requireDescription: z.boolean().default(false),
  autoPopulateVat: z.boolean().default(true),
  defaultSource: z.enum(['MANUAL', 'IMPORT', 'API']).default('MANUAL'),
  warnUnbalanced: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Approvals Settings Tab
// ---------------------------------------------------------------------------

export const approvalsSettingsSchema = z.object({
  journalApprovalEnabled: z.boolean().default(false),
  journalApprovalThreshold: z.number().min(0).default(10000),
  budgetApprovalRequired: z.boolean().default(true),
  yearEndApprovalRequired: z.boolean().default(true),
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

// ---------------------------------------------------------------------------
// Number Series Settings Tab
// ---------------------------------------------------------------------------

export const numberSeriesSettingsSchema = z.object({
  journalPrefix: z.string().max(10).default('JNL'),
  journalPadding: z.number().int().min(4).max(10).default(5),
  simulationPrefix: z.string().max(10).default('SIM'),
  simulationPadding: z.number().int().min(4).max(10).default(5),
  budgetPrefix: z.string().max(10).default('BDG'),
  budgetPadding: z.number().int().min(4).max(10).default(5),
});

// ---------------------------------------------------------------------------
// Rounding Settings Tab
// ---------------------------------------------------------------------------

export const roundingSettingsSchema = z.object({
  currencyRoundingMethod: z.enum(['HALF_UP', 'HALF_EVEN', 'CEILING', 'FLOOR']).default('HALF_UP'),
  displayDecimals: z.number().int().min(0).max(4).default(2),
  internalDecimals: z.number().int().min(2).max(4).default(4),
});

export const reportingSettingsSchema = z.object({
  defaultReportFormat: z.enum(['PDF', 'EXCEL', 'CSV']).default('PDF'),
  includeZeroBalances: z.boolean().default(false),
  showAccountCodes: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Combined Settings Schema — all 12 tabs grouped
// ---------------------------------------------------------------------------

export const financeSettingsSchema = z.object({
  general: generalSettingsSchema,
  vat: vatSettingsSchema,
  subSystems: subSystemsSettingsSchema,
  tags: tagsSettingsSchema,
  dimensions: dimensionsSettingsSchema,
  dataEntry: dataEntrySettingsSchema,
  approvals: approvalsSettingsSchema,
  reconciliation: reconciliationSettingsSchema,
  multiCurrency: multiCurrencySettingsSchema,
  numberSeries: numberSeriesSettingsSchema,
  rounding: roundingSettingsSchema,
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
  dimensions: dimensionsSettingsSchema.partial().optional(),
  dataEntry: dataEntrySettingsSchema.partial().optional(),
  approvals: approvalsSettingsSchema.partial().optional(),
  reconciliation: reconciliationSettingsSchema.partial().optional(),
  multiCurrency: multiCurrencySettingsSchema.partial().optional(),
  numberSeries: numberSeriesSettingsSchema.partial().optional(),
  rounding: roundingSettingsSchema.partial().optional(),
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
export type DimensionsSettings = z.infer<typeof dimensionsSettingsSchema>;
export type DataEntrySettings = z.infer<typeof dataEntrySettingsSchema>;
export type ApprovalsSettings = z.infer<typeof approvalsSettingsSchema>;
export type ReconciliationSettings = z.infer<typeof reconciliationSettingsSchema>;
export type MultiCurrencySettings = z.infer<typeof multiCurrencySettingsSchema>;
export type NumberSeriesSettings = z.infer<typeof numberSeriesSettingsSchema>;
export type RoundingSettings = z.infer<typeof roundingSettingsSchema>;
export type ReportingSettings = z.infer<typeof reportingSettingsSchema>;
