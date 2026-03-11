// ---------------------------------------------------------------------------
// Unit tests — Document Generation Routes (E12-1 Task 6.5)
// ---------------------------------------------------------------------------

import { describe, expect, it, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing the routes
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    documentTemplate: { findFirst: vi.fn() },
    companyProfile: { findUnique: vi.fn() },
  },
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  DocumentType: {
    SALES_INVOICE: 'SALES_INVOICE',
    CREDIT_NOTE: 'CREDIT_NOTE',
    PURCHASE_ORDER: 'PURCHASE_ORDER',
  },
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
}));

vi.mock('@nexa/i18n/server', () => ({
  tServer: (key: string) => key,
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import type { ResolvedTemplate } from '../services/document-template.service.js';
import type { DocumentDataContext } from '../services/document-data-loader.service.js';

// ---------------------------------------------------------------------------
// Helpers — build mock services
// ---------------------------------------------------------------------------

function createMockServices() {
  return {
    templateCompilerService: {
      compile: vi.fn().mockReturnValue('<html><body>Compiled</body></html>'),
    },
    pdfGeneratorService: {
      generatePdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock content')),
      init: vi.fn(),
      close: vi.fn(),
    },
    documentTemplateService: {
      selectTemplateVersion: vi.fn(),
      findActiveTemplate: vi.fn(),
    },
    documentDataLoaderService: {
      loadContext: vi.fn(),
    },
  };
}

function buildResolvedTemplate(overrides?: Partial<ResolvedTemplate>): ResolvedTemplate {
  return {
    template: {
      id: 'tpl-001',
      companyId: 'company-001',
      name: 'Invoice Template',
      documentType: 'SALES_INVOICE',
      description: null,
      isDefault: true,
      isActive: true,
      htmlTemplate: '<h1>{{document.number}}</h1>',
      headerHtml: null,
      footerHtml: null,
      cssStyles: 'body { font-family: sans-serif; }',
      pageSize: 'A4',
      orientation: 'portrait',
      marginTop: 20 as unknown as import('@prisma/client/runtime/library').Decimal,
      marginBottom: 20 as unknown as import('@prisma/client/runtime/library').Decimal,
      marginLeft: 15 as unknown as import('@prisma/client/runtime/library').Decimal,
      marginRight: 15 as unknown as import('@prisma/client/runtime/library').Decimal,
      showLogo: true,
      logoPosition: 'top-left',
      showBankDetails: true,
      showVatNumber: true,
      showCompanyReg: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'user-001',
    } as unknown as ResolvedTemplate['template'],
    version: null,
    mergedHtml: '<h1>{{document.number}}</h1>',
    mergedCss: 'body { font-family: sans-serif; }',
    mergedHeader: null,
    mergedFooter: null,
    emailSettings: null,
    ...overrides,
  };
}

function buildDataContext(): DocumentDataContext {
  return {
    company: {
      name: 'Test Ltd',
      legalName: 'Test Limited',
      address: '1 Test St, London, EC1A 1AA',
      vatNumber: 'GB123456789',
      companyNumber: '12345678',
      bankName: 'Test Bank',
      bankSortCode: '12-34-56',
      bankAccountNumber: '12345678',
      logoUrl: '',
      email: 'info@test.co.uk',
      phone: '020 1234 5678',
      website: 'https://test.co.uk',
    },
    document: {
      number: 'INV-00042',
      date: '2026-03-01',
      dueDate: '2026-03-31',
      reference: 'PO-100',
      notes: '',
      status: 'DRAFT',
      currency: 'GBP',
    },
    counterparty: {
      name: 'Customer Corp',
      address: '2 Customer Rd, Birmingham',
      vatNumber: 'GB987654321',
      contactEmail: 'ap@customer.com',
    },
    lines: [
      {
        lineNumber: 1,
        itemCode: 'WIDGET-01',
        description: 'Widget',
        quantity: 10,
        unitPrice: 100,
        discountPercent: 0,
        vatRate: 20,
        vatAmount: 200,
        lineTotal: 1000,
      },
    ],
    totals: {
      subtotal: 1000,
      vatBreakdown: [{ rate: 20, taxableAmount: 1000, vatAmount: 200 }],
      vatAmount: 200,
      total: 1200,
      amountDue: 1200,
    },
    metadata: {
      paymentTerms: 'Net 30',
      currencyCode: 'GBP',
      currencySymbol: '£',
      formattedDate: '01/03/2026',
      formattedDueDate: '31/03/2026',
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
// Mock Fastify instance for route testing
// ---------------------------------------------------------------------------

interface RouteHandler {
  method: string;
  url: string;
  opts: Record<string, unknown>;
  handler: (request: Record<string, unknown>, reply: Record<string, unknown>) => Promise<unknown>;
}

function createMockFastify(services: ReturnType<typeof createMockServices>) {
  const routes: RouteHandler[] = [];

  const fastify = {
    // Service decorations
    ...services,
    // Route registration
    post: vi.fn((url: string, opts: Record<string, unknown>, handler: RouteHandler['handler']) => {
      routes.push({ method: 'POST', url, opts, handler });
    }),
    get: vi.fn((url: string, opts: Record<string, unknown>, handler: RouteHandler['handler']) => {
      routes.push({ method: 'GET', url, opts, handler });
    }),
    register: vi.fn(),
  };

  return { fastify, routes };
}

function createMockReply() {
  const reply: Record<string, unknown> = {};
  reply.header = vi.fn().mockReturnValue(reply);
  reply.status = vi.fn().mockReturnValue(reply);
  reply.send = vi.fn().mockReturnValue(reply);
  return reply as {
    header: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };
}

function createMockRequest(overrides?: Record<string, unknown>) {
  return {
    companyId: 'company-001',
    userId: 'user-001',
    userRole: 'STAFF',
    tenantId: 'tenant-001',
    enabledModules: [],
    body: {
      documentType: 'SALES_INVOICE',
      recordId: '550e8400-e29b-41d4-a716-446655440000',
      outputFormat: 'inline',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Document Generation Routes (Task 6.5)', () => {
  let services: ReturnType<typeof createMockServices>;

  beforeEach(() => {
    vi.clearAllMocks();
    services = createMockServices();
  });

  // Helper to import and register routes, then return the registered handler
  async function getRegisteredHandler() {
    const { documentGenerationRoutesPlugin } = await import('./document-generation.routes.js');
    const { fastify, routes } = createMockFastify(services);
    await documentGenerationRoutesPlugin(fastify as never);
    const route = routes.find((r) => r.url === '/documents/generate' && r.method === 'POST');
    expect(route).toBeDefined();
    return route!;
  }

  // -------------------------------------------------------------------------
  // Route registration
  // -------------------------------------------------------------------------

  describe('route registration', () => {
    it('registers POST /documents/generate', async () => {
      const route = await getRegisteredHandler();
      expect(route.method).toBe('POST');
      expect(route.url).toBe('/documents/generate');
    });

    it('uses generateDocumentBodySchema for body validation', async () => {
      const route = await getRegisteredHandler();
      const schema = route.opts.schema as Record<string, unknown>;
      expect(schema.body).toBeDefined();
    });

    it('uses RBAC guard with STAFF minimum role', async () => {
      const route = await getRegisteredHandler();
      expect(route.opts.preHandler).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Successful PDF generation
  // -------------------------------------------------------------------------

  describe('successful PDF generation', () => {
    it('returns PDF buffer with correct Content-Type', async () => {
      const resolved = buildResolvedTemplate();
      const dataContext = buildDataContext();
      services.documentTemplateService.selectTemplateVersion.mockResolvedValue(resolved);
      services.documentDataLoaderService.loadContext.mockResolvedValue(dataContext);

      const route = await getRegisteredHandler();
      const request = createMockRequest();
      const reply = createMockReply();

      await route.handler(request, reply);

      expect(reply.header).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(reply.send).toHaveBeenCalledWith(expect.any(Buffer));
    });

    it('calls all services in correct order', async () => {
      const resolved = buildResolvedTemplate();
      const dataContext = buildDataContext();
      services.documentTemplateService.selectTemplateVersion.mockResolvedValue(resolved);
      services.documentDataLoaderService.loadContext.mockResolvedValue(dataContext);

      const route = await getRegisteredHandler();
      const request = createMockRequest();
      const reply = createMockReply();

      await route.handler(request, reply);

      // 1. Template selection
      expect(services.documentTemplateService.selectTemplateVersion).toHaveBeenCalledWith(
        'company-001',
        'SALES_INVOICE',
        expect.objectContaining({
          languageCode: null,
          branchCode: null,
        }),
      );

      // 2. Data context loading
      expect(services.documentDataLoaderService.loadContext).toHaveBeenCalledWith(
        'company-001',
        'SALES_INVOICE',
        '550e8400-e29b-41d4-a716-446655440000',
        expect.objectContaining({ showLogo: true }),
      );

      // 3. Template compilation
      expect(services.templateCompilerService.compile).toHaveBeenCalledWith(
        resolved.mergedHtml,
        expect.any(Object),
        resolved.mergedCss ?? undefined,
      );

      // 4. PDF generation
      expect(services.pdfGeneratorService.generatePdf).toHaveBeenCalledWith(
        '<html><body>Compiled</body></html>',
        expect.objectContaining({
          pageSize: 'A4',
          orientation: 'portrait',
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Output format: inline vs attachment
  // -------------------------------------------------------------------------

  describe('output format', () => {
    it('returns Content-Disposition: inline by default', async () => {
      services.documentTemplateService.selectTemplateVersion.mockResolvedValue(
        buildResolvedTemplate(),
      );
      services.documentDataLoaderService.loadContext.mockResolvedValue(buildDataContext());

      const route = await getRegisteredHandler();
      const request = createMockRequest({
        body: {
          documentType: 'SALES_INVOICE',
          recordId: '550e8400-e29b-41d4-a716-446655440000',
          outputFormat: 'inline',
        },
      });
      const reply = createMockReply();

      await route.handler(request, reply);

      expect(reply.header).toHaveBeenCalledWith('Content-Disposition', 'inline');
    });

    it('returns Content-Disposition: attachment with filename when outputFormat is attachment', async () => {
      services.documentTemplateService.selectTemplateVersion.mockResolvedValue(
        buildResolvedTemplate(),
      );
      services.documentDataLoaderService.loadContext.mockResolvedValue(buildDataContext());

      const route = await getRegisteredHandler();
      const request = createMockRequest({
        body: {
          documentType: 'SALES_INVOICE',
          recordId: '550e8400-e29b-41d4-a716-446655440000',
          outputFormat: 'attachment',
        },
      });
      const reply = createMockReply();

      await route.handler(request, reply);

      expect(reply.header).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="SALES_INVOICE-INV-00042.pdf"',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Response headers
  // -------------------------------------------------------------------------

  describe('response headers', () => {
    it('sets X-Document-Type header', async () => {
      services.documentTemplateService.selectTemplateVersion.mockResolvedValue(
        buildResolvedTemplate(),
      );
      services.documentDataLoaderService.loadContext.mockResolvedValue(buildDataContext());

      const route = await getRegisteredHandler();
      const reply = createMockReply();

      await route.handler(createMockRequest(), reply);

      expect(reply.header).toHaveBeenCalledWith('X-Document-Type', 'SALES_INVOICE');
    });

    it('sets X-Template-Id header', async () => {
      services.documentTemplateService.selectTemplateVersion.mockResolvedValue(
        buildResolvedTemplate(),
      );
      services.documentDataLoaderService.loadContext.mockResolvedValue(buildDataContext());

      const route = await getRegisteredHandler();
      const reply = createMockReply();

      await route.handler(createMockRequest(), reply);

      expect(reply.header).toHaveBeenCalledWith('X-Template-Id', 'tpl-001');
    });

    it('sets X-Template-Version-Id header (empty when no version)', async () => {
      services.documentTemplateService.selectTemplateVersion.mockResolvedValue(
        buildResolvedTemplate({ version: null }),
      );
      services.documentDataLoaderService.loadContext.mockResolvedValue(buildDataContext());

      const route = await getRegisteredHandler();
      const reply = createMockReply();

      await route.handler(createMockRequest(), reply);

      expect(reply.header).toHaveBeenCalledWith('X-Template-Version-Id', '');
    });

    it('sets X-Template-Version-Id when version is selected', async () => {
      const version = {
        id: 'ver-001',
        templateId: 'tpl-001',
        languageCode: 'en',
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
      };
      services.documentTemplateService.selectTemplateVersion.mockResolvedValue(
        buildResolvedTemplate({ version: version as never }),
      );
      services.documentDataLoaderService.loadContext.mockResolvedValue(buildDataContext());

      const route = await getRegisteredHandler();
      const reply = createMockReply();

      await route.handler(createMockRequest(), reply);

      expect(reply.header).toHaveBeenCalledWith('X-Template-Version-Id', 'ver-001');
    });
  });

  // -------------------------------------------------------------------------
  // Error handling: template not found → 404
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('throws TEMPLATE_NOT_FOUND (404) when no template exists', async () => {
      services.documentTemplateService.selectTemplateVersion.mockResolvedValue(null);

      const route = await getRegisteredHandler();
      const request = createMockRequest();
      const reply = createMockReply();

      await expect(route.handler(request, reply)).rejects.toMatchObject({
        code: 'TEMPLATE_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('throws RECORD_NOT_FOUND (404) when record does not exist', async () => {
      services.documentTemplateService.selectTemplateVersion.mockResolvedValue(
        buildResolvedTemplate(),
      );
      services.documentDataLoaderService.loadContext.mockResolvedValue(null);

      const route = await getRegisteredHandler();
      const request = createMockRequest();
      const reply = createMockReply();

      await expect(route.handler(request, reply)).rejects.toMatchObject({
        code: 'RECORD_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('throws TEMPLATE_COMPILATION_ERROR (500) when template fails to compile', async () => {
      services.documentTemplateService.selectTemplateVersion.mockResolvedValue(
        buildResolvedTemplate(),
      );
      services.documentDataLoaderService.loadContext.mockResolvedValue(buildDataContext());
      services.templateCompilerService.compile.mockImplementation(() => {
        throw new Error('Unexpected closing tag');
      });

      const route = await getRegisteredHandler();
      const request = createMockRequest();
      const reply = createMockReply();

      await expect(route.handler(request, reply)).rejects.toMatchObject({
        code: 'TEMPLATE_COMPILATION_ERROR',
        statusCode: 500,
      });
    });

    it('throws PDF_GENERATION_ERROR (500) when PDF rendering fails', async () => {
      services.documentTemplateService.selectTemplateVersion.mockResolvedValue(
        buildResolvedTemplate(),
      );
      services.documentDataLoaderService.loadContext.mockResolvedValue(buildDataContext());
      services.pdfGeneratorService.generatePdf.mockRejectedValue(new Error('Browser crashed'));

      const route = await getRegisteredHandler();
      const request = createMockRequest();
      const reply = createMockReply();

      await expect(route.handler(request, reply)).rejects.toMatchObject({
        code: 'PDF_GENERATION_ERROR',
        statusCode: 500,
      });
    });
  });
});
