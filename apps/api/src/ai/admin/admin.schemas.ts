// ---------------------------------------------------------------------------
// Zod schemas for AI Admin CRUD — Models, Prompts, Dashboard
// E5c-3 Task 1: AC #3, #4, #5, #6
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ─── Shared enums ───────────────────────────────────────────────────────────

const promptCategoryEnum = z.enum([
  'record-creation',
  'query',
  'analysis',
  'briefing',
  'skill',
  'chat',
  'automation',
]);

// ─── Params schemas ─────────────────────────────────────────────────────────

export const modelIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const promptIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const versionParamsSchema = z.object({
  id: z.string().uuid(),
  version: z.coerce.number().int().positive(),
});

// ─── Model request schemas ──────────────────────────────────────────────────

export const createModelSchema = z.object({
  name: z.string().min(1).max(100),
  provider: z.string().min(1).max(100),
  modelId: z.string().min(1).max(255),
  displayName: z.string().min(1).max(255),
  maxInputTokens: z.number().int().positive(),
  maxOutputTokens: z.number().int().positive(),
  costPerMInput: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, 'Must be a decimal number with up to 4 decimal places'),
  costPerMOutput: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, 'Must be a decimal number with up to 4 decimal places'),
  capabilities: z.record(z.string(), z.unknown()).default({}),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  config: z.record(z.string(), z.unknown()).optional(),
  fallbackModelId: z.string().uuid().optional(),
  routingTags: z.array(z.string()).default([]),
});

export const updateModelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  provider: z.string().min(1).max(100).optional(),
  modelId: z.string().min(1).max(255).optional(),
  displayName: z.string().min(1).max(255).optional(),
  maxInputTokens: z.number().int().positive().optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  costPerMInput: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, 'Must be a decimal number with up to 4 decimal places')
    .optional(),
  costPerMOutput: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, 'Must be a decimal number with up to 4 decimal places')
    .optional(),
  capabilities: z.record(z.string(), z.unknown()).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).nullable().optional(),
  fallbackModelId: z.string().uuid().nullable().optional(),
  routingTags: z.array(z.string()).optional(),
});

// ─── Model query schema ─────────────────────────────────────────────────────

export const listModelsQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  provider: z.string().optional(),
  search: z.string().max(200).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ─── Prompt request schemas ─────────────────────────────────────────────────

export const createPromptSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-z][a-z0-9_-]*$/,
      'Name must start with a lowercase letter and contain only lowercase letters, digits, hyphens, or underscores',
    ),
  description: z.string().max(2000).optional(),
  category: promptCategoryEnum,
  systemPrompt: z.string().min(1),
  userTemplate: z.string().min(1),
  parameters: z.unknown().default([]),
  outputFormat: z.unknown().optional(),
  isActive: z.boolean().default(true),
});

export const updatePromptSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-z][a-z0-9_-]*$/,
      'Name must start with a lowercase letter and contain only lowercase letters, digits, hyphens, or underscores',
    )
    .optional(),
  description: z.string().max(2000).nullable().optional(),
  category: promptCategoryEnum.optional(),
  systemPrompt: z.string().min(1).optional(),
  userTemplate: z.string().min(1).optional(),
  parameters: z.unknown().optional(),
  outputFormat: z.unknown().nullable().optional(),
  isActive: z.boolean().optional(),
  changeReason: z.string().min(1).max(500).optional(),
});

// ─── Prompt query schema ────────────────────────────────────────────────────

export const listPromptsQuerySchema = z.object({
  category: promptCategoryEnum.optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().max(200).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ─── Version & test schemas ─────────────────────────────────────────────────

export const testPromptSchema = z.object({
  sampleVariables: z.record(z.string(), z.string()).optional(),
  entityId: z.string().optional(),
  entityType: z.string().optional(),
});

// ─── Dashboard query schema ─────────────────────────────────────────────────

export const dashboardQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(30),
});

// ─── Model response schemas ─────────────────────────────────────────────────

export const modelListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  modelId: z.string(),
  displayName: z.string(),
  maxInputTokens: z.number(),
  maxOutputTokens: z.number(),
  costPerMInput: z.string(),
  costPerMOutput: z.string(),
  routingTags: z.array(z.string()),
  capabilities: z.unknown(),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  fallbackModelId: z.string().nullable(),
  agentCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const modelDetailSchema = modelListItemSchema.extend({
  fallbackModel: z
    .object({
      id: z.string(),
      name: z.string(),
      displayName: z.string(),
    })
    .nullable(),
  config: z.unknown().nullable(),
});

// ─── Prompt response schemas ────────────────────────────────────────────────

