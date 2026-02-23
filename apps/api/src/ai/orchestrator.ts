import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type Redis from 'ioredis';
import type {
  AiGateway,
} from '@nexa/ai-gateway';
import type {
  AiGatewayRequest,
  Message,
  Tool,
} from '@nexa/ai-gateway';
import {
  AiQuotaExceededError,
  ProviderUnavailableError,
  ProviderError,
} from '@nexa/ai-gateway';
import type { EventBus } from '../core/events/event-bus.js';
import type { PromptManager } from './prompt-manager.js';
import type { ResponseParser } from './response-parser.js';
import type { ActionPlanner } from './action-planner.js';
import type {
  AgentGuardrails,
  AiRequest,
  AiRequestContext,
  AiResponse,
  AiStreamChunk,
} from './ai.types.js';
import { AiAgentNotFoundError } from './ai.errors.js';

/** Default number of conversation history messages to load */
const DEFAULT_HISTORY_LIMIT = 50;

/** Token estimation: ~4 chars per token (rough heuristic) */
const CHARS_PER_TOKEN = 4;

/** Keep 80% of maxInputTokens for history trimming */
const TOKEN_BUDGET_RATIO = 0.8;

export class AiOrchestrator {
  /** ActionPlanner for guardrail evaluation of action proposals (nullable for graceful degradation) */
  private actionPlanner: ActionPlanner | null = null;

  constructor(
    private aiGateway: AiGateway,
    private promptManager: PromptManager,
    private responseParser: ResponseParser,
    private db: PrismaClient,
    _redis: Redis, // Reserved for future cache integration
    private eventBus: EventBus,
    private logger: Logger,
  ) {}

  /** Set the ActionPlanner instance (called during plugin initialization) */
  setActionPlanner(planner: ActionPlanner): void {
    this.actionPlanner = planner;
  }

  /**
   * Main entry point — process an AI request end-to-end.
   *
   * Flow:
   *   1. Resolve agent (from agentName or intent keywords)
   *   2. Load prompt via PromptManager
   *   3. Resolve prompt parameters
   *   4. Load conversation history (multi-turn)
   *   5. Build AiGatewayRequest
   *   6. Call aiGateway.complete()
   *   7. Parse response via ResponseParser
   *   8. Persist user + assistant messages
   *   9. Return typed AiResponse
   *
   * Never throws — returns AiResponse with type 'error' on failure (IMP-006).
   */
  async process(request: AiRequest): Promise<AiResponse> {
    try {
      // 1. Resolve agent
      const agent = await this.resolveAgent(request);

      // 2. Load prompt
      const loaded = await this.promptManager.loadPrompt(agent.promptName);

      // 3. Resolve prompt parameters
      const resolved = await this.promptManager.resolveParameters(
        loaded.prompt,
        request.context,
        request.userMessage,
      );

      // 4. Load conversation history (verify tenant + user ownership)
      const conversationHistory = request.conversationId
        ? await this.loadConversationHistory(request.conversationId, agent, request.context.companyId, request.context.userId)
        : [];

      // 5. Build gateway request
      const gatewayRequest = this.buildGatewayRequest(
        agent,
        resolved,
        request,
        conversationHistory,
      );

      // 6. Call AI Gateway
      const gatewayResponse = await this.aiGateway.complete(gatewayRequest);

      // 7. Parse response
      const aiResponse = this.responseParser.parse(gatewayResponse, request.intent);

      // Set latency from gateway response
      if (aiResponse.usage) {
        aiResponse.usage.latencyMs = gatewayResponse.latencyMs;
      }

      // 8. Ensure conversation exists (needed before ActionPlanner for conversationId)
      const conversationId = request.conversationId ?? await this.ensureConversation(
        request.context.userId,
        request.context.companyId,
        agent.id,
      );

      // 9. If action proposal detected, enrich with guardrails via ActionPlanner
      if (aiResponse.type === 'action_proposal' && aiResponse.action) {
        if (!this.actionPlanner) {
          // Graceful degradation (IMP-006): convert to text when ActionPlanner unavailable
          aiResponse.type = 'text';
          aiResponse.action = undefined;
        } else {
          const agentGuardrails = this.parseAgentGuardrails(agent.guardrails);

          const proposalResult = this.actionPlanner.createProposal({
            type: aiResponse.action.type,
            entityType: aiResponse.action.entityType,
            fields: aiResponse.action.previewData,
            fieldConfidences: aiResponse.fieldConfidences ?? {},
            description: aiResponse.action.description,
            conversationId,
            agentId: agent.id,
            userId: request.context.userId,
            companyId: request.context.companyId,
            agentGuardrails,
          });

          if (!proposalResult.guardrailDecision.allowed) {
            // Guardrails blocked the action — convert to text explaining why
            aiResponse.type = 'text';
            aiResponse.content = proposalResult.guardrailDecision.reason;
            aiResponse.action = undefined;
            aiResponse.guardrailDecision = proposalResult.guardrailDecision;
          } else {
            // Enrich response with the staged proposal and guardrail metadata
            // Use ActionPlanner's weighted confidence (required fields get 2x weight)
            aiResponse.action = proposalResult.proposal;
            aiResponse.guardrailDecision = proposalResult.guardrailDecision;
            aiResponse.requiresApproval = proposalResult.requiresApproval;
            aiResponse.confidence = proposalResult.proposal.confidence;
          }
        }
      }

      // 10. Persist messages
      await this.persistMessage(conversationId, 'user', request.userMessage, {});

      await this.persistMessage(conversationId, 'assistant', aiResponse.content ?? '', {
        modelId: agent.modelId,
        inputTokens: gatewayResponse.usage.promptTokens,
        outputTokens: gatewayResponse.usage.completionTokens,
        latencyMs: gatewayResponse.latencyMs,
        confidence: aiResponse.confidence,
        toolCalls: gatewayResponse.toolCalls ?? undefined,
        promptVersionId: String(loaded.promptVersion),
      });

      return aiResponse;
    } catch (error) {
      return this.handleDegradation(error as Error, request);
    }
  }

