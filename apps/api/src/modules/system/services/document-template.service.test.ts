// ---------------------------------------------------------------------------
// Unit tests — DocumentTemplateService (E12-1 Task 4.5)
// ---------------------------------------------------------------------------

import { describe, expect, it, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the service
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    documentTemplate: {
      findFirst: vi.fn(),
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

import { DocumentTemplateService } from './document-template.service.js';
import type { VersionSelectionContext } from './document-template.service.js';
import { DocumentType } from '@nexa/db';

// ---------------------------------------------------------------------------
// Types (inlined to avoid @nexa/db PrismaClient init)
// ---------------------------------------------------------------------------

interface MockDocumentTemplate {
  id: string;
  companyId: string;
  name: string;
  documentType: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  htmlTemplate: string;
  headerHtml: string | null;
  footerHtml: string | null;
  cssStyles: string | null;
  pageSize: string;
  orientation: string;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  showLogo: boolean;
  logoPosition: string;
  showBankDetails: boolean;
  showVatNumber: boolean;
  showCompanyReg: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

interface MockDocumentTemplateVersion {
  id: string;
  templateId: string;
  languageCode: string | null;
  branchCode: string | null;
  numberSeriesId: string | null;
  accessGroup: string | null;
  customerGroupId: string | null;
  htmlOverride: string | null;
  cssOverride: string | null;
  headerOverride: string | null;
  footerOverride: string | null;
  emailSubject: string | null;
  emailBody: string | null;
  replyToEmail: string | null;
  ccEmails: string | null;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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

function makeTemplate(overrides: Partial<MockDocumentTemplate> = {}): MockDocumentTemplate {
  return {
    id: 'tpl-1',
    companyId: COMPANY_A,
    name: 'Invoice Template',
    documentType: DocumentType.SALES_INVOICE,
    description: null,
    isDefault: true,
    isActive: true,
    htmlTemplate: '<html><body>{{invoice.number}}</body></html>',
    headerHtml: '<div>Header</div>',
    footerHtml: '<div>Footer</div>',
    cssStyles: 'body { font-size: 12px; }',
    pageSize: 'A4',
    orientation: 'portrait',
    marginTop: 20,
    marginBottom: 20,
    marginLeft: 15,
    marginRight: 15,
    showLogo: true,
    logoPosition: 'top-left',
    showBankDetails: true,
    showVatNumber: true,
    showCompanyReg: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-1',
    ...overrides,
  };
}

function makeVersion(
  overrides: Partial<MockDocumentTemplateVersion> = {},
): MockDocumentTemplateVersion {
  return {
    id: 'ver-1',
    templateId: 'tpl-1',
    languageCode: null,
    branchCode: null,
    numberSeriesId: null,
    accessGroup: null,
    customerGroupId: null,
    htmlOverride: null,
    cssOverride: null,
    headerOverride: null,
    footerOverride: null,
    emailSubject: null,
    emailBody: null,
    replyToEmail: null,
    ccEmails: null,
    priority: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DocumentTemplateService', () => {
  let service: DocumentTemplateService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DocumentTemplateService(mockPrisma as any, mockLogger);
  });

  // -------------------------------------------------------------------------
  // findActiveTemplate (Task 4.2)
  // -------------------------------------------------------------------------

  describe('findActiveTemplate', () => {
    it('returns the default active template when one exists', async () => {
      const template = makeTemplate();
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...template,
        versions: [],
      });

      const result = await service.findActiveTemplate(COMPANY_A, DocumentType.SALES_INVOICE as any);

      expect(result).toBeTruthy();
      expect(result!.id).toBe('tpl-1');
      expect(mockPrisma.documentTemplate.findFirst).toHaveBeenCalledWith({
        where: {
          companyId: COMPANY_A,
          documentType: DocumentType.SALES_INVOICE,
          isDefault: true,
          isActive: true,
        },
        include: {
          versions: {
            where: { isActive: true },
            orderBy: { priority: 'desc' },
          },
        },
      });
    });

    it('falls back to any active template when no default exists', async () => {
      const template = makeTemplate({ isDefault: false, id: 'tpl-fallback' });
      // First call (default search) returns null
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(null);
      // Second call (fallback search) returns the non-default template
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...template,
        versions: [],
      });

      const result = await service.findActiveTemplate(COMPANY_A, DocumentType.SALES_INVOICE as any);

      expect(result).toBeTruthy();
      expect(result!.id).toBe('tpl-fallback');
      expect(mockPrisma.documentTemplate.findFirst).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('returns null when no template exists for the documentType', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValue(null);

      const result = await service.findActiveTemplate(
        COMPANY_A,
        DocumentType.PURCHASE_ORDER as any,
      );

      expect(result).toBeNull();
    });

    it('enforces companyId scoping', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValue(null);

      await service.findActiveTemplate(COMPANY_B, DocumentType.SALES_INVOICE as any);

      // Both calls should scope to COMPANY_B
      for (const call of mockPrisma.documentTemplate.findFirst.mock.calls) {
        expect(call[0].where.companyId).toBe(COMPANY_B);
      }
    });

    it('includes only active versions ordered by priority desc', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...makeTemplate(),
        versions: [],
      });

      await service.findActiveTemplate(COMPANY_A, DocumentType.SALES_INVOICE as any);

      const includeArg = mockPrisma.documentTemplate.findFirst.mock.calls[0][0].include;
      expect(includeArg.versions.where).toEqual({ isActive: true });
      expect(includeArg.versions.orderBy).toEqual({ priority: 'desc' });
    });
  });

  // -------------------------------------------------------------------------
  // calculateMatchScore (Task 4.3)
  // -------------------------------------------------------------------------

  describe('calculateMatchScore', () => {
    const context: VersionSelectionContext = {
      languageCode: 'en',
      branchCode: 'LONDON',
      numberSeriesId: 'ns-1',
      accessGroup: 'ag-sales',
      customerGroupId: 'cg-retail',
    };

    it('scores +10 for language code match', () => {
      const version = makeVersion({ languageCode: 'en' });
      expect(service.calculateMatchScore(version as any, context)).toBe(10);
    });

    it('scores -20 for language code mismatch', () => {
      const version = makeVersion({ languageCode: 'fr' });
      expect(service.calculateMatchScore(version as any, context)).toBe(-20);
    });

    it('scores +8 for branch code match', () => {
      const version = makeVersion({ branchCode: 'LONDON' });
      expect(service.calculateMatchScore(version as any, context)).toBe(8);
    });

    it('scores -16 for branch code mismatch', () => {
      const version = makeVersion({ branchCode: 'MANCHESTER' });
      expect(service.calculateMatchScore(version as any, context)).toBe(-16);
    });

    it('scores +6 for number series match', () => {
      const version = makeVersion({ numberSeriesId: 'ns-1' });
      expect(service.calculateMatchScore(version as any, context)).toBe(6);
    });

    it('scores 0 for number series non-match (no penalty)', () => {
      const version = makeVersion({ numberSeriesId: 'ns-other' });
      expect(service.calculateMatchScore(version as any, context)).toBe(0);
    });

    it('scores +4 for access group match', () => {
      const version = makeVersion({ accessGroup: 'ag-sales' });
      expect(service.calculateMatchScore(version as any, context)).toBe(4);
    });

    it('scores +2 for customer group match', () => {
      const version = makeVersion({ customerGroupId: 'cg-retail' });
      expect(service.calculateMatchScore(version as any, context)).toBe(2);
    });

    it('scores 0 for null criteria (wildcard)', () => {
      const version = makeVersion(); // all criteria null
      expect(service.calculateMatchScore(version as any, context)).toBe(0);
    });

    it('accumulates scores for all matching criteria', () => {
      const version = makeVersion({
        languageCode: 'en',
        branchCode: 'LONDON',
        numberSeriesId: 'ns-1',
        accessGroup: 'ag-sales',
        customerGroupId: 'cg-retail',
      });
      // 10 + 8 + 6 + 4 + 2 = 30
      expect(service.calculateMatchScore(version as any, context)).toBe(30);
    });

    it('handles mixed match and mismatch', () => {
      const version = makeVersion({
        languageCode: 'en', // +10
        branchCode: 'BRISTOL', // -16
        numberSeriesId: 'ns-1', // +6
      });
      // 10 - 16 + 6 = 0
      expect(service.calculateMatchScore(version as any, context)).toBe(0);
    });

    it('handles context with null/undefined values', () => {
      const emptyContext: VersionSelectionContext = {};
      const version = makeVersion({
        languageCode: 'en',
        branchCode: 'LONDON',
      });
      // languageCode 'en' vs undefined → mismatch -20
      // branchCode 'LONDON' vs undefined → mismatch -16
      expect(service.calculateMatchScore(version as any, emptyContext)).toBe(-36);
    });
  });

  // -------------------------------------------------------------------------
  // selectTemplateVersion (Task 4.3 — full flow)
  // -------------------------------------------------------------------------

  describe('selectTemplateVersion', () => {
    it('returns null when no template exists', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValue(null);

      const result = await service.selectTemplateVersion(
        COMPANY_A,
        DocumentType.SALES_INVOICE as any,
        { languageCode: 'en' },
      );

      expect(result).toBeNull();
    });

    it('returns base template when no versions exist', async () => {
      const template = makeTemplate();
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...template,
        versions: [],
      });

      const result = await service.selectTemplateVersion(
        COMPANY_A,
        DocumentType.SALES_INVOICE as any,
        { languageCode: 'en' },
      );

      expect(result).toBeTruthy();
      expect(result!.version).toBeNull();
      expect(result!.mergedHtml).toBe(template.htmlTemplate);
      expect(result!.mergedCss).toBe(template.cssStyles);
      expect(result!.mergedHeader).toBe(template.headerHtml);
      expect(result!.mergedFooter).toBe(template.footerHtml);
      expect(result!.emailSettings).toBeNull();
    });

    it('selects the highest-scoring version', async () => {
      const template = makeTemplate();
      const versionEn = makeVersion({
        id: 'ver-en',
        languageCode: 'en',
        priority: 0,
      });
      const versionFr = makeVersion({
        id: 'ver-fr',
        languageCode: 'fr',
        priority: 0,
      });

      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...template,
        versions: [versionFr, versionEn],
      });

      const result = await service.selectTemplateVersion(
        COMPANY_A,
        DocumentType.SALES_INVOICE as any,
        { languageCode: 'en' },
      );

      expect(result).toBeTruthy();
      expect(result!.version!.id).toBe('ver-en');
    });

    it('uses priority as tiebreaker when scores are equal', async () => {
      const template = makeTemplate();
      const versionLow = makeVersion({
        id: 'ver-low',
        languageCode: 'en',
        priority: 1,
      });
      const versionHigh = makeVersion({
        id: 'ver-high',
        languageCode: 'en',
        priority: 10,
      });

      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...template,
        versions: [versionLow, versionHigh],
      });

      const result = await service.selectTemplateVersion(
        COMPANY_A,
        DocumentType.SALES_INVOICE as any,
        { languageCode: 'en' },
      );

      expect(result).toBeTruthy();
      expect(result!.version!.id).toBe('ver-high');
    });

    it('falls back to base template when all versions score negatively', async () => {
      const template = makeTemplate();
      const versionFr = makeVersion({
        id: 'ver-fr',
        languageCode: 'fr',
      }); // -20

      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...template,
        versions: [versionFr],
      });

      const result = await service.selectTemplateVersion(
        COMPANY_A,
        DocumentType.SALES_INVOICE as any,
        { languageCode: 'en' },
      );

      expect(result).toBeTruthy();
      expect(result!.version).toBeNull();
      expect(result!.mergedHtml).toBe(template.htmlTemplate);
    });

    it('selects version with partial matches (higher score wins)', async () => {
      const template = makeTemplate();
      // Version A: matches language (+10) and branch (+8) = 18
      const versionA = makeVersion({
        id: 'ver-a',
        languageCode: 'en',
        branchCode: 'LONDON',
        priority: 0,
      });
      // Version B: matches language (+10) only = 10
      const versionB = makeVersion({
        id: 'ver-b',
        languageCode: 'en',
        priority: 0,
      });

      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...template,
        versions: [versionB, versionA],
      });

      const result = await service.selectTemplateVersion(
        COMPANY_A,
        DocumentType.SALES_INVOICE as any,
        { languageCode: 'en', branchCode: 'LONDON' },
      );

      expect(result).toBeTruthy();
      expect(result!.version!.id).toBe('ver-a');
    });
  });

  // -------------------------------------------------------------------------
  // Override merging (Task 4.4 — AC #8)
  // -------------------------------------------------------------------------

  describe('override merging', () => {
    it('applies htmlOverride when present on version', async () => {
      const template = makeTemplate();
      const version = makeVersion({
        id: 'ver-override',
        languageCode: 'en',
        htmlOverride: '<html><body>OVERRIDDEN</body></html>',
      });

      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...template,
        versions: [version],
      });

      const result = await service.selectTemplateVersion(
        COMPANY_A,
        DocumentType.SALES_INVOICE as any,
        { languageCode: 'en' },
      );

      expect(result!.mergedHtml).toBe('<html><body>OVERRIDDEN</body></html>');
    });

    it('applies cssOverride when present on version', async () => {
      const template = makeTemplate();
      const version = makeVersion({
        id: 'ver-css',
        languageCode: 'en',
        cssOverride: 'body { font-size: 14px; }',
      });

      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...template,
        versions: [version],
      });

      const result = await service.selectTemplateVersion(
        COMPANY_A,
        DocumentType.SALES_INVOICE as any,
        { languageCode: 'en' },
      );

      expect(result!.mergedCss).toBe('body { font-size: 14px; }');
    });

    it('applies headerOverride and footerOverride when present', async () => {
      const template = makeTemplate();
      const version = makeVersion({
        id: 'ver-hf',
        languageCode: 'en',
        headerOverride: '<div>Custom Header</div>',
        footerOverride: '<div>Custom Footer</div>',
      });

      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...template,
        versions: [version],
      });

      const result = await service.selectTemplateVersion(
        COMPANY_A,
        DocumentType.SALES_INVOICE as any,
        { languageCode: 'en' },
      );

      expect(result!.mergedHeader).toBe('<div>Custom Header</div>');
      expect(result!.mergedFooter).toBe('<div>Custom Footer</div>');
    });

    it('uses base template fields when version has no overrides', async () => {
      const template = makeTemplate();
      const version = makeVersion({
        id: 'ver-no-override',
        languageCode: 'en',
      });

      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...template,
        versions: [version],
      });

      const result = await service.selectTemplateVersion(
        COMPANY_A,
        DocumentType.SALES_INVOICE as any,
        { languageCode: 'en' },
      );

      expect(result!.mergedHtml).toBe(template.htmlTemplate);
      expect(result!.mergedCss).toBe(template.cssStyles);
      expect(result!.mergedHeader).toBe(template.headerHtml);
      expect(result!.mergedFooter).toBe(template.footerHtml);
    });

    it('extracts email settings from selected version', async () => {
      const template = makeTemplate();
      const version = makeVersion({
        id: 'ver-email',
        languageCode: 'en',
        emailSubject: 'Invoice {{invoice.number}}',
        emailBody: 'Please find attached your invoice.',
        replyToEmail: 'billing@acme.co.uk',
        ccEmails: 'accounts@acme.co.uk',
      });

      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...template,
        versions: [version],
      });

      const result = await service.selectTemplateVersion(
        COMPANY_A,
        DocumentType.SALES_INVOICE as any,
        { languageCode: 'en' },
      );

      expect(result!.emailSettings).toEqual({
        emailSubject: 'Invoice {{invoice.number}}',
        emailBody: 'Please find attached your invoice.',
        replyToEmail: 'billing@acme.co.uk',
        ccEmails: 'accounts@acme.co.uk',
      });
    });

    it('returns null emailSettings when no version is selected', async () => {
      const template = makeTemplate();
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...template,
        versions: [],
      });

      const result = await service.selectTemplateVersion(
        COMPANY_A,
        DocumentType.SALES_INVOICE as any,
        {},
      );

      expect(result!.emailSettings).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // companyId scoping (cross-cutting)
  // -------------------------------------------------------------------------

  describe('companyId scoping', () => {
    it('passes companyId to all Prisma queries', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValue(null);

      await service.selectTemplateVersion(COMPANY_B, DocumentType.CREDIT_NOTE as any, {});

      // Both findFirst calls (default search + fallback) should scope to COMPANY_B
      for (const call of mockPrisma.documentTemplate.findFirst.mock.calls) {
        expect(call[0].where.companyId).toBe(COMPANY_B);
      }
    });
  });
});
