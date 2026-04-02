import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@nexa/db';
import type { Logger } from 'pino';
import type Redis from 'ioredis';
import type { AiGateway } from '@nexa/ai-gateway';
import type {
  AiGatewayRequest,
  Message,
  Tool,
  ToolUseBlock,
  ToolResultBlock,
} from '@nexa/ai-gateway';
import { AiQuotaExceededError, ProviderUnavailableError, ProviderError } from '@nexa/ai-gateway';
import type { EventBus } from '../core/events/event-bus.js';
import type { PromptManager } from './prompt-manager.js';
import type { ResponseParser } from './response-parser.js';
import type { ActionPlanner } from './action-planner.js';
import type { MemoryInjectionService } from './memory-injection.service.js';
import type { DynamicContextService } from './dynamic-context.service.js';
import type { PatternDetectionService } from './pattern-detection.service.js';
import type { MemoryParserService } from './memory-parser.service.js';
import type { MemoryCitationService } from './memory-citation.service.js';
import type { QueryExecutor } from './query-executor.js';
import type { ToolRegistry } from '@nexa/ai-tools';
import type {
  PreCompactionService,
  AiMessage as PreCompactionMessage,
} from './pre-compaction.service.js';
import type { MemoryRecord } from './memory.service.js';
import type { PromptRenderer } from './prompt-renderer.js';
import type { VariableResolutionContext } from './automation/variable-resolver.js';
import type {
  AgentGuardrails,
  AiRequest,
  AiRequestContext,
  AiResponse,
  AiStreamChunk,
  EntityMentionRef,
} from './ai.types.js';
import { AiAgentNotFoundError } from './ai.errors.js';
import { buildPageListContext } from './mcp/page-registry.js';

/** Default number of conversation history messages to load */
const DEFAULT_HISTORY_LIMIT = 50;

/** Token estimation: ~4 chars per token (rough heuristic) */
const CHARS_PER_TOKEN = 4;

/** Keep 80% of maxInputTokens for history trimming */
const TOKEN_BUDGET_RATIO = 0.8;

export class AiOrchestrator {
  /** ActionPlanner for guardrail evaluation of action proposals (nullable for graceful degradation) */
  private actionPlanner: ActionPlanner | null = null;

  /** MemoryInjectionService for <user_context> assembly (nullable for graceful degradation) */
  private memoryInjection: MemoryInjectionService | null = null;

  /** DynamicContextService for skill-aware context assembly (nullable for graceful degradation) */
  private dynamicContext: DynamicContextService | null = null;

  /** PatternDetectionService for implicit learning from user actions (nullable for graceful degradation) */
  private patternDetection: PatternDetectionService | null = null;

  /** MemoryParserService for detecting explicit memory intents in user messages (nullable for graceful degradation) */
  private memoryParser: MemoryParserService | null = null;

  /** MemoryCitationService for citation tracking after AI responses (nullable for graceful degradation, E5b-3 Task 3) */
  private memoryCitation: MemoryCitationService | null = null;

  /** PreCompactionService for extracting facts before context trimming (nullable for graceful degradation, E5b-3 Task 7) */
  private preCompaction: PreCompactionService | null = null;

  /** PromptRenderer for resolving AiPromptVariable-based variables in prompts (nullable for graceful degradation, E5c-2 Task 8) */
  private promptRenderer: PromptRenderer | null = null;

  /** QueryExecutor for executing READ tool calls in the streaming tool loop (nullable for graceful degradation) */
  private queryExecutor: QueryExecutor | null = null;

  /** ToolRegistry for resolving all available tools as gateway Tool[] (nullable for graceful degradation) */
  private toolRegistry: ToolRegistry | null = null;

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

  /** Set the MemoryInjectionService instance (called during plugin initialization) */
  setMemoryInjection(service: MemoryInjectionService): void {
    this.memoryInjection = service;
  }

  /** Set the DynamicContextService instance (called during plugin initialization) */
  setDynamicContext(service: DynamicContextService): void {
    this.dynamicContext = service;
  }

  /** Set the PatternDetectionService instance (called during plugin initialization, E5b-3) */
  setPatternDetection(service: PatternDetectionService): void {
    this.patternDetection = service;
  }

