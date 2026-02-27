import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted ensures variables exist when vi.mock is hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockResolveUserRole, mockPermissionService } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    companyProfile: { findUnique: vi.fn() },
    dataView: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    dataViewField: {
      findMany: vi.fn(),
    },
    dateRangePreset: { findMany: vi.fn() },
    savedView: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    savedViewCondition: { deleteMany: vi.fn() },
    userColumnPreference: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
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
  UserRole: {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    VIEWER: 'VIEWER',
  },
  FieldVisibility: {
    VISIBLE: 'VISIBLE',
    READ_ONLY: 'READ_ONLY',
    HIDDEN: 'HIDDEN',
  },
  FilterOperator: [
    'EQUALS',
    'NOT_EQUALS',
    'CONTAINS',
    'STARTS_WITH',
    'ENDS_WITH',
    'GT',
    'GTE',
    'LT',
    'LTE',
    'BETWEEN',
    'IN',
    'NOT_IN',
    'IS_EMPTY',
    'IS_NOT_EMPTY',
  ],
  ViewScope: ['PERSONAL', 'ROLE', 'GLOBAL'],
  PinPosition: ['NONE', 'LEFT', 'RIGHT'],
  FieldDataType: ['STRING', 'NUMBER', 'DATE', 'BOOLEAN', 'ENUM', 'CURRENCY'],
  LovType: ['NONE', 'STATIC', 'GLOBAL', 'VIEW_SPECIFIC'],
}));

vi.mock('../../core/rbac/permission.service.js', () => ({
  permissionService: mockPermissionService,
  PermissionService: vi.fn(),
  ACTION_FLAG_MAP: { new: 'canNew', view: 'canView', edit: 'canEdit', delete: 'canDelete' },
}));

// Mock ioredis for ViewsService
const mockRedis = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
}));

