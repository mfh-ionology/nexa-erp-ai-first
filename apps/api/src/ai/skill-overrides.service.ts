// ---------------------------------------------------------------------------
// SkillOverrideService — CRUD for tenant-scoped AI skill overrides
// E5b-2 Task 12.1
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import { NotFoundError } from '../core/errors/not-found-error.js';

// ─── Types ────────────────────────────────────────────────────────────────

export interface UpsertOverrideInput {
  isActive?: boolean | null;
  triggerPhrasesOverride?: string[];
  priorityOverride?: number | null;
}

export interface SkillOverrideRecord {
  id: string;
  skillId: string;
  companyId: string;
  isActive: boolean | null;
  triggerPhrasesOverride: string[];
  priorityOverride: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── SkillOverrideService ─────────────────────────────────────────────────

export class SkillOverrideService {
  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
  ) {}

  // ─── List ─────────────────────────────────────────────────────────────

  /**
   * List all skill overrides for a company.
   */
  async listOverrides(companyId: string): Promise<SkillOverrideRecord[]> {
    const overrides = await this.db.aiSkillOverride.findMany({
      where: { companyId },
      orderBy: [{ createdAt: 'desc' }],
    });

    return overrides.map((o) => this.toRecord(o));
  }

  // ─── Get ──────────────────────────────────────────────────────────────

  /**
   * Get a single override by skill ID + company ID.
   */
  async getOverride(skillId: string, companyId: string): Promise<SkillOverrideRecord | null> {
    const override = await this.db.aiSkillOverride.findUnique({
      where: { skillId_companyId: { skillId, companyId } },
    });

    return override ? this.toRecord(override) : null;
  }

  // ─── Upsert ─────────────────────────────────────────────────────────

  /**
   * Create or update an override for a skill + company pair.
   * Uses the unique constraint [skillId, companyId] for upsert.
   */
  async upsertOverride(
    skillId: string,
    companyId: string,
    input: UpsertOverrideInput,
  ): Promise<SkillOverrideRecord> {
    // Verify the skill exists
    const skill = await this.db.aiSkill.findUnique({ where: { id: skillId } });
    if (!skill) {
      throw new NotFoundError('SKILL_NOT_FOUND', 'Skill not found', 'ai.error.skillNotFound');
    }

    const data = {
      isActive: input.isActive ?? null,
      triggerPhrasesOverride: input.triggerPhrasesOverride ?? [],
      priorityOverride: input.priorityOverride ?? null,
    };

    const override = await this.db.aiSkillOverride.upsert({
      where: { skillId_companyId: { skillId, companyId } },
      create: {
        skillId,
        companyId,
        ...data,
      },
      update: data,
    });

    this.logger.info({ skillId, companyId, overrideId: override.id }, 'Skill override upserted');

    return this.toRecord(override);
  }

  // ─── Delete ─────────────────────────────────────────────────────────

  /**
   * Delete an override, reverting to system default for this skill + company.
   */
  async deleteOverride(skillId: string, companyId: string): Promise<boolean> {
    const existing = await this.db.aiSkillOverride.findUnique({
      where: { skillId_companyId: { skillId, companyId } },
    });
    if (!existing) return false;

    await this.db.aiSkillOverride.delete({
      where: { skillId_companyId: { skillId, companyId } },
    });

    this.logger.info({ skillId, companyId, overrideId: existing.id }, 'Skill override deleted');

    return true;
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma model return type
  private toRecord(override: any): SkillOverrideRecord {
    return {
      id: override.id,
      skillId: override.skillId,
      companyId: override.companyId,
      isActive: override.isActive,
      triggerPhrasesOverride: override.triggerPhrasesOverride,
      priorityOverride: override.priorityOverride,
      createdAt: override.createdAt,
      updatedAt: override.updatedAt,
    };
  }
}
