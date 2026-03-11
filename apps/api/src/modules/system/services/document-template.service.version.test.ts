// ---------------------------------------------------------------------------
// Unit tests — DocumentTemplateService version management (E12-2 Task 7.2)
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
    documentTemplateVersion: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  Prisma: {},
  DocumentType: {
    SALES_INVOICE: 'SALES_INVOICE',
    CREDIT_NOTE: 'CREDIT_NOTE',
    PURCHASE_ORDER: 'PURCHASE_ORDER',
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { DocumentTemplateService } from './document-template.service.js';
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

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tpl-1',
    companyId: COMPANY_A,
    name: 'Invoice Template',
    documentType: DocumentType.SALES_INVOICE,
    isActive: true,
    ...overrides,
  };
}

function makeVersion(overrides: Record<string, unknown> = {}) {
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

describe('DocumentTemplateService — Version Management', () => {
  let service: DocumentTemplateService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DocumentTemplateService(mockPrisma as any, mockLogger as any);
  });

  // -------------------------------------------------------------------------
  // createVersion
  // -------------------------------------------------------------------------

  describe('createVersion', () => {
    it('creates a version with all fields', async () => {
      const template = makeTemplate();
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(template);

      const versionData = {
        languageCode: 'fr',
        branchCode: 'PARIS',
        numberSeriesId: 'ns-fr',
        accessGroup: 'ag-europe',
        customerGroupId: 'cg-premium',
        htmlOverride: '<html>French</html>',
        cssOverride: 'body { direction: ltr; }',
        headerOverride: '<div>En-tête</div>',
        footerOverride: '<div>Pied de page</div>',
        emailSubject: 'Facture {{number}}',
        emailBody: 'Veuillez trouver ci-joint...',
        replyToEmail: 'facturation@acme.fr',
        ccEmails: 'comptabilite@acme.fr',
        priority: 10,
        isActive: true,
      };

      const createdVersion = makeVersion({ id: 'ver-new', ...versionData });
      mockPrisma.documentTemplateVersion.create.mockResolvedValueOnce(createdVersion);

      const result = await service.createVersion(COMPANY_A, 'tpl-1', versionData);

      expect(result).toBeTruthy();
      expect(result!.id).toBe('ver-new');
      expect(mockPrisma.documentTemplateVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          templateId: 'tpl-1',
          languageCode: 'fr',
          branchCode: 'PARIS',
          priority: 10,
          isActive: true,
        }),
      });
    });

    it('defaults optional fields to null when not provided', async () => {
      const template = makeTemplate();
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(template);
      mockPrisma.documentTemplateVersion.create.mockResolvedValueOnce(
        makeVersion({ id: 'ver-new' }),
      );

      await service.createVersion(COMPANY_A, 'tpl-1', {});

      expect(mockPrisma.documentTemplateVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
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
        }),
      });
    });

    it('verifies template ownership — returns null for wrong company', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(null);

      const result = await service.createVersion(COMPANY_B, 'tpl-1', { languageCode: 'en' });

      expect(result).toBeNull();
      expect(mockPrisma.documentTemplateVersion.create).not.toHaveBeenCalled();
    });

    it('verifies template ownership — returns null for non-existent template', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(null);

      const result = await service.createVersion(COMPANY_A, 'nonexistent', { languageCode: 'en' });

      expect(result).toBeNull();
      expect(mockPrisma.documentTemplateVersion.create).not.toHaveBeenCalled();
    });

    it('checks template with correct where clause', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(null);

      await service.createVersion(COMPANY_A, 'tpl-1', {});

      expect(mockPrisma.documentTemplate.findFirst).toHaveBeenCalledWith({
        where: { id: 'tpl-1', companyId: COMPANY_A },
      });
    });

    it('logs version creation', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(makeTemplate());
      mockPrisma.documentTemplateVersion.create.mockResolvedValueOnce(
        makeVersion({ id: 'ver-new' }),
      );

      await service.createVersion(COMPANY_A, 'tpl-1', { languageCode: 'en' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        { companyId: COMPANY_A, templateId: 'tpl-1', versionId: 'ver-new' },
        'document-template: version created',
      );
    });
  });

  // -------------------------------------------------------------------------
  // updateVersion
  // -------------------------------------------------------------------------

  describe('updateVersion', () => {
    it('performs partial update of version fields', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(makeTemplate());
      mockPrisma.documentTemplateVersion.findFirst.mockResolvedValueOnce(makeVersion());
      const updated = makeVersion({ languageCode: 'de', priority: 5 });
      mockPrisma.documentTemplateVersion.update.mockResolvedValueOnce(updated);

      const result = await service.updateVersion(COMPANY_A, 'tpl-1', 'ver-1', {
        languageCode: 'de',
        priority: 5,
      });

      expect(result).toBeTruthy();
      expect(result!.languageCode).toBe('de');
      expect(mockPrisma.documentTemplateVersion.update).toHaveBeenCalledWith({
        where: { id: 'ver-1', templateId: 'tpl-1' },
        data: expect.objectContaining({
          languageCode: 'de',
          priority: 5,
        }),
      });
    });

    it('returns null when template does not belong to company', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(null);

      const result = await service.updateVersion(COMPANY_B, 'tpl-1', 'ver-1', {
        priority: 10,
      });

      expect(result).toBeNull();
      expect(mockPrisma.documentTemplateVersion.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.documentTemplateVersion.update).not.toHaveBeenCalled();
    });

    it('returns null when version does not belong to template', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(makeTemplate());
      mockPrisma.documentTemplateVersion.findFirst.mockResolvedValueOnce(null);

      const result = await service.updateVersion(COMPANY_A, 'tpl-1', 'ver-wrong', {
        priority: 10,
      });

      expect(result).toBeNull();
      expect(mockPrisma.documentTemplateVersion.update).not.toHaveBeenCalled();
    });

    it('verifies the full ownership chain — template then version', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(makeTemplate());
      mockPrisma.documentTemplateVersion.findFirst.mockResolvedValueOnce(makeVersion());
      mockPrisma.documentTemplateVersion.update.mockResolvedValueOnce(makeVersion());

      await service.updateVersion(COMPANY_A, 'tpl-1', 'ver-1', { isActive: false });

      expect(mockPrisma.documentTemplate.findFirst).toHaveBeenCalledWith({
        where: { id: 'tpl-1', companyId: COMPANY_A },
      });
      expect(mockPrisma.documentTemplateVersion.findFirst).toHaveBeenCalledWith({
        where: { id: 'ver-1', templateId: 'tpl-1' },
      });
    });

    it('only includes provided fields in update data', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(makeTemplate());
      mockPrisma.documentTemplateVersion.findFirst.mockResolvedValueOnce(makeVersion());
      mockPrisma.documentTemplateVersion.update.mockResolvedValueOnce(
        makeVersion({ emailSubject: 'New Subject' }),
      );

      await service.updateVersion(COMPANY_A, 'tpl-1', 'ver-1', {
        emailSubject: 'New Subject',
      });

      const updateData = mockPrisma.documentTemplateVersion.update.mock.calls[0][0].data;
      expect(updateData).toEqual({ emailSubject: 'New Subject' });
    });
  });

  // -------------------------------------------------------------------------
  // deleteVersion
  // -------------------------------------------------------------------------

  describe('deleteVersion', () => {
    it('hard-deletes a version and returns true', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(makeTemplate());
      mockPrisma.documentTemplateVersion.findFirst.mockResolvedValueOnce(makeVersion());
      mockPrisma.documentTemplateVersion.delete.mockResolvedValueOnce(makeVersion());

      const result = await service.deleteVersion(COMPANY_A, 'tpl-1', 'ver-1');

      expect(result).toBe(true);
      expect(mockPrisma.documentTemplateVersion.delete).toHaveBeenCalledWith({
        where: { id: 'ver-1', templateId: 'tpl-1' },
      });
    });

    it('returns false when template does not belong to company', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(null);

      const result = await service.deleteVersion(COMPANY_B, 'tpl-1', 'ver-1');

      expect(result).toBe(false);
      expect(mockPrisma.documentTemplateVersion.delete).not.toHaveBeenCalled();
    });

    it('returns false when version does not belong to template', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(makeTemplate());
      mockPrisma.documentTemplateVersion.findFirst.mockResolvedValueOnce(null);

      const result = await service.deleteVersion(COMPANY_A, 'tpl-1', 'ver-wrong');

      expect(result).toBe(false);
      expect(mockPrisma.documentTemplateVersion.delete).not.toHaveBeenCalled();
    });

    it('verifies ownership chain before deleting', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(makeTemplate());
      mockPrisma.documentTemplateVersion.findFirst.mockResolvedValueOnce(makeVersion());
      mockPrisma.documentTemplateVersion.delete.mockResolvedValueOnce(makeVersion());

      await service.deleteVersion(COMPANY_A, 'tpl-1', 'ver-1');

      expect(mockPrisma.documentTemplate.findFirst).toHaveBeenCalledWith({
        where: { id: 'tpl-1', companyId: COMPANY_A },
      });
      expect(mockPrisma.documentTemplateVersion.findFirst).toHaveBeenCalledWith({
        where: { id: 'ver-1', templateId: 'tpl-1' },
      });
    });

    it('logs version deletion', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(makeTemplate());
      mockPrisma.documentTemplateVersion.findFirst.mockResolvedValueOnce(makeVersion());
      mockPrisma.documentTemplateVersion.delete.mockResolvedValueOnce(makeVersion());

      await service.deleteVersion(COMPANY_A, 'tpl-1', 'ver-1');

      expect(mockLogger.info).toHaveBeenCalledWith(
        { companyId: COMPANY_A, templateId: 'tpl-1', versionId: 'ver-1' },
        'document-template: version deleted',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Cross-company access
  // -------------------------------------------------------------------------

  describe('cross-company access', () => {
    it('createVersion returns null for cross-company template', async () => {
      // Template belongs to COMPANY_A, accessing with COMPANY_B
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(null);

      const result = await service.createVersion(COMPANY_B, 'tpl-1', { languageCode: 'en' });
      expect(result).toBeNull();
    });

    it('updateVersion returns null for cross-company template', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(null);

      const result = await service.updateVersion(COMPANY_B, 'tpl-1', 'ver-1', { priority: 5 });
      expect(result).toBeNull();
    });

    it('deleteVersion returns false for cross-company template', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce(null);

      const result = await service.deleteVersion(COMPANY_B, 'tpl-1', 'ver-1');
      expect(result).toBe(false);
    });
  });
});
