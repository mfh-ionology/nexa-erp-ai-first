import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Mock constants
// ---------------------------------------------------------------------------

const TEST_SERVICE_TOKEN = 'test-platform-service-token-abc123';

// ---------------------------------------------------------------------------
// Mock @nexa/platform-client
// ---------------------------------------------------------------------------

const mockInvalidateCache = vi.fn();

vi.mock('@nexa/platform-client', () => ({
  createPlatformClient: vi.fn(() => ({
    getEntitlements: vi.fn(),
    checkModuleAccess: vi.fn(),
    checkUserQuota: vi.fn(),
    getTenantStatus: vi.fn(),
    checkAiQuota: vi.fn(),
    recordAiUsage: vi.fn(),
    invalidateCache: mockInvalidateCache,
    destroy: vi.fn().mockResolvedValue(undefined),
  })),
}));

// ---------------------------------------------------------------------------
// Mock @nexa/db — buildApp transitively imports it
// ---------------------------------------------------------------------------

vi.mock('@nexa/db', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    refreshToken: { create: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
    userCompanyRole: { findUnique: vi.fn(), findFirst: vi.fn() },
  },
  resolveUserRole: vi.fn(),
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
  VatScheme: {
    STANDARD: 'STANDARD',
    FLAT_RATE: 'FLAT_RATE',
    CASH: 'CASH',
  },
  ResourceType: {
    PAGE: 'PAGE',
    REPORT: 'REPORT',
    SETTING: 'SETTING',
    MAINTENANCE: 'MAINTENANCE',
  },
  FieldVisibility: {
    VISIBLE: 'VISIBLE',
    READ_ONLY: 'READ_ONLY',
    HIDDEN: 'HIDDEN',
  },
}));

// Mock argon2 to avoid native module issues in unit tests
vi.mock('argon2', () => ({
  default: {
    verify: vi.fn(),
    hash: vi.fn(),
    argon2id: 2,
  },
}));

// ---------------------------------------------------------------------------
// Env setup
// ---------------------------------------------------------------------------

beforeAll(() => {
  vi.stubEnv('JWT_SECRET', 'test-secret-that-is-at-least-32-chars-long!!');
  vi.stubEnv('PLATFORM_SERVICE_TOKEN', TEST_SERVICE_TOKEN);
  vi.stubEnv('PLATFORM_API_URL', 'http://localhost:3001/api/v1');
});

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { buildApp } from '../../../app.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWebhookPayload(event: string, tenantId: string = '550e8400-e29b-41d4-a716-446655440000') {
  return {
    event,
    timestamp: new Date().toISOString(),
    payload: { tenantId },
  };
}