export const promptListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  activeVersion: z.number(),
  isActive: z.boolean(),
  variableCount: z.number(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const promptDetailSchema = promptListItemSchema.extend({
  systemPrompt: z.string(),
  userTemplate: z.string(),
  parameters: z.unknown(),
  outputFormat: z.unknown().nullable(),
  variables: z.array(
    z.object({
      id: z.string(),
      variableName: z.string(),
      displayName: z.string(),
      sourceType: z.string(),
    }),
  ),
  versionCount: z.number(),
});

export const promptVersionItemSchema = z.object({
  id: z.string(),
  promptId: z.string(),
  version: z.number(),
  changeReason: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.string(),
  snippet: z.string(),
});

export const promptVersionDetailSchema = promptVersionItemSchema.extend({
  systemPrompt: z.string(),
  userTemplate: z.string(),
  parameters: z.unknown(),
});

// ─── Test render response schema ────────────────────────────────────────────

export const testRenderResultSchema = z.object({
  systemPrompt: z.string(),
  userTemplate: z.string(),
  resolvedVariables: z.record(z.string(), z.string()),
  unresolvedCount: z.number(),
});

// ─── Dashboard response schema ──────────────────────────────────────────────

export const dashboardSummarySchema = z.object({
  activeModels: z.object({
    count: z.number(),
    monthlyCost: z.string(),
  }),
  activeAgents: z.object({
    count: z.number(),
  }),
  activeSkills: z.object({
    byModule: z.record(z.string(), z.number()),
    total: z.number(),
  }),
  automations: z.object({
    active: z.number(),
    paused: z.number(),
    last24hRuns: z.object({
      success: z.number(),
      failed: z.number(),
    }),
  }),
  dailyTokenUsage: z.array(
    z.object({
      date: z.string(),
      inputTokens: z.number(),
      outputTokens: z.number(),
      totalCost: z.string(),
    }),
  ),
});

// ─── Shared enums (agents & skills) ────────────────────────────────────────

const skillCategoryEnum = z.enum(['document', 'analysis', 'communication', 'financial']);

const skillOutputTypeEnum = z.enum(['pdf', 'json', 'markdown', 'email']);

const orchestrationPatternEnum = z.enum([
  'SEQUENTIAL',
  'PARALLEL',
  'ITERATIVE',
  'CONTEXT_AWARE',
  'DOMAIN_INTELLIGENCE',
]);

const nameRegex = /^[a-z][a-z0-9_-]*$/;
const nameRegexMsg =
  'Name must start with a lowercase letter and contain only lowercase letters, digits, hyphens, or underscores';

// ─── Agent params schemas ──────────────────────────────────────────────────

export const agentIdParamsSchema = z.object({
  id: z.string().uuid(),
});

// ─── Agent guardrails schema ──────────────────────────────────────────────

const agentGuardrailsSchema = z.object({
  canRead: z.array(z.string()).default([]),
  canWrite: z.array(z.string()).default([]),
  requiresApproval: z.boolean().default(false),
  maxAmountWithoutApproval: z.string().optional(),
  blockedOperations: z.array(z.string()).default([]),
  dataScope: z.enum(['own', 'module', 'all']).default('own'),
});

// ─── Agent request schemas ─────────────────────────────────────────────────

export const createAgentSchema = z.object({
  name: z.string().min(1).max(100).regex(nameRegex, nameRegexMsg),
  displayName: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  modelId: z.string().uuid().nullable().optional().default(null),
  promptId: z.string().uuid(),
  routingTags: z.array(z.string()).default([]),
  tools: z.unknown().default([]),
  guardrails: agentGuardrailsSchema.default({
    canRead: [],
    canWrite: [],
    requiresApproval: false,
    blockedOperations: [],
    dataScope: 'own',
  }),
  triggerConfig: z.unknown().default([]),
  maxTurns: z.number().int().min(1).max(50).default(10),
  isActive: z.boolean().default(true),
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).regex(nameRegex, nameRegexMsg).optional(),
  displayName: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  modelId: z.string().uuid().nullable().optional(),
  promptId: z.string().uuid().optional(),
  routingTags: z.array(z.string()).optional(),
  tools: z.unknown().optional(),
  guardrails: agentGuardrailsSchema.optional(),
  triggerConfig: z.unknown().optional(),
  maxTurns: z.number().int().min(1).max(50).optional(),
  isActive: z.boolean().optional(),
});

// ─── Agent query schema ────────────────────────────────────────────────────

export const listAgentsQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().max(200).optional(),
  modelId: z.string().uuid().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ─── Skill params schemas ──────────────────────────────────────────────────

export const skillIdParamsSchema = z.object({
  id: z.string().uuid(),
});

// ─── Skill request schemas ─────────────────────────────────────────────────

export const createSkillSchema = z.object({
  name: z.string().min(1).max(100).regex(nameRegex, nameRegexMsg),
  displayName: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  category: skillCategoryEnum,
  skillContent: z.string().min(1),
  triggerPhrases: z.array(z.string()).min(1),
  inputSchema: z.unknown().default({}),
  outputType: skillOutputTypeEnum,
  requiredTools: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
  moduleKey: z.string().max(100).optional(),
  packKey: z.string().max(100).optional(),
  negativeTriggers: z.array(z.string()).default([]),
  contextRequired: z.array(z.string()).default([]),
  orchestrationPattern: orchestrationPatternEnum.nullable().optional().default(null),
  parameters: z.unknown().optional(),
  examples: z.unknown().optional(),
  priority: z.number().int().min(1).max(1000).default(100),
});

