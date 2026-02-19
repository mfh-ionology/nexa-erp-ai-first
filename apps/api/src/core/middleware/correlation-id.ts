import { randomUUID } from 'node:crypto';

import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
  }
}

const HEADER_NAME = 'X-Correlation-ID';
const MAX_CORRELATION_ID_LENGTH = 128;
// Allow alphanumeric, hyphens, underscores, dots, colons — safe for log output
const CORRELATION_ID_PATTERN = /^[\w.:/-]+$/;

/**
 * Validate an incoming correlation ID header value.
 * Rejects values that are too long or contain unsafe characters
 * to prevent log-injection and excessive memory usage.
 */
function isValidCorrelationId(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_CORRELATION_ID_LENGTH &&
    CORRELATION_ID_PATTERN.test(value)
  );
}

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
const correlationIdPluginFn = async (fastify: FastifyInstance): Promise<void> => {
  fastify.decorateRequest('correlationId', '');

  fastify.addHook('onRequest', (request, reply, done) => {
    const incoming = request.headers[HEADER_NAME.toLowerCase()] as string | undefined;
    // Only accept incoming correlation ID if it passes validation;
    // otherwise generate a new UUID to prevent log-injection attacks.
    const correlationId = incoming && isValidCorrelationId(incoming) ? incoming : randomUUID();
    request.correlationId = correlationId;
    void reply.header(HEADER_NAME, correlationId);
    done();
  });
};

export const correlationIdPlugin = fp(correlationIdPluginFn, {
  name: 'correlation-id',
});
