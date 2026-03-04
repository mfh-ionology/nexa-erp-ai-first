// ---------------------------------------------------------------------------
// Route-level tests for /documents/email and /ar/reports/statements/batch
// E10-3 Tasks 10.3 + 10.4
// ---------------------------------------------------------------------------

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mocks (vi.hoisted)
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  mockEventBus,
  mockResolveUserRole,
  mockPermissionService,
  mockNextNumber,
  mockEnqueueEmailSend,
  mockValidateEntityExists,
  mockPutObject,
  mockGetDefaultBucket,
  mockCreateSystemLink,
} = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    companyProfile: { findFirst: vi.fn(), findUnique: vi.fn() },
    systemSetting: { findFirst: vi.fn() },
    emailMessage: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    emailRecipient: { updateMany: vi.fn() },
    emailSignature: { findFirst: vi.fn() },
    emailTemplate: { findFirst: vi.fn(), findMany: vi.fn() },
    emailQueue: { create: vi.fn() },
    attachment: { create: vi.fn() },
    customerInvoice: { findFirst: vi.fn() },
    customer: { findFirst: vi.fn() },
    contact: { findFirst: vi.fn() },
    notification: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  mockEventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
    setLogger: vi.fn(),
  },
  mockResolveUserRole: vi.fn(),
  mockPermissionService: {
    getEffectivePermissions: vi.fn(),
  },
  mockNextNumber: vi.fn(),
  mockEnqueueEmailSend: vi.fn(),
  mockValidateEntityExists: vi.fn(),
  mockPutObject: vi.fn(),
  mockGetDefaultBucket: vi.fn(),
  mockCreateSystemLink: vi.fn(),
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  resolveUserRole: mockResolveUserRole,
  nextNumber: mockNextNumber,
  UserRole: {
    VIEWER: 'VIEWER',
    STAFF: 'STAFF',
    MANAGER: 'MANAGER',
    ADMIN: 'ADMIN',
    SUPER_ADMIN: 'SUPER_ADMIN',
  },
  RecordLinkType: { RELATES_TO: 'RELATES_TO' },
  EmailMessageStatus: {
    DRAFT: 'DRAFT',
    QUEUED: 'QUEUED',
    SENT: 'SENT',
    FAILED: 'FAILED',
    BOUNCED: 'BOUNCED',
  },
  EmailDirection: { INBOUND: 'INBOUND', OUTBOUND: 'OUTBOUND' },
  EmailRecipientType: { FROM: 'FROM', TO: 'TO', CC: 'CC', BCC: 'BCC' },
  EmailRecipientStatus: {
    UNREAD: 'UNREAD',
    READ: 'READ',
    DELETED: 'DELETED',
    ARCHIVED: 'ARCHIVED',
  },
  EmailQueueStatus: {
    PENDING: 'PENDING',
    PROCESSING: 'PROCESSING',
    SENT: 'SENT',
    FAILED: 'FAILED',
  },
  Prisma: { EmailMessageWhereInput: {} },
}));

vi.mock('../../../core/rbac/permission.service.js', () => ({
  permissionService: mockPermissionService,
  PermissionService: vi.fn(),
  ACTION_FLAG_MAP: { new: 'canNew', view: 'canView', edit: 'canEdit', delete: 'canDelete' },
}));

vi.mock('./email-send.queue.js', () => ({
  enqueueEmailSend: mockEnqueueEmailSend,
  EMAIL_SEND_QUEUE_NAME: 'email-send',
  initEmailSendQueue: vi.fn(),
  getEmailSendQueue: vi.fn(),
}));

vi.mock('../../../core/entity-registry/index.js', () => ({
  validateEntityExists: mockValidateEntityExists,
  isValidEntityType: vi.fn().mockReturnValue(true),
  VALID_ENTITY_TYPES: ['CustomerInvoice', 'EmailMessage'],
}));

vi.mock('../../../core/storage/index.js', () => ({
  putObject: mockPutObject,
  getDefaultBucket: mockGetDefaultBucket,
}));

