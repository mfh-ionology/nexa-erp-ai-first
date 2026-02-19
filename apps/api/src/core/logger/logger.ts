import type { FastifyBaseLogger } from 'fastify';
import type { LoggerOptions } from 'pino';

/**
 * Structured log context fields per Architecture Communication Patterns -- Logging.
 *
 * correlationId, tenantId, userId are injected per-request via child loggers.
 * module, entity, entityId, action, isAiAction are set by call-site code.
 */
export interface LogContext {
  correlationId?: string;
  tenantId?: string;
  userId?: string;
  module?: string;
  entity?: string;
  entityId?: string;
  action?: string;
  isAiAction?: boolean;
}

const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';

/**
 * Pino logger options for the Fastify constructor.
 *
 * Fastify 5 embeds Pino — pass these options to `Fastify({ logger: loggerOptions })`.
 * Do NOT create a standalone Pino instance for the server.
 */
export const loggerOptions: LoggerOptions = {
  level: LOG_LEVEL,
  // Rename Pino's default `msg` key to `message` per architecture spec
  messageKey: 'message',
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  // Redact sensitive fields from ever appearing in logs
  redact: ['req.headers.authorization', 'req.headers.cookie'],
};

/**
 * Create a child logger with structured context fields.
 *
 * Usage in route handlers / services:
 * ```ts
 * const log = createChildLogger(request.log, { module: 'ar', entity: 'invoice', entityId: 'inv-123' });
 * log.info('Invoice approved');
 * ```
 */
export function createChildLogger(
  parent: FastifyBaseLogger,
  context: LogContext,
): FastifyBaseLogger {
  return parent.child(context);
}
