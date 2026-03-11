// ---------------------------------------------------------------------------
// Unit tests — Document Template Seed Config (E12-3 Task 7.4)
// Validates the 14 default template configurations: coverage, required fields,
// uniqueness, isDefault flag, and branding toggle defaults per document type.
// ---------------------------------------------------------------------------

import { describe, expect, it, vi, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock generated Prisma client (DocumentType enum)
// ---------------------------------------------------------------------------

vi.mock('../../../generated/prisma/client', () => ({
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

import { DocumentType } from '../../../generated/prisma/client';
import { DEFAULT_TEMPLATES, seedDocumentTemplates } from '../document-template-seed.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Document Template Seed Config — E12-3 Task 7.4', () => {
  const ALL_DOCUMENT_TYPES = Object.values(DocumentType) as string[];

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Coverage
  // -----------------------------------------------------------------------

  it('covers all 14 DocumentType values (no missing types)', () => {
    const coveredTypes = DEFAULT_TEMPLATES.map((t) => t.documentType);
    expect(coveredTypes).toHaveLength(14);
    for (const type of ALL_DOCUMENT_TYPES) {
      expect(coveredTypes).toContain(type);
    }
  });

  // -----------------------------------------------------------------------
  // Required fields
  // -----------------------------------------------------------------------

  it('each template config has all required fields', () => {
    for (const config of DEFAULT_TEMPLATES) {
      expect(config.documentType).toBeTruthy();
      expect(config.name).toBeTruthy();
      expect(typeof config.name).toBe('string');
      expect(config.description).toBeTruthy();
      expect(typeof config.description).toBe('string');
      expect(config.htmlTemplate).toBeTruthy();
      expect(config.htmlTemplate.length).toBeGreaterThan(100);
      expect(config.cssStyles).toBeTruthy();
      expect(config.cssStyles.length).toBeGreaterThan(100);
      expect(config.footerHtml).toBeTruthy();
      expect(config.footerHtml).toContain('pageNumber');
      expect(config.pageSize).toBe('A4');
      expect(config.orientation).toBe('portrait');
      expect(typeof config.showLogo).toBe('boolean');
      expect(typeof config.showBankDetails).toBe('boolean');
      expect(typeof config.showVatNumber).toBe('boolean');
      expect(typeof config.showCompanyReg).toBe('boolean');
    }
  });

  // -----------------------------------------------------------------------
  // Uniqueness
  // -----------------------------------------------------------------------

  it('template names are unique per documentType', () => {
    const seen = new Set<string>();
    for (const config of DEFAULT_TEMPLATES) {
      const key = `${config.documentType}::${config.name}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  // -----------------------------------------------------------------------
  // isDefault flag (verified via mock prisma)
  // -----------------------------------------------------------------------

  it('seeds with isDefault=true and isActive=true for all entries', async () => {
    const upsertCalls: any[] = [];
    const mockPrisma = {
      documentTemplate: {
        upsert: vi.fn(async (args: any) => {
          upsertCalls.push(args);
          return {};
        }),
      },
    };

    // Suppress console.log output during test
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await seedDocumentTemplates(mockPrisma as any, 'test-company-id', 'test-user-id');

    expect(upsertCalls).toHaveLength(14);
    for (const call of upsertCalls) {
      // Create path
      expect(call.create.isDefault).toBe(true);
      expect(call.create.isActive).toBe(true);
      expect(call.create.companyId).toBe('test-company-id');
      expect(call.create.createdBy).toBe('test-user-id');
      // Update path
      expect(call.update.isDefault).toBe(true);
      expect(call.update.isActive).toBe(true);
    }
  });

  // -----------------------------------------------------------------------
  // Branding toggles per document type group (AC #1, spec §6.4)
  // -----------------------------------------------------------------------

  describe('branding toggles per document type group', () => {
    function findConfig(docType: string) {
      const config = DEFAULT_TEMPLATES.find((t) => t.documentType === docType);
      expect(config).toBeDefined();
      return config!;
    }

    it('sales documents with bank details: all branding toggles true', () => {
      const salesTypesWithBank = ['SALES_INVOICE', 'CREDIT_NOTE', 'SALES_ORDER'];
      for (const type of salesTypesWithBank) {
        const config = findConfig(type);
        expect(config.showLogo).toBe(true);
        expect(config.showBankDetails).toBe(true);
        expect(config.showVatNumber).toBe(true);
        expect(config.showCompanyReg).toBe(true);
      }
    });

    it('PROFORMA_INVOICE: showBankDetails=false (template has no bank details block)', () => {
      const config = findConfig('PROFORMA_INVOICE');
      expect(config.showLogo).toBe(true);
      expect(config.showBankDetails).toBe(false);
      expect(config.showVatNumber).toBe(true);
      expect(config.showCompanyReg).toBe(true);
    });

    it('SALES_QUOTE: showBankDetails=false (template has no bank details block)', () => {
      const config = findConfig('SALES_QUOTE');
      expect(config.showLogo).toBe(true);
      expect(config.showBankDetails).toBe(false);
      expect(config.showVatNumber).toBe(true);
      expect(config.showCompanyReg).toBe(true);
    });

    it('CASH_RECEIPT: showLogo=true, showVatNumber=true, showBankDetails=false, showCompanyReg=false', () => {
      const config = findConfig('CASH_RECEIPT');
      expect(config.showLogo).toBe(true);
      expect(config.showBankDetails).toBe(false);
      expect(config.showVatNumber).toBe(true);
      expect(config.showCompanyReg).toBe(false);
    });

    it('CUSTOMER_STATEMENT: showLogo=true, showBankDetails=true, showVatNumber=true, showCompanyReg=false', () => {
      const config = findConfig('CUSTOMER_STATEMENT');
      expect(config.showLogo).toBe(true);
      expect(config.showBankDetails).toBe(true);
      expect(config.showVatNumber).toBe(true);
      expect(config.showCompanyReg).toBe(false);
    });

    it('DELIVERY_NOTE: only showLogo=true, all others false', () => {
      const config = findConfig('DELIVERY_NOTE');
      expect(config.showLogo).toBe(true);
      expect(config.showBankDetails).toBe(false);
      expect(config.showVatNumber).toBe(false);
      expect(config.showCompanyReg).toBe(false);
    });

    it('purchasing documents with bank details: GRN and remittance', () => {
      const purchasingTypesWithBank = ['GOODS_RECEIPT_NOTE', 'SUPPLIER_REMITTANCE'];
      for (const type of purchasingTypesWithBank) {
        const config = findConfig(type);
        expect(config.showLogo).toBe(true);
        expect(config.showBankDetails).toBe(true);
        expect(config.showVatNumber).toBe(true);
        expect(config.showCompanyReg).toBe(true);
      }
    });

    it('PURCHASE_ORDER: showBankDetails=false (PO should not expose buyer bank details)', () => {
      const config = findConfig('PURCHASE_ORDER');
      expect(config.showLogo).toBe(true);
      expect(config.showBankDetails).toBe(false);
      expect(config.showVatNumber).toBe(true);
      expect(config.showCompanyReg).toBe(true);
    });

    it('payroll documents: showLogo=true, showCompanyReg=true, showBankDetails=false, showVatNumber=false', () => {
      const payrollTypes = ['PAYSLIP', 'P45', 'P60'];
      for (const type of payrollTypes) {
        const config = findConfig(type);
        expect(config.showLogo).toBe(true);
        expect(config.showBankDetails).toBe(false);
        expect(config.showVatNumber).toBe(false);
        expect(config.showCompanyReg).toBe(true);
      }
    });
  });
});
