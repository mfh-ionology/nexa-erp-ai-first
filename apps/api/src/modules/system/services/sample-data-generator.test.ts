// ---------------------------------------------------------------------------
// Unit tests — SampleDataGeneratorService (E12-2 Task 7.3)
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

import { SampleDataGeneratorService } from './sample-data-generator.service.js';
import { DocumentType } from '@nexa/db';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SampleDataGeneratorService', () => {
  let generator: SampleDataGeneratorService;

  beforeEach(() => {
    generator = new SampleDataGeneratorService();
  });

  // All 14 DocumentType values
  const allDocumentTypes = [
    DocumentType.SALES_INVOICE,
    DocumentType.CREDIT_NOTE,
    DocumentType.CASH_RECEIPT,
    DocumentType.PROFORMA_INVOICE,
    DocumentType.CUSTOMER_STATEMENT,
    DocumentType.SALES_ORDER,
    DocumentType.SALES_QUOTE,
    DocumentType.DELIVERY_NOTE,
    DocumentType.PURCHASE_ORDER,
    DocumentType.GOODS_RECEIPT_NOTE,
    DocumentType.SUPPLIER_REMITTANCE,
    DocumentType.PAYSLIP,
    DocumentType.P45,
    DocumentType.P60,
  ];

  // -------------------------------------------------------------------------
  // Shape validation — all document types return correct structure
  // -------------------------------------------------------------------------

  describe.each(allDocumentTypes)('generateSampleData(%s)', (docType) => {
    it('returns valid DocumentDataContext shape', () => {
      const data = generator.generateSampleData(docType as any);

      // Top-level shape
      expect(data).toHaveProperty('company');
      expect(data).toHaveProperty('document');
      expect(data).toHaveProperty('counterparty');
      expect(data).toHaveProperty('lines');
      expect(data).toHaveProperty('totals');
      expect(data).toHaveProperty('metadata');
      expect(data).toHaveProperty('branding');
      expect(data).toHaveProperty('isStub');
    });

    it('has valid company data', () => {
      const data = generator.generateSampleData(docType as any);
      const { company } = data;

      expect(company.name).toBeTruthy();
      expect(typeof company.name).toBe('string');
      expect(company.address).toBeTruthy();
      expect(company.email).toMatch(/@/);
      expect(company.phone).toBeTruthy();
    });

    it('has valid document metadata', () => {
      const data = generator.generateSampleData(docType as any);
      const { document } = data;

      expect(document.number).toBeTruthy();
      expect(typeof document.number).toBe('string');
      expect(document.date).toBeTruthy();
      expect(document.currency).toBe('GBP');
    });

    it('has valid counterparty data', () => {
      const data = generator.generateSampleData(docType as any);
      const { counterparty } = data;

      expect(counterparty.name).toBeTruthy();
      expect(typeof counterparty.name).toBe('string');
      expect(counterparty.address).toBeTruthy();
    });

    it('has lines array with valid entries', () => {
      const data = generator.generateSampleData(docType as any);

      expect(Array.isArray(data.lines)).toBe(true);
      expect(data.lines.length).toBeGreaterThan(0);

      for (const line of data.lines) {
        expect(line).toHaveProperty('lineNumber');
        expect(line).toHaveProperty('itemCode');
        expect(line).toHaveProperty('description');
        expect(line).toHaveProperty('quantity');
        expect(line).toHaveProperty('unitPrice');
        expect(line).toHaveProperty('lineTotal');
        expect(typeof line.lineNumber).toBe('number');
        expect(typeof line.quantity).toBe('number');
      }
    });

    it('has valid totals structure', () => {
      const data = generator.generateSampleData(docType as any);
      const { totals } = data;

      expect(typeof totals.subtotal).toBe('number');
      expect(typeof totals.vatAmount).toBe('number');
      expect(typeof totals.total).toBe('number');
      expect(typeof totals.amountDue).toBe('number');
      expect(Array.isArray(totals.vatBreakdown)).toBe(true);
    });

    it('has valid branding flags', () => {
      const data = generator.generateSampleData(docType as any);
      const { branding } = data;

      expect(typeof branding.showLogo).toBe('boolean');
      expect(typeof branding.showBankDetails).toBe('boolean');
      expect(typeof branding.showVatNumber).toBe('boolean');
      expect(typeof branding.showCompanyReg).toBe('boolean');
      expect(typeof branding.logoPosition).toBe('string');
    });

    it('has valid metadata with GBP currency', () => {
      const data = generator.generateSampleData(docType as any);
      const { metadata } = data;

      expect(metadata.currencyCode).toBe('GBP');
      expect(metadata.currencySymbol).toBe('£');
    });

    it('isStub is false', () => {
      const data = generator.generateSampleData(docType as any);
      expect(data.isStub).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Sales-specific validations
  // -------------------------------------------------------------------------

  describe('SALES_INVOICE sample data', () => {
    it('has realistic monetary values', () => {
      const data = generator.generateSampleData(DocumentType.SALES_INVOICE as any);

      expect(data.totals.subtotal).toBeGreaterThan(0);
      expect(data.totals.total).toBeGreaterThan(data.totals.subtotal);
      expect(data.totals.vatAmount).toBeGreaterThan(0);
    });

    it('has UK-formatted date values', () => {
      const data = generator.generateSampleData(DocumentType.SALES_INVOICE as any);

      // UK dates are dd/mm/yyyy
      expect(data.document.date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      expect(data.document.dueDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });

    it('has VAT breakdown with UK rates', () => {
      const data = generator.generateSampleData(DocumentType.SALES_INVOICE as any);

      expect(data.totals.vatBreakdown.length).toBeGreaterThan(0);
      // UK standard VAT rate is 20%
      const standardRate = data.totals.vatBreakdown.find((v) => v.rate === 20);
      expect(standardRate).toBeTruthy();
      expect(standardRate!.vatAmount).toBeGreaterThan(0);
      expect(standardRate!.taxableAmount).toBeGreaterThan(0);
    });

    it('has customer counterparty with VAT number', () => {
      const data = generator.generateSampleData(DocumentType.SALES_INVOICE as any);

      expect(data.counterparty.vatNumber).toMatch(/^GB/);
    });

    it('uses sample company Acme Ltd', () => {
      const data = generator.generateSampleData(DocumentType.SALES_INVOICE as any);

      expect(data.company.name).toBe('Acme Ltd');
      expect(data.company.legalName).toBe('Acme Trading Limited');
    });
  });

  // -------------------------------------------------------------------------
  // Purchase-side validation
  // -------------------------------------------------------------------------

  describe('PURCHASE_ORDER sample data', () => {
    it('uses supplier as counterparty', () => {
      const data = generator.generateSampleData(DocumentType.PURCHASE_ORDER as any);

      expect(data.counterparty.name).not.toBe('Widget Corp Ltd');
      expect(data.counterparty.name).toBeTruthy();
    });

    it('has positive monetary values', () => {
      const data = generator.generateSampleData(DocumentType.PURCHASE_ORDER as any);

      expect(data.totals.subtotal).toBeGreaterThan(0);
      expect(data.totals.total).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // Payroll documents
  // -------------------------------------------------------------------------

  describe('PAYSLIP sample data', () => {
    it('uses employee as counterparty', () => {
      const data = generator.generateSampleData(DocumentType.PAYSLIP as any);

      expect(data.counterparty.name).toBeTruthy();
      // Employee unlikely to have VAT number
      expect(data.counterparty.vatNumber).toBe('');
    });

    it('has deduction lines with negative values', () => {
      const data = generator.generateSampleData(DocumentType.PAYSLIP as any);

      const negativeLines = data.lines.filter((l) => l.unitPrice < 0);
      expect(negativeLines.length).toBeGreaterThan(0);
    });
  });

  describe('P45 sample data', () => {
    it('uses employee as counterparty', () => {
      const data = generator.generateSampleData(DocumentType.P45 as any);
      expect(data.counterparty.vatNumber).toBe('');
    });

    it('has total pay and total tax lines', () => {
      const data = generator.generateSampleData(DocumentType.P45 as any);
      const itemCodes = data.lines.map((l) => l.itemCode);
      expect(itemCodes).toContain('TOTAL-PAY');
      expect(itemCodes).toContain('TOTAL-TAX');
    });
  });

  describe('P60 sample data', () => {
    it('uses employee as counterparty', () => {
      const data = generator.generateSampleData(DocumentType.P60 as any);
      expect(data.counterparty.vatNumber).toBe('');
    });

    it('includes NI contributions line', () => {
      const data = generator.generateSampleData(DocumentType.P60 as any);
      const niLine = data.lines.find((l) => l.itemCode === 'TOTAL-NI');
      expect(niLine).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Delivery-type documents (no monetary values)
  // -------------------------------------------------------------------------

  describe('DELIVERY_NOTE sample data', () => {
    it('has zero-value totals (quantity-only document)', () => {
      const data = generator.generateSampleData(DocumentType.DELIVERY_NOTE as any);

      expect(data.totals.subtotal).toBe(0);
      expect(data.totals.total).toBe(0);
    });

    it('has lines with quantities but zero prices', () => {
      const data = generator.generateSampleData(DocumentType.DELIVERY_NOTE as any);

      for (const line of data.lines) {
        expect(line.quantity).toBeGreaterThan(0);
        expect(line.unitPrice).toBe(0);
      }
    });
  });
});
