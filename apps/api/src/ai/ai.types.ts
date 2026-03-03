// ─── AI Request Types ────────────────────────────────────────────────────────

/** What modules send to the orchestrator */
export interface AiRequest {
  intent: string; // 'create_invoice', 'query', 'chat', 'briefing'
  agentName?: string; // explicit agent, or resolved from intent
  routingTags?: string[]; // ['reasoning', 'standard', 'cheap']
  userMessage: string; // the user's natural language input
  context: AiRequestContext; // page context, entity context
  conversationId?: string; // for multi-turn
  stream?: boolean; // enable streaming
  entityMentions?: EntityMentionRef[]; // structured entity references from chat autocomplete (E5b-7)
}

/** Structured entity reference from inline entity mentions (E5b-7) */
export interface EntityMentionRef {
  type: string; // entity type, e.g. "Contact", "Customer", "DataView"
  id: string; // entity UUID
  name: string; // display name, e.g. "John Smith"
}

export interface AiRequestContext {
  userId: string;
  companyId: string;
  tenantId: string;
  currentPage?: string; // e.g., '/ar/invoices/123'
  currentEntityType?: string; // e.g., 'CustomerInvoice'
  currentEntityId?: string; // e.g., 'inv-uuid'
  locale: string; // e.g., 'en-GB'
}

// ─── AI Response Types ───────────────────────────────────────────────────────

/** What the orchestrator returns */
export interface AiResponse {
  type: 'text' | 'action_proposal' | 'record_created' | 'error';
  messageId: string;
  content?: string;
  action?: ActionProposal;
  record?: CreatedRecord;
  confidence?: number; // 0.0-1.0
  usage?: { inputTokens: number; outputTokens: number; latencyMs: number };
  errorCode?: string; // structured error code for route-level status mapping
  guardrailDecision?: GuardrailDecision; // present when type === 'action_proposal'
  requiresApproval?: boolean; // from guardrail evaluation
  fieldConfidences?: Record<string, number>; // per-field confidence from structured output
}

export interface ActionProposal {
  id: string;
  type: string; // 'CREATE_INVOICE', 'SEND_EMAIL', etc.
  description: string;
  entityType: string;
  previewData: Record<string, unknown>;
  confidence: number;
}

export interface CreatedRecord {
  entityType: string;
  entityId: string;
  displayRef: string;
}

// ─── Guardrail Types ────────────────────────────────────────────────────────

export interface GuardrailDecision {
  allowed: boolean;
  requiresApproval: boolean;
  reason: string; // human-readable explanation
  rulesTriggered: string[]; // e.g., ['FINANCIAL_SAFETY', 'AMOUNT_THRESHOLD']
}

export interface AgentGuardrails {
  canRead: string[];
  canWrite: string[];
  requiresApproval: boolean;
  maxAmountWithoutApproval?: string;
  blockedOperations: string[];
  dataScope: 'own' | 'module' | 'all';
}

// ─── Action Proposal Result ─────────────────────────────────────────────────

/** Enriched action proposal with guardrail evaluation result */
export interface ActionProposalResult {
  proposal: ActionProposal;
  requiresApproval: boolean; // from guardrails — always true for financial actions
  guardrailDecision: GuardrailDecision;
  conversationId: string;
  agentId: string;
  userId: string; // for independent ownership verification (E5.2 Issue #8)
}

// ─── Action Execution Types ─────────────────────────────────────────────────

/** Result from executing a confirmed action */
export interface ActionExecutionResult {
  success: boolean;
  entityType?: string;
  entityId?: string;
  displayRef?: string;
  error?: { code: string; message: string };
}

/** Interface for action execution — implemented by ActionExecutor (E5-3 Task 4) */
export interface IActionExecutor {
  execute(params: {
    proposal: ActionProposal;
    conversationId: string;
    agentId: string;
    userId: string;
    companyId: string;
  }): Promise<ActionExecutionResult>;
}

/** Interface for guardrail evaluation — implemented by GuardrailsService (E5-3 Task 2) */
export interface IGuardrailsService {
  evaluate(params: {
    actionType: string;
    entityType: string;
    agentGuardrails: AgentGuardrails;
    amount?: number;
  }): GuardrailDecision;
}

// ─── Structured Output Types ─────────────────────────────────────────────────

/** What the LLM returns in JSON mode */
export interface AiStructuredOutput {
  intent: string;
  action?: {
    type: string;
    entityType: string;
    fields: Record<string, unknown>;
    confidence: Record<string, number>; // per-field confidence
  };
  answer?: string;
  followUp?: string;
}

