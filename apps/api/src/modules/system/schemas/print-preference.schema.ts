// ---------------------------------------------------------------------------
// Print Preference Schemas — E13-1 Task 3.1
// Zod schemas for print preference endpoints.
// ---------------------------------------------------------------------------

import { z } from 'zod';
import { DocumentType, PrintAction } from '@nexa/db';

// ---------------------------------------------------------------------------
// Shared enum values — derived from Prisma enums (single source of truth)
// ---------------------------------------------------------------------------

const DOCUMENT_TYPE_VALUES = Object.values(DocumentType) as [string, ...string[]];

const PRINT_ACTION_VALUES = Object.values(PrintAction) as [string, ...string[]];

const PREFERENCE_SOURCE_VALUES = ['USER', 'COMPANY_DEFAULT', 'FALLBACK'] as const;

// ---------------------------------------------------------------------------
// Response item schemas
// ---------------------------------------------------------------------------

export const printPreferenceItemSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPE_VALUES),
  action: z.enum(PRINT_ACTION_VALUES),
  source: z.enum(PREFERENCE_SOURCE_VALUES),
});

export type PrintPreferenceItem = z.infer<typeof printPreferenceItemSchema>;

export const getPreferencesResponseSchema = z.array(printPreferenceItemSchema);

export const companyDefaultItemSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPE_VALUES),
  action: z.enum(PRINT_ACTION_VALUES),
});

export type CompanyDefaultItem = z.infer<typeof companyDefaultItemSchema>;

export const getCompanyDefaultsResponseSchema = z.array(companyDefaultItemSchema);

// ---------------------------------------------------------------------------
// Request body schemas
// ---------------------------------------------------------------------------

export const updateUserPreferencesBodySchema = z.object({
  preferences: z
    .array(
      z.object({
        documentType: z.enum(DOCUMENT_TYPE_VALUES),
        action: z.enum(PRINT_ACTION_VALUES),
      }),
    )
    .min(1),
});

export type UpdateUserPreferencesBody = z.infer<typeof updateUserPreferencesBodySchema>;

export const updateCompanyDefaultsBodySchema = z.object({
  defaults: z
    .array(
      z.object({
        documentType: z.enum(DOCUMENT_TYPE_VALUES),
        action: z.enum(PRINT_ACTION_VALUES),
      }),
    )
    .min(1),
});

export type UpdateCompanyDefaultsBody = z.infer<typeof updateCompanyDefaultsBodySchema>;
