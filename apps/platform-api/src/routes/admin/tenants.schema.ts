import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums (matching Prisma TenantStatus)
// ---------------------------------------------------------------------------

const tenantStatusEnum = z.enum([
  'PROVISIONING',
  'ACTIVE',
  'SUSPENDED',
  'READ_ONLY',
  'ARCHIVED',
]);

const billingStatusEnum = z.enum(['CURRENT', 'GRACE', 'OVERDUE', 'BLOCKED']);

const enforcementActionEnum = z.enum([
  'NONE',
  'WARNING',
  'READ_ONLY',
  'SUSPENDED',
]);

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

export const tenantIdParamsSchema = z.object({
  id: z.uuid(),
});

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createTenantRequestSchema = z.object({
  code: z
    .string()
    .min(3, 'Tenant code must be at least 3 characters')
    .max(50, 'Tenant code must be at most 50 characters')
    .regex(
      /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9]))*[a-z0-9]$/,
      'Tenant code must be lowercase alphanumeric with single hyphens, cannot start or end with a hyphen',
    ),
  displayName: z.string().min(1).max(255),
  legalName: z.string().min(1).max(255).optional(),
  planId: z.uuid(),
  region: z.string().max(30).default('uk-south'),
  dbHost: z.string().min(1).max(255),
  dbName: z.string().min(1).max(128),
  dbPort: z.coerce.number().int().min(1).max(65535).default(5432),
  sandboxEnabled: z.boolean().default(false),
});

export const updateTenantRequestSchema = z
  .object({
    displayName: z.string().min(1).max(255).optional(),
    legalName: z.string().min(1).max(255).optional(),
    region: z.string().max(30).optional(),
    sandboxEnabled: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.displayName !== undefined ||
      data.legalName !== undefined ||
      data.region !== undefined ||
      data.sandboxEnabled !== undefined,
    { message: 'At least one field must be provided' },
  );

export const listTenantsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  status: tenantStatusEnum.optional(),
  planId: z.uuid().optional(),
  search: z.string().min(1).optional(),
});

export const suspendTenantRequestSchema = z.object({
  reason: z
    .string()
    .min(1, 'Suspension reason is required')
    .max(1000, 'Suspension reason must be at most 1000 characters'),
});

export const modulesRequestSchema = z.object({
  modules: z
    .array(
      z.object({
        moduleKey: z.string().min(1).max(50),
        enabled: z.boolean(),
        reason: z.string().max(500).optional(),
      }),
    )
    .min(1, 'At least one module override is required'),
});

export const featureFlagsRequestSchema = z.object({
  flags: z
    .array(
      z.object({
        featureKey: z.string().min(1).max(100),
        enabled: z.boolean(),
      }),
    )
    .min(1, 'At least one feature flag is required'),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

const planSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  displayName: z.string(),
});

const moduleOverrideSchema = z.object({
  id: z.string(),
  moduleKey: z.string(),
  enabled: z.boolean(),
  reason: z.string().nullable(),
  changedBy: z.string(),
  changedAt: z.string(),
});

const featureFlagSchema = z.object({
  id: z.string(),
  featureKey: z.string(),
  enabled: z.boolean(),
  changedBy: z.string(),
  changedAt: z.string(),
});

const billingSummarySchema = z.object({
  subscriptionStatus: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
  gracePeriodDays: z.number(),
  dunningLevel: z.number(),
  enforcementAction: enforcementActionEnum,
});

const aiQuotaSummarySchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  tokensUsed: z.string(), // BigInt serialised as string
  tokenAllowance: z.string(), // BigInt serialised as string
  softLimitPct: z.number(),
  hardLimitPct: z.number(),
});

export const tenantListItemSchema = z.object({
  id: z.string(),
  code: z.string(),
  displayName: z.string(),
  legalName: z.string().nullable(),
  status: tenantStatusEnum,
  billingStatus: billingStatusEnum,
  region: z.string(),
  sandboxEnabled: z.boolean(),
  lastActivityAt: z.string().nullable(),
  createdAt: z.string(),
  plan: planSummarySchema,
  moduleOverrideCount: z.number(),
});

export const tenantDetailSchema = z.object({
  id: z.string(),
  code: z.string(),
  displayName: z.string(),
  legalName: z.string().nullable(),
  status: tenantStatusEnum,
  billingStatus: billingStatusEnum,
  region: z.string(),
  sandboxEnabled: z.boolean(),
  lastActivityAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  plan: planSummarySchema,
  moduleOverrides: z.array(moduleOverrideSchema),
  featureFlags: z.array(featureFlagSchema),
  billing: billingSummarySchema.nullable(),
  aiQuota: aiQuotaSummarySchema.nullable(),
});

