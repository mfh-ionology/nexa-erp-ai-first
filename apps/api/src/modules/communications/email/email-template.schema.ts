// ---------------------------------------------------------------------------
// Email Template Zod Schemas — E10-2 Task 6.1
// Validation schemas for the /email/templates REST API endpoints.
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Supported document types enum (mirrors DOCUMENT_TYPE_VARIABLES keys)
// ---------------------------------------------------------------------------

const documentTypeEnum = z.enum([
  'CustomerInvoice',
  'CustomerStatement',
  'SalesQuote',
  'SalesOrder',
  'PurchaseOrder',
  'CreditNote',
  'Payslip',
]);

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

/** GET /email/templates — query parameters */
export const listTemplatesQuerySchema = z.object({
  documentType: z.string().max(100).optional(),
  isActive: z.coerce.boolean().optional(),
  languageCode: z.string().max(5).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

/** Path params for /:id endpoints */
export const templateIdParamsSchema = z.object({
  id: z.uuid(),
});

/** POST /email/templates — request body */
export const createTemplateBodySchema = z.object({
  code: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Code must be uppercase letters, digits, and underscores'),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  documentType: documentTypeEnum,
  subjectTemplate: z.string().min(1).max(500),
  bodyHtmlTemplate: z.string().min(1),
  bodyTextTemplate: z.string().optional(),
  openingTextCode: z.string().min(1).max(60).optional(),
  closingTextCode: z.string().min(1).max(60).optional(),
  languageCode: z.string().min(1).max(5).default('en'),
  attachPdf: z.boolean().default(true),
  autoSend: z.boolean().default(false),
});

/** PATCH /email/templates/:id — request body (all fields optional) */
export const updateTemplateBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  documentType: documentTypeEnum.optional(),
  subjectTemplate: z.string().min(1).max(500).optional(),
  bodyHtmlTemplate: z.string().min(1).optional(),
  bodyTextTemplate: z.string().optional(),
  openingTextCode: z.string().min(1).max(60).optional(),
  closingTextCode: z.string().min(1).max(60).optional(),
  languageCode: z.string().min(1).max(5).optional(),
  attachPdf: z.boolean().optional(),
  autoSend: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const templateResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  documentType: z.string(),
  subjectTemplate: z.string(),
  bodyHtmlTemplate: z.string(),
  bodyTextTemplate: z.string().nullable(),
  openingTextCode: z.string().nullable(),
  closingTextCode: z.string().nullable(),
  languageCode: z.string(),
  attachPdf: z.boolean(),
  autoSend: z.boolean(),
  isActive: z.boolean(),
  createdBy: z.string(),
  updatedBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const templateListResponseSchema = z.object({
  items: z.array(templateResponseSchema),
  meta: z.object({
    cursor: z.string().nullable(),
    hasMore: z.boolean(),
  }),
});

export const templatePreviewResponseSchema = z.object({
  subject: z.string(),
  bodyHtml: z.string(),
  sampleData: z.record(z.string(), z.unknown()),
});

export const deleteTemplateResponseSchema = z.object({
  deleted: z.boolean(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>;
export type TemplateIdParams = z.infer<typeof templateIdParamsSchema>;
export type CreateTemplateBody = z.infer<typeof createTemplateBodySchema>;
export type UpdateTemplateBody = z.infer<typeof updateTemplateBodySchema>;
