// ---------------------------------------------------------------------------
// Unified System module plugin — E12-1 Task 8
// Registers all system sub-plugins under the /system prefix.
// Creates document template engine service instances, wires lifecycle hooks,
// initialises BullMQ queue + worker for batch PDF generation, and decorates
// Fastify with services for route handler access.
//
// Route layout:
//   GET  /system/companies              (list accessible companies)
//   POST /system/companies/:id/switch   (company switch)
//   GET|POST|PATCH /system/company-profile
//   GET|POST|PATCH|DELETE /system/users[/:id[/role|/modules]]
//   GET /system/resources
//   GET|POST|PATCH|DELETE /system/access-groups[/:id[/permissions]]
//   GET|PUT /system/users/:id/access-groups
//   GET /system/my-permissions
//   GET /system/audit-log
//   GET /system/audit-log/:entityType/:entityId
//   GET /system/dead-letter-queue
//   POST /system/dead-letter-queue/:id/reprocess
//   GET|POST|PATCH|DELETE /system/document-templates[/:id[/versions[/:versionId]]]
//   POST /system/document-templates/:id/preview (template preview PDF)
//   POST /system/documents/generate        (single PDF generation)
//   POST /system/documents/batch-generate  (batch PDF generation)
//   GET  /system/documents/batch-generate/:batchJobId/status (batch status)
//   GET|PUT /system/print-preferences        (user print preferences)
//   GET|PUT /system/print-preferences/company-defaults (company defaults, ADMIN)
//   DELETE  /system/print-preferences/reset  (reset user preferences)
//   GET    /system/favourite-pages             (list user favourite pages)
//   POST   /system/favourite-pages             (add a favourite page pin)
//   DELETE /system/favourite-pages/:id         (remove a favourite page pin)
//   POST   /system/favourite-pages/unpin-by-path (remove by path)
//   PUT    /system/favourite-pages/reorder     (reorder favourite page pins)
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import type { Logger } from 'pino';
import { prisma } from '@nexa/db';

import { companyRoutesPlugin } from './company.routes.js';
import { userRoutesPlugin } from './user.routes.js';
import { companyProfileRoutesPlugin } from './company-profile.routes.js';
import { resourceRoutesPlugin } from './resources.routes.js';
import { accessGroupRoutesPlugin } from './access-groups.routes.js';
import { userAccessGroupRoutesPlugin } from './user-access-groups.routes.js';
import { myPermissionsRoutesPlugin } from './my-permissions.routes.js';
import { auditLogRoutesPlugin } from './audit-log.routes.js';
import { deadLetterRoutesPlugin } from './dead-letter.routes.js';
import { documentGenerationRoutesPlugin } from './routes/document-generation.routes.js';

// E12-1 Task 8 — Document template engine services
import { TemplateCompilerService } from './services/template-compiler.service.js';
import { PdfGeneratorService } from './services/pdf-generator.service.js';
import { DocumentTemplateService } from './services/document-template.service.js';
import { DocumentDataLoaderService } from './services/document-data-loader.service.js';
import { initPdfBatchQueue, getPdfBatchQueue } from './queues/pdf-batch-generate.queue.js';
import {
  createPdfBatchWorker,
  type PdfBatchWorkerHandle,
} from './workers/pdf-batch-generate.worker.js';
import { parseRedisUrl } from '../../core/events/redis-connection.js';

// E12-2 Task 5 — Sample data generator for template preview
import { SampleDataGeneratorService } from './services/sample-data-generator.service.js';
// E12-2 Tasks 3, 4 & 5 — Document template CRUD, version management, preview routes
import { documentTemplateRoutesPlugin } from './routes/document-template.routes.js';

// E13-1 Task 3 — Print preference routes
import { printPreferenceRoutesPlugin } from './routes/print-preference.routes.js';

// Nav Redesign — Favourite pages routes
import { favouritePagesRoutesPlugin } from './favourite-pages.routes.js';

// ---------------------------------------------------------------------------
// Fastify type augmentation — expose document template services (Task 8.5)
// ---------------------------------------------------------------------------

declare module 'fastify' {
  interface FastifyInstance {
    templateCompilerService: TemplateCompilerService;
    pdfGeneratorService: PdfGeneratorService;
    documentTemplateService: DocumentTemplateService;
    documentDataLoaderService: DocumentDataLoaderService;
    sampleDataGeneratorService: SampleDataGeneratorService;
  }
}

// ---------------------------------------------------------------------------
// System module plugin
// ---------------------------------------------------------------------------

