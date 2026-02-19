import { z } from 'zod';
import { UserRole } from '@nexa/db';

// ---------------------------------------------------------------------------
// Valid module identifiers (matches the 11 MVP modules from the PRD)
// ---------------------------------------------------------------------------

const VALID_MODULES = [
  'SYSTEM',
  'FINANCE',
  'AR',
  'AP',
  'SALES',
  'PURCHASING',
  'INVENTORY',
  'CRM',
  'HR',
  'MANUFACTURING',
  'REPORTING',
] as const;

const moduleSchema = z.enum(VALID_MODULES);

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createUserRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(UserRole),
  enabledModules: z.array(moduleSchema).default([]),
});

export const updateUserRequestSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
});

export const updateUserRoleRequestSchema = z.object({
  role: z.enum(UserRole),
});

export const updateUserModulesRequestSchema = z.object({
  enabledModules: z.array(moduleSchema),
});

// ---------------------------------------------------------------------------
// Params & Query Schemas
// ---------------------------------------------------------------------------

export const userParamsSchema = z.object({
  id: z.uuid(),
});

export const userListQuerySchema = z.object({
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['email', 'firstName', 'lastName', 'createdAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('asc'),
  search: z.string().optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const userResponseSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.enum(UserRole).nullable(),
  enabledModules: z.array(z.string()),
  isActive: z.boolean(),
  mfaEnabled: z.boolean(),
  lastLoginAt: z.date().nullable(),
  companyId: z.uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const userListResponseSchema = z.array(userResponseSchema);

// ---------------------------------------------------------------------------
// Access Group Assignment Schemas
// ---------------------------------------------------------------------------

export const replaceUserAccessGroupsRequestSchema = z.object({
  accessGroupIds: z.array(z.uuid()).min(1, 'At least one access group is required'),
});

export const userAccessGroupResponseSchema = z.object({
  id: z.string(),
  accessGroupId: z.string(),
  companyId: z.string(),
  assignedBy: z.string(),
  createdAt: z.date(),
  accessGroup: z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
  }),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;
export type UpdateUserRoleRequest = z.infer<typeof updateUserRoleRequestSchema>;
export type UpdateUserModulesRequest = z.infer<typeof updateUserModulesRequestSchema>;
export type ReplaceUserAccessGroupsRequest = z.infer<typeof replaceUserAccessGroupsRequestSchema>;
export type UserParams = z.infer<typeof userParamsSchema>;
export type UserListQuery = z.infer<typeof userListQuerySchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
