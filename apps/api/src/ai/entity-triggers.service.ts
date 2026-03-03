// ---------------------------------------------------------------------------
// EntityTriggerService — CRUD for AI entity triggers
// E5b-2 Task 11.4
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import { Prisma } from '@nexa/db';
import type { Logger } from 'pino';
import { AppError } from '../core/errors/app-error.js';

// ─── Types ────────────────────────────────────────────────────────────────

export interface CreateTriggerInput {
  moduleKey: string;
  triggerWord: string;
  entityType: string;
  searchEndpoint: string;
  displayField: string;
  subtitleField?: string | null;
  scopeBy?: string | null;
  icon?: string | null;
  priority?: number;
  isActive?: boolean;
}

export interface UpdateTriggerInput {
  moduleKey?: string;
  triggerWord?: string;
  entityType?: string;
  searchEndpoint?: string;
  displayField?: string;
  subtitleField?: string | null;
  scopeBy?: string | null;
  icon?: string | null;
  priority?: number;
  isActive?: boolean;
}

export interface EntityTriggerRecord {
  id: string;
  moduleKey: string;
  triggerWord: string;
  entityType: string;
  searchEndpoint: string;
  displayField: string;
  subtitleField: string | null;
  scopeBy: string | null;
  icon: string | null;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── EntityTriggerService ─────────────────────────────────────────────────

export class EntityTriggerService {
  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
  ) {}

  // ─── List ─────────────────────────────────────────────────────────────

  async listTriggers(
    filters: { moduleKey?: string; isActive?: boolean } = {},
  ): Promise<EntityTriggerRecord[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic where clause
    const where: any = {};
    if (filters.moduleKey) {
      where.moduleKey = filters.moduleKey;
    }
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const triggers = await this.db.aiEntityTrigger.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { triggerWord: 'asc' }],
    });

    return triggers.map((t) => this.toRecord(t));
  }

  // ─── Get ──────────────────────────────────────────────────────────────

  async getTrigger(id: string): Promise<EntityTriggerRecord | null> {
    const trigger = await this.db.aiEntityTrigger.findUnique({ where: { id } });
    if (!trigger) return null;
    return this.toRecord(trigger);
  }

  // ─── Create ───────────────────────────────────────────────────────────

  async createTrigger(input: CreateTriggerInput): Promise<EntityTriggerRecord> {
    let trigger;
    try {
      trigger = await this.db.aiEntityTrigger.create({
        data: {
          moduleKey: input.moduleKey,
          triggerWord: input.triggerWord,
          entityType: input.entityType,
          searchEndpoint: input.searchEndpoint,
          displayField: input.displayField,
          subtitleField: input.subtitleField ?? null,
          scopeBy: input.scopeBy ?? null,
          icon: input.icon ?? null,
          priority: input.priority ?? 100,
          isActive: input.isActive ?? true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(
          'ENTITY_TRIGGER_CONFLICT',
          `Entity trigger for "${input.moduleKey}/${input.triggerWord}" already exists`,
          409,
        );
      }
      throw error;
    }

    this.logger.info(
      { triggerId: trigger.id, triggerWord: trigger.triggerWord },
      'Entity trigger created',
    );

    return this.toRecord(trigger);
  }

  // ─── Update ───────────────────────────────────────────────────────────

  async updateTrigger(id: string, input: UpdateTriggerInput): Promise<EntityTriggerRecord | null> {
    const existing = await this.db.aiEntityTrigger.findUnique({ where: { id } });
    if (!existing) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic update data
    const data: any = {};
    if (input.moduleKey !== undefined) data.moduleKey = input.moduleKey;
    if (input.triggerWord !== undefined) data.triggerWord = input.triggerWord;
    if (input.entityType !== undefined) data.entityType = input.entityType;
    if (input.searchEndpoint !== undefined) data.searchEndpoint = input.searchEndpoint;
    if (input.displayField !== undefined) data.displayField = input.displayField;
    if (input.subtitleField !== undefined) data.subtitleField = input.subtitleField;
    if (input.scopeBy !== undefined) data.scopeBy = input.scopeBy;
    if (input.icon !== undefined) data.icon = input.icon;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const trigger = await this.db.aiEntityTrigger.update({
      where: { id },
      data,
    });

    this.logger.info(
      { triggerId: trigger.id, triggerWord: trigger.triggerWord },
      'Entity trigger updated',
    );

    return this.toRecord(trigger);
  }

  // ─── Delete ───────────────────────────────────────────────────────────

  async deleteTrigger(id: string): Promise<boolean> {
    const existing = await this.db.aiEntityTrigger.findUnique({ where: { id } });
    if (!existing) return false;

    await this.db.aiEntityTrigger.delete({ where: { id } });

    this.logger.info(
      { triggerId: id, triggerWord: existing.triggerWord },
      'Entity trigger deleted',
    );

    return true;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma model return type
  private toRecord(trigger: any): EntityTriggerRecord {
    return {
      id: trigger.id,
      moduleKey: trigger.moduleKey,
      triggerWord: trigger.triggerWord,
      entityType: trigger.entityType,
      searchEndpoint: trigger.searchEndpoint,
      displayField: trigger.displayField,
      subtitleField: trigger.subtitleField,
      scopeBy: trigger.scopeBy,
      icon: trigger.icon,
      priority: trigger.priority,
      isActive: trigger.isActive,
      createdAt: trigger.createdAt,
      updatedAt: trigger.updatedAt,
    };
  }
}
