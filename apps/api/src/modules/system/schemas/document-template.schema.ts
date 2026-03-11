// ---------------------------------------------------------------------------
// Document Template Management Schemas — E12-2 Task 1
// Zod schemas for template CRUD, version management, and preview endpoints.
// ---------------------------------------------------------------------------

import { z } from 'zod';
import { DocumentType } from '@nexa/db';

// ---------------------------------------------------------------------------
// Path Parameter Schemas
// ---------------------------------------------------------------------------

export const documentTemplateParamsSchema = z.object({
  id: z.string().min(1),
});

export type DocumentTemplateParams = z.infer<typeof documentTemplateParamsSchema>;

export const documentTemplateVersionParamsSchema = z.object({
  id: z.string().min(1),
  versionId: z.string().min(1),
});

export type DocumentTemplateVersionParams = z.infer<typeof documentTemplateVersionParamsSchema>;

// ---------------------------------------------------------------------------
// Template CRUD Schemas (AC1, AC2, AC3)
// ---------------------------------------------------------------------------

export const createDocumentTemplateSchema = z.object({
  documentType: z.nativeEnum(DocumentType),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  htmlTemplate: z.string().min(1),
  headerHtml: z.string().optional(),
  footerHtml: z.string().optional(),
  cssStyles: z.string().optional(),
  pageSize: z.enum(['A4', 'A5', 'Letter']).default('A4'),
  orientation: z.enum(['portrait', 'landscape']).default('portrait'),
  marginTop: z.coerce.number().min(0).max(100).default(20),
  marginBottom: z.coerce.number().min(0).max(100).default(20),
  marginLeft: z.coerce.number().min(0).max(100).default(15),
  marginRight: z.coerce.number().min(0).max(100).default(15),
  showLogo: z.boolean().default(true),
  logoPosition: z.enum(['top-left', 'top-center', 'top-right']).default('top-left'),
  showBankDetails: z.boolean().default(true),
  showVatNumber: z.boolean().default(true),
  showCompanyReg: z.boolean().default(true),
  isDefault: z.boolean().default(false),
});

export type CreateDocumentTemplate = z.infer<typeof createDocumentTemplateSchema>;

export const updateDocumentTemplateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    htmlTemplate: z.string().min(1).optional(),
    headerHtml: z.string().optional(),
    footerHtml: z.string().optional(),
    cssStyles: z.string().optional(),
    pageSize: z.enum(['A4', 'A5', 'Letter']).optional(),
    orientation: z.enum(['portrait', 'landscape']).optional(),
    marginTop: z.coerce.number().min(0).max(100).optional(),
    marginBottom: z.coerce.number().min(0).max(100).optional(),
    marginLeft: z.coerce.number().min(0).max(100).optional(),
    marginRight: z.coerce.number().min(0).max(100).optional(),
    showLogo: z.boolean().optional(),
    logoPosition: z.enum(['top-left', 'top-center', 'top-right']).optional(),
    showBankDetails: z.boolean().optional(),
    showVatNumber: z.boolean().optional(),
    showCompanyReg: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

export type UpdateDocumentTemplate = z.infer<typeof updateDocumentTemplateSchema>;

export const listDocumentTemplatesQuerySchema = z.object({
  documentType: z.nativeEnum(DocumentType).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListDocumentTemplatesQuery = z.infer<typeof listDocumentTemplatesQuerySchema>;

// ---------------------------------------------------------------------------
// Version Management Schemas (AC4)
// ---------------------------------------------------------------------------

export const createVersionSchema = z.object({
  languageCode: z.string().max(10).nullish(),
  branchCode: z.string().max(50).nullish(),
  numberSeriesId: z.string().nullish(),
  accessGroup: z.string().max(50).nullish(),
  customerGroupId: z.string().nullish(),
  htmlOverride: z.string().nullish(),
  cssOverride: z.string().nullish(),
  headerOverride: z.string().nullish(),
  footerOverride: z.string().nullish(),
  emailSubject: z.string().max(500).nullish(),
  emailBody: z.string().nullish(),
  replyToEmail: z.string().email().max(255).nullish(),
  ccEmails: z.string().max(500).nullish(),
  priority: z.coerce.number().int().min(-100).max(1000).default(0),
  isActive: z.boolean().default(true),
});

export type CreateVersion = z.infer<typeof createVersionSchema>;

export const updateVersionSchema = z
  .object({
    languageCode: z.string().max(10).nullish(),
    branchCode: z.string().max(50).nullish(),
    numberSeriesId: z.string().nullish(),
    accessGroup: z.string().max(50).nullish(),
    customerGroupId: z.string().nullish(),
    htmlOverride: z.string().nullish(),
    cssOverride: z.string().nullish(),
    headerOverride: z.string().nullish(),
    footerOverride: z.string().nullish(),
    emailSubject: z.string().max(500).nullish(),
    emailBody: z.string().nullish(),
    replyToEmail: z.string().email().max(255).nullish(),
    ccEmails: z.string().max(500).nullish(),
    priority: z.coerce.number().int().min(-100).max(1000).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined && v !== null), {
    message: 'At least one field must be provided',
  });

export type UpdateVersion = z.infer<typeof updateVersionSchema>;

// ---------------------------------------------------------------------------
// Preview Schema (AC5)
// ---------------------------------------------------------------------------

export const previewTemplateBodySchema = z.object({
  versionId: z.string().optional(),
});

export type PreviewTemplateBody = z.infer<typeof previewTemplateBodySchema>;

// ---------------------------------------------------------------------------
// Response Schemas (for type safety and future OpenAPI docs)
// ---------------------------------------------------------------------------

export const documentTemplateVersionResponseSchema = z.object({
  id: z.string(),
  templateId: z.string(),
  languageCode: z.string().nullable(),
  branchCode: z.string().nullable(),
  numberSeriesId: z.string().nullable(),
  accessGroup: z.string().nullable(),
  customerGroupId: z.string().nullable(),
  htmlOverride: z.string().nullable(),
  cssOverride: z.string().nullable(),
  headerOverride: z.string().nullable(),
  footerOverride: z.string().nullable(),
  emailSubject: z.string().nullable(),
  emailBody: z.string().nullable(),
  replyToEmail: z.string().nullable(),
  ccEmails: z.string().nullable(),
  priority: z.number(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type DocumentTemplateVersionResponse = z.infer<typeof documentTemplateVersionResponseSchema>;

export const documentTemplateResponseSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  name: z.string(),
  documentType: z.nativeEnum(DocumentType),
  description: z.string().nullable(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  htmlTemplate: z.string(),
  headerHtml: z.string().nullable(),
  footerHtml: z.string().nullable(),
  cssStyles: z.string().nullable(),
  pageSize: z.string(),
  orientation: z.string(),
  marginTop: z.number(),
  marginBottom: z.number(),
  marginLeft: z.number(),
  marginRight: z.number(),
  showLogo: z.boolean(),
  logoPosition: z.string(),
  showBankDetails: z.boolean(),
  showVatNumber: z.boolean(),
  showCompanyReg: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
  versionCount: z.number(),
});

export type DocumentTemplateResponse = z.infer<typeof documentTemplateResponseSchema>;

export const documentTemplateDetailResponseSchema = documentTemplateResponseSchema.extend({
  versions: z.array(documentTemplateVersionResponseSchema),
});

export type DocumentTemplateDetailResponse = z.infer<typeof documentTemplateDetailResponseSchema>;
