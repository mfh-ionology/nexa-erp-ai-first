import { z } from 'zod';

// ---------------------------------------------------------------------------
// Status enum
// ---------------------------------------------------------------------------

export const VAT_RETURN_STATUSES = [
  'DRAFT',
  'CALCULATED',
  'SUBMITTED',
  'ACCEPTED',
  'REJECTED',
] as const;

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createVatReturnSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
});

// ---------------------------------------------------------------------------
// Params & Query Schemas
// ---------------------------------------------------------------------------

export const vatReturnParamsSchema = z.object({
  id: z.uuid(),
});

export const listVatReturnsQuerySchema = z.object({
  status: z.enum(VAT_RETURN_STATUSES).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const vatReturnListItemSchema = z.object({
  id: z.uuid(),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  status: z.enum(VAT_RETURN_STATUSES),
  box1: z.number(),
  box2: z.number(),
  box3: z.number(),
  box4: z.number(),
  box5: z.number(),
  box6: z.number(),
  box7: z.number(),
  box8: z.number(),
  box9: z.number(),
  calculatedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  createdBy: z.string(),
});

export const vatReturnDetailSchema = vatReturnListItemSchema.extend({
  submittedAt: z.coerce.date().nullable(),
  submittedBy: z.string().nullable(),
  hmrcSubmissionId: z.string().nullable(),
  hmrcResponse: z.unknown().nullable(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateVatReturnInput = z.infer<typeof createVatReturnSchema>;
export type ListVatReturnsQuery = z.infer<typeof listVatReturnsQuerySchema>;
export type VatReturnListItem = z.infer<typeof vatReturnListItemSchema>;
export type VatReturnDetail = z.infer<typeof vatReturnDetailSchema>;
