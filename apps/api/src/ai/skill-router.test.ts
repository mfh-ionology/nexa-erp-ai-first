import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockToolRegistry, mockEventBus, mockLogger } = vi.hoisted(() => ({
  mockPrisma: {
    aiSkill: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    aiModuleKnowledge: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    aiSkillOverride: {
      findMany: vi.fn(),
    },
  },
  mockToolRegistry: {
    getDefinition: vi.fn(),
    resolveTools: vi.fn(),
  },
  mockEventBus: {
    emit: vi.fn(),
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

import { SkillRouter } from './skill-router.js';
import type { ModulePack, SkillSummary } from './skill-router.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRouter(withTools = true, withEvents = true) {
  return new SkillRouter(
    mockPrisma as any,
    mockLogger as any,
    withTools ? (mockToolRegistry as any) : undefined,
    withEvents ? (mockEventBus as any) : undefined,
  );
}

function makeDbSkill(
  moduleKey: string,
  triggerPhrases: string[],
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `skill-${Math.random().toString(36).slice(2, 8)}`,
    name: `${moduleKey}_skill`,
    triggerPhrases,
    negativeTriggers: [],
    contextRequired: [],
    priority: 100,
    moduleKey,
    isActive: true,
    ...overrides,
  };
}

function makeFullDbSkill(overrides: Record<string, unknown> = {}) {
  return {
    id: 'skill-full-1',
    name: 'create_invoice',
    moduleKey: 'ar',
    skillContent: 'You help create invoices for the AR module.',
    parameters: { invoiceType: 'standard' },
    examples: [{ input: 'Create an invoice', output: 'Creating invoice...' }],
    requiredTools: ['get_customers', 'get_products'],
    triggerPhrases: ['create invoice', 'new invoice'],
    negativeTriggers: [],
    contextRequired: [],
    priority: 100,
    isActive: true,
    contexts: [
      {
        id: 'ctx-1',
        contextKey: 'customer_list',
        contextQuery: 'SELECT * FROM customers',
        tokenBudget: 100,
        cacheTtlSeconds: 300,
        isRequired: true,
      },
    ],
    ...overrides,
  };
}

function makeModulePack(moduleKey: string, skills: SkillSummary[]): ModulePack {
  return {
    moduleKey,
    skills,
    overview: `${moduleKey} overview`,
    tokenCount: 100,
  };
}

function makeSkillSummary(overrides: Partial<SkillSummary> = {}): SkillSummary {
  return {
    id: 'skill-1',
    name: 'create_invoice',
    triggerPhrases: ['create invoice', 'new invoice', 'make invoice'],
    negativeTriggers: [],
    contextRequired: [],
    priority: 100,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SkillRouter', () => {
  let router: SkillRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    router = createRouter();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // L0: Module Classification (14.3)
  // ═══════════════════════════════════════════════════════════════════════

  describe('L0: classifyModule()', () => {
    it('classifies a user message to the correct module', async () => {
      mockPrisma.aiSkill.findMany.mockResolvedValue([
        makeDbSkill('ar', ['invoice', 'overdue', 'aging report']),
        makeDbSkill('finance', ['journal entry', 'general ledger', 'chart of accounts']),
      ]);
      mockPrisma.aiModuleKnowledge.findMany.mockResolvedValue([
        { moduleKey: 'ar', content: 'Accounts Receivable' },
        { moduleKey: 'finance', content: 'General Ledger & Finance' },
      ]);

      const result = await router.classifyModule('Show me overdue invoices');

      expect(result.moduleKey).toBe('ar');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('returns null moduleKey when no module matches', async () => {
      mockPrisma.aiSkill.findMany.mockResolvedValue([
        makeDbSkill('ar', ['invoice', 'aging report']),
      ]);
      mockPrisma.aiModuleKnowledge.findMany.mockResolvedValue([]);

      const result = await router.classifyModule('What is the weather today?');

      expect(result.moduleKey).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('returns null when confidence is below threshold (0.1)', async () => {
      mockPrisma.aiSkill.findMany.mockResolvedValue([
        makeDbSkill('ar', ['very specific financial instrument terminology']),
      ]);
      mockPrisma.aiModuleKnowledge.findMany.mockResolvedValue([]);

      const result = await router.classifyModule('hello world');

      expect(result.moduleKey).toBeNull();
    });

    it('returns null when no skills exist', async () => {
      mockPrisma.aiSkill.findMany.mockResolvedValue([]);
      mockPrisma.aiModuleKnowledge.findMany.mockResolvedValue([]);

      const result = await router.classifyModule('Show me invoices');

      expect(result.moduleKey).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('uses cache on second call within TTL', async () => {
      mockPrisma.aiSkill.findMany.mockResolvedValue([makeDbSkill('ar', ['invoice'])]);
      mockPrisma.aiModuleKnowledge.findMany.mockResolvedValue([]);

      // First call — loads from DB
      await router.classifyModule('Show me invoices');
      expect(mockPrisma.aiSkill.findMany).toHaveBeenCalledTimes(1);

      // Second call — uses cache
      await router.classifyModule('Show me another invoice');
      expect(mockPrisma.aiSkill.findMany).toHaveBeenCalledTimes(1); // NOT called again
    });

    it('invalidateCache forces reload on next call', async () => {
      mockPrisma.aiSkill.findMany.mockResolvedValue([makeDbSkill('ar', ['invoice'])]);
      mockPrisma.aiModuleKnowledge.findMany.mockResolvedValue([]);

      await router.classifyModule('Show me invoices');
      expect(mockPrisma.aiSkill.findMany).toHaveBeenCalledTimes(1);

      router.invalidateCache();

      await router.classifyModule('Show me invoices');
      expect(mockPrisma.aiSkill.findMany).toHaveBeenCalledTimes(2);
    });

    it('includes summaryTokens in the result', async () => {
      mockPrisma.aiSkill.findMany.mockResolvedValue([makeDbSkill('ar', ['invoice'])]);
      mockPrisma.aiModuleKnowledge.findMany.mockResolvedValue([
        { moduleKey: 'ar', content: 'Accounts Receivable' },
      ]);

      const result = await router.classifyModule('invoice');

      expect(result.summaryTokens).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // L1: Module Pack Loader (14.4)
  // ═══════════════════════════════════════════════════════════════════════

  describe('L1: loadModulePack()', () => {
    it('loads skills for a module with overview', async () => {
      mockPrisma.aiSkill.findMany.mockResolvedValue([
        makeDbSkill('ar', ['create invoice'], {
          id: 'skill-1',
          name: 'create_invoice',
          priority: 200,
        }),
        makeDbSkill('ar', ['aging report'], { id: 'skill-2', name: 'aging_report', priority: 100 }),
      ]);
      mockPrisma.aiSkillOverride.findMany.mockResolvedValue([]);
      mockPrisma.aiModuleKnowledge.findFirst.mockResolvedValue({
        content: 'AR module handles invoicing',
      });

      const pack = await router.loadModulePack('ar', 'company-1');

      expect(pack.moduleKey).toBe('ar');
      expect(pack.skills).toHaveLength(2);
      expect(pack.skills[0]!.name).toBe('create_invoice'); // higher priority first
      expect(pack.overview).toBe('AR module handles invoicing');
      expect(pack.tokenCount).toBeGreaterThan(0);
    });

    it('excludes skills disabled by tenant override', async () => {
      mockPrisma.aiSkill.findMany.mockResolvedValue([
        makeDbSkill('ar', ['create invoice'], { id: 'skill-1', name: 'create_invoice' }),
        makeDbSkill('ar', ['aging report'], { id: 'skill-2', name: 'aging_report' }),
      ]);
      mockPrisma.aiSkillOverride.findMany.mockResolvedValue([
        { skillId: 'skill-1', isActive: false, triggerPhrasesOverride: [], priorityOverride: null },
      ]);
      mockPrisma.aiModuleKnowledge.findFirst.mockResolvedValue(null);

      const pack = await router.loadModulePack('ar', 'company-1');

      expect(pack.skills).toHaveLength(1);
      expect(pack.skills[0]!.name).toBe('aging_report');
    });

    it('replaces trigger phrases when override provides them', async () => {
      mockPrisma.aiSkill.findMany.mockResolvedValue([
        makeDbSkill('ar', ['create invoice'], { id: 'skill-1', name: 'create_invoice' }),
      ]);
      mockPrisma.aiSkillOverride.findMany.mockResolvedValue([
        {
          skillId: 'skill-1',
          isActive: null,
          triggerPhrasesOverride: ['make bill', 'generate invoice'],
          priorityOverride: null,
        },
      ]);
      mockPrisma.aiModuleKnowledge.findFirst.mockResolvedValue(null);

      const pack = await router.loadModulePack('ar', 'company-1');

      expect(pack.skills[0]!.triggerPhrases).toEqual(['make bill', 'generate invoice']);
    });

    it('overrides priority when provided', async () => {
      mockPrisma.aiSkill.findMany.mockResolvedValue([
        makeDbSkill('ar', ['create invoice'], {
          id: 'skill-1',
          name: 'create_invoice',
          priority: 100,
        }),
        makeDbSkill('ar', ['aging report'], { id: 'skill-2', name: 'aging_report', priority: 200 }),
      ]);
      mockPrisma.aiSkillOverride.findMany.mockResolvedValue([
        { skillId: 'skill-1', isActive: null, triggerPhrasesOverride: [], priorityOverride: 999 },
      ]);
      mockPrisma.aiModuleKnowledge.findFirst.mockResolvedValue(null);

      const pack = await router.loadModulePack('ar', 'company-1');

      // skill-1 now has priority 999, should be first
      expect(pack.skills[0]!.name).toBe('create_invoice');
      expect(pack.skills[0]!.priority).toBe(999);
    });

    it('emits ai.skill.packLoaded event', async () => {
      mockPrisma.aiSkill.findMany.mockResolvedValue([
        makeDbSkill('ar', ['invoice'], { id: 'skill-1' }),
      ]);
      mockPrisma.aiSkillOverride.findMany.mockResolvedValue([]);
      mockPrisma.aiModuleKnowledge.findFirst.mockResolvedValue(null);

      await router.loadModulePack('ar', 'company-1', 'user-1');

      expect(mockEventBus.emit).toHaveBeenCalledWith('ai.skill.packLoaded', {
        moduleKey: 'ar',
        skillCount: 1,
        userId: 'user-1',
        companyId: 'company-1',
      });
    });
  });

  // ─── selectSkill ────────────────────────────────────────────────────────

  describe('L1: selectSkill()', () => {
    it('selects best-matching skill by trigger phrase', async () => {
      const pack = makeModulePack('ar', [
        makeSkillSummary({
          id: 'skill-1',
          name: 'create_invoice',
          triggerPhrases: ['create invoice', 'new invoice'],
        }),
        makeSkillSummary({
          id: 'skill-2',
          name: 'aging_report',
          triggerPhrases: ['aging report', 'overdue report'],
        }),
      ]);

      const result = await router.selectSkill('I need to create a new invoice', pack);

      expect(result).not.toBeNull();
      expect(result!.name).toBe('create_invoice');
      expect(result!.confidence).toBeGreaterThan(0);
    });

    it('excludes skills with negative trigger match', async () => {
      const pack = makeModulePack('ar', [
        makeSkillSummary({
          id: 'skill-1',
          name: 'create_invoice',
          triggerPhrases: ['create invoice'],
          negativeTriggers: ['credit note'],
        }),
        makeSkillSummary({
          id: 'skill-2',
          name: 'create_credit_note',
          triggerPhrases: ['create credit note'],
        }),
      ]);

      const result = await router.selectSkill('Create a credit note invoice', pack);

      // skill-1 has negative trigger "credit note" — should be excluded
      // skill-2 should match
      expect(result).not.toBeNull();
      expect(result!.name).toBe('create_credit_note');
    });

    it('returns null when no skill scores above threshold', async () => {
      const pack = makeModulePack('ar', [
        makeSkillSummary({
          triggerPhrases: ['very specific invoice terminology'],
        }),
      ]);

      const result = await router.selectSkill('hello world how are you', pack);

      expect(result).toBeNull();
    });

    it('returns null when pack has no skills', async () => {
      const pack = makeModulePack('ar', []);

      const result = await router.selectSkill('create invoice', pack);

      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // L2: Skill Activator (14.5)
  // ═══════════════════════════════════════════════════════════════════════

  describe('L2: activateSkill()', () => {
    it('returns full skill activation with content, parameters, examples', async () => {
      mockPrisma.aiSkill.findUnique.mockResolvedValue(makeFullDbSkill());
      mockPrisma.aiModuleKnowledge.findMany.mockResolvedValue([]);
      mockToolRegistry.getDefinition.mockReturnValue({
        name: 'get_customers',
        description: 'Get customers',
        moduleKey: 'ar',
        inputSchema: { type: 'object', properties: {} },
        type: 'query',
      });

      const result = await router.activateSkill(
        { id: 'skill-full-1', name: 'create_invoice', moduleKey: 'ar', confidence: 0.9 },
        'user-1',
      );

      expect(result).not.toBeNull();
      expect(result!.name).toBe('create_invoice');
      expect(result!.skillContent).toContain('You help create invoices');
      expect(result!.parameters).toEqual({ invoiceType: 'standard' });
      expect(result!.examples).toHaveLength(1);
      expect(result!.examples![0]!.input).toBe('Create an invoice');
    });

    it('resolves required tools from ToolRegistry', async () => {
      const toolDef = {
        name: 'get_customers',
        description: 'Get customers',
        moduleKey: 'ar',
        inputSchema: { type: 'object', properties: {} },
        type: 'query' as const,
      };
      mockPrisma.aiSkill.findUnique.mockResolvedValue(makeFullDbSkill());
      mockPrisma.aiModuleKnowledge.findMany.mockResolvedValue([]);
      mockToolRegistry.getDefinition
        .mockReturnValueOnce(toolDef) // get_customers
        .mockReturnValueOnce(undefined); // get_products — not registered

      const result = await router.activateSkill(
        { id: 'skill-full-1', name: 'create_invoice', moduleKey: 'ar', confidence: 0.9 },
        'user-1',
      );

      expect(result!.tools).toHaveLength(1);
      expect(result!.tools[0]!.name).toBe('get_customers');
    });

    it('logs warning for missing tool (not failure)', async () => {
      mockPrisma.aiSkill.findUnique.mockResolvedValue(makeFullDbSkill());
      mockPrisma.aiModuleKnowledge.findMany.mockResolvedValue([]);
      mockToolRegistry.getDefinition.mockReturnValue(undefined); // all tools missing

      const result = await router.activateSkill(
        { id: 'skill-full-1', name: 'create_invoice', moduleKey: 'ar', confidence: 0.9 },
        'user-1',
      );

      expect(result).not.toBeNull(); // Does NOT fail
      expect(result!.tools).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ toolName: 'get_customers' }),
        expect.stringContaining('required tool not registered'),
      );
    });

    it('loads module knowledge within token budget', async () => {
      mockPrisma.aiSkill.findUnique.mockResolvedValue(makeFullDbSkill());
      mockPrisma.aiModuleKnowledge.findMany.mockResolvedValue([
        {
          title: 'AR Entities',
          content: 'Invoice, CreditNote, Payment',
          knowledgeType: 'ENTITIES',
        },
        { title: 'AR Rules', content: 'Net 30 default terms', knowledgeType: 'BUSINESS_RULES' },
      ]);
      mockToolRegistry.getDefinition.mockReturnValue(undefined);

      const result = await router.activateSkill(
        { id: 'skill-full-1', name: 'create_invoice', moduleKey: 'ar', confidence: 0.9 },
        'user-1',
      );

      expect(result!.contextKnowledge).toContain('[ENTITIES] AR Entities');
      expect(result!.contextKnowledge).toContain('[BUSINESS_RULES] AR Rules');
    });

    it('emits ai.skill.activated event', async () => {
      mockPrisma.aiSkill.findUnique.mockResolvedValue(makeFullDbSkill());
      mockPrisma.aiModuleKnowledge.findMany.mockResolvedValue([]);
      mockToolRegistry.getDefinition.mockReturnValue(undefined);

      await router.activateSkill(
        { id: 'skill-full-1', name: 'create_invoice', moduleKey: 'ar', confidence: 0.85 },
        'user-1',
      );

      expect(mockEventBus.emit).toHaveBeenCalledWith('ai.skill.activated', {
        skillKey: 'create_invoice',
        moduleKey: 'ar',
        userId: 'user-1',
        companyId: '',
        confidence: 0.85,
      });
    });

    it('returns null when skill not found in DB', async () => {
      mockPrisma.aiSkill.findUnique.mockResolvedValue(null);

      const result = await router.activateSkill(
        { id: 'nonexistent', name: 'missing', moduleKey: 'ar', confidence: 0.9 },
        'user-1',
      );

      expect(result).toBeNull();
    });

    it('calculates totalTokens from content + contexts + knowledge', async () => {
      mockPrisma.aiSkill.findUnique.mockResolvedValue(makeFullDbSkill());
      mockPrisma.aiModuleKnowledge.findMany.mockResolvedValue([
        { title: 'Entities', content: 'Invoice, Payment', knowledgeType: 'ENTITIES' },
      ]);
      mockToolRegistry.getDefinition.mockReturnValue(undefined);

      const result = await router.activateSkill(
        { id: 'skill-full-1', name: 'create_invoice', moduleKey: 'ar', confidence: 0.9 },
        'user-1',
      );

      expect(result!.totalTokens).toBeGreaterThan(0);
    });
  });
});
