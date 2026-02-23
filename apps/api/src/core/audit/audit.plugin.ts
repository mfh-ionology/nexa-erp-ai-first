import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@nexa/db';
import { auditService, type AuditService } from './audit.service.js';

declare module 'fastify' {
  interface FastifyInstance {
    auditService: AuditService;
  }
}

// eslint-disable-next-line @typescript-eslint/require-await
const auditPluginFn: FastifyPluginAsync = async (fastify) => {
  // Attach the Fastify logger for structured error output
  auditService.setLogger(fastify.log);

  // Subscribe to all mapped business events so audit records are created automatically
  auditService.registerEventSubscriptions(fastify.eventBus, prisma);

  // Decorate Fastify instance for potential direct use by route handlers
  fastify.decorate('auditService', auditService);

  // eslint-disable-next-line @typescript-eslint/require-await
  fastify.addHook('onClose', async () => {
    auditService.setLogger(null);
  });
};

export const auditPlugin = fp(auditPluginFn, {
  name: 'audit',
  dependencies: ['event-bus'],
});
