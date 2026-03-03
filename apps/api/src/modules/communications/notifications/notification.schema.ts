import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enums (mirror Prisma enums for Zod validation)
// ---------------------------------------------------------------------------

const notificationStatusEnum = z.enum(['PENDING', 'DELIVERED', 'READ', 'DISMISSED', 'FAILED']);
const notificationChannelEnum = z.enum(['IN_APP', 'EMAIL', 'PUSH']);
const notificationPriorityEnum = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);

// ---------------------------------------------------------------------------
// Request Schemas
// ---------------------------------------------------------------------------

export const notificationListQuerySchema = z.object({
  status: notificationStatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const notificationParamsSchema = z.object({
  id: z.uuid(),
});

export const markReadSchema = z.object({}).optional();

export const dismissSchema = z.object({}).optional();

// ---------------------------------------------------------------------------
// Response Schemas
// ---------------------------------------------------------------------------

export const notificationResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  templateId: z.string().nullable(),
  title: z.string(),
  body: z.string(),
  channel: notificationChannelEnum,
  priority: notificationPriorityEnum,
  actionUrl: z.string().nullable(),
  entityType: z.string().nullable(),
  entityId: z.string().nullable(),
  status: notificationStatusEnum,
  deliveredAt: z.date().nullable(),
  readAt: z.date().nullable(),
  dismissedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const notificationListResponseSchema = z.object({
  items: z.array(notificationResponseSchema),
  meta: z.object({
    cursor: z.string().nullable(),
    hasMore: z.boolean(),
  }),
});

export const unreadCountResponseSchema = z.object({
  count: z.number().int(),
});

export const markAllReadResponseSchema = z.object({
  updated: z.number().int(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript Types
// ---------------------------------------------------------------------------

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type NotificationParams = z.infer<typeof notificationParamsSchema>;
export type NotificationResponse = z.infer<typeof notificationResponseSchema>;
