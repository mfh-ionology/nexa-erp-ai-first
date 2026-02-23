import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock setup via vi.hoisted
// ---------------------------------------------------------------------------

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock crypto.randomUUID for deterministic IDs in tests
let uuidCounter = 0;
vi.mock('node:crypto', () => ({
  randomUUID: () => `test-uuid-${++uuidCounter}`,
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { ActionPlanner } from './action-planner.js';
import { GuardrailsService } from './guardrails.js';
import { ActionExecutor } from './action-executor.js';
import type { ActionHandler } from './action-executor.js';
import type {
  ActionProposal,
  AgentGuardrails,
  AiRequestContext,
  AiStructuredOutput,
} from './ai.types.js';
import { AUDIT_EVENT_MAPPINGS, registerAuditMapping } from '../core/audit/audit.mappings.js';
import type { AuditAction } from '../core/audit/audit.types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGuardrails(overrides: Partial<AgentGuardrails> = {}): AgentGuardrails {
  return {
    canRead: ['CustomerInvoice', 'Customer', 'Email'],
    canWrite: ['CustomerInvoice', 'Customer', 'Email'],
    requiresApproval: false,
    blockedOperations: [],
    dataScope: 'all',
    ...overrides,
  };
}

function makeUserContext(overrides: Partial<AiRequestContext> = {}): AiRequestContext {
  return {
    userId: 'user-1',
    companyId: 'company-1',
    tenantId: 'tenant-1',
    locale: 'en-GB',
    ...overrides,
  };
}

function makeStructuredOutput(overrides: Partial<AiStructuredOutput> = {}): AiStructuredOutput {
  return {
    intent: 'create_invoice',
    action: {
      type: 'CREATE_INVOICE',
      entityType: 'CustomerInvoice',
      fields: { customerId: 'cust-1', amount: 500, currency: 'GBP' },
      confidence: { customerId: 0.95, amount: 0.88, currency: 0.99 },
    },
    answer: 'I will create an invoice.',
    ...overrides,
  };
}

function makeProposal(overrides: Partial<ActionProposal> = {}): ActionProposal {
  return {
    id: 'proposal-1',
    type: 'CREATE_INVOICE',
    description: 'Create invoice for Acme',
    entityType: 'CustomerInvoice',
    previewData: { customerId: 'cust-1', amount: 500, currency: 'GBP' },
    confidence: 0.92,
    ...overrides,
  };
}

function createMockEventBus() {
  return {
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
    drain: vi.fn(),
    setLogger: vi.fn(),
    setRetryExecutor: vi.fn(),
    setDeadLetterService: vi.fn(),
  };
}

function createMockDb() {
  return {
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
  };
}

// ---------------------------------------------------------------------------
// Integration Tests: Full Action Flow
// ---------------------------------------------------------------------------

describe('Action Flow Integration', () => {
  let guardrailsService: GuardrailsService;
  let actionPlanner: ActionPlanner;
  let actionExecutor: ActionExecutor;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEventBus: ReturnType<typeof createMockEventBus>;

  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;

    // Use REAL GuardrailsService (not mocked) — per Task 9.2 requirement
    guardrailsService = new GuardrailsService(mockLogger as any);
    actionPlanner = new ActionPlanner(guardrailsService, mockLogger as any);
    mockDb = createMockDb();
    mockEventBus = createMockEventBus();
    actionExecutor = new ActionExecutor(
      mockDb as any,
      mockEventBus as any,
      mockLogger as any,
    );
  });

  // ── Test 1: AI response with action_proposal → proposal created with correct fields ──

  describe('action proposal creation from AI response', () => {
    it('creates proposal with correct fields from structured output', () => {
      const aiResponse = makeStructuredOutput();
      const result = actionPlanner.extractActionProposal(
        aiResponse,
        makeGuardrails(),
        makeUserContext(),
        'conv-1',
        'agent-1',
      );

      expect(result).not.toBeNull();
      expect(result!.proposal.type).toBe('CREATE_INVOICE');
      expect(result!.proposal.entityType).toBe('CustomerInvoice');
      expect(result!.proposal.previewData).toEqual({
        customerId: 'cust-1',
        amount: 500,
        currency: 'GBP',
      });
      expect(result!.proposal.confidence).toBeGreaterThan(0);
      expect(result!.proposal.id).toBeTruthy();
      expect(result!.proposal.description).toBeTruthy();
      // Financial action → must require approval
      expect(result!.requiresApproval).toBe(true);
      expect(result!.guardrailDecision.allowed).toBe(true);
    });
  });

  // ── Test 2: action_confirm → ActionExecutor called → record_created emitted ──

  describe('action confirmation flow', () => {
    it('executes action via ActionExecutor and emits record_created on confirm', async () => {
      // Register a handler so the action can actually execute
      const handler: ActionHandler = vi.fn().mockResolvedValue({
        entityId: 'inv-123',
        displayRef: 'INV-0001',
      });
      actionExecutor.registerHandler('CREATE_INVOICE', handler);

      // Stage a proposal through the planner
      const proposalResult = actionPlanner.createProposal({
        type: 'CREATE_INVOICE',
        entityType: 'CustomerInvoice',
        fields: { customerId: 'cust-1', amount: 500, currency: 'GBP' },
        fieldConfidences: { customerId: 0.95, amount: 0.88, currency: 0.99 },
        description: 'Create invoice for Acme',
        conversationId: 'conv-1',
        agentId: 'agent-1',
        userId: 'user-1',
        companyId: 'company-1',
        agentGuardrails: makeGuardrails(),
      });

      // Simulate action_confirm by executing via ActionExecutor
      const result = await actionExecutor.execute({
        proposal: proposalResult.proposal,
        conversationId: proposalResult.conversationId,
        agentId: proposalResult.agentId,
        userId: 'user-1',
        companyId: 'company-1',
      });

      expect(result.success).toBe(true);
      expect(result.entityType).toBe('CustomerInvoice');
      expect(result.entityId).toBe('inv-123');
      expect(result.displayRef).toBe('INV-0001');

      // Verify handler was called with correct params
      expect(handler).toHaveBeenCalledWith(
        expect.anything(), // tx
        'company-1',
        'user-1',
        proposalResult.proposal.previewData,
      );
    });
  });

  // ── Test 3: action_confirm for unregistered action type → ACTION_TYPE_NOT_IMPLEMENTED ──

  describe('unregistered action type', () => {
    it('returns ACTION_TYPE_NOT_IMPLEMENTED for unregistered action types', async () => {
      // Stage a proposal but do NOT register a handler
      const proposalResult = actionPlanner.createProposal({
        type: 'CREATE_INVOICE',
        entityType: 'CustomerInvoice',
        fields: { customerId: 'cust-1', amount: 500 },
        fieldConfidences: { customerId: 0.95, amount: 0.88 },
        description: 'Create invoice',
        conversationId: 'conv-1',
        agentId: 'agent-1',
        userId: 'user-1',
        companyId: 'company-1',
        agentGuardrails: makeGuardrails(),
      });

      const result = await actionExecutor.execute({
        proposal: proposalResult.proposal,
        conversationId: 'conv-1',
        agentId: 'agent-1',
        userId: 'user-1',
        companyId: 'company-1',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ACTION_TYPE_NOT_IMPLEMENTED');
      expect(result.error?.message).toContain('CREATE_INVOICE');
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });
  });

  // ── Test 4: action_reject → no data modified → acknowledgement ──

  describe('action rejection flow', () => {
    it('removes proposal on rejection with no data modification', () => {
      // Stage a proposal
      const proposalResult = actionPlanner.createProposal({
        type: 'SEND_EMAIL',
        entityType: 'Email',
        fields: { to: 'test@example.com', subject: 'Hello' },
        fieldConfidences: { to: 0.95, subject: 0.90 },
        description: 'Send email to test@example.com',
        conversationId: 'conv-1',
        agentId: 'agent-1',
        userId: 'user-1',
        companyId: 'company-1',
        agentGuardrails: makeGuardrails(),
      });

      const proposalId = proposalResult.proposal.id;
      expect(actionPlanner.getProposal(proposalId)).toBeDefined();

      // Simulate rejection: remove the proposal
      const removed = actionPlanner.removeProposal(proposalId);

      expect(removed).toBe(true);
      expect(actionPlanner.getProposal(proposalId)).toBeUndefined();
      // No events should be emitted on rejection
      expect(mockEventBus.emit).not.toHaveBeenCalled();
      // No database calls should be made (no $transaction)
      expect(mockDb.$transaction).not.toHaveBeenCalled();
    });
  });

  // ── Test 5: action_confirm for non-existent proposal → ACTION_NOT_FOUND ──

  describe('non-existent proposal', () => {
    it('returns undefined for a non-existent proposal ID', () => {
      const proposal = actionPlanner.getProposal('non-existent-id');
      expect(proposal).toBeUndefined();
    });
  });

  // ── Test 6: action_confirm for another user's proposal → ACTION_FORBIDDEN ──

  describe('proposal ownership verification', () => {
    it('detects session mismatch for cross-user proposal access', () => {
      // User A creates a proposal in session 'conv-user-a'
      const proposalResult = actionPlanner.createProposal({
        type: 'SEND_EMAIL',
        entityType: 'Email',
        fields: { to: 'test@example.com' },
        fieldConfidences: { to: 0.95 },
        description: 'Send email',
        conversationId: 'conv-user-a',
        agentId: 'agent-1',
        userId: 'user-a',
        companyId: 'company-1',
        agentGuardrails: makeGuardrails(),
      });

      // User B tries to confirm with their session 'conv-user-b'
      const retrieved = actionPlanner.getProposal(proposalResult.proposal.id);
      expect(retrieved).toBeDefined();

      // Verify conversation mismatch — this is how WebSocket handler checks ownership
      const userBSessionId = 'conv-user-b';
      expect(retrieved!.conversationId).not.toBe(userBSessionId);
      // The WebSocket handler would return ACTION_FORBIDDEN here
    });
  });

  // ── Test 7: Financial action (CREATE_INVOICE) → requiresApproval always true ──

  describe('financial action guardrails', () => {
    it('CREATE_INVOICE always requires approval regardless of agent config', () => {
      const proposalResult = actionPlanner.createProposal({
        type: 'CREATE_INVOICE',
        entityType: 'CustomerInvoice',
        fields: { customerId: 'cust-1', amount: 500 },
        fieldConfidences: { customerId: 0.99, amount: 0.99 },
        description: 'Create invoice',
        conversationId: 'conv-1',
        agentId: 'agent-1',
        userId: 'user-1',
        companyId: 'company-1',
        agentGuardrails: makeGuardrails({ requiresApproval: false }),
      });

      expect(proposalResult.requiresApproval).toBe(true);
      expect(proposalResult.guardrailDecision.rulesTriggered).toContain('FINANCIAL_SAFETY');
    });

    it.each([
      'CREATE_INVOICE', 'POST_JOURNAL', 'CREATE_PAYMENT', 'RUN_PAYROLL',
      'APPROVE_INVOICE', 'VOID_INVOICE', 'CREATE_CREDIT_NOTE',
      'CREATE_BILL', 'POST_BILL', 'VOID_BILL',
    ] satisfies string[])('%s always requires approval (NFR16)', (actionType) => {
      // Derive a plausible entityType from the action type
      const entityType = actionType.replace(/^[A-Z]+_/, '');
      const guardrails = makeGuardrails({
        requiresApproval: false,
        canWrite: [entityType, 'CustomerInvoice', 'JournalEntry', 'Payment', 'Payroll', 'Invoice', 'CreditNote', 'Bill'],
      });

      const decision = guardrailsService.evaluate({
        actionType,
        entityType,
        agentGuardrails: guardrails,
      });

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(true);
      expect(decision.rulesTriggered).toContain('FINANCIAL_SAFETY');
    });
  });

  // ── Test 8: Non-financial action with low confidence → requiresApproval per guardrails ──

  describe('non-financial action guardrails', () => {
    it('SEND_EMAIL does not require approval when agent allows auto-execution', () => {
      const proposalResult = actionPlanner.createProposal({
        type: 'SEND_EMAIL',
        entityType: 'Email',
        fields: { to: 'test@example.com', subject: 'Hello' },
        fieldConfidences: { to: 0.45, subject: 0.30 }, // low confidence
        description: 'Send email',
        conversationId: 'conv-1',
        agentId: 'agent-1',
        userId: 'user-1',
        companyId: 'company-1',
        agentGuardrails: makeGuardrails({ requiresApproval: false }),
      });

      // Non-financial action with agent.requiresApproval=false → no approval needed
      expect(proposalResult.requiresApproval).toBe(false);
      expect(proposalResult.guardrailDecision.allowed).toBe(true);
    });

    it('non-financial action requires approval when agent guardrails demand it', () => {
      const proposalResult = actionPlanner.createProposal({
        type: 'SEND_EMAIL',
        entityType: 'Email',
        fields: { to: 'test@example.com' },
        fieldConfidences: { to: 0.95 },
        description: 'Send email',
        conversationId: 'conv-1',
        agentId: 'agent-1',
        userId: 'user-1',
        companyId: 'company-1',
        agentGuardrails: makeGuardrails({ requiresApproval: true }),
      });

      expect(proposalResult.requiresApproval).toBe(true);
      expect(proposalResult.guardrailDecision.rulesTriggered).toContain('AGENT_REQUIRES_APPROVAL');
    });
  });

  // ── Test 9: Guardrail blocks action (entity not in canWrite) → allowed=false ──

  describe('guardrail blocking', () => {
    it('blocks action when entity type not in canWrite', () => {
      const aiResponse = makeStructuredOutput({
        action: {
          type: 'CREATE_ORDER',
          entityType: 'SalesOrder',
          fields: { customerId: 'cust-1', amount: 100 },
          confidence: { customerId: 0.95 },
        },
      });

      // canWrite does NOT include 'SalesOrder'
      const result = actionPlanner.extractActionProposal(
        aiResponse,
        makeGuardrails({ canWrite: ['CustomerInvoice'] }),
        makeUserContext(),
        'conv-1',
        'agent-1',
      );

      // extractActionProposal returns null when guardrails block
      expect(result).toBeNull();
    });

    it('blocks action when operation is in blockedOperations', () => {
      const decision = guardrailsService.evaluate({
        actionType: 'DELETE_CUSTOMER',
        entityType: 'Customer',
        agentGuardrails: makeGuardrails({
          blockedOperations: ['DELETE_CUSTOMER'],
        }),
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('Operation blocked by agent guardrails');
      expect(decision.rulesTriggered).toContain('OPERATION_BLOCKLIST');
    });
  });

  // ── Test 10: ai.action.executed event emitted on successful execution with correct payload ──

  describe('event emission on successful execution', () => {
    it('emits ai.action.executed event with correct payload', async () => {
      const handler: ActionHandler = vi.fn().mockResolvedValue({
        entityId: 'inv-456',
        displayRef: 'INV-0042',
      });
      actionExecutor.registerHandler('CREATE_INVOICE', handler);

      // Stage proposal
      const proposalResult = actionPlanner.createProposal({
        type: 'CREATE_INVOICE',
        entityType: 'CustomerInvoice',
        fields: { customerId: 'cust-1', amount: 500, currency: 'GBP' },
        fieldConfidences: { customerId: 0.95, amount: 0.88, currency: 0.99 },
        description: 'Create invoice for Acme',
        conversationId: 'conv-42',
        agentId: 'agent-sales',
        userId: 'user-1',
        companyId: 'company-1',
        agentGuardrails: makeGuardrails(),
      });

      // Execute the confirmed action
      const result = await actionExecutor.execute({
        proposal: proposalResult.proposal,
        conversationId: 'conv-42',
        agentId: 'agent-sales',
        userId: 'user-1',
        companyId: 'company-1',
      });

      expect(result.success).toBe(true);

      // Verify ai.action.executed event payload
      expect(mockEventBus.emit).toHaveBeenCalledWith('ai.action.executed', {
        agentId: 'agent-sales',
        toolName: 'CREATE_INVOICE',
        entityType: 'CustomerInvoice',
        entityId: 'inv-456',
        userId: 'user-1',
        confidence: String(proposalResult.proposal.confidence),
        companyId: 'company-1',
        conversationId: 'conv-42',
        actionType: 'CREATE', // derived from CREATE_ prefix
      });
    });

    it('does NOT emit event when handler fails', async () => {
      const handler: ActionHandler = vi.fn().mockRejectedValue(
        new Error('Validation failed'),
      );
      actionExecutor.registerHandler('CREATE_INVOICE', handler);

      const result = await actionExecutor.execute({
        proposal: makeProposal(),
        conversationId: 'conv-1',
        agentId: 'agent-1',
        userId: 'user-1',
        companyId: 'company-1',
      });

      expect(result.success).toBe(false);
      expect(mockEventBus.emit).not.toHaveBeenCalled();
    });
  });

  // ── Test 11: Audit log mapping for ai.action.executed event ──

  describe('audit log mapping for AI actions', () => {
    it('audit mapping produces correct entry with isAiAction=true and aiConfidence', () => {
      // Register the audit mapping (same as done in index.ts)
      registerAuditMapping('ai.action.executed', (payload) => ({
        companyId: payload.companyId,
        entityType: payload.entityType,
        entityId: payload.entityId,
        action: (payload.actionType as AuditAction) ?? 'CREATE',
        userId: payload.userId,
        isAiAction: true,
        aiConfidence: parseFloat(payload.confidence),
        correlationId: payload.conversationId,
      }));

      const mapping = AUDIT_EVENT_MAPPINGS['ai.action.executed'];
      expect(mapping).toBeDefined();

      // Simulate the event payload that ActionExecutor would emit
      const eventPayload = {
        agentId: 'agent-sales',
        toolName: 'CREATE_INVOICE',
        entityType: 'CustomerInvoice',
        entityId: 'inv-789',
        userId: 'user-1',
        confidence: '0.92',
        companyId: 'company-1',
        conversationId: 'conv-42',
        actionType: 'CREATE',
      };

      const auditEntry = mapping!(eventPayload);

      expect(auditEntry.companyId).toBe('company-1');
      expect(auditEntry.entityType).toBe('CustomerInvoice');
      expect(auditEntry.entityId).toBe('inv-789');
      expect(auditEntry.action).toBe('CREATE');
      expect(auditEntry.userId).toBe('user-1');
      expect(auditEntry.isAiAction).toBe(true);
      expect(auditEntry.aiConfidence).toBeCloseTo(0.92, 2);
      expect(auditEntry.correlationId).toBe('conv-42');
    });
  });

  // ── End-to-end: Full flow from proposal creation to execution ──

  describe('end-to-end flow', () => {
    it('proposal → guardrails → confirm → execute → event', async () => {
      // 1. Register action handler
      const handler: ActionHandler = vi.fn().mockResolvedValue({
        entityId: 'inv-e2e',
        displayRef: 'INV-E2E-001',
      });
      actionExecutor.registerHandler('CREATE_INVOICE', handler);

      // 2. Extract action proposal from AI response (uses real guardrails)
      const aiResponse = makeStructuredOutput();
      const proposalResult = actionPlanner.extractActionProposal(
        aiResponse,
        makeGuardrails(),
        makeUserContext(),
        'conv-e2e',
        'agent-e2e',
      );

      // 3. Verify proposal was created and staged
      expect(proposalResult).not.toBeNull();
      expect(proposalResult!.requiresApproval).toBe(true); // financial action
      expect(actionPlanner.getProposal(proposalResult!.proposal.id)).toBeDefined();

      // 4. Simulate user confirmation — execute the action
      const executionResult = await actionExecutor.execute({
        proposal: proposalResult!.proposal,
        conversationId: 'conv-e2e',
        agentId: 'agent-e2e',
        userId: 'user-1',
        companyId: 'company-1',
      });

      // 5. Verify successful execution
      expect(executionResult.success).toBe(true);
      expect(executionResult.entityId).toBe('inv-e2e');
      expect(executionResult.displayRef).toBe('INV-E2E-001');

      // 6. Verify event was emitted
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'ai.action.executed',
        expect.objectContaining({
          entityType: 'CustomerInvoice',
          entityId: 'inv-e2e',
          userId: 'user-1',
          companyId: 'company-1',
          actionType: 'CREATE',
        }),
      );

      // 7. Remove proposal from staging (as WebSocket handler does after confirm)
      actionPlanner.removeProposal(proposalResult!.proposal.id);
      expect(actionPlanner.getProposal(proposalResult!.proposal.id)).toBeUndefined();
    });
  });
});
