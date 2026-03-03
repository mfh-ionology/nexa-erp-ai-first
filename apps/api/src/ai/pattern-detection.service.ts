// ---------------------------------------------------------------------------
// PatternDetectionService — Detect repeated user actions and create implicit memories
// E5b-3 Task 1 (AC: #1)
// ---------------------------------------------------------------------------

import type { Logger } from 'pino';
import type { EventBus } from '../core/events/event-bus.js';
import type { MemoryService, MemoryRecord } from './memory.service.js';

// ─── Types ────────────────────────────────────────────────────────────────

export interface PatternAction {
  actionType: string;
  entityType?: string;
  viewKey?: string;
  filterApplied?: string;
  metadata?: Record<string, unknown>;
}

/** Internal tracked action with timestamp */
interface TrackedAction extends PatternAction {
  timestamp: Date;
}

export type PatternType =
  | 'VIEW_PREFERENCE'
  | 'FILTER_PREFERENCE'
  | 'WORKFLOW_PATTERN'
  | 'TIME_PATTERN';

export interface DetectedPattern {
  patternType: PatternType;
  description: string;
  occurrenceCount: number;
  confidence: number;
  suggestedCategory: 'PREFERENCE' | 'WORKFLOW';
  /** Composite key used for grouping: actionType + entityType */
  patternKey: string;
}

/** Interface for semantic dedup (Task 6) — optional dependency */
export interface SemanticDedupCheck {
  checkDuplicate(
    userId: string,
    companyId: string,
    newContent: string,
  ): Promise<{ isDuplicate: boolean; existingMemory?: MemoryRecord; similarity: number }>;
  mergeMemories(
    existing: MemoryRecord,
    newContent: string,
    newSource?: 'EXPLICIT' | 'IMPLICIT',
  ): Promise<MemoryRecord>;
}

// ─── Constants ────────────────────────────────────────────────────────────

/** Minimum occurrences to trigger a pattern */
const PATTERN_THRESHOLD = 3;

/** Rolling window for pattern analysis (30 days in ms) */
const PATTERN_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Maximum actions to keep per user in the buffer */
const MAX_BUFFER_SIZE = 500;

/** Run pattern analysis every N recorded actions to auto-create implicit memories */
const ANALYSE_EVERY_N_ACTIONS = 5;

// ─── PatternDetectionService ──────────────────────────────────────────────

export class PatternDetectionService {
  /** In-memory action buffer per user+company (userId:companyId → tracked actions) */
  private readonly actionBuffer = new Map<string, TrackedAction[]>();

  /** Counter per user+company to trigger periodic analysis */
  private readonly actionCounter = new Map<string, number>();

  /** Track which pattern keys have already been converted to memories to avoid re-creation */
  private readonly createdPatternKeys = new Set<string>();

  /** Optional semantic dedup service — set via setter when Task 6 is wired */
  private semanticDedup: SemanticDedupCheck | null = null;

  constructor(
    private readonly logger: Logger,
    private readonly eventBus: EventBus,
    private readonly memoryService: MemoryService,
  ) {}

  /** Set semantic dedup service (wired later when available) */
  setSemanticDedup(service: SemanticDedupCheck): void {
    this.semanticDedup = service;
  }

  // ─── Action Recording (1.1) ────────────────────────────────────────────

  /**
   * Record a user action into the in-memory tracking buffer.
   * Actions are kept in a rolling 30-day window, capped at MAX_BUFFER_SIZE per user.
   *
   * Every ANALYSE_EVERY_N_ACTIONS actions, automatically triggers pattern analysis
   * and creates implicit memories for any newly detected patterns.
   */
  recordAction(userId: string, companyId: string, action: PatternAction): void {
    const bufferKey = `${userId}:${companyId}`;
    const tracked: TrackedAction = { ...action, timestamp: new Date() };

    let buffer = this.actionBuffer.get(bufferKey);
    if (!buffer) {
      buffer = [];
      this.actionBuffer.set(bufferKey, buffer);
    }

    buffer.push(tracked);

    // Prune old entries outside the 30-day window
    const cutoff = Date.now() - PATTERN_WINDOW_MS;
    const pruned = buffer.filter((a) => a.timestamp.getTime() >= cutoff);

    // Cap to prevent unbounded growth
    if (pruned.length > MAX_BUFFER_SIZE) {
      pruned.splice(0, pruned.length - MAX_BUFFER_SIZE);
    }

    this.actionBuffer.set(bufferKey, pruned);

    // Auto-trigger pattern analysis every N actions (fire-and-forget)
    const count = (this.actionCounter.get(bufferKey) ?? 0) + 1;
    this.actionCounter.set(bufferKey, count);

    if (count % ANALYSE_EVERY_N_ACTIONS === 0) {
      this.analyseAndCreateMemories(userId, companyId).catch((error) => {
        this.logger.debug(
          { error: (error as Error).message, userId, companyId },
          'Auto pattern analysis failed — non-critical, skipping',
        );
      });
    }
  }

