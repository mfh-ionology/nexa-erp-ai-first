// ---------------------------------------------------------------------------
// Integration tests — Document Template Management Routes (E12-2 Task 8)
// Tests CRUD endpoints (8.1), version management (8.2), and preview (8.3).
// Uses real Fastify injection with mocked auth middleware and service layer.
// ---------------------------------------------------------------------------

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  mockResolveUserRole,
  mockPermissionService,
  mockDocumentTemplateService,
  mockTemplateCompilerService,
  mockPdfGeneratorService,
  mockSampleDataGeneratorService,
} = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    companyProfile: { findUnique: vi.fn() },
  },
  mockResolveUserRole: vi.fn(),
  mockPermissionService: {
    getEffectivePermissions: vi.fn(),
    hasPermission: vi.fn(),
    invalidateUser: vi.fn(),
    invalidateGroup: vi.fn(),
    invalidateAll: vi.fn(),
    clearCache: vi.fn(),
    getCacheSize: vi.fn(),
    deriveEnabledModules: vi.fn(),
    getFieldVisibility: vi.fn(),
  },
  mockDocumentTemplateService: {
    listTemplates: vi.fn(),
    getTemplateById: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    softDeleteTemplate: vi.fn(),
    createVersion: vi.fn(),
    updateVersion: vi.fn(),
    deleteVersion: vi.fn(),
    // E12-1 methods (not used in these routes but exist on the service)
    findActiveTemplate: vi.fn(),
    selectTemplateVersion: vi.fn(),
  },
  mockTemplateCompilerService: {
    compile: vi.fn(),
  },
  mockPdfGeneratorService: {
    generatePdf: vi.fn(),
    init: vi.fn(),
    close: vi.fn(),
  },
  mockSampleDataGeneratorService: {
    generateSampleData: vi.fn(),
  },
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  resolveUserRole: mockResolveUserRole,
  DocumentType: {
    SALES_INVOICE: 'SALES_INVOICE',
    CREDIT_NOTE: 'CREDIT_NOTE',
    PROFORMA_INVOICE: 'PROFORMA_INVOICE',
    CASH_RECEIPT: 'CASH_RECEIPT',
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
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
}));

vi.mock('../../../core/rbac/permission.service.js', () => ({
  permissionService: mockPermissionService,
  PermissionService: vi.fn(),
  ACTION_FLAG_MAP: { new: 'canNew', view: 'canView', edit: 'canEdit', delete: 'canDelete' },
}));

vi.mock('@nexa/i18n/server', () => ({
  tServer: (key: string, _params?: Record<string, string>) => key,
  mapZodIssueToTranslationKey: (_issue: unknown) => ({ key: 'validation.error', params: {} }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../../../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../../../core/middleware/company-context.js';
import { registerErrorHandler } from '../../../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../../core/validation/index.js';
import { documentTemplateRoutesPlugin } from './document-template.routes.js';
import { DomainError } from '../../../core/errors/index.js';
import {
  makeTestJwt,
  authHeaders,
  TEST_JWT_SECRET,
  TEST_USER_ID,
  TEST_COMPANY_ID,
} from '../../../test-utils/jwt.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const OTHER_COMPANY_ID = '22222222-2222-4000-a000-222222222222';
const TEMPLATE_ID = 'tpl-00000000-0000-4000-a000-000000000001';
const TEMPLATE_ID_2 = 'tpl-00000000-0000-4000-a000-000000000002';
const VERSION_ID = 'ver-00000000-0000-4000-a000-000000000001';
const VERSION_ID_2 = 'ver-00000000-0000-4000-a000-000000000002';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: TEMPLATE_ID,
    companyId: TEST_COMPANY_ID,
    documentType: 'SALES_INVOICE',
    name: 'Standard Invoice',
    description: null,
    htmlTemplate: '<h1>{{document.number}}</h1>',
    headerHtml: null,
    footerHtml: null,
    cssStyles: 'body { font-family: sans-serif; }',
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
    isActive: true,
    createdBy: TEST_USER_ID,
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: new Date('2026-03-01T00:00:00Z'),
    ...overrides,
  };
}

function makeTemplateWithCount(overrides: Record<string, unknown> = {}) {
  return {
    ...makeTemplate(overrides),
    _count: { versions: (overrides._count as { versions: number })?.versions ?? 0 },
  };
}

function makeVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: VERSION_ID,
    templateId: TEMPLATE_ID,
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
    createdAt: new Date('2026-03-01T00:00:00Z'),
    updatedAt: new Date('2026-03-01T00:00:00Z'),
    ...overrides,
  };
}

