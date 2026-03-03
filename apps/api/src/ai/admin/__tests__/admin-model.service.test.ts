import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @nexa/db before any service imports — vi.hoisted runs before vi.mock
// ---------------------------------------------------------------------------

const { MockDecimal, MockPrismaClientKnownRequestError } = vi.hoisted(() => {
  class MockDecimal {
    private value: string;
    constructor(val: string | number) {
      this.value = String(val);
    }
    toString() {
      return this.value;
    }
  }

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

  return { MockDecimal, MockPrismaClientKnownRequestError };
});

vi.mock('@nexa/db', () => ({
  prisma: {},
  Prisma: {
    Decimal: MockDecimal,
    PrismaClientKnownRequestError: MockPrismaClientKnownRequestError,
  },
}));

// ---------------------------------------------------------------------------
// Now import the service (after mock is established)
// ---------------------------------------------------------------------------

import { AdminModelService } from '../admin-model.service.js';
import { AppError } from '../../../core/errors/app-error.js';
import { NotFoundError } from '../../../core/errors/not-found-error.js';

// ---------------------------------------------------------------------------
// Prisma mock factory
// ---------------------------------------------------------------------------

function createMockPrisma() {
  return {
    aiModel: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        aiModel: {
          findMany: vi.fn(),
          findUnique: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          updateMany: vi.fn(),
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

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const NOW = new Date('2026-03-03T12:00:00Z');

function makeModelRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-a000-000000000001',
    name: 'claude-opus',
    provider: 'anthropic',
    modelId: 'claude-opus-4-6',
    displayName: 'Claude Opus 4.6',
    maxInputTokens: 200000,
    maxOutputTokens: 32000,
    costPerMInput: new MockDecimal('15.00'),
    costPerMOutput: new MockDecimal('75.00'),
    routingTags: ['reasoning', 'standard'],
    capabilities: { vision: true },
    isActive: true,
    isDefault: false,
    fallbackModelId: null,
    config: null,
    createdAt: NOW,
    updatedAt: NOW,
    _count: { agents: 0 },
    fallbackModel: null,
    ...overrides,
  };
}

function makeCreateInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'claude-opus',
    provider: 'anthropic',
    modelId: 'claude-opus-4-6',
    displayName: 'Claude Opus 4.6',
    maxInputTokens: 200000,
    maxOutputTokens: 32000,
    costPerMInput: '15.00',
    costPerMOutput: '75.00',
    capabilities: { vision: true },
    isActive: true,
    isDefault: false,
    routingTags: ['reasoning', 'standard'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminModelService', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let service: AdminModelService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    service = new AdminModelService(mockPrisma as any, mockLogger as any);
  });

  // ─── listModels ─────────────────────────────────────────────────────

  describe('listModels', () => {
    it('returns paginated list of models', async () => {
      const rows = [
        makeModelRow(),
        makeModelRow({ id: '00000000-0000-4000-a000-000000000002', name: 'gpt-4' }),
      ];
      mockPrisma.aiModel.findMany.mockResolvedValue(rows);
      mockPrisma.aiModel.count.mockResolvedValue(2);

      const result = await service.listModels({ limit: 50 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.hasMore).toBe(false);
      expect(result.data[0]!.name).toBe('claude-opus');
      expect(result.data[0]!.costPerMInput).toBe('15.00');
    });

    it('detects hasMore when rows exceed limit', async () => {
      const rows = [
        makeModelRow({ id: '1' }),
        makeModelRow({ id: '2' }),
        makeModelRow({ id: '3' }),
      ];
      mockPrisma.aiModel.findMany.mockResolvedValue(rows);
      mockPrisma.aiModel.count.mockResolvedValue(5);

      const result = await service.listModels({ limit: 2 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.hasMore).toBe(true);
      expect(result.meta.cursor).toBe('2');
    });

    it('applies search filter', async () => {
      mockPrisma.aiModel.findMany.mockResolvedValue([]);
      mockPrisma.aiModel.count.mockResolvedValue(0);

      await service.listModels({ limit: 50, search: 'claude' });

      const findManyCall = mockPrisma.aiModel.findMany.mock.calls[0]![0] as Record<string, unknown>;
      const where = findManyCall.where as Record<string, unknown>;
      expect(where.OR).toEqual([
        { name: { contains: 'claude', mode: 'insensitive' } },
        { displayName: { contains: 'claude', mode: 'insensitive' } },
        { modelId: { contains: 'claude', mode: 'insensitive' } },
      ]);
    });

    it('applies isActive and provider filters', async () => {
      mockPrisma.aiModel.findMany.mockResolvedValue([]);
      mockPrisma.aiModel.count.mockResolvedValue(0);

      await service.listModels({ limit: 50, isActive: true, provider: 'anthropic' });

      const findManyCall = mockPrisma.aiModel.findMany.mock.calls[0]![0] as Record<string, unknown>;
      const where = findManyCall.where as Record<string, unknown>;
      expect(where.isActive).toBe(true);
      expect(where.provider).toBe('anthropic');
    });
  });

  // ─── getModel ─────────────────────────────────────────────────────

  describe('getModel', () => {
    it('returns model detail with fallback info', async () => {
      const row = makeModelRow({
        fallbackModel: { id: 'fb-1', name: 'gpt-4', displayName: 'GPT-4' },
        config: { temperature: 0.7 },
      });
      mockPrisma.aiModel.findUnique.mockResolvedValue(row);

      const result = await service.getModel(row.id as string);

      expect(result.id).toBe(row.id);
      expect(result.fallbackModel).toEqual({ id: 'fb-1', name: 'gpt-4', displayName: 'GPT-4' });
      expect(result.config).toEqual({ temperature: 0.7 });
    });

    it('throws NotFoundError when model does not exist', async () => {
      mockPrisma.aiModel.findUnique.mockResolvedValue(null);

      await expect(service.getModel('nonexistent-id')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── createModel ─────────────────────────────────────────────────

  describe('createModel', () => {
    it('creates a basic model', async () => {
      const input = makeCreateInput();
      const createdRow = makeModelRow();
      mockPrisma.aiModel.create.mockResolvedValue(createdRow);

      const result = await service.createModel(input as any);

      expect(result.name).toBe('claude-opus');
      expect(mockPrisma.aiModel.create).toHaveBeenCalledTimes(1);
    });

    it('creates model with isDefault=true and unsets previous default in transaction', async () => {
      const input = makeCreateInput({ isDefault: true });
      const createdRow = makeModelRow({ isDefault: true });

      mockPrisma.$transaction.mockImplementation(async (fn: any) => {
        const tx = {
          aiModel: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            create: vi.fn().mockResolvedValue(createdRow),
          },
        };
        return fn(tx);
      });

      const result = await service.createModel(input as any);

      expect(result.isDefault).toBe(true);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('throws 409 on duplicate name (P2002)', async () => {
      const input = makeCreateInput();
      const prismaError = new MockPrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.0.0',
      });
      mockPrisma.aiModel.create.mockRejectedValue(prismaError);

      try {
        await service.createModel(input as any);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(409);
        expect((error as AppError).code).toBe('MODEL_NAME_CONFLICT');
      }
    });
  });

  // ─── updateModel ─────────────────────────────────────────────────

  describe('updateModel', () => {
    it('rejects deactivating the default model (422)', async () => {
      const currentModel = makeModelRow({ isDefault: true, isActive: true });
      mockPrisma.aiModel.findUnique.mockResolvedValue(currentModel);

      try {
        await service.updateModel(currentModel.id as string, { isActive: false });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(422);
        expect((error as AppError).code).toBe('CANNOT_DEACTIVATE_DEFAULT');
      }
    });

    it('rejects circular fallback chain (422)', async () => {
      const modelA = makeModelRow({ id: 'model-a' });

      // findUnique: load current model for validation
      mockPrisma.aiModel.findUnique.mockResolvedValueOnce(modelA);
      // $queryRaw: CTE detects cycle (model-b → model-a)
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ has_cycle: true, chain_depth: 1 }]);

      try {
        await service.updateModel('model-a', { fallbackModelId: 'model-b' });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(422);
        expect((error as AppError).code).toBe('CIRCULAR_FALLBACK');
      }
    });

    it('updates model and re-fetches detail', async () => {
      const currentModel = makeModelRow();
      const updatedModel = makeModelRow({ displayName: 'Updated Name' });

      mockPrisma.aiModel.findUnique
        .mockResolvedValueOnce(currentModel) // Load for validation
        .mockResolvedValueOnce(updatedModel); // Re-fetch after update

      mockPrisma.aiModel.update.mockResolvedValue(updatedModel);

      const result = await service.updateModel(currentModel.id as string, {
        displayName: 'Updated Name',
      });

      expect(result.displayName).toBe('Updated Name');
    });

    it('throws NotFoundError when model does not exist', async () => {
      mockPrisma.aiModel.findUnique.mockResolvedValue(null);

      await expect(service.updateModel('nonexistent', { displayName: 'New Name' })).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  // ─── deleteModel ─────────────────────────────────────────────────

  describe('deleteModel', () => {
    it('rejects deletion when model is referenced by agents (422)', async () => {
      const model = makeModelRow({ _count: { agents: 3 } });
      mockPrisma.aiModel.findUnique.mockResolvedValue(model);

      try {
        await service.deleteModel(model.id as string);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(422);
        expect((error as AppError).code).toBe('MODEL_REFERENCED_BY_AGENTS');
        expect((error as AppError).message).toContain('3 agents');
      }
    });

    it('deletes model when unreferenced', async () => {
      const model = makeModelRow({ _count: { agents: 0 } });
      mockPrisma.aiModel.findUnique.mockResolvedValue(model);
      mockPrisma.aiModel.delete.mockResolvedValue(model);

      await service.deleteModel(model.id as string);

      expect(mockPrisma.aiModel.delete).toHaveBeenCalledWith({
        where: { id: model.id },
      });
      expect(mockLogger.info).toHaveBeenCalled();
    });

    it('throws NotFoundError when model does not exist', async () => {
      mockPrisma.aiModel.findUnique.mockResolvedValue(null);

      await expect(service.deleteModel('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── detectFallbackCycle ─────────────────────────────────────────

  describe('detectFallbackCycle', () => {
    it('detects direct self-reference', async () => {
      // Self-reference is caught before the DB query
      const result = await service.detectFallbackCycle('model-a', 'model-a');
      expect(result).toBe(true);
      expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('detects indirect cycle (A→B→A) via $queryRaw CTE', async () => {
      // The recursive CTE finds that B's fallback chain leads back to A
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ has_cycle: true, chain_depth: 1 }]);

      const result = await service.detectFallbackCycle('model-a', 'model-b');
      expect(result).toBe(true);
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('returns false for valid chain (A→B→C, no cycle)', async () => {
      // The recursive CTE finds no cycle in the chain
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ has_cycle: false, chain_depth: 2 }]);

      const result = await service.detectFallbackCycle('model-a', 'model-b');
      expect(result).toBe(false);
    });

    it('returns false when no chain exists (empty result)', async () => {
      // No rows returned means fallback model has no further chain
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      const result = await service.detectFallbackCycle('model-a', 'model-b');
      expect(result).toBe(false);
    });

    it('treats chains deeper than 10 as problematic', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ has_cycle: false, chain_depth: 10 }]);

      const result = await service.detectFallbackCycle('model-0', 'model-1');
      expect(result).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });
});
