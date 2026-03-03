import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerErrorHandler } from '../../core/middleware/error-handler.js';
import type { EffectivePermissions } from '../../core/rbac/permission.types.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../core/validation/index.js';
import { AppError, NotFoundError } from '../../core/errors/index.js';
import type { RecordLinkType } from '@nexa/db';

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
  RecordLinkType: {
    CREATED_FROM: 'CREATED_FROM',
    FULFILLS: 'FULFILLS',
    PAYMENT_FOR: 'PAYMENT_FOR',
    CREDIT_FOR: 'CREDIT_FOR',
    RELATES_TO: 'RELATES_TO',
    PARENT_CHILD: 'PARENT_CHILD',
  },
}));

// ---------------------------------------------------------------------------
// Mock service layer — control return values per test
// ---------------------------------------------------------------------------

vi.mock('./record-link.service.js', () => ({
  createRecordLink: vi.fn(),
  listRecordLinks: vi.fn(),
  deleteRecordLink: vi.fn(),
}));

import { createRecordLink, listRecordLinks, deleteRecordLink } from './record-link.service.js';
import { recordLinkRoutesPlugin } from './record-link.routes.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SOURCE_ID = '550e8400-e29b-41d4-a716-446655440000';
const TARGET_ID = '660e8400-e29b-41d4-a716-446655440000';
const LINK_ID = '770e8400-e29b-41d4-a716-446655440000';

