// ---------------------------------------------------------------------------
// AdminAgentService — CRUD for AI agents (admin-only)
// E5c-4 Task 2: AC #1, #2
// ---------------------------------------------------------------------------

import type { PrismaClient } from '@nexa/db';
import { Prisma } from '@nexa/db';
import type { Logger } from 'pino';
import { AppError } from '../../core/errors/app-error.js';
import { NotFoundError } from '../../core/errors/not-found-error.js';
import type { PaginationMeta } from '../../core/utils/response.js';
import type { CreateAgentInput, UpdateAgentInput, ListAgentsQuery } from './admin.schemas.js';

// ─── Response types ────────────────────────────────────────────────────────

export interface AgentListItem {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  modelId: string | null;
  modelDisplayName: string | null;
  promptId: string;
  promptName: string;
  routingTags: string[];
  toolCount: number;
  maxTurns: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentDetail extends AgentListItem {
  tools: unknown;
  guardrails: unknown;
  triggerConfig: unknown;
  model: { id: string; name: string; displayName: string; provider: string } | null;
  prompt: { id: string; name: string; description: string | null; category: string };
  automationStepCount: number;
}

// ─── Service ───────────────────────────────────────────────────────────────

export class AdminAgentService {
  constructor(
    private readonly db: PrismaClient,
    private readonly logger: Logger,
  ) {}

  // ─── List ──────────────────────────────────────────────────────────────

