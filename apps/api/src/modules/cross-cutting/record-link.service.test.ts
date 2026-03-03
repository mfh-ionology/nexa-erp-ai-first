import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RequestContext } from '../../core/types/request-context.js';
import type { CreateRecordLinkInput, RecordLinkListQuery } from './record-link.schema.js';

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before imports that use them
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

vi.mock('../../core/entity-registry/index.js', () => ({
  isValidEntityType: vi.fn(),
  validateEntityExists: vi.fn(),
}));

// Import after mocks are set up
import { isValidEntityType, validateEntityExists } from '../../core/entity-registry/index.js';
import { AppError } from '../../core/errors/app-error.js';
import { NotFoundError } from '../../core/errors/not-found-error.js';
import { ValidationError } from '../../core/errors/validation-error.js';

import {
  createRecordLink,
  listRecordLinks,
  deleteRecordLink,
  createSystemLink,
} from './record-link.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SOURCE_ID = '550e8400-e29b-41d4-a716-446655440000';
const TARGET_ID = '660e8400-e29b-41d4-a716-446655440000';
const LINK_ID = '770e8400-e29b-41d4-a716-446655440000';

const staffCtx: RequestContext = {
  userId: 'user-001',
  tenantId: 'tenant-001',
  companyId: 'company-001',
  role: 'STAFF',
  enabledModules: [],
};

const managerCtx: RequestContext = {
  ...staffCtx,
  userId: 'user-002',
  role: 'MANAGER',
};

function fakeLink(overrides: Record<string, unknown> = {}) {
  return {
    id: LINK_ID,
    sourceEntityType: 'Customer',
    sourceEntityId: SOURCE_ID,
    targetEntityType: 'SalesOrder',
    targetEntityId: TARGET_ID,
    linkType: 'CREATED_FROM',
    isSystemGenerated: false,
    description: null,
    createdBy: 'user-001',
    createdAt: new Date('2026-03-03T00:00:00Z'),
    updatedAt: new Date('2026-03-03T00:00:00Z'),
    ...overrides,
  };
}

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    recordLink: {
      create: vi.fn(),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
    ...overrides,
  } as never;
}

// Convenience cast for accessing mock methods
type MockPrisma = {
  recordLink: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
};

// ---------------------------------------------------------------------------
// createRecordLink
// ---------------------------------------------------------------------------

