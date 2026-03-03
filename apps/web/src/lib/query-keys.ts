/**
 * Centralised query key factory for TanStack Query.
 *
 * Every query key used in the application MUST be defined here
 * to enable targeted invalidation and cache management.
 *
 * Pattern: module → scope → params
 */
export const queryKeys = {
  auth: {
    all: ['auth'] as const,
    me: () => [...queryKeys.auth.all, 'me'] as const,
    permissions: () => [...queryKeys.auth.all, 'permissions'] as const,
  },
  system: {
    all: ['system'] as const,
    companies: () => [...queryKeys.system.all, 'companies'] as const,
    company: (id: string) => [...queryKeys.system.all, 'company', id] as const,
    resources: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.system.all, 'resources', params] as const)
        : ([...queryKeys.system.all, 'resources'] as const),
    resourcesInfinite: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.system.all, 'resources', 'infinite', params] as const)
        : ([...queryKeys.system.all, 'resources', 'infinite'] as const),
    accessGroups: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.system.all, 'access-groups', params] as const)
        : ([...queryKeys.system.all, 'access-groups'] as const),
    accessGroupsInfinite: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.system.all, 'access-groups', 'infinite', params] as const)
        : ([...queryKeys.system.all, 'access-groups', 'infinite'] as const),
    accessGroup: (id: string) => [...queryKeys.system.all, 'access-groups', id] as const,
    users: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.system.all, 'users', params] as const)
        : ([...queryKeys.system.all, 'users'] as const),
    usersInfinite: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.system.all, 'users', 'infinite', params] as const)
        : ([...queryKeys.system.all, 'users', 'infinite'] as const),
    user: (id: string) => [...queryKeys.system.all, 'users', id] as const,
    userAccessGroups: (userId: string) =>
      [...queryKeys.system.all, 'users', userId, 'access-groups'] as const,
    exportDefaults: () => [...queryKeys.system.all, 'export-defaults'] as const,
  },
  views: {
    all: ['views'] as const,
    init: (viewKey: string) => [...queryKeys.views.all, 'init', viewKey] as const,
    saved: (viewKey: string) => [...queryKeys.views.all, 'saved', viewKey] as const,
    favourites: () => [...queryKeys.views.all, 'favourites'] as const,
    columns: (viewKey: string) => [...queryKeys.views.all, 'columns', viewKey] as const,
    lov: (fieldId: string) => [...queryKeys.views.all, 'lov', fieldId] as const,
    lovBatch: (viewKey: string) => [...queryKeys.views.all, 'lov', 'batch', viewKey] as const,
  },
  ai: {
    all: ['ai'] as const,
    memories: () => [...queryKeys.ai.all, 'memories'] as const,
    memorySettings: () => [...queryKeys.ai.all, 'memory-settings'] as const,
    skills: () => [...queryKeys.ai.all, 'skills'] as const,
    entityTriggers: () => [...queryKeys.ai.all, 'entity-triggers'] as const,
    entitySearch: (type: string | null, q: string, scopeBy?: string, scopeValue?: string) =>
      [...queryKeys.ai.all, 'entity-search', type, q, scopeBy, scopeValue] as const,
  },
  attachments: {
    all: ['attachments'] as const,
    list: (entityType: string, entityId: string) =>
      [...queryKeys.attachments.all, entityType, entityId] as const,
    count: (entityType: string, entityId: string) =>
      [...queryKeys.attachments.all, 'count', entityType, entityId] as const,
  },
  notes: {
    all: ['notes'] as const,
    list: (entityType: string, entityId: string) =>
      [...queryKeys.notes.all, entityType, entityId] as const,
  },
  recordLinks: {
    all: ['record-links'] as const,
    list: (entityType: string, entityId: string) =>
      [...queryKeys.recordLinks.all, entityType, entityId] as const,
    count: (entityType: string, entityId: string) =>
      [...queryKeys.recordLinks.all, 'count', entityType, entityId] as const,
  },
  aiAdmin: {
    all: ['ai-admin'] as const,
    dashboard: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'dashboard', params] as const)
        : ([...queryKeys.aiAdmin.all, 'dashboard'] as const),
    models: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'models', params] as const)
        : ([...queryKeys.aiAdmin.all, 'models'] as const),
    modelsInfinite: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'models', 'infinite', params] as const)
        : ([...queryKeys.aiAdmin.all, 'models', 'infinite'] as const),
    model: (id: string) => [...queryKeys.aiAdmin.all, 'models', id] as const,
    prompts: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'prompts', params] as const)
        : ([...queryKeys.aiAdmin.all, 'prompts'] as const),
    promptsInfinite: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'prompts', 'infinite', params] as const)
        : ([...queryKeys.aiAdmin.all, 'prompts', 'infinite'] as const),
    prompt: (id: string) => [...queryKeys.aiAdmin.all, 'prompts', id] as const,
    promptVersions: (id: string) => [...queryKeys.aiAdmin.all, 'prompts', id, 'versions'] as const,
    promptVersion: (id: string, version: number) =>
      [...queryKeys.aiAdmin.all, 'prompts', id, 'versions', version] as const,
    agents: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'agents', params] as const)
        : ([...queryKeys.aiAdmin.all, 'agents'] as const),
    agentsInfinite: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'agents', 'infinite', params] as const)
        : ([...queryKeys.aiAdmin.all, 'agents', 'infinite'] as const),
    agent: (id: string) => [...queryKeys.aiAdmin.all, 'agents', id] as const,
    skills: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'skills', params] as const)
        : ([...queryKeys.aiAdmin.all, 'skills'] as const),
    skillsInfinite: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'skills', 'infinite', params] as const)
        : ([...queryKeys.aiAdmin.all, 'skills', 'infinite'] as const),
    skillsGrouped: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'skills', 'grouped', params] as const)
        : ([...queryKeys.aiAdmin.all, 'skills', 'grouped'] as const),
    skill: (id: string) => [...queryKeys.aiAdmin.all, 'skills', id] as const,
    automations: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'automations', params] as const)
        : ([...queryKeys.aiAdmin.all, 'automations'] as const),
    automationsInfinite: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'automations', 'infinite', params] as const)
        : ([...queryKeys.aiAdmin.all, 'automations', 'infinite'] as const),
    automation: (id: string) => [...queryKeys.aiAdmin.all, 'automations', id] as const,
    automationRuns: (automationId: string, params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'automations', automationId, 'runs', params] as const)
        : ([...queryKeys.aiAdmin.all, 'automations', automationId, 'runs'] as const),
    automationRun: (runId: string) =>
      [...queryKeys.aiAdmin.all, 'automations', 'runs', runId] as const,
    automationVariables: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'variables', params] as const)
        : ([...queryKeys.aiAdmin.all, 'variables'] as const),
  },
} as const;