  async listAgents(
    query: ListAgentsQuery,
  ): Promise<{ data: AgentListItem[]; meta: PaginationMeta }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic where clause
    const where: any = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.modelId) {
      where.modelId = query.modelId;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { displayName: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [rows, total] = await Promise.all([
      this.db.aiAgent.findMany({
        where,
        take: query.limit + 1,
        ...(query.cursor ? { skip: 1, cursor: { id: query.cursor } } : {}),
        orderBy: { createdAt: 'desc' },
        include: {
          model: { select: { id: true, displayName: true } },
          prompt: { select: { id: true, name: true } },
        },
      }),
      this.db.aiAgent.count({ where }),
    ]);

    const hasMore = rows.length > query.limit;
    const data = hasMore ? rows.slice(0, -1) : rows;
    const nextCursor = hasMore && data.length > 0 ? data[data.length - 1]!.id : undefined;

    return {
      data: data.map((row) => this.toListItem(row)),
      meta: { cursor: nextCursor, hasMore, total },
    };
  }

  // ─── Get ───────────────────────────────────────────────────────────────

  async getAgent(id: string): Promise<AgentDetail> {
    const agent = await this.db.aiAgent.findUnique({
      where: { id },
      include: {
        model: { select: { id: true, name: true, displayName: true, provider: true } },
        prompt: { select: { id: true, name: true, description: true, category: true } },
        _count: { select: { automationSteps: true } },
      },
    });

    if (!agent) {
      throw new NotFoundError('AGENT_NOT_FOUND', `AI agent with id "${id}" not found`);
    }

    return {
      ...this.toListItem(agent),
      tools: agent.tools,
      guardrails: agent.guardrails,
      triggerConfig: agent.triggerConfig,
      model: agent.model,
      prompt: {
        id: agent.prompt.id,
        name: agent.prompt.name,
        description: agent.prompt.description ?? null,
        category: agent.prompt.category,
      },
      automationStepCount: agent._count.automationSteps,
    };
  }

  // ─── Create ────────────────────────────────────────────────────────────

  async createAgent(input: CreateAgentInput): Promise<AgentDetail> {
    // Validate modelId if provided
    if (input.modelId) {
      const model = await this.db.aiModel.findUnique({
        where: { id: input.modelId },
        select: { id: true, isActive: true },
      });

      if (!model) {
        throw new AppError('MODEL_NOT_FOUND', 'Referenced model does not exist', 422);
      }

      if (!model.isActive) {
        throw new AppError('MODEL_INACTIVE', 'Referenced model is inactive or does not exist', 422);
      }
    }

    // Validate promptId exists
    const prompt = await this.db.aiPrompt.findUnique({
      where: { id: input.promptId },
      select: { id: true },
    });

    if (!prompt) {
      throw new NotFoundError('PROMPT_NOT_FOUND', `Prompt with id "${input.promptId}" not found`);
    }

    try {
      const agent = await this.db.aiAgent.create({
        data: {
          name: input.name,
          displayName: input.displayName,
          description: input.description ?? null,
          modelId: input.modelId ?? null,
          promptId: input.promptId,
          routingTags: input.routingTags,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
          tools: input.tools as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
          guardrails: input.guardrails as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
          triggerConfig: input.triggerConfig as any,
          maxTurns: input.maxTurns,
          isActive: input.isActive,
        },
      });

      this.logger.info({ agentId: agent.id, agentName: agent.name }, 'AI agent created');

      return this.getAgent(agent.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(
          'AGENT_NAME_CONFLICT',
          `An agent with name "${input.name}" already exists`,
          409,
        );
      }
      throw error;
    }
  }

  // ─── Update ────────────────────────────────────────────────────────────

  async updateAgent(id: string, input: UpdateAgentInput): Promise<AgentDetail> {
    // Load current agent to verify it exists
    const current = await this.db.aiAgent.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundError('AGENT_NOT_FOUND', `AI agent with id "${id}" not found`);
    }

    // Validate modelId if being updated
    if (input.modelId !== undefined && input.modelId !== null) {
      const model = await this.db.aiModel.findUnique({
        where: { id: input.modelId },
        select: { id: true, isActive: true },
      });

      if (!model) {
        throw new AppError('MODEL_NOT_FOUND', 'Referenced model does not exist', 422);
      }

      if (!model.isActive) {
        throw new AppError('MODEL_INACTIVE', 'Referenced model is inactive or does not exist', 422);
      }
    }

    // Validate promptId if being updated
    if (input.promptId !== undefined) {
      const prompt = await this.db.aiPrompt.findUnique({
        where: { id: input.promptId },
        select: { id: true },
      });

      if (!prompt) {
        throw new NotFoundError('PROMPT_NOT_FOUND', `Prompt with id "${input.promptId}" not found`);
      }
    }

    // Build Prisma update data — only include fields that were provided
    const data: Prisma.AiAgentUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.displayName !== undefined) data.displayName = input.displayName;
    if (input.description !== undefined) data.description = input.description;
    if (input.modelId !== undefined) data.modelId = input.modelId;
    if (input.promptId !== undefined) data.promptId = input.promptId;
    if (input.routingTags !== undefined) data.routingTags = input.routingTags;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
    if (input.tools !== undefined) data.tools = input.tools as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
    if (input.guardrails !== undefined) data.guardrails = input.guardrails as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma InputJsonValue
    if (input.triggerConfig !== undefined) data.triggerConfig = input.triggerConfig as any;
    if (input.maxTurns !== undefined) data.maxTurns = input.maxTurns;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    try {
      await this.db.aiAgent.update({ where: { id }, data });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const conflictName = input.name ?? current.name;
        throw new AppError(
          'AGENT_NAME_CONFLICT',
          `An agent with name "${conflictName}" already exists`,
          409,
        );
      }
      throw error;
    }

    this.logger.info({ agentId: id }, 'AI agent updated');

    return this.getAgent(id);
  }

  // ─── Delete ────────────────────────────────────────────────────────────

  async deleteAgent(id: string): Promise<void> {
    const agent = await this.db.aiAgent.findUnique({
      where: { id },
      include: { _count: { select: { automationSteps: true } } },
    });

    if (!agent) {
      throw new NotFoundError('AGENT_NOT_FOUND', `AI agent with id "${id}" not found`);
    }

    // Business rule: Cannot delete an agent referenced by automation steps
    if (agent._count.automationSteps > 0) {
      throw new AppError(
        'AGENT_REFERENCED_BY_STEPS',
        `This agent is referenced by ${agent._count.automationSteps} automation step${agent._count.automationSteps === 1 ? '' : 's'}. Remove step references first.`,
        422,
      );
    }

    await this.db.aiAgent.delete({ where: { id } });
    this.logger.info({ agentId: id, agentName: agent.name }, 'AI agent deleted');
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma model type with includes
  private toListItem(row: any): AgentListItem {
    // Compute tool count from the tools JSON array
    const toolsArray = Array.isArray(row.tools) ? row.tools : [];

    return {
      id: row.id,
      name: row.name,
      displayName: row.displayName,
      description: row.description,
      modelId: row.modelId,
      modelDisplayName: row.model?.displayName ?? null,
      promptId: row.promptId,
      promptName: row.prompt?.name ?? '',
      routingTags: row.routingTags,
      toolCount: toolsArray.length,
      maxTurns: row.maxTurns,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
