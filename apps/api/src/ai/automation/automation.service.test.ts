import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock chain detection ──────────────────────────────────────────────────

const { mockDetectCycleInChain } = vi.hoisted(() => ({
  mockDetectCycleInChain: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./chain-detection.js', () => ({
  detectCycleInChain: mockDetectCycleInChain,
  ChainCycleError: class ChainCycleError extends Error {
    statusCode = 422;
    constructor(path: string[]) {
      super(`Circular chain detected: ${path.join(' → ')}`);
    }
  },
  ChainDepthExceededError: class ChainDepthExceededError extends Error {
    statusCode = 422;
    constructor(depth: number) {
      super(`Chain depth exceeds maximum of 10 (found ${depth})`);
    }
  },
}));

// ─── Imports ────────────────────────────────────────────────────────────────

import { AutomationService } from './automation.service.js';
import type { CreateAutomationInput, UpdateAutomationInput } from './automation.schemas.js';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

function createMockEventBus() {
  return {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  };
}

const now = new Date('2026-03-03T10:00:00Z');

function createMockDb() {
  return {
    aiAutomation: {
      create: vi.fn(),
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
    aiAutomationStep: {
      deleteMany: vi.fn(),
    },
    aiPromptVariable: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation(async (cb: Function) =>
      cb({
        aiAutomation: {
          create: vi.fn().mockResolvedValue(makeAutomationRow()),
          update: vi.fn().mockResolvedValue(makeAutomationRow()),
        },
        aiAutomationStep: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      }),
    ),
  } as any;
}

function createMockScheduler() {
  return {
    addSchedule: vi.fn().mockResolvedValue(undefined),
    removeSchedule: vi.fn().mockResolvedValue(undefined),
    updateSchedule: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function createMockEventListener() {
  return {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    updateSubscription: vi.fn(),
  } as any;
}

function createMockExecutor() {
  return {
    execute: vi.fn().mockResolvedValue({ runId: 'run-1', status: 'COMPLETED' }),
  } as any;
}

function makeAutomationRow(overrides: Record<string, any> = {}) {
  return {
    id: 'auto-1',
    name: 'Test Automation',
    description: 'Test desc',
    triggerType: 'MANUAL',
    eventType: null,
    chainFromId: null,
    chainNextId: null,
    notificationConfig: null,
    maxTokenBudget: 50000,
    maxDurationMs: 300000,
    isActive: true,
    createdById: 'user-1',
    createdAt: now,
    updatedAt: now,
    schedule: null,
    steps: [
      {
        id: 'step-1',
        stepOrder: 1,
        agentId: 'agent-1',
        goal: 'Test step',
        inputConfig: {},
        outputConfig: {},
        maxTurns: 10,
        agent: { displayName: 'Test Agent' },
      },
    ],
    runs: [],
    ...overrides,
  };
}

function makeCreateInput(overrides: Partial<CreateAutomationInput> = {}): CreateAutomationInput {
  return {
    name: 'New Automation',
    triggerType: 'MANUAL',
    steps: [
      {
        agentId: 'agent-1',
        goal: 'Do something',
        inputConfig: {},
        outputConfig: {},
        maxTurns: 10,
      },
    ],
    maxTokenBudget: 50000,
    maxDurationMs: 300000,
    ...overrides,
  } as CreateAutomationInput;
}

function createService(overrides: Record<string, any> = {}) {
  const db = createMockDb();
  const eventBus = createMockEventBus();
  const scheduler = createMockScheduler();
  const eventListener = createMockEventListener();
  const executor = createMockExecutor();

  const service = new AutomationService({
    db,
    eventBus: eventBus as any,
    logger: mockLogger as any,
    scheduler,
    eventListener,
    executor,
    ...overrides,
  });

  return { service, db, eventBus, scheduler, eventListener, executor };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AutomationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Create automation
  // =========================================================================

  describe('createAutomation()', () => {
    it('creates automation with all trigger types', async () => {
      const { service, db } = createService();

      db.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          aiAutomation: {
            create: vi.fn().mockResolvedValue(makeAutomationRow()),
          },
        };
        return cb(tx);
      });

      const result = await service.createAutomation('comp-1', 'user-1', makeCreateInput());

      expect(result).toBeDefined();
      expect(result.id).toBe('auto-1');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ automationId: 'auto-1', triggerType: 'MANUAL' }),
        'Automation created',
      );
    });

    it('registers schedule for SCHEDULED trigger type', async () => {
      const { service, db, scheduler } = createService();

      db.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          aiAutomation: {
            create: vi.fn().mockResolvedValue(makeAutomationRow({ triggerType: 'SCHEDULED' })),
          },
        };
        return cb(tx);
      });

      await service.createAutomation(
        'comp-1',
        'user-1',
        makeCreateInput({
          triggerType: 'SCHEDULED',
          schedule: { cronExpression: '0 7 * * 1-5', timezone: 'Europe/London', isPaused: false },
        }),
      );

      expect(scheduler.addSchedule).toHaveBeenCalledWith(
        'auto-1',
        'comp-1',
        '0 7 * * 1-5',
        'Europe/London',
      );
    });

    it('subscribes event listener for EVENT trigger type', async () => {
      const { service, db, eventListener } = createService();

      db.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          aiAutomation: {
            create: vi
              .fn()
              .mockResolvedValue(
                makeAutomationRow({ triggerType: 'EVENT', eventType: 'InvoiceOverdue' }),
              ),
          },
        };
        return cb(tx);
      });

      await service.createAutomation(
        'comp-1',
        'user-1',
        makeCreateInput({
          triggerType: 'EVENT',
          eventType: 'InvoiceOverdue',
        }),
      );

      expect(eventListener.subscribe).toHaveBeenCalledWith('auto-1', 'InvoiceOverdue');
    });

    it('rejects 422 on circular chain creation', async () => {
      const { service, db } = createService();

      const { ChainCycleError } = await import('./chain-detection.js');

      db.aiAutomation.findUnique.mockResolvedValue({ id: 'auto-2', companyId: 'comp-1' });
      db.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          aiAutomation: {
            create: vi.fn().mockResolvedValue(makeAutomationRow({ chainNextId: 'auto-2' })),
          },
        };
        const result = await cb(tx);
        return result;
      });

      mockDetectCycleInChain.mockRejectedValue(new ChainCycleError(['auto-1', 'auto-2', 'auto-1']));

      await expect(
        service.createAutomation('comp-1', 'user-1', makeCreateInput({ chainNextId: 'auto-2' })),
      ).rejects.toThrow(/Circular chain detected/);
    });

    it('rejects chain target from different company', async () => {
      const { service, db } = createService();

      db.aiAutomation.findUnique.mockResolvedValue({ id: 'auto-2', companyId: 'comp-other' });

      await expect(
        service.createAutomation('comp-1', 'user-1', makeCreateInput({ chainNextId: 'auto-2' })),
      ).rejects.toThrow('Chain target automation not found in this company');
    });
  });

  // =========================================================================
  // List automations with pagination and filters
  // =========================================================================

  describe('listAutomations()', () => {
    it('returns paginated list with cursor', async () => {
      const { service, db } = createService();

      const items = [
        makeAutomationRow({ id: 'auto-1' }),
        makeAutomationRow({ id: 'auto-2' }),
        makeAutomationRow({ id: 'auto-3' }), // extra = hasMore
      ];

      db.aiAutomation.findMany.mockResolvedValue(items);
      db.aiAutomation.count.mockResolvedValue(10);

      const result = await service.listAutomations('comp-1', { limit: 2 } as any);

      expect(result.data).toHaveLength(2);
      expect(result.meta.hasMore).toBe(true);
      expect(result.meta.total).toBe(10);
      expect(result.meta.cursor).toBe('auto-2');
    });

    it('filters by triggerType', async () => {
      const { service, db } = createService();

      db.aiAutomation.findMany.mockResolvedValue([]);
      db.aiAutomation.count.mockResolvedValue(0);

      await service.listAutomations('comp-1', {
        limit: 20,
        triggerType: 'SCHEDULED',
      } as any);

      expect(db.aiAutomation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'comp-1',
            triggerType: 'SCHEDULED',
          }),
        }),
      );
    });

    it('filters by active/inactive status', async () => {
      const { service, db } = createService();

      db.aiAutomation.findMany.mockResolvedValue([]);
      db.aiAutomation.count.mockResolvedValue(0);

      await service.listAutomations('comp-1', {
        limit: 20,
        status: 'active',
      } as any);

      expect(db.aiAutomation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        }),
      );
    });
  });

  // =========================================================================
  // Get automation
  // =========================================================================

  describe('getAutomation()', () => {
    it('returns automation detail with steps and recent runs', async () => {
      const { service, db } = createService();

      db.aiAutomation.findFirst.mockResolvedValue(makeAutomationRow());

      const result = await service.getAutomation('comp-1', 'auto-1');

      expect(result.id).toBe('auto-1');
      expect(result.steps).toHaveLength(1);
    });

    it('throws NotFoundError for nonexistent automation', async () => {
      const { service, db } = createService();

      db.aiAutomation.findFirst.mockResolvedValue(null);

      await expect(service.getAutomation('comp-1', 'nonexistent')).rejects.toThrow(
        'Automation not found',
      );
    });
  });

  // =========================================================================
  // Update automation
  // =========================================================================

  describe('updateAutomation()', () => {
    it('updates automation and refreshes schedule on cron change', async () => {
      const { service, db, scheduler } = createService();

      db.aiAutomation.findFirst.mockResolvedValue({
        id: 'auto-1',
        triggerType: 'SCHEDULED',
        eventType: null,
        isActive: true,
        schedule: { id: 'sched-1', cronExpression: '0 7 * * *', timezone: 'Europe/London' },
      });

      db.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          aiAutomationStep: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          aiAutomation: {
            update: vi.fn().mockResolvedValue(makeAutomationRow({ triggerType: 'SCHEDULED' })),
          },
        };
        return cb(tx);
      });

      await service.updateAutomation('comp-1', 'auto-1', {
        schedule: { cronExpression: '0 9 * * *', timezone: 'Europe/Berlin' },
      } as UpdateAutomationInput);

      expect(scheduler.updateSchedule).toHaveBeenCalledWith(
        'auto-1',
        'comp-1',
        '0 9 * * *',
        'Europe/Berlin',
      );
    });

    it('removes schedule when deactivating', async () => {
      const { service, db, scheduler } = createService();

      db.aiAutomation.findFirst.mockResolvedValue({
        id: 'auto-1',
        triggerType: 'SCHEDULED',
        eventType: null,
        isActive: true,
        schedule: { id: 'sched-1', cronExpression: '0 7 * * *', timezone: 'Europe/London' },
      });

      db.$transaction.mockImplementation(async (cb: Function) => {
        const tx = {
          aiAutomationStep: { deleteMany: vi.fn() },
          aiAutomation: {
            update: vi.fn().mockResolvedValue(makeAutomationRow({ isActive: false })),
          },
        };
        return cb(tx);
      });

      await service.updateAutomation('comp-1', 'auto-1', {
        isActive: false,
      } as UpdateAutomationInput);

      expect(scheduler.removeSchedule).toHaveBeenCalledWith('auto-1');
    });
  });

  // =========================================================================
  // Delete automation (soft-delete)
  // =========================================================================

  describe('deleteAutomation()', () => {
    it('soft-deletes by setting isActive = false', async () => {
      const { service, db } = createService();

      db.aiAutomation.findFirst.mockResolvedValue({
        id: 'auto-1',
        triggerType: 'MANUAL',
      });

      await service.deleteAutomation('comp-1', 'auto-1');

      expect(db.aiAutomation.update).toHaveBeenCalledWith({
        where: { id: 'auto-1' },
        data: { isActive: false },
      });
    });

    it('removes schedule on delete of SCHEDULED automation', async () => {
      const { service, db, scheduler } = createService();

      db.aiAutomation.findFirst.mockResolvedValue({
        id: 'auto-1',
        triggerType: 'SCHEDULED',
      });

      await service.deleteAutomation('comp-1', 'auto-1');

      expect(scheduler.removeSchedule).toHaveBeenCalledWith('auto-1');
    });

    it('unsubscribes event listener on delete of EVENT automation', async () => {
      const { service, db, eventListener } = createService();

      db.aiAutomation.findFirst.mockResolvedValue({
        id: 'auto-1',
        triggerType: 'EVENT',
      });

      await service.deleteAutomation('comp-1', 'auto-1');

      expect(eventListener.unsubscribe).toHaveBeenCalledWith('auto-1');
    });

    it('throws NotFoundError when automation not found', async () => {
      const { service, db } = createService();

      db.aiAutomation.findFirst.mockResolvedValue(null);

      await expect(service.deleteAutomation('comp-1', 'nonexistent')).rejects.toThrow(
        'Automation not found',
      );
    });

    it('preserves run history after soft-delete', async () => {
      const { service, db } = createService();

      db.aiAutomation.findFirst.mockResolvedValue({
        id: 'auto-1',
        triggerType: 'MANUAL',
      });

      await service.deleteAutomation('comp-1', 'auto-1');

      // Only update isActive, never delete the record
      expect(db.aiAutomation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: false },
        }),
      );
    });
  });

  // =========================================================================
  // Run Now (manual trigger)
  // =========================================================================

  describe('runAutomation()', () => {
    it('triggers manual execution with correct triggeredBy', async () => {
      const { service, db, executor } = createService();

      db.aiAutomation.findFirst.mockResolvedValue({ id: 'auto-1', isActive: true });

      await service.runAutomation('comp-1', 'auto-1', 'user-1', { key: 'val' });

      expect(executor.execute).toHaveBeenCalledWith({
        automationId: 'auto-1',
        input: { key: 'val' },
        triggeredBy: 'manual:user-1',
      });
    });

    it('throws 503 when executor unavailable', async () => {
      const { service } = createService({ executor: null });

      await expect(service.runAutomation('comp-1', 'auto-1', 'user-1')).rejects.toThrow(
        'Automation executor is not available',
      );
    });

    it('throws 422 when automation is inactive', async () => {
      const { service, db } = createService();

      db.aiAutomation.findFirst.mockResolvedValue({ id: 'auto-1', isActive: false });

      await expect(service.runAutomation('comp-1', 'auto-1', 'user-1')).rejects.toThrow(
        'Cannot run an inactive automation',
      );
    });
  });

  // ─── Variable CRUD ───────────────────────────────────────────────────────

  describe('createVariable()', () => {
    it('creates a variable when prompt exists', async () => {
      const { service, db } = createService();

      db.aiPrompt = {
        findUnique: vi.fn().mockResolvedValue({ id: 'prompt-1' }),
      };
      db.aiPromptVariable = {
        ...db.aiPromptVariable,
        create: vi.fn().mockResolvedValue({
          id: 'var-1',
          promptId: 'prompt-1',
          variableName: 'company.name',
          displayName: 'Company Name',
          description: null,
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'company.name' },
          defaultValue: null,
          isRequired: false,
          createdAt: now,
          updatedAt: now,
          prompt: { name: 'test-prompt' },
        }),
      };

      const result = await service.createVariable({
        promptId: 'prompt-1',
        variableName: 'company.name',
        displayName: 'Company Name',
        sourceType: 'SYSTEM',
        sourceConfig: { variable: 'company.name' },
        isRequired: false,
      } as any);

      expect(result.id).toBe('var-1');
      expect(result.variableName).toBe('company.name');
      expect(result.promptName).toBe('test-prompt');
      expect(result.sourceType).toBe('SYSTEM');
      expect(db.aiPromptVariable.create).toHaveBeenCalledOnce();
    });

    it('throws NotFoundError when prompt does not exist', async () => {
      const { service, db } = createService();

      db.aiPrompt = {
        findUnique: vi.fn().mockResolvedValue(null),
      };

      await expect(
        service.createVariable({
          promptId: 'nonexistent',
          variableName: 'test',
          displayName: 'Test',
          sourceType: 'CONSTANT',
          sourceConfig: { value: 'x' },
          isRequired: false,
        } as any),
      ).rejects.toThrow('Prompt not found');
    });

    it('creates variables for each sourceType', async () => {
      const sourceTypes = [
        'DB_FIELD',
        'DB_QUERY',
        'PAGE_FIELD',
        'SYSTEM',
        'CONSTANT',
        'EXPRESSION',
        'PREVIOUS_STEP',
      ] as const;

      for (const sourceType of sourceTypes) {
        const { service, db } = createService();

        db.aiPrompt = {
          findUnique: vi.fn().mockResolvedValue({ id: 'prompt-1' }),
        };
        db.aiPromptVariable = {
          ...db.aiPromptVariable,
          create: vi.fn().mockResolvedValue({
            id: `var-${sourceType}`,
            promptId: 'prompt-1',
            variableName: `test.${sourceType}`,
            displayName: `Test ${sourceType}`,
            description: null,
            sourceType,
            sourceConfig: { value: 'test' },
            defaultValue: null,
            isRequired: false,
            createdAt: now,
            updatedAt: now,
            prompt: { name: 'test-prompt' },
          }),
        };

        const result = await service.createVariable({
          promptId: 'prompt-1',
          variableName: `test.${sourceType}`,
          displayName: `Test ${sourceType}`,
          sourceType,
          sourceConfig: { value: 'test' },
          isRequired: false,
        } as any);

        expect(result.sourceType).toBe(sourceType);
      }
    });
  });

  describe('updateVariable()', () => {
    it('updates an existing variable', async () => {
      const { service, db } = createService();

      db.aiPromptVariable = {
        ...db.aiPromptVariable,
        findUnique: vi.fn().mockResolvedValue({ id: 'var-1' }),
        update: vi.fn().mockResolvedValue({
          id: 'var-1',
          promptId: 'prompt-1',
          variableName: 'company.name',
          displayName: 'Updated Name',
          description: 'Updated desc',
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'company.name' },
          defaultValue: 'fallback',
          isRequired: true,
          createdAt: now,
          updatedAt: now,
          prompt: { name: 'test-prompt' },
        }),
      };

      const result = await service.updateVariable('var-1', {
        displayName: 'Updated Name',
        description: 'Updated desc',
        defaultValue: 'fallback',
        isRequired: true,
      });

      expect(result.displayName).toBe('Updated Name');
      expect(result.description).toBe('Updated desc');
      expect(result.defaultValue).toBe('fallback');
      expect(result.isRequired).toBe(true);
      expect(db.aiPromptVariable.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'var-1' },
          data: expect.objectContaining({
            displayName: 'Updated Name',
            description: 'Updated desc',
            defaultValue: 'fallback',
            isRequired: true,
          }),
        }),
      );
    });

    it('throws NotFoundError when variable does not exist', async () => {
      const { service, db } = createService();

      db.aiPromptVariable = {
        ...db.aiPromptVariable,
        findUnique: vi.fn().mockResolvedValue(null),
      };

      await expect(service.updateVariable('nonexistent', { displayName: 'X' })).rejects.toThrow(
        'Prompt variable not found',
      );
    });
  });

  describe('deleteVariable()', () => {
    it('deletes an existing variable', async () => {
      const { service, db } = createService();

      db.aiPromptVariable = {
        ...db.aiPromptVariable,
        findUnique: vi.fn().mockResolvedValue({ id: 'var-1', variableName: 'test' }),
        delete: vi.fn().mockResolvedValue({}),
      };

      await service.deleteVariable('var-1');

      expect(db.aiPromptVariable.delete).toHaveBeenCalledWith({
        where: { id: 'var-1' },
      });
    });

    it('throws NotFoundError when variable does not exist', async () => {
      const { service, db } = createService();

      db.aiPromptVariable = {
        ...db.aiPromptVariable,
        findUnique: vi.fn().mockResolvedValue(null),
      };

      await expect(service.deleteVariable('nonexistent')).rejects.toThrow(
        'Prompt variable not found',
      );
    });
  });

  describe('listVariables()', () => {
    it('returns variables grouped by sourceType', async () => {
      const { service, db } = createService();

      db.aiPromptVariable.findMany.mockResolvedValue([
        {
          id: 'v1',
          promptId: 'p1',
          variableName: 'today',
          displayName: 'Today',
          description: null,
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'today' },
          defaultValue: null,
          isRequired: false,
          prompt: { name: 'prompt-1' },
        },
        {
          id: 'v2',
          promptId: 'p1',
          variableName: 'company.name',
          displayName: 'Company',
          description: null,
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'company.name' },
          defaultValue: null,
          isRequired: false,
          prompt: { name: 'prompt-1' },
        },
        {
          id: 'v3',
          promptId: 'p1',
          variableName: 'greeting',
          displayName: 'Greeting',
          description: null,
          sourceType: 'CONSTANT',
          sourceConfig: { value: 'Hello' },
          defaultValue: null,
          isRequired: false,
          prompt: { name: 'prompt-1' },
        },
      ]);

      const result = await service.listVariables('comp-1');

      // Grouped by sourceType
      expect(result['SYSTEM']).toHaveLength(2);
      expect(result['CONSTANT']).toHaveLength(1);
      expect(result['SYSTEM']![0]!.variableName).toBe('today');
      expect(result['SYSTEM']![1]!.variableName).toBe('company.name');
      expect(result['CONSTANT']![0]!.variableName).toBe('greeting');

      // Includes promptName in each item
      expect(result['SYSTEM']![0]!.promptName).toBe('prompt-1');
    });

    it('filters variables by promptId when provided', async () => {
      const { service, db } = createService();

      db.aiPromptVariable.findMany.mockResolvedValue([]);

      await service.listVariables('comp-1', { promptId: 'prompt-99' });

      expect(db.aiPromptVariable.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { promptId: 'prompt-99' },
        }),
      );
    });

    it('returns all variables when no promptId filter', async () => {
      const { service, db } = createService();

      db.aiPromptVariable.findMany.mockResolvedValue([]);

      await service.listVariables('comp-1');

      expect(db.aiPromptVariable.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
        }),
      );
    });
  });

  describe('testResolveVariable()', () => {
    it('resolves a SYSTEM variable with test context', async () => {
      const { service, db } = createService();

      db.aiPromptVariable = {
        ...db.aiPromptVariable,
        findUnique: vi.fn().mockResolvedValue({
          id: 'var-1',
          promptId: 'prompt-1',
          variableName: 'company.name',
          displayName: 'Company Name',
          description: null,
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'company.name' },
          defaultValue: null,
          isRequired: false,
          createdAt: now,
          updatedAt: now,
        }),
      };

      const result = await service.testResolveVariable('var-1', 'comp-1', {
        companyName: 'Acme Ltd',
      });

      expect(result.variableId).toBe('var-1');
      expect(result.variableName).toBe('company.name');
      expect(result.sourceType).toBe('SYSTEM');
      expect(result.resolvedValue).toBe('Acme Ltd');
      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      expect(typeof result.resolveTimeMs).toBe('number');
    });

    it('resolves a CONSTANT variable', async () => {
      const { service, db } = createService();

      db.aiPromptVariable = {
        ...db.aiPromptVariable,
        findUnique: vi.fn().mockResolvedValue({
          id: 'var-2',
          promptId: 'prompt-1',
          variableName: 'greeting',
          displayName: 'Greeting',
          description: null,
          sourceType: 'CONSTANT',
          sourceConfig: { value: 'Hello World' },
          defaultValue: null,
          isRequired: false,
          createdAt: now,
          updatedAt: now,
        }),
      };

      const result = await service.testResolveVariable('var-2', 'comp-1', {});

      expect(result.resolvedValue).toBe('Hello World');
      expect(result.success).toBe(true);
    });

    it('resolves a PAGE_FIELD variable with pageContext', async () => {
      const { service, db } = createService();

      db.aiPromptVariable = {
        ...db.aiPromptVariable,
        findUnique: vi.fn().mockResolvedValue({
          id: 'var-3',
          promptId: 'prompt-1',
          variableName: 'currentFilter',
          displayName: 'Current Filter',
          description: null,
          sourceType: 'PAGE_FIELD',
          sourceConfig: { field: 'filters.status' },
          defaultValue: null,
          isRequired: false,
          createdAt: now,
          updatedAt: now,
        }),
      };

      const result = await service.testResolveVariable('var-3', 'comp-1', {
        pageContext: { filters: { status: 'OVERDUE' } },
      });

      expect(result.resolvedValue).toBe('OVERDUE');
      expect(result.success).toBe(true);
    });

    it('throws NotFoundError when variable does not exist', async () => {
      const { service, db } = createService();

      db.aiPromptVariable = {
        ...db.aiPromptVariable,
        findUnique: vi.fn().mockResolvedValue(null),
      };

      await expect(service.testResolveVariable('nonexistent', 'comp-1', {})).rejects.toThrow(
        'Prompt variable not found',
      );
    });

    it('returns null resolvedValue for unresolvable variable', async () => {
      const { service, db } = createService();

      db.aiPromptVariable = {
        ...db.aiPromptVariable,
        findUnique: vi.fn().mockResolvedValue({
          id: 'var-4',
          promptId: 'prompt-1',
          variableName: 'unknownSys',
          displayName: 'Unknown',
          description: null,
          sourceType: 'SYSTEM',
          sourceConfig: { key: 'nonexistent.key' },
          defaultValue: null,
          isRequired: false,
          createdAt: now,
          updatedAt: now,
        }),
      };

      const result = await service.testResolveVariable('var-4', 'comp-1', {});

      expect(result.resolvedValue).toBeNull();
      expect(result.success).toBe(true);
    });
  });
});
