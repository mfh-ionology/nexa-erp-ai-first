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
} as const;
