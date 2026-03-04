// ---------------------------------------------------------------------------
// Unit tests for EmailTemplateEngineService — E10-2 Task 8.1
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EmailTemplate } from '@nexa/db';
import {
  EmailTemplateEngineService,
  DOCUMENT_TYPE_VARIABLES,
} from './email-template-engine.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

function makeTemplate(overrides: Partial<EmailTemplate> = {}): EmailTemplate {
  return {
    id: '00000000-0000-4000-a000-000000000001',
    code: 'INVOICE_SEND',
    name: 'Invoice Send',
    description: null,
    documentType: 'CustomerInvoice',
    subjectTemplate: 'Invoice {{invoiceNumber}} from {{companyName}}',
    bodyHtmlTemplate:
      '<p>Dear {{customerName}}, invoice {{invoiceNumber}} total: {{totalAmount}}</p>',
    bodyTextTemplate: null,
    openingTextCode: null,
    closingTextCode: null,
    languageCode: 'en',
    attachPdf: true,
    autoSend: false,
    isActive: true,
    createdBy: 'user-1',
    updatedBy: 'user-1',
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
    ...overrides,
  } as EmailTemplate;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmailTemplateEngineService', () => {
  let engine: EmailTemplateEngineService;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new EmailTemplateEngineService(mockLogger);
  });

  // -------------------------------------------------------------------------
  // validateTemplate
  // -------------------------------------------------------------------------

  describe('validateTemplate', () => {
    it('passes validation with known variables', () => {
      const result = engine.validateTemplate(
        'Invoice {{invoiceNumber}}',
        '<p>Dear {{customerName}}, total: {{totalAmount}}</p>',
        'CustomerInvoice',
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('fails validation with unknown variable and returns descriptive error', () => {
      const result = engine.validateTemplate(
        'Invoice {{invoiceNumber}}',
        '<p>Hello {{unknownField}}</p>',
        'CustomerInvoice',
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('unknownField');
      expect(result.errors[0]).toContain('CustomerInvoice');
    });

    it('fails with unknown document type', () => {
      const result = engine.validateTemplate('Subject', '<p>Body</p>', 'NonExistentType');

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Unknown document type');
    });

    it('allows Handlebars block helpers (#if, #each) with known variables', () => {
      const result = engine.validateTemplate(
        'Invoice {{invoiceNumber}}',
        '{{#if customerName}}<p>Dear {{customerName}}</p>{{/if}}{{#each lineItems}}<li>item</li>{{/each}}',
        'CustomerInvoice',
      );

      expect(result.valid).toBe(true);
    });

    it('allows custom helpers (formatCurrency, formatDate)', () => {
      const result = engine.validateTemplate(
        'Invoice {{invoiceNumber}}',
        '<p>Total: {{formatCurrency totalAmount currency}}, Due: {{formatDate dueDate}}</p>',
        'CustomerInvoice',
      );

      expect(result.valid).toBe(true);
    });

    it('returns syntax error for invalid Handlebars syntax', () => {
      const result = engine.validateTemplate(
        'Invoice {{invoiceNumber}}',
        '<p>{{#if customerName}}</p>', // Missing closing {{/if}}
        'CustomerInvoice',
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('error'))).toBe(true);
    });

    it('validates variables in subject template too', () => {
      const result = engine.validateTemplate(
        '{{badVariable}} from {{companyName}}',
        '<p>Hello {{customerName}}</p>',
        'CustomerInvoice',
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('badVariable');
    });

    it('validates all 7 document types accept their own variables', () => {
      for (const [docType, vars] of Object.entries(DOCUMENT_TYPE_VARIABLES)) {
        const subject = `{{${vars[0]}}}`;
        const body = `<p>{{${vars[0]}}}</p>`;
        const result = engine.validateTemplate(subject, body, docType);
        expect(result.valid).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // compileTemplate
  // -------------------------------------------------------------------------

  describe('compileTemplate', () => {
    it('compiles and renders template with data', () => {
      const template = makeTemplate();
      const compiled = engine.compileTemplate(template);

      const subject = compiled.renderSubject({
        invoiceNumber: 'INV-001',
        companyName: 'Acme',
      });
      const body = compiled.renderBody({
        customerName: 'John',
        invoiceNumber: 'INV-001',
        totalAmount: '500.00',
      });

      expect(subject).toBe('Invoice INV-001 from Acme');
      expect(body).toContain('Dear John');
      expect(body).toContain('INV-001');
      expect(body).toContain('500.00');
    });

    it('returns cached result on repeated compilation (cache hit)', () => {
      const template = makeTemplate();

      const compiled1 = engine.compileTemplate(template);
      const compiled2 = engine.compileTemplate(template);

      expect(compiled1).toBe(compiled2);
      // debug log should show cache hit on second call
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: template.id }),
        'template-engine: cache hit',
      );
    });

    it('recompiles after updatedAt changes', () => {
      const template = makeTemplate();
      const compiled1 = engine.compileTemplate(template);

      const updatedTemplate = makeTemplate({
        updatedAt: new Date('2026-03-02'),
        subjectTemplate: 'Updated: {{invoiceNumber}}',
      });
      const compiled2 = engine.compileTemplate(updatedTemplate);

      expect(compiled1).not.toBe(compiled2);
      expect(compiled2.renderSubject({ invoiceNumber: 'INV-002' })).toBe('Updated: INV-002');
    });
  });

  // -------------------------------------------------------------------------
  // renderPreview
  // -------------------------------------------------------------------------

  describe('renderPreview', () => {
    it('generates preview with sample data for CustomerInvoice', () => {
      const template = makeTemplate();
      const result = engine.renderPreview(template);

      expect(result.subject).toContain('INV-00042');
      expect(result.subject).toContain('Sample Company Ltd');
      expect(result.bodyHtml).toContain('Acme Ltd');
      expect(result.sampleData).toBeDefined();
      expect(result.sampleData.invoiceNumber).toBe('INV-00042');
    });

    it('generates preview for all 7 document types', () => {
      const types = [
        'CustomerInvoice',
        'CustomerStatement',
        'SalesQuote',
        'SalesOrder',
        'PurchaseOrder',
        'CreditNote',
        'Payslip',
      ];

      for (const docType of types) {
        const vars = DOCUMENT_TYPE_VARIABLES[docType]!;
        const template = makeTemplate({
          documentType: docType,
          subjectTemplate: `Test {{${vars[0]}}}`,
          bodyHtmlTemplate: `<p>{{${vars[0]}}}</p>`,
        });
        const result = engine.renderPreview(template);
        expect(result.subject).toBeDefined();
        expect(result.bodyHtml).toBeDefined();
        expect(Object.keys(result.sampleData).length).toBeGreaterThan(0);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Handlebars helpers
  // -------------------------------------------------------------------------

  describe('Handlebars helpers', () => {
    it('formatCurrency produces formatted output', () => {
      const template = makeTemplate({
        subjectTemplate: 'Total: {{formatCurrency totalAmount currency}}',
        bodyHtmlTemplate: '<p>Amount: {{formatCurrency totalAmount currency}}</p>',
      });
      const compiled = engine.compileTemplate(template);
      const subject = compiled.renderSubject({ totalAmount: 1250, currency: 'GBP' });

      expect(subject).toContain('1,250.00');
    });

    it('formatDate produces ISO date by default', () => {
      const template = makeTemplate({
        subjectTemplate: 'Due: {{formatDate dueDate}}',
        bodyHtmlTemplate: '<p>Due: {{formatDate dueDate}}</p>',
      });
      const compiled = engine.compileTemplate(template);
      const subject = compiled.renderSubject({ dueDate: '2026-04-15' });

      expect(subject).toBe('Due: 2026-04-15');
    });

    it('formatDate with "long" format produces readable date', () => {
      const template = makeTemplate({
        subjectTemplate: 'x',
        bodyHtmlTemplate: '<p>{{formatDate dueDate "long"}}</p>',
      });
      const compiled = engine.compileTemplate(template);
      const body = compiled.renderBody({ dueDate: '2026-04-15' });

      expect(body).toContain('April');
      expect(body).toContain('2026');
    });
  });

  // -------------------------------------------------------------------------
  // Cache management
  // -------------------------------------------------------------------------

  describe('cache management', () => {
    it('invalidateCache removes entries for a given template ID', () => {
      const template = makeTemplate();
      engine.compileTemplate(template);

      engine.invalidateCache(template.id);

      // Compiling again should not hit cache
      vi.clearAllMocks();
      engine.compileTemplate(template);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: template.id }),
        'template-engine: compiled and cached',
      );
    });

    it('clearCache removes all entries', () => {
      const t1 = makeTemplate();
      const t2 = makeTemplate({ id: '00000000-0000-4000-a000-000000000002' });
      engine.compileTemplate(t1);
      engine.compileTemplate(t2);

      engine.clearCache();

      vi.clearAllMocks();
      engine.compileTemplate(t1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: t1.id }),
        'template-engine: compiled and cached',
      );
    });
  });
});
