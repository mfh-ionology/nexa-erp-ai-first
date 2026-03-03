// QueryExecutor — READ tool executor with RBAC, companyId scoping, and result truncation
// Mirrors ActionExecutor's registry pattern but is simpler: no guardrails, no transactions

import type { Logger } from 'pino';
import type { PrismaClient } from '@nexa/db';
import type { QueryToolHandler, ToolDefinition } from '@nexa/ai-tools';
import type { ToolRegistry } from '@nexa/ai-tools';
import type { EventBus } from '../core/events/event-bus.js';
import type { PermissionService } from '../core/rbac/permission.service.js';
import { ToolParamValidator } from './automation/param-validator.js';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Approximate characters per token for budget calculations */
const CHARS_PER_TOKEN = 4;

/** Default token budget for query results */
const DEFAULT_TOKEN_BUDGET = 2000;

// ─── Result Types ───────────────────────────────────────────────────────────

export interface QueryExecutionResult {
  success: boolean;
  data?: unknown;
  rowCount?: number;
  truncated?: boolean;
  latencyMs?: number;
  error?: {
    code: string;
    message: string;
  };
}

// ─── QueryExecutor ──────────────────────────────────────────────────────────

/**
 * Executes READ tool queries registered by business modules.
 * Uses a registry pattern — modules register their query handlers at startup.
 *
 * Key differences from ActionExecutor:
 * - No user confirmation required (reads are safe)
 * - No transaction wrapping (reads don't modify data)
 * - Result truncation to stay within token budgets
 * - RBAC checks via enabledModules (module-level access)
 */
export class QueryExecutor {
  constructor(
    private db: PrismaClient,
    private eventBus: EventBus,
    private permissionService: PermissionService,
    private toolRegistry: ToolRegistry,
    private logger: Logger,
  ) {}

  /**
   * Register a query tool definition and handler via the ToolRegistry.
   * Called by business module Fastify plugins during initialization.
   * This is the single registration point — both definition and handler
   * are stored in the ToolRegistry, avoiding duplicate registries.
   *
   * @example
   *   // In AR module plugin:
   *   queryExecutor.registerHandler('get_aging_report', agingReportDef, agingReportHandler);
   */
  registerHandler(toolName: string, handler: QueryToolHandler, definition?: ToolDefinition): void {
    // If a definition is provided, register the full tool in ToolRegistry
    if (definition) {
      this.toolRegistry.registerTool({
        definition: { ...definition, type: 'query' } as ToolDefinition & { type: 'query' },
        handler,
      });
    } else {
      // Legacy path: register handler-only for tools whose definition was already
      // registered separately. Update the handler via setQueryHandler.
      const existing = this.toolRegistry.getDefinition(toolName);
      if (existing) {
        this.toolRegistry.setQueryHandler(toolName, handler);
      } else {
        // No definition exists — register a minimal placeholder
        this.toolRegistry.registerTool({
          definition: {
            name: toolName,
            description: `Query tool: ${toolName}`,
            moduleKey: 'unknown',
            inputSchema: { type: 'object' as const, properties: {} },
            type: 'query' as const,
          },
          handler,
        });
      }
    }
    this.logger.info({ toolName: toolName.toLowerCase() }, 'Query handler registered');
  }

