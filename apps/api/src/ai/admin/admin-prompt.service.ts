// ---------------------------------------------------------------------------
// AdminPromptService — CRUD + versioning for AI prompts (admin-only)
// E5c-3 Task 3: AC #4, #5, #6, #7
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import { Prisma } from '@nexa/db';
import type { Logger } from 'pino';
import { AppError } from '../../core/errors/app-error.js';
import { NotFoundError } from '../../core/errors/not-found-error.js';
import type { PaginationMeta } from '../../core/utils/response.js';
import type { PromptRenderer } from '../prompt-renderer.js';
import type {
  CreatePromptInput,
  UpdatePromptInput,
  ListPromptsQuery,
  TestPromptInput,
} from './admin.schemas.js';

// ─── Response types ────────────────────────────────────────────────────────

export interface PromptListItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  activeVersion: number;
  isActive: boolean;
  variableCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromptDetail extends PromptListItem {
  systemPrompt: string;
  userTemplate: string;
  parameters: unknown;
  outputFormat: unknown;
  variables: { id: string; variableName: string; displayName: string; sourceType: string }[];
  versionCount: number;
}

export interface PromptVersionItem {
  id: string;
  promptId: string;
  version: number;
  changeReason: string | null;
  createdBy: string;
  createdAt: string;
  snippet: string;
}

export interface PromptVersionDetail extends PromptVersionItem {
  systemPrompt: string;
  userTemplate: string;
  parameters: unknown;
}

