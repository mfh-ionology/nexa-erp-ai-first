// ---------------------------------------------------------------------------
// AdminDashboardService — AI Configuration Dashboard summary data
// E5c-3 Task 4: AC #1
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';

// ─── Response types ────────────────────────────────────────────────────────

export interface DashboardSummary {
  activeModels: {
    count: number;
    monthlyCost: string;
  };
  activeAgents: {
    count: number;
  };
  activeSkills: {
    byModule: Record<string, number>;
    total: number;
  };
  automations: {
    active: number;
    paused: number;
  };
  dailyTokenUsage: Array<{
    date: string;
    inputTokens: number;
    outputTokens: number;
    totalCost: string;
  }>;
}

// ─── Service ───────────────────────────────────────────────────────────────

export class AdminDashboardService {
  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
  ) {}

  async getDashboardSummary(companyId: string, days: number): Promise<DashboardSummary> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Run all independent queries in parallel
    const [
      activeModelCount,
      monthlyCostResult,
      activeAgentCount,
      skillsByModule,
      activeAutomationCount,
      pausedAutomationCount,
      dailyUsage,
    ] = await Promise.all([
      // Active models (global)
      this.db.aiModel.count({ where: { isActive: true } }),

      // Monthly cost (company-scoped via tenantId)
      this.db.aiUsage.aggregate({
        where: {
          tenantId: companyId,
          date: { gte: startOfMonth },
        },
        _sum: { totalCost: true },
      }),

      // Active agents (global)
      this.db.aiAgent.count({ where: { isActive: true } }),

      // Active skills grouped by moduleKey
      this.db.aiSkill.groupBy({
        by: ['moduleKey'],
        where: { isActive: true },
        _count: true,
      }),

      // Active automations (company-scoped, excluding those with paused schedules)
      this.db.aiAutomation.count({
        where: {
          companyId,
          isActive: true,
          OR: [{ schedule: null }, { schedule: { isPaused: false } }],
        },
      }),

      // Paused automations: active automation with a paused schedule
      this.db.aiAutomation.count({
        where: {
          companyId,
          isActive: true,
          schedule: { isPaused: true },
        },
      }),

      // Daily token usage for the last N days (company-scoped)
      this.db.aiUsage.groupBy({
        by: ['date'],
        where: {
          tenantId: companyId,
          date: { gte: cutoffDate },
        },
        _sum: {
          inputTokens: true,
          outputTokens: true,
          totalCost: true,
        },
        orderBy: { date: 'asc' },
      }),
    ]);

    // Build skills by-module map
    const byModule: Record<string, number> = {};
    let totalSkills = 0;
    for (const group of skillsByModule) {
      const key = group.moduleKey ?? 'unassigned';
      byModule[key] = group._count;
      totalSkills += group._count;
    }

    // Format daily usage
    const formattedDailyUsage = dailyUsage.map((row) => ({
      date: row.date.toISOString().split('T')[0]!,
      inputTokens: row._sum.inputTokens ?? 0,
      outputTokens: row._sum.outputTokens ?? 0,
      totalCost: (row._sum.totalCost ?? 0).toString(),
    }));

    this.logger.debug(
      { companyId, days, activeModelCount, activeAgentCount, totalSkills },
      'Dashboard summary fetched',
    );

    return {
      activeModels: {
        count: activeModelCount,
        monthlyCost: (monthlyCostResult._sum.totalCost ?? 0).toString(),
      },
      activeAgents: {
        count: activeAgentCount,
      },
      activeSkills: {
        byModule,
        total: totalSkills,
      },
      automations: {
        active: activeAutomationCount,
        paused: pausedAutomationCount,
      },
      dailyTokenUsage: formattedDailyUsage,
    };
  }
}
