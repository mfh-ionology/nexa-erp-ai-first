import { z } from 'zod';
import { UserRole } from '@nexa/db';

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
  role: z.enum(UserRole),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CompanySwitchParams = z.infer<typeof companySwitchParamsSchema>;
export type CompanySwitchResponse = z.infer<typeof companySwitchResponseSchema>;
