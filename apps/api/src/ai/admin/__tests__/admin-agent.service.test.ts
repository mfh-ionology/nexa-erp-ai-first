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
  },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { AdminAgentService } from '../admin-agent.service.js';
import { NotFoundError } from '../../../core/errors/not-found-error.js';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function createMockPrisma() {
  return {
    aiAgent: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    aiModel: {
      findUnique: vi.fn(),
    },
    aiPrompt: {
      findUnique: vi.fn(),
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
const AGENT_ID = '00000000-0000-4000-a000-000000000001';
const MODEL_ID = '00000000-0000-4000-a000-000000000002';
const PROMPT_ID = '00000000-0000-4000-a000-000000000003';

function makeAgentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: AGENT_ID,
    name: 'invoice-creator',
    displayName: 'Invoice Creator',
    description: 'Creates invoices from natural language',
    modelId: MODEL_ID,
    promptId: PROMPT_ID,
    routingTags: ['standard'],
    tools: ['create_invoice', 'query_entity'],
    guardrails: {
      canRead: ['customers'],
      canWrite: ['invoices'],
      requiresApproval: false,
      blockedOperations: [],
      dataScope: 'own',
    },
    triggerConfig: [],
    maxTurns: 10,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    model: {
      id: MODEL_ID,
      displayName: 'Claude Opus 4.6',
      name: 'claude-opus',
      provider: 'anthropic',
    },
    prompt: {
      id: PROMPT_ID,
      name: 'invoice-system',
      description: 'Invoice system prompt',
      category: 'system',
    },
    _count: { automationSteps: 0 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mockPrisma: ReturnType<typeof createMockPrisma>;
let service: AdminAgentService;

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma = createMockPrisma();
  service = new AdminAgentService(mockPrisma as any, mockLogger as any);
});

// ---------------------------------------------------------------------------
// listAgents
// ---------------------------------------------------------------------------

describe('listAgents', () => {
  it('returns paginated results with computed fields', async () => {
    const rows = [makeAgentRow()];
    mockPrisma.aiAgent.findMany.mockResolvedValue(rows);
    mockPrisma.aiAgent.count.mockResolvedValue(1);

    const result = await service.listAgents({ limit: 50 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]!.toolCount).toBe(2);
    expect(result.data[0]!.modelDisplayName).toBe('Claude Opus 4.6');
    expect(result.data[0]!.promptName).toBe('invoice-system');
    expect(result.meta.hasMore).toBe(false);
    expect(result.meta.total).toBe(1);
  });

  it('supports search filter', async () => {
    mockPrisma.aiAgent.findMany.mockResolvedValue([]);
    mockPrisma.aiAgent.count.mockResolvedValue(0);

    await service.listAgents({ limit: 50, search: 'invoice' });

    expect(mockPrisma.aiAgent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: 'invoice', mode: 'insensitive' } },
            { displayName: { contains: 'invoice', mode: 'insensitive' } },
            { description: { contains: 'invoice', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('supports isActive filter', async () => {
    mockPrisma.aiAgent.findMany.mockResolvedValue([]);
    mockPrisma.aiAgent.count.mockResolvedValue(0);

    await service.listAgents({ limit: 50, isActive: true });

    expect(mockPrisma.aiAgent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true }),
      }),
    );
  });

  it('cursor pagination — hasMore and nextCursor', async () => {
    // Simulate limit+1 rows → hasMore = true
    const rows = Array.from({ length: 3 }, (_, i) => makeAgentRow({ id: `id-${i}` }));
    mockPrisma.aiAgent.findMany.mockResolvedValue(rows);
    mockPrisma.aiAgent.count.mockResolvedValue(10);

    const result = await service.listAgents({ limit: 2 });

    expect(result.data).toHaveLength(2);
    expect(result.meta.hasMore).toBe(true);
    expect(result.meta.cursor).toBe('id-1');
  });

  it('applies cursor with skip:1 when cursor provided', async () => {
    const cursorId = 'cursor-id';
    mockPrisma.aiAgent.findMany.mockResolvedValue([]);
    mockPrisma.aiAgent.count.mockResolvedValue(0);

    await service.listAgents({ limit: 50, cursor: cursorId });

    expect(mockPrisma.aiAgent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 1,
        cursor: { id: cursorId },
      }),
    );
  });

  it('modelDisplayName is null when model is null (auto-routed)', async () => {
    const row = makeAgentRow({ modelId: null, model: null });
    mockPrisma.aiAgent.findMany.mockResolvedValue([row]);
    mockPrisma.aiAgent.count.mockResolvedValue(1);

    const result = await service.listAgents({ limit: 50 });

    expect(result.data[0]!.modelDisplayName).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getAgent
// ---------------------------------------------------------------------------

describe('getAgent', () => {
  it('returns agent detail with automation step count', async () => {
    mockPrisma.aiAgent.findUnique.mockResolvedValue(makeAgentRow());

    const result = await service.getAgent(AGENT_ID);

    expect(result.id).toBe(AGENT_ID);
    expect(result.tools).toEqual(['create_invoice', 'query_entity']);
    expect(result.automationStepCount).toBe(0);
    expect(result.model).toBeTruthy();
    expect(result.prompt.name).toBe('invoice-system');
  });

  it('throws NotFoundError when agent does not exist', async () => {
    mockPrisma.aiAgent.findUnique.mockResolvedValue(null);

    await expect(service.getAgent('nonexistent')).rejects.toThrow(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// createAgent
// ---------------------------------------------------------------------------

describe('createAgent', () => {
  const validInput = {
    name: 'new-agent',
    displayName: 'New Agent',
    modelId: null as string | null,
    promptId: PROMPT_ID,
    routingTags: ['standard'],
    tools: [],
    guardrails: {
      canRead: [],
      canWrite: [],
      requiresApproval: false,
      blockedOperations: [],
      dataScope: 'own' as const,
    },
    triggerConfig: [],
    maxTurns: 10,
    isActive: true,
  };

  it('creates agent without model (auto-routed)', async () => {
    mockPrisma.aiPrompt.findUnique.mockResolvedValue({ id: PROMPT_ID });
    mockPrisma.aiAgent.create.mockResolvedValue(makeAgentRow({ modelId: null, model: null }));
    mockPrisma.aiAgent.findUnique.mockResolvedValue(makeAgentRow({ modelId: null, model: null }));

    const result = await service.createAgent(validInput);

    expect(result.id).toBe(AGENT_ID);
    expect(mockPrisma.aiModel.findUnique).not.toHaveBeenCalled();
  });

  it('creates agent with valid model', async () => {
    mockPrisma.aiModel.findUnique.mockResolvedValue({ id: MODEL_ID, isActive: true });
    mockPrisma.aiPrompt.findUnique.mockResolvedValue({ id: PROMPT_ID });
    mockPrisma.aiAgent.create.mockResolvedValue(makeAgentRow());
    mockPrisma.aiAgent.findUnique.mockResolvedValue(makeAgentRow());

    const result = await service.createAgent({ ...validInput, modelId: MODEL_ID });

    expect(result.id).toBe(AGENT_ID);
    expect(mockPrisma.aiModel.findUnique).toHaveBeenCalledWith({
      where: { id: MODEL_ID },
      select: { id: true, isActive: true },
    });
  });

  it('rejects duplicate name with 409', async () => {
    mockPrisma.aiPrompt.findUnique.mockResolvedValue({ id: PROMPT_ID });
    mockPrisma.aiAgent.create.mockRejectedValue(
      new MockPrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      }),
    );

    await expect(service.createAgent(validInput)).rejects.toThrow(
      expect.objectContaining({
        code: 'AGENT_NAME_CONFLICT',
        statusCode: 409,
      }),
    );
  });

  it('rejects inactive model with 422', async () => {
    mockPrisma.aiModel.findUnique.mockResolvedValue({ id: MODEL_ID, isActive: false });

    await expect(service.createAgent({ ...validInput, modelId: MODEL_ID })).rejects.toThrow(
      expect.objectContaining({
        code: 'MODEL_INACTIVE',
        statusCode: 422,
      }),
    );
  });

  it('rejects nonexistent model with 422', async () => {
    mockPrisma.aiModel.findUnique.mockResolvedValue(null);

    await expect(service.createAgent({ ...validInput, modelId: 'nonexistent-id' })).rejects.toThrow(
      expect.objectContaining({
        code: 'MODEL_NOT_FOUND',
        statusCode: 422,
      }),
    );
  });

  it('rejects nonexistent prompt with 404', async () => {
    mockPrisma.aiPrompt.findUnique.mockResolvedValue(null);

    await expect(service.createAgent(validInput)).rejects.toThrow(NotFoundError);
    await expect(service.createAgent(validInput)).rejects.toThrow(
      expect.objectContaining({ code: 'PROMPT_NOT_FOUND' }),
    );
  });

  it('re-throws non-P2002 errors', async () => {
    mockPrisma.aiPrompt.findUnique.mockResolvedValue({ id: PROMPT_ID });
    mockPrisma.aiAgent.create.mockRejectedValue(new Error('Database connection lost'));

    await expect(service.createAgent(validInput)).rejects.toThrow('Database connection lost');
  });
});

// ---------------------------------------------------------------------------
// updateAgent
// ---------------------------------------------------------------------------

describe('updateAgent', () => {
  it('updates agent and returns full detail', async () => {
    mockPrisma.aiAgent.findUnique
      .mockResolvedValueOnce(makeAgentRow()) // existence check
      .mockResolvedValueOnce(makeAgentRow({ displayName: 'Updated Agent' })); // getAgent
    mockPrisma.aiAgent.update.mockResolvedValue(makeAgentRow({ displayName: 'Updated Agent' }));

    const result = await service.updateAgent(AGENT_ID, { displayName: 'Updated Agent' });

    expect(result.displayName).toBe('Updated Agent');
    expect(mockPrisma.aiAgent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: AGENT_ID },
        data: { displayName: 'Updated Agent' },
      }),
    );
  });

  it('throws NotFoundError when agent does not exist', async () => {
    mockPrisma.aiAgent.findUnique.mockResolvedValue(null);

    await expect(service.updateAgent('nonexistent', { displayName: 'X' })).rejects.toThrow(
      NotFoundError,
    );
  });

  it('validates model on update if provided', async () => {
    mockPrisma.aiAgent.findUnique.mockResolvedValue(makeAgentRow());
    mockPrisma.aiModel.findUnique.mockResolvedValue({ id: MODEL_ID, isActive: false });

    await expect(service.updateAgent(AGENT_ID, { modelId: MODEL_ID })).rejects.toThrow(
      expect.objectContaining({ code: 'MODEL_INACTIVE', statusCode: 422 }),
    );
  });

  it('validates prompt on update if provided', async () => {
    mockPrisma.aiAgent.findUnique.mockResolvedValue(makeAgentRow());
    mockPrisma.aiPrompt.findUnique.mockResolvedValue(null);

    await expect(service.updateAgent(AGENT_ID, { promptId: 'nonexistent-prompt' })).rejects.toThrow(
      expect.objectContaining({ code: 'PROMPT_NOT_FOUND' }),
    );
  });

  it('rejects duplicate name on update with 409', async () => {
    mockPrisma.aiAgent.findUnique.mockResolvedValue(makeAgentRow());
    mockPrisma.aiAgent.update.mockRejectedValue(
      new MockPrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      }),
    );

    await expect(service.updateAgent(AGENT_ID, { name: 'existing-name' })).rejects.toThrow(
      expect.objectContaining({ code: 'AGENT_NAME_CONFLICT', statusCode: 409 }),
    );
  });
});

// ---------------------------------------------------------------------------
// deleteAgent
// ---------------------------------------------------------------------------

describe('deleteAgent', () => {
  it('deletes unreferenced agent successfully', async () => {
    mockPrisma.aiAgent.findUnique.mockResolvedValue(
      makeAgentRow({ _count: { automationSteps: 0 } }),
    );
    mockPrisma.aiAgent.delete.mockResolvedValue(undefined);

    await expect(service.deleteAgent(AGENT_ID)).resolves.toBeUndefined();
    expect(mockPrisma.aiAgent.delete).toHaveBeenCalledWith({ where: { id: AGENT_ID } });
  });

  it('rejects deletion when referenced by automation steps (422)', async () => {
    mockPrisma.aiAgent.findUnique.mockResolvedValue(
      makeAgentRow({ _count: { automationSteps: 3 } }),
    );

    await expect(service.deleteAgent(AGENT_ID)).rejects.toThrow(
      expect.objectContaining({
        code: 'AGENT_REFERENCED_BY_STEPS',
        statusCode: 422,
      }),
    );

    expect(mockPrisma.aiAgent.delete).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when agent does not exist', async () => {
    mockPrisma.aiAgent.findUnique.mockResolvedValue(null);

    await expect(service.deleteAgent('nonexistent')).rejects.toThrow(NotFoundError);
  });
});
