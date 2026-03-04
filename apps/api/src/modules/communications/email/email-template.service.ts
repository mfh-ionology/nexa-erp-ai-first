// ---------------------------------------------------------------------------
// Email Template CRUD Service — E10-2 Task 5
// High-level CRUD, resolution, and preview for EmailTemplate records.
// ---------------------------------------------------------------------------

import { Prisma } from '@nexa/db';
import type { PrismaClient, EmailTemplate } from '@nexa/db';

import { AppError, ValidationError } from '../../../core/errors/index.js';
import {
  EmailTemplateEngineService,
  SUPPORTED_DOCUMENT_TYPES,
} from './email-template-engine.service.js';
import type { PreviewResult } from './email-template-engine.service.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Logger = {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
};

export interface CreateTemplateInput {
  code: string;
  name: string;
  description?: string;
  documentType: string;
  subjectTemplate: string;
  bodyHtmlTemplate: string;
  bodyTextTemplate?: string;
  openingTextCode?: string;
  closingTextCode?: string;
  languageCode?: string;
  attachPdf?: boolean;
  autoSend?: boolean;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  documentType?: string;
  subjectTemplate?: string;
  bodyHtmlTemplate?: string;
  bodyTextTemplate?: string;
  openingTextCode?: string;
  closingTextCode?: string;
  languageCode?: string;
  attachPdf?: boolean;
  autoSend?: boolean;
}

