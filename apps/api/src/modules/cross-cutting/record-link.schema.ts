import { z } from 'zod';
import { RecordLinkType } from '@nexa/db';

// ---------------------------------------------------------------------------
// Enums — derived from Prisma enum (single source of truth)
// ---------------------------------------------------------------------------

const recordLinkTypeValues = Object.values(RecordLinkType) as [string, ...string[]];
const recordLinkTypeEnum = z.enum(recordLinkTypeValues);

const directionEnum = z.enum(['outgoing', 'incoming', 'all']);

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const createRecordLinkSchema = z.object({
  sourceEntityType: z.string().min(1).max(100),
  sourceEntityId: z.uuid(),
  targetEntityType: z.string().min(1).max(100),
  targetEntityId: z.uuid(),
  linkType: recordLinkTypeEnum,
  description: z.string().max(500).optional(),
});

export const recordLinkListQuerySchema = z.object({
  entityType: z.string().min(1),
  entityId: z.uuid(),
  linkType: recordLinkTypeEnum.optional(),
  direction: directionEnum.optional().default('all'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const recordLinkParamsSchema = z.object({
  id: z.uuid(),
});

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const recordLinkResponseSchema = z.object({
  id: z.uuid(),
  sourceEntityType: z.string(),
  sourceEntityId: z.string(),
  targetEntityType: z.string(),
  targetEntityId: z.string(),
  linkType: recordLinkTypeEnum,
  isSystemGenerated: z.boolean(),
  description: z.string().nullable(),
  direction: directionEnum.exclude(['all']).optional(),
  createdBy: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const recordLinkListResponseSchema = z.object({
  items: z.array(recordLinkResponseSchema),
  total: z.number().int(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type CreateRecordLinkInput = z.infer<typeof createRecordLinkSchema>;
export type RecordLinkListQuery = z.infer<typeof recordLinkListQuerySchema>;
export type RecordLinkParams = z.infer<typeof recordLinkParamsSchema>;
