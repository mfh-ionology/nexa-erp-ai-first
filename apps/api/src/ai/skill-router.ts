// ─── Skill Router — L0 Meta-Router, L1 Pack Loader, L2 Skill Activator ──────
// E5b-2 Tasks 4–6: Three-layer routing for dynamic AI skill selection
// L0: Classify user intent → module (deterministic keyword matching)
// L1: Load module pack → select best skill (added in Task 5)
// L2: Activate skill with full context (added in Task 6)
// ─────────────────────────────────────────────────────────────────────────────

import type { PrismaClient } from '@nexa/db';
import type { ToolDefinition } from '@nexa/ai-tools';
import type { ToolRegistry } from '@nexa/ai-tools';
import type { EventBus } from '../core/events/event-bus.js';
import type { Logger } from 'pino';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ModuleClassification {
  moduleKey: string | null;
  confidence: number;
  summaryTokens: number;
}

export interface ModulePack {
  moduleKey: string;
  skills: SkillSummary[];
  overview: string;
  tokenCount: number;
}

export interface SkillSummary {
  id: string;
  name: string;
  triggerPhrases: string[];
  negativeTriggers: string[];
  contextRequired: string[];
  priority: number;
}

export interface SelectedSkill {
  id: string;
  name: string;
  moduleKey: string;
  confidence: number;
}

export interface ActivatedSkill {
  id: string;
  name: string;
  moduleKey: string;
  skillContent: string;
  parameters: Record<string, unknown> | null;
  examples: Array<{ input: string; output: string }> | null;
  tools: ToolDefinition[];
  contextKnowledge: string;
  totalTokens: number;
}

// ─── Cache Entry ────────────────────────────────────────────────────────────

interface ModuleSummaryCache {
  entries: Array<{ moduleKey: string; triggerPhrases: string[]; overview: string }>;
  summary: string;
  tokenCount: number;
  cachedAt: number;
}

const MODULE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Skill Router ───────────────────────────────────────────────────────────

export class SkillRouter {
  private moduleSummaryCache: ModuleSummaryCache | null = null;

  constructor(
    private db: PrismaClient,
    private logger: Logger,
    private toolRegistry?: ToolRegistry,
    private eventBus?: EventBus,
  ) {}

  // ─── L0: Module Classification ──────────────────────────────────────────

  /**
   * Classify a user message to a module using deterministic keyword matching.
   * Loads all active module summaries (cached 5 min) and scores each module
   * by aggregate trigger phrase overlap with the user message.
   */
  async classifyModule(userMessage: string): Promise<ModuleClassification> {
    const cache = await this.getModuleSummaries();

    if (cache.entries.length === 0) {
      return { moduleKey: null, confidence: 0, summaryTokens: 0 };
    }

    const messageWords = this.normaliseToWords(userMessage);

    let bestModule: string | null = null;
    let bestScore = 0;

    for (const entry of cache.entries) {
      const score = this.scoreModuleTriggers(messageWords, entry.triggerPhrases);
      if (score > bestScore) {
        bestScore = score;
        bestModule = entry.moduleKey;
      }
    }

    // Minimum confidence threshold — below this, no module matches
    if (bestScore < 0.1) {
      return { moduleKey: null, confidence: 0, summaryTokens: cache.tokenCount };
    }

    return {
      moduleKey: bestModule,
      confidence: bestScore,
      summaryTokens: cache.tokenCount,
    };
  }

  // ─── Module Summary Cache ───────────────────────────────────────────────

