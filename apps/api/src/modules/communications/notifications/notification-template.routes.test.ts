import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerErrorHandler } from '../../../core/middleware/error-handler.js';
import type { EffectivePermissions } from '../../../core/rbac/permission.types.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../../core/validation/index.js';
import { NotFoundError, ValidationError } from '../../../core/errors/index.js';
import type { NotificationChannel, NotificationPriority } from '@nexa/db';

// ---------------------------------------------------------------------------
// Mock @nexa/db (prevent real PrismaClient init)
// ---------------------------------------------------------------------------

vi.mock('@nexa/db', () => ({
  prisma: {},
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
}));

// ---------------------------------------------------------------------------
// Mock service layer — control return values per test
// ---------------------------------------------------------------------------

vi.mock('./notification-template.service.js', () => ({
  createTemplate: vi.fn(),
  updateTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
  listTemplates: vi.fn(),
  getTemplateById: vi.fn(),
}));

import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listTemplates,
  getTemplateById,
} from './notification-template.service.js';
import { notificationTemplateRoutesPlugin } from './notification-template.routes.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEMPLATE_ID = '550e8400-e29b-41d4-a716-446655440000';

function fakeTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: TEMPLATE_ID,
    code: 'APPROVAL_REQUESTED',
    name: 'Approval Requested',
    description: null as string | null,
    eventName: 'approval.requested',
    titleTemplate: 'Approval required',
    bodyTemplate: 'A {{entityType}} requires your approval.',
    defaultChannels: ['IN_APP', 'EMAIL'] as NotificationChannel[],
    defaultPriority: 'HIGH' as NotificationPriority,
    actionUrl: null as string | null,
    isActive: true,
    createdAt: new Date('2026-03-03T00:00:00Z'),
    updatedAt: new Date('2026-03-03T00:00:00Z'),
    ...overrides,
  };
}

function buildTestApp(role: string = 'ADMIN') {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);

  // Decorate request with auth context (simulating JWT + company-context middleware)
  app.decorateRequest('userId', '');
  app.decorateRequest('tenantId', '');
  app.decorateRequest('companyId', '');
  app.decorateRequest('userRole', '');
  app.decorateRequest('enabledModules', {
    getter() {
      return (this as unknown as { _enabledModules: string[] })._enabledModules ?? [];
    },
    setter(val: string[]) {
      (this as unknown as { _enabledModules: string[] })._enabledModules = val;
    },
  });
  app.decorateRequest('permissions', {
    getter() {
      return ((this as unknown as { _permissions: unknown })._permissions ??
        null) as EffectivePermissions | null;
    },
    setter(val: unknown) {
      (this as unknown as { _permissions: unknown })._permissions = val;
    },
  });

  app.addHook('onRequest', async (request) => {
    request.userId = 'user-001';
    request.tenantId = 'tenant-001';
    request.companyId = 'company-001';
    request.userRole = role;
    request.enabledModules = [];
  });

  return app;
}

interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    messageKey?: string;
    details?: Record<string, string[]>;
  };
}

// ---------------------------------------------------------------------------
// GET /notifications/templates
// ---------------------------------------------------------------------------

