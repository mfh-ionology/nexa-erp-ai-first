import { z } from 'zod';

/**
 * Standard error response envelope per API Contracts.
 * Single source of truth — imported by error-handler.ts and response.ts.
 */
export interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    messageKey?: string;
    messageParams?: Record<string, string>;
    details?: Record<string, string[]>;
  };
}

/**
 * Wraps a Zod data schema in the standard success envelope:
 * `{ success: true, data: <dataSchema> }`
 *
 * Used in Fastify route `schema.response` definitions.
 */
export function successEnvelope(dataSchema: z.ZodType) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    _fieldMeta: z.record(z.string(), z.string()).optional(),
  });
}
