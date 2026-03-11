// ---------------------------------------------------------------------------
// Document Generation Routes — E12-1 Task 6.2 / 6.3 / 7.3 / 7.4
// POST /documents/generate — single document PDF generation (AC #6)
// POST /documents/batch-generate — batch PDF generation (AC #7)
// GET  /documents/batch-generate/:batchJobId/status — batch status (AC #7)
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { DocumentType } from '@nexa/db';

import {
  generateDocumentBodySchema,
  type GenerateDocumentBody,
  batchGenerateBodySchema,
  type BatchGenerateBody,
  batchStatusParamsSchema,
  type BatchStatusParams,
} from '../schemas/document-generation.schema.js';
import { createRbacGuard } from '../../../core/rbac/index.js';
import { AppError } from '../../../core/errors/index.js';
import type { TemplateCompilerService } from '../services/template-compiler.service.js';
import type { PdfGeneratorService } from '../services/pdf-generator.service.js';
import type { DocumentTemplateService } from '../services/document-template.service.js';
import type {
  DocumentDataLoaderService,
  BrandingOptions,
} from '../services/document-data-loader.service.js';
import { enqueuePdfBatch, getPdfBatchQueue } from '../queues/pdf-batch-generate.queue.js';
import type { BatchProgressData } from '../workers/pdf-batch-generate.worker.js';

// ---------------------------------------------------------------------------
// Service accessors interface (injected via Fastify decorations)
// ---------------------------------------------------------------------------