function makeSampleData() {
  return {
    company: {
      name: 'Acme Ltd',
      legalName: 'Acme Trading Limited',
      address: 'Unit 12, Business Park\n123 High Street\nLondon\nEC1A 1BB',
      vatNumber: 'GB 123 456 789',
      companyNumber: '12345678',
      bankName: 'Barclays Bank',
      bankSortCode: '20-00-00',
      bankAccountNumber: '12345678',
      email: 'accounts@acme.co.uk',
      phone: '+44 20 7946 0958',
      logoUrl: null,
      website: '',
    },
    document: {
      number: 'INV-00042',
      date: '15/02/2026',
      dueDate: '17/03/2026',
      reference: 'PO-12345',
      notes: '',
      status: 'DRAFT',
      currency: 'GBP',
    },
    counterparty: {
      name: 'Widget Corp Ltd',
      address: '10 Widget Way, Manchester, M1 1AA',
      vatNumber: 'GB 987 654 321',
      contactEmail: 'ap@widgetcorp.co.uk',
    },
    lines: [
      {
        lineNumber: 1,
        itemCode: 'WIDGET-A',
        description: 'Standard Widget Type A',
        quantity: 100,
        unitPrice: 50.0,
        discountPercent: 0,
        vatRate: 20,
        vatAmount: 1000.0,
        lineTotal: 5000.0,
      },
    ],
    totals: {
      subtotal: 5000.0,
      vatBreakdown: [{ rate: 20, taxableAmount: 5000.0, vatAmount: 1000.0 }],
      vatAmount: 1000.0,
      total: 6000.0,
      amountDue: 6000.0,
    },
    metadata: {
      paymentTerms: 'Net 30',
      currencyCode: 'GBP',
      currencySymbol: '£',
      formattedDate: '15/02/2026',
      formattedDueDate: '17/03/2026',
    },
    branding: {
      showLogo: true,
      logoPosition: 'top-left',
      showBankDetails: true,
      showVatNumber: true,
      showCompanyReg: true,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);

  registerErrorHandler(app);

  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);

  // Decorate mock services (routes access these via fastify.*)
  app.decorate('documentTemplateService', mockDocumentTemplateService);
  app.decorate('templateCompilerService', mockTemplateCompilerService);
  app.decorate('pdfGeneratorService', mockPdfGeneratorService);
  app.decorate('sampleDataGeneratorService', mockSampleDataGeneratorService);

  await app.register(documentTemplateRoutesPlugin);

  await app.ready();
  return app;
}

/**
 * Configure argument-based mock implementations for auth middleware.
 * The role parameter controls what the RBAC guard sees.
 */
