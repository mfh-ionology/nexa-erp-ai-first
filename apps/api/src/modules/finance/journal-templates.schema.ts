import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum constants
// ---------------------------------------------------------------------------

export const TEMPLATE_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'] as const;

// ---------------------------------------------------------------------------
// Template line schema (stored as JSON in templateLines column)
// ---------------------------------------------------------------------------

const templateLineSchema = z.object({
  accountCode: z.string().min(2).max(20),
  debit: z.number().min(0).default(0),
  credit: z.number().min(0).default(0),
  description: z.string().max(500).optional(),
  vatCode: z.string().max(20).optional(),
});

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(255),
  description: z.string().max(500).optional(),
  frequency: z.enum(TEMPLATE_FREQUENCIES),
  templateLines: z.array(templateLineSchema).min(2, 'Template must have at least 2 lines'),
  nextDueDate: z.coerce.date().optional(),
});

export const updateTemplateSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(500).nullable().optional(),
    frequency: z.enum(TEMPLATE_FREQUENCIES).optional(),
    templateLines: z
      .array(templateLineSchema)
      .min(2, 'Template must have at least 2 lines')
      .optional(),
    nextDueDate: z.coerce.date().nullable().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided for update',
  });

export const executeTemplateSchema = z.object({
  transactionDate: z.coerce.date().optional(),
  periodId: z.uuid(),
});

// ---------------------------------------------------------------------------
// Params & Query Schemas
// ---------------------------------------------------------------------------

export const templateParamsSchema = z.object({
  id: z.uuid(),
});

export const listTemplatesQuerySchema = z.object({
  frequency: z.enum(TEMPLATE_FREQUENCIES).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

const templateLineResponseSchema = z.object({
  accountCode: z.string(),
  debit: z.number(),
  credit: z.number(),
  description: z.string().optional().nullable(),
  vatCode: z.string().optional().nullable(),
});

export const templateListItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  frequency: z.enum(TEMPLATE_FREQUENCIES),
  isActive: z.boolean(),
  nextDueDate: z.string().nullable(),
  lastExecutedAt: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const templateDetailSchema = templateListItemSchema.extend({
  templateLines: z.array(templateLineResponseSchema),
  createdBy: z.string(),
  updatedBy: z.string(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type ExecuteTemplateInput = z.infer<typeof executeTemplateSchema>;
export type ListTemplatesQuery = z.infer<typeof listTemplatesQuerySchema>;
export type TemplateLine = z.infer<typeof templateLineSchema>;
