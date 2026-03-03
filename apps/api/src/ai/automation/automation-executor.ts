// ---------------------------------------------------------------------------
// AutomationExecutor — Main execution engine for AI automations.
// Orchestrates sequential step execution with I/O piping, budget enforcement,
// immutable run/step-run records, event emission, and chain triggering.
// E5c-1 Task 4: AC #4, #5, #8, #9, #11, #17, #18
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import type { PrismaClient, Prisma, AiPromptVariable } from '@nexa/db';
import type { Logger } from 'pino';
import type { AiGateway } from '@nexa/ai-gateway';
import type { ToolRegistry } from '@nexa/ai-tools';
import type { EventBus } from '../../core/events/event-bus.js';
import type { DynamicContextService } from '../dynamic-context.service.js';
import type { QueryExecutor } from '../query-executor.js';
import type { ActionExecutor } from '../action-executor.js';
import {
  VariableResolver,
  createVariableResolver,
  UnresolvableRequiredParamError,
} from './variable-resolver.js';
import type { VariableResolutionContext } from './variable-resolver.js';
import { AutonomousAgentExecutor } from './autonomous-agent-executor.js';
import type { AgentStepConfig, AgentExecutionContext } from './autonomous-agent-executor.js';
import type { PromptRenderer } from '../prompt-renderer.js';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Run status enum */
type RunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

/** Input to the executor */
export interface AutomationExecuteInput {
  automationId: string;
  /** Optional input data (e.g. event payload, chain output) */
  input?: Record<string, unknown>;
  /** What triggered this execution */
  triggeredBy: string;
  /** Pre-generated run ID (allows caller to track the run immediately) */
  runId?: string;
  /** FK link to original run if this is a retry */
  retryOfRunId?: string;
  /** Step order to start from (for retry-from-failed-step). Steps before this are skipped. */
  startFromStepOrder?: number;
  /** Pre-resolved outputs from prior steps (used when retrying from a mid-point) */
  priorStepOutputs?: Record<string, unknown>;
}

/** Full result of an automation execution */
export interface AutomationExecuteResult {
  runId: string;
  status: RunStatus;
  result?: Record<string, unknown> | null;
  error?: string;
  totalTokens: number;
  totalCost: number;
  durationMs: number;
}

// ─── AutomationExecutor ─────────────────────────────────────────────────────

export class AutomationExecutor {
  private variableResolver: VariableResolver;
  private agentExecutor: AutonomousAgentExecutor;
  private promptRenderer: PromptRenderer | null = null;

  constructor(
    private db: PrismaClient,
    aiGateway: AiGateway,
    dynamicContext: DynamicContextService | null,
    queryExecutor: QueryExecutor,
    actionExecutor: ActionExecutor,
    toolRegistry: ToolRegistry | null,
    private eventBus: EventBus,
    private logger: Logger,
  ) {
    this.variableResolver = createVariableResolver(db, logger);
    this.agentExecutor = new AutonomousAgentExecutor(
      aiGateway,
      dynamicContext,
      queryExecutor,
      actionExecutor,
      toolRegistry,
      logger,
    );
  }

  /** Set the PromptRenderer for resolving variables in step goals and prompts (E5c-2 Task 8) */
  setPromptRenderer(renderer: PromptRenderer): void {
    this.promptRenderer = renderer;
  }

