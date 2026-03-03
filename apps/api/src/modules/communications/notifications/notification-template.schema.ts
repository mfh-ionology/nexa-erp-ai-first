import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums (mirror Prisma enums for Zod validation)
// ---------------------------------------------------------------------------

const notificationChannelEnum = z.enum(['IN_APP', 'EMAIL', 'PUSH']);
const notificationPriorityEnum = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createTemplateSchema = z.object({
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  eventName: z.string().min(1).max(200),
  titleTemplate: z.string().min(1).max(500),
  bodyTemplate: z.string().min(1).max(10000),
  defaultChannels: z.array(notificationChannelEnum).min(1),
  defaultPriority: notificationPriorityEnum.optional(),
  actionUrl: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const updateTemplateSchema = z.object({
  code: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  eventName: z.string().min(1).max(200).optional(),
  titleTemplate: z.string().min(1).max(500).optional(),
  bodyTemplate: z.string().min(1).max(10000).optional(),
  defaultChannels: z.array(notificationChannelEnum).min(1).optional(),
  defaultPriority: notificationPriorityEnum.optional(),
  actionUrl: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const templateListQuerySchema = z.object({
  isActive: z.union([z.boolean(), z.string().transform((v) => v === 'true')]).optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const templateParamsSchema = z.object({
  id: z.uuid(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const templateResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  eventName: z.string(),
  titleTemplate: z.string(),
  bodyTemplate: z.string(),
  defaultChannels: z.array(notificationChannelEnum),
  defaultPriority: notificationPriorityEnum,
  actionUrl: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const templateListResponseSchema = z.object({
  items: z.array(templateResponseSchema),
  meta: z.object({
    total: z.number().int(),
    limit: z.number().int(),
    offset: z.number().int(),
  }),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type TemplateListQuery = z.infer<typeof templateListQuerySchema>;
export type TemplateParams = z.infer<typeof templateParamsSchema>;
export type TemplateResponse = z.infer<typeof templateResponseSchema>;
