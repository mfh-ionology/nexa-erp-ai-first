// ---------------------------------------------------------------------------
// SkillsService — CRUD for AI skills with tenant override merging
// E5b-2 Task 10.1
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import { Prisma } from '@nexa/db';
import type { Logger } from 'pino';
import { AppError } from '../core/errors/app-error.js';

// ─── Types ────────────────────────────────────────────────────────────────

export interface CreateSkillInput {
  name: string;
  displayName: string;
  description?: string;
  category: string;
  skillContent: string;
  triggerPhrases: string[];
  inputSchema: Record<string, unknown>;
  outputType: string;
  requiredTools: string[];
  isActive?: boolean;
  moduleKey?: string;
  packKey?: string;
  negativeTriggers?: string[];
  contextRequired?: string[];
  parameters?: Record<string, unknown>;
  examples?: Array<{ input: string; output: string }>;
  priority?: number;
  orchestrationPattern?: string;
  version?: number;
}

export interface UpdateSkillInput {
  name?: string;
  displayName?: string;
  description?: string | null;
  category?: string;
  skillContent?: string;
  triggerPhrases?: string[];
  inputSchema?: Record<string, unknown>;
  outputType?: string;
  requiredTools?: string[];
  isActive?: boolean;
  moduleKey?: string | null;
  packKey?: string | null;
  negativeTriggers?: string[];
  contextRequired?: string[];
  parameters?: Record<string, unknown> | null;
  examples?: Array<{ input: string; output: string }> | null;
  priority?: number;
  orchestrationPattern?: string | null;
  version?: number;
}

export interface SkillRecord {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  category: string;
  skillContent: string;
  triggerPhrases: string[];
  inputSchema: unknown;
  outputType: string;
  requiredTools: string[];
  isActive: boolean;
  moduleKey: string | null;
  packKey: string | null;
  negativeTriggers: string[];
  contextRequired: string[];
  parameters: unknown;
  examples: unknown;
  priority: number;
  orchestrationPattern: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

// ─── SkillsService ────────────────────────────────────────────────────────

export class SkillsService {
  private onSkillMutated?: () => void;

  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
  ) {}

  /**
   * Set a callback to be invoked when skills are created, updated, or deleted.
   * Used to invalidate the SkillRouter's module summary cache.
   */
  setMutationCallback(callback: () => void): void {
    this.onSkillMutated = callback;
  }

  // ─── List ─────────────────────────────────────────────────────────────

