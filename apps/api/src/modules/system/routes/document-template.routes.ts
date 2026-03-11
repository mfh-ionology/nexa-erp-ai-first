// ---------------------------------------------------------------------------
// Document Template Management Routes — E12-2 Tasks 3, 4 & 5
// CRUD endpoints for document templates (AC #1, #2, #3), version
// management (AC #4), and preview endpoint (AC #5).
//
// Route layout:
//   GET    /document-templates                          (list templates)
//   GET    /document-templates/:id                      (get template detail with versions)
//   POST   /document-templates                          (create template)
//   PATCH  /document-templates/:id                      (update template)
//   DELETE /document-templates/:id                      (soft-delete template)
//   POST   /document-templates/:id/versions             (create version)
//   PATCH  /document-templates/:id/versions/:versionId  (update version)
//   DELETE /document-templates/:id/versions/:versionId  (delete version)
//   POST   /document-templates/:id/preview              (preview PDF)
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';

import {
  documentTemplateParamsSchema,
  type DocumentTemplateParams,
  documentTemplateVersionParamsSchema,
  type DocumentTemplateVersionParams,
  createDocumentTemplateSchema,
  type CreateDocumentTemplate,
  updateDocumentTemplateSchema,
  type UpdateDocumentTemplate,
  listDocumentTemplatesQuerySchema,
  type ListDocumentTemplatesQuery,
  createVersionSchema,
  type CreateVersion,
  updateVersionSchema,
  type UpdateVersion,
  previewTemplateBodySchema,
  type PreviewTemplateBody,
} from '../schemas/document-template.schema.js';
import { createRbacGuard } from '../../../core/rbac/index.js';
import { extractRequestContext } from '../../../core/types/request-context.js';
import { sendSuccess } from '../../../core/utils/response.js';
import { AppError, DomainError } from '../../../core/errors/index.js';
import type { DocumentTemplateService } from '../services/document-template.service.js';
import type { TemplateCompilerService } from '../services/template-compiler.service.js';
import type { PdfGeneratorService } from '../services/pdf-generator.service.js';
import type { SampleDataGeneratorService } from '../services/sample-data-generator.service.js';

// ---------------------------------------------------------------------------
// Service accessor interface (injected via Fastify decorations)
// ---------------------------------------------------------------------------

interface DocumentTemplateServices {
  documentTemplateService: DocumentTemplateService;
  templateCompilerService: TemplateCompilerService;
  pdfGeneratorService: PdfGeneratorService;
  sampleDataGeneratorService: SampleDataGeneratorService;
}

/**
 * Convert Prisma Decimal margin fields to plain numbers for JSON serialisation.
 * Prisma returns Decimal objects (from decimal.js) which serialise as strings.
 */
