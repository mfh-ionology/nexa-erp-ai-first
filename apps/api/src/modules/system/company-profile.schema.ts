import { z } from 'zod';
import { VatScheme } from '@nexa/db';

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createCompanyProfileRequestSchema = z.object({
  name: z.string().min(1),
  legalName: z.string().optional(),
  registrationNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  utrNumber: z.string().optional(),
  natureOfBusiness: z.string().optional(),
  baseCurrencyCode: z.string().length(3).default('GBP'),

  // Address
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  postcode: z.string().optional(),
  countryCode: z.string().length(2).default('GB'),

  // Contact
  phone: z.string().optional(),
  email: z.email().optional(),
  website: z.url().optional(),

  // Configuration
  timezone: z.string().default('Europe/London'),
  weekStart: z.number().int().min(0).max(6).default(1),
  dateFormat: z.string().default('DD/MM/YYYY'),
  decimalSeparator: z.string().optional(),
  thousandsSeparator: z.string().optional(),
  vatScheme: z.enum(VatScheme).default(VatScheme.STANDARD),
  defaultLanguage: z.string().default('en'),

  // Tax Agent
  taxAgentName: z.string().optional(),
  taxAgentPhone: z.string().optional(),
  taxAgentEmail: z.email().optional(),

  // Branding
  logoUrl: z.url().optional(),
});

export const updateCompanyProfileRequestSchema = createCompanyProfileRequestSchema
  .omit({ baseCurrencyCode: true, countryCode: true })
  .partial()
  .strict();

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const companyProfileResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  legalName: z.string().nullable(),
  registrationNumber: z.string().nullable(),
  vatNumber: z.string().nullable(),
  utrNumber: z.string().nullable(),
  natureOfBusiness: z.string().nullable(),
  baseCurrencyCode: z.string(),
  isDefault: z.boolean(),
  isActive: z.boolean(),

  // Address
  addressLine1: z.string().nullable(),
  addressLine2: z.string().nullable(),
  city: z.string().nullable(),
  county: z.string().nullable(),
  postcode: z.string().nullable(),
  countryCode: z.string(),

  // Contact
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),

  // Configuration
  timezone: z.string(),
  weekStart: z.number(),
  dateFormat: z.string(),
  decimalSeparator: z.string(),
  thousandsSeparator: z.string(),
  vatScheme: z.enum(VatScheme),
  defaultLanguage: z.string(),

  // Tax Agent
  taxAgentName: z.string().nullable(),
  taxAgentPhone: z.string().nullable(),
  taxAgentEmail: z.string().nullable(),

  // Branding
  logoUrl: z.string().nullable(),

  // Audit
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  updatedBy: z.string(),
});

// ---------------------------------------------------------------------------
// Default Data Import Schema
// ---------------------------------------------------------------------------

const importPermissionSchema = z.object({
  resourceCode: z.string(),
  canAccess: z.boolean(),
  canNew: z.boolean(),
  canView: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});

const importFieldOverrideSchema = z.object({
  resourceCode: z.string(),
  fieldPath: z.string(),
  visibility: z.enum(['VISIBLE', 'READ_ONLY', 'HIDDEN']),
});

const importAccessGroupSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  isSystem: z.boolean().optional(),
  permissions: z.array(importPermissionSchema).default([]),
  fieldOverrides: z.array(importFieldOverrideSchema).default([]),
});

export const importDefaultsRequestSchema = z.object({
  accessGroups: z.array(importAccessGroupSchema).min(1),
});

export const importDefaultsResponseSchema = z.object({
  created: z.number(),
  updated: z.number(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateCompanyProfileRequest = z.infer<typeof createCompanyProfileRequestSchema>;
export type UpdateCompanyProfileRequest = z.infer<typeof updateCompanyProfileRequestSchema>;
export type CompanyProfileResponse = z.infer<typeof companyProfileResponseSchema>;
export type ImportDefaultsRequest = z.infer<typeof importDefaultsRequestSchema>;
