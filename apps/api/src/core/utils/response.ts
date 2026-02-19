import type { FastifyReply } from 'fastify';

import { AppError } from '../errors/index.js';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

export interface PaginationMeta {
  cursor?: string;
  hasMore?: boolean;
  total?: number;
}

/**
 * Send a standardised success response envelope.
 *
 * Shape: `{ success: true, data: T, meta?: PaginationMeta }`
 */
export function sendSuccess(
  reply: FastifyReply,
  data: unknown,
  meta?: PaginationMeta,
  statusCode = 200,
): FastifyReply {
  const envelope: SuccessEnvelope<unknown> = { success: true, data };
  if (meta) {
    envelope.meta = meta;
  }
  return reply.status(statusCode).send(envelope);
}

/**
 * Send a standardised error response envelope.
 *
 * - AppError instances use their own code, message, statusCode, and details.
 * - Unknown errors return 500 INTERNAL_ERROR with a generic message.
 *
 * Shape: `{ success: false, error: { code, message, details? } }`
 */
export function sendError(reply: FastifyReply, error: Error): FastifyReply {
  if (error instanceof AppError) {
    const envelope: ErrorEnvelope = {
      success: false,
      error: { code: error.code, message: error.message },
    };
    if (error.details && Object.keys(error.details).length > 0) {
      envelope.error.details = error.details;
    }
    return reply.status(error.statusCode).send(envelope);
  }

  return reply.status(500).send({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  } satisfies ErrorEnvelope);
}
