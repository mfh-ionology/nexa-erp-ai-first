import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerErrorHandler } from '../../../core/middleware/error-handler.js';
import type { EffectivePermissions } from '../../../core/rbac/permission.types.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../../core/validation/index.js';
import { AppError, NotFoundError } from '../../../core/errors/index.js';
import type { NotificationStatus, NotificationChannel, NotificationPriority } from '@nexa/db';

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

vi.mock('./notification.service.js', () => ({
  listNotifications: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  dismissNotification: vi.fn(),
  getUnreadCount: vi.fn(),
}));

vi.mock('./notification-preference.service.js', () => ({
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
  getRoleDefaults: vi.fn(),
  updateRoleDefaults: vi.fn(),
}));

import {
  listNotifications,
  markAsRead,
  markAllAsRead,
  dismissNotification,
  getUnreadCount,
} from './notification.service.js';
import { getRoleDefaults, updateRoleDefaults } from './notification-preference.service.js';
import { notificationRoutesPlugin } from './notification.routes.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOTIFICATION_ID = '550e8400-e29b-41d4-a716-446655440000';

function fakeNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTIFICATION_ID,
    userId: 'user-001',
    templateId: 'template-001',
    title: 'Test notification',
    body: 'This is a test notification body',
    channel: 'IN_APP' as NotificationChannel,
    priority: 'NORMAL' as NotificationPriority,
    actionUrl: null as string | null,
    entityType: null as string | null,
    entityId: null as string | null,
    status: 'DELIVERED' as NotificationStatus,
    deliveredAt: new Date('2026-03-03T00:00:00Z'),
    readAt: null as Date | null,
    dismissedAt: null as Date | null,
    createdAt: new Date('2026-03-03T00:00:00Z'),
    updatedAt: new Date('2026-03-03T00:00:00Z'),
    ...overrides,
  };
}

