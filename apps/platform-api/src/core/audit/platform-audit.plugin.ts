// ---------------------------------------------------------------------------
// PlatformAudit Fastify Plugin — Decorates fastify.platformAudit
// Source: BR-PLT-017 (every state-changing action logged)
// ---------------------------------------------------------------------------

import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

import {
  platformAuditService,
  type PlatformAuditService,
} from './platform-audit.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    platformAudit: PlatformAuditService;
  }
}

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature requires async
const platformAuditPluginFn: FastifyPluginAsync = async (fastify) => {
  // Attach Fastify logger for structured error output
  platformAuditService.setLogger(fastify.log);

  // Decorate Fastify instance so routes can call fastify.platformAudit.log(...)
  fastify.decorate('platformAudit', platformAuditService);

  // eslint-disable-next-line @typescript-eslint/require-await
  fastify.addHook('onClose', async () => {
    platformAuditService.setLogger(null);
  });
};

export const platformAuditPlugin = fp(platformAuditPluginFn, {
  name: 'platform-audit',
});
