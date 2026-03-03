import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @nexa/db
// ---------------------------------------------------------------------------

vi.mock('@nexa/db', () => ({
  prisma: {},
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { AdminTriggerTestService } from '../admin-trigger-test.service.js';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function createMockPrisma() {
  return {
    aiSkill: {
      findMany: vi.fn(),
    },
  };
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

function makeActiveSkill(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-4000-a000-000000000010',
    name: 'ar-overdue-analysis',
    displayName: 'Overdue Invoice Analysis',
    moduleKey: 'ar',
    triggerPhrases: ['show me overdue invoices', 'analyse overdue accounts'],
    negativeTriggers: ['create invoice'],
    requiredTools: ['query_entity', 'analyse_data'],
    skillContent:
      '# Overdue Invoice Analysis\n\nAnalyse overdue invoices and recommend follow-up actions for the accounts receivable module. This skill queries the AR data to find...',
    priority: 200,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mockPrisma: ReturnType<typeof createMockPrisma>;
let service: AdminTriggerTestService;

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma = createMockPrisma();
  service = new AdminTriggerTestService(mockPrisma as any, mockLogger as any);
});

// ---------------------------------------------------------------------------
// testTrigger
// ---------------------------------------------------------------------------

describe('testTrigger', () => {
  it('exact phrase match returns high confidence', async () => {
    mockPrisma.aiSkill.findMany.mockResolvedValue([makeActiveSkill()]);

    const result = await service.testTrigger('show me overdue invoices');

    expect(result.noMatch).toBe(false);
    expect(result.matchedModule).toBe('ar');
    expect(result.matchedSkill).toBeTruthy();
    expect(result.matchedSkill!.name).toBe('ar-overdue-analysis');
    expect(result.l0Confidence).toBeGreaterThan(0.5);
    expect(result.l1Confidence).toBeGreaterThan(0.5);
    expect(result.requiredTools).toEqual(['query_entity', 'analyse_data']);
    expect(result.skillContentPreview.length).toBeLessThanOrEqual(200);
  });

  it('partial match returns lower confidence than exact match', async () => {
    mockPrisma.aiSkill.findMany.mockResolvedValue([makeActiveSkill()]);

    const exactResult = await service.testTrigger('show me overdue invoices');
    const partialResult = await service.testTrigger('overdue');

    expect(partialResult.noMatch).toBe(false);
    expect(partialResult.l1Confidence).toBeLessThan(exactResult.l1Confidence);
  });

  it('negative trigger reduces score', async () => {
    // "create invoice" is a negative trigger for the AR overdue skill
    const arSkill = makeActiveSkill();
    const salesSkill = makeActiveSkill({
      id: 'sales-skill-id',
      name: 'sales-invoice-creator',
      displayName: 'Invoice Creator',
      moduleKey: 'sales',
      triggerPhrases: ['create invoice', 'new invoice'],
      negativeTriggers: [],
      requiredTools: ['create_invoice'],
      priority: 150,
    });

    mockPrisma.aiSkill.findMany.mockResolvedValue([arSkill, salesSkill]);

    const result = await service.testTrigger('create invoice');

    // The sales skill should win because AR skill has "create invoice" as negative trigger
    expect(result.noMatch).toBe(false);
    expect(result.matchedModule).toBe('sales');
    expect(result.matchedSkill!.name).toBe('sales-invoice-creator');
  });

  it('no match returns noMatch=true with suggestions', async () => {
    mockPrisma.aiSkill.findMany.mockResolvedValue([
      makeActiveSkill(),
      makeActiveSkill({
        id: 's2',
        moduleKey: 'finance',
        name: 'fin-skill',
        triggerPhrases: ['reconcile bank'],
      }),
    ]);

    const result = await service.testTrigger('completely unrelated query about weather');

    expect(result.noMatch).toBe(true);
    expect(result.matchedModule).toBeNull();
    expect(result.matchedSkill).toBeNull();
    expect(result.requiredTools).toEqual([]);
    expect(result.suggestions).toContain('ar');
    expect(result.suggestions).toContain('finance');
  });

  it('respects isActive filter — only loads active skills', async () => {
    mockPrisma.aiSkill.findMany.mockResolvedValue([]);

    await service.testTrigger('test phrase');

    expect(mockPrisma.aiSkill.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
      }),
    );
  });

  it('returns empty result when no skills exist', async () => {
    mockPrisma.aiSkill.findMany.mockResolvedValue([]);

    const result = await service.testTrigger('anything');

    expect(result.noMatch).toBe(true);
    expect(result.matchedModule).toBeNull();
    expect(result.matchedSkill).toBeNull();
    expect(result.suggestions).toEqual([]);
  });

  it('skills with no moduleKey grouped under __unassigned__', async () => {
    const unassignedSkill = makeActiveSkill({
      id: 'unassigned-id',
      moduleKey: null,
      name: 'general-skill',
      triggerPhrases: ['help me with something'],
    });
    mockPrisma.aiSkill.findMany.mockResolvedValue([unassignedSkill]);

    const result = await service.testTrigger('help me with something');

    expect(result.noMatch).toBe(false);
    // When moduleKey is __unassigned__, matchedModule should be null
    expect(result.matchedModule).toBeNull();
    expect(result.matchedSkill!.name).toBe('general-skill');
  });

  it('skill content preview is truncated to 200 chars', async () => {
    const longContent = 'A'.repeat(500);
    mockPrisma.aiSkill.findMany.mockResolvedValue([makeActiveSkill({ skillContent: longContent })]);

    const result = await service.testTrigger('show me overdue invoices');

    expect(result.skillContentPreview.length).toBe(200);
  });

  it('higher priority skill wins when scores are close', async () => {
    const highPriority = makeActiveSkill({
      id: 'high-priority',
      name: 'ar-high-priority',
      displayName: 'High Priority Skill',
      triggerPhrases: ['overdue invoices'],
      priority: 900,
    });
    const lowPriority = makeActiveSkill({
      id: 'low-priority',
      name: 'ar-low-priority',
      displayName: 'Low Priority Skill',
      triggerPhrases: ['overdue invoices'],
      priority: 100,
    });

    mockPrisma.aiSkill.findMany.mockResolvedValue([highPriority, lowPriority]);

    const result = await service.testTrigger('overdue invoices');

    expect(result.matchedSkill!.name).toBe('ar-high-priority');
  });

  it('selects best module across multiple modules', async () => {
    const arSkill = makeActiveSkill({
      id: 'ar-id',
      moduleKey: 'ar',
      triggerPhrases: ['overdue invoices'],
    });
    const salesSkill = makeActiveSkill({
      id: 'sales-id',
      moduleKey: 'sales',
      name: 'sales-quotes',
      triggerPhrases: ['create a quote', 'new quotation'],
    });

    mockPrisma.aiSkill.findMany.mockResolvedValue([arSkill, salesSkill]);

    const result = await service.testTrigger('show me overdue invoices');

    expect(result.matchedModule).toBe('ar');
  });

  it('L0 confidence above threshold selects module correctly', async () => {
    mockPrisma.aiSkill.findMany.mockResolvedValue([makeActiveSkill()]);

    const result = await service.testTrigger('invoices');

    // "invoices" overlaps with "show me overdue invoices" at word level
    expect(result.l0Confidence).toBeGreaterThan(0.1);
    expect(result.noMatch).toBe(false);
  });
});
