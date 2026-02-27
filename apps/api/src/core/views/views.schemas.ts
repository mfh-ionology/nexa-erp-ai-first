import { z } from 'zod';
import { FilterOperator, PinPosition, ViewScope } from '@nexa/db';

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

const sortConfigItemSchema = z.object({
  field: z.string().min(1),
  direction: z.enum(['ASC', 'DESC']),
  priority: z.number().int().min(0),
});

const columnConfigItemSchema = z.object({
  fieldId: z.uuid(),
  visible: z.boolean(),
  order: z.number().int().min(0),
  width: z.number().int().min(40).max(800),
  pinned: z.enum(PinPosition),
});

const conditionInputSchema = z.object({
  dataViewFieldId: z.uuid(),
  operator: z.enum(FilterOperator),
  value: z.string().optional(),
  valueList: z.array(z.string()).optional(),
  datePresetId: z.uuid().optional(),
  groupId: z.number().int().min(0).optional().default(0),
  groupLogic: z.enum(['AND', 'OR']).optional().default('AND'),
  outerLogic: z.enum(['AND', 'OR']).optional().default('AND'),
  conditionOrder: z.number().int().min(0),
});

// ---------------------------------------------------------------------------
// Query Schemas
// ---------------------------------------------------------------------------

export const viewInitQuerySchema = z.object({
  viewKey: z.string().min(1).max(50),
});

export const savedViewsQuerySchema = z.object({
  viewKey: z.string().min(1).max(50),
});

// ---------------------------------------------------------------------------
// Params Schemas
// ---------------------------------------------------------------------------

export const savedViewParamsSchema = z.object({
  id: z.uuid(),
});

export const columnWidthParamsSchema = z.object({
  viewKey: z.string().min(1).max(50),
  fieldId: z.uuid(),
});

export const columnPrefsParamsSchema = z.object({
  viewKey: z.string().min(1).max(50),
});

export const lovScopeParamsSchema = z.object({
  lovScope: z.string().min(1).max(50),
});

// ---------------------------------------------------------------------------
// Request Body Schemas
// ---------------------------------------------------------------------------

export const createSavedViewSchema = z
  .object({
    viewKey: z.string().min(1).max(50),
    name: z.string().min(1).max(100),
    groupName: z.string().min(1).max(100),
    scope: z.enum(ViewScope),
    roleId: z.uuid().optional(),
    isFavourite: z.boolean().optional().default(false),
    isDefault: z.boolean().optional().default(false),
    filterLogic: z.enum(['AND', 'OR']),
    sortConfig: z.array(sortConfigItemSchema),
    columnConfig: z.array(columnConfigItemSchema),
    conditions: z.array(conditionInputSchema),
  })
  .refine((data) => data.scope !== 'ROLE' || data.roleId !== undefined, {
    message: 'roleId is required when scope is ROLE',
    path: ['roleId'],
  });

export const updateSavedViewSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    groupName: z.string().min(1).max(100).optional(),
    filterLogic: z.enum(['AND', 'OR']).optional(),
    sortConfig: z.array(sortConfigItemSchema).optional(),
    columnConfig: z.array(columnConfigItemSchema).optional(),
    conditions: z.array(conditionInputSchema).optional(),
    isFavourite: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export const batchLovSchema = z.object({
  items: z
    .array(
      z.object({
        fieldId: z.uuid(),
        lovScope: z.string().min(1).max(50),
        search: z.string().optional(),
        parentValue: z.string().optional(),
        limit: z.number().int().min(1).max(200).optional().default(50),
      }),
    )
    .min(1)
    .max(20),
});

export const updateColumnWidthSchema = z.object({
  width: z.number().int().min(40).max(800),
});

export const bulkColumnPrefsSchema = z
  .array(
    z.object({
      dataViewFieldId: z.uuid(),
      visible: z.boolean(),
      displayOrder: z.number().int().min(0),
      width: z.number().int().min(40).max(800),
      pinned: z.enum(PinPosition),
    }),
  )
  .min(1);

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type ViewInitQuery = z.infer<typeof viewInitQuerySchema>;
export type CreateSavedViewBody = z.infer<typeof createSavedViewSchema>;
export type UpdateSavedViewBody = z.infer<typeof updateSavedViewSchema>;
export type BatchLovBody = z.infer<typeof batchLovSchema>;
export type UpdateColumnWidthBody = z.infer<typeof updateColumnWidthSchema>;
export type BulkColumnPrefsBody = z.infer<typeof bulkColumnPrefsSchema>;
