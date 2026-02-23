import { z } from 'zod';
import { FieldVisibility } from '@nexa/db';

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

const resourcePermissionSchema = z.object({
  canAccess: z.boolean(),
  canNew: z.boolean(),
  canView: z.boolean(),
  canEdit: z.boolean(),
  canDelete: z.boolean(),
});

const accessGroupInfoSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
});

export const myPermissionsResponseSchema = z.object({
  permissions: z.record(z.string(), resourcePermissionSchema),
  fieldOverrides: z.record(z.string(), z.record(z.string(), z.enum(FieldVisibility))),
  accessGroups: z.array(accessGroupInfoSchema),
  role: z.string(),
  isSuperAdmin: z.boolean(),
  enabledModules: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type MyPermissionsResponse = z.infer<typeof myPermissionsResponseSchema>;
