// ---------------------------------------------------------------------------
// Schema validation tests — Document Template schemas (E12-2 Task 7.4)
// ---------------------------------------------------------------------------

import { describe, expect, it, vi } from 'vitest';

// Mock @nexa/db to provide DocumentType enum without PrismaClient init
vi.mock('@nexa/db', () => ({
  DocumentType: {
    SALES_INVOICE: 'SALES_INVOICE',
    CREDIT_NOTE: 'CREDIT_NOTE',
    CASH_RECEIPT: 'CASH_RECEIPT',
    PROFORMA_INVOICE: 'PROFORMA_INVOICE',
    CUSTOMER_STATEMENT: 'CUSTOMER_STATEMENT',
    SALES_ORDER: 'SALES_ORDER',
    SALES_QUOTE: 'SALES_QUOTE',
    DELIVERY_NOTE: 'DELIVERY_NOTE',
    PURCHASE_ORDER: 'PURCHASE_ORDER',
    GOODS_RECEIPT_NOTE: 'GOODS_RECEIPT_NOTE',
    SUPPLIER_REMITTANCE: 'SUPPLIER_REMITTANCE',
    PAYSLIP: 'PAYSLIP',
    P45: 'P45',
    P60: 'P60',
  },
}));

import {
  createDocumentTemplateSchema,
  updateDocumentTemplateSchema,
  listDocumentTemplatesQuerySchema,
  createVersionSchema,
  updateVersionSchema,
  previewTemplateBodySchema,
  documentTemplateParamsSchema,
  documentTemplateVersionParamsSchema,
} from './document-template.schema.js';

// ---------------------------------------------------------------------------
// createDocumentTemplateSchema
// ---------------------------------------------------------------------------

