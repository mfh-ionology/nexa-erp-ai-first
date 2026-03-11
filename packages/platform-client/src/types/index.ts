export type TenantStatus = 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED' | 'READ_ONLY' | 'ARCHIVED';
export type BillingStatus = 'CURRENT' | 'GRACE' | 'OVERDUE' | 'BLOCKED';
export type EnforcementAction = 'NONE' | 'WARNING' | 'READ_ONLY' | 'SUSPENDED';

export interface TenantEntitlements {
  status: TenantStatus;
  planCode: string;
  billingStatus: BillingStatus;
  enforcementAction: EnforcementAction;
  maxUsers: number;
  maxCompanies: number;
  enabledModules: string[];
  featureFlags: Record<string, boolean>;
}

export interface ModuleAccess {
  allowed: boolean;
  reason?: string;
}

export interface UserQuota {
  currentCount: number;
  maxUsers: number;
  canAddUser: boolean;
}

export interface TenantStatusResponse {
  status: TenantStatus;
  billingStatus: BillingStatus;
  enforcementAction: EnforcementAction;
  maintenanceMode: boolean;
}

export interface AiQuotaCheck {
  allowed: boolean;
  remainingTokens: number;
  quotaPct: number;
  warning?: string;
  degraded?: boolean;
}

export interface AiUsageRecord {
  tenantId: string;
  userId: string;
  featureKey: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEstimate: number;
  requestId: string;
  isByok: boolean;
  latencyMs?: number;
  fallbackUsed: boolean;
  fallbackFrom?: string;
}

export interface EntitlementResult {
  entitlements: TenantEntitlements;
  degraded: boolean;
}

export interface PlatformWebhookEvent {
  event: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

// ─── Knowledge Distribution ──────────────────────────────────────────

export interface SuggestedKnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  version: number;
  publishedAt: string;
  previousResponse: { status: string; articleVersion: number } | null;
}

export interface SuggestedKnowledgeResult {
  data: SuggestedKnowledgeArticle[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface KnowledgeResponseInput {
  status: 'ACCEPTED' | 'REJECTED';
  tenantArticleId?: string;
}

// ─── Client Config ───────────────────────────────────────────────────

export interface PlatformClientConfig {
  platformApiUrl: string;
  serviceToken: string;
  cacheTtlMs?: number;
  redisUrl?: string;
  circuitBreaker?: {
    failureThreshold?: number;
    recoveryWindowMs?: number;
  };
  logger?: import('pino').Logger;
}
