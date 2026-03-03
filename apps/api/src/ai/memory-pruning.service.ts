// ---------------------------------------------------------------------------
// MemoryPruningService — BullMQ scheduled job for pruning low-importance memories
// E5b-1 Task 2.2
// ---------------------------------------------------------------------------

import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';
import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import { MemoryService } from './memory.service.js';
import type { VectorSearchService } from './vector-search.service.js';

// ─── Types ────────────────────────────────────────────────────────────────

export interface PruningJobData {
  scheduledAt: string;
}

export interface PruningResult {
  usersProcessed: number;
  memoriesDeleted: number;
  durationMs: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

const QUEUE_NAME = 'memory-pruning';
const TRIGGER_JOB_NAME = 'memory-pruning-trigger';

/** Minimum effective importance — memories below this are pruning candidates */
const MIN_EFFECTIVE_IMPORTANCE = 0.1;

/** Default minimum days since last access for pruning eligibility (used when no retentionDays setting) */
const DEFAULT_MIN_DAYS_SINCE_ACCESS = 90;

// ─── MemoryPruningService ─────────────────────────────────────────────────

export class MemoryPruningService {
  private readonly queue: Queue;
  private readonly worker: Worker<PruningJobData>;
  private readonly memoryService: MemoryService;
  private vectorSearchService: VectorSearchService | null = null;

  /** Wire optional VectorSearchService for unified scoring (graceful degradation) */
  setVectorSearchService(service: VectorSearchService): void {
    this.vectorSearchService = service;
  }

  constructor(
    memoryService: MemoryService,
    private readonly db: PrismaClient,
    private readonly logger: Logger,
    connection: ConnectionOptions,
    opts?: {
      cronExpression?: string;
      concurrency?: number;
    },
  ) {
    this.memoryService = memoryService;

    const cronExpression = opts?.cronExpression ?? '0 2 * * *'; // daily at 02:00 UTC
    const concurrency = opts?.concurrency ?? 1;

    // ── Queue ──────────────────────────────────────────────────────────
    this.queue = new Queue<PruningJobData>(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: { count: 100, age: 7 * 24 * 3600 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    });

    // ── Worker ─────────────────────────────────────────────────────────
    this.worker = new Worker<PruningJobData>(
      QUEUE_NAME,
      async (job: Job<PruningJobData>) => {
        await this.runPruning(job);
      },
      {
        connection,
        concurrency,
      },
    );

    this.worker.on('completed', (job) => {
      this.logger.debug({ jobId: job?.id }, 'MemoryPruningService: job completed');
    });

    this.worker.on('failed', (job, err) => {
      this.logger.warn({ jobId: job?.id, error: err.message }, 'MemoryPruningService: job failed');
    });

    // ── Schedule repeatable job ────────────────────────────────────────
    void this.scheduleRepeatable(cronExpression);
  }

  // ─── Pruning Logic ──────────────────────────────────────────────────────

  /**
   * Run pruning for all users.
   *
   * For each user+company pair that exceeds their maxMemories limit,
   * delete memories where:
   * - effectiveImportance < 0.1
   * - lastAccessedAt > min(retentionDays, 90) days ago
   */
  private async runPruning(_job: Job<PruningJobData>): Promise<PruningResult> {
    const startTime = Date.now();
    let usersProcessed = 0;
    let memoriesDeleted = 0;

    try {
      // Find user+company pairs that have memory settings
      const settings = await this.db.aiMemorySettings.findMany({
        where: { isEnabled: true },
        select: {
          userId: true,
          companyId: true,
          maxMemories: true,
          retentionDays: true,
          decayHalfLifeDays: true,
        },
      });

      for (const setting of settings) {
        try {
          const deleted = await this.pruneUserMemories(
            setting.userId,
            setting.companyId,
            setting.maxMemories,
            setting.retentionDays,
            setting.decayHalfLifeDays,
          );
          memoriesDeleted += deleted;
          usersProcessed++;
        } catch (err) {
          this.logger.warn(
            { userId: setting.userId, companyId: setting.companyId, error: (err as Error).message },
            'MemoryPruningService: failed to prune memories for user',
          );
        }
      }

      // Also prune for users without explicit settings (use default limit)
      const usersWithSettings = new Set(settings.map((s) => `${s.userId}:${s.companyId}`));

      const userCompanyPairs = await this.db.aiMemory.groupBy({
        by: ['userId', 'companyId'],
        _count: { id: true },
      });

      for (const pair of userCompanyPairs) {
        const key = `${pair.userId}:${pair.companyId}`;
        if (usersWithSettings.has(key)) continue;

        // Default limit of 500, default retention 365 days
        if (pair._count.id > 500) {
          try {
            const deleted = await this.pruneUserMemories(
              pair.userId,
              pair.companyId,
              500,
              365,
              30, // default decayHalfLifeDays
            );
            memoriesDeleted += deleted;
            usersProcessed++;
          } catch (err) {
            this.logger.warn(
              { userId: pair.userId, companyId: pair.companyId, error: (err as Error).message },
              'MemoryPruningService: failed to prune memories for user (no settings)',
            );
          }
        }
      }
    } catch (err) {
      this.logger.error(
        { error: (err as Error).message },
        'MemoryPruningService: pruning run failed',
      );
    }

    const durationMs = Date.now() - startTime;

    this.logger.info(
      { usersProcessed, memoriesDeleted, durationMs },
      'MemoryPruningService: pruning run complete',
    );

    return { usersProcessed, memoriesDeleted, durationMs };
  }