function fakeLink(overrides: Record<string, unknown> = {}) {
  return {
    id: LINK_ID,
    sourceEntityType: 'Customer',
    sourceEntityId: SOURCE_ID,
    targetEntityType: 'SalesOrder',
    targetEntityId: TARGET_ID,
    linkType: 'RELATES_TO' as RecordLinkType,
    isSystemGenerated: false,
    description: null as string | null,
    createdBy: 'user-001',
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
// POST /record-links
// ---------------------------------------------------------------------------

describe('POST /record-links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validBody = {
    sourceEntityType: 'Customer',
    sourceEntityId: SOURCE_ID,
    targetEntityType: 'SalesOrder',
    targetEntityId: TARGET_ID,
    linkType: 'RELATES_TO',
  };

  it('returns 201 with link record (RELATES_TO) and calls service with correct args', async () => {
    const created = fakeLink();
    vi.mocked(createRecordLink).mockResolvedValue(created);

    const app = buildTestApp('STAFF');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/record-links',
      payload: validBody,
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('id', LINK_ID);
    expect(body.data).toHaveProperty('linkType', 'RELATES_TO');

    // Verify service was called with correctly parsed body and context
    expect(createRecordLink).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-001',
        companyId: 'company-001',
        tenantId: 'tenant-001',
      }),
      expect.anything(),
      expect.objectContaining({
        sourceEntityType: 'Customer',
        sourceEntityId: SOURCE_ID,
        targetEntityType: 'SalesOrder',
        targetEntityId: TARGET_ID,
        linkType: 'RELATES_TO',
      }),
    );

    await app.close();
  });

  it('returns 201 with CREATED_FROM linkType', async () => {
    const created = fakeLink({ linkType: 'CREATED_FROM' });
    vi.mocked(createRecordLink).mockResolvedValue(created);

    const app = buildTestApp('STAFF');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/record-links',
      payload: { ...validBody, linkType: 'CREATED_FROM' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<SuccessResponse>();
    expect(body.data).toHaveProperty('linkType', 'CREATED_FROM');

    await app.close();
  });

  it('returns 201 with FULFILLS linkType', async () => {
    const created = fakeLink({ linkType: 'FULFILLS' });
    vi.mocked(createRecordLink).mockResolvedValue(created);

    const app = buildTestApp('STAFF');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/record-links',
      payload: { ...validBody, linkType: 'FULFILLS' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<SuccessResponse>();
    expect(body.data).toHaveProperty('linkType', 'FULFILLS');

    await app.close();
  });

  it('returns 201 with PAYMENT_FOR linkType', async () => {
    const created = fakeLink({ linkType: 'PAYMENT_FOR' });
    vi.mocked(createRecordLink).mockResolvedValue(created);

    const app = buildTestApp('STAFF');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/record-links',
      payload: { ...validBody, linkType: 'PAYMENT_FOR' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<SuccessResponse>();
    expect(body.data).toHaveProperty('linkType', 'PAYMENT_FOR');

    await app.close();
  });

  it('returns 201 with CREDIT_FOR linkType', async () => {
    const created = fakeLink({ linkType: 'CREDIT_FOR' });
    vi.mocked(createRecordLink).mockResolvedValue(created);

    const app = buildTestApp('STAFF');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/record-links',
      payload: { ...validBody, linkType: 'CREDIT_FOR' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<SuccessResponse>();
    expect(body.data).toHaveProperty('linkType', 'CREDIT_FOR');

    await app.close();
  });

  it('returns 201 with PARENT_CHILD linkType', async () => {
    const created = fakeLink({ linkType: 'PARENT_CHILD' });
    vi.mocked(createRecordLink).mockResolvedValue(created);

    const app = buildTestApp('STAFF');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/record-links',
      payload: { ...validBody, linkType: 'PARENT_CHILD' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<SuccessResponse>();
    expect(body.data).toHaveProperty('linkType', 'PARENT_CHILD');

    await app.close();
  });

  it('returns 400 when service rejects invalid sourceEntityType', async () => {
    vi.mocked(createRecordLink).mockRejectedValue(
      new AppError('INVALID_ENTITY_TYPE', 'Invalid source entity type: FakeType', 400),
    );

    const app = buildTestApp('STAFF');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/record-links',
      payload: { ...validBody, sourceEntityType: 'FakeType' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_ENTITY_TYPE');

    await app.close();
  });

  it('returns 400 when service rejects invalid targetEntityType', async () => {
    vi.mocked(createRecordLink).mockRejectedValue(
      new AppError('INVALID_ENTITY_TYPE', 'Invalid target entity type: FakeTarget', 400),
    );

    const app = buildTestApp('STAFF');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/record-links',
      payload: { ...validBody, targetEntityType: 'FakeTarget' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_ENTITY_TYPE');

    await app.close();
  });

  it('returns 404 when source entity does not exist', async () => {
    vi.mocked(createRecordLink).mockRejectedValue(
      new NotFoundError('ENTITY_NOT_FOUND', 'Source entity not found'),
    );

    const app = buildTestApp('STAFF');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/record-links',
      payload: validBody,
    });

    expect(res.statusCode).toBe(404);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('ENTITY_NOT_FOUND');

    await app.close();
  });

  it('returns 404 when target entity does not exist', async () => {
    vi.mocked(createRecordLink).mockRejectedValue(
      new NotFoundError('ENTITY_NOT_FOUND', 'Target entity not found'),
    );

    const app = buildTestApp('STAFF');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/record-links',
      payload: validBody,
    });

    expect(res.statusCode).toBe(404);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('ENTITY_NOT_FOUND');

    await app.close();
  });

  it('returns 409 when duplicate link exists', async () => {
    vi.mocked(createRecordLink).mockRejectedValue(
      new AppError(
        'DUPLICATE_RECORD_LINK',
        'A link with the same source, target, and type already exists',
        409,
        undefined,
        'errors.recordLink.duplicateLink',
      ),
    );

    const app = buildTestApp('STAFF');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/record-links',
      payload: validBody,
    });

    expect(res.statusCode).toBe(409);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('DUPLICATE_RECORD_LINK');

    await app.close();
  });

  it('returns 400 for missing required fields (Zod validation)', async () => {
    const app = buildTestApp('STAFF');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/record-links',
      payload: { sourceEntityType: 'Customer' }, // missing many fields
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);

    await app.close();
  });

  it('returns 400 for invalid linkType', async () => {
    const app = buildTestApp('STAFF');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/record-links',
      payload: { ...validBody, linkType: 'INVALID_TYPE' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);

    await app.close();
  });

  it('returns 400 for non-UUID sourceEntityId', async () => {
    const app = buildTestApp('STAFF');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/record-links',
      payload: { ...validBody, sourceEntityId: 'not-a-uuid' },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);

    await app.close();
  });

  it('returns 400 for self-linking (same source and target)', async () => {
    vi.mocked(createRecordLink).mockRejectedValue(
      new AppError('SELF_LINK_NOT_ALLOWED', 'Cannot create a link from an entity to itself', 400),
    );

    const app = buildTestApp('STAFF');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/record-links',
      payload: {
        ...validBody,
        targetEntityType: validBody.sourceEntityType,
        targetEntityId: validBody.sourceEntityId,
      },
    });

    expect(res.statusCode).toBe(400);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('SELF_LINK_NOT_ALLOWED');

    await app.close();
  });

  it('returns 403 when user role is VIEWER (below STAFF)', async () => {
    const app = buildTestApp('VIEWER');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: '/record-links',
      payload: validBody,
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// GET /record-links
// ---------------------------------------------------------------------------

describe('GET /record-links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 with bidirectional list and direction indicators', async () => {
    const outgoingLink = fakeLink();
    const incomingLink = fakeLink({
      id: 'link-incoming',
      sourceEntityType: 'SalesOrder',
      sourceEntityId: TARGET_ID,
      targetEntityType: 'Customer',
      targetEntityId: SOURCE_ID,
      linkType: 'FULFILLS',
      direction: 'incoming',
    });
    const fakeResult = {
      items: [
        { ...outgoingLink, direction: 'outgoing' as const },
        { ...incomingLink, direction: 'incoming' as const },
      ],
      total: 2,
    };
    vi.mocked(listRecordLinks).mockResolvedValue(fakeResult);

    const app = buildTestApp('VIEWER');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: `/record-links?entityType=Customer&entityId=${SOURCE_ID}`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('items');
    expect(body.data).toHaveProperty('total', 2);

    await app.close();
  });

  it('returns 200 with filtered list when linkType specified', async () => {
    const fakeResult = {
      items: [{ ...fakeLink({ linkType: 'FULFILLS' }), direction: 'outgoing' as const }],
      total: 1,
    };
    vi.mocked(listRecordLinks).mockResolvedValue(fakeResult);

    const app = buildTestApp('VIEWER');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: `/record-links?entityType=Customer&entityId=${SOURCE_ID}&linkType=FULFILLS`,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<SuccessResponse>();
    expect(body.success).toBe(true);

    // Verify service was called with linkType filter
    expect(listRecordLinks).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ linkType: 'FULFILLS' }),
    );

    await app.close();
  });

  it('returns 200 with outgoing-only links when direction=outgoing', async () => {
    const fakeResult = { items: [{ ...fakeLink(), direction: 'outgoing' as const }], total: 1 };
    vi.mocked(listRecordLinks).mockResolvedValue(fakeResult);

    const app = buildTestApp('VIEWER');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: `/record-links?entityType=Customer&entityId=${SOURCE_ID}&direction=outgoing`,
    });

    expect(res.statusCode).toBe(200);

    expect(listRecordLinks).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ direction: 'outgoing' }),
    );

    await app.close();
  });

  it('returns 200 with incoming-only links when direction=incoming', async () => {
    const fakeResult = { items: [{ ...fakeLink(), direction: 'incoming' as const }], total: 1 };
    vi.mocked(listRecordLinks).mockResolvedValue(fakeResult);

    const app = buildTestApp('VIEWER');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: `/record-links?entityType=Customer&entityId=${SOURCE_ID}&direction=incoming`,
    });

    expect(res.statusCode).toBe(200);

    expect(listRecordLinks).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ direction: 'incoming' }),
    );

    await app.close();
  });

  it('returns 400 for missing required query params', async () => {
    const app = buildTestApp('VIEWER');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/record-links',
    });

    expect(res.statusCode).toBe(400);

    await app.close();
  });

  it('returns 400 for invalid entityId (not UUID)', async () => {
    const app = buildTestApp('VIEWER');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'GET',
      url: '/record-links?entityType=Customer&entityId=not-a-uuid',
    });

    expect(res.statusCode).toBe(400);

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// DELETE /record-links/:id
// ---------------------------------------------------------------------------

