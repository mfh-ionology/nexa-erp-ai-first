// ---------------------------------------------------------------------------
// PDF Batch Generate Worker — BullMQ worker for async batch PDF generation
// E12-1 Task 7.2
// ---------------------------------------------------------------------------

import { Worker, type ConnectionOptions, type Job } from 'bullmq';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { PdfBatchJobData } from '../queues/pdf-batch-generate.queue.js';
import { PDF_BATCH_GENERATE_QUEUE_NAME } from '../queues/pdf-batch-generate.queue.js';
import type { DocumentTemplateService } from '../services/document-template.service.js';
import type {
  DocumentDataLoaderService,
  BrandingOptions,
} from '../services/document-data-loader.service.js';
import type { TemplateCompilerService } from '../services/template-compiler.service.js';
import type { PdfGeneratorService } from '../services/pdf-generator.service.js';
import type { Logger } from 'pino';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BatchProgressData {
  total: number;
  completed: number;
  failed: number;
  errors: Array<{ recordId: string; error: string }>;
}

export interface PdfBatchWorkerHandle {
  worker: Worker<PdfBatchJobData>;
}

// ---------------------------------------------------------------------------
// Worker factory
// ---------------------------------------------------------------------------

/**
 * Create and return a BullMQ Worker that processes batch PDF generation jobs.
 *
 * Each job processes multiple recordIds sequentially:
 * 1. Finds the template once for the entire batch
 * 2. For each record: loads data → compiles template → renders PDF → stores file
 * 3. Individual record failures do not abort the batch
 * 4. Progress is tracked via job.updateProgress()
 *
 * @param logger                    Structured logger
 * @param connection                BullMQ Redis connection options
 * @param documentTemplateService   Template version selection + merging
 * @param documentDataLoaderService Data context loading for documents
 * @param templateCompilerService   Handlebars template compilation
 * @param pdfGeneratorService       Puppeteer HTML-to-PDF rendering
 */
export function createPdfBatchWorker(
  logger: Logger,
  connection: ConnectionOptions,
  documentTemplateService: DocumentTemplateService,
  documentDataLoaderService: DocumentDataLoaderService,
  templateCompilerService: TemplateCompilerService,
  pdfGeneratorService: PdfGeneratorService,
): PdfBatchWorkerHandle {
  const worker = new Worker<PdfBatchJobData>(
    PDF_BATCH_GENERATE_QUEUE_NAME,
    async (job: Job<PdfBatchJobData>) => {
      const { batchId, companyId, documentType, recordIds } = job.data;
      const total = recordIds.length;
      let completed = 0;
      let failed = 0;
      const errors: Array<{ recordId: string; error: string }> = [];

      logger.info({ batchId, documentType, total }, 'pdf-batch-generate: starting batch');

      // Create storage directory for this batch
      const batchDir = join(process.cwd(), 'storage', 'pdfs', batchId);
      await mkdir(batchDir, { recursive: true });

      // Find template once for the entire batch
      const resolved = await documentTemplateService.selectTemplateVersion(
        companyId,
        documentType,
        {
          languageCode: null,
          branchCode: null,
          numberSeriesId: null,
          accessGroup: null,
          customerGroupId: null,
        },
      );

      if (!resolved) {
        throw new Error(`No active template found for document type: ${documentType}`);
      }

      const branding: BrandingOptions = {
        showLogo: resolved.template.showLogo,
        logoPosition: resolved.template.logoPosition,
        showBankDetails: resolved.template.showBankDetails,
        showVatNumber: resolved.template.showVatNumber,
        showCompanyReg: resolved.template.showCompanyReg,
      };

      // Process each record sequentially
      for (const recordId of recordIds) {
        try {
          // 1. Load data context
          const dataContext = await documentDataLoaderService.loadContext(
            companyId,
            documentType,
            recordId,
            branding,
          );

          if (!dataContext) {
            failed++;
            errors.push({ recordId, error: 'Record not found or access denied' });
            await job.updateProgress({ total, completed, failed, errors });
            continue;
          }

          // 2. Compile template with data context
          const compiledHtml = templateCompilerService.compile(
            resolved.mergedHtml,
            dataContext,
            resolved.mergedCss ?? undefined,
          );

          // 3. Render PDF via Puppeteer
          const pdfBuffer = await pdfGeneratorService.generatePdf(compiledHtml, {
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

          // 4. Store PDF on local filesystem (MVP — S3/MinIO later)
          const filename = `${documentType}-${recordId}.pdf`;
          await writeFile(join(batchDir, filename), pdfBuffer);

          completed++;
        } catch (err) {
          failed++;
          const message = err instanceof Error ? err.message : String(err);
          errors.push({ recordId, error: message });
          logger.warn({ batchId, recordId, error: message }, 'pdf-batch-generate: record failed');
        }

        // Update progress after each record
        await job.updateProgress({ total, completed, failed, errors });
      }

      logger.info({ batchId, total, completed, failed }, 'pdf-batch-generate: batch completed');

      // Return final result (available via job.returnvalue)
      return { total, completed, failed, errors } satisfies BatchProgressData;
    },
    {
      connection,
      concurrency: 1, // One batch at a time (each batch processes records sequentially)
    },
  );

  worker.on('completed', (job) => {
    logger.debug(
      { jobId: job?.id, batchId: job?.data.batchId },
      'pdf-batch-generate: job completed',
    );
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, batchId: job?.data.batchId, error: err.message },
      'pdf-batch-generate: job failed',
    );
  });

  return { worker };
}
