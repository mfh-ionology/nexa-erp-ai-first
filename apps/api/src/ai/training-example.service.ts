// ---------------------------------------------------------------------------
// TrainingExampleService — CRUD for tenant training examples used as few-shot
// injection into AI context (E5d-2 Task 4, AC #4)
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Valid training example categories (same as knowledge articles) */
export const VALID_TRAINING_CATEGORIES = [
  'BUSINESS_PROCESS',
  'TERMINOLOGY',
  'INDUSTRY_RULES',
  'CUSTOM_FIELDS',
  'HISTORICAL_PATTERN',
] as const;

export type TrainingCategory = (typeof VALID_TRAINING_CATEGORIES)[number];

/** Valid training example sources */
export const VALID_TRAINING_SOURCES = ['ADMIN_CURATED', 'CORRECTION_DERIVED'] as const;

export type TrainingSource = (typeof VALID_TRAINING_SOURCES)[number];

/** Default pagination */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CreateTrainingExampleInput {
  inputText: string;
  outputText: string;
  category: string;
  skillKey?: string;
  source?: string;
}

export interface UpdateTrainingExampleInput {
  inputText?: string;
  outputText?: string;
  category?: string;
  skillKey?: string;
  isActive?: boolean;
  /** source is NOT allowed — immutable after creation */
}

export interface ListTrainingExamplesFilters {
  category?: string | string[];
  skillKey?: string;
  isActive?: boolean;
  cursor?: string;
  limit?: number;
}

export interface TrainingExampleRecord {
  id: string;
  companyId: string;
  skillKey: string | null;
  inputText: string;
  outputText: string;
  category: string;
  source: string;
  isActive: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedTrainingExamples {
  data: TrainingExampleRecord[];
  nextCursor: string | null;
  total: number;
}

// ─── TrainingExampleService ───────────────────────────────────────────────────

export class TrainingExampleService {
  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
  ) {}

  // ─── List (AC: #4 — GET /training-examples) ──────────────────────────────

  async listExamples(
    companyId: string,
    filters: ListTrainingExamplesFilters = {},
  ): Promise<PaginatedTrainingExamples> {
    const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic where clause
    const where: any = { companyId };

    // Category filter (single or array)
    if (filters.category) {
      if (Array.isArray(filters.category)) {
        where.category = { in: filters.category };
      } else {
        where.category = filters.category;
      }
    }

    if (filters.skillKey !== undefined) {
      where.skillKey = filters.skillKey;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    // Cursor-based pagination — use Prisma's native cursor which respects orderBy
    const findManyArgs: Parameters<typeof this.db.aiTrainingExample.findMany>[0] = {
      where,
      orderBy: [{ category: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    };
    if (filters.cursor) {
      findManyArgs.cursor = { id: filters.cursor };
      findManyArgs.skip = 1;
    }

    const [examples, total] = await Promise.all([
      this.db.aiTrainingExample.findMany(findManyArgs),
      this.db.aiTrainingExample.count({ where }),
    ]);

    let nextCursor: string | null = null;
    if (examples.length > limit) {
      const lastItem = examples.pop()!;
      nextCursor = lastItem.id;
    }

    return {
      data: examples.map((e) => this.toRecord(e)),
      nextCursor,
      total,
    };
  }

  // ─── Get (AC: #4 — GET /training-examples/:id) ───────────────────────────

  async getExample(id: string, companyId: string): Promise<TrainingExampleRecord | null> {
    const example = await this.db.aiTrainingExample.findFirst({
      where: { id, companyId },
    });

    if (!example) return null;

    return this.toRecord(example);
  }

  // ─── Create (AC: #4 — POST /training-examples) ───────────────────────────

  async createExample(
    companyId: string,
    userId: string,
    input: CreateTrainingExampleInput,
  ): Promise<TrainingExampleRecord> {
    // Validate category
    if (!VALID_TRAINING_CATEGORIES.includes(input.category as TrainingCategory)) {
      throw new Error(
        `Invalid category "${input.category}". Must be one of: ${VALID_TRAINING_CATEGORIES.join(', ')}`,
      );
    }

    const source = input.source ?? 'ADMIN_CURATED';
    if (!VALID_TRAINING_SOURCES.includes(source as TrainingSource)) {
      throw new Error(
        `Invalid source "${source}". Must be one of: ${VALID_TRAINING_SOURCES.join(', ')}`,
      );
    }

    const example = await this.db.aiTrainingExample.create({
      data: {
        companyId,
        inputText: input.inputText,
        outputText: input.outputText,
        category: input.category,
        source,
        skillKey: input.skillKey ?? null,
        createdById: userId,
      },
    });

    this.logger.info(
      { exampleId: example.id, companyId, category: input.category, source },
      'Training example created',
    );

    return this.toRecord(example);
  }

  // ─── Update (AC: #4 — PATCH /training-examples/:id) ──────────────────────

  async updateExample(
    id: string,
    companyId: string,
    input: UpdateTrainingExampleInput,
  ): Promise<TrainingExampleRecord | null> {
    // Check existence + companyId scoping
    const existing = await this.db.aiTrainingExample.findFirst({
      where: { id, companyId },
    });

    if (!existing) return null;

    // Validate category if provided
    if (input.category && !VALID_TRAINING_CATEGORIES.includes(input.category as TrainingCategory)) {
      throw new Error(
        `Invalid category "${input.category}". Must be one of: ${VALID_TRAINING_CATEGORIES.join(', ')}`,
      );
    }

    // Build update data (source is immutable — NOT included)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic data object
    const data: any = {};
    if (input.inputText !== undefined) data.inputText = input.inputText;
    if (input.outputText !== undefined) data.outputText = input.outputText;
    if (input.category !== undefined) data.category = input.category;
    if (input.skillKey !== undefined) data.skillKey = input.skillKey;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const example = await this.db.aiTrainingExample.update({
      where: { id, companyId },
      data,
    });

    this.logger.info({ exampleId: id, companyId }, 'Training example updated');

    return this.toRecord(example);
  }

  // ─── Delete (AC: #4 — DELETE /training-examples/:id) ─────────────────────

  async deleteExample(id: string, companyId: string): Promise<boolean> {
    // Check existence + companyId scoping
    const existing = await this.db.aiTrainingExample.findFirst({
      where: { id, companyId },
    });

    if (!existing) return false;

    // Soft-delete: set isActive = false
    await this.db.aiTrainingExample.update({
      where: { id, companyId },
      data: { isActive: false },
    });

    this.logger.info({ exampleId: id, companyId }, 'Training example soft-deleted');

    return true;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma model return types
  private toRecord(row: any): TrainingExampleRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      skillKey: row.skillKey,
      inputText: row.inputText,
      outputText: row.outputText,
      category: row.category,
      source: row.source,
      isActive: row.isActive,
      createdById: row.createdById,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