  /**
   * Execute a READ tool query through the registered handler.
   * Pipeline: lookup handler → RBAC check → execute → truncate → emit event
   */
  async execute(params: {
    toolName: string;
    companyId: string;
    userId: string;
    userRole: string;
    input: Record<string, unknown>;
    tokenBudget?: number;
  }): Promise<QueryExecutionResult> {
    const { toolName, companyId, userId, userRole, input, tokenBudget } = params;
    const budget = tokenBudget ?? DEFAULT_TOKEN_BUDGET;
    const startTime = Date.now();

    try {
      // 1. Look up registered handler and definition from ToolRegistry
      const handler = this.toolRegistry.getQueryHandler(toolName);
      if (!handler) {
        return {
          success: false,
          error: {
            code: 'TOOL_NOT_FOUND',
            message: `No query handler registered for tool: ${toolName}`,
          },
        };
      }

      // 2. Resolve moduleKey from ToolRegistry definition for RBAC
      const definition = this.toolRegistry.getDefinition(toolName);
      const moduleKey = definition?.moduleKey;

      // 3. Check RBAC permission — user must have access to the tool's module
      if (moduleKey) {
        const hasAccess = await this.checkModuleAccess(userId, companyId, userRole, moduleKey);
        if (!hasAccess) {
          return {
            success: false,
            error: {
              code: 'PERMISSION_DENIED',
              message: `User does not have read access to module: ${moduleKey}`,
            },
          };
        }
      }

      // 3b. Validate input against the tool's inputSchema (required + nested fields)
      if (definition) {
        const validator = new ToolParamValidator();
        const validation = validator.validate({ id: '', name: toolName, input }, definition);
        if (!validation.valid) {
          return {
            success: false,
            error: {
              code: 'INVALID_INPUT',
              message: validator.buildClarificationMessage(toolName, validation.missingParams),
            },
          };
        }
      }

      // 4. Execute the handler with companyId scoping
      const result = await handler({ companyId, userId, input });

      // 5. Truncate results if they exceed the token budget
      const { data, truncated } = this.truncateResult(result.data, budget);

      const latencyMs = Date.now() - startTime;

      // 6. Emit ai.tool.queryExecuted event (isolated so emit failure doesn't mask a successful query)
      try {
        this.eventBus.emit('ai.tool.queryExecuted', {
          toolName,
          moduleKey: moduleKey ?? 'unknown',
          userId,
          companyId,
          resultRowCount: result.rowCount ?? 0,
          latencyMs,
        });
      } catch (emitError) {
        this.logger.warn(
          { error: (emitError as Error).message, toolName },
          'Failed to emit queryExecuted event',
        );
      }

      // 7. Return result
      return {
        success: true,
        data,
        rowCount: result.rowCount,
        truncated: truncated || result.truncated,
        latencyMs,
      };
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      this.logger.error(
        {
          error: (error as Error).message,
          toolName,
          userId,
          companyId,
          latencyMs,
        },
        'Query execution failed',
      );

      return {
        success: false,
        latencyMs,
        error: {
          code: 'QUERY_EXECUTION_FAILED',
          // Sanitise: do not leak internal error details (Prisma errors, SQL, etc.)
          message: 'Query execution failed',
        },
      };
    }
  }

  /**
   * Check if user has module-level access via the permission service.
   * Uses getEffectivePermissions and checks enabledModules.
   */
  private async checkModuleAccess(
    userId: string,
    companyId: string,
    userRole: string,
    moduleKey: string,
  ): Promise<boolean> {
    try {
      const effective = await this.permissionService.getEffectivePermissions(
        this.db,
        userId,
        companyId,
        userRole,
      );
      // SUPER_ADMIN has all modules enabled
      if (effective.isSuperAdmin) return true;
      return effective.enabledModules.includes(moduleKey);
    } catch (error) {
      this.logger.error(
        { error: (error as Error).message, userId, companyId, moduleKey },
        'Permission check failed — denying access',
      );
      return false;
    }
  }

  /**
   * Truncate query results to stay within the token budget.
   * - Arrays: remove trailing items until within budget
   * - Strings: truncate with "..." suffix
   * - Objects: serialise and truncate the JSON string
   */
  private truncateResult(
    data: unknown,
    tokenBudget: number,
  ): { data: unknown; truncated: boolean } {
    const maxChars = tokenBudget * CHARS_PER_TOKEN;

    const serialised = JSON.stringify(data);
    if (serialised.length <= maxChars) {
      return { data, truncated: false };
    }

    // Array truncation: progressively remove items from the end
    if (Array.isArray(data)) {
      const items = [...data];
      while (items.length > 1) {
        items.pop();
        const check = JSON.stringify(items);
        if (check.length <= maxChars) {
          return { data: items, truncated: true };
        }
      }
      // Even one item is too large — truncate the serialised form
      const single = JSON.stringify(items);
      if (single.length > maxChars) {
        return {
          data: single.slice(0, maxChars - 3) + '...',
          truncated: true,
        };
      }
      return { data: items, truncated: true };
    }

    // String truncation
    if (typeof data === 'string') {
      return {
        data: data.slice(0, maxChars - 3) + '...',
        truncated: true,
      };
    }

    // Object/other: truncate the serialised JSON
    return {
      data: serialised.slice(0, maxChars - 3) + '...',
      truncated: true,
    };
  }

  /** Check if a handler is registered for a given tool name (for testing/monitoring) */
  hasHandler(toolName: string): boolean {
    return this.toolRegistry.getQueryHandler(toolName) !== undefined;
  }
}
