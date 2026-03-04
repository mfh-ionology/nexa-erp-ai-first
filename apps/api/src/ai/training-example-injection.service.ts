// ---------------------------------------------------------------------------
// TrainingExampleInjectionService — Retrieves relevant training examples and
// formats them as few-shot context for injection into the AI system prompt.
// E5d-2 Task 5 (AC: #5)
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import { estimateTokens } from './dynamic-context.service.js';

// ─── Types ────────────────────────────────────────────────────────────────

export interface TrainingExampleRow {
  id: string;
  inputText: string;
  outputText: string;
  category: string;
  skillKey: string | null;
}

export interface InjectionResult {
  examples: TrainingExampleRow[];
  formattedContext: string;
  totalTokens: number;
}

// ─── Constants ────────────────────────────────────────────────────────────

/** Maximum number of training examples to inject */
const MAX_EXAMPLES = 3;

// ─── TrainingExampleInjectionService ──────────────────────────────────────

export class TrainingExampleInjectionService {
  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
  ) {}

  /**
   * Retrieve relevant training examples for the current AI context.
   *
   * Priority ordering:
   *   1. Skill-matching examples (WHERE skillKey = ?) — highest relevance
   *   2. Category-matching examples (WHERE category = ?)
   *   3. All active examples (fallback)
   *
   * Examples share the ~1000 token knowledge budget with RAG chunks.
   * They are injected AFTER RAG chunks, so remaining budget may be limited.
   *
   * Never throws — returns empty result on any failure (graceful degradation).
   */
  async retrieveRelevantExamples(
    companyId: string,
    skillKey?: string | null,
    category?: string | null,
    tokenBudget?: number,
  ): Promise<InjectionResult> {
    const emptyResult: InjectionResult = { examples: [], formattedContext: '', totalTokens: 0 };

    try {
      const candidates: TrainingExampleRow[] = [];

      // 1. Skill-matching examples first (highest priority)
      if (skillKey) {
        const skillMatches = await this.db.aiTrainingExample.findMany({
          where: { companyId, isActive: true, skillKey },
          select: { id: true, inputText: true, outputText: true, category: true, skillKey: true },
          orderBy: { createdAt: 'desc' },
          take: MAX_EXAMPLES,
        });
        for (const row of skillMatches) {
          candidates.push(row);
        }
      }

      // 2. Category-matching examples (if we still need more)
      if (candidates.length < MAX_EXAMPLES && category) {
        const categoryMatches = await this.db.aiTrainingExample.findMany({
          where: {
            companyId,
            isActive: true,
            category,
            // Exclude already-selected skill matches
            ...(candidates.length > 0 ? { id: { notIn: candidates.map((c) => c.id) } } : {}),
          },
          select: { id: true, inputText: true, outputText: true, category: true, skillKey: true },
          orderBy: { createdAt: 'desc' },
          take: MAX_EXAMPLES - candidates.length,
        });
        for (const row of categoryMatches) {
          candidates.push(row);
        }
      }

      // 3. Fallback: any active examples (if we still need more)
      if (candidates.length < MAX_EXAMPLES) {
        const fallbackMatches = await this.db.aiTrainingExample.findMany({
          where: {
            companyId,
            isActive: true,
            ...(candidates.length > 0 ? { id: { notIn: candidates.map((c) => c.id) } } : {}),
          },
          select: { id: true, inputText: true, outputText: true, category: true, skillKey: true },
          orderBy: { createdAt: 'desc' },
          take: MAX_EXAMPLES - candidates.length,
        });
        for (const row of fallbackMatches) {
          candidates.push(row);
        }
      }

      if (candidates.length === 0) {
        return emptyResult;
      }

      // Select examples within token budget
      const selected: TrainingExampleRow[] = [];
      let usedTokens = 0;
      const budget = tokenBudget ?? Infinity;

      // Reserve tokens for the header line
      const headerTokens = estimateTokens('## Training Examples\n');
      usedTokens += headerTokens;

      for (const example of candidates) {
        const lineText = `- Q: "${example.inputText}" → A: "${example.outputText}"\n`;
        const lineTokens = estimateTokens(lineText);

        if (usedTokens + lineTokens > budget) break;

        selected.push(example);
        usedTokens += lineTokens;
      }

      if (selected.length === 0) {
        return emptyResult;
      }

      // Format context
      const formattedContext = this.formatContext(selected);
      const totalTokens = estimateTokens(formattedContext);

      return { examples: selected, formattedContext, totalTokens };
    } catch (error) {
      this.logger.warn(
        { err: error, companyId },
        'TrainingExampleInjection: retrieval failed, returning empty',
      );
      return emptyResult;
    }
  }

  // ─── Private: Context Formatting ──────────────────────────────────────

  /**
   * Format selected training examples as a few-shot block for injection
   * into the <tenant_knowledge> section of the AI system prompt.
   */
  private formatContext(examples: TrainingExampleRow[]): string {
    if (examples.length === 0) return '';

    const lines = examples.map((ex) => `- Q: "${ex.inputText}" → A: "${ex.outputText}"`);

    return ['## Training Examples', ...lines].join('\n');
  }
}
