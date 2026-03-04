import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

import { loggerOptions } from './core/logger/logger.js';
import { correlationIdPlugin } from './core/plugins/correlation-id.js';
import { requestLoggerPlugin } from './core/middleware/request-logger.js';
import { registerErrorHandler } from './core/middleware/error-handler.js';
import { zodValidatorCompiler, zodSerializerCompiler } from './core/validation/zod-compiler.js';
import { healthRoutesPlugin } from './routes/admin/health.routes.js';
import { platformJwtVerifyPlugin } from './core/auth/platform-jwt-verify.hook.js';
import { platformAuthRoutesPlugin } from './core/auth/platform-auth.routes.js';
import { entitlementRoutesPlugin } from './routes/platform/entitlements.routes.js';
import { aiRoutesPlugin } from './routes/platform/ai.routes.js';
import { userRoutesPlugin } from './routes/admin/users.routes.js';
import { tenantRoutesPlugin } from './routes/admin/tenants.routes.js';
import { plansRoutesPlugin } from './routes/admin/plans.routes.js';
import { platformAuditPlugin } from './core/audit/platform-audit.plugin.js';
import { auditOnResponsePlugin } from './core/audit/audit-on-response.hook.js';
import { intelligenceRoutesPlugin } from './routes/admin/intelligence.routes.js';
import { knowledgeRoutesPlugin } from './routes/admin/knowledge.routes.js';
import { knowledgePlatformRoutesPlugin } from './routes/platform/knowledge.routes.js';
import { validateIntelligenceEnv } from './services/index.js';

const DEFAULT_RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Build and return a fully configured Platform API Fastify instance.
 *
 * Plugin registration order:
 * 1. Zod validator/serializer compilers
 * 2. Correlation ID plugin
 * 3. CORS plugin
 * 4. Helmet plugin
 * 5. Rate limiting (100 req/min per IP default, PLATFORM_RATE_LIMIT_MAX env)
 * 6. Request logger plugin
 * 7. Global error handler
 * 8. Cookie parser
 * 9. Platform JWT verify hook (Task 3)
 * 10. Platform audit middleware (Task 6)
 * 11. Routes: /admin/monitoring/health, /admin/auth/*, /admin/users, /platform/*
 */
export async function buildApp(opts: { logger?: boolean | Record<string, unknown> } = {}) {
  const fastify = Fastify({
    logger: opts.logger ?? loggerOptions,
  });

  // 1. Zod validation compilers (must be set before routes)
  fastify.setValidatorCompiler(zodValidatorCompiler);
  fastify.setSerializerCompiler(zodSerializerCompiler);

  // 2. Correlation ID (must come before request-logger)
  await fastify.register(correlationIdPlugin);

  // 3. CORS
  const corsOrigin = process.env.PLATFORM_CORS_ORIGIN ?? 'http://localhost:5174';
  if (corsOrigin === '*') {
    throw new Error(
      'PLATFORM_CORS_ORIGIN="*" is not allowed when credentials: true. ' +
        'Set an explicit origin list (e.g. "http://localhost:5174").',
    );
  }
  await fastify.register(cors, {
    origin: corsOrigin.split(','),
    credentials: true,
  });

  // 4. Security headers
  await fastify.register(helmet);

  // 5. Rate limiting
  const rateLimitMax = Number(process.env.PLATFORM_RATE_LIMIT_MAX) || DEFAULT_RATE_LIMIT_MAX;
  await fastify.register(rateLimit, {
    max: rateLimitMax,
    timeWindow: RATE_LIMIT_WINDOW_MS,
  });

  // 6. Request logger (depends on correlation-id)
  await fastify.register(requestLoggerPlugin);

  // 7. Global error handler
  registerErrorHandler(fastify);

  // 8. Cookie parser (required by auth refresh/logout)
  await fastify.register(cookie);

  // 9. Platform JWT verify hook
  await fastify.register(platformJwtVerifyPlugin);

  // 10. Platform audit middleware
  await fastify.register(platformAuditPlugin);
  await fastify.register(auditOnResponsePlugin);

  // Custom 404 handler (standard error envelope)
  fastify.setNotFoundHandler((_request, reply) => {
    void reply.status(404).send({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  // Startup validation: ensure PLATFORM_SERVICE_TOKEN is set (required for /platform/* routes)
  if (!process.env.PLATFORM_SERVICE_TOKEN) {
    fastify.log.warn(
      'PLATFORM_SERVICE_TOKEN is not set — /platform/* service routes will reject all requests',
    );
  }

  // Startup validation: intelligence pipeline env vars (Task 9.2 — graceful degradation)
  for (const warning of validateIntelligenceEnv()) {
    fastify.log.warn(warning);
  }

  // 11. Routes
  await fastify.register(healthRoutesPlugin);
  await fastify.register(platformAuthRoutesPlugin, { prefix: '/admin/auth' });
  await fastify.register(userRoutesPlugin);
  await fastify.register(tenantRoutesPlugin);
  await fastify.register(plansRoutesPlugin);
  await fastify.register(entitlementRoutesPlugin);
  await fastify.register(aiRoutesPlugin);
  await fastify.register(intelligenceRoutesPlugin);
  await fastify.register(knowledgeRoutesPlugin);
  await fastify.register(knowledgePlatformRoutesPlugin);

  return fastify;
}
