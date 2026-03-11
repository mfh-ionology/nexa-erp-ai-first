// ---------------------------------------------------------------------------
// Tenant Domain Types — Frontend types matching Platform API response schemas
// Source: tenants.schema.ts (E3b), Data Models §5
// Story: E13b.2 Task 1.1
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type TenantStatus = 'PROVISIONING' | 'ACTIVE' | 'SUSPENDED' | 'READ_ONLY' | 'ARCHIVED';

export type BillingStatus = 'CURRENT' | 'GRACE' | 'OVERDUE' | 'BLOCKED';

export type EnforcementAction = 'NONE' | 'WARNING' | 'READ_ONLY' | 'SUSPENDED';

// ---------------------------------------------------------------------------
// Nested relation types (matching backend response schemas)
// ---------------------------------------------------------------------------

export interface PlanSummary {
  id: string;
  code: string;
  displayName: string;
  /** Extended fields — available when backend includes full plan data */
  maxUsers?: number;
  maxCompanies?: number;
  monthlyAiTokenAllowance?: number;
  aiHardLimit?: boolean;
  enabledModules?: string[];
  apiRateLimit?: number;
}

export interface TenantModuleOverride {
  id: string;
  moduleKey: string;
  enabled: boolean;
  reason: string | null;
  changedBy: string;
  changedAt: string;
}

export interface TenantFeatureFlag {
  id: string;
  featureKey: string;
  enabled: boolean;
  changedBy: string;
  changedAt: string;
}

export interface TenantBilling {
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  gracePeriodDays: number;
  dunningLevel: number;
  enforcementAction: EnforcementAction;
}

export interface TenantAiQuota {
  periodStart: string;
  periodEnd: string;
  tokensUsed: string;
  tokenAllowance: string;
  softLimitPct: number;
  hardLimitPct: number;
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

/** List endpoint item — GET /admin/tenants */
export interface TenantListItem {
  id: string;
  code: string;
  displayName: string;
  legalName: string | null;
  status: TenantStatus;
  billingStatus: BillingStatus;
  region: string;
  sandboxEnabled: boolean;
  lastActivityAt: string | null;
  createdAt: string;
  plan: PlanSummary;
  moduleOverrideCount: number;
  /** userCount may not be returned by all backend versions */
  userCount?: number;
}

/** Detail endpoint — GET /admin/tenants/:id */
export interface TenantDetail {
  id: string;
  code: string;
  displayName: string;
  legalName: string | null;
  status: TenantStatus;
  billingStatus: BillingStatus;
  region: string;
  sandboxEnabled: boolean;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
  plan: PlanSummary;
  moduleOverrides: TenantModuleOverride[];
  featureFlags: TenantFeatureFlag[];
  billing: TenantBilling | null;
  aiQuota: TenantAiQuota | null;
}

// ---------------------------------------------------------------------------
// Query / mutation parameter types
// ---------------------------------------------------------------------------

export interface TenantListParams {
  limit?: number;
  offset?: number;
  status?: TenantStatus;
  planId?: string;
  search?: string;
}

export interface SuspendTenantBody {
  reason: string;
}

export interface ModulesUpdateBody {
  modules: Array<{
    moduleKey: string;
    enabled: boolean;
    reason?: string;
  }>;
}

export interface FeatureFlagsUpdateBody {
  flags: Array<{
    featureKey: string;
    enabled: boolean;
  }>;
}

// ---------------------------------------------------------------------------
// Billing Dashboard Types (E13b.3 Task 1.1)
// ---------------------------------------------------------------------------

export interface BillingOverview {
  totalActive: number;
  statusBreakdown: {
    current: number;
    grace: number;
    overdue: number;
    blocked: number;
  };
  enforcementBreakdown: {
    none: number;
    warning: number;
    readOnly: number;
    suspended: number;
  };
}

/** Full billing detail — extends TenantBilling with fields from billingResponseSchema */
export interface BillingDetail extends TenantBilling {
  tenantId: string;
  billingStatus: BillingStatus;
  stripeCustomerId: string | null;
  lastPaymentAt: string | null;
}

export interface EnforcementTransitionResult {
  tenantId: string;
  previousAction: EnforcementAction;
  newAction: EnforcementAction;
  effectiveAt: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Plan Management Types (E13b.3 Task 1.1)
// ---------------------------------------------------------------------------

/** Full plan — extends PlanSummary with additional metadata.
 *  Makes optional PlanSummary fields required (full plan response always includes them).
 *  Overrides monthlyAiTokenAllowance to string (BigInt serialised from backend). */
export interface Plan extends Required<Omit<PlanSummary, 'monthlyAiTokenAllowance'>> {
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** BigInt serialised as string from backend */
  monthlyAiTokenAllowance: string;
}

export interface PlanLimits {
  maxUsers: number;
  maxCompanies: number;
  monthlyAiTokenAllowance: string;
  apiRateLimit: number;
}

export interface AssignPlanResult {
  tenantId: string;
  oldPlanCode: string;
  newPlanCode: string;
  oldPlanLimits: PlanLimits;
  newPlanLimits: PlanLimits;
  changedAt: string;
}

export interface CreatePlanInput {
  code: string;
  displayName: string;
  maxUsers: number;
  maxCompanies: number;
  monthlyAiTokenAllowance: number;
  aiHardLimit?: boolean;
  enabledModules: string[];
  apiRateLimit?: number;
}

export type UpdatePlanInput = Partial<CreatePlanInput> & {
  isActive?: boolean;
};
