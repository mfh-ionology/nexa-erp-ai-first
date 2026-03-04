// ---------------------------------------------------------------------------
// DynamicContextService — Assemble full AI context with skill routing, memory,
// module knowledge, permissions, and screen context.
// E5b-2 Task 7: AC #13 (INTERACTIVE), AC #14 (AUTONOMOUS)
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import type { ToolDefinition, ToolRegistry } from '@nexa/ai-tools';
import type { Logger } from 'pino';
import type { SkillRouter } from './skill-router.js';
import type { MemoryInjectionService } from './memory-injection.service.js';
import type { KnowledgeRagService } from './knowledge-rag.service.js';
import type { TrainingExampleInjectionService } from './training-example-injection.service.js';

// ─── Constants ────────────────────────────────────────────────────────────

/** Approximate characters per token (matches orchestrator's existing constant) */
const CHARS_PER_TOKEN = 4;

/** Token budgets per section (INTERACTIVE mode, ~5000 total) */
const BUDGET_INTERACTIVE = {
  base: 500,
  memories: 2000,
  skills: 1000,
  knowledge: 1000,
  permissions: 200,
  screen: 300,
  total: 5500,
} as const;

/** Token budgets per section (AUTONOMOUS mode, ~3000 total) */
const BUDGET_AUTONOMOUS = {
  base: 500,
  knowledge: 500,
  skills: 1000,
  inputData: 1000,
  total: 3000,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────

export interface InteractiveContextParams {
  userId: string;
  companyId: string;
  userMessage: string;
  screenContext?: {
    url: string;
    entityType?: string;
    entityId?: string;
    selectedIds?: string[];
  };
  basePrompt: string;
}

export interface AutonomousContextParams {
  moduleKey: string;
  companyId?: string;
  skillName?: string;
  inputData: Record<string, unknown>;
  basePrompt: string;
}

export interface AssembledContext {
  systemPrompt: string;
  tools: ToolDefinition[];
  skillChain: {
    l0Module: string | null;
    l1Skill: string | null;
    l2Activated: boolean;
  };
  tokenBreakdown: {
    base: number;
    memories: number;
    skills: number;
    knowledge: number;
    permissions: number;
    screen: number;
    total: number;
  };
}

// ─── DynamicContextService ───────────────────────────────────────────────

export class DynamicContextService {
  private knowledgeRagService: KnowledgeRagService | null = null;
  private trainingExampleInjection: TrainingExampleInjectionService | null = null;

  constructor(
    private skillRouter: SkillRouter,
    private memoryInjection: MemoryInjectionService,
    private toolRegistry: ToolRegistry,
    private db: PrismaClient,
    private logger: Logger,
  ) {}

  /** Setter for optional KnowledgeRagService (E5d tenant knowledge RAG) */
  setKnowledgeRagService(svc: KnowledgeRagService): void {
    this.knowledgeRagService = svc;
  }

  /** Setter for optional TrainingExampleInjectionService (E5d-2 few-shot injection) */
  setTrainingExampleInjection(svc: TrainingExampleInjectionService): void {
    this.trainingExampleInjection = svc;
  }

  // ─── INTERACTIVE Mode (Chat Sessions) ───────────────────────────────

  /**
   * Assemble full context for INTERACTIVE mode (user chat sessions).
   *
   * Assembly order:
   *   1. Base system prompt (~500 tokens)
   *   2. User memories via MemoryInjectionService (≤2000 tokens)
   *   2.5. Tenant knowledge via RAG (E5d) — shares knowledge budget
   *   3. Skill routing chain L0→L1→L2 (≤1000 tokens)
   *   3.5. Training examples via few-shot injection (E5d-2) — shares remaining knowledge budget
   *        (runs after skill routing so skillKey/category are available for AC#5 priority)
   *   4. Module knowledge for active module (≤500 tokens)
   *   5. User permissions summary (~200 tokens)
   *   6. Current screen context (~300 tokens)
   *   7. Concatenate with XML-style section tags
   *   8. Validate total ≤~5000 tokens; truncate lowest-priority sections if over
   *
   * Never throws — returns base prompt on any error (graceful degradation).
   */
  async assembleInteractive(params: InteractiveContextParams): Promise<AssembledContext> {
    const { userId, companyId, userMessage, screenContext, basePrompt } = params;

    const breakdown = {
      base: 0,
      memories: 0,
      skills: 0,
      knowledge: 0,
      permissions: 0,
      screen: 0,
      total: 0,
    };
    const skillChain = {
      l0Module: null as string | null,
      l1Skill: null as string | null,
      l2Activated: false,
    };
    let tools: ToolDefinition[] = [];

    const sections: string[] = [];

    try {
      // 1. Base system prompt
      sections.push(basePrompt);
      breakdown.base = estimateTokens(basePrompt);

      // 2. Inject user memories via MemoryInjectionService
      let memoriesBlock = '';
      try {
        memoriesBlock = await this.memoryInjection.assembleUserContext(userId, companyId, [
          userMessage,
        ]);
      } catch {
        this.logger.warn(
          { userId, companyId },
          'DynamicContext: memory injection failed, continuing without',
        );
      }
      if (memoriesBlock) {
        const memTokens = estimateTokens(memoriesBlock);
        if (memTokens <= BUDGET_INTERACTIVE.memories) {
          sections.push(memoriesBlock);
          breakdown.memories = memTokens;
        } else {
          const truncated = truncateToTokenBudget(memoriesBlock, BUDGET_INTERACTIVE.memories);
          sections.push(truncated);
          breakdown.memories = BUDGET_INTERACTIVE.memories;
        }
      }

      // 2.5 Tenant knowledge via RAG (E5d)
      if (this.knowledgeRagService) {
        try {
          const ragResult = await this.knowledgeRagService.retrieveRelevantKnowledge(
            userMessage,
            companyId,
            { tokenBudget: BUDGET_INTERACTIVE.knowledge },
          );
          if (ragResult.chunks.length > 0) {
            sections.push(ragResult.formattedContext);
            breakdown.knowledge = ragResult.totalTokens;
          }
        } catch {
          this.logger.warn(
            { userId, companyId },
            'DynamicContext: knowledge RAG failed, continuing without',
          );
        }
      }

      // 3. Skill routing chain L0→L1→L2 (runs before training example injection so
      //    skillKey/category are available for AC#5 priority ordering)
      let skillSection = '';
      try {
        // L0: classify module
        const classification = await this.skillRouter.classifyModule(userMessage);
        skillChain.l0Module = classification.moduleKey;

        if (classification.moduleKey) {
          // Get module summary for context
          const moduleSummary = await this.skillRouter.getModuleSummary();
          skillSection += moduleSummary + '\n';

          // L1: load module pack and select skill
          const pack = await this.skillRouter.loadModulePack(
            classification.moduleKey,
            companyId,
            userId,
          );
          const selected = await this.skillRouter.selectSkill(userMessage, pack);

          if (selected) {
            skillChain.l1Skill = selected.name;

            // L2: activate skill with full context
            const activated = await this.skillRouter.activateSkill(selected, userId, companyId);
            if (activated) {
              skillChain.l2Activated = true;
              tools = activated.tools;

              // Build active skill section
              skillSection += `<active_skill>\n`;
              skillSection += `Name: ${activated.name}\n`;
              skillSection += `Module: ${activated.moduleKey}\n`;
              skillSection += activated.skillContent + '\n';

              if (activated.parameters) {
                skillSection += `Parameters: ${JSON.stringify(activated.parameters)}\n`;
              }

              if (activated.examples && activated.examples.length > 0) {
                skillSection += `Examples:\n`;
                for (const ex of activated.examples) {
                  skillSection += `  User: ${ex.input}\n  Assistant: ${ex.output}\n`;
                }
              }

              skillSection += `</active_skill>\n`;

              // Append context knowledge from L2 activation
              if (activated.contextKnowledge) {
                skillSection += `<module_knowledge>\n${activated.contextKnowledge}\n</module_knowledge>\n`;
              }
            }
          }
        }
      } catch (error) {
        this.logger.warn(
          { error: (error as Error).message, userId },
          'DynamicContext: skill routing failed, continuing without skills',
        );
      }

      if (skillSection) {
        // Remaining knowledge budget after tenant knowledge (step 2.5)
        const remainingKnowledgeBudget = Math.max(
          0,
          BUDGET_INTERACTIVE.knowledge - breakdown.knowledge,
        );
        const skillBudget = BUDGET_INTERACTIVE.skills + remainingKnowledgeBudget;
        const skillTokens = estimateTokens(skillSection);

        if (skillTokens <= skillBudget) {
          sections.push(skillSection);
          breakdown.skills = Math.min(skillTokens, BUDGET_INTERACTIVE.skills);
          // Module knowledge (E5b) tokens — overflow beyond skills budget, added to knowledge
          breakdown.knowledge += Math.max(0, skillTokens - BUDGET_INTERACTIVE.skills);
        } else {
          const truncated = truncateToTokenBudget(skillSection, skillBudget);
          sections.push(truncated);
          breakdown.skills = BUDGET_INTERACTIVE.skills;
          breakdown.knowledge += remainingKnowledgeBudget;
        }
      }

      // 3.5 Training examples via few-shot injection (E5d-2)
      // Runs AFTER skill routing so skillKey/category are available for AC#5 priority ordering
      if (this.trainingExampleInjection) {
        const remainingKnowledgeBudget = Math.max(
          0,
          BUDGET_INTERACTIVE.knowledge - breakdown.knowledge,
        );
        if (remainingKnowledgeBudget > 0) {
          try {
            // ISSUE #1 FIX: Pass undefined for category — l0Module is a module key
            // (e.g. "finance") which never matches knowledge categories (e.g.
            // "BUSINESS_PROCESS"). Tier 2 category matching is skipped; tier 1
            // (skillKey) and tier 3 (fallback) still provide relevant examples.
            const injectionResult = await this.trainingExampleInjection.retrieveRelevantExamples(
              companyId,
              skillChain.l1Skill ?? undefined,
              undefined,
              remainingKnowledgeBudget,
            );
            if (injectionResult.examples.length > 0) {
              sections.push(injectionResult.formattedContext);
              breakdown.knowledge += injectionResult.totalTokens;
            }
          } catch {
            this.logger.warn(
              { userId, companyId },
              'DynamicContext: training example injection failed, continuing without',
            );
          }
        }
      }

      // 4. Module knowledge (E5b — loaded as part of L2 above via contextKnowledge)
      //    If L2 didn't activate but L0 identified a module, load OVERVIEW knowledge.
      //    Coexists with tenant knowledge (E5d step 2.5) — both share the knowledge budget.
      if (skillChain.l0Module && !skillChain.l2Activated) {
        const remainingKnowledgeBudget = BUDGET_INTERACTIVE.knowledge - breakdown.knowledge;
        if (remainingKnowledgeBudget > 0) {
          try {
            const overview = await this.db.aiModuleKnowledge.findFirst({
              where: {
                moduleKey: skillChain.l0Module,
                knowledgeType: 'OVERVIEW',
                isActive: true,
              },
              select: { content: true },
            });

            if (overview?.content) {
              const knowledgeBlock = `<module_knowledge>\n${overview.content}\n</module_knowledge>`;
              const knowledgeTokens = estimateTokens(knowledgeBlock);
              if (knowledgeTokens <= remainingKnowledgeBudget) {
                sections.push(knowledgeBlock);
                breakdown.knowledge += knowledgeTokens;
              }
            }
          } catch {
            // Swallowed — non-critical
          }
        }
      }

      // 5. User permissions summary
      let permissionsBlock = '';
      try {
        permissionsBlock = await this.buildPermissionsSummary(userId, companyId);
      } catch {
        // Swallowed — non-critical
      }
      if (permissionsBlock) {
        const permTokens = estimateTokens(permissionsBlock);
        if (permTokens <= BUDGET_INTERACTIVE.permissions) {
          sections.push(permissionsBlock);
          breakdown.permissions = permTokens;
        }
      }

      // 6. Screen context
      if (screenContext) {
        const screenBlock = this.buildScreenContext(screenContext);
        const screenTokens = estimateTokens(screenBlock);
        if (screenTokens <= BUDGET_INTERACTIVE.screen) {
          sections.push(screenBlock);
          breakdown.screen = screenTokens;
        }
      }

      // 7. Assemble final prompt
      const systemPrompt = sections.join('\n\n');
      breakdown.total =
        breakdown.base +
        breakdown.memories +
        breakdown.skills +
        breakdown.knowledge +
        breakdown.permissions +
        breakdown.screen;

      // 8. Validate total budget — truncate lowest-priority sections if over
      if (breakdown.total > BUDGET_INTERACTIVE.total) {
        this.logger.warn(
          { breakdown, budget: BUDGET_INTERACTIVE.total },
          'DynamicContext: total tokens exceed budget, assembled as-is (soft limit)',
        );
      }

      this.logger.debug(
        { skillChain, breakdown, toolCount: tools.length },
        'DynamicContext: interactive context assembled',
      );

      return { systemPrompt, tools, skillChain, tokenBreakdown: breakdown };
    } catch (error) {
      // Graceful degradation — return base prompt on any unexpected error
      this.logger.error(
        { error: (error as Error).message, userId, companyId },
        'DynamicContext: assembly failed, returning base prompt only',
      );

      breakdown.base = estimateTokens(basePrompt);
      breakdown.total = breakdown.base;

      return {
        systemPrompt: basePrompt,
        tools: [],
        skillChain,
        tokenBreakdown: breakdown,
      };
    }
  }

  // ─── AUTONOMOUS Mode (Automations) ──────────────────────────────────

  /**
   * Assemble context for AUTONOMOUS mode (E5c automations).
   *
   * Assembly order:
   *   1. Base system prompt (~500 tokens)
   *   1.5. Tenant knowledge via RAG (≤500 tokens, if companyId provided)
   *   2. Module knowledge for the specified module (≤remaining knowledge budget)
   *   3. Skill instructions for the specified skill (≤1000 tokens)
   *   4. Automation-specific input data (≤1000 tokens)
   *   5. NO user memories, NO screen context
   *   6. Validate total ≤~3000 tokens
   *
   * Never throws — returns base prompt on any error (graceful degradation).
   */
  async assembleAutonomous(params: AutonomousContextParams): Promise<AssembledContext> {
    const { moduleKey, companyId, skillName, inputData, basePrompt } = params;

    const breakdown = {
      base: 0,
      memories: 0,
      skills: 0,
      knowledge: 0,
      permissions: 0,
      screen: 0,
      total: 0,
    };
    const skillChain = {
      l0Module: moduleKey,
      l1Skill: skillName ?? null,
      l2Activated: false,
    };
    let tools: ToolDefinition[] = [];

    const sections: string[] = [];

    try {
      // 1. Base system prompt
      sections.push(basePrompt);
      breakdown.base = estimateTokens(basePrompt);

      // 1.5 Tenant knowledge via RAG (E5d) — optional, requires companyId
      if (this.knowledgeRagService && companyId) {
        try {
          // Build a meaningful semantic query from inputData context rather than
          // just using the skill/module identifier (which yields poor vector matches).
          const inputSummary = Object.values(inputData)
            .filter((v) => typeof v === 'string' && v.length > 0)
            .slice(0, 5)
            .join(' ');
          const ragQuery = inputSummary
            ? `${moduleKey} ${skillName ?? ''} ${inputSummary}`.trim()
            : `${moduleKey} ${skillName ?? ''}`.trim();
          const ragResult = await this.knowledgeRagService.retrieveRelevantKnowledge(
            ragQuery,
            companyId,
            { tokenBudget: BUDGET_AUTONOMOUS.knowledge },
          );
          if (ragResult.chunks.length > 0) {
            sections.push(ragResult.formattedContext);
            breakdown.knowledge = ragResult.totalTokens;
          }
        } catch {
          this.logger.warn(
            { moduleKey, companyId },
            'DynamicContext: autonomous knowledge RAG failed, continuing without',
          );
        }
      }

      // 2. Module knowledge (E5b) — shares knowledge budget with tenant knowledge (step 1.5)
      try {
        const remainingKnowledgeBudget = BUDGET_AUTONOMOUS.knowledge - breakdown.knowledge;
        if (remainingKnowledgeBudget > 0) {
          const knowledgeEntries = await this.db.aiModuleKnowledge.findMany({
            where: {
              moduleKey,
              isActive: true,
              knowledgeType: { in: ['OVERVIEW', 'ENTITIES', 'WORKFLOWS', 'BUSINESS_RULES'] },
            },
            orderBy: [{ priority: 'desc' }],
            select: { title: true, content: true, knowledgeType: true },
          });

          if (knowledgeEntries.length > 0) {
            const parts: string[] = ['<module_knowledge>'];
            let knowledgeTokens = 0;

            for (const entry of knowledgeEntries) {
              const entryText = `[${entry.knowledgeType}] ${entry.title}: ${entry.content}`;
              const entryTokens = estimateTokens(entryText);

              if (knowledgeTokens + entryTokens > remainingKnowledgeBudget) break;

              parts.push(entryText);
              knowledgeTokens += entryTokens;
            }

            parts.push('</module_knowledge>');
            const knowledgeBlock = parts.join('\n');
            sections.push(knowledgeBlock);
            breakdown.knowledge += knowledgeTokens;
          }
        }
      } catch {
        // Swallowed — non-critical
      }

      // 3. Skill instructions (if skillName provided)
      if (skillName) {
        try {
          const skill = await this.db.aiSkill.findFirst({
            where: { name: skillName, moduleKey, isActive: true },
            select: {
              id: true,
              name: true,
              skillContent: true,
              parameters: true,
              examples: true,
              requiredTools: true,
              moduleKey: true,
            },
          });

          if (skill) {
            skillChain.l2Activated = true;

            let skillBlock = `<active_skill>\nName: ${skill.name}\n`;
            skillBlock += skill.skillContent + '\n';

            if (skill.parameters) {
              skillBlock += `Parameters: ${JSON.stringify(skill.parameters)}\n`;
            }

            skillBlock += '</active_skill>';

            const skillTokens = estimateTokens(skillBlock);
            if (skillTokens <= BUDGET_AUTONOMOUS.skills) {
              sections.push(skillBlock);
              breakdown.skills = skillTokens;
            } else {
              const truncated = truncateToTokenBudget(skillBlock, BUDGET_AUTONOMOUS.skills);
              sections.push(truncated);
              breakdown.skills = BUDGET_AUTONOMOUS.skills;
            }

            // Resolve required tools
            if (skill.requiredTools.length > 0) {
              tools = this.toolRegistry.resolveTools(skill.requiredTools);
            }
          }
        } catch {
          // Swallowed — non-critical
        }
      }

      // 4. Automation-specific input data
      let inputDataTokens = 0;
      if (inputData && Object.keys(inputData).length > 0) {
        const inputBlock = `<automation_input>\n${JSON.stringify(inputData, null, 2)}\n</automation_input>`;
        inputDataTokens = estimateTokens(inputBlock);
        if (inputDataTokens <= BUDGET_AUTONOMOUS.inputData) {
          sections.push(inputBlock);
        } else {
          const truncated = truncateToTokenBudget(inputBlock, BUDGET_AUTONOMOUS.inputData);
          sections.push(truncated);
          inputDataTokens = BUDGET_AUTONOMOUS.inputData;
        }
      }

      // 5. Assemble final prompt
      const systemPrompt = sections.join('\n\n');
      breakdown.total = breakdown.base + breakdown.knowledge + breakdown.skills + inputDataTokens;

      // 6. Validate total budget
      if (breakdown.total > BUDGET_AUTONOMOUS.total) {
        this.logger.warn(
          { breakdown, budget: BUDGET_AUTONOMOUS.total },
          'DynamicContext: autonomous context exceeds budget (soft limit)',
        );
      }

      this.logger.debug(
        { moduleKey, skillName, breakdown, toolCount: tools.length },
        'DynamicContext: autonomous context assembled',
      );

      return { systemPrompt, tools, skillChain, tokenBreakdown: breakdown };
    } catch (error) {
      this.logger.error(
        { error: (error as Error).message, moduleKey, skillName },
        'DynamicContext: autonomous assembly failed, returning base prompt only',
      );

      breakdown.base = estimateTokens(basePrompt);
      breakdown.total = breakdown.base;

      return {
        systemPrompt: basePrompt,
        tools: [],
        skillChain,
        tokenBreakdown: breakdown,
      };
    }
  }

  // ─── Private Helpers ────────────────────────────────────────────────

  /**
   * Build a compact permissions summary for injection into the system prompt.
   * Format: <user_permissions>\nRole: ADMIN\nModules: finance, ar, ap\n</user_permissions>
   */
  private async buildPermissionsSummary(userId: string, companyId: string): Promise<string> {
    // Load the user's company role
    const userRole = await this.db.userCompanyRole.findFirst({
      where: { userId, companyId },
      select: { role: true },
    });

    if (!userRole) return '';

    // Load user's accessible resource codes from access group permissions
    const userAccessGroups = await this.db.userAccessGroup.findMany({
      where: { userId, companyId },
      select: {
        accessGroup: {
          select: {
            permissions: {
              where: { canAccess: true },
              select: { resourceCode: true },
            },
          },
        },
      },
    });

    const resources = new Set<string>();
    for (const uag of userAccessGroups) {
      for (const perm of uag.accessGroup.permissions) {
        resources.add(perm.resourceCode);
      }
    }

    const resourceList = Array.from(resources).sort().join(', ') || 'none';

    return `<user_permissions>\nRole: ${userRole.role}\nModules: ${resourceList}\n</user_permissions>`;
  }

  /**
   * Build screen context section for the system prompt.
   * Format: <screen_context>\nPage: /ar/invoices\nEntity: Invoice INV-001\n</screen_context>
   */
  private buildScreenContext(
    screen: NonNullable<InteractiveContextParams['screenContext']>,
  ): string {
    const parts: string[] = ['<screen_context>'];

    parts.push(`Page: ${screen.url}`);

    if (screen.entityType) {
      parts.push(`Entity Type: ${screen.entityType}`);
    }

    if (screen.entityId) {
      parts.push(`Entity ID: ${screen.entityId}`);
    }

    if (screen.selectedIds && screen.selectedIds.length > 0) {
      parts.push(`Selected: ${screen.selectedIds.join(', ')}`);
    }

    parts.push('</screen_context>');

    return parts.join('\n');
  }
}

// ─── Token Estimation Utility ─────────────────────────────────────────────

/**
 * Estimate the number of tokens in a text string.
 * Uses a simple heuristic: ~4 characters per token.
 * Matches the orchestrator's existing CHARS_PER_TOKEN constant.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// ─── Truncation Utility ───────────────────────────────────────────────────

/**
 * Truncate text to fit within a token budget, appending "..." if truncated.
 */
function truncateToTokenBudget(text: string, tokenBudget: number): string {
  const maxChars = tokenBudget * CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3) + '...';
}