  /** Set the MemoryParserService instance (called during plugin initialization, E5b-3 Task 2) */
  setMemoryParser(service: MemoryParserService): void {
    this.memoryParser = service;
  }

  /** Set the MemoryCitationService instance (called during plugin initialization, E5b-3 Task 3) */
  setMemoryCitation(service: MemoryCitationService): void {
    this.memoryCitation = service;
  }

  /** Set the PreCompactionService instance (called during plugin initialization, E5b-3 Task 7) */
  setPreCompaction(service: PreCompactionService): void {
    this.preCompaction = service;
  }

  /** Set the PromptRenderer instance for AiPromptVariable resolution (called during plugin initialization, E5c-2 Task 8) */
  setPromptRenderer(renderer: PromptRenderer): void {
    this.promptRenderer = renderer;
  }

  /** Set the QueryExecutor instance (called during plugin initialization) */
  setQueryExecutor(executor: QueryExecutor): void {
    this.queryExecutor = executor;
  }

  /** Set the ToolRegistry instance for resolving all available tools (called during plugin initialization) */
  setToolRegistry(registry: ToolRegistry): void {
    this.toolRegistry = registry;
  }

  /**
   * Get all registered tools as AI Gateway Tool[] for inclusion in LLM requests.
   * Always includes MCP global tools + module-specific tools.
   */
  private getAllGatewayTools(): Tool[] {
    if (!this.toolRegistry) return [];
    return this.toolRegistry.getDefinitions().map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as unknown as Record<string, unknown>,
    }));
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

      // 3a. Resolve AiPromptVariable-based variables via PromptRenderer (E5c-2 Task 8)
      const varResolved = await this.resolvePromptVariables(
        loaded.promptId,
        resolved.systemPrompt,
        resolved.userPrompt,
        request.context,
      );
      resolved.systemPrompt = varResolved.systemPrompt;
      resolved.userPrompt = varResolved.userPrompt;

      // 3b. Dynamic context assembly OR basic memory injection
      let dynamicTools: Tool[] | undefined;
      if (this.dynamicContext) {
        // Skill-aware context assembly (includes memories, skills, knowledge, permissions, screen)
        const assembled = await this.dynamicContext.assembleInteractive({
          userId: request.context.userId,
          companyId: request.context.companyId,
          userMessage: request.userMessage,
          screenContext: request.context.currentPage
            ? {
                url: request.context.currentPage,
                entityType: request.context.currentEntityType,
                entityId: request.context.currentEntityId,
              }
            : undefined,
          basePrompt: resolved.systemPrompt,
        });

        resolved.systemPrompt = assembled.systemPrompt;
        dynamicTools = assembled.tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema as unknown as Record<string, unknown>,
        }));

        this.logger.info(
          {
            skillChain: assembled.skillChain,
            tokenBreakdown: assembled.tokenBreakdown,
            toolCount: dynamicTools.length,
          },
          'Dynamic context assembled for process()',
        );

        // Record skill activations for pattern detection (E5b-3 Task 1.4)
        if (
          this.patternDetection &&
          assembled.skillChain.l2Activated &&
          assembled.skillChain.l1Skill
        ) {
          try {
            this.patternDetection.recordAction(request.context.userId, request.context.companyId, {
              actionType: 'skill_activation',
              entityType: assembled.skillChain.l1Skill,
              metadata: { module: assembled.skillChain.l0Module },
            });
          } catch {
            // Silent — pattern detection failures must not break the AI flow
          }
        }
      } else {
        // Fallback: basic memory injection only (E5b-1 behaviour)
        resolved.systemPrompt = await this.injectMemoryContext(
          resolved.systemPrompt,
          request.context.userId,
          request.context.companyId,
          [request.userMessage],
        );
      }

      // 3c. Memory intent detection (E5b-3 Task 2.3)
      // Check for explicit memory instructions before calling the AI Gateway
      let memoryConfirmation: string | null = null;
      if (this.memoryParser) {
        try {
          const intent = this.memoryParser.parseForMemoryIntent(request.userMessage, '');
          if (intent) {
            const result = await this.memoryParser.processMemoryIntent(
              request.context.userId,
              request.context.companyId,
              intent,
            );

            if (result.message) {
              // Build a confirmation instruction for the AI to relay naturally
              memoryConfirmation = this.buildMemoryConfirmation(intent.type, result.message);
            }
          }
        } catch (error) {
          // Silent — memory parsing failures must not break the AI flow (IMP-006)
          this.logger.warn(
            { error: (error as Error).message, userId: request.context.userId },
            'Memory intent parsing failed, proceeding without memory processing',
          );
        }
      }

      // Inject memory confirmation into system prompt so AI can acknowledge it
      if (memoryConfirmation) {
        resolved.systemPrompt += `\n\n<memory_update>\n${memoryConfirmation}\n</memory_update>`;
      }

      // 3d. Entity mention processing (E5b-7 Task 10.1)
      // Append structured entity references to the user prompt so the AI sees exact IDs
      resolved.userPrompt = this.formatEntityMentions(resolved.userPrompt, request.entityMentions);

      // 3e. Inject available pages context so the LLM knows what it can navigate to
      resolved.systemPrompt += '\n\n' + buildPageListContext();

      // 4. Load conversation history (verify tenant + user ownership)
      const conversationHistory = request.conversationId
        ? await this.loadConversationHistory(
            request.conversationId,
            agent,
            request.context.companyId,
            request.context.userId,
          )
        : [];

      // 5. Build gateway request
      const gatewayRequest = this.buildGatewayRequest(
        agent,
        resolved,
        request,
        conversationHistory,
      );

      // Set tools: prefer dynamic skill-specific tools, fall back to all registered tools
      if (dynamicTools && dynamicTools.length > 0) {
        gatewayRequest.tools = dynamicTools;
      } else {
        const allTools = this.getAllGatewayTools();
        if (allTools.length > 0) {
          gatewayRequest.tools = allTools;
        }
      }

      // 6. Call AI Gateway
      const gatewayResponse = await this.aiGateway.complete(gatewayRequest);

      // 7. Parse response
      const aiResponse = this.responseParser.parse(gatewayResponse, request.intent);

      // Set latency from gateway response
      if (aiResponse.usage) {
        aiResponse.usage.latencyMs = gatewayResponse.latencyMs;
      }

      // 8. Ensure conversation exists (needed before ActionPlanner for conversationId)
      const conversationId =
        request.conversationId ??
        (await this.ensureConversation(
          request.context.userId,
          request.context.companyId,
          agent.id,
        ));

      // 8b. Emit entity mention resolved event (E5b-7 Task 10.2)
      if (request.entityMentions && request.entityMentions.length > 0) {
        this.emitEntityMentionResolved(
          conversationId,
          request.context.userId,
          request.context.companyId,
          request.entityMentions,
        );
      }

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

      // 9b. Record tool call action for pattern detection (E5b-3 Task 1.4)
      if (gatewayResponse.toolCalls && this.patternDetection) {
        try {
          for (const tc of gatewayResponse.toolCalls as Array<{ name: string; input?: unknown }>) {
            const entityType = this.inferEntityTypeFromToolName(tc.name);
            this.patternDetection.recordAction(request.context.userId, request.context.companyId, {
              actionType: tc.name,
              entityType,
              metadata: tc.input as Record<string, unknown> | undefined,
            });
          }
        } catch {
          // Silent — pattern detection failures must not break the AI flow (IMP-006)
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

      // 11. Citation tracking — detect which injected memories were cited in the response (E5b-3 Task 3.2)
      if (this.memoryCitation && aiResponse.content) {
        this.trackCitedMemories(
          request.context.userId,
          request.context.companyId,
          aiResponse.content,
        ).catch(() => {
          // Fire-and-forget — citation tracking failures are silent (IMP-006)
        });
      }

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
    /** Optional: module key for AUTONOMOUS context assembly */
    moduleKey?: string;
    /** Optional: skill name for AUTONOMOUS context assembly */
    skillName?: string;
    /** Optional: input data for AUTONOMOUS context assembly */
    inputData?: Record<string, unknown>;
  }): Promise<AiResponse> {
    try {
      let finalSystemPrompt = params.systemPrompt;
      let autonomousTools: Tool[] | undefined;

      // Apply AUTONOMOUS context assembly when DynamicContextService is available and moduleKey is provided
      if (this.dynamicContext && params.moduleKey) {
        const assembled = await this.dynamicContext.assembleAutonomous({
          moduleKey: params.moduleKey,
          skillName: params.skillName,
          inputData: params.inputData ?? {},
          basePrompt: params.systemPrompt,
        });

        finalSystemPrompt = assembled.systemPrompt;
        autonomousTools = assembled.tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema as unknown as Record<string, unknown>,
        }));

        this.logger.info(
          {
            skillChain: assembled.skillChain,
            tokenBreakdown: assembled.tokenBreakdown,
            toolCount: autonomousTools.length,
          },
          'Dynamic context assembled for processDirect() (AUTONOMOUS)',
        );
      }

      const messages: Message[] = [
        { role: 'system', content: finalSystemPrompt },
        { role: 'user', content: params.userMessage },
      ];

      const gatewayRequest: AiGatewayRequest = {
        tenantId: params.context.tenantId,
        userId: params.context.userId,
        featureKey: `ai.${params.intent}`,
        messages,
        routingTags: params.routingTags,
        tools: autonomousTools && autonomousTools.length > 0 ? autonomousTools : undefined,
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

      // 3a. Resolve AiPromptVariable-based variables via PromptRenderer (E5c-2 Task 8)
      const streamVarResolved = await this.resolvePromptVariables(
        loaded.promptId,
        resolved.systemPrompt,
        resolved.userPrompt,
        request.context,
      );
      resolved.systemPrompt = streamVarResolved.systemPrompt;
      resolved.userPrompt = streamVarResolved.userPrompt;

      // 3b. Dynamic context assembly OR basic memory injection
      let dynamicStreamTools: Tool[] | undefined;
      if (this.dynamicContext) {
        const assembled = await this.dynamicContext.assembleInteractive({
          userId: request.context.userId,
          companyId: request.context.companyId,
          userMessage: request.userMessage,
          screenContext: request.context.currentPage
            ? {
                url: request.context.currentPage,
                entityType: request.context.currentEntityType,
                entityId: request.context.currentEntityId,
              }
            : undefined,
          basePrompt: resolved.systemPrompt,
        });

        resolved.systemPrompt = assembled.systemPrompt;
        dynamicStreamTools = assembled.tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema as unknown as Record<string, unknown>,
        }));

        this.logger.info(
          {
            skillChain: assembled.skillChain,
            tokenBreakdown: assembled.tokenBreakdown,
            toolCount: dynamicStreamTools.length,
          },
          'Dynamic context assembled for processStream()',
        );

        // Record skill activations for pattern detection (E5b-3 Task 1.4)
        if (
          this.patternDetection &&
          assembled.skillChain.l2Activated &&
          assembled.skillChain.l1Skill
        ) {
          try {
            this.patternDetection.recordAction(request.context.userId, request.context.companyId, {
              actionType: 'skill_activation',
              entityType: assembled.skillChain.l1Skill,
              metadata: { module: assembled.skillChain.l0Module },
            });
          } catch {
            // Silent — pattern detection failures must not break the AI flow
          }
        }
      } else {
        resolved.systemPrompt = await this.injectMemoryContext(
          resolved.systemPrompt,
          request.context.userId,
          request.context.companyId,
          [request.userMessage],
        );
      }

      // 3c. Memory intent detection for streaming (E5b-3 Task 2.3)
      let streamMemoryConfirmation: string | null = null;
      if (this.memoryParser) {
        try {
          const intent = this.memoryParser.parseForMemoryIntent(request.userMessage, '');
          if (intent) {
            const result = await this.memoryParser.processMemoryIntent(
              request.context.userId,
              request.context.companyId,
              intent,
            );

            if (result.message) {
              streamMemoryConfirmation = this.buildMemoryConfirmation(intent.type, result.message);
            }
          }
        } catch {
          // Silent — memory parsing failures must not break the AI flow (IMP-006)
        }
      }

      if (streamMemoryConfirmation) {
        resolved.systemPrompt += `\n\n<memory_update>\n${streamMemoryConfirmation}\n</memory_update>`;
      }

      // 3d. Entity mention processing (E5b-7 Task 10.1)
      // Append structured entity references to the user prompt so the AI sees exact IDs
      resolved.userPrompt = this.formatEntityMentions(resolved.userPrompt, request.entityMentions);

      // 3e. Inject available pages context so the LLM knows what it can navigate to
      resolved.systemPrompt += '\n\n' + buildPageListContext();

      // 4. Load conversation history (verify tenant + user ownership)
      const conversationHistory = request.conversationId
        ? await this.loadConversationHistory(
            request.conversationId,
            agent,
            request.context.companyId,
            request.context.userId,
          )
        : [];

      // 5. Build gateway request with stream: true
      const gatewayRequest = this.buildGatewayRequest(
        agent,
        resolved,
        request,
        conversationHistory,
      );
      gatewayRequest.stream = true;

      // Set tools: prefer dynamic skill-specific tools, fall back to all registered tools
      if (dynamicStreamTools && dynamicStreamTools.length > 0) {
        gatewayRequest.tools = dynamicStreamTools;
      } else {
        // No skill activated — use all registered tools (MCP + finance + views)
        const allTools = this.getAllGatewayTools();
        if (allTools.length > 0) {
          gatewayRequest.tools = allTools;
        }
      }

      // 6. Stream from AI Gateway, accumulating content and tool calls for persistence
      const streamStartTime = Date.now();
      let accumulatedContent = '';
      let promptTokens = 0;
      let completionTokens = 0;
      let finishReason = 'stop';
      let lastToolCall: AiStreamChunk['toolCall'] = undefined;
      let accumulatedToolInput = '';
      let pendingNavigation: string | undefined;

      for await (const chunk of this.aiGateway.stream(gatewayRequest)) {
        // Map LLMStreamChunk to AiStreamChunk and yield
        if (chunk.type === 'content_delta') {
          accumulatedContent += chunk.content ?? '';
          yield { type: 'content_delta', content: chunk.content };
        } else if (chunk.type === 'tool_use_delta') {
          // Merge tool call deltas: id/name arrive first, input fragments follow
          if (chunk.toolCall) {
            if (!lastToolCall) {
              // Seed from first delta — id/name come in first, input accumulates later
              lastToolCall = {
                id: chunk.toolCall.id ?? '',
                name: chunk.toolCall.name ?? '',
                input: {},
              } as AiStreamChunk['toolCall'];
              accumulatedToolInput = '';
            } else {
              if (chunk.toolCall.id) lastToolCall.id = chunk.toolCall.id;
              if (chunk.toolCall.name) lastToolCall.name = chunk.toolCall.name;
            }
            // Accumulate incremental JSON input fragments
            if (chunk.toolCall.input !== undefined) {
              if (typeof chunk.toolCall.input === 'string') {
                accumulatedToolInput += chunk.toolCall.input;
              } else {
                accumulatedToolInput = JSON.stringify(chunk.toolCall.input);
              }
            }
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

      // Parse accumulated tool call input from streaming JSON fragments
      if (lastToolCall && accumulatedToolInput) {
        try {
          lastToolCall.input = JSON.parse(accumulatedToolInput);
        } catch {
          // If JSON parsing fails, keep as string — tool execution will handle it
          this.logger.warn(
            { toolName: lastToolCall.name, inputLength: accumulatedToolInput.length },
            'Failed to parse accumulated tool call input JSON',
          );
        }
      }

      // ── Tool Execution Loop ──────────────────────────────────────────────
      // When the LLM requests a query tool call (finishReason === 'tool_use'),
      // execute it and feed the result back for a final text response.
      // Action tools (finance_create_journal, etc.) skip this and go through
      // the action_proposal flow below.
      if (
        finishReason === 'tool_use' &&
        lastToolCall?.id &&
        lastToolCall?.name &&
        this.queryExecutor &&
        this.queryExecutor.hasHandler(lastToolCall.name)
      ) {
        const toolInput =
          typeof lastToolCall.input === 'object' && lastToolCall.input !== null
            ? (lastToolCall.input as Record<string, unknown>)
            : {};

        this.logger.info(
          {
            toolName: lastToolCall.name,
            toolId: lastToolCall.id,
            inputKeys: Object.keys(toolInput),
          },
          'Executing tool call from LLM',
        );

        // Execute the tool via QueryExecutor
        const toolResult = await this.queryExecutor.execute({
          toolName: lastToolCall.name,
          companyId: request.context.companyId,
          userId: request.context.userId,
          userRole: request.context.userRole ?? 'VIEWER',
          input: toolInput,
        });

        // Check for navigation intent in tool result
        if (toolResult.success && toolResult.data && typeof toolResult.data === 'object') {
          const resultData = toolResult.data as Record<string, unknown>;
          if (typeof resultData._navigateTo === 'string') {
            pendingNavigation = resultData._navigateTo;
          }
        }

        // Build tool result content for the second LLM call
        const toolResultContent = toolResult.success
          ? JSON.stringify(toolResult.data)
          : JSON.stringify({ error: toolResult.error?.message ?? 'Tool execution failed' });

        // Build messages for the follow-up LLM call:
        // [original messages..., assistant(tool_use), user(tool_result)]
        const followUpMessages: Message[] = [
          ...gatewayRequest.messages,
          {
            role: 'assistant' as const,
            content: [
              {
                type: 'tool_use' as const,
                id: lastToolCall.id,
                name: lastToolCall.name,
                input: toolInput,
              } satisfies ToolUseBlock,
            ],
          },
          {
            role: 'user' as const,
            content: [
              {
                type: 'tool_result' as const,
                toolUseId: lastToolCall.id,
                content: toolResultContent,
                isError: !toolResult.success,
              } satisfies ToolResultBlock,
            ],
          },
        ];

        const followUpRequest: AiGatewayRequest = {
          ...gatewayRequest,
          messages: followUpMessages,
          stream: true,
        };

        // Stream the second LLM response (final text answer)
        for await (const chunk of this.aiGateway.stream(followUpRequest)) {
          if (chunk.type === 'content_delta') {
            accumulatedContent += chunk.content ?? '';
            yield { type: 'content_delta', content: chunk.content };
          } else if (chunk.type === 'usage' && chunk.usage) {
            promptTokens += chunk.usage.promptTokens ?? 0;
            completionTokens += chunk.usage.completionTokens ?? 0;
          } else if (chunk.type === 'done') {
            finishReason = chunk.finishReason ?? 'stop';
          }
        }

        // Clear lastToolCall so we don't re-process it as an action proposal below
        lastToolCall = undefined;
      }

      // Yield done with accumulated usage (stream_end)
      const latencyMs = Date.now() - streamStartTime;
      yield {
        type: 'done',
        usage: { inputTokens: promptTokens, outputTokens: completionTokens, latencyMs },
        finishReason,
      };

      // 7. Persist messages after stream completes
      const conversationId =
        request.conversationId ??
        (await this.ensureConversation(
          request.context.userId,
          request.context.companyId,
          agent.id,
        ));

      // 7b. Emit entity mention resolved event (E5b-7 Task 10.2)
      if (request.entityMentions && request.entityMentions.length > 0) {
        this.emitEntityMentionResolved(
          conversationId,
          request.context.userId,
          request.context.companyId,
          request.entityMentions,
        );
      }

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

      // 8b. Emit navigate chunk if a query tool returned _navigateTo
      if (pendingNavigation) {
        yield {
          type: 'navigate' as const,
          route: pendingNavigation,
        };
      }

      // 9. Citation tracking for streamed response (E5b-3 Task 3.2)
      if (this.memoryCitation && accumulatedContent) {
        this.trackCitedMemories(
          request.context.userId,
          request.context.companyId,
          accumulatedContent,
        ).catch(() => {
          // Fire-and-forget — citation tracking failures are silent (IMP-006)
        });
      }

      // 10. Record action for pattern detection (E5b-3 Task 1.4)
      if (lastToolCall && this.patternDetection) {
        try {
          const entityType = this.inferEntityTypeFromToolName(lastToolCall.name);
          this.patternDetection.recordAction(request.context.userId, request.context.companyId, {
            actionType: lastToolCall.name,
            entityType,
            metadata: lastToolCall.input as Record<string, unknown> | undefined,
          });
        } catch {
          // Silent — pattern detection failures must not break the AI flow (IMP-006)
        }
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

  // ─── Memory Citation Tracking (E5b-3 Task 3.2) ────────────────────────────

  /**
   * Detect which injected memories were cited in the AI response
   * and update their lastAccessedAt. Fire-and-forget — never throws.
   *
   * Uses cached memories from MemoryInjectionService to avoid a redundant DB fetch.
   */
  private async trackCitedMemories(
    userId: string,
    companyId: string,
    aiResponseContent: string,
  ): Promise<void> {
    if (!this.memoryCitation) return;

    try {
      // Use cached memories from injection step instead of re-fetching from DB
      const memoryRecords: MemoryRecord[] = this.memoryInjection
        ? this.memoryInjection.getLastInjectedMemories(userId, companyId)
        : [];

      if (memoryRecords.length === 0) return;

      const citedIds = this.memoryCitation.detectCitedMemories(memoryRecords, aiResponseContent);
      if (citedIds.length > 0) {
        await this.memoryCitation.trackMemoryAccess(citedIds);
      }
    } catch (error) {
      this.logger.debug(
        { error: (error as Error).message, userId },
        'Citation tracking failed — non-critical, skipping',
      );
    }
  }

  // ─── Memory Injection (E5b-1) ──────────────────────────────────────────────

  /**
   * Prepend user memory context to the system prompt.
   * Graceful degradation: if injection fails, returns the original prompt unchanged.
   */
  private async injectMemoryContext(
    systemPrompt: string,
    userId: string,
    companyId: string,
    recentMessages?: string[],
  ): Promise<string> {
    if (!this.memoryInjection) return systemPrompt;

    try {
      const userContext = await this.memoryInjection.assembleUserContext(
        userId,
        companyId,
        recentMessages,
      );
      if (!userContext) return systemPrompt;
      return userContext + '\n\n' + systemPrompt;
    } catch (error) {
      this.logger.warn(
        { error: (error as Error).message, userId, companyId },
        'Memory injection failed, proceeding without user context',
      );
      return systemPrompt;
    }
  }

  // ─── Entity Mention Processing (E5b-7 Task 10) ────────────────────────────

  /**
   * Format entity mentions as a structured context block appended after the user message.
   * Enables the AI to use exact entity IDs when calling tools (no ambiguity).
   * Returns the original message unchanged if no mentions are present.
   */
  private formatEntityMentions(userMessage: string, mentions?: EntityMentionRef[]): string {
    if (!mentions || mentions.length === 0) return userMessage;

    const refs = mentions.map((m) => `${m.type} "${m.name}" (${m.id})`).join(', ');

    return `${userMessage}\n\n[Referenced entities: ${refs}]`;
  }

  /**
   * Emit ai.entityMention.resolved event when entity mentions are present.
   * Fire-and-forget — failures are logged but do not break the AI flow (IMP-006).
   */
  private emitEntityMentionResolved(
    conversationId: string,
    userId: string,
    companyId: string,
    mentions: EntityMentionRef[],
  ): void {
    try {
      this.eventBus.emit('ai.entityMention.resolved', {
        conversationId,
        userId,
        companyId,
        mentions: mentions.map((m) => ({ type: m.type, id: m.id, name: m.name })),
      });
    } catch {
      // Silent — entity mention event failures must not break the AI flow (IMP-006)
    }
  }

  // ─── Prompt Variable Resolution (E5c-2 Task 8) ─────────────────────────────

  /**
   * Resolve AiPromptVariable-based variables in already-resolved prompt templates.
   * Loads AiPromptVariables for the prompt and applies PromptRenderer's variable
   * resolution on top of the PromptManager's basic parameter resolution.
   *
   * Graceful degradation: if PromptRenderer is not available or resolution fails,
   * returns the original templates unchanged (IMP-006).
   */
  private async resolvePromptVariables(
    promptId: string,
    systemPrompt: string,
    userPrompt: string,
    context: AiRequestContext,
  ): Promise<{ systemPrompt: string; userPrompt: string }> {
    if (!this.promptRenderer) {
      return { systemPrompt, userPrompt };
    }

    try {
      // Load AiPromptVariables for this prompt
      const variables = await this.db.aiPromptVariable.findMany({
        where: { promptId },
      });

      if (variables.length === 0) {
        return { systemPrompt, userPrompt };
      }

      // Build VariableResolutionContext from the request context
      const varContext: VariableResolutionContext = {
        companyId: context.companyId,
        userId: context.userId,
        userName: context.userName,
        userRole: context.userRole,
        companyName: context.companyName,
        baseCurrency: context.baseCurrency,
        defaultCurrency: context.defaultCurrency,
        entityId: context.currentEntityId,
        entityType: context.currentEntityType,
        pageContext: context.pageContext,
        autonomous: false, // chat is always interactive mode
      };

      // Resolve variables in both templates
      const renderedSystem = await this.promptRenderer.renderTemplate(
        systemPrompt,
        variables,
        varContext,
      );
      const renderedUser = await this.promptRenderer.renderTemplate(
        userPrompt,
        variables,
        varContext,
      );

      this.logger.debug(
        { promptId, variableCount: variables.length },
        'AiPromptVariable resolution applied to prompt templates',
      );

      return { systemPrompt: renderedSystem, userPrompt: renderedUser };
    } catch (error) {
      this.logger.warn(
        { promptId, error: (error as Error).message },
        'AiPromptVariable resolution failed, using original templates',
      );
      return { systemPrompt, userPrompt };
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
        const matched = keywords.some((kw: string) => messageLower.includes(kw.toLowerCase()));
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

    // Apply token limit trimming with pre-compaction flush (E5b-3 Task 7.4)
    if (agent.maxInputTokens) {
      const trimmed = this.trimHistoryByTokens(history, agent.maxInputTokens);

      // If messages were trimmed and PreCompactionService is available,
      // extract facts from the trimmed messages before losing them
      if (trimmed.length < history.length && this.preCompaction) {
        // Identify which messages were removed (those in history but not in trimmed)
        const keptSet = new Set(trimmed);
        const removedMessages: PreCompactionMessage[] = history
          .filter((m) => !keptSet.has(m))
          .map((m) => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          }));

        if (removedMessages.length > 0) {
          // Await pre-compaction: AC #6 requires extraction BEFORE trimming completes.
          // Failures are caught and logged but do not block conversation loading.
          try {
            await this.preCompaction.extractAndFlush(userId, companyId, removedMessages);
          } catch (error) {
            this.logger.warn(
              {
                error: (error as Error).message,
                userId,
                companyId,
                removedCount: removedMessages.length,
              },
              'Pre-compaction flush failed — proceeding without memory extraction',
            );
          }
        }
      }

      history = trimmed;
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
        const content =
          typeof history[i]!.content === 'string'
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
        content:
          'AI service is temporarily unavailable. Please use the traditional interface or try again later.',
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
      this.logger.warn({ error: error.message }, 'AI agent not found');

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
      canRead: Array.isArray(raw.canRead) ? (raw.canRead as string[]) : [],
      canWrite: Array.isArray(raw.canWrite) ? (raw.canWrite as string[]) : [],
      requiresApproval: typeof raw.requiresApproval === 'boolean' ? raw.requiresApproval : true,
      maxAmountWithoutApproval:
        typeof raw.maxAmountWithoutApproval === 'string' ? raw.maxAmountWithoutApproval : undefined,
      blockedOperations: Array.isArray(raw.blockedOperations)
        ? (raw.blockedOperations as string[])
        : [],
      dataScope:
        raw.dataScope === 'own' || raw.dataScope === 'module' || raw.dataScope === 'all'
          ? raw.dataScope
          : 'own',
    };
  }

  // ─── Memory Confirmation (E5b-3 Task 2.3) ─────────────────────────────────

  /**
   * Build a natural-language confirmation instruction for the AI to acknowledge
   * a memory operation (create, correct, forget).
   */
  private buildMemoryConfirmation(_intentType: string, resultMessage: string): string {
    const [code, ...contentParts] = resultMessage.split(':');
    const content = contentParts.join(':');

    switch (code) {
      case 'MEMORY_CREATED':
        return `You just saved a new memory for the user: "${content}". Acknowledge this briefly (e.g., "I'll remember that...").`;
      case 'MEMORY_MERGED':
        return `A memory about "${content}" already existed and was updated with the new information. Acknowledge this briefly.`;
      case 'MEMORY_CORRECTED':
        return `You updated the user's previous preference/instruction to: "${content}". Acknowledge the correction briefly.`;
      case 'MEMORY_FORGOTTEN':
        return `You forgot the user's preference about: "${content}". Acknowledge this briefly (e.g., "I've forgotten...").`;
      case 'MEMORY_NOT_FOUND':
        return `The user asked to forget something about "${content}", but no matching memory was found. Let them know.`;
      case 'MEMORY_DISABLED':
        return 'The user asked you to remember something, but memory is disabled in their settings. Let them know they can enable it in settings.';
      case 'CATEGORY_DISABLED':
        return `The user asked you to remember something, but the ${content} memory category is disabled in their settings.`;
      default:
        return '';
    }
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