vi.mock('../../cross-cutting/record-link.service.js', () => ({
  createSystemLink: mockCreateSystemLink,
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../../../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../../../core/middleware/company-context.js';
import { registerErrorHandler } from '../../../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../../core/validation/index.js';
import {
  documentEmailRoutesPlugin,
  batchStatementEmailRoutesPlugin,
} from './document-email.routes.js';
import { DocumentEmailService } from './document-email.service.js';
import { EmailService } from './email.service.js';
import { EmailQueueService } from './email-queue.service.js';
import { EmailTemplateService } from './email-template.service.js';
import { EmailTemplateEngineService } from './email-template-engine.service.js';
import { BatchStatementEmailService } from './batch-statement-email.service.js';
import {
  makeTestJwt,
  authHeaders,
  TEST_JWT_SECRET,
  TEST_USER_ID,
  TEST_COMPANY_ID,
} from '../../../test-utils/jwt.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_RECORD_ID = '00000000-0000-4000-b000-000000000001';
const TEST_EMAIL_MSG_ID = '00000000-0000-4000-c000-000000000001';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);
  app.decorate('eventBus', mockEventBus as unknown as FastifyInstance['eventBus']);

  // Decorate shared services expected by the refactored routes (Issue #1 fix)
  const emailService = new EmailService(
    mockPrisma as unknown as import('@nexa/db').PrismaClient,
    app.log,
    mockEventBus as unknown as FastifyInstance['eventBus'],
  );
  const emailQueueService = new EmailQueueService(
    mockPrisma as unknown as import('@nexa/db').PrismaClient,
    app.log,
  );
  const templateEngine = new EmailTemplateEngineService(app.log);
  const templateService = new EmailTemplateService(
    mockPrisma as unknown as import('@nexa/db').PrismaClient,
    app.log,
    templateEngine,
  );
  const documentEmailService = new DocumentEmailService(
    mockPrisma as unknown as import('@nexa/db').PrismaClient,
    app.log,
    mockEventBus as unknown as FastifyInstance['eventBus'],
    emailService,
    emailQueueService,
    templateService,
    templateEngine,
  );
  app.decorate('documentEmailService', documentEmailService);

  const batchStatementService = new BatchStatementEmailService(app.log);
  app.decorate('batchStatementEmailService', batchStatementService);

  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);
  await app.register(documentEmailRoutesPlugin);
  await app.register(batchStatementEmailRoutesPlugin);
  await app.ready();
  return app;
}

