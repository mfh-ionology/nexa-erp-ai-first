import type { PrismaClient, AiPromptVariable } from '@nexa/db';
import type { Logger } from 'pino';
import {
  createVariableResolver,
  type VariableResolver,
  type VariableResolutionContext,
} from './automation/variable-resolver.js';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Context provided by callers (orchestrator, automation executor) for prompt rendering */
export interface PromptRenderContext {
  companyId: string;
  userId: string;
  userName?: string;
  userRole?: string;
  companyName?: string;
  baseCurrency?: string;
  defaultCurrency?: string;
  /** For DB_FIELD resolution — which record to look up */
  entityId?: string;
  /** For DB_FIELD resolution — which table */
  entityType?: string;
  /** For PAGE_FIELD resolution — frontend page state from chat session */
  pageContext?: Record<string, unknown>;
  /** For PREVIOUS_STEP resolution — outputs from previous automation steps */
  previousStepOutputs?: Record<string, unknown>;
  /** If true, required vars that fail resolution throw UnresolvableRequiredParamError */
  autonomous?: boolean;
}

/** Result of rendering a prompt with all variables resolved */
export interface RenderedPrompt {
  systemPrompt: string;
  userTemplate: string;
  /** Map of variable names to their resolved string values */
  resolvedVariables: Record<string, string>;
  /** Count of variables that could not be resolved (fell back to defaults or placeholders) */
  unresolvedCount: number;
  /** Time taken to render the prompt in milliseconds */
  renderTimeMs: number;
}

// ─── Service ────────────────────────────────────────────────────────────────

export class PromptRenderer {
  private variableResolver: VariableResolver;

  constructor(
    private db: PrismaClient,
    private logger: Logger,
  ) {
    this.variableResolver = createVariableResolver(db, logger);
  }

  /**
   * Renders a prompt's active version with all variables resolved.
   * Loads the prompt's active AiPromptVersion, resolves all bound AiPromptVariable records,
   * and replaces `{{varName}}` placeholders in both systemPrompt and userTemplate.
   */
  async render(promptId: string, context: PromptRenderContext): Promise<RenderedPrompt> {
    const startTime = Date.now();

    // 1. Load the prompt with its variables (not all versions)
    const prompt = await this.db.aiPrompt.findUnique({
      where: { id: promptId },
      include: { variables: true },
    });

    if (!prompt) {
      throw new Error(`Prompt not found: ${promptId}`);
    }

    // 2. Load only the active version (instead of all versions)
    const activeVersion = await this.db.aiPromptVersion.findFirst({
      where: { promptId, version: prompt.activeVersion },
    });

    if (!activeVersion) {
      this.logger.warn(
        { promptId, activeVersion: prompt.activeVersion },
        'Active prompt version not found, falling back to prompt base templates',
      );
    }

    const systemTemplate = activeVersion?.systemPrompt ?? prompt.systemPrompt;
    const userTemplateStr = activeVersion?.userTemplate ?? prompt.userTemplate;

    // 3. Build the VariableResolutionContext from the PromptRenderContext
    const resolutionContext: VariableResolutionContext = {
      companyId: context.companyId,
      userId: context.userId,
      userName: context.userName,
      userRole: context.userRole,
      companyName: context.companyName,
      baseCurrency: context.baseCurrency,
      defaultCurrency: context.defaultCurrency,
      entityId: context.entityId,
      entityType: context.entityType,
      previousStepOutputs: context.previousStepOutputs,
      pageContext: context.pageContext,
      autonomous: context.autonomous ?? false,
    };

    // 4. Resolve all variables once and track which resolved vs. fell back
    const variables = prompt.variables;
    const resolvedMap = await this.variableResolver.resolveToMap(variables, resolutionContext);

    // Build a string map for tracking and count unresolved
    const resolvedVariables: Record<string, string> = {};
    let unresolvedCount = 0;

    for (const variable of variables) {
      const value = resolvedMap[variable.variableName];
      if (value === undefined || value === null) {
        unresolvedCount++;
      } else {
        resolvedVariables[variable.variableName] = String(value);
      }
    }

    // 5. Render templates by replacing placeholders with already-resolved values
    //    (avoids re-resolving variables for each template)
    const systemPrompt = this.replaceTemplateVars(systemTemplate, resolvedMap);
    const userTemplate = this.replaceTemplateVars(userTemplateStr, resolvedMap);

    const renderTimeMs = Date.now() - startTime;

    this.logger.info(
      {
        promptId,
        variableCount: variables.length,
        resolvedCount: variables.length - unresolvedCount,
        unresolvedCount,
        renderTimeMs,
      },
      'Prompt rendered',
    );

    return {
      systemPrompt,
      userTemplate,
      resolvedVariables,
      unresolvedCount,
      renderTimeMs,
    };
  }

  /** Replace `{{varName}}` placeholders in a template with values from a pre-resolved map */
  private replaceTemplateVars(template: string, resolvedMap: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, varName: string) => {
      const value = resolvedMap[varName];
      if (value === undefined || value === null) {
        return `[unknown: ${varName}]`;
      }
      if (Array.isArray(value) || typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    });
  }

  /**
   * Renders a template string (not from DB) with variables resolved.
   * Used for ad-hoc rendering (e.g., automation step goals).
   */
  async renderTemplate(
    template: string,
    variables: AiPromptVariable[],
    context: VariableResolutionContext,
  ): Promise<string> {
    return this.variableResolver.resolve(template, variables, context);
  }
}
