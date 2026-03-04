// ---------------------------------------------------------------------------
// Route-level, integration, and cross-company isolation tests for email
// E10-1 Tasks 10.4, 10.5, 10.6
// ---------------------------------------------------------------------------

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  mockResolveUserRole,
  mockPermissionService,
  mockEventBus,
  mockNextNumber,
  mockEnqueueEmailSend,
} = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    companyProfile: { findUnique: vi.fn() },
    emailMessage: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    emailRecipient: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    emailSignature: {
      findFirst: vi.fn(),
    },
    emailQueue: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
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
  mockEventBus: {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
    setLogger: vi.fn(),
  },
  mockNextNumber: vi.fn(),
  mockEnqueueEmailSend: vi.fn(),
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  resolveUserRole: mockResolveUserRole,
  nextNumber: mockNextNumber,
  Prisma: { EmailMessageWhereInput: {} },
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
  EmailMessageStatus: {
    DRAFT: 'DRAFT',
    QUEUED: 'QUEUED',
    SENT: 'SENT',
    FAILED: 'FAILED',
    BOUNCED: 'BOUNCED',
  },
  EmailDirection: {
    INBOUND: 'INBOUND',
    OUTBOUND: 'OUTBOUND',
  },
  EmailRecipientType: {
    FROM: 'FROM',
    TO: 'TO',
    CC: 'CC',
    BCC: 'BCC',
  },
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
    RETRYING: 'RETRYING',
  },
}));

vi.mock('../../../core/rbac/permission.service.js', () => ({
  permissionService: mockPermissionService,
  PermissionService: vi.fn(),
  ACTION_FLAG_MAP: {
    new: 'canNew',
    view: 'canView',
    edit: 'canEdit',
    delete: 'canDelete',
  },
}));

vi.mock('./email-send.queue.js', () => ({
  enqueueEmailSend: mockEnqueueEmailSend,
  EMAIL_SEND_QUEUE_NAME: 'email-send',
  initEmailSendQueue: vi.fn(),
  getEmailSendQueue: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../../../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../../../core/middleware/company-context.js';
import { registerErrorHandler } from '../../../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../../core/validation/index.js';
import { emailRoutesPlugin } from './email.routes.js';
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

const COMPANY_B_ID = '22222222-2222-4000-a000-222222222222';
const now = new Date();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);
  app.decorate('eventBus', mockEventBus as unknown as FastifyInstance['eventBus']);
  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);
  await app.register(emailRoutesPlugin);
  await app.ready();
  return app;
}

function setupMocks(config: { role?: string; companyId?: string } = {}) {
  const resolvedRole = config.role ?? 'ADMIN';
  const companyId = config.companyId ?? TEST_COMPANY_ID;

  mockPrisma.user.findUnique.mockResolvedValue({
    companyId,
    isActive: true,
  });

  mockPrisma.companyProfile.findUnique.mockResolvedValue({ isActive: true });
  mockResolveUserRole.mockResolvedValue(resolvedRole);

  mockPrisma.$transaction.mockImplementation(
    async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
  );

  const fullPerm = {
    canAccess: true,
    canNew: true,
    canView: true,
    canEdit: true,
    canDelete: true,
  };
  mockPermissionService.getEffectivePermissions.mockResolvedValue({
    permissions: { 'communications.email': fullPerm },
    fieldOverrides: {},
    accessGroups: [{ id: 'ag-1', code: 'FULL_ACCESS', name: 'Full Access' }],
    role: resolvedRole,
    isSuperAdmin: resolvedRole === 'SUPER_ADMIN',
    enabledModules: ['system', 'communications'],
  });
}

function makeEmailRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    messageNumber: 'EM-00001',
    subject: 'Test Email',
    bodyText: 'Hello',
    bodyHtml: '<p>Hello</p>',
    direction: 'OUTBOUND',
    status: 'DRAFT',
    externalMessageId: null,
    inReplyTo: null,
    threadId: null,
    sourceEntityType: null,
    sourceEntityId: null,
    emailTemplateId: null,
    priority: 0,
    isHtml: true,
    hasAttachments: false,
    isAutoGenerated: false,
    isBounce: false,
    isMailingList: false,
    sentAt: null,
    companyId: TEST_COMPANY_ID,
    createdBy: TEST_USER_ID,
    createdAt: now,
    updatedAt: now,
    recipients: [
      {
        id: randomUUID(),
        recipientType: 'TO',
        emailAddress: 'test@example.com',
        displayName: null,
        userId: null,
        status: 'UNREAD',
        readAt: null,
        acceptanceStatus: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    queueEntry: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let staffJwt: string;
let adminJwt: string;
let viewerJwt: string;

beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  staffJwt = await makeTestJwt({ role: 'STAFF' });
  adminJwt = await makeTestJwt({ role: 'ADMIN' });
  viewerJwt = await makeTestJwt({ role: 'VIEWER' });
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// Task 10.4: Route-level tests
// ===========================================================================

describe('GET /email/messages', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('returns 200 with list of emails for current company', async () => {
    setupMocks();
    const email = makeEmailRecord();
    mockPrisma.emailMessage.findMany.mockResolvedValue([email]);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/email/messages',
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.meta.hasMore).toBe(false);
  });

  it('passes status filter through to service', async () => {
    setupMocks();
    mockPrisma.emailMessage.findMany.mockResolvedValue([]);
    app = await buildTestApp();

    await app.inject({
      method: 'GET',
      url: '/email/messages?status=SENT',
      headers: authHeaders(adminJwt),
    });

    expect(mockPrisma.emailMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'SENT' }),
      }),
    );
  });

  it('enforces STAFF+ permission (VIEWER rejected)', async () => {
    setupMocks({ role: 'VIEWER' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/email/messages',
      headers: authHeaders(viewerJwt),
    });

    expect(res.statusCode).toBe(403);
  });

  it('STAFF role can access email list', async () => {
    setupMocks({ role: 'STAFF' });
    mockPrisma.emailMessage.findMany.mockResolvedValue([]);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/email/messages',
      headers: authHeaders(staffJwt),
    });

    expect(res.statusCode).toBe(200);
  });
});

