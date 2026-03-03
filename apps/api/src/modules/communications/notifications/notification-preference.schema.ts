import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums (mirror Prisma enums for Zod validation)
// ---------------------------------------------------------------------------

const notificationChannelEnum = z.enum(['IN_APP', 'EMAIL', 'PUSH']);
const notificationPriorityEnum = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

/**
 * GET /notifications/preferences — no params needed, returns for authenticated user.
 */
export const getPreferencesSchema = z.object({}).optional();

/**
 * PUT /notifications/preferences — bulk upsert preferences.
 */
export const updatePreferencesSchema = z.object({
  preferences: z
    .array(
      z.object({
        notificationTemplateId: z.uuid(),
        enableInApp: z.boolean().optional(),
        enableEmail: z.boolean().optional(),
        enablePush: z.boolean().optional(),
        priorityOverride: notificationPriorityEnum.nullable().optional(),
        isMuted: z.boolean().optional(),
        muteUntil: z.string().datetime().nullable().optional(),
      }),
    )
    .min(1),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const preferenceItemResponseSchema = z.object({
  templateId: z.string(),
  templateCode: z.string(),
  templateName: z.string(),
  eventName: z.string(),
  defaultChannels: z.array(notificationChannelEnum),
  defaultPriority: notificationPriorityEnum,
  enableInApp: z.boolean(),
  enableEmail: z.boolean(),
  enablePush: z.boolean(),
  priorityOverride: notificationPriorityEnum.nullable(),
  isMuted: z.boolean(),
  muteUntil: z.string().nullable(),
  hasUserPreference: z.boolean(),
});

export const preferencesResponseSchema = z.object({
  items: z.array(
    preferenceItemResponseSchema.extend({
      source: z.enum(['USER', 'ROLE_DEFAULT', 'TEMPLATE_DEFAULT']),
    }),
  ),
});

export const updatePreferencesResponseSchema = z.object({
  updated: z.number().int(),
});

/**
 * DELETE /notifications/preferences/reset — delete all user preferences,
 * falling back to role/template defaults.
 */
export const resetPreferencesResponseSchema = z.object({
  deleted: z.number().int(),
});

// ---------------------------------------------------------------------------
// Role-Defaults Schemas (ADMIN-only, E9-4 Task 5)
// ---------------------------------------------------------------------------

const userRoleEnum = z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF', 'VIEWER']);

/**
 * GET /notifications/preferences/role-defaults?role=STAFF
 */
export const getRoleDefaultsQuerySchema = z.object({
  role: userRoleEnum,
});

/**
 * PUT /notifications/preferences/role-defaults
 */
export const updateRoleDefaultsSchema = z.object({
  role: userRoleEnum,
  preferences: z
    .array(
      z.object({
        notificationTemplateId: z.uuid(),
        enableInApp: z.boolean(),
        enableEmail: z.boolean(),
        enablePush: z.boolean(),
      }),
    )
    .min(1),
});

/** Single item in the role-defaults response */
export const roleDefaultItemResponseSchema = z.object({
  templateId: z.string(),
  templateCode: z.string(),
  templateName: z.string(),
  eventName: z.string(),
  defaultChannels: z.array(notificationChannelEnum),
  enableInApp: z.boolean(),
  enableEmail: z.boolean(),
  enablePush: z.boolean(),
  hasRoleDefault: z.boolean(),
});

export const roleDefaultsResponseSchema = z.object({
  role: userRoleEnum,
  items: z.array(roleDefaultItemResponseSchema),
});

export const updateRoleDefaultsResponseSchema = z.object({
  updated: z.number().int(),
});

// ---------------------------------------------------------------------------
// Updated Preference Item (with source field for cascade tracking)
// ---------------------------------------------------------------------------

export const preferenceItemWithSourceSchema = preferenceItemResponseSchema.extend({
  source: z.enum(['USER', 'ROLE_DEFAULT', 'TEMPLATE_DEFAULT']),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type PreferenceItemResponse = z.infer<typeof preferenceItemResponseSchema>;
export type GetRoleDefaultsQuery = z.infer<typeof getRoleDefaultsQuerySchema>;
export type UpdateRoleDefaultsInput = z.infer<typeof updateRoleDefaultsSchema>;
export type RoleDefaultItemResponse = z.infer<typeof roleDefaultItemResponseSchema>;
export type PreferenceItemWithSource = z.infer<typeof preferenceItemWithSourceSchema>;
