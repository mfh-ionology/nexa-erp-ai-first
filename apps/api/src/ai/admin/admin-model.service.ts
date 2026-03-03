// ---------------------------------------------------------------------------
// AdminModelService — CRUD for AI models (admin-only)
// E5c-3 Task 2: AC #2, #3
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import { Prisma } from '@nexa/db';
import type { Logger } from 'pino';
import { AppError } from '../../core/errors/app-error.js';
import { NotFoundError } from '../../core/errors/not-found-error.js';
import type { PaginationMeta } from '../../core/utils/response.js';
import type { CreateModelInput, UpdateModelInput, ListModelsQuery } from './admin.schemas.js';

// ─── Constants ─────────────────────────────────────────────────────────────

const MAX_FALLBACK_DEPTH = 10;

// ─── Response types ────────────────────────────────────────────────────────

export interface ModelListItem {
  id: string;
  name: string;
  provider: string;
  modelId: string;
  displayName: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  costPerMInput: string;
  costPerMOutput: string;
  routingTags: string[];
  capabilities: unknown;
  isActive: boolean;
  isDefault: boolean;
  fallbackModelId: string | null;
  agentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ModelDetail extends ModelListItem {
  fallbackModel: { id: string; name: string; displayName: string } | null;
  config: unknown;
}

// ─── Service ───────────────────────────────────────────────────────────────

export class AdminModelService {
  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
  ) {}

  // ─── List ──────────────────────────────────────────────────────────────

