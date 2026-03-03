// ---------------------------------------------------------------------------
// Automation CRUD service — company-scoped automation management
// E5c-1 Task 10.1: AC #21, #22
// ---------------------------------------------------------------------------

import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type { EventBus } from '../../core/events/event-bus.js';
import { NotFoundError } from '../../core/errors/not-found-error.js';
import { AppError } from '../../core/errors/app-error.js';
import { detectCycleInChain } from './chain-detection.js';
import { VALID_BUSINESS_EVENT_TYPES } from '../../core/events/event-bus.types.js';
import type { AutomationSchedulerService } from './automation-scheduler.js';
import type { AutomationEventListener } from './automation-event-listener.js';
import type { AutomationExecutor } from './automation-executor.js';
import type {
  CreateAutomationInput,
  UpdateAutomationInput,
  ListAutomationsQuery,
  ListRunsQuery,
  CreateVariableInput,
  UpdateVariableInput,
  TestResolveInput,
  ListVariablesQuery,
} from './automation.schemas.js';
import {
  createVariableResolver,
  type VariableResolver,
  type VariableResolutionContext,
} from './variable-resolver.js';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AutomationServiceDeps {
  db: PrismaClient;
  eventBus: EventBus;
  logger: Logger;
  scheduler: AutomationSchedulerService | null;
  eventListener: AutomationEventListener | null;
  executor: AutomationExecutor | null;
}

interface PaginatedResult<T> {
  data: T[];
  meta: {
    cursor?: string | null;
    hasMore: boolean;
    total: number;
  };
}

// ─── Shared select shapes ───────────────────────────────────────────────────

const automationListSelect = {
  id: true,
  name: true,
  description: true,
  triggerType: true,
  eventType: true,
  isActive: true,
  maxTokenBudget: true,
  maxDurationMs: true,
  createdAt: true,
  updatedAt: true,
  schedule: {
    select: {
      id: true,
      cronExpression: true,
      timezone: true,
      nextRunAt: true,
      lastRunAt: true,
      isPaused: true,
    },
  },
  _count: { select: { steps: true } },
  runs: {
    take: 1,
    orderBy: { createdAt: 'desc' as const },
    select: { id: true, status: true, startedAt: true, completedAt: true },
  },
} satisfies Prisma.AiAutomationSelect;

const automationDetailSelect = {
  id: true,
  name: true,
  description: true,
  triggerType: true,
  eventType: true,
  chainFromId: true,
  chainNextId: true,
  notificationConfig: true,
  maxTokenBudget: true,
  maxDurationMs: true,
  isActive: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  schedule: {
    select: {
      id: true,
      cronExpression: true,
      timezone: true,
      nextRunAt: true,
      lastRunAt: true,
      isPaused: true,
    },
  },
  steps: {
    orderBy: { stepOrder: 'asc' as const },
    select: {
      id: true,
      stepOrder: true,
      agentId: true,
      goal: true,
      inputConfig: true,
      outputConfig: true,
      maxTurns: true,
      agent: { select: { displayName: true } },
    },
  },
  runs: {
    take: 5,
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      triggeredBy: true,
      status: true,
      startedAt: true,
      completedAt: true,
      totalTokens: true,
      createdAt: true,
    },
  },
} satisfies Prisma.AiAutomationSelect;

// ─── Service ────────────────────────────────────────────────────────────────

export class AutomationService {
  private db: PrismaClient;
  private logger: Logger;
  private scheduler: AutomationSchedulerService | null;
  private eventListener: AutomationEventListener | null;
  private executor: AutomationExecutor | null;
  private variableResolver: VariableResolver;

  constructor(deps: AutomationServiceDeps) {
    this.db = deps.db;
    this.logger = deps.logger;
    this.scheduler = deps.scheduler;
    this.eventListener = deps.eventListener;
    this.executor = deps.executor;
    this.variableResolver = createVariableResolver(deps.db, deps.logger);
  }

  // ─── Create ─────────────────────────────────────────────────────────────

