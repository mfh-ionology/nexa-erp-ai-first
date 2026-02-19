import { z } from 'zod';

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createAccessGroupRequestSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

export const updateAccessGroupRequestSchema = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().optional().nullable(),
    isActive: z.boolean(),
  })
  .partial()
  .strict();

const permissionItemSchema = z.object({
  resourceCode: z.string(),
  canAccess: z.boolean(),
  canNew: z.boolean(),
  canView: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});

const fieldOverrideItemSchema = z.object({
  resourceCode: z.string(),
  fieldPath: z.string(),
  visibility: z.enum(['VISIBLE', 'READ_ONLY', 'HIDDEN']),
});

export const replacePermissionsRequestSchema = z.object({
  permissions: z.array(permissionItemSchema),
});

export const replaceFieldOverridesRequestSchema = z.object({
  fieldOverrides: z.array(fieldOverrideItemSchema),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const accessGroupSummarySchema = z.object({
  id: z.string(),
  companyId: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const permissionResponseSchema = z.object({
  id: z.string(),
  resourceCode: z.string(),
  canAccess: z.boolean(),
  canNew: z.boolean(),
  canView: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});

const fieldOverrideResponseSchema = z.object({
  id: z.string(),
  resourceCode: z.string(),
  fieldPath: z.string(),
  visibility: z.string(),
});

export const accessGroupDetailSchema = accessGroupSummarySchema.extend({
  permissions: z.array(permissionResponseSchema),
  fieldOverrides: z.array(fieldOverrideResponseSchema),
  _count: z.object({ userAccessGroups: z.number() }).optional(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateAccessGroupRequest = z.infer<typeof createAccessGroupRequestSchema>;
export type UpdateAccessGroupRequest = z.infer<typeof updateAccessGroupRequestSchema>;
export type ReplacePermissionsRequest = z.infer<typeof replacePermissionsRequestSchema>;
export type ReplaceFieldOverridesRequest = z.infer<typeof replaceFieldOverridesRequestSchema>;