function setupMocks(config: { role?: string } = {}) {
  const role = config.role ?? 'ADMIN';

  mockPrisma.user.findUnique.mockResolvedValue({
    companyId: TEST_COMPANY_ID,
    isActive: true,
  });

  mockPrisma.companyProfile.findUnique.mockResolvedValue({ isActive: true });
  mockResolveUserRole.mockResolvedValue(role);

  mockPermissionService.getEffectivePermissions.mockImplementation(
    async (_prisma: unknown, _userId: string, _companyId: string, userRole: string) => {
      const fullPerm = {
        canAccess: true,
        canNew: true,
        canView: true,
        canEdit: true,
        canDelete: true,
      };
      return {
        permissions: { 'system.document-template': fullPerm },
        fieldOverrides: {},
        accessGroups: [],
        role: userRole,
        isSuperAdmin: false,
        enabledModules: ['system'],
      };
    },
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let adminJwt: string;
let managerJwt: string;
let staffJwt: string;
let viewerJwt: string;

beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  adminJwt = await makeTestJwt({ role: 'ADMIN' });
  managerJwt = await makeTestJwt({ role: 'MANAGER' });
  staffJwt = await makeTestJwt({ role: 'STAFF' });
  viewerJwt = await makeTestJwt({ role: 'VIEWER' });
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 8.1 — Template CRUD Integration Tests
// ---------------------------------------------------------------------------

describe('Template CRUD Routes (8.1)', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // -------------------------------------------------------------------------
  // POST /document-templates — Create
  // -------------------------------------------------------------------------

  describe('POST /document-templates', () => {
    const validPayload = {
      documentType: 'SALES_INVOICE',
      name: 'Standard Invoice',
      htmlTemplate: '<h1>{{document.number}}</h1>',
    };

    it('creates template and returns 201 with id', async () => {
      setupMocks();
      const created = makeTemplate();
      mockDocumentTemplateService.createTemplate.mockResolvedValue(created);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/document-templates',
        headers: authHeaders(adminJwt),
        payload: validPayload,
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(TEMPLATE_ID);
      expect(body.data.documentType).toBe('SALES_INVOICE');
    });

    it('passes companyId and userId to service', async () => {
      setupMocks();
      mockDocumentTemplateService.createTemplate.mockResolvedValue(makeTemplate());
      app = await buildTestApp();

      await app.inject({
        method: 'POST',
        url: '/document-templates',
        headers: authHeaders(adminJwt),
        payload: validPayload,
      });

      expect(mockDocumentTemplateService.createTemplate).toHaveBeenCalledWith(
        TEST_COMPANY_ID,
        TEST_USER_ID,
        expect.objectContaining({
          documentType: 'SALES_INVOICE',
          name: 'Standard Invoice',
          htmlTemplate: '<h1>{{document.number}}</h1>',
        }),
      );
    });

    it('applies schema defaults for optional fields', async () => {
      setupMocks();
      mockDocumentTemplateService.createTemplate.mockResolvedValue(makeTemplate());
      app = await buildTestApp();

      await app.inject({
        method: 'POST',
        url: '/document-templates',
        headers: authHeaders(adminJwt),
        payload: validPayload,
      });

      const callData = mockDocumentTemplateService.createTemplate.mock.calls[0][2];
      expect(callData.pageSize).toBe('A4');
      expect(callData.orientation).toBe('portrait');
      expect(callData.marginTop).toBe(20);
      expect(callData.showLogo).toBe(true);
      expect(callData.isDefault).toBe(false);
    });

    it('returns 400 when name is missing', async () => {
      setupMocks();
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/document-templates',
        headers: authHeaders(adminJwt),
        payload: { documentType: 'SALES_INVOICE', htmlTemplate: '<h1>Test</h1>' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().success).toBe(false);
    });

    it('returns 400 when htmlTemplate is missing', async () => {
      setupMocks();
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/document-templates',
        headers: authHeaders(adminJwt),
        payload: { documentType: 'SALES_INVOICE', name: 'Test' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for invalid documentType', async () => {
      setupMocks();
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/document-templates',
        headers: authHeaders(adminJwt),
        payload: { ...validPayload, documentType: 'INVALID_TYPE' },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // GET /document-templates — List
  // -------------------------------------------------------------------------

  describe('GET /document-templates', () => {
    it('returns 200 with templates and version count', async () => {
      setupMocks();
      const tpl = makeTemplateWithCount({ _count: { versions: 3 } });
      mockDocumentTemplateService.listTemplates.mockResolvedValue({
        templates: [tpl],
        cursor: null,
        total: 1,
      });
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/document-templates',
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].versionCount).toBe(3);
      expect(body.meta.hasMore).toBe(false);
      expect(body.meta.total).toBe(1);
    });

    it('passes documentType filter to service', async () => {
      setupMocks();
      mockDocumentTemplateService.listTemplates.mockResolvedValue({
        templates: [],
        cursor: null,
        total: 0,
      });
      app = await buildTestApp();

      await app.inject({
        method: 'GET',
        url: '/document-templates?documentType=SALES_INVOICE',
        headers: authHeaders(adminJwt),
      });

      expect(mockDocumentTemplateService.listTemplates).toHaveBeenCalledWith(
        TEST_COMPANY_ID,
        expect.objectContaining({ documentType: 'SALES_INVOICE' }),
      );
    });

    it('passes search filter to service', async () => {
      setupMocks();
      mockDocumentTemplateService.listTemplates.mockResolvedValue({
        templates: [],
        cursor: null,
        total: 0,
      });
      app = await buildTestApp();

      await app.inject({
        method: 'GET',
        url: '/document-templates?search=Invoice',
        headers: authHeaders(adminJwt),
      });

      expect(mockDocumentTemplateService.listTemplates).toHaveBeenCalledWith(
        TEST_COMPANY_ID,
        expect.objectContaining({ search: 'Invoice' }),
      );
    });

    it('supports cursor-based pagination', async () => {
      setupMocks();
      mockDocumentTemplateService.listTemplates.mockResolvedValue({
        templates: [makeTemplateWithCount({ id: TEMPLATE_ID_2 })],
        cursor: TEMPLATE_ID_2,
        total: 5,
      });
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: `/document-templates?cursor=${TEMPLATE_ID}&limit=1`,
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.meta.hasMore).toBe(true);
      expect(body.meta.cursor).toBe(TEMPLATE_ID_2);
    });

    it('defaults limit to 50', async () => {
      setupMocks();
      mockDocumentTemplateService.listTemplates.mockResolvedValue({
        templates: [],
        cursor: null,
        total: 0,
      });
      app = await buildTestApp();

      await app.inject({
        method: 'GET',
        url: '/document-templates',
        headers: authHeaders(adminJwt),
      });

      expect(mockDocumentTemplateService.listTemplates).toHaveBeenCalledWith(
        TEST_COMPANY_ID,
        expect.objectContaining({ limit: 50 }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // GET /document-templates/:id — Detail
  // -------------------------------------------------------------------------

  describe('GET /document-templates/:id', () => {
    it('returns 200 with template and versions array', async () => {
      setupMocks();
      const tpl = { ...makeTemplate(), versions: [makeVersion()] };
      mockDocumentTemplateService.getTemplateById.mockResolvedValue(tpl);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: `/document-templates/${TEMPLATE_ID}`,
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(TEMPLATE_ID);
      expect(body.data.versions).toHaveLength(1);
      expect(body.data.versions[0].id).toBe(VERSION_ID);
    });

    it('returns 404 when template not found', async () => {
      setupMocks();
      mockDocumentTemplateService.getTemplateById.mockResolvedValue(null);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: `/document-templates/${TEMPLATE_ID}`,
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('TEMPLATE_NOT_FOUND');
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /document-templates/:id — Update
  // -------------------------------------------------------------------------

  describe('PATCH /document-templates/:id', () => {
    it('returns 200 with updated template', async () => {
      setupMocks();
      const updated = makeTemplate({ name: 'Updated Invoice' });
      mockDocumentTemplateService.updateTemplate.mockResolvedValue(updated);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'PATCH',
        url: `/document-templates/${TEMPLATE_ID}`,
        headers: authHeaders(adminJwt),
        payload: { name: 'Updated Invoice' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.name).toBe('Updated Invoice');
    });

    it('returns 404 when template not found', async () => {
      setupMocks();
      mockDocumentTemplateService.updateTemplate.mockResolvedValue(null);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'PATCH',
        url: `/document-templates/${TEMPLATE_ID}`,
        headers: authHeaders(adminJwt),
        payload: { name: 'Updated' },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('TEMPLATE_NOT_FOUND');
    });

    it('returns 400 when no fields provided', async () => {
      setupMocks();
      app = await buildTestApp();

      const res = await app.inject({
        method: 'PATCH',
        url: `/document-templates/${TEMPLATE_ID}`,
        headers: authHeaders(adminJwt),
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /document-templates/:id — Soft-delete
  // -------------------------------------------------------------------------

  describe('DELETE /document-templates/:id', () => {
    it('returns 204 on successful soft-delete', async () => {
      setupMocks();
      mockDocumentTemplateService.softDeleteTemplate.mockResolvedValue(true);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'DELETE',
        url: `/document-templates/${TEMPLATE_ID}`,
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(204);
    });

    it('calls softDeleteTemplate with correct args', async () => {
      setupMocks();
      mockDocumentTemplateService.softDeleteTemplate.mockResolvedValue(true);
      app = await buildTestApp();

      await app.inject({
        method: 'DELETE',
        url: `/document-templates/${TEMPLATE_ID}`,
        headers: authHeaders(adminJwt),
      });

      expect(mockDocumentTemplateService.softDeleteTemplate).toHaveBeenCalledWith(
        TEST_COMPANY_ID,
        TEMPLATE_ID,
      );
    });

    it('returns 404 when template not found', async () => {
      setupMocks();
      mockDocumentTemplateService.softDeleteTemplate.mockResolvedValue(false);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'DELETE',
        url: `/document-templates/${TEMPLATE_ID}`,
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('TEMPLATE_NOT_FOUND');
    });
  });

  // -------------------------------------------------------------------------
  // isDefault management
  // -------------------------------------------------------------------------

  describe('isDefault management', () => {
    it('creates template with isDefault=true via service', async () => {
      setupMocks();
      const created = makeTemplate({ isDefault: true });
      mockDocumentTemplateService.createTemplate.mockResolvedValue(created);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/document-templates',
        headers: authHeaders(adminJwt),
        payload: {
          documentType: 'SALES_INVOICE',
          name: 'New Default',
          htmlTemplate: '<h1>Default</h1>',
          isDefault: true,
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().data.isDefault).toBe(true);

      // Verify service was called with isDefault: true
      const callData = mockDocumentTemplateService.createTemplate.mock.calls[0][2];
      expect(callData.isDefault).toBe(true);
    });

    it('updates template with isDefault=true via service', async () => {
      setupMocks();
      const updated = makeTemplate({ isDefault: true });
      mockDocumentTemplateService.updateTemplate.mockResolvedValue(updated);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'PATCH',
        url: `/document-templates/${TEMPLATE_ID}`,
        headers: authHeaders(adminJwt),
        payload: { isDefault: true },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.isDefault).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Unique constraint violation → 409
  // -------------------------------------------------------------------------

  describe('unique constraint violation', () => {
    it('returns 409 when creating template with duplicate name+type', async () => {
      setupMocks();
      mockDocumentTemplateService.createTemplate.mockRejectedValue(
        new DomainError(
          'TEMPLATE_NAME_EXISTS',
          'A template with this name already exists for this document type',
        ),
      );
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/document-templates',
        headers: authHeaders(adminJwt),
        payload: {
          documentType: 'SALES_INVOICE',
          name: 'Duplicate Name',
          htmlTemplate: '<h1>Test</h1>',
        },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('TEMPLATE_NAME_EXISTS');
    });

    it('returns 409 when updating template to duplicate name+type', async () => {
      setupMocks();
      mockDocumentTemplateService.updateTemplate.mockRejectedValue(
        new DomainError(
          'TEMPLATE_NAME_EXISTS',
          'A template with this name already exists for this document type',
        ),
      );
      app = await buildTestApp();

      const res = await app.inject({
        method: 'PATCH',
        url: `/document-templates/${TEMPLATE_ID}`,
        headers: authHeaders(adminJwt),
        payload: { name: 'Duplicate Name' },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error.code).toBe('TEMPLATE_NAME_EXISTS');
    });
  });

  // -------------------------------------------------------------------------
  // companyId isolation
  // -------------------------------------------------------------------------

  describe('companyId isolation', () => {
    it('GET detail returns 404 for cross-company template', async () => {
      setupMocks();
      // Service returns null because companyId doesn't match
      mockDocumentTemplateService.getTemplateById.mockResolvedValue(null);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: `/document-templates/${TEMPLATE_ID}`,
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(404);
      // Verify service was called with the authenticated user's companyId
      expect(mockDocumentTemplateService.getTemplateById).toHaveBeenCalledWith(
        TEST_COMPANY_ID,
        TEMPLATE_ID,
      );
    });

    it('DELETE returns 404 for cross-company template', async () => {
      setupMocks();
      mockDocumentTemplateService.softDeleteTemplate.mockResolvedValue(false);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'DELETE',
        url: `/document-templates/${TEMPLATE_ID}`,
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(404);
    });

    it('PATCH returns 404 for cross-company template', async () => {
      setupMocks();
      mockDocumentTemplateService.updateTemplate.mockResolvedValue(null);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'PATCH',
        url: `/document-templates/${TEMPLATE_ID}`,
        headers: authHeaders(adminJwt),
        payload: { name: 'Should Fail' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // RBAC enforcement
  // -------------------------------------------------------------------------

  describe('RBAC enforcement', () => {
    it('ADMIN → 200 on GET list', async () => {
      setupMocks({ role: 'ADMIN' });
      mockDocumentTemplateService.listTemplates.mockResolvedValue({
        templates: [],
        cursor: null,
        total: 0,
      });
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/document-templates',
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(200);
    });

    it('MANAGER → 403 on all endpoints', async () => {
      setupMocks({ role: 'MANAGER' });
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/document-templates',
        headers: authHeaders(managerJwt),
      });

      expect(res.statusCode).toBe(403);
    });

    it('STAFF → 403 on POST create', async () => {
      setupMocks({ role: 'STAFF' });
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: '/document-templates',
        headers: authHeaders(staffJwt),
        payload: {
          documentType: 'SALES_INVOICE',
          name: 'Test',
          htmlTemplate: '<h1>Test</h1>',
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('VIEWER → 403 on DELETE', async () => {
      setupMocks({ role: 'VIEWER' });
      app = await buildTestApp();

      const res = await app.inject({
        method: 'DELETE',
        url: `/document-templates/${TEMPLATE_ID}`,
        headers: authHeaders(viewerJwt),
      });

      expect(res.statusCode).toBe(403);
    });

    it('unauthenticated → 401', async () => {
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: '/document-templates',
      });

      expect(res.statusCode).toBe(401);
    });
  });
});

// ---------------------------------------------------------------------------
// 8.2 — Version Management Integration Tests
// ---------------------------------------------------------------------------

describe('Version Management Routes (8.2)', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // -------------------------------------------------------------------------
  // POST /document-templates/:id/versions — Create version
  // -------------------------------------------------------------------------

  describe('POST /document-templates/:id/versions', () => {
    it('creates version and returns 201', async () => {
      setupMocks();
      const version = makeVersion({ languageCode: 'fr', priority: 5 });
      mockDocumentTemplateService.createVersion.mockResolvedValue(version);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: `/document-templates/${TEMPLATE_ID}/versions`,
        headers: authHeaders(adminJwt),
        payload: { languageCode: 'fr', priority: 5 },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(VERSION_ID);
      expect(body.data.languageCode).toBe('fr');
    });

    it('passes companyId and templateId to service', async () => {
      setupMocks();
      mockDocumentTemplateService.createVersion.mockResolvedValue(makeVersion());
      app = await buildTestApp();

      await app.inject({
        method: 'POST',
        url: `/document-templates/${TEMPLATE_ID}/versions`,
        headers: authHeaders(adminJwt),
        payload: { branchCode: 'MAIN' },
      });

      expect(mockDocumentTemplateService.createVersion).toHaveBeenCalledWith(
        TEST_COMPANY_ID,
        TEMPLATE_ID,
        expect.objectContaining({ branchCode: 'MAIN' }),
      );
    });

    it('returns 404 when template not found', async () => {
      setupMocks();
      mockDocumentTemplateService.createVersion.mockResolvedValue(null);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: `/document-templates/${TEMPLATE_ID}/versions`,
        headers: authHeaders(adminJwt),
        payload: { languageCode: 'en' },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('TEMPLATE_NOT_FOUND');
    });

    it('returns 404 when template belongs to different company', async () => {
      setupMocks();
      // Service returns null for cross-company access
      mockDocumentTemplateService.createVersion.mockResolvedValue(null);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: `/document-templates/${TEMPLATE_ID}/versions`,
        headers: authHeaders(adminJwt),
        payload: {},
      });

      expect(res.statusCode).toBe(404);
    });

    it('applies default values for priority and isActive', async () => {
      setupMocks();
      mockDocumentTemplateService.createVersion.mockResolvedValue(makeVersion());
      app = await buildTestApp();

      await app.inject({
        method: 'POST',
        url: `/document-templates/${TEMPLATE_ID}/versions`,
        headers: authHeaders(adminJwt),
        payload: {},
      });

      const callData = mockDocumentTemplateService.createVersion.mock.calls[0][2];
      expect(callData.priority).toBe(0);
      expect(callData.isActive).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /document-templates/:id/versions/:versionId — Update version
  // -------------------------------------------------------------------------

  describe('PATCH /document-templates/:id/versions/:versionId', () => {
    it('updates version and returns 200', async () => {
      setupMocks();
      const updated = makeVersion({ priority: 10 });
      mockDocumentTemplateService.updateVersion.mockResolvedValue(updated);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'PATCH',
        url: `/document-templates/${TEMPLATE_ID}/versions/${VERSION_ID}`,
        headers: authHeaders(adminJwt),
        payload: { priority: 10 },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.priority).toBe(10);
    });

    it('passes all four IDs to service (companyId, templateId, versionId, data)', async () => {
      setupMocks();
      mockDocumentTemplateService.updateVersion.mockResolvedValue(makeVersion());
      app = await buildTestApp();

      await app.inject({
        method: 'PATCH',
        url: `/document-templates/${TEMPLATE_ID}/versions/${VERSION_ID}`,
        headers: authHeaders(adminJwt),
        payload: { isActive: false },
      });

      expect(mockDocumentTemplateService.updateVersion).toHaveBeenCalledWith(
        TEST_COMPANY_ID,
        TEMPLATE_ID,
        VERSION_ID,
        expect.objectContaining({ isActive: false }),
      );
    });

    it('returns 404 when template or version not found', async () => {
      setupMocks();
      mockDocumentTemplateService.updateVersion.mockResolvedValue(null);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'PATCH',
        url: `/document-templates/${TEMPLATE_ID}/versions/${VERSION_ID}`,
        headers: authHeaders(adminJwt),
        payload: { priority: 5 },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when no fields provided', async () => {
      setupMocks();
      app = await buildTestApp();

      const res = await app.inject({
        method: 'PATCH',
        url: `/document-templates/${TEMPLATE_ID}/versions/${VERSION_ID}`,
        headers: authHeaders(adminJwt),
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /document-templates/:id/versions/:versionId — Delete version
  // -------------------------------------------------------------------------

  describe('DELETE /document-templates/:id/versions/:versionId', () => {
    it('deletes version and returns 204', async () => {
      setupMocks();
      mockDocumentTemplateService.deleteVersion.mockResolvedValue(true);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'DELETE',
        url: `/document-templates/${TEMPLATE_ID}/versions/${VERSION_ID}`,
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(204);
    });

    it('passes companyId, templateId, versionId to service', async () => {
      setupMocks();
      mockDocumentTemplateService.deleteVersion.mockResolvedValue(true);
      app = await buildTestApp();

      await app.inject({
        method: 'DELETE',
        url: `/document-templates/${TEMPLATE_ID}/versions/${VERSION_ID}`,
        headers: authHeaders(adminJwt),
      });

      expect(mockDocumentTemplateService.deleteVersion).toHaveBeenCalledWith(
        TEST_COMPANY_ID,
        TEMPLATE_ID,
        VERSION_ID,
      );
    });

    it('returns 404 when template or version not found', async () => {
      setupMocks();
      mockDocumentTemplateService.deleteVersion.mockResolvedValue(false);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'DELETE',
        url: `/document-templates/${TEMPLATE_ID}/versions/${VERSION_ID}`,
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // -------------------------------------------------------------------------
  // RBAC enforcement on version endpoints
  // -------------------------------------------------------------------------

  describe('version RBAC enforcement', () => {
    it('MANAGER → 403 on POST create version', async () => {
      setupMocks({ role: 'MANAGER' });
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: `/document-templates/${TEMPLATE_ID}/versions`,
        headers: authHeaders(managerJwt),
        payload: { priority: 1 },
      });

      expect(res.statusCode).toBe(403);
    });

    it('STAFF → 403 on PATCH update version', async () => {
      setupMocks({ role: 'STAFF' });
      app = await buildTestApp();

      const res = await app.inject({
        method: 'PATCH',
        url: `/document-templates/${TEMPLATE_ID}/versions/${VERSION_ID}`,
        headers: authHeaders(staffJwt),
        payload: { priority: 2 },
      });

      expect(res.statusCode).toBe(403);
    });

    it('VIEWER → 403 on DELETE version', async () => {
      setupMocks({ role: 'VIEWER' });
      app = await buildTestApp();

      const res = await app.inject({
        method: 'DELETE',
        url: `/document-templates/${TEMPLATE_ID}/versions/${VERSION_ID}`,
        headers: authHeaders(viewerJwt),
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // -------------------------------------------------------------------------
  // Version appears in template detail
  // -------------------------------------------------------------------------

  describe('version in template detail', () => {
    it('GET /document-templates/:id includes versions', async () => {
      setupMocks();
      const tpl = {
        ...makeTemplate(),
        versions: [
          makeVersion({ id: VERSION_ID, priority: 10 }),
          makeVersion({ id: VERSION_ID_2, priority: 5 }),
        ],
      };
      mockDocumentTemplateService.getTemplateById.mockResolvedValue(tpl);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'GET',
        url: `/document-templates/${TEMPLATE_ID}`,
        headers: authHeaders(adminJwt),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.versions).toHaveLength(2);
    });
  });
});

// ---------------------------------------------------------------------------
// 8.3 — Preview Integration Tests
// ---------------------------------------------------------------------------

describe('Preview Route (8.3)', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  // -------------------------------------------------------------------------
  // Successful preview
  // -------------------------------------------------------------------------

  describe('POST /document-templates/:id/preview', () => {
    it('returns 200 with PDF content-type', async () => {
      setupMocks();
      const tpl = { ...makeTemplate(), versions: [] };
      mockDocumentTemplateService.getTemplateById.mockResolvedValue(tpl);
      mockSampleDataGeneratorService.generateSampleData.mockReturnValue(makeSampleData());
      mockTemplateCompilerService.compile.mockReturnValue('<html>Compiled</html>');
      mockPdfGeneratorService.generatePdf.mockResolvedValue(Buffer.from('%PDF-1.4 mock'));
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: `/document-templates/${TEMPLATE_ID}/preview`,
        headers: authHeaders(adminJwt),
        payload: {},
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('preview-SALES_INVOICE.pdf');
    });

    it('returns PDF buffer starting with %PDF', async () => {
      setupMocks();
      const tpl = { ...makeTemplate(), versions: [] };
      mockDocumentTemplateService.getTemplateById.mockResolvedValue(tpl);
      mockSampleDataGeneratorService.generateSampleData.mockReturnValue(makeSampleData());
      mockTemplateCompilerService.compile.mockReturnValue('<html>Compiled</html>');
      mockPdfGeneratorService.generatePdf.mockResolvedValue(Buffer.from('%PDF-1.4 mock content'));
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: `/document-templates/${TEMPLATE_ID}/preview`,
        headers: authHeaders(adminJwt),
        payload: {},
      });

      expect(res.rawPayload.toString().startsWith('%PDF')).toBe(true);
    });

    it('calls services in correct order: load → sample data → compile → PDF', async () => {
      setupMocks();
      const tpl = { ...makeTemplate(), versions: [] };
      const sampleData = makeSampleData();
      mockDocumentTemplateService.getTemplateById.mockResolvedValue(tpl);
      mockSampleDataGeneratorService.generateSampleData.mockReturnValue(sampleData);
      mockTemplateCompilerService.compile.mockReturnValue('<html>Done</html>');
      mockPdfGeneratorService.generatePdf.mockResolvedValue(Buffer.from('%PDF'));
      app = await buildTestApp();

      await app.inject({
        method: 'POST',
        url: `/document-templates/${TEMPLATE_ID}/preview`,
        headers: authHeaders(adminJwt),
        payload: {},
      });

      // 1. Load template
      expect(mockDocumentTemplateService.getTemplateById).toHaveBeenCalledWith(
        TEST_COMPANY_ID,
        TEMPLATE_ID,
      );

      // 2. Generate sample data
      expect(mockSampleDataGeneratorService.generateSampleData).toHaveBeenCalledWith(
        'SALES_INVOICE',
      );

      // 3. Compile template
      expect(mockTemplateCompilerService.compile).toHaveBeenCalledWith(
        tpl.htmlTemplate,
        expect.objectContaining({
          company: sampleData.company,
          branding: expect.objectContaining({ showLogo: true }),
        }),
        tpl.cssStyles ?? undefined,
      );

      // 4. Generate PDF
      expect(mockPdfGeneratorService.generatePdf).toHaveBeenCalledWith(
        '<html>Done</html>',
        expect.objectContaining({
          pageSize: 'A4',
          orientation: 'portrait',
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Preview with version overrides
  // -------------------------------------------------------------------------

  describe('preview with versionId', () => {
    it('applies version overrides to base template', async () => {
      setupMocks();
      const version = makeVersion({
        id: VERSION_ID,
        htmlOverride: '<h1>Overridden</h1>',
        cssOverride: 'body { color: red; }',
      });
      const tpl = { ...makeTemplate(), versions: [version] };
      mockDocumentTemplateService.getTemplateById.mockResolvedValue(tpl);
      mockSampleDataGeneratorService.generateSampleData.mockReturnValue(makeSampleData());
      mockTemplateCompilerService.compile.mockReturnValue('<html>Versioned</html>');
      mockPdfGeneratorService.generatePdf.mockResolvedValue(Buffer.from('%PDF'));
      app = await buildTestApp();

      await app.inject({
        method: 'POST',
        url: `/document-templates/${TEMPLATE_ID}/preview`,
        headers: authHeaders(adminJwt),
        payload: { versionId: VERSION_ID },
      });

      // compile should receive the version overrides, not the base template
      expect(mockTemplateCompilerService.compile).toHaveBeenCalledWith(
        '<h1>Overridden</h1>',
        expect.any(Object),
        'body { color: red; }',
      );
    });

    it('returns 404 when versionId not found in template', async () => {
      setupMocks();
      const tpl = { ...makeTemplate(), versions: [] };
      mockDocumentTemplateService.getTemplateById.mockResolvedValue(tpl);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: `/document-templates/${TEMPLATE_ID}/preview`,
        headers: authHeaders(adminJwt),
        payload: { versionId: 'non-existent-version-id' },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('VERSION_NOT_FOUND');
    });
  });

  // -------------------------------------------------------------------------
  // Preview error handling
  // -------------------------------------------------------------------------

  describe('preview error handling', () => {
    it('returns 404 when template not found', async () => {
      setupMocks();
      mockDocumentTemplateService.getTemplateById.mockResolvedValue(null);
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: `/document-templates/${TEMPLATE_ID}/preview`,
        headers: authHeaders(adminJwt),
        payload: {},
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('TEMPLATE_NOT_FOUND');
    });

    it('returns 422 when template compilation fails (bad Handlebars)', async () => {
      setupMocks();
      const tpl = { ...makeTemplate({ htmlTemplate: '{{#if}}broken{{/unless}}' }), versions: [] };
      mockDocumentTemplateService.getTemplateById.mockResolvedValue(tpl);
      mockSampleDataGeneratorService.generateSampleData.mockReturnValue(makeSampleData());
      mockTemplateCompilerService.compile.mockImplementation(() => {
        throw new Error('Parse error: Unexpected closing tag');
      });
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: `/document-templates/${TEMPLATE_ID}/preview`,
        headers: authHeaders(adminJwt),
        payload: {},
      });

      expect(res.statusCode).toBe(422);
      expect(res.json().error.code).toBe('TEMPLATE_COMPILATION_ERROR');
      expect(res.json().error.message).toContain('Parse error');
    });

    it('returns 500 when PDF generation fails', async () => {
      setupMocks();
      const tpl = { ...makeTemplate(), versions: [] };
      mockDocumentTemplateService.getTemplateById.mockResolvedValue(tpl);
      mockSampleDataGeneratorService.generateSampleData.mockReturnValue(makeSampleData());
      mockTemplateCompilerService.compile.mockReturnValue('<html>OK</html>');
      mockPdfGeneratorService.generatePdf.mockRejectedValue(new Error('Browser crashed'));
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: `/document-templates/${TEMPLATE_ID}/preview`,
        headers: authHeaders(adminJwt),
        payload: {},
      });

      expect(res.statusCode).toBe(500);
      expect(res.json().error.code).toBe('PDF_GENERATION_ERROR');
    });
  });

  // -------------------------------------------------------------------------
  // Preview RBAC
  // -------------------------------------------------------------------------

  describe('preview RBAC', () => {
    it('STAFF → 403 on preview', async () => {
      setupMocks({ role: 'STAFF' });
      app = await buildTestApp();

      const res = await app.inject({
        method: 'POST',
        url: `/document-templates/${TEMPLATE_ID}/preview`,
        headers: authHeaders(staffJwt),
        payload: {},
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
