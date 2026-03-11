// ---------------------------------------------------------------------------
// Document Template Service — E12-1 Task 4 + E12-2 Task 2
// Version selection algorithm, template-version override merging, and CRUD.
// ---------------------------------------------------------------------------

import type { PrismaClient, DocumentTemplate, DocumentTemplateVersion } from '@nexa/db';
import { DocumentType, Prisma } from '@nexa/db';
import type { Logger } from 'pino';

import { DomainError } from '../../../core/errors/index.js';

/**
 * Context used to score and select the best template version.
 * Null fields are ignored (wildcard — neither add nor subtract score).
 */
export interface VersionSelectionContext {
  languageCode?: string | null;
  branchCode?: string | null;
  numberSeriesId?: string | null;
  accessGroup?: string | null;
  customerGroupId?: string | null;
}

/**
 * Email settings extracted from the selected version (for downstream email pipeline).
 */
export interface EmailSettings {
  emailSubject: string | null;
  emailBody: string | null;
  replyToEmail: string | null;
  ccEmails: string | null;
}

/**
 * Resolved template with version overrides merged into base template fields.
 */
export interface ResolvedTemplate {
  template: DocumentTemplate;
  version: DocumentTemplateVersion | null;
  mergedHtml: string;
  mergedCss: string | null;
  mergedHeader: string | null;
  mergedFooter: string | null;
  emailSettings: EmailSettings | null;
}

// Re-export DocumentType for consumer convenience
export { DocumentType };

// ---------------------------------------------------------------------------
// CRUD input types (E12-2 Task 2)
// ---------------------------------------------------------------------------

export interface ListTemplatesOptions {
  documentType?: DocumentType;
  isActive?: boolean;
  search?: string;
  cursor?: string;
  limit: number;
}

export interface CreateTemplateInput {
  documentType: DocumentType;
  name: string;
  description?: string;
  htmlTemplate: string;
  headerHtml?: string;
  footerHtml?: string;
  cssStyles?: string;
  pageSize?: string;
  orientation?: string;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  showLogo?: boolean;
  logoPosition?: string;
  showBankDetails?: boolean;
  showVatNumber?: boolean;
  showCompanyReg?: boolean;
  isDefault?: boolean;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  htmlTemplate?: string;
  headerHtml?: string;
  footerHtml?: string;
  cssStyles?: string;
  pageSize?: string;
  orientation?: string;
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  showLogo?: boolean;
  logoPosition?: string;
  showBankDetails?: boolean;
  showVatNumber?: boolean;
  showCompanyReg?: boolean;
  isDefault?: boolean;
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// Version CRUD input types (E12-2 Task 4)
// ---------------------------------------------------------------------------

export interface CreateVersionInput {
  languageCode?: string | null;
  branchCode?: string | null;
  numberSeriesId?: string | null;
  accessGroup?: string | null;
  customerGroupId?: string | null;
  htmlOverride?: string | null;
  cssOverride?: string | null;
  headerOverride?: string | null;
  footerOverride?: string | null;
  emailSubject?: string | null;
  emailBody?: string | null;
  replyToEmail?: string | null;
  ccEmails?: string | null;
  priority?: number;
  isActive?: boolean;
}

export interface UpdateVersionInput {
  languageCode?: string | null;
  branchCode?: string | null;
  numberSeriesId?: string | null;
  accessGroup?: string | null;
  customerGroupId?: string | null;
  htmlOverride?: string | null;
  cssOverride?: string | null;
  headerOverride?: string | null;
  footerOverride?: string | null;
  emailSubject?: string | null;
  emailBody?: string | null;
  replyToEmail?: string | null;
  ccEmails?: string | null;
  priority?: number;
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// Match scoring constants (AC #3)
// ---------------------------------------------------------------------------

const SCORE_LANGUAGE_MATCH = 10;
const SCORE_LANGUAGE_MISMATCH = -20;
const SCORE_BRANCH_MATCH = 8;
const SCORE_BRANCH_MISMATCH = -16;
const SCORE_NUMBER_SERIES_MATCH = 6;
const SCORE_ACCESS_GROUP_MATCH = 4;
const SCORE_CUSTOMER_GROUP_MATCH = 2;

// ---------------------------------------------------------------------------
// DocumentTemplateService
// ---------------------------------------------------------------------------

export class DocumentTemplateService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly logger: Logger,
  ) {}

  // -------------------------------------------------------------------------
  // findActiveTemplate (Task 4.2)
  // -------------------------------------------------------------------------