  /**
   * Execute an automation end-to-end.
   * 1. Load automation + steps
   * 2. Create immutable run record
   * 3. Execute steps sequentially with I/O piping
   * 4. Enforce token/duration budgets
   * 5. Emit lifecycle events
   * 6. Trigger chain if configured
   */
  async execute(input: AutomationExecuteInput): Promise<AutomationExecuteResult> {
    const { automationId, triggeredBy } = input;
    const runId = input.runId ?? randomUUID();

    // 1. Load automation definition with steps (ordered by stepOrder)
    const automation = await this.db.aiAutomation.findUnique({
      where: { id: automationId },
      include: {
        steps: {
          orderBy: { stepOrder: 'asc' },
          include: {
            agent: {
              include: {
                prompt: {
                  include: { variables: true },
                },
              },
            },
          },
        },
        schedule: true,
      },
    });

    if (!automation) {
      this.logger.error({ automationId }, 'Automation not found');
      return {
        runId,
        status: 'FAILED',
        error: `Automation ${automationId} not found`,
        totalTokens: 0,
        totalCost: 0,
        durationMs: 0,
      };
    }

    if (!automation.isActive) {
      this.logger.warn({ automationId }, 'Automation is inactive');
      return {
        runId,
        status: 'FAILED',
        error: `Automation ${automationId} is inactive`,
        totalTokens: 0,
        totalCost: 0,
        durationMs: 0,
      };
    }

    // 1b + 2. Atomic concurrency guard + run creation (single transaction
    // eliminates TOCTOU race and avoids a separate PENDING→RUNNING mutation).
    const startedAt = new Date();
    const concurrencyResult = await this.db.$transaction(async (tx) => {
      const activeRun = await tx.aiAutomationRun.findFirst({
        where: {
          automationId,
          status: { in: ['PENDING', 'RUNNING'] },
        },
        select: { id: true },
      });

      if (activeRun) {
        return { blocked: true as const, activeRunId: activeRun.id };
      }

      // Create run directly as RUNNING (immutable — no PENDING→RUNNING update needed)
      await tx.aiAutomationRun.create({
        data: {
          id: runId,
          automationId,
          triggeredBy,
          status: 'RUNNING',
          startedAt,
          ...(input.retryOfRunId ? { retryOfRunId: input.retryOfRunId } : {}),
        },
      });

      return { blocked: false as const };
    });

    if (concurrencyResult.blocked) {
      this.logger.warn(
        { automationId, activeRunId: concurrencyResult.activeRunId },
        'Automation already has an active run — skipping concurrent execution',
      );
      return {
        runId,
        status: 'CANCELLED',
        error: `Automation already running (active run: ${concurrencyResult.activeRunId})`,
        totalTokens: 0,
        totalCost: 0,
        durationMs: 0,
      };
    }

    // Emit triggered event
    this.eventBus.emit('ai.automation.triggered', {
      automationId,
      companyId: automation.companyId,
      triggerType: automation.triggerType,
      triggeredBy,
      runId,
    });

    // 3. Execute steps sequentially
    // Seed prior step outputs when retrying from a mid-point
    const previousStepOutputs: Record<string, unknown> = input.priorStepOutputs
      ? { ...input.priorStepOutputs }
      : {};
    let cumulativeTokens = 0;
    let cumulativeCost = 0;
    let lastStepOutput: Record<string, unknown> | null = null;
    const startFromStep = input.startFromStepOrder ?? 1;

    const executionContext: AgentExecutionContext = {
      companyId: automation.companyId,
      tenantId: automation.companyId, // tenantId matches companyId in single-tenant-per-company model
      userId: automation.createdById,
      userRole: 'SYSTEM', // autonomous runs execute as system
    };

    for (const step of automation.steps) {
      // ── Skip steps before startFromStepOrder (retry-from-failed-step) ──
      if (step.stepOrder < startFromStep) {
        continue;
      }

      // ── Token budget check (AC-17) ──
      const tokenBudgetResult = this.checkTokenBudget(cumulativeTokens, automation.maxTokenBudget);
      if (!tokenBudgetResult.allowed) {
        await this.terminateRun(
          runId,
          'CANCELLED',
          'TOKEN_BUDGET_EXCEEDED',
          cumulativeTokens,
          cumulativeCost,
          lastStepOutput,
        );

        this.emitFailedEvent(automation, runId, 'TOKEN_BUDGET_EXCEEDED', step.stepOrder);

        return {
          runId,
          status: 'CANCELLED',
          error: 'TOKEN_BUDGET_EXCEEDED',
          totalTokens: cumulativeTokens,
          totalCost: cumulativeCost,
          durationMs: Date.now() - startedAt.getTime(),
        };
      }

      // ── Duration budget check (AC-18) ──
      const durationBudgetResult = this.checkDurationBudget(startedAt, automation.maxDurationMs);
      if (!durationBudgetResult.allowed) {
        await this.terminateRun(
          runId,
          'CANCELLED',
          'DURATION_BUDGET_EXCEEDED',
          cumulativeTokens,
          cumulativeCost,
          lastStepOutput,
        );

        this.emitFailedEvent(automation, runId, 'DURATION_BUDGET_EXCEEDED', step.stepOrder);

        return {
          runId,
          status: 'CANCELLED',
          error: 'DURATION_BUDGET_EXCEEDED',
          totalTokens: cumulativeTokens,
          totalCost: cumulativeCost,
          durationMs: Date.now() - startedAt.getTime(),
        };
      }

      // ── Create step run record (AC-9) ──
      const stepRunId = randomUUID();
      const stepStartedAt = new Date();

      await this.db.aiAutomationStepRun.create({
        data: {
          id: stepRunId,
          runId,
          stepId: step.id,
          status: 'RUNNING',
          agentId: step.agentId,
          startedAt: stepStartedAt,
        },
      });

      try {
        // ── Resolve input variables (AC-4, AC-10) ──
        const resolvedInput = await this.resolveStepInput(
          step,
          automation.companyId,
          automation.createdById,
          previousStepOutputs,
          input.input,
        );

        // ── Render step goal and system prompt through PromptRenderer (E5c-2 Task 8) ──
        let renderedGoal = step.goal;
        let renderedSystemPrompt = step.agent.prompt.systemPrompt;

        if (this.promptRenderer && step.agent.prompt.variables.length > 0) {
          const renderContext: VariableResolutionContext = {
            companyId: automation.companyId,
            userId: automation.createdById,
            previousStepOutputs,
            autonomous: true, // automation steps are always autonomous
          };

          try {
            renderedGoal = await this.promptRenderer.renderTemplate(
              step.goal,
              step.agent.prompt.variables,
              renderContext,
            );
            renderedSystemPrompt = await this.promptRenderer.renderTemplate(
              step.agent.prompt.systemPrompt,
              step.agent.prompt.variables,
              renderContext,
            );
          } catch (renderErr) {
            // If the error is UnresolvableRequiredParamError, re-throw (AC-15)
            if (renderErr instanceof UnresolvableRequiredParamError) {
              throw renderErr;
            }
            this.logger.warn(
              { stepId: step.id, error: (renderErr as Error).message },
              'PromptRenderer failed for step goal/systemPrompt, using raw templates',
            );
          }
        }

        // ── Execute agent autonomously (AC-5, AC-11) ──
        const agentConfig: AgentStepConfig = {
          agentId: step.agentId,
          agentName: step.agent.displayName,
          goal: renderedGoal,
          inputData: resolvedInput,
          routingTags: step.agent.routingTags,
          systemPrompt: renderedSystemPrompt,
          moduleKey: this.extractModuleKey(step.agent, step.inputConfig),
          skillName: step.agent.name,
          maxTurns: step.maxTurns,
          guardrails: step.agent.guardrails as unknown as
            | import('../ai.types.js').AgentGuardrails
            | undefined,
          deadlineMs: startedAt.getTime() + automation.maxDurationMs,
        };

        const agentResult = await this.agentExecutor.execute(agentConfig, executionContext);

        // ── Update step run record (AC-9, immutable) ──
        await this.db.aiAutomationStepRun.update({
          where: { id: stepRunId },
          data: {
            status: agentResult.success ? 'COMPLETED' : 'FAILED',
            modelId: agentResult.modelId,
            input: resolvedInput as Prisma.InputJsonValue,
            output: (agentResult.output ?? undefined) as Prisma.InputJsonValue | undefined,
            error: agentResult.error,
            inputTokens: agentResult.inputTokens,
            outputTokens: agentResult.outputTokens,
            latencyMs: agentResult.latencyMs,
            turns: agentResult.turns,
            completedAt: new Date(),
          },
        });

        // Accumulate totals
        cumulativeTokens += agentResult.inputTokens + agentResult.outputTokens;
        cumulativeCost += await this.calculateStepCost(
          agentResult.modelId,
          agentResult.inputTokens,
          agentResult.outputTokens,
        );

        if (!agentResult.success) {
          // Mark remaining steps as SKIPPED
          await this.skipRemainingSteps(runId, automation.steps, step.stepOrder);

          await this.terminateRun(
            runId,
            'FAILED',
            agentResult.error ?? 'Step execution failed',
            cumulativeTokens,
            cumulativeCost,
            lastStepOutput,
          );

          this.emitFailedEvent(
            automation,
            runId,
            agentResult.error ?? 'Step execution failed',
            step.stepOrder,
          );

          return {
            runId,
            status: 'FAILED',
            error: agentResult.error,
            totalTokens: cumulativeTokens,
            totalCost: cumulativeCost,
            durationMs: Date.now() - startedAt.getTime(),
          };
        }

        // ── Feed output to next step (AC-4 I/O piping) ──
        if (agentResult.output) {
          previousStepOutputs[String(step.stepOrder)] = agentResult.output;
          lastStepOutput = agentResult.output;
        }
      } catch (error) {
        const err = error as Error;

        // Handle UnresolvableRequiredParamError (AC-15)
        const errorMessage =
          err instanceof UnresolvableRequiredParamError
            ? `UNRESOLVABLE_REQUIRED_PARAM: ${err.message}`
            : err.message;

        await this.db.aiAutomationStepRun.update({
          where: { id: stepRunId },
          data: {
            status: 'FAILED',
            error: errorMessage,
            completedAt: new Date(),
          },
        });

        // Mark remaining steps as SKIPPED
        await this.skipRemainingSteps(runId, automation.steps, step.stepOrder);

        await this.terminateRun(
          runId,
          'FAILED',
          errorMessage,
          cumulativeTokens,
          cumulativeCost,
          lastStepOutput,
        );

        this.emitFailedEvent(automation, runId, errorMessage, step.stepOrder);

        return {
          runId,
          status: 'FAILED',
          error: errorMessage,
          totalTokens: cumulativeTokens,
          totalCost: cumulativeCost,
          durationMs: Date.now() - startedAt.getTime(),
        };
      }
    }

    // 4. All steps completed successfully (AC-8)
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    await this.db.aiAutomationRun.update({
      where: { id: runId },
      data: {
        status: 'COMPLETED',
        completedAt,
        totalTokens: cumulativeTokens,
        totalCost: cumulativeCost,
        result: (lastStepOutput ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });

    // 5. Emit completed event (AC-20)
    this.eventBus.emit('ai.automation.completed', {
      automationId,
      companyId: automation.companyId,
      runId,
      totalTokens: cumulativeTokens,
      totalCost: cumulativeCost,
      durationMs,
    });

    this.logger.info(
      {
        automationId,
        runId,
        totalTokens: cumulativeTokens,
        durationMs,
        stepCount: automation.steps.length,
      },
      'Automation completed successfully',
    );

    // 6. Trigger chain if configured (AC-6)
    if (automation.chainNextId) {
      this.triggerChain(automation.chainNextId, lastStepOutput, automation.companyId, runId);
    }

    return {
      runId,
      status: 'COMPLETED',
      result: lastStepOutput,
      totalTokens: cumulativeTokens,
      totalCost: cumulativeCost,
      durationMs,
    };
  }

  // ─── Token Budget Enforcement (AC-17) ─────────────────────────────────────

  private checkTokenBudget(cumulativeTokens: number, maxTokenBudget: number): { allowed: boolean } {
    return { allowed: cumulativeTokens < maxTokenBudget };
  }

  // ─── Duration Budget Enforcement (AC-18) ──────────────────────────────────

  private checkDurationBudget(startedAt: Date, maxDurationMs: number): { allowed: boolean } {
    const elapsed = Date.now() - startedAt.getTime();
    return { allowed: elapsed < maxDurationMs };
  }

  // ─── Step Input Resolution ────────────────────────────────────────────────

  /**
   * Resolve input variables for a step using the VariableResolver.
   * Combines: automation input, previous step outputs, DB fields, system vars.
   */
  private async resolveStepInput(
    step: {
      inputConfig: unknown;
      agent: {
        prompt: {
          variables: AiPromptVariable[];
        };
      };
    },
    companyId: string,
    userId: string,
    previousStepOutputs: Record<string, unknown>,
    automationInput?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const variables = step.agent.prompt.variables;

    // If no variables configured, fall back to automation input or empty
    if (!variables || variables.length === 0) {
      return automationInput ?? {};
    }

    const context: VariableResolutionContext = {
      companyId,
      userId,
      previousStepOutputs,
      autonomous: true, // always autonomous mode for automation steps
    };

    const resolved = await this.variableResolver.resolveToMap(variables, context);

    // Merge with automation-level input (automation input takes lower precedence)
    if (automationInput) {
      for (const [key, value] of Object.entries(automationInput)) {
        if (!(key in resolved)) {
          resolved[key] = value;
        }
      }
    }

    return resolved;
  }

  // ─── Helper Methods ───────────────────────────────────────────────────────

  /**
   * Calculate cost for a step using the model's pricing from the AiModel registry.
   * Falls back to zero if the model is not found (avoids hardcoded rates).
   */
  private async calculateStepCost(
    modelId: string | undefined,
    inputTokens: number,
    outputTokens: number,
  ): Promise<number> {
    if (!modelId) return 0;

    try {
      const model = await this.db.aiModel.findFirst({
        where: { modelId },
        select: { costPerMInput: true, costPerMOutput: true },
      });

      if (!model) {
        this.logger.warn({ modelId }, 'Model not found in registry for cost calculation');
        return 0;
      }

      const inputCost = (inputTokens / 1_000_000) * Number(model.costPerMInput);
      const outputCost = (outputTokens / 1_000_000) * Number(model.costPerMOutput);
      return inputCost + outputCost;
    } catch (err) {
      this.logger.warn({ modelId, err }, 'Failed to look up model pricing');
      return 0;
    }
  }

  /** Extract module key from agent configuration, step inputConfig, or name pattern */
  private extractModuleKey(
    agent: { name: string; triggerConfig: unknown },
    stepInputConfig?: unknown,
  ): string | undefined {
    // 1. Explicit triggerConfig.moduleKey
    const triggerCfg = agent.triggerConfig as { moduleKey?: string } | null;
    if (triggerCfg?.moduleKey) return triggerCfg.moduleKey;

    // 2. Step inputConfig.moduleKey
    const inputCfg = stepInputConfig as { moduleKey?: string } | null;
    if (inputCfg?.moduleKey) return inputCfg.moduleKey;

    // 3. Infer from agent name — supports kebab-case, snake_case, PascalCase
    // e.g. "ar-aging-agent" → "ar", "sales_forecast_agent" → "sales", "ArAgingAgent" → "ar"
    const kebabMatch = agent.name.match(/^([a-z]+)[-_]/);
    if (kebabMatch) return kebabMatch[1];

    const pascalMatch = agent.name.match(/^([A-Z][a-z]+)/);
    if (pascalMatch) return pascalMatch[1]!.toLowerCase();

    return undefined;
  }

  /** Terminate a run with a final status and error */
  private async terminateRun(
    runId: string,
    status: RunStatus,
    error: string,
    totalTokens: number,
    totalCost: number,
    result: Record<string, unknown> | null,
  ): Promise<void> {
    await this.db.aiAutomationRun.update({
      where: { id: runId },
      data: {
        status,
        completedAt: new Date(),
        totalTokens,
        totalCost,
        error,
        result: (result ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  /** Mark remaining steps (after a failure) as SKIPPED */
  private async skipRemainingSteps(
    runId: string,
    steps: Array<{ id: string; stepOrder: number; agentId: string }>,
    failedStepOrder: number,
  ): Promise<void> {
    const remainingSteps = steps.filter((s) => s.stepOrder > failedStepOrder);

    for (const step of remainingSteps) {
      await this.db.aiAutomationStepRun.create({
        data: {
          id: randomUUID(),
          runId,
          stepId: step.id,
          status: 'SKIPPED',
          agentId: step.agentId,
          completedAt: new Date(),
        },
      });
    }
  }

  /** Emit ai.automation.failed event */
  private emitFailedEvent(
    automation: { id: string; companyId: string },
    runId: string,
    error: string,
    stepOrder?: number,
  ): void {
    this.eventBus.emit('ai.automation.failed', {
      automationId: automation.id,
      companyId: automation.companyId,
      runId,
      error,
      stepOrder,
    });
  }

  /**
   * Trigger the next automation in a chain (AC-6).
   * Fire-and-forget: chain runs asynchronously.
   */
  private triggerChain(
    chainNextId: string,
    output: Record<string, unknown> | null,
    companyId: string,
    sourceRunId: string,
  ): void {
    // Execute asynchronously — don't await to avoid blocking the current run
    this.execute({
      automationId: chainNextId,
      input: output ?? undefined,
      triggeredBy: `chain:${sourceRunId}`,
    }).catch((err) => {
      this.logger.error(
        { chainNextId, companyId, error: (err as Error).message },
        'Chained automation execution failed',
      );
    });
  }
}
