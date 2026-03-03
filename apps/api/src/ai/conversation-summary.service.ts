// ---------------------------------------------------------------------------
// ConversationSummaryService — Summarise AI conversations on session end
// E5b-1 Task 3.1
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type { AiGateway } from '@nexa/ai-gateway';
import type { EventBus } from '../core/events/event-bus.js';

// ─── Types ────────────────────────────────────────────────────────────────

export interface ConversationSummaryRecord {
  id: string;
  userId: string;
  companyId: string;
  conversationId: string;
  summary: string;
  topics: string[];
  decisionsCount: number;
  actionsCount: number;
  createdAt: Date;
}

/** Parsed JSON output from the summarisation LLM call */
interface SummarisationOutput {
  summary: string;
  topics: string[];
  decisionsCount: number;
  actionsCount: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

/** Max characters for summary content (~500 tokens at ~4 chars/token) */
const MAX_SUMMARY_CHARS = 2000;

/** Max characters for input transcript (~10k tokens at ~4 chars/token) to stay within LLM context limits */
const MAX_TRANSCRIPT_CHARS = 40_000;

/** Summarisation prompt name in the AiPrompt table */
export const SUMMARISATION_PROMPT_NAME = 'conversation-summariser';

/** System prompt for conversation summarisation */
export const SUMMARISATION_SYSTEM_PROMPT = `You are a conversation summariser for Nexa ERP. Summarise this conversation into key decisions, actions taken, and context. Be concise. Focus on facts the user would want remembered.

Return a JSON object with this exact structure:
{
  "summary": "A concise paragraph summarising the key points of the conversation.",
  "topics": ["topic1", "topic2"],
  "decisionsCount": 0,
  "actionsCount": 0
}

Rules:
- "summary" must be under 500 words
- "topics" should be 1-5 short tags (e.g., "invoicing", "customer setup", "payment terms")
- "decisionsCount" is the number of decisions made during the conversation
- "actionsCount" is the number of actions taken (records created, settings changed, etc.)
- Return ONLY valid JSON, no markdown fences or extra text`;

/** User template for the summarisation prompt */
export const SUMMARISATION_USER_TEMPLATE = `Summarise the following conversation:\n\n{{conversationTranscript}}`;

// ─── ConversationSummaryService ───────────────────────────────────────────

export class ConversationSummaryService {
  constructor(
    private readonly db: PrismaClient,
    private readonly aiGateway: AiGateway,
    private readonly eventBus: EventBus,
    private readonly logger: Logger,
  ) {}

