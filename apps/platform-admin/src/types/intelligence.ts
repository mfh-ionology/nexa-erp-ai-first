// ---------------------------------------------------------------------------
// Platform Intelligence Types — Frontend types matching Platform API responses
// Source: intelligence.schema.ts, knowledge.schema.ts (E5d-3, E5d-4)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type InsightType =
  | 'FEATURE_GAP'
  | 'WORKFLOW_OPPORTUNITY'
  | 'DEFAULT_CANDIDATE'
  | 'SKILL_IMPROVEMENT';

export type InsightSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export type InsightStatus = 'NEW' | 'REVIEWED' | 'ACTIONED' | 'DISMISSED';

export type SkillTrend = 'IMPROVING' | 'STABLE' | 'DECLINING';

export type KnowledgeCategory = 'BEST_PRACTICE' | 'HELP' | 'DEFAULT_CONFIG' | 'SKILL_UPDATE';

export type KnowledgeStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

// ---------------------------------------------------------------------------
// Response types — match the Platform API Zod response schemas
// ---------------------------------------------------------------------------

export interface IntelligenceSummary {
  totalContributingTenants: number;
  totalPatterns: number;
  totalCorrections: number;
  totalKnowledgeArticles: number;
  overallAiSuccessRate: number | null;
  lastAggregatedAt: string | null;
  topSkillsByUsage: Array<{
    skillKey: string;
    totalQueries: number;
    avgSuccessRate: string;
    trend: string | null;
  }>;
  topInsightsBySeverity: PlatformInsight[];
}

export interface TenantPattern {
  id: string;
  tenantId: string;
  patternDate: string;
  industry: string | null;
  planTier: string | null;
  queryCategories: unknown;
  skillUsage: unknown;
  viewPatterns: unknown;
  automationUsage: unknown;
  createdAt: string;
}

export interface TenantCorrection {
  id: string;
  patternDate: string;
  industry: string | null;
  correctionType: string;
  skillKey: string | null;
  occurrenceCount: number;
  tenantCount: number;
  commonCorrection: string | null;
  createdAt: string;
}

export interface SkillEffectiveness {
  id: string;
  skillKey: string;
  measureDate: string;
  tenantCount: number;
  totalQueries: number;
  avgSuccessRate: string;
  avgCorrectionRate: string;
  avgConfidence: string;
  trend: string | null;
  createdAt: string;
}

export interface PlatformInsight {
  id: string;
  insightType: string;
  title: string;
  description: string;
  evidence: unknown;
  severity: string;
  status: string;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DistributionSummary {
  accepted: number;
  rejected: number;
  pending: number;
}

export interface DistributionStats extends DistributionSummary {
  totalEligibleTenants: number;
}

export interface PlatformKnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  targetIndustries: string[];
  targetPlanTiers: string[];
  version: number;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  distributionStats?: DistributionStats;
  distributionSummary?: DistributionSummary;
}

// ---------------------------------------------------------------------------
// Mutation payloads
// ---------------------------------------------------------------------------

export interface AggregationResult {
  processedTenants: number;
  skippedTenants: number;
  patternsCreated: number;
  correctionsCreated: number;
}

export interface InsightsGenerationResult {
  insightsGenerated: number;
  byType: {
    featureGap: number;
    workflowOpportunity: number;
    defaultCandidate: number;
    skillImprovement: number;
  };
}

export interface UpdateInsightBody {
  status: InsightStatus;
  reviewedById?: string;
}

export interface CreateKnowledgeBody {
  title: string;
  content: string;
  category: KnowledgeCategory;
  targetIndustries?: string[];
  targetPlanTiers?: string[];
}

export interface UpdateKnowledgeBody {
  title?: string;
  content?: string;
  category?: KnowledgeCategory;
  targetIndustries?: string[];
  targetPlanTiers?: string[];
}

// ---------------------------------------------------------------------------
// Filter / query params
// ---------------------------------------------------------------------------

export interface PatternsFilters {
  industry?: string;
  planTier?: string;
  dateFrom?: string;
  dateTo?: string;
  tenantId?: string;
  cursor?: string;
  limit?: number;
}

export interface CorrectionsFilters {
  correctionType?: string;
  skillKey?: string;
  dateFrom?: string;
  dateTo?: string;
  cursor?: string;
  limit?: number;
}

export interface SkillEffectivenessFilters {
  skillKey?: string;
  dateFrom?: string;
  dateTo?: string;
  trend?: SkillTrend;
  cursor?: string;
  limit?: number;
}

export interface InsightsFilters {
  insightType?: InsightType;
  severity?: InsightSeverity;
  status?: InsightStatus;
  cursor?: string;
  limit?: number;
}

export interface KnowledgeFilters {
  status?: KnowledgeStatus;
  category?: KnowledgeCategory;
  cursor?: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Cursor pagination generic
// ---------------------------------------------------------------------------

export interface CursorPaginatedResponse<T> {
  data: T[];
  meta: {
    hasMore: boolean;
    cursor?: string | null;
  };
}