// ─── Streaming Types ─────────────────────────────────────────────────────────

export interface AiStreamChunk {
  type: 'content_delta' | 'tool_use_delta' | 'done' | 'error' | 'action_proposal';
  content?: string;
  toolCall?: { id: string; name: string; input: Record<string, unknown> };
  usage?: { inputTokens: number; outputTokens: number; latencyMs: number };
  finishReason?: string;
  error?: string;
  action?: ActionProposal; // present when type === 'action_proposal'
  guardrailDecision?: GuardrailDecision; // present when type === 'action_proposal'
  requiresApproval?: boolean; // present when type === 'action_proposal'
}

// ─── Prompt Parameter Types ──────────────────────────────────────────────────

export interface EntityParamSource {
  type: 'entity';
  entityType: string;
  idFrom: string; // key in context to read the entity ID from
  fields?: string[]; // optional field selection
}

export interface QueryParamSource {
  type: 'query';
  entityType: string;
  where: Record<string, unknown>;
  select?: Record<string, boolean>;
  limit?: number;
}

export interface ContextParamSource {
  type: 'context';
  path: string; // dot-path into UserContext, e.g., 'tenant.companyName'
}

export interface ComputedParamSource {
  type: 'computed';
  fn: 'currentDate' | 'currentPeriod' | 'currentTime' | 'currentUser';
}

export interface UserInputParamSource {
  type: 'userInput';
}

export type PromptParamSource =
  | EntityParamSource
  | QueryParamSource
  | ContextParamSource
  | ComputedParamSource
  | UserInputParamSource;

/** Resolved prompt ready for LLM */
export interface ResolvedPrompt {
  systemPrompt: string;
  userPrompt: string;
  promptId: string;
  promptVersion: number;
}

// ─── Briefing Types ────────────────────────────────────────────────────────

/** Role template identifiers for briefing generation */
export type BriefingRole =
  | 'OWNER' // Business Owner / SUPER_ADMIN
  | 'FINANCE' // Finance Manager / Finance Clerk
  | 'SALES' // Sales Manager / Sales Staff
  | 'HR' // HR Manager / HR Viewer
  | 'WAREHOUSE' // Warehouse Staff
  | 'ADMIN'; // System Administrator

/** A single briefing item with actionable content */
export interface BriefingItem {
  id: string; // unique item ID
  title: string; // e.g., "3 Overdue Invoices"
  description: string; // e.g., "Total outstanding: £12,400"
  category: string; // e.g., "approvals", "overdue", "cash", "alerts"
  priority: 'high' | 'medium' | 'low';
  metric?: {
    value: string; // e.g., "£12,400" or "12%"
    delta?: string; // e.g., "+12%" or "-£3,200"
    trend?: 'up' | 'down' | 'flat';
    comparisonPeriod?: string; // e.g., "vs last month"
  };
  actions: BriefingAction[];
  entityLink?: {
    entityType: string;
    entityId?: string;
    route: string; // e.g., "/ar/invoices?status=overdue"
  };
}

/** An actionable button within a briefing item */
export interface BriefingAction {
  label: string; // e.g., "Approve All", "Chase", "Review"
  actionType: 'navigate' | 'approve' | 'chase' | 'dismiss';
  route?: string; // for navigate actions
  entityType?: string; // for approve/chase actions
  entityIds?: string[]; // for batch actions
}

/** Full daily briefing response */
export interface DailyBriefing {
  generatedAt: string; // ISO datetime
  userId: string;
  role: BriefingRole;
  greeting: string; // e.g., "Good morning, Mohammed."
  summary: string; // 1-2 sentence overview
  items: BriefingItem[];
  cachedAt?: string; // when the cache was last refreshed
  isStale?: boolean; // true if cache is older than 24h
}

// ─── Smart Suggestion Types ────────────────────────────────────────────────

/** A contextual suggestion chip */
export interface SuggestionChip {
  id: string;
  label: string; // e.g., "Invoice this customer"
  prompt: string; // full prompt to submit to AI
  category: 'action' | 'query' | 'navigation';
  icon?: string; // icon name for UI rendering
  priority: number; // sort order (lower = higher priority)
}

/** Smart suggestions response */
export interface SmartSuggestions {
  entityType?: string;
  entityId?: string;
  pageRoute?: string;
  suggestions: SuggestionChip[];
}

// ─── Prediction Types ───────────────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'review' | 'low';

export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.9) return 'high'; // green — auto-suggest
  if (score >= 0.7) return 'review'; // amber — review recommended
  return 'low'; // red — manual review required
}

