import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { webhookEventSchema, webhookResponseSchema, type WebhookEventBody } from './platform-webhook.schema.js';
import { AuthError } from '../errors/index.js';

/**
 * HMAC-hash a token to produce a fixed-length digest for timing-safe comparison.
 * Prevents leaking the expected token's length via timing side-channels.
 * The HMAC key is a static, purpose-specific constant — security comes from
 * knowing the correct PLATFORM_SERVICE_TOKEN, not from this key.
 */
const TIMING_SAFE_HMAC_KEY = 'nexa-platform-webhook-timing-safe-compare';

function hmacHash(value: string): Buffer {
  return createHmac('sha256', TIMING_SAFE_HMAC_KEY).update(value).digest();
}

/**
 * Validate the service token from Authorization header using timing-safe comparison.
 */
function validateServiceToken(request: FastifyRequest): void {
  const expectedToken = process.env.PLATFORM_SERVICE_TOKEN;
  if (!expectedToken) {
    request.log.error('PLATFORM_SERVICE_TOKEN environment variable is not set');
    throw new AuthError('UNAUTHORIZED', 'Service authentication unavailable', 401);
  }

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthError('UNAUTHORIZED', 'Service token required', 401);
  }

  const token = authHeader.slice(7);
  if (!token) {
    throw new AuthError('UNAUTHORIZED', 'Service token required', 401);
  }

  const tokenHash = hmacHash(token);
  const expectedHash = hmacHash(expectedToken);

  if (!timingSafeEqual(tokenHash, expectedHash)) {
    throw new AuthError('UNAUTHORIZED', 'Invalid service token', 401);
  }
}

/**
 * Events that require cache invalidation (any event that could affect entitlements).
 */
const CACHE_INVALIDATION_EVENTS = new Set([
  'tenant.suspended',
  'tenant.reactivated',
  'tenant.archived',
  'tenant.plan_changed',
  'tenant.modules_changed',
  'billing.enforcement_changed',
]);

const platformWebhookPluginFn = async (fastify: FastifyInstance): Promise<void> => {
  fastify.post('/webhooks/platform', {
    schema: {
      body: webhookEventSchema,
      response: {
        200: webhookResponseSchema,
      },
    },
    // Auth runs as onRequest — before body parsing and schema validation
    onRequest: async (request: FastifyRequest) => {
      validateServiceToken(request);
    },
  }, async (request, reply) => {
    const { event, timestamp, payload } = request.body as WebhookEventBody;
    const tenantId = typeof payload.tenantId === 'string' && payload.tenantId.length > 0
      ? payload.tenantId
      : undefined;

    // 2. Route event to appropriate handler
    if (CACHE_INVALIDATION_EVENTS.has(event)) {
      if (!tenantId) {
        request.log.warn({ event, payload }, 'Platform webhook: cache-invalidation event missing tenantId in payload');
      } else if (!fastify.platformClient) {
        request.log.warn({ event, tenantId }, 'Platform webhook: PlatformClient not configured — cache invalidation skipped');
      } else {
        fastify.platformClient.invalidateCache(tenantId);
      }
      request.log.info({ event, tenantId, timestamp }, `Platform webhook: ${event}`);
    } else if (event === 'tenant.quota_warning') {
      request.log.warn({ event, tenantId, timestamp, payload }, 'Platform webhook: AI quota warning');
    } else if (event === 'tenant.quota_exceeded') {
      request.log.warn({ event, tenantId, timestamp, payload }, 'Platform webhook: AI quota exceeded');
    } else {
      // Unknown event — log warning, return 200 for forward compatibility
      request.log.warn({ event, tenantId, timestamp }, `Platform webhook: unknown event "${event}"`);
    }

    // 3. Fast acknowledgement
    return reply.status(200).send({ success: true as const });
  });
};

export const platformWebhookPlugin = fp(platformWebhookPluginFn, {
  name: 'platform-webhook-routes',
  dependencies: ['platform-client'],
});
