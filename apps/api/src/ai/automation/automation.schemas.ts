// ---------------------------------------------------------------------------
// Zod schemas for Automation CRUD & Run endpoints
// E5c-1 Task 10.3: AC #21, #22
// ---------------------------------------------------------------------------

import { z } from 'zod';
import { CronExpressionParser } from 'cron-parser';

// ─── Shared enums ───────────────────────────────────────────────────────────

const triggerTypeEnum = z.enum(['SCHEDULED', 'EVENT', 'CHAIN', 'MANUAL']);
const runStatusEnum = z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']);
// @ts-expect-error TS6133 — reserved for future use in step-run filtering
const _stepRunStatusEnum = z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED']);

// ─── Params schemas ─────────────────────────────────────────────────────────

export const automationIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const runIdParamsSchema = z.object({
  runId: z.string().uuid(),
});

export const automationRunParamsSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
});

// ─── Step sub-schema (for create/update) ────────────────────────────────────

const automationStepInputSchema = z.object({
  agentId: z.string().uuid(),
  goal: z.string().min(1).max(5000),
  inputConfig: z.record(z.string(), z.unknown()).default({}),
  outputConfig: z.record(z.string(), z.unknown()).default({}),
  maxTurns: z.number().int().min(1).max(50).default(10),
});

// ─── Schedule sub-schema ────────────────────────────────────────────────────

const automationScheduleInputSchema = z.object({
  cronExpression: z
    .string()
    .min(1)
    .max(100)
    .refine(
      (val) => {
        try {
          CronExpressionParser.parse(val);
          return true;
        } catch {
          return false;
        }
      },
      { message: 'Invalid cron expression' },
    ),
  timezone: z.string().max(50).default('Europe/London'),
  isPaused: z.boolean().optional().default(false),
});

// ─── Request schemas ────────────────────────────────────────────────────────

export const createAutomationSchema = z
  .object({
    name: z.string().min(1).max(255),
    description: z.string().max(2000).optional(),
    triggerType: triggerTypeEnum,
    eventType: z.string().max(255).optional(),
    steps: z.array(automationStepInputSchema).min(1),
    schedule: automationScheduleInputSchema.optional(),
    chainNextId: z.string().uuid().optional(),
    notificationConfig: z.record(z.string(), z.unknown()).optional(),
    maxTokenBudget: z.number().int().min(1000).max(500_000).default(50_000),
    maxDurationMs: z.number().int().min(1000).max(1_800_000).default(300_000),
  })
  .superRefine((data, ctx) => {
    // eventType required when triggerType is EVENT
    if (data.triggerType === 'EVENT' && !data.eventType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'eventType is required when triggerType is EVENT',
        path: ['eventType'],
      });
    }
    // schedule required when triggerType is SCHEDULED
    if (data.triggerType === 'SCHEDULED' && !data.schedule) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'schedule is required when triggerType is SCHEDULED',
        path: ['schedule'],
      });
    }
  });

export const updateAutomationSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).nullable().optional(),
    triggerType: triggerTypeEnum.optional(),
    eventType: z.string().max(255).nullable().optional(),
    steps: z.array(automationStepInputSchema).min(1).optional(),
    schedule: automationScheduleInputSchema.nullable().optional(),
    chainNextId: z.string().uuid().nullable().optional(),
    notificationConfig: z.record(z.string(), z.unknown()).nullable().optional(),
    maxTokenBudget: z.number().int().min(1000).max(500_000).optional(),
    maxDurationMs: z.number().int().min(1000).max(1_800_000).optional(),
    isActive: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    // If triggerType is being changed to EVENT, eventType must be provided
    if (data.triggerType === 'EVENT' && !data.eventType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'eventType is required when triggerType is EVENT',
        path: ['eventType'],
      });
    }
    // If triggerType is being changed to SCHEDULED, schedule must be provided
    if (data.triggerType === 'SCHEDULED' && !data.schedule) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'schedule is required when triggerType is SCHEDULED',
        path: ['schedule'],
      });
    }
    // Clearing eventType while keeping/setting EVENT trigger is invalid
    if (data.eventType === null && data.triggerType === 'EVENT') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cannot clear eventType while triggerType is EVENT',
        path: ['eventType'],
      });
    }
    // Clearing schedule while keeping/setting SCHEDULED trigger is invalid
    if (data.schedule === null && data.triggerType === 'SCHEDULED') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cannot clear schedule while triggerType is SCHEDULED',
        path: ['schedule'],
      });
    }
  });

export const runAutomationSchema = z.object({
  input: z.record(z.string(), z.unknown()).optional(),
});

// ─── Query schemas ──────────────────────────────────────────────────────────

export const listAutomationsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  triggerType: triggerTypeEnum.optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const listRunsQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: runStatusEnum.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

// ─── Response schemas ───────────────────────────────────────────────────────