interface DocumentGenerationServices {
  templateCompilerService: TemplateCompilerService;
  pdfGeneratorService: PdfGeneratorService;
  documentTemplateService: DocumentTemplateService;
  documentDataLoaderService: DocumentDataLoaderService;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

async function documentGenerationRoutes(fastify: FastifyInstance): Promise<void> {
  // Retrieve service instances from Fastify decorations
  const services = fastify as unknown as DocumentGenerationServices & FastifyInstance;

  // -------------------------------------------------------------------------
  // POST /documents/generate — single document generation (AC #6)
  // -------------------------------------------------------------------------
  fastify.post<{ Body: GenerateDocumentBody }>(
    '/documents/generate',
    {
      schema: {
        body: generateDocumentBodySchema,
      },
      preHandler: createRbacGuard({ minimumRole: 'STAFF' as const }),
    },
    async (request, reply) => {
      const { documentType, recordId, outputFormat, versionContext } = request.body;
      const companyId = request.companyId;

      // Cast string to Prisma DocumentType enum
      const docType = documentType as DocumentType;

      // Step 1: Find template and select best version (AC3)
      const resolved = await services.documentTemplateService.selectTemplateVersion(
        companyId,
        docType,
        {
          // Use caller-provided version context, falling back to null (wildcard)
          languageCode: versionContext?.languageCode ?? null,
          branchCode: versionContext?.branchCode ?? null,
          numberSeriesId: versionContext?.numberSeriesId ?? null,
          accessGroup: versionContext?.accessGroup ?? null,
          customerGroupId: versionContext?.customerGroupId ?? null,
        },
      );

      if (!resolved) {
        throw new AppError(
          'TEMPLATE_NOT_FOUND',
          `No active template found for document type: ${documentType}`,
          404,
        );
      }

      // Step 2: Load data context for the record (AC4)
      const branding: BrandingOptions = {
        showLogo: resolved.template.showLogo,
        logoPosition: resolved.template.logoPosition,
        showBankDetails: resolved.template.showBankDetails,
        showVatNumber: resolved.template.showVatNumber,
        showCompanyReg: resolved.template.showCompanyReg,
      };

      const dataResult = await services.documentDataLoaderService.loadContext(
        companyId,
        docType,
        recordId,
        branding,
      );

      if (!dataResult) {
        throw new AppError(
          'RECORD_NOT_FOUND',
          `Record not found or access denied: ${recordId}`,
          404,
        );
      }

      if (dataResult.isStub) {
        request.log?.warn?.(
          { documentType, recordId },
          'document-generation: using stub data — source model not yet implemented',
        );
      }

      const dataContext = dataResult;

      // Step 3: Compile the template with data context (AC1, AC2)
      let compiledHtml: string;
      try {
        compiledHtml = services.templateCompilerService.compile(
          resolved.mergedHtml,
          dataContext,
          resolved.mergedCss ?? undefined,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new AppError(
          'TEMPLATE_COMPILATION_ERROR',
          `Template compilation failed: ${message}`,
          500,
        );
      }

      // Step 4: Render compiled HTML to PDF (AC5)
      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await services.pdfGeneratorService.generatePdf(compiledHtml, {
          pageSize: resolved.template.pageSize as 'A4' | 'A5' | 'Letter',
          orientation: resolved.template.orientation as 'portrait' | 'landscape',
          marginTop: Number(resolved.template.marginTop),
          marginBottom: Number(resolved.template.marginBottom),
          marginLeft: Number(resolved.template.marginLeft),
          marginRight: Number(resolved.template.marginRight),
          headerHtml: resolved.mergedHeader ?? undefined,
          footerHtml: resolved.mergedFooter ?? undefined,
          displayHeaderFooter: !!(resolved.mergedHeader || resolved.mergedFooter),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new AppError('PDF_GENERATION_ERROR', `PDF generation failed: ${message}`, 500);
      }

      // Step 5: Build filename for attachment disposition
      // Sanitise to prevent header injection (strip quotes, semicolons, CRLF, control chars)
      const rawName = `${documentType}-${dataContext.document.number || recordId}`;
      const safeName = rawName.replace(/["\\\r\n;]/g, '_').replace(/[^\x20-\x7E]/g, '_');
      const filename = `${safeName}.pdf`;

      // Step 6: Set response headers (AC6)
      const disposition =
        outputFormat === 'attachment' ? `attachment; filename="${filename}"` : 'inline';

      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', disposition)
        .header('X-Document-Type', documentType)
        .header('X-Template-Id', resolved.template.id)
        .header('X-Template-Version-Id', resolved.version?.id ?? '')
        .send(pdfBuffer);
    },
  );

  // -------------------------------------------------------------------------
  // POST /documents/batch-generate — batch PDF generation (AC #7, Task 7.3)
  // -------------------------------------------------------------------------
  fastify.post<{ Body: BatchGenerateBody }>(
    '/documents/batch-generate',
    {
      schema: {
        body: batchGenerateBodySchema,
      },
      preHandler: createRbacGuard({ minimumRole: 'MANAGER' as const }),
    },
    async (request, reply) => {
      const { documentType, recordIds } = request.body;
      const companyId = request.companyId;
      const userId = request.userId;

      // Check that the queue is available (Redis configured)
      const queue = getPdfBatchQueue();
      if (!queue) {
        throw new AppError(
          'SERVICE_UNAVAILABLE',
          'Batch generation service is not available (queue not initialised)',
          503,
        );
      }

      // Generate a unique batch ID
      const batchId = randomUUID();

      // Enqueue BullMQ job with all recordIds
      await enqueuePdfBatch({
        batchId,
        companyId,
        documentType: documentType as DocumentType,
        recordIds,
        userId,
      });

      // Return 202 Accepted with batchJobId
      return reply.status(202).send({ batchJobId: batchId });
    },
  );

  // -------------------------------------------------------------------------
  // GET /documents/batch-generate/:batchJobId/status — batch status (AC #7, Task 7.4)
  // -------------------------------------------------------------------------
  fastify.get<{ Params: BatchStatusParams }>(
    '/documents/batch-generate/:batchJobId/status',
    {
      schema: {
        params: batchStatusParamsSchema,
      },
      preHandler: createRbacGuard({ minimumRole: 'STAFF' as const }),
    },
    async (request, reply) => {
      const { batchJobId } = request.params;
      const companyId = request.companyId;

      const queue = getPdfBatchQueue();
      if (!queue) {
        throw new AppError(
          'SERVICE_UNAVAILABLE',
          'Batch generation service is not available (queue not initialised)',
          503,
        );
      }

      // Look up the BullMQ job by ID
      const job = await queue.getJob(`pdf-batch-${batchJobId}`);

      if (!job) {
        throw new AppError('BATCH_NOT_FOUND', `Batch job not found: ${batchJobId}`, 404);
      }

      // Enforce companyId isolation — batch job must belong to requesting user's company
      if (job.data.companyId !== companyId) {
        throw new AppError('BATCH_NOT_FOUND', `Batch job not found: ${batchJobId}`, 404);
      }

      const state = await job.getState();

      // Normalise BullMQ states to our response schema
      const statusMap: Record<string, string> = {
        waiting: 'waiting',
        delayed: 'waiting',
        'waiting-children': 'waiting',
        prioritized: 'waiting',
        active: 'active',
        completed: 'completed',
        failed: 'failed',
        unknown: 'failed',
      };
      const status = statusMap[state] ?? 'waiting';

      // Progress data from job.updateProgress() (set during processing)
      const progress = (job.progress ?? {}) as Partial<BatchProgressData>;

      // If completed, prefer the return value for final accurate counts
      const returnValue = (job.returnvalue ?? {}) as Partial<BatchProgressData>;
      const isCompleted = state === 'completed';

      return reply.send({
        batchJobId,
        status,
        total: (isCompleted ? returnValue.total : progress.total) ?? 0,
        completed: (isCompleted ? returnValue.completed : progress.completed) ?? 0,
        failed: (isCompleted ? returnValue.failed : progress.failed) ?? 0,
        errors: (isCompleted ? returnValue.errors : progress.errors) ?? [],
      });
    },
  );
}

export const documentGenerationRoutesPlugin = documentGenerationRoutes;
