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
  notifications: {
    all: ['notifications'] as const,
    list: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.notifications.all, 'list', params] as const)
        : ([...queryKeys.notifications.all, 'list'] as const),
    unreadCount: () => [...queryKeys.notifications.all, 'unread-count'] as const,
    detail: (id: string) => [...queryKeys.notifications.all, 'detail', id] as const,
    preferences: () => [...queryKeys.notifications.all, 'preferences'] as const,
    roleDefaults: (role: string) =>
      [...queryKeys.notifications.all, 'role-defaults', role] as const,
  },
  briefing: {
    all: ['briefing'] as const,
    current: (forceRefresh?: boolean) =>
      forceRefresh
        ? ([...queryKeys.briefing.all, 'current', { forceRefresh }] as const)
        : ([...queryKeys.briefing.all, 'current'] as const),
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
    automationRunsAll: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'automations', 'runs', 'all', params] as const)
        : ([...queryKeys.aiAdmin.all, 'automations', 'runs', 'all'] as const),
    automationRun: (runId: string) =>
      [...queryKeys.aiAdmin.all, 'automations', 'runs', runId] as const,
    automationHealth: () => [...queryKeys.aiAdmin.all, 'automations', 'health'] as const,
    automationVariables: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'variables', params] as const)
        : ([...queryKeys.aiAdmin.all, 'variables'] as const),
    // Knowledge articles
    knowledgeArticles: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'knowledge-articles', params] as const)
        : ([...queryKeys.aiAdmin.all, 'knowledge-articles'] as const),
    knowledgeArticlesInfinite: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'knowledge-articles', 'infinite', params] as const)
        : ([...queryKeys.aiAdmin.all, 'knowledge-articles', 'infinite'] as const),
    knowledgeArticle: (id: string) => [...queryKeys.aiAdmin.all, 'knowledge-articles', id] as const,
    knowledgeArticlesSuggested: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'knowledge-articles', 'suggested', params] as const)
        : ([...queryKeys.aiAdmin.all, 'knowledge-articles', 'suggested'] as const),
    // Training examples
    trainingExamples: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'training-examples', params] as const)
        : ([...queryKeys.aiAdmin.all, 'training-examples'] as const),
    trainingExamplesInfinite: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'training-examples', 'infinite', params] as const)
        : ([...queryKeys.aiAdmin.all, 'training-examples', 'infinite'] as const),
    trainingExample: (id: string) => [...queryKeys.aiAdmin.all, 'training-examples', id] as const,
    // Corrections
    corrections: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'corrections', params] as const)
        : ([...queryKeys.aiAdmin.all, 'corrections'] as const),
    correctionsInfinite: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'corrections', 'infinite', params] as const)
        : ([...queryKeys.aiAdmin.all, 'corrections', 'infinite'] as const),
    correctionStats: () => [...queryKeys.aiAdmin.all, 'corrections', 'stats'] as const,
    setupStatus: () => [...queryKeys.aiAdmin.all, 'setup-status'] as const,
    // Analytics
    analyticsSummary: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'analytics', 'summary', params] as const)
        : ([...queryKeys.aiAdmin.all, 'analytics', 'summary'] as const),
    analyticsBreakdown: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.aiAdmin.all, 'analytics', 'breakdown', params] as const)
        : ([...queryKeys.aiAdmin.all, 'analytics', 'breakdown'] as const),
    analyticsAlerts: () => [...queryKeys.aiAdmin.all, 'analytics', 'alerts'] as const,
  },
  // finance keys consolidated below (after email)
  tasks: {
    all: ['tasks'] as const,
    my: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.tasks.all, 'my', params] as const)
        : ([...queryKeys.tasks.all, 'my'] as const),
    list: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.tasks.all, 'list', params] as const)
        : ([...queryKeys.tasks.all, 'list'] as const),
    detail: (id: string) => [...queryKeys.tasks.all, id] as const,
    byEntity: (entityType: string, entityId: string) =>
      [...queryKeys.tasks.all, 'entity', entityType, entityId] as const,
  },
  printPreferences: {
    all: ['print-preferences'] as const,
    user: () => [...queryKeys.printPreferences.all, 'user'] as const,
    companyDefaults: () => [...queryKeys.printPreferences.all, 'company-defaults'] as const,
    batchStatus: (batchJobId: string) =>
      [...queryKeys.printPreferences.all, 'batch-status', batchJobId] as const,
  },
  documentTemplates: {
    all: ['document-templates'] as const,
    list: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.documentTemplates.all, 'list', params] as const)
        : ([...queryKeys.documentTemplates.all, 'list'] as const),
    listInfinite: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.documentTemplates.all, 'list', 'infinite', params] as const)
        : ([...queryKeys.documentTemplates.all, 'list', 'infinite'] as const),
    detail: (id: string) => [...queryKeys.documentTemplates.all, id] as const,
  },
  email: {
    all: ['email'] as const,
    preview: (documentType: string, recordId: string, templateId?: string) =>
      [...queryKeys.email.all, 'preview', documentType, recordId, templateId] as const,
    templates: (documentType: string) =>
      [...queryKeys.email.all, 'templates', documentType] as const,
    templateAdmin: {
      all: () => [...queryKeys.email.all, 'template-admin'] as const,
      list: (params?: Record<string, unknown>) =>
        params
          ? ([...queryKeys.email.all, 'template-admin', 'list', params] as const)
          : ([...queryKeys.email.all, 'template-admin', 'list'] as const),
      listInfinite: (params?: Record<string, unknown>) =>
        params
          ? ([...queryKeys.email.all, 'template-admin', 'list', 'infinite', params] as const)
          : ([...queryKeys.email.all, 'template-admin', 'list', 'infinite'] as const),
      detail: (id: string) => [...queryKeys.email.all, 'template-admin', id] as const,
    },
  },
  finance: {
    all: ['finance'] as const,
    // Accounts (from E14-API)
    accounts: {
      all: () => [...queryKeys.finance.all, 'accounts'] as const,
      list: (params?: Record<string, unknown>) =>
        params
          ? ([...queryKeys.finance.all, 'accounts', 'list', params] as const)
          : ([...queryKeys.finance.all, 'accounts', 'list'] as const),
      tree: (params?: Record<string, unknown>) =>
        params
          ? ([...queryKeys.finance.all, 'accounts', 'tree', params] as const)
          : ([...queryKeys.finance.all, 'accounts', 'tree'] as const),
      detail: (id: string) => [...queryKeys.finance.all, 'accounts', id] as const,
      search: (params?: Record<string, unknown>) =>
        params
          ? ([...queryKeys.finance.all, 'accounts', 'search', params] as const)
          : ([...queryKeys.finance.all, 'accounts', 'search'] as const),
    },
    // Settings
    settings: () => [...queryKeys.finance.all, 'settings'] as const,
    // Journals (E14-FE4)
    journals: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'journals', params] as const)
        : ([...queryKeys.finance.all, 'journals'] as const),
    journalsInfinite: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'journals', 'infinite', params] as const)
        : ([...queryKeys.finance.all, 'journals', 'infinite'] as const),
    journal: (id: string) => [...queryKeys.finance.all, 'journals', id] as const,
    // Periods
    periods: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'periods', params] as const)
        : ([...queryKeys.finance.all, 'periods'] as const),
    accountMappings: () => [...queryKeys.finance.all, 'account-mappings'] as const,
    trialBalance: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'trial-balance', params] as const)
        : ([...queryKeys.finance.all, 'trial-balance'] as const),
    profitAndLoss: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'profit-and-loss', params] as const)
        : ([...queryKeys.finance.all, 'profit-and-loss'] as const),
    balanceSheet: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'balance-sheet', params] as const)
        : ([...queryKeys.finance.all, 'balance-sheet'] as const),
    bankAccounts: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'bank-accounts', params] as const)
        : ([...queryKeys.finance.all, 'bank-accounts'] as const),
    bankAccountsInfinite: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'bank-accounts', 'infinite', params] as const)
        : ([...queryKeys.finance.all, 'bank-accounts', 'infinite'] as const),
    bankAccount: (id: string) => [...queryKeys.finance.all, 'bank-accounts', id] as const,
    bankReconciliation: (id: string) =>
      [...queryKeys.finance.all, 'bank-reconciliation', id] as const,
    bankTransactions: (bankAccountId: string, params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'bank-transactions', bankAccountId, params] as const)
        : ([...queryKeys.finance.all, 'bank-transactions', bankAccountId] as const),
    unmatchedJournalLines: (bankAccountId: string, params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'unmatched-journal-lines', bankAccountId, params] as const)
        : ([...queryKeys.finance.all, 'unmatched-journal-lines', bankAccountId] as const),
    glAccounts: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'gl-accounts', params] as const)
        : ([...queryKeys.finance.all, 'gl-accounts'] as const),
    // Dashboard (FE13)
    dashboard: () => [...queryKeys.finance.all, 'dashboard'] as const,
    // VAT Returns (FE9)
    vatReturns: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'vat-returns', params] as const)
        : ([...queryKeys.finance.all, 'vat-returns'] as const),
    vatReturn: (id: string) => [...queryKeys.finance.all, 'vat-returns', id] as const,
    // Budgets (FE10)
    budgets: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'budgets', params] as const)
        : ([...queryKeys.finance.all, 'budgets'] as const),
    budget: (id: string) => [...queryKeys.finance.all, 'budgets', id] as const,
    // Journal Templates (FE11)
    journalTemplates: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'journal-templates', params] as const)
        : ([...queryKeys.finance.all, 'journal-templates'] as const),
    journalTemplate: (id: string) => [...queryKeys.finance.all, 'journal-templates', id] as const,
    // Additional Reports (FE12)
    transactionJournal: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'transaction-journal', params] as const)
        : ([...queryKeys.finance.all, 'transaction-journal'] as const),
    budgetVariance: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'budget-variance', params] as const)
        : ([...queryKeys.finance.all, 'budget-variance'] as const),
    // Enhanced Reports (Wave 10)
    glDetail: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'gl-detail', params] as const)
        : ([...queryKeys.finance.all, 'gl-detail'] as const),
    generalLedger: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'general-ledger', params] as const)
        : ([...queryKeys.finance.all, 'general-ledger'] as const),
    departmentalPnl: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'departmental-pnl', params] as const)
        : ([...queryKeys.finance.all, 'departmental-pnl'] as const),
    // Year-End (FE14)
    yearEndStatus: (fiscalYear: number) =>
      [...queryKeys.finance.all, 'year-end', fiscalYear] as const,
    openingBalances: () => [...queryKeys.finance.all, 'opening-balances'] as const,
    // Month-End (FE15)
    monthEndPeriods: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'month-end', params] as const)
        : ([...queryKeys.finance.all, 'month-end'] as const),
    monthEndPeriod: (id: string) => [...queryKeys.finance.all, 'month-end', id] as const,
    // Dimension Types (Wave 9)
    dimensionTypes: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'dimension-types', params] as const)
        : ([...queryKeys.finance.all, 'dimension-types'] as const),
    dimensionType: (id: string) => [...queryKeys.finance.all, 'dimension-types', id] as const,
    // Dimension Values
    dimensionValues: (typeId: string, params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'dimension-values', typeId, params] as const)
        : ([...queryKeys.finance.all, 'dimension-values', typeId] as const),
    // Dimension Requirements
    dimensionRequirements: () => [...queryKeys.finance.all, 'dimension-requirements'] as const,
    // Dimension Defaults
    dimensionDefaults: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'dimension-defaults', params] as const)
        : ([...queryKeys.finance.all, 'dimension-defaults'] as const),
    // Simulations (Wave 9)
    simulations: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'simulations', params] as const)
        : ([...queryKeys.finance.all, 'simulations'] as const),
    simulationsInfinite: (params?: Record<string, unknown>) =>
      params
        ? ([...queryKeys.finance.all, 'simulations', 'infinite', params] as const)
        : ([...queryKeys.finance.all, 'simulations', 'infinite'] as const),
    simulation: (id: string) => [...queryKeys.finance.all, 'simulations', id] as const,
    // Budget Versions (Wave 9)
    budgetVersions: (fiscalYear?: number) =>
      fiscalYear
        ? ([...queryKeys.finance.all, 'budget-versions', fiscalYear] as const)
        : ([...queryKeys.finance.all, 'budget-versions'] as const),
    // Budget Keys (Wave 9)
    budgetKeys: () => [...queryKeys.finance.all, 'budget-keys'] as const,
  },
} as const;
