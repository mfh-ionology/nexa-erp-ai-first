// ---------------------------------------------------------------------------
// AdminSkillService — CRUD for AI skills (admin-only)
// E5c-4 Task 3: AC #3, #4, #6
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import { Prisma } from '@nexa/db';
import type { Logger } from 'pino';
import { AppError } from '../../core/errors/app-error.js';
import { NotFoundError } from '../../core/errors/not-found-error.js';
import type { PaginationMeta } from '../../core/utils/response.js';
import type { CreateSkillInput, UpdateSkillInput, ListSkillsQuery } from './admin.schemas.js';

// ─── Response types ────────────────────────────────────────────────────────

export interface SkillListItem {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  category: string;
  moduleKey: string | null;
  packKey: string | null;
  triggerPhrases: string[];
  negativeTriggers: string[];
  orchestrationPattern: string | null;
  priority: number;
  version: number;
  isActive: boolean;
  outputType: string;
  requiredToolCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SkillDetail extends SkillListItem {
  skillContent: string;
  inputSchema: unknown;
  requiredTools: string[];
  contextRequired: string[];
  parameters: unknown;
  examples: unknown;
  contextCount: number;
  overrideCount: number;
}

export interface SkillGroup {
  moduleKey: string | null;
  skills: SkillListItem[];
}

export interface SkillsGroupedResponse {
  groups: SkillGroup[];
  totalCount: number;
}

// ─── Service ───────────────────────────────────────────────────────────────

export class AdminSkillService {
  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
  ) {}

  // ─── List ──────────────────────────────────────────────────────────────

  async listSkills(
    query: ListSkillsQuery,
  ): Promise<{ data: SkillListItem[]; meta: PaginationMeta }> {
    const where = this.buildWhereClause(query);

    const [rows, total] = await Promise.all([
      this.db.aiSkill.findMany({
        where,
        take: query.limit + 1,
        ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
        orderBy: [{ moduleKey: 'asc' }, { priority: 'desc' }, { name: 'asc' }],
      }),
      this.db.aiSkill.count({ where }),
    ]);

    const hasMore = rows.length > query.limit;
    const data = hasMore ? rows.slice(0, -1) : rows;
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1]!.id : undefined;