  /**
   * Get the current action buffer for a user+company (for testing/inspection).
   */
  getActionBuffer(userId: string, companyId: string): TrackedAction[] {
    return this.actionBuffer.get(`${userId}:${companyId}`) ?? [];
  }

  /**
   * Clear the action buffer for a user+company (for testing).
   */
  clearBuffer(userId: string, companyId: string): void {
    this.actionBuffer.delete(`${userId}:${companyId}`);
  }

  /**
   * Analyse patterns and auto-create implicit memories for newly detected ones.
   * Skips patterns that have already been converted to memories.
   * Fire-and-forget — failures are logged but never throw to the caller.
   */
  async analyseAndCreateMemories(userId: string, companyId: string): Promise<void> {
    const patterns = this.analysePatterns(userId, companyId);

    for (const pattern of patterns) {
      const dedupKey = `${userId}:${companyId}:${pattern.patternKey}`;
      if (this.createdPatternKeys.has(dedupKey)) continue;

      try {
        await this.createImplicitMemory(userId, companyId, pattern);
        this.createdPatternKeys.add(dedupKey);
      } catch (error) {
        this.logger.debug(
          { error: (error as Error).message, patternKey: pattern.patternKey },
          'Failed to create implicit memory from pattern — skipping',
        );
      }
    }

    // Evict old pattern keys to prevent unbounded growth (keep last 500)
    if (this.createdPatternKeys.size > 1000) {
      const toKeep = Array.from(this.createdPatternKeys).slice(-500);
      this.createdPatternKeys.clear();
      for (const key of toKeep) {
        this.createdPatternKeys.add(key);
      }
    }
  }

  // ─── Pattern Analysis (1.2) ────────────────────────────────────────────

  /**
   * Analyse recent actions (30-day window) for repetition patterns.
   * Groups by (actionType + entityType) and checks if threshold is met.
   */
  analysePatterns(userId: string, companyId: string): DetectedPattern[] {
    const bufferKey = `${userId}:${companyId}`;
    const buffer = this.actionBuffer.get(bufferKey);
    if (!buffer || buffer.length === 0) return [];

    const cutoff = Date.now() - PATTERN_WINDOW_MS;
    const recentActions = buffer.filter((a) => a.timestamp.getTime() >= cutoff);

    if (recentActions.length === 0) return [];

    const detected: DetectedPattern[] = [];

    // ── VIEW_PREFERENCE: group by actionType + entityType ──
    const viewCounts = new Map<string, { count: number; actions: TrackedAction[] }>();
    for (const action of recentActions) {
      if (action.actionType === 'view' || action.actionType === 'navigate') {
        const key = `${action.actionType}:${action.entityType ?? ''}:${action.viewKey ?? ''}`;
        const entry = viewCounts.get(key) ?? { count: 0, actions: [] };
        entry.count++;
        entry.actions.push(action);
        viewCounts.set(key, entry);
      }
    }

    for (const [key, entry] of viewCounts) {
      if (entry.count >= PATTERN_THRESHOLD) {
        const sample = entry.actions[0]!;
        const viewDesc = sample.viewKey
          ? `the "${sample.viewKey}" view`
          : sample.entityType
            ? `${sample.entityType} listings`
            : 'this view';
        detected.push({
          patternType: 'VIEW_PREFERENCE',
          description: `User frequently opens ${viewDesc}`,
          occurrenceCount: entry.count,
          confidence: Math.min(entry.count / (PATTERN_THRESHOLD * 2), 1.0),
          suggestedCategory: 'PREFERENCE',
          patternKey: key,
        });
      }
    }

    // ── FILTER_PREFERENCE: group by actionType=filter + filterApplied ──
    const filterCounts = new Map<string, { count: number; actions: TrackedAction[] }>();
    for (const action of recentActions) {
      if (action.actionType === 'filter' && action.filterApplied) {
        const key = `filter:${action.entityType ?? ''}:${action.filterApplied}`;
        const entry = filterCounts.get(key) ?? { count: 0, actions: [] };
        entry.count++;
        entry.actions.push(action);
        filterCounts.set(key, entry);
      }
    }

    for (const [key, entry] of filterCounts) {
      if (entry.count >= PATTERN_THRESHOLD) {
        const sample = entry.actions[0]!;
        detected.push({
          patternType: 'FILTER_PREFERENCE',
          description: `User frequently filters ${sample.entityType ?? 'items'} by "${sample.filterApplied}"`,
          occurrenceCount: entry.count,
          confidence: Math.min(entry.count / (PATTERN_THRESHOLD * 2), 1.0),
          suggestedCategory: 'PREFERENCE',
          patternKey: key,
        });
      }
    }

    // ── WORKFLOW_PATTERN: group by actionType (for tool/skill usage) ──
    const workflowCounts = new Map<string, { count: number; actions: TrackedAction[] }>();
    for (const action of recentActions) {
      if (
        action.actionType !== 'view' &&
        action.actionType !== 'navigate' &&
        action.actionType !== 'filter'
      ) {
        const key = `workflow:${action.actionType}:${action.entityType ?? ''}`;
        const entry = workflowCounts.get(key) ?? { count: 0, actions: [] };
        entry.count++;
        entry.actions.push(action);
        workflowCounts.set(key, entry);
      }
    }

    for (const [key, entry] of workflowCounts) {
      if (entry.count >= PATTERN_THRESHOLD) {
        const sample = entry.actions[0]!;
        detected.push({
          patternType: 'WORKFLOW_PATTERN',
          description: `User frequently performs "${sample.actionType}" on ${sample.entityType ?? 'entities'}`,
          occurrenceCount: entry.count,
          confidence: Math.min(entry.count / (PATTERN_THRESHOLD * 2), 1.0),
          suggestedCategory: 'WORKFLOW',
          patternKey: key,
        });
      }
    }

    // ── TIME_PATTERN: detect consistent time-of-day usage ──
    const hourBuckets = new Map<number, number>();
    for (const action of recentActions) {
      const hour = action.timestamp.getHours();
      hourBuckets.set(hour, (hourBuckets.get(hour) ?? 0) + 1);
    }

    for (const [hour, count] of hourBuckets) {
      if (count >= PATTERN_THRESHOLD) {
        const timeLabel = `${hour.toString().padStart(2, '0')}:00`;
        detected.push({
          patternType: 'TIME_PATTERN',
          description: `User is most active around ${timeLabel}`,
          occurrenceCount: count,
          confidence: Math.min(count / (recentActions.length * 0.3), 1.0),
          suggestedCategory: 'PREFERENCE',
          patternKey: `time:${hour}`,
        });
      }
    }

    return detected;
  }

