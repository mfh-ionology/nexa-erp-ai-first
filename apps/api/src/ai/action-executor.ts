import type { Logger } from 'pino';
import type { PrismaClient } from '@nexa/db';
import type { EventBus } from '../core/events/event-bus.js';
import type {
  ActionExecutionResult,
  ActionProposal,
  IActionExecutor,
} from './ai.types.js';

// ─── Action Handler Type ────────────────────────────────────────────────────

/**
 * Handler function registered by business modules (Finance, AR, AP, etc.)
 * to execute specific action types through the standard service layer.
 */
export type ActionHandler = (
  db: PrismaClient,
  companyId: string,
  userId: string,
  data: Record<string, unknown>,
) => Promise<{ entityId: string; displayRef: string }>;

// ─── Action Type → Audit Action Mapping ─────────────────────────────────────

/** Derive audit action from action type prefix — must return a valid AuditAction value */
function deriveAuditAction(actionType: string): string {
  const upper = actionType.toUpperCase();
  if (upper.startsWith('CREATE_')) return 'CREATE';
  if (upper.startsWith('UPDATE_')) return 'UPDATE';
  if (upper.startsWith('DELETE_')) return 'DELETE';
  if (upper.startsWith('POST_')) return 'POST';
  if (upper.startsWith('APPROVE_')) return 'APPROVE';
  if (upper.startsWith('VOID_')) return 'UPDATE';     // VOID is a status change — maps to UPDATE
  if (upper.startsWith('REVERSE_')) return 'UPDATE';   // REVERSE is a status change — maps to UPDATE
  if (upper.startsWith('RUN_')) return 'CREATE';
  if (upper.startsWith('DISPOSE_')) return 'DELETE';
  if (upper.startsWith('SEND_')) return 'CREATE';
  return 'CREATE';
}

// ─── ActionExecutor ─────────────────────────────────────────────────────────

/**
 * Executes confirmed action proposals through the standard service layer.
 * Uses a registry pattern — business modules register their handlers at startup.
 *
 * For E5-3 (MVP), NO handlers are registered. All action types return
 * ACTION_TYPE_NOT_IMPLEMENTED until business modules (Finance, AR, AP) are built.
 */
export class ActionExecutor implements IActionExecutor {
  private handlers = new Map<string, ActionHandler>();

  constructor(
    private db: PrismaClient,
    private eventBus: EventBus,
    private logger: Logger,
  ) {}

  /**
   * Register an action handler for a specific action type.
   * Called by business module Fastify plugins during initialization.
   *
   * @example
   *   // In Finance module plugin:
   *   actionExecutor.registerHandler('CREATE_JOURNAL', createJournalHandler);
   */
  registerHandler(actionType: string, handler: ActionHandler): void {
    const key = actionType.toUpperCase();
    this.handlers.set(key, handler);
    this.logger.info({ actionType: key }, 'Action handler registered');
  }

  /**
   * Execute a confirmed action through the standard service layer.
   * Uses the same code path as manual creation — no business rule bypass.
   */
  async execute(params: {
    proposal: ActionProposal;
    conversationId: string;
    agentId: string;
    userId: string;
    companyId: string;
  }): Promise<ActionExecutionResult> {
    const { proposal, conversationId, agentId, userId, companyId } = params;

    // Validate required proposal fields
    if (!proposal.type || !proposal.entityType || !proposal.previewData) {
      return {
        success: false,
        error: {
          code: 'INVALID_PROPOSAL',
          message: 'Action proposal is missing required fields (type, entityType, previewData)',
        },
      };
    }

    const actionType = proposal.type.toUpperCase();
    const handler = this.handlers.get(actionType);

    if (!handler) {
      this.logger.info(
        { actionType, entityType: proposal.entityType },
        'No handler registered for action type',
      );
      return {
        success: false,
        error: {
          code: 'ACTION_TYPE_NOT_IMPLEMENTED',
          message: `Action type ${actionType} is not yet available`,
        },
      };
    }

    try {
      const result = await this.db.$transaction(async (tx) => {
        return handler(tx as unknown as PrismaClient, companyId, userId, proposal.previewData);
      });

      // Emit ai.action.executed event on success
      this.eventBus.emit('ai.action.executed', {
        agentId,
        toolName: proposal.type,
        entityType: proposal.entityType,
        entityId: result.entityId,
        userId,
        confidence: String(proposal.confidence),
        companyId,
        conversationId,
        actionType: deriveAuditAction(actionType),
      });

      this.logger.info(
        {
          actionType,
          entityType: proposal.entityType,
          entityId: result.entityId,
          displayRef: result.displayRef,
          userId,
          companyId,
        },
        'Action executed successfully',
      );

      return {
        success: true,
        entityType: proposal.entityType,
        entityId: result.entityId,
        displayRef: result.displayRef,
      };
    } catch (error) {
      // Do NOT emit event on failure. Do NOT modify data.
      this.logger.error(
        {
          error: (error as Error).message,
          actionType,
          entityType: proposal.entityType,
          userId,
          companyId,
        },
        'Action execution failed',
      );

      return {
        success: false,
        error: {
          code: 'ACTION_EXECUTION_FAILED',
          message: (error as Error).message,
        },
      };
    }
  }

  /** Check if a handler is registered for a given action type (for testing/monitoring) */
  hasHandler(actionType: string): boolean {
    return this.handlers.has(actionType.toUpperCase());
  }

  /** Get count of registered handlers (for monitoring/testing) */
  get handlerCount(): number {
    return this.handlers.size;
  }
}