/** Cash flow forecast — period breakdown */
export interface CashFlowPeriod {
  periodStart: string; // ISO date
  periodEnd: string;
  openingBalance: string; // Decimal(19,4) as string
  inflows: string;
  outflows: string;
  netFlow: string; // inflows - outflows
  closingBalance: string; // openingBalance + netFlow
  inflowDetails: Array<{
    source: string; // "AR outstanding", "Recurring", etc.
    amount: string;
    description: string;
  }>;
  outflowDetails: Array<{
    source: string; // "AP outstanding", "Committed PO", etc.
    amount: string;
    description: string;
  }>;
}

/** Cash flow forecast alert */
export interface CashFlowAlert {
  type: 'LOW_BALANCE' | 'NEGATIVE_BALANCE' | 'COLLECTION_OPPORTUNITY';
  message: string;
  period: string; // affected period date range
  amount: string; // projected shortfall/surplus as Decimal(19,4)
  suggestedAction?: string; // "Accelerate collections", "Defer payments", etc.
}

/** Full cash flow forecast response */
export interface CashFlowForecast {
  generatedAt: string; // ISO datetime
  currency: string; // e.g., "GBP"
  currentBalance: string; // Decimal(19,4)
  periods: CashFlowPeriod[];
  alerts: CashFlowAlert[];
}

/** Anomaly detection result */
export interface AnomalyResult {
  id: string;
  entityType: string; // "SupplierInvoice", "Payment", etc.
  entityId: string;
  displayRef: string;
  anomalyType:
    | 'DUPLICATE_AMOUNT'
    | 'UNUSUAL_AMOUNT'
    | 'TIMING_ANOMALY'
    | 'NEW_SUPPLIER_LARGE_AMOUNT'
    | 'SEQUENTIAL_INVOICES'
    | 'ROUND_NUMBER_BIAS';
  description: string;
  confidence: number; // 0.0-1.0
  confidenceLevel: ConfidenceLevel;
  relatedEntities?: Array<{
    entityType: string;
    entityId: string;
    displayRef: string;
    relationship: string; // "original_payment", "same_supplier", etc.
  }>;
  metadata: Record<string, unknown>; // anomaly-specific data
}

/** Duplicate detection pair */
export interface DuplicatePair {
  entityA: {
    entityType: string;
    entityId: string;
    displayRef: string;
    data: Record<string, unknown>;
  };
  entityB: {
    entityType: string;
    entityId: string;
    displayRef: string;
    data: Record<string, unknown>;
  };
  overallSimilarity: number; // 0.0-1.0
  confidenceLevel: ConfidenceLevel;
  fieldComparisons: Array<{
    field: string;
    valueA: string;
    valueB: string;
    similarity: number; // 0.0-1.0
  }>;
}

/** Confidence score response */
export interface ConfidenceScoreResponse {
  entityType: string;
  entityId: string;
  overallConfidence: number; // 0.0-1.0
  confidenceLevel: ConfidenceLevel;
  fieldConfidence: Record<string, number>; // per-field breakdown
  lastUpdated: string;
}

/** Explainability response */
export interface ExplainResponse {
  summary: string; // plain English explanation
  reasoning: string[]; // bulleted reasoning steps
  dataPoints: Array<{
    field: string;
    value: string;
    confidence: number;
    source: string; // "extracted", "inferred", "default", "historical"
  }>;
}

// ─── Shared Utilities ──────────────────────────────────────────────────────

/**
 * Map a user's system role to a BriefingRole.
 * Uses the role string as primary signal with pattern matching.
 * Shared between BriefingEngine and SuggestionsService.
 */
export function resolveRole(userRole: string): BriefingRole {
  const roleUpper = userRole.toUpperCase();

  if (roleUpper === 'SUPER_ADMIN' || roleUpper === 'OWNER') return 'OWNER';
  if (roleUpper === 'ADMIN') return 'ADMIN';
  if (
    roleUpper.includes('FINANCE') ||
    roleUpper.includes('ACCOUNTANT') ||
    roleUpper.includes('BOOKKEEPER')
  )
    return 'FINANCE';
  if (roleUpper.includes('SALES') || roleUpper.includes('COMMERCIAL')) return 'SALES';
  if (roleUpper.includes('HR') || roleUpper.includes('HUMAN') || roleUpper.includes('PAYROLL'))
    return 'HR';
  if (
    roleUpper.includes('WAREHOUSE') ||
    roleUpper.includes('INVENTORY') ||
    roleUpper.includes('STOCK')
  )
    return 'WAREHOUSE';

  return 'ADMIN';
}
