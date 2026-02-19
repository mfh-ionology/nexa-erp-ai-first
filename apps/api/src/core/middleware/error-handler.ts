import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { AppError, ValidationError } from '../errors/index.js';

/**
 * Standard error response envelope per API Contracts.
 */
interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

/**
 * Map HTTP status codes to clean API error codes per Architecture error code convention.
 * Prevents leaking Fastify internal codes (FST_ERR_*) to clients.
 */
const STATUS_TO_ERROR_CODE = new Map<number, string>([
  [400, 'BAD_REQUEST'],
  [401, 'UNAUTHORIZED'],
  [403, 'FORBIDDEN'],
  [404, 'NOT_FOUND'],
  [408, 'REQUEST_TIMEOUT'],
  [409, 'CONFLICT'],
  [413, 'PAYLOAD_TOO_LARGE'],
  [415, 'UNSUPPORTED_MEDIA_TYPE'],
  [422, 'BUSINESS_RULE_VIOLATION'],
  [423, 'ACCOUNT_LOCKED'],
  [429, 'RATE_LIMITED'],
]);

/**
 * Map a Fastify/HTTP status code to a clean API error code.
 * Falls back to INTERNAL_ERROR for unrecognised status codes.
 */
function mapStatusToErrorCode(statusCode: number): string {
  return STATUS_TO_ERROR_CODE.get(statusCode) ?? 'INTERNAL_ERROR';
}

/**
 * Build the standardised error envelope.
 */
function buildErrorEnvelope(
  code: string,
  message: string,
  details?: Record<string, string[]>,
): ErrorEnvelope {
  const envelope: ErrorEnvelope = {
    success: false,
    error: { code, message },
  };
  if (details && Object.keys(details).length > 0) {
    envelope.error.details = details;
  }
  return envelope;
}

/**
 * Global Fastify error handler plugin.
 *
 * Maps AppError subtypes to their HTTP status codes and returns the
 * standardised `{ success: false, error: { code, message, details? } }` envelope.
 *
 * Handles three categories:
 * 1. AppError instances — use their statusCode, code, message, details
 * 2. Fastify validation errors (from Zod integration) — extract ValidationError from cause
 * 3. Unknown errors — log full stack, return 500 INTERNAL_ERROR
 */
export function registerErrorHandler(fastify: FastifyInstance): void {
  fastify.setErrorHandler(
    (error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) => {
      // 1. Fastify-wrapped validation errors (from Zod validator compiler)
      //    Fastify wraps validator compiler errors in a FastifyError with .validation set,
      //    and our original ValidationError is accessible via .cause
      if ('validation' in error && error.validation) {
        const cause = (error as { cause?: unknown }).cause;
        if (cause instanceof ValidationError) {
          return reply
            .status(400)
            .send(buildErrorEnvelope(cause.code, cause.message, cause.details));
        }
        // Fallback for non-Zod validation errors (shouldn't happen, but be safe)
        return reply.status(400).send(buildErrorEnvelope('VALIDATION_ERROR', 'Validation failed'));
      }

      // 2. Direct AppError instances (thrown from route handlers / services)
      if (error instanceof AppError) {
        if (error.statusCode >= 500) {
          request.log.error({ err: error }, error.message);
        }
        return reply
          .status(error.statusCode)
          .send(buildErrorEnvelope(error.code, error.message, error.details));
      }

      // 3. Fastify errors with statusCode (e.g. 404 from Fastify itself, rate limit 429)
      //    Map to clean API error codes — never expose internal FST_ERR_* codes to clients.
      if ('statusCode' in error && typeof error.statusCode === 'number') {
        const statusCode = error.statusCode;
        if (statusCode >= 500) {
          request.log.error({ err: error }, error.message);
        }
        const code = mapStatusToErrorCode(statusCode);
        // For 5xx, use generic message to avoid leaking internals
        const message = statusCode >= 500 ? 'An unexpected error occurred' : error.message;
        return reply.status(statusCode).send(buildErrorEnvelope(code, message));
      }

      // 4. Unknown / unexpected errors — log full stack, return generic 500
      request.log.error({ err: error }, error.message);
      return reply
        .status(500)
        .send(buildErrorEnvelope('INTERNAL_ERROR', 'An unexpected error occurred'));
    },
  );
}