  /**
   * Load module summaries from DB or return cached version.
   * Cache has a 5-minute TTL — module list changes rarely.
   */
  private async getModuleSummaries(): Promise<ModuleSummaryCache> {
    const now = Date.now();
    if (this.moduleSummaryCache && now - this.moduleSummaryCache.cachedAt < MODULE_CACHE_TTL_MS) {
      return this.moduleSummaryCache;
    }

    // Load all distinct moduleKeys from active skills
    const skills = await this.db.aiSkill.findMany({
      where: { isActive: true, moduleKey: { not: null } },
      select: { moduleKey: true, triggerPhrases: true },
    });

    // Group trigger phrases by module
    const moduleMap = new Map<string, string[]>();
    for (const skill of skills) {
      if (!skill.moduleKey) continue;
      const existing = moduleMap.get(skill.moduleKey) ?? [];
      existing.push(...skill.triggerPhrases);
      moduleMap.set(skill.moduleKey, existing);
    }

    // Load OVERVIEW knowledge for each module
    const moduleKeys = Array.from(moduleMap.keys());
    const overviews =
      moduleKeys.length > 0
        ? await this.db.aiModuleKnowledge.findMany({
            where: {
              moduleKey: { in: moduleKeys },
              knowledgeType: 'OVERVIEW',
              isActive: true,
            },
            select: { moduleKey: true, content: true },
          })
        : [];

    const overviewMap = new Map<string, string>();
    for (const ov of overviews) {
      overviewMap.set(ov.moduleKey, ov.content);
    }

    // Build cache entries
    const entries = moduleKeys.map((mk) => ({
      moduleKey: mk,
      triggerPhrases: moduleMap.get(mk) ?? [],
      overview: overviewMap.get(mk) ?? mk,
    }));

    // Build compact summary in the spec format:
    // <available_modules>
    // - views: Saved Views, Filters, Column Management
    // - finance: General Ledger, Chart of Accounts
    // </available_modules>
    const summaryLines = entries.map((e) => `- ${e.moduleKey}: ${e.overview}`);
    const summary = `<available_modules>\n${summaryLines.join('\n')}\n</available_modules>`;

    // Rough token estimate: ~4 chars per token
    const tokenCount = Math.ceil(summary.length / 4);

    this.moduleSummaryCache = {
      entries,
      summary,
      tokenCount,
      cachedAt: now,
    };

    this.logger.debug(
      { moduleCount: entries.length, tokenCount },
      'SkillRouter: refreshed module summary cache',
    );

    return this.moduleSummaryCache;
  }

  /**
   * Get the formatted module summary string (for context injection).
   */
  async getModuleSummary(): Promise<string> {
    const cache = await this.getModuleSummaries();
    return cache.summary;
  }

  /**
   * Invalidate the module summary cache (e.g. after skill seed changes).
   */
  invalidateCache(): void {
    this.moduleSummaryCache = null;
  }

  // ─── L1: Module Pack Loader ──────────────────────────────────────────

  /**
   * Load all active skills for a module, apply tenant overrides, and include
   * the module's OVERVIEW knowledge. Returns a compact ModulePack (~500 tokens).
   */
  async loadModulePack(moduleKey: string, companyId: string, userId?: string): Promise<ModulePack> {
    // Load all active skills for this module, ordered by priority DESC
    const skills = await this.db.aiSkill.findMany({
      where: { moduleKey, isActive: true },
      select: {
        id: true,
        name: true,
        triggerPhrases: true,
        negativeTriggers: true,
        contextRequired: true,
        priority: true,
      },
      orderBy: { priority: 'desc' },
    });

    // Load tenant overrides for these skills
    const skillIds = skills.map((s) => s.id);
    const overrides =
      skillIds.length > 0
        ? await this.db.aiSkillOverride.findMany({
            where: { companyId, skillId: { in: skillIds } },
          })
        : [];

    // Index overrides by skillId for fast lookup
    const overrideMap = new Map(overrides.map((o) => [o.skillId, o]));

    // Merge overrides into skills
    const mergedSkills: SkillSummary[] = [];
    for (const skill of skills) {
      const override = overrideMap.get(skill.id);

      // If override explicitly disables this skill, exclude it
      if (override?.isActive === false) continue;

      mergedSkills.push({
        id: skill.id,
        name: skill.name,
        triggerPhrases:
          override?.triggerPhrasesOverride && override.triggerPhrasesOverride.length > 0
            ? override.triggerPhrasesOverride
            : skill.triggerPhrases,
        negativeTriggers: skill.negativeTriggers,
        contextRequired: skill.contextRequired,
        priority: override?.priorityOverride ?? skill.priority,
      });
    }

    // Re-sort by (possibly overridden) priority DESC
    mergedSkills.sort((a, b) => b.priority - a.priority);

    // Load OVERVIEW knowledge for this module
    const overview = await this.db.aiModuleKnowledge.findFirst({
      where: { moduleKey, knowledgeType: 'OVERVIEW', isActive: true },
      select: { content: true },
    });

    const overviewText = overview?.content ?? moduleKey;

    // Estimate token count
    const packText = mergedSkills
      .map((s) => `${s.name}: ${s.triggerPhrases.join(', ')}`)
      .join('\n');
    const tokenCount = Math.ceil((packText.length + overviewText.length) / 4);

    // Emit ai.skill.packLoaded event (E5b-2 Task 8.10)
    if (this.eventBus) {
      this.eventBus.emit('ai.skill.packLoaded', {
        moduleKey,
        skillCount: mergedSkills.length,
        userId: userId ?? 'system',
        companyId,
      });
    }

    this.logger.debug(
      { moduleKey, skillCount: mergedSkills.length, overrideCount: overrides.length, tokenCount },
      'SkillRouter L1: loaded module pack',
    );

    return {
      moduleKey,
      skills: mergedSkills,
      overview: overviewText,
      tokenCount,
    };
  }

