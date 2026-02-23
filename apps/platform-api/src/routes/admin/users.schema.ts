import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

const platformUserProfileSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string(),
  role: z.enum(['PLATFORM_ADMIN', 'PLATFORM_VIEWER']),
  mfaEnabled: z.boolean(),
  isActive: z.boolean(),
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
});

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createUserRequestSchema = z.object({
  email: z.email(),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters for platform admin accounts')
    .max(128)
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/\d/, 'Password must contain at least one digit')
    .regex(/[^a-zA-Z\d]/, 'Password must contain at least one special character'),
  displayName: z.string().min(1).max(255),
  role: z.enum(['PLATFORM_ADMIN', 'PLATFORM_VIEWER']),
});

export const updateUserRequestSchema = z.object({
  role: z.enum(['PLATFORM_ADMIN', 'PLATFORM_VIEWER']).optional(),
  isActive: z.boolean().optional(),
  displayName: z.string().min(1).max(255).optional(),
  mfaReset: z.boolean().optional(),
});

export const userIdParamsSchema = z.object({
  id: z.uuid(),
});

export const listUsersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const listUsersResponseSchema = z.array(platformUserProfileSchema);

export const singleUserResponseSchema = platformUserProfileSchema;

// ---------------------------------------------------------------------------
// Inferred Types
// ---------------------------------------------------------------------------

export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;