const automationStepResponseSchema = z.object({
  id: z.string(),
  stepOrder: z.number(),
  agentId: z.string(),
  agentName: z.string().optional(),
  goal: z.string(),
  inputConfig: z.unknown(),
  outputConfig: z.unknown(),
  maxTurns: z.number(),
});

const automationScheduleResponseSchema = z.object({
  id: z.string(),
  cronExpression: z.string(),
  timezone: z.string(),
  nextRunAt: z.string().nullable(),
  lastRunAt: z.string().nullable(),
  isPaused: z.boolean(),
});

const automationRunSummarySchema = z.object({
  id: z.string(),
  triggeredBy: z.string(),
  status: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  totalTokens: z.number(),
  createdAt: z.string(),
});

export const automationListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  triggerType: z.string(),
  eventType: z.string().nullable(),
  isActive: z.boolean(),
  maxTokenBudget: z.number(),
  maxDurationMs: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  stepCount: z.number(),
  lastRunId: z.string().nullable(),
  lastRunStatus: z.string().nullable(),
  lastRunAt: z.string().nullable(),
  schedule: automationScheduleResponseSchema.nullable(),
});

export const automationListResponseSchema = z.array(automationListItemSchema);

export const automationDetailSchema = automationListItemSchema.extend({
  chainFromId: z.string().nullable(),
  chainNextId: z.string().nullable(),
  notificationConfig: z.unknown().nullable(),
  createdById: z.string(),
  steps: z.array(automationStepResponseSchema),
  recentRuns: z.array(automationRunSummarySchema),
});

// ─── Run detail response schemas ────────────────────────────────────────────