  /**
   * Select the best-matching skill from a loaded module pack using trigger
   * phrase matching with negative trigger exclusion.
   *
   * Scoring: For each skill, each trigger phrase is split into words and we
   * count how many appear in the user message. The score is
   * matchedWords/totalWords averaged across matched phrases. If any negative
   * trigger phrase is found in the message (substring), score is set to 0.
   *
   * Returns null if no skill scores above the threshold (0.3).
   */
  async selectSkill(userMessage: string, pack: ModulePack): Promise<SelectedSkill | null> {
    if (pack.skills.length === 0) return null;

    const messageWords = this.normaliseToWords(userMessage);
    const messageLower = userMessage.toLowerCase();

    let bestSkill: SkillSummary | null = null;
    let bestScore = 0;

    for (const skill of pack.skills) {
      // Negative trigger exclusion — substring check
      if (this.hasNegativeTriggerMatch(messageLower, skill.negativeTriggers)) {
        continue;
      }

      const score = this.scoreModuleTriggers(messageWords, skill.triggerPhrases);
      if (score > bestScore) {
        bestScore = score;
        bestSkill = skill;
      }
    }

    // Minimum confidence threshold for skill selection
    const SKILL_MATCH_THRESHOLD = 0.3;
    if (!bestSkill || bestScore < SKILL_MATCH_THRESHOLD) {
      this.logger.debug(
        { moduleKey: pack.moduleKey, bestScore, threshold: SKILL_MATCH_THRESHOLD },
        'SkillRouter L1: no skill above threshold',
      );
      return null;
    }

    return {
      id: bestSkill.id,
      name: bestSkill.name,
      moduleKey: pack.moduleKey,
      confidence: bestScore,
    };
  }

  // ─── L2: Skill Activator ──────────────────────────────────────────────