export interface TestRenderResult {
  systemPrompt: string;
  userTemplate: string;
  resolvedVariables: Record<string, string>;
  unresolvedCount: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Canonical JSON stringify with sorted keys at every level for stable comparison */
function stableStringify(val: unknown): string {
  if (val === null || val === undefined) return JSON.stringify(val);
  if (Array.isArray(val)) return `[${val.map(stableStringify).join(',')}]`;
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    const sorted = Object.keys(obj).sort();
    return `{${sorted.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(val);
}

// ─── Service ───────────────────────────────────────────────────────────────

export class AdminPromptService {
  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
    private readonly promptRenderer: PromptRenderer,
  ) {}

  // ─── List (3.1) ─────────────────────────────────────────────────────────

  async listPrompts(
    query: ListPromptsQuery,
  ): Promise<{ data: PromptListItem[]; meta: PaginationMeta }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic where clause
    const where: any = {};

    if (query.category) {
      where.category = query.category;
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.db.aiPrompt.findMany({
        where,
        take: query.limit + 1,
        ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { variables: true } },
        },
      }),
      this.db.aiPrompt.count({ where }),
    ]);

    const hasMore = rows.length > query.limit;
    const data = hasMore ? rows.slice(0, -1) : rows;
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1]!.id : undefined;

    return {
      data: data.map((row) => this.toListItem(row, row._count.variables)),
      meta: { cursor: nextCursor, hasMore, total },
    };
  }

  // ─── Get (3.1) ──────────────────────────────────────────────────────────

  async getPrompt(id: string): Promise<PromptDetail> {
    const prompt = await this.db.aiPrompt.findUnique({
      where: { id },
      include: {
        _count: { select: { variables: true, versions: true } },
        variables: {
          select: { id: true, variableName: true, displayName: true, sourceType: true },
          orderBy: { variableName: 'asc' },
        },
      },
    });

    if (!prompt) {
      throw new NotFoundError('PROMPT_NOT_FOUND', `AI prompt with id "${id}" not found`);
    }

    return {
      ...this.toListItem(prompt, prompt._count.variables),
      systemPrompt: prompt.systemPrompt,
      userTemplate: prompt.userTemplate,
      parameters: prompt.parameters,
      outputFormat: prompt.outputFormat,
      variables: prompt.variables,
      versionCount: prompt._count.versions,
    };
  }

  // ─── Create (3.1) ──────────────────────────────────────────────────────

  async createPrompt(userId: string, input: CreatePromptInput): Promise<PromptDetail> {
    try {
      const prompt = await this.db.$transaction(async (tx) => {
        // Create the prompt
        const created = await tx.aiPrompt.create({
          data: {
            name: input.name,
            description: input.description ?? null,
            category: input.category,
            systemPrompt: input.systemPrompt,
            userTemplate: input.userTemplate,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
            parameters: input.parameters as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
            outputFormat: (input.outputFormat ?? null) as any,
            activeVersion: 1,
            isActive: input.isActive,
            createdBy: userId,
          },
        });

        // Create the initial version (v1)
        await tx.aiPromptVersion.create({
          data: {
            promptId: created.id,
            version: 1,
            systemPrompt: input.systemPrompt,
            userTemplate: input.userTemplate,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
            parameters: input.parameters as any,
            changeReason: 'Initial version',
            createdBy: userId,
          },
        });

        return created;
      });

      this.logger.info({ promptId: prompt.id, promptName: prompt.name }, 'AI prompt created');
      return this.getPrompt(prompt.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(
          'PROMPT_NAME_CONFLICT',
          `A prompt with name "${input.name}" already exists`,
          409,
        );
      }
      throw error;
    }
  }

  // ─── Update (3.1) ──────────────────────────────────────────────────────

  async updatePrompt(id: string, userId: string, input: UpdatePromptInput): Promise<PromptDetail> {
    const current = await this.db.aiPrompt.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundError('PROMPT_NOT_FOUND', `AI prompt with id "${id}" not found`);
    }

    // Determine if content fields changed (requires new version)
    const contentChanged =
      (input.systemPrompt !== undefined && input.systemPrompt !== current.systemPrompt) ||
      (input.userTemplate !== undefined && input.userTemplate !== current.userTemplate) ||
      (input.parameters !== undefined &&
        stableStringify(input.parameters) !== stableStringify(current.parameters));

    // Build update data — only include provided fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic Prisma update
    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.category !== undefined) data.category = input.category;
    if (input.systemPrompt !== undefined) data.systemPrompt = input.systemPrompt;
    if (input.userTemplate !== undefined) data.userTemplate = input.userTemplate;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
    if (input.parameters !== undefined) data.parameters = input.parameters as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
    if (input.outputFormat !== undefined) data.outputFormat = input.outputFormat as any;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    if (contentChanged) {
      // Content changed — changeReason is mandatory for versioned updates
      if (!input.changeReason?.trim()) {
        throw new AppError(
          'CHANGE_REASON_REQUIRED',
          'A change reason is required when modifying prompt content (systemPrompt, userTemplate, or parameters)',
          422,
        );
      }

      // Content changed — create a new version in a transaction
      // Compute nextVersion inside the transaction to avoid TOCTOU race
      let nextVersion: number;
      try {
        nextVersion = await this.db.$transaction(async (tx) => {
          const maxResult = await tx.aiPromptVersion.aggregate({
            where: { promptId: id },
            _max: { version: true },
          });
          const newVersion = (maxResult._max.version ?? 0) + 1;

          // Create new version with snapshots of new content
          await tx.aiPromptVersion.create({
            data: {
              promptId: id,
              version: newVersion,
              systemPrompt: input.systemPrompt ?? current.systemPrompt,
              userTemplate: input.userTemplate ?? current.userTemplate,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
              parameters: (input.parameters ?? current.parameters) as any,
              changeReason: input.changeReason,
              createdBy: userId,
            },
          });

          // Update the prompt with new content + bump activeVersion
          const updateData = { ...data, activeVersion: newVersion };
          await tx.aiPrompt.update({ where: { id }, data: updateData });

          return newVersion;
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new AppError(
            'VERSION_CONFLICT',
            'Another update was saved simultaneously. Please retry.',
            409,
          );
        }
        throw error;
      }

      this.logger.info(
        { promptId: id, newVersion: nextVersion },
        'AI prompt updated with new version',
      );
    } else {
      // Metadata-only change — no new version
      try {
        await this.db.aiPrompt.update({ where: { id }, data });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new AppError(
            'PROMPT_NAME_CONFLICT',
            `A prompt with name "${input.name}" already exists`,
            409,
          );
        }
        throw error;
      }

      this.logger.info({ promptId: id }, 'AI prompt metadata updated (no new version)');
    }

    return this.getPrompt(id);
  }

  // ─── Delete (3.1) ──────────────────────────────────────────────────────

  async deletePrompt(id: string): Promise<void> {
    const prompt = await this.db.aiPrompt.findUnique({
      where: { id },
      include: { _count: { select: { agents: true } } },
    });

    if (!prompt) {
      throw new NotFoundError('PROMPT_NOT_FOUND', `AI prompt with id "${id}" not found`);
    }

    if (prompt._count.agents > 0) {
      throw new AppError(
        'PROMPT_REFERENCED_BY_AGENTS',
        `This prompt is referenced by ${prompt._count.agents} agent${prompt._count.agents === 1 ? '' : 's'}. Remove agent references first.`,
        422,
      );
    }

    // Delete in a transaction — AiPromptVersion lacks onDelete:Cascade in schema,
    // so we must explicitly delete versions (and variables, defensively) first.
    await this.db.$transaction(async (tx) => {
      await tx.aiPromptVersion.deleteMany({ where: { promptId: id } });
      await tx.aiPromptVariable.deleteMany({ where: { promptId: id } });
      await tx.aiPrompt.delete({ where: { id } });
    });
    this.logger.info({ promptId: id, promptName: prompt.name }, 'AI prompt deleted');
  }

  // ─── Version Management (3.2) ──────────────────────────────────────────

  async listVersions(promptId: string): Promise<PromptVersionItem[]> {
    // Ensure prompt exists
    const prompt = await this.db.aiPrompt.findUnique({
      where: { id: promptId },
      select: { id: true },
    });
    if (!prompt) {
      throw new NotFoundError('PROMPT_NOT_FOUND', `AI prompt with id "${promptId}" not found`);
    }

    const versions = await this.db.aiPromptVersion.findMany({
      where: { promptId },
      orderBy: { version: 'desc' },
    });

    return versions.map((v) => ({
      id: v.id,
      promptId: v.promptId,
      version: v.version,
      changeReason: v.changeReason,
      createdBy: v.createdBy,
      createdAt: v.createdAt.toISOString(),
      snippet: v.systemPrompt.slice(0, 100),
    }));
  }

  async getVersion(promptId: string, version: number): Promise<PromptVersionDetail> {
    const row = await this.db.aiPromptVersion.findUnique({
      where: { promptId_version: { promptId, version } },
    });

    if (!row) {
      throw new NotFoundError(
        'VERSION_NOT_FOUND',
        `Version ${version} not found for prompt "${promptId}"`,
      );
    }

    return {
      id: row.id,
      promptId: row.promptId,
      version: row.version,
      changeReason: row.changeReason,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      snippet: row.systemPrompt.slice(0, 100),
      systemPrompt: row.systemPrompt,
      userTemplate: row.userTemplate,
      parameters: row.parameters,
    };
  }

  async restoreVersion(
    promptId: string,
    version: number,
    userId: string,
  ): Promise<PromptVersionDetail> {
    // Load the version to restore
    const oldVersion = await this.db.aiPromptVersion.findUnique({
      where: { promptId_version: { promptId, version } },
    });
    if (!oldVersion) {
      throw new NotFoundError(
        'VERSION_NOT_FOUND',
        `Version ${version} not found for prompt "${promptId}"`,
      );
    }

    const changeReason = `Restored from version ${version}`;

    const newVersion = await this.db.$transaction(async (tx) => {
      // Compute nextVersion inside the transaction to avoid TOCTOU race
      const maxResult = await tx.aiPromptVersion.aggregate({
        where: { promptId },
        _max: { version: true },
      });
      const nextVersion = (maxResult._max.version ?? 0) + 1;

      // Create a new version copying old content
      const created = await tx.aiPromptVersion.create({
        data: {
          promptId,
          version: nextVersion,
          systemPrompt: oldVersion.systemPrompt,
          userTemplate: oldVersion.userTemplate,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
          parameters: oldVersion.parameters as any,
          changeReason,
          createdBy: userId,
        },
      });

      // Update prompt: bump activeVersion + set content to restored version
      await tx.aiPrompt.update({
        where: { id: promptId },
        data: {
          activeVersion: nextVersion,
          systemPrompt: oldVersion.systemPrompt,
          userTemplate: oldVersion.userTemplate,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
          parameters: oldVersion.parameters as any,
        },
      });

      return created;
    });

    this.logger.info(
      { promptId, restoredFrom: version, newVersion: newVersion.version },
      'AI prompt version restored',
    );

    return {
      id: newVersion.id,
      promptId: newVersion.promptId,
      version: newVersion.version,
      changeReason: newVersion.changeReason,
      createdBy: newVersion.createdBy,
      createdAt: newVersion.createdAt.toISOString(),
      snippet: newVersion.systemPrompt.slice(0, 100),
      systemPrompt: newVersion.systemPrompt,
      userTemplate: newVersion.userTemplate,
      parameters: newVersion.parameters,
    };
  }

  // ─── Test Render (3.3) ─────────────────────────────────────────────────

  async testRender(
    promptId: string,
    context: TestPromptInput,
    callerCompanyId: string,
    callerUserId: string,
  ): Promise<TestRenderResult> {
    // Verify prompt exists
    const prompt = await this.db.aiPrompt.findUnique({
      where: { id: promptId },
      select: { id: true },
    });
    if (!prompt) {
      throw new NotFoundError('PROMPT_NOT_FOUND', `AI prompt with id "${promptId}" not found`);
    }

    // Use the PromptRenderer to render with the provided sample context
    const result = await this.promptRenderer.render(promptId, {
      companyId: callerCompanyId,
      userId: callerUserId,
      entityId: context.entityId,
      entityType: context.entityType,
      pageContext: context.sampleVariables as Record<string, unknown> | undefined,
    });

    return {
      systemPrompt: result.systemPrompt,
      userTemplate: result.userTemplate,
      resolvedVariables: result.resolvedVariables,
      unresolvedCount: result.unresolvedCount,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma model type
  private toListItem(row: any, variableCount: number): PromptListItem {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      activeVersion: row.activeVersion,
      isActive: row.isActive,
      variableCount,
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