function buildTestApp(role: string = 'STAFF') {
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
// GET /notifications
// ---------------------------------------------------------------------------

describe('GET /notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with notification list', async () => {
    const fakeResult = {
      items: [fakeNotification()],
      meta: { cursor: null, hasMore: false },
    };
    vi.mocked(listNotifications).mockResolvedValue(fakeResult);

    const app = buildTestApp('STAFF');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/notifications',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('items');

    await app.close();
  });

  it('passes query params to service (status filter)', async () => {
    const fakeResult = {
      items: [],
      meta: { cursor: null, hasMore: false },
    };
    vi.mocked(listNotifications).mockResolvedValue(fakeResult);

    const app = buildTestApp('STAFF');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/notifications?status=DELIVERED&limit=10',
    });

    expect(res.statusCode).toBe(200);
    expect(listNotifications).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ status: 'DELIVERED', limit: 10 }),
    );

    await app.close();
  });

  it('returns 403 when user role is VIEWER (below STAFF)', async () => {
    const app = buildTestApp('VIEWER');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/notifications',
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// GET /notifications/unread-count
// ---------------------------------------------------------------------------

describe('GET /notifications/unread-count', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with unread count', async () => {
    vi.mocked(getUnreadCount).mockResolvedValue({ count: 5 });

    const app = buildTestApp('STAFF');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/notifications/unread-count',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('count', 5);

    await app.close();
  });

  it('returns 403 when user role is VIEWER', async () => {
    const app = buildTestApp('VIEWER');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/notifications/unread-count',
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// PATCH /notifications/mark-all-read
// ---------------------------------------------------------------------------

describe('PATCH /notifications/mark-all-read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with updated count', async () => {
    vi.mocked(markAllAsRead).mockResolvedValue({ updated: 5 });

    const app = buildTestApp('STAFF');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PATCH',
      url: '/notifications/mark-all-read',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('updated', 5);

    await app.close();
  });

  it('returns 200 with updated: 0 when no unread notifications', async () => {
    vi.mocked(markAllAsRead).mockResolvedValue({ updated: 0 });

    const app = buildTestApp('STAFF');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PATCH',
      url: '/notifications/mark-all-read',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('updated', 0);

    await app.close();
  });

  it('calls markAllAsRead with request context', async () => {
    vi.mocked(markAllAsRead).mockResolvedValue({ updated: 3 });

    const app = buildTestApp('STAFF');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    await app.inject({
      method: 'PATCH',
      url: '/notifications/mark-all-read',
    });

    expect(markAllAsRead).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-001' }),
      expect.anything(),
    );

    await app.close();
  });

  it('returns 403 when user role is VIEWER', async () => {
    const app = buildTestApp('VIEWER');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PATCH',
      url: '/notifications/mark-all-read',
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// PATCH /notifications/:id/read
// ---------------------------------------------------------------------------

describe('PATCH /notifications/:id/read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with updated notification marked as READ', async () => {
    const readNotification = fakeNotification({
      status: 'READ',
      readAt: new Date('2026-03-03T01:00:00Z'),
    });
    vi.mocked(markAsRead).mockResolvedValue(readNotification);

    const app = buildTestApp('STAFF');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PATCH',
      url: `/notifications/${NOTIFICATION_ID}/read`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('status', 'READ');

    await app.close();
  });

  it('returns 404 when notification does not exist', async () => {
    vi.mocked(markAsRead).mockRejectedValue(
      new NotFoundError('NOTIFICATION_NOT_FOUND', 'Notification not found'),
    );

    const app = buildTestApp('STAFF');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PATCH',
      url: `/notifications/${NOTIFICATION_ID}/read`,
    });

    expect(res.statusCode).toBe(404);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOTIFICATION_NOT_FOUND');

    await app.close();
  });

  it('returns 422 on invalid state transition', async () => {
    vi.mocked(markAsRead).mockRejectedValue(
      new AppError(
        'INVALID_STATE_TRANSITION',
        'Cannot mark notification as read from status PENDING',
        422,
      ),
    );

    const app = buildTestApp('STAFF');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PATCH',
      url: `/notifications/${NOTIFICATION_ID}/read`,
    });

    expect(res.statusCode).toBe(422);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_STATE_TRANSITION');

    await app.close();
  });

  it('returns 400 when id is not a valid UUID', async () => {
    const app = buildTestApp('STAFF');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PATCH',
      url: '/notifications/not-a-uuid/read',
    });

    expect(res.statusCode).toBe(400);

    await app.close();
  });

  it('returns 403 when user role is VIEWER', async () => {
    const app = buildTestApp('VIEWER');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PATCH',
      url: `/notifications/${NOTIFICATION_ID}/read`,
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// POST /notifications/:id/dismiss
// ---------------------------------------------------------------------------

describe('POST /notifications/:id/dismiss', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with dismissed notification', async () => {
    const dismissed = fakeNotification({
      status: 'DISMISSED',
      dismissedAt: new Date('2026-03-03T01:00:00Z'),
    });
    vi.mocked(dismissNotification).mockResolvedValue(dismissed);

    const app = buildTestApp('STAFF');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: `/notifications/${NOTIFICATION_ID}/dismiss`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('status', 'DISMISSED');

    await app.close();
  });

  it('returns 404 when notification does not exist', async () => {
    vi.mocked(dismissNotification).mockRejectedValue(
      new NotFoundError('NOTIFICATION_NOT_FOUND', 'Notification not found'),
    );

    const app = buildTestApp('STAFF');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: `/notifications/${NOTIFICATION_ID}/dismiss`,
    });

    expect(res.statusCode).toBe(404);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('NOTIFICATION_NOT_FOUND');

    await app.close();
  });

  it('returns 422 on invalid state transition', async () => {
    vi.mocked(dismissNotification).mockRejectedValue(
      new AppError(
        'INVALID_STATE_TRANSITION',
        'Cannot dismiss notification from status PENDING',
        422,
      ),
    );

    const app = buildTestApp('STAFF');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: `/notifications/${NOTIFICATION_ID}/dismiss`,
    });

    expect(res.statusCode).toBe(422);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_STATE_TRANSITION');

    await app.close();
  });

  it('returns 403 when user role is VIEWER', async () => {
    const app = buildTestApp('VIEWER');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: `/notifications/${NOTIFICATION_ID}/dismiss`,
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// GET /notifications/preferences/role-defaults (ADMIN only)
// ---------------------------------------------------------------------------

const TEMPLATE_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('GET /notifications/preferences/role-defaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with role defaults for ADMIN user', async () => {
    const fakeResult = {
      role: 'STAFF',
      items: [
        {
          templateId: TEMPLATE_ID,
          templateCode: 'APPROVAL_REQUESTED',
          templateName: 'Approval Required',
          eventName: 'approval.requested',
          defaultChannels: ['IN_APP', 'EMAIL'] as ('IN_APP' | 'EMAIL' | 'PUSH')[],
          enableInApp: true,
          enableEmail: false,
          enablePush: true,
          hasRoleDefault: true,
        },
      ],
    };
    vi.mocked(getRoleDefaults).mockResolvedValue(fakeResult);

    const app = buildTestApp('ADMIN');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/notifications/preferences/role-defaults?role=STAFF',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('role', 'STAFF');
    expect(body.data).toHaveProperty('items');

    await app.close();
  });

  it('passes role query parameter to service', async () => {
    vi.mocked(getRoleDefaults).mockResolvedValue({ role: 'MANAGER', items: [] });

    const app = buildTestApp('ADMIN');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    await app.inject({
      method: 'GET',
      url: '/notifications/preferences/role-defaults?role=MANAGER',
    });

    expect(getRoleDefaults).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-001' }),
      expect.anything(),
      { role: 'MANAGER' },
    );

    await app.close();
  });

  it('returns 403 when user role is STAFF (below ADMIN)', async () => {
    const app = buildTestApp('STAFF');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/notifications/preferences/role-defaults?role=STAFF',
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });

  it('returns 403 when user role is VIEWER', async () => {
    const app = buildTestApp('VIEWER');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/notifications/preferences/role-defaults?role=STAFF',
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });

  it('returns 400 when role query param is missing', async () => {
    const app = buildTestApp('ADMIN');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/notifications/preferences/role-defaults',
    });

    expect(res.statusCode).toBe(400);

    await app.close();
  });

  it('returns 400 when role query param is invalid', async () => {
    const app = buildTestApp('ADMIN');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/notifications/preferences/role-defaults?role=INVALID',
    });

    expect(res.statusCode).toBe(400);

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// PUT /notifications/preferences/role-defaults (ADMIN only)
// ---------------------------------------------------------------------------