  // ─── Implicit Memory Creation (1.3) ─────────────────────────────────────

  /**
   * Create an implicit memory from a detected pattern.
   * Performs semantic dedup check before creation — merges if duplicate found.
   *
   * @returns The created or merged memory, or null if dedup merged into existing
   */
  async createImplicitMemory(
    userId: string,
    companyId: string,
    pattern: DetectedPattern,
  ): Promise<MemoryRecord | null> {
    const content = pattern.description;

    // Semantic dedup check (if service is available)
    if (this.semanticDedup) {
      try {
        const dedupResult = await this.semanticDedup.checkDuplicate(userId, companyId, content);

        if (dedupResult.isDuplicate && dedupResult.existingMemory) {
          // Merge instead of create
          this.logger.debug(
            {
              userId,
              companyId,
              similarity: dedupResult.similarity,
              existingId: dedupResult.existingMemory.id,
            },
            'Pattern duplicate detected — merging with existing memory',
          );

          const merged = await this.semanticDedup.mergeMemories(
            dedupResult.existingMemory,
            content,
            'IMPLICIT',
          );

          this.eventBus.emit('ai.memory.updated', {
            memoryId: merged.id,
            userId,
            companyId,
            category: merged.category,
            previousSource: dedupResult.existingMemory.source,
            newSource: merged.source,
            reason: 'MERGE',
          });

          return merged;
        }
      } catch (error) {
        // Graceful degradation — proceed with creation if dedup fails
        this.logger.warn(
          { error: (error as Error).message, userId, companyId },
          'Semantic dedup check failed, proceeding with memory creation',
        );
      }
    }

    // Create new implicit memory
    const memory = await this.memoryService.createMemory(userId, companyId, {
      content,
      category: pattern.suggestedCategory,
      source: 'IMPLICIT',
      metadata: {
        patternType: pattern.patternType,
        patternKey: pattern.patternKey,
        occurrenceCount: pattern.occurrenceCount,
        confidence: pattern.confidence,
      },
    });

    // Note: MemoryService.createMemory already emits 'ai.memory.created' with source

    this.logger.info(
      { memoryId: memory.id, userId, companyId, patternType: pattern.patternType },
      'Implicit memory created from detected pattern',
    );

    return memory;
  }
}