  /**
   * Summarise a conversation by loading its messages and using the AI Gateway
   * to compress them into a structured summary.
   *
   * Called when a conversation session ends (status → 'completed').
   * Respects memory settings — if memory is disabled for the user, no summary is created.
   */
  async summariseConversation(conversationId: string): Promise<ConversationSummaryRecord | null> {
    // 1. Load the conversation with user/company context
    const conversation = await this.db.aiConversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        userId: true,
        companyId: true,
        status: true,
      },
    });

    if (!conversation) {
      this.logger.warn({ conversationId }, 'Cannot summarise: conversation not found');
      return null;
    }

    // 2. Check memory settings — respect isEnabled
    const settings = await this.db.aiMemorySettings.findUnique({
      where: {
        userId_companyId: {
          userId: conversation.userId,
          companyId: conversation.companyId,
        },
      },
      select: { isEnabled: true },
    });

    // If settings exist and memory is disabled, skip summarisation
    if (settings && !settings.isEnabled) {
      this.logger.debug(
        { conversationId, userId: conversation.userId },
        'Skipping summarisation: memory disabled for user',
      );
      return null;
    }

    // 3. Check if summary already exists for this conversation
    const existingSummary = await this.db.aiConversationSummary.findFirst({
      where: { conversationId },
      select: { id: true },
    });

    if (existingSummary) {
      this.logger.debug({ conversationId }, 'Summary already exists, skipping');
      return null;
    }

    // 4. Load conversation messages
    const messages = await this.db.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      select: {
        role: true,
        content: true,
        createdAt: true,
      },
    });

    if (messages.length === 0) {
      this.logger.debug({ conversationId }, 'No messages to summarise');
      return null;
    }

    // 5. Build conversation transcript (truncated to fit LLM input context)
    let transcript = messages.map((m) => `[${m.role}]: ${m.content}`).join('\n');

    if (transcript.length > MAX_TRANSCRIPT_CHARS) {
      transcript = transcript.slice(0, MAX_TRANSCRIPT_CHARS) + '\n[...truncated]';
    }

    // 6. Call AI Gateway for summarisation
    const parsed = await this.callSummarisationLlm(
      transcript,
      conversation.userId,
      conversation.companyId,
    );

    if (!parsed) {
      this.logger.warn(
        { conversationId },
        'Summarisation LLM call failed or returned invalid output',
      );
      return null;
    }

    // 7. Truncate summary to token budget
    const truncatedSummary =
      parsed.summary.length > MAX_SUMMARY_CHARS
        ? parsed.summary.slice(0, MAX_SUMMARY_CHARS)
        : parsed.summary;

    // 8. Store in ai_conversation_summaries
    const summary = await this.db.aiConversationSummary.create({
      data: {
        userId: conversation.userId,
        companyId: conversation.companyId,
        conversationId,
        summary: truncatedSummary,
        topics: parsed.topics.slice(0, 5), // max 5 topics
        decisionsCount: parsed.decisionsCount,
        actionsCount: parsed.actionsCount,
      },
    });

    // 9. Emit event
    this.eventBus.emit('ai.conversation.summarised', {
      summaryId: summary.id,
      conversationId,
      userId: conversation.userId,
      companyId: conversation.companyId,
    });

    this.logger.info(
      {
        summaryId: summary.id,
        conversationId,
        userId: conversation.userId,
        topicCount: parsed.topics.length,
        decisionsCount: parsed.decisionsCount,
        actionsCount: parsed.actionsCount,
      },
      'Conversation summarised',
    );

    return this.toRecord(summary);
  }

  // ─── Private Helpers ──────────────────────────────────────────────────

  /**
   * Call the AI Gateway with the summarisation prompt.
   * Returns parsed output or null if the call fails.
   */
  private async callSummarisationLlm(
    transcript: string,
    userId: string,
    companyId: string,
  ): Promise<SummarisationOutput | null> {
    try {
      const response = await this.aiGateway.complete({
        tenantId: companyId,
        userId,
        featureKey: 'ai.memory_management',
        routingTags: ['cheap'], // Use cheaper model for summarisation
        maxOutputTokens: 600,
        temperature: 0.3, // Low temperature for factual summarisation
        messages: [
          { role: 'system', content: SUMMARISATION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: SUMMARISATION_USER_TEMPLATE.replace('{{conversationTranscript}}', transcript),
          },
        ],
      });

      return this.parseSummarisationOutput(response.content);
    } catch (error) {
      this.logger.error(
        { error: (error as Error).message },
        'AI Gateway summarisation call failed',
      );
      return null;
    }
  }

  /**
   * Parse and validate the LLM's JSON output.
   * Gracefully handles malformed responses.
   */
  private parseSummarisationOutput(content: string): SummarisationOutput | null {
    try {
      // Strip markdown code fences if present
      const cleaned = content
        .replace(/^```json?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();

      const parsed = JSON.parse(cleaned) as Record<string, unknown>;

      // Validate required fields
      if (typeof parsed.summary !== 'string' || parsed.summary.length === 0) {
        this.logger.warn('Summarisation output missing or empty "summary" field');
        return null;
      }

      return {
        summary: parsed.summary,
        topics: Array.isArray(parsed.topics)
          ? (parsed.topics as unknown[]).filter((t): t is string => typeof t === 'string')
          : [],
        decisionsCount:
          typeof parsed.decisionsCount === 'number'
            ? Math.max(0, Math.floor(parsed.decisionsCount))
            : 0,
        actionsCount:
          typeof parsed.actionsCount === 'number'
            ? Math.max(0, Math.floor(parsed.actionsCount))
            : 0,
      };
    } catch {
      this.logger.warn('Failed to parse summarisation JSON output');
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma model return type
  private toRecord(summary: any): ConversationSummaryRecord {
    return {
      id: summary.id,
      userId: summary.userId,
      companyId: summary.companyId,
      conversationId: summary.conversationId,
      summary: summary.summary,
      topics: summary.topics,
      decisionsCount: summary.decisionsCount,
      actionsCount: summary.actionsCount,
      createdAt: summary.createdAt,
    };
  }
}
