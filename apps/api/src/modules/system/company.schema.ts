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

export const companyItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  baseCurrencyCode: z.string(),
  isDefault: z.boolean(),
});

export const companyListResponseSchema = z.array(companyItemSchema);

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CompanySwitchParams = z.infer<typeof companySwitchParamsSchema>;
export type CompanySwitchResponse = z.infer<typeof companySwitchResponseSchema>;
export type CompanyItem = z.infer<typeof companyItemSchema>;
