/**
 * TypeScript interfaces for the Email Template Management API.
 *
 * Matches the API contract from §2.25 Communications — /email/templates endpoints.
 */

// --- Document Type enum ---

export const DOCUMENT_TYPES = [
  'CustomerInvoice',
  'CustomerStatement',
  'SalesQuote',
  'SalesOrder',
  'PurchaseOrder',
  'CreditNote',
  'Payslip',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

// --- Response types ---

export interface EmailTemplateListItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  documentType: string;
  subjectTemplate: string;
  bodyHtmlTemplate: string;
  bodyTextTemplate: string | null;
  languageCode: string;
  attachPdf: boolean;
  autoSend: boolean;
  isActive: boolean;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export type EmailTemplateDetail = EmailTemplateListItem;

export interface EmailTemplatePreview {
  subject: string;
  bodyHtml: string;
  sampleData: Record<string, unknown>;
}

// --- Request types ---

export interface CreateEmailTemplateRequest {
  code: string;
  name: string;
  description?: string;
  documentType: DocumentType;
  subjectTemplate: string;
  bodyHtmlTemplate: string;
  bodyTextTemplate?: string;
  languageCode?: string;
  attachPdf?: boolean;
  autoSend?: boolean;
}

export interface UpdateEmailTemplateRequest {
  name?: string;
  description?: string;
  documentType?: DocumentType;
  subjectTemplate?: string;
  bodyHtmlTemplate?: string;
  bodyTextTemplate?: string;
  languageCode?: string;
  attachPdf?: boolean;
  autoSend?: boolean;
  isActive?: boolean;
}

// --- List params ---

export interface EmailTemplateListParams {
  cursor?: string;
  limit?: number;
  documentType?: string;
  isActive?: boolean;
  search?: string;
}

// --- List response ---

interface EmailTemplateListMeta {
  cursor?: string | null;
  hasMore: boolean;
}

export interface EmailTemplateListResponse {
  data: EmailTemplateListItem[];
  meta: EmailTemplateListMeta;
}
