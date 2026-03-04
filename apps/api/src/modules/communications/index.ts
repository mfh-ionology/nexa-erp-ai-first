// ---------------------------------------------------------------------------
// Communications Module Plugin — E9-1 / E10-1
// Registers notification event bus subscribers, notification routes,
// email CRUD routes, email send BullMQ queue + worker, and email events.
// ---------------------------------------------------------------------------

import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@nexa/db';

import { registerNotificationSubscribers } from './notifications/notification.events.js';
import { notificationRoutesPlugin } from './notifications/notification.routes.js';
import { notificationTemplateRoutesPlugin } from './notifications/notification-template.routes.js';
import { NotificationWebSocketHandler } from './notifications/notification.websocket.js';
import { emailRoutesPlugin } from './email/email.routes.js';
import { emailTemplateRoutesPlugin } from './email/email-template.routes.js';
import {
  documentEmailRoutesPlugin,
  batchStatementEmailRoutesPlugin,
} from './email/document-email.routes.js';
import { initEmailSendQueue, getEmailSendQueue } from './email/email-send.queue.js';
import { createEmailSendWorker, type EmailSendWorkerHandle } from './email/email-send.worker.js';
import { registerEmailEventSubscribers } from './email/email.events.js';
import { BatchStatementEmailService } from './email/batch-statement-email.service.js';
import {
  createBatchStatementWorker,
  type BatchStatementWorkerHandle,
} from './email/batch-statement-email.worker.js';
import { DocumentEmailService } from './email/document-email.service.js';
import { EmailService } from './email/email.service.js';
import { EmailQueueService } from './email/email-queue.service.js';
import { EmailTemplateService } from './email/email-template.service.js';
import { EmailTemplateEngineService } from './email/email-template-engine.service.js';
import { parseRedisUrl } from '../../core/events/redis-connection.js';

declare module 'fastify' {
  interface FastifyInstance {
    notificationWs: NotificationWebSocketHandler;
    batchStatementEmailService: BatchStatementEmailService;
    documentEmailService: DocumentEmailService;
  }
}

const communicationsModulePluginFn: FastifyPluginAsync = async (fastify) => {
  // Register event bus subscribers for notification-triggering events
  registerNotificationSubscribers(fastify.eventBus, prisma, fastify.log);

  // Register notification routes
  await fastify.register(notificationRoutesPlugin);
  await fastify.register(notificationTemplateRoutesPlugin);

  // Register email routes (E10-1 — Task 9.2)
  await fastify.register(emailRoutesPlugin);

  // Register email template routes (E10-2 — Task 6.3)
  await fastify.register(emailTemplateRoutesPlugin);

  // ── E10-3 Task 9.1: Shared DocumentEmailService + Batch statement service ──
  const emailService = new EmailService(prisma, fastify.log, fastify.eventBus);
  const emailQueueService = new EmailQueueService(prisma, fastify.log);
  const templateEngine = new EmailTemplateEngineService(fastify.log);
  const templateService = new EmailTemplateService(prisma, fastify.log, templateEngine);
  const documentEmailService = new DocumentEmailService(
    prisma,
    fastify.log,
    fastify.eventBus,
    emailService,
    emailQueueService,
    templateService,
    templateEngine,
  );
  fastify.decorate('documentEmailService', documentEmailService);

  const batchStatementService = new BatchStatementEmailService(fastify.log);
  fastify.decorate('batchStatementEmailService', batchStatementService);

  // Register document-to-email routes (E10-3 — Task 3.3)
  await fastify.register(documentEmailRoutesPlugin);

  // Register batch statement route separately (E10-3 — Task 4.4)
  await fastify.register(batchStatementEmailRoutesPlugin);

  // Register email event subscribers (E10-1 — Task 9.3)
  registerEmailEventSubscribers(fastify.eventBus, prisma, fastify.log);

  // ── E10-1 Task 9.1: Email send queue + worker ──
  let emailSendHandle: EmailSendWorkerHandle | null = null;
  let batchStatementHandle: BatchStatementWorkerHandle | null = null;

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const connection = parseRedisUrl(redisUrl);

      // Initialise the BullMQ queue (makes enqueueEmailSend() functional)
      initEmailSendQueue(connection, fastify.log);

      // Start the worker that processes email sending jobs
      emailSendHandle = createEmailSendWorker(prisma, fastify.log, connection, fastify.eventBus);

      // ── E10-3: Batch statement email queue + worker ──
      // Initialise the batch statement queue
      batchStatementService.initQueue(connection);

      // Start the batch statement worker (uses the shared DocumentEmailService)
      batchStatementHandle = createBatchStatementWorker(
        prisma,
        fastify.log,
        connection,
        documentEmailService,
        fastify.eventBus,
      );

      fastify.log.info(
        '[CommunicationsModule] Email send queue, worker, and batch statement worker initialised',
      );
    } catch (err) {
      fastify.log.warn(
        { error: (err as Error).message },
        '[CommunicationsModule] Failed to initialise email send queue — email delivery disabled',
      );
    }
  } else {
    fastify.log.warn('[CommunicationsModule] REDIS_URL not set — email send queue disabled');
  }

  // Attach notification WebSocket handler to the HTTP server (E9-2)
  const notificationWs = new NotificationWebSocketHandler(
    fastify.log as unknown as import('pino').Logger,
  );
  notificationWs.attach(fastify.server);
  fastify.decorate('notificationWs', notificationWs);

  // ── Graceful shutdown (E10-1 — Task 9.4) ──
  fastify.addHook('onClose', async () => {
    // Close email send worker first (stop processing jobs), then close cached SMTP transports
    if (emailSendHandle) {
      try {
        await emailSendHandle.worker.close();
      } catch (err) {
        fastify.log.warn(
          { error: (err as Error).message },
          '[CommunicationsModule] Error closing email send worker',
        );
      }
      emailSendHandle.closeTransports();
    }

    // Close batch statement worker (E10-3)
    if (batchStatementHandle) {
      try {
        await batchStatementHandle.worker.close();
      } catch (err) {
        fastify.log.warn(
          { error: (err as Error).message },
          '[CommunicationsModule] Error closing batch statement worker',
        );
      }
    }

    // Close batch statement queue (E10-3)
    const batchQueue = batchStatementService.getQueue();
    if (batchQueue) {
      try {
        await batchQueue.close();
      } catch (err) {
        fastify.log.warn(
          { error: (err as Error).message },
          '[CommunicationsModule] Error closing batch statement queue',
        );
      }
    }

    // Close email send queue
    const emailQueue = getEmailSendQueue();
    if (emailQueue) {
      try {
        await emailQueue.client;
      } catch {
        // Connection never established — safe to ignore
      }
      try {
        await emailQueue.close();
      } catch (err) {
        fastify.log.warn(
          { error: (err as Error).message },
          '[CommunicationsModule] Error closing email send queue',
        );
      }
    }

    // Close notification WebSocket
    await notificationWs.close();
  });

  fastify.log.info(
    '[CommunicationsModule] Notification + email event subscribers, routes, and WebSocket registered',
  );
};

export const communicationsModulePlugin = fp(communicationsModulePluginFn, {
  name: 'communications-module',
  dependencies: ['event-bus', 'notification-dispatch'],
});
