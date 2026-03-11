// ---------------------------------------------------------------------------
// Document Generation Schemas — E12-1 Task 6.1
// Zod schemas for document generation and batch generation endpoints.
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ---------------------------------------------------------------------------
// DocumentType enum values (mirrors Prisma enum)
// ---------------------------------------------------------------------------

const DOCUMENT_TYPE_VALUES = [
  'SALES_INVOICE',
  'CREDIT_NOTE',
  'CASH_RECEIPT',
  'PROFORMA_INVOICE',
  'CUSTOMER_STATEMENT',
  'SALES_ORDER',
  'SALES_QUOTE',
  'DELIVERY_NOTE',
  'PURCHASE_ORDER',
  'GOODS_RECEIPT_NOTE',
  'SUPPLIER_REMITTANCE',
  'PAYSLIP',
  'P45',
  'P60',
] as const;

// ---------------------------------------------------------------------------
// POST /documents/generate — single document generation
// ---------------------------------------------------------------------------

export const generateDocumentBodySchema = z.object({
  documentType: z.enum(DOCUMENT_TYPE_VALUES),
  recordId: z.string().uuid(),
  outputFormat: z.enum(['inline', 'attachment']).default('inline'),
  // Optional version selection context (AC3) — allows caller to influence template version selection
  versionContext: z
    .object({
      languageCode: z.string().nullish(),
      branchCode: z.string().nullish(),
      numberSeriesId: z.string().nullish(),
      accessGroup: z.string().nullish(),
      customerGroupId: z.string().nullish(),
    })
    .optional(),
});

export type GenerateDocumentBody = z.infer<typeof generateDocumentBodySchema>;

// ---------------------------------------------------------------------------
// POST /documents/batch-generate — batch document generation
// ---------------------------------------------------------------------------

const MAX_BATCH_SIZE = 500;

export const batchGenerateBodySchema = z.object({
  documentType: z.enum(DOCUMENT_TYPE_VALUES),
  recordIds: z.array(z.string().uuid()).min(1).max(MAX_BATCH_SIZE),
});

export type BatchGenerateBody = z.infer<typeof batchGenerateBodySchema>;

// ---------------------------------------------------------------------------
// GET /documents/batch-generate/:batchJobId/status
// ---------------------------------------------------------------------------

export const batchStatusParamsSchema = z.object({
  batchJobId: z.string().min(1),
});

export type BatchStatusParams = z.infer<typeof batchStatusParamsSchema>;

// ---------------------------------------------------------------------------
// Response schemas (for OpenAPI documentation)
// ---------------------------------------------------------------------------

export const batchGenerateResponseSchema = z.object({
  batchJobId: z.string(),
});

export const batchStatusResponseSchema = z.object({
  batchJobId: z.string(),
  status: z.enum(['waiting', 'active', 'completed', 'failed']),
  total: z.number(),
  completed: z.number(),
  failed: z.number(),
  errors: z.array(
    z.object({
      recordId: z.string(),
      error: z.string(),
    }),
  ),
});