    return {
      data: data.map((row) => this.toListItem(row)),
      meta: { cursor: nextCursor, hasMore, total },
    };
  }

  // ─── List Grouped ─────────────────────────────────────────────────────

  async listSkillsGrouped(query: ListSkillsQuery): Promise<SkillsGroupedResponse> {
    const where = this.buildWhereClause(query);

    // Safety limit — grouped view fetches all skills for the accordion UI
    // but caps at 500 to prevent unbounded queries
    const MAX_GROUPED_RESULTS = 500;

    const rows = await this.db.aiSkill.findMany({
      where,
      take: MAX_GROUPED_RESULTS,
      orderBy: [{ moduleKey: 'asc' }, { priority: 'desc' }, { name: 'asc' }],
    });

    // Group by moduleKey
    const groupMap = new Map<string | null, SkillListItem[]>();
    for (const row of rows) {
      const key = row.moduleKey;
      const existing = groupMap.get(key);
      if (existing) {
        existing.push(this.toListItem(row));
      } else {
        groupMap.set(key, [this.toListItem(row)]);
      }
    }

    // Build sorted groups: alphabetical by moduleKey, null last
    const groups: SkillGroup[] = [];
    const sortedKeys = [...groupMap.keys()].sort((a, b) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return a.localeCompare(b);
    });

    for (const key of sortedKeys) {
      groups.push({
        moduleKey: key,
        skills: groupMap.get(key)!,
      });
    }

    return {
      groups,
      totalCount: rows.length,
    };
  }

  // ─── Get ───────────────────────────────────────────────────────────────

  async getSkill(id: string): Promise<SkillDetail> {
    const skill = await this.db.aiSkill.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            contexts: true,
            overrides: true,
          },
        },
      },
    });

    if (!skill) {
      throw new NotFoundError('SKILL_NOT_FOUND', `AI skill with id "${id}" not found`);
    }

    return {
      ...this.toListItem(skill),
      skillContent: skill.skillContent,
      inputSchema: skill.inputSchema,
      requiredTools: skill.requiredTools,
      contextRequired: skill.contextRequired,
      parameters: skill.parameters,
      examples: skill.examples,
      contextCount: skill._count.contexts,
      overrideCount: skill._count.overrides,
    };
  }

  // ─── Create ────────────────────────────────────────────────────────────

  async createSkill(input: CreateSkillInput): Promise<SkillDetail> {
    try {
      const skill = await this.db.aiSkill.create({
        data: {
          name: input.name,
          displayName: input.displayName,
          description: input.description ?? null,
          category: input.category,
          skillContent: input.skillContent,
          triggerPhrases: input.triggerPhrases,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
          inputSchema: input.inputSchema as any,
          outputType: input.outputType,
          requiredTools: input.requiredTools,
          isActive: input.isActive,
          moduleKey: input.moduleKey ?? null,
          packKey: input.packKey ?? null,
          negativeTriggers: input.negativeTriggers,
          contextRequired: input.contextRequired,
          orchestrationPattern: input.orchestrationPattern ?? null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
          parameters: (input.parameters as any) ?? Prisma.DbNull,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
          examples: (input.examples as any) ?? Prisma.DbNull,
          priority: input.priority,
        },
      });

      this.logger.info({ skillId: skill.id, skillName: skill.name }, 'AI skill created');

      return this.getSkill(skill.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(
          'SKILL_NAME_CONFLICT',
          `A skill with name "${input.name}" already exists`,
          409,
        );
      }
      throw error;
    }
  }

  // ─── Update ────────────────────────────────────────────────────────────

  async updateSkill(id: string, input: UpdateSkillInput): Promise<SkillDetail> {
    // Load current skill to verify it exists
    const current = await this.db.aiSkill.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundError('SKILL_NOT_FOUND', `AI skill with id "${id}" not found`);
    }

    // Build Prisma update data — only include fields that were provided
    const data: Prisma.AiSkillUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.displayName !== undefined) data.displayName = input.displayName;
    if (input.description !== undefined) data.description = input.description;
    if (input.category !== undefined) data.category = input.category;
    if (input.skillContent !== undefined) data.skillContent = input.skillContent;
    if (input.triggerPhrases !== undefined) data.triggerPhrases = input.triggerPhrases;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
    if (input.inputSchema !== undefined) data.inputSchema = input.inputSchema as any;
    if (input.outputType !== undefined) data.outputType = input.outputType;
    if (input.requiredTools !== undefined) data.requiredTools = input.requiredTools;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.moduleKey !== undefined) data.moduleKey = input.moduleKey;
    if (input.packKey !== undefined) data.packKey = input.packKey;
    if (input.negativeTriggers !== undefined) data.negativeTriggers = input.negativeTriggers;
    if (input.contextRequired !== undefined) data.contextRequired = input.contextRequired;
    if (input.orchestrationPattern !== undefined)
      data.orchestrationPattern = input.orchestrationPattern;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
    if (input.parameters !== undefined)
      data.parameters = input.parameters === null ? Prisma.DbNull : (input.parameters as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
    if (input.examples !== undefined)
      data.examples = input.examples === null ? Prisma.DbNull : (input.examples as any);
    if (input.priority !== undefined) data.priority = input.priority;

    // Auto-increment version atomically when substantive content changes
    const contentChanged =
      input.skillContent !== undefined ||
      input.triggerPhrases !== undefined ||
      input.inputSchema !== undefined ||
      input.requiredTools !== undefined;
    if (contentChanged) {
      data.version = { increment: 1 };
    }

    try {
      await this.db.aiSkill.update({ where: { id }, data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const conflictName = input.name ?? current.name;
        throw new AppError(
          'SKILL_NAME_CONFLICT',
          `A skill with name "${conflictName}" already exists`,
          409,
        );
      }
      throw error;
    }

    this.logger.info({ skillId: id }, 'AI skill updated');

    return this.getSkill(id);
  }

  // ─── Delete (soft-delete) ─────────────────────────────────────────────

  async deleteSkill(id: string): Promise<SkillDetail> {
    const skill = await this.db.aiSkill.findUnique({ where: { id } });

    if (!skill) {
      throw new NotFoundError('SKILL_NOT_FOUND', `AI skill with id "${id}" not found`);
    }

    // Soft-delete: set isActive=false (NOT hard delete)
    await this.db.aiSkill.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.info({ skillId: id, skillName: skill.name }, 'AI skill soft-deleted (deactivated)');

    return this.getSkill(id);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private buildWhereClause(query: ListSkillsQuery): Prisma.AiSkillWhereInput {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic where clause
    const where: any = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.moduleKey) {
      where.moduleKey = query.moduleKey;
    }
    if (query.category) {
      where.category = query.category;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { displayName: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma model type
  private toListItem(row: any): SkillListItem {
    return {
      id: row.id,
      name: row.name,
      displayName: row.displayName,
      description: row.description,
      category: row.category,
      moduleKey: row.moduleKey,
      packKey: row.packKey,
      triggerPhrases: row.triggerPhrases,
      negativeTriggers: row.negativeTriggers,
      orchestrationPattern: row.orchestrationPattern,
      priority: row.priority,
      version: row.version,
      isActive: row.isActive,
      outputType: row.outputType,
      requiredToolCount: Array.isArray(row.requiredTools) ? row.requiredTools.length : 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
