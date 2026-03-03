// ---------------------------------------------------------------------------
// Integration test — L0→L1→L2 routing chain for E7 Views skill pack
// E5b-6 Task 8: Validates deterministic routing of natural language intents
// through the three-level progressive disclosure system to the correct
// views module skill.
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockEventBus, mockMemoryInjection, mockLogger } = vi.hoisted(() => ({
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

import { ToolRegistry, type ToolDefinition } from '@nexa/ai-tools';
import { SkillRouter } from './skill-router.js';
import { DynamicContextService } from './dynamic-context.service.js';

// ---------------------------------------------------------------------------
// Test data — simulates a seeded E7 Views module (5 skills)
// Matches the shapes defined in packages/db/prisma/seeds/skill-packs/views.ts
// ---------------------------------------------------------------------------

const COMPANY_ID = 'company-1';
const USER_ID = 'user-1';

// IDs for each skill
const SKILL_IDS = {
  open_entity_list: '00000000-0000-0000-0000-100000000001',
  search_views: '00000000-0000-0000-0000-100000000002',
  apply_filter: '00000000-0000-0000-0000-100000000003',
  list_saved_views: '00000000-0000-0000-0000-100000000004',
  create_saved_view: '00000000-0000-0000-0000-100000000005',
} as const;

// Skill DB records — shape matches what SkillRouter expects from Prisma
const viewsSkillsDb = [
  {
    id: SKILL_IDS.open_entity_list,
    name: 'open_entity_list',
    displayName: 'Open Entity List',
    moduleKey: 'views',
    packKey: 'views-core',
    triggerPhrases: [
      'show me',
      'open',
      'go to',
      'navigate to',
      'display',
      'view all',
      'show all',
      'list all',
      'show invoices',
      'show customers',
      'show contacts',
      'show users',
      'open invoices',
      'open customers',
    ],
    negativeTriggers: [
      'create an invoice',
      'create a customer',
      'create a contact',
      'delete',
      'edit',
      'update',
      'modify',
    ],
    contextRequired: [],
    priority: 100,
    isActive: true,
    skillContent: `You can open entity list pages for the user. Available view keys include INVOICES, CUSTOMERS, USERS, CONTACTS, and others matching the UPPERCASE_PLURAL convention of the entity table name.

When the user asks to "show", "open", or "go to" an entity list, determine the correct viewKey from their request. If they mention a specific saved view by name, include the savedViewName parameter so the saved view's filters, sort, and columns are applied automatically.

If the viewKey is ambiguous, ask the user to clarify which entity list they mean. Always use the UPPERCASE_PLURAL form for viewKey values.`,
    parameters: {
      viewKey: { type: 'string', required: true, description: 'Entity list view key' },
      savedViewName: {
        type: 'string',
        required: false,
        description: 'Name of saved view to apply',
      },
    },
    examples: [
      { input: 'show me all invoices', output: "open_entity_list(viewKey: 'INVOICES')" },
      { input: 'open the customers list', output: "open_entity_list(viewKey: 'CUSTOMERS')" },
    ],
    requiredTools: ['open_entity_list'],
    contexts: [],
  },
  {
    id: SKILL_IDS.search_views,
    name: 'search_views',
    displayName: 'Search Saved Views',
    moduleKey: 'views',
    packKey: 'views-core',
    triggerPhrases: [
      'find view',
      'search view',
      'look for view',
      'which view',
      'find the view',
      'where is the view',
      'overdue view',
      'show me the view',
    ],
    negativeTriggers: ['create a view', 'make a view', 'new view', 'delete view'],
    contextRequired: [],
    priority: 90,
    isActive: true,
    skillContent: `You can search for saved views by name. Use this when the user asks to find a specific saved view or mentions a view by name without specifying the exact entity list.

Perform a fuzzy search using the query parameter. Results include the view name, associated viewKey, scope (PERSONAL/ROLE/GLOBAL), and filter count.`,
    parameters: {
      query: { type: 'string', required: true, description: 'Fuzzy search term for view name' },
    },
    examples: [{ input: 'show me the overdue view', output: "search_views(query: 'overdue')" }],
    requiredTools: ['search_views', 'open_entity_list'],
    contexts: [],
  },
  {
    id: SKILL_IDS.apply_filter,
    name: 'apply_filter',
    displayName: 'Apply Filter',
    moduleKey: 'views',
    packKey: 'views-core',
    triggerPhrases: [
      'filter by',
      'filter',
      'show only',
      'where',
      'narrow down',
      'just show',
      'only show',
      'this month',
      'this week',
      'overdue',
      'outstanding',
    ],
    negativeTriggers: ['create a filter', 'save filter', 'delete filter'],
    contextRequired: ['screen:entity-list'],
    priority: 80,
    isActive: true,
    skillContent: `You can apply filter conditions to the currently active entity list view. Available filter operators: EQUALS, NOT_EQUALS, CONTAINS, STARTS_WITH, ENDS_WITH, GT, GTE, LT, LTE, BETWEEN, IN, NOT_IN, IS_EMPTY, IS_NOT_EMPTY.

Date presets available: today, yesterday, tomorrow, last3days, last7days, last30days, next7days, next30days, thisweek, lastweek, nextweek, thismonth, lastmonth, nextmonth, thisyear, lastyear, nextyear, mtd, ytd.`,
    parameters: {
      viewKey: { type: 'string', required: true, description: 'Entity list view key' },
      conditions: { type: 'array', required: true, description: 'Filter conditions to apply' },
    },
    examples: [
      {
        input: 'filter invoices by this month',
        output:
          "apply_filter(viewKey: 'INVOICES', conditions: [{ field: 'invoiceDate', operator: 'EQUALS', datePreset: 'thismonth' }])",
      },
    ],
    requiredTools: ['apply_filter'],
    contexts: [],
  },
  {
    id: SKILL_IDS.list_saved_views,
    name: 'list_saved_views',
    displayName: 'List Saved Views',
    moduleKey: 'views',
    packKey: 'views-core',
    triggerPhrases: [
      'list views',
      'what views',
      'available views',
      'my views',
      'saved views',
      'show views',
    ],
    negativeTriggers: ['create a view', 'delete a view'],
    contextRequired: [],
    priority: 70,
    isActive: true,
    skillContent: `You can list all saved views available to the user. Views are scoped: PERSONAL views are visible only to the creator, ROLE views to users with the matching role, and GLOBAL views to all users.`,
    parameters: {
      viewKey: {
        type: 'string',
        required: false,
        description: 'Entity list view key to filter by',
      },
    },
    examples: [
      {
        input: 'what views do I have for invoices?',
        output: "list_saved_views(viewKey: 'INVOICES')",
      },
    ],
    requiredTools: ['list_saved_views'],
    contexts: [],
  },
  {
    id: SKILL_IDS.create_saved_view,
    name: 'create_saved_view',
    displayName: 'Create Saved View',
    moduleKey: 'views',
    packKey: 'views-core',
    triggerPhrases: [
      'create a view',
      'save this view',
      'new view',
      'make a view',
      'save view as',
      'create view called',
    ],
    negativeTriggers: ['create an invoice', 'create a customer', 'create a contact', 'delete view'],
    contextRequired: [],
    priority: 60,
    isActive: true,
    skillContent: `You can create new saved views for entity lists. A saved view stores a named combination of filter conditions, sort configuration, and column visibility.

Filter operators: EQUALS, NOT_EQUALS, CONTAINS, STARTS_WITH, ENDS_WITH, GT, GTE, LT, LTE, BETWEEN, IN, NOT_IN, IS_EMPTY, IS_NOT_EMPTY.
Date presets: today, thisweek, thismonth, thisyear, last7days, last30days, mtd, ytd, and more.`,
    parameters: {
      name: { type: 'string', required: true, description: 'Name for the new saved view' },
      viewKey: { type: 'string', required: true, description: 'Entity list view key' },
      conditions: { type: 'array', required: true, description: 'Filter conditions for the view' },
      sortConfig: { type: 'array', required: false, description: 'Optional sort rules' },
    },
    examples: [
      {
        input: 'create a view called Big Invoices for amounts over 10000',
        output:
          "create_saved_view(name: 'Big Invoices', viewKey: 'INVOICES', conditions: [{ field: 'totalAmount', operator: 'GT', value: '10000' }])",
      },
    ],
    requiredTools: ['create_saved_view'],
    contexts: [],
  },
];

// Module knowledge entries
const viewsOverviewKnowledge = {
  moduleKey: 'views',
  knowledgeType: 'OVERVIEW',
  title: 'Views Module Overview',
  content:
    'The Saved Views module provides a metadata-driven DataTable system for entity list pages. It enables users to browse entity records (invoices, customers, users, etc.) through configurable list views with filtering, sorting, and column customisation.',
  priority: 100,
  isActive: true,
};

const viewsEntitiesKnowledge = {
  moduleKey: 'views',
  knowledgeType: 'ENTITIES',
  title: 'Views Module Entities',
  content:
    'Core entities: DataView (viewKey, viewName, entityTable), DataViewField (fieldKey, fieldLabel, fieldType, filterable, sortable), SavedView (name, scope PERSONAL/ROLE/GLOBAL, filterLogic, sortConfig, columnConfig), SavedViewCondition (fieldKey, operator, value, datePreset).',
  priority: 90,
  isActive: true,
};

const viewsWorkflowsKnowledge = {
  moduleKey: 'views',
  knowledgeType: 'WORKFLOWS',
  title: 'Views Module Workflows',
  content:
    'Key workflows: Open entity list, Apply saved view, Apply ad-hoc filter, Create saved view, Date presets, Column customisation.',
  priority: 80,
  isActive: true,
};

// ---------------------------------------------------------------------------
// Helper: build a compact L0 summary row from a full skill DB record
// (only the fields L0 module summary loading uses)
// ---------------------------------------------------------------------------
function toL0Summary(skill: (typeof viewsSkillsDb)[number]) {
  return {
    moduleKey: skill.moduleKey,
    triggerPhrases: skill.triggerPhrases,
    id: skill.id,
    name: skill.name,
    negativeTriggers: skill.negativeTriggers,
    contextRequired: skill.contextRequired,
    priority: skill.priority,
    isActive: skill.isActive,
  };
}

// L1 pack select fields
function toL1Summary(skill: (typeof viewsSkillsDb)[number]) {
  return {
    id: skill.id,
    name: skill.name,
    triggerPhrases: skill.triggerPhrases,
    negativeTriggers: skill.negativeTriggers,
    contextRequired: skill.contextRequired,
    priority: skill.priority,
  };
}

// ---------------------------------------------------------------------------
// Helper: register all views tools in a ToolRegistry
// ---------------------------------------------------------------------------
function registerAllViewsTools(toolRegistry: ToolRegistry) {
  const toolDefs = [
    {
      name: 'open_entity_list',
      description: 'Open an entity list view page',
      moduleKey: 'views',
      type: 'query' as const,
      inputSchema: {
        type: 'object' as const,
        properties: { viewKey: { type: 'string' } },
        required: ['viewKey'] as string[],
      },
    },
    {
      name: 'search_views',
      description: 'Search for a saved view by name',
      moduleKey: 'views',
      type: 'query' as const,
      inputSchema: {
        type: 'object' as const,
        properties: { query: { type: 'string' } },
        required: ['query'] as string[],
      },
    },
    {
      name: 'apply_filter',
      description: 'Apply a filter condition',
      moduleKey: 'views',
      type: 'action' as const,
      inputSchema: {
        type: 'object' as const,
        properties: { viewKey: { type: 'string' }, conditions: { type: 'array' } },
        required: ['viewKey', 'conditions'] as string[],
      },
    },
    {
      name: 'list_saved_views',
      description: 'List all available saved views',
      moduleKey: 'views',
      type: 'query' as const,
      inputSchema: { type: 'object' as const, properties: { viewKey: { type: 'string' } } },
    },
    {
      name: 'create_saved_view',
      description: 'Create a new saved view',
      moduleKey: 'views',
      type: 'action' as const,
      inputSchema: {
        type: 'object' as const,
        properties: {
          name: { type: 'string' },
          viewKey: { type: 'string' },
          conditions: { type: 'array' },
        },
        required: ['name', 'viewKey', 'conditions'] as string[],
      },
    },
  ];

  for (const def of toolDefs) {
    if (def.type === 'action') {
      toolRegistry.registerTool({
        definition: def as unknown as ToolDefinition & { type: 'action' },
      });
    } else {
      toolRegistry.registerTool({
        definition: def as unknown as ToolDefinition & { type: 'query' },
        handler: async () => ({ data: null, rowCount: 0 }),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integration: Views skill pack — L0→L1→L2 routing chain', () => {
  let toolRegistry: ToolRegistry;
  let skillRouter: SkillRouter;
  let contextService: DynamicContextService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Build a real ToolRegistry with all 5 views tool definitions
    toolRegistry = new ToolRegistry();
    registerAllViewsTools(toolRegistry);

    // Build a real SkillRouter with mock DB
    skillRouter = new SkillRouter(
      mockPrisma as any,
      mockLogger as any,
      toolRegistry,
      mockEventBus as any,
    );

    // Build a real DynamicContextService
    contextService = new DynamicContextService(
      skillRouter,
      mockMemoryInjection as any,
      toolRegistry,
      mockPrisma as any,
      mockLogger as any,
    );

    // ── Seed mock DB responses ──────────────────────────────────────────

    // L0: module summary loading — returns all views skills
    mockPrisma.aiSkill.findMany.mockImplementation(async (args: any) => {
      // L0 uses: { where: { isActive: true, moduleKey: { not: null } }, select: { moduleKey, triggerPhrases } }
      // L1 uses: { where: { moduleKey, isActive: true }, select: { id, name, triggerPhrases, ... } }
      if (args?.where?.moduleKey === 'views') {
        // L1 — load module pack for views
        return viewsSkillsDb.map(toL1Summary);
      }
      // L0 — all active skills
      return viewsSkillsDb.map(toL0Summary);
    });

    // Module knowledge
    mockPrisma.aiModuleKnowledge.findMany.mockImplementation(async (args: any) => {
      if (args?.where?.knowledgeType === 'OVERVIEW') {
        return [viewsOverviewKnowledge];
      }
      if (args?.where?.knowledgeType?.in?.includes('ENTITIES')) {
        return [viewsEntitiesKnowledge];
      }
      if (args?.where?.knowledgeType?.in?.includes('OVERVIEW')) {
        return [viewsOverviewKnowledge, viewsEntitiesKnowledge, viewsWorkflowsKnowledge];
      }
      return [];
    });

    // L0: module overview
    mockPrisma.aiModuleKnowledge.findFirst.mockResolvedValue(viewsOverviewKnowledge);

    // L1: overrides (none)
    mockPrisma.aiSkillOverride.findMany.mockResolvedValue([]);

    // L2: full skill load — dynamically returns the correct skill by ID
    mockPrisma.aiSkill.findUnique.mockImplementation(async (args: any) => {
      const id = args?.where?.id;
      return viewsSkillsDb.find((s) => s.id === id) ?? null;
    });

    // Memory injection
    mockMemoryInjection.assembleUserContext.mockResolvedValue(
      '<user_context>\n[PREFERENCE] User prefers tabular format\n</user_context>',
    );

    // Permissions
    mockPrisma.userCompanyRole.findFirst.mockResolvedValue({ role: 'ADMIN' });
    mockPrisma.userAccessGroup.findMany.mockResolvedValue([
      { accessGroup: { permissions: [{ resourceCode: 'views' }] } },
    ]);
  });

  // ─── 8.3: L0 classifies "show me all invoices" → module=views ─────

  it('L0 classifies "show me all invoices" as module=views', async () => {
    const classification = await skillRouter.classifyModule('show me all invoices');
    expect(classification.moduleKey).toBe('views');
    expect(classification.confidence).toBeGreaterThan(0);
  });

  // ─── 8.4: L1 loads views pack and selects open_entity_list ─────────

  it('L1 loads views pack (5 skills) and selects open_entity_list for "show me all invoices"', async () => {
    // L1: load module pack
    const pack = await skillRouter.loadModulePack('views', COMPANY_ID, USER_ID);
    expect(pack.moduleKey).toBe('views');
    expect(pack.skills).toHaveLength(5);

    // L1: select skill
    const selected = await skillRouter.selectSkill('show me all invoices', pack);
    expect(selected).not.toBeNull();
    expect(selected!.name).toBe('open_entity_list');
  });

  // ─── 8.5: L2 activates open_entity_list with tools resolved ────────

  it('L2 activates open_entity_list with tools and context knowledge', async () => {
    const pack = await skillRouter.loadModulePack('views', COMPANY_ID, USER_ID);
    const selected = await skillRouter.selectSkill('show me all invoices', pack);
    expect(selected).not.toBeNull();

    const activated = await skillRouter.activateSkill(selected!, USER_ID, COMPANY_ID);
    expect(activated).not.toBeNull();
    expect(activated!.name).toBe('open_entity_list');

    // Tools resolved
    expect(activated!.tools.length).toBeGreaterThanOrEqual(1);
    expect(activated!.tools[0]!.name).toBe('open_entity_list');

    // Skill content loaded
    expect(activated!.skillContent).toContain('entity list pages');
    expect(activated!.skillContent).toContain('viewKey');

    // Context knowledge injected (ENTITIES type)
    expect(activated!.contextKnowledge).toContain('ENTITIES');
    expect(activated!.contextKnowledge).toContain('Views Module Entities');
  });

  // ─── 8.6: Full chain for "show me the Overdue for more than 20 days View" → search_views ──

  it('routes "show me the Overdue for more than 20 days View" → search_views', async () => {
    const message = 'show me the Overdue for more than 20 days View';

    // L0
    const classification = await skillRouter.classifyModule(message);
    expect(classification.moduleKey).toBe('views');

    // L1
    const pack = await skillRouter.loadModulePack('views', COMPANY_ID, USER_ID);
    const selected = await skillRouter.selectSkill(message, pack);
    expect(selected).not.toBeNull();
    expect(selected!.name).toBe('search_views');

    // L2
    const activated = await skillRouter.activateSkill(selected!, USER_ID, COMPANY_ID);
    expect(activated).not.toBeNull();
    expect(activated!.tools.some((t) => t.name === 'search_views')).toBe(true);
  });

  // ─── 8.7: Full chain for "filter invoices by this month" → apply_filter ──

  it('routes "filter invoices by this month" → apply_filter', async () => {
    const message = 'filter invoices by this month';

    // L0
    const classification = await skillRouter.classifyModule(message);
    expect(classification.moduleKey).toBe('views');

    // L1
    const pack = await skillRouter.loadModulePack('views', COMPANY_ID, USER_ID);
    const selected = await skillRouter.selectSkill(message, pack);
    expect(selected).not.toBeNull();
    expect(selected!.name).toBe('apply_filter');

    // L2
    const activated = await skillRouter.activateSkill(selected!, USER_ID, COMPANY_ID);
    expect(activated).not.toBeNull();
    expect(activated!.tools.some((t) => t.name === 'apply_filter')).toBe(true);
  });

  // ─── 8.8: Full chain for "list my saved views" → list_saved_views ──

  it('routes "list my saved views" → list_saved_views', async () => {
    const message = 'list my saved views';

    // L0
    const classification = await skillRouter.classifyModule(message);
    expect(classification.moduleKey).toBe('views');

    // L1
    const pack = await skillRouter.loadModulePack('views', COMPANY_ID, USER_ID);
    const selected = await skillRouter.selectSkill(message, pack);
    expect(selected).not.toBeNull();
    expect(selected!.name).toBe('list_saved_views');
  });

  // ─── 8.9: Full chain for "create a view called Big Invoices..." → create_saved_view ──

  it('routes "create a view called Big Invoices for amounts over 10000" → create_saved_view', async () => {
    const message = 'create a view called Big Invoices for amounts over 10000';

    // L0
    const classification = await skillRouter.classifyModule(message);
    expect(classification.moduleKey).toBe('views');

    // L1
    const pack = await skillRouter.loadModulePack('views', COMPANY_ID, USER_ID);
    const selected = await skillRouter.selectSkill(message, pack);
    expect(selected).not.toBeNull();
    expect(selected!.name).toBe('create_saved_view');

    // L2
    const activated = await skillRouter.activateSkill(selected!, USER_ID, COMPANY_ID);
    expect(activated).not.toBeNull();
    expect(activated!.tools.some((t) => t.name === 'create_saved_view')).toBe(true);
  });

  // ─── 8.10: Negative trigger — "create an invoice" does NOT activate ──

  it('negative trigger: "create an invoice" does NOT activate any views skill', async () => {
    const message = 'create an invoice';

    // Regardless of L0 classification, L1 MUST NOT select any views skill
    // because "create an invoice" is a negative trigger for open_entity_list
    // and create_saved_view. Test L1 unconditionally against the views pack.
    const pack = await skillRouter.loadModulePack('views', COMPANY_ID, USER_ID);
    const selected = await skillRouter.selectSkill(message, pack);
    expect(selected).toBeNull();
  });

  // ─── 8.11: Negative trigger — "edit the customer record" does NOT activate ──

  it('negative trigger: "edit the customer record" does NOT activate any views skill', async () => {
    const message = 'edit the customer record';

    // Regardless of L0 classification, L1 MUST NOT select any views skill
    // because "edit" is a negative trigger for open_entity_list.
    // Test L1 unconditionally against the views pack.
    const pack = await skillRouter.loadModulePack('views', COMPANY_ID, USER_ID);
    const selected = await skillRouter.selectSkill(message, pack);
    expect(selected).toBeNull();
  });

  // ─── 8.12: Dynamic context assembly includes views skill chain ──────

  it('assembles full interactive context with views skill chain', async () => {
    const result = await contextService.assembleInteractive({
      userId: USER_ID,
      companyId: COMPANY_ID,
      userMessage: 'show me overdue invoices',
      basePrompt: 'You are the Nexa AI Co-Pilot.',
    });

    // Verify L0→L1→L2 chain
    expect(result.skillChain.l0Module).toBe('views');
    expect(result.skillChain.l1Skill).toBe('open_entity_list');
    expect(result.skillChain.l2Activated).toBe(true);

    // Verify tools resolved
    expect(result.tools.length).toBeGreaterThanOrEqual(1);
    expect(result.tools.some((t) => t.name === 'open_entity_list')).toBe(true);

    // Verify system prompt contains expected sections
    expect(result.systemPrompt).toContain('You are the Nexa AI Co-Pilot.');
    expect(result.systemPrompt).toContain('<user_context>');
    expect(result.systemPrompt).toContain('open_entity_list');
    expect(result.systemPrompt).toContain('entity list pages');
    expect(result.systemPrompt).toContain('<user_permissions>');

    // Verify system prompt contains module knowledge
    expect(result.systemPrompt).toContain('module_knowledge');

    // Verify token breakdown is populated
    expect(result.tokenBreakdown.base).toBeGreaterThan(0);
    expect(result.tokenBreakdown.memories).toBeGreaterThan(0);
    expect(result.tokenBreakdown.skills).toBeGreaterThan(0);
    expect(result.tokenBreakdown.total).toBeGreaterThan(0);
  });

  // ─── 8.13: Events emitted correctly during full chain ────────────────

  it('emits ai.skill.packLoaded and ai.skill.activated events during full chain', async () => {
    const message = 'show me all invoices';

    // Execute the full chain through DynamicContextService
    await contextService.assembleInteractive({
      userId: USER_ID,
      companyId: COMPANY_ID,
      userMessage: message,
      basePrompt: 'You are the Nexa AI Co-Pilot.',
    });

    // Collect all event names emitted
    const emitCalls = mockEventBus.emit.mock.calls.map((c: any[]) => c[0]);

    // Verify ai.skill.packLoaded was emitted with views module
    expect(emitCalls).toContain('ai.skill.packLoaded');
    const packLoadedCall = mockEventBus.emit.mock.calls.find(
      (c: any[]) => c[0] === 'ai.skill.packLoaded',
    );
    expect(packLoadedCall![1]).toMatchObject({
      moduleKey: 'views',
      skillCount: 5,
      userId: USER_ID,
      companyId: COMPANY_ID,
    });

    // Verify ai.skill.activated was emitted with open_entity_list
    expect(emitCalls).toContain('ai.skill.activated');
    const activatedCall = mockEventBus.emit.mock.calls.find(
      (c: any[]) => c[0] === 'ai.skill.activated',
    );
    expect(activatedCall![1]).toMatchObject({
      skillKey: 'open_entity_list',
      moduleKey: 'views',
      userId: USER_ID,
    });
  });
});
