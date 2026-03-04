/**
 * TypeScript interfaces for the AI Admin API.
 *
 * Matches the response schemas defined in apps/api/src/ai/admin/admin.schemas.ts
 * and the API contract from E5c-3.
 */

// ─── Prompt category enum ──────────────────────────────────────────────────

export type PromptCategory =
  | 'record-creation'
  | 'query'
  | 'analysis'
  | 'briefing'
  | 'skill'
  | 'chat'
  | 'automation';

// ─── Model types ────────────────────────────────────────────────────────────

export interface AiModelListItem {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  displayName: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  costPerMInput: string;
  costPerMOutput: string;
  routingTags: string[];
  capabilities: unknown;
  isActive: boolean;
  isDefault: boolean;
  fallbackModelId: string | null;
  agentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiModelDetail extends AiModelListItem {
  fallbackModel: {
    id: string;
    name: string;
    displayName: string;
  } | null;
  config: unknown;
}

// ─── Model request types ────────────────────────────────────────────────────

export interface CreateAiModelRequest {
  name: string;
  provider: string;
  modelId: string;
  displayName: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  costPerMInput: string;
  costPerMOutput: string;
  capabilities?: Record<string, unknown>;
  isActive?: boolean;
  isDefault?: boolean;
  config?: Record<string, unknown>;
  fallbackModelId?: string;
  routingTags?: string[];
}

export interface UpdateAiModelRequest {
  name?: string;
  provider?: string;
  modelId?: string;
  displayName?: string;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  costPerMInput?: string;
  costPerMOutput?: string;
  capabilities?: Record<string, unknown>;
  isActive?: boolean;
  isDefault?: boolean;
  config?: Record<string, unknown> | null;
  fallbackModelId?: string | null;
  routingTags?: string[];
}

// ─── Model list params ──────────────────────────────────────────────────────

export interface AiModelListParams {
  cursor?: string;
  limit?: number;
  isActive?: boolean;
  provider?: string;
  search?: string;
}

// ─── Model list response ────────────────────────────────────────────────────

interface AiModelListMeta {
  cursor?: string;
  hasMore: boolean;
}

export interface AiModelListResponse {
  data: AiModelListItem[];
  meta: AiModelListMeta;
}

// ─── Prompt types ───────────────────────────────────────────────────────────

export interface AiPromptListItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  activeVersion: number;
  isActive: boolean;
  variableCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiPromptVariable {
  id: string;
  variableName: string;
  displayName: string;
  sourceType: string;
}

export interface AiPromptDetail extends AiPromptListItem {
  systemPrompt: string;
  userTemplate: string;
  parameters: unknown;
  outputFormat: unknown;
  variables: AiPromptVariable[];
  versionCount: number;
}

// ─── Prompt request types ───────────────────────────────────────────────────

export interface CreateAiPromptRequest {
  name: string;
  description?: string;
  category: PromptCategory;
  systemPrompt: string;
  userTemplate: string;
  parameters?: unknown;
  outputFormat?: unknown;
  isActive?: boolean;
}

export interface UpdateAiPromptRequest {
  name?: string;
  description?: string | null;
  category?: PromptCategory;
  systemPrompt?: string;
  userTemplate?: string;
  parameters?: unknown;
  outputFormat?: unknown;
  isActive?: boolean;
  changeReason: string;
}

// ─── Prompt list params ─────────────────────────────────────────────────────

export interface AiPromptListParams {
  cursor?: string;
  limit?: number;
  category?: PromptCategory;
  isActive?: boolean;
  search?: string;
}

// ─── Prompt list response ───────────────────────────────────────────────────

interface AiPromptListMeta {
  cursor?: string;
  hasMore: boolean;
}

export interface AiPromptListResponse {
  data: AiPromptListItem[];
  meta: AiPromptListMeta;
}

// ─── Prompt version types ───────────────────────────────────────────────────

export interface AiPromptVersionItem {
  id: string;
  promptId: string;
  version: number;
  changeReason: string | null;
  createdBy: string;
  createdAt: string;
  snippet: string;
}

export interface AiPromptVersionDetail extends AiPromptVersionItem {
  systemPrompt: string;
  userTemplate: string;
  parameters: unknown;
}

// ─── Test render types ──────────────────────────────────────────────────────

export interface TestRenderRequest {
  sampleVariables?: Record<string, string>;
  entityId?: string;
  entityType?: string;
}

export interface TestRenderResult {
  systemPrompt: string;
  userTemplate: string;
  resolvedVariables: Record<string, string>;
  unresolvedCount: number;
}

// ─── Dashboard types ────────────────────────────────────────────────────────

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
    last24hRuns: {
      success: number;
      failed: number;
    };
  };
  dailyTokenUsage: Array<{
    date: string;
    inputTokens: number;
    outputTokens: number;
    totalCost: string;
  }>;
}