export const updateSkillSchema = z.object({
  name: z.string().min(1).max(100).regex(nameRegex, nameRegexMsg).optional(),
  displayName: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  category: skillCategoryEnum.optional(),
  skillContent: z.string().min(1).optional(),
  triggerPhrases: z.array(z.string()).min(1).optional(),
  inputSchema: z.unknown().optional(),
  outputType: skillOutputTypeEnum.optional(),
  requiredTools: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
  moduleKey: z.string().max(100).nullable().optional(),
  packKey: z.string().max(100).nullable().optional(),
  negativeTriggers: z.array(z.string()).optional(),
  contextRequired: z.array(z.string()).optional(),
  orchestrationPattern: orchestrationPatternEnum.nullable().optional(),
  parameters: z.unknown().nullable().optional(),
  examples: z.unknown().nullable().optional(),
  priority: z.number().int().min(1).max(1000).optional(),
});

// ─── Skill query schema ────────────────────────────────────────────────────

export const listSkillsQuerySchema = z.object({
  moduleKey: z.string().optional(),
  category: skillCategoryEnum.optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().max(200).optional(),
  grouped: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ─── Trigger test schema ───────────────────────────────────────────────────

export const testTriggerSchema = z.object({
  phrase: z.string().min(1).max(500),
});

// ─── Agent response schemas ────────────────────────────────────────────────

export const agentListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string(),
  description: z.string().nullable(),
  modelId: z.string().nullable(),
  modelDisplayName: z.string().nullable(),
  promptId: z.string(),
  promptName: z.string(),
  routingTags: z.array(z.string()),
  toolCount: z.number(),
  maxTurns: z.number(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const agentDetailSchema = agentListItemSchema.extend({
  tools: z.unknown(),
  guardrails: z.unknown(),
  triggerConfig: z.unknown(),
  model: z
    .object({
      id: z.string(),
      name: z.string(),
      displayName: z.string(),
      provider: z.string(),
    })
    .nullable(),
  prompt: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    category: z.string(),
  }),
  automationStepCount: z.number(),
});

// ─── Skill response schemas ────────────────────────────────────────────────

export const skillListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  moduleKey: z.string().nullable(),
  packKey: z.string().nullable(),
  triggerPhrases: z.array(z.string()),
  negativeTriggers: z.array(z.string()),
  orchestrationPattern: z.string().nullable(),
  priority: z.number(),
  version: z.number(),
  isActive: z.boolean(),
  outputType: z.string(),
  requiredToolCount: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const skillDetailSchema = skillListItemSchema.extend({
  skillContent: z.string(),
  inputSchema: z.unknown(),
  requiredTools: z.array(z.string()),
  contextRequired: z.array(z.string()),
  parameters: z.unknown().nullable(),
  examples: z.unknown().nullable(),
  contextCount: z.number(),
  overrideCount: z.number(),
});

export const skillsGroupedResponseSchema = z.object({
  groups: z.array(
    z.object({
      moduleKey: z.string().nullable(),
      skills: z.array(skillListItemSchema),
    }),
  ),
  totalCount: z.number(),
});

// ─── Test trigger response schema ──────────────────────────────────────────

export const testTriggerResultSchema = z.object({
  matchedModule: z.string().nullable(),
  matchedSkill: z
    .object({
      id: z.string(),
      name: z.string(),
      displayName: z.string(),
      confidence: z.number(),
    })
    .nullable(),
  l0Confidence: z.number(),
  l1Confidence: z.number(),
  requiredTools: z.array(z.string()),
  skillContentPreview: z.string(),
  noMatch: z.boolean(),
  suggestions: z.array(z.string()),
});

// ─── TypeScript type inference ──────────────────────────────────────────────

export type CreateModelInput = z.infer<typeof createModelSchema>;
export type UpdateModelInput = z.infer<typeof updateModelSchema>;
export type ListModelsQuery = z.infer<typeof listModelsQuerySchema>;
export type CreatePromptInput = z.infer<typeof createPromptSchema>;
export type UpdatePromptInput = z.infer<typeof updatePromptSchema>;
export type ListPromptsQuery = z.infer<typeof listPromptsQuerySchema>;
export type TestPromptInput = z.infer<typeof testPromptSchema>;
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

// Agent types
export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type ListAgentsQuery = z.infer<typeof listAgentsQuerySchema>;

// Skill types
export type CreateSkillInput = z.infer<typeof createSkillSchema>;
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;
export type ListSkillsQuery = z.infer<typeof listSkillsQuerySchema>;
export type TestTriggerInput = z.infer<typeof testTriggerSchema>;