  async createAutomation(companyId: string, userId: string, data: CreateAutomationInput) {
    // Validate eventType against known BusinessEvents
    if (
      data.triggerType === 'EVENT' &&
      data.eventType &&
      !VALID_BUSINESS_EVENT_TYPES.has(data.eventType)
    ) {
      throw new AppError(
        'INVALID_EVENT_TYPE',
        `Unknown event type '${data.eventType}'. Must be a valid business event.`,
        422,
      );
    }

    // Validate chain cycle if chainNextId is set
    if (data.chainNextId) {
      // For new automations, we use a temporary ID since it doesn't exist yet
      // We just need to check the chainNextId target doesn't already form a cycle
      const target = await this.db.aiAutomation.findUnique({
        where: { id: data.chainNextId },
        select: { id: true, companyId: true },
      });
      if (!target || target.companyId !== companyId) {
        throw new AppError(
          'CHAIN_TARGET_NOT_FOUND',
          'Chain target automation not found in this company',
          422,
        );
      }
    }

    const automation = await this.db.$transaction(async (tx) => {
      // Create the automation
      const created = await tx.aiAutomation.create({
        data: {
          companyId,
          name: data.name,
          description: data.description ?? null,
          triggerType: data.triggerType,
          eventType: data.triggerType === 'EVENT' ? data.eventType : null,
          chainNextId: data.chainNextId ?? null,
          notificationConfig: data.notificationConfig
            ? (data.notificationConfig as Prisma.InputJsonValue)
            : undefined,
          maxTokenBudget: data.maxTokenBudget,
          maxDurationMs: data.maxDurationMs,
          createdById: userId,
          steps: {
            create: data.steps.map((step, index) => ({
              stepOrder: index + 1,
              agentId: step.agentId,
              goal: step.goal,
              inputConfig: step.inputConfig as Prisma.InputJsonValue,
              outputConfig: step.outputConfig as Prisma.InputJsonValue,
              maxTurns: step.maxTurns,
            })),
          },
          ...(data.triggerType === 'SCHEDULED' && data.schedule
            ? {
                schedule: {
                  create: {
                    cronExpression: data.schedule.cronExpression,
                    timezone: data.schedule.timezone,
                    isPaused: data.schedule.isPaused ?? false,
                  },
                },
              }
            : {}),
        },
        select: automationDetailSelect,
      });

      // Validate chain cycle after creation (now we have the real ID)
      if (data.chainNextId) {
        await detectCycleInChain(tx as unknown as PrismaClient, created.id, data.chainNextId);
      }

      return created;
    });

    // Post-creation side effects (outside transaction)
    if (data.triggerType === 'SCHEDULED' && data.schedule && this.scheduler) {
      await this.scheduler.addSchedule(
        automation.id,
        companyId,
        data.schedule.cronExpression,
        data.schedule.timezone,
      );
    }

    if (data.triggerType === 'EVENT' && data.eventType && this.eventListener) {
      this.eventListener.subscribe(automation.id, data.eventType);
    }

    this.logger.info(
      { automationId: automation.id, companyId, triggerType: data.triggerType },
      'Automation created',
    );

    return this.formatAutomationDetail(automation);
  }

  // ─── List ───────────────────────────────────────────────────────────────

