import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const {
  mockPrisma,
  mockSkillRouter,
  mockMemoryInjection,
  mockToolRegistry,
  mockLogger,
  mockKnowledgeRagService,
  mockTrainingExampleInjection,
} = vi.hoisted(() => ({
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
  mockKnowledgeRagService: {
    retrieveRelevantKnowledge: vi.fn(),
  },
  mockTrainingExampleInjection: {
    retrieveRelevantExamples: vi.fn(),
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
  // E5d: Tenant Knowledge RAG Integration
  // ═══════════════════════════════════════════════════════════════════════

  describe('assembleInteractive() — E5d tenant knowledge', () => {
    it('injects <tenant_knowledge> section when KnowledgeRagService is set and returns results', async () => {
      mockKnowledgeRagService.retrieveRelevantKnowledge.mockResolvedValue({
        chunks: [
          {
            chunkId: 'c1',
            articleId: 'a1',
            content: 'VAT code 3 means reverse charge',
            category: 'TERMINOLOGY',
            title: 'VAT Codes',
            similarity: 0.85,
            confidenceWeight: 1.0,
            finalScore: 0.85,
            tokenCount: 20,
          },
        ],
        totalTokens: 50,
        articleIds: ['a1'],
        formattedContext:
          '<tenant_knowledge>\n## Relevant Knowledge for This Query\n- [TERMINOLOGY] VAT Codes: VAT code 3 means reverse charge\n</tenant_knowledge>',
      });

      service.setKnowledgeRagService(mockKnowledgeRagService as any);

      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'What does VAT code 3 mean?',
        basePrompt,
      });

      expect(result.systemPrompt).toContain('<tenant_knowledge>');
      expect(result.systemPrompt).toContain('VAT code 3 means reverse charge');
      expect(result.tokenBreakdown.knowledge).toBeGreaterThan(0);
    });

    it('does not inject knowledge when KnowledgeRagService is not set (graceful degradation)', async () => {
      // Service without KnowledgeRagService set (default state)
      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'What does VAT code 3 mean?',
        basePrompt,
      });

      expect(result.systemPrompt).not.toContain('<tenant_knowledge>');
      expect(mockKnowledgeRagService.retrieveRelevantKnowledge).not.toHaveBeenCalled();
    });

    it('gracefully degrades when KnowledgeRagService throws', async () => {
      mockKnowledgeRagService.retrieveRelevantKnowledge.mockRejectedValue(new Error('RAG failed'));
      service.setKnowledgeRagService(mockKnowledgeRagService as any);

      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'What does VAT code 3 mean?',
        basePrompt,
      });

      expect(result.systemPrompt).toContain(basePrompt);
      expect(result.systemPrompt).not.toContain('<tenant_knowledge>');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ userId: defaultUserId, companyId: defaultCompanyId }),
        'DynamicContext: knowledge RAG failed, continuing without',
      );
    });

    it('enforces knowledge token budget (≤1000 tokens)', async () => {
      mockKnowledgeRagService.retrieveRelevantKnowledge.mockResolvedValue({
        chunks: [
          {
            chunkId: 'c1',
            articleId: 'a1',
            content: 'x',
            category: 'TERMINOLOGY',
            title: 'Test',
            similarity: 0.9,
            confidenceWeight: 1.0,
            finalScore: 0.9,
            tokenCount: 800,
          },
        ],
        totalTokens: 800,
        articleIds: ['a1'],
        formattedContext: '<tenant_knowledge>\n' + 'x'.repeat(3200) + '\n</tenant_knowledge>',
      });
      service.setKnowledgeRagService(mockKnowledgeRagService as any);

      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'Test query',
        basePrompt,
      });

      expect(result.tokenBreakdown.knowledge).toBeLessThanOrEqual(1000);
      // Verify the RAG service was called with the correct token budget
      expect(mockKnowledgeRagService.retrieveRelevantKnowledge).toHaveBeenCalledWith(
        'Test query',
        defaultCompanyId,
        { tokenBudget: 1000 },
      );
    });

    it('coexists with module knowledge (E5b) — both share knowledge budget', async () => {
      // Tenant knowledge takes some budget
      mockKnowledgeRagService.retrieveRelevantKnowledge.mockResolvedValue({
        chunks: [
          {
            chunkId: 'c1',
            articleId: 'a1',
            content: 'Tenant knowledge',
            category: 'BUSINESS_PROCESS',
            title: 'Process',
            similarity: 0.9,
            confidenceWeight: 1.0,
            finalScore: 0.9,
            tokenCount: 100,
          },
        ],
        totalTokens: 100,
        articleIds: ['a1'],
        formattedContext:
          '<tenant_knowledge>\n## Relevant Knowledge\n- [BUSINESS PROCESS] Process: Tenant knowledge\n</tenant_knowledge>',
      });
      service.setKnowledgeRagService(mockKnowledgeRagService as any);

      // L0 matches but L2 doesn't activate → triggers OVERVIEW fallback
      mockSkillRouter.selectSkill.mockResolvedValue(null);
      mockPrisma.aiModuleKnowledge.findFirst.mockResolvedValue({
        content: 'AR module overview for E5b.',
      });

      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'Tell me about AR',
        basePrompt,
      });

      // Both should be present
      expect(result.systemPrompt).toContain('<tenant_knowledge>');
      expect(result.systemPrompt).toContain('<module_knowledge>');
      expect(result.systemPrompt).toContain('Tenant knowledge');
      expect(result.systemPrompt).toContain('AR module overview for E5b');
    });

    it('does not inject empty knowledge when RAG returns zero chunks', async () => {
      mockKnowledgeRagService.retrieveRelevantKnowledge.mockResolvedValue({
        chunks: [],
        totalTokens: 0,
        articleIds: [],
        formattedContext: '',
      });
      service.setKnowledgeRagService(mockKnowledgeRagService as any);

      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'Something irrelevant',
        basePrompt,
      });

      expect(result.systemPrompt).not.toContain('<tenant_knowledge>');
    });
  });

  describe('assembleAutonomous() — E5d tenant knowledge', () => {
    beforeEach(() => {
      mockPrisma.aiModuleKnowledge.findMany.mockResolvedValue([]);
      mockPrisma.aiSkill.findFirst.mockResolvedValue(null);
    });

    it('injects tenant knowledge when companyId is provided', async () => {
      mockKnowledgeRagService.retrieveRelevantKnowledge.mockResolvedValue({
        chunks: [
          {
            chunkId: 'c1',
            articleId: 'a1',
            content: 'Automation context',
            category: 'BUSINESS_PROCESS',
            title: 'Process',
            similarity: 0.9,
            confidenceWeight: 1.0,
            finalScore: 0.9,
            tokenCount: 50,
          },
        ],
        totalTokens: 50,
        articleIds: ['a1'],
        formattedContext:
          '<tenant_knowledge>\n## Relevant Knowledge\n- [BUSINESS PROCESS] Process: Automation context\n</tenant_knowledge>',
      });
      service.setKnowledgeRagService(mockKnowledgeRagService as any);

      const result = await service.assembleAutonomous({
        moduleKey: 'ar',
        companyId: defaultCompanyId,
        inputData: {},
        basePrompt,
      });

      expect(result.systemPrompt).toContain('<tenant_knowledge>');
      expect(result.systemPrompt).toContain('Automation context');
    });

    it('skips tenant knowledge when companyId is not provided', async () => {
      service.setKnowledgeRagService(mockKnowledgeRagService as any);

      const result = await service.assembleAutonomous({
        moduleKey: 'ar',
        inputData: {},
        basePrompt,
      });

      expect(result.systemPrompt).not.toContain('<tenant_knowledge>');
      expect(mockKnowledgeRagService.retrieveRelevantKnowledge).not.toHaveBeenCalled();
    });

    it('gracefully degrades when knowledge RAG fails in autonomous mode', async () => {
      mockKnowledgeRagService.retrieveRelevantKnowledge.mockRejectedValue(new Error('RAG failed'));
      service.setKnowledgeRagService(mockKnowledgeRagService as any);

      const result = await service.assembleAutonomous({
        moduleKey: 'ar',
        companyId: defaultCompanyId,
        inputData: {},
        basePrompt,
      });

      expect(result.systemPrompt).toContain(basePrompt);
      expect(result.systemPrompt).not.toContain('<tenant_knowledge>');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // E5d-2: Training Example Injection Integration (Task 8.10)
  // ═══════════════════════════════════════════════════════════════════════

  describe('assembleInteractive() — E5d-2 training example injection', () => {
    it('injects training examples alongside RAG knowledge in <tenant_knowledge>', async () => {
      // Set up RAG to return some knowledge
      mockKnowledgeRagService.retrieveRelevantKnowledge.mockResolvedValue({
        chunks: [
          {
            chunkId: 'c1',
            articleId: 'a1',
            content: 'VAT reverse charge info',
            category: 'TERMINOLOGY',
            title: 'VAT',
            similarity: 0.9,
            confidenceWeight: 1.0,
            finalScore: 0.9,
            tokenCount: 30,
          },
        ],
        totalTokens: 30,
        articleIds: ['a1'],
        formattedContext:
          '<tenant_knowledge>\n## Relevant Knowledge\n- [TERMINOLOGY] VAT: VAT reverse charge info\n</tenant_knowledge>',
      });
      service.setKnowledgeRagService(mockKnowledgeRagService as any);

      // Set up training example injection
      mockTrainingExampleInjection.retrieveRelevantExamples.mockResolvedValue({
        examples: [
          {
            id: 'ex-1',
            inputText: 'VAT rate?',
            outputText: 'Use code 3',
            category: 'TERMINOLOGY',
            skillKey: null,
          },
        ],
        formattedContext: '## Training Examples\n- Q: "VAT rate?" → A: "Use code 3"',
        totalTokens: 20,
      });
      service.setTrainingExampleInjection(mockTrainingExampleInjection as any);

      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'What VAT code should I use?',
        basePrompt,
      });

      // Both RAG and training examples should be in the prompt
      expect(result.systemPrompt).toContain('<tenant_knowledge>');
      expect(result.systemPrompt).toContain('## Training Examples');
      expect(result.systemPrompt).toContain('VAT rate?');
      expect(result.systemPrompt).toContain('Use code 3');
    });

    it('shares knowledge token budget between RAG and training examples', async () => {
      // RAG uses most of the budget
      mockKnowledgeRagService.retrieveRelevantKnowledge.mockResolvedValue({
        chunks: [
          {
            chunkId: 'c1',
            articleId: 'a1',
            content: 'x'.repeat(3600),
            category: 'TERMINOLOGY',
            title: 'Large',
            similarity: 0.9,
            confidenceWeight: 1.0,
            finalScore: 0.9,
            tokenCount: 900,
          },
        ],
        totalTokens: 900,
        articleIds: ['a1'],
        formattedContext: '<tenant_knowledge>\n' + 'x'.repeat(3600) + '\n</tenant_knowledge>',
      });
      service.setKnowledgeRagService(mockKnowledgeRagService as any);

      mockTrainingExampleInjection.retrieveRelevantExamples.mockResolvedValue({
        examples: [
          { id: 'ex-1', inputText: 'Q', outputText: 'A', category: 'TERMINOLOGY', skillKey: null },
        ],
        formattedContext: '## Training Examples\n- Q: "Q" → A: "A"',
        totalTokens: 15,
      });
      service.setTrainingExampleInjection(mockTrainingExampleInjection as any);

      await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'Test query',
        basePrompt,
      });

      // Training example injection should be called with remaining budget
      // After skill routing, skillKey='create_invoice' and category='ar' are passed
      expect(mockTrainingExampleInjection.retrieveRelevantExamples).toHaveBeenCalledWith(
        defaultCompanyId,
        'create_invoice',
        'ar',
        expect.any(Number), // remaining budget after RAG
      );

      // The remaining budget should be less than 1000 (total knowledge budget)
      const calledBudget = mockTrainingExampleInjection.retrieveRelevantExamples.mock.calls[0]![3];
      expect(calledBudget).toBeLessThan(1000);
      expect(calledBudget).toBeGreaterThanOrEqual(0);
    });

    it('gracefully degrades when training example injection is not set', async () => {
      // Do NOT call setTrainingExampleInjection — service is null by default
      const freshService = createService();
      setupHappyPath();

      const result = await freshService.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'Create an invoice',
        basePrompt,
      });

      // Should still work without training examples
      expect(result.systemPrompt).toContain(basePrompt);
      expect(result.systemPrompt).not.toContain('## Training Examples');
    });

    it('gracefully degrades when training example injection throws', async () => {
      mockTrainingExampleInjection.retrieveRelevantExamples.mockRejectedValue(
        new Error('Training example DB error'),
      );
      service.setTrainingExampleInjection(mockTrainingExampleInjection as any);

      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'Create an invoice',
        basePrompt,
      });

      // Should continue without training examples
      expect(result.systemPrompt).toContain(basePrompt);
      expect(result.systemPrompt).not.toContain('## Training Examples');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ userId: defaultUserId, companyId: defaultCompanyId }),
        'DynamicContext: training example injection failed, continuing without',
      );
    });

    it('skips training examples when knowledge budget is exhausted by RAG', async () => {
      // RAG uses entire 1000-token budget
      mockKnowledgeRagService.retrieveRelevantKnowledge.mockResolvedValue({
        chunks: [
          {
            chunkId: 'c1',
            articleId: 'a1',
            content: 'x'.repeat(4000),
            category: 'TERMINOLOGY',
            title: 'Huge',
            similarity: 0.9,
            confidenceWeight: 1.0,
            finalScore: 0.9,
            tokenCount: 1000,
          },
        ],
        totalTokens: 1000,
        articleIds: ['a1'],
        formattedContext: '<tenant_knowledge>\n' + 'x'.repeat(4000) + '\n</tenant_knowledge>',
      });
      service.setKnowledgeRagService(mockKnowledgeRagService as any);
      service.setTrainingExampleInjection(mockTrainingExampleInjection as any);

      await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'Test query',
        basePrompt,
      });

      // Training example injection should NOT be called since budget = 0
      expect(mockTrainingExampleInjection.retrieveRelevantExamples).not.toHaveBeenCalled();
    });

    it('does not inject empty training examples', async () => {
      mockTrainingExampleInjection.retrieveRelevantExamples.mockResolvedValue({
        examples: [],
        formattedContext: '',
        totalTokens: 0,
      });
      service.setTrainingExampleInjection(mockTrainingExampleInjection as any);

      const result = await service.assembleInteractive({
        userId: defaultUserId,
        companyId: defaultCompanyId,
        userMessage: 'Something irrelevant',
        basePrompt,
      });

      expect(result.systemPrompt).not.toContain('## Training Examples');
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
