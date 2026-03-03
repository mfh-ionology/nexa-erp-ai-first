// ---------------------------------------------------------------------------
// EmbeddingBackfillService — Backfills embeddings for memories missing them
// E5b-4 Task 5 (AC: #3)
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type { EmbeddingService } from './embedding.service.js';

// ─── Types ────────────────────────────────────────────────────────────────

export interface BackfillResult {
  total: number;
  processed: number;
  failed: number;
  skipped: number;
  durationMs: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

/** Default batch size for backfill processing */
const DEFAULT_BATCH_SIZE = 50;

/** Delay between batches to avoid AI Gateway rate limits (ms) */
const BATCH_DELAY_MS = 500;

/** Maximum batch iterations to prevent infinite loops from persistently failing memories */
const MAX_ITERATIONS = 500;

// ─── EmbeddingBackfillService ─────────────────────────────────────────────

export class EmbeddingBackfillService {
  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * Backfill embeddings for all memories that have a NULL embedding column.
   *
   * - Fetches memories in batches of `batchSize` (default 50)
   * - Uses `EmbeddingService.generateEmbeddings()` for batch efficiency
   * - Rate-limits: 500ms delay between batches to avoid AI Gateway rate limits
   * - Idempotent: safe to re-run (only processes memories with NULL embedding)
   * - Non-blocking: intended to be called as a background job after server starts
   */
  async backfillMemoryEmbeddings(batchSize: number = DEFAULT_BATCH_SIZE): Promise<BackfillResult> {
    const startTime = Date.now();
    let processed = 0;
    let failed = 0;
    let skipped = 0;

    // Count total memories needing backfill (embedding IS NULL)
    const countResult = await this.db.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) AS count FROM ai_memories WHERE embedding IS NULL
    `;
    const total = Number(countResult[0]?.count ?? 0);

    if (total === 0) {
      this.logger.info('EmbeddingBackfillService: no memories need backfill — all have embeddings');
      return { total: 0, processed: 0, failed: 0, skipped: 0, durationMs: Date.now() - startTime };
    }

    this.logger.info({ total, batchSize }, 'EmbeddingBackfillService: starting backfill');

    // Track IDs that failed embedding generation to exclude from subsequent fetches,
    // preventing infinite loops where the same failing memories are re-fetched endlessly.
    const failedIds = new Set<string>();
    let iterations = 0;
    let hasMore = true;

    while (hasMore) {
      iterations++;
      if (iterations > MAX_ITERATIONS) {
        this.logger.warn(
          { iterations, processed, failed, skipped },
          'EmbeddingBackfillService: max iterations reached — stopping to prevent infinite loop',
        );
        break;
      }

      // Fetch next batch of memories with NULL embedding, excluding previously failed IDs
      let batch: Array<{ id: string; content: string }>;
      if (failedIds.size > 0) {
        const excludeIds = Array.from(failedIds);
        batch = await this.db.$queryRawUnsafe<Array<{ id: string; content: string }>>(
          `SELECT id, content FROM ai_memories
           WHERE embedding IS NULL AND id != ALL($1)
           ORDER BY created_at ASC
           LIMIT $2`,
          excludeIds,
          batchSize,
        );
      } else {
        batch = await this.db.$queryRaw<Array<{ id: string; content: string }>>`
          SELECT id, content FROM ai_memories
          WHERE embedding IS NULL
          ORDER BY created_at ASC
          LIMIT ${batchSize}
        `;
      }

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      // Generate embeddings for the batch
      const texts = batch.map((m) => m.content);
      const embeddings = await this.embeddingService.generateEmbeddings(texts);

      // Update each memory with its embedding
      for (let i = 0; i < batch.length; i++) {
        const memory = batch[i]!;
        const embedding = embeddings[i];

        if (!embedding) {
          failed++;
          failedIds.add(memory.id);
          this.logger.debug(
            { memoryId: memory.id },
            'EmbeddingBackfillService: embedding generation failed for memory — excluding from future batches',
          );
          continue;
        }

        try {
          const vectorLiteral = `[${embedding.join(',')}]`;
          await this.db.$executeRaw`
            UPDATE ai_memories SET embedding = ${vectorLiteral}::vector WHERE id = ${memory.id}
          `;
          processed++;
        } catch (err) {
          failed++;
          failedIds.add(memory.id);
          this.logger.warn(
            { error: (err as Error).message, memoryId: memory.id },
            'EmbeddingBackfillService: failed to store embedding',
          );
        }
      }

      this.logger.info(
        { processed, failed, remaining: total - processed - failed },
        'EmbeddingBackfillService: batch completed',
      );

      // Rate-limit delay between batches
      if (batch.length === batchSize) {
        await this.delay(BATCH_DELAY_MS);
      } else {
        hasMore = false;
      }
    }

    const durationMs = Date.now() - startTime;
    this.logger.info(
      { total, processed, failed, skipped, durationMs },
      'EmbeddingBackfillService: backfill completed',
    );

    return { total, processed, failed, skipped, durationMs };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