  /**
   * Activate a selected skill by loading its full content, associated context
   * records, relevant module knowledge, and resolving required tools.
   * Returns an ActivatedSkill with everything needed for AI context injection.
   */
  async activateSkill(
    selected: SelectedSkill,
    userId: string,
    companyId?: string,
  ): Promise<ActivatedSkill | null> {
    // Load the full AiSkill record
    const skill = await this.db.aiSkill.findUnique({
      where: { id: selected.id },
      include: { contexts: true },
    });

    if (!skill) {
      this.logger.warn({ skillId: selected.id }, 'SkillRouter L2: skill not found');
      return null;
    }

    // Load relevant AiModuleKnowledge: ENTITIES first, then BUSINESS_RULES
    // Respect ~300 token budget
    const TOKEN_BUDGET = 300;
    const CHARS_PER_TOKEN = 4;
    let contextKnowledge = '';
    let knowledgeTokens = 0;

    if (skill.moduleKey) {
      const knowledgeEntries = await this.db.aiModuleKnowledge.findMany({
        where: {
          moduleKey: skill.moduleKey,
          knowledgeType: { in: ['ENTITIES', 'BUSINESS_RULES'] },
          isActive: true,
        },
        orderBy: [
          // ENTITIES before BUSINESS_RULES (alphabetical works here)
          { knowledgeType: 'asc' },
          { priority: 'desc' },
        ],
        select: { title: true, content: true, knowledgeType: true },
      });

      const knowledgeParts: string[] = [];
      for (const entry of knowledgeEntries) {
        const entryText = `[${entry.knowledgeType}] ${entry.title}: ${entry.content}`;
        const entryTokens = Math.ceil(entryText.length / CHARS_PER_TOKEN);

        if (knowledgeTokens + entryTokens > TOKEN_BUDGET) break;

        knowledgeParts.push(entryText);
        knowledgeTokens += entryTokens;
      }

      contextKnowledge = knowledgeParts.join('\n');
    }

    // Resolve required tools from the ToolRegistry
    const tools: ToolDefinition[] = [];
    if (this.toolRegistry && skill.requiredTools.length > 0) {
      for (const toolName of skill.requiredTools) {
        const def = this.toolRegistry.getDefinition(toolName);
        if (def) {
          tools.push(def);
        } else {
          this.logger.warn(
            { toolName, skillName: skill.name },
            'SkillRouter L2: required tool not registered (module not yet built)',
          );
        }
      }
    }

    // Calculate total token estimate
    const skillContentTokens = Math.ceil(skill.skillContent.length / CHARS_PER_TOKEN);
    const contextTokens = skill.contexts.reduce(
      (sum, ctx) => sum + Math.ceil(ctx.contextQuery.length / CHARS_PER_TOKEN),
      0,
    );
    const totalTokens = skillContentTokens + contextTokens + knowledgeTokens;

    // Emit ai.skill.activated event
    if (this.eventBus) {
      this.eventBus.emit('ai.skill.activated', {
        skillKey: skill.name,
        moduleKey: skill.moduleKey ?? '',
        userId,
        companyId: companyId ?? '',
        confidence: selected.confidence,
      });
    }

    this.logger.debug(
      {
        skillId: skill.id,
        skillName: skill.name,
        moduleKey: skill.moduleKey,
        toolCount: tools.length,
        totalTokens,
      },
      'SkillRouter L2: skill activated',
    );

    return {
      id: skill.id,
      name: skill.name,
      moduleKey: skill.moduleKey ?? '',
      skillContent: skill.skillContent,
      parameters: (skill.parameters as Record<string, unknown>) ?? null,
      examples: (skill.examples as Array<{ input: string; output: string }>) ?? null,
      tools,
      contextKnowledge,
      totalTokens,
    };
  }

  /**
   * Check if any negative trigger phrase appears as a substring in the message.
   */
  private hasNegativeTriggerMatch(messageLower: string, negativeTriggers: string[]): boolean {
    for (const neg of negativeTriggers) {
      if (neg && messageLower.includes(neg.toLowerCase())) {
        return true;
      }
    }
    return false;
  }

  // ─── Scoring Helpers ──────────────────────────────────────────────────

  /**
   * Score a module's aggregate trigger phrases against user message words.
   * Each trigger phrase is split into words; we count how many appear in the
   * user message. Score = matchedWords / totalWords summed across all phrases,
   * then divided by total phrase count (not just matched phrases). This prevents
   * a module with many phrases from getting a perfect score on a single match.
   */
  private scoreModuleTriggers(messageWords: Set<string>, triggerPhrases: string[]): number {
    if (triggerPhrases.length === 0) return 0;

    let totalScore = 0;
    let validPhrases = 0;

    for (const phrase of triggerPhrases) {
      const phraseWords = this.normaliseToWords(phrase);
      if (phraseWords.size === 0) continue;

      validPhrases++;

      let matchedWords = 0;
      for (const word of phraseWords) {
        if (messageWords.has(word)) {
          matchedWords++;
        }
      }

      if (matchedWords > 0) {
        totalScore += matchedWords / phraseWords.size;
      }
    }

    if (validPhrases === 0) return 0;
    return totalScore / validPhrases;
  }

  /**
   * Normalise a string to a Set of lowercase words (letters/numbers only).
   */
  private normaliseToWords(text: string): Set<string> {
    return new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 1),
    );
  }
}
