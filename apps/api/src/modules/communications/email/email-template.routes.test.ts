// ---------------------------------------------------------------------------
// Route-level tests for /email/templates — E10-2 Task 8.3
// ---------------------------------------------------------------------------

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mocks — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole, mockPermissionService } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    companyProfile: { findUnique: vi.fn() },
    emailTemplate: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
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
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  resolveUserRole: mockResolveUserRole,
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
  ACTION_FLAG_MAP: {
    new: 'canNew',
    view: 'canView',
    edit: 'canEdit',
    delete: 'canDelete',
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../../../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../../../core/middleware/company-context.js';
import { registerErrorHandler } from '../../../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../../core/validation/index.js';
import { emailTemplateRoutesPlugin } from './email-template.routes.js';
import {
  makeTestJwt,
  authHeaders,
  TEST_JWT_SECRET,
  TEST_USER_ID,
  TEST_COMPANY_ID,
} from '../../../test-utils/jwt.js';
import { Prisma } from '@nexa/db';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const now = new Date('2026-03-01T00:00:00Z');

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
  await app.register(emailTemplateRoutesPlugin);
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
// Setup
// ---------------------------------------------------------------------------

let adminJwt: string;
let staffJwt: string;
let viewerJwt: string;

beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  adminJwt = await makeTestJwt({ role: 'ADMIN' });
  staffJwt = await makeTestJwt({ role: 'STAFF' });
  viewerJwt = await makeTestJwt({ role: 'VIEWER' });
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ===========================================================================
// CRUD lifecycle
// ===========================================================================

describe('POST /email/templates', () => {
  let app: FastifyInstance;
  afterEach(async () => {
    await app?.close();
  });

  it('creates template and returns 201', async () => {
    setupMocks();
    const template = makeTemplateRecord();
    mockPrisma.emailTemplate.create.mockResolvedValue(template);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/email/templates',
      headers: authHeaders(adminJwt),
      payload: {
        code: 'INVOICE_SEND',
        name: 'Invoice Send',
        documentType: 'CustomerInvoice',
        subjectTemplate: 'Invoice {{invoiceNumber}} from {{companyName}}',
        bodyHtmlTemplate: '<p>Dear {{customerName}}</p>',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.code).toBe('INVOICE_SEND');
  });

  it('returns 400 for invalid template syntax', async () => {
    setupMocks();
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/email/templates',
      headers: authHeaders(adminJwt),
      payload: {
        code: 'BAD_TEMPLATE',
        name: 'Bad',
        documentType: 'CustomerInvoice',
        subjectTemplate: '{{invoiceNumber}}',
        bodyHtmlTemplate: '{{#if customerName}}unclosed',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 409 for duplicate code (P2002)', async () => {
    setupMocks();
    const err = new (Prisma.PrismaClientKnownRequestError as any)('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '6.0.0',
    });
    mockPrisma.emailTemplate.create.mockRejectedValue(err);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/email/templates',
      headers: authHeaders(adminJwt),
      payload: {
        code: 'INVOICE_SEND',
        name: 'Dupe',
        documentType: 'CustomerInvoice',
        subjectTemplate: '{{invoiceNumber}}',
        bodyHtmlTemplate: '<p>{{customerName}}</p>',
      },
    });

    expect(res.statusCode).toBe(409);
  });
});

// ---------------------------------------------------------------------------
// Permission guards
// ---------------------------------------------------------------------------

