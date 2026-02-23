import { z } from 'zod';
import { FieldVisibility } from '@nexa/db';

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createAccessGroupSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Code must be uppercase alphanumeric with underscores, starting with a letter'),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});

export const updateAccessGroupSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).nullable().optional(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: 'At least one field (name or description) must be provided',
  });

export const setPermissionsSchema = z
  .array(
    z
      .object({
        resourceCode: z.string(),
        canAccess: z.boolean(),
        canNew: z.boolean(),
        canView: z.boolean(),
        canEdit: z.boolean(),
        canDelete: z.boolean(),
      })
      .refine(
        (p) => p.canAccess || (!p.canNew && !p.canView && !p.canEdit && !p.canDelete),
        { message: 'Action flags must be false when canAccess is false' },
      ),
  )
  .refine(
    (items) => {
      const codes = items.map((i) => i.resourceCode);
      return new Set(codes).size === codes.length;
    },
    { message: 'Duplicate resourceCode entries are not allowed' },
  );

// ---------------------------------------------------------------------------
// Params & Query Schemas
// ---------------------------------------------------------------------------

export const accessGroupParamsSchema = z.object({
  id: z.uuid(),
});

export const listAccessGroupsQuerySchema = z.object({
  search: z.string().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const accessGroupListItemSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  isSystem: z.boolean(),
  isActive: z.boolean(),
  userCount: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const permissionSchema = z.object({
  resourceCode: z.string(),
  canAccess: z.boolean(),
  canNew: z.boolean(),
  canView: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});

const fieldOverrideSchema = z.object({
  resourceCode: z.string(),
  fieldPath: z.string(),
  visibility: z.enum(FieldVisibility),
});

export const accessGroupDetailSchema = accessGroupListItemSchema.extend({
  permissions: z.array(permissionSchema),
  fieldOverrides: z.array(fieldOverrideSchema),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateAccessGroupInput = z.infer<typeof createAccessGroupSchema>;
export type UpdateAccessGroupInput = z.infer<typeof updateAccessGroupSchema>;
export type ListAccessGroupsQuery = z.infer<typeof listAccessGroupsQuerySchema>;
export type SetPermissionsInput = z.infer<typeof setPermissionsSchema>;
export type AccessGroupListItem = z.infer<typeof accessGroupListItemSchema>;
export type AccessGroupDetail = z.infer<typeof accessGroupDetailSchema>;
