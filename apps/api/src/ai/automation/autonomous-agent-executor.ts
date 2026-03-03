// ---------------------------------------------------------------------------
// AutonomousAgentExecutor — Multi-turn agent execution for AUTONOMOUS mode.
// Runs an AI agent with tool calls in a loop until completion or maxTurns.
// E5c-1 Task 4.4: AC #5, #11
// ---------------------------------------------------------------------------

import type { Logger } from 'pino';
import type {
  AiGateway,
  AiGatewayRequest,
  AiGatewayResponse,
  Message,
  Tool,
  ToolCall,
  ContentBlock,
  ToolResultBlock,
  ToolUseBlock,
} from '@nexa/ai-gateway';
import type { ToolRegistry } from '@nexa/ai-tools';
import type { DynamicContextService } from '../dynamic-context.service.js';
import type { QueryExecutor } from '../query-executor.js';
import type { ActionExecutor } from '../action-executor.js';
import type { AgentGuardrails, ActionProposal } from '../ai.types.js';
import { randomUUID } from 'node:crypto';
import { ToolParamValidator } from './param-validator.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AgentStepConfig {
  agentId: string;
  /** Agent's display name (for logging) */
  agentName: string;
  /** The goal/task for this step */
  goal: string;
  /** Resolved input data for this step */
  inputData: Record<string, unknown>;
  /** Agent's routing tags for model selection */
  routingTags: string[];
  /** Agent's system prompt */
  systemPrompt: string;
  /** Module key for AUTONOMOUS context assembly */
  moduleKey?: string;
  /** Skill name for AUTONOMOUS context assembly */
  skillName?: string;
  /** Maximum number of LLM turns (default 10) */
  maxTurns: number;
  /** Agent guardrails — controls which actions are allowed in autonomous mode */
  guardrails?: AgentGuardrails;
  /** Absolute deadline timestamp (ms since epoch). If set, the agent loop aborts when exceeded. */
  deadlineMs?: number;
}

export interface AgentExecutionContext {
  companyId: string;
  tenantId: string;
  userId: string;
  userRole: string;
}

export interface AgentExecutionResult {
  success: boolean;
  /** Structured output from the agent (final JSON or text content) */
  output: Record<string, unknown> | null;
  /** Error message if failed */
  error?: string;
  /** Error code for structured failure handling */
  errorCode?: string;
  /** Total input tokens consumed */
  inputTokens: number;
  /** Total output tokens consumed */
  outputTokens: number;
  /** Number of LLM turns executed */
  turns: number;
  /** Execution latency in ms */
  latencyMs: number;
  /** Model that was used */
  modelId?: string;
}

// ─── AutonomousAgentExecutor ─────────────────────────────────────────────

export class AutonomousAgentExecutor {
  private paramValidator = new ToolParamValidator();

  constructor(
    private aiGateway: AiGateway,
    private dynamicContext: DynamicContextService | null,
    private queryExecutor: QueryExecutor,
    private actionExecutor: ActionExecutor,
    private toolRegistry: ToolRegistry | null,
    private logger: Logger,
  ) {}

  /**
   * Execute an agent autonomously in a multi-turn loop.
   * The agent receives a goal + input data, executes tool calls,
   * and returns structured output when complete.
   */
  async execute(
    config: AgentStepConfig,
    context: AgentExecutionContext,
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let turns = 0;
    let modelId: string | undefined;

    try {
      // 1. Assemble AUTONOMOUS context (module knowledge + skill instructions + input)
      let finalSystemPrompt = config.systemPrompt;
      let autonomousTools: Tool[] = [];

      if (this.dynamicContext && config.moduleKey) {
        const assembled = await this.dynamicContext.assembleAutonomous({
          moduleKey: config.moduleKey,
          skillName: config.skillName,
          inputData: config.inputData,
          basePrompt: config.systemPrompt,
        });

        finalSystemPrompt = assembled.systemPrompt;
        autonomousTools = assembled.tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema as unknown as Record<string, unknown>,
        }));