export interface DashboardParams {
  days?: number;
}

// ─── Agent types ───────────────────────────────────────────────────────────

export interface AiAgentListItem {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  modelId: string | null;
  modelDisplayName: string | null;
  promptId: string;
  promptName: string;
  routingTags: string[];
  toolCount: number;
  maxTurns: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentGuardrails {
  canRead: string[];
  canWrite: string[];
  requiresApproval: boolean;
  maxAmountWithoutApproval?: string;
  blockedOperations: string[];
  dataScope: 'own' | 'module' | 'all';
}

export interface AiAgentDetail extends AiAgentListItem {
  tools: unknown;
  guardrails: AgentGuardrails;
  triggerConfig: unknown;
  model: {
    id: string;
    name: string;
    displayName: string;
    provider: string;
  } | null;
  prompt: {
    id: string;
    name: string;
    description: string | null;
    category: string;
  };
  automationStepCount: number;
}

// ─── Agent request types ───────────────────────────────────────────────────

export interface CreateAiAgentRequest {
  name: string;
  displayName: string;
  description?: string;
  modelId?: string | null;
  promptId: string;
  routingTags?: string[];
  tools?: unknown;
  guardrails?: AgentGuardrails;
  triggerConfig?: unknown;
  maxTurns?: number;
  isActive?: boolean;
}

export interface UpdateAiAgentRequest {
  name?: string;
  displayName?: string;
  description?: string | null;
  modelId?: string | null;
  promptId?: string;
  routingTags?: string[];
  tools?: unknown;
  guardrails?: AgentGuardrails;
  triggerConfig?: unknown;
  maxTurns?: number;
  isActive?: boolean;
}

// ─── Agent list params ─────────────────────────────────────────────────────

export interface AiAgentListParams {
  cursor?: string;
  limit?: number;
  isActive?: boolean;
  search?: string;
  modelId?: string;
}

// ─── Agent list response ───────────────────────────────────────────────────

interface AiAgentListMeta {
  cursor?: string;
  hasMore: boolean;
}

export interface AiAgentListResponse {
  data: AiAgentListItem[];
  meta: AiAgentListMeta;
}

// ─── Skill types ───────────────────────────────────────────────────────────

export type SkillCategory = 'document' | 'analysis' | 'communication' | 'financial';

export type SkillOutputType = 'pdf' | 'json' | 'markdown' | 'email';

export type OrchestrationPattern =
  | 'SEQUENTIAL'
  | 'PARALLEL'
  | 'ITERATIVE'
  | 'CONTEXT_AWARE'
  | 'DOMAIN_INTELLIGENCE';

export interface AiSkillListItem {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  category: string;
  moduleKey: string | null;
  packKey: string | null;
  triggerPhrases: string[];
  negativeTriggers: string[];
  orchestrationPattern: string | null;
  priority: number;
  version: number;
  isActive: boolean;
  outputType: string;
  requiredToolCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AiSkillDetail extends AiSkillListItem {
  skillContent: string;
  inputSchema: unknown;
  requiredTools: string[];
  contextRequired: string[];
  parameters: unknown;
  examples: unknown;
  contextCount: number;
  overrideCount: number;
}

// ─── Skill request types ───────────────────────────────────────────────────

export interface CreateAiSkillRequest {
  name: string;
  displayName: string;
  description?: string;
  category: SkillCategory;
  skillContent: string;
  triggerPhrases: string[];
  inputSchema?: unknown;
  outputType: SkillOutputType;
  requiredTools?: string[];
  isActive?: boolean;
  moduleKey?: string;
  packKey?: string;
  negativeTriggers?: string[];
  contextRequired?: string[];
  orchestrationPattern?: OrchestrationPattern | null;
  parameters?: unknown;
  examples?: unknown;
  priority?: number;
}

export interface UpdateAiSkillRequest {
  name?: string;
  displayName?: string;
  description?: string | null;
  category?: SkillCategory;
  skillContent?: string;
  triggerPhrases?: string[];
  inputSchema?: unknown;
  outputType?: SkillOutputType;
  requiredTools?: string[];
  isActive?: boolean;
  moduleKey?: string | null;
  packKey?: string | null;
  negativeTriggers?: string[];
  contextRequired?: string[];
  orchestrationPattern?: OrchestrationPattern | null;
  parameters?: unknown | null;
  examples?: unknown | null;
  priority?: number;
}

// ─── Skill list params ─────────────────────────────────────────────────────

export interface AiSkillListParams {
  cursor?: string;
  limit?: number;
  moduleKey?: string;
  category?: SkillCategory;
  isActive?: boolean;
  search?: string;
  grouped?: boolean;
}

// ─── Skill list response ───────────────────────────────────────────────────

interface AiSkillListMeta {
  cursor?: string;
  hasMore: boolean;
}

export interface AiSkillListResponse {
  data: AiSkillListItem[];
  meta: AiSkillListMeta;
}

// ─── Skill grouped response ────────────────────────────────────────────────

export interface SkillGroup {
  moduleKey: string | null;
  skills: AiSkillListItem[];
}

export interface SkillsGroupedResponse {
  groups: SkillGroup[];
  totalCount: number;
}

// ─── Automation types ──────────────────────────────────────────────────────

export type AutomationTriggerType = 'SCHEDULED' | 'EVENT' | 'CHAIN' | 'MANUAL';

export type AutomationRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type AutomationStepRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';

export interface AiAutomationSchedule {
  id: string;
  cronExpression: string;
  timezone: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  isPaused: boolean;
}

export interface AiAutomationListItem {
  id: string;
  name: string;
  description: string | null;
  triggerType: AutomationTriggerType;
  eventType: string | null;
  isActive: boolean;
  maxTokenBudget: number;
  maxDurationMs: number;
  stepCount: number;
  createdAt: string;
  updatedAt: string;
  lastRunId: string | null;
  lastRunStatus: AutomationRunStatus | null;
  lastRunAt: string | null;
  schedule: AiAutomationSchedule | null;
}

export interface AiAutomationStep {
  id: string;
  stepOrder: number;
  agentId: string;
  agentName?: string;
  goal: string;
  inputConfig: unknown;
  outputConfig: unknown;
  maxTurns: number;
}

export interface AiAutomationRunSummary {
  id: string;
  triggeredBy: string;
  status: AutomationRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  totalTokens: number;
  createdAt: string;
}

export interface AiAutomationDetail extends AiAutomationListItem {
  chainFromId: string | null;
  chainNextId: string | null;
  notificationConfig: unknown;
  createdById: string;
  steps: AiAutomationStep[];
  recentRuns: AiAutomationRunSummary[];
}

// ─── Automation list params ────────────────────────────────────────────────

export interface AiAutomationListParams {
  cursor?: string;
  limit?: number;
  triggerType?: AutomationTriggerType;
  status?: 'active' | 'inactive';
  search?: string;
}

// ─── Automation list response ──────────────────────────────────────────────

interface AiAutomationListMeta {
  cursor?: string | null;
  hasMore: boolean;
  total: number;
}

export interface AiAutomationListResponse {
  data: AiAutomationListItem[];
  meta: AiAutomationListMeta;
}

// ─── Automation request types ──────────────────────────────────────────────

export interface CreateAutomationStepInput {
  agentId: string;
  goal: string;
  inputConfig?: Record<string, unknown>;
  outputConfig?: Record<string, unknown>;
  maxTurns?: number;
}

export interface CreateAutomationScheduleInput {
  cronExpression: string;
  timezone?: string;
  isPaused?: boolean;
}

export interface CreateAutomationRequest {
  name: string;
  description?: string;
  triggerType: AutomationTriggerType;
  eventType?: string;
  steps: CreateAutomationStepInput[];
  schedule?: CreateAutomationScheduleInput;
  chainNextId?: string;
  notificationConfig?: Record<string, unknown>;
  maxTokenBudget?: number;
  maxDurationMs?: number;
}

export interface UpdateAutomationRequest {
  name?: string;
  description?: string | null;
  triggerType?: AutomationTriggerType;
  eventType?: string | null;
  steps?: CreateAutomationStepInput[];
  schedule?: CreateAutomationScheduleInput | null;
  chainNextId?: string | null;
  notificationConfig?: Record<string, unknown> | null;
  maxTokenBudget?: number;
  maxDurationMs?: number;
  isActive?: boolean;
}

export interface RunAutomationRequest {
  input?: Record<string, unknown>;
}

export interface RunAutomationResponse {
  message: string;
  automationId: string;
  runId: string;
}

// ─── Automation run types ──────────────────────────────────────────────────

export interface AiAutomationRunListItem {
  id: string;
  automationId: string;
  automationName: string;
  triggerType?: AutomationTriggerType;
  triggeredBy: string;
  status: AutomationRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  totalTokens: number;
  totalCost: string;
  error: string | null;
  createdAt: string;
}

export interface AiAutomationStepRun {
  id: string;
  stepId: string;
  stepOrder: number;
  agentId: string;
  agentName?: string;
  agentDisplayName?: string;
  goal?: string;
  modelId: string | null;
  status: AutomationStepRunStatus;
  input: unknown;
  output: unknown;
  error: string | null;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number | null;
  turns: number;
  startedAt: string | null;
  completedAt: string | null;
}

export interface AiAutomationRunDetail extends AiAutomationRunListItem {
  result: unknown;
  retryOfRunId: string | null;
  stepRuns: AiAutomationStepRun[];
}

// ─── Automation run list params ────────────────────────────────────────────

export interface AiAutomationRunListParams {
  cursor?: string;
  limit?: number;
  status?: AutomationRunStatus;
  dateFrom?: string;
  dateTo?: string;
  automationId?: string;
}

// ─── Automation run list response ──────────────────────────────────────────

interface AiAutomationRunListMeta {
  cursor?: string | null;
  hasMore: boolean;
  total: number;
}

export interface AiAutomationRunListResponse {
  data: AiAutomationRunListItem[];
  meta: AiAutomationRunListMeta;
}

// ─── Automation health stats (dashboard) ───────────────────────────────────

export interface AutomationHealthStats {
  totalAutomations: number;
  activeCount: number;
  pausedCount: number;
  inactiveCount: number;
  failedRunsLast24h: number;
  upcomingRuns: Array<{
    automationId: string;
    automationName: string;
    nextRunAt: string;
  }>;
  dailyTokenSpend: Array<{
    date: string;
    tokens: number;
  }>;
  circuitBreakerAlerts: Array<{
    automationId: string;
    automationName: string;
    consecutiveFailures: number;
    lastFailedAt: string;
  }>;
}

// ─── Prompt variable types (for variable autocomplete) ─────────────────────

export interface AiPromptVariableRegistryItem {
  id: string;
  promptId: string;
  promptName: string | null;
  variableName: string;
  displayName: string;
  description: string | null;
  sourceType: string;
  sourceConfig: unknown;
  defaultValue: string | null;
  isRequired: boolean;
}

export type AiVariablesGroupedResponse = Record<string, AiPromptVariableRegistryItem[]>;

// ─── Retry response ────────────────────────────────────────────────────────

export interface RetryAutomationRunResponse {
  message: string;
  automationId: string;
  originalRunId: string;
  newRunId: string;
}

// ─── Test trigger types ────────────────────────────────────────────────────

export interface TestTriggerResult {
  matchedModule: string | null;
  matchedSkill: {
    id: string;
    name: string;
    displayName: string;
    confidence: number;
  } | null;
  l0Confidence: number;
  l1Confidence: number;
  requiredTools: string[];
  skillContentPreview: string;
  noMatch: boolean;
  suggestions: string[];
}

// ─── Knowledge article types ────────────────────────────────────────────────

export type KnowledgeCategory =
  | 'BUSINESS_PROCESS'
  | 'TERMINOLOGY'
  | 'INDUSTRY_RULES'
  | 'CUSTOM_FIELDS'
  | 'HISTORICAL_PATTERN';

export type KnowledgeSource =
  | 'ADMIN_UPLOADED'
  | 'AI_GENERATED'
  | 'PLATFORM_SUGGESTED'
  | 'CORRECTION_DERIVED';

export interface KnowledgeArticle {
  id: string;
  companyId: string;
  title: string;
  content: string;
  category: KnowledgeCategory;
  source: KnowledgeSource;
  sourceRef: string | null;
  confidenceScore: number;
  isConfirmed: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  isActive: boolean;
  chunkCount: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Knowledge article request types ────────────────────────────────────────

export interface CreateKnowledgeArticleRequest {
  title: string;
  content: string;
  category: KnowledgeCategory;
}

export interface UpdateKnowledgeArticleRequest {
  title?: string;
  content?: string;
  category?: KnowledgeCategory;
  isActive?: boolean;
  confidenceScore?: number;
  isConfirmed?: boolean;
}

// ─── Knowledge article list params ──────────────────────────────────────────

export interface KnowledgeArticleListParams {
  cursor?: string;
  limit?: number;
  category?: KnowledgeCategory | KnowledgeCategory[];
  source?: KnowledgeSource;
  isActive?: boolean;
}

// ─── Knowledge article list response ────────────────────────────────────────

interface KnowledgeArticleListMeta {
  cursor?: string;
  hasMore: boolean;
  total?: number;
}

export interface KnowledgeArticleListResponse {
  data: KnowledgeArticle[];
  meta: KnowledgeArticleListMeta;
}

// ─── Training example types ──────────────────────────────────────────────────

export interface TrainingExample {
  id: string;
  companyId: string;
  skillKey: string | null;
  inputText: string;
  outputText: string;
  category: KnowledgeCategory;
  source: 'ADMIN_CURATED' | 'CORRECTION_DERIVED';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Training example request types ──────────────────────────────────────────

export interface CreateTrainingExampleRequest {
  inputText: string;
  outputText: string;
  category: KnowledgeCategory;
  skillKey?: string;
}

export interface UpdateTrainingExampleRequest {
  inputText?: string;
  outputText?: string;
  category?: KnowledgeCategory;
  skillKey?: string | null;
  isActive?: boolean;
}

// ─── Training example list params ────────────────────────────────────────────

export interface TrainingExampleListParams {
  cursor?: string;
  limit?: number;
  category?: KnowledgeCategory | KnowledgeCategory[];
  skillKey?: string;
  isActive?: boolean;
}

// ─── Training example list response ──────────────────────────────────────────

interface TrainingExampleListMeta {
  cursor?: string;
  hasMore: boolean;
}

export interface TrainingExampleListResponse {
  data: TrainingExample[];
  meta: TrainingExampleListMeta;
}

// ─── Correction types ────────────────────────────────────────────────────────

export type CorrectionType = 'TERMINOLOGY' | 'PROCESS' | 'DATA' | 'PREFERENCE' | 'OTHER';

export interface CorrectionLog {
  id: string;
  userId: string;
  conversationId: string | null;
  skillKey: string | null;
  originalResponse: string;
  correctedResponse: string;
  correctionType: CorrectionType;
  wasAutoResolved: boolean;
  createdAt: string;
}

export interface CorrectionStats {
  total: number;
  last30Days: number;
  byType: Record<CorrectionType, number>;
  bySkill: Record<string, number>;
  autoResolvedCount: number;
  trend: Array<{ date: string; count: number }>;
}

// ─── Correction list params ──────────────────────────────────────────────────

export interface CorrectionListParams {
  cursor?: string;
  limit?: number;
  correctionType?: CorrectionType;
  skillKey?: string;
  wasAutoResolved?: boolean;
  from?: string;
  to?: string;
}

// ─── Correction list response ────────────────────────────────────────────────

interface CorrectionListMeta {
  cursor?: string;
  hasMore: boolean;
}

export interface CorrectionListResponse {
  data: CorrectionLog[];
  meta: CorrectionListMeta;
}

// ─── Suggested knowledge article types ───────────────────────────────────────

export interface SuggestedKnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  version: number;
  publishedAt: string;
  previousResponse: { status: 'ACCEPTED' | 'REJECTED'; articleVersion: number } | null;
}

// ─── Suggested knowledge list params ─────────────────────────────────────────

export interface SuggestedKnowledgeListParams {
  cursor?: string;
  limit?: number;
}

// ─── Suggested knowledge list response ───────────────────────────────────────

interface SuggestedKnowledgeListMeta {
  cursor?: string;
  hasMore: boolean;
}

export interface SuggestedKnowledgeListResponse {
  data: SuggestedKnowledgeArticle[];
  meta: SuggestedKnowledgeListMeta;
}

// ─── Accept edited suggestion request ────────────────────────────────────────

export interface AcceptEditedSuggestionRequest {
  title: string;
  content: string;
  category: KnowledgeCategory;
}
