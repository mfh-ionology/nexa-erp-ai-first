// ---------------------------------------------------------------------------
// Communications Module Plugin — E9-1
// Registers notification event bus subscribers and notification routes.
// ---------------------------------------------------------------------------

import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@nexa/db';

import { registerNotificationSubscribers } from './notifications/notification.events.js';
import { notificationRoutesPlugin } from './notifications/notification.routes.js';
import { notificationTemplateRoutesPlugin } from './notifications/notification-template.routes.js';
import { NotificationWebSocketHandler } from './notifications/notification.websocket.js';

declare module 'fastify' {
  interface FastifyInstance {
    notificationWs: NotificationWebSocketHandler;
  }
}

const communicationsModulePluginFn: FastifyPluginAsync = async (fastify) => {
  // Register event bus subscribers for notification-triggering events
  registerNotificationSubscribers(fastify.eventBus, prisma, fastify.log);

  // Register notification routes
  await fastify.register(notificationRoutesPlugin);
  await fastify.register(notificationTemplateRoutesPlugin);

  // Attach notification WebSocket handler to the HTTP server (E9-2)
  const notificationWs = new NotificationWebSocketHandler(fastify.log);
  notificationWs.attach(fastify.server);
  fastify.decorate('notificationWs', notificationWs);

  // Graceful shutdown
  fastify.addHook('onClose', async () => {
    await notificationWs.close();
  });

  fastify.log.info(
    '[CommunicationsModule] Notification event subscribers, routes, and WebSocket registered',
  );
};

export const communicationsModulePlugin = fp(communicationsModulePluginFn, {
  name: 'communications-module',
  dependencies: ['event-bus', 'notification-dispatch'],
});