vi.mock('ioredis', () => ({
  default: vi.fn(() => mockRedis),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { jwtVerifyPlugin } from '../../core/auth/jwt-verify.hook.js';
import { companyContextPlugin } from '../../core/middleware/company-context.js';
import { registerErrorHandler } from '../../core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from '../../core/validation/index.js';
import { eventBusPlugin } from '../../core/events/event-bus.plugin.js';
import { viewRoutesPlugin } from './views.routes.js';
import {
  makeTestJwt,
  authHeaders,
  TEST_JWT_SECRET,
  TEST_USER_ID,
  TEST_COMPANY_ID,
} from '../../test-utils/jwt.js';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const now = new Date('2026-01-01');
const DATAVIEW_ID = 'dddddddd-0000-4000-a000-000000000001';
const FIELD_ID_1 = 'ffffffff-0000-4000-a000-000000000001';
const FIELD_ID_2 = 'ffffffff-0000-4000-a000-000000000002';
const SAVED_VIEW_ID = 'aabbccdd-0000-4000-a000-000000000001';
const OTHER_USER_ID = '22222222-2222-4000-a000-222222222222';

function sampleDataView(overrides: Record<string, unknown> = {}) {
  return {
    id: DATAVIEW_ID,
    companyId: TEST_COMPANY_ID,
    viewKey: 'USERS',
    viewName: 'Users',
    entityTable: 'User',
    idField: 'id',
    defaultSortField: 'createdAt',
    defaultSortDir: 'DESC',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function sampleFields() {
  return [
    {
      id: FIELD_ID_1,
      dataViewId: DATAVIEW_ID,
      fieldKey: 'email',
      fieldLabel: 'Email',
      fieldType: 'STRING',
      defaultVisible: true,
      defaultOrder: 1,
      defaultWidth: 250,
      sortable: true,
      filterable: true,
      advancedFilterOnly: false,
      pinnable: true,
      lovType: 'NONE',
      lovScope: null,
      lovStaticValues: null,
      lovDependsOn: null,
      lovSearchMin: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: FIELD_ID_2,
      dataViewId: DATAVIEW_ID,
      fieldKey: 'firstName',
      fieldLabel: 'First Name',
      fieldType: 'STRING',
      defaultVisible: true,
      defaultOrder: 2,
      defaultWidth: 150,
      sortable: true,
      filterable: true,
      advancedFilterOnly: false,
      pinnable: true,
      lovType: 'NONE',
      lovScope: null,
      lovStaticValues: null,
      lovDependsOn: null,
      lovSearchMin: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function sampleSavedView(overrides: Record<string, unknown> = {}) {
  return {
    id: SAVED_VIEW_ID,
    companyId: TEST_COMPANY_ID,
    dataViewId: DATAVIEW_ID,
    name: 'My View',
    groupName: 'General',
    scope: 'PERSONAL',
    roleId: null,
    createdBy: TEST_USER_ID,
    isFavourite: false,
    favouriteOrder: 0,
    isDefault: false,
    filterLogic: 'AND',
    sortConfig: [{ field: 'createdAt', direction: 'DESC', priority: 1 }],
    columnConfig: [],
    createdAt: now,
    updatedAt: now,
    conditions: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(zodValidatorCompiler);
  app.setSerializerCompiler(zodSerializerCompiler);
  registerErrorHandler(app);
  await app.register(eventBusPlugin);
  await app.register(jwtVerifyPlugin);
  await app.register(companyContextPlugin);

  // Decorate fastify with redis mock (ViewsService needs it)
  app.decorate('redis', mockRedis);

  await app.register(viewRoutesPlugin, { prefix: '/views' });
  await app.ready();
  return app;
}

function setupMocks(config: { role?: string } = {}) {
  const resolvedRole = config.role ?? 'ADMIN';

  mockPrisma.user.findUnique.mockImplementation((args: { where: { id: string } }) => {
    if (args.where.id === TEST_USER_ID) {
      return Promise.resolve({ companyId: TEST_COMPANY_ID, isActive: true });
    }
    return Promise.resolve(null);
  });

  mockPrisma.companyProfile.findUnique.mockResolvedValue({ isActive: true });
  mockResolveUserRole.mockResolvedValue(resolvedRole);

  const fullPerm = { canAccess: true, canNew: true, canView: true, canEdit: true, canDelete: true };

  if (resolvedRole === 'SUPER_ADMIN') {
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: { 'views.list': fullPerm },
      fieldOverrides: {},
      accessGroups: [{ id: 'ag-1', code: 'FULL_ACCESS', name: 'Full Access' }],
      role: 'SUPER_ADMIN',
      isSuperAdmin: true,
      enabledModules: ['system'],
    });
  } else if (['ADMIN', 'MANAGER', 'STAFF'].includes(resolvedRole)) {
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: { 'views.list': fullPerm },
      fieldOverrides: {},
      accessGroups: [{ id: 'ag-1', code: 'FULL_ACCESS', name: 'Full Access' }],
      role: resolvedRole,
      isSuperAdmin: false,
      enabledModules: ['system'],
    });
  } else {
    // VIEWER — view-only permissions
    const viewPerm = {
      canAccess: true,
      canNew: false,
      canView: true,
      canEdit: false,
      canDelete: false,
    };
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      permissions: { 'views.list': viewPerm },
      fieldOverrides: {},
      accessGroups: [],
      role: resolvedRole,
      isSuperAdmin: false,
      enabledModules: ['system'],
    });
  }
}

function setupDataViewMock() {
  const fields = sampleFields();
  const dataView = { ...sampleDataView(), fields };

  // Mock for repo.getDataViewWithFields (uses findFirst)
  mockPrisma.dataView.findFirst.mockResolvedValue(dataView);
  // Mock for the list endpoint
  mockPrisma.dataView.findMany.mockResolvedValue([sampleDataView()]);

  return { dataView, fields };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let testJwt: string;

beforeAll(async () => {
  vi.stubEnv('JWT_SECRET', TEST_JWT_SECRET);
  testJwt = await makeTestJwt();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockPrisma),
  );
  // Default: redis cache miss
  mockRedis.get.mockResolvedValue(null);
  mockRedis.set.mockResolvedValue('OK');
});

// ---------------------------------------------------------------------------
// GET /views/init — Bundled init (AC: #3)
// ---------------------------------------------------------------------------

describe('GET /views/init', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('returns bundled response with viewKey=USERS (AC: #3) — 200', async () => {
    setupMocks({ role: 'ADMIN' });
    const { fields } = setupDataViewMock();

    mockPrisma.dateRangePreset.findMany.mockResolvedValue([
      {
        id: 'p1',
        companyId: TEST_COMPANY_ID,
        presetKey: 'today',
        presetName: 'Today',
        orderInList: 1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    mockPrisma.savedView.findMany.mockResolvedValue([]);
    mockPrisma.userColumnPreference.findMany.mockResolvedValue([]);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/views/init?viewKey=USERS',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.dataView.viewKey).toBe('USERS');
    expect(body.data.fields).toHaveLength(fields.length);
    expect(body.data.datePresets).toHaveLength(1);
    expect(body.data.savedViews).toEqual([]);
    expect(body.data.userColumnPreferences).toBeNull();
  });

  it('returns 400 when viewKey is missing', async () => {
    setupMocks({ role: 'ADMIN' });
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/views/init',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when viewKey does not exist', async () => {
    setupMocks({ role: 'ADMIN' });
    mockPrisma.dataView.findFirst.mockResolvedValue(null);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/views/init?viewKey=UNKNOWN',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VIEW_NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// POST /views/saved — Create saved view (AC: #4)
// ---------------------------------------------------------------------------

describe('POST /views/saved', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('creates PERSONAL saved view — 201', async () => {
    setupMocks({ role: 'STAFF' });
    setupDataViewMock();
    mockPrisma.savedView.create.mockResolvedValue(sampleSavedView());

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/views/saved',
      headers: authHeaders(testJwt),
      payload: {
        viewKey: 'USERS',
        name: 'My View',
        groupName: 'General',
        scope: 'PERSONAL',
        filterLogic: 'AND',
        sortConfig: [{ field: 'createdAt', direction: 'DESC', priority: 1 }],
        columnConfig: [],
        conditions: [],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('My View');
    expect(body.data.scope).toBe('PERSONAL');
  });

  it('returns 403 when non-admin creates GLOBAL view (AC: #4)', async () => {
    setupMocks({ role: 'STAFF' });
    setupDataViewMock();

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/views/saved',
      headers: authHeaders(testJwt),
      payload: {
        viewKey: 'USERS',
        name: 'Global View',
        groupName: 'Shared',
        scope: 'GLOBAL',
        filterLogic: 'AND',
        sortConfig: [],
        columnConfig: [],
        conditions: [],
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VIEW_SCOPE_FORBIDDEN');
  });

  it('allows ADMIN to create GLOBAL view — 201', async () => {
    setupMocks({ role: 'ADMIN' });
    setupDataViewMock();
    mockPrisma.savedView.create.mockResolvedValue(sampleSavedView({ scope: 'GLOBAL' }));

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/views/saved',
      headers: authHeaders(testJwt),
      payload: {
        viewKey: 'USERS',
        name: 'Global View',
        groupName: 'Shared',
        scope: 'GLOBAL',
        filterLogic: 'AND',
        sortConfig: [],
        columnConfig: [],
        conditions: [],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.scope).toBe('GLOBAL');
  });
});

// ---------------------------------------------------------------------------
// DELETE /views/saved/:id — Delete saved view
// ---------------------------------------------------------------------------

describe('DELETE /views/saved/:id', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('owner deletes own view — 204', async () => {
    setupMocks({ role: 'STAFF' });
    mockPrisma.savedView.findFirst.mockResolvedValue(sampleSavedView({ createdBy: TEST_USER_ID }));
    mockPrisma.savedView.delete.mockResolvedValue({});

    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/views/saved/${SAVED_VIEW_ID}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(204);
  });

  it('non-owner non-admin returns 403', async () => {
    setupMocks({ role: 'STAFF' });
    mockPrisma.savedView.findFirst.mockResolvedValue(sampleSavedView({ createdBy: OTHER_USER_ID }));

    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/views/saved/${SAVED_VIEW_ID}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VIEW_SCOPE_FORBIDDEN');
  });

  it('admin deletes any view — 204', async () => {
    setupMocks({ role: 'ADMIN' });
    mockPrisma.savedView.findFirst.mockResolvedValue(sampleSavedView({ createdBy: OTHER_USER_ID }));
    mockPrisma.savedView.delete.mockResolvedValue({});

    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/views/saved/${SAVED_VIEW_ID}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(204);
  });
});

// ---------------------------------------------------------------------------
// PATCH /views/columns/:viewKey/:fieldId/width — Update width (AC: #7)
// ---------------------------------------------------------------------------

describe('PATCH /views/columns/:viewKey/:fieldId/width', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('persists column width — 200', async () => {
    setupMocks({ role: 'STAFF' });
    setupDataViewMock();
    mockPrisma.userColumnPreference.upsert.mockResolvedValue({});

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/views/columns/USERS/${FIELD_ID_1}/width`,
      headers: authHeaders(testJwt),
      payload: { width: 200 },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    // Verify upsert was called with correct params
    expect(mockPrisma.userColumnPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_dataViewFieldId: {
            userId: TEST_USER_ID,
            dataViewFieldId: FIELD_ID_1,
          },
        },
        update: { width: 200 },
      }),
    );
  });

  it('returns 400 for invalid width (too small)', async () => {
    setupMocks({ role: 'STAFF' });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/views/columns/USERS/${FIELD_ID_1}/width`,
      headers: authHeaders(testJwt),
      payload: { width: 10 },
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for invalid width (too large)', async () => {
    setupMocks({ role: 'STAFF' });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/views/columns/USERS/${FIELD_ID_1}/width`,
      headers: authHeaders(testJwt),
      payload: { width: 1000 },
    });

    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /views/lov/batch — Batch LOV fetch (AC: #6)
// ---------------------------------------------------------------------------

describe('POST /views/lov/batch', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('returns keyed results — 200', async () => {
    setupMocks({ role: 'STAFF' });

    // Mock field metadata lookup for LOV service
    mockPrisma.dataViewField.findMany.mockResolvedValue([
      {
        id: FIELD_ID_1,
        lovType: 'STATIC',
        lovScope: null,
        lovStaticValues: [{ value: 'A', label: 'Alpha' }],
        lovDependsOn: null,
        lovSearchMin: 0,
      },
    ]);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/views/lov/batch',
      headers: authHeaders(testJwt),
      payload: {
        items: [{ fieldId: FIELD_ID_1, lovScope: 'currencies' }],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.results).toBeDefined();
    // STATIC type returns empty (client-side only)
    expect(body.data.results[FIELD_ID_1]).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// VIEWER can read but not write
// ---------------------------------------------------------------------------

describe('VIEWER permissions', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('VIEWER can GET /views/data-views — 200', async () => {
    setupMocks({ role: 'VIEWER' });
    mockPrisma.dataView.findMany.mockResolvedValue([]);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/views/data-views',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
  });

  it('VIEWER cannot POST /views/saved — 403', async () => {
    setupMocks({ role: 'VIEWER' });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/views/saved',
      headers: authHeaders(testJwt),
      payload: {
        viewKey: 'USERS',
        name: 'My View',
        groupName: 'General',
        scope: 'PERSONAL',
        filterLogic: 'AND',
        sortConfig: [],
        columnConfig: [],
        conditions: [],
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('VIEWER cannot DELETE /views/saved/:id — 403', async () => {
    setupMocks({ role: 'VIEWER' });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/views/saved/${SAVED_VIEW_ID}`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('VIEWER cannot PATCH column width — 403', async () => {
    setupMocks({ role: 'VIEWER' });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/views/columns/USERS/${FIELD_ID_1}/width`,
      headers: authHeaders(testJwt),
      payload: { width: 200 },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// Unauthenticated — 401
// ---------------------------------------------------------------------------

describe('Unauthenticated requests get 401', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('GET /views/init — 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/views/init?viewKey=USERS',
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('POST /views/saved — 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/views/saved',
      payload: {
        viewKey: 'USERS',
        name: 'Test',
        groupName: 'G',
        scope: 'PERSONAL',
        filterLogic: 'AND',
        sortConfig: [],
        columnConfig: [],
        conditions: [],
      },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('DELETE /views/saved/:id — 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'DELETE',
      url: `/views/saved/${SAVED_VIEW_ID}`,
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('PATCH /views/columns/:viewKey/:fieldId/width — 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/views/columns/USERS/${FIELD_ID_1}/width`,
      payload: { width: 200 },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('POST /views/lov/batch — 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: '/views/lov/batch',
      payload: { items: [{ fieldId: FIELD_ID_1, lovScope: 'currencies' }] },
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('GET /views/data-views — 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/views/data-views',
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });

  it('GET /views/favourites — 401 without auth', async () => {
    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/views/favourites',
    });

    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('UNAUTHORIZED');
  });
});

// ---------------------------------------------------------------------------
// GET /views/date-presets
// ---------------------------------------------------------------------------

describe('GET /views/date-presets', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('returns date presets — 200', async () => {
    setupMocks({ role: 'ADMIN' });
    const presets = [
      {
        id: 'p1',
        companyId: TEST_COMPANY_ID,
        presetKey: 'today',
        presetName: 'Today',
        orderInList: 1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'p2',
        companyId: TEST_COMPANY_ID,
        presetKey: 'yesterday',
        presetName: 'Yesterday',
        orderInList: 2,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ];
    mockPrisma.dateRangePreset.findMany.mockResolvedValue(presets);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/views/date-presets',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// POST /views/saved/:id/toggle-favourite
// ---------------------------------------------------------------------------

describe('POST /views/saved/:id/toggle-favourite', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('toggles favourite — 200', async () => {
    setupMocks({ role: 'STAFF' });
    mockPrisma.savedView.findFirst.mockResolvedValue(sampleSavedView({ isFavourite: false }));
    mockPrisma.savedView.update.mockResolvedValue({});

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/views/saved/${SAVED_VIEW_ID}/toggle-favourite`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);

    // Verify favourite was toggled to true (was false)
    expect(mockPrisma.savedView.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SAVED_VIEW_ID, companyId: TEST_COMPANY_ID },
        data: { isFavourite: true },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// POST /views/saved/:id/set-default
// ---------------------------------------------------------------------------

describe('POST /views/saved/:id/set-default', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('sets default — 200', async () => {
    setupMocks({ role: 'STAFF' });
    mockPrisma.savedView.findFirst.mockResolvedValue(sampleSavedView());
    mockPrisma.savedView.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.savedView.update.mockResolvedValue({});

    app = await buildTestApp();

    const res = await app.inject({
      method: 'POST',
      url: `/views/saved/${SAVED_VIEW_ID}/set-default`,
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PATCH /views/saved/:id — Update saved view
// ---------------------------------------------------------------------------

describe('PATCH /views/saved/:id', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('owner updates own view — 200', async () => {
    setupMocks({ role: 'STAFF' });
    setupDataViewMock();
    mockPrisma.savedView.findFirst.mockResolvedValue(sampleSavedView({ createdBy: TEST_USER_ID }));
    mockPrisma.savedView.update.mockResolvedValue(sampleSavedView({ name: 'Renamed View' }));

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/views/saved/${SAVED_VIEW_ID}`,
      headers: authHeaders(testJwt),
      payload: { name: 'Renamed View' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Renamed View');
  });

  it('non-owner non-admin returns 403', async () => {
    setupMocks({ role: 'STAFF' });
    mockPrisma.savedView.findFirst.mockResolvedValue(sampleSavedView({ createdBy: OTHER_USER_ID }));

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/views/saved/${SAVED_VIEW_ID}`,
      headers: authHeaders(testJwt),
      payload: { name: 'Renamed View' },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VIEW_SCOPE_FORBIDDEN');
  });

  it('returns 404 when view not found', async () => {
    setupMocks({ role: 'STAFF' });
    mockPrisma.savedView.findFirst.mockResolvedValue(null);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PATCH',
      url: `/views/saved/${SAVED_VIEW_ID}`,
      headers: authHeaders(testJwt),
      payload: { name: 'Renamed View' },
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /views/saved — List saved views
// ---------------------------------------------------------------------------

describe('GET /views/saved', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('returns saved views for viewKey — 200', async () => {
    setupMocks({ role: 'STAFF' });
    setupDataViewMock();
    mockPrisma.savedView.findMany.mockResolvedValue([sampleSavedView()]);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/views/saved?viewKey=USERS',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it('returns 400 when viewKey is missing', async () => {
    setupMocks({ role: 'STAFF' });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/views/saved',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /views/columns/:viewKey — Get column preferences
// ---------------------------------------------------------------------------

describe('GET /views/columns/:viewKey', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('returns column preferences — 200', async () => {
    setupMocks({ role: 'STAFF' });
    setupDataViewMock();
    mockPrisma.userColumnPreference.findMany.mockResolvedValue([
      {
        id: 'cp-1',
        userId: TEST_USER_ID,
        dataViewFieldId: FIELD_ID_1,
        visible: true,
        displayOrder: 1,
        width: 200,
        pinned: 'NONE',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/views/columns/USERS',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it('returns 404 when viewKey not found', async () => {
    setupMocks({ role: 'STAFF' });
    mockPrisma.dataView.findFirst.mockResolvedValue(null);

    app = await buildTestApp();

    const res = await app.inject({
      method: 'GET',
      url: '/views/columns/UNKNOWN',
      headers: authHeaders(testJwt),
    });

    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PUT /views/columns/:viewKey — Bulk upsert column prefs
// ---------------------------------------------------------------------------

describe('PUT /views/columns/:viewKey', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it('upserts column preferences — 200', async () => {
    setupMocks({ role: 'STAFF' });
    setupDataViewMock();
    mockPrisma.userColumnPreference.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.userColumnPreference.createMany.mockResolvedValue({ count: 1 });

    app = await buildTestApp();

    const res = await app.inject({
      method: 'PUT',
      url: '/views/columns/USERS',
      headers: authHeaders(testJwt),
      payload: [
        { dataViewFieldId: FIELD_ID_1, visible: true, displayOrder: 1, width: 200, pinned: 'NONE' },
      ],
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Performance tests (AC: #3, #7)
// Note: These are placeholder tests. Real performance testing requires
// integration tests against actual DB/Redis, not mocked unit tests.
// ---------------------------------------------------------------------------

describe('Performance: GET /views/init (AC: #3)', () => {
  it.todo('responds within 100ms (requires integration test with real DB/Redis)');
});

describe('Performance: PATCH /views/columns/:viewKey/:fieldId/width (AC: #7)', () => {
  it.todo('responds within 50ms (requires integration test with real DB/Redis)');
});