  /**
   * Find the active default template for a given documentType within a company.
   * Falls back to any active template if no default is found.
   * Returns null if no template exists at all.
   */
  async findActiveTemplate(
    companyId: string,
    documentType: DocumentType,
  ): Promise<(DocumentTemplate & { versions: DocumentTemplateVersion[] }) | null> {
    // First try the default template
    const defaultTemplate = await this.prisma.documentTemplate.findFirst({
      where: {
        companyId,
        documentType,
        isDefault: true,
        isActive: true,
      },
      include: {
        versions: {
          where: { isActive: true },
          orderBy: { priority: 'desc' },
        },
      },
    });

    if (defaultTemplate) {
      return defaultTemplate;
    }

    // Fallback: any active template for this documentType
    const anyTemplate = await this.prisma.documentTemplate.findFirst({
      where: {
        companyId,
        documentType,
        isActive: true,
      },
      include: {
        versions: {
          where: { isActive: true },
          orderBy: { priority: 'desc' },
        },
      },
    });

    if (anyTemplate) {
      this.logger.warn(
        { companyId, documentType, templateId: anyTemplate.id },
        'document-template: no default template found, using fallback',
      );
    }

    return anyTemplate;
  }

  // -------------------------------------------------------------------------
  // selectTemplateVersion (Task 4.3 + 4.4)
  // -------------------------------------------------------------------------

  /**
   * Select the best template version for a document generation request.
   *
   * 1. Finds the active template for the given documentType
   * 2. Scores each active version against the provided context
   * 3. Selects the highest-scoring version (priority as tiebreaker)
   * 4. Merges version overrides with base template fields
   *
   * Returns a ResolvedTemplate with merged fields ready for compilation.
   * Returns null if no template exists for the documentType.
   */
  async selectTemplateVersion(
    companyId: string,
    documentType: DocumentType,
    context: VersionSelectionContext,
  ): Promise<ResolvedTemplate | null> {
    const template = await this.findActiveTemplate(companyId, documentType);

    if (!template) {
      return null;
    }

    // Score and select the best version
    const selectedVersion = this.selectBestVersion(template.versions, context);

    // Merge version overrides with base template (Task 4.4)
    return this.mergeTemplateVersion(template, selectedVersion);
  }

  // -------------------------------------------------------------------------
  // Match scoring algorithm (Task 4.3 — AC #3)
  // -------------------------------------------------------------------------

  /**
   * Calculate the match score for a version against the selection context.
   *
   * Scoring rules:
   * - languageCode match: +10, mismatch (non-null, different): -20
   * - branchCode match: +8, mismatch: -16
   * - numberSeriesId match: +6
   * - accessGroup match: +4
   * - customerGroupId match: +2
   * - Null criteria on the version are wildcards (score 0)
   */
  calculateMatchScore(version: DocumentTemplateVersion, context: VersionSelectionContext): number {
    let score = 0;

    // Language code
    if (version.languageCode) {
      if (version.languageCode === context.languageCode) {
        score += SCORE_LANGUAGE_MATCH;
      } else {
        score += SCORE_LANGUAGE_MISMATCH;
      }
    }

    // Branch code
    if (version.branchCode) {
      if (version.branchCode === context.branchCode) {
        score += SCORE_BRANCH_MATCH;
      } else {
        score += SCORE_BRANCH_MISMATCH;
      }
    }

    // Number series ID (match only — no mismatch penalty per AC)
    if (version.numberSeriesId && version.numberSeriesId === context.numberSeriesId) {
      score += SCORE_NUMBER_SERIES_MATCH;
    }

    // Access group (match only)
    if (version.accessGroup && version.accessGroup === context.accessGroup) {
      score += SCORE_ACCESS_GROUP_MATCH;
    }

    // Customer group ID (match only)
    if (version.customerGroupId && version.customerGroupId === context.customerGroupId) {
      score += SCORE_CUSTOMER_GROUP_MATCH;
    }

    return score;
  }

  // -------------------------------------------------------------------------
  // CRUD Methods (E12-2 Task 2)
  // -------------------------------------------------------------------------

