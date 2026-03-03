import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock chain detection ──────────────────────────────────────────────────

vi.mock('./chain-detection.js', () => ({
  detectCycleInChain: vi.fn().mockResolvedValue(undefined),
  ChainCycleError: class extends Error {
    statusCode = 422;
    constructor() {
      super('cycle');
    }
  },
  ChainDepthExceededError: class extends Error {
    statusCode = 422;
    constructor() {
      super('depth');
    }
  },
}));

// ─── Imports ────────────────────────────────────────────────────────────────

import { AutomationService } from './automation.service.js';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const now = new Date('2026-03-03T10:00:00Z');
const oneHourAgo = new Date('2026-03-03T09:00:00Z');

function makeRunRow(overrides: Record<string, any> = {}) {
  return {
    id: 'run-1',
    automationId: 'auto-1',
    triggeredBy: 'manual:user-1',
    status: 'COMPLETED',
    startedAt: oneHourAgo,
    completedAt: now,
    totalTokens: 1500,
    totalCost: { toString: () => '0.0500' },
    result: { summary: 'done' },
    error: null,
    retryOfRunId: null,
    createdAt: oneHourAgo,
    automation: { name: 'Test Automation' },
    stepRuns: [
      {
        id: 'sr-1',
        stepId: 'step-1',
        agentId: 'agent-1',
        modelId: 'claude-sonnet',
        status: 'COMPLETED',
        input: { data: 'input' },
        output: { summary: 'done' },
        error: null,
        inputTokens: 1000,
        outputTokens: 500,
        latencyMs: 2500,
        turns: 3,
        startedAt: oneHourAgo,
        completedAt: now,
        step: { stepOrder: 1 },
      },
    ],
    ...overrides,
  };
}

function createMockDb() {
  return {
    aiAutomation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    aiAutomationRun: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    aiPromptVariable: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  } as any;
}

