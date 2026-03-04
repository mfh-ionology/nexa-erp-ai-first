// ---------------------------------------------------------------------------
// Document-to-Email Zod Schemas — E10-3 Task 3.1
// Validation schemas for the /documents/email REST API endpoints.
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Supported document types enum (mirrors SENDABLE_STATUS_MAP keys)
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

/** POST /documents/email — request body */
export const sendDocumentEmailBodySchema = z.object({
  documentType: documentTypeEnum,
  recordId: z.uuid(),
  recipientOverrides: z.array(z.string().email()).optional(),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  templateId: z.uuid().optional(),
  subject: z.string().min(1).max(500).optional(),
  bodyHtml: z.string().optional(),
});

/** POST /documents/email/preview — request body */
export const documentEmailPreviewBodySchema = z.object({
  documentType: documentTypeEnum,
  recordId: z.uuid(),
  templateId: z.uuid().optional(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

/** POST /documents/email — response */
export const sendDocumentEmailResponseSchema = z.object({
  emailMessageId: z.string(),
  queueStatus: z.string(),
  recipientEmail: z.string(),
});

/** POST /documents/email/preview — response */
export const documentEmailPreviewResponseSchema = z.object({
  from: z.string(),
  to: z.string(),
  subject: z.string(),
  bodyHtml: z.string(),
  attachmentFileName: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Batch Statement Email Schemas (E10-3 Task 4.4)
// ---------------------------------------------------------------------------

/** POST /ar/reports/statements/batch — request body */
export const batchStatementEmailBodySchema = z.object({
  dateRange: z.object({
    from: z.string().date(),
    to: z.string().date(),
  }),
  customerIds: z.array(z.uuid()).optional(),
  customerCategoryIds: z.array(z.uuid()).optional(),
});

/** POST /ar/reports/statements/batch — response */
export const batchStatementEmailResponseSchema = z.object({
  batchJobId: z.string(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type SendDocumentEmailBody = z.infer<typeof sendDocumentEmailBodySchema>;
export type DocumentEmailPreviewBody = z.infer<typeof documentEmailPreviewBodySchema>;
export type SendDocumentEmailResponse = z.infer<typeof sendDocumentEmailResponseSchema>;
export type DocumentEmailPreviewResponse = z.infer<typeof documentEmailPreviewResponseSchema>;
export type BatchStatementEmailBody = z.infer<typeof batchStatementEmailBodySchema>;
export type BatchStatementEmailResponse = z.infer<typeof batchStatementEmailResponseSchema>;