describe('Permission guards — ADMIN required', () => {
  let app: FastifyInstance;
  afterEach(async () => {
    await app?.close();
  });

  it('STAFF user gets 403 on POST /email/templates', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/email/templates',
      headers: authHeaders(staffJwt),
      payload: {
        code: 'TEST',
        name: 'Test',
        documentType: 'CustomerInvoice',
        subjectTemplate: '{{invoiceNumber}}',
        bodyHtmlTemplate: '<p>{{customerName}}</p>',
      },
    });

    expect(res.statusCode).toBe(403);
  });

  it('VIEWER user gets 403 on GET /email/templates', async () => {
    setupMocks({ role: 'VIEWER' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/email/templates',
      headers: authHeaders(viewerJwt),
    });

    expect(res.statusCode).toBe(403);
  });

  it('STAFF user gets 403 on DELETE /email/templates/:id', async () => {
    setupMocks({ role: 'STAFF' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/email/templates/${randomUUID()}`,
      headers: authHeaders(staffJwt),
    });

    expect(res.statusCode).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /email/templates
// ---------------------------------------------------------------------------

describe('GET /email/templates', () => {
  let app: FastifyInstance;
  afterEach(async () => {
    await app?.close();
  });

  it('returns paginated list of templates', async () => {
    setupMocks();
    const templates = [makeTemplateRecord(), makeTemplateRecord({ code: 'QUOTE_SEND' })];
    mockPrisma.emailTemplate.findMany.mockResolvedValue(templates);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/email/templates',
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(2);
    expect(body.data.meta.hasMore).toBe(false);
  });

  it('supports documentType filter', async () => {
    setupMocks();
    mockPrisma.emailTemplate.findMany.mockResolvedValue([]);
    app = await buildTestApp();

    await app.inject({
      method: 'GET',
      url: '/email/templates?documentType=SalesQuote',
      headers: authHeaders(adminJwt),
    });

    expect(mockPrisma.emailTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ documentType: 'SalesQuote' }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// GET /email/templates/:id
// ---------------------------------------------------------------------------

describe('GET /email/templates/:id', () => {
  let app: FastifyInstance;
  afterEach(async () => {
    await app?.close();
  });

  it('returns single template', async () => {
    setupMocks();
    const template = makeTemplateRecord();
    mockPrisma.emailTemplate.findUnique.mockResolvedValue(template);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/email/templates/${template.id}`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.id).toBe(template.id);
  });

  it('returns 404 when not found', async () => {
    setupMocks();
    mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: `/email/templates/${randomUUID()}`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PATCH /email/templates/:id
// ---------------------------------------------------------------------------

describe('PATCH /email/templates/:id', () => {
  let app: FastifyInstance;
  afterEach(async () => {
    await app?.close();
  });

  it('updates template and returns 200', async () => {
    setupMocks();
    const existing = makeTemplateRecord();
    const updated = { ...existing, name: 'Updated' };
    mockPrisma.emailTemplate.findUnique.mockResolvedValue(existing);
    mockPrisma.emailTemplate.update.mockResolvedValue(updated);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/email/templates/${existing.id}`,
      headers: authHeaders(adminJwt),
      payload: { name: 'Updated' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Updated');
  });

  it('returns 404 when template not found', async () => {
    setupMocks();
    mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/email/templates/${randomUUID()}`,
      headers: authHeaders(adminJwt),
      payload: { name: 'Nope' },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /email/templates/:id
// ---------------------------------------------------------------------------

describe('DELETE /email/templates/:id', () => {
  let app: FastifyInstance;
  afterEach(async () => {
    await app?.close();
  });

  it('soft-deletes and returns 200', async () => {
    setupMocks();
    const existing = makeTemplateRecord();
    mockPrisma.emailTemplate.findUnique.mockResolvedValue(existing);
    mockPrisma.emailTemplate.update.mockResolvedValue({ ...existing, isActive: false });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/email/templates/${existing.id}`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.deleted).toBe(true);
  });

  it('returns 404 when not found', async () => {
    setupMocks();
    mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/email/templates/${randomUUID()}`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /email/templates/:id/preview
// ---------------------------------------------------------------------------

describe('POST /email/templates/:id/preview', () => {
  let app: FastifyInstance;
  afterEach(async () => {
    await app?.close();
  });

  it('returns rendered HTML preview with sample data', async () => {
    setupMocks();
    const template = makeTemplateRecord();
    mockPrisma.emailTemplate.findUnique.mockResolvedValue(template);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/email/templates/${template.id}/preview`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.subject).toBeDefined();
    expect(body.data.bodyHtml).toBeDefined();
    expect(body.data.sampleData).toBeDefined();
  });

  it('returns 404 when template not found', async () => {
    setupMocks();
    mockPrisma.emailTemplate.findUnique.mockResolvedValue(null);
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/email/templates/${randomUUID()}/preview`,
      headers: authHeaders(adminJwt),
    });

    expect(res.statusCode).toBe(404);
  });
});

// ===========================================================================
// Full CRUD lifecycle
// ===========================================================================

describe('Full CRUD lifecycle', () => {
  let app: FastifyInstance;
  afterEach(async () => {
    await app?.close();
  });

  it('create → list → get → update → delete lifecycle', async () => {
    setupMocks();
    const templateId = randomUUID();
    const template = makeTemplateRecord({ id: templateId });

    // Create
    mockPrisma.emailTemplate.create.mockResolvedValue(template);
    app = await buildTestApp();

    const createRes = await app.inject({
      method: 'POST',
      url: '/email/templates',
      headers: authHeaders(adminJwt),
      payload: {
        code: 'INVOICE_SEND',
        name: 'Invoice Send',
        documentType: 'CustomerInvoice',
        subjectTemplate: 'Invoice {{invoiceNumber}} from {{companyName}}',
        bodyHtmlTemplate: '<p>Dear {{customerName}}</p>',
      },
    });
    expect(createRes.statusCode).toBe(201);

    // List
    mockPrisma.emailTemplate.findMany.mockResolvedValue([template]);
    const listRes = await app.inject({
      method: 'GET',
      url: '/email/templates',
      headers: authHeaders(adminJwt),
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().data.items).toHaveLength(1);

    // Get
    mockPrisma.emailTemplate.findUnique.mockResolvedValue(template);
    const getRes = await app.inject({
      method: 'GET',
      url: `/email/templates/${templateId}`,
      headers: authHeaders(adminJwt),
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().data.id).toBe(templateId);

    // Update
    const updated = { ...template, name: 'Updated Invoice' };
    mockPrisma.emailTemplate.findUnique.mockResolvedValue(template);
    mockPrisma.emailTemplate.update.mockResolvedValue(updated);
    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/email/templates/${templateId}`,
      headers: authHeaders(adminJwt),
      payload: { name: 'Updated Invoice' },
    });
    expect(updateRes.statusCode).toBe(200);

    // Delete (soft)
    mockPrisma.emailTemplate.findUnique.mockResolvedValue(template);
    mockPrisma.emailTemplate.update.mockResolvedValue({ ...template, isActive: false });
    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/email/templates/${templateId}`,
      headers: authHeaders(adminJwt),
    });
    expect(deleteRes.statusCode).toBe(200);
    expect(deleteRes.json().data.deleted).toBe(true);
  });
});
