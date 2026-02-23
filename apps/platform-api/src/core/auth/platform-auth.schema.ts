import { z } from 'zod';

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  mfaCode: z
    .string()
    .length(6)
    .regex(/^\d{6}$/)
    .optional(),
});

export const mfaVerifyRequestSchema = z.object({
  mfaCode: z
    .string()
    .length(6)
    .regex(/^\d{6}$/),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

const platformUserProfileSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string(),
  role: z.enum(['PLATFORM_ADMIN', 'PLATFORM_VIEWER']),
});

export const mfaChallengeResponseSchema = z.object({
  requiresMfa: z.literal(true),
});

export const loginResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
  platformUser: platformUserProfileSchema,
});

export const loginRouteResponseSchema = z.union([loginResponseSchema, mfaChallengeResponseSchema]);

export const refreshResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number(),
});

export const logoutResponseSchema = z.object({
  message: z.string(),
});

export const mfaVerifyResponseSchema = z.object({
  message: z.string(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type MfaChallengeResponse = z.infer<typeof mfaChallengeResponseSchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;
export type MfaVerifyRequest = z.infer<typeof mfaVerifyRequestSchema>;
export type MfaVerifyResponse = z.infer<typeof mfaVerifyResponseSchema>;

// ---------------------------------------------------------------------------
// Response Envelope Helpers — re-exported from shared location
// ---------------------------------------------------------------------------

export { successEnvelope } from '../schemas/envelope.js';