  async listAutomations(
    companyId: string,
    query: ListAutomationsQuery,
  ): Promise<PaginatedResult<unknown>> {
    const { cursor, limit, triggerType, status } = query;

    const where: Prisma.AiAutomationWhereInput = {
      companyId,
      ...(triggerType ? { triggerType } : {}),
      ...(status === 'active' ? { isActive: true } : {}),
      ...(status === 'inactive' ? { isActive: false } : {}),
    };

    const [items, total] = await Promise.all([
      this.db.aiAutomation.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { createdAt: 'desc' },
        select: automationListSelect,
      }),
      this.db.aiAutomation.count({ where }),
    ]);

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, -1) : items;
    const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

    return {
      data: data.map((item) => this.formatAutomationListItem(item)),
      meta: { cursor: nextCursor ?? null, hasMore, total },
    };
  }

  // ─── Get ────────────────────────────────────────────────────────────────

  async getAutomation(companyId: string, automationId: string) {
    const automation = await this.db.aiAutomation.findFirst({
      where: { id: automationId, companyId },
      select: automationDetailSelect,
    });

    if (!automation) {
      throw new NotFoundError(
        'AUTOMATION_NOT_FOUND',
        'Automation not found',
        'ai.error.automationNotFound',
      );
    }

    return this.formatAutomationDetail(automation);
  }

  // ─── Update ─────────────────────────────────────────────────────────────

  async updateAutomation(companyId: string, automationId: string, data: UpdateAutomationInput) {
    // Ensure automation exists and belongs to company
    const existing = await this.db.aiAutomation.findFirst({
      where: { id: automationId, companyId },
      select: {
        id: true,
        triggerType: true,
        eventType: true,
        isActive: true,
        schedule: { select: { id: true, cronExpression: true, timezone: true } },
      },
    });

    if (!existing) {
      throw new NotFoundError(
        'AUTOMATION_NOT_FOUND',
        'Automation not found',
        'ai.error.automationNotFound',
      );
    }

    // Validate eventType against known BusinessEvents
    const effectiveEventType = data.eventType ?? existing.eventType;
    const effectiveTriggerType = data.triggerType ?? existing.triggerType;
    if (
      effectiveTriggerType === 'EVENT' &&
      effectiveEventType &&
      !VALID_BUSINESS_EVENT_TYPES.has(effectiveEventType)
    ) {
      throw new AppError(
        'INVALID_EVENT_TYPE',
        `Unknown event type '${effectiveEventType}'. Must be a valid business event.`,
        422,
      );
    }

    // Validate chain cycle if chainNextId is being set
    if (data.chainNextId) {
      await detectCycleInChain(this.db, automationId, data.chainNextId);
    }

    const automation = await this.db.$transaction(async (tx) => {
      // If steps are being replaced, delete existing and recreate
      if (data.steps) {
        await tx.aiAutomationStep.deleteMany({ where: { automationId } });
      }

      // Build update payload
      const updateData: Prisma.AiAutomationUpdateInput = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.triggerType !== undefined) updateData.triggerType = data.triggerType;
      if (data.eventType !== undefined) updateData.eventType = data.eventType;
      if (data.chainNextId !== undefined) {
        if (data.chainNextId === null) {
          updateData.chainNext = { disconnect: true };
        } else {
          updateData.chainNext = { connect: { id: data.chainNextId } };
        }
      }
      if (data.notificationConfig !== undefined) {
        updateData.notificationConfig =
          (data.notificationConfig as Prisma.InputJsonValue) ?? Prisma.DbNull;
      }
      if (data.maxTokenBudget !== undefined) updateData.maxTokenBudget = data.maxTokenBudget;
      if (data.maxDurationMs !== undefined) updateData.maxDurationMs = data.maxDurationMs;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      // Recreate steps if provided
      if (data.steps) {
        updateData.steps = {
          create: data.steps.map((step, index) => ({
            stepOrder: index + 1,
            agentId: step.agentId,
            goal: step.goal,
            inputConfig: step.inputConfig as Prisma.InputJsonValue,
            outputConfig: step.outputConfig as Prisma.InputJsonValue,
            maxTurns: step.maxTurns,
          })),
        };
      }

      // Handle schedule changes
      const effectiveTriggerType = data.triggerType ?? existing.triggerType;
      if (effectiveTriggerType === 'SCHEDULED' && data.schedule) {
        if (existing.schedule) {
          updateData.schedule = {
            update: {
              cronExpression: data.schedule.cronExpression,
              timezone: data.schedule.timezone,
              ...(data.schedule.isPaused !== undefined && { isPaused: data.schedule.isPaused }),
            },
          };
        } else {
          updateData.schedule = {
            create: {
              cronExpression: data.schedule.cronExpression,
              timezone: data.schedule.timezone,
              isPaused: data.schedule.isPaused ?? false,
            },
          };
        }
      } else if (effectiveTriggerType !== 'SCHEDULED' && existing.schedule) {
        // Trigger type changed away from SCHEDULED — remove schedule
        updateData.schedule = { delete: true };
      }

      return tx.aiAutomation.update({
        where: { id: automationId },
        data: updateData,
        select: automationDetailSelect,
      });
    });

    // Post-update side effects
    const postTriggerType = data.triggerType ?? existing.triggerType;
    const effectiveIsActive = data.isActive ?? existing.isActive;

    // Handle scheduler refresh
    if (postTriggerType === 'SCHEDULED' && this.scheduler) {
      if (effectiveIsActive && data.schedule) {
        await this.scheduler.updateSchedule(
          automationId,
          companyId,
          data.schedule.cronExpression,
          data.schedule.timezone,
        );
      } else if (!effectiveIsActive) {
        await this.scheduler.removeSchedule(automationId);
      }
    } else if (
      existing.triggerType === 'SCHEDULED' &&
      postTriggerType !== 'SCHEDULED' &&
      this.scheduler
    ) {
      await this.scheduler.removeSchedule(automationId);
    }

    // Handle event listener refresh
    if (postTriggerType === 'EVENT' && this.eventListener) {
      const effectiveEventType = data.eventType ?? existing.eventType;
      if (effectiveIsActive && effectiveEventType) {
        this.eventListener.updateSubscription(automationId, effectiveEventType);
      } else if (!effectiveIsActive) {
        this.eventListener.unsubscribe(automationId);
      }
    } else if (
      existing.triggerType === 'EVENT' &&
      postTriggerType !== 'EVENT' &&
      this.eventListener
    ) {
      this.eventListener.unsubscribe(automationId);
    }

    this.logger.info({ automationId, companyId }, 'Automation updated');

    return this.formatAutomationDetail(automation);
  }

  // ─── Delete (soft) ──────────────────────────────────────────────────────

  async deleteAutomation(companyId: string, automationId: string): Promise<void> {
    const existing = await this.db.aiAutomation.findFirst({
      where: { id: automationId, companyId },
      select: { id: true, triggerType: true },
    });

    if (!existing) {
      throw new NotFoundError(
        'AUTOMATION_NOT_FOUND',
        'Automation not found',
        'ai.error.automationNotFound',
      );
    }

    // Soft-delete: set isActive = false (preserve run history)
    await this.db.aiAutomation.update({
      where: { id: automationId },
      data: { isActive: false },
    });

    // Clean up scheduler/listener
    if (existing.triggerType === 'SCHEDULED' && this.scheduler) {
      await this.scheduler.removeSchedule(automationId);
    }
    if (existing.triggerType === 'EVENT' && this.eventListener) {
      this.eventListener.unsubscribe(automationId);
    }

    this.logger.info({ automationId, companyId }, 'Automation soft-deleted');
  }

  // ─── Manual Run ─────────────────────────────────────────────────────────

  async runAutomation(
    companyId: string,
    automationId: string,
    userId: string,
    input?: Record<string, unknown>,
  ) {
    if (!this.executor) {
      throw new AppError('EXECUTOR_UNAVAILABLE', 'Automation executor is not available', 503);
    }

    const automation = await this.db.aiAutomation.findFirst({
      where: { id: automationId, companyId },
      select: { id: true, isActive: true },
    });

    if (!automation) {
      throw new NotFoundError(
        'AUTOMATION_NOT_FOUND',
        'Automation not found',
        'ai.error.automationNotFound',
      );
    }

    if (!automation.isActive) {
      throw new AppError('AUTOMATION_INACTIVE', 'Cannot run an inactive automation', 422);
    }

    // Pre-generate runId so the caller can track it immediately
    const runId = randomUUID();

    // Execute asynchronously — return the run ID immediately
    const result = this.executor.execute({
      automationId,
      input,
      triggeredBy: `manual:${userId}`,
      runId,
    });

    // Don't await — let it run in the background
    result.catch((err) => {
      this.logger.error(
        { automationId, runId, error: (err as Error).message },
        'Manual automation run failed',
      );
    });

    return { message: 'Automation run started', automationId, runId };
  }

  // ─── Run Queries ────────────────────────────────────────────────────────

  async listRuns(
    companyId: string,
    automationId: string | undefined,
    query: ListRunsQuery,
  ): Promise<PaginatedResult<unknown>> {
    const { cursor, limit, status, dateFrom, dateTo } = query;

    const where: Prisma.AiAutomationRunWhereInput = {
      automation: { companyId },
      ...(automationId ? { automationId } : {}),
      ...(status ? { status } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.db.aiAutomationRun.findMany({
        where,
        take: limit + 1,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          automationId: true,
          triggeredBy: true,
          status: true,
          startedAt: true,
          completedAt: true,
          totalTokens: true,
          totalCost: true,
          error: true,
          createdAt: true,
          automation: { select: { name: true } },
        },
      }),
      this.db.aiAutomationRun.count({ where }),
    ]);

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, -1) : items;
    const nextCursor = hasMore ? data[data.length - 1]?.id : undefined;

    return {
      data: data.map((item) => ({
        id: item.id,
        automationId: item.automationId,
        automationName: item.automation.name,
        triggeredBy: item.triggeredBy,
        status: item.status,
        startedAt: item.startedAt?.toISOString() ?? null,
        completedAt: item.completedAt?.toISOString() ?? null,
        totalTokens: item.totalTokens,
        totalCost: item.totalCost.toString(),
        error: item.error,
        createdAt: item.createdAt.toISOString(),
      })),
      meta: { cursor: nextCursor ?? null, hasMore, total },
    };
  }

  async getRun(companyId: string, runId: string) {
    const run = await this.db.aiAutomationRun.findFirst({
      where: {
        id: runId,
        automation: { companyId },
      },
      select: {
        id: true,
        automationId: true,
        triggeredBy: true,
        status: true,
        startedAt: true,
        completedAt: true,
        totalTokens: true,
        totalCost: true,
        result: true,
        error: true,
        retryOfRunId: true,
        createdAt: true,
        automation: { select: { name: true } },
        stepRuns: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            stepId: true,
            agentId: true,
            modelId: true,
            status: true,
            input: true,
            output: true,
            error: true,
            inputTokens: true,
            outputTokens: true,
            latencyMs: true,
            turns: true,
            startedAt: true,
            completedAt: true,
            step: { select: { stepOrder: true } },
          },
        },
      },
    });

    if (!run) {
      throw new NotFoundError('RUN_NOT_FOUND', 'Automation run not found', 'ai.error.runNotFound');
    }

    return {
      id: run.id,
      automationId: run.automationId,
      automationName: run.automation.name,
      triggeredBy: run.triggeredBy,
      status: run.status,
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
      totalTokens: run.totalTokens,
      totalCost: run.totalCost.toString(),
      result: run.result,
      error: run.error,
      retryOfRunId: run.retryOfRunId,
      createdAt: run.createdAt.toISOString(),
      stepRuns: run.stepRuns.map((sr) => ({
        id: sr.id,
        stepId: sr.stepId,
        stepOrder: sr.step.stepOrder,
        agentId: sr.agentId,
        modelId: sr.modelId,
        status: sr.status,
        input: sr.input,
        output: sr.output,
        error: sr.error,
        inputTokens: sr.inputTokens,
        outputTokens: sr.outputTokens,
        latencyMs: sr.latencyMs,
        turns: sr.turns,
        startedAt: sr.startedAt?.toISOString() ?? null,
        completedAt: sr.completedAt?.toISOString() ?? null,
      })),
    };
  }

  // ─── Retry from failed step ─────────────────────────────────────────────

  async retryFromFailedStep(companyId: string, runId: string) {
    if (!this.executor) {
      throw new AppError('EXECUTOR_UNAVAILABLE', 'Automation executor is not available', 503);
    }

    // Load the original run with its step runs (including output for completed steps)
    const originalRun = await this.db.aiAutomationRun.findFirst({
      where: {
        id: runId,
        automation: { companyId },
      },
      select: {
        id: true,
        automationId: true,
        status: true,
        automation: { select: { isActive: true } },
        stepRuns: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            stepId: true,
            status: true,
            input: true,
            output: true,
            step: { select: { stepOrder: true } },
          },
        },
      },
    });

    if (!originalRun) {
      throw new NotFoundError('RUN_NOT_FOUND', 'Automation run not found', 'ai.error.runNotFound');
    }

    if (originalRun.status !== 'FAILED') {
      throw new AppError('RUN_NOT_FAILED', 'Can only retry runs with FAILED status', 422);
    }

    if (!originalRun.automation.isActive) {
      throw new AppError(
        'AUTOMATION_INACTIVE',
        'Cannot retry a run for an inactive automation',
        422,
      );
    }

    // Find the first failed step to determine retry start point
    const failedStepRun = originalRun.stepRuns.find((sr) => sr.status === 'FAILED');
    const failedStepOrder = failedStepRun?.step.stepOrder ?? 1;
    const retryInput = failedStepRun?.input as Record<string, unknown> | undefined;

    // Collect outputs from previously completed steps (prior to the failed step)
    // so the executor can resume with the correct previousStepOutputs context
    const priorStepOutputs: Record<string, unknown> = {};
    for (const sr of originalRun.stepRuns) {
      if (sr.status === 'COMPLETED' && sr.output && sr.step.stepOrder < failedStepOrder) {
        priorStepOutputs[String(sr.step.stepOrder)] = sr.output;
      }
    }

    // Pre-generate the new run ID so we can return it to the client immediately
    const newRunId = randomUUID();

    // Execute asynchronously starting from the failed step
    const result = this.executor.execute({
      automationId: originalRun.automationId,
      runId: newRunId,
      input: retryInput ?? undefined,
      triggeredBy: `retry:${runId}`,
      retryOfRunId: runId,
      startFromStepOrder: failedStepOrder,
      priorStepOutputs,
    });

    result.catch((err) => {
      this.logger.error(
        {
          automationId: originalRun.automationId,
          originalRunId: runId,
          newRunId,
          error: (err as Error).message,
        },
        'Retry automation run failed',
      );
    });

    return {
      message: 'Retry started',
      automationId: originalRun.automationId,
      originalRunId: runId,
      newRunId,
    };
  }

  // ─── Variable Registry ─────────────────────────────────────────────────

  async listVariables(_companyId: string, query?: ListVariablesQuery) {
    // Prompt variables are system-level resources (agents/prompts are global,
    // not company-scoped). Return all for autocomplete in prompt editors.
    const where = query?.promptId ? { promptId: query.promptId } : {};

    const variables = await this.db.aiPromptVariable.findMany({
      where,
      select: {
        id: true,
        promptId: true,
        variableName: true,
        displayName: true,
        description: true,
        sourceType: true,
        sourceConfig: true,
        defaultValue: true,
        isRequired: true,
        prompt: { select: { name: true } },
      },
      orderBy: [{ sourceType: 'asc' }, { variableName: 'asc' }],
    });

    // Group by sourceType for the response
    const grouped: Record<
      string,
      Array<{
        id: string;
        promptId: string;
        promptName: string | null;
        variableName: string;
        displayName: string;
        description: string | null;
        sourceType: string;
        sourceConfig: unknown;
        defaultValue: string | null;
        isRequired: boolean;
      }>
    > = {};

    for (const v of variables) {
      const item = {
        id: v.id,
        promptId: v.promptId,
        promptName: v.prompt.name,
        variableName: v.variableName,
        displayName: v.displayName,
        description: v.description,
        sourceType: v.sourceType,
        sourceConfig: v.sourceConfig,
        defaultValue: v.defaultValue,
        isRequired: v.isRequired,
      };
      const group = grouped[v.sourceType] ?? [];
      group.push(item);
      grouped[v.sourceType] = group;
    }

    return grouped;
  }

  async createVariable(data: CreateVariableInput) {
    // Verify the prompt exists
    const prompt = await this.db.aiPrompt.findUnique({
      where: { id: data.promptId },
      select: { id: true },
    });

    if (!prompt) {
      throw new NotFoundError('PROMPT_NOT_FOUND', 'Prompt not found', 'ai.error.promptNotFound');
    }

    const variable = await this.db.aiPromptVariable.create({
      data: {
        promptId: data.promptId,
        variableName: data.variableName,
        displayName: data.displayName,
        description: data.description ?? null,
        sourceType: data.sourceType,
        sourceConfig: data.sourceConfig as Prisma.InputJsonValue,
        defaultValue: data.defaultValue ?? null,
        isRequired: data.isRequired,
      },
      select: {
        id: true,
        promptId: true,
        variableName: true,
        displayName: true,
        description: true,
        sourceType: true,
        sourceConfig: true,
        defaultValue: true,
        isRequired: true,
        createdAt: true,
        updatedAt: true,
        prompt: { select: { name: true } },
      },
    });

    this.logger.info(
      { variableId: variable.id, variableName: variable.variableName, promptId: data.promptId },
      'Prompt variable created',
    );

    return {
      id: variable.id,
      promptId: variable.promptId,
      promptName: variable.prompt.name,
      variableName: variable.variableName,
      displayName: variable.displayName,
      description: variable.description,
      sourceType: variable.sourceType,
      sourceConfig: variable.sourceConfig,
      defaultValue: variable.defaultValue,
      isRequired: variable.isRequired,
      createdAt: variable.createdAt.toISOString(),
      updatedAt: variable.updatedAt.toISOString(),
    };
  }

  async updateVariable(variableId: string, data: UpdateVariableInput) {
    const existing = await this.db.aiPromptVariable.findUnique({
      where: { id: variableId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundError(
        'VARIABLE_NOT_FOUND',
        'Prompt variable not found',
        'ai.error.variableNotFound',
      );
    }

    const updateData: Prisma.AiPromptVariableUpdateInput = {};
    if (data.variableName !== undefined) updateData.variableName = data.variableName;
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.sourceType !== undefined) updateData.sourceType = data.sourceType;
    if (data.sourceConfig !== undefined)
      updateData.sourceConfig = data.sourceConfig as Prisma.InputJsonValue;
    if (data.defaultValue !== undefined) updateData.defaultValue = data.defaultValue;
    if (data.isRequired !== undefined) updateData.isRequired = data.isRequired;

    const variable = await this.db.aiPromptVariable.update({
      where: { id: variableId },
      data: updateData,
      select: {
        id: true,
        promptId: true,
        variableName: true,
        displayName: true,
        description: true,
        sourceType: true,
        sourceConfig: true,
        defaultValue: true,
        isRequired: true,
        createdAt: true,
        updatedAt: true,
        prompt: { select: { name: true } },
      },
    });

    this.logger.info(
      { variableId, variableName: variable.variableName },
      'Prompt variable updated',
    );

    return {
      id: variable.id,
      promptId: variable.promptId,
      promptName: variable.prompt.name,
      variableName: variable.variableName,
      displayName: variable.displayName,
      description: variable.description,
      sourceType: variable.sourceType,
      sourceConfig: variable.sourceConfig,
      defaultValue: variable.defaultValue,
      isRequired: variable.isRequired,
      createdAt: variable.createdAt.toISOString(),
      updatedAt: variable.updatedAt.toISOString(),
    };
  }

  async deleteVariable(variableId: string): Promise<void> {
    const existing = await this.db.aiPromptVariable.findUnique({
      where: { id: variableId },
      select: { id: true, variableName: true },
    });

    if (!existing) {
      throw new NotFoundError(
        'VARIABLE_NOT_FOUND',
        'Prompt variable not found',
        'ai.error.variableNotFound',
      );
    }

    await this.db.aiPromptVariable.delete({ where: { id: variableId } });

    this.logger.info(
      { variableId, variableName: existing.variableName },
      'Prompt variable deleted',
    );
  }

  async testResolveVariable(variableId: string, companyId: string, testContext: TestResolveInput) {
    const variable = await this.db.aiPromptVariable.findUnique({
      where: { id: variableId },
    });

    if (!variable) {
      throw new NotFoundError(
        'VARIABLE_NOT_FOUND',
        'Prompt variable not found',
        'ai.error.variableNotFound',
      );
    }

    const startTime = Date.now();
    const resolutionContext: VariableResolutionContext = {
      companyId, // Use authenticated companyId, not from request body
      userId: testContext.userId ?? '00000000-0000-0000-0000-000000000000',
      userName: testContext.userName,
      userRole: testContext.userRole,
      companyName: testContext.companyName,
      baseCurrency: testContext.baseCurrency,
      defaultCurrency: testContext.defaultCurrency,
      pageContext: testContext.pageContext,
      autonomous: false,
    };

    let resolvedValue: unknown = null;
    let success = true;
    let error: string | null = null;

    try {
      const resultMap = await this.variableResolver.resolveToMap([variable], resolutionContext);
      resolvedValue = resultMap[variable.variableName] ?? null;
    } catch (err) {
      success = false;
      error = (err as Error).message;
    }

    const resolveTimeMs = Date.now() - startTime;

    return {
      variableId: variable.id,
      variableName: variable.variableName,
      sourceType: variable.sourceType,
      resolvedValue,
      resolveTimeMs,
      success,
      error,
    };
  }

  // ─── Formatters ─────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatAutomationListItem(item: any) {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      triggerType: item.triggerType,
      eventType: item.eventType,
      isActive: item.isActive,
      maxTokenBudget: item.maxTokenBudget,
      maxDurationMs: item.maxDurationMs,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      stepCount: item._count?.steps ?? 0,
      lastRunId: item.runs?.[0]?.id ?? null,
      lastRunStatus: item.runs?.[0]?.status ?? null,
      lastRunAt:
        item.runs?.[0]?.completedAt?.toISOString() ??
        item.runs?.[0]?.startedAt?.toISOString() ??
        null,
      schedule: item.schedule
        ? {
            id: item.schedule.id,
            cronExpression: item.schedule.cronExpression,
            timezone: item.schedule.timezone,
            nextRunAt: item.schedule.nextRunAt?.toISOString() ?? null,
            lastRunAt: item.schedule.lastRunAt?.toISOString() ?? null,
            isPaused: item.schedule.isPaused,
          }
        : null,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatAutomationDetail(item: any) {
    return {
      ...this.formatAutomationListItem(item),
      chainFromId: item.chainFromId,
      chainNextId: item.chainNextId,
      notificationConfig: item.notificationConfig,
      createdById: item.createdById,
      steps: item.steps.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (step: any) => ({
          id: step.id,
          stepOrder: step.stepOrder,
          agentId: step.agentId,
          agentName: step.agent?.displayName ?? undefined,
          goal: step.goal,
          inputConfig: step.inputConfig,
          outputConfig: step.outputConfig,
          maxTurns: step.maxTurns,
        }),
      ),
      recentRuns: (item.runs ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (run: any) => ({
          id: run.id,
          triggeredBy: run.triggeredBy,
          status: run.status,
          startedAt: run.startedAt?.toISOString() ?? null,
          completedAt: run.completedAt?.toISOString() ?? null,
          totalTokens: run.totalTokens,
          createdAt: run.createdAt.toISOString(),
        }),
      ),
    };
  }
}