describe('GET /notifications/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with template list', async () => {
    const fakeResult = { items: [fakeTemplate()], meta: { total: 1, limit: 50, offset: 0 } };
    vi.mocked(listTemplates).mockResolvedValue(fakeResult);

    const app = buildTestApp('ADMIN');
    await app.register(notificationTemplateRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/notifications/templates',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('items');

    await app.close();
  });

  it('passes query filters to service', async () => {
    vi.mocked(listTemplates).mockResolvedValue({
      items: [],
      meta: { total: 0, limit: 50, offset: 0 },
    });

    const app = buildTestApp('ADMIN');
    await app.register(notificationTemplateRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/notifications/templates?isActive=true&search=approval',
    });

    expect(res.statusCode).toBe(200);
    expect(listTemplates).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ isActive: true, search: 'approval' }),
    );

    await app.close();
  });

  it('returns 403 when user role is STAFF (below ADMIN)', async () => {
    const app = buildTestApp('STAFF');
    await app.register(notificationTemplateRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/notifications/templates',
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });

  it('returns 403 when user role is MANAGER (below ADMIN)', async () => {
    const app = buildTestApp('MANAGER');
    await app.register(notificationTemplateRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/notifications/templates',
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// GET /notifications/templates/:id
// ---------------------------------------------------------------------------

describe('GET /notifications/templates/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with template', async () => {
    vi.mocked(getTemplateById).mockResolvedValue(fakeTemplate());

    const app = buildTestApp('ADMIN');
    await app.register(notificationTemplateRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: `/notifications/templates/${TEMPLATE_ID}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('id', TEMPLATE_ID);
    expect(body.data).toHaveProperty('code', 'APPROVAL_REQUESTED');

    await app.close();
  });

  it('returns 404 when template does not exist', async () => {
    vi.mocked(getTemplateById).mockRejectedValue(
      new NotFoundError('TEMPLATE_NOT_FOUND', 'Notification template not found'),
    );

    const app = buildTestApp('ADMIN');
    await app.register(notificationTemplateRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: `/notifications/templates/${TEMPLATE_ID}`,
    });

    expect(res.statusCode).toBe(404);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('TEMPLATE_NOT_FOUND');

    await app.close();
  });

  it('returns 400 when id is not a valid UUID', async () => {
    const app = buildTestApp('ADMIN');
    await app.register(notificationTemplateRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/notifications/templates/not-a-uuid',
    });

    expect(res.statusCode).toBe(400);

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// POST /notifications/templates
// ---------------------------------------------------------------------------

describe('POST /notifications/templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validBody = {
    code: 'NEW_TEMPLATE',
    name: 'New Template',
    eventName: 'test.event',
    titleTemplate: 'Test title',
    bodyTemplate: 'Test body {{data}}',
    defaultChannels: ['IN_APP'],
  };

  it('returns 201 with created template', async () => {
    const created = fakeTemplate({ code: 'NEW_TEMPLATE', name: 'New Template' });
    vi.mocked(createTemplate).mockResolvedValue(created);

    const app = buildTestApp('ADMIN');
    await app.register(notificationTemplateRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/notifications/templates',
      payload: validBody,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('code', 'NEW_TEMPLATE');

    await app.close();
  });

  it('returns 400 when duplicate code', async () => {
    vi.mocked(createTemplate).mockRejectedValue(
      new ValidationError('A notification template with code "EXISTING" already exists'),
    );

    const app = buildTestApp('ADMIN');
    await app.register(notificationTemplateRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/notifications/templates',
      payload: { ...validBody, code: 'EXISTING' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');

    await app.close();
  });

  it('returns 400 when required fields are missing', async () => {
    const app = buildTestApp('ADMIN');
    await app.register(notificationTemplateRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/notifications/templates',
      payload: { code: 'MISSING_FIELDS' }, // missing name, eventName, etc.
    });

    expect(res.statusCode).toBe(400);

    await app.close();
  });

  it('returns 400 when defaultChannels is empty', async () => {
    const app = buildTestApp('ADMIN');
    await app.register(notificationTemplateRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/notifications/templates',
      payload: { ...validBody, defaultChannels: [] },
    });

    expect(res.statusCode).toBe(400);

    await app.close();
  });

  it('returns 403 when user role is STAFF (below ADMIN)', async () => {
    const app = buildTestApp('STAFF');
    await app.register(notificationTemplateRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/notifications/templates',
      payload: validBody,
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// PATCH /notifications/templates/:id
// ---------------------------------------------------------------------------

describe('PATCH /notifications/templates/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with updated template', async () => {
    const updated = fakeTemplate({ name: 'Updated Name' });
    vi.mocked(updateTemplate).mockResolvedValue(updated);

    const app = buildTestApp('ADMIN');
    await app.register(notificationTemplateRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PATCH',
      url: `/notifications/templates/${TEMPLATE_ID}`,
      payload: { name: 'Updated Name' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('name', 'Updated Name');

    await app.close();
  });

  it('returns 404 when template does not exist', async () => {
    vi.mocked(updateTemplate).mockRejectedValue(
      new NotFoundError('TEMPLATE_NOT_FOUND', 'Notification template not found'),
    );

    const app = buildTestApp('ADMIN');
    await app.register(notificationTemplateRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PATCH',
      url: `/notifications/templates/${TEMPLATE_ID}`,
      payload: { name: 'Updated' },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('TEMPLATE_NOT_FOUND');

    await app.close();
  });

  it('returns 403 when user role is STAFF', async () => {
    const app = buildTestApp('STAFF');
    await app.register(notificationTemplateRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PATCH',
      url: `/notifications/templates/${TEMPLATE_ID}`,
      payload: { name: 'nope' },
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// DELETE /notifications/templates/:id
// ---------------------------------------------------------------------------

describe('DELETE /notifications/templates/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with soft-deleted template (isActive = false)', async () => {
    const deleted = fakeTemplate({ isActive: false });
    vi.mocked(deleteTemplate).mockResolvedValue(deleted);

    const app = buildTestApp('ADMIN');
    await app.register(notificationTemplateRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'DELETE',
      url: `/notifications/templates/${TEMPLATE_ID}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('isActive', false);

    await app.close();
  });

  it('returns 404 when template does not exist', async () => {
    vi.mocked(deleteTemplate).mockRejectedValue(
      new NotFoundError('TEMPLATE_NOT_FOUND', 'Notification template not found'),
    );

    const app = buildTestApp('ADMIN');
    await app.register(notificationTemplateRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'DELETE',
      url: `/notifications/templates/${TEMPLATE_ID}`,
    });

    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it('returns 403 when user role is MANAGER (below ADMIN)', async () => {
    const app = buildTestApp('MANAGER');
    await app.register(notificationTemplateRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'DELETE',
      url: `/notifications/templates/${TEMPLATE_ID}`,
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });

  it('returns 400 when id is not a valid UUID', async () => {
    const app = buildTestApp('ADMIN');
    await app.register(notificationTemplateRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'DELETE',
      url: '/notifications/templates/not-a-uuid',
    });

    expect(res.statusCode).toBe(400);

    await app.close();
  });
});