        this.logger.info(
          {
            agentId: config.agentId,
            skillChain: assembled.skillChain,
            tokenBreakdown: assembled.tokenBreakdown,
            toolCount: autonomousTools.length,
          },
          'AUTONOMOUS context assembled for agent step',
        );
      }

      // 2. Build initial messages: system prompt + user message with goal + input
      const userMessage = this.buildUserMessage(config.goal, config.inputData);

      const messages: Message[] = [
        { role: 'system', content: finalSystemPrompt },
        { role: 'user', content: userMessage },
      ];

      // 3. Multi-turn execution loop
      while (turns < config.maxTurns) {
        // Check deadline before each turn
        if (config.deadlineMs && Date.now() >= config.deadlineMs) {
          this.logger.warn(
            { agentId: config.agentId, turns },
            'Agent step aborted — automation duration budget exceeded',
          );

          return {
            success: false,
            output: null,
            error: 'DURATION_BUDGET_EXCEEDED',
            errorCode: 'DURATION_BUDGET_EXCEEDED',
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            turns,
            latencyMs: Date.now() - startTime,
            modelId,
          };
        }

        turns++;

        const gatewayRequest: AiGatewayRequest = {
          tenantId: context.tenantId,
          userId: context.userId,
          featureKey: `ai.automation.step`,
          messages,
          tools: autonomousTools.length > 0 ? autonomousTools : undefined,
          routingTags: config.routingTags,
          stream: false,
        };

        const response = await this.aiGateway.complete(gatewayRequest);

        // Track usage
        totalInputTokens += response.usage.promptTokens;
        totalOutputTokens += response.usage.completionTokens;
        if (!modelId) modelId = response.model;

        this.logger.debug(
          {
            agentId: config.agentId,
            turn: turns,
            finishReason: response.finishReason,
            toolCallCount: response.toolCalls?.length ?? 0,
            tokens: response.usage.totalTokens,
          },
          'Agent turn completed',
        );

        // 4. Check if the agent is done (no tool calls)
        if (response.finishReason !== 'tool_use' || !response.toolCalls?.length) {
          // Agent completed — extract structured output
          const output = this.extractOutput(response.content);

          return {
            success: true,
            output,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
            turns,
            latencyMs: Date.now() - startTime,
            modelId,
          };
        }

        // 5. Execute tool calls and build tool result messages
        const assistantContent = this.buildAssistantContent(response);
        messages.push({ role: 'assistant', content: assistantContent });

        const toolResults = await this.executeToolCalls(
          response.toolCalls,
          context,
          config.guardrails,
        );
        messages.push({ role: 'user', content: toolResults });
      }

      // maxTurns exceeded — extract whatever output we have from the last response
      this.logger.warn(
        { agentId: config.agentId, maxTurns: config.maxTurns },
        'Agent reached maxTurns without completing',
      );

      return {
        success: false,
        output: null,
        error: `Agent reached maxTurns (${config.maxTurns}) without completing`,
        errorCode: 'MAX_TURNS_EXCEEDED',
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        turns,
        latencyMs: Date.now() - startTime,
        modelId,
      };
    } catch (error) {
      const err = error as Error;

      this.logger.error(
        { agentId: config.agentId, error: err.message, turns },
        'Agent execution failed',
      );

      return {
        success: false,
        output: null,
        error: err.message,
        errorCode: (err as any).code ?? 'AGENT_EXECUTION_ERROR',
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        turns,
        latencyMs: Date.now() - startTime,
        modelId,
      };
    }
  }

  /** Build the user message with goal and structured input data */
  private buildUserMessage(goal: string, inputData: Record<string, unknown>): string {
    const parts: string[] = [`<goal>${goal}</goal>`];

    if (Object.keys(inputData).length > 0) {
      parts.push(`<input_data>${JSON.stringify(inputData, null, 2)}</input_data>`);
    }

    parts.push(
      '<instructions>',
      'Execute the goal using the provided tools. When complete, respond with a JSON object containing your results.',
      'If you cannot complete the goal, explain why in a JSON object with an "error" field.',
      'IMPORTANT: In AUTONOMOUS mode, you cannot ask the user for clarification. If you lack required information, fail with an explicit error.',
      '</instructions>',
    );

    return parts.join('\n\n');
  }

  /**
   * Build assistant content blocks from a gateway response (text + tool_use blocks).
   * Required for the multi-turn message format.
   */
  private buildAssistantContent(response: AiGatewayResponse): ContentBlock[] {
    const blocks: ContentBlock[] = [];

    // Add text content if present
    if (response.content) {
      blocks.push({ type: 'text', text: response.content });
    }

    // Add tool_use blocks
    if (response.toolCalls) {
      for (const tc of response.toolCalls) {
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: tc.input,
        } satisfies ToolUseBlock);
      }
    }

    return blocks;
  }

  /**
   * Execute tool calls and return tool_result content blocks.
   * In AUTONOMOUS mode, action writes are allowed only if the agent's guardrails
   * permit them (action in canWrite list, not in blockedOperations, and
   * requiresApproval is false). Actions that require approval are blocked.
   */
  private async executeToolCalls(
    toolCalls: ToolCall[],
    context: AgentExecutionContext,
    guardrails?: AgentGuardrails,
  ): Promise<ContentBlock[]> {
    const results: ToolResultBlock[] = [];

    for (const tc of toolCalls) {
      try {
        // Validate tool parameters in AUTONOMOUS mode (AC #12, #14, #15)
        const toolDef = this.toolRegistry?.getDefinition(tc.name);
        if (toolDef) {
          const validation = this.paramValidator.validate(tc, toolDef);
          if (!validation.valid) {
            const errorMsg = this.paramValidator.buildAutonomousError(validation.missingParams);
            this.logger.warn(
              { toolName: tc.name, missingParams: validation.missingParams },
              'AUTONOMOUS mode: tool call blocked — missing required parameters',
            );
            results.push({
              type: 'tool_result',
              toolUseId: tc.id,
              content: errorMsg,
              isError: true,
            });
            continue;
          }
        }

        // Determine if this is a query or action tool
        if (this.queryExecutor.hasHandler(tc.name)) {
          const result = await this.queryExecutor.execute({
            toolName: tc.name,
            companyId: context.companyId,
            userId: context.userId,
            userRole: context.userRole,
            input: tc.input,
          });

          if (result.success) {
            results.push({
              type: 'tool_result',
              toolUseId: tc.id,
              content: JSON.stringify(result.data),
            });
          } else {
            results.push({
              type: 'tool_result',
              toolUseId: tc.id,
              content: `Tool error: ${result.error?.message ?? 'Query execution failed'}`,
              isError: true,
            });
          }
        } else if (this.actionExecutor.hasHandler(tc.name)) {
          // Check guardrails to decide if this action is allowed in autonomous mode
          const actionAllowed = this.isActionAllowedAutonomous(tc.name, guardrails);

          if (!actionAllowed) {
            results.push({
              type: 'tool_result',
              toolUseId: tc.id,
              content: `AUTONOMOUS_MODE_WRITE_BLOCKED: Action '${tc.name}' requires user approval or is not in the agent's permitted write list. Use query tools to gather information instead.`,
              isError: true,
            });

            this.logger.warn(
              { toolName: tc.name, agentContext: 'AUTONOMOUS' },
              'Action tool blocked in AUTONOMOUS mode — not permitted by guardrails',
            );
          } else {
            // Action is allowed by guardrails — execute it via ActionExecutor
            const input = tc.input as Record<string, unknown>;
            const proposal: ActionProposal = {
              id: randomUUID(),
              type: tc.name,
              description: `Autonomous execution of ${tc.name}`,
              entityType: (input.entityType as string) ?? this.inferEntityType(tc.name),
              previewData: input,
              confidence: 1.0, // autonomous actions have full confidence
            };

            const result = await this.actionExecutor.execute({
              proposal,
              conversationId: `autonomous:${context.companyId}`,
              agentId: guardrails ? tc.name : 'unknown',
              userId: context.userId,
              companyId: context.companyId,
            });

            if (result.success) {
              results.push({
                type: 'tool_result',
                toolUseId: tc.id,
                content: JSON.stringify({
                  success: true,
                  entityId: result.entityId,
                  entityType: result.entityType,
                }),
              });
            } else {
              results.push({
                type: 'tool_result',
                toolUseId: tc.id,
                content: `Action error: ${result.error?.message ?? 'Action execution failed'}`,
                isError: true,
              });
            }
          }
        } else {
          results.push({
            type: 'tool_result',
            toolUseId: tc.id,
            content: `Unknown tool: ${tc.name}`,
            isError: true,
          });
        }
      } catch (error) {
        const err = error as Error;
        this.logger.error({ toolName: tc.name, error: err.message }, 'Tool execution failed');

        results.push({
          type: 'tool_result',
          toolUseId: tc.id,
          content: `Tool execution error: ${err.message}`,
          isError: true,
        });
      }
    }

    return results;
  }

  /**
   * Check whether a specific action is allowed to execute in autonomous mode
   * based on the agent's guardrails configuration.
   */
  private isActionAllowedAutonomous(actionName: string, guardrails?: AgentGuardrails): boolean {
    // No guardrails → default to blocking (safe default)
    if (!guardrails) return false;

    // Explicitly blocked → deny
    if (guardrails.blockedOperations.includes(actionName)) return false;

    // Agent requires approval for all actions → deny
    if (guardrails.requiresApproval) return false;

    // Action must be in the agent's canWrite list
    return guardrails.canWrite.includes(actionName);
  }

  /** Infer entity type from action name (e.g., CREATE_INVOICE → invoice) */
  private inferEntityType(actionName: string): string {
    // Strip common prefixes: CREATE_, UPDATE_, DELETE_, APPROVE_, SEND_
    const stripped = actionName.replace(/^(CREATE|UPDATE|DELETE|APPROVE|SEND|POST|VOID)_/i, '');
    return stripped.toLowerCase();
  }

  /**
   * Extract structured JSON output from the agent's final text response.
   * Attempts to parse JSON from the content, falls back to wrapping text.
   */
  private extractOutput(content: string): Record<string, unknown> | null {
    if (!content || content.trim().length === 0) {
      return null;
    }

    // Try to parse the entire content as JSON
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Not valid JSON — try extracting JSON from markdown code blocks
    }

    // Try extracting JSON from ```json ... ``` code blocks
    const jsonBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (jsonBlockMatch?.[1]) {
      try {
        const parsed = JSON.parse(jsonBlockMatch[1]);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // Not valid JSON in code block
      }
    }

    // Fall back to wrapping the text content
    return { content, type: 'text' };
  }
}