const stepRunResponseSchema = z.object({
  id: z.string(),
  stepId: z.string(),
  stepOrder: z.number().optional(),
  agentId: z.string(),
  modelId: z.string().nullable(),
  status: z.string(),
  input: z.unknown().nullable(),
  output: z.unknown().nullable(),
  error: z.string().nullable(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  latencyMs: z.number().nullable(),
  turns: z.number(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
});

export const runDetailSchema = z.object({
  id: z.string(),
  automationId: z.string(),
  automationName: z.string().optional(),
  triggeredBy: z.string(),
  status: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  totalTokens: z.number(),
  totalCost: z.string(),
  result: z.unknown().nullable(),
  error: z.string().nullable(),
  retryOfRunId: z.string().nullable(),
  createdAt: z.string(),
  stepRuns: z.array(stepRunResponseSchema),
});

export const runListItemSchema = z.object({
  id: z.string(),
  automationId: z.string(),
  automationName: z.string().optional(),
  triggeredBy: z.string(),
  status: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  totalTokens: z.number(),
  totalCost: z.string(),
  error: z.string().nullable(),
  createdAt: z.string(),
});

export const runListResponseSchema = z.array(runListItemSchema);

// ─── Variable CRUD schemas ──────────────────────────────────────────────────

const variableSourceTypeEnum = z.enum([
  'DB_FIELD',
  'DB_QUERY',
  'PAGE_FIELD',
  'SYSTEM',
  'CONSTANT',
  'EXPRESSION',
  'PREVIOUS_STEP',
]);

/** Known SYSTEM variable keys — validated when sourceType is SYSTEM */
const KNOWN_SYSTEM_VARIABLE_KEYS = new Set([
  'today',
  'currentUser.name',
  'currentUser.role',
  'currentUser.id',
  'company.name',
  'company.baseCurrency',
  'company.defaultCurrency',
  'company.id',
]);

export const variableIdParamsSchema = z.object({
  id: z.string().uuid(),
});

/** Shared sourceConfig shape validation for create and update schemas */
function validateSourceConfig(
  sourceType: string,
  cfg: Record<string, unknown>,
  ctx: z.RefinementCtx,
): void {
  switch (sourceType) {
    case 'DB_FIELD':
      if (typeof cfg.table !== 'string' || !cfg.table) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'sourceConfig.table is required for DB_FIELD',
          path: ['sourceConfig', 'table'],
        });
      }
      if (typeof cfg.field !== 'string' || !cfg.field) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'sourceConfig.field is required for DB_FIELD',
          path: ['sourceConfig', 'field'],
        });
      }
      break;
    case 'DB_QUERY':
      if (typeof cfg.query !== 'string' || !cfg.query) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'sourceConfig.query is required for DB_QUERY',
          path: ['sourceConfig', 'query'],
        });
      } else if (!cfg.query.toString().trim().toUpperCase().startsWith('SELECT')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'sourceConfig.query must start with SELECT',
          path: ['sourceConfig', 'query'],
        });
      }
      break;
    case 'PAGE_FIELD':
      if (typeof cfg.field !== 'string' || !cfg.field) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'sourceConfig.field is required for PAGE_FIELD',
          path: ['sourceConfig', 'field'],
        });
      }
      break;
    case 'SYSTEM':
      if (typeof cfg.key !== 'string' || !cfg.key) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'sourceConfig.key is required for SYSTEM',
          path: ['sourceConfig', 'key'],
        });
      } else if (!KNOWN_SYSTEM_VARIABLE_KEYS.has(cfg.key as string)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unknown system variable '${cfg.key}'. Must be one of: ${[...KNOWN_SYSTEM_VARIABLE_KEYS].join(', ')}`,
          path: ['sourceConfig', 'key'],
        });
      }
      break;
    case 'CONSTANT':
      if (cfg.value === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'sourceConfig.value is required for CONSTANT',
          path: ['sourceConfig', 'value'],
        });
      }
      break;
    case 'EXPRESSION':
      if (typeof cfg.expression !== 'string' || !cfg.expression) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'sourceConfig.expression is required for EXPRESSION',
          path: ['sourceConfig', 'expression'],
        });
      }
      break;
    case 'PREVIOUS_STEP':
      if (typeof cfg.stepOrder !== 'number' || cfg.stepOrder < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'sourceConfig.stepOrder (positive number) is required for PREVIOUS_STEP',
          path: ['sourceConfig', 'stepOrder'],
        });
      }
      break;
  }
}

export const createVariableSchema = z
  .object({
    promptId: z.string().uuid(),
    variableName: z
      .string()
      .min(1)
      .max(100)
      .regex(
        /^[a-zA-Z][a-zA-Z0-9_.]*$/,
        'Variable name must start with a letter and contain only letters, digits, dots, or underscores',
      ),
    displayName: z.string().min(1).max(255),
    description: z.string().optional(),
    sourceType: variableSourceTypeEnum,
    sourceConfig: z.record(z.string(), z.unknown()),
    defaultValue: z.string().optional(),
    isRequired: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    validateSourceConfig(data.sourceType, data.sourceConfig, ctx);
  });

export const updateVariableSchema = z
  .object({
    variableName: z
      .string()
      .min(1)
      .max(100)
      .regex(
        /^[a-zA-Z][a-zA-Z0-9_.]*$/,
        'Variable name must start with a letter and contain only letters, digits, dots, or underscores',
      )
      .optional(),
    displayName: z.string().min(1).max(255).optional(),
    description: z.string().nullable().optional(),
    sourceType: variableSourceTypeEnum.optional(),
    sourceConfig: z.record(z.string(), z.unknown()).optional(),
    defaultValue: z.string().nullable().optional(),
    isRequired: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    // When both sourceType and sourceConfig are provided, validate the shape
    if (data.sourceType && data.sourceConfig) {
      validateSourceConfig(data.sourceType, data.sourceConfig, ctx);
    }
  });

export const testResolveSchema = z.object({
  // companyId is NOT accepted from the body — it comes from the authenticated request context
  userId: z.string().uuid().optional(),
  userName: z.string().optional(),
  userRole: z.string().optional(),
  companyName: z.string().optional(),
  baseCurrency: z.string().optional(),
  defaultCurrency: z.string().optional(),
  pageContext: z.record(z.string(), z.unknown()).optional(),
});

export const listVariablesQuerySchema = z.object({
  promptId: z.string().uuid().optional(),
});

// ─── Variable registry response schema ──────────────────────────────────────

export const variableRegistryItemSchema = z.object({
  id: z.string(),
  promptId: z.string(),
  promptName: z.string().nullable(),
  variableName: z.string(),
  displayName: z.string(),
  description: z.string().nullable(),
  sourceType: z.string(),
  sourceConfig: z.unknown(),
  defaultValue: z.string().nullable(),
  isRequired: z.boolean(),
});

export const variableRegistryGroupedResponseSchema = z.record(
  z.string(),
  z.array(variableRegistryItemSchema),
);

export const variableDetailSchema = variableRegistryItemSchema.extend({
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const testResolveResponseSchema = z.object({
  variableId: z.string(),
  variableName: z.string(),
  sourceType: z.string(),
  resolvedValue: z.unknown().nullable(),
  resolveTimeMs: z.number(),
  success: z.boolean(),
  error: z.string().nullable(),
});

// ─── Retry response schema ─────────────────────────────────────────────────

export const retryResponseSchema = z.object({
  message: z.string(),
  automationId: z.string(),
  originalRunId: z.string(),
  newRunId: z.string(),
});

// ─── TypeScript type inference ──────────────────────────────────────────────

export type CreateAutomationInput = z.infer<typeof createAutomationSchema>;
export type UpdateAutomationInput = z.infer<typeof updateAutomationSchema>;
export type RunAutomationInput = z.infer<typeof runAutomationSchema>;
export type ListAutomationsQuery = z.infer<typeof listAutomationsQuerySchema>;
export type ListRunsQuery = z.infer<typeof listRunsQuerySchema>;
export type CreateVariableInput = z.infer<typeof createVariableSchema>;
export type UpdateVariableInput = z.infer<typeof updateVariableSchema>;
export type TestResolveInput = z.infer<typeof testResolveSchema>;
export type ListVariablesQuery = z.infer<typeof listVariablesQuerySchema>;