describe('createDocumentTemplateSchema', () => {
  const validInput = {
    documentType: 'SALES_INVOICE',
    name: 'Invoice Template',
    htmlTemplate: '<html><body>{{number}}</body></html>',
  };

  it('passes with valid minimal input', () => {
    const result = createDocumentTemplateSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('applies default values for optional fields', () => {
    const result = createDocumentTemplateSchema.parse(validInput);

    expect(result.pageSize).toBe('A4');
    expect(result.orientation).toBe('portrait');
    expect(result.marginTop).toBe(20);
    expect(result.marginBottom).toBe(20);
    expect(result.marginLeft).toBe(15);
    expect(result.marginRight).toBe(15);
    expect(result.showLogo).toBe(true);
    expect(result.logoPosition).toBe('top-left');
    expect(result.showBankDetails).toBe(true);
    expect(result.showVatNumber).toBe(true);
    expect(result.showCompanyReg).toBe(true);
    expect(result.isDefault).toBe(false);
  });

  it('passes with all fields provided', () => {
    const result = createDocumentTemplateSchema.safeParse({
      ...validInput,
      description: 'Full template',
      headerHtml: '<header>H</header>',
      footerHtml: '<footer>F</footer>',
      cssStyles: 'body { color: red; }',
      pageSize: 'Letter',
      orientation: 'landscape',
      marginTop: 30,
      marginBottom: 30,
      marginLeft: 25,
      marginRight: 25,
      showLogo: false,
      logoPosition: 'top-center',
      showBankDetails: false,
      showVatNumber: false,
      showCompanyReg: false,
      isDefault: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing documentType', () => {
    const result = createDocumentTemplateSchema.safeParse({
      name: 'Template',
      htmlTemplate: '<html>body</html>',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const result = createDocumentTemplateSchema.safeParse({
      documentType: 'SALES_INVOICE',
      htmlTemplate: '<html>body</html>',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing htmlTemplate', () => {
    const result = createDocumentTemplateSchema.safeParse({
      documentType: 'SALES_INVOICE',
      name: 'Template',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = createDocumentTemplateSchema.safeParse({
      ...validInput,
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects name over 200 characters', () => {
    const result = createDocumentTemplateSchema.safeParse({
      ...validInput,
      name: 'A'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('accepts name at exactly 200 characters', () => {
    const result = createDocumentTemplateSchema.safeParse({
      ...validInput,
      name: 'A'.repeat(200),
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty htmlTemplate', () => {
    const result = createDocumentTemplateSchema.safeParse({
      ...validInput,
      htmlTemplate: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid documentType', () => {
    const result = createDocumentTemplateSchema.safeParse({
      ...validInput,
      documentType: 'INVALID_TYPE',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid pageSize', () => {
    const result = createDocumentTemplateSchema.safeParse({
      ...validInput,
      pageSize: 'Legal',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid orientation', () => {
    const result = createDocumentTemplateSchema.safeParse({
      ...validInput,
      orientation: 'diagonal',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid logoPosition', () => {
    const result = createDocumentTemplateSchema.safeParse({
      ...validInput,
      logoPosition: 'bottom-left',
    });
    expect(result.success).toBe(false);
  });

  it('rejects margin values out of range', () => {
    const result = createDocumentTemplateSchema.safeParse({
      ...validInput,
      marginTop: 101,
    });
    expect(result.success).toBe(false);

    const result2 = createDocumentTemplateSchema.safeParse({
      ...validInput,
      marginTop: -1,
    });
    expect(result2.success).toBe(false);
  });

  it('coerces string margin values to numbers', () => {
    const result = createDocumentTemplateSchema.parse({
      ...validInput,
      marginTop: '25',
    });
    expect(result.marginTop).toBe(25);
  });

  it('rejects description over 2000 characters', () => {
    const result = createDocumentTemplateSchema.safeParse({
      ...validInput,
      description: 'D'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// updateDocumentTemplateSchema
// ---------------------------------------------------------------------------

describe('updateDocumentTemplateSchema', () => {
  it('passes with at least one field', () => {
    const result = updateDocumentTemplateSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('rejects empty object (at least one field required)', () => {
    const result = updateDocumentTemplateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts partial fields', () => {
    const result = updateDocumentTemplateSchema.safeParse({
      showLogo: false,
      marginTop: 10,
    });
    expect(result.success).toBe(true);
  });

  it('rejects name over 200 characters', () => {
    const result = updateDocumentTemplateSchema.safeParse({
      name: 'A'.repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = updateDocumentTemplateSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty htmlTemplate', () => {
    const result = updateDocumentTemplateSchema.safeParse({ htmlTemplate: '' });
    expect(result.success).toBe(false);
  });

  it('accepts valid pageSize values', () => {
    for (const size of ['A4', 'A5', 'Letter']) {
      const result = updateDocumentTemplateSchema.safeParse({ pageSize: size });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid pageSize', () => {
    const result = updateDocumentTemplateSchema.safeParse({ pageSize: 'B5' });
    expect(result.success).toBe(false);
  });

  it('does not include documentType field', () => {
    // documentType is immutable, not in the update schema
    const result = updateDocumentTemplateSchema.safeParse({ name: 'X' });
    if (result.success) {
      expect(result.data).not.toHaveProperty('documentType');
    }
  });
});

// ---------------------------------------------------------------------------
// listDocumentTemplatesQuerySchema
// ---------------------------------------------------------------------------

describe('listDocumentTemplatesQuerySchema', () => {
  it('passes with empty query (all optional)', () => {
    const result = listDocumentTemplatesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('defaults limit to 50', () => {
    const result = listDocumentTemplatesQuerySchema.parse({});
    expect(result.limit).toBe(50);
  });

  it('coerces string limit to number', () => {
    const result = listDocumentTemplatesQuerySchema.parse({ limit: '25' });
    expect(result.limit).toBe(25);
  });

  it('rejects limit over 100', () => {
    const result = listDocumentTemplatesQuerySchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it('rejects limit of 0', () => {
    const result = listDocumentTemplatesQuerySchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });

  it('transforms isActive string "true" to boolean', () => {
    const result = listDocumentTemplatesQuerySchema.parse({ isActive: 'true' });
    expect(result.isActive).toBe(true);
  });

  it('transforms isActive string "false" to boolean', () => {
    const result = listDocumentTemplatesQuerySchema.parse({ isActive: 'false' });
    expect(result.isActive).toBe(false);
  });

  it('rejects invalid isActive value', () => {
    const result = listDocumentTemplatesQuerySchema.safeParse({ isActive: 'yes' });
    expect(result.success).toBe(false);
  });

  it('accepts valid documentType filter', () => {
    const result = listDocumentTemplatesQuerySchema.safeParse({
      documentType: 'SALES_INVOICE',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid documentType', () => {
    const result = listDocumentTemplatesQuerySchema.safeParse({
      documentType: 'INVALID',
    });
    expect(result.success).toBe(false);
  });

  it('accepts cursor and search strings', () => {
    const result = listDocumentTemplatesQuerySchema.safeParse({
      cursor: 'some-id',
      search: 'invoice',
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createVersionSchema
// ---------------------------------------------------------------------------

describe('createVersionSchema', () => {
  it('passes with empty input (all optional/nullish)', () => {
    const result = createVersionSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('defaults priority to 0', () => {
    const result = createVersionSchema.parse({});
    expect(result.priority).toBe(0);
  });

  it('defaults isActive to true', () => {
    const result = createVersionSchema.parse({});
    expect(result.isActive).toBe(true);
  });

  it('accepts all fields', () => {
    const result = createVersionSchema.safeParse({
      languageCode: 'fr',
      branchCode: 'PARIS',
      numberSeriesId: 'ns-1',
      accessGroup: 'ag-1',
      customerGroupId: 'cg-1',
      htmlOverride: '<html>override</html>',
      cssOverride: 'body {}',
      headerOverride: '<h>H</h>',
      footerOverride: '<f>F</f>',
      emailSubject: 'Subject',
      emailBody: 'Body',
      replyToEmail: 'reply@example.com',
      ccEmails: 'cc@example.com',
      priority: 10,
      isActive: false,
    });
    expect(result.success).toBe(true);
  });

  it('validates replyToEmail is a valid email', () => {
    const result = createVersionSchema.safeParse({
      replyToEmail: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('accepts null for replyToEmail', () => {
    const result = createVersionSchema.safeParse({
      replyToEmail: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects languageCode over 10 characters', () => {
    const result = createVersionSchema.safeParse({
      languageCode: 'A'.repeat(11),
    });
    expect(result.success).toBe(false);
  });

  it('rejects branchCode over 50 characters', () => {
    const result = createVersionSchema.safeParse({
      branchCode: 'B'.repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it('rejects emailSubject over 500 characters', () => {
    const result = createVersionSchema.safeParse({
      emailSubject: 'S'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('rejects ccEmails over 500 characters', () => {
    const result = createVersionSchema.safeParse({
      ccEmails: 'C'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('rejects priority below -100', () => {
    const result = createVersionSchema.safeParse({
      priority: -101,
    });
    expect(result.success).toBe(false);
  });

  it('rejects priority above 1000', () => {
    const result = createVersionSchema.safeParse({
      priority: 1001,
    });
    expect(result.success).toBe(false);
  });

  it('coerces string priority to number', () => {
    const result = createVersionSchema.parse({ priority: '5' });
    expect(result.priority).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// updateVersionSchema
// ---------------------------------------------------------------------------

describe('updateVersionSchema', () => {
  it('rejects empty object (at least one field required)', () => {
    const result = updateVersionSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('passes with at least one field', () => {
    const result = updateVersionSchema.safeParse({ priority: 5 });
    expect(result.success).toBe(true);
  });

  it('validates replyToEmail when provided', () => {
    const result = updateVersionSchema.safeParse({
      replyToEmail: 'bad-email',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid email for replyToEmail', () => {
    const result = updateVersionSchema.safeParse({
      replyToEmail: 'valid@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null values for nullish fields', () => {
    const result = updateVersionSchema.safeParse({
      languageCode: null,
      branchCode: null,
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// previewTemplateBodySchema
// ---------------------------------------------------------------------------

describe('previewTemplateBodySchema', () => {
  it('accepts undefined (schema is optional)', () => {
    const result = previewTemplateBodySchema.safeParse(undefined);
    expect(result.success).toBe(true);
  });

  it('accepts empty object', () => {
    const result = previewTemplateBodySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts versionId', () => {
    const result = previewTemplateBodySchema.safeParse({ versionId: 'ver-1' });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Path parameter schemas
// ---------------------------------------------------------------------------

describe('documentTemplateParamsSchema', () => {
  it('passes with valid id', () => {
    const result = documentTemplateParamsSchema.safeParse({ id: 'tpl-123' });
    expect(result.success).toBe(true);
  });

  it('rejects empty id', () => {
    const result = documentTemplateParamsSchema.safeParse({ id: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing id', () => {
    const result = documentTemplateParamsSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('documentTemplateVersionParamsSchema', () => {
  it('passes with valid id and versionId', () => {
    const result = documentTemplateVersionParamsSchema.safeParse({
      id: 'tpl-1',
      versionId: 'ver-1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty versionId', () => {
    const result = documentTemplateVersionParamsSchema.safeParse({
      id: 'tpl-1',
      versionId: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing versionId', () => {
    const result = documentTemplateVersionParamsSchema.safeParse({
      id: 'tpl-1',
    });
    expect(result.success).toBe(false);
  });
});
