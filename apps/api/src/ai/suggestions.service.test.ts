import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockLogger, mockContextEngine, mockPermissionService } = vi.hoisted(() => ({
  mockPrisma: {
    aiAgent: {
      findMany: vi.fn(),
    },
  } as Record<string, any>,
  mockLogger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockContextEngine: {
    getUserContext: vi.fn(),
    updateContext: vi.fn(),
    refreshContext: vi.fn(),
  },
  mockPermissionService: {
    getEffectivePermissions: vi.fn(),
    hasPermission: vi.fn(),
    invalidateUser: vi.fn(),
    invalidateGroup: vi.fn(),
    invalidateAll: vi.fn(),
    clearCache: vi.fn(),
    getCacheSize: vi.fn(),
    deriveEnabledModules: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { SuggestionsService } from './suggestions.service.js';
import type { SuggestionChip } from './ai.types.js';
import type { EffectivePermissions } from '../core/rbac/permission.types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createService() {
  return new SuggestionsService(
    mockPrisma as any,
    mockContextEngine as any,
    mockPermissionService as any,
    mockLogger as any,
  );
}

const defaultUserContext = {
  user: { id: 'user-1', name: 'Mohammed Hussein', role: 'SUPER_ADMIN' },
  tenant: { id: 'tenant-1', companyName: 'Acme Ltd', baseCurrency: 'GBP' },
  recentEntities: [],
  recentActions: [],
  currentPeriod: { start: '2026-02-01', end: '2026-02-28', isLocked: false },
  preferences: { dateFormat: 'DD/MM/YYYY', locale: 'en' },
};

function makeSuperAdminPermissions(): EffectivePermissions {
  return {
    permissions: {},
    fieldOverrides: {},
    accessGroups: [],
    role: 'SUPER_ADMIN',
    isSuperAdmin: true,
    enabledModules: ['ar', 'ap', 'sales', 'finance', 'hr', 'inventory', 'crm'],
  };
}

function makeStaffPermissions(enabledModules: string[]): EffectivePermissions {
  const permissions: Record<string, any> = {};
  for (const mod of enabledModules) {
    permissions[`${mod}.list`] = { canAccess: true, canNew: true, canView: true, canEdit: false, canDelete: false };
  }
  return {
    permissions,
    fieldOverrides: {},
    accessGroups: [{ id: 'ag-1', code: 'STAFF', name: 'Staff' }],
    role: 'STAFF',
    isSuperAdmin: false,
    enabledModules,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SuggestionsService', () => {
  let service: SuggestionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();

    // Default: user context returns SUPER_ADMIN
    mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);

    // Default: super admin permissions
    mockPermissionService.getEffectivePermissions.mockResolvedValue(makeSuperAdminPermissions());

    // Default: no agent presets
    mockPrisma.aiAgent.findMany.mockResolvedValue([]);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Page-based suggestions
  // ═══════════════════════════════════════════════════════════════════════

  describe('getPageSuggestions', () => {
    it('returns customer detail suggestions for /ar/customers/:id', () => {
      const result = service.getPageSuggestions('/ar/customers/cust-123');

      expect(result.length).toBe(4);
      expect(result.map((s) => s.label)).toEqual([
        'Invoice this customer',
        'Show payment history',
        'Credit check',
        'View outstanding',
      ]);
      expect(result.every((s) => s.id)).toBe(true); // all have IDs
    });

    it('returns invoice list suggestions for /ar/invoices', () => {
      const result = service.getPageSuggestions('/ar/invoices');

      expect(result.length).toBe(4);
      expect(result.map((s) => s.label)).toContain('Show overdue');
      expect(result.map((s) => s.label)).toContain('Create invoice');
    });

    it('returns invoice list suggestions for /ar/invoices/', () => {
      const result = service.getPageSuggestions('/ar/invoices/');

      expect(result.length).toBe(4);
      expect(result.map((s) => s.label)).toContain('Show overdue');
    });

    it('returns supplier detail suggestions for /ap/suppliers/:id', () => {
      const result = service.getPageSuggestions('/ap/suppliers/sup-456');

      expect(result.length).toBe(3);
      expect(result.map((s) => s.label)).toContain('Create PO');
      expect(result.map((s) => s.label)).toContain('Show outstanding bills');
    });

    it('returns dashboard suggestions for /', () => {
      const result = service.getPageSuggestions('/');

      expect(result.length).toBe(3);
      expect(result.map((s) => s.label)).toContain('Morning briefing');
    });

    it('returns generic list suggestions for unrecognised list routes', () => {
      const result = service.getPageSuggestions('/crm/contacts');

      expect(result.length).toBe(3);
      expect(result.map((s) => s.label)).toContain('Create new');
      expect(result.map((s) => s.label)).toContain('Export');
    });

    it('returns empty for undefined route', () => {
      const result = service.getPageSuggestions(undefined);
      expect(result).toEqual([]);
    });

    it('returns empty for deep nested routes without a match', () => {
      const result = service.getPageSuggestions('/settings/system/advanced');
      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Role-based suggestions
  // ═══════════════════════════════════════════════════════════════════════

  describe('getRoleSuggestions', () => {
    it('returns finance suggestions for FINANCE role', () => {
      const result = service.getRoleSuggestions('FINANCE');

      expect(result.length).toBe(3);
      expect(result.map((s) => s.label)).toContain('Bank reconciliation');
      expect(result.map((s) => s.label)).toContain('Month-end status');
      expect(result.map((s) => s.label)).toContain('Cash flow forecast');
    });

    it('returns sales suggestions for SALES role', () => {
      const result = service.getRoleSuggestions('SALES');

      expect(result.length).toBe(3);
      expect(result.map((s) => s.label)).toContain('Pipeline summary');
      expect(result.map((s) => s.label)).toContain('New leads');
    });

    it('returns owner suggestions for OWNER role', () => {
      const result = service.getRoleSuggestions('OWNER');

      expect(result.length).toBe(3);
      expect(result.map((s) => s.label)).toContain('Business overview');
      expect(result.map((s) => s.label)).toContain('Anomaly check');
    });

    it('returns HR suggestions for HR role', () => {
      const result = service.getRoleSuggestions('HR');

      expect(result.length).toBe(3);
      expect(result.map((s) => s.label)).toContain('Leave requests');
    });

    it('returns warehouse suggestions for WAREHOUSE role', () => {
      const result = service.getRoleSuggestions('WAREHOUSE');

      expect(result.length).toBe(3);
      expect(result.map((s) => s.label)).toContain('Low stock alerts');
    });

    it('returns admin suggestions for ADMIN role', () => {
      const result = service.getRoleSuggestions('ADMIN');

      expect(result.length).toBe(3);
      expect(result.map((s) => s.label)).toContain('Business overview');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Time-based suggestions
  // ═══════════════════════════════════════════════════════════════════════

  describe('getTimeSuggestions', () => {
    it('returns morning suggestions before 12:00', () => {
      const morning = new Date('2026-02-23T09:00:00');
      const result = service.getTimeSuggestions(morning);

      expect(result.length).toBe(2);
      expect(result.map((s) => s.label)).toContain('Daily briefing');
      expect(result.map((s) => s.label)).toContain('What happened overnight?');
    });

    it('returns afternoon suggestions between 12:00 and 17:00', () => {
      const afternoon = new Date('2026-02-23T14:00:00');
      const result = service.getTimeSuggestions(afternoon);

      expect(result.length).toBe(2);
      expect(result.map((s) => s.label)).toContain('Summary so far today');
      expect(result.map((s) => s.label)).toContain('Pending actions');
    });

    it('returns evening suggestions after 17:00', () => {
      const evening = new Date('2026-02-23T18:00:00');
      const result = service.getTimeSuggestions(evening);

      expect(result.length).toBe(2);
      expect(result.map((s) => s.label)).toContain('Day summary');
      expect(result.map((s) => s.label)).toContain("Tomorrow's schedule");
    });

    it('returns morning suggestions at exactly 00:00', () => {
      const midnight = new Date('2026-02-23T00:00:00');
      const result = service.getTimeSuggestions(midnight);

      expect(result.map((s) => s.label)).toContain('Daily briefing');
    });

    it('returns afternoon suggestions at exactly 12:00', () => {
      const noon = new Date('2026-02-23T12:00:00');
      const result = service.getTimeSuggestions(noon);

      expect(result.map((s) => s.label)).toContain('Summary so far today');
    });

    it('returns evening suggestions at exactly 17:00', () => {
      const fivePm = new Date('2026-02-23T17:00:00');
      const result = service.getTimeSuggestions(fivePm);

      expect(result.map((s) => s.label)).toContain('Day summary');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Agent preset prompt loading
  // ═══════════════════════════════════════════════════════════════════════

  describe('loadAgentPresetPrompts', () => {
    it('loads preset prompts from active agents', async () => {
      mockPrisma.aiAgent.findMany.mockResolvedValue([
        {
          name: 'finance-agent',
          triggerConfig: {
            presetPrompts: [
              { label: 'Run month-end', prompt: 'Execute month-end closing', category: 'action', icon: 'calendar', priority: 150 },
              { label: 'Tax report', prompt: 'Generate tax report', category: 'query' },
            ],
          },
        },
      ]);

      const result = await service.loadAgentPresetPrompts();

      expect(result.length).toBe(2);
      expect(result[0]!.label).toBe('Run month-end');
      expect(result[0]!.category).toBe('action');
      expect(result[0]!.icon).toBe('calendar');
      expect(result[0]!.priority).toBe(150);
      expect(result[1]!.label).toBe('Tax report');
      expect(result[1]!.priority).toBe(300); // default priority
    });

    it('skips agents without presetPrompts', async () => {
      mockPrisma.aiAgent.findMany.mockResolvedValue([
        {
          name: 'chat-agent',
          triggerConfig: { someOtherConfig: true },
        },
      ]);

      const result = await service.loadAgentPresetPrompts();
      expect(result).toEqual([]);
    });

    it('skips malformed preset entries', async () => {
      mockPrisma.aiAgent.findMany.mockResolvedValue([
        {
          name: 'agent-1',
          triggerConfig: {
            presetPrompts: [
              { label: 'Valid', prompt: 'Valid prompt' },
              { label: 123, prompt: 'Invalid label type' }, // label not string
              { prompt: 'Missing label' }, // no label
              null,
            ],
          },
        },
      ]);

      const result = await service.loadAgentPresetPrompts();
      expect(result.length).toBe(1);
      expect(result[0]!.label).toBe('Valid');
    });

    it('returns empty when AiAgent model is not available', async () => {
      delete mockPrisma.aiAgent;

      const result = await service.loadAgentPresetPrompts();
      expect(result).toEqual([]);

      // Restore for other tests
      mockPrisma.aiAgent = { findMany: vi.fn() };
    });

    it('returns empty on database error', async () => {
      mockPrisma.aiAgent.findMany.mockRejectedValue(new Error('DB connection failed'));

      const result = await service.loadAgentPresetPrompts();
      expect(result).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'DB connection failed' }),
        expect.stringContaining('failed to load agent preset prompts'),
      );
    });

    it('handles agents with null triggerConfig', async () => {
      mockPrisma.aiAgent.findMany.mockResolvedValue([
        { name: 'agent-null', triggerConfig: null },
      ]);

      const result = await service.loadAgentPresetPrompts();
      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // RBAC filtering
  // ═══════════════════════════════════════════════════════════════════════

  describe('filterByPermissions', () => {
    const arSuggestion = {
      id: 's-1',
      label: 'Show overdue invoices',
      prompt: 'Show all overdue invoices',
      category: 'query' as const,
      priority: 10,
      requiredModule: 'ar',
    };
    const hrSuggestion = {
      id: 's-2',
      label: 'Leave requests',
      prompt: 'Show pending leave requests',
      category: 'query' as const,
      priority: 100,
      requiredModule: 'hr',
    };
    const genericSuggestion: SuggestionChip = {
      id: 's-3',
      label: 'Daily briefing',
      prompt: 'Show my daily briefing',
      category: 'query',
      priority: 200,
    };

    it('returns all suggestions for SUPER_ADMIN', async () => {
      mockPermissionService.getEffectivePermissions.mockResolvedValue(makeSuperAdminPermissions());

      const result = await service.filterByPermissions(
        [arSuggestion, hrSuggestion, genericSuggestion],
        'user-1', 'company-1', 'SUPER_ADMIN',
      );

      expect(result.length).toBe(3);
    });

    it('filters out AR suggestions when user lacks AR module access', async () => {
      mockPermissionService.getEffectivePermissions.mockResolvedValue(
        makeStaffPermissions(['hr']), // only HR access
      );

      const result = await service.filterByPermissions(
        [arSuggestion, hrSuggestion, genericSuggestion],
        'user-1', 'company-1', 'STAFF',
      );

      expect(result.map((s) => s.label)).not.toContain('Show overdue invoices');
      expect(result.map((s) => s.label)).toContain('Leave requests');
      expect(result.map((s) => s.label)).toContain('Daily briefing');
    });

    it('filters out HR suggestions when user lacks HR module access', async () => {
      mockPermissionService.getEffectivePermissions.mockResolvedValue(
        makeStaffPermissions(['ar', 'finance']), // AR and Finance only
      );

      const result = await service.filterByPermissions(
        [arSuggestion, hrSuggestion, genericSuggestion],
        'user-1', 'company-1', 'STAFF',
      );

      expect(result.map((s) => s.label)).toContain('Show overdue invoices');
      expect(result.map((s) => s.label)).not.toContain('Leave requests');
    });

    it('returns all suggestions when permission loading fails', async () => {
      mockPermissionService.getEffectivePermissions.mockRejectedValue(new Error('Permission error'));

      const result = await service.filterByPermissions(
        [arSuggestion, hrSuggestion, genericSuggestion],
        'user-1', 'company-1', 'STAFF',
      );

      expect(result.length).toBe(3);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Permission error' }),
        expect.stringContaining('failed to load permissions'),
      );
    });

    it('keeps generic suggestions that have no module requirement', async () => {
      mockPermissionService.getEffectivePermissions.mockResolvedValue(
        makeStaffPermissions([]), // no modules
      );

      const result = await service.filterByPermissions(
        [genericSuggestion],
        'user-1', 'company-1', 'STAFF',
      );

      expect(result.length).toBe(1);
      expect(result[0]!.label).toBe('Daily briefing');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Deduplication and priority sorting
  // ═══════════════════════════════════════════════════════════════════════

  describe('deduplication and priority sorting', () => {
    it('deduplicates suggestions with the same prompt', async () => {
      // Dashboard page has "Morning briefing" AND morning time has "Daily briefing" with same prompt text
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);

      const result = await service.getSuggestions({
        userId: 'user-1',
        companyId: 'company-1',
        tenantId: 'tenant-1',
        pageRoute: '/',
      });

      // "Show my daily briefing" appears in both page and time suggestions
      const briefingPrompts = result.suggestions.filter(
        (s) => s.prompt.toLowerCase() === 'show my daily briefing',
      );
      expect(briefingPrompts.length).toBe(1); // deduplicated
    });

    it('keeps the higher priority version when deduplicating', async () => {
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);

      const result = await service.getSuggestions({
        userId: 'user-1',
        companyId: 'company-1',
        tenantId: 'tenant-1',
        pageRoute: '/',
      });

      const briefing = result.suggestions.find(
        (s) => s.prompt.toLowerCase() === 'show my daily briefing',
      );
      // Page suggestion priority (10) < time suggestion priority (200), so the page one should win
      expect(briefing?.priority).toBe(10);
    });

    it('sorts results by priority ascending', async () => {
      mockContextEngine.getUserContext.mockResolvedValue(defaultUserContext);

      const result = await service.getSuggestions({
        userId: 'user-1',
        companyId: 'company-1',
        tenantId: 'tenant-1',
        pageRoute: '/ar/customers/cust-1',
      });

      const priorities = result.suggestions.map((s) => s.priority);
      for (let i = 1; i < priorities.length; i++) {
        expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i - 1]!);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getSuggestions (full flow)
  // ═══════════════════════════════════════════════════════════════════════

  describe('getSuggestions', () => {
    it('returns combined page, role, and time suggestions', async () => {
      mockContextEngine.getUserContext.mockResolvedValue({
        ...defaultUserContext,
        user: { id: 'user-1', name: 'Sarah Finance', role: 'FINANCE' },
      });

      const result = await service.getSuggestions({
        userId: 'user-1',
        companyId: 'company-1',
        tenantId: 'tenant-1',
        pageRoute: '/ar/invoices',
      });

      expect(result.pageRoute).toBe('/ar/invoices');
      // Should contain page suggestions (Show overdue, Create invoice...)
      expect(result.suggestions.some((s) => s.label === 'Show overdue')).toBe(true);
      // Should contain finance role suggestions (Bank reconciliation...)
      expect(result.suggestions.some((s) => s.label === 'Bank reconciliation')).toBe(true);
      // Should contain some time-based suggestions
      expect(result.suggestions.length).toBeGreaterThan(4);
    });

    it('includes agent presets in the result', async () => {
      mockPrisma.aiAgent.findMany.mockResolvedValue([
        {
          name: 'test-agent',
          triggerConfig: {
            presetPrompts: [
              { label: 'Agent action', prompt: 'Perform agent action', category: 'action', priority: 250 },
            ],
          },
        },
      ]);

      const result = await service.getSuggestions({
        userId: 'user-1',
        companyId: 'company-1',
        tenantId: 'tenant-1',
      });

      expect(result.suggestions.some((s) => s.label === 'Agent action')).toBe(true);
    });

    it('passes through entityType and entityId', async () => {
      const result = await service.getSuggestions({
        userId: 'user-1',
        companyId: 'company-1',
        tenantId: 'tenant-1',
        entityType: 'Customer',
        entityId: 'cust-123',
        pageRoute: '/ar/customers/cust-123',
      });

      expect(result.entityType).toBe('Customer');
      expect(result.entityId).toBe('cust-123');
    });

    it('returns empty suggestions on context engine failure', async () => {
      mockContextEngine.getUserContext.mockRejectedValue(new Error('Redis down'));

      const result = await service.getSuggestions({
        userId: 'user-1',
        companyId: 'company-1',
        tenantId: 'tenant-1',
        pageRoute: '/ar/invoices',
      });

      expect(result.suggestions).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Redis down' }),
        expect.stringContaining('failed to generate suggestions'),
      );
    });

    it('returns empty suggestions array with metadata preserved on error', async () => {
      mockContextEngine.getUserContext.mockRejectedValue(new Error('Timeout'));

      const result = await service.getSuggestions({
        userId: 'user-1',
        companyId: 'company-1',
        tenantId: 'tenant-1',
        entityType: 'Invoice',
        entityId: 'inv-1',
        pageRoute: '/ar/invoices/inv-1',
      });

      expect(result.entityType).toBe('Invoice');
      expect(result.entityId).toBe('inv-1');
      expect(result.pageRoute).toBe('/ar/invoices/inv-1');
      expect(result.suggestions).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Role resolution
  // ═══════════════════════════════════════════════════════════════════════

  describe('role resolution', () => {
    it('maps SUPER_ADMIN to OWNER suggestions', async () => {
      mockContextEngine.getUserContext.mockResolvedValue({
        ...defaultUserContext,
        user: { id: 'user-1', name: 'Owner', role: 'SUPER_ADMIN' },
      });

      const result = await service.getSuggestions({
        userId: 'user-1',
        companyId: 'company-1',
        tenantId: 'tenant-1',
      });

      expect(result.suggestions.some((s) => s.label === 'Business overview')).toBe(true);
    });

    it('maps ADMIN to ADMIN suggestions', async () => {
      mockContextEngine.getUserContext.mockResolvedValue({
        ...defaultUserContext,
        user: { id: 'user-1', name: 'Admin', role: 'ADMIN' },
      });

      const result = await service.getSuggestions({
        userId: 'user-1',
        companyId: 'company-1',
        tenantId: 'tenant-1',
      });

      expect(result.suggestions.some((s) => s.label === 'Business overview')).toBe(true);
    });

    it('maps role with FINANCE keyword to finance suggestions', async () => {
      mockContextEngine.getUserContext.mockResolvedValue({
        ...defaultUserContext,
        user: { id: 'user-1', name: 'Clerk', role: 'FINANCE_CLERK' },
      });

      const result = await service.getSuggestions({
        userId: 'user-1',
        companyId: 'company-1',
        tenantId: 'tenant-1',
      });

      expect(result.suggestions.some((s) => s.label === 'Bank reconciliation')).toBe(true);
    });

    it('maps role with WAREHOUSE keyword to warehouse suggestions', async () => {
      mockContextEngine.getUserContext.mockResolvedValue({
        ...defaultUserContext,
        user: { id: 'user-1', name: 'Picker', role: 'WAREHOUSE_STAFF' },
      });

      const result = await service.getSuggestions({
        userId: 'user-1',
        companyId: 'company-1',
        tenantId: 'tenant-1',
      });

      expect(result.suggestions.some((s) => s.label === 'Low stock alerts')).toBe(true);
    });
  });
});
