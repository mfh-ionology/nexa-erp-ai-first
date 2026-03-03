// ---------------------------------------------------------------------------
// MemoryParserService — Parse user messages for memory intents (remember/forget/correct)
// E5b-3 Task 2 (AC: #2, #5)
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type { EventBus } from '../core/events/event-bus.js';
import type { MemoryService, MemoryRecord, MemoryCategory } from './memory.service.js';
import type { SemanticDedupCheck } from './pattern-detection.service.js';

// ─── Types ────────────────────────────────────────────────────────────────

export type MemoryIntentType = 'CREATE' | 'UPDATE' | 'FORGET';

export interface MemoryIntent {
  type: MemoryIntentType;
  content: string;
  category: MemoryCategory;
  /** For corrections — the referenced content being corrected */
  referencedContent?: string;
}

export interface MemoryIntentResult {
  memory: MemoryRecord | null;
  message: string;
}

// ─── Constants ────────────────────────────────────────────────────────────

/** Trigger phrases for "remember" intents — ordered longest first to avoid partial matches */
const CREATE_TRIGGERS = [
  'remember that',
  'remember i',
  'always use',
  'never use',
  'my preference is',
  'i prefer',
  'from now on',
  'going forward',
] as const;

/** Trigger phrases for "forget" intents */
const FORGET_TRIGGERS = [
  'forget about',
  'forget that',
  'forget my',
  'stop remembering',
  'delete my preference',
  'remove my preference',
] as const;

/** Trigger phrases for "correction" intents (AC #5) */
const CORRECTION_TRIGGERS = [
  'no actually',
  'no, actually',
  "that's wrong",
  'thats wrong',
  'i changed my mind',
  'not anymore',
  'instead of',
  'correction:',
  'update my preference',
  'actually i prefer',
  'actually, i prefer',
] as const;

/** Filler words to strip from normalised content */
const FILLER_WORDS = new Set([
  'please',
  'can',
  'you',
  'could',
  'would',
  'that',
  'the',
  'a',
  'an',
  'to',
  'for',
  'me',
  'my',
  'is',
  'it',
  'this',
  'i',
  'want',
]);

// ─── MemoryParserService ──────────────────────────────────────────────────

