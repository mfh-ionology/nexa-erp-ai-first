import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @nexa/db
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    resource: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@nexa/db', () => ({
  prisma: mockPrisma,
  ResourceType: {
    PAGE: 'PAGE',
    REPORT: 'REPORT',
    SETTING: 'SETTING',
    MAINTENANCE: 'MAINTENANCE',
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { listResources } from './resources.service.js';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const now = new Date();

function sampleResource(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-a000-000000000001',
    code: 'system.users.list',
    name: 'User Management',
    module: 'system',
    type: 'PAGE',
    parentCode: null,
    sortOrder: 100,
    icon: null,
    description: 'User list view',
    isActive: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const allResources = [
  sampleResource(),
  sampleResource({
    id: '00000000-0000-4000-a000-000000000002',
    code: 'system.users.detail',
    name: 'User Detail',
    parentCode: 'system.users.list',
    sortOrder: 101,
    description: 'User detail view',
  }),
  sampleResource({
    id: '00000000-0000-4000-a000-000000000003',
    code: 'system.company-profile.detail',
    name: 'Company Profile',
    type: 'SETTING',
    sortOrder: 200,
    description: 'Company profile settings',
  }),
  sampleResource({
    id: '00000000-0000-4000-a000-000000000004',
    code: 'system.resources.list',
    name: 'Resource Registry',
    sortOrder: 300,
    description: 'Resource registry list',
  }),
];

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('listResources', () => {
  it('returns all active resources when no filters', async () => {
    mockPrisma.resource.findMany.mockResolvedValue(allResources);
    mockPrisma.resource.count.mockResolvedValue(allResources.length);

    const result = await listResources(mockPrisma as never, { isActive: true, limit: 100 });

    expect(result.data).toHaveLength(4);
    expect(result.meta.total).toBe(4);
    expect(mockPrisma.resource.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      take: 101,
      orderBy: [{ module: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
    });
  });

  it('filters by module', async () => {
    const systemResources = allResources.filter((r) => r.module === 'system');
    mockPrisma.resource.findMany.mockResolvedValue(systemResources);
    mockPrisma.resource.count.mockResolvedValue(systemResources.length);

    const result = await listResources(mockPrisma as never, {
      module: 'system',
      isActive: true,
      limit: 100,
    });

    expect(result.data).toHaveLength(4);
    expect(mockPrisma.resource.findMany).toHaveBeenCalledWith({
      where: { module: 'system', isActive: true },
      take: 101,
      orderBy: [{ module: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
    });
  });

  it('filters by type', async () => {
    const pages = allResources.filter((r) => r.type === 'PAGE');
    mockPrisma.resource.findMany.mockResolvedValue(pages);
    mockPrisma.resource.count.mockResolvedValue(pages.length);

    const result = await listResources(mockPrisma as never, {
      type: 'PAGE',
      isActive: true,
      limit: 100,
    });

    expect(result.data).toHaveLength(3);
    expect(mockPrisma.resource.findMany).toHaveBeenCalledWith({
      where: { type: 'PAGE', isActive: true },
      take: 101,
      orderBy: [{ module: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
    });
  });

  it('search across code, name, description (case-insensitive)', async () => {
    const matched = [allResources[0]!];
    mockPrisma.resource.findMany.mockResolvedValue(matched);
    mockPrisma.resource.count.mockResolvedValue(1);

    const result = await listResources(mockPrisma as never, {
      search: 'user',
      isActive: true,
      limit: 100,
    });

    expect(result.data).toHaveLength(1);
    expect(mockPrisma.resource.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        OR: [
          { code: { contains: 'user', mode: 'insensitive' } },
          { name: { contains: 'user', mode: 'insensitive' } },
          { description: { contains: 'user', mode: 'insensitive' } },
        ],
      },
      take: 101,
      orderBy: [{ module: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
    });
  });

  it('isActive=false returns inactive resources', async () => {
    const inactive = [sampleResource({ isActive: false })];
    mockPrisma.resource.findMany.mockResolvedValue(inactive);
    mockPrisma.resource.count.mockResolvedValue(1);

    const result = await listResources(mockPrisma as never, { isActive: false, limit: 100 });

    expect(result.data).toHaveLength(1);
    expect(mockPrisma.resource.findMany).toHaveBeenCalledWith({
      where: { isActive: false },
      take: 101,
      orderBy: [{ module: 'asc' }, { sortOrder: 'asc' }, { code: 'asc' }],
    });
  });

  it('returns correct total count', async () => {
    mockPrisma.resource.findMany.mockResolvedValue(allResources);
    mockPrisma.resource.count.mockResolvedValue(42);

    const result = await listResources(mockPrisma as never, { isActive: true, limit: 100 });

    expect(result.meta.total).toBe(42);
  });

  it('cursor pagination — hasMore and nextCursor', async () => {
    // Simulate limit+1 rows → hasMore = true
    const resources = Array.from({ length: 21 }, (_, i) =>
      sampleResource({
        id: `id-${String(i).padStart(3, '0')}`,
        code: `system.resource-${i}`,
      }),
    );
    mockPrisma.resource.findMany.mockResolvedValue(resources);
    mockPrisma.resource.count.mockResolvedValue(50);

    const result = await listResources(mockPrisma as never, { isActive: true, limit: 20 });

    expect(result.data).toHaveLength(20);
    expect(result.meta.hasMore).toBe(true);
    expect(result.meta.cursor).toBe('id-019');
    expect(result.meta.total).toBe(50);
  });

  it('cursor pagination — no more results', async () => {
    mockPrisma.resource.findMany.mockResolvedValue(allResources);
    mockPrisma.resource.count.mockResolvedValue(4);

    const result = await listResources(mockPrisma as never, { isActive: true, limit: 20 });

    expect(result.data).toHaveLength(4);
    expect(result.meta.hasMore).toBe(false);
    expect(result.meta.cursor).toBeUndefined();
  });

  it('applies cursor with skip:1 when provided', async () => {
    const cursorId = '00000000-0000-4000-a000-000000000099';
    mockPrisma.resource.findMany.mockResolvedValue([]);
    mockPrisma.resource.count.mockResolvedValue(0);

    await listResources(mockPrisma as never, {
      isActive: true,
      limit: 20,
      cursor: cursorId,
    });

    expect(mockPrisma.resource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 1,
        cursor: { id: cursorId },
        take: 21,
      }),
    );
  });
});
