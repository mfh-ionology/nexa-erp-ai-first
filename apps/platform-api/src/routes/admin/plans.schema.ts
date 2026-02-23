// ---------------------------------------------------------------------------
// Plan CRUD Schemas — Zod schemas for Plan management routes
// Source: API Contracts §21.4, Story E3b.5 Task 1
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createPlanSchema = z.object({
  code: z
    .string()
    .min(1, 'Plan code is required')
    .max(30, 'Plan code must be at most 30 characters')
    .regex(/^[a-z0-9_-]+$/, 'Plan code must be lowercase alphanumeric with hyphens/underscores only'),
  displayName: z.string().min(1, 'Display name is required').max(100),
  maxUsers: z.number().int().positive(),
  maxCompanies: z.number().int().positive(),
  monthlyAiTokenAllowance: z.number().int().nonnegative(),
  aiHardLimit: z.boolean().optional().default(true),
  enabledModules: z.array(z.string().min(1).max(50)),
  apiRateLimit: z.number().int().positive().optional().default(1000),
});

export const updatePlanSchema = z
  .object({
    displayName: z.string().min(1).max(100).optional(),
    maxUsers: z.number().int().positive().optional(),
    maxCompanies: z.number().int().positive().optional(),
    monthlyAiTokenAllowance: z.number().int().nonnegative().optional(),
    aiHardLimit: z.boolean().optional(),
    enabledModules: z.array(z.string().min(1).max(50)).optional(),
    apiRateLimit: z.number().int().positive().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (obj) => Object.keys(obj).length > 0,
    { message: 'At least one field must be provided' },
  );

export const planIdParamsSchema = z.object({
  id: z.uuid(),
});

export const listPlansQuerySchema = z.object({
  active: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const planResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  displayName: z.string(),
  maxUsers: z.number(),
  maxCompanies: z.number(),
  monthlyAiTokenAllowance: z.string(), // BigInt serialised as string
  aiHardLimit: z.boolean(),
  enabledModules: z.array(z.string()),
  apiRateLimit: z.number(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const planListResponseSchema = z.array(planResponseSchema);

// ---------------------------------------------------------------------------
// Inferred Types
// ---------------------------------------------------------------------------

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type PlanIdParams = z.infer<typeof planIdParamsSchema>;
export type ListPlansQuery = z.infer<typeof listPlansQuerySchema>;