  /**
   * List templates for a company with optional filters and cursor-based pagination.
   * Includes version count per template.
   */
  async listTemplates(
    companyId: string,
    options: ListTemplatesOptions,
  ): Promise<{
    templates: (DocumentTemplate & { _count: { versions: number } })[];
    cursor: string | null;
    total: number;
  }> {
    const where: Prisma.DocumentTemplateWhereInput = { companyId };

    if (options.documentType !== undefined) {
      where.documentType = options.documentType;
    }
    if (options.isActive !== undefined) {
      where.isActive = options.isActive;
    } else {
      // Default: only active templates
      where.isActive = true;
    }
    if (options.search) {
      where.name = { contains: options.search, mode: 'insensitive' };
    }

    const limit = options.limit;

    // Get total count for the filter
    const total = await this.prisma.documentTemplate.count({ where });

    // Build findMany args with cursor-based pagination
    const findArgs: Prisma.DocumentTemplateFindManyArgs = {
      where,
      include: { _count: { select: { versions: true } } },
      orderBy: [{ documentType: 'asc' }, { name: 'asc' }],
      take: limit + 1,
    };

    if (options.cursor) {
      findArgs.cursor = { id: options.cursor };
      findArgs.skip = 1;
    }

    const items = (await this.prisma.documentTemplate.findMany(findArgs)) as (DocumentTemplate & {
      _count: { versions: number };
    })[];

    const hasMore = items.length > limit;
    if (hasMore) {
      items.pop();
    }

    const nextCursor = hasMore && items.length > 0 ? items[items.length - 1]!.id : null;

    return { templates: items, cursor: nextCursor, total };
  }