describe('createRecordLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateEntityExists).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validInput: CreateRecordLinkInput = {
    sourceEntityType: 'Customer',
    sourceEntityId: SOURCE_ID,
    targetEntityType: 'SalesOrder',
    targetEntityId: TARGET_ID,
    linkType: 'CREATED_FROM',
  };

  it('creates link with correct fields and isSystemGenerated: false', async () => {
    const prisma = mockPrisma();
    const created = fakeLink();
    (prisma as unknown as MockPrisma).recordLink.create.mockResolvedValue(created);

    const result = await createRecordLink(staffCtx, prisma, validInput);

    expect(result).toEqual(created);
    expect((prisma as unknown as MockPrisma).recordLink.create).toHaveBeenCalledWith({
      data: {
        sourceEntityType: 'Customer',
        sourceEntityId: SOURCE_ID,
        targetEntityType: 'SalesOrder',
        targetEntityId: TARGET_ID,
        linkType: 'CREATED_FROM',
        description: null,
        isSystemGenerated: false,
        createdBy: 'user-001',
      },
    });
  });

  it('creates link with description when provided', async () => {
    const prisma = mockPrisma();
    const created = fakeLink({ description: 'Order originated from customer' });
    (prisma as unknown as MockPrisma).recordLink.create.mockResolvedValue(created);

    const input: CreateRecordLinkInput = {
      ...validInput,
      description: 'Order originated from customer',
    };
    const result = await createRecordLink(staffCtx, prisma, input);

    expect(result.description).toBe('Order originated from customer');
    expect((prisma as unknown as MockPrisma).recordLink.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ description: 'Order originated from customer' }),
      }),
    );
  });

  it('validates both source and target entities exist with companyId (BR-SYS-013)', async () => {
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.create.mockResolvedValue(fakeLink());

    await createRecordLink(staffCtx, prisma, validInput);

    expect(validateEntityExists).toHaveBeenCalledTimes(2);
    expect(validateEntityExists).toHaveBeenCalledWith(prisma, 'Customer', SOURCE_ID, 'company-001');
    expect(validateEntityExists).toHaveBeenCalledWith(
      prisma,
      'SalesOrder',
      TARGET_ID,
      'company-001',
    );
  });

  it('rejects invalid sourceEntityType via validateEntityExists (BR-SYS-014)', async () => {
    vi.mocked(validateEntityExists).mockRejectedValueOnce(
      new AppError(
        'INVALID_ENTITY_TYPE',
        'Invalid entity type: FakeType',
        400,
        undefined,
        'errors.entity.invalidType',
      ),
    );

    const prisma = mockPrisma();
    const input: CreateRecordLinkInput = { ...validInput, sourceEntityType: 'FakeType' };

    await expect(createRecordLink(staffCtx, prisma, input)).rejects.toMatchObject({
      code: 'INVALID_ENTITY_TYPE',
      statusCode: 400,
    });
  });

  it('rejects invalid targetEntityType via validateEntityExists (BR-SYS-014)', async () => {
    vi.mocked(validateEntityExists)
      .mockResolvedValueOnce(true) // source passes
      .mockRejectedValueOnce(
        new AppError(
          'INVALID_ENTITY_TYPE',
          'Invalid entity type: FakeTarget',
          400,
          undefined,
          'errors.entity.invalidType',
        ),
      );

    const prisma = mockPrisma();
    const input: CreateRecordLinkInput = { ...validInput, targetEntityType: 'FakeTarget' };

    await expect(createRecordLink(staffCtx, prisma, input)).rejects.toMatchObject({
      code: 'INVALID_ENTITY_TYPE',
      statusCode: 400,
    });
  });

  it('rejects duplicate link with 409 (AC #7)', async () => {
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.findUnique.mockResolvedValue(fakeLink());

    await expect(createRecordLink(staffCtx, prisma, validInput)).rejects.toMatchObject({
      code: 'DUPLICATE_RECORD_LINK',
      statusCode: 409,
      messageKey: 'errors.recordLink.duplicateLink',
    });
  });

  it('does not create when duplicate exists', async () => {
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.findUnique.mockResolvedValue(fakeLink());

    await expect(createRecordLink(staffCtx, prisma, validInput)).rejects.toThrow(AppError);
    expect((prisma as unknown as MockPrisma).recordLink.create).not.toHaveBeenCalled();
  });

  it('converts P2002 unique constraint error to 409 (race condition safety)', async () => {
    const prisma = mockPrisma();
    // findUnique returns null (no duplicate detected), but create fails with P2002
    const p2002Error = new Error('Unique constraint failed') as Error & { code: string };
    p2002Error.code = 'P2002';
    (prisma as unknown as MockPrisma).recordLink.create.mockRejectedValue(p2002Error);

    await expect(createRecordLink(staffCtx, prisma, validInput)).rejects.toMatchObject({
      code: 'DUPLICATE_RECORD_LINK',
      statusCode: 409,
      messageKey: 'errors.recordLink.duplicateLink',
    });
  });

  it('re-throws non-P2002 create errors as-is', async () => {
    const prisma = mockPrisma();
    const genericError = new Error('DB connection lost');
    (prisma as unknown as MockPrisma).recordLink.create.mockRejectedValue(genericError);

    await expect(createRecordLink(staffCtx, prisma, validInput)).rejects.toThrow(
      'DB connection lost',
    );
  });

  it('rejects self-linking (same source and target entity)', async () => {
    const prisma = mockPrisma();
    const selfLinkInput: CreateRecordLinkInput = {
      sourceEntityType: 'Customer',
      sourceEntityId: SOURCE_ID,
      targetEntityType: 'Customer',
      targetEntityId: SOURCE_ID,
      linkType: 'RELATES_TO',
    };

    await expect(createRecordLink(staffCtx, prisma, selfLinkInput)).rejects.toMatchObject({
      code: 'SELF_LINK_NOT_ALLOWED',
      statusCode: 400,
      messageKey: 'errors.recordLink.selfLinkNotAllowed',
    });

    // Should reject before any entity validation
    expect(validateEntityExists).not.toHaveBeenCalled();
  });

  it('allows linking same entity type with different IDs', async () => {
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.create.mockResolvedValue(
      fakeLink({ targetEntityType: 'Customer' }),
    );

    const input: CreateRecordLinkInput = {
      sourceEntityType: 'Customer',
      sourceEntityId: SOURCE_ID,
      targetEntityType: 'Customer',
      targetEntityId: TARGET_ID, // different ID
      linkType: 'PARENT_CHILD',
    };

    await expect(createRecordLink(staffCtx, prisma, input)).resolves.toBeDefined();
  });

  it('rejects reverse-direction RELATES_TO duplicate with 409', async () => {
    const prisma = mockPrisma();
    // Forward lookup returns null, but reverse lookup finds existing
    (prisma as unknown as MockPrisma).recordLink.findUnique
      .mockResolvedValueOnce(null) // forward check
      .mockResolvedValueOnce(fakeLink({ linkType: 'RELATES_TO' })); // reverse check

    const relatesToInput: CreateRecordLinkInput = {
      sourceEntityType: 'SalesOrder',
      sourceEntityId: TARGET_ID,
      targetEntityType: 'Customer',
      targetEntityId: SOURCE_ID,
      linkType: 'RELATES_TO',
    };

    await expect(createRecordLink(staffCtx, prisma, relatesToInput)).rejects.toMatchObject({
      code: 'DUPLICATE_RECORD_LINK',
      statusCode: 409,
    });
    // Should NOT create — rejected before create
    expect((prisma as unknown as MockPrisma).recordLink.create).not.toHaveBeenCalled();
  });

  it('does NOT check reverse direction for non-symmetric types (CREATED_FROM)', async () => {
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.create.mockResolvedValue(fakeLink());

    await createRecordLink(staffCtx, prisma, validInput); // linkType: CREATED_FROM

    // findUnique called once for forward duplicate check only (not reverse)
    expect((prisma as unknown as MockPrisma).recordLink.findUnique).toHaveBeenCalledTimes(1);
  });

  it('propagates source entity validation errors', async () => {
    vi.mocked(validateEntityExists).mockRejectedValueOnce(
      new AppError('ENTITY_NOT_FOUND', 'Source entity not found', 404),
    );

    const prisma = mockPrisma();

    await expect(createRecordLink(staffCtx, prisma, validInput)).rejects.toThrow(AppError);
  });

  it('propagates target entity validation errors', async () => {
    vi.mocked(validateEntityExists)
      .mockResolvedValueOnce(true) // source passes
      .mockRejectedValueOnce(new AppError('ENTITY_NOT_FOUND', 'Target entity not found', 404));

    const prisma = mockPrisma();

    await expect(createRecordLink(staffCtx, prisma, validInput)).rejects.toThrow(AppError);
  });
});

