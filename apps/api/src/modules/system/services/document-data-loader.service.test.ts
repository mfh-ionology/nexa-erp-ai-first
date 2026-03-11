// ---------------------------------------------------------------------------
// Unit tests — DocumentDataLoaderService (E12-1 Task 5.8)
// ---------------------------------------------------------------------------

import { describe, expect, it, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the service
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    companyProfile: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
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

import { DocumentDataLoaderService } from './document-data-loader.service.js';
import type { DocumentLine, BrandingOptions } from './document-data-loader.service.js';
import { DocumentType } from '@nexa/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const COMPANY_A = 'company-a-id';
const COMPANY_B = 'company-b-id';
const RECORD_ID = 'record-123-abc';

function makeCompanyProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: COMPANY_A,
    name: 'Acme Ltd',
    legalName: 'Acme Trading Limited',
    registrationNumber: '12345678',
    vatNumber: 'GB123456789',
    utrNumber: null,
    natureOfBusiness: null,
    baseCurrencyCode: 'GBP',
    isDefault: true,
    isActive: true,
    addressLine1: '123 High Street',
    addressLine2: 'Suite 4',
    city: 'London',
    county: 'Greater London',
    postcode: 'EC1A 1BB',
    countryCode: 'GB',
    phone: '+44 20 7946 0958',
    email: 'accounts@acme.co.uk',
    website: 'https://acme.co.uk',
    timezone: 'Europe/London',
    weekStart: 1,
    dateFormat: 'DD/MM/YYYY',
    decimalSeparator: '.',
    thousandsSeparator: ',',
    vatScheme: 'STANDARD',
    defaultLanguage: 'en',
    taxAgentName: null,
    taxAgentPhone: null,
    taxAgentEmail: null,
    logoUrl: 'https://cdn.acme.co.uk/logo.png',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
    updatedBy: 'user-1',
    ...overrides,
  };
}

