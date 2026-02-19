import { z } from 'zod';

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  mfaToken: z
    .string()
    .length(6)
    .regex(/^\d{6}$/)
    .optional(),
});

export const mfaVerifyRequestSchema = z.object({
  token: z
    .string()
    .length(6)
    .regex(/^\d{6}$/),
});

export const mfaResetRequestSchema = z.object({
  userId: z.uuid(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

const userProfileSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF', 'VIEWER']),
  enabledModules: z.array(z.string()),
  tenantId: z.string(),
  tenantName: z.string(),
  mfaEnabled: z.boolean(),
});

export const mfaChallengeResponseSchema = z.object({
  requiresMfa: z.literal(true),
});

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(), // Sent as httpOnly cookie, not in body
  expiresIn: z.number(),
  user: userProfileSchema,
});

export const loginRouteResponseSchema = z.union([loginResponseSchema, mfaChallengeResponseSchema]);

export const refreshResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
});

export const logoutResponseSchema = z.object({
  message: z.string(),
});

export const mfaSetupResponseSchema = z.object({
  secret: z.string(),
  uri: z.string(),
});

export const mfaVerifyResponseSchema = z.object({
  message: z.string(),
});

export const mfaResetResponseSchema = z.object({
  message: z.string(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type MfaChallengeResponse = z.infer<typeof mfaChallengeResponseSchema>;
export type UserProfile = z.infer<typeof userProfileSchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;
export type MfaSetupResponse = z.infer<typeof mfaSetupResponseSchema>;
export type MfaVerifyRequest = z.infer<typeof mfaVerifyRequestSchema>;
export type MfaVerifyResponse = z.infer<typeof mfaVerifyResponseSchema>;
export type MfaResetRequest = z.infer<typeof mfaResetRequestSchema>;
export type MfaResetResponse = z.infer<typeof mfaResetResponseSchema>;

// ---------------------------------------------------------------------------
// Response Envelope Helpers — re-exported from shared location
// ---------------------------------------------------------------------------

export { successEnvelope } from '../schemas/envelope.js';
