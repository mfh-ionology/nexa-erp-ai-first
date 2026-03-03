// ---------------------------------------------------------------------------
// Integration test — L0→L1→L2→tool execution chain
// E5b-2 Task 14.13: End-to-end test that classifies a message, routes through
// all three levels, resolves tools, and executes a mock query tool.
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockEventBus, mockPermissionService, mockMemoryInjection, mockLogger } =
  vi.hoisted(() => ({
    mockPrisma: {
      aiSkill: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
      aiModuleKnowledge: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
      aiSkillOverride: {
        findMany: vi.fn(),
      },
      userCompanyRole: {
        findFirst: vi.fn(),
      },
      userAccessGroup: {
        findMany: vi.fn(),
      },
    },
    mockEventBus: {
      emit: vi.fn(),
    },
    mockPermissionService: {
      getEffectivePermissions: vi.fn(),
    },
    mockMemoryInjection: {
      assembleUserContext: vi.fn(),
    },
    mockLogger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { ToolRegistry } from '@nexa/ai-tools';
import { SkillRouter } from './skill-router.js';
import { QueryExecutor } from './query-executor.js';
import { DynamicContextService } from './dynamic-context.service.js';

// ---------------------------------------------------------------------------
// Test data — simulates a seeded AR module
// ---------------------------------------------------------------------------

const SKILL_ID = '00000000-0000-0000-0000-000000000001';
const COMPANY_ID = 'company-1';
const USER_ID = 'user-1';

const arSkillDb = {
  id: SKILL_ID,
  name: 'aging_report',
  displayName: 'Aging Report',
  moduleKey: 'ar',
  packKey: 'ar-core',
  triggerPhrases: ['aging report', 'overdue invoices', 'outstanding invoices'],
  negativeTriggers: ['credit note'],
  contextRequired: [],
  priority: 100,
  isActive: true,
  skillContent:
    'You provide aging reports for accounts receivable. List overdue invoices grouped by aging bucket.',
  parameters: { buckets: [30, 60, 90] },
  examples: [
    {
      input: 'Show me the aging report',
      output: 'Here are the overdue invoices grouped by aging bucket...',
    },
  ],
  requiredTools: ['get_aging_report'],
  contexts: [],
};

const arOverviewKnowledge = {
  moduleKey: 'ar',
  knowledgeType: 'OVERVIEW',
  title: 'AR Overview',
  content: 'Accounts Receivable: invoicing, payments, aging, credit notes',
  priority: 100,
  isActive: true,
};

const arEntitiesKnowledge = {
  moduleKey: 'ar',
  knowledgeType: 'ENTITIES',
  title: 'AR Entities',
  content: 'Invoice (status: Draft→Approved→Sent→Paid), CreditNote, Payment',
  priority: 90,
  isActive: true,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: L0→L1→L2→tool execution chain', () => {
  let toolRegistry: ToolRegistry;
  let skillRouter: SkillRouter;
  let queryExecutor: QueryExecutor;
  let contextService: DynamicContextService;
  let mockQueryHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // 1. Build a real ToolRegistry with a mock query handler
    toolRegistry = new ToolRegistry();
    mockQueryHandler = vi.fn().mockResolvedValue({
      data: [
        { invoiceId: 'INV-001', customer: 'Acme Ltd', amount: 5000, daysOverdue: 45 },
        { invoiceId: 'INV-002', customer: 'Beta Corp', amount: 2500, daysOverdue: 75 },
      ],
      rowCount: 2,
    });

    toolRegistry.registerTool({
      definition: {
        name: 'get_aging_report',
        description: 'Fetch aging report for overdue invoices',
        moduleKey: 'ar',
        inputSchema: {
          type: 'object',
          properties: {
            bucket: { type: 'string', description: 'Aging bucket filter' },
          },
        },
        type: 'query',
      },
      handler: mockQueryHandler as any,
    });

    // 2. Build a real SkillRouter with mock DB
    skillRouter = new SkillRouter(
      mockPrisma as any,
      mockLogger as any,
      toolRegistry,
      mockEventBus as any,
    );

    // 3. Build a real QueryExecutor
    queryExecutor = new QueryExecutor(
      mockPrisma as any,
      mockEventBus as any,
      mockPermissionService as any,
      toolRegistry,
      mockLogger as any,
    );
    queryExecutor.registerHandler('get_aging_report', mockQueryHandler as any);

    // 4. Build a real DynamicContextService
    contextService = new DynamicContextService(
      skillRouter,
      mockMemoryInjection as any,
      toolRegistry,
      mockPrisma as any,
      mockLogger as any,
    );

    // ── Seed mock DB responses ──────────────────────────────────────────

    // L0: module summary loading
    mockPrisma.aiSkill.findMany.mockResolvedValue([
      {
        moduleKey: 'ar',
        triggerPhrases: [
          'aging report',
          'overdue invoices',
          'outstanding invoices',
          'invoice',
          'payment',
        ],
        id: SKILL_ID,
        name: 'aging_report',
        negativeTriggers: ['credit note'],
        contextRequired: [],
        priority: 100,
        isActive: true,
      },
    ]);

    // L0: module overviews
    mockPrisma.aiModuleKnowledge.findMany.mockImplementation(async (args: any) => {
      if (args?.where?.knowledgeType === 'OVERVIEW') {
        return [arOverviewKnowledge];
      }
      if (args?.where?.knowledgeType?.in?.includes('ENTITIES')) {
        return [arEntitiesKnowledge];
      }
      if (args?.where?.knowledgeType?.in?.includes('OVERVIEW')) {
        return [arOverviewKnowledge, arEntitiesKnowledge];
      }
      return [];
    });

    // L1: load module pack
    // (aiSkill.findMany is already mocked above for L0 — L1 queries the same table)

    // L1: overrides (none for this test)
    mockPrisma.aiSkillOverride.findMany.mockResolvedValue([]);

    // L1: module overview
    mockPrisma.aiModuleKnowledge.findFirst.mockResolvedValue(arOverviewKnowledge);

    // L2: full skill load
    mockPrisma.aiSkill.findUnique.mockResolvedValue(arSkillDb);

    // Memory injection
    mockMemoryInjection.assembleUserContext.mockResolvedValue(
      '<user_context>\n[PREFERENCE] User prefers tabular format\n</user_context>',
    );

    // Permissions
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue({ role: 'ADMIN' });
    mockPrisma.userAccessGroup.findMany.mockResolvedValue([
      { accessGroup: { permissions: [{ resourceCode: 'ar' }] } },
    ]);

    // RBAC for query executor
    mockPermissionService.getEffectivePermissions.mockResolvedValue({
      isSuperAdmin: false,
      enabledModules: ['ar', 'finance'],
    });
  });

  it('classifies message → loads pack → selects skill → activates → resolves tools → executes query', async () => {
    const userMessage = 'Show me the aging report for overdue invoices';

    // ── Step 1: L0 — Module classification ──────────────────────────────
    const classification = await skillRouter.classifyModule(userMessage);
    expect(classification.moduleKey).toBe('ar');
    expect(classification.confidence).toBeGreaterThan(0);

    // ── Step 2: L1 — Load module pack ───────────────────────────────────
    const pack = await skillRouter.loadModulePack('ar', COMPANY_ID, USER_ID);
    expect(pack.moduleKey).toBe('ar');
    expect(pack.skills.length).toBeGreaterThan(0);

    // ── Step 3: L1 — Select skill ───────────────────────────────────────
    const selected = await skillRouter.selectSkill(userMessage, pack);
    expect(selected).not.toBeNull();
    expect(selected!.name).toBe('aging_report');

    // ── Step 4: L2 — Activate skill ─────────────────────────────────────
    const activated = await skillRouter.activateSkill(selected!, USER_ID);
    expect(activated).not.toBeNull();
    expect(activated!.name).toBe('aging_report');
    expect(activated!.skillContent).toContain('aging reports');
    expect(activated!.tools.length).toBeGreaterThan(0);
    expect(activated!.tools[0]!.name).toBe('get_aging_report');

    // ── Step 5: Execute query tool ──────────────────────────────────────
    const queryResult = await queryExecutor.execute({
      toolName: 'get_aging_report',
      companyId: COMPANY_ID,
      userId: USER_ID,
      userRole: 'ADMIN',
      input: { bucket: '30-60' },
    });

    expect(queryResult.success).toBe(true);
    expect(queryResult.rowCount).toBe(2);
    expect(queryResult.data).toEqual([
      { invoiceId: 'INV-001', customer: 'Acme Ltd', amount: 5000, daysOverdue: 45 },
      { invoiceId: 'INV-002', customer: 'Beta Corp', amount: 2500, daysOverdue: 75 },
    ]);

    // ── Verify events were emitted ──────────────────────────────────────
    const emitCalls = mockEventBus.emit.mock.calls.map((c: any[]) => c[0]);
    expect(emitCalls).toContain('ai.skill.packLoaded');
    expect(emitCalls).toContain('ai.skill.activated');
    expect(emitCalls).toContain('ai.tool.queryExecuted');

    // ── Verify companyId was scoped ─────────────────────────────────────
    expect(mockQueryHandler).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: COMPANY_ID }),
    );
  });

  it('assembles full interactive context including the entire chain', async () => {
    const result = await contextService.assembleInteractive({
      userId: USER_ID,
      companyId: COMPANY_ID,
      userMessage: 'Show me the aging report',
      basePrompt: 'You are the Nexa AI Co-Pilot.',
    });

    // Verify L0→L1→L2 chain was exercised
    expect(result.skillChain.l0Module).toBe('ar');
    expect(result.skillChain.l1Skill).toBe('aging_report');
    expect(result.skillChain.l2Activated).toBe(true);

    // Verify system prompt contains all sections
    expect(result.systemPrompt).toContain('You are the Nexa AI Co-Pilot.');
    expect(result.systemPrompt).toContain('<user_context>');
    expect(result.systemPrompt).toContain('aging_report');
    expect(result.systemPrompt).toContain('aging reports');
    expect(result.systemPrompt).toContain('<user_permissions>');

    // Verify tools are resolved
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0]!.name).toBe('get_aging_report');

    // Verify token breakdown is populated
    expect(result.tokenBreakdown.base).toBeGreaterThan(0);
    expect(result.tokenBreakdown.memories).toBeGreaterThan(0);
    expect(result.tokenBreakdown.skills).toBeGreaterThan(0);
    expect(result.tokenBreakdown.total).toBeGreaterThan(0);
  });

  it('handles negative trigger exclusion in the full chain', async () => {
    // "credit note" is a negative trigger for aging_report
    const result = await contextService.assembleInteractive({
      userId: USER_ID,
      companyId: COMPANY_ID,
      userMessage: 'Create a credit note for the invoice',
      basePrompt: 'You are the Nexa AI Co-Pilot.',
    });

    // L0 should match 'ar' module (has 'invoice' trigger)
    // But L1 selectSkill should NOT select aging_report (negative trigger "credit note")
    expect(result.skillChain.l0Module).toBe('ar');
    expect(result.skillChain.l1Skill).toBeNull();
    expect(result.skillChain.l2Activated).toBe(false);
  });
});
