// ---------------------------------------------------------------------------
// MemoryService — CRUD + importance scoring for AI memories
// E5b-1 Task 2.1
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type { EventBus } from '../core/events/event-bus.js';
import type { EmbeddingService } from './embedding.service.js';
import { daysSince } from './text-utils.js';

// ─── Types ────────────────────────────────────────────────────────────────

export type MemoryCategory =
  | 'PREFERENCE'
  | 'WORKFLOW'
  | 'ENTITY_CONTEXT'
  | 'DECISION'
  | 'INSTRUCTION';

export type MemorySource = 'EXPLICIT' | 'IMPLICIT';

export interface CreateMemoryInput {
  content: string;
  category: MemoryCategory;
  source?: MemorySource;
  /** Override the default importance score (default: 1.0 for EXPLICIT, 0.5 for IMPLICIT) */
  importance?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateMemoryInput {
  content?: string;
  category?: MemoryCategory;
  metadata?: Record<string, unknown>;
}

export interface ListMemoriesInput {
  category?: MemoryCategory;
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface MemoryRecord {
  id: string;
  userId: string;
  companyId: string;
  category: string;
  content: string;
  source: string;
  importance: number;
  lastAccessedAt: Date;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedMemories {
  data: MemoryRecord[];
  nextCursor: string | null;
  total: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

/** Temporal decay half-life in days */
const DECAY_HALF_LIFE_DAYS = 30;

/** Explicit memories get 1.5x weight over implicit */
const EXPLICIT_WEIGHT = 1.5;
const IMPLICIT_WEIGHT = 1.0;

/** Default importance scores by source */
const DEFAULT_IMPORTANCE_EXPLICIT = 1.0;
const DEFAULT_IMPORTANCE_IMPLICIT = 0.5;

/** Default pagination limit */
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// ─── MemoryService ────────────────────────────────────────────────────────

export class MemoryService {
  private embeddingService: EmbeddingService | null = null;

  constructor(
    private readonly db: PrismaClient,
    private readonly eventBus: EventBus,
    private readonly logger: Logger,
  ) {}

  /** Wire optional EmbeddingService for fire-and-forget vector embedding on create/update */
  setEmbeddingService(service: EmbeddingService): void {
    this.embeddingService = service;
  }

  // ─── Create ───────────────────────────────────────────────────────────

  async createMemory(
    userId: string,
    companyId: string,
    input: CreateMemoryInput,
  ): Promise<MemoryRecord> {
    const source: MemorySource = input.source ?? 'EXPLICIT';
    const importance =
      input.importance ??
      (source === 'EXPLICIT' ? DEFAULT_IMPORTANCE_EXPLICIT : DEFAULT_IMPORTANCE_IMPLICIT);

    const memory = await this.db.aiMemory.create({
      data: {
        userId,
        companyId,
        category: input.category,
        content: input.content,
        source,
        importance,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue; our Record<string, unknown> is always JSON-safe
        metadata: (input.metadata ?? null) as any,
      },
    });

    this.eventBus.emit('ai.memory.created', {
      memoryId: memory.id,
      userId,
      companyId,
      category: memory.category,
      source: memory.source,
    });

    this.logger.debug(
      { memoryId: memory.id, userId, companyId, category: input.category },
      'Memory created',
    );

    // Fire-and-forget embedding generation (AC3 — never blocks memory creation)
    if (this.embeddingService) {
      this.generateAndStoreEmbedding(memory.id, memory.content).catch((err) =>
        this.logger.warn({ err, memoryId: memory.id }, 'Failed to generate embedding'),
      );
    }

    return this.toRecord(memory);
  }

  // ─── List ─────────────────────────────────────────────────────────────

  async listMemories(
    userId: string,
    companyId: string,
    input: ListMemoriesInput = {},
  ): Promise<PaginatedMemories> {
    const limit = Math.min(input.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic where clause
    const where: any = {
      userId,
      companyId,
      ...(input.category ? { category: input.category } : {}),
      ...(input.search ? { content: { contains: input.search, mode: 'insensitive' } } : {}),
      // Exclude archived memories (AC7)
      NOT: {
        metadata: { path: ['archived'], equals: true },
      },
    };

    // Fetch all matching memories so we can apply effective importance sorting
    // (temporal decay is computed in-memory). Bounded by per-user max (default 500).
    const [allMemories, total] = await Promise.all([
      this.db.aiMemory.findMany({
        where,
        orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      }),
      this.db.aiMemory.count({ where }),
    ]);

    // Compute effective importance and sort by it descending
    const scored = allMemories.map((m: any) => ({
      memory: m,
      effectiveImportance: this.calculateEffectiveImportance({
        importance:
          typeof m.importance === 'number' ? m.importance : parseFloat(String(m.importance)),
        source: m.source,
        lastAccessedAt: m.lastAccessedAt,
      }),
    }));
    scored.sort((a, b) => b.effectiveImportance - a.effectiveImportance);

    // Apply offset-based pagination using cursor position within the sorted list
    let startIndex = 0;
    if (input.cursor) {
      const cursorIdx = scored.findIndex((s) => s.memory.id === input.cursor);
      if (cursorIdx >= 0) startIndex = cursorIdx + 1;
    }

    const page = scored.slice(startIndex, startIndex + limit + 1);
    let nextCursor: string | null = null;
    if (page.length > limit) {
      const lastItem = page.pop()!;
      nextCursor = lastItem.memory.id;
    }

    return {
      data: page.map((s) => this.toRecord(s.memory)),
      nextCursor,
      total,
    };
  }

  // ─── Get ──────────────────────────────────────────────────────────────

  async getMemory(id: string, userId: string, companyId: string): Promise<MemoryRecord | null> {
    const memory = await this.db.aiMemory.findFirst({
      where: { id, userId, companyId },
    });

    if (!memory) return null;

    return this.toRecord(memory);
  }

  // ─── Update ───────────────────────────────────────────────────────────

  async updateMemory(
    id: string,
    userId: string,
    companyId: string,
    input: UpdateMemoryInput,
  ): Promise<MemoryRecord | null> {
    // Ownership + tenant check
    const existing = await this.db.aiMemory.findFirst({
      where: { id, userId, companyId },
    });

    if (!existing) return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
    const data: any = {};
    if (input.content !== undefined) data.content = input.content;
    if (input.category !== undefined) data.category = input.category;
    if (input.metadata !== undefined) data.metadata = input.metadata ?? null;

    const memory = await this.db.aiMemory.update({
      where: { id },
      data,
    });

    // Fire-and-forget embedding re-generation if content changed (AC3)
    if (
      this.embeddingService &&
      input.content !== undefined &&
      input.content !== existing.content
    ) {
      this.generateAndStoreEmbedding(memory.id, memory.content).catch((err) =>
        this.logger.warn({ err, memoryId: memory.id }, 'Failed to re-generate embedding on update'),
      );
    }

    return this.toRecord(memory);
  }

  // ─── Delete ───────────────────────────────────────────────────────────

  async deleteMemory(id: string, userId: string, companyId: string): Promise<boolean> {
    // Ownership + tenant check
    const existing = await this.db.aiMemory.findFirst({
      where: { id, userId, companyId },
    });

    if (!existing) return false;

    await this.db.aiMemory.delete({ where: { id } });

    this.eventBus.emit('ai.memory.deleted', {
      memoryId: id,
      userId,
      companyId: existing.companyId,
    });

    this.logger.debug({ memoryId: id, userId, companyId: existing.companyId }, 'Memory deleted');

    return true;
  }

  // ─── Forget All ───────────────────────────────────────────────────────

  async forgetAll(userId: string, companyId: string): Promise<number> {
    // Fetch IDs before deletion so we can include them in the bulk event (AC-12)
    const toDelete = await this.db.aiMemory.findMany({
      where: { userId, companyId },
      select: { id: true },
    });

    if (toDelete.length === 0) return 0;

    const result = await this.db.aiMemory.deleteMany({
      where: { userId, companyId },
    });

    // Emit a single bulk event instead of N individual events to avoid event bus flooding
    this.eventBus.emit('ai.memory.bulk_deleted', {
      memoryIds: toDelete.map((m) => m.id),
      userId,
      companyId,
      count: result.count,
    });

    this.logger.info(
      { userId, companyId, count: result.count },
      'All memories deleted (forget-all)',
    );

    return result.count;
  }

  // ─── Touch (update lastAccessedAt) ────────────────────────────────────

  async touchMemory(id: string): Promise<void> {
    try {
      await this.db.aiMemory.update({
        where: { id },
        data: { lastAccessedAt: new Date() },
      });
    } catch {
      // Silently ignore — memory may have been deleted
      this.logger.debug({ memoryId: id }, 'touchMemory: memory not found');
    }
  }

  // ─── Importance Scoring ───────────────────────────────────────────────

  /**
   * Calculate effective importance with temporal decay.
   *
   * Formula: effectiveScore = baseScore * sourceWeight * temporalDecay
   * where temporalDecay = 0.5^(daysSinceAccess / halfLife)
   * and explicit memories get 1.5x weight, implicit get 1.0x
   */
  calculateEffectiveImportance(
    memory: {
      importance: number;
      source: string;
      lastAccessedAt: Date;
    },
    halfLifeDays: number = DECAY_HALF_LIFE_DAYS,
  ): number {
    const daysSinceAccess = daysSince(memory.lastAccessedAt);
    const sourceWeight = memory.source === 'EXPLICIT' ? EXPLICIT_WEIGHT : IMPLICIT_WEIGHT;
    const temporalDecay = Math.pow(0.5, daysSinceAccess / halfLifeDays);

    return memory.importance * sourceWeight * temporalDecay;
  }

  // ─── Embedding Integration (E5b-4 Task 4) ────────────────────────────

  /**
   * Generate an embedding for the given content and store it in the ai_memories row.
   * Uses raw SQL because Prisma doesn't support the pgvector type natively.
   */
  private async generateAndStoreEmbedding(memoryId: string, content: string): Promise<void> {
    const embedding = await this.embeddingService!.generateEmbedding(content);
    if (!embedding) return; // Graceful — embedding generation failed, column stays NULL

    const vectorLiteral = `[${embedding.join(',')}]`;
    await this.db.$executeRaw`
      UPDATE ai_memories SET embedding = ${vectorLiteral}::vector WHERE id = ${memoryId}
    `;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  // daysSince imported from text-utils.ts

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma model return types
  private toRecord(memory: any): MemoryRecord {
    return {
      id: memory.id,
      userId: memory.userId,
      companyId: memory.companyId,
      category: memory.category,
      content: memory.content,
      source: memory.source,
      importance:
        typeof memory.importance === 'number'
          ? memory.importance
          : parseFloat(String(memory.importance)),
      lastAccessedAt: memory.lastAccessedAt,
      metadata: memory.metadata,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    };
  }
}