function makeLines(): DocumentLine[] {
  return [
    {
      lineNumber: 1,
      itemCode: 'WIDGET-A',
      description: 'Standard Widget',
      quantity: 10,
      unitPrice: 25.0,
      discountPercent: 0,
      vatRate: 20,
      vatAmount: 50.0,
      lineTotal: 250.0,
    },
    {
      lineNumber: 2,
      itemCode: 'SERVICE-B',
      description: 'Installation Service',
      quantity: 2,
      unitPrice: 100.0,
      discountPercent: 0,
      vatRate: 20,
      vatAmount: 40.0,
      lineTotal: 200.0,
    },
    {
      lineNumber: 3,
      itemCode: 'BOOK-C',
      description: 'User Manual',
      quantity: 5,
      unitPrice: 12.0,
      discountPercent: 0,
      vatRate: 0,
      vatAmount: 0,
      lineTotal: 60.0,
    },
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DocumentDataLoaderService', () => {
  let service: DocumentDataLoaderService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DocumentDataLoaderService(mockPrisma as any, mockLogger);
  });

  // -------------------------------------------------------------------------
  // Company data loading (Task 5.2)
  // -------------------------------------------------------------------------

  describe('company data loading', () => {
    it('loads and maps company profile fields correctly', async () => {
      const profile = makeCompanyProfile();
      mockPrisma.companyProfile.findUnique.mockResolvedValueOnce(profile);

      const result = await service.loadContext(
        COMPANY_A,
        DocumentType.SALES_INVOICE as any,
        RECORD_ID,
      );

      expect(result).toBeTruthy();
      expect(result!.company.name).toBe('Acme Ltd');
      expect(result!.company.legalName).toBe('Acme Trading Limited');
      expect(result!.company.vatNumber).toBe('GB123456789');
      expect(result!.company.companyNumber).toBe('12345678');
      expect(result!.company.logoUrl).toBe('https://cdn.acme.co.uk/logo.png');
      expect(result!.company.email).toBe('accounts@acme.co.uk');
      expect(result!.company.phone).toBe('+44 20 7946 0958');
      expect(result!.company.website).toBe('https://acme.co.uk');
    });

    it('formats multi-line address correctly', async () => {
      const profile = makeCompanyProfile();
      mockPrisma.companyProfile.findUnique.mockResolvedValueOnce(profile);

      const result = await service.loadContext(
        COMPANY_A,
        DocumentType.SALES_INVOICE as any,
        RECORD_ID,
      );

      expect(result!.company.address).toBe(
        '123 High Street, Suite 4, London, Greater London, EC1A 1BB',
      );
    });

    it('handles missing optional fields gracefully (empty strings)', async () => {
      const profile = makeCompanyProfile({
        legalName: null,
        vatNumber: null,
        registrationNumber: null,
        logoUrl: null,
        email: null,
        phone: null,
        website: null,
        addressLine2: null,
        county: null,
      });
      mockPrisma.companyProfile.findUnique.mockResolvedValueOnce(profile);

      const result = await service.loadContext(
        COMPANY_A,
        DocumentType.SALES_INVOICE as any,
        RECORD_ID,
      );

      expect(result!.company.legalName).toBe('');
      expect(result!.company.vatNumber).toBe('');
      expect(result!.company.companyNumber).toBe('');
      expect(result!.company.logoUrl).toBe('');
      expect(result!.company.email).toBe('');
      expect(result!.company.phone).toBe('');
      expect(result!.company.website).toBe('');
      // Address should skip null parts
      expect(result!.company.address).toBe('123 High Street, London, EC1A 1BB');
    });

    it('returns null when company not found', async () => {
      mockPrisma.companyProfile.findUnique.mockResolvedValueOnce(null);

      const result = await service.loadContext(
        COMPANY_A,
        DocumentType.SALES_INVOICE as any,
        RECORD_ID,
      );

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        { companyId: COMPANY_A },
        'document-data-loader: company not found',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Document type routing (Task 5.3)
  // -------------------------------------------------------------------------

  describe('document type routing', () => {
    it('returns stub context for unsupported document types (models not yet built)', async () => {
      const profile = makeCompanyProfile();
      mockPrisma.companyProfile.findUnique.mockResolvedValueOnce(profile);

      const result = await service.loadContext(
        COMPANY_A,
        DocumentType.SALES_INVOICE as any,
        RECORD_ID,
      );

      expect(result).toBeTruthy();
      // Stub document should have STUB prefix
      expect(result!.document.number).toMatch(/^STUB-/);
      expect(result!.document.status).toBe('DRAFT');
      expect(result!.document.currency).toBe('GBP');
      // Empty counterparty
      expect(result!.counterparty.name).toBe('');
      // No lines
      expect(result!.lines).toEqual([]);
      // Logger should warn about stub
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: COMPANY_A,
          documentType: DocumentType.SALES_INVOICE,
          recordId: RECORD_ID,
        }),
        'document-data-loader: source model not yet implemented, returning stub context',
      );
    });

    it('returns stub for all DocumentType enum values', async () => {
      const allTypes = Object.values(DocumentType) as DocumentType[];

      for (const docType of allTypes) {
        vi.clearAllMocks();
        const profile = makeCompanyProfile();
        mockPrisma.companyProfile.findUnique.mockResolvedValueOnce(profile);

        const result = await service.loadContext(COMPANY_A, docType as any, RECORD_ID);

        expect(result).toBeTruthy();
        expect(result!.document.number).toMatch(/^STUB-/);
      }
    });
  });

  // -------------------------------------------------------------------------
  // Line items normalisation (Task 5.4)
  // -------------------------------------------------------------------------

  describe('line items normalisation', () => {
    it('normalises raw lines into standard DocumentLine shape', () => {
      const rawLines = [
        {
          description: 'Widget A',
          itemCode: 'W-A',
          quantity: 5,
          unitPrice: 20,
          discountPercent: 0,
          vatRate: 20,
          vatAmount: 20,
          lineTotal: 100,
        },
        {
          description: 'Widget B',
          itemCode: 'W-B',
          quantity: 3,
          unitPrice: 50,
          discountPercent: 10,
          vatRate: 20,
          vatAmount: 27,
          lineTotal: 135,
        },
      ];

      const result = service.normaliseLines(rawLines);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        lineNumber: 1,
        itemCode: 'W-A',
        description: 'Widget A',
        quantity: 5,
        unitPrice: 20,
        discountPercent: 0,
        vatRate: 20,
        vatAmount: 20,
        lineTotal: 100,
      });
      expect(result[1].lineNumber).toBe(2);
      expect(result[1].description).toBe('Widget B');
    });

    it('assigns 1-based line numbers', () => {
      const rawLines = [{ description: 'A' }, { description: 'B' }, { description: 'C' }];

      const result = service.normaliseLines(rawLines);

      expect(result[0].lineNumber).toBe(1);
      expect(result[1].lineNumber).toBe(2);
      expect(result[2].lineNumber).toBe(3);
    });

    it('handles null/undefined fields gracefully', () => {
      const rawLines = [
        {
          description: null,
          itemCode: null,
          quantity: null,
          unitPrice: null,
          discountPercent: null,
          vatRate: null,
          vatAmount: null,
          lineTotal: null,
        },
      ];

      const result = service.normaliseLines(rawLines);

      expect(result[0].description).toBe('');
      expect(result[0].itemCode).toBe('');
      expect(result[0].quantity).toBe(0);
      expect(result[0].unitPrice).toBe(0);
      expect(result[0].lineTotal).toBe(0);
      expect(result[0].vatAmount).toBe(0);
    });

    it('handles string numeric values (Prisma Decimal serialisation)', () => {
      const rawLines = [
        {
          description: 'Decimal test',
          quantity: '3',
          unitPrice: '25.50',
          vatRate: '20',
          vatAmount: '15.30',
          lineTotal: '76.50',
        },
      ];

      const result = service.normaliseLines(rawLines);

      expect(result[0].quantity).toBe(3);
      expect(result[0].unitPrice).toBe(25.5);
      expect(result[0].vatRate).toBe(20);
      expect(result[0].vatAmount).toBe(15.3);
      expect(result[0].lineTotal).toBe(76.5);
    });

    it('handles Prisma Decimal objects (with toNumber method)', () => {
      const mockDecimal = (n: number) => ({
        toNumber: () => n,
        toString: () => String(n),
      });

      const rawLines = [
        {
          description: 'Decimal obj test',
          quantity: mockDecimal(2),
          unitPrice: mockDecimal(45.99),
          vatRate: mockDecimal(20),
          vatAmount: mockDecimal(18.4),
          lineTotal: mockDecimal(91.98),
        },
      ];

      const result = service.normaliseLines(rawLines as any);

      expect(result[0].quantity).toBe(2);
      expect(result[0].unitPrice).toBe(45.99);
      expect(result[0].lineTotal).toBe(91.98);
    });

    it('calculates lineTotal and vatAmount when not provided', () => {
      const rawLines = [
        {
          description: 'Auto-calc',
          quantity: 4,
          unitPrice: 25,
          vatRate: 20,
          // No lineTotal or vatAmount provided
        },
      ];

      const result = service.normaliseLines(rawLines);

      // lineTotal = 4 * 25 = 100
      expect(result[0].lineTotal).toBe(100);
      // vatAmount = 100 * 0.20 = 20
      expect(result[0].vatAmount).toBe(20);
    });

    it('applies discount when calculating lineTotal', () => {
      const rawLines = [
        {
          description: 'Discounted',
          quantity: 10,
          unitPrice: 50,
          discountPercent: 10,
          vatRate: 20,
          // No lineTotal provided — should calculate: (10*50) - 10% = 450
        },
      ];

      const result = service.normaliseLines(rawLines);

      expect(result[0].lineTotal).toBe(450);
      // vatAmount = 450 * 0.20 = 90
      expect(result[0].vatAmount).toBe(90);
    });
  });

  // -------------------------------------------------------------------------
  // Totals calculation (Task 5.5)
  // -------------------------------------------------------------------------

  describe('totals calculation', () => {
    it('calculates subtotal as sum of lineTotals', () => {
      const lines = makeLines();
      const totals = service.calculateTotals(lines);

      // 250 + 200 + 60 = 510
      expect(totals.subtotal).toBe(510);
    });

    it('calculates VAT breakdown grouped by rate', () => {
      const lines = makeLines();
      const totals = service.calculateTotals(lines);

      expect(totals.vatBreakdown).toHaveLength(2);

      // 0% rate
      const zeroRate = totals.vatBreakdown.find((v) => v.rate === 0);
      expect(zeroRate).toBeTruthy();
      expect(zeroRate!.taxableAmount).toBe(60);
      expect(zeroRate!.vatAmount).toBe(0);

      // 20% rate
      const twentyRate = totals.vatBreakdown.find((v) => v.rate === 20);
      expect(twentyRate).toBeTruthy();
      expect(twentyRate!.taxableAmount).toBe(450); // 250 + 200
      expect(twentyRate!.vatAmount).toBe(90); // 50 + 40
    });

    it('sorts VAT breakdown by rate ascending', () => {
      const lines = makeLines();
      const totals = service.calculateTotals(lines);

      const rates = totals.vatBreakdown.map((v) => v.rate);
      expect(rates).toEqual([0, 20]);
    });

    it('calculates total as subtotal + vatAmount', () => {
      const lines = makeLines();
      const totals = service.calculateTotals(lines);

      // 510 + 90 = 600
      expect(totals.total).toBe(600);
    });

    it('calculates vatAmount as sum across all rates', () => {
      const lines = makeLines();
      const totals = service.calculateTotals(lines);

      // 50 + 40 + 0 = 90
      expect(totals.vatAmount).toBe(90);
    });

    it('calculates amountDue as total - payments', () => {
      const lines = makeLines();
      const totals = service.calculateTotals(lines, 150);

      // 600 - 150 = 450
      expect(totals.amountDue).toBe(450);
    });

    it('defaults paymentsReceived to 0', () => {
      const lines = makeLines();
      const totals = service.calculateTotals(lines);

      expect(totals.amountDue).toBe(totals.total);
    });

    it('handles empty lines', () => {
      const totals = service.calculateTotals([]);

      expect(totals.subtotal).toBe(0);
      expect(totals.vatBreakdown).toEqual([]);
      expect(totals.vatAmount).toBe(0);
      expect(totals.total).toBe(0);
      expect(totals.amountDue).toBe(0);
    });

    it('rounds totals to 2 decimal places', () => {
      const lines: DocumentLine[] = [
        {
          lineNumber: 1,
          itemCode: 'X',
          description: 'Rounding test',
          quantity: 1,
          unitPrice: 33.33,
          discountPercent: 0,
          vatRate: 20,
          vatAmount: 6.67,
          lineTotal: 33.33,
        },
        {
          lineNumber: 2,
          itemCode: 'Y',
          description: 'Rounding test 2',
          quantity: 1,
          unitPrice: 33.33,
          discountPercent: 0,
          vatRate: 20,
          vatAmount: 6.67,
          lineTotal: 33.33,
        },
        {
          lineNumber: 3,
          itemCode: 'Z',
          description: 'Rounding test 3',
          quantity: 1,
          unitPrice: 33.34,
          discountPercent: 0,
          vatRate: 20,
          vatAmount: 6.67,
          lineTotal: 33.34,
        },
      ];

      const totals = service.calculateTotals(lines);

      // Each value should have at most 2 decimal places
      expect(totals.subtotal).toBe(100);
      expect(totals.vatAmount).toBe(20.01);
      expect(totals.total).toBe(120.01);
    });
  });

  // -------------------------------------------------------------------------
  // Branding context injection (Task 5.6)
  // -------------------------------------------------------------------------

  describe('branding context', () => {
    it('uses provided branding options', async () => {
      const profile = makeCompanyProfile();
      mockPrisma.companyProfile.findUnique.mockResolvedValueOnce(profile);

      const branding: BrandingOptions = {
        showLogo: false,
        logoPosition: 'top-right',
        showBankDetails: false,
        showVatNumber: true,
        showCompanyReg: false,
      };

      const result = await service.loadContext(
        COMPANY_A,
        DocumentType.SALES_INVOICE as any,
        RECORD_ID,
        branding,
      );

      expect(result!.branding).toEqual({
        showLogo: false,
        logoPosition: 'top-right',
        showBankDetails: false,
        showVatNumber: true,
        showCompanyReg: false,
      });
    });

    it('defaults all branding to true when not provided', async () => {
      const profile = makeCompanyProfile();
      mockPrisma.companyProfile.findUnique.mockResolvedValueOnce(profile);

      const result = await service.loadContext(
        COMPANY_A,
        DocumentType.SALES_INVOICE as any,
        RECORD_ID,
      );

      expect(result!.branding).toEqual({
        showLogo: true,
        logoPosition: 'top-left',
        showBankDetails: true,
        showVatNumber: true,
        showCompanyReg: true,
      });
    });
  });

  // -------------------------------------------------------------------------
  // companyId scoping (Task 5.7)
  // -------------------------------------------------------------------------

  describe('companyId scoping', () => {
    it('queries CompanyProfile using the provided companyId', async () => {
      mockPrisma.companyProfile.findUnique.mockResolvedValueOnce(null);

      await service.loadContext(COMPANY_B, DocumentType.SALES_INVOICE as any, RECORD_ID);

      expect(mockPrisma.companyProfile.findUnique).toHaveBeenCalledWith({
        where: { id: COMPANY_B },
      });
    });

    it('returns null when company not found (cross-company access)', async () => {
      mockPrisma.companyProfile.findUnique.mockResolvedValueOnce(null);

      const result = await service.loadContext(
        'non-existent-company',
        DocumentType.SALES_INVOICE as any,
        RECORD_ID,
      );

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Metadata (implicit in Task 5.1)
  // -------------------------------------------------------------------------

  describe('metadata', () => {
    it('includes currency code and symbol', async () => {
      const profile = makeCompanyProfile();
      mockPrisma.companyProfile.findUnique.mockResolvedValueOnce(profile);

      const result = await service.loadContext(
        COMPANY_A,
        DocumentType.SALES_INVOICE as any,
        RECORD_ID,
      );

      expect(result!.metadata.currencyCode).toBe('GBP');
      expect(result!.metadata.currencySymbol).toBe('\u00a3');
    });

    it('includes formatted date in UK format', async () => {
      const profile = makeCompanyProfile();
      mockPrisma.companyProfile.findUnique.mockResolvedValueOnce(profile);

      const result = await service.loadContext(
        COMPANY_A,
        DocumentType.SALES_INVOICE as any,
        RECORD_ID,
      );

      // Stub context produces a date — should be formatted as DD/MM/YYYY
      expect(result!.metadata.formattedDate).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    });
  });
});