describe('GET /email/messages/:id', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('returns 200 with email and recipients', async () => {
    setupMocks();
    const email = makeEmailRecord();
    mockPrisma.emailMessage.findFirst.mockResolvedValue(email);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/email/messages/${email.id}`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe(email.id);
  });

  it('returns 404 when email not found', async () => {
    setupMocks();
    mockPrisma.emailMessage.findFirst.mockResolvedValue(null);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/email/messages/${randomUUID()}`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('POST /email/messages', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('creates email and returns 201', async () => {
    setupMocks();
    const email = makeEmailRecord();
    mockNextNumber.mockResolvedValue('EM-00001');
    mockPrisma.emailMessage.create.mockResolvedValue(email);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/email/messages',
      headers: authHeaders(adminJwt),
      payload: {
        subject: 'Test Email',
        bodyHtml: '<p>Hello</p>',
        recipients: [{ recipientType: 'TO', emailAddress: 'test@example.com' }],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
  });

  it('returns 400 for missing subject', async () => {
    setupMocks();
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/email/messages',
      headers: authHeaders(adminJwt),
      payload: {
        bodyHtml: '<p>No subject</p>',
        recipients: [{ recipientType: 'TO', emailAddress: 'test@example.com' }],
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for empty recipients array', async () => {
    setupMocks();
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/email/messages',
      headers: authHeaders(adminJwt),
      payload: {
        subject: 'Test',
        recipients: [],
      },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('POST /email/messages/:id/send', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('queues email for sending and returns 200', async () => {
    setupMocks();
    const emailId = randomUUID();
    const queueEntry = {
      id: randomUUID(),
      emailMessageId: emailId,
      status: 'PENDING',
      priority: 0,
      attempts: 0,
      maxAttempts: 3,
      lastError: null,
      nextRetryAt: null,
      smtpResponse: null,
      deliveredAt: null,
      queuedAt: now,
      processedAt: null,
    };

    // appendSignature uses findFirst (1st call), then queueEmail uses findFirst (2nd call)
    mockPrisma.emailMessage.findFirst
      .mockResolvedValueOnce({
        id: emailId,
        bodyHtml: '<p>Hello</p>',
        bodyText: 'Hello',
      })
      .mockResolvedValueOnce({
        id: emailId,
        status: 'DRAFT',
      });
    mockPrisma.emailSignature.findFirst.mockResolvedValue(null);

    // queueEmail mocks
    mockPrisma.emailMessage.update.mockResolvedValue({ id: emailId, status: 'QUEUED' });
    mockPrisma.emailQueue.create.mockResolvedValue(queueEntry);
    mockEnqueueEmailSend.mockResolvedValue(undefined);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/email/messages/${emailId}/send`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.emailMessageId).toBe(emailId);
  });

  it('re-queues FAILED email successfully', async () => {
    setupMocks();
    const emailId = randomUUID();
    const updatedQueueEntry = {
      id: randomUUID(),
      emailMessageId: emailId,
      status: 'PENDING',
      attempts: 0,
    };

    // appendSignature uses findFirst (1st call), then queueEmail uses findFirst (2nd call)
    mockPrisma.emailMessage.findFirst
      .mockResolvedValueOnce({
        id: emailId,
        bodyHtml: '<p>Hello</p>',
        bodyText: null,
      })
      .mockResolvedValueOnce({
        id: emailId,
        status: 'FAILED',
      });
    mockPrisma.emailSignature.findFirst.mockResolvedValue(null);
    mockPrisma.emailMessage.update.mockResolvedValue({ id: emailId, status: 'QUEUED' });
    mockPrisma.emailQueue.update.mockResolvedValue(updatedQueueEntry);
    mockEnqueueEmailSend.mockResolvedValue(undefined);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/email/messages/${emailId}/send`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(200);
  });
});

describe('PATCH /email/messages/:id/read', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('toggles read status for the current user', async () => {
    setupMocks();
    const emailId = randomUUID();
    const recipientId = randomUUID();

    mockPrisma.emailRecipient.findFirst.mockResolvedValue({
      id: recipientId,
      emailMessageId: emailId,
      userId: TEST_USER_ID,
      status: 'UNREAD',
    });
    mockPrisma.emailRecipient.update.mockResolvedValue({
      id: recipientId,
      status: 'READ',
      readAt: now,
    });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/email/messages/${emailId}/read`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(200);
    expect(mockPrisma.emailRecipient.update).toHaveBeenCalledWith({
      where: { id: recipientId },
      data: expect.objectContaining({ status: 'READ' }),
    });
  });

  it('returns 404 when user is not a recipient', async () => {
    setupMocks();
    mockPrisma.emailRecipient.findFirst.mockResolvedValue(null);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/email/messages/${randomUUID()}/read`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /email/messages/:id', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('soft-deletes email and returns 200', async () => {
    setupMocks();
    const emailId = randomUUID();

    mockPrisma.emailMessage.findFirst.mockResolvedValue({ id: emailId });
    mockPrisma.emailRecipient.updateMany.mockResolvedValue({ count: 1 });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/email/messages/${emailId}`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.deleted).toBe(true);
  });

  it('returns 404 when email not found', async () => {
    setupMocks();
    mockPrisma.emailMessage.findFirst.mockResolvedValue(null);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/email/messages/${randomUUID()}`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(404);
  });
});

// ===========================================================================
// Task 10.5: Integration tests — full lifecycle through HTTP
// ===========================================================================

describe('Integration: email lifecycle via HTTP', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('create → queue → verifies queued state', async () => {
    setupMocks();

    const emailId = randomUUID();
    const email = makeEmailRecord({ id: emailId, status: 'DRAFT' });
    const queueEntry = {
      id: randomUUID(),
      emailMessageId: emailId,
      status: 'PENDING',
      priority: 0,
      attempts: 0,
      maxAttempts: 3,
      lastError: null,
      nextRetryAt: null,
      smtpResponse: null,
      deliveredAt: null,
      queuedAt: now,
      processedAt: null,
    };

    // Step 1: Create email
    mockNextNumber.mockResolvedValue('EM-00010');
    mockPrisma.emailMessage.create.mockResolvedValue(email);

    app = await buildTestApp();

    const createRes = await app.inject({
      method: 'POST',
      url: '/email/messages',
      headers: authHeaders(adminJwt),
      payload: {
        subject: 'Invoice #123',
        bodyHtml: '<p>Please find attached</p>',
        recipients: [{ recipientType: 'TO', emailAddress: 'client@example.com' }],
      },
    });

    expect(createRes.statusCode).toBe(201);

    // Step 2: Queue for sending
    // appendSignature uses findFirst (1st call), then queueEmail uses findFirst (2nd call)
    mockPrisma.emailMessage.findFirst
      .mockResolvedValueOnce({
        id: emailId,
        bodyHtml: '<p>Please find attached</p>',
        bodyText: null,
      })
      .mockResolvedValueOnce({
        id: emailId,
        status: 'DRAFT',
      });
    mockPrisma.emailSignature.findFirst.mockResolvedValue(null);
    mockPrisma.emailMessage.update.mockResolvedValue({ id: emailId, status: 'QUEUED' });
    mockPrisma.emailQueue.create.mockResolvedValue(queueEntry);
    mockEnqueueEmailSend.mockResolvedValue(undefined);

    const sendRes = await app.inject({
      method: 'POST',
      url: `/email/messages/${emailId}/send`,
      headers: authHeaders(adminJwt),
    });

    expect(sendRes.statusCode).toBe(200);
    expect(mockEnqueueEmailSend).toHaveBeenCalledWith(queueEntry.id);

    // Step 3: Verify the email was fetched and queued correctly
    const queuedEmail = makeEmailRecord({
      id: emailId,
      status: 'QUEUED',
      queueEntry,
    });
    mockPrisma.emailMessage.findFirst.mockResolvedValue(queuedEmail);

    const getRes = await app.inject({
      method: 'GET',
      url: `/email/messages/${emailId}`,
      headers: authHeaders(adminJwt),
    });

    expect(getRes.statusCode).toBe(200);
    const body = getRes.json();
    expect(body.data.status).toBe('QUEUED');
  });
});

// ===========================================================================
// Task 10.6: Cross-company isolation tests
// ===========================================================================

describe('Cross-company isolation', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('Company A email is not visible to Company B (GET → 404)', async () => {
    // User belongs to Company B
    setupMocks({ companyId: COMPANY_B_ID });

    // The email belongs to Company A, so findFirst returns null for Company B
    mockPrisma.emailMessage.findFirst.mockResolvedValue(null);

    const companyBJwt = await makeTestJwt({ tenantId: COMPANY_B_ID, role: 'ADMIN' });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/email/messages/${randomUUID()}`,
      headers: authHeaders(companyBJwt, COMPANY_B_ID),
    });

    // Cross-company access returns 404 (not 403)
    expect(res.statusCode).toBe(404);
  });

  it('Company A email cannot be queued by Company B (POST /send → 404)', async () => {
    setupMocks({ companyId: COMPANY_B_ID });

    const emailId = randomUUID();

    // appendSignature uses findFirst: email not found for Company B
    mockPrisma.emailMessage.findFirst.mockResolvedValue(null);

    const companyBJwt = await makeTestJwt({ tenantId: COMPANY_B_ID, role: 'ADMIN' });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/email/messages/${emailId}/send`,
      headers: authHeaders(companyBJwt, COMPANY_B_ID),
    });

    // Should fail — email not found for Company B's context
    expect(res.statusCode).toBe(404);
  });

  it('Company B list only shows Company B emails', async () => {
    setupMocks({ companyId: COMPANY_B_ID });

    const companyBEmail = makeEmailRecord({ companyId: COMPANY_B_ID });
    mockPrisma.emailMessage.findMany.mockResolvedValue([companyBEmail]);

    const companyBJwt = await makeTestJwt({ tenantId: COMPANY_B_ID, role: 'ADMIN' });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/email/messages',
      headers: authHeaders(companyBJwt, COMPANY_B_ID),
    });

    expect(res.statusCode).toBe(200);

    // Verify the findMany was called with Company B's companyId
    expect(mockPrisma.emailMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: COMPANY_B_ID }),
      }),
    );
  });

  it('Company A email cannot be deleted by Company B', async () => {
    setupMocks({ companyId: COMPANY_B_ID });

    // findFirst with Company B's companyId → not found
    mockPrisma.emailMessage.findFirst.mockResolvedValue(null);

    const companyBJwt = await makeTestJwt({ tenantId: COMPANY_B_ID, role: 'ADMIN' });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/email/messages/${randomUUID()}`,
      headers: authHeaders(companyBJwt, COMPANY_B_ID),
    });

    expect(res.statusCode).toBe(404);
  });

  it('Company A cannot read Company B read-status', async () => {
    setupMocks({ companyId: COMPANY_B_ID });

    // No matching recipient for user+email combination
    mockPrisma.emailRecipient.findFirst.mockResolvedValue(null);

    const companyBJwt = await makeTestJwt({ tenantId: COMPANY_B_ID, role: 'ADMIN' });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/email/messages/${randomUUID()}/read`,
      headers: authHeaders(companyBJwt, COMPANY_B_ID),
    });

    expect(res.statusCode).toBe(404);
  });
});
