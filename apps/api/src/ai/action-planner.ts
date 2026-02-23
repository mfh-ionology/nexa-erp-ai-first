import { randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import type {
  ActionProposal,
  ActionProposalResult,
  AgentGuardrails,
  AiRequestContext,
  AiStructuredOutput,
  IGuardrailsService,
} from './ai.types.js';

// ─── Required Fields (2x weight in confidence calculation) ──────────────────

const REQUIRED_FIELDS: ReadonlySet<string> = new Set([
  'customerId',
  'supplierId',
  'amount',
  'currency',
  'entityType',
  'accountId',
  'employeeId',
  'itemId',
  'quantity',
  'unitPrice',
]);

// ─── ActionPlanner ──────────────────────────────────────────────────────────

/**
 * Parse AI structured output or tool calls to extract action proposals,
 * enrich them with guardrail decisions, and stage for user confirmation.
 *
 * Flow: AI Response → ResponseParser → ActionPlanner → WebSocket action_proposal
 */
export class ActionPlanner {
  /** In-memory staging map — proposals are ephemeral (lost on restart) */
  private stagedProposals = new Map<string, ActionProposalResult>();

  /** Timestamps for staged proposals — used for TTL eviction */
  private proposalTimestamps = new Map<string, number>();

  /** Max age for staged proposals before eviction (30 minutes) */
  private static readonly PROPOSAL_TTL_MS = 30 * 60 * 1000;

  /** Max number of staged proposals to prevent unbounded memory growth */
  private static readonly MAX_STAGED_PROPOSALS = 1000;

  /** Interval handle for periodic cleanup */
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private guardrails: IGuardrailsService,
    private logger: Logger,
  ) {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => this.evictExpiredProposals(), 5 * 60 * 1000);
    // Prevent the interval from keeping the process alive
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /** Stop the periodic cleanup timer (call on shutdown) */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Parse AI structured output to extract action proposals.
   * Called by the orchestrator when AI response contains actionable intent.
   * Returns null if no actionable intent found.
   */
  extractActionProposal(
    aiResponse: AiStructuredOutput,
    agentGuardrails: AgentGuardrails,
    userContext: AiRequestContext,
    conversationId: string,
    agentId: string,
  ): ActionProposalResult | null {
    if (!aiResponse.action) {
      return null;
    }

    const { action } = aiResponse;

    if (!action.type || !action.entityType) {
      this.logger.warn({ action }, 'Action missing required type or entityType');
      return null;
    }

    const actionType = action.type.toUpperCase();
    const fieldConfidences = action.confidence ?? {};
    const confidence = this.calculateConfidence(fieldConfidences);

    const proposal: ActionProposal = {
      id: randomUUID(),
      type: actionType,
      description: this.generateDescription(actionType, action.entityType, action.fields),
      entityType: action.entityType,
      previewData: action.fields,
      confidence,
    };

    // Run guardrail evaluation
    const amount = this.extractAmount(action.fields);
    const guardrailDecision = this.guardrails.evaluate({
      actionType,
      entityType: action.entityType,
      agentGuardrails,
      amount,
    });

    if (!guardrailDecision.allowed) {
      this.logger.info(
        { actionType, entityType: action.entityType, reason: guardrailDecision.reason },
        'Action blocked by guardrails',
      );
      return null;
    }

    const result: ActionProposalResult = {
      proposal,
      requiresApproval: guardrailDecision.requiresApproval,
      guardrailDecision,
      conversationId,
      agentId,
      userId: userContext.userId,
    };

    // Stage the proposal for later confirmation/rejection (with TTL tracking)
    this.stageProposal(proposal.id, result);

    this.logger.info(
      {
        proposalId: proposal.id,
        actionType,
        entityType: action.entityType,
        confidence,
        requiresApproval: guardrailDecision.requiresApproval,
      },
      'Action proposal extracted and staged',
    );

    return result;
  }

  /**
   * Create a staged action proposal with preview data, confidence, and guardrail decision.
   * Returns the proposal with requiresApproval flag set by guardrails.
   */
  createProposal(params: {
    type: string;
    entityType: string;
    fields: Record<string, unknown>;
    fieldConfidences: Record<string, number>;
    description: string;
    conversationId: string;
    agentId: string;
    userId: string;
    companyId: string;
    agentGuardrails: AgentGuardrails;
  }): ActionProposalResult {
    const actionType = params.type.toUpperCase();
    const confidence = this.calculateConfidence(params.fieldConfidences);

    const proposal: ActionProposal = {
      id: randomUUID(),
      type: actionType,
      description: params.description,
      entityType: params.entityType,
      previewData: params.fields,
      confidence,
    };

    // Run guardrail evaluation
    const amount = this.extractAmount(params.fields);
    const guardrailDecision = this.guardrails.evaluate({
      actionType,
      entityType: params.entityType,
      agentGuardrails: params.agentGuardrails,
      amount,
    });

    const result: ActionProposalResult = {
      proposal,
      requiresApproval: guardrailDecision.requiresApproval,
      guardrailDecision,
      conversationId: params.conversationId,
      agentId: params.agentId,
      userId: params.userId,
    };

    // Only stage allowed proposals — blocked proposals should not consume memory
    if (guardrailDecision.allowed) {
      this.stageProposal(proposal.id, result);
    }

    this.logger.info(
      {
        proposalId: proposal.id,
        actionType,
        entityType: params.entityType,
        confidence,
        requiresApproval: guardrailDecision.requiresApproval,
        conversationId: params.conversationId,
      },
      'Action proposal created and staged',
    );

    return result;
  }

  /**
   * Calculate aggregated confidence score from per-field confidences.
   * Uses weighted average — required fields get 2x weight.
   */
  calculateConfidence(fieldConfidences: Record<string, number>): number {
    const entries = Object.entries(fieldConfidences);
    if (entries.length === 0) {
      return 0.5; // default when no field confidences provided
    }

    let weightedSum = 0;
    let totalWeight = 0;

    for (const [field, score] of entries) {
      const weight = REQUIRED_FIELDS.has(field) ? 2 : 1;
      weightedSum += score * weight;
      totalWeight += weight;
    }

    const avg = weightedSum / totalWeight;
    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, avg));
  }

  /** Retrieve a staged proposal by ID */
  getProposal(proposalId: string): ActionProposalResult | undefined {
    return this.stagedProposals.get(proposalId);
  }

  /** Remove a staged proposal (after confirmation or rejection) */
  removeProposal(proposalId: string): boolean {
    this.proposalTimestamps.delete(proposalId);
    return this.stagedProposals.delete(proposalId);
  }

  /**
   * Atomically retrieve and remove a staged proposal.
   * Returns undefined if not found. Prevents double-confirm race conditions.
   */
  takeProposal(proposalId: string): ActionProposalResult | undefined {
    const result = this.stagedProposals.get(proposalId);
    if (result) {
      this.stagedProposals.delete(proposalId);
      this.proposalTimestamps.delete(proposalId);
    }
    return result;
  }

  /** Get count of staged proposals (for monitoring/testing) */
  get stagedCount(): number {
    return this.stagedProposals.size;
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /** Stage a proposal with timestamp tracking and capacity enforcement */
  private stageProposal(proposalId: string, result: ActionProposalResult): void {
    // Enforce max capacity — evict oldest if at limit
    if (this.stagedProposals.size >= ActionPlanner.MAX_STAGED_PROPOSALS) {
      this.evictExpiredProposals();
      // If still at limit after eviction, remove the oldest entry
      if (this.stagedProposals.size >= ActionPlanner.MAX_STAGED_PROPOSALS) {
        const oldestId = this.stagedProposals.keys().next().value;
        if (oldestId) {
          this.stagedProposals.delete(oldestId);
          this.proposalTimestamps.delete(oldestId);
          this.logger.warn({ proposalId: oldestId }, 'Evicted oldest staged proposal due to capacity limit');
        }
      }
    }
    this.stagedProposals.set(proposalId, result);
    this.proposalTimestamps.set(proposalId, Date.now());
  }

  /** Evict proposals older than PROPOSAL_TTL_MS */
  private evictExpiredProposals(): void {
    const now = Date.now();
    let evicted = 0;
    for (const [id, timestamp] of this.proposalTimestamps) {
      if (now - timestamp > ActionPlanner.PROPOSAL_TTL_MS) {
        this.stagedProposals.delete(id);
        this.proposalTimestamps.delete(id);
        evicted++;
      }
    }
    if (evicted > 0) {
      this.logger.info({ evicted }, 'Evicted expired staged proposals');
    }
  }

  /** Generate a human-readable description from action type and entity data */
  private generateDescription(
    actionType: string,
    entityType: string,
    fields: Record<string, unknown>,
  ): string {
    const verb = this.actionVerb(actionType);
    const entityName = this.formatEntityName(entityType);

    // Try to include a meaningful identifier from fields
    const identifier =
      (fields.name as string) ??
      (fields.displayRef as string) ??
      (fields.reference as string) ??
      (fields.customerId as string) ??
      (fields.supplierId as string) ??
      null;

    if (identifier) {
      return `${verb} ${entityName} for ${identifier}`;
    }
    return `${verb} ${entityName}`;
  }

  /** Map action type prefix to a human-readable verb */
  private actionVerb(actionType: string): string {
    if (actionType.startsWith('CREATE_')) return 'Create';
    if (actionType.startsWith('UPDATE_')) return 'Update';
    if (actionType.startsWith('DELETE_')) return 'Delete';
    if (actionType.startsWith('POST_')) return 'Post';
    if (actionType.startsWith('APPROVE_')) return 'Approve';
    if (actionType.startsWith('VOID_')) return 'Void';
    if (actionType.startsWith('REVERSE_')) return 'Reverse';
    if (actionType.startsWith('SEND_')) return 'Send';
    if (actionType.startsWith('RUN_')) return 'Run';
    if (actionType.startsWith('DISPOSE_')) return 'Dispose';
    return actionType.replace(/_/g, ' ').toLowerCase();
  }

  /** Format entity type from PascalCase to readable form */
  private formatEntityName(entityType: string): string {
    return entityType.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  }

  /** Extract numeric amount from fields for threshold checking */
  private extractAmount(fields: Record<string, unknown>): number | undefined {
    const amount = fields.amount ?? fields.totalAmount ?? fields.total;
    if (typeof amount === 'number') return amount;
    if (typeof amount === 'string') {
      const parsed = parseFloat(amount);
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }
}