function createService() {
  const db = createMockDb();
  const executor = {
    execute: vi.fn().mockResolvedValue({ runId: 'run-new', status: 'COMPLETED' }),
  };

  const service = new AutomationService({
    db,
    eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as any,
    logger: mockLogger as any,
    scheduler: null,
    eventListener: null,
    executor: executor as any,
  });

  return { service, db, executor };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AutomationService — Run History', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // List runs with filters and pagination
  // =========================================================================

  describe('listRuns()', () => {
    it('returns paginated run list with cursor-based pagination', async () => {
      const { service, db } = createService();

      const runs = [
        makeRunRow({ id: 'run-1' }),
        makeRunRow({ id: 'run-2' }),
        makeRunRow({ id: 'run-3' }), // extra = hasMore
      ];

      db.aiAutomationRun.findMany.mockResolvedValue(runs);
      db.aiAutomationRun.count.mockResolvedValue(25);

      const result = await service.listRuns('comp-1', undefined, {
        limit: 2,
      } as any);

      expect(result.data).toHaveLength(2);
      expect(result.meta.hasMore).toBe(true);
      expect(result.meta.total).toBe(25);
      expect(result.meta.cursor).toBe('run-2');
    });

    it('filters by status', async () => {
      const { service, db } = createService();

      db.aiAutomationRun.findMany.mockResolvedValue([]);
      db.aiAutomationRun.count.mockResolvedValue(0);

      await service.listRuns('comp-1', undefined, {
        limit: 50,
        status: 'FAILED',
      } as any);

      expect(db.aiAutomationRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'FAILED',
          }),
        }),
      );
    });

    it('filters by date range', async () => {
      const { service, db } = createService();

      const dateFrom = new Date('2026-03-01');
      const dateTo = new Date('2026-03-03');

      db.aiAutomationRun.findMany.mockResolvedValue([]);
      db.aiAutomationRun.count.mockResolvedValue(0);

      await service.listRuns('comp-1', undefined, {
        limit: 50,
        dateFrom,
        dateTo,
      } as any);

      expect(db.aiAutomationRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: dateFrom,
              lte: dateTo,
            },
          }),
        }),
      );
    });

    it('scopes by automationId when provided', async () => {
      const { service, db } = createService();

      db.aiAutomationRun.findMany.mockResolvedValue([]);
      db.aiAutomationRun.count.mockResolvedValue(0);

      await service.listRuns('comp-1', 'auto-1', {
        limit: 50,
      } as any);

      expect(db.aiAutomationRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            automationId: 'auto-1',
          }),
        }),
      );
    });

    it('scopes all queries by companyId through automation relation', async () => {
      const { service, db } = createService();

      db.aiAutomationRun.findMany.mockResolvedValue([]);
      db.aiAutomationRun.count.mockResolvedValue(0);

      await service.listRuns('comp-1', undefined, {
        limit: 50,
      } as any);

      expect(db.aiAutomationRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            automation: { companyId: 'comp-1' },
          }),
        }),
      );
    });

    it('defaults to 50 per page', async () => {
      const { service, db } = createService();

      db.aiAutomationRun.findMany.mockResolvedValue([]);
      db.aiAutomationRun.count.mockResolvedValue(0);

      await service.listRuns('comp-1', undefined, {
        limit: 50,
      } as any);

      expect(db.aiAutomationRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 51, // limit + 1 for hasMore check
        }),
      );
    });

    it('returns hasMore = false when no extra items', async () => {
      const { service, db } = createService();

      db.aiAutomationRun.findMany.mockResolvedValue([makeRunRow({ id: 'run-1' })]);
      db.aiAutomationRun.count.mockResolvedValue(1);

      const result = await service.listRuns('comp-1', undefined, {
        limit: 50,
      } as any);

      expect(result.meta.hasMore).toBe(false);
      expect(result.meta.cursor).toBeNull();
    });

    it('formats run dates as ISO strings', async () => {
      const { service, db } = createService();

      db.aiAutomationRun.findMany.mockResolvedValue([makeRunRow()]);
      db.aiAutomationRun.count.mockResolvedValue(1);

      const result = await service.listRuns('comp-1', undefined, {
        limit: 50,
      } as any);

      const run = result.data[0] as any;
      expect(run.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(run.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(run.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  // =========================================================================
  // Get run detail with step runs
  // =========================================================================

  describe('getRun()', () => {
    it('returns run detail with step runs', async () => {
      const { service, db } = createService();

      db.aiAutomationRun.findFirst.mockResolvedValue(makeRunRow());

      const result = await service.getRun('comp-1', 'run-1');

      expect(result.id).toBe('run-1');
      expect(result.automationName).toBe('Test Automation');
      expect(result.stepRuns).toHaveLength(1);
      expect(result.stepRuns[0]!.stepOrder).toBe(1);
      expect(result.stepRuns[0]!.inputTokens).toBe(1000);
      expect(result.stepRuns[0]!.outputTokens).toBe(500);
      expect(result.stepRuns[0]!.latencyMs).toBe(2500);
      expect(result.stepRuns[0]!.turns).toBe(3);
    });

    it('throws NotFoundError for nonexistent run', async () => {
      const { service, db } = createService();

      db.aiAutomationRun.findFirst.mockResolvedValue(null);

      await expect(service.getRun('comp-1', 'nonexistent')).rejects.toThrow(
        'Automation run not found',
      );
    });

    it('scopes run query by companyId', async () => {
      const { service, db } = createService();

      db.aiAutomationRun.findFirst.mockResolvedValue(makeRunRow());

      await service.getRun('comp-1', 'run-1');

      expect(db.aiAutomationRun.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'run-1',
            automation: { companyId: 'comp-1' },
          },
        }),
      );
    });

    it('includes totalCost as string', async () => {
      const { service, db } = createService();

      db.aiAutomationRun.findFirst.mockResolvedValue(makeRunRow());

      const result = await service.getRun('comp-1', 'run-1');

      expect(result.totalCost).toBe('0.0500');
    });
  });

  // =========================================================================
  // Retry from failed step
  // =========================================================================

  describe('retryFromFailedStep()', () => {
    it('retries from failed step with original input', async () => {
      const { service, db, executor } = createService();

      db.aiAutomationRun.findFirst.mockResolvedValue({
        id: 'run-1',
        automationId: 'auto-1',
        status: 'FAILED',
        automation: { isActive: true },
        stepRuns: [
          {
            id: 'sr-1',
            stepId: 'step-1',
            status: 'COMPLETED',
            input: { a: 1 },
            step: { stepOrder: 1 },
          },
          {
            id: 'sr-2',
            stepId: 'step-2',
            status: 'FAILED',
            input: { b: 2 },
            step: { stepOrder: 2 },
          },
        ],
      });

      const result = await service.retryFromFailedStep('comp-1', 'run-1');

      expect(result.message).toBe('Retry started');
      expect(result.originalRunId).toBe('run-1');
      expect(executor.execute).toHaveBeenCalledWith({
        automationId: 'auto-1',
        input: { b: 2 },
        triggeredBy: 'retry:run-1',
      });
    });

    it('throws 422 when run status is not FAILED', async () => {
      const { service, db } = createService();

      db.aiAutomationRun.findFirst.mockResolvedValue({
        id: 'run-1',
        automationId: 'auto-1',
        status: 'COMPLETED',
        automation: { isActive: true },
        stepRuns: [],
      });

      await expect(service.retryFromFailedStep('comp-1', 'run-1')).rejects.toThrow(
        'Can only retry runs with FAILED status',
      );
    });

    it('throws 422 when automation is inactive', async () => {
      const { service, db } = createService();

      db.aiAutomationRun.findFirst.mockResolvedValue({
        id: 'run-1',
        automationId: 'auto-1',
        status: 'FAILED',
        automation: { isActive: false },
        stepRuns: [],
      });

      await expect(service.retryFromFailedStep('comp-1', 'run-1')).rejects.toThrow(
        'Cannot retry a run for an inactive automation',
      );
    });

    it('throws 503 when executor unavailable', async () => {
      // Create a new service without executor
      const db2 = createMockDb();
      const svc = new AutomationService({
        db: db2,
        eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() } as any,
        logger: mockLogger as any,
        scheduler: null,
        eventListener: null,
        executor: null,
      });

      await expect(svc.retryFromFailedStep('comp-1', 'run-1')).rejects.toThrow(
        'Automation executor is not available',
      );
    });
  });

  // =========================================================================
  // Variable Registry
  // =========================================================================

  describe('listVariables()', () => {
    it('returns all prompt variables', async () => {
      const { service, db } = createService();

      db.aiPromptVariable.findMany.mockResolvedValue([
        { id: 'v1', variableName: 'today', displayName: 'Today', sourceType: 'SYSTEM' },
        {
          id: 'v2',
          variableName: 'company.name',
          displayName: 'Company Name',
          sourceType: 'SYSTEM',
        },
      ]);

      const result = await service.listVariables('comp-1');

      expect(result).toHaveLength(2);
      expect(db.aiPromptVariable.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ sourceType: 'asc' }, { variableName: 'asc' }],
        }),
      );
    });
  });
});