// ---------------------------------------------------------------------------
// listRecordLinks
// ---------------------------------------------------------------------------

describe('listRecordLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateEntityExists).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validQuery: RecordLinkListQuery = {
    entityType: 'Customer',
    entityId: SOURCE_ID,
    direction: 'all',
    limit: 50,
    offset: 0,
  };

  it('returns bidirectional links with correct direction indicator (AC #3)', async () => {
    const outgoingLink = fakeLink(); // source = Customer/SOURCE_ID
    const incomingLink = fakeLink({
      id: 'link-incoming',
      sourceEntityType: 'SalesOrder',
      sourceEntityId: TARGET_ID,
      targetEntityType: 'Customer',
      targetEntityId: SOURCE_ID,
      linkType: 'FULFILLS',
    });

    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.findMany.mockResolvedValue([
      outgoingLink,
      incomingLink,
    ]);
    (prisma as unknown as MockPrisma).recordLink.count.mockResolvedValue(2);

    const result = await listRecordLinks(staffCtx, prisma, validQuery);

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
    // First link: Customer is source → outgoing
    expect(result.items[0]!.direction).toBe('outgoing');
    // Second link: Customer is target → incoming
    expect(result.items[1]!.direction).toBe('incoming');
  });

  it('filters by linkType when provided (AC #4)', async () => {
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.findMany.mockResolvedValue([]);
    (prisma as unknown as MockPrisma).recordLink.count.mockResolvedValue(0);

    await listRecordLinks(staffCtx, prisma, { ...validQuery, linkType: 'FULFILLS' });

    expect((prisma as unknown as MockPrisma).recordLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ linkType: 'FULFILLS' }),
      }),
    );
  });

  it('filters by direction outgoing only', async () => {
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.findMany.mockResolvedValue([]);
    (prisma as unknown as MockPrisma).recordLink.count.mockResolvedValue(0);

    await listRecordLinks(staffCtx, prisma, { ...validQuery, direction: 'outgoing' });

    expect((prisma as unknown as MockPrisma).recordLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceEntityType: 'Customer',
          sourceEntityId: SOURCE_ID,
        }),
      }),
    );
  });

  it('filters by direction incoming only', async () => {
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.findMany.mockResolvedValue([]);
    (prisma as unknown as MockPrisma).recordLink.count.mockResolvedValue(0);

    await listRecordLinks(staffCtx, prisma, { ...validQuery, direction: 'incoming' });

    expect((prisma as unknown as MockPrisma).recordLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          targetEntityType: 'Customer',
          targetEntityId: SOURCE_ID,
        }),
      }),
    );
  });

  it('uses bidirectional OR query for direction=all (default)', async () => {
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.findMany.mockResolvedValue([]);
    (prisma as unknown as MockPrisma).recordLink.count.mockResolvedValue(0);

    await listRecordLinks(staffCtx, prisma, validQuery);

    expect((prisma as unknown as MockPrisma).recordLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { sourceEntityType: 'Customer', sourceEntityId: SOURCE_ID },
            { targetEntityType: 'Customer', targetEntityId: SOURCE_ID },
          ],
        }),
      }),
    );
  });

  it('respects custom limit and offset (pagination)', async () => {
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.findMany.mockResolvedValue([]);
    (prisma as unknown as MockPrisma).recordLink.count.mockResolvedValue(0);

    await listRecordLinks(staffCtx, prisma, { ...validQuery, limit: 10, offset: 20 });

    expect((prisma as unknown as MockPrisma).recordLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 20 }),
    );
  });

  it('defaults to limit=50 and offset=0', async () => {
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.findMany.mockResolvedValue([]);
    (prisma as unknown as MockPrisma).recordLink.count.mockResolvedValue(0);

    await listRecordLinks(staffCtx, prisma, validQuery);

    expect((prisma as unknown as MockPrisma).recordLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50, skip: 0 }),
    );
  });

  it('orders by createdAt DESC', async () => {
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.findMany.mockResolvedValue([]);
    (prisma as unknown as MockPrisma).recordLink.count.mockResolvedValue(0);

    await listRecordLinks(staffCtx, prisma, validQuery);

    expect((prisma as unknown as MockPrisma).recordLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });

  it('rejects invalid entityType via validateEntityExists (BR-SYS-014)', async () => {
    vi.mocked(validateEntityExists).mockRejectedValue(
      new AppError(
        'INVALID_ENTITY_TYPE',
        'Invalid entity type',
        400,
        undefined,
        'errors.entity.invalidType',
      ),
    );

    const prisma = mockPrisma();

    await expect(listRecordLinks(staffCtx, prisma, validQuery)).rejects.toMatchObject({
      code: 'INVALID_ENTITY_TYPE',
      statusCode: 400,
    });
  });

  it('validates entity exists before querying (BR-SYS-013)', async () => {
    vi.mocked(validateEntityExists).mockRejectedValue(
      new AppError('ENTITY_NOT_FOUND', 'Not found', 404),
    );
    const prisma = mockPrisma();

    await expect(listRecordLinks(staffCtx, prisma, validQuery)).rejects.toThrow(AppError);
    expect((prisma as unknown as MockPrisma).recordLink.findMany).not.toHaveBeenCalled();
  });

  it('returns empty items with zero total when no links exist', async () => {
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.findMany.mockResolvedValue([]);
    (prisma as unknown as MockPrisma).recordLink.count.mockResolvedValue(0);

    const result = await listRecordLinks(staffCtx, prisma, validQuery);
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// deleteRecordLink
// ---------------------------------------------------------------------------

describe('deleteRecordLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateEntityExists).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deletes manual link as STAFF (AC #5)', async () => {
    const manualLink = fakeLink({ isSystemGenerated: false });
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.findUnique.mockResolvedValue(manualLink);

    await deleteRecordLink(staffCtx, prisma, LINK_ID);

    expect((prisma as unknown as MockPrisma).recordLink.delete).toHaveBeenCalledWith({
      where: { id: LINK_ID },
    });
  });

  it('rejects STAFF from deleting system-generated link with 403 (AC #6)', async () => {
    const systemLink = fakeLink({ isSystemGenerated: true });
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.findUnique.mockResolvedValue(systemLink);

    await expect(deleteRecordLink(staffCtx, prisma, LINK_ID)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
      messageKey: 'errors.recordLink.systemLinkDeleteForbidden',
    });
  });

  it('allows MANAGER to delete system-generated link (AC #6)', async () => {
    const systemLink = fakeLink({ isSystemGenerated: true });
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.findUnique.mockResolvedValue(systemLink);

    await deleteRecordLink(managerCtx, prisma, LINK_ID);

    expect((prisma as unknown as MockPrisma).recordLink.delete).toHaveBeenCalledWith({
      where: { id: LINK_ID },
    });
  });

  it('throws NotFoundError when link does not exist (404)', async () => {
    const prisma = mockPrisma();
    // findUnique returns null by default

    await expect(deleteRecordLink(staffCtx, prisma, LINK_ID)).rejects.toThrow(NotFoundError);
  });

  it('validates entity access — checks BOTH source and target companyId', async () => {
    const link = fakeLink();
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.findUnique.mockResolvedValue(link);

    await deleteRecordLink(staffCtx, prisma, LINK_ID);

    expect(validateEntityExists).toHaveBeenCalledTimes(2);
    expect(validateEntityExists).toHaveBeenCalledWith(prisma, 'Customer', SOURCE_ID, 'company-001');
    expect(validateEntityExists).toHaveBeenCalledWith(
      prisma,
      'SalesOrder',
      TARGET_ID,
      'company-001',
    );
  });

  it('rejects when source passes but target entity belongs to different company', async () => {
    const link = fakeLink();
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.findUnique.mockResolvedValue(link);

    // Source passes, target fails (different company)
    vi.mocked(validateEntityExists)
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new AppError('ENTITY_NOT_FOUND', 'Target not found', 404));

    await expect(deleteRecordLink(staffCtx, prisma, LINK_ID)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
      messageKey: 'errors.recordLink.accessDenied',
    });
    expect((prisma as unknown as MockPrisma).recordLink.delete).not.toHaveBeenCalled();
  });

  it('rejects when source entity belongs to different company even if target passes', async () => {
    const link = fakeLink();
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.findUnique.mockResolvedValue(link);

    // Source fails (different company), target passes
    vi.mocked(validateEntityExists)
      .mockRejectedValueOnce(new AppError('ENTITY_NOT_FOUND', 'Source not found', 404))
      .mockResolvedValueOnce(true);

    await expect(deleteRecordLink(staffCtx, prisma, LINK_ID)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
      messageKey: 'errors.recordLink.accessDenied',
    });
    expect((prisma as unknown as MockPrisma).recordLink.delete).not.toHaveBeenCalled();
  });

  it('allows delete when source model unavailable but target passes', async () => {
    const link = fakeLink();
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.findUnique.mockResolvedValue(link);

    // Source unavailable (model not yet implemented), target passes
    vi.mocked(validateEntityExists)
      .mockRejectedValueOnce(new AppError('ENTITY_TYPE_NOT_AVAILABLE', 'Not available', 400))
      .mockResolvedValueOnce(true);

    await deleteRecordLink(staffCtx, prisma, LINK_ID);

    expect(validateEntityExists).toHaveBeenCalledTimes(2);
    expect((prisma as unknown as MockPrisma).recordLink.delete).toHaveBeenCalled();
  });

  it('re-throws unexpected errors from source entity validation (not entity-related)', async () => {
    const link = fakeLink();
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.findUnique.mockResolvedValue(link);

    // Source entity validation fails with a non-entity error (e.g. DB connection failure)
    const dbError = new Error('Connection refused');
    vi.mocked(validateEntityExists).mockRejectedValueOnce(dbError);

    await expect(deleteRecordLink(staffCtx, prisma, LINK_ID)).rejects.toThrow('Connection refused');
    // Should NOT fall through to target — error was re-thrown immediately
    expect(validateEntityExists).toHaveBeenCalledTimes(1);
  });

  it('rejects when neither source nor target entity is accessible', async () => {
    const link = fakeLink();
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.findUnique.mockResolvedValue(link);

    // Both entity validations fail with entity-not-found
    vi.mocked(validateEntityExists)
      .mockRejectedValueOnce(new AppError('ENTITY_NOT_FOUND', 'Source not found', 404))
      .mockRejectedValueOnce(new AppError('ENTITY_NOT_FOUND', 'Target not found', 404));

    await expect(deleteRecordLink(staffCtx, prisma, LINK_ID)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    });
  });

  it('converts P2025 (concurrent delete) to 404 NotFoundError', async () => {
    const link = fakeLink();
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.findUnique.mockResolvedValue(link);

    // Delete fails because another request deleted it first
    const p2025Error = new Error('Record to delete does not exist') as Error & { code: string };
    p2025Error.code = 'P2025';
    (prisma as unknown as MockPrisma).recordLink.delete.mockRejectedValue(p2025Error);

    await expect(deleteRecordLink(staffCtx, prisma, LINK_ID)).rejects.toThrow(NotFoundError);
  });

  it('does not delete when RBAC check fails', async () => {
    const systemLink = fakeLink({ isSystemGenerated: true });
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.findUnique.mockResolvedValue(systemLink);

    await expect(deleteRecordLink(staffCtx, prisma, LINK_ID)).rejects.toThrow(AppError);
    expect((prisma as unknown as MockPrisma).recordLink.delete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// createSystemLink
// ---------------------------------------------------------------------------

describe('createSystemLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isValidEntityType).mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const systemInput = {
    sourceEntityType: 'SalesOrder',
    sourceEntityId: SOURCE_ID,
    targetEntityType: 'CustomerInvoice',
    targetEntityId: TARGET_ID,
    linkType: 'CREATED_FROM' as const,
  };

  it('creates link via upsert with isSystemGenerated: true and correct createdBy (AC #2)', async () => {
    const systemLink = fakeLink({
      sourceEntityType: 'SalesOrder',
      targetEntityType: 'CustomerInvoice',
      isSystemGenerated: true,
      createdBy: 'system-actor',
    });
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.upsert.mockResolvedValue(systemLink);

    const result = await createSystemLink(prisma, systemInput, 'system-actor');

    expect(result.isSystemGenerated).toBe(true);
    expect(result.createdBy).toBe('system-actor');
    expect((prisma as unknown as MockPrisma).recordLink.upsert).toHaveBeenCalledWith({
      where: {
        sourceEntityType_sourceEntityId_targetEntityType_targetEntityId_linkType: {
          sourceEntityType: 'SalesOrder',
          sourceEntityId: SOURCE_ID,
          targetEntityType: 'CustomerInvoice',
          targetEntityId: TARGET_ID,
          linkType: 'CREATED_FROM',
        },
      },
      update: {},
      create: {
        sourceEntityType: 'SalesOrder',
        sourceEntityId: SOURCE_ID,
        targetEntityType: 'CustomerInvoice',
        targetEntityId: TARGET_ID,
        linkType: 'CREATED_FROM',
        description: null,
        isSystemGenerated: true,
        createdBy: 'system-actor',
      },
    });
  });

  it('returns existing link when duplicate exists (upsert no-op update)', async () => {
    const existingLink = fakeLink({ isSystemGenerated: true });
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.upsert.mockResolvedValue(existingLink);

    const result = await createSystemLink(prisma, systemInput, 'system-actor');

    expect(result).toEqual(existingLink);
  });

  it('validates entity types via isValidEntityType but not validateEntityExists', async () => {
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.upsert.mockResolvedValue(
      fakeLink({ isSystemGenerated: true }),
    );

    await createSystemLink(prisma, systemInput, 'system-actor');

    expect(isValidEntityType).toHaveBeenCalledWith('SalesOrder');
    expect(isValidEntityType).toHaveBeenCalledWith('CustomerInvoice');
    expect(validateEntityExists).not.toHaveBeenCalled();
  });

  it('rejects invalid source entity type (BR-SYS-014)', async () => {
    vi.mocked(isValidEntityType).mockReturnValueOnce(false);
    const prisma = mockPrisma();

    await expect(
      createSystemLink(prisma, { ...systemInput, sourceEntityType: 'FakeType' }, 'system-actor'),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects invalid target entity type (BR-SYS-014)', async () => {
    vi.mocked(isValidEntityType)
      .mockReturnValueOnce(true) // source passes
      .mockReturnValueOnce(false); // target fails
    const prisma = mockPrisma();

    await expect(
      createSystemLink(prisma, { ...systemInput, targetEntityType: 'FakeType' }, 'system-actor'),
    ).rejects.toThrow(ValidationError);
  });

  it('creates link with description when provided', async () => {
    const prisma = mockPrisma();
    (prisma as unknown as MockPrisma).recordLink.upsert.mockResolvedValue(
      fakeLink({ isSystemGenerated: true, description: 'Auto-linked from SO' }),
    );

    await createSystemLink(
      prisma,
      { ...systemInput, description: 'Auto-linked from SO' },
      'system-actor',
    );

    expect((prisma as unknown as MockPrisma).recordLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ description: 'Auto-linked from SO' }),
      }),
    );
  });

  // Input validation tests (issue #5)
  it('rejects empty sourceEntityType', async () => {
    const prisma = mockPrisma();
    await expect(
      createSystemLink(prisma, { ...systemInput, sourceEntityType: '' }, 'system-actor'),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects empty sourceEntityId', async () => {
    const prisma = mockPrisma();
    await expect(
      createSystemLink(prisma, { ...systemInput, sourceEntityId: '' }, 'system-actor'),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects empty targetEntityType', async () => {
    const prisma = mockPrisma();
    await expect(
      createSystemLink(prisma, { ...systemInput, targetEntityType: '' }, 'system-actor'),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects empty targetEntityId', async () => {
    const prisma = mockPrisma();
    await expect(
      createSystemLink(prisma, { ...systemInput, targetEntityId: '' }, 'system-actor'),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects empty linkType', async () => {
    const prisma = mockPrisma();
    await expect(
      createSystemLink(prisma, { ...systemInput, linkType: '' as never }, 'system-actor'),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects empty actorId', async () => {
    const prisma = mockPrisma();
    await expect(createSystemLink(prisma, systemInput, '')).rejects.toThrow(ValidationError);
  });
});