describe('DELETE /record-links/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 204 when STAFF deletes manual link (AC #5)', async () => {
    vi.mocked(deleteRecordLink).mockResolvedValue(undefined);

    const app = buildTestApp('STAFF');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'DELETE',
      url: `/record-links/${LINK_ID}`,
    });

    expect(res.statusCode).toBe(204);

    await app.close();
  });

  it('returns 403 when STAFF tries to delete system-generated link (AC #6)', async () => {
    vi.mocked(deleteRecordLink).mockRejectedValue(
      new AppError(
        'FORBIDDEN',
        'Only managers can delete system-generated links',
        403,
        undefined,
        'errors.recordLink.systemLinkDeleteForbidden',
      ),
    );

    const app = buildTestApp('STAFF');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'DELETE',
      url: `/record-links/${LINK_ID}`,
    });

    expect(res.statusCode).toBe(403);
    const body = res.json<ErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');

    await app.close();
  });

  it('returns 204 when MANAGER deletes system-generated link (AC #6)', async () => {
    vi.mocked(deleteRecordLink).mockResolvedValue(undefined);

    const app = buildTestApp('MANAGER');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'DELETE',
      url: `/record-links/${LINK_ID}`,
    });

    expect(res.statusCode).toBe(204);

    await app.close();
  });

  it('returns 404 when link does not exist', async () => {
    vi.mocked(deleteRecordLink).mockRejectedValue(
      new NotFoundError('RECORD_LINK_NOT_FOUND', 'Record link not found'),
    );

    const app = buildTestApp('STAFF');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'DELETE',
      url: `/record-links/${LINK_ID}`,
    });

    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it('returns 403 when user role is VIEWER (below STAFF)', async () => {
    const app = buildTestApp('VIEWER');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'DELETE',
      url: `/record-links/${LINK_ID}`,
    });

    expect(res.statusCode).toBe(403);

    await app.close();
  });

  it('returns 400 for non-UUID id param', async () => {
    const app = buildTestApp('STAFF');
    await app.register(recordLinkRoutesPlugin);
    await app.ready();

    const res = await app.inject({
      method: 'DELETE',
      url: '/record-links/not-a-uuid',
    });

    expect(res.statusCode).toBe(400);

    await app.close();
  });
});