function authHeader(token: string = TEST_SERVICE_TOKEN) {
  return { authorization: `Bearer ${token}` };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /webhooks/platform (Task 6)', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    vi.clearAllMocks();
  });

  // --- Valid service token + tenant.plan_changed → 200, cache invalidated ---

  it('returns 200 and invalidates cache on tenant.plan_changed', async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const body = makeWebhookPayload('tenant.plan_changed');
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/platform',
      headers: authHeader(),
      payload: body,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
    expect(mockInvalidateCache).toHaveBeenCalledWith(body.payload.tenantId);
  });

  // --- Valid service token + tenant.suspended → 200, cache invalidated ---

  it('returns 200 and invalidates cache on tenant.suspended', async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const body = makeWebhookPayload('tenant.suspended');
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/platform',
      headers: authHeader(),
      payload: body,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
    expect(mockInvalidateCache).toHaveBeenCalledWith(body.payload.tenantId);
  });

  // --- Valid service token + tenant.reactivated → 200, cache invalidated ---

  it('returns 200 and invalidates cache on tenant.reactivated', async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const body = makeWebhookPayload('tenant.reactivated');
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/platform',
      headers: authHeader(),
      payload: body,
    });

    expect(res.statusCode).toBe(200);
    expect(mockInvalidateCache).toHaveBeenCalledWith(body.payload.tenantId);
  });

  // --- Valid service token + tenant.archived → 200, cache invalidated ---

  it('returns 200 and invalidates cache on tenant.archived', async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const body = makeWebhookPayload('tenant.archived');
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/platform',
      headers: authHeader(),
      payload: body,
    });

    expect(res.statusCode).toBe(200);
    expect(mockInvalidateCache).toHaveBeenCalledWith(body.payload.tenantId);
  });

  // --- Valid service token + tenant.modules_changed → 200, cache invalidated ---

  it('returns 200 and invalidates cache on tenant.modules_changed', async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const body = makeWebhookPayload('tenant.modules_changed');
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/platform',
      headers: authHeader(),
      payload: body,
    });

    expect(res.statusCode).toBe(200);
    expect(mockInvalidateCache).toHaveBeenCalledWith(body.payload.tenantId);
  });

  // --- Valid service token + billing.enforcement_changed → 200, cache invalidated ---

  it('returns 200 and invalidates cache on billing.enforcement_changed', async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const body = makeWebhookPayload('billing.enforcement_changed');
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/platform',
      headers: authHeader(),
      payload: body,
    });

    expect(res.statusCode).toBe(200);
    expect(mockInvalidateCache).toHaveBeenCalledWith(body.payload.tenantId);
  });

  // --- Valid service token + tenant.quota_warning → 200, no cache invalidation ---

  it('returns 200 on tenant.quota_warning without cache invalidation', async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const body = makeWebhookPayload('tenant.quota_warning');
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/platform',
      headers: authHeader(),
      payload: body,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
    expect(mockInvalidateCache).not.toHaveBeenCalled();
  });

  // --- Valid service token + unknown event → 200 (forward compatible) ---

  it('returns 200 on unknown event type (forward compatible)', async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const body = makeWebhookPayload('tenant.future_event_v2');
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/platform',
      headers: authHeader(),
      payload: body,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true });
    expect(mockInvalidateCache).not.toHaveBeenCalled();
  });

  // --- Invalid service token → 401 ---

  it('returns 401 for invalid service token', async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const body = makeWebhookPayload('tenant.plan_changed');
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/platform',
      headers: authHeader('wrong-token'),
      payload: body,
    });

    expect(res.statusCode).toBe(401);
    const json = res.json() as { success: boolean; error: { code: string } };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNAUTHORIZED');
    expect(mockInvalidateCache).not.toHaveBeenCalled();
  });

  // --- Missing Authorization header → 401 ---

  it('returns 401 when Authorization header is missing', async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const body = makeWebhookPayload('tenant.plan_changed');
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/platform',
      payload: body,
    });

    expect(res.statusCode).toBe(401);
    const json = res.json() as { success: boolean; error: { code: string } };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe('UNAUTHORIZED');
  });

  // --- Empty Authorization header → 401 ---

  it('returns 401 when Authorization header is empty', async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const body = makeWebhookPayload('tenant.plan_changed');
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/platform',
      headers: { authorization: '' },
      payload: body,
    });

    expect(res.statusCode).toBe(401);
  });

  // --- Bearer prefix without token → 401 ---

  it('returns 401 when Authorization header is "Bearer " with no token', async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const body = makeWebhookPayload('tenant.plan_changed');
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/platform',
      headers: { authorization: 'Bearer ' },
      payload: body,
    });

    expect(res.statusCode).toBe(401);
  });

  // --- Malformed body → 400 ---

  it('returns 400 for malformed body (missing required fields)', async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/platform',
      headers: authHeader(),
      payload: { event: 'test' }, // missing timestamp and payload
    });

    expect(res.statusCode).toBe(400);
  });

  // --- Empty body → 400 ---

  it('returns 400 for empty body', async () => {
    app = await buildApp({ logger: false });
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/platform',
      headers: authHeader(),
      payload: {},
    });

    expect(res.statusCode).toBe(400);
  });
});
