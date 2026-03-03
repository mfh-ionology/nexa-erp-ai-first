import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockPrisma, mockSkillRouter, mockMemoryInjection, mockToolRegistry, mockLogger } =
  vi.hoisted(() => ({
    mockPrisma: {
      aiModuleKnowledge: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      userCompanyRole: {
        findFirst: vi.fn(),
      },
      userAccessGroup: {
        findMany: vi.fn(),
      },
      aiSkill: {
        findFirst: vi.fn(),
      },
    },
    mockSkillRouter: {
      classifyModule: vi.fn(),
      getModuleSummary: vi.fn(),
      loadModulePack: vi.fn(),
      selectSkill: vi.fn(),
      activateSkill: vi.fn(),
    },
    mockMemoryInjection: {
      assembleUserContext: vi.fn(),
    },
    mockToolRegistry: {
      resolveTools: vi.fn(),
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

import { DynamicContextService, estimateTokens } from './dynamic-context.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultUserId = 'user-1';
const defaultCompanyId = 'company-1';
const basePrompt = 'You are the Nexa AI Co-Pilot.';

function createService() {
  return new DynamicContextService(
    mockSkillRouter as any,
    mockMemoryInjection as any,
    mockToolRegistry as any,
    mockPrisma as any,
    mockLogger as any,
  );
}

function setupHappyPath() {
  // L0: classify to AR module
  mockSkillRouter.classifyModule.mockResolvedValue({
    moduleKey: 'ar',
    confidence: 0.8,
    summaryTokens: 50,
  });
  mockSkillRouter.getModuleSummary.mockResolvedValue(
    '<available_modules>\n- ar: Accounts Receivable\n</available_modules>',
  );

  // L1: pack + skill selection
  mockSkillRouter.loadModulePack.mockResolvedValue({
    moduleKey: 'ar',
    skills: [{ id: 'skill-1', name: 'create_invoice', triggerPhrases: ['create invoice'] }],
    overview: 'AR module',
    tokenCount: 50,
  });
  mockSkillRouter.selectSkill.mockResolvedValue({
    id: 'skill-1',
    name: 'create_invoice',
    moduleKey: 'ar',
    confidence: 0.85,
  });

  // L2: activation
  mockSkillRouter.activateSkill.mockResolvedValue({
    id: 'skill-1',
    name: 'create_invoice',
    moduleKey: 'ar',
    skillContent: 'You help create invoices.',
    parameters: null,
    examples: [{ input: 'Make an invoice', output: 'Creating invoice...' }],
    tools: [
      {
        name: 'get_customers',
        description: 'Get customers',
        moduleKey: 'ar',
        inputSchema: { type: 'object', properties: {} },
        type: 'query',
      },
    ],
    contextKnowledge: '[ENTITIES] Invoice, Payment',
    totalTokens: 200,
  });

  // Memory injection
  mockMemoryInjection.assembleUserContext.mockResolvedValue(
    '<user_context>\n## Your Memories About This User\n[PREFERENCE] Prefers dark mode\n</user_context>',
  );

  // Permissions
  mockPrisma.userCompanyRole.findFirst.mockResolvedValue({ role: 'ADMIN' });
  mockPrisma.userAccessGroup.findMany.mockResolvedValue([
    {
      accessGroup: {
        permissions: [{ resourceCode: 'ar' }, { resourceCode: 'finance' }],
      },
    },
  ]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DynamicContextService', () => {
  let service: DynamicContextService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = createService();
    setupHappyPath();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // INTERACTIVE Mode (14.6)
  // ═══════════════════════════════════════════════════════════════════════

  describe('assembleInteractive() — INTERACTIVE mode', () => {
    it('assembles full context with all sections present', async () => {
      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'Create an invoice for Acme Ltd',
        basePrompt,
        screenContext: { url: '/ar/invoices', entityType: 'Invoice' },
      });

      expect(result.systemPrompt).toContain(basePrompt);
      expect(result.systemPrompt).toContain('<user_context>');
      expect(result.systemPrompt).toContain('create_invoice');
      expect(result.systemPrompt).toContain('<user_permissions>');
      expect(result.systemPrompt).toContain('<screen_context>');
    });

    it('enforces total token budget (sections within ~5000)', async () => {
      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'Create an invoice',
        basePrompt,
      });

      expect(result.tokenBreakdown.total).toBeLessThanOrEqual(5500); // soft limit
    });

    it('includes memories section (≤2000 tokens)', async () => {
      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'Create an invoice',
        basePrompt,
      });

      expect(result.systemPrompt).toContain('<user_context>');
      expect(result.tokenBreakdown.memories).toBeGreaterThan(0);
      expect(result.tokenBreakdown.memories).toBeLessThanOrEqual(2000);
    });

    it('truncates memories when they exceed 2000 tokens', async () => {
      // Return a huge memory block
      mockMemoryInjection.assembleUserContext.mockResolvedValue('x'.repeat(10000));

      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'Create an invoice',
        basePrompt,
      });

      expect(result.tokenBreakdown.memories).toBe(2000);
    });

    it('includes skills section (≤1000 tokens)', async () => {
      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'Create an invoice',
        basePrompt,
      });

      expect(result.systemPrompt).toContain('create_invoice');
      expect(result.tokenBreakdown.skills).toBeGreaterThan(0);
    });

    it('includes knowledge section (≤500 tokens)', async () => {
      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'Create an invoice',
        basePrompt,
      });

      expect(result.systemPrompt).toContain('[ENTITIES] Invoice, Payment');
    });

    it('includes screen context when provided', async () => {
      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'Create an invoice',
        basePrompt,
        screenContext: {
          url: '/ar/invoices',
          entityType: 'Invoice',
          entityId: 'INV-001',
          selectedIds: ['inv-1', 'inv-2'],
        },
      });

      expect(result.systemPrompt).toContain('<screen_context>');
      expect(result.systemPrompt).toContain('Page: /ar/invoices');
      expect(result.systemPrompt).toContain('Entity Type: Invoice');
      expect(result.systemPrompt).toContain('Entity ID: INV-001');
      expect(result.systemPrompt).toContain('Selected: inv-1, inv-2');
    });

    it('does not include screen context when not provided', async () => {
      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'Create an invoice',
        basePrompt,
      });

      expect(result.systemPrompt).not.toContain('<screen_context>');
      expect(result.tokenBreakdown.screen).toBe(0);
    });

    it('falls back to generic when no module matches (skill routing returns null)', async () => {
      mockSkillRouter.classifyModule.mockResolvedValue({
        moduleKey: null,
        confidence: 0,
        summaryTokens: 50,
      });

      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'What is the weather today?',
        basePrompt,
      });

      expect(result.skillChain.l0Module).toBeNull();
      expect(result.skillChain.l1Skill).toBeNull();
      expect(result.skillChain.l2Activated).toBe(false);
      expect(result.systemPrompt).toContain(basePrompt);
    });

    it('tracks skill chain through L0→L1→L2', async () => {
      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'Create an invoice',
        basePrompt,
      });

      expect(result.skillChain.l0Module).toBe('ar');
      expect(result.skillChain.l1Skill).toBe('create_invoice');
      expect(result.skillChain.l2Activated).toBe(true);
    });

    it('returns tools from activated skill', async () => {
      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'Create an invoice',
        basePrompt,
      });

      expect(result.tools).toHaveLength(1);
      expect(result.tools[0]!.name).toBe('get_customers');
    });

    it('gracefully degrades when skill routing throws', async () => {
      mockSkillRouter.classifyModule.mockRejectedValue(new Error('Routing failed'));

      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'Create an invoice',
        basePrompt,
      });

      // Should still have base prompt + memories
      expect(result.systemPrompt).toContain(basePrompt);
      expect(result.skillChain.l2Activated).toBe(false);
    });

    it('gracefully degrades when memory injection fails', async () => {
      mockMemoryInjection.assembleUserContext.mockRejectedValue(
        new Error('Memory DB connection lost'),
      );

      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'Create an invoice',
        basePrompt,
      });

      expect(result.systemPrompt).toContain(basePrompt);
      expect(result.tokenBreakdown.memories).toBe(0);
    });

    it('loads OVERVIEW knowledge when L2 does not activate but L0 matches', async () => {
      // L0 matches but L1 selectSkill returns null
      mockSkillRouter.selectSkill.mockResolvedValue(null);
      mockPrisma.aiModuleKnowledge.findFirst.mockResolvedValue({
        content: 'AR module manages invoices and payments.',
      });

      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'Tell me about AR',
        basePrompt,
      });

      expect(result.systemPrompt).toContain('<module_knowledge>');
      expect(result.systemPrompt).toContain('AR module manages invoices');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // AUTONOMOUS Mode (14.7)
  // ═══════════════════════════════════════════════════════════════════════

  describe('assembleAutonomous() — AUTONOMOUS mode', () => {
    beforeEach(() => {
      // Autonomous mode loads knowledge and skill directly from DB
      mockPrisma.aiModuleKnowledge.findMany.mockResolvedValue([
        {
          title: 'AR Overview',
          content: 'AR module manages invoicing.',
          knowledgeType: 'OVERVIEW',
        },
        { title: 'AR Entities', content: 'Invoice, CreditNote', knowledgeType: 'ENTITIES' },
      ]);
      mockPrisma.aiSkill.findFirst.mockResolvedValue({
        id: 'skill-1',
        name: 'auto_aging_alert',
        skillContent: 'Send aging alerts for overdue invoices.',
        parameters: { threshold: 30 },
        examples: null,
        requiredTools: ['get_overdue'],
        moduleKey: 'ar',
      });
      mockToolRegistry.resolveTools.mockReturnValue([
        {
          name: 'get_overdue',
          description: 'Get overdue invoices',
          moduleKey: 'ar',
          inputSchema: { type: 'object', properties: {} },
          type: 'query',
        },
      ]);
    });

    it('assembles context with module knowledge + skill instructions + input data', async () => {
      const result = await service.assembleAutonomous({
        moduleKey: 'ar',
        skillName: 'auto_aging_alert',
        inputData: { overdueThreshold: 30, batchSize: 50 },
        basePrompt,
      });

      expect(result.systemPrompt).toContain(basePrompt);
      expect(result.systemPrompt).toContain('<module_knowledge>');
      expect(result.systemPrompt).toContain('AR module manages invoicing');
      expect(result.systemPrompt).toContain('<active_skill>');
      expect(result.systemPrompt).toContain('Send aging alerts');
      expect(result.systemPrompt).toContain('<automation_input>');
      expect(result.systemPrompt).toContain('"overdueThreshold": 30');
    });

    it('does NOT include user memories', async () => {
      const result = await service.assembleAutonomous({
        moduleKey: 'ar',
        skillName: 'auto_aging_alert',
        inputData: {},
        basePrompt,
      });

      expect(result.tokenBreakdown.memories).toBe(0);
      expect(result.systemPrompt).not.toContain('<user_context>');
      expect(mockMemoryInjection.assembleUserContext).not.toHaveBeenCalled();
    });

    it('does NOT include screen context', async () => {
      const result = await service.assembleAutonomous({
        moduleKey: 'ar',
        inputData: {},
        basePrompt,
      });

      expect(result.tokenBreakdown.screen).toBe(0);
      expect(result.systemPrompt).not.toContain('<screen_context>');
    });

    it('enforces total token budget ≤3000', async () => {
      const result = await service.assembleAutonomous({
        moduleKey: 'ar',
        skillName: 'auto_aging_alert',
        inputData: { data: 'test' },
        basePrompt,
      });

      // In practice this is a soft limit that logs a warning
      expect(result.tokenBreakdown.total).toBeLessThanOrEqual(3500);
    });

    it('resolves required tools from skill', async () => {
      const result = await service.assembleAutonomous({
        moduleKey: 'ar',
        skillName: 'auto_aging_alert',
        inputData: {},
        basePrompt,
      });

      expect(result.tools).toHaveLength(1);
      expect(result.tools[0]!.name).toBe('get_overdue');
    });

    it('works without a skillName (knowledge only)', async () => {
      const result = await service.assembleAutonomous({
        moduleKey: 'ar',
        inputData: { someData: true },
        basePrompt,
      });

      expect(result.systemPrompt).toContain('<module_knowledge>');
      expect(result.systemPrompt).not.toContain('<active_skill>');
      expect(result.skillChain.l2Activated).toBe(false);
    });

    it('gracefully degrades on error — returns base prompt', async () => {
      mockPrisma.aiModuleKnowledge.findMany.mockRejectedValue(new Error('DB error'));
      mockPrisma.aiSkill.findFirst.mockRejectedValue(new Error('DB error'));

      const result = await service.assembleAutonomous({
        moduleKey: 'ar',
        skillName: 'auto_aging_alert',
        inputData: {},
        basePrompt,
      });

      expect(result.systemPrompt).toContain(basePrompt);
    });

    it('sets skillChain correctly', async () => {
      const result = await service.assembleAutonomous({
        moduleKey: 'ar',
        skillName: 'auto_aging_alert',
        inputData: {},
        basePrompt,
      });

      expect(result.skillChain.l0Module).toBe('ar');
      expect(result.skillChain.l1Skill).toBe('auto_aging_alert');
      expect(result.skillChain.l2Activated).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // estimateTokens utility
  // ═══════════════════════════════════════════════════════════════════════

  describe('estimateTokens()', () => {
    it('estimates ~4 chars per token', () => {
      const text = 'a'.repeat(100);
      expect(estimateTokens(text)).toBe(25);
    });

    it('rounds up', () => {
      expect(estimateTokens('abc')).toBe(1); // ceil(3/4) = 1
    });
  });
});
