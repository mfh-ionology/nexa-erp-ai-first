// ---------------------------------------------------------------------------
// Unit tests — Default Document Templates (E12-3 Task 7.1, 7.2, 7.3)
// Tests template content validation, compilation, and branding toggle behaviour.
// ---------------------------------------------------------------------------

import { describe, expect, it, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @nexa/db to avoid PrismaClient init
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { DocumentType } from '@nexa/db';
import { TemplateCompilerService } from '../../services/template-compiler.service.js';
import { SampleDataGeneratorService } from '../../services/sample-data-generator.service.js';
import { SHARED_CSS } from '../shared-styles.js';

import { SALES_INVOICE_HTML } from '../sales-invoice.js';
import { CREDIT_NOTE_HTML } from '../credit-note.js';
import { CASH_RECEIPT_HTML } from '../cash-receipt.js';
import { PROFORMA_INVOICE_HTML } from '../proforma-invoice.js';
import { CUSTOMER_STATEMENT_HTML } from '../customer-statement.js';
import { SALES_ORDER_HTML } from '../sales-order.js';
import { SALES_QUOTE_HTML } from '../sales-quote.js';
import { DELIVERY_NOTE_HTML } from '../delivery-note.js';
import { PURCHASE_ORDER_HTML } from '../purchase-order.js';
import { GOODS_RECEIPT_NOTE_HTML } from '../goods-receipt-note.js';
import { SUPPLIER_REMITTANCE_HTML } from '../supplier-remittance.js';
import { PAYSLIP_HTML } from '../payslip.js';
import { P45_HTML } from '../p45.js';
import { P60_HTML } from '../p60.js';

// ---------------------------------------------------------------------------
// Test helpers & config
// ---------------------------------------------------------------------------

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn().mockReturnThis(),
};

interface TemplateTestConfig {
  type: string;
  label: string;
  html: string;
  expectedNumber: string;
  hasBankDetails: boolean;
  hasFormatCurrency: boolean;
}

