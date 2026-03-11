// ---------------------------------------------------------------------------
// Integration tests — Document Generation Pipeline (E12-1 Task 9)
//
// These tests wire up REAL services (TemplateCompiler, DocumentTemplate,
// DocumentDataLoader) with a mocked Prisma layer and a mocked PDF generator.
// They verify the full pipeline from route handler → service chain → response.
// ---------------------------------------------------------------------------

import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — Prisma, i18n, and BullMQ queue (must be before imports)
// ---------------------------------------------------------------------------

const { mockPrisma, mockEnqueuePdfBatch, mockGetPdfBatchQueue } = vi.hoisted(() => ({
  mockPrisma: {
    documentTemplate: { findFirst: vi.fn() },
    companyProfile: { findUnique: vi.fn() },
  },
  mockEnqueuePdfBatch: vi.fn(),
  mockGetPdfBatchQueue: vi.fn(),
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

vi.mock('../queues/pdf-batch-generate.queue.js', () => ({
  enqueuePdfBatch: mockEnqueuePdfBatch,
  getPdfBatchQueue: mockGetPdfBatchQueue,
  PDF_BATCH_GENERATE_QUEUE_NAME: 'pdf-batch-generate',
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { TemplateCompilerService } from '../services/template-compiler.service.js';
import { DocumentTemplateService } from '../services/document-template.service.js';
import { DocumentDataLoaderService } from '../services/document-data-loader.service.js';
import type { PdfGeneratorService } from '../services/pdf-generator.service.js';
import { documentGenerationRoutesPlugin } from './document-generation.routes.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COMPANY_A = 'company-a-11111111-1111-4000-a000-111111111111';
const COMPANY_B = 'company-b-22222222-2222-4000-a000-222222222222';
const RECORD_ID = '550e8400-e29b-41d4-a716-446655440001';
const RECORD_ID_2 = '550e8400-e29b-41d4-a716-446655440002';
const RECORD_ID_3 = '550e8400-e29b-41d4-a716-446655440003';

// Realistic PDF header bytes
const PDF_BUFFER = Buffer.from('%PDF-1.4 mock pdf content for integration testing');

// ---------------------------------------------------------------------------
// Shared mock logger
// ---------------------------------------------------------------------------

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// ---------------------------------------------------------------------------
// Test data builders
// ---------------------------------------------------------------------------

function makeCompanyProfile(companyId: string) {
  return {
    id: companyId,
    name: 'Acme Ltd',
    legalName: 'Acme Limited',
    addressLine1: '10 Test Street',
    addressLine2: null,
    city: 'London',
    county: null,
    postcode: 'EC1A 1BB',
    countryCode: 'GB',
    vatNumber: 'GB123456789',
    registrationNumber: '12345678',
    logoUrl: 'https://example.com/logo.png',
    email: 'info@acme.co.uk',
    phone: '020 7946 0958',
    website: 'https://acme.co.uk',
    currencyCode: 'GBP',
    financialYearStart: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeTemplate(companyId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'tpl-int-001',
    companyId,
    name: 'Invoice Template',
    documentType: 'SALES_INVOICE',
    description: 'Standard sales invoice',
    isDefault: true,
    isActive: true,
    htmlTemplate:
      '<html><head></head><body>' +
      '<h1>{{company.name}}</h1>' +
      '<p>Invoice: {{document.number}}</p>' +
      '<p>Date: {{document.date}}</p>' +
      '{{#if branding.showVatNumber}}<p>VAT: {{company.vatNumber}}</p>{{/if}}' +
      '{{#each lines}}<div>{{lineNumber @index}}: {{description}} - {{formatCurrency lineTotal "GBP"}}</div>{{/each}}' +
      '<p>Total: {{formatCurrency totals.total "GBP"}}</p>' +
      '</body></html>',
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
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'user-001',
    ...overrides,
  };
}

function makeVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ver-int-001',
    templateId: 'tpl-int-001',
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
// Mock Fastify plumbing (direct route handler invocation)
// ---------------------------------------------------------------------------

interface RouteHandler {
  method: string;
  url: string;
  opts: Record<string, unknown>;
  handler: (request: Record<string, unknown>, reply: Record<string, unknown>) => Promise<unknown>;
}

function createReply() {
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

function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    companyId: COMPANY_A,
    userId: 'user-int-001',
    userRole: 'STAFF',
    tenantId: COMPANY_A,
    enabledModules: ['SYSTEM'],
    body: {
      documentType: 'SALES_INVOICE',
      recordId: RECORD_ID,
      outputFormat: 'inline',
    },
    params: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Integration test setup — wire real services with mock boundaries
// ---------------------------------------------------------------------------

describe('Document Generation — Integration Tests (Task 9)', () => {
  let templateCompilerService: TemplateCompilerService;
  let documentTemplateService: DocumentTemplateService;
  let documentDataLoaderService: DocumentDataLoaderService;
  let mockPdfGeneratorService: PdfGeneratorService;
  let routes: RouteHandler[];

  beforeEach(async () => {
    vi.clearAllMocks();

    // Real services with mocked Prisma
    templateCompilerService = new TemplateCompilerService(mockLogger);
    documentTemplateService = new DocumentTemplateService(mockPrisma as never, mockLogger);
    documentDataLoaderService = new DocumentDataLoaderService(mockPrisma as never, mockLogger);

    // Mock PDF generator — returns a realistic PDF-like buffer
    mockPdfGeneratorService = {
      init: vi.fn(),
      close: vi.fn(),
      generatePdf: vi.fn().mockResolvedValue(PDF_BUFFER),
    } as unknown as PdfGeneratorService;

    // Register routes against a mock Fastify that has real services decorated
    routes = [];
    const mockFastify = {
      templateCompilerService,
      pdfGeneratorService: mockPdfGeneratorService,
      documentTemplateService,
      documentDataLoaderService,
      post: vi.fn(
        (url: string, opts: Record<string, unknown>, handler: RouteHandler['handler']) => {
          routes.push({ method: 'POST', url, opts, handler });
        },
      ),
      get: vi.fn((url: string, opts: Record<string, unknown>, handler: RouteHandler['handler']) => {
        routes.push({ method: 'GET', url, opts, handler });
      }),
      register: vi.fn(),
    };

    await documentGenerationRoutesPlugin(mockFastify as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function getRoute(method: string, url: string): RouteHandler {
    const route = routes.find((r) => r.method === method && r.url === url);
    if (!route) throw new Error(`Route ${method} ${url} not found`);
    return route;
  }

  // =========================================================================
  // 9.1 — End-to-end generation test
  // =========================================================================

  describe('9.1 — End-to-end document generation', () => {
    it('generates a valid PDF from a seeded template and record', async () => {
      // Seed: company profile for data loader
      mockPrisma.companyProfile.findUnique.mockResolvedValue(makeCompanyProfile(COMPANY_A));

      // Seed: template with Handlebars content
      const template = makeTemplate(COMPANY_A);
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...template,
        versions: [],
      });

      const route = getRoute('POST', '/documents/generate');
      const request = createRequest();
      const reply = createReply();

      await route.handler(request, reply);

      // Verify PDF response
      expect(reply.header).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(reply.send).toHaveBeenCalledTimes(1);

      const sentBuffer = reply.send.mock.calls[0][0] as Buffer;
      expect(Buffer.isBuffer(sentBuffer)).toBe(true);
      expect(sentBuffer.toString('utf-8').startsWith('%PDF')).toBe(true);
    });

    it('passes compiled HTML (with Handlebars resolved) to the PDF generator', async () => {
      mockPrisma.companyProfile.findUnique.mockResolvedValue(makeCompanyProfile(COMPANY_A));
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...makeTemplate(COMPANY_A),
        versions: [],
      });

      const route = getRoute('POST', '/documents/generate');
      await route.handler(createRequest(), createReply());

      // The real TemplateCompilerService should have compiled the Handlebars template
      // and the compiled HTML should have been passed to the PDF generator
      const generatePdfCalls = (mockPdfGeneratorService.generatePdf as ReturnType<typeof vi.fn>)
        .mock.calls;
      expect(generatePdfCalls).toHaveLength(1);

      const compiledHtml = generatePdfCalls[0][0] as string;
      // Handlebars variables should be resolved (not raw {{...}} syntax)
      expect(compiledHtml).toContain('Acme Ltd');
      expect(compiledHtml).not.toContain('{{company.name}}');
      // VAT number should appear (showVatNumber = true)
      expect(compiledHtml).toContain('GB123456789');
    });

    it('injects CSS into the compiled HTML', async () => {
      mockPrisma.companyProfile.findUnique.mockResolvedValue(makeCompanyProfile(COMPANY_A));
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...makeTemplate(COMPANY_A),
        versions: [],
      });

      const route = getRoute('POST', '/documents/generate');
      await route.handler(createRequest(), createReply());

      const compiledHtml = (mockPdfGeneratorService.generatePdf as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(compiledHtml).toContain('<style>');
      expect(compiledHtml).toContain('font-family: sans-serif');
    });

    it('passes correct PDF options from template settings', async () => {
      mockPrisma.companyProfile.findUnique.mockResolvedValue(makeCompanyProfile(COMPANY_A));
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...makeTemplate(COMPANY_A, { pageSize: 'Letter', orientation: 'landscape', marginTop: 25 }),
        versions: [],
      });

      const route = getRoute('POST', '/documents/generate');
      await route.handler(createRequest(), createReply());

      const pdfOptions = (mockPdfGeneratorService.generatePdf as ReturnType<typeof vi.fn>).mock
        .calls[0][1];
      expect(pdfOptions.pageSize).toBe('Letter');
      expect(pdfOptions.orientation).toBe('landscape');
      expect(pdfOptions.marginTop).toBe(25);
    });

    it('returns Content-Disposition: attachment with filename when requested', async () => {
      mockPrisma.companyProfile.findUnique.mockResolvedValue(makeCompanyProfile(COMPANY_A));
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...makeTemplate(COMPANY_A),
        versions: [],
      });

      const route = getRoute('POST', '/documents/generate');
      const request = createRequest({
        body: { documentType: 'SALES_INVOICE', recordId: RECORD_ID, outputFormat: 'attachment' },
      });
      const reply = createReply();

      await route.handler(request, reply);

      // The stub data loader generates STUB-{first8chars} as the doc number
      const dispositionCalls = reply.header.mock.calls.filter(
        (c: unknown[]) => c[0] === 'Content-Disposition',
      );
      expect(dispositionCalls).toHaveLength(1);
      expect(dispositionCalls[0][1]).toMatch(/^attachment; filename="SALES_INVOICE-.+\.pdf"$/);
    });
  });

  // =========================================================================
  // 9.2 — Version selection integration test
  // =========================================================================

  describe('9.2 — Version selection with context matching', () => {
    it('selects the correct version and reports it in X-Template-Version-Id', async () => {
      mockPrisma.companyProfile.findUnique.mockResolvedValue(makeCompanyProfile(COMPANY_A));

      // 3 versions with different criteria
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
      const versionEnLondon = makeVersion({
        id: 'ver-en-london',
        languageCode: 'en',
        branchCode: 'LONDON',
        priority: 0,
      });

      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...makeTemplate(COMPANY_A),
        versions: [versionEn, versionFr, versionEnLondon],
      });

      const route = getRoute('POST', '/documents/generate');
      const reply = createReply();

      await route.handler(createRequest(), reply);

      // With null context from the route handler, all versions with non-null
      // criteria will get mismatch penalties. The version with fewest criteria
      // (wildcard) would score 0, while others score negatively.
      // versionEn: languageCode='en' vs null → mismatch -20
      // versionFr: languageCode='fr' vs null → mismatch -20
      // versionEnLondon: languageCode='en' + branchCode='LONDON' vs null → -20 + -16 = -36
      // All negative → falls back to base template (no version)
      expect(reply.header).toHaveBeenCalledWith('X-Template-Version-Id', '');
      expect(reply.header).toHaveBeenCalledWith('X-Template-Id', 'tpl-int-001');
    });

    it('selects version with highest positive score when context matches', async () => {
      mockPrisma.companyProfile.findUnique.mockResolvedValue(makeCompanyProfile(COMPANY_A));

      // Create versions where one will match the null context (wildcard)
      const wildcardVersion = makeVersion({
        id: 'ver-wildcard',
        priority: 5, // Higher priority as wildcard
      });
      const specificVersion = makeVersion({
        id: 'ver-specific',
        languageCode: 'en', // Will mismatch null context → -20
        priority: 10,
      });

      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...makeTemplate(COMPANY_A),
        versions: [wildcardVersion, specificVersion],
      });

      const route = getRoute('POST', '/documents/generate');
      const reply = createReply();

      await route.handler(createRequest(), reply);

      // wildcardVersion scores 0 (all null criteria), specificVersion scores -20
      // wildcardVersion wins with score 0
      expect(reply.header).toHaveBeenCalledWith('X-Template-Version-Id', 'ver-wildcard');
    });

    it('applies version HTML override when version is selected', async () => {
      mockPrisma.companyProfile.findUnique.mockResolvedValue(makeCompanyProfile(COMPANY_A));

      const overrideVersion = makeVersion({
        id: 'ver-override',
        htmlOverride: '<html><body><h1>OVERRIDDEN: {{company.name}}</h1></body></html>',
        priority: 1,
      });

      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...makeTemplate(COMPANY_A),
        versions: [overrideVersion],
      });

      const route = getRoute('POST', '/documents/generate');
      await route.handler(createRequest(), createReply());

      const compiledHtml = (mockPdfGeneratorService.generatePdf as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(compiledHtml).toContain('OVERRIDDEN: Acme Ltd');
      expect(compiledHtml).not.toContain('{{company.name}}');
    });

    it('applies version CSS override when present', async () => {
      mockPrisma.companyProfile.findUnique.mockResolvedValue(makeCompanyProfile(COMPANY_A));

      const cssOverrideVersion = makeVersion({
        id: 'ver-css-override',
        cssOverride: 'body { font-family: monospace; color: red; }',
        priority: 1,
      });

      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...makeTemplate(COMPANY_A),
        versions: [cssOverrideVersion],
      });

      const route = getRoute('POST', '/documents/generate');
      await route.handler(createRequest(), createReply());

      const compiledHtml = (mockPdfGeneratorService.generatePdf as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as string;
      expect(compiledHtml).toContain('font-family: monospace');
      expect(compiledHtml).toContain('color: red');
      // Original CSS should NOT be present (overridden)
      expect(compiledHtml).not.toContain('font-family: sans-serif');
    });
  });

  // =========================================================================
  // 9.3 — Batch generation integration test
  // =========================================================================

  describe('9.3 — Batch generation', () => {
    it('enqueues a batch job and returns 202 with batchJobId', async () => {
      // Mock queue as available
      const mockQueue = { getJob: vi.fn() };
      mockGetPdfBatchQueue.mockReturnValue(mockQueue);
      mockEnqueuePdfBatch.mockResolvedValue(undefined);

      const route = getRoute('POST', '/documents/batch-generate');
      const request = createRequest({
        userRole: 'MANAGER',
        body: {
          documentType: 'SALES_INVOICE',
          recordIds: [RECORD_ID, RECORD_ID_2, RECORD_ID_3],
        },
      });
      const reply = createReply();

      await route.handler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(202);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ batchJobId: expect.any(String) }),
      );

      // Verify enqueuePdfBatch was called with correct data
      expect(mockEnqueuePdfBatch).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: COMPANY_A,
          documentType: 'SALES_INVOICE',
          recordIds: [RECORD_ID, RECORD_ID_2, RECORD_ID_3],
          userId: 'user-int-001',
        }),
      );
    });

    it('returns batch status from the queue job', async () => {
      const mockJob = {
        data: { companyId: COMPANY_A },
        progress: {
          total: 3,
          completed: 2,
          failed: 1,
          errors: [{ recordId: RECORD_ID_3, error: 'Record not found' }],
        },
        returnvalue: null,
        getState: vi.fn().mockResolvedValue('active'),
      };
      const mockQueue = { getJob: vi.fn().mockResolvedValue(mockJob) };
      mockGetPdfBatchQueue.mockReturnValue(mockQueue);

      const route = getRoute('GET', '/documents/batch-generate/:batchJobId/status');
      const request = createRequest({
        params: { batchJobId: 'batch-123' },
      });
      const reply = createReply();

      await route.handler(request, reply);

      expect(reply.send).toHaveBeenCalledWith({
        batchJobId: 'batch-123',
        status: 'active',
        total: 3,
        completed: 2,
        failed: 1,
        errors: [{ recordId: RECORD_ID_3, error: 'Record not found' }],
      });
    });

    it('returns completed status with return value data', async () => {
      const mockJob = {
        data: { companyId: COMPANY_A },
        progress: { total: 3, completed: 1, failed: 0, errors: [] },
        returnvalue: { total: 3, completed: 3, failed: 0, errors: [] },
        getState: vi.fn().mockResolvedValue('completed'),
      };
      const mockQueue = { getJob: vi.fn().mockResolvedValue(mockJob) };
      mockGetPdfBatchQueue.mockReturnValue(mockQueue);

      const route = getRoute('GET', '/documents/batch-generate/:batchJobId/status');
      const request = createRequest({ params: { batchJobId: 'batch-456' } });
      const reply = createReply();

      await route.handler(request, reply);

      // When completed, uses returnvalue (final accurate counts) not progress
      expect(reply.send).toHaveBeenCalledWith({
        batchJobId: 'batch-456',
        status: 'completed',
        total: 3,
        completed: 3,
        failed: 0,
        errors: [],
      });
    });
  });

  // =========================================================================
  // 9.4 — Error path tests
  // =========================================================================

  describe('9.4 — Error paths', () => {
    it('returns 404 TEMPLATE_NOT_FOUND when no template exists for documentType', async () => {
      // No templates found for either default or fallback search
      mockPrisma.documentTemplate.findFirst.mockResolvedValue(null);

      const route = getRoute('POST', '/documents/generate');
      const request = createRequest({
        body: { documentType: 'PURCHASE_ORDER', recordId: RECORD_ID, outputFormat: 'inline' },
      });
      const reply = createReply();

      await expect(route.handler(request, reply)).rejects.toMatchObject({
        code: 'TEMPLATE_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('returns 404 RECORD_NOT_FOUND when company profile does not exist', async () => {
      // Template exists but company profile not found → data loader returns null
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...makeTemplate(COMPANY_A),
        versions: [],
      });
      mockPrisma.companyProfile.findUnique.mockResolvedValue(null);

      const route = getRoute('POST', '/documents/generate');
      const reply = createReply();

      await expect(route.handler(createRequest(), reply)).rejects.toMatchObject({
        code: 'RECORD_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('returns 400 when batch recordIds is empty', async () => {
      const mockQueue = { getJob: vi.fn() };
      mockGetPdfBatchQueue.mockReturnValue(mockQueue);

      const route = getRoute('POST', '/documents/batch-generate');
      const request = createRequest({
        userRole: 'MANAGER',
        body: { documentType: 'SALES_INVOICE', recordIds: [] },
      });
      const reply = createReply();

      await expect(route.handler(request, reply)).rejects.toMatchObject({
        code: 'INVALID_REQUEST',
        statusCode: 400,
      });
    });

    it('returns 503 SERVICE_UNAVAILABLE when batch queue is not initialised', async () => {
      mockGetPdfBatchQueue.mockReturnValue(null);

      const route = getRoute('POST', '/documents/batch-generate');
      const request = createRequest({
        userRole: 'MANAGER',
        body: { documentType: 'SALES_INVOICE', recordIds: [RECORD_ID] },
      });
      const reply = createReply();

      await expect(route.handler(request, reply)).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
      });
    });

    it('returns 404 BATCH_NOT_FOUND for non-existent batch job', async () => {
      const mockQueue = { getJob: vi.fn().mockResolvedValue(null) };
      mockGetPdfBatchQueue.mockReturnValue(mockQueue);

      const route = getRoute('GET', '/documents/batch-generate/:batchJobId/status');
      const request = createRequest({ params: { batchJobId: 'non-existent' } });
      const reply = createReply();

      await expect(route.handler(request, reply)).rejects.toMatchObject({
        code: 'BATCH_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('returns 500 TEMPLATE_COMPILATION_ERROR when template has syntax errors', async () => {
      mockPrisma.companyProfile.findUnique.mockResolvedValue(makeCompanyProfile(COMPANY_A));
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...makeTemplate(COMPANY_A, {
          htmlTemplate: '<html>{{#if unclosed}}<p>broken template',
        }),
        versions: [],
      });

      const route = getRoute('POST', '/documents/generate');
      const reply = createReply();

      // Handlebars should throw on unclosed block — route catches and wraps
      await expect(route.handler(createRequest(), reply)).rejects.toMatchObject({
        code: 'TEMPLATE_COMPILATION_ERROR',
        statusCode: 500,
      });
    });

    it('returns 500 PDF_GENERATION_ERROR when PDF rendering fails', async () => {
      mockPrisma.companyProfile.findUnique.mockResolvedValue(makeCompanyProfile(COMPANY_A));
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...makeTemplate(COMPANY_A),
        versions: [],
      });
      (mockPdfGeneratorService.generatePdf as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Puppeteer browser crashed'),
      );

      const route = getRoute('POST', '/documents/generate');
      const reply = createReply();

      await expect(route.handler(createRequest(), reply)).rejects.toMatchObject({
        code: 'PDF_GENERATION_ERROR',
        statusCode: 500,
      });
    });
  });

  // =========================================================================
  // 9.5 — companyId isolation test
  // =========================================================================

  describe('9.5 — companyId isolation', () => {
    it('returns 404 when attempting to generate with a different company context', async () => {
      // Template seeded for COMPANY_A
      mockPrisma.documentTemplate.findFirst.mockImplementation(
        async (args: { where: { companyId: string } }) => {
          // Only return template for COMPANY_A queries
          if (args.where.companyId === COMPANY_A) {
            return {
              ...makeTemplate(COMPANY_A),
              versions: [],
            };
          }
          return null;
        },
      );

      // Request as COMPANY_B → template lookup scoped to COMPANY_B → not found
      const route = getRoute('POST', '/documents/generate');
      const request = createRequest({ companyId: COMPANY_B });
      const reply = createReply();

      await expect(route.handler(request, reply)).rejects.toMatchObject({
        code: 'TEMPLATE_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('enforces companyId in template lookup queries', async () => {
      mockPrisma.documentTemplate.findFirst.mockResolvedValue(null);

      const route = getRoute('POST', '/documents/generate');
      const request = createRequest({ companyId: COMPANY_B });
      const reply = createReply();

      try {
        await route.handler(request, reply);
      } catch {
        // Expected to throw TEMPLATE_NOT_FOUND
      }

      // Both findFirst calls (default + fallback) should scope to COMPANY_B
      for (const call of mockPrisma.documentTemplate.findFirst.mock.calls) {
        expect(call[0].where.companyId).toBe(COMPANY_B);
      }
    });

    it('enforces companyId in data loader queries', async () => {
      // Template found for COMPANY_B, but company profile lookup fails
      mockPrisma.documentTemplate.findFirst.mockResolvedValueOnce({
        ...makeTemplate(COMPANY_B),
        versions: [],
      });
      // Company profile only exists for COMPANY_A
      mockPrisma.companyProfile.findUnique.mockImplementation(
        async (args: { where: { id: string } }) => {
          if (args.where.id === COMPANY_A) {
            return makeCompanyProfile(COMPANY_A);
          }
          return null;
        },
      );

      const route = getRoute('POST', '/documents/generate');
      const request = createRequest({ companyId: COMPANY_B });
      const reply = createReply();

      await expect(route.handler(request, reply)).rejects.toMatchObject({
        code: 'RECORD_NOT_FOUND',
        statusCode: 404,
      });

      // Data loader should have queried with COMPANY_B
      expect(mockPrisma.companyProfile.findUnique).toHaveBeenCalledWith({
        where: { id: COMPANY_B },
      });
    });

    it('company A succeeds while company B is rejected for same template', async () => {
      // Simulate scoped data: only COMPANY_A has templates
      mockPrisma.documentTemplate.findFirst.mockImplementation(
        async (args: { where: { companyId: string } }) => {
          if (args.where.companyId === COMPANY_A) {
            return { ...makeTemplate(COMPANY_A), versions: [] };
          }
          return null;
        },
      );
      mockPrisma.companyProfile.findUnique.mockImplementation(
        async (args: { where: { id: string } }) => {
          if (args.where.id === COMPANY_A) {
            return makeCompanyProfile(COMPANY_A);
          }
          return null;
        },
      );

      const route = getRoute('POST', '/documents/generate');

      // COMPANY_A succeeds
      const replyA = createReply();
      await route.handler(createRequest({ companyId: COMPANY_A }), replyA);
      expect(replyA.header).toHaveBeenCalledWith('Content-Type', 'application/pdf');

      // COMPANY_B fails with 404 (not 403 — per AC)
      const replyB = createReply();
      await expect(
        route.handler(createRequest({ companyId: COMPANY_B }), replyB),
      ).rejects.toMatchObject({
        code: 'TEMPLATE_NOT_FOUND',
        statusCode: 404,
      });
    });
  });
});
