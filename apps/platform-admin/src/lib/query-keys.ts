/**
 * Centralised query key factory for Platform Admin TanStack Query.
 *
 * Pattern: module -> scope -> params
 * Follows the same factory pattern as apps/web/src/lib/query-keys.ts
 */
export const queryKeys = {
  intelligence: {
    all: ['intelligence'] as const,
    summary: () => [...queryKeys.intelligence.all, 'summary'] as const,
    patterns: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.intelligence.all, 'patterns', filters] as const)
        : ([...queryKeys.intelligence.all, 'patterns'] as const),
    patternsInfinite: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.intelligence.all, 'patterns', 'infinite', filters] as const)
        : ([...queryKeys.intelligence.all, 'patterns', 'infinite'] as const),
    corrections: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.intelligence.all, 'corrections', filters] as const)
        : ([...queryKeys.intelligence.all, 'corrections'] as const),
    correctionsInfinite: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.intelligence.all, 'corrections', 'infinite', filters] as const)
        : ([...queryKeys.intelligence.all, 'corrections', 'infinite'] as const),
    skillEffectiveness: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.intelligence.all, 'skill-effectiveness', filters] as const)
        : ([...queryKeys.intelligence.all, 'skill-effectiveness'] as const),
    skillEffectivenessInfinite: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.intelligence.all, 'skill-effectiveness', 'infinite', filters] as const)
        : ([...queryKeys.intelligence.all, 'skill-effectiveness', 'infinite'] as const),
    insights: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.intelligence.all, 'insights', filters] as const)
        : ([...queryKeys.intelligence.all, 'insights'] as const),
    insightsInfinite: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.intelligence.all, 'insights', 'infinite', filters] as const)
        : ([...queryKeys.intelligence.all, 'insights', 'infinite'] as const),
  },
  aiUsage: {
    all: ['ai-usage'] as const,
    summary: () => [...queryKeys.aiUsage.all, 'summary'] as const,
    tenantUsage: (tenantId: string) => [...queryKeys.aiUsage.all, 'tenant', tenantId] as const,
    tenantUsageByFeature: (tenantId: string) =>
      [...queryKeys.aiUsage.all, 'tenant', tenantId, 'by-feature'] as const,
    alerts: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.aiUsage.all, 'alerts', filters] as const)
        : ([...queryKeys.aiUsage.all, 'alerts'] as const),
    providers: () => [...queryKeys.aiUsage.all, 'providers'] as const,
    tenantQuota: (tenantId: string) =>
      [...queryKeys.aiUsage.all, 'tenant', tenantId, 'quota'] as const,
    tenantByok: (tenantId: string) =>
      [...queryKeys.aiUsage.all, 'tenant', tenantId, 'byok'] as const,
  },
  knowledge: {
    all: ['knowledge'] as const,
    list: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.knowledge.all, 'list', filters] as const)
        : ([...queryKeys.knowledge.all, 'list'] as const),
    listInfinite: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.knowledge.all, 'list', 'infinite', filters] as const)
        : ([...queryKeys.knowledge.all, 'list', 'infinite'] as const),
    detail: (id: string) => [...queryKeys.knowledge.all, 'detail', id] as const,
  },
  support: {
    all: ['support'] as const,
    search: (q: string, type?: string) =>
      type ? (['support', 'search', q, type] as const) : (['support', 'search', q] as const),
    sessions: (filters?: Record<string, unknown>) =>
      filters ? (['support', 'sessions', filters] as const) : (['support', 'sessions'] as const),
  },
  auditLog: {
    all: ['audit-log'] as const,
    list: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.auditLog.all, 'list', filters] as const)
        : ([...queryKeys.auditLog.all, 'list'] as const),
    listInfinite: (filters?: Record<string, unknown>) =>
      filters
        ? ([...queryKeys.auditLog.all, 'list', 'infinite', filters] as const)
        : ([...queryKeys.auditLog.all, 'list', 'infinite'] as const),
    detail: (id: string) => [...queryKeys.auditLog.all, 'detail', id] as const,
  },
  platformUsers: {
    all: ['platform-users'] as const,
    listForFilter: () => ['platform-users', 'list-for-filter'] as const,
  },
} as const;