export interface ListTemplatesFilters {
  documentType?: string;
  isActive?: boolean;
  languageCode?: string;
  cursor?: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// EmailTemplateService
// ---------------------------------------------------------------------------

export class EmailTemplateService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
    private readonly engine: EmailTemplateEngineService,
  ) {}

  // -------------------------------------------------------------------------
  // createTemplate (AC #1 — subtask 5.2)
  // -------------------------------------------------------------------------

  async createTemplate(userId: string, input: CreateTemplateInput): Promise<EmailTemplate> {
    // Validate documentType
    if (!SUPPORTED_DOCUMENT_TYPES.includes(input.documentType)) {
      throw new ValidationError(
        `Invalid documentType "${input.documentType}". Supported types: ${SUPPORTED_DOCUMENT_TYPES.join(', ')}`,
      );
    }

    // Validate template syntax
    const validation = this.engine.validateTemplate(
      input.subjectTemplate,
      input.bodyHtmlTemplate,
      input.documentType,
    );
    if (!validation.valid) {
      throw new ValidationError(`Template validation failed: ${validation.errors.join('; ')}`);
    }

    try {
      const template = await this.prisma.emailTemplate.create({
        data: {
          code: input.code,
          name: input.name,
          description: input.description ?? null,
          documentType: input.documentType,
          subjectTemplate: input.subjectTemplate,
          bodyHtmlTemplate: input.bodyHtmlTemplate,
          bodyTextTemplate: input.bodyTextTemplate ?? null,
          openingTextCode: input.openingTextCode ?? null,
          closingTextCode: input.closingTextCode ?? null,
          languageCode: input.languageCode ?? 'en',
          attachPdf: input.attachPdf ?? true,
          autoSend: input.autoSend ?? false,
          isActive: true,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      this.logger.info({ templateId: template.id, code: template.code }, 'email template created');

      return template;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError(
          'CONFLICT',
          `An email template with code "${input.code}" already exists`,
          409,
        );
      }
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // updateTemplate (AC #1 — subtask 5.3)
  // -------------------------------------------------------------------------

  async updateTemplate(
    id: string,
    userId: string,
    input: UpdateTemplateInput,
  ): Promise<EmailTemplate | null> {
    const existing = await this.prisma.emailTemplate.findUnique({
      where: { id },
    });
    if (!existing) return null;

    // Determine the effective documentType / subject / body for validation
    const effectiveDocType = input.documentType ?? existing.documentType;
    const effectiveSubject = input.subjectTemplate ?? existing.subjectTemplate;
    const effectiveBody = input.bodyHtmlTemplate ?? existing.bodyHtmlTemplate;

    // Validate documentType if changed
    if (input.documentType && !SUPPORTED_DOCUMENT_TYPES.includes(input.documentType)) {
      throw new ValidationError(
        `Invalid documentType "${input.documentType}". Supported types: ${SUPPORTED_DOCUMENT_TYPES.join(', ')}`,
      );
    }

    // Re-validate template syntax if subject, body, or documentType changed
    if (input.subjectTemplate || input.bodyHtmlTemplate || input.documentType) {
      const validation = this.engine.validateTemplate(
        effectiveSubject,
        effectiveBody,
        effectiveDocType,
      );
      if (!validation.valid) {
        throw new ValidationError(`Template validation failed: ${validation.errors.join('; ')}`);
      }
    }

    // Whitelist allowed fields — never spread raw input into Prisma data
    const data: Prisma.EmailTemplateUncheckedUpdateInput = { updatedBy: userId };
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.documentType !== undefined) data.documentType = input.documentType;
    if (input.subjectTemplate !== undefined) data.subjectTemplate = input.subjectTemplate;
    if (input.bodyHtmlTemplate !== undefined) data.bodyHtmlTemplate = input.bodyHtmlTemplate;
    if (input.bodyTextTemplate !== undefined) data.bodyTextTemplate = input.bodyTextTemplate;
    if (input.openingTextCode !== undefined) data.openingTextCode = input.openingTextCode;
    if (input.closingTextCode !== undefined) data.closingTextCode = input.closingTextCode;
    if (input.languageCode !== undefined) data.languageCode = input.languageCode;
    if (input.attachPdf !== undefined) data.attachPdf = input.attachPdf;
    if (input.autoSend !== undefined) data.autoSend = input.autoSend;

    const template = await this.prisma.emailTemplate.update({
      where: { id },
      data,
    });

    // Invalidate compiled template cache
    this.engine.invalidateCache(id);

    this.logger.info({ templateId: template.id, code: template.code }, 'email template updated');

    return template;
  }

  // -------------------------------------------------------------------------
  // getTemplate (AC #6 — subtask 5.4)
  // -------------------------------------------------------------------------

  async getTemplate(id: string): Promise<EmailTemplate | null> {
    return this.prisma.emailTemplate.findUnique({ where: { id } });
  }

  // -------------------------------------------------------------------------
  // listTemplates (AC #6 — subtask 5.5)
  // -------------------------------------------------------------------------

  async listTemplates(filters: ListTemplatesFilters) {
    const limit = filters.limit ?? 20;

    const where: Prisma.EmailTemplateWhereInput = {};

    if (filters.documentType) {
      where.documentType = filters.documentType;
    }
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }
    if (filters.languageCode) {
      where.languageCode = filters.languageCode;
    }

    const findArgs: Prisma.EmailTemplateFindManyArgs = {
      where,
      orderBy: [{ documentType: 'asc' as const }, { languageCode: 'asc' as const }],
      take: limit + 1,
    };

    if (filters.cursor) {
      findArgs.cursor = { id: filters.cursor };
      findArgs.skip = 1;
    }

    const items = await this.prisma.emailTemplate.findMany(findArgs);

    const hasMore = items.length > limit;
    if (hasMore) {
      items.pop();
    }

    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

    return {
      items,
      meta: {
        cursor: nextCursor,
        hasMore,
      },
    };
  }

  // -------------------------------------------------------------------------
  // deleteTemplate — soft-delete (AC #6 — subtask 5.6)
  // -------------------------------------------------------------------------

  async deleteTemplate(id: string): Promise<boolean> {
    const existing = await this.prisma.emailTemplate.findUnique({
      where: { id },
    });
    if (!existing) return false;

    await this.prisma.emailTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    // Invalidate compiled template cache
    this.engine.invalidateCache(id);

    this.logger.info({ templateId: id }, 'email template soft-deleted');
    return true;
  }

  // -------------------------------------------------------------------------
  // resolveTemplate (AC #4, #5 — subtask 5.7)
  // -------------------------------------------------------------------------

  async resolveTemplate(
    documentType: string,
    languageCode?: string,
  ): Promise<EmailTemplate | null> {
    const lang = languageCode ?? 'en';

    // 1. Exact match: documentType + languageCode (or default 'en')
    const exact = await this.prisma.emailTemplate.findFirst({
      where: { documentType, languageCode: lang, isActive: true },
    });
    if (exact) return exact;

    // 2. Default language fallback (only if requested language was not already 'en')
    if (lang !== 'en') {
      const defaultLang = await this.prisma.emailTemplate.findFirst({
        where: { documentType, languageCode: 'en', isActive: true },
      });
      if (defaultLang) return defaultLang;
    }

    // 3. Any active template for this documentType
    const anyActive = await this.prisma.emailTemplate.findFirst({
      where: { documentType, isActive: true },
    });
    return anyActive;
  }

  // -------------------------------------------------------------------------
  // previewTemplate (AC #3 — subtask 5.8)
  // -------------------------------------------------------------------------

  async previewTemplate(id: string): Promise<PreviewResult | null> {
    const template = await this.prisma.emailTemplate.findUnique({
      where: { id },
    });
    if (!template) return null;

    return this.engine.renderPreview(template);
  }
}
