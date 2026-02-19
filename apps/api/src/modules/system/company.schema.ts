import { z } from 'zod';

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const companySwitchParamsSchema = z.object({
  id: z.uuid(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const companySwitchResponseSchema = z.object({
  companyId: z.uuid(),
  companyName: z.string(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF', 'VIEWER']),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CompanySwitchParams = z.infer<typeof companySwitchParamsSchema>;
export type CompanySwitchResponse = z.infer<typeof companySwitchResponseSchema>;