  async listModels(
    query: ListModelsQuery,
  ): Promise<{ data: ModelListItem[]; meta: PaginationMeta }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic where clause
    const where: any = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.provider) {
      where.provider = query.provider;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { displayName: { contains: query.search, mode: 'insensitive' } },
        { modelId: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.db.aiModel.findMany({
        where,
        take: query.limit + 1,
        ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { agents: true } },
        },
      }),
      this.db.aiModel.count({ where }),
    ]);

    const hasMore = rows.length > query.limit;
    const data = hasMore ? rows.slice(0, -1) : rows;
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1]!.id : undefined;

    return {
      data: data.map((row) => this.toListItem(row, row._count.agents)),
      meta: { cursor: nextCursor, hasMore, total },
    };
  }

  // ─── Get ───────────────────────────────────────────────────────────────

  async getModel(id: string): Promise<ModelDetail> {
    const model = await this.db.aiModel.findUnique({
      where: { id },
      include: {
        _count: { select: { agents: true } },
        fallbackModel: { select: { id: true, name: true, displayName: true } },
      },
    });

    if (!model) {
      throw new NotFoundError('MODEL_NOT_FOUND', `AI model with id "${id}" not found`);
    }

    return {
      ...this.toListItem(model, model._count.agents),
      fallbackModel: model.fallbackModel,
      config: model.config,
    };
  }

  // ─── Create ────────────────────────────────────────────────────────────

  async createModel(input: CreateModelInput): Promise<ModelDetail> {
    try {
      // If setting as default, unset previous default in a transaction
      if (input.isDefault) {
        const model = await this.db.$transaction(async (tx) => {
          await tx.aiModel.updateMany({
            where: { isDefault: true },
            data: { isDefault: false },
          });
          return tx.aiModel.create({
            data: {
              name: input.name,
              provider: input.provider,
              modelId: input.modelId,
              displayName: input.displayName,
              maxInputTokens: input.maxInputTokens,
              maxOutputTokens: input.maxOutputTokens,
              costPerMInput: new Prisma.Decimal(input.costPerMInput),
              costPerMOutput: new Prisma.Decimal(input.costPerMOutput),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
              capabilities: input.capabilities as any,
              isActive: input.isActive,
              isDefault: true,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
              config: (input.config ?? null) as any,
              fallbackModelId: input.fallbackModelId ?? null,
              routingTags: input.routingTags,
            },
            include: {
              _count: { select: { agents: true } },
              fallbackModel: { select: { id: true, name: true, displayName: true } },
            },
          });
        });

        return {
          ...this.toListItem(model, model._count.agents),
          fallbackModel: model.fallbackModel,
          config: model.config,
        };
      }

      // Standard create (not setting as default)
      const model = await this.db.aiModel.create({
        data: {
          name: input.name,
          provider: input.provider,
          modelId: input.modelId,
          displayName: input.displayName,
          maxInputTokens: input.maxInputTokens,
          maxOutputTokens: input.maxOutputTokens,
          costPerMInput: new Prisma.Decimal(input.costPerMInput),
          costPerMOutput: new Prisma.Decimal(input.costPerMOutput),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
          capabilities: input.capabilities as any,
          isActive: input.isActive,
          isDefault: false,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
          config: (input.config ?? null) as any,
          fallbackModelId: input.fallbackModelId ?? null,
          routingTags: input.routingTags,
        },
        include: {
          _count: { select: { agents: true } },
          fallbackModel: { select: { id: true, name: true, displayName: true } },
        },
      });

      return {
        ...this.toListItem(model, model._count.agents),
        fallbackModel: model.fallbackModel,
        config: model.config,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(
          'MODEL_NAME_CONFLICT',
          `A model with name "${input.name}" already exists`,
          409,
        );
      }
      throw error;
    }
  }

  // ─── Update ────────────────────────────────────────────────────────────

  async updateModel(id: string, input: UpdateModelInput): Promise<ModelDetail> {
    // Load current model to validate business rules
    const current = await this.db.aiModel.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundError('MODEL_NOT_FOUND', `AI model with id "${id}" not found`);
    }

    // Business rule: Cannot deactivate the default model
    if (input.isActive === false && current.isDefault) {
      throw new AppError(
        'CANNOT_DEACTIVATE_DEFAULT',
        'Cannot deactivate the default model. Assign a new default first.',
        422,
      );
    }

    // Business rule: Cannot unset isDefault on the current default model
    if (input.isDefault === false && current.isDefault) {
      throw new AppError(
        'CANNOT_UNSET_DEFAULT',
        'Cannot remove default status. Set another model as default first.',
        422,
      );
    }

    // Business rule: Validate no circular fallback chain
    if (input.fallbackModelId !== undefined && input.fallbackModelId !== null) {
      const hasCycle = await this.detectFallbackCycle(id, input.fallbackModelId);
      if (hasCycle) {
        throw new AppError(
          'CIRCULAR_FALLBACK',
          'Setting this fallback model would create a circular fallback chain',
          422,
        );
      }
    }

    // Build Prisma update data — only include fields that were provided
    const data: Prisma.AiModelUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.provider !== undefined) data.provider = input.provider;
    if (input.modelId !== undefined) data.modelId = input.modelId;
    if (input.displayName !== undefined) data.displayName = input.displayName;
    if (input.maxInputTokens !== undefined) data.maxInputTokens = input.maxInputTokens;
    if (input.maxOutputTokens !== undefined) data.maxOutputTokens = input.maxOutputTokens;
    if (input.costPerMInput !== undefined)
      data.costPerMInput = new Prisma.Decimal(input.costPerMInput);
    if (input.costPerMOutput !== undefined)
      data.costPerMOutput = new Prisma.Decimal(input.costPerMOutput);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
    if (input.capabilities !== undefined) data.capabilities = input.capabilities as any;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
    if (input.config !== undefined) data.config = input.config as any;
    if (input.fallbackModelId !== undefined) data.fallbackModelId = input.fallbackModelId;
    if (input.routingTags !== undefined) data.routingTags = input.routingTags;

    if (input.isDefault !== undefined) {
      data.isDefault = input.isDefault;
    }

    // If setting isDefault=true, always unset previous default in transaction
    // (even if current model is already default, to guard against concurrent races)
    if (input.isDefault === true) {
      await this.db.$transaction(async (tx) => {
        await tx.aiModel.updateMany({
          where: { isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
        await tx.aiModel.update({ where: { id }, data });
      });

      // Re-fetch the full model with includes after transaction
      return this.getModel(id);
    }

    try {
      await this.db.aiModel.update({ where: { id }, data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(
          'MODEL_NAME_CONFLICT',
          `A model with name "${input.name}" already exists`,
          409,
        );
      }
      throw error;
    }

    return this.getModel(id);
  }

  // ─── Delete ────────────────────────────────────────────────────────────

  async deleteModel(id: string): Promise<void> {
    const model = await this.db.aiModel.findUnique({
      where: { id },
      include: { _count: { select: { agents: true } } },
    });

    if (!model) {
      throw new NotFoundError('MODEL_NOT_FOUND', `AI model with id "${id}" not found`);
    }

    // Business rule: Cannot delete a model referenced by agents
    if (model._count.agents > 0) {
      throw new AppError(
        'MODEL_REFERENCED_BY_AGENTS',
        `This model is referenced by ${model._count.agents} agent${model._count.agents === 1 ? '' : 's'}. Remove agent references first.`,
        422,
      );
    }

    await this.db.aiModel.delete({ where: { id } });
    this.logger.info({ modelId: id, modelName: model.name }, 'AI model deleted');
  }

  // ─── Circular fallback detection (Task 2.2) ───────────────────────────

  /**
   * Detect if setting `fallbackModelId` on model `modelId` would create
   * a circular fallback chain. Uses a single recursive CTE query
   * to traverse the chain — checks for cycles and max depth in one round-trip.
   * Max depth of 10 (including the initial model → fallback link).
   */
  async detectFallbackCycle(modelId: string, fallbackModelId: string): Promise<boolean> {
    // Direct self-reference
    if (modelId === fallbackModelId) return true;

    // Single recursive CTE: traverse fallback chain, check for cycle + depth
    const result = await this.db.$queryRaw<{ has_cycle: boolean; chain_depth: number }[]>`
      WITH RECURSIVE chain AS (
        SELECT fallback_model_id, 1 as depth
        FROM ai_models
        WHERE id = ${fallbackModelId}
        UNION ALL
        SELECT m.fallback_model_id, c.depth + 1
        FROM ai_models m
        JOIN chain c ON m.id = c.fallback_model_id
        WHERE c.fallback_model_id IS NOT NULL
          AND c.depth < ${MAX_FALLBACK_DEPTH}
      )
      SELECT
        EXISTS(SELECT 1 FROM chain WHERE fallback_model_id = ${modelId}) as has_cycle,
        COALESCE(MAX(depth), 0)::int as chain_depth
      FROM chain
    `;

    const row = result[0];
    if (!row) return false;

    if (row.has_cycle) return true;

    if (row.chain_depth >= MAX_FALLBACK_DEPTH) {
      this.logger.warn(
        { modelId, fallbackModelId, depth: row.chain_depth },
        'Fallback chain depth exceeds maximum — rejecting to prevent deep chains',
      );
      return true;
    }

    return false;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma model type
  private toListItem(row: any, agentCount: number): ModelListItem {
    return {
      id: row.id,
      name: row.name,
      provider: row.provider,
      modelId: row.modelId,
      displayName: row.displayName,
      maxInputTokens: row.maxInputTokens,
      maxOutputTokens: row.maxOutputTokens,
      costPerMInput: row.costPerMInput.toString(),
      costPerMOutput: row.costPerMOutput.toString(),
      routingTags: row.routingTags,
      capabilities: row.capabilities,
      isActive: row.isActive,
      isDefault: row.isDefault,
      fallbackModelId: row.fallbackModelId,
      agentCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
