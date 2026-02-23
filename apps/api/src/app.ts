import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { loggerOptions } from './core/logger/logger.js';
import { correlationIdPlugin } from './core/middleware/correlation-id.js';
import { requestLoggerPlugin } from './core/middleware/request-logger.js';
import { registerErrorHandler } from './core/middleware/error-handler.js';
import {
  zodValidatorCompiler,
  zodSerializerCompiler,
  zodSwaggerTransform,
} from './core/validation/index.js';
import { healthRoutesPlugin } from './core/routes/health.routes.js';
import { jwtVerifyPlugin } from './core/auth/jwt-verify.hook.js';
import { authRoutesPlugin } from './core/auth/auth.routes.js';
import { companyContextPlugin } from './core/middleware/company-context.js';
import { systemModulePlugin } from './modules/system/index.js';
import { registerPermissionCacheListeners } from './core/rbac/index.js';
import { eventBusPlugin } from './core/events/event-bus.plugin.js';
import { auditPlugin } from './core/audit/audit.plugin.js';
import { deadLetterPlugin } from './core/events/dead-letter.plugin.js';
import { platformClientPlugin } from './core/platform/platform-client.plugin.js';
import { platformWebhookPlugin } from './core/webhooks/platform-webhook.routes.js';
import { aiPlugin } from './ai/index.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

const DEFAULT_RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Build and return a fully configured Fastify instance.
 *
 * Plugin registration order:
 * 1. Pino logger (via Fastify constructor)
 * 2. Correlation ID middleware
 * 3. @fastify/cors
 * 4. @fastify/helmet
 * 5. @fastify/rate-limit
 * 6. Request logger middleware
 * 7. Zod validator / serializer compilers
 * 8. Global error handler
 * 9. @fastify/cookie
 * 10. JWT verification hook
 * 11. Company context middleware (depends on JWT verify)
 * 12. Event bus plugin (decorates fastify.eventBus — before routes)
 * 13. Audit trail plugin (subscribes to eventBus — after event-bus, before routes)
 * 14. Dead-letter plugin (retry + DLQ — after event-bus and audit, before routes)
 * 15. @fastify/swagger
 * 16. @fastify/swagger-ui
 * 17. AI module plugin (optional — degrades gracefully if config missing)
 * 18. Routes (health, auth, system)
 */
export async function buildApp(opts: { logger?: boolean | Record<string, unknown> } = {}) {
  const fastify = Fastify({
    logger: opts.logger ?? loggerOptions,
  });

  // -- Zod validation compilers (must be set before routes)
  fastify.setValidatorCompiler(zodValidatorCompiler);
  fastify.setSerializerCompiler(zodSerializerCompiler);

  // -- Correlation ID (must come before request-logger)
  await fastify.register(correlationIdPlugin);

  // -- CORS
  const corsOrigin = process.env.CORS_ORIGIN ?? '*';
  await fastify.register(cors, {
    origin: corsOrigin === '*' ? true : corsOrigin.split(','),
    credentials: corsOrigin !== '*',
  });

  // -- Security headers
  await fastify.register(helmet);

  // -- Rate limiting (100 req/min per IP by default)
  const rateLimitMax = Number(process.env.RATE_LIMIT_MAX) || DEFAULT_RATE_LIMIT_MAX;
  await fastify.register(rateLimit, {
    max: rateLimitMax,
    timeWindow: RATE_LIMIT_WINDOW_MS,
  });

  // -- Request logger (depends on correlation-id)
  await fastify.register(requestLoggerPlugin);

  // -- Global error handler
  registerErrorHandler(fastify);

  // -- Cookie parser (required by auth refresh/logout)
  await fastify.register(cookie);

  // -- JWT verification hook (after cookie, before routes)
  await fastify.register(jwtVerifyPlugin);

  // -- Company context middleware (after JWT verify — depends on userId/tenantId)
  await fastify.register(companyContextPlugin);

  // -- Event bus (after logger setup, before routes — all route handlers can access request.server.eventBus)
  await fastify.register(eventBusPlugin);

  // -- Audit trail (subscribes to eventBus events — must come after event-bus, before routes)
  await fastify.register(auditPlugin);

  // -- Dead-letter queue + retry (depends on event-bus — after audit, before routes)
  await fastify.register(deadLetterPlugin);

  // -- Platform Client SDK (singleton — before webhook route)
  await fastify.register(platformClientPlugin);

  // -- Platform webhook listener (service-token auth, bypasses JWT)
  await fastify.register(platformWebhookPlugin);

  // -- OpenAPI / Swagger
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Nexa ERP API',
        description: 'AI-first ERP for UK SMEs',
        version: pkg.version,
      },
      servers: [{ url: '/' }],
    },
    transform: zodSwaggerTransform,
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/documentation',
  });

  // -- Custom 404 handler (ensures 404s follow the standard error envelope)
  fastify.setNotFoundHandler((_request, reply) => {
    void reply.status(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  // -- AI module (optional — degrades gracefully if AI Gateway config missing)
  await fastify.register(aiPlugin, { prefix: '/ai' });

  // -- Routes
  await fastify.register(healthRoutesPlugin);
  await fastify.register(authRoutesPlugin, { prefix: '/auth' });
  await fastify.register(systemModulePlugin, { prefix: '/system' });

  // -- Permission cache invalidation event listeners (E2b-4)
  registerPermissionCacheListeners(fastify.eventBus);

  return fastify;
}