/** All 14 template configs with expected sample data outputs */
const TEMPLATE_CONFIGS: TemplateTestConfig[] = [
  // Sales documents
  {
    type: DocumentType.SALES_INVOICE,
    label: 'SALES_INVOICE',
    html: SALES_INVOICE_HTML,
    expectedNumber: 'INV-00042',
    hasBankDetails: true,
    hasFormatCurrency: true,
  },
  {
    type: DocumentType.CREDIT_NOTE,
    label: 'CREDIT_NOTE',
    html: CREDIT_NOTE_HTML,
    expectedNumber: 'CN-00015',
    hasBankDetails: true,
    hasFormatCurrency: true,
  },
  {
    type: DocumentType.CASH_RECEIPT,
    label: 'CASH_RECEIPT',
    html: CASH_RECEIPT_HTML,
    expectedNumber: 'REC-00023',
    hasBankDetails: false,
    hasFormatCurrency: true,
  },
  {
    type: DocumentType.PROFORMA_INVOICE,
    label: 'PROFORMA_INVOICE',
    html: PROFORMA_INVOICE_HTML,
    expectedNumber: 'PI-00008',
    hasBankDetails: false,
    hasFormatCurrency: true,
  }, // no bank details block in template
  {
    type: DocumentType.CUSTOMER_STATEMENT,
    label: 'CUSTOMER_STATEMENT',
    html: CUSTOMER_STATEMENT_HTML,
    expectedNumber: 'STMT-2026-02',
    hasBankDetails: true,
    hasFormatCurrency: true,
  },
  {
    type: DocumentType.SALES_ORDER,
    label: 'SALES_ORDER',
    html: SALES_ORDER_HTML,
    expectedNumber: 'SO-00019',
    hasBankDetails: true,
    hasFormatCurrency: true,
  },
  {
    type: DocumentType.SALES_QUOTE,
    label: 'SALES_QUOTE',
    html: SALES_QUOTE_HTML,
    expectedNumber: 'QT-00031',
    hasBankDetails: false,
    hasFormatCurrency: true,
  },
  // Delivery / GRN — no pricing columns
  {
    type: DocumentType.DELIVERY_NOTE,
    label: 'DELIVERY_NOTE',
    html: DELIVERY_NOTE_HTML,
    expectedNumber: 'DN-00027',
    hasBankDetails: false,
    hasFormatCurrency: false,
  },
  // Purchasing documents
  {
    type: DocumentType.PURCHASE_ORDER,
    label: 'PURCHASE_ORDER',
    html: PURCHASE_ORDER_HTML,
    expectedNumber: 'PO-00054',
    hasBankDetails: false,
    hasFormatCurrency: true,
  },
  {
    type: DocumentType.GOODS_RECEIPT_NOTE,
    label: 'GOODS_RECEIPT_NOTE',
    html: GOODS_RECEIPT_NOTE_HTML,
    expectedNumber: 'GRN-00016',
    hasBankDetails: false,
    hasFormatCurrency: false,
  },
  {
    type: DocumentType.SUPPLIER_REMITTANCE,
    label: 'SUPPLIER_REMITTANCE',
    html: SUPPLIER_REMITTANCE_HTML,
    expectedNumber: 'REM-00009',
    hasBankDetails: true,
    hasFormatCurrency: true,
  },
  // Payroll documents
  {
    type: DocumentType.PAYSLIP,
    label: 'PAYSLIP',
    html: PAYSLIP_HTML,
    expectedNumber: 'PAY-2026-02-JS',
    hasBankDetails: false,
    hasFormatCurrency: true,
  },
  {
    type: DocumentType.P45,
    label: 'P45',
    html: P45_HTML,
    expectedNumber: 'P45-2026-JS',
    hasBankDetails: false,
    hasFormatCurrency: true,
  },
  {
    type: DocumentType.P60,
    label: 'P60',
    html: P60_HTML,
    expectedNumber: 'P60-2025-26-JS',
    hasBankDetails: false,
    hasFormatCurrency: true,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Default Templates — E12-3 Task 7', () => {
  let compiler: TemplateCompilerService;
  let sampleDataGenerator: SampleDataGeneratorService;

  beforeEach(() => {
    vi.clearAllMocks();
    compiler = new TemplateCompilerService(mockLogger as any);
    sampleDataGenerator = new SampleDataGeneratorService();
  });

  // -----------------------------------------------------------------------
  // 7.1 — Template content validation (AC #3, #7)
  // -----------------------------------------------------------------------

  describe('7.1 — Template content validation', () => {
    it.each(TEMPLATE_CONFIGS)(
      '$label: contains valid HTML structure (<html>, <body>, <style>)',
      ({ html }) => {
        expect(html).toContain('<html');
        expect(html).toContain('<body>');
        expect(html).toContain('</body>');
        expect(html).toContain('</html>');
        expect(html).toContain('<style>');
      },
    );

    it.each(TEMPLATE_CONFIGS)(
      '$label: contains required Handlebars variables (document.number, company.name)',
      ({ html }) => {
        expect(html).toContain('{{document.number}}');
        expect(html).toContain('{{company.name}}');
      },
    );

    it.each(TEMPLATE_CONFIGS)(
      '$label: contains branding conditionals from COMPANY_HEADER_PARTIAL',
      ({ html }) => {
        // All templates include COMPANY_HEADER_PARTIAL which has these
        expect(html).toContain('{{#if branding.showLogo}}');
        expect(html).toContain('{{#if branding.showVatNumber}}');
        expect(html).toContain('{{#if branding.showCompanyReg}}');
      },
    );

    it.each(TEMPLATE_CONFIGS.filter((c) => c.hasBankDetails))(
      '$label: contains showBankDetails conditional (from BANK_DETAILS_PARTIAL)',
      ({ html }) => {
        expect(html).toContain('{{#if branding.showBankDetails}}');
      },
    );

    it.each(TEMPLATE_CONFIGS)('$label: contains {{#each lines}} iteration block', ({ html }) => {
      expect(html).toContain('{{#each lines}}');
    });

    it.each(TEMPLATE_CONFIGS.filter((c) => c.hasFormatCurrency))(
      '$label: contains {{formatCurrency helper calls for monetary values',
      ({ html }) => {
        expect(html).toContain('{{formatCurrency');
      },
    );

    it.each(TEMPLATE_CONFIGS)(
      '$label: contains {{formatDate helper calls for date values',
      ({ html }) => {
        expect(html).toContain('{{formatDate');
      },
    );
  });

  // -----------------------------------------------------------------------
  // 7.2 — Template compilation tests (AC #6)
  // -----------------------------------------------------------------------

  describe('7.2 — Template compilation tests', () => {
    it.each(TEMPLATE_CONFIGS)(
      '$label: compiles with sample data — non-empty, no unresolved expressions, no undefined',
      ({ type, html, expectedNumber }) => {
        const sampleData = sampleDataGenerator.generateSampleData(type as any);
        const result = compiler.compile(html, sampleData, SHARED_CSS);

        // 1. Compiled HTML is non-empty
        expect(result).toBeTruthy();
        expect(result.length).toBeGreaterThan(0);

        // 2. No unresolved Handlebars expressions (all {{...}} resolved)
        expect(result).not.toContain('{{');

        // 3. No 'undefined' or '[object Object]' in output
        expect(result).not.toContain('undefined');
        expect(result).not.toContain('[object Object]');

        // 4. Document number appears in output
        expect(result).toContain(expectedNumber);
      },
    );

    it('all 14 DocumentType values have template configs', () => {
      const allTypes = Object.values(DocumentType);
      expect(TEMPLATE_CONFIGS).toHaveLength(14);
      for (const type of allTypes) {
        expect(TEMPLATE_CONFIGS.find((c) => c.type === type)).toBeDefined();
      }
    });
  });

  // -----------------------------------------------------------------------
  // 7.3 — Branding toggle tests (AC #3)
  // -----------------------------------------------------------------------

  describe('7.3 — Branding toggle tests', () => {
    /**
     * Compile the SALES_INVOICE template with custom branding overrides.
     * Optionally override company data (e.g., to add logoUrl for logo tests).
     */
    function compileSalesInvoice(
      brandingOverrides: Record<string, unknown>,
      companyOverrides?: Record<string, unknown>,
    ): string {
      const sampleData = sampleDataGenerator.generateSampleData(DocumentType.SALES_INVOICE as any);
      const data = {
        ...sampleData,
        branding: { ...sampleData.branding, ...brandingOverrides },
        ...(companyOverrides ? { company: { ...sampleData.company, ...companyOverrides } } : {}),
      };
      return compiler.compile(SALES_INVOICE_HTML, data, SHARED_CSS);
    }

    it('omits logo section when showLogo is false', () => {
      const withLogo = compileSalesInvoice(
        { showLogo: true },
        { logoUrl: 'https://example.com/logo.png' },
      );
      const withoutLogo = compileSalesInvoice(
        { showLogo: false },
        { logoUrl: 'https://example.com/logo.png' },
      );

      // Check for the <img> tag with the logo URL (unique to rendered HTML, not CSS)
      expect(withLogo).toContain('<img src="https://example.com/logo.png"');
      expect(withoutLogo).not.toContain('<img src="https://example.com/logo.png"');
    });

    it('omits bank details when showBankDetails is false', () => {
      const withBank = compileSalesInvoice({ showBankDetails: true });
      const withoutBank = compileSalesInvoice({ showBankDetails: false });

      // Check for rendered bank data (not CSS class names/comments which are always present)
      expect(withBank).toContain('Barclays Bank');
      expect(withBank).toContain('20-00-00');
      expect(withoutBank).not.toContain('Barclays Bank');
      expect(withoutBank).not.toContain('20-00-00');
    });

    it('omits VAT number when showVatNumber is false', () => {
      const withVat = compileSalesInvoice({ showVatNumber: true });
      const withoutVat = compileSalesInvoice({ showVatNumber: false });

      expect(withVat).toContain('GB 123 456 789');
      expect(withoutVat).not.toContain('GB 123 456 789');
    });

    it('omits company registration number when showCompanyReg is false', () => {
      const withReg = compileSalesInvoice({ showCompanyReg: true });
      const withoutReg = compileSalesInvoice({ showCompanyReg: false });

      expect(withReg).toContain('Reg: 12345678');
      expect(withoutReg).not.toContain('Reg: 12345678');
    });

    it('omits all conditional sections when all toggles are false', () => {
      const result = compileSalesInvoice(
        {
          showLogo: false,
          showBankDetails: false,
          showVatNumber: false,
          showCompanyReg: false,
        },
        { logoUrl: 'https://example.com/logo.png' },
      );

      expect(result).not.toContain('<img src="https://example.com/logo.png"');
      expect(result).not.toContain('Barclays Bank');
      expect(result).not.toContain('20-00-00');
      expect(result).not.toContain('GB 123 456 789');
      expect(result).not.toContain('Reg: 12345678');
    });

    it('includes all conditional sections when all toggles are true', () => {
      const result = compileSalesInvoice(
        {
          showLogo: true,
          showBankDetails: true,
          showVatNumber: true,
          showCompanyReg: true,
        },
        { logoUrl: 'https://example.com/logo.png' },
      );

      expect(result).toContain('<img src="https://example.com/logo.png"');
      expect(result).toContain('Barclays Bank');
      expect(result).toContain('20-00-00');
      expect(result).toContain('GB 123 456 789');
      expect(result).toContain('Reg: 12345678');
    });
  });
});