export const tenantSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  displayName: z.string(),
  status: tenantStatusEnum,
  region: z.string(),
  createdAt: z.string(),
  plan: planSummarySchema,
});

export const moduleOverrideListSchema = z.array(moduleOverrideSchema);

export const featureFlagListSchema = z.array(featureFlagSchema);

// ---------------------------------------------------------------------------
// Plan Assignment Schemas (E3b.5 Task 2)
// ---------------------------------------------------------------------------

export const assignPlanRequestSchema = z.object({
  planId: z.uuid(),
  reason: z.string().min(1).max(500).optional(),
});

export const assignPlanResponseSchema = z.object({
  tenantId: z.string(),
  oldPlanCode: z.string(),
  newPlanCode: z.string(),
  oldPlanLimits: z.object({
    maxUsers: z.number(),
    maxCompanies: z.number(),
    monthlyAiTokenAllowance: z.string(),
    apiRateLimit: z.number(),
  }),
  newPlanLimits: z.object({
    maxUsers: z.number(),
    maxCompanies: z.number(),
    monthlyAiTokenAllowance: z.string(),
    apiRateLimit: z.number(),
  }),
  changedAt: z.string(),
});

// ---------------------------------------------------------------------------
// Billing Status Response Schema (E3b.5 Task 3)
// ---------------------------------------------------------------------------

export const billingResponseSchema = z.object({
  tenantId: z.string(),
  billingStatus: billingStatusEnum,
  stripeCustomerId: z.string().nullable(),
  subscriptionStatus: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
  gracePeriodDays: z.number().int(),
  lastPaymentAt: z.string().nullable(),
  dunningLevel: z.number().int(),
  enforcementAction: enforcementActionEnum,
});

// ---------------------------------------------------------------------------
// Enforcement Update Schema (E3b.5 Task 4)
// ---------------------------------------------------------------------------

export const enforcementUpdateSchema = z.object({
  enforcementAction: enforcementActionEnum,
  gracePeriodDays: z.number().int().positive().optional(),
  reason: z.string().min(1).max(500),
});

export const enforcementResponseSchema = z.object({
  tenantId: z.string(),
  previousAction: enforcementActionEnum,
  newAction: enforcementActionEnum,
  effectiveAt: z.string(),
  reason: z.string(),
});

// ---------------------------------------------------------------------------
// AI Quota Schemas (E3b.5 Task 5)
// ---------------------------------------------------------------------------

export const aiQuotaResponseSchema = z.object({
  tenantId: z.string(),
  planCode: z.string(),
  tokenAllowance: z.string(), // BigInt serialised as string to avoid precision loss
  tokensUsed: z.string(), // BigInt serialised as string to avoid precision loss
  quotaPct: z.number(),
  softLimitPct: z.number().int(),
  hardLimitPct: z.number().int(),
  burstAllowance: z.string().nullable(), // BigInt serialised as string
  periodStart: z.string(),
  periodEnd: z.string(),
});

export const updateAiQuotaSchema = z
  .object({
    tokenAllowance: z.number().int().nonnegative().optional(),
    softLimitPct: z.number().int().min(1).max(100).optional(),
    hardLimitPct: z.number().int().min(1).max(200).optional(),
    burstAllowance: z.number().int().nonnegative().nullable().optional(),
    reason: z.string().min(1).max(500),
  })
  .refine(
    (obj) => {
      const { reason: _reason, ...rest } = obj;
      return Object.keys(rest).some((k) => rest[k as keyof typeof rest] !== undefined);
    },
    { message: 'At least one quota field must be provided besides reason' },
  );

// ---------------------------------------------------------------------------
// Inferred Types
// ---------------------------------------------------------------------------

export type CreateTenantRequest = z.infer<typeof createTenantRequestSchema>;
export type UpdateTenantRequest = z.infer<typeof updateTenantRequestSchema>;
export type TenantIdParams = z.infer<typeof tenantIdParamsSchema>;
export type ListTenantsQuery = z.infer<typeof listTenantsQuerySchema>;
export type SuspendTenantRequest = z.infer<typeof suspendTenantRequestSchema>;
export type ModulesRequest = z.infer<typeof modulesRequestSchema>;
export type FeatureFlagsRequest = z.infer<typeof featureFlagsRequestSchema>;
export type TenantListItem = z.infer<typeof tenantListItemSchema>;
export type TenantDetail = z.infer<typeof tenantDetailSchema>;
export type TenantSummary = z.infer<typeof tenantSummarySchema>;
export type AssignPlanRequest = z.infer<typeof assignPlanRequestSchema>;
export type BillingResponse = z.infer<typeof billingResponseSchema>;
export type EnforcementUpdateRequest = z.infer<typeof enforcementUpdateSchema>;
export type UpdateAiQuotaRequest = z.infer<typeof updateAiQuotaSchema>;
