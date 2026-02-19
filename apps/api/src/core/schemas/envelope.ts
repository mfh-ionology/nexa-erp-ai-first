import { z } from 'zod';

/**
 * Wraps a Zod data schema in the standard success envelope:
 * `{ success: true, data: <dataSchema> }`
 *
 * Used in Fastify route `schema.response` definitions.
 */
export function successEnvelope(dataSchema: z.ZodType) {
  return z.object({ success: z.literal(true), data: dataSchema });
}
