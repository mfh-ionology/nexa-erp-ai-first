// ---------------------------------------------------------------------------
// Integration test — E10-3 Task 10.6
// End-to-end: preview → send → EmailMessage created + queued + RecordLink
// ---------------------------------------------------------------------------

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mocks
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
  mockPermissionService: { getEffectivePermissions: vi.fn() },
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
// Imports
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../../../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../../../core/middleware/company-context.js';
import { registerErrorHandler } from '../../../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../../core/validation/index.js';
import { documentEmailRoutesPlugin } from './document-email.routes.js';
import { DocumentEmailService } from './document-email.service.js';
import { EmailService } from './email.service.js';
import { EmailQueueService } from './email-queue.service.js';
import { EmailTemplateService } from './email-template.service.js';
import { EmailTemplateEngineService } from './email-template-engine.service.js';
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
const TEST_TEMPLATE_ID = '00000000-0000-4000-d000-000000000001';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);
  app.decorate('eventBus', mockEventBus as unknown as FastifyInstance['eventBus']);

  // Decorate shared DocumentEmailService (Issue #1 fix — single shared instance)
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

  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);
  await app.register(documentEmailRoutesPlugin);
  await app.ready();
  return app;
}

function setupAllMocks() {
  mockPrisma.user.findUnique.mockResolvedValue({
    id: TEST_USER_ID,
    companyId: TEST_COMPANY_ID,
    isActive: true,
  });
  mockPrisma.companyProfile.findUnique.mockResolvedValue({ id: TEST_COMPANY_ID, isActive: true });
  mockResolveUserRole.mockResolvedValue('STAFF');
  mockPrisma.$transaction.mockImplementation(async (fn: (prisma: unknown) => unknown) =>
    fn(mockPrisma),
  );
  mockPermissionService.getEffectivePermissions.mockResolvedValue({
    'communications.email': { canNew: true, canView: true, canEdit: true, canDelete: true },
  });
  mockValidateEntityExists.mockResolvedValue(undefined);
  mockGetDefaultBucket.mockReturnValue('nexa-attachments');
  mockPutObject.mockResolvedValue(undefined);
  mockCreateSystemLink.mockResolvedValue({ id: randomUUID() });
  mockNextNumber.mockResolvedValue('EM-000001');
  mockEnqueueEmailSend.mockResolvedValue(undefined);

  const template = {
    id: TEST_TEMPLATE_ID,
    code: 'INVOICE_SEND',
    documentType: 'CustomerInvoice',
    subjectTemplate: 'Invoice {{invoiceNumber}} from {{companyName}}',
    bodyHtmlTemplate:
      '<p>Dear {{customerName}},</p><p>Please find invoice {{invoiceNumber}} attached.</p>',
    languageCode: 'en',
    isActive: true,
    isDefault: true,
    attachPdf: true,
    autoSend: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  mockPrisma.emailTemplate.findFirst.mockResolvedValue(template);

  mockPrisma.customerInvoice.findFirst.mockResolvedValue({
    id: TEST_RECORD_ID,
    companyId: TEST_COMPANY_ID,
    status: 'POSTED',
    customerId: 'cust-001',
    invoiceNumber: 'INV-001',
    totalAmount: 1500.0,
    dueDate: new Date('2026-04-01'),
    issueDate: new Date('2026-03-01'),
  });

  mockPrisma.customer.findFirst.mockResolvedValue({
    id: 'cust-001',
    email: 'billing@customer.co.uk',
  });

  mockPrisma.systemSetting.findFirst.mockResolvedValue({
    value: 'invoices@testcompany.co.uk',
  });

  mockPrisma.companyProfile.findFirst.mockResolvedValue({
    name: 'Test Company Ltd',
    email: 'info@testcompany.co.uk',
    phone: '020 1234 5678',
    addressLine1: '100 High Street',
    addressLine2: null,
    city: 'London',
    county: null,
    postcode: 'EC1A 1BB',
    countryCode: 'GB',
    baseCurrencyCode: 'GBP',
  });

  mockPrisma.emailMessage.create.mockResolvedValue({
    id: TEST_EMAIL_MSG_ID,
    companyId: TEST_COMPANY_ID,
    subject: 'Invoice INV-001 from Test Company Ltd',
    bodyHtml: '<p>Dear ,</p><p>Please find invoice INV-001 attached.</p>',
    status: 'DRAFT',
    direction: 'OUTBOUND',
    hasAttachments: false,
    recipients: [
      { emailAddress: 'invoices@testcompany.co.uk', recipientType: 'FROM' },
      { emailAddress: 'billing@customer.co.uk', recipientType: 'TO' },
    ],
    queueEntry: null,
  });

  mockPrisma.emailSignature.findFirst.mockResolvedValue(null);
  mockPrisma.emailMessage.findFirst.mockResolvedValue({
    id: TEST_EMAIL_MSG_ID,
    status: 'DRAFT',
    bodyHtml: '<p>Dear ,</p>',
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
// Integration test
// ---------------------------------------------------------------------------

describe('Document-to-Email Integration Flow', () => {
  let app: FastifyInstance;
  let staffJwt: string;

  beforeAll(async () => {
    vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
    staffJwt = await makeTestJwt({ role: 'STAFF' });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    setupAllMocks();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('end-to-end: preview → send → EmailMessage created + queued + RecordLink', async () => {
    app = await buildTestApp();

    // Step 1: Preview
    const previewRes = await app.inject({
      method: 'POST',
      url: '/documents/email/preview',
      headers: authHeaders(staffJwt),
      payload: {
        documentType: 'CustomerInvoice',
        recordId: TEST_RECORD_ID,
      },
    });

    expect(previewRes.statusCode).toBe(200);
    const previewBody = previewRes.json();
    expect(previewBody.success).toBe(true);
    expect(previewBody.data.from).toBe('invoices@testcompany.co.uk');
    expect(previewBody.data.to).toBe('billing@customer.co.uk');
    expect(previewBody.data.subject).toContain('Invoice');
    expect(previewBody.data.attachmentFileName).toMatch(/Invoice-INV-001\.pdf/);

    // Step 2: Send
    const sendRes = await app.inject({
      method: 'POST',
      url: '/documents/email',
      headers: authHeaders(staffJwt),
      payload: {
        documentType: 'CustomerInvoice',
        recordId: TEST_RECORD_ID,
        recipientOverrides: ['billing@customer.co.uk'],
      },
    });

    expect(sendRes.statusCode).toBe(200);
    const sendBody = sendRes.json();
    expect(sendBody.success).toBe(true);
    expect(sendBody.data.emailMessageId).toBe(TEST_EMAIL_MSG_ID);
    expect(sendBody.data.queueStatus).toBeDefined();
    expect(sendBody.data.recipientEmail).toBe('billing@customer.co.uk');

    // Verify: EmailMessage was created
    expect(mockPrisma.emailMessage.create).toHaveBeenCalled();

    // Verify: PDF was attached (Attachment record created + S3 upload)
    expect(mockPutObject).toHaveBeenCalledWith(
      'nexa-attachments',
      expect.stringContaining('EmailMessage'),
      expect.any(Buffer),
      'application/pdf',
    );
    expect(mockPrisma.attachment.create).toHaveBeenCalled();

    // Verify: hasAttachments set to true
    expect(mockPrisma.emailMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_EMAIL_MSG_ID },
        data: { hasAttachments: true },
      }),
    );

    // Verify: Email was queued (DRAFT → QUEUED)
    expect(mockEnqueueEmailSend).toHaveBeenCalled();

    // Verify: RecordLink was created
    expect(mockCreateSystemLink).toHaveBeenCalledWith(
      mockPrisma,
      expect.objectContaining({
        sourceEntityType: 'CustomerInvoice',
        sourceEntityId: TEST_RECORD_ID,
        targetEntityType: 'EmailMessage',
        targetEntityId: TEST_EMAIL_MSG_ID,
        linkType: 'RELATES_TO',
      }),
      TEST_USER_ID,
    );
  });
});