function normaliseMargins<T extends Record<string, unknown>>(template: T): T {
  return {
    ...template,
    marginTop: Number(template.marginTop),
    marginBottom: Number(template.marginBottom),
    marginLeft: Number(template.marginLeft),
    marginRight: Number(template.marginRight),
  };
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

async function documentTemplateRoutes(fastify: FastifyInstance): Promise<void> {
  const services = fastify as unknown as DocumentTemplateServices & FastifyInstance;

  // -------------------------------------------------------------------------
  // GET /document-templates — list templates (AC #2)
  // -------------------------------------------------------------------------
  fastify.get<{ Querystring: ListDocumentTemplatesQuery }>(
    '/document-templates',
    {
      schema: {
        querystring: listDocumentTemplatesQuerySchema,
      },
      preHandler: createRbacGuard({ minimumRole: 'ADMIN' as const }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const { templates, cursor, total } = await services.documentTemplateService.listTemplates(
        ctx.companyId,
        {
          documentType: request.query.documentType,
          isActive: request.query.isActive,
          search: request.query.search,
          cursor: request.query.cursor,
          limit: request.query.limit,
        },
      );

      // Map _count to versionCount for API response, stripping internal _count field.
      // Also normalise Prisma Decimal margin fields to plain numbers.
      const data = templates.map((t) => {
        const { _count, ...rest } = t as typeof t & { _count: { versions: number } };
        return normaliseMargins({ ...rest, versionCount: _count.versions });
      });

      return sendSuccess(reply, data, {
        cursor: cursor ?? undefined,
        hasMore: cursor !== null,
        total,
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /document-templates/:id — get template detail with versions (AC #2)
  // -------------------------------------------------------------------------
  fastify.get<{ Params: DocumentTemplateParams }>(
    '/document-templates/:id',
    {
      schema: {
        params: documentTemplateParamsSchema,
      },
      preHandler: createRbacGuard({ minimumRole: 'ADMIN' as const }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const template = await services.documentTemplateService.getTemplateById(
        ctx.companyId,
        request.params.id,
      );

      if (!template) {
        throw new AppError('TEMPLATE_NOT_FOUND', `Template not found: ${request.params.id}`, 404);
      }

      return sendSuccess(reply, normaliseMargins(template));
    },
  );

  // -------------------------------------------------------------------------
  // POST /document-templates — create template (AC #1)
  // -------------------------------------------------------------------------
  fastify.post<{ Body: CreateDocumentTemplate }>(
    '/document-templates',
    {
      schema: {
        body: createDocumentTemplateSchema,
      },
      preHandler: createRbacGuard({ minimumRole: 'ADMIN' as const }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);

      try {
        const template = await services.documentTemplateService.createTemplate(
          ctx.companyId,
          ctx.userId,
          request.body,
        );

        return sendSuccess(reply, template, undefined, 201);
      } catch (error) {
        if (error instanceof DomainError && error.code === 'TEMPLATE_NAME_EXISTS') {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /document-templates/:id — update template (AC #3)
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: DocumentTemplateParams; Body: UpdateDocumentTemplate }>(
    '/document-templates/:id',
    {
      schema: {
        params: documentTemplateParamsSchema,
        body: updateDocumentTemplateSchema,
      },
      preHandler: createRbacGuard({ minimumRole: 'ADMIN' as const }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);

      try {
        const template = await services.documentTemplateService.updateTemplate(
          ctx.companyId,
          request.params.id,
          request.body,
        );

        if (!template) {
          throw new AppError('TEMPLATE_NOT_FOUND', `Template not found: ${request.params.id}`, 404);
        }

        return sendSuccess(reply, template);
      } catch (error) {
        if (error instanceof DomainError && error.code === 'TEMPLATE_NAME_EXISTS') {
          throw new AppError(error.code, error.message, 409);
        }
        throw error;
      }
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /document-templates/:id — soft-delete template (AC #3)
  // -------------------------------------------------------------------------
  fastify.delete<{ Params: DocumentTemplateParams }>(
    '/document-templates/:id',
    {
      schema: {
        params: documentTemplateParamsSchema,
      },
      preHandler: createRbacGuard({ minimumRole: 'ADMIN' as const }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const deleted = await services.documentTemplateService.softDeleteTemplate(
        ctx.companyId,
        request.params.id,
      );

      if (!deleted) {
        throw new AppError('TEMPLATE_NOT_FOUND', `Template not found: ${request.params.id}`, 404);
      }

      return reply.status(204).send();
    },
  );

  // -------------------------------------------------------------------------
  // POST /document-templates/:id/versions — create version (AC #4)
  // -------------------------------------------------------------------------
  fastify.post<{ Params: DocumentTemplateParams; Body: CreateVersion }>(
    '/document-templates/:id/versions',
    {
      schema: {
        params: documentTemplateParamsSchema,
        body: createVersionSchema,
      },
      preHandler: createRbacGuard({ minimumRole: 'ADMIN' as const }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const version = await services.documentTemplateService.createVersion(
        ctx.companyId,
        request.params.id,
        request.body,
      );

      if (!version) {
        throw new AppError('TEMPLATE_NOT_FOUND', `Template not found: ${request.params.id}`, 404);
      }

      return sendSuccess(reply, version, undefined, 201);
    },
  );

  // -------------------------------------------------------------------------
  // PATCH /document-templates/:id/versions/:versionId — update version (AC #4)
  // -------------------------------------------------------------------------
  fastify.patch<{ Params: DocumentTemplateVersionParams; Body: UpdateVersion }>(
    '/document-templates/:id/versions/:versionId',
    {
      schema: {
        params: documentTemplateVersionParamsSchema,
        body: updateVersionSchema,
      },
      preHandler: createRbacGuard({ minimumRole: 'ADMIN' as const }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const version = await services.documentTemplateService.updateVersion(
        ctx.companyId,
        request.params.id,
        request.params.versionId,
        request.body,
      );

      if (!version) {
        throw new AppError('TEMPLATE_NOT_FOUND', `Template or version not found`, 404);
      }

      return sendSuccess(reply, version);
    },
  );

  // -------------------------------------------------------------------------
  // DELETE /document-templates/:id/versions/:versionId — delete version (AC #4)
  // -------------------------------------------------------------------------
  fastify.delete<{ Params: DocumentTemplateVersionParams }>(
    '/document-templates/:id/versions/:versionId',
    {
      schema: {
        params: documentTemplateVersionParamsSchema,
      },
      preHandler: createRbacGuard({ minimumRole: 'ADMIN' as const }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);
      const deleted = await services.documentTemplateService.deleteVersion(
        ctx.companyId,
        request.params.id,
        request.params.versionId,
      );

      if (!deleted) {
        throw new AppError('TEMPLATE_NOT_FOUND', `Template or version not found`, 404);
      }

      return reply.status(204).send();
    },
  );

  // -------------------------------------------------------------------------
  // POST /document-templates/:id/preview — generate preview PDF (AC #5)
  // -------------------------------------------------------------------------
  fastify.post<{ Params: DocumentTemplateParams; Body: PreviewTemplateBody }>(
    '/document-templates/:id/preview',
    {
      schema: {
        params: documentTemplateParamsSchema,
        body: previewTemplateBodySchema,
      },
      preHandler: createRbacGuard({ minimumRole: 'ADMIN' as const }),
    },
    async (request, reply) => {
      const ctx = extractRequestContext(request);

      // Step 1: Load template with versions
      const template = await services.documentTemplateService.getTemplateById(
        ctx.companyId,
        request.params.id,
      );

      if (!template) {
        throw new AppError('TEMPLATE_NOT_FOUND', `Template not found: ${request.params.id}`, 404);
      }

      // Step 2: Determine which HTML/CSS to use (base or version override)
      let htmlTemplate = template.htmlTemplate;
      let cssStyles = template.cssStyles;
      let headerHtml = template.headerHtml;
      let footerHtml = template.footerHtml;

      const versionId = request.body?.versionId;
      if (versionId) {
        const version = template.versions.find((v) => v.id === versionId);
        if (!version) {
          throw new AppError('VERSION_NOT_FOUND', `Version not found: ${versionId}`, 404);
        }
        // Merge version overrides into base template (non-null overrides replace base)
        htmlTemplate = version.htmlOverride ?? htmlTemplate;
        cssStyles = version.cssOverride ?? cssStyles;
        headerHtml = version.headerOverride ?? headerHtml;
        footerHtml = version.footerOverride ?? footerHtml;
      }

      // Step 3: Generate sample data for the template's document type
      const sampleData = services.sampleDataGeneratorService.generateSampleData(
        template.documentType,
      );

      // Inject branding flags from the template into the sample data context
      sampleData.branding = {
        showLogo: template.showLogo,
        logoPosition: template.logoPosition,
        showBankDetails: template.showBankDetails,
        showVatNumber: template.showVatNumber,
        showCompanyReg: template.showCompanyReg,
      };

      // Step 4: Compile the template with sample data
      let compiledHtml: string;
      try {
        compiledHtml = services.templateCompilerService.compile(
          htmlTemplate,
          sampleData,
          cssStyles ?? undefined,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new AppError(
          'TEMPLATE_COMPILATION_ERROR',
          `Template compilation failed: ${message}`,
          422,
        );
      }

      // Step 5: Render compiled HTML to PDF
      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await services.pdfGeneratorService.generatePdf(compiledHtml, {
          pageSize: template.pageSize as 'A4' | 'A5' | 'Letter',
          orientation: template.orientation as 'portrait' | 'landscape',
          marginTop: Number(template.marginTop),
          marginBottom: Number(template.marginBottom),
          marginLeft: Number(template.marginLeft),
          marginRight: Number(template.marginRight),
          headerHtml: headerHtml ?? undefined,
          footerHtml: footerHtml ?? undefined,
          displayHeaderFooter: !!(headerHtml || footerHtml),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new AppError('PDF_GENERATION_ERROR', `PDF generation failed: ${message}`, 500);
      }

      // Step 6: Return PDF inline
      const safeType = template.documentType.replace(/[^\w-]/g, '_');
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `inline; filename="preview-${safeType}.pdf"`)
        .send(pdfBuffer);
    },
  );
}

export const documentTemplateRoutesPlugin = documentTemplateRoutes;
