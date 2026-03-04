// ---------------------------------------------------------------------------
// Unit tests for EmailTemplateService — E10-2 Task 8.2
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    emailTemplate: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      constructor(message: string, opts: { code: string; clientVersion: string }) {
        super(message);
        this.code = opts.code;
      }
    },
    EmailTemplateWhereInput: {},
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { EmailTemplateService } from './email-template.service.js';
import { EmailTemplateEngineService } from './email-template-engine.service.js';
import { Prisma } from '@nexa/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER_ID = '00000000-0000-4000-a000-000000000001';
const now = new Date('2026-03-01');

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

function makeTemplateRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    code: 'INVOICE_SEND',
    name: 'Invoice Send',
    description: null,
    documentType: 'CustomerInvoice',
    subjectTemplate: 'Invoice {{invoiceNumber}} from {{companyName}}',
    bodyHtmlTemplate: '<p>Dear {{customerName}}</p>',
    bodyTextTemplate: null,
    openingTextCode: null,
    closingTextCode: null,
    languageCode: 'en',
    attachPdf: true,
    autoSend: false,
    isActive: true,
    createdBy: TEST_USER_ID,
    updatedBy: TEST_USER_ID,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;
  let engine: EmailTemplateEngineService;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new EmailTemplateEngineService(mockLogger);
    service = new EmailTemplateService(mockPrisma as never, mockLogger, engine);
  });

  // -------------------------------------------------------------------------
  // createTemplate
  // -------------------------------------------------------------------------

  describe('createTemplate', () => {
    it('creates template with valid input', async () => {
      const expected = makeTemplateRecord();
      mockPrisma.emailTemplate.create.mockResolvedValue(expected);

      const result = await service.createTemplate(TEST_USER_ID, {
        code: 'INVOICE_SEND',
        name: 'Invoice Send',
        documentType: 'CustomerInvoice',
        subjectTemplate: 'Invoice {{invoiceNumber}} from {{companyName}}',
        bodyHtmlTemplate: '<p>Dear {{customerName}}</p>',
      });

      expect(result).toEqual(expected);
      expect(mockPrisma.emailTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: 'INVOICE_SEND',
            createdBy: TEST_USER_ID,
            updatedBy: TEST_USER_ID,
          }),
        }),
      );
    });

    it('rejects duplicate code with 409 conflict', async () => {
      const err = new (Prisma.PrismaClientKnownRequestError as any)('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.0.0',
      });
      mockPrisma.emailTemplate.create.mockRejectedValue(err);

      await expect(
        service.createTemplate(TEST_USER_ID, {
          code: 'INVOICE_SEND',
          name: 'Dupe',
          documentType: 'CustomerInvoice',
          subjectTemplate: '{{invoiceNumber}}',
          bodyHtmlTemplate: '<p>{{customerName}}</p>',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'CONFLICT',
          statusCode: 409,
        }),
      );
    });

    it('rejects invalid documentType', async () => {
      await expect(
        service.createTemplate(TEST_USER_ID, {
          code: 'TEST',
          name: 'Test',
          documentType: 'FakeType',
          subjectTemplate: 'Subject',
          bodyHtmlTemplate: '<p>Body</p>',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
          statusCode: 400,
        }),
      );
    });

    it('rejects invalid Handlebars syntax', async () => {
      await expect(
        service.createTemplate(TEST_USER_ID, {
          code: 'TEST',
          name: 'Test',
          documentType: 'CustomerInvoice',
          subjectTemplate: '{{invoiceNumber}}',
          bodyHtmlTemplate: '{{#if customerName}}unclosed',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      );
    });

    it('rejects template with unknown variables', async () => {
      await expect(
        service.createTemplate(TEST_USER_ID, {
          code: 'TEST',
          name: 'Test',
          documentType: 'CustomerInvoice',
          subjectTemplate: '{{unknownVar}}',
          bodyHtmlTemplate: '<p>body</p>',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: 'VALIDATION_ERROR',
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // updateTemplate
  // -------------------------------------------------------------------------

  describe('updateTemplate', () => {
    it('updates template and invalidates cache', async () => {
      const existing = makeTemplateRecord();
      const updated = { ...existing, name: 'Updated Name' };
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(existing);
      mockPrisma.emailTemplate.update.mockResolvedValue(updated);

      const invalidateSpy = vi.spyOn(engine, 'invalidateCache');

      const result = await service.updateTemplate(existing.id, TEST_USER_ID, {
        name: 'Updated Name',
      });

      expect(result).toEqual(updated);
      expect(invalidateSpy).toHaveBeenCalledWith(existing.id);
    });

    it('returns null when template not found', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);

      const result = await service.updateTemplate(randomUUID(), TEST_USER_ID, {
        name: 'Updated',
      });

      expect(result).toBeNull();
    });

    it('re-validates when body is changed', async () => {
      const existing = makeTemplateRecord();
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(existing);

      await expect(
        service.updateTemplate(existing.id, TEST_USER_ID, {
          bodyHtmlTemplate: '<p>{{unknownField}}</p>',
        }),
      ).rejects.toThrow(expect.objectContaining({ code: 'VALIDATION_ERROR' }));
    });

    it('skips validation when only non-template fields change', async () => {
      const existing = makeTemplateRecord();
      const updated = { ...existing, name: 'New Name' };
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(existing);
      mockPrisma.emailTemplate.update.mockResolvedValue(updated);

      const result = await service.updateTemplate(existing.id, TEST_USER_ID, {
        name: 'New Name',
      });

      expect(result!.name).toBe('New Name');
    });
  });

  // -------------------------------------------------------------------------
  // deleteTemplate (soft-delete)
  // -------------------------------------------------------------------------

  describe('deleteTemplate', () => {
    it('sets isActive to false (soft-delete) and invalidates cache', async () => {
      const existing = makeTemplateRecord();
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(existing);
      mockPrisma.emailTemplate.update.mockResolvedValue({ ...existing, isActive: false });

      const invalidateSpy = vi.spyOn(engine, 'invalidateCache');

      const result = await service.deleteTemplate(existing.id);

      expect(result).toBe(true);
      expect(mockPrisma.emailTemplate.update).toHaveBeenCalledWith({
        where: { id: existing.id },
        data: { isActive: false },
      });
      expect(invalidateSpy).toHaveBeenCalledWith(existing.id);
    });

    it('returns false when template not found', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);

      const result = await service.deleteTemplate(randomUUID());

      expect(result).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // resolveTemplate
  // -------------------------------------------------------------------------

  describe('resolveTemplate', () => {
    it('returns exact match by documentType + languageCode', async () => {
      const template = makeTemplateRecord({ languageCode: 'fr' });
      mockPrisma.emailTemplate.findFirst.mockResolvedValue(template);

      const result = await service.resolveTemplate('CustomerInvoice', 'fr');

      expect(result).toEqual(template);
      expect(mockPrisma.emailTemplate.findFirst).toHaveBeenCalledWith({
        where: { documentType: 'CustomerInvoice', languageCode: 'fr', isActive: true },
      });
    });

    it('falls back to default language (en) when specific language not found', async () => {
      const enTemplate = makeTemplateRecord({ languageCode: 'en' });
      mockPrisma.emailTemplate.findFirst
        .mockResolvedValueOnce(null) // fr not found
        .mockResolvedValueOnce(enTemplate); // en found

      const result = await service.resolveTemplate('CustomerInvoice', 'fr');

      expect(result).toEqual(enTemplate);
    });

    it('falls back to any active template for documentType', async () => {
      const anyTemplate = makeTemplateRecord({ languageCode: 'de' });
      mockPrisma.emailTemplate.findFirst
        .mockResolvedValueOnce(null) // fr not found
        .mockResolvedValueOnce(null) // en not found
        .mockResolvedValueOnce(anyTemplate); // any active

      const result = await service.resolveTemplate('CustomerInvoice', 'fr');

      expect(result).toEqual(anyTemplate);
    });

    it('returns null when no template exists', async () => {
      mockPrisma.emailTemplate.findFirst.mockResolvedValue(null);

      const result = await service.resolveTemplate('CustomerInvoice', 'fr');

      expect(result).toBeNull();
    });

    it('defaults to "en" when no languageCode provided', async () => {
      const enTemplate = makeTemplateRecord();
      mockPrisma.emailTemplate.findFirst.mockResolvedValueOnce(enTemplate);

      const result = await service.resolveTemplate('CustomerInvoice');

      expect(result).toEqual(enTemplate);
      // Should query with languageCode: 'en' as exact match
      expect(mockPrisma.emailTemplate.findFirst).toHaveBeenCalledTimes(1);
      expect(mockPrisma.emailTemplate.findFirst).toHaveBeenCalledWith({
        where: { documentType: 'CustomerInvoice', languageCode: 'en', isActive: true },
      });
    });
  });

  // -------------------------------------------------------------------------
  // listTemplates
  // -------------------------------------------------------------------------

  describe('listTemplates', () => {
    it('filters by documentType', async () => {
      mockPrisma.emailTemplate.findMany.mockResolvedValue([]);

      await service.listTemplates({ documentType: 'CustomerInvoice' });

      expect(mockPrisma.emailTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ documentType: 'CustomerInvoice' }),
        }),
      );
    });

    it('filters by isActive', async () => {
      mockPrisma.emailTemplate.findMany.mockResolvedValue([]);

      await service.listTemplates({ isActive: true });

      expect(mockPrisma.emailTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it('supports cursor-based pagination', async () => {
      const cursorId = randomUUID();
      mockPrisma.emailTemplate.findMany.mockResolvedValue([]);

      await service.listTemplates({ cursor: cursorId, limit: 10 });

      expect(mockPrisma.emailTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: cursorId },
          skip: 1,
          take: 11,
        }),
      );
    });

    it('returns hasMore when extra items exist', async () => {
      const items = Array.from({ length: 21 }, () => makeTemplateRecord());
      mockPrisma.emailTemplate.findMany.mockResolvedValue(items);

      const result = await service.listTemplates({ limit: 20 });

      expect(result.items).toHaveLength(20);
      expect(result.meta.hasMore).toBe(true);
      expect(result.meta.cursor).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // previewTemplate
  // -------------------------------------------------------------------------

  describe('previewTemplate', () => {
    it('returns rendered preview with sample data', async () => {
      const template = makeTemplateRecord();
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(template);

      const result = await service.previewTemplate(template.id);

      expect(result).not.toBeNull();
      expect(result!.subject).toContain('INV-00042');
      expect(result!.bodyHtml).toContain('Acme Ltd');
      expect(result!.sampleData).toBeDefined();
    });

    it('returns null when template not found', async () => {
      mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);

      const result = await service.previewTemplate(randomUUID());

      expect(result).toBeNull();
    });
  });
});
