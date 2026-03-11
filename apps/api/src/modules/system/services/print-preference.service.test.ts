// ---------------------------------------------------------------------------
// Unit tests — PrintPreferenceService (E13-1 Task 2.2)
// ---------------------------------------------------------------------------

import { describe, expect, it, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the service
// ---------------------------------------------------------------------------

const mockTransaction = vi.fn();

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    printPreference: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    systemSetting: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
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
  PrintAction: {
    AUTO_DOWNLOAD: 'AUTO_DOWNLOAD',
    BROWSER_PRINT: 'BROWSER_PRINT',
    NONE: 'NONE',
  },
  SettingCategory: {
    GENERAL: 'GENERAL',
  },
  SettingValueType: {
    STRING: 'STRING',
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { PrintPreferenceService } from './print-preference.service.js';
import type { ResolvedPreference, CompanyDefault } from './print-preference.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COMPANY_ID = 'company-1';
const USER_ID = 'user-1';

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as import('pino').Logger;

function makeUserPref(docType: string, action: string) {
  return {
    id: `pref-${docType}`,
    companyId: COMPANY_ID,
    userId: USER_ID,
    documentType: docType,
    action,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeSystemSetting(docType: string, action: string) {
  return {
    id: `setting-${docType}`,
    companyId: COMPANY_ID,
    key: `print.default.${docType}`,
    value: action,
    valueType: 'STRING',
    category: 'GENERAL',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PrintPreferenceService', () => {
  let service: PrintPreferenceService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default $transaction implementation: execute the callback with mockPrisma as tx
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
        return fn(mockPrisma);
      },
    );
    service = new PrintPreferenceService(mockPrisma as any, mockLogger);
  });

  // -------------------------------------------------------------------------
  // getPreferences
  // -------------------------------------------------------------------------

  describe('getPreferences', () => {
    it('returns all 14 document types with NONE/FALLBACK when no preferences or defaults exist', async () => {
      mockPrisma.printPreference.findMany.mockResolvedValue([]);
      mockPrisma.systemSetting.findMany.mockResolvedValue([]);

      const result = await service.getPreferences(COMPANY_ID, USER_ID);

      expect(result).toHaveLength(14);
      for (const pref of result) {
        expect(pref.action).toBe('NONE');
        expect(pref.source).toBe('FALLBACK');
      }
    });

    it('user preference overrides company default', async () => {
      mockPrisma.printPreference.findMany.mockResolvedValue([
        makeUserPref('SALES_INVOICE', 'BROWSER_PRINT'),
      ]);
      mockPrisma.systemSetting.findMany.mockResolvedValue([
        makeSystemSetting('SALES_INVOICE', 'AUTO_DOWNLOAD'),
      ]);

      const result = await service.getPreferences(COMPANY_ID, USER_ID);

      const salesInvoice = result.find((p) => p.documentType === 'SALES_INVOICE')!;
      expect(salesInvoice.action).toBe('BROWSER_PRINT');
      expect(salesInvoice.source).toBe('USER');
    });

    it('company default used when no user preference exists', async () => {
      mockPrisma.printPreference.findMany.mockResolvedValue([]);
      mockPrisma.systemSetting.findMany.mockResolvedValue([
        makeSystemSetting('PURCHASE_ORDER', 'AUTO_DOWNLOAD'),
      ]);

      const result = await service.getPreferences(COMPANY_ID, USER_ID);

      const po = result.find((p) => p.documentType === 'PURCHASE_ORDER')!;
      expect(po.action).toBe('AUTO_DOWNLOAD');
      expect(po.source).toBe('COMPANY_DEFAULT');
    });

    it('falls back to NONE when neither user nor company default exists', async () => {
      mockPrisma.printPreference.findMany.mockResolvedValue([
        makeUserPref('SALES_INVOICE', 'AUTO_DOWNLOAD'),
      ]);
      mockPrisma.systemSetting.findMany.mockResolvedValue([
        makeSystemSetting('SALES_INVOICE', 'BROWSER_PRINT'),
      ]);

      const result = await service.getPreferences(COMPANY_ID, USER_ID);

      // SALES_INVOICE has user pref, but CREDIT_NOTE has neither
      const creditNote = result.find((p) => p.documentType === 'CREDIT_NOTE')!;
      expect(creditNote.action).toBe('NONE');
      expect(creditNote.source).toBe('FALLBACK');
    });

    it('queries with correct companyId and userId', async () => {
      mockPrisma.printPreference.findMany.mockResolvedValue([]);
      mockPrisma.systemSetting.findMany.mockResolvedValue([]);

      await service.getPreferences(COMPANY_ID, USER_ID);

      expect(mockPrisma.printPreference.findMany).toHaveBeenCalledWith({
        where: { companyId: COMPANY_ID, userId: USER_ID },
      });
      expect(mockPrisma.systemSetting.findMany).toHaveBeenCalledWith({
        where: {
          companyId: COMPANY_ID,
          key: { startsWith: 'print.default.' },
        },
      });
    });
  });

  // -------------------------------------------------------------------------
  // updateUserPreferences
  // -------------------------------------------------------------------------

  describe('updateUserPreferences', () => {
    it('creates new user preferences via upsert', async () => {
      // getCompanyDefaults returns NONE for all (no settings)
      mockPrisma.systemSetting.findMany.mockResolvedValue([]);

      await service.updateUserPreferences(COMPANY_ID, USER_ID, [
        { documentType: 'SALES_INVOICE' as any, action: 'AUTO_DOWNLOAD' as any },
      ]);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.printPreference.upsert).toHaveBeenCalledWith({
        where: {
          companyId_userId_documentType: {
            companyId: COMPANY_ID,
            userId: USER_ID,
            documentType: 'SALES_INVOICE',
          },
        },
        create: {
          companyId: COMPANY_ID,
          userId: USER_ID,
          documentType: 'SALES_INVOICE',
          action: 'AUTO_DOWNLOAD',
        },
        update: {
          action: 'AUTO_DOWNLOAD',
        },
      });
    });

    it('updates existing preferences via upsert', async () => {
      mockPrisma.systemSetting.findMany.mockResolvedValue([]);

      await service.updateUserPreferences(COMPANY_ID, USER_ID, [
        { documentType: 'CREDIT_NOTE' as any, action: 'BROWSER_PRINT' as any },
      ]);

      expect(mockPrisma.printPreference.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { action: 'BROWSER_PRINT' },
        }),
      );
    });

    it('deletes user preference when action matches company default (normalise)', async () => {
      // Company default for SALES_INVOICE is AUTO_DOWNLOAD
      mockPrisma.systemSetting.findMany.mockResolvedValue([
        makeSystemSetting('SALES_INVOICE', 'AUTO_DOWNLOAD'),
      ]);

      await service.updateUserPreferences(COMPANY_ID, USER_ID, [
        { documentType: 'SALES_INVOICE' as any, action: 'AUTO_DOWNLOAD' as any },
      ]);

      expect(mockPrisma.printPreference.deleteMany).toHaveBeenCalledWith({
        where: {
          companyId: COMPANY_ID,
          userId: USER_ID,
          documentType: { in: ['SALES_INVOICE'] },
        },
      });
      // Should NOT upsert since it matches the default
      expect(mockPrisma.printPreference.upsert).not.toHaveBeenCalled();
    });

    it('deletes preference when action matches fallback NONE and no company default', async () => {
      mockPrisma.systemSetting.findMany.mockResolvedValue([]);

      await service.updateUserPreferences(COMPANY_ID, USER_ID, [
        { documentType: 'SALES_INVOICE' as any, action: 'NONE' as any },
      ]);

      expect(mockPrisma.printPreference.deleteMany).toHaveBeenCalledWith({
        where: {
          companyId: COMPANY_ID,
          userId: USER_ID,
          documentType: { in: ['SALES_INVOICE'] },
        },
      });
      expect(mockPrisma.printPreference.upsert).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // getCompanyDefaults
  // -------------------------------------------------------------------------

  describe('getCompanyDefaults', () => {
    it('returns all 14 document types with NONE when no company defaults exist', async () => {
      mockPrisma.systemSetting.findMany.mockResolvedValue([]);

      const result = await service.getCompanyDefaults(COMPANY_ID);

      expect(result).toHaveLength(14);
      for (const def of result) {
        expect(def.action).toBe('NONE');
      }
    });

    it('returns company defaults from system settings', async () => {
      mockPrisma.systemSetting.findMany.mockResolvedValue([
        makeSystemSetting('SALES_INVOICE', 'AUTO_DOWNLOAD'),
        makeSystemSetting('PURCHASE_ORDER', 'BROWSER_PRINT'),
      ]);

      const result = await service.getCompanyDefaults(COMPANY_ID);

      const salesInvoice = result.find((d) => d.documentType === 'SALES_INVOICE')!;
      expect(salesInvoice.action).toBe('AUTO_DOWNLOAD');

      const po = result.find((d) => d.documentType === 'PURCHASE_ORDER')!;
      expect(po.action).toBe('BROWSER_PRINT');

      // Others should be NONE
      const creditNote = result.find((d) => d.documentType === 'CREDIT_NOTE')!;
      expect(creditNote.action).toBe('NONE');
    });

    it('ignores settings with invalid PrintAction values', async () => {
      mockPrisma.systemSetting.findMany.mockResolvedValue([
        makeSystemSetting('SALES_INVOICE', 'INVALID_ACTION'),
      ]);

      const result = await service.getCompanyDefaults(COMPANY_ID);

      const salesInvoice = result.find((d) => d.documentType === 'SALES_INVOICE')!;
      expect(salesInvoice.action).toBe('NONE');
    });
  });

  // -------------------------------------------------------------------------
  // updateCompanyDefaults
  // -------------------------------------------------------------------------

  describe('updateCompanyDefaults', () => {
    it('creates and updates system settings via upsert', async () => {
      await service.updateCompanyDefaults(COMPANY_ID, [
        { documentType: 'SALES_INVOICE' as any, action: 'AUTO_DOWNLOAD' as any },
        { documentType: 'PURCHASE_ORDER' as any, action: 'BROWSER_PRINT' as any },
      ]);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.systemSetting.upsert).toHaveBeenCalledTimes(2);

      expect(mockPrisma.systemSetting.upsert).toHaveBeenCalledWith({
        where: {
          companyId_key: {
            companyId: COMPANY_ID,
            key: 'print.default.SALES_INVOICE',
          },
        },
        create: {
          companyId: COMPANY_ID,
          key: 'print.default.SALES_INVOICE',
          value: 'AUTO_DOWNLOAD',
          valueType: 'STRING',
          category: 'GENERAL',
        },
        update: {
          value: 'AUTO_DOWNLOAD',
        },
      });

      expect(mockPrisma.systemSetting.upsert).toHaveBeenCalledWith({
        where: {
          companyId_key: {
            companyId: COMPANY_ID,
            key: 'print.default.PURCHASE_ORDER',
          },
        },
        create: {
          companyId: COMPANY_ID,
          key: 'print.default.PURCHASE_ORDER',
          value: 'BROWSER_PRINT',
          valueType: 'STRING',
          category: 'GENERAL',
        },
        update: {
          value: 'BROWSER_PRINT',
        },
      });
    });

    it('logs after updating company defaults', async () => {
      await service.updateCompanyDefaults(COMPANY_ID, [
        { documentType: 'SALES_INVOICE' as any, action: 'AUTO_DOWNLOAD' as any },
      ]);

      expect(mockLogger.info).toHaveBeenCalledWith(
        { companyId: COMPANY_ID, count: 1 },
        'print-preference: company defaults updated',
      );
    });
  });
});
