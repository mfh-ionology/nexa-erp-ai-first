import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminDashboardService } from '../admin-dashboard.service.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

function createMockPrisma() {
  return {
    aiModel: { count: vi.fn() },
    aiAgent: { count: vi.fn() },
    aiSkill: { groupBy: vi.fn() },
    aiAutomation: { count: vi.fn() },
    aiUsage: {
      aggregate: vi.fn(),
      groupBy: vi.fn(),
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
// Tests
// ---------------------------------------------------------------------------

const TEST_COMPANY_ID = '11111111-1111-4000-a000-111111111111';

describe('AdminDashboardService', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let service: AdminDashboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    service = new AdminDashboardService(mockPrisma as any, mockLogger as any);
  });

  describe('getDashboardSummary', () => {
    it('returns all card data', async () => {
      // Set up mock responses for all parallel queries
      mockPrisma.aiModel.count.mockResolvedValue(5);
      mockPrisma.aiUsage.aggregate.mockResolvedValue({
        _sum: { totalCost: 123.45 },
      });
      mockPrisma.aiAgent.count.mockResolvedValue(3);
      mockPrisma.aiSkill.groupBy.mockResolvedValue([
        { moduleKey: 'sales', _count: 4 },
        { moduleKey: 'finance', _count: 2 },
      ]);
      // Active automations
      mockPrisma.aiAutomation.count
        .mockResolvedValueOnce(7) // active count
        .mockResolvedValueOnce(2); // paused count
      mockPrisma.aiUsage.groupBy.mockResolvedValue([
        {
          date: new Date('2026-03-01'),
          _sum: { inputTokens: 1000, outputTokens: 500, totalCost: 10.5 },
        },
        {
          date: new Date('2026-03-02'),
          _sum: { inputTokens: 2000, outputTokens: 1000, totalCost: 21.0 },
        },
      ]);

      const result = await service.getDashboardSummary(TEST_COMPANY_ID, 30);

      // Active models
      expect(result.activeModels.count).toBe(5);
      expect(result.activeModels.monthlyCost).toBe('123.45');

      // Active agents
      expect(result.activeAgents.count).toBe(3);

      // Active skills
      expect(result.activeSkills.total).toBe(6);
      expect(result.activeSkills.byModule).toEqual({ sales: 4, finance: 2 });

      // Automations
      expect(result.automations.active).toBe(7);
      expect(result.automations.paused).toBe(2);

      // Daily token usage
      expect(result.dailyTokenUsage).toHaveLength(2);
      expect(result.dailyTokenUsage[0]!.date).toBe('2026-03-01');
      expect(result.dailyTokenUsage[0]!.inputTokens).toBe(1000);
      expect(result.dailyTokenUsage[0]!.outputTokens).toBe(500);
    });

    it('handles null sums gracefully', async () => {
      mockPrisma.aiModel.count.mockResolvedValue(0);
      mockPrisma.aiUsage.aggregate.mockResolvedValue({
        _sum: { totalCost: null },
      });
      mockPrisma.aiAgent.count.mockResolvedValue(0);
      mockPrisma.aiSkill.groupBy.mockResolvedValue([]);
      mockPrisma.aiAutomation.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      mockPrisma.aiUsage.groupBy.mockResolvedValue([]);

      const result = await service.getDashboardSummary(TEST_COMPANY_ID, 30);

      expect(result.activeModels.count).toBe(0);
      expect(result.activeModels.monthlyCost).toBe('0');
      expect(result.activeSkills.total).toBe(0);
      expect(result.dailyTokenUsage).toHaveLength(0);
    });

    it('handles null moduleKey as "unassigned"', async () => {
      mockPrisma.aiModel.count.mockResolvedValue(0);
      mockPrisma.aiUsage.aggregate.mockResolvedValue({ _sum: { totalCost: null } });
      mockPrisma.aiAgent.count.mockResolvedValue(0);
      mockPrisma.aiSkill.groupBy.mockResolvedValue([{ moduleKey: null, _count: 3 }]);
      mockPrisma.aiAutomation.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      mockPrisma.aiUsage.groupBy.mockResolvedValue([]);

      const result = await service.getDashboardSummary(TEST_COMPANY_ID, 30);

      expect(result.activeSkills.byModule).toEqual({ unassigned: 3 });
      expect(result.activeSkills.total).toBe(3);
    });

    it('handles null daily usage sums', async () => {
      mockPrisma.aiModel.count.mockResolvedValue(0);
      mockPrisma.aiUsage.aggregate.mockResolvedValue({ _sum: { totalCost: null } });
      mockPrisma.aiAgent.count.mockResolvedValue(0);
      mockPrisma.aiSkill.groupBy.mockResolvedValue([]);
      mockPrisma.aiAutomation.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      mockPrisma.aiUsage.groupBy.mockResolvedValue([
        {
          date: new Date('2026-03-01'),
          _sum: { inputTokens: null, outputTokens: null, totalCost: null },
        },
      ]);

      const result = await service.getDashboardSummary(TEST_COMPANY_ID, 30);

      expect(result.dailyTokenUsage[0]!.inputTokens).toBe(0);
      expect(result.dailyTokenUsage[0]!.outputTokens).toBe(0);
      expect(result.dailyTokenUsage[0]!.totalCost).toBe('0');
    });
  });
});
