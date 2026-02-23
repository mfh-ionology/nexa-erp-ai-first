import type { Logger } from 'pino';
import type { AgentGuardrails, GuardrailDecision, IGuardrailsService } from './ai.types.js';

// ─── Financial Action Types ────────────────────────────────────────────────

/**
 * Financial action types that ALWAYS require user confirmation.
 * This is hardcoded per NFR16 — not configurable per tenant.
 */
export const FINANCIAL_ACTION_TYPES = [
  'CREATE_INVOICE',
  'APPROVE_INVOICE',
  'POST_INVOICE',
  'VOID_INVOICE',
  'CREATE_CREDIT_NOTE',
  'CREATE_JOURNAL',
  'POST_JOURNAL',
  'REVERSE_JOURNAL',
  'CREATE_PAYMENT',
  'POST_PAYMENT',
  'CREATE_BILL',
  'POST_BILL',
  'VOID_BILL',
  'CREATE_SUPPLIER_PAYMENT',
  'POST_SUPPLIER_PAYMENT',
  'RUN_PAYROLL',
  'POST_DEPRECIATION',
  'DISPOSE_ASSET',
] as const;

export type FinancialActionType = (typeof FINANCIAL_ACTION_TYPES)[number];

/** Pre-built set for O(1) lookup (case-insensitive via uppercased keys) */
const FINANCIAL_ACTION_SET: ReadonlySet<string> = new Set(FINANCIAL_ACTION_TYPES);

// ─── Write Operation Prefixes ──────────────────────────────────────────────

/** Action prefixes that constitute write operations */
const WRITE_PREFIXES = [
  'CREATE_',
  'UPDATE_',
  'DELETE_',
  'POST_',
  'APPROVE_',
  'VOID_',
  'REVERSE_',
  'RUN_',
  'DISPOSE_',
  'SEND_',
] as const;

// ─── GuardrailsService ────────────────────────────────────────────────────

/**
 * Evaluates action proposals against a chain of safety rules.
 *
 * Guardrail chain (evaluated in order):
 * 1. Operation blocklist check (agent.guardrails.blockedOperations)
 * 2. Entity write permission check (agent.guardrails.canWrite)
 * 3. Financial safety check (ALWAYS requires approval for financial types — NFR16)
 * 4. Amount threshold check (agent.guardrails.maxAmountWithoutApproval)
 * 5. Agent-level approval requirement (agent.guardrails.requiresApproval)
 */
export class GuardrailsService implements IGuardrailsService {
  constructor(private logger: Logger) {}

  evaluate(params: {
    actionType: string;
    entityType: string;
    agentGuardrails: AgentGuardrails;
    amount?: number;
  }): GuardrailDecision {
    const { actionType, entityType, agentGuardrails, amount } = params;
    const upperAction = actionType.toUpperCase();
    const rulesTriggered: string[] = [];

    // ── Rule 1: Blocklist check ──────────────────────────────────────────
    if (agentGuardrails.blockedOperations.some((op) => op.toUpperCase() === upperAction)) {
      const decision: GuardrailDecision = {
        allowed: false,
        requiresApproval: false,
        reason: 'Operation blocked by agent guardrails',
        rulesTriggered: ['OPERATION_BLOCKLIST'],
      };
      this.logDecision(upperAction, entityType, decision);
      return decision;
    }

    // ── Rule 2: Write permission check (case-insensitive entityType match) ──
    const entityLower = entityType.toLowerCase();
    if (this.isWriteOperation(upperAction) && !agentGuardrails.canWrite.some((w) => w.toLowerCase() === entityLower)) {
      const decision: GuardrailDecision = {
        allowed: false,
        requiresApproval: false,
        reason: 'Agent lacks write permission for this entity type',
        rulesTriggered: ['WRITE_PERMISSION'],
      };
      this.logDecision(upperAction, entityType, decision);
      return decision;
    }

    // ── Rule 3: Financial safety (NFR16 — IMMUTABLE) ─────────────────────
    let requiresApproval = false;
    if (this.isFinancialAction(upperAction)) {
      requiresApproval = true;
      rulesTriggered.push('FINANCIAL_SAFETY');
    }

    // ── Rule 4: Amount threshold check ───────────────────────────────────
    if (
      amount !== undefined &&
      agentGuardrails.maxAmountWithoutApproval !== undefined
    ) {
      const threshold = parseFloat(agentGuardrails.maxAmountWithoutApproval);
      if (!isNaN(threshold) && amount > threshold) {
        requiresApproval = true;
        rulesTriggered.push('AMOUNT_THRESHOLD');
      }
    }

    // ── Rule 5: Agent-level approval requirement ─────────────────────────
    if (agentGuardrails.requiresApproval) {
      requiresApproval = true;
      rulesTriggered.push('AGENT_REQUIRES_APPROVAL');
    }

    const reason = requiresApproval
      ? this.buildApprovalReason(rulesTriggered)
      : 'Action allowed';

    const decision: GuardrailDecision = {
      allowed: true,
      requiresApproval,
      reason,
      rulesTriggered,
    };

    this.logDecision(upperAction, entityType, decision);
    return decision;
  }

  /**
   * Check if an action type is a financial action (always requires confirmation).
   * Case-insensitive comparison.
   */
  isFinancialAction(actionType: string): boolean {
    return FINANCIAL_ACTION_SET.has(actionType.toUpperCase());
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  /** Check if an action type is a write operation based on its prefix */
  private isWriteOperation(upperAction: string): boolean {
    return WRITE_PREFIXES.some((prefix) => upperAction.startsWith(prefix));
  }

  /** Build a human-readable reason from triggered rules */
  private buildApprovalReason(rulesTriggered: string[]): string {
    if (rulesTriggered.includes('FINANCIAL_SAFETY')) {
      return 'Financial action requires user confirmation';
    }
    if (rulesTriggered.includes('AMOUNT_THRESHOLD')) {
      return 'Amount exceeds auto-approval threshold';
    }
    if (rulesTriggered.includes('AGENT_REQUIRES_APPROVAL')) {
      return 'Agent configuration requires user approval for all actions';
    }
    return 'Action requires user approval';
  }

  /** Log every guardrail decision for observability */
  private logDecision(
    actionType: string,
    entityType: string,
    decision: GuardrailDecision,
  ): void {
    this.logger.info(
      {
        actionType,
        entityType,
        allowed: decision.allowed,
        requiresApproval: decision.requiresApproval,
        reason: decision.reason,
        rulesTriggered: decision.rulesTriggered,
      },
      'Guardrail decision',
    );
  }
}
