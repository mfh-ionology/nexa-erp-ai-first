import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @nexa/db before any service imports — vi.hoisted runs before vi.mock
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
  },
}));

// ---------------------------------------------------------------------------
// Now import the service (after mock is established)
// ---------------------------------------------------------------------------

import { AdminPromptService } from '../admin-prompt.service.js';
import { AppError } from '../../../core/errors/app-error.js';
import { NotFoundError } from '../../../core/errors/not-found-error.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function createMockPrisma() {
  return {
    aiPrompt: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    aiPromptVersion: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        aiPrompt: {
          create: vi.fn(),
          update: vi.fn(),
        },
        aiPromptVersion: {
          create: vi.fn(),
        },
      }),
    ),
  };
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const mockPromptRenderer = {
  render: vi.fn(),
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-03T12:00:00Z');
const TEST_USER_ID = '00000000-0000-4000-a000-000000000099';
const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';

function makePromptRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-a000-000000000010',
    name: 'record-create-invoice',
    description: 'Creates a new invoice record',
    category: 'record-creation',
    systemPrompt: 'You are an invoice creation assistant.',
    userTemplate: 'Create an invoice for {{customer_name}}.',
    parameters: [],
    outputFormat: null,
    activeVersion: 1,
    isActive: true,
    createdBy: TEST_USER_ID,
    createdAt: NOW,
    updatedAt: NOW,
    _count: { variables: 2, versions: 1, agents: 0 },
    variables: [
      {
        id: 'v1',
        variableName: 'customer_name',
        displayName: 'Customer Name',
        sourceType: 'DB Fields',
      },
      { id: 'v2', variableName: 'company_name', displayName: 'Company Name', sourceType: 'System' },
    ],
    ...overrides,
  };
}

function makeVersionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ver-001',
    promptId: '00000000-0000-4000-a000-000000000010',
    version: 1,
    systemPrompt: 'You are an invoice creation assistant.',
    userTemplate: 'Create an invoice for {{customer_name}}.',
    parameters: [],
    changeReason: 'Initial version',
    createdBy: TEST_USER_ID,
    createdAt: NOW,
    ...overrides,
  };
}

function makeCreatePromptInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'record-create-invoice',
    category: 'record-creation',
    systemPrompt: 'You are an invoice creation assistant.',
    userTemplate: 'Create an invoice for {{customer_name}}.',
    parameters: [],
    isActive: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminPromptService', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let service: AdminPromptService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    service = new AdminPromptService(
      mockPrisma as any,
      mockLogger as any,
      mockPromptRenderer as any,
    );
  });

  // ─── listPrompts ─────────────────────────────────────────────────────

  describe('listPrompts', () => {
    it('returns paginated list with variable counts', async () => {
      const rows = [makePromptRow()];
      mockPrisma.aiPrompt.findMany.mockResolvedValue(rows);
      mockPrisma.aiPrompt.count.mockResolvedValue(1);

      const result = await service.listPrompts({ limit: 50 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]!.variableCount).toBe(2);
      expect(result.meta.total).toBe(1);
      expect(result.meta.hasMore).toBe(false);
    });

    it('filters by category', async () => {
      mockPrisma.aiPrompt.findMany.mockResolvedValue([]);
      mockPrisma.aiPrompt.count.mockResolvedValue(0);

      await service.listPrompts({ limit: 50, category: 'query' });

      const findManyCall = mockPrisma.aiPrompt.findMany.mock.calls[0]![0] as Record<
        string,
        unknown
      >;
      const where = findManyCall.where as Record<string, unknown>;
      expect(where.category).toBe('query');
    });

    it('applies search filter on name and description', async () => {
      mockPrisma.aiPrompt.findMany.mockResolvedValue([]);
      mockPrisma.aiPrompt.count.mockResolvedValue(0);

      await service.listPrompts({ limit: 50, search: 'invoice' });

      const findManyCall = mockPrisma.aiPrompt.findMany.mock.calls[0]![0] as Record<
        string,
        unknown
      >;
      const where = findManyCall.where as Record<string, unknown>;
      expect(where.OR).toEqual([
        { name: { contains: 'invoice', mode: 'insensitive' } },
        { description: { contains: 'invoice', mode: 'insensitive' } },
      ]);
    });
  });

  // ─── getPrompt ─────────────────────────────────────────────────────

  describe('getPrompt', () => {
    it('returns prompt detail with variables and version count', async () => {
      const row = makePromptRow();
      mockPrisma.aiPrompt.findUnique.mockResolvedValue(row);

      const result = await service.getPrompt(row.id);

      expect(result.id).toBe(row.id);
      expect(result.variables).toHaveLength(2);
      expect(result.versionCount).toBe(1);
      expect(result.systemPrompt).toBe('You are an invoice creation assistant.');
    });

    it('throws NotFoundError when prompt does not exist', async () => {
      mockPrisma.aiPrompt.findUnique.mockResolvedValue(null);

      await expect(service.getPrompt('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── createPrompt ─────────────────────────────────────────────────

  describe('createPrompt', () => {
    it('creates prompt with initial version (v1)', async () => {
      const input = makeCreatePromptInput();
      const createdPrompt = makePromptRow();

      // Transaction mock: capture calls to tx
      const txCreate = vi.fn().mockResolvedValue({ ...createdPrompt, id: 'new-prompt-id' });
      const txVersionCreate = vi.fn().mockResolvedValue(makeVersionRow());
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          aiPrompt: { create: txCreate },
          aiPromptVersion: { create: txVersionCreate },
        });
      });

      // After transaction, getPrompt is called
      mockPrisma.aiPrompt.findUnique.mockResolvedValue(createdPrompt);

      const result = await service.createPrompt(TEST_USER_ID, input as any);

      expect(result.name).toBe('record-create-invoice');
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('throws 409 on duplicate name (P2002)', async () => {
      const input = makeCreatePromptInput();
      const prismaError = new MockPrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.0.0',
      });
      mockPrisma.$transaction.mockRejectedValue(prismaError);

      try {
        await service.createPrompt(TEST_USER_ID, input as any);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(409);
        expect((error as AppError).code).toBe('PROMPT_NAME_CONFLICT');
      }
    });
  });

  // ─── updatePrompt ─────────────────────────────────────────────────

  describe('updatePrompt', () => {
    it('creates new version when content changes', async () => {
      const current = makePromptRow({ activeVersion: 1 });
      mockPrisma.aiPrompt.findUnique
        .mockResolvedValueOnce(current) // Load current for validation
        .mockResolvedValueOnce({ ...current, activeVersion: 2 }); // Re-fetch after update

      const txVersionCreate = vi.fn().mockResolvedValue(makeVersionRow({ version: 2 }));
      const txPromptUpdate = vi.fn().mockResolvedValue(current);
      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        return fn({
          aiPromptVersion: { create: txVersionCreate },
          aiPrompt: { update: txPromptUpdate },
        });
      });

      await service.updatePrompt(current.id, TEST_USER_ID, {
        systemPrompt: 'Updated system prompt.',
        changeReason: 'Improved instructions',
      });

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('does NOT create version for metadata-only changes', async () => {
      const current = makePromptRow();
      mockPrisma.aiPrompt.findUnique
        .mockResolvedValueOnce(current) // Load current
        .mockResolvedValueOnce(current); // Re-fetch

      mockPrisma.aiPrompt.update.mockResolvedValue(current);

      await service.updatePrompt(current.id, TEST_USER_ID, {
        description: 'Updated description',
        changeReason: 'Not used for metadata',
      });

      // Transaction should NOT be called for metadata-only
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
      // Direct update should be called
      expect(mockPrisma.aiPrompt.update).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundError when prompt does not exist', async () => {
      mockPrisma.aiPrompt.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePrompt('nonexistent', TEST_USER_ID, { changeReason: 'test' }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ─── deletePrompt ─────────────────────────────────────────────────

  describe('deletePrompt', () => {
    it('rejects deletion when prompt is referenced by agents (422)', async () => {
      const prompt = makePromptRow({ _count: { variables: 2, versions: 1, agents: 2 } });
      mockPrisma.aiPrompt.findUnique.mockResolvedValue(prompt);

      await expect(service.deletePrompt(prompt.id)).rejects.toThrow(AppError);

      try {
        await service.deletePrompt(prompt.id);
      } catch (error) {
        expect((error as AppError).statusCode).toBe(422);
        expect((error as AppError).code).toBe('PROMPT_REFERENCED_BY_AGENTS');
      }
    });

    it('deletes unreferenced prompt', async () => {
      const prompt = makePromptRow({ _count: { variables: 2, versions: 1, agents: 0 } });
      mockPrisma.aiPrompt.findUnique.mockResolvedValue(prompt);
      mockPrisma.aiPrompt.delete.mockResolvedValue(prompt);

      await service.deletePrompt(prompt.id);

      expect(mockPrisma.aiPrompt.delete).toHaveBeenCalledWith({ where: { id: prompt.id } });
    });

    it('throws NotFoundError when prompt does not exist', async () => {
      mockPrisma.aiPrompt.findUnique.mockResolvedValue(null);

      await expect(service.deletePrompt('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── listVersions ─────────────────────────────────────────────────

  describe('listVersions', () => {
    it('returns versions ordered by version DESC', async () => {
      const prompt = makePromptRow();
      mockPrisma.aiPrompt.findUnique.mockResolvedValue(prompt);

      const versions = [
        makeVersionRow({ version: 3, changeReason: 'Third version' }),
        makeVersionRow({ version: 2, changeReason: 'Second version' }),
        makeVersionRow({ version: 1, changeReason: 'Initial version' }),
      ];
      mockPrisma.aiPromptVersion.findMany.mockResolvedValue(versions);

      const result = await service.listVersions(prompt.id);

      expect(result).toHaveLength(3);
      expect(result[0]!.version).toBe(3);
      expect(result[0]!.snippet).toBe('You are an invoice creation assistant.');
      expect(mockPrisma.aiPromptVersion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { version: 'desc' } }),
      );
    });

    it('throws NotFoundError when prompt does not exist', async () => {
      mockPrisma.aiPrompt.findUnique.mockResolvedValue(null);

      await expect(service.listVersions('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── getVersion ─────────────────────────────────────────────────

  describe('getVersion', () => {
    it('returns full version content', async () => {
      const version = makeVersionRow();
      mockPrisma.aiPromptVersion.findUnique.mockResolvedValue(version);

      const result = await service.getVersion(version.promptId, 1);

      expect(result.version).toBe(1);
      expect(result.systemPrompt).toBe('You are an invoice creation assistant.');
      expect(result.userTemplate).toBe('Create an invoice for {{customer_name}}.');
    });

    it('throws NotFoundError when version does not exist', async () => {
      mockPrisma.aiPromptVersion.findUnique.mockResolvedValue(null);

      await expect(service.getVersion('prompt-id', 99)).rejects.toThrow(NotFoundError);
    });
  });

  // ─── restoreVersion ─────────────────────────────────────────────

  describe('restoreVersion', () => {
    it('creates new version copying old content with auto-populated changeReason', async () => {
      const oldVersion = makeVersionRow({ version: 1 });
      const prompt = makePromptRow({ activeVersion: 3 });

      mockPrisma.aiPromptVersion.findUnique.mockResolvedValue(oldVersion);
      mockPrisma.aiPrompt.findUnique.mockResolvedValue(prompt);

      const newVersionRow = makeVersionRow({
        id: 'ver-new',
        version: 4,
        changeReason: 'Restored from version 1',
      });

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          aiPromptVersion: { create: vi.fn().mockResolvedValue(newVersionRow) },
          aiPrompt: { update: vi.fn().mockResolvedValue(prompt) },
        };
        return fn(tx);
      });

      const result = await service.restoreVersion(prompt.id, 1, TEST_USER_ID);

      expect(result.version).toBe(4);
      expect(result.changeReason).toBe('Restored from version 1');
      expect(result.systemPrompt).toBe(oldVersion.systemPrompt);
    });

    it('throws NotFoundError when version does not exist', async () => {
      mockPrisma.aiPromptVersion.findUnique.mockResolvedValue(null);

      await expect(service.restoreVersion('prompt-id', 99, TEST_USER_ID)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  // ─── testRender ─────────────────────────────────────────────────

  describe('testRender', () => {
    it('calls PromptRenderer and returns result', async () => {
      const prompt = makePromptRow();
      mockPrisma.aiPrompt.findUnique.mockResolvedValue(prompt);

      const renderResult = {
        systemPrompt: 'Resolved system prompt.',
        userTemplate: 'Resolved user template.',
        resolvedVariables: { customer_name: 'Acme Corp' },
        unresolvedCount: 0,
      };
      mockPromptRenderer.render.mockResolvedValue(renderResult);

      const result = await service.testRender(
        prompt.id,
        { sampleVariables: { customer_name: 'Acme Corp' } },
        TEST_COMPANY_ID,
        TEST_USER_ID,
      );

      expect(result.systemPrompt).toBe('Resolved system prompt.');
      expect(result.resolvedVariables).toEqual({ customer_name: 'Acme Corp' });
      expect(result.unresolvedCount).toBe(0);
      expect(mockPromptRenderer.render).toHaveBeenCalledWith(
        prompt.id,
        expect.objectContaining({
          companyId: TEST_COMPANY_ID,
          userId: TEST_USER_ID,
        }),
      );
    });

    it('throws NotFoundError when prompt does not exist', async () => {
      mockPrisma.aiPrompt.findUnique.mockResolvedValue(null);

      await expect(
        service.testRender('nonexistent', {}, TEST_COMPANY_ID, TEST_USER_ID),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
