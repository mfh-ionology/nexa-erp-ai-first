import { z } from 'zod';

// ─── Cash Flow Forecast ─────────────────────────────────────────────────────

export const cashFlowRequestSchema = z.object({
  startDate: z.iso.date(),                 // ISO date string (YYYY-MM-DD)
  endDate: z.iso.date(),
  bankAccountIds: z.array(z.uuid()).optional(),
  includeCommittedPOs: z.boolean().default(true),
  includeRecurring: z.boolean().default(true),
}).refine((data) => data.startDate < data.endDate, {
  message: 'startDate must be before endDate',
});

const inflowOutflowDetailSchema = z.object({
  source: z.string(),
  amount: z.string(),
  description: z.string(),
});

const cashFlowPeriodSchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  openingBalance: z.string(),
  inflows: z.string(),
  outflows: z.string(),
  netFlow: z.string(),
  closingBalance: z.string(),
  inflowDetails: z.array(inflowOutflowDetailSchema),
  outflowDetails: z.array(inflowOutflowDetailSchema),
});

const cashFlowAlertSchema = z.object({
  type: z.enum(['LOW_BALANCE', 'NEGATIVE_BALANCE', 'COLLECTION_OPPORTUNITY']),
  message: z.string(),
  period: z.string(),
  amount: z.string(),
  suggestedAction: z.string().optional(),
});

export const cashFlowResponseSchema = z.object({
  generatedAt: z.string(),
  currency: z.string(),
  currentBalance: z.string(),
  periods: z.array(cashFlowPeriodSchema),
  alerts: z.array(cashFlowAlertSchema),
});

// ─── Anomaly Detection ──────────────────────────────────────────────────────

export const anomalyRequestSchema = z.object({
  lookbackDays: z.number().int().min(7).max(365).default(90),
  entityTypes: z.array(z.enum(['Payment', 'SupplierInvoice'])).optional(),
  minConfidence: z.number().min(0).max(1).default(0.5),
});

const relatedEntitySchema = z.object({
  entityType: z.string(),
  entityId: z.string(),
  displayRef: z.string(),
  relationship: z.string(),
});

const anomalyResultSchema = z.object({
  id: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  displayRef: z.string(),
  anomalyType: z.enum([
    'DUPLICATE_AMOUNT', 'UNUSUAL_AMOUNT', 'TIMING_ANOMALY',
    'NEW_SUPPLIER_LARGE_AMOUNT', 'SEQUENTIAL_INVOICES', 'ROUND_NUMBER_BIAS',
  ]),
  description: z.string(),
  confidence: z.number(),
  confidenceLevel: z.enum(['high', 'review', 'low']),
  relatedEntities: z.array(relatedEntitySchema).optional(),
  metadata: z.record(z.string(), z.unknown()),
});

export const anomalyResponseSchema = z.object({
  generatedAt: z.string(),
  lookbackDays: z.number(),
  totalAnalysed: z.number(),
  anomalies: z.array(anomalyResultSchema),
});

// ─── Duplicate Detection ────────────────────────────────────────────────────

export const duplicateRequestSchema = z.object({
  entityType: z.enum(['Customer', 'Supplier', 'Contact']),
  minSimilarity: z.number().min(0).max(1).default(0.7),
  limit: z.number().int().min(1).max(100).default(20),
});

const fieldComparisonSchema = z.object({
  field: z.string(),
  valueA: z.string(),
  valueB: z.string(),
  similarity: z.number(),
});

const duplicateEntitySchema = z.object({
  entityType: z.string(),
  entityId: z.string(),
  displayRef: z.string(),
  data: z.record(z.string(), z.unknown()),
});

const duplicatePairSchema = z.object({
  entityA: duplicateEntitySchema,
  entityB: duplicateEntitySchema,
  overallSimilarity: z.number(),
  confidenceLevel: z.enum(['high', 'review', 'low']),
  fieldComparisons: z.array(fieldComparisonSchema),
});

export const duplicateResponseSchema = z.object({
  generatedAt: z.string(),
  entityType: z.string(),
  totalScanned: z.number(),
  duplicates: z.array(duplicatePairSchema),
});

// ─── Confidence Scoring ─────────────────────────────────────────────────────

export const confidenceParamsSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.uuid(),
});

export const confidenceResponseSchema = z.object({
  entityType: z.string(),
  entityId: z.string(),
  overallConfidence: z.number(),
  confidenceLevel: z.enum(['high', 'review', 'low']),
  fieldConfidence: z.record(z.string(), z.number()),
  lastUpdated: z.string(),
});

// ─── Explainability ─────────────────────────────────────────────────────────

export const explainRequestSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.uuid(),
  decisionType: z.enum(['creation', 'anomaly', 'forecast']),
});

const dataPointSchema = z.object({
  field: z.string(),
  value: z.string(),
  confidence: z.number(),
  source: z.string(),
});

export const explainResponseSchema = z.object({
  summary: z.string(),
  reasoning: z.array(z.string()),
  dataPoints: z.array(dataPointSchema),
});
