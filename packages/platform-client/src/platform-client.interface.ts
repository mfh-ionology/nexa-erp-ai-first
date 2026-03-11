import type {
  AiQuotaCheck,
  AiUsageRecord,
  EntitlementResult,
  KnowledgeResponseInput,
  ModuleAccess,
  SuggestedKnowledgeArticle,
  SuggestedKnowledgeResult,
  TenantStatusResponse,
  UserQuota,
} from './types/index.js';

export interface PlatformClient {
  // Entitlements (cached, 5-min TTL, webhook-invalidated)
  getEntitlements(tenantId: string): Promise<EntitlementResult>;
  checkModuleAccess(tenantId: string, moduleKey: string): Promise<ModuleAccess>;
  checkUserQuota(tenantId: string): Promise<UserQuota>;
  getTenantStatus(tenantId: string): Promise<TenantStatusResponse>;

  // AI Gateway (always live, no cache)
  checkAiQuota(
    tenantId: string,
    estimatedTokens: number,
    featureKey: string,
  ): Promise<AiQuotaCheck>;
  recordAiUsage(record: AiUsageRecord): Promise<void>;

  // Knowledge Distribution (always live, no cache)
  getSuggestedKnowledge(
    tenantId: string,
    opts?: { cursor?: string; limit?: number },
  ): Promise<SuggestedKnowledgeResult>;
  getPlatformArticle(
    tenantId: string,
    articleId: string,
  ): Promise<SuggestedKnowledgeArticle | null>;
  respondToKnowledge(
    tenantId: string,
    articleId: string,
    response: KnowledgeResponseInput,
  ): Promise<void>;

  // Cache management
  invalidateCache(tenantId: string): void;

  // Lifecycle
  destroy(): Promise<void>;
}
