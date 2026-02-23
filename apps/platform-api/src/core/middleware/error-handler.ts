import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { AppError, ValidationError } from '../errors/app-error.js';

interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

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
  [429, 'RATE_LIMITED'],
]);

function mapStatusToErrorCode(statusCode: number): string {
  return STATUS_TO_ERROR_CODE.get(statusCode) ?? 'INTERNAL_ERROR';
}

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

export function registerErrorHandler(fastify: FastifyInstance): void {
  fastify.setErrorHandler(
    (error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) => {
      // 1. Fastify-wrapped validation errors (from Zod validator compiler)
      if ('validation' in error && error.validation) {
        const cause = (error as { cause?: unknown }).cause;
        if (cause instanceof ValidationError) {
          return reply
            .status(400)
            .send(buildErrorEnvelope(cause.code, cause.message, cause.details));
        }
        return reply.status(400).send(buildErrorEnvelope('VALIDATION_ERROR', 'Validation failed'));
      }

      // 2. Direct AppError instances
      if (error instanceof AppError) {
        if (error.statusCode >= 500) {
          request.log.error({ err: error }, error.message);
        }
        return reply
          .status(error.statusCode)
          .send(buildErrorEnvelope(error.code, error.message, error.details));
      }

      // 3. Fastify errors with statusCode
      if ('statusCode' in error && typeof error.statusCode === 'number') {
        const statusCode = error.statusCode;
        if (statusCode >= 500) {
          request.log.error({ err: error }, error.message);
        }
        const code = mapStatusToErrorCode(statusCode);
        const message = statusCode >= 500 ? 'An unexpected error occurred' : error.message;
        return reply.status(statusCode).send(buildErrorEnvelope(code, message));
      }

      // 4. Unknown / unexpected errors
      request.log.error({ err: error }, error.message);
      return reply
        .status(500)
        .send(buildErrorEnvelope('INTERNAL_ERROR', 'An unexpected error occurred'));
    },
  );
}
