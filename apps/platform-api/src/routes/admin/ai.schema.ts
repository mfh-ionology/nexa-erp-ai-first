import { z } from 'zod';

// ---------------------------------------------------------------------------
// Param schemas
// ---------------------------------------------------------------------------

export const tenantIdParamsSchema = z.object({
  id: z.uuid(),
});

// ---------------------------------------------------------------------------
// Query schemas
// ---------------------------------------------------------------------------

export const aiExportQuerySchema = z.object({
  startDate: z.string().date(),
  endDate: z.string().date(),
});

// ---------------------------------------------------------------------------
// Response schemas — GET /admin/ai/usage/summary
// ---------------------------------------------------------------------------

const dailyTrendItemSchema = z.object({
  date: z.string(),
  tokens: z.number(),
  cost: z.string(),
});

const topConsumerSchema = z.object({
  tenantId: z.string(),
  tenantCode: z.string(),
  tenantName: z.string(),
  tokens: z.number(),
});

export const aiUsageSummaryResponseSchema = z.object({
  tokensToday: z.number(),
  tokensThisMonth: z.number(),
  costEstimateToday: z.string(),
  costEstimateThisMonth: z.string(),
  dailyTrend: z.array(dailyTrendItemSchema),
  topConsumers: z.array(topConsumerSchema),
});

// ---------------------------------------------------------------------------
// Response schemas — GET /admin/tenants/:id/ai/usage
// ---------------------------------------------------------------------------

const providerBreakdownSchema = z.object({
  provider: z.string(),
  tokens: z.number(),
  pct: z.number(),
});

const byokSplitSchema = z.object({
  byokTokens: z.number(),
  vendorTokens: z.number(),
  byokPct: z.number(),
});

export const aiTenantUsageResponseSchema = z.object({
  tokensToday: z.number(),
  tokensThisMonth: z.number(),
  costEstimate: z.string(),
  dailyTrend: z.array(dailyTrendItemSchema),
  byProvider: z.array(providerBreakdownSchema),
  byokSplit: byokSplitSchema,
});

// ---------------------------------------------------------------------------
// Response schemas — GET /admin/tenants/:id/ai/usage/by-feature
// ---------------------------------------------------------------------------

const featureUsageSchema = z.object({
  featureKey: z.string(),
  tokens: z.number(),
  pct: z.number(),
  calls: z.number(),
});

export const aiUsageByFeatureResponseSchema = z.object({
  features: z.array(featureUsageSchema),
});

// ---------------------------------------------------------------------------
// Param schemas — Alerts
// ---------------------------------------------------------------------------

export const alertIdParamsSchema = z.object({
  id: z.uuid(),
});

// ---------------------------------------------------------------------------
// Query schemas — GET /admin/ai/alerts
// ---------------------------------------------------------------------------