export class MemoryParserService {
  /** Optional semantic dedup — set via setter when Task 6 is wired */
  private semanticDedup: SemanticDedupCheck | null = null;

  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
    private readonly memoryService: MemoryService,
    private readonly eventBus: EventBus,
  ) {}

  /** Set semantic dedup service (wired later when available) */
  setSemanticDedup(service: SemanticDedupCheck): void {
    this.semanticDedup = service;
  }

  // ─── Intent Detection (2.1) ──────────────────────────────────────────────

  /**
   * Parse a user message for memory-related intent.
   *
   * Checks for:
   *   1. Correction intent (highest priority — "no actually", "that's wrong")
   *   2. Forget intent ("forget about", "stop remembering")
   *   3. Create intent ("remember that", "always use", "I prefer")
   *
   * @returns MemoryIntent if detected, null otherwise
   */
  parseForMemoryIntent(message: string, _aiResponse: string): MemoryIntent | null {
    const lower = message.toLowerCase().trim();

    // 1. Correction intent (highest priority)
    for (const trigger of CORRECTION_TRIGGERS) {
      if (lower.includes(trigger)) {
        const afterTrigger = this.extractAfterTrigger(message, trigger);
        if (!afterTrigger) continue;

        return {
          type: 'UPDATE',
          content: this.normaliseContent(afterTrigger),
          category: 'INSTRUCTION',
          referencedContent: this.extractReferencedContent(afterTrigger),
        };
      }
    }

    // 2. Forget intent
    for (const trigger of FORGET_TRIGGERS) {
      if (lower.includes(trigger)) {
        const afterTrigger = this.extractAfterTrigger(message, trigger);
        if (!afterTrigger) continue;

        return {
          type: 'FORGET',
          content: this.normaliseContent(afterTrigger),
          category: 'INSTRUCTION',
        };
      }
    }

    // 3. Create intent
    for (const trigger of CREATE_TRIGGERS) {
      if (lower.includes(trigger)) {
        const afterTrigger = this.extractAfterTrigger(message, trigger);
        if (!afterTrigger) continue;

        return {
          type: 'CREATE',
          content: this.normaliseContent(afterTrigger),
          category: this.inferCategory(afterTrigger),
        };
      }
    }

    return null;
  }

  // ─── Memory Processing (2.2) ──────────────────────────────────────────────

  /**
   * Process a detected memory intent — create, update, or delete a memory.
   *
   * Checks memory settings (isEnabled, category enabled) before creation.
   * Performs semantic dedup check before creation.
   * Returns the created/merged memory and a confirmation message.
   */
  async processMemoryIntent(
    userId: string,
    companyId: string,
    intent: MemoryIntent,
  ): Promise<MemoryIntentResult> {
    // Check memory settings
    const settingsCheck = await this.checkMemorySettings(userId, companyId, intent.category);
    if (settingsCheck) return settingsCheck;

    switch (intent.type) {
      case 'CREATE':
        return this.handleCreate(userId, companyId, intent);

      case 'UPDATE':
        return this.handleCorrection(userId, companyId, intent);

      case 'FORGET':
        return this.handleForget(userId, companyId, intent);

      default:
        return { memory: null, message: '' };
    }
  }

  // ─── Settings Check ───────────────────────────────────────────────────────

  /**
   * Check if memory is enabled for this user+company and if the category is allowed.
   * Returns a MemoryIntentResult with an error message if blocked, null if allowed.
   */
  private async checkMemorySettings(
    userId: string,
    companyId: string,
    category: MemoryCategory,
  ): Promise<MemoryIntentResult | null> {
    try {
      const settings = await this.db.aiMemorySettings.findUnique({
        where: {
          userId_companyId: { userId, companyId },
        },
        select: {
          isEnabled: true,
          enabledCategories: true,
        },
      });

      // If no settings exist, memory is enabled by default with all categories
      if (!settings) return null;

      if (!settings.isEnabled) {
        return {
          memory: null,
          message: 'MEMORY_DISABLED',
        };
      }

      const enabledCategories = settings.enabledCategories ?? [];
      if (enabledCategories.length > 0 && !enabledCategories.includes(category)) {
        return {
          memory: null,
          message: `CATEGORY_DISABLED:${category}`,
        };
      }

      return null;
    } catch (error) {
      this.logger.warn(
        { error: (error as Error).message, userId, companyId },
        'Failed to check memory settings, allowing by default',
      );
      return null;
    }
  }

  // ─── Create Handler ──────────────────────────────────────────────────────

  private async handleCreate(
    userId: string,
    companyId: string,
    intent: MemoryIntent,
  ): Promise<MemoryIntentResult> {
    // Semantic dedup check before creation
    if (this.semanticDedup) {
      try {
        const dedupResult = await this.semanticDedup.checkDuplicate(
          userId,
          companyId,
          intent.content,
        );

        if (dedupResult.isDuplicate && dedupResult.existingMemory) {
          // Merge instead of create
          const merged = await this.semanticDedup.mergeMemories(
            dedupResult.existingMemory,
            intent.content,
            'EXPLICIT',
          );

          // Upgrade to EXPLICIT if existing was IMPLICIT
          if (dedupResult.existingMemory.source === 'IMPLICIT') {
            await this.memoryService.updateMemory(merged.id, userId, companyId, {
              metadata: {
                ...((merged.metadata as Record<string, unknown>) ?? {}),
                upgradedToExplicit: true,
              },
            });

            this.eventBus.emit('ai.memory.updated', {
              memoryId: merged.id,
              userId,
              companyId,
              category: merged.category,
              previousSource: 'IMPLICIT',
              newSource: 'EXPLICIT',
              reason: 'MERGE',
            });
          }

          return {
            memory: merged,
            message: `MEMORY_MERGED:${intent.content}`,
          };
        }
      } catch (error) {
        this.logger.warn(
          { error: (error as Error).message, userId, companyId },
          'Semantic dedup failed during explicit memory creation, proceeding with create',
        );
      }
    }

    // Create new explicit memory with high importance (AC #2: 1.5 for explicit)
    const memory = await this.memoryService.createMemory(userId, companyId, {
      content: intent.content,
      category: intent.category,
      source: 'EXPLICIT',
      importance: 1.5,
      metadata: { intentType: 'user_instruction' },
    });

    this.logger.info(
      { memoryId: memory.id, userId, companyId, category: intent.category },
      'Explicit memory created from user instruction',
    );

    return {
      memory,
      message: `MEMORY_CREATED:${intent.content}`,
    };
  }

  // ─── Correction Handler (AC #5) ──────────────────────────────────────────

  /**
   * Handle user corrections — find matching memory and update in-place.
   * Preserves memory ID and creation date (does NOT delete and recreate).
   */
  private async handleCorrection(
    userId: string,
    companyId: string,
    intent: MemoryIntent,
  ): Promise<MemoryIntentResult> {
    // Try to find the memory being corrected
    const existingMemory = await this.findMemoryToCorrect(userId, companyId, intent);

    if (existingMemory) {
      // Atomic update: content + metadata + source upgrade + importance boost in a single write.
      // Uses findFirst with userId+companyId to enforce cross-cutting companyId scoping
      // before the update (project-context.md mandate). AC #5: preserves memory ID and creation date.
      const previousSource = existingMemory.source;

      try {
        // Ownership verification: ensure the memory belongs to this user+company
        const verified = await this.db.aiMemory.findFirst({
          where: { id: existingMemory.id, userId, companyId },
          select: { id: true },
        });

        if (!verified) {
          this.logger.warn(
            { memoryId: existingMemory.id, userId, companyId },
            'Memory ownership verification failed during correction — creating new memory instead',
          );
          return this.handleCreate(userId, companyId, { ...intent, type: 'CREATE' });
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
        const updated = await this.db.aiMemory.update({
          where: { id: existingMemory.id },
          data: {
            content: intent.content,
            source: 'EXPLICIT',
            importance: 1.5,
            metadata: {
              ...((existingMemory.metadata as Record<string, unknown>) ?? {}),
              correctedAt: new Date().toISOString(),
              previousContent: existingMemory.content,
            } as any,
          },
        });

        this.eventBus.emit('ai.memory.updated', {
          memoryId: existingMemory.id,
          userId,
          companyId,
          category: updated.category,
          previousSource,
          newSource: 'EXPLICIT',
          reason: 'CORRECTION',
        });

        this.logger.info(
          { memoryId: existingMemory.id, userId, companyId, previousSource },
          'Memory corrected and upgraded to EXPLICIT',
        );

        return {
          memory: {
            id: updated.id,
            userId: updated.userId,
            companyId: updated.companyId,
            category: updated.category,
            content: updated.content,
            source: updated.source,
            importance:
              typeof updated.importance === 'number'
                ? updated.importance
                : parseFloat(String(updated.importance)),
            lastAccessedAt: updated.lastAccessedAt,
            metadata: updated.metadata,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
          },
          message: `MEMORY_CORRECTED:${intent.content}`,
        };
      } catch {
        // Fallback: create new if atomic update fails
        return this.handleCreate(userId, companyId, { ...intent, type: 'CREATE' });
      }
    }

    // No matching memory found — create a new EXPLICIT memory instead
    this.logger.debug(
      { userId, companyId, content: intent.content },
      'No matching memory found for correction, creating new explicit memory',
    );

    return this.handleCreate(userId, companyId, { ...intent, type: 'CREATE' });
  }

  // ─── Forget Handler ──────────────────────────────────────────────────────

  private async handleForget(
    userId: string,
    companyId: string,
    intent: MemoryIntent,
  ): Promise<MemoryIntentResult> {
    // Search for memories matching the forget content
    const memories = await this.memoryService.listMemories(userId, companyId, {
      search: intent.content,
      limit: 10,
    });

    if (memories.data.length === 0) {
      return {
        memory: null,
        message: `MEMORY_NOT_FOUND:${intent.content}`,
      };
    }

    // Delete the best match (first result, highest effective importance)
    const target = memories.data[0]!;
    await this.memoryService.deleteMemory(target.id, userId, companyId);

    this.logger.info(
      { memoryId: target.id, userId, companyId, content: target.content },
      'Memory forgotten by user request',
    );

    return {
      memory: null,
      message: `MEMORY_FORGOTTEN:${target.content}`,
    };
  }

  // ─── Memory Search for Corrections ──────────────────────────────────────

  /**
   * Find the memory being corrected — uses semantic similarity if available,
   * falls back to keyword search.
   */
  private async findMemoryToCorrect(
    userId: string,
    companyId: string,
    intent: MemoryIntent,
  ): Promise<MemoryRecord | null> {
    // Try semantic search first (if dedup service available)
    if (this.semanticDedup && intent.referencedContent) {
      try {
        const result = await this.semanticDedup.checkDuplicate(
          userId,
          companyId,
          intent.referencedContent,
        );
        if (result.existingMemory) return result.existingMemory;
      } catch {
        // Fall through to keyword search
      }
    }

    // Keyword search fallback — search by the referenced or main content
    const searchTerm = intent.referencedContent ?? intent.content;
    const keywords = this.extractKeywords(searchTerm);

    if (keywords.length === 0) return null;

    // Search using the most distinctive keyword
    const results = await this.memoryService.listMemories(userId, companyId, {
      search: keywords[0],
      limit: 5,
    });

    if (results.data.length === 0) return null;

    // Return the best match by keyword overlap
    let bestMatch: MemoryRecord | null = null;
    let bestScore = 0;

    for (const mem of results.data) {
      const memKeywords = this.extractKeywords(mem.content);
      const overlap = keywords.filter((k) => memKeywords.includes(k)).length;
      const score = overlap / Math.max(keywords.length, 1);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = mem;
      }
    }

    return bestMatch;
  }

  // ─── Text Processing Helpers ──────────────────────────────────────────────

  /**
   * Extract the meaningful text after a trigger phrase.
   * Returns null if nothing meaningful follows the trigger.
   */
  private extractAfterTrigger(message: string, trigger: string): string | null {
    const lower = message.toLowerCase();
    const idx = lower.indexOf(trigger);
    if (idx === -1) return null;

    const after = message.slice(idx + trigger.length).trim();
    // Strip leading punctuation/whitespace
    const cleaned = after.replace(/^[,.:;\s]+/, '').trim();

    return cleaned.length > 2 ? cleaned : null;
  }

  /**
   * Normalise content by stripping leading filler phrases and cleaning up.
   * AC #2 requires normalised form (e.g., "User prefers Net 30 payment terms for new customers").
   * Strips common filler prefixes like "I want to", "can you", "please" etc.
   */
  private normaliseContent(raw: string): string {
    // Remove trailing punctuation
    let content = raw.replace(/[.!]+$/, '').trim();

    // Strip common leading filler phrases (case-insensitive)
    const fillerPrefixes = [
      /^(?:i\s+want\s+(?:to\s+)?)/i,
      /^(?:can\s+you\s+(?:please\s+)?)/i,
      /^(?:could\s+you\s+(?:please\s+)?)/i,
      /^(?:please\s+)/i,
      /^(?:i\s+would\s+like\s+(?:to\s+)?)/i,
      /^(?:i\s+need\s+(?:to\s+)?)/i,
      /^(?:make\s+sure\s+(?:to\s+)?)/i,
    ];

    for (const prefix of fillerPrefixes) {
      const stripped = content.replace(prefix, '');
      if (stripped.length > 2 && stripped !== content) {
        content = stripped;
        break;
      }
    }

    content = content.trim();

    // Capitalise first letter
    if (content.length > 0) {
      content = content.charAt(0).toUpperCase() + content.slice(1);
    }

    return content;
  }

  /**
   * Extract referenced content from a correction message.
   * Looks for "instead of X" patterns to find what's being corrected.
   */
  private extractReferencedContent(text: string): string | undefined {
    const lower = text.toLowerCase();

    // "instead of X, use Y" → referenced = X
    const insteadOfMatch = lower.match(/instead of\s+(.+?)(?:,|$)/);
    if (insteadOfMatch?.[1]) return insteadOfMatch[1].trim();

    // "not X anymore" → referenced = X
    const notMatch = lower.match(/not\s+(.+?)\s+anymore/);
    if (notMatch?.[1]) return notMatch[1].trim();

    return undefined;
  }

  /**
   * Infer the memory category from the content.
   * Defaults to INSTRUCTION for explicit user commands.
   */
  private inferCategory(content: string): MemoryCategory {
    const lower = content.toLowerCase();

    // Preference indicators
    if (
      lower.includes('prefer') ||
      lower.includes('like') ||
      lower.includes('favourite') ||
      lower.includes('favorite')
    ) {
      return 'PREFERENCE';
    }

    // Workflow indicators
    if (
      lower.includes('workflow') ||
      lower.includes('process') ||
      lower.includes('step') ||
      lower.includes('sequence')
    ) {
      return 'WORKFLOW';
    }

    // Decision indicators
    if (lower.includes('decided') || lower.includes('chosen') || lower.includes('going with')) {
      return 'DECISION';
    }

    // Default to INSTRUCTION for explicit user commands
    return 'INSTRUCTION';
  }

  /**
   * Extract meaningful keywords from text (for search/matching).
   * Removes stop words and filler words.
   */
  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !FILLER_WORDS.has(w));
  }
}