  /**
   * List skills with optional moduleKey filter, applying tenant overrides.
   * Returns ALL skills (including override-disabled ones) so admins can manage
   * them. The override's isActive value is merged into the record for visibility.
   * Trigger phrase and priority overrides replace defaults.
   */
  async listSkills(
    companyId: string,
    filters: { moduleKey?: string } = {},
  ): Promise<SkillRecord[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic where clause
    const where: any = {};
    if (filters.moduleKey) {
      where.moduleKey = filters.moduleKey;
    }

    const skills = await this.db.aiSkill.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    });

    // Load overrides for this company
    const skillIds = skills.map((s) => s.id);
    const overrides =
      skillIds.length > 0
        ? await this.db.aiSkillOverride.findMany({
            where: { companyId, skillId: { in: skillIds } },
          })
        : [];

    const overrideMap = new Map(overrides.map((o) => [o.skillId, o]));

    // Merge overrides into skills — CRUD listing includes ALL skills so admins
    // can see and re-enable override-disabled skills
    const result: SkillRecord[] = [];
    for (const skill of skills) {
      const override = overrideMap.get(skill.id);
      result.push(this.toRecord(skill, override));
    }

    return result;
  }

  // ─── Get ──────────────────────────────────────────────────────────────

  /**
   * Get a single skill by ID with tenant override applied.
   */
  async getSkill(id: string, companyId: string): Promise<SkillRecord | null> {
    const skill = await this.db.aiSkill.findUnique({ where: { id } });
    if (!skill) return null;

    // Load override for this company — CRUD endpoint returns disabled skills
    // with isActive: false so admins can see and re-enable them
    const override = await this.db.aiSkillOverride.findUnique({
      where: { skillId_companyId: { skillId: id, companyId } },
    });

    return this.toRecord(skill, override);
  }

  // ─── Create ───────────────────────────────────────────────────────────

  /**
   * Create a new skill. Admin only.
   */
  async createSkill(input: CreateSkillInput): Promise<SkillRecord> {
    let skill;
    try {
      skill = await this.db.aiSkill.create({
        data: {
          name: input.name,
          displayName: input.displayName,
          description: input.description,
          category: input.category,
          skillContent: input.skillContent,
          triggerPhrases: input.triggerPhrases,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
          inputSchema: input.inputSchema as any,
          outputType: input.outputType,
          requiredTools: input.requiredTools,
          isActive: input.isActive ?? true,
          moduleKey: input.moduleKey,
          packKey: input.packKey,
          negativeTriggers: input.negativeTriggers ?? [],
          contextRequired: input.contextRequired ?? [],
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
          parameters: (input.parameters ?? null) as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
          examples: (input.examples ?? null) as any,
          priority: input.priority ?? 100,
          orchestrationPattern: input.orchestrationPattern ?? null,
          version: input.version ?? 1,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(
          'SKILL_NAME_CONFLICT',
          `Skill with name "${input.name}" already exists`,
          409,
        );
      }
      throw error;
    }

    this.logger.info({ skillId: skill.id, name: skill.name }, 'Skill created');

    this.onSkillMutated?.();
    return this.toRecord(skill);
  }

  // ─── Update ───────────────────────────────────────────────────────────

  /**
   * Update an existing skill. Admin only.
   */
  async updateSkill(id: string, input: UpdateSkillInput): Promise<SkillRecord | null> {
    const existing = await this.db.aiSkill.findUnique({ where: { id } });
    if (!existing) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic update data
    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.displayName !== undefined) data.displayName = input.displayName;
    if (input.description !== undefined) data.description = input.description;
    if (input.category !== undefined) data.category = input.category;
    if (input.skillContent !== undefined) data.skillContent = input.skillContent;
    if (input.triggerPhrases !== undefined) data.triggerPhrases = input.triggerPhrases;
    if (input.inputSchema !== undefined) data.inputSchema = input.inputSchema;
    if (input.outputType !== undefined) data.outputType = input.outputType;
    if (input.requiredTools !== undefined) data.requiredTools = input.requiredTools;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.moduleKey !== undefined) data.moduleKey = input.moduleKey;
    if (input.packKey !== undefined) data.packKey = input.packKey;
    if (input.negativeTriggers !== undefined) data.negativeTriggers = input.negativeTriggers;
    if (input.contextRequired !== undefined) data.contextRequired = input.contextRequired;
    if (input.parameters !== undefined) data.parameters = input.parameters;
    if (input.examples !== undefined) data.examples = input.examples;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.orchestrationPattern !== undefined)
      data.orchestrationPattern = input.orchestrationPattern;
    if (input.version !== undefined) data.version = input.version;

    let skill;
    try {
      skill = await this.db.aiSkill.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(
          'SKILL_NAME_CONFLICT',
          `Skill with name "${data.name}" already exists`,
          409,
        );
      }
      throw error;
    }

    this.logger.info({ skillId: skill.id, name: skill.name }, 'Skill updated');

    this.onSkillMutated?.();
    return this.toRecord(skill);
  }

  // ─── Delete ───────────────────────────────────────────────────────────

  /**
   * Delete a skill. Admin only.
   */
  async deleteSkill(id: string): Promise<boolean> {
    const existing = await this.db.aiSkill.findUnique({ where: { id } });
    if (!existing) return false;

    await this.db.aiSkill.delete({ where: { id } });

    this.logger.info({ skillId: id, name: existing.name }, 'Skill deleted');

    this.onSkillMutated?.();
    return true;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma model return types + optional override
  private toRecord(skill: any, override?: any): SkillRecord {
    return {
      id: skill.id,
      name: skill.name,
      displayName: skill.displayName,
      description: skill.description,
      category: skill.category,
      skillContent: skill.skillContent,
      triggerPhrases:
        override?.triggerPhrasesOverride && override.triggerPhrasesOverride.length > 0
          ? override.triggerPhrasesOverride
          : skill.triggerPhrases,
      inputSchema: skill.inputSchema,
      outputType: skill.outputType,
      requiredTools: skill.requiredTools,
      isActive: override?.isActive ?? skill.isActive,
      moduleKey: skill.moduleKey,
      packKey: skill.packKey,
      negativeTriggers: skill.negativeTriggers,
      contextRequired: skill.contextRequired,
      parameters: skill.parameters,
      examples: skill.examples,
      priority: override?.priorityOverride ?? skill.priority,
      orchestrationPattern: skill.orchestrationPattern ?? null,
      version: skill.version ?? 1,
      createdAt: skill.createdAt,
      updatedAt: skill.updatedAt,
    };
  }
}
