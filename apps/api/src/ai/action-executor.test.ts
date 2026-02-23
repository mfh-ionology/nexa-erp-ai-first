import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionExecutor } from './action-executor.js';
import type { ActionHandler } from './action-executor.js';
import type { ActionProposal } from './ai.types.js';

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

function createMockEventBus() {
  return {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
    drain: vi.fn(),
    setLogger: vi.fn(),
    setRetryExecutor: vi.fn(),
    setDeadLetterService: vi.fn(),
  };
}

function createMockDb() {
  return {
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
  };
}

function makeProposal(overrides: Partial<ActionProposal> = {}): ActionProposal {
  return {
    id: 'proposal-1',
    type: 'CREATE_INVOICE',
    description: 'Create invoice for Acme',
    entityType: 'CustomerInvoice',
    previewData: { customerId: 'cust-1', amount: 500, currency: 'GBP' },
    confidence: 0.92,
    ...overrides,
  };
}

function makeExecuteParams(overrides: Partial<Parameters<ActionExecutor['execute']>[0]> = {}) {
  return {
    proposal: makeProposal(),
    conversationId: 'conv-1',
    agentId: 'agent-1',
    userId: 'user-1',
    companyId: 'company-1',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActionExecutor', () => {
  let executor: ActionExecutor;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEventBus: ReturnType<typeof createMockEventBus>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockEventBus = createMockEventBus();
    executor = new ActionExecutor(
      mockDb as any,
      mockEventBus as any,
      mockLogger as any,
    );
  });

  // ─── Handler Registration ──────────────────────────────────────────────

  describe('registerHandler', () => {
    it('registers a handler for an action type', () => {
      const handler: ActionHandler = vi.fn();
      executor.registerHandler('CREATE_INVOICE', handler);

      expect(executor.hasHandler('CREATE_INVOICE')).toBe(true);
      expect(executor.handlerCount).toBe(1);
    });

    it('normalises action type to uppercase', () => {
      const handler: ActionHandler = vi.fn();
      executor.registerHandler('create_invoice', handler);

      expect(executor.hasHandler('CREATE_INVOICE')).toBe(true);
    });

    it('logs handler registration', () => {
      executor.registerHandler('CREATE_INVOICE', vi.fn() as any);

      expect(mockLogger.info).toHaveBeenCalledWith(
        { actionType: 'CREATE_INVOICE' },
        'Action handler registered',
      );
    });
  });

  // ─── Execute with registered handler ──────────────────────────────────

  describe('execute with registered handler', () => {
    it('calls handler and returns success', async () => {
      const handler: ActionHandler = vi.fn().mockResolvedValue({
        entityId: 'inv-123',
        displayRef: 'INV-0001',
      });
      executor.registerHandler('CREATE_INVOICE', handler);

      const result = await executor.execute(makeExecuteParams());

      expect(result.success).toBe(true);
      expect(result.entityType).toBe('CustomerInvoice');
      expect(result.entityId).toBe('inv-123');
      expect(result.displayRef).toBe('INV-0001');
    });

    it('calls handler within a Prisma transaction', async () => {
      const handler: ActionHandler = vi.fn().mockResolvedValue({
        entityId: 'inv-123',
        displayRef: 'INV-0001',
      });
      executor.registerHandler('CREATE_INVOICE', handler);

      await executor.execute(makeExecuteParams());

      expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        expect.anything(), // tx (the mock transaction client)
        'company-1',
        'user-1',
        { customerId: 'cust-1', amount: 500, currency: 'GBP' },
      );
    });

    it('emits ai.action.executed event on success', async () => {
      const handler: ActionHandler = vi.fn().mockResolvedValue({
        entityId: 'inv-123',
        displayRef: 'INV-0001',
      });
      executor.registerHandler('CREATE_INVOICE', handler);

      await executor.execute(makeExecuteParams());

      expect(mockEventBus.emit).toHaveBeenCalledWith('ai.action.executed', {
        agentId: 'agent-1',
        toolName: 'CREATE_INVOICE',
        entityType: 'CustomerInvoice',
        entityId: 'inv-123',
        userId: 'user-1',
        confidence: '0.92',
        companyId: 'company-1',
        conversationId: 'conv-1',
        actionType: 'CREATE',
      });
    });

    it('derives correct audit action type from action prefix', async () => {
      const handler: ActionHandler = vi.fn().mockResolvedValue({
        entityId: 'j-123',
        displayRef: 'JNL-0001',
      });
      executor.registerHandler('POST_JOURNAL', handler);

      await executor.execute(makeExecuteParams({
        proposal: makeProposal({ type: 'POST_JOURNAL', entityType: 'JournalEntry' }),
      }));

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'ai.action.executed',
        expect.objectContaining({ actionType: 'POST' }),
      );
    });
  });

  // ─── Execute with unregistered action type ────────────────────────────

  describe('execute with unregistered action type', () => {
    it('returns ACTION_TYPE_NOT_IMPLEMENTED', async () => {
      const result = await executor.execute(makeExecuteParams());

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ACTION_TYPE_NOT_IMPLEMENTED');
      expect(result.error?.message).toContain('CREATE_INVOICE');
    });

    it('does NOT emit any event', async () => {
      await executor.execute(makeExecuteParams());

      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });
  });

  // ─── Handler failure ──────────────────────────────────────────────────

  describe('handler failure', () => {
    it('returns structured error and does not emit event', async () => {
      const handler: ActionHandler = vi.fn().mockRejectedValue(
        new Error('Validation failed: amount must be positive'),
      );
      executor.registerHandler('CREATE_INVOICE', handler);

      const result = await executor.execute(makeExecuteParams());

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ACTION_EXECUTION_FAILED');
      expect(result.error?.message).toBe('Validation failed: amount must be positive');
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });

    it('logs the error', async () => {
      const handler: ActionHandler = vi.fn().mockRejectedValue(
        new Error('DB constraint violation'),
      );
      executor.registerHandler('CREATE_INVOICE', handler);

      await executor.execute(makeExecuteParams());

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'DB constraint violation',
          actionType: 'CREATE_INVOICE',
        }),
        'Action execution failed',
      );
    });
  });

  // ─── Proposal validation ──────────────────────────────────────────────

  describe('proposal validation', () => {
    it('returns error when proposal has no type', async () => {
      const result = await executor.execute(makeExecuteParams({
        proposal: makeProposal({ type: '' }),
      }));

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PROPOSAL');
    });

    it('returns error when proposal has no entityType', async () => {
      const result = await executor.execute(makeExecuteParams({
        proposal: makeProposal({ entityType: '' }),
      }));

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PROPOSAL');
    });

    it('returns error when proposal has no previewData', async () => {
      const result = await executor.execute(makeExecuteParams({
        proposal: makeProposal({ previewData: undefined as any }),
      }));

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_PROPOSAL');
    });
  });

  // ─── E5-3 MVP: No handlers registered ─────────────────────────────────

  describe('E5-3 MVP (no handlers registered)', () => {
    it('returns ACTION_TYPE_NOT_IMPLEMENTED for any action type', async () => {
      const types = ['CREATE_INVOICE', 'POST_JOURNAL', 'SEND_EMAIL', 'UPDATE_CUSTOMER'];

      for (const type of types) {
        const result = await executor.execute(makeExecuteParams({
          proposal: makeProposal({ type }),
        }));

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('ACTION_TYPE_NOT_IMPLEMENTED');
      }
    });

    it('has zero handlers by default', () => {
      expect(executor.handlerCount).toBe(0);
    });
  });
});