  /**
   * Get a single template by ID with all versions included.
   * Returns null if template doesn't exist or belongs to a different company.
   */
  async getTemplateById(
    companyId: string,
    templateId: string,
  ): Promise<(DocumentTemplate & { versions: DocumentTemplateVersion[] }) | null> {
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id: templateId, companyId },
      include: {
        versions: {
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    return template;
  }

  /**
   * Create a new document template. If isDefault is true, unsets any existing
   * default for the same [companyId, documentType] in a transaction.
   */
  async createTemplate(
    companyId: string,
    userId: string,
    data: CreateTemplateInput,
  ): Promise<DocumentTemplate> {
    const createData: Prisma.DocumentTemplateUncheckedCreateInput = {
      companyId,
      createdBy: userId,
      documentType: data.documentType,
      name: data.name,
      htmlTemplate: data.htmlTemplate,
      description: data.description ?? null,
      headerHtml: data.headerHtml ?? null,
      footerHtml: data.footerHtml ?? null,
      cssStyles: data.cssStyles ?? null,
      pageSize: data.pageSize ?? 'A4',
      orientation: data.orientation ?? 'portrait',
      marginTop: data.marginTop ?? 20,
      marginBottom: data.marginBottom ?? 20,
      marginLeft: data.marginLeft ?? 15,
      marginRight: data.marginRight ?? 15,
      showLogo: data.showLogo ?? true,
      logoPosition: data.logoPosition ?? 'top-left',
      showBankDetails: data.showBankDetails ?? true,
      showVatNumber: data.showVatNumber ?? true,
      showCompanyReg: data.showCompanyReg ?? true,
      isDefault: data.isDefault ?? false,
    };

    try {
      if (data.isDefault) {
        // Wrap in serializable transaction to prevent concurrent isDefault race
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.documentTemplate.updateMany({
              where: {
                companyId,
                documentType: data.documentType,
                isDefault: true,
              },
              data: { isDefault: false },
            });

            return tx.documentTemplate.create({ data: createData });
          },
          { isolationLevel: 'Serializable' },
        );
      }

      return await this.prisma.documentTemplate.create({ data: createData });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new DomainError(
          'TEMPLATE_NAME_EXISTS',
          'A template with this name already exists for this document type',
        );
      }
      throw err;
    }
  }

  /**
   * Partial update of a template. If isDefault is changed to true, unsets
   * any existing default for the same [companyId, documentType] in a transaction.
   * Returns null if template doesn't exist or belongs to a different company.
   */
  async updateTemplate(
    companyId: string,
    templateId: string,
    data: UpdateTemplateInput,
  ): Promise<DocumentTemplate | null> {
    // Verify template exists and belongs to company
    const existing = await this.prisma.documentTemplate.findFirst({
      where: { id: templateId, companyId },
    });
    if (!existing) return null;

    // Build update data — only include provided fields
    const updateData: Prisma.DocumentTemplateUncheckedUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.htmlTemplate !== undefined) updateData.htmlTemplate = data.htmlTemplate;
    if (data.headerHtml !== undefined) updateData.headerHtml = data.headerHtml;
    if (data.footerHtml !== undefined) updateData.footerHtml = data.footerHtml;
    if (data.cssStyles !== undefined) updateData.cssStyles = data.cssStyles;
    if (data.pageSize !== undefined) updateData.pageSize = data.pageSize;
    if (data.orientation !== undefined) updateData.orientation = data.orientation;
    if (data.marginTop !== undefined) updateData.marginTop = data.marginTop;
    if (data.marginBottom !== undefined) updateData.marginBottom = data.marginBottom;
    if (data.marginLeft !== undefined) updateData.marginLeft = data.marginLeft;
    if (data.marginRight !== undefined) updateData.marginRight = data.marginRight;
    if (data.showLogo !== undefined) updateData.showLogo = data.showLogo;
    if (data.logoPosition !== undefined) updateData.logoPosition = data.logoPosition;
    if (data.showBankDetails !== undefined) updateData.showBankDetails = data.showBankDetails;
    if (data.showVatNumber !== undefined) updateData.showVatNumber = data.showVatNumber;
    if (data.showCompanyReg !== undefined) updateData.showCompanyReg = data.showCompanyReg;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    try {
      if (data.isDefault === true) {
        // Wrap in serializable transaction to prevent concurrent isDefault race
        return await this.prisma.$transaction(
          async (tx) => {
            await tx.documentTemplate.updateMany({
              where: {
                companyId,
                documentType: existing.documentType,
                isDefault: true,
                id: { not: templateId },
              },
              data: { isDefault: false },
            });

            return tx.documentTemplate.update({
              where: { id: templateId, companyId },
              data: updateData,
            });
          },
          { isolationLevel: 'Serializable' },
        );
      }

      return await this.prisma.documentTemplate.update({
        where: { id: templateId, companyId },
        data: updateData,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new DomainError(
          'TEMPLATE_NAME_EXISTS',
          'A template with this name already exists for this document type',
        );
      }
      throw err;
    }
  }

  /**
   * Soft-delete a template by setting isActive = false.
   * Returns false if template doesn't exist or belongs to a different company.
   */
  async softDeleteTemplate(companyId: string, templateId: string): Promise<boolean> {
    const existing = await this.prisma.documentTemplate.findFirst({
      where: { id: templateId, companyId },
    });
    if (!existing) return false;

    // Clear isDefault when soft-deleting a default template to prevent stale data
    await this.prisma.documentTemplate.update({
      where: { id: templateId, companyId },
      data: { isActive: false, ...(existing.isDefault ? { isDefault: false } : {}) },
    });

    this.logger.info(
      { companyId, templateId, wasDefault: existing.isDefault },
      'document-template: soft-deleted',
    );

    return true;
  }

  // -------------------------------------------------------------------------
  // Version CRUD Methods (E12-2 Task 4)
  // -------------------------------------------------------------------------

  /**
   * Create a new version for a template.
   * Verifies the template exists and belongs to the company before creating.
   * Returns null if template not found or belongs to a different company.
   */
  async createVersion(
    companyId: string,
    templateId: string,
    data: CreateVersionInput,
  ): Promise<DocumentTemplateVersion | null> {
    // Verify template ownership
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id: templateId, companyId },
    });
    if (!template) return null;

    const version = await this.prisma.documentTemplateVersion.create({
      data: {
        templateId,
        languageCode: data.languageCode ?? null,
        branchCode: data.branchCode ?? null,
        numberSeriesId: data.numberSeriesId ?? null,
        accessGroup: data.accessGroup ?? null,
        customerGroupId: data.customerGroupId ?? null,
        htmlOverride: data.htmlOverride ?? null,
        cssOverride: data.cssOverride ?? null,
        headerOverride: data.headerOverride ?? null,
        footerOverride: data.footerOverride ?? null,
        emailSubject: data.emailSubject ?? null,
        emailBody: data.emailBody ?? null,
        replyToEmail: data.replyToEmail ?? null,
        ccEmails: data.ccEmails ?? null,
        priority: data.priority ?? 0,
        isActive: data.isActive ?? true,
      },
    });

    this.logger.info(
      { companyId, templateId, versionId: version.id },
      'document-template: version created',
    );

    return version;
  }

  /**
   * Partial update of a template version.
   * Verifies the ownership chain: template belongs to company, version belongs to template.
   * Returns null if any check fails.
   */
  async updateVersion(
    companyId: string,
    templateId: string,
    versionId: string,
    data: UpdateVersionInput,
  ): Promise<DocumentTemplateVersion | null> {
    // Verify template ownership
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id: templateId, companyId },
    });
    if (!template) return null;

    // Verify version belongs to template
    const existing = await this.prisma.documentTemplateVersion.findFirst({
      where: { id: versionId, templateId },
    });
    if (!existing) return null;

    // Build update data — only include provided fields
    const updateData: Prisma.DocumentTemplateVersionUncheckedUpdateInput = {};
    if (data.languageCode !== undefined) updateData.languageCode = data.languageCode;
    if (data.branchCode !== undefined) updateData.branchCode = data.branchCode;
    if (data.numberSeriesId !== undefined) updateData.numberSeriesId = data.numberSeriesId;
    if (data.accessGroup !== undefined) updateData.accessGroup = data.accessGroup;
    if (data.customerGroupId !== undefined) updateData.customerGroupId = data.customerGroupId;
    if (data.htmlOverride !== undefined) updateData.htmlOverride = data.htmlOverride;
    if (data.cssOverride !== undefined) updateData.cssOverride = data.cssOverride;
    if (data.headerOverride !== undefined) updateData.headerOverride = data.headerOverride;
    if (data.footerOverride !== undefined) updateData.footerOverride = data.footerOverride;
    if (data.emailSubject !== undefined) updateData.emailSubject = data.emailSubject;
    if (data.emailBody !== undefined) updateData.emailBody = data.emailBody;
    if (data.replyToEmail !== undefined) updateData.replyToEmail = data.replyToEmail;
    if (data.ccEmails !== undefined) updateData.ccEmails = data.ccEmails;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const version = await this.prisma.documentTemplateVersion.update({
      where: { id: versionId, templateId },
      data: updateData,
    });

    this.logger.info({ companyId, templateId, versionId }, 'document-template: version updated');

    return version;
  }

  /**
   * Hard-delete a template version.
   * Verifies the ownership chain: template belongs to company, version belongs to template.
   * Returns false if any check fails.
   */
  async deleteVersion(companyId: string, templateId: string, versionId: string): Promise<boolean> {
    // Verify template ownership
    const template = await this.prisma.documentTemplate.findFirst({
      where: { id: templateId, companyId },
    });
    if (!template) return false;

    // Verify version belongs to template
    const existing = await this.prisma.documentTemplateVersion.findFirst({
      where: { id: versionId, templateId },
    });
    if (!existing) return false;

    await this.prisma.documentTemplateVersion.delete({
      where: { id: versionId, templateId },
    });

    this.logger.info({ companyId, templateId, versionId }, 'document-template: version deleted');

    return true;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Select the best version from a list of active versions using match scoring.
   * Returns null if no versions exist or all score negatively.
   */
  private selectBestVersion(
    versions: DocumentTemplateVersion[],
    context: VersionSelectionContext,
  ): DocumentTemplateVersion | null {
    if (versions.length === 0) {
      return null;
    }

    // Score all versions
    const scored = versions.map((version) => ({
      version,
      score: this.calculateMatchScore(version, context),
    }));

    // Sort by score (desc), then priority (desc) as tiebreaker
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.version.priority - a.version.priority;
    });

    const best = scored[0]!;

    // If the best score is negative, fall back to base template (no version)
    if (best.score < 0) {
      this.logger.debug(
        { bestScore: best.score, versionId: best.version.id },
        'document-template: all versions scored negatively, using base template',
      );
      return null;
    }

    this.logger.debug(
      { versionId: best.version.id, score: best.score, priority: best.version.priority },
      'document-template: version selected',
    );

    return best.version;
  }

  /**
   * Merge version overrides with base template fields (Task 4.4 — AC #8).
   *
   * Non-null override fields replace the corresponding base template fields.
   * Null overrides leave the base template field unchanged.
   */
  private mergeTemplateVersion(
    template: DocumentTemplate,
    version: DocumentTemplateVersion | null,
  ): ResolvedTemplate {
    if (!version) {
      return {
        template,
        version: null,
        mergedHtml: template.htmlTemplate,
        mergedCss: template.cssStyles,
        mergedHeader: template.headerHtml,
        mergedFooter: template.footerHtml,
        emailSettings: null,
      };
    }

    return {
      template,
      version,
      mergedHtml: version.htmlOverride ?? template.htmlTemplate,
      mergedCss: version.cssOverride ?? template.cssStyles,
      mergedHeader: version.headerOverride ?? template.headerHtml,
      mergedFooter: version.footerOverride ?? template.footerHtml,
      emailSettings: {
        emailSubject: version.emailSubject,
        emailBody: version.emailBody,
        replyToEmail: version.replyToEmail,
        ccEmails: version.ccEmails,
      },
    };
  }
}