export const aiAlertsQuerySchema = z.object({
  type: z.enum(['QUOTA_WARNING', 'QUOTA_EXCEEDED', 'USAGE_SPIKE']).optional(),
  acknowledged: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

// ---------------------------------------------------------------------------
// Response schemas — GET /admin/ai/alerts
// ---------------------------------------------------------------------------

const aiAlertItemSchema = z.object({
  id: z.string(),
  type: z.enum(['QUOTA_WARNING', 'QUOTA_EXCEEDED', 'USAGE_SPIKE']),
  tenantId: z.string(),
  tenantCode: z.string(),
  tenantName: z.string(),
  message: z.string(),
  usagePct: z.number(),
  threshold: z.number().nullable(),
  dailyTokens: z.number().nullable(),
  rollingAvgTokens: z.number().nullable(),
  acknowledged: z.boolean(),
  acknowledgedBy: z.string().nullable(),
  acknowledgedAt: z.string().nullable(),
  createdAt: z.string(),
});

export const aiAlertsResponseSchema = z.array(aiAlertItemSchema);

// ---------------------------------------------------------------------------
// Response schemas — POST /admin/ai/alerts/:id/acknowledge
// ---------------------------------------------------------------------------

export const aiAlertAcknowledgeResponseSchema = z.object({
  id: z.string(),
  acknowledged: z.boolean(),
  acknowledgedBy: z.string(),
  acknowledgedAt: z.string(),
});

// ---------------------------------------------------------------------------
// Request/Response schemas — POST /admin/ai/spike-detection
// ---------------------------------------------------------------------------

export const spikeDetectionBodySchema = z.object({
  date: z.string().date().optional(),
});

export const spikeDetectionResponseSchema = z.object({
  tenantsChecked: z.number(),
  spikesDetected: z.number(),
  alertsCreated: z.number(),
});

// ---------------------------------------------------------------------------
// Param schemas — Provider & BYOK (Task 3)
// ---------------------------------------------------------------------------

export const providerIdParamsSchema = z.object({
  providerId: z.string().min(1).max(50),
});

export const tenantProviderParamsSchema = z.object({
  id: z.uuid(),
  providerId: z.string().min(1).max(50),
});

// ---------------------------------------------------------------------------
// Request schemas — Provider key management
// ---------------------------------------------------------------------------

export const updateProviderKeyBodySchema = z.object({
  apiKey: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Request schemas — BYOK management
// ---------------------------------------------------------------------------

export const addByokKeyBodySchema = z.object({
  apiKey: z.string().min(1),
});

export const toggleActiveBodySchema = z.object({
  isActive: z.boolean(),
});

// ---------------------------------------------------------------------------
// Response schemas — GET /admin/ai/providers
// ---------------------------------------------------------------------------

const vendorProviderItemSchema = z.object({
  providerId: z.string(),
  displayName: z.string(),
  isActive: z.boolean(),
  hasApiKey: z.boolean(),
  lastUsedAt: z.string().nullable(),
});

export const aiProvidersResponseSchema = z.array(vendorProviderItemSchema);

// ---------------------------------------------------------------------------
// Response schemas — PUT /admin/ai/providers/:providerId/key
// ---------------------------------------------------------------------------

export const updateProviderKeyResponseSchema = z.object({
  success: z.literal(true),
  providerId: z.string(),
  updatedAt: z.string(),
});

// ---------------------------------------------------------------------------
// Response schemas — PATCH /admin/ai/providers/:providerId
// ---------------------------------------------------------------------------

export const toggleProviderResponseSchema = z.object({
  providerId: z.string(),
  isActive: z.boolean(),
  updatedAt: z.string(),
});

// ---------------------------------------------------------------------------
// Response schemas — GET /admin/tenants/:id/ai/byok
// ---------------------------------------------------------------------------

const byokKeyItemSchema = z.object({
  providerId: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});

export const tenantByokResponseSchema = z.array(byokKeyItemSchema);

// ---------------------------------------------------------------------------
// Response schemas — PUT /admin/tenants/:id/ai/byok/:providerId
// ---------------------------------------------------------------------------

export const addByokKeyResponseSchema = z.object({
  tenantId: z.string(),
  providerId: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
});

// ---------------------------------------------------------------------------
// Response schemas — DELETE /admin/tenants/:id/ai/byok/:providerId
// ---------------------------------------------------------------------------

export const deleteByokKeyResponseSchema = z.object({
  tenantId: z.string(),
  providerId: z.string(),
  deleted: z.literal(true),
});

// ---------------------------------------------------------------------------
// Response schemas — PATCH /admin/tenants/:id/ai/byok/:providerId
// ---------------------------------------------------------------------------

export const toggleByokKeyResponseSchema = z.object({
  tenantId: z.string(),
  providerId: z.string(),
  isActive: z.boolean(),
  updatedAt: z.string(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type TenantIdParams = z.infer<typeof tenantIdParamsSchema>;
export type AlertIdParams = z.infer<typeof alertIdParamsSchema>;
export type ProviderIdParams = z.infer<typeof providerIdParamsSchema>;
export type TenantProviderParams = z.infer<typeof tenantProviderParamsSchema>;
export type AiAlertsQuery = z.infer<typeof aiAlertsQuerySchema>;
export type AiExportQuery = z.infer<typeof aiExportQuerySchema>;
export type SpikeDetectionBody = z.infer<typeof spikeDetectionBodySchema>;
export type UpdateProviderKeyBody = z.infer<typeof updateProviderKeyBodySchema>;
export type AddByokKeyBody = z.infer<typeof addByokKeyBodySchema>;
export type ToggleActiveBody = z.infer<typeof toggleActiveBodySchema>;
export type AiUsageSummaryResponse = z.infer<typeof aiUsageSummaryResponseSchema>;
export type AiTenantUsageResponse = z.infer<typeof aiTenantUsageResponseSchema>;
export type AiUsageByFeatureResponse = z.infer<typeof aiUsageByFeatureResponseSchema>;
