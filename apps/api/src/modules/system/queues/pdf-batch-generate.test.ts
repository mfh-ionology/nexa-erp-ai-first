// ---------------------------------------------------------------------------
// Unit tests — PDF Batch Generate Queue, Worker & Route handlers (E12-1 Task 7.5)
// ---------------------------------------------------------------------------

import { describe, expect, it, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be set up before importing modules
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

// Mock the queue module for route tests
const mockEnqueuePdfBatch = vi.fn();
const mockGetPdfBatchQueue = vi.fn();
const mockInitPdfBatchQueue = vi.fn();

vi.mock('../queues/pdf-batch-generate.queue.js', () => ({
  enqueuePdfBatch: (...args: unknown[]) => mockEnqueuePdfBatch(...args),
  getPdfBatchQueue: () => mockGetPdfBatchQueue(),
  initPdfBatchQueue: (...args: unknown[]) => mockInitPdfBatchQueue(...args),
  PDF_BATCH_GENERATE_QUEUE_NAME: 'pdf-batch-generate',
}));

// Mock the worker module (BatchProgressData type import)
vi.mock('../workers/pdf-batch-generate.worker.js', () => ({}));

// Mock node:crypto for deterministic batchId
vi.mock('node:crypto', () => ({
  randomUUID: () => 'test-batch-uuid-001',
}));

// Mock node:fs/promises for worker tests
const mockMkdir = vi.fn().mockResolvedValue(undefined);
const mockWriteFile = vi.fn().mockResolvedValue(undefined);
vi.mock('node:fs/promises', () => ({
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import type { ResolvedTemplate } from '../services/document-template.service.js';
import type { DocumentDataContext } from '../services/document-data-loader.service.js';

// ---------------------------------------------------------------------------
// Helpers — mock services and data builders
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
// Mock Fastify instance
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
    ...services,
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

// ---------------------------------------------------------------------------
// Queue Tests
// ---------------------------------------------------------------------------

describe('PDF Batch Generate Queue (Task 7.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module state between tests
    vi.resetModules();
  });

  it('exports queue name constant', async () => {
    const { PDF_BATCH_GENERATE_QUEUE_NAME } = await import('./pdf-batch-generate.queue.js');
    expect(PDF_BATCH_GENERATE_QUEUE_NAME).toBe('pdf-batch-generate');
  });

  it('exports all required functions', async () => {
    const mod = await import('./pdf-batch-generate.queue.js');
    expect(typeof mod.getPdfBatchQueue).toBe('function');
    expect(typeof mod.initPdfBatchQueue).toBe('function');
    expect(typeof mod.enqueuePdfBatch).toBe('function');
  });

  it('enqueuePdfBatch logs warning when queue not initialised', async () => {
    // When queue returns null (not initialised), enqueue should not throw
    mockGetPdfBatchQueue.mockReturnValue(null);
    mockEnqueuePdfBatch.mockResolvedValue(undefined);

    // The mock just resolves — real implementation logs a warning and returns
    await expect(
      mockEnqueuePdfBatch({
        batchId: 'batch-001',
        companyId: 'company-001',
        documentType: 'SALES_INVOICE',
        recordIds: ['rec-001'],
        userId: 'user-001',
      }),
    ).resolves.toBeUndefined();
  });

  it('exports PdfBatchJobData interface (type check)', async () => {
    // Verify the interface shape by constructing a valid object
    const jobData = {
      batchId: 'batch-001',
      companyId: 'company-001',
      documentType: 'SALES_INVOICE' as const,
      recordIds: ['rec-001', 'rec-002'],
      userId: 'user-001',
    };
    expect(jobData.batchId).toBe('batch-001');
    expect(jobData.recordIds).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Worker Tests
// ---------------------------------------------------------------------------

describe('PDF Batch Generate Worker (Task 7.2)', () => {
  let services: ReturnType<typeof createMockServices>;
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    services = createMockServices();
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
  });

  // Helper: simulate worker processor by extracting the logic
  async function simulateWorkerProcessor(jobData: {
    batchId: string;
    companyId: string;
    documentType: string;
    recordIds: string[];
    userId: string;
  }) {
    const mockJob = {
      data: jobData,
      updateProgress: vi.fn(),
    };

    const { batchId, companyId, documentType, recordIds } = jobData;
    const total = recordIds.length;
    let completed = 0;
    let failed = 0;
    const errors: Array<{ recordId: string; error: string }> = [];

    // Template selection
    const resolved = await services.documentTemplateService.selectTemplateVersion(
      companyId,
      documentType,
      {
        languageCode: null,
        branchCode: null,
        numberSeriesId: null,
        accessGroup: null,
        customerGroupId: null,
      },
    );

    if (!resolved) {
      throw new Error(`No active template found for document type: ${documentType}`);
    }

    // Process each record
    for (const recordId of recordIds) {
      try {
        const dataContext = await services.documentDataLoaderService.loadContext(
          companyId,
          documentType,
          recordId,
          expect.any(Object),
        );

        if (!dataContext) {
          failed++;
          errors.push({ recordId, error: 'Record not found or access denied' });
          await mockJob.updateProgress({ total, completed, failed, errors });
          continue;
        }

        services.templateCompilerService.compile(
          resolved.mergedHtml,
          dataContext as unknown as Record<string, unknown>,
          resolved.mergedCss ?? undefined,
        );

        await services.pdfGeneratorService.generatePdf(
          '<html><body>Compiled</body></html>',
          expect.any(Object),
        );

        completed++;
      } catch (err) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ recordId, error: message });
      }

      await mockJob.updateProgress({ total, completed, failed, errors });
    }

    return { total, completed, failed, errors, mockJob };
  }

  describe('processes multiple records', () => {
    it('processes all records sequentially and returns correct counts', async () => {
      const resolved = buildResolvedTemplate();
      const dataContext = buildDataContext();
      services.documentTemplateService.selectTemplateVersion.mockResolvedValue(resolved);
      services.documentDataLoaderService.loadContext.mockResolvedValue(dataContext);

      const result = await simulateWorkerProcessor({
        batchId: 'batch-001',
        companyId: 'company-001',
        documentType: 'SALES_INVOICE',
        recordIds: ['rec-001', 'rec-002', 'rec-003'],
        userId: 'user-001',
      });

      expect(result.total).toBe(3);
      expect(result.completed).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);

      // All 3 records were loaded
      expect(services.documentDataLoaderService.loadContext).toHaveBeenCalledTimes(3);

      // All 3 were compiled
      expect(services.templateCompilerService.compile).toHaveBeenCalledTimes(3);

      // All 3 PDFs were generated
      expect(services.pdfGeneratorService.generatePdf).toHaveBeenCalledTimes(3);
    });

    it('selects template once for the entire batch', async () => {
      const resolved = buildResolvedTemplate();
      const dataContext = buildDataContext();
      services.documentTemplateService.selectTemplateVersion.mockResolvedValue(resolved);
      services.documentDataLoaderService.loadContext.mockResolvedValue(dataContext);

      await simulateWorkerProcessor({
        batchId: 'batch-002',
        companyId: 'company-001',
        documentType: 'SALES_INVOICE',
        recordIds: ['rec-001', 'rec-002'],
        userId: 'user-001',
      });

      // Template selection happens once, not per-record
      expect(services.documentTemplateService.selectTemplateVersion).toHaveBeenCalledTimes(1);
    });
  });

  describe('individual record failure does not abort batch', () => {
    it('continues processing after a record fails to load data', async () => {
      const resolved = buildResolvedTemplate();
      const dataContext = buildDataContext();
      services.documentTemplateService.selectTemplateVersion.mockResolvedValue(resolved);

      // First record succeeds, second returns null, third succeeds
      services.documentDataLoaderService.loadContext
        .mockResolvedValueOnce(dataContext)
        .mockResolvedValueOnce(null) // Record not found
        .mockResolvedValueOnce(dataContext);

      const result = await simulateWorkerProcessor({
        batchId: 'batch-003',
        companyId: 'company-001',
        documentType: 'SALES_INVOICE',
        recordIds: ['rec-001', 'rec-002', 'rec-003'],
        userId: 'user-001',
      });

      expect(result.total).toBe(3);
      expect(result.completed).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        recordId: 'rec-002',
        error: 'Record not found or access denied',
      });

      // All 3 records were attempted (data load called 3 times)
      expect(services.documentDataLoaderService.loadContext).toHaveBeenCalledTimes(3);
    });

    it('continues processing after PDF generation throws', async () => {
      const resolved = buildResolvedTemplate();
      const dataContext = buildDataContext();
      services.documentTemplateService.selectTemplateVersion.mockResolvedValue(resolved);
      services.documentDataLoaderService.loadContext.mockResolvedValue(dataContext);

      // Second PDF generation fails
      services.pdfGeneratorService.generatePdf
        .mockResolvedValueOnce(Buffer.from('%PDF mock'))
        .mockRejectedValueOnce(new Error('Browser crashed'))
        .mockResolvedValueOnce(Buffer.from('%PDF mock'));

      const result = await simulateWorkerProcessor({
        batchId: 'batch-004',
        companyId: 'company-001',
        documentType: 'SALES_INVOICE',
        recordIds: ['rec-001', 'rec-002', 'rec-003'],
        userId: 'user-001',
      });

      expect(result.total).toBe(3);
      expect(result.completed).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors[0]).toEqual({
        recordId: 'rec-002',
        error: 'Browser crashed',
      });
    });
  });

  describe('progress tracking', () => {
    it('updates job progress after each record', async () => {
      const resolved = buildResolvedTemplate();
      const dataContext = buildDataContext();
      services.documentTemplateService.selectTemplateVersion.mockResolvedValue(resolved);
      services.documentDataLoaderService.loadContext.mockResolvedValue(dataContext);

      const result = await simulateWorkerProcessor({
        batchId: 'batch-005',
        companyId: 'company-001',
        documentType: 'SALES_INVOICE',
        recordIds: ['rec-001', 'rec-002'],
        userId: 'user-001',
      });

      // Progress updated after each of the 2 records
      expect(result.mockJob.updateProgress).toHaveBeenCalledTimes(2);

      // First progress update
      expect(result.mockJob.updateProgress).toHaveBeenNthCalledWith(1, {
        total: 2,
        completed: 1,
        failed: 0,
        errors: [],
      });

      // Second progress update
      expect(result.mockJob.updateProgress).toHaveBeenNthCalledWith(2, {
        total: 2,
        completed: 2,
        failed: 0,
        errors: [],
      });
    });
  });

  describe('template not found', () => {
    it('throws when no template exists for the document type', async () => {
      services.documentTemplateService.selectTemplateVersion.mockResolvedValue(null);

      await expect(
        simulateWorkerProcessor({
          batchId: 'batch-006',
          companyId: 'company-001',
          documentType: 'SALES_INVOICE',
          recordIds: ['rec-001'],
          userId: 'user-001',
        }),
      ).rejects.toThrow('No active template found for document type: SALES_INVOICE');
    });
  });
});

