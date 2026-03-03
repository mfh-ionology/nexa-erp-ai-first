import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockEventBus, mockPermissionService, mockToolRegistry, mockLogger } =
  vi.hoisted(() => {
    // Track registered query handlers so getQueryHandler can look them up
    const queryHandlers = new Map<string, any>();
    return {
      mockPrisma: {},
      mockEventBus: {
        emit: vi.fn(),
      },
      mockPermissionService: {
        getEffectivePermissions: vi.fn(),
      },
      mockToolRegistry: {
        getDefinition: vi.fn(),
        getQueryHandler: vi.fn((name: string) => queryHandlers.get(name.toLowerCase())),
        registerTool: vi.fn((reg: any) => {
          const key = reg.definition.name.toLowerCase();
          if (reg.definition.type === 'query' && reg.handler) {
            queryHandlers.set(key, reg.handler);
          }
        }),
        _queryHandlers: queryHandlers,
      },
      mockLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    };
  });

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import {
  QueryExecutor,
  type QueryExecutionResult as _QueryExecutionResult,
} from './query-executor.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultParams = {
  toolName: 'get_invoices',
  companyId: 'company-1',
  userId: 'user-1',
  userRole: 'ADMIN',
  input: { status: 'overdue' },
};

function createExecutor() {
  return new QueryExecutor(
    mockPrisma as any,
    mockEventBus as any,
    mockPermissionService as any,
    mockToolRegistry as any,
    mockLogger as any,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('QueryExecutor', () => {
  let executor: QueryExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    mockToolRegistry._queryHandlers.clear();
    executor = createExecutor();

    // Default: RBAC allows access (SUPER_ADMIN)
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      isSuperAdmin: true,
      enabledModules: [],
    });
  });

  // ─── Handler registration and lookup ───────────────────────────────────

  describe('handler registration', () => {
    it('registers a handler and reports it exists', () => {
      const handler = vi.fn();
      executor.registerHandler('get_invoices', handler);

      expect(executor.hasHandler('get_invoices')).toBe(true);
    });

    it('normalises handler names to lowercase', () => {
      executor.registerHandler('Get_Aging_Report', vi.fn());

      expect(executor.hasHandler('get_aging_report')).toBe(true);
      expect(executor.hasHandler('GET_AGING_REPORT')).toBe(true);
    });

    it('returns false for unregistered handler', () => {
      expect(executor.hasHandler('nonexistent')).toBe(false);
    });
  });

  // ─── CompanyId scoping enforcement ─────────────────────────────────────

  describe('companyId scoping', () => {
    it('passes correct companyId to the handler', async () => {
      const handler = vi.fn().mockResolvedValue({ data: [], rowCount: 0 });
      executor.registerHandler('get_invoices', handler);
      mockToolRegistry.getDefinition.mockReturnValue({ moduleKey: 'ar' });

      await executor.execute(defaultParams);

      expect(handler).toHaveBeenCalledWith({
        companyId: 'company-1',
        userId: 'user-1',
        input: { status: 'overdue' },
      });
    });
  });

  // ─── RBAC permission check ─────────────────────────────────────────────

  describe('RBAC permission check', () => {
    it('allows execution when user is SUPER_ADMIN', async () => {
      const handler = vi.fn().mockResolvedValue({ data: [{ id: 1 }], rowCount: 1 });
      executor.registerHandler('get_invoices', handler);
      mockToolRegistry.getDefinition.mockReturnValue({ moduleKey: 'ar' });
      mockPermissionService.getEffectivePermissions.mockResolvedValue({
        isSuperAdmin: true,
        enabledModules: [],
      });

      const result = await executor.execute(defaultParams);

      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalled();
    });

    it('allows execution when user has the module enabled', async () => {
      const handler = vi.fn().mockResolvedValue({ data: [], rowCount: 0 });
      executor.registerHandler('get_invoices', handler);
      mockToolRegistry.getDefinition.mockReturnValue({ moduleKey: 'ar' });
      mockPermissionService.getEffectivePermissions.mockResolvedValue({
        isSuperAdmin: false,
        enabledModules: ['ar', 'finance'],
      });

      const result = await executor.execute(defaultParams);

      expect(result.success).toBe(true);
    });

    it('denies execution when user lacks module access', async () => {
      const handler = vi.fn();
      executor.registerHandler('get_invoices', handler);
      mockToolRegistry.getDefinition.mockReturnValue({ moduleKey: 'ar' });
      mockPermissionService.getEffectivePermissions.mockResolvedValue({
        isSuperAdmin: false,
        enabledModules: ['finance'],
      });

      const result = await executor.execute(defaultParams);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('PERMISSION_DENIED');
      expect(handler).not.toHaveBeenCalled();
    });

    it('skips RBAC check when tool has no moduleKey', async () => {
      const handler = vi.fn().mockResolvedValue({ data: [], rowCount: 0 });
      executor.registerHandler('get_help', handler);
      mockToolRegistry.getDefinition.mockReturnValue(undefined);

      const result = await executor.execute({ ...defaultParams, toolName: 'get_help' });

      expect(result.success).toBe(true);
      expect(mockPermissionService.getEffectivePermissions).not.toHaveBeenCalled();
    });
  });

  // ─── Result truncation ─────────────────────────────────────────────────

  describe('result truncation', () => {
    it('does not truncate when result is within budget', async () => {
      const handler = vi.fn().mockResolvedValue({
        data: [{ id: 1, name: 'Invoice A' }],
        rowCount: 1,
      });
      executor.registerHandler('get_invoices', handler);
      mockToolRegistry.getDefinition.mockReturnValue({ moduleKey: 'ar' });

      const result = await executor.execute({ ...defaultParams, tokenBudget: 2000 });

      expect(result.success).toBe(true);
      expect(result.truncated).toBeFalsy();
    });

    it('truncates array results that exceed token budget', async () => {
      // Create data that exceeds a 50-token budget (200 chars)
      const largeData = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Invoice ${i}`,
        description: 'Some description text',
      }));
      const handler = vi.fn().mockResolvedValue({ data: largeData, rowCount: 100 });
      executor.registerHandler('get_invoices', handler);
      mockToolRegistry.getDefinition.mockReturnValue({ moduleKey: 'ar' });

      const result = await executor.execute({ ...defaultParams, tokenBudget: 50 });

      expect(result.success).toBe(true);
      expect(result.truncated).toBe(true);
    });

    it('truncates string results that exceed token budget', async () => {
      const longString = 'x'.repeat(10000);
      const handler = vi.fn().mockResolvedValue({ data: longString, rowCount: 1 });
      executor.registerHandler('get_report', handler);
      mockToolRegistry.getDefinition.mockReturnValue({ moduleKey: 'ar' });

      const result = await executor.execute({
        ...defaultParams,
        toolName: 'get_report',
        tokenBudget: 50,
      });

      expect(result.success).toBe(true);
      expect(result.truncated).toBe(true);
      expect((result.data as string).endsWith('...')).toBe(true);
    });

    it('uses default 2000 token budget when not specified', async () => {
      // Data within 2000-token budget (8000 chars)
      const handler = vi.fn().mockResolvedValue({ data: { message: 'ok' }, rowCount: 1 });
      executor.registerHandler('get_invoices', handler);
      mockToolRegistry.getDefinition.mockReturnValue({ moduleKey: 'ar' });

      const result = await executor.execute(defaultParams);

      expect(result.success).toBe(true);
      expect(result.truncated).toBeFalsy();
    });
  });

  // ─── Tool-not-found error ──────────────────────────────────────────────

  describe('tool not found', () => {
    it('returns TOOL_NOT_FOUND error for unregistered tool', async () => {
      const result = await executor.execute({
        ...defaultParams,
        toolName: 'nonexistent_tool',
      });

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('TOOL_NOT_FOUND');
      expect(result.error!.message).toContain('nonexistent_tool');
    });
  });

  // ─── Event emission ────────────────────────────────────────────────────

  describe('event emission', () => {
    it('emits ai.tool.queryExecuted on successful execution', async () => {
      const handler = vi.fn().mockResolvedValue({ data: [{ id: 1 }], rowCount: 5 });
      executor.registerHandler('get_invoices', handler);
      mockToolRegistry.getDefinition.mockReturnValue({ moduleKey: 'ar' });

      await executor.execute(defaultParams);

      expect(mockEventBus.emit).toHaveBeenCalledWith('ai.tool.queryExecuted', {
        toolName: 'get_invoices',
        moduleKey: 'ar',
        userId: 'user-1',
        companyId: 'company-1',
        resultRowCount: 5,
        latencyMs: expect.any(Number),
      });
    });

    it('uses "unknown" moduleKey when tool definition not found', async () => {
      const handler = vi.fn().mockResolvedValue({ data: [], rowCount: 0 });
      executor.registerHandler('get_help', handler);
      mockToolRegistry.getDefinition.mockReturnValue(undefined);

      await executor.execute({ ...defaultParams, toolName: 'get_help' });

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'ai.tool.queryExecuted',
        expect.objectContaining({ moduleKey: 'unknown' }),
      );
    });

    it('does not emit event on TOOL_NOT_FOUND', async () => {
      await executor.execute({ ...defaultParams, toolName: 'nonexistent' });

      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });
  });

  // ─── Graceful error handling ───────────────────────────────────────────

  describe('graceful error handling', () => {
    it('returns structured error when handler throws', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('Database connection lost'));
      executor.registerHandler('get_invoices', handler);
      mockToolRegistry.getDefinition.mockReturnValue({ moduleKey: 'ar' });

      const result = await executor.execute(defaultParams);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('QUERY_EXECUTION_FAILED');
      expect(result.error!.message).toBe('Database connection lost');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('denies access when permission check throws', async () => {
      const handler = vi.fn();
      executor.registerHandler('get_invoices', handler);
      mockToolRegistry.getDefinition.mockReturnValue({ moduleKey: 'ar' });
      mockPermissionService.getEffectivePermissions.mockRejectedValue(
        new Error('Permission service unavailable'),
      );

      const result = await executor.execute(defaultParams);

      expect(result.success).toBe(false);
      expect(result.error!.code).toBe('PERMISSION_DENIED');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ─── Latency tracking ─────────────────────────────────────────────────

  describe('latency tracking', () => {
    it('includes latencyMs in successful results', async () => {
      const handler = vi.fn().mockResolvedValue({ data: [], rowCount: 0 });
      executor.registerHandler('get_invoices', handler);
      mockToolRegistry.getDefinition.mockReturnValue({ moduleKey: 'ar' });

      const result = await executor.execute(defaultParams);

      expect(result.latencyMs).toBeDefined();
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });
});
