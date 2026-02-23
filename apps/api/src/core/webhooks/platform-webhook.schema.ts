import { z } from 'zod';

export const webhookEventSchema = z.object({
  event: z.string().min(1),
  timestamp: z.string().datetime(),
  payload: z.record(z.string(), z.unknown()),
});

export type WebhookEventBody = z.infer<typeof webhookEventSchema>;

export const webhookResponseSchema = z.object({
  success: z.literal(true),
});