describe('PUT /notifications/preferences/role-defaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with updated count for ADMIN user', async () => {
    vi.mocked(updateRoleDefaults).mockResolvedValue({ updated: 2 });

    const app = buildTestApp('ADMIN');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PUT',
      url: '/notifications/preferences/role-defaults',
      payload: {
        role: 'STAFF',
        preferences: [
          {
            notificationTemplateId: TEMPLATE_ID,
            enableInApp: true,
            enableEmail: false,
            enablePush: true,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('updated', 2);

    await app.close();
  });

  it('passes body to updateRoleDefaults service', async () => {
    vi.mocked(updateRoleDefaults).mockResolvedValue({ updated: 1 });

    const app = buildTestApp('ADMIN');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const payload = {
      role: 'MANAGER',
      preferences: [
        {
          notificationTemplateId: TEMPLATE_ID,
          enableInApp: false,
          enableEmail: true,
          enablePush: false,
        },
      ],
    };

    await app.inject({
      method: 'PUT',
      url: '/notifications/preferences/role-defaults',
      payload,
    });

    expect(updateRoleDefaults).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-001' }),
      expect.anything(),
      payload,
    );

    await app.close();
  });

  it('returns 403 when user role is STAFF (below ADMIN)', async () => {
    const app = buildTestApp('STAFF');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PUT',
      url: '/notifications/preferences/role-defaults',
      payload: {
        role: 'STAFF',
        preferences: [
          {
            notificationTemplateId: TEMPLATE_ID,
            enableInApp: true,
            enableEmail: true,
            enablePush: true,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });

  it('returns 403 when user role is VIEWER', async () => {
    const app = buildTestApp('VIEWER');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PUT',
      url: '/notifications/preferences/role-defaults',
      payload: {
        role: 'STAFF',
        preferences: [
          {
            notificationTemplateId: TEMPLATE_ID,
            enableInApp: true,
            enableEmail: true,
            enablePush: true,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });

  it('returns 400 when role is invalid', async () => {
    const app = buildTestApp('ADMIN');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PUT',
      url: '/notifications/preferences/role-defaults',
      payload: {
        role: 'NONEXISTENT_ROLE',
        preferences: [
          {
            notificationTemplateId: TEMPLATE_ID,
            enableInApp: true,
            enableEmail: true,
            enablePush: true,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(400);

    await app.close();
  });

  it('returns 400 when preferences array is empty', async () => {
    const app = buildTestApp('ADMIN');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PUT',
      url: '/notifications/preferences/role-defaults',
      payload: {
        role: 'STAFF',
        preferences: [],
      },
    });

    expect(res.statusCode).toBe(400);

    await app.close();
  });

  it('returns 400 when body is missing', async () => {
    const app = buildTestApp('ADMIN');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PUT',
      url: '/notifications/preferences/role-defaults',
    });

    expect(res.statusCode).toBe(400);

    await app.close();
  });

  it('returns 400 when notificationTemplateId is not a valid UUID', async () => {
    const app = buildTestApp('ADMIN');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PUT',
      url: '/notifications/preferences/role-defaults',
      payload: {
        role: 'STAFF',
        preferences: [
          {
            notificationTemplateId: 'not-a-uuid',
            enableInApp: true,
            enableEmail: true,
            enablePush: true,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(400);

    await app.close();
  });

  it('allows SUPER_ADMIN role access', async () => {
    vi.mocked(updateRoleDefaults).mockResolvedValue({ updated: 1 });

    const app = buildTestApp('SUPER_ADMIN');
    await app.register(notificationRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'PUT',
      url: '/notifications/preferences/role-defaults',
      payload: {
        role: 'STAFF',
        preferences: [
          {
            notificationTemplateId: TEMPLATE_ID,
            enableInApp: true,
            enableEmail: true,
            enablePush: true,
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);

    await app.close();
  });
});