  /**
   * Direct entry point for internal services that build their own prompts.
   * Bypasses agent resolution, prompt loading, and conversation persistence.
   * Used by PredictionService which constructs prompts programmatically.
   *
   * Routes through AI Gateway for quota enforcement and usage recording.
   * Never throws — returns AiResponse with type 'error' on failure (IMP-006).
   */
  async processDirect(params: {
    systemPrompt: string;
    userMessage: string;
    routingTags?: string[];
    context: AiRequestContext;
    intent: string;
  }): Promise<AiResponse> {
    try {
      const messages: Message[] = [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userMessage },
      ];

      const gatewayRequest: AiGatewayRequest = {
        tenantId: params.context.tenantId,
        userId: params.context.userId,
        featureKey: `ai.${params.intent}`,
        messages,
        routingTags: params.routingTags,
        stream: false,
      };

      const gatewayResponse = await this.aiGateway.complete(gatewayRequest);

      const aiResponse = this.responseParser.parse(gatewayResponse, params.intent);

      if (aiResponse.usage) {
        aiResponse.usage.latencyMs = gatewayResponse.latencyMs;
      }

      return aiResponse;
    } catch (error) {
      return this.handleDegradation(error as Error, {
        intent: params.intent,
        userMessage: params.userMessage,
        context: params.context,
      });
    }
  }

  /**
   * Streaming entry point — returns AsyncGenerator of chunks.
   * Routes through AiGateway.stream() for real-time token delivery.
   * Accumulates full response for persistence after stream ends.
   */
  async *processStream(request: AiRequest): AsyncGenerator<AiStreamChunk> {
    try {
      // 1. Resolve agent
      const agent = await this.resolveAgent(request);

      // 2. Load prompt
      const loaded = await this.promptManager.loadPrompt(agent.promptName);

      // 3. Resolve prompt parameters
      const resolved = await this.promptManager.resolveParameters(
        loaded.prompt,
        request.context,
        request.userMessage,
      );

      // 4. Load conversation history (verify tenant + user ownership)
      const conversationHistory = request.conversationId
        ? await this.loadConversationHistory(request.conversationId, agent, request.context.companyId, request.context.userId)
        : [];

      // 5. Build gateway request with stream: true
      const gatewayRequest = this.buildGatewayRequest(
        agent,
        resolved,
        request,
        conversationHistory,
      );
      gatewayRequest.stream = true;

      // 6. Stream from AI Gateway, accumulating content and tool calls for persistence
      const streamStartTime = Date.now();
      let accumulatedContent = '';
      let promptTokens = 0;
      let completionTokens = 0;
      let finishReason = 'stop';
      let lastToolCall: AiStreamChunk['toolCall'] = undefined;

      for await (const chunk of this.aiGateway.stream(gatewayRequest)) {
        // Map LLMStreamChunk to AiStreamChunk and yield
        if (chunk.type === 'content_delta') {
          accumulatedContent += chunk.content ?? '';
          yield { type: 'content_delta', content: chunk.content };
        } else if (chunk.type === 'tool_use_delta') {
          // Accumulate tool call for ActionPlanner processing after stream ends
          if (chunk.toolCall) {
            lastToolCall = chunk.toolCall as AiStreamChunk['toolCall'];
          }
          yield {
            type: 'tool_use_delta',
            toolCall: chunk.toolCall as AiStreamChunk['toolCall'],
          };
        } else if (chunk.type === 'usage' && chunk.usage) {
          promptTokens = chunk.usage.promptTokens ?? promptTokens;
          completionTokens = chunk.usage.completionTokens ?? completionTokens;
        } else if (chunk.type === 'done') {
          finishReason = chunk.finishReason ?? 'stop';
        }
      }

      // Yield done with accumulated usage (stream_end)
      const latencyMs = Date.now() - streamStartTime;
      yield {
        type: 'done',
        usage: { inputTokens: promptTokens, outputTokens: completionTokens, latencyMs },
        finishReason,
      };

      // 7. Persist messages after stream completes
      const conversationId = request.conversationId ?? await this.ensureConversation(
        request.context.userId,
        request.context.companyId,
        agent.id,
      );

      await this.persistMessage(conversationId, 'user', request.userMessage, {});

      await this.persistMessage(conversationId, 'assistant', accumulatedContent, {
        modelId: agent.modelId,
        inputTokens: promptTokens,
        outputTokens: completionTokens,
        latencyMs,
        promptVersionId: String(loaded.promptVersion),
      });

      // 8. After stream_end + persistence: emit action_proposal if tool calls were accumulated
      if (lastToolCall && this.actionPlanner) {
        const agentGuardrails = this.parseAgentGuardrails(agent.guardrails);
        const entityType = this.inferEntityTypeFromToolName(lastToolCall.name);

        const proposalResult = this.actionPlanner.createProposal({
          type: lastToolCall.name.toUpperCase(),
          entityType,
          fields: lastToolCall.input,
          fieldConfidences: {},
          description: `Execute ${lastToolCall.name.replace(/_/g, ' ')}`,
          conversationId,
          agentId: agent.id,
          userId: request.context.userId,
          companyId: request.context.companyId,
          agentGuardrails,
        });

        if (proposalResult.guardrailDecision.allowed) {
          // Emit action_proposal AFTER stream_end so user sees conversational response first
          yield {
            type: 'action_proposal' as const,
            action: proposalResult.proposal,
            guardrailDecision: proposalResult.guardrailDecision,
            requiresApproval: proposalResult.requiresApproval,
          };
        }
        // If blocked, don't emit — the conversational content already streamed
      }
    } catch (error) {
      // Graceful degradation — yield error chunk, never throw
      const degraded = this.handleDegradation(error as Error, request);
      yield {
        type: 'error',
        error: degraded.content ?? (error as Error).message,
      };
    }
  }

  // ─── Agent Resolution ──────────────────────────────────────────────────────

  /**
   * Resolve which agent to use from explicit name or intent matching.
   *
   * Priority:
   *   1. Explicit agentName → look up by name
   *   2. Intent keyword matching via triggerConfig.keywords
   *   3. Fallback to "chat-router" agent
   */
  private async resolveAgent(request: AiRequest): Promise<ResolvedAgent> {
    // 1. Explicit agent name
    if (request.agentName) {
      const agent = await this.db.aiAgent.findUnique({
        where: { name: request.agentName },
        include: { prompt: true, model: true },
      });

      if (!agent || !agent.isActive) {
        throw new AiAgentNotFoundError(
          `AI agent '${request.agentName}' not found or inactive`,
          'ai.error.agentNotFound',
          { agentName: request.agentName },
        );
      }

      return this.toResolvedAgent(agent);
    }

    // 2. Intent keyword matching
    const activeAgents = await this.db.aiAgent.findMany({
      where: { isActive: true },
      include: { prompt: true, model: true },
    });

    const messageLower = request.userMessage.toLowerCase();

    for (const agent of activeAgents) {
      const config = agent.triggerConfig as Record<string, unknown> | null;
      if (!config) continue;

      const keywords = config.keywords as string[] | undefined;
      if (keywords && Array.isArray(keywords)) {
        const matched = keywords.some((kw: string) =>
          messageLower.includes(kw.toLowerCase()),
        );
        if (matched) {
          return this.toResolvedAgent(agent);
        }
      }
    }

    // 3. Fallback to chat-router
    const fallback = await this.db.aiAgent.findUnique({
      where: { name: 'chat-router' },
      include: { prompt: true, model: true },
    });

    if (!fallback || !fallback.isActive) {
      throw new AiAgentNotFoundError(
        'Default chat-router agent not found or inactive',
        'ai.error.agentNotFound',
        { agentName: 'chat-router' },
      );
    }

    return this.toResolvedAgent(fallback);
  }

  /** Map DB agent record to a typed ResolvedAgent */
  private toResolvedAgent(agent: any): ResolvedAgent {
    return {
      id: agent.id,
      name: agent.name,
      promptName: agent.prompt.name,
      routingTags: agent.routingTags ?? [],
      modelId: agent.model?.id,
      modelName: agent.model?.name,
      maxInputTokens: agent.model?.maxInputTokens,
      tools: agent.tools as Tool[] | undefined,
      guardrails: agent.guardrails as Record<string, unknown> | undefined,
      maxTurns: agent.maxTurns ?? 10,
    };
  }

  // ─── Conversation History ──────────────────────────────────────────────────

  /**
   * Load conversation history for multi-turn.
   * Verifies that the conversation belongs to the requesting user + company
   * before loading messages to prevent cross-tenant/cross-user data leakage.
   * Trims oldest messages if total estimated tokens exceed 80% of model's maxInputTokens.
   * Always keeps the most recent 2 user messages.
   */
  private async loadConversationHistory(
    conversationId: string,
    agent: ResolvedAgent,
    companyId: string,
    userId: string,
  ): Promise<Message[]> {
    // Verify conversation belongs to the requesting user + company (tenant + user isolation)
    const conversation = await this.db.aiConversation.findFirst({
      where: { id: conversationId, companyId, userId },
      select: { id: true },
    });

    if (!conversation) {
      this.logger.warn(
        { conversationId, companyId, userId },
        'Conversation not found or does not belong to user/company',
      );
      return [];
    }

    const messages = await this.db.aiMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: DEFAULT_HISTORY_LIMIT,
    });

    if (!messages || messages.length === 0) return [];

    // Convert to Message[] format
    let history: Message[] = messages.map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Apply token limit trimming
    if (agent.maxInputTokens) {
      history = this.trimHistoryByTokens(history, agent.maxInputTokens);
    }

    return history;
  }

  /**
   * Trim conversation history to fit within token budget.
   * Removes oldest messages first, always keeping the most recent 2 user messages.
   */
  private trimHistoryByTokens(history: Message[], maxInputTokens: number): Message[] {
    const budget = Math.floor(maxInputTokens * TOKEN_BUDGET_RATIO);

    const estimateTokens = (msgs: Message[]): number => {
      return msgs.reduce((total, m) => {
        const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        return total + Math.ceil(content.length / CHARS_PER_TOKEN);
      }, 0);
    };

    let totalTokens = estimateTokens(history);

    if (totalTokens <= budget) return history;

    // Find indices of the last 2 user messages in the original array (must be preserved)
    const protectedIndices = new Set<number>();
    let userCount = 0;
    for (let i = history.length - 1; i >= 0 && userCount < 2; i--) {
      if (history[i]!.role === 'user') {
        protectedIndices.add(i);
        userCount++;
      }
    }

    // Remove messages from the front until within budget
    const result: Message[] = [];
    let skipped = 0;

    for (let i = 0; i < history.length; i++) {
      if (totalTokens > budget && !protectedIndices.has(i)) {
        // Skip this message
        const content = typeof history[i]!.content === 'string'
          ? history[i]!.content
          : JSON.stringify(history[i]!.content);
        totalTokens -= Math.ceil((content as string).length / CHARS_PER_TOKEN);
        skipped++;
      } else {
        result.push(history[i]!);
      }
    }

    if (skipped > 0) {
      this.logger.info(
        { original: history.length, kept: result.length, budgetTokens: budget },
        'Trimmed conversation history to fit token budget',
      );
    }

    return result;
  }

  // ─── Gateway Request Building ──────────────────────────────────────────────

  /**
   * Build the AI Gateway request from resolved agent + prompt.
   */
  private buildGatewayRequest(
    agent: ResolvedAgent,
    resolvedPrompt: { systemPrompt: string; userPrompt: string },
    request: AiRequest,
    conversationHistory: Message[],
  ): AiGatewayRequest {
    const messages: Message[] = [
      { role: 'system', content: resolvedPrompt.systemPrompt },
      ...conversationHistory,
      { role: 'user', content: resolvedPrompt.userPrompt },
    ];

    return {
      tenantId: request.context.tenantId,
      userId: request.context.userId,
      featureKey: `ai.${request.intent}`,
      messages,
      tools: agent.tools,
      routingTags: request.routingTags ?? agent.routingTags,
      modelName: agent.modelName,
      stream: false,
    };
  }

  // ─── Message Persistence ───────────────────────────────────────────────────

  /**
   * Ensure a conversation exists, reusing an active one or creating a new one.
   * Prevents unbounded conversation growth for anonymous (no conversationId) requests.
   */
  private async ensureConversation(
    userId: string,
    companyId: string,
    agentId?: string,
  ): Promise<string> {
    // Reuse the most recent active conversation for this user+company+agent
    const existing = await this.db.aiConversation.findFirst({
      where: { userId, companyId, agentId: agentId ?? null, status: 'active' },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    });

    if (existing) return existing.id;

    const conversation = await this.db.aiConversation.create({
      data: {
        id: randomUUID(),
        userId,
        companyId,
        agentId: agentId ?? null,
        channel: 'web',
        status: 'active',
        startedAt: new Date(),
      },
    });
    return conversation.id;
  }

  /**
   * Persist a message to the AiMessage table.
   */
  private async persistMessage(
    conversationId: string,
    role: string,
    content: string,
    metadata: {
      modelId?: string;
      inputTokens?: number;
      outputTokens?: number;
      latencyMs?: number;
      confidence?: number;
      toolCalls?: unknown;
      promptVersionId?: string;
    },
  ): Promise<void> {
    await this.db.aiMessage.create({
      data: {
        id: randomUUID(),
        conversationId,
        role,
        content,
        modelId: metadata.modelId ?? null,
        inputTokens: metadata.inputTokens ?? null,
        outputTokens: metadata.outputTokens ?? null,
        latencyMs: metadata.latencyMs ?? null,
        confidence: metadata.confidence != null ? metadata.confidence : null,
        toolCalls: (metadata.toolCalls ?? null) as any,
        promptVersionId: metadata.promptVersionId ?? null,
      },
    });
  }

  // ─── Graceful Degradation ──────────────────────────────────────────────────

  /**
   * Handle errors gracefully — never throw from process().
   * Returns an AiResponse with type 'error' and appropriate error info.
   * Emits 'ai.degraded' event for provider failures.
   *
   * IMP-006 (HARD): AI degradation must not break traditional UI.
   */
  private handleDegradation(error: Error, request: AiRequest): AiResponse {
    const messageId = randomUUID();

    // Quota exceeded — ISSUE #7 FIX: include errorCode for structured detection
    if (error instanceof AiQuotaExceededError) {
      this.logger.warn(
        { error: error.message, userId: request.context.userId },
        'AI request blocked by quota',
      );

      return {
        type: 'error',
        messageId,
        errorCode: 'AI_QUOTA_EXCEEDED',
        content: 'AI usage quota exceeded. Please try again later or contact your administrator.',
      };
    }

    // Provider unavailable (primary + fallback both failed)
    if (error instanceof ProviderUnavailableError) {
      this.logger.warn(
        { error: error.message, userId: request.context.userId },
        'AI provider unavailable',
      );

      this.eventBus.emit('ai.degraded', {
        errorCode: 'PROVIDER_UNAVAILABLE',
        errorMessage: error.message,
        userId: request.context.userId,
        tenantId: request.context.tenantId,
        intent: request.intent,
      });

      return {
        type: 'error',
        messageId,
        errorCode: 'AI_DEGRADED',
        content: 'AI service is temporarily unavailable. Please use the traditional interface or try again later.',
      };
    }

    // Provider error (single provider failure)
    if (error instanceof ProviderError) {
      this.logger.warn(
        { error: error.message, provider: error.provider, userId: request.context.userId },
        'AI provider error',
      );

      this.eventBus.emit('ai.degraded', {
        errorCode: 'PROVIDER_ERROR',
        errorMessage: error.message,
        userId: request.context.userId,
        tenantId: request.context.tenantId,
        intent: request.intent,
      });

      return {
        type: 'error',
        messageId,
        errorCode: 'AI_DEGRADED',
        content: 'AI service encountered an error. Please try again later.',
      };
    }

    // Agent/prompt not found errors
    if (error instanceof AiAgentNotFoundError) {
      this.logger.warn(
        { error: error.message },
        'AI agent not found',
      );

      return {
        type: 'error',
        messageId,
        errorCode: 'AI_AGENT_NOT_FOUND',
        content: 'The requested AI agent is not available.',
      };
    }

    // Generic/unexpected error
    this.logger.error(
      { error: error.message, stack: error.stack, userId: request.context.userId },
      'Unexpected AI service error',
    );

    this.eventBus.emit('ai.degraded', {
      errorCode: 'AI_SERVICE_ERROR',
      errorMessage: error.message,
      userId: request.context.userId,
      tenantId: request.context.tenantId,
      intent: request.intent,
    });

    return {
      type: 'error',
      messageId,
      errorCode: 'AI_SERVICE_ERROR',
      content: 'An unexpected error occurred with the AI service. Please try again.',
    };
  }

  // ─── Agent Guardrails Parsing ─────────────────────────────────────────────

  /**
   * Parse raw agent guardrails JSON into typed AgentGuardrails.
   * Defaults to restrictive settings (requiresApproval: true) when data is missing.
   */
  private parseAgentGuardrails(raw?: Record<string, unknown>): AgentGuardrails {
    if (!raw) {
      return {
        canRead: [],
        canWrite: [],
        requiresApproval: true,
        blockedOperations: [],
        dataScope: 'own',
      };
    }

    return {
      canRead: Array.isArray(raw.canRead) ? raw.canRead as string[] : [],
      canWrite: Array.isArray(raw.canWrite) ? raw.canWrite as string[] : [],
      requiresApproval: typeof raw.requiresApproval === 'boolean' ? raw.requiresApproval : true,
      maxAmountWithoutApproval: typeof raw.maxAmountWithoutApproval === 'string' ? raw.maxAmountWithoutApproval : undefined,
      blockedOperations: Array.isArray(raw.blockedOperations) ? raw.blockedOperations as string[] : [],
      dataScope: (raw.dataScope === 'own' || raw.dataScope === 'module' || raw.dataScope === 'all') ? raw.dataScope : 'own',
    };
  }

  /**
   * Infer entity type from a tool call name.
   * e.g., 'create_bank_transaction' → 'BankTransaction'
   */
  private inferEntityTypeFromToolName(toolName: string): string {
    const parts = toolName.split('_');
    if (parts.length >= 2) {
      return parts
        .slice(1)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join('');
    }
    return toolName.charAt(0).toUpperCase() + toolName.slice(1);
  }
}

// ─── Internal Types ────────────────────────────────────────────────────────

/** Resolved agent with included prompt/model data */
interface ResolvedAgent {
  id: string;
  name: string;
  promptName: string;
  routingTags: string[];
  modelId?: string;
  modelName?: string;
  maxInputTokens?: number;
  tools?: Tool[];
  guardrails?: Record<string, unknown>;
  maxTurns: number;
}
