// ---------------------------------------------------------------------------
// Unit tests — DocumentTemplateService CRUD methods (E12-2 Task 7.1)
// ---------------------------------------------------------------------------

import { describe, expect, it, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the service
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    documentTemplate: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock Prisma.PrismaClientKnownRequestError for unique constraint tests
const { MockPrismaClientKnownRequestError } = vi.hoisted(() => {
  class MockPrismaClientKnownRequestError extends Error {
    code: string;
    meta?: Record<string, unknown>;
    clientVersion: string;
    constructor(
      message: string,
      opts: { code: string; clientVersion?: string; meta?: Record<string, unknown> },
    ) {
      super(message);
      this.name = 'PrismaClientKnownRequestError';
      this.code = opts.code;
      this.clientVersion = opts.clientVersion ?? '5.0.0';
      this.meta = opts.meta;
    }
  }
  return { MockPrismaClientKnownRequestError };
});

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  Prisma: {
    PrismaClientKnownRequestError: MockPrismaClientKnownRequestError,
  },
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
import { DocumentType } from '@nexa/db';
import { DomainError } from '../../../core/errors/domain-error.js';

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
const USER_ID = 'user-1';

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
    createdBy: USER_ID,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DocumentTemplateService — CRUD', () => {
  let service: DocumentTemplateService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DocumentTemplateService(mockPrisma as any, mockLogger as any);

    // Default: $transaction passes through to callback
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
  });

  // -------------------------------------------------------------------------
  // listTemplates
  // -------------------------------------------------------------------------

  describe('listTemplates', () => {
    it('returns templates with version count for a company', async () => {
      const templates = [
        { ...makeTemplate(), _count: { versions: 3 } },
        {
          ...makeTemplate({
            id: 'tpl-2',
            name: 'Quote Template',
            documentType: DocumentType.SALES_QUOTE,
          }),
          _count: { versions: 0 },
        },
      ];
      mockPrisma.documentTemplate.count.mockResolvedValueOnce(2);
      mockPrisma.documentTemplate.findMany.mockResolvedValueOnce(templates);

      const result = await service.listTemplates(COMPANY_A, { limit: 50 });

      expect(result.templates).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.cursor).toBeNull();
      expect(mockPrisma.documentTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: COMPANY_A, isActive: true }),
          include: { _count: { select: { versions: true } } },
          orderBy: [{ documentType: 'asc' }, { name: 'asc' }],
          take: 51,
        }),
      );
    });

    it('enforces companyId scoping', async () => {
      mockPrisma.documentTemplate.count.mockResolvedValueOnce(0);
      mockPrisma.documentTemplate.findMany.mockResolvedValueOnce([]);

      await service.listTemplates(COMPANY_B, { limit: 50 });

      expect(mockPrisma.documentTemplate.count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: COMPANY_B }) }),
      );
      expect(mockPrisma.documentTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: COMPANY_B }) }),
      );
    });

    it('filters by documentType when provided', async () => {
      mockPrisma.documentTemplate.count.mockResolvedValueOnce(1);
      mockPrisma.documentTemplate.findMany.mockResolvedValueOnce([
        { ...makeTemplate(), _count: { versions: 0 } },
      ]);

      await service.listTemplates(COMPANY_A, {
        documentType: DocumentType.SALES_INVOICE as any,
        limit: 50,
      });

      expect(mockPrisma.documentTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ documentType: DocumentType.SALES_INVOICE }),
        }),
      );
    });

    it('filters by search (case-insensitive name match)', async () => {
      mockPrisma.documentTemplate.count.mockResolvedValueOnce(1);
      mockPrisma.documentTemplate.findMany.mockResolvedValueOnce([
        { ...makeTemplate(), _count: { versions: 0 } },
      ]);

      await service.listTemplates(COMPANY_A, { search: 'invoice', limit: 50 });

      expect(mockPrisma.documentTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: { contains: 'invoice', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('supports cursor-based pagination', async () => {
      const templates = [
        { ...makeTemplate({ id: 'tpl-2' }), _count: { versions: 0 } },
        { ...makeTemplate({ id: 'tpl-3' }), _count: { versions: 1 } },
        // Extra item signals hasMore
        { ...makeTemplate({ id: 'tpl-4' }), _count: { versions: 0 } },
      ];
      mockPrisma.documentTemplate.count.mockResolvedValueOnce(5);
      mockPrisma.documentTemplate.findMany.mockResolvedValueOnce(templates);

      const result = await service.listTemplates(COMPANY_A, { cursor: 'tpl-1', limit: 2 });

      expect(result.templates).toHaveLength(2);
      expect(result.cursor).toBe('tpl-3');
      expect(result.total).toBe(5);
      expect(mockPrisma.documentTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'tpl-1' },
          skip: 1,
          take: 3,
        }),
      );
    });

    it('defaults isActive to true when not specified', async () => {
      mockPrisma.documentTemplate.count.mockResolvedValueOnce(0);
      mockPrisma.documentTemplate.findMany.mockResolvedValueOnce([]);

      await service.listTemplates(COMPANY_A, { limit: 50 });

      expect(mockPrisma.documentTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it('allows explicit isActive=false filter', async () => {
      mockPrisma.documentTemplate.count.mockResolvedValueOnce(0);
      mockPrisma.documentTemplate.findMany.mockResolvedValueOnce([]);

      await service.listTemplates(COMPANY_A, { isActive: false, limit: 50 });

      expect(mockPrisma.documentTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: false }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getTemplateById
  // -------------------------------------------------------------------------

  describe('getTemplateById', () => {
    it('returns template with versions when found', async () => {
      const template = { ...makeTemplate(), versions: [{ id: 'ver-1', templateId: 'tpl-1' }] };
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(template);

      const result = await service.getTemplateById(COMPANY_A, 'tpl-1');

      expect(result).toBeTruthy();
      expect(result!.id).toBe('tpl-1');
      expect(result!.versions).toHaveLength(1);
      expect(mockPrisma.documentTemplate.findFirst).toHaveBeenCalledWith({
        where: { id: 'tpl-1', companyId: COMPANY_A },
        include: {
          versions: {
            orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
          },
        },
      });
    });

    it('returns null when template belongs to a different company', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(null);

      const result = await service.getTemplateById(COMPANY_B, 'tpl-1');

      expect(result).toBeNull();
      expect(mockPrisma.documentTemplate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'tpl-1', companyId: COMPANY_B },
        }),
      );
    });

    it('returns null when template does not exist', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(null);

      const result = await service.getTemplateById(COMPANY_A, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // createTemplate
  // -------------------------------------------------------------------------

  describe('createTemplate', () => {
    it('creates a template with all fields persisted', async () => {
      const inputData = {
        documentType: DocumentType.SALES_INVOICE as any,
        name: 'My Invoice',
        htmlTemplate: '<html>{{number}}</html>',
        description: 'Test description',
        pageSize: 'Letter',
        orientation: 'landscape',
        marginTop: 25,
        marginBottom: 25,
        marginLeft: 10,
        marginRight: 10,
        showLogo: false,
        logoPosition: 'top-center',
        showBankDetails: false,
        showVatNumber: false,
        showCompanyReg: false,
        isDefault: false,
      };
      const createdTemplate = makeTemplate({ ...inputData, id: 'tpl-new' });
      mockPrisma.documentTemplate.create.mockResolvedValueOnce(createdTemplate);

      const result = await service.createTemplate(COMPANY_A, USER_ID, inputData);

      expect(result.id).toBe('tpl-new');
      expect(mockPrisma.documentTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: COMPANY_A,
          createdBy: USER_ID,
          documentType: DocumentType.SALES_INVOICE,
          name: 'My Invoice',
          htmlTemplate: '<html>{{number}}</html>',
          description: 'Test description',
          pageSize: 'Letter',
          orientation: 'landscape',
          marginTop: 25,
          marginBottom: 25,
          marginLeft: 10,
          marginRight: 10,
          showLogo: false,
          logoPosition: 'top-center',
          showBankDetails: false,
          showVatNumber: false,
          showCompanyReg: false,
          isDefault: false,
        }),
      });
    });

    it('applies default values for optional fields', async () => {
      const inputData = {
        documentType: DocumentType.SALES_INVOICE as any,
        name: 'Minimal Template',
        htmlTemplate: '<html>body</html>',
      };
      mockPrisma.documentTemplate.create.mockResolvedValueOnce(makeTemplate());

      await service.createTemplate(COMPANY_A, USER_ID, inputData);

      expect(mockPrisma.documentTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
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
          isDefault: false,
          description: null,
          headerHtml: null,
          footerHtml: null,
          cssStyles: null,
        }),
      });
    });

    it('unsets existing default when isDefault=true via transaction', async () => {
      const inputData = {
        documentType: DocumentType.SALES_INVOICE as any,
        name: 'New Default',
        htmlTemplate: '<html>new default</html>',
        isDefault: true,
      };
      mockPrisma.documentTemplate.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.documentTemplate.create.mockResolvedValueOnce(
        makeTemplate({ id: 'tpl-new', isDefault: true }),
      );

      await service.createTemplate(COMPANY_A, USER_ID, inputData);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.documentTemplate.updateMany).toHaveBeenCalledWith({
        where: {
          companyId: COMPANY_A,
          documentType: DocumentType.SALES_INVOICE,
          isDefault: true,
        },
        data: { isDefault: false },
      });
      expect(mockPrisma.documentTemplate.create).toHaveBeenCalled();
    });

    it('does not use transaction when isDefault=false', async () => {
      const inputData = {
        documentType: DocumentType.SALES_INVOICE as any,
        name: 'Non-default',
        htmlTemplate: '<html>body</html>',
        isDefault: false,
      };
      mockPrisma.documentTemplate.create.mockResolvedValueOnce(makeTemplate({ isDefault: false }));

      await service.createTemplate(COMPANY_A, USER_ID, inputData);

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      expect(mockPrisma.documentTemplate.create).toHaveBeenCalled();
    });

    it('throws DomainError on unique constraint violation (P2002)', async () => {
      const inputData = {
        documentType: DocumentType.SALES_INVOICE as any,
        name: 'Duplicate Name',
        htmlTemplate: '<html>body</html>',
      };
      mockPrisma.documentTemplate.create.mockRejectedValueOnce(
        new MockPrismaClientKnownRequestError('Unique constraint', { code: 'P2002' }),
      );

      await expect(service.createTemplate(COMPANY_A, USER_ID, inputData)).rejects.toThrow(
        DomainError,
      );

      try {
        mockPrisma.documentTemplate.create.mockRejectedValueOnce(
          new MockPrismaClientKnownRequestError('Unique constraint', { code: 'P2002' }),
        );
        await service.createTemplate(COMPANY_A, USER_ID, inputData);
      } catch (err) {
        expect(err).toBeInstanceOf(DomainError);
        expect((err as DomainError).code).toBe('TEMPLATE_NAME_EXISTS');
      }
    });

    it('re-throws non-P2002 errors', async () => {
      const inputData = {
        documentType: DocumentType.SALES_INVOICE as any,
        name: 'Template',
        htmlTemplate: '<html>body</html>',
      };
      const genericError = new Error('DB connection lost');
      mockPrisma.documentTemplate.create.mockRejectedValueOnce(genericError);

      await expect(service.createTemplate(COMPANY_A, USER_ID, inputData)).rejects.toThrow(
        'DB connection lost',
      );
    });
  });

  // -------------------------------------------------------------------------
  // updateTemplate
  // -------------------------------------------------------------------------

  describe('updateTemplate', () => {
    it('performs partial update — only provided fields are updated', async () => {
      const existing = makeTemplate();
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.documentTemplate.update.mockResolvedValueOnce({
        ...existing,
        name: 'Updated Name',
      });

      const result = await service.updateTemplate(COMPANY_A, 'tpl-1', { name: 'Updated Name' });

      expect(result).toBeTruthy();
      expect(result!.name).toBe('Updated Name');
      expect(mockPrisma.documentTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tpl-1', companyId: COMPANY_A },
        data: { name: 'Updated Name' },
      });
    });

    it('returns null when template belongs to different company', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(null);

      const result = await service.updateTemplate(COMPANY_B, 'tpl-1', { name: 'Hacked' });

      expect(result).toBeNull();
      expect(mockPrisma.documentTemplate.update).not.toHaveBeenCalled();
    });

    it('returns null when template does not exist', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(null);

      const result = await service.updateTemplate(COMPANY_A, 'nonexistent', { name: 'X' });

      expect(result).toBeNull();
    });

    it('unsets existing default when isDefault changed to true via transaction', async () => {
      const existing = makeTemplate({ isDefault: false });
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.documentTemplate.updateMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.documentTemplate.update.mockResolvedValueOnce({ ...existing, isDefault: true });

      await service.updateTemplate(COMPANY_A, 'tpl-1', { isDefault: true });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.documentTemplate.updateMany).toHaveBeenCalledWith({
        where: {
          companyId: COMPANY_A,
          documentType: existing.documentType,
          isDefault: true,
          id: { not: 'tpl-1' },
        },
        data: { isDefault: false },
      });
    });

    it('does not use transaction when isDefault is not set to true', async () => {
      const existing = makeTemplate();
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.documentTemplate.update.mockResolvedValueOnce({
        ...existing,
        name: 'New Name',
      });

      await service.updateTemplate(COMPANY_A, 'tpl-1', { name: 'New Name' });

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws DomainError on unique constraint violation (P2002)', async () => {
      const existing = makeTemplate();
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.documentTemplate.update.mockRejectedValueOnce(
        new MockPrismaClientKnownRequestError('Unique constraint', { code: 'P2002' }),
      );

      await expect(
        service.updateTemplate(COMPANY_A, 'tpl-1', { name: 'Existing Name' }),
      ).rejects.toThrow(DomainError);
    });

    it('does not change documentType (immutable — only updates provided fields)', async () => {
      const existing = makeTemplate();
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.documentTemplate.update.mockResolvedValueOnce(existing);

      // Even if someone passes an update, the service only includes known fields
      await service.updateTemplate(COMPANY_A, 'tpl-1', { showLogo: false });

      const updateCall = mockPrisma.documentTemplate.update.mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('documentType');
      expect(updateCall.data).not.toHaveProperty('companyId');
    });
  });

  // -------------------------------------------------------------------------
  // softDeleteTemplate
  // -------------------------------------------------------------------------

  describe('softDeleteTemplate', () => {
    it('sets isActive to false for an existing template', async () => {
      const existing = makeTemplate();
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(existing);
      mockPrisma.documentTemplate.update.mockResolvedValueOnce({ ...existing, isActive: false });

      const result = await service.softDeleteTemplate(COMPANY_A, 'tpl-1');

      expect(result).toBe(true);
      expect(mockPrisma.documentTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tpl-1', companyId: COMPANY_A },
        data: { isActive: false, isDefault: false },
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        { companyId: COMPANY_A, templateId: 'tpl-1' },
        'document-template: soft-deleted',
      );
    });

    it('returns false when template does not exist', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(null);

      const result = await service.softDeleteTemplate(COMPANY_A, 'nonexistent');

      expect(result).toBe(false);
      expect(mockPrisma.documentTemplate.update).not.toHaveBeenCalled();
    });

    it('returns false when template belongs to different company', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(null);

      const result = await service.softDeleteTemplate(COMPANY_B, 'tpl-1');

      expect(result).toBe(false);
    });
  });
});