async function systemModule(fastify: FastifyInstance): Promise<void> {
  // =========================================================================
  // Task 8.1 — Create service instances
  // =========================================================================

  const log = fastify.log as Logger;
  const templateCompilerService = new TemplateCompilerService(log);
  const pdfGeneratorService = new PdfGeneratorService(log);
  const documentTemplateService = new DocumentTemplateService(prisma, log);
  const documentDataLoaderService = new DocumentDataLoaderService(prisma, log);
  const sampleDataGeneratorService = new SampleDataGeneratorService();

  // =========================================================================
  // Task 8.5 — Decorate Fastify with services for route handler access
  // =========================================================================

  fastify.decorate('templateCompilerService', templateCompilerService);
  fastify.decorate('pdfGeneratorService', pdfGeneratorService);
  fastify.decorate('documentTemplateService', documentTemplateService);
  fastify.decorate('documentDataLoaderService', documentDataLoaderService);
  fastify.decorate('sampleDataGeneratorService', sampleDataGeneratorService);

  // =========================================================================
  // Task 8.2 — Register Fastify lifecycle hooks
  // =========================================================================

  // onReady: launch Puppeteer browser instance (called once after server is ready)
  fastify.addHook('onReady', async () => {
    try {
      await pdfGeneratorService.init();
      fastify.log.info('[SystemModule] Puppeteer browser launched for PDF generation');
    } catch (err) {
      fastify.log.warn(
        { error: (err as Error).message },
        '[SystemModule] Failed to launch Puppeteer browser — PDF generation will attempt lazy init on first request',
      );
    }
  });

  // onClose: shut down Puppeteer browser cleanly
  fastify.addHook('onClose', async () => {
    await pdfGeneratorService.close();
    fastify.log.info('[SystemModule] Puppeteer browser closed');
  });

  // =========================================================================
  // Task 8.3 — Initialise BullMQ queue + worker for batch PDF generation
  // =========================================================================

  let batchWorkerHandle: PdfBatchWorkerHandle | null = null;

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const connection = parseRedisUrl(redisUrl);

      // Initialise the BullMQ queue (makes enqueuePdfBatch() functional)
      initPdfBatchQueue(connection, log);

      // Start the worker that processes batch PDF generation jobs
      batchWorkerHandle = createPdfBatchWorker(
        log,
        connection,
        documentTemplateService,
        documentDataLoaderService,
        templateCompilerService,
        pdfGeneratorService,
      );

      fastify.log.info('[SystemModule] PDF batch generation queue and worker initialised');
    } catch (err) {
      fastify.log.warn(
        { error: (err as Error).message },
        '[SystemModule] Failed to initialise PDF batch generation queue — batch generation disabled',
      );
    }
  } else {
    fastify.log.warn(
      '[SystemModule] REDIS_URL not set or Redis unavailable — PDF batch generation queue disabled',
    );
  }

  // Graceful shutdown for batch worker + queue
  fastify.addHook('onClose', async () => {
    // Close worker first (stop processing jobs)
    if (batchWorkerHandle) {
      try {
        await batchWorkerHandle.worker.close();
      } catch (err) {
        fastify.log.warn(
          { error: (err as Error).message },
          '[SystemModule] Error closing PDF batch worker',
        );
      }
    }

    // Close the BullMQ queue
    const batchQueue = getPdfBatchQueue();
    if (batchQueue) {
      try {
        await batchQueue.close();
      } catch (err) {
        fastify.log.warn(
          { error: (err as Error).message },
          '[SystemModule] Error closing PDF batch queue',
        );
      }
    }
  });

  // =========================================================================
  // Task 8.4 — Register routes
  // =========================================================================

  // Existing system routes
  await fastify.register(companyRoutesPlugin);
  await fastify.register(userRoutesPlugin);
  await fastify.register(companyProfileRoutesPlugin);
  await fastify.register(resourceRoutesPlugin);
  await fastify.register(accessGroupRoutesPlugin);
  await fastify.register(userAccessGroupRoutesPlugin);
  await fastify.register(myPermissionsRoutesPlugin);
  await fastify.register(auditLogRoutesPlugin);
  await fastify.register(deadLetterRoutesPlugin);

  // Document template CRUD, version management, preview routes (under /system/document-templates/*)
  await fastify.register(documentTemplateRoutesPlugin);

  // Document generation routes (under /system/documents/*)
  await fastify.register(documentGenerationRoutesPlugin);

  // Print preference routes (under /system/print-preferences/*)
  await fastify.register(printPreferenceRoutesPlugin);

  // Favourite pages routes (under /system/favourite-pages/*)
  await fastify.register(favouritePagesRoutesPlugin, { prefix: '/favourite-pages' });
}

export const systemModulePlugin = systemModule;