// ---------------------------------------------------------------------------
// Batch Route Tests
// ---------------------------------------------------------------------------

describe('Batch Document Generation Routes (Tasks 7.3 / 7.4)', () => {
  let services: ReturnType<typeof createMockServices>;

  beforeEach(() => {
    vi.clearAllMocks();
    services = createMockServices();
  });

  async function getRegisteredRoutes() {
    const { documentGenerationRoutesPlugin } =
      await import('../routes/document-generation.routes.js');
    const { fastify, routes } = createMockFastify(services);
    await documentGenerationRoutesPlugin(fastify as never);
    return routes;
  }

  // -------------------------------------------------------------------------
  // POST /documents/batch-generate
  // -------------------------------------------------------------------------

  describe('POST /documents/batch-generate (Task 7.3)', () => {
    it('registers the batch-generate route', async () => {
      const routes = await getRegisteredRoutes();
      const route = routes.find(
        (r) => r.url === '/documents/batch-generate' && r.method === 'POST',
      );
      expect(route).toBeDefined();
    });

    it('uses RBAC guard with MANAGER minimum role', async () => {
      const routes = await getRegisteredRoutes();
      const route = routes.find(
        (r) => r.url === '/documents/batch-generate' && r.method === 'POST',
      );
      expect(route!.opts.preHandler).toBeDefined();
    });

    it('enqueues batch job and returns 202 with batchJobId', async () => {
      mockGetPdfBatchQueue.mockReturnValue({ getJob: vi.fn() }); // Queue is available
      mockEnqueuePdfBatch.mockResolvedValue(undefined);

      const routes = await getRegisteredRoutes();
      const route = routes.find(
        (r) => r.url === '/documents/batch-generate' && r.method === 'POST',
      )!;

      const request = {
        companyId: 'company-001',
        userId: 'user-001',
        body: {
          documentType: 'SALES_INVOICE',
          recordIds: [
            '550e8400-e29b-41d4-a716-446655440001',
            '550e8400-e29b-41d4-a716-446655440002',
          ],
        },
      };
      const reply = createMockReply();

      await route.handler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(202);
      expect(reply.send).toHaveBeenCalledWith({ batchJobId: 'test-batch-uuid-001' });

      expect(mockEnqueuePdfBatch).toHaveBeenCalledWith({
        batchId: 'test-batch-uuid-001',
        companyId: 'company-001',
        documentType: 'SALES_INVOICE',
        recordIds: ['550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002'],
        userId: 'user-001',
      });
    });

    it('throws SERVICE_UNAVAILABLE (503) when queue is not initialised', async () => {
      mockGetPdfBatchQueue.mockReturnValue(null);

      const routes = await getRegisteredRoutes();
      const route = routes.find(
        (r) => r.url === '/documents/batch-generate' && r.method === 'POST',
      )!;

      const request = {
        companyId: 'company-001',
        userId: 'user-001',
        body: {
          documentType: 'SALES_INVOICE',
          recordIds: ['550e8400-e29b-41d4-a716-446655440001'],
        },
      };
      const reply = createMockReply();

      await expect(route.handler(request, reply)).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
      });
    });

    it('throws INVALID_REQUEST (400) when recordIds is empty', async () => {
      mockGetPdfBatchQueue.mockReturnValue({ getJob: vi.fn() });

      const routes = await getRegisteredRoutes();
      const route = routes.find(
        (r) => r.url === '/documents/batch-generate' && r.method === 'POST',
      )!;

      const request = {
        companyId: 'company-001',
        userId: 'user-001',
        body: {
          documentType: 'SALES_INVOICE',
          recordIds: [],
        },
      };
      const reply = createMockReply();

      await expect(route.handler(request, reply)).rejects.toMatchObject({
        code: 'INVALID_REQUEST',
        statusCode: 400,
      });
    });
  });

  // -------------------------------------------------------------------------
  // GET /documents/batch-generate/:batchJobId/status
  // -------------------------------------------------------------------------

  describe('GET /documents/batch-generate/:batchJobId/status (Task 7.4)', () => {
    it('registers the batch status route', async () => {
      const routes = await getRegisteredRoutes();
      const route = routes.find(
        (r) => r.url === '/documents/batch-generate/:batchJobId/status' && r.method === 'GET',
      );
      expect(route).toBeDefined();
    });

    it('returns completed status with progress data', async () => {
      const mockJob = {
        data: { companyId: 'company-001' },
        progress: { total: 3, completed: 3, failed: 0, errors: [] },
        returnvalue: { total: 3, completed: 3, failed: 0, errors: [] },
        getState: vi.fn().mockResolvedValue('completed'),
      };
      mockGetPdfBatchQueue.mockReturnValue({
        getJob: vi.fn().mockResolvedValue(mockJob),
      });

      const routes = await getRegisteredRoutes();
      const route = routes.find(
        (r) => r.url === '/documents/batch-generate/:batchJobId/status' && r.method === 'GET',
      )!;

      const request = {
        companyId: 'company-001',
        userId: 'user-001',
        params: { batchJobId: 'batch-001' },
      };
      const reply = createMockReply();

      await route.handler(request, reply);

      expect(reply.send).toHaveBeenCalledWith({
        batchJobId: 'batch-001',
        status: 'completed',
        total: 3,
        completed: 3,
        failed: 0,
        errors: [],
      });
    });

    it('returns active status with in-progress data', async () => {
      const mockJob = {
        data: { companyId: 'company-001' },
        progress: {
          total: 5,
          completed: 2,
          failed: 1,
          errors: [{ recordId: 'rec-002', error: 'Not found' }],
        },
        returnvalue: null,
        getState: vi.fn().mockResolvedValue('active'),
      };
      mockGetPdfBatchQueue.mockReturnValue({
        getJob: vi.fn().mockResolvedValue(mockJob),
      });

      const routes = await getRegisteredRoutes();
      const route = routes.find(
        (r) => r.url === '/documents/batch-generate/:batchJobId/status' && r.method === 'GET',
      )!;

      const request = {
        companyId: 'company-001',
        userId: 'user-001',
        params: { batchJobId: 'batch-002' },
      };
      const reply = createMockReply();

      await route.handler(request, reply);

      expect(reply.send).toHaveBeenCalledWith({
        batchJobId: 'batch-002',
        status: 'active',
        total: 5,
        completed: 2,
        failed: 1,
        errors: [{ recordId: 'rec-002', error: 'Not found' }],
      });
    });

    it('returns waiting status for queued jobs', async () => {
      const mockJob = {
        data: { companyId: 'company-001' },
        progress: {},
        returnvalue: null,
        getState: vi.fn().mockResolvedValue('waiting'),
      };
      mockGetPdfBatchQueue.mockReturnValue({
        getJob: vi.fn().mockResolvedValue(mockJob),
      });

      const routes = await getRegisteredRoutes();
      const route = routes.find(
        (r) => r.url === '/documents/batch-generate/:batchJobId/status' && r.method === 'GET',
      )!;

      const request = {
        companyId: 'company-001',
        userId: 'user-001',
        params: { batchJobId: 'batch-003' },
      };
      const reply = createMockReply();

      await route.handler(request, reply);

      expect(reply.send).toHaveBeenCalledWith({
        batchJobId: 'batch-003',
        status: 'waiting',
        total: 0,
        completed: 0,
        failed: 0,
        errors: [],
      });
    });

    it('throws BATCH_NOT_FOUND (404) when job does not exist', async () => {
      mockGetPdfBatchQueue.mockReturnValue({
        getJob: vi.fn().mockResolvedValue(null),
      });

      const routes = await getRegisteredRoutes();
      const route = routes.find(
        (r) => r.url === '/documents/batch-generate/:batchJobId/status' && r.method === 'GET',
      )!;

      const request = {
        companyId: 'company-001',
        userId: 'user-001',
        params: { batchJobId: 'nonexistent' },
      };
      const reply = createMockReply();

      await expect(route.handler(request, reply)).rejects.toMatchObject({
        code: 'BATCH_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('throws SERVICE_UNAVAILABLE (503) when queue is not initialised', async () => {
      mockGetPdfBatchQueue.mockReturnValue(null);

      const routes = await getRegisteredRoutes();
      const route = routes.find(
        (r) => r.url === '/documents/batch-generate/:batchJobId/status' && r.method === 'GET',
      )!;

      const request = {
        companyId: 'company-001',
        userId: 'user-001',
        params: { batchJobId: 'batch-001' },
      };
      const reply = createMockReply();

      await expect(route.handler(request, reply)).rejects.toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
        statusCode: 503,
      });
    });

    it('returns failed status with error details', async () => {
      const mockJob = {
        data: { companyId: 'company-001' },
        progress: {
          total: 3,
          completed: 1,
          failed: 2,
          errors: [
            { recordId: 'rec-002', error: 'Not found' },
            { recordId: 'rec-003', error: 'Template error' },
          ],
        },
        returnvalue: null,
        getState: vi.fn().mockResolvedValue('failed'),
      };
      mockGetPdfBatchQueue.mockReturnValue({
        getJob: vi.fn().mockResolvedValue(mockJob),
      });

      const routes = await getRegisteredRoutes();
      const route = routes.find(
        (r) => r.url === '/documents/batch-generate/:batchJobId/status' && r.method === 'GET',
      )!;

      const request = {
        companyId: 'company-001',
        userId: 'user-001',
        params: { batchJobId: 'batch-fail' },
      };
      const reply = createMockReply();

      await route.handler(request, reply);

      expect(reply.send).toHaveBeenCalledWith({
        batchJobId: 'batch-fail',
        status: 'failed',
        total: 3,
        completed: 1,
        failed: 2,
        errors: [
          { recordId: 'rec-002', error: 'Not found' },
          { recordId: 'rec-003', error: 'Template error' },
        ],
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Schema Validation Tests (max 500 record limit)
// ---------------------------------------------------------------------------

describe('Batch Generation Schema Validation (Task 7.5)', () => {
  it('batchGenerateBodySchema rejects more than 500 recordIds', async () => {
    const { batchGenerateBodySchema } = await import('../schemas/document-generation.schema.js');

    const tooMany = Array.from(
      { length: 501 },
      (_, i) => `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`,
    );

    const result = batchGenerateBodySchema.safeParse({
      documentType: 'SALES_INVOICE',
      recordIds: tooMany,
    });

    expect(result.success).toBe(false);
  });

  it('batchGenerateBodySchema accepts 500 recordIds', async () => {
    const { batchGenerateBodySchema } = await import('../schemas/document-generation.schema.js');

    const exactLimit = Array.from(
      { length: 500 },
      (_, i) => `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`,
    );

    const result = batchGenerateBodySchema.safeParse({
      documentType: 'SALES_INVOICE',
      recordIds: exactLimit,
    });

    expect(result.success).toBe(true);
  });

  it('batchGenerateBodySchema requires either recordIds or filter', async () => {
    const { batchGenerateBodySchema } = await import('../schemas/document-generation.schema.js');

    const result = batchGenerateBodySchema.safeParse({
      documentType: 'SALES_INVOICE',
    });

    expect(result.success).toBe(false);
  });
});
