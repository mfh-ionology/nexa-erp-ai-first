import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @nexa/db — vi.hoisted runs before vi.mock
// ---------------------------------------------------------------------------

const { MockPrismaClientKnownRequestError } = vi.hoisted(() => {
  class MockPrismaClientKnownRequestError extends Error {
    code: string;
    clientVersion: string;
    constructor(message: string, opts: { code: string; clientVersion: string }) {
      super(message);
      this.name = 'PrismaClientKnownRequestError';
      this.code = opts.code;
      this.clientVersion = opts.clientVersion;
    }
  }

  return { MockPrismaClientKnownRequestError };
});

vi.mock('@nexa/db', () => ({
  prisma: {},
  Prisma: {
    PrismaClientKnownRequestError: MockPrismaClientKnownRequestError,
    DbNull: Symbol('DbNull'),
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { AdminSkillService } from '../admin-skill.service.js';
import { NotFoundError } from '../../../core/errors/not-found-error.js';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function createMockPrisma() {
  return {
    aiSkill: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-03T12:00:00Z');
const SKILL_ID = '00000000-0000-4000-a000-000000000010';

function makeSkillRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SKILL_ID,
    name: 'ar-overdue-analysis',
    displayName: 'Overdue Invoice Analysis',
    description: 'Analyses overdue invoices and recommends follow-up actions',
    category: 'analysis',
    skillContent: '# Overdue Invoice Analysis\n\nAnalyse overdue invoices...',
    triggerPhrases: ['show me overdue invoices', 'analyse overdue accounts'],
    negativeTriggers: ['create invoice'],
    inputSchema: {},
    outputType: 'json',
    requiredTools: ['query_entity', 'analyse_data'],
    isActive: true,
    moduleKey: 'ar',
    packKey: 'ar-analysis',
    contextRequired: ['module:ar'],
    orchestrationPattern: 'SEQUENTIAL',
    parameters: null,
    examples: null,
    priority: 200,
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    _count: { contexts: 2, overrides: 1 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mockPrisma: ReturnType<typeof createMockPrisma>;
let service: AdminSkillService;

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma = createMockPrisma();
  service = new AdminSkillService(mockPrisma as any, mockLogger as any);
});

// ---------------------------------------------------------------------------
// listSkills
// ---------------------------------------------------------------------------

describe('listSkills', () => {
  it('returns paginated results with computed requiredToolCount', async () => {
    const rows = [makeSkillRow()];
    mockPrisma.aiSkill.findMany.mockResolvedValue(rows);
    mockPrisma.aiSkill.count.mockResolvedValue(1);

    const result = await service.listSkills({ limit: 50 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.requiredToolCount).toBe(2);
    expect(result.data[0]!.moduleKey).toBe('ar');
    expect(result.meta.hasMore).toBe(false);
    expect(result.meta.total).toBe(1);
  });

  it('supports moduleKey filter', async () => {
    mockPrisma.aiSkill.findMany.mockResolvedValue([]);
    mockPrisma.aiSkill.count.mockResolvedValue(0);

    await service.listSkills({ limit: 50, moduleKey: 'ar' });

    expect(mockPrisma.aiSkill.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ moduleKey: 'ar' }),
      }),
    );
  });

  it('supports category filter', async () => {
    mockPrisma.aiSkill.findMany.mockResolvedValue([]);
    mockPrisma.aiSkill.count.mockResolvedValue(0);

    await service.listSkills({ limit: 50, category: 'analysis' });

    expect(mockPrisma.aiSkill.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: 'analysis' }),
      }),
    );
  });

  it('supports search filter', async () => {
    mockPrisma.aiSkill.findMany.mockResolvedValue([]);
    mockPrisma.aiSkill.count.mockResolvedValue(0);

    await service.listSkills({ limit: 50, search: 'overdue' });

    expect(mockPrisma.aiSkill.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: 'overdue', mode: 'insensitive' } },
            { displayName: { contains: 'overdue', mode: 'insensitive' } },
            { description: { contains: 'overdue', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('orders by moduleKey ASC, priority DESC, name ASC', async () => {
    mockPrisma.aiSkill.findMany.mockResolvedValue([]);
    mockPrisma.aiSkill.count.mockResolvedValue(0);

    await service.listSkills({ limit: 50 });

    expect(mockPrisma.aiSkill.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ moduleKey: 'asc' }, { priority: 'desc' }, { name: 'asc' }],
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// listSkillsGrouped
// ---------------------------------------------------------------------------

describe('listSkillsGrouped', () => {
  it('groups skills by moduleKey', async () => {
    const rows = [
      makeSkillRow({ id: 's1', moduleKey: 'ar', name: 'ar-skill-1' }),
      makeSkillRow({ id: 's2', moduleKey: 'ar', name: 'ar-skill-2' }),
      makeSkillRow({ id: 's3', moduleKey: 'finance', name: 'fin-skill-1' }),
    ];
    mockPrisma.aiSkill.findMany.mockResolvedValue(rows);

    const result = await service.listSkillsGrouped({ limit: 50 });

    expect(result.groups).toHaveLength(2);
    expect(result.groups[0]!.moduleKey).toBe('ar');
    expect(result.groups[0]!.skills).toHaveLength(2);
    expect(result.groups[1]!.moduleKey).toBe('finance');
    expect(result.groups[1]!.skills).toHaveLength(1);
    expect(result.totalCount).toBe(3);
  });

  it('places null moduleKey last ("Unassigned")', async () => {
    const rows = [
      makeSkillRow({ id: 's1', moduleKey: null, name: 'unassigned-skill' }),
      makeSkillRow({ id: 's2', moduleKey: 'ar', name: 'ar-skill' }),
    ];
    mockPrisma.aiSkill.findMany.mockResolvedValue(rows);

    const result = await service.listSkillsGrouped({ limit: 50 });

    expect(result.groups).toHaveLength(2);
    expect(result.groups[0]!.moduleKey).toBe('ar');
    expect(result.groups[1]!.moduleKey).toBeNull();
  });

  it('sorts groups alphabetically by moduleKey', async () => {
    const rows = [
      makeSkillRow({ id: 's1', moduleKey: 'sales', name: 'sales-skill' }),
      makeSkillRow({ id: 's2', moduleKey: 'ar', name: 'ar-skill' }),
      makeSkillRow({ id: 's3', moduleKey: 'finance', name: 'fin-skill' }),
    ];
    mockPrisma.aiSkill.findMany.mockResolvedValue(rows);

    const result = await service.listSkillsGrouped({ limit: 50 });

    expect(result.groups.map((g) => g.moduleKey)).toEqual(['ar', 'finance', 'sales']);
  });
});

// ---------------------------------------------------------------------------
// getSkill
// ---------------------------------------------------------------------------

describe('getSkill', () => {
  it('returns full skill detail with context and override counts', async () => {
    mockPrisma.aiSkill.findUnique.mockResolvedValue(makeSkillRow());

    const result = await service.getSkill(SKILL_ID);

    expect(result.id).toBe(SKILL_ID);
    expect(result.skillContent).toContain('Overdue Invoice Analysis');
    expect(result.requiredTools).toEqual(['query_entity', 'analyse_data']);
    expect(result.contextCount).toBe(2);
    expect(result.overrideCount).toBe(1);
  });

  it('throws NotFoundError when skill does not exist', async () => {
    mockPrisma.aiSkill.findUnique.mockResolvedValue(null);

    await expect(service.getSkill('nonexistent')).rejects.toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// createSkill
// ---------------------------------------------------------------------------

describe('createSkill', () => {
  const validInput = {
    name: 'new-skill',
    displayName: 'New Skill',
    category: 'analysis' as const,
    skillContent: '# New Skill\nInstructions here',
    triggerPhrases: ['do something new'],
    inputSchema: {},
    outputType: 'json' as const,
    requiredTools: [],
    isActive: true,
    negativeTriggers: [],
    contextRequired: [],
    orchestrationPattern: null as null,
    priority: 100,
  };

  it('creates skill and returns full detail', async () => {
    mockPrisma.aiSkill.create.mockResolvedValue(makeSkillRow({ name: 'new-skill' }));
    mockPrisma.aiSkill.findUnique.mockResolvedValue(makeSkillRow({ name: 'new-skill' }));

    const result = await service.createSkill(validInput);

    expect(result.id).toBe(SKILL_ID);
    expect(mockPrisma.aiSkill.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'new-skill',
          displayName: 'New Skill',
          category: 'analysis',
          triggerPhrases: ['do something new'],
        }),
      }),
    );
  });

  it('rejects duplicate name with 409', async () => {
    mockPrisma.aiSkill.create.mockRejectedValue(
      new MockPrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      }),
    );

    await expect(service.createSkill(validInput)).rejects.toThrow(
      expect.objectContaining({
        code: 'SKILL_NAME_CONFLICT',
        statusCode: 409,
      }),
    );
  });

  it('re-throws non-P2002 errors', async () => {
    mockPrisma.aiSkill.create.mockRejectedValue(new Error('Database error'));

    await expect(service.createSkill(validInput)).rejects.toThrow('Database error');
  });
});

// ---------------------------------------------------------------------------
// updateSkill
// ---------------------------------------------------------------------------

describe('updateSkill', () => {
  it('updates skill and returns full detail', async () => {
    mockPrisma.aiSkill.findUnique
      .mockResolvedValueOnce(makeSkillRow()) // existence check
      .mockResolvedValueOnce(makeSkillRow({ isActive: false })); // getSkill
    mockPrisma.aiSkill.update.mockResolvedValue(makeSkillRow({ isActive: false }));

    const result = await service.updateSkill(SKILL_ID, { isActive: false });

    expect(result.isActive).toBe(false);
  });

  it('toggles isActive (AC-6 mechanism)', async () => {
    mockPrisma.aiSkill.findUnique
      .mockResolvedValueOnce(makeSkillRow({ isActive: true }))
      .mockResolvedValueOnce(makeSkillRow({ isActive: false }));
    mockPrisma.aiSkill.update.mockResolvedValue(undefined);

    const result = await service.updateSkill(SKILL_ID, { isActive: false });

    expect(mockPrisma.aiSkill.update).toHaveBeenCalledWith({
      where: { id: SKILL_ID },
      data: { isActive: false },
    });
    expect(result.isActive).toBe(false);
  });

  it('throws NotFoundError when skill does not exist', async () => {
    mockPrisma.aiSkill.findUnique.mockResolvedValue(null);

    await expect(service.updateSkill('nonexistent', { displayName: 'X' })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('rejects duplicate name on update with 409', async () => {
    mockPrisma.aiSkill.findUnique.mockResolvedValue(makeSkillRow());
    mockPrisma.aiSkill.update.mockRejectedValue(
      new MockPrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      }),
    );

    await expect(service.updateSkill(SKILL_ID, { name: 'existing-name' })).rejects.toThrow(
      expect.objectContaining({ code: 'SKILL_NAME_CONFLICT', statusCode: 409 }),
    );
  });
});

// ---------------------------------------------------------------------------
// deleteSkill (soft-delete)
// ---------------------------------------------------------------------------

describe('deleteSkill', () => {
  it('soft-deletes by setting isActive=false', async () => {
    mockPrisma.aiSkill.findUnique
      .mockResolvedValueOnce(makeSkillRow()) // existence check
      .mockResolvedValueOnce(makeSkillRow({ isActive: false })); // getSkill after update
    mockPrisma.aiSkill.update.mockResolvedValue(undefined);

    const result = await service.deleteSkill(SKILL_ID);

    expect(mockPrisma.aiSkill.update).toHaveBeenCalledWith({
      where: { id: SKILL_ID },
      data: { isActive: false },
    });
    expect(result.isActive).toBe(false);
  });

  it('throws NotFoundError when skill does not exist', async () => {
    mockPrisma.aiSkill.findUnique.mockResolvedValue(null);

    await expect(service.deleteSkill('nonexistent')).rejects.toThrow(NotFoundError);
  });

  it('returns the updated skill detail after soft-delete', async () => {
    const deactivated = makeSkillRow({ isActive: false });
    mockPrisma.aiSkill.findUnique
      .mockResolvedValueOnce(makeSkillRow())
      .mockResolvedValueOnce(deactivated);
    mockPrisma.aiSkill.update.mockResolvedValue(undefined);

    const result = await service.deleteSkill(SKILL_ID);

    expect(result.id).toBe(SKILL_ID);
    expect(result.isActive).toBe(false);
    expect(result.contextCount).toBe(2);
  });
});