  /**
   * Prune memories for a single user+company pair.
   *
   * Two-phase pruning:
   *   1. Archive: memories with low effective importance (< 0.1) that haven't been
   *      accessed in 90+ days — clear embedding to save storage, set metadata.archived
   *   2. Delete: memories that exceed the user's retentionDays — hard delete
   *
   * Returns the total number of memories archived + deleted.
   */
  private async pruneUserMemories(
    userId: string,
    companyId: string,
    maxMemories: number,
    retentionDays: number,
    decayHalfLifeDays: number = 30,
  ): Promise<number> {
    const count = await this.db.aiMemory.count({
      where: { userId, companyId },
    });

    if (count <= maxMemories) return 0;

    // ── Phase 1: Archive low-importance old memories ──────────────────
    // Use the stricter of retentionDays and the default minimum (90 days)
    const accessCutoffDays = Math.min(retentionDays, DEFAULT_MIN_DAYS_SINCE_ACCESS);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - accessCutoffDays);

    const candidates = await this.db.aiMemory.findMany({
      where: {
        userId,
        companyId,
        lastAccessedAt: { lt: cutoffDate },
      },
      select: {
        id: true,
        importance: true,
        source: true,
        lastAccessedAt: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: { lastAccessedAt: 'asc' },
    });

    const toArchive: string[] = [];
    const toDelete: string[] = [];
    const now = new Date();

    for (const candidate of candidates) {
      const importance =
        typeof candidate.importance === 'number'
          ? candidate.importance
          : parseFloat(String(candidate.importance));

      // Use VectorSearchService scoring if available, else fall back to MemoryService
      const effectiveImportance = this.vectorSearchService
        ? this.vectorSearchService.calculateEffectiveImportance(
            importance,
            candidate.source,
            candidate.lastAccessedAt,
            decayHalfLifeDays,
          )
        : this.memoryService.calculateEffectiveImportance(
            {
              importance,
              source: candidate.source,
              lastAccessedAt: candidate.lastAccessedAt,
            },
            decayHalfLifeDays,
          );

      if (effectiveImportance >= MIN_EFFECTIVE_IMPORTANCE) continue;

      // Check if memory exceeds retentionDays → hard delete
      const daysSinceCreated = Math.max(
        0,
        (now.getTime() - candidate.createdAt.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysSinceCreated > retentionDays) {
        toDelete.push(candidate.id);
      } else {
        // Check if already archived — skip if so
        const meta = candidate.metadata as Record<string, unknown> | null;
        if (meta?.archived === true) continue;
        toArchive.push(candidate.id);
      }
    }

    let totalPruned = 0;

    // ── Archive: set metadata.archived, clear embedding ──────────────
    if (toArchive.length > 0) {
      // Build lookup map to avoid O(n²) find() inside the archive loop
      const candidateMap = new Map(candidates.map((c) => [c.id, c]));

      for (const memoryId of toArchive) {
        try {
          const candidate = candidateMap.get(memoryId)!;
          const existingMeta = (candidate.metadata as Record<string, unknown>) ?? {};
          const updatedMeta = {
            ...existingMeta,
            archived: true,
            archivedAt: now.toISOString(),
          };

          await this.db.aiMemory.update({
            where: { id: memoryId },
            data: { metadata: updatedMeta },
          });

          // Clear embedding to save storage (raw SQL since Prisma doesn't support vector type)
          await this.db.$executeRawUnsafe(
            'UPDATE ai_memories SET embedding = NULL WHERE id = $1',
            memoryId,
          );
        } catch (err) {
          this.logger.warn(
            { memoryId, error: (err as Error).message },
            'MemoryPruningService: failed to archive memory',
          );
        }
      }
      totalPruned += toArchive.length;

      this.logger.debug(
        { userId, companyId, archived: toArchive.length },
        'MemoryPruningService: archived memories for user',
      );
    }

    // ── Delete: hard delete memories exceeding retentionDays ─────────
    if (toDelete.length > 0) {
      const result = await this.db.aiMemory.deleteMany({
        where: { id: { in: toDelete } },
      });
      totalPruned += result.count;

      this.logger.debug(
        { userId, companyId, deleted: result.count },
        'MemoryPruningService: deleted memories for user',
      );
    }

    return totalPruned;
  }

  // ─── Schedule Management ───────────────────────────────────────────────

  private async scheduleRepeatable(cronExpression: string): Promise<void> {
    try {
      const existing = await this.queue.getRepeatableJobs();
      for (const job of existing) {
        await this.queue.removeRepeatableByKey(job.key);
      }

      await this.queue.add(
        TRIGGER_JOB_NAME,
        { scheduledAt: new Date().toISOString() },
        {
          repeat: { pattern: cronExpression },
          jobId: `memory-pruning-trigger`,
        },
      );

      this.logger.info(
        { cronExpression, queueName: QUEUE_NAME },
        'MemoryPruningService: repeatable job scheduled',
      );
    } catch (err) {
      this.logger.warn(
        { error: (err as Error).message },
        'MemoryPruningService: failed to schedule repeatable job',
      );
    }
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────

  async close(): Promise<void> {
    try {
      await this.worker.close();
    } catch (err) {
      this.logger.warn(
        { error: (err as Error).message },
        'MemoryPruningService: error closing worker',
      );
    }
    try {
      await this.queue.client;
    } catch {
      // Connection never established
    }
    try {
      await this.queue.close();
    } catch (err) {
      this.logger.warn(
        { error: (err as Error).message },
        'MemoryPruningService: error closing queue',
      );
    }
  }
}