function setupMocks(opts: { role?: string; companyId?: string } = {}) {
  const role = opts.role ?? 'ADMIN';
  const companyId = opts.companyId ?? TEST_COMPANY_ID;

  mockPrisma.user.findUnique.mockResolvedValue({
    id: TEST_USER_ID,
    companyId,
    isActive: true,
  });
  mockPrisma.companyProfile.findUnique.mockResolvedValue({ id: companyId, isActive: true });
  mockResolveUserRole.mockResolvedValue(role);
  mockPrisma.$transaction.mockImplementation(async (fn: (prisma: unknown) => unknown) =>
    fn(mockPrisma),
  );
  mockPermissionService.getEffectivePermissions.mockResolvedValue({
    'communications.email': { canNew: true, canView: true, canEdit: true, canDelete: true },
  });

  // Defaults for document email flow
  mockValidateEntityExists.mockResolvedValue(undefined);
  mockGetDefaultBucket.mockReturnValue('nexa-attachments');
  mockPutObject.mockResolvedValue(undefined);
  mockCreateSystemLink.mockResolvedValue({ id: randomUUID() });
  mockNextNumber.mockResolvedValue('EM-000001');
  mockEnqueueEmailSend.mockResolvedValue(undefined);

  // Template resolution
  mockPrisma.emailTemplate.findFirst.mockResolvedValue({
    id: randomUUID(),
    code: 'INVOICE_SEND',
    documentType: 'CustomerInvoice',
    subjectTemplate: 'Invoice {{invoiceNumber}}',
    bodyHtmlTemplate: '<p>Dear {{customerName}},</p>',
    languageCode: 'en',
    isActive: true,
    isDefault: true,
    attachPdf: true,
    autoSend: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Document data
  mockPrisma.customerInvoice.findFirst.mockResolvedValue({
    id: TEST_RECORD_ID,
    companyId: TEST_COMPANY_ID,
    status: 'POSTED',
    customerId: 'cust-001',
    invoiceNumber: 'INV-001',
  });

  mockPrisma.customer.findFirst.mockResolvedValue({
    id: 'cust-001',
    email: 'customer@example.com',
  });

  mockPrisma.systemSetting.findFirst.mockResolvedValue({
    value: 'invoices@company.co.uk',
  });

  mockPrisma.companyProfile.findFirst.mockResolvedValue({
    name: 'Test Co',
    email: 'info@company.co.uk',
    phone: '0123456789',
    addressLine1: '1 Test St',
    addressLine2: null,
    city: 'London',
    county: null,
    postcode: 'EC1A',
    countryCode: 'GB',
    baseCurrencyCode: 'GBP',
  });

  // EmailService.createEmail — returns via $transaction mock
  mockPrisma.emailMessage.create.mockResolvedValue({
    id: TEST_EMAIL_MSG_ID,
    companyId,
    status: 'DRAFT',
    direction: 'OUTBOUND',
    hasAttachments: false,
    recipients: [{ emailAddress: 'customer@example.com', recipientType: 'TO' }],
    queueEntry: null,
  });

  mockPrisma.emailSignature.findFirst.mockResolvedValue(null);
  mockPrisma.emailMessage.findFirst.mockResolvedValue({
    id: TEST_EMAIL_MSG_ID,
    status: 'DRAFT',
    bodyHtml: '<p>test</p>',
  });
  mockPrisma.emailMessage.update.mockResolvedValue({
    id: TEST_EMAIL_MSG_ID,
    hasAttachments: true,
    status: 'QUEUED',
  });
  mockPrisma.emailQueue.create.mockResolvedValue({
    id: randomUUID(),
    status: 'PENDING',
  });
  mockPrisma.attachment.create.mockResolvedValue({ id: randomUUID() });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let staffJwt: string;
let viewerJwt: string;
let managerJwt: string;

beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  staffJwt = await makeTestJwt({ role: 'STAFF' });
  viewerJwt = await makeTestJwt({ role: 'VIEWER' });
  managerJwt = await makeTestJwt({ role: 'MANAGER' });
});

// =========================================================================
// POST /documents/email
// =========================================================================

describe('POST /documents/email', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('returns 200 with emailMessageId on valid input', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/documents/email',
      headers: authHeaders(staffJwt),
      payload: {
        documentType: 'CustomerInvoice',
        recordId: TEST_RECORD_ID,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.emailMessageId).toBeDefined();
    expect(body.data.queueStatus).toBeDefined();
    expect(body.data.recipientEmail).toBeDefined();
  });

  it('returns 400 for invalid documentType', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/documents/email',
      headers: authHeaders(staffJwt),
      payload: {
        documentType: 'InvalidType',
        recordId: TEST_RECORD_ID,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for missing recordId', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/documents/email',
      headers: authHeaders(staffJwt),
      payload: {
        documentType: 'CustomerInvoice',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when document not found', async () => {
    setupMocks({ role: 'STAFF' });
    mockValidateEntityExists.mockRejectedValue(
      Object.assign(new Error('Not found'), { code: 'NOT_FOUND', statusCode: 404 }),
    );
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/documents/email',
      headers: authHeaders(staffJwt),
      payload: {
        documentType: 'CustomerInvoice',
        recordId: TEST_RECORD_ID,
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('returns 400 when document not in sendable state', async () => {
    setupMocks({ role: 'STAFF' });
    mockPrisma.customerInvoice.findFirst.mockResolvedValue({
      id: TEST_RECORD_ID,
      companyId: TEST_COMPANY_ID,
      status: 'DRAFT',
    });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/documents/email',
      headers: authHeaders(staffJwt),
      payload: {
        documentType: 'CustomerInvoice',
        recordId: TEST_RECORD_ID,
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 403 for VIEWER role (STAFF+ required)', async () => {
    setupMocks({ role: 'VIEWER' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/documents/email',
      headers: authHeaders(viewerJwt),
      payload: {
        documentType: 'CustomerInvoice',
        recordId: TEST_RECORD_ID,
      },
    });

    expect(res.statusCode).toBe(403);
  });
});

// =========================================================================
// POST /documents/email/preview
// =========================================================================

describe('POST /documents/email/preview', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('returns rendered preview', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/documents/email/preview',
      headers: authHeaders(staffJwt),
      payload: {
        documentType: 'CustomerInvoice',
        recordId: TEST_RECORD_ID,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.from).toBeDefined();
    expect(body.data.to).toBeDefined();
    expect(body.data.subject).toBeDefined();
    expect(body.data.bodyHtml).toBeDefined();
  });

  it('returns 403 for VIEWER role', async () => {
    setupMocks({ role: 'VIEWER' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/documents/email/preview',
      headers: authHeaders(viewerJwt),
      payload: {
        documentType: 'CustomerInvoice',
        recordId: TEST_RECORD_ID,
      },
    });

    expect(res.statusCode).toBe(403);
  });
});

// =========================================================================
// POST /ar/reports/statements/batch
// =========================================================================

describe('POST /ar/reports/statements/batch', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('returns 403 for STAFF role (MANAGER+ required)', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ar/reports/statements/batch',
      headers: authHeaders(staffJwt),
      payload: {
        dateRange: { from: '2026-01-01', to: '2026-01-31' },
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('returns 400 for invalid date range', async () => {
    setupMocks({ role: 'MANAGER' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/ar/reports/statements/batch',
      headers: authHeaders(managerJwt),
      payload: {
        dateRange: { from: 'not-a-date', to: '2026-01-31' },
      },
    });

    expect(res.statusCode).toBe(400);
  });

  // NOTE: The batch route's BatchStatementEmailService has queue=null
  // (not initialised in the route plugin). A full integration test of
  // successful batch is in the worker test. Here we test schema/auth guards.
});
