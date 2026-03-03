// ---------------------------------------------------------------------------
// PreCompactionService — Extract facts from messages before context compaction
// E5b-3 Task 7 (AC: #6)
// ---------------------------------------------------------------------------

import type { Logger } from 'pino';
import type { MemoryService, MemoryCategory } from './memory.service.js';
import type { SemanticDedupService } from './semantic-dedup.service.js';

// ─── Types ────────────────────────────────────────────────────────────────

/** Shape matching AiMessage rows from the orchestrator's conversation history */
export interface AiMessage {
  id?: string;
  role: string;
  content: string;
}

export type FactType =
  | 'DECISION'
  | 'PREFERENCE'
  | 'INSTRUCTION'
  | 'ENTITY_CONTEXT'
  | 'ACTION_CONFIRMED';

export interface ExtractedFact {
  factType: FactType;
  content: string;
  category: MemoryCategory;
  source: 'user' | 'assistant';
}

export interface FlushResult {
  memoriesCreated: number;
  memoriesMerged: number;
  memoriesReferenced: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

/** Trigger phrases for decisions in user messages */
const DECISION_TRIGGERS = [
  'i decided to',
  "i've decided to",
  "let's go with",
  'lets go with',
  "we'll use",
  'we will use',
  "i'm going with",
  'im going with',
  'going to use',
  'decided on',
  'final decision is',
  "let's use",
  'lets use',
] as const;

/** Trigger phrases for preferences in user messages */
const PREFERENCE_TRIGGERS = [
  'i prefer',
  'i like',
  'i always',
  'i never',
  'my preference is',
  'i usually',
  'i typically',
] as const;

/** Trigger phrases for instructions in user messages */
const INSTRUCTION_TRIGGERS = [
  'remember that',
  'remember i',
  'from now on',
  'going forward',
  'make sure to',
  'always use',
  'never use',
  "don't forget",
  'keep in mind',
] as const;

/** Trigger phrases for confirmed actions in assistant messages */
const ACTION_CONFIRMED_TRIGGERS = [
  "i've created",
  "i've updated",
  "i've deleted",
  "i've generated",
  "i've scheduled",
  "i've sent",
  "i've processed",
  'i have created',
  'i have updated',
  'successfully created',
  'successfully updated',
  'has been created',
  'has been updated',
  'has been posted',
  'has been approved',
] as const;

/** Entity context triggers in user messages (mentions of specific entities) */
const ENTITY_CONTEXT_PATTERNS = [
  /(?:customer|client)\s+(?:["']?)([A-Za-z0-9][\w\s&.-]{2,30})/i,
  /(?:project)\s+(?:["']?)([A-Za-z0-9][\w\s&.-]{2,30})/i,
  /(?:invoice|order|quote)\s+#?\s*([A-Z0-9][\w-]{2,20})/i,
  /(?:supplier|vendor)\s+(?:["']?)([A-Za-z0-9][\w\s&.-]{2,30})/i,
] as const;

/** Filler words to strip for content normalisation */
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
  'just',
  'well',
  'ok',
  'okay',
  'yeah',
  'yes',
  'sure',
  'so',
  'um',
  'uh',
]);

// ─── PreCompactionService ─────────────────────────────────────────────────

export class PreCompactionService {
  /** Track which message groups have already been flushed to prevent double-extraction */
  private readonly flushedMessageKeys = new Set<string>();

  constructor(
    private readonly logger: Logger,
    private readonly memoryService: MemoryService,
    private readonly semanticDedup: SemanticDedupService | null,
  ) {}

  // ─── Main Entry Point (7.1) ──────────────────────────────────────────────

  /**
   * Extract facts from messages about to be compacted and flush them to memory.
   *
   * This is called by the orchestrator BEFORE it trims old messages from the
   * conversation history. It ensures no valuable context is lost during compaction.
   *
   * @param userId - The user's ID
   * @param companyId - The company (tenant) ID
   * @param messagesToBeCompacted - Messages that are about to be trimmed
   * @returns FlushResult summary of memory operations performed
   */
  async extractAndFlush(
    userId: string,
    companyId: string,
    messagesToBeCompacted: AiMessage[],
  ): Promise<FlushResult> {
    if (messagesToBeCompacted.length === 0) {
      return { memoriesCreated: 0, memoriesMerged: 0, memoriesReferenced: 0 };
    }

    // Guard against double-extraction for the same set of messages (user-scoped key)
    const messageKey = `${userId}:${companyId}:${this.computeMessageKey(messagesToBeCompacted)}`;
    if (this.flushedMessageKeys.has(messageKey)) {
      this.logger.debug(
        { userId, companyId, messageCount: messagesToBeCompacted.length },
        'Pre-compaction already ran for these messages — skipping',
      );
      return { memoriesCreated: 0, memoriesMerged: 0, memoriesReferenced: 0 };
    }

    this.logger.info(
      { userId, companyId, messageCount: messagesToBeCompacted.length },
      'Pre-compaction flush started — extracting facts from messages about to be trimmed',
    );

    const result: FlushResult = { memoriesCreated: 0, memoriesMerged: 0, memoriesReferenced: 0 };

    try {
      // 1. Extract facts from messages (7.2)
      const facts = this.extractFacts(messagesToBeCompacted);

      this.logger.debug(
        { userId, companyId, factCount: facts.length },
        'Facts extracted from messages',
      );

      // 2. Process each fact through the flush pipeline (7.3)
      for (const fact of facts) {
        try {
          const processed = await this.processFact(userId, companyId, fact);
          if (processed === 'created') result.memoriesCreated++;
          else if (processed === 'merged') result.memoriesMerged++;
        } catch (error) {
          // Individual fact processing failure should not stop the pipeline
          this.logger.warn(
            { error: (error as Error).message, factType: fact.factType, userId },
            'Failed to process extracted fact — skipping',
          );
        }
      }

      // 3. Update referenced memories (those whose content keywords appear in the messages)
      const referencedCount = await this.updateReferencedMemories(
        userId,
        companyId,
        messagesToBeCompacted,
      );
      result.memoriesReferenced = referencedCount;

      // Mark these messages as flushed to prevent double-extraction
      this.flushedMessageKeys.add(messageKey);

      // Evict old keys to prevent unbounded growth. Keep only the most recent 50.
      // Compaction events are sequential, so insertion-order eviction is correct.
      if (this.flushedMessageKeys.size > 100) {
        const toKeep = new Set(Array.from(this.flushedMessageKeys).slice(-50));
        this.flushedMessageKeys.clear();
        for (const key of toKeep) {
          this.flushedMessageKeys.add(key);
        }
      }

      this.logger.info({ userId, companyId, ...result }, 'Pre-compaction flush completed');
    } catch (error) {
      this.logger.warn(
        { error: (error as Error).message, userId, companyId },
        'Pre-compaction flush failed — allowing compaction to proceed',
      );
    }

    return result;
  }

  // ─── Fact Extraction (7.2) ──────────────────────────────────────────────

  /**
   * Extract facts from user and assistant messages.
   *
   * Scans for:
   *   - Decisions: "I decided to...", "Let's go with..."
   *   - Preferences: "I prefer...", "I like..."
   *   - Instructions: "Remember...", "From now on..."
   *   - Entity context: mentions of specific customers, projects, invoices
   *   - Confirmed actions (from assistant): "I've created invoice #1042 for Acme"
   */
  extractFacts(messages: AiMessage[]): ExtractedFact[] {
    const facts: ExtractedFact[] = [];
    const seenContent = new Set<string>();

    for (const message of messages) {
      if (!message.content || message.content.trim().length === 0) continue;

      const lower = message.content.toLowerCase();

      if (message.role === 'user') {
        // Extract decisions
        for (const trigger of DECISION_TRIGGERS) {
          if (lower.includes(trigger)) {
            const extracted = this.extractAfterTrigger(message.content, trigger);
            if (extracted && !seenContent.has(extracted.toLowerCase())) {
              seenContent.add(extracted.toLowerCase());
              facts.push({
                factType: 'DECISION',
                content: this.normaliseContent(extracted),
                category: 'DECISION',
                source: 'user',
              });
            }
          }
        }

        // Extract preferences
        for (const trigger of PREFERENCE_TRIGGERS) {
          if (lower.includes(trigger)) {
            const extracted = this.extractAfterTrigger(message.content, trigger);
            if (extracted && !seenContent.has(extracted.toLowerCase())) {
              seenContent.add(extracted.toLowerCase());
              facts.push({
                factType: 'PREFERENCE',
                content: this.normaliseContent(extracted),
                category: 'PREFERENCE',
                source: 'user',
              });
            }
          }
        }

        // Extract instructions
        for (const trigger of INSTRUCTION_TRIGGERS) {
          if (lower.includes(trigger)) {
            const extracted = this.extractAfterTrigger(message.content, trigger);
            if (extracted && !seenContent.has(extracted.toLowerCase())) {
              seenContent.add(extracted.toLowerCase());
              facts.push({
                factType: 'INSTRUCTION',
                content: this.normaliseContent(extracted),
                category: 'INSTRUCTION',
                source: 'user',
              });
            }
          }
        }

        // Extract entity context
        for (const pattern of ENTITY_CONTEXT_PATTERNS) {
          const match = message.content.match(pattern);
          if (match?.[0]) {
            const entityContext = match[0].trim();
            if (!seenContent.has(entityContext.toLowerCase())) {
              seenContent.add(entityContext.toLowerCase());
              facts.push({
                factType: 'ENTITY_CONTEXT',
                content: `User discussed: ${entityContext}`,
                category: 'ENTITY_CONTEXT',
                source: 'user',
              });
            }
          }
        }
      } else if (message.role === 'assistant') {
        // Extract confirmed actions from assistant messages
        for (const trigger of ACTION_CONFIRMED_TRIGGERS) {
          if (lower.includes(trigger)) {
            const extracted = this.extractActionContent(message.content, trigger);
            if (extracted && !seenContent.has(extracted.toLowerCase())) {
              seenContent.add(extracted.toLowerCase());
              facts.push({
                factType: 'ACTION_CONFIRMED',
                content: extracted,
                category: 'ENTITY_CONTEXT',
                source: 'assistant',
              });
            }
          }
        }
      }
    }

    return facts;
  }

  // ─── Flush Pipeline (7.3) ──────────────────────────────────────────────

  /**
   * Process a single extracted fact: check for duplicates then create or merge.
   *
   * @returns 'created' if a new memory was created, 'merged' if merged with existing, 'skipped' if no action taken
   */
  private async processFact(
    userId: string,
    companyId: string,
    fact: ExtractedFact,
  ): Promise<'created' | 'merged' | 'skipped'> {
    // Check semantic dedup against existing memories
    if (this.semanticDedup) {
      try {
        const dedupResult = await this.semanticDedup.checkDuplicate(
          userId,
          companyId,
          fact.content,
        );

        if (dedupResult.isDuplicate && dedupResult.existingMemory) {
          // Merge with existing memory
          await this.semanticDedup.mergeMemories(
            dedupResult.existingMemory,
            fact.content,
            'IMPLICIT',
          );

          this.logger.debug(
            {
              userId,
              companyId,
              factType: fact.factType,
              existingId: dedupResult.existingMemory.id,
            },
            'Pre-compaction fact merged with existing memory',
          );

          return 'merged';
        }
      } catch (error) {
        // Dedup failed — proceed with creation
        this.logger.warn(
          { error: (error as Error).message },
          'Semantic dedup failed during pre-compaction, proceeding with creation',
        );
      }
    }

    // Create new IMPLICIT memory
    const memory = await this.memoryService.createMemory(userId, companyId, {
      content: fact.content,
      category: fact.category,
      source: 'IMPLICIT',
      metadata: {
        extractedBy: 'pre-compaction',
        factType: fact.factType,
        sourceRole: fact.source,
      },
    });

    this.logger.debug(
      { memoryId: memory.id, userId, companyId, factType: fact.factType },
      'Pre-compaction created new implicit memory',
    );

    return 'created';
  }

  /**
   * Find existing memories referenced in the conversation and update their lastAccessedAt.
   *
   * This ensures that memories discussed in the conversation get their temporal decay reset,
   * reflecting their continued relevance.
   */
  private async updateReferencedMemories(
    userId: string,
    companyId: string,
    messages: AiMessage[],
  ): Promise<number> {
    try {
      // Build a combined text from all messages for keyword matching
      const combinedText = messages
        .map((m) => m.content)
        .join(' ')
        .toLowerCase();
      const combinedKeywords = this.extractKeywords(combinedText);

      if (combinedKeywords.size === 0) return 0;

      // Fetch existing memories
      const existingMemories = await this.memoryService.listMemories(userId, companyId, {
        limit: 100,
      });

      if (existingMemories.data.length === 0) return 0;

      let referencedCount = 0;

      for (const memory of existingMemories.data) {
        const memoryKeywords = this.extractKeywords(memory.content.toLowerCase());
        if (memoryKeywords.size === 0) continue;

        // Check if at least 50% of the memory's keywords appear in the conversation
        let overlapCount = 0;
        for (const kw of memoryKeywords) {
          if (combinedKeywords.has(kw)) overlapCount++;
        }

        const overlapRatio = overlapCount / memoryKeywords.size;
        if (overlapRatio >= 0.5) {
          // This memory was referenced — touch it to reset temporal decay
          await this.memoryService.touchMemory(memory.id);
          referencedCount++;
        }
      }

      return referencedCount;
    } catch (error) {
      this.logger.warn(
        { error: (error as Error).message, userId, companyId },
        'Failed to update referenced memories during pre-compaction',
      );
      return 0;
    }
  }

  // ─── Text Extraction Helpers ────────────────────────────────────────────

  /**
   * Extract meaningful text after a trigger phrase in a message.
   * Returns null if nothing meaningful follows the trigger.
   */
  private extractAfterTrigger(message: string, trigger: string): string | null {
    const lower = message.toLowerCase();
    const idx = lower.indexOf(trigger);
    if (idx === -1) return null;

    const after = message.slice(idx + trigger.length).trim();
    // Strip leading punctuation/whitespace
    const cleaned = after.replace(/^[,.:;\s]+/, '').trim();

    // Take up to the first sentence boundary or 200 chars
    const sentenceEnd = cleaned.search(/[.!?\n]/);
    const content = sentenceEnd > 0 ? cleaned.slice(0, sentenceEnd) : cleaned.slice(0, 200);

    return content.length > 3 ? content.trim() : null;
  }

  /**
   * Extract a confirmed action description from an assistant message.
   * Takes the sentence containing the trigger phrase.
   */
  private extractActionContent(message: string, trigger: string): string | null {
    const lower = message.toLowerCase();
    const idx = lower.indexOf(trigger);
    if (idx === -1) return null;

    // Find the start of the sentence containing the trigger
    let sentenceStart = idx;
    for (let i = idx - 1; i >= 0; i--) {
      if (message[i] === '.' || message[i] === '!' || message[i] === '?' || message[i] === '\n') {
        sentenceStart = i + 1;
        break;
      }
      if (i === 0) sentenceStart = 0;
    }

    // Find the end of the sentence
    const afterTrigger = message.slice(idx + trigger.length);
    const sentenceEnd = afterTrigger.search(/[.!?\n]/);
    const endIdx =
      sentenceEnd >= 0
        ? idx + trigger.length + sentenceEnd + 1
        : Math.min(idx + trigger.length + 200, message.length);

    const sentence = message.slice(sentenceStart, endIdx).trim();
    return sentence.length > 5 ? sentence : null;
  }

  /**
   * Normalise content by capitalising and trimming.
   */
  private normaliseContent(raw: string): string {
    let content = raw.replace(/[.!]+$/, '').trim();
    if (content.length > 0) {
      content = content.charAt(0).toUpperCase() + content.slice(1);
    }
    return content;
  }

  /**
   * Extract meaningful keywords from text for matching.
   */
  private extractKeywords(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !FILLER_WORDS.has(w)),
    );
  }

  /**
   * Compute a deterministic key for a set of messages to detect re-processing.
   * Uses message count, total character length, and first/last content snippets
   * as a lightweight fingerprint. The totalChars discriminator makes collisions
   * far less likely than count + snippets alone.
   */
  private computeMessageKey(messages: AiMessage[]): string {
    if (messages.length === 0) return '';

    const first = messages[0]!;
    const last = messages[messages.length - 1]!;
    const firstSnippet = (first.id ?? first.content.slice(0, 80)).replace(/\s+/g, '');
    const lastSnippet = (last.id ?? last.content.slice(0, 80)).replace(/\s+/g, '');
    const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);

    return `${messages.length}:${totalChars}:${firstSnippet}:${lastSnippet}`;
  }
}
