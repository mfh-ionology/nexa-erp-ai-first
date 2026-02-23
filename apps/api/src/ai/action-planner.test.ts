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
import type {
  AgentGuardrails,
  AiRequestContext,
  AiStructuredOutput,
  GuardrailDecision,
  IGuardrailsService,
} from './ai.types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGuardrails(overrides: Partial<AgentGuardrails> = {}): AgentGuardrails {
  return {
    canRead: ['CustomerInvoice', 'Customer'],
    canWrite: ['CustomerInvoice', 'Customer'],
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
      type: 'create_invoice',
      entityType: 'CustomerInvoice',
      fields: { customerId: 'cust-1', amount: 500, currency: 'GBP' },
      confidence: { customerId: 0.95, amount: 0.88, currency: 0.99 },
    },
    answer: 'I will create an invoice.',
    ...overrides,
  };
}

function makeAllowedDecision(overrides: Partial<GuardrailDecision> = {}): GuardrailDecision {
  return {
    allowed: true,
    requiresApproval: false,
    reason: 'Action allowed',
    rulesTriggered: [],
    ...overrides,
  };
}

function makeFinancialDecision(): GuardrailDecision {
  return {
    allowed: true,
    requiresApproval: true,
    reason: 'Financial action requires user confirmation',
    rulesTriggered: ['FINANCIAL_SAFETY'],
  };
}

function makeBlockedDecision(): GuardrailDecision {
  return {
    allowed: false,
    requiresApproval: false,
    reason: 'Agent lacks write permission for this entity type',
    rulesTriggered: ['WRITE_PERMISSION'],
  };
}

function createMockGuardrailsService(
  decision: GuardrailDecision = makeAllowedDecision(),
): IGuardrailsService {
  return {
    evaluate: vi.fn().mockReturnValue(decision),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActionPlanner', () => {
  let planner: ActionPlanner;
  let mockGuardrailsService: IGuardrailsService;

  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockGuardrailsService = createMockGuardrailsService();
    planner = new ActionPlanner(mockGuardrailsService, mockLogger as any);
  });

  // ─── extractActionProposal ──────────────────────────────────────────────

  describe('extractActionProposal', () => {
    it('extracts action from structured output with correct type, entityType, previewData', () => {
      const aiResponse = makeStructuredOutput();
      const result = planner.extractActionProposal(
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
      expect(result!.conversationId).toBe('conv-1');
      expect(result!.agentId).toBe('agent-1');
    });

    it('returns null when no action intent in response', () => {
      const aiResponse = makeStructuredOutput({
        action: undefined,
      });
      const result = planner.extractActionProposal(
        aiResponse,
        makeGuardrails(),
        makeUserContext(),
        'conv-1',
        'agent-1',
      );

      expect(result).toBeNull();
    });

    it('returns null when action is missing type', () => {
      const aiResponse = makeStructuredOutput({
        action: {
          type: '',
          entityType: 'CustomerInvoice',
          fields: {},
          confidence: {},
        },
      });
      const result = planner.extractActionProposal(
        aiResponse,
        makeGuardrails(),
        makeUserContext(),
        'conv-1',
        'agent-1',
      );

      expect(result).toBeNull();
    });

    it('returns null when action is missing entityType', () => {
      const aiResponse = makeStructuredOutput({
        action: {
          type: 'CREATE_INVOICE',
          entityType: '',
          fields: {},
          confidence: {},
        },
      });
      const result = planner.extractActionProposal(
        aiResponse,
        makeGuardrails(),
        makeUserContext(),
        'conv-1',
        'agent-1',
      );

      expect(result).toBeNull();
    });

    it('generates unique proposal IDs', () => {
      const aiResponse = makeStructuredOutput();

      const result1 = planner.extractActionProposal(
        aiResponse,
        makeGuardrails(),
        makeUserContext(),
        'conv-1',
        'agent-1',
      );
      const result2 = planner.extractActionProposal(
        aiResponse,
        makeGuardrails(),
        makeUserContext(),
        'conv-2',
        'agent-1',
      );

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result1!.proposal.id).not.toBe(result2!.proposal.id);
    });

    it('sets requiresApproval=true for financial action types', () => {
      mockGuardrailsService = createMockGuardrailsService(makeFinancialDecision());
      planner = new ActionPlanner(mockGuardrailsService, mockLogger as any);

      const aiResponse = makeStructuredOutput();
      const result = planner.extractActionProposal(
        aiResponse,
        makeGuardrails(),
        makeUserContext(),
        'conv-1',
        'agent-1',
      );

      expect(result).not.toBeNull();
      expect(result!.requiresApproval).toBe(true);
      expect(result!.guardrailDecision.rulesTriggered).toContain('FINANCIAL_SAFETY');
    });

    it('sets requiresApproval per guardrail decision for non-financial types', () => {
      mockGuardrailsService = createMockGuardrailsService(makeAllowedDecision({
        requiresApproval: false,
      }));
      planner = new ActionPlanner(mockGuardrailsService, mockLogger as any);

      const aiResponse = makeStructuredOutput({
        action: {
          type: 'SEND_EMAIL',
          entityType: 'Email',
          fields: { to: 'test@example.com' },
          confidence: { to: 0.95 },
        },
      });
      const result = planner.extractActionProposal(
        aiResponse,
        makeGuardrails({ canWrite: ['Email'] }),
        makeUserContext(),
        'conv-1',
        'agent-1',
      );

      expect(result).not.toBeNull();
      expect(result!.requiresApproval).toBe(false);
    });

    it('returns null when guardrails block the action', () => {
      mockGuardrailsService = createMockGuardrailsService(makeBlockedDecision());
      planner = new ActionPlanner(mockGuardrailsService, mockLogger as any);

      const aiResponse = makeStructuredOutput();
      const result = planner.extractActionProposal(
        aiResponse,
        makeGuardrails({ canWrite: [] }),
        makeUserContext(),
        'conv-1',
        'agent-1',
      );

      expect(result).toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'Agent lacks write permission for this entity type' }),
        'Action blocked by guardrails',
      );
    });

    it('stages proposal for later retrieval', () => {
      const aiResponse = makeStructuredOutput();
      const result = planner.extractActionProposal(
        aiResponse,
        makeGuardrails(),
        makeUserContext(),
        'conv-1',
        'agent-1',
      );

      expect(result).not.toBeNull();
      const retrieved = planner.getProposal(result!.proposal.id);
      expect(retrieved).toEqual(result);
    });

    it('generates a human-readable description with identifier', () => {
      const aiResponse = makeStructuredOutput({
        action: {
          type: 'create_invoice',
          entityType: 'CustomerInvoice',
          fields: { customerId: 'cust-acme-1', amount: 500 },
          confidence: { customerId: 0.95, amount: 0.88 },
        },
      });
      const result = planner.extractActionProposal(
        aiResponse,
        makeGuardrails(),
        makeUserContext(),
        'conv-1',
        'agent-1',
      );

      expect(result).not.toBeNull();
      expect(result!.proposal.description).toBe('Create customer invoice for cust-acme-1');
    });

    it('passes amount to guardrails for threshold checking', () => {
      const aiResponse = makeStructuredOutput({
        action: {
          type: 'create_invoice',
          entityType: 'CustomerInvoice',
          fields: { customerId: 'cust-1', amount: 10000 },
          confidence: { customerId: 0.95, amount: 0.88 },
        },
      });
      planner.extractActionProposal(
        aiResponse,
        makeGuardrails(),
        makeUserContext(),
        'conv-1',
        'agent-1',
      );

      expect(mockGuardrailsService.evaluate).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 10000 }),
      );
    });
  });

  // ─── createProposal ────────────────────────────────────────────────────

  describe('createProposal', () => {
    it('creates a proposal with correct fields', () => {
      const result = planner.createProposal({
        type: 'create_invoice',
        entityType: 'CustomerInvoice',
        fields: { customerId: 'cust-1', amount: 500 },
        fieldConfidences: { customerId: 0.95, amount: 0.88 },
        description: 'Create invoice for Acme Corp',
        conversationId: 'conv-1',
        agentId: 'agent-1',
        userId: 'user-1',
        companyId: 'company-1',
        agentGuardrails: makeGuardrails(),
      });

      expect(result.proposal.type).toBe('CREATE_INVOICE');
      expect(result.proposal.entityType).toBe('CustomerInvoice');
      expect(result.proposal.description).toBe('Create invoice for Acme Corp');
      expect(result.proposal.previewData).toEqual({ customerId: 'cust-1', amount: 500 });
      expect(result.conversationId).toBe('conv-1');
      expect(result.agentId).toBe('agent-1');
    });

    it('stages proposal for later retrieval', () => {
      const result = planner.createProposal({
        type: 'create_invoice',
        entityType: 'CustomerInvoice',
        fields: { customerId: 'cust-1' },
        fieldConfidences: { customerId: 0.95 },
        description: 'Create invoice',
        conversationId: 'conv-1',
        agentId: 'agent-1',
        userId: 'user-1',
        companyId: 'company-1',
        agentGuardrails: makeGuardrails(),
      });

      expect(planner.getProposal(result.proposal.id)).toEqual(result);
      expect(planner.stagedCount).toBe(1);
    });

    it('runs guardrails and sets requiresApproval', () => {
      mockGuardrailsService = createMockGuardrailsService(makeFinancialDecision());
      planner = new ActionPlanner(mockGuardrailsService, mockLogger as any);

      const result = planner.createProposal({
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

      expect(result.requiresApproval).toBe(true);
      expect(result.guardrailDecision.rulesTriggered).toContain('FINANCIAL_SAFETY');
    });

    it('generates unique proposal IDs', () => {
      const params = {
        type: 'SEND_EMAIL',
        entityType: 'Email',
        fields: { to: 'test@example.com' },
        fieldConfidences: { to: 0.95 },
        description: 'Send email',
        conversationId: 'conv-1',
        agentId: 'agent-1',
        userId: 'user-1',
        companyId: 'company-1',
        agentGuardrails: makeGuardrails({ canWrite: ['Email'] }),
      };

      const result1 = planner.createProposal(params);
      const result2 = planner.createProposal(params);

      expect(result1.proposal.id).not.toBe(result2.proposal.id);
    });
  });

  // ─── calculateConfidence ───────────────────────────────────────────────

  describe('calculateConfidence', () => {
    it('returns weighted average with required fields at 2x weight', () => {
      const confidences = {
        customerId: 0.90,  // required → weight 2
        amount: 0.80,      // required → weight 2
        notes: 0.70,       // optional → weight 1
      };
      // Weighted: (0.90*2 + 0.80*2 + 0.70*1) / (2+2+1) = (1.80+1.60+0.70)/5 = 4.10/5 = 0.82
      const result = planner.calculateConfidence(confidences);
      expect(result).toBeCloseTo(0.82, 2);
    });

    it('returns 0.5 when no field confidences provided', () => {
      expect(planner.calculateConfidence({})).toBe(0.5);
    });

    it('returns simple average when no required fields present', () => {
      const confidences = {
        notes: 0.70,
        description: 0.90,
      };
      // (0.70 + 0.90) / 2 = 0.80
      const result = planner.calculateConfidence(confidences);
      expect(result).toBeCloseTo(0.80, 2);
    });

    it('clamps result to [0, 1]', () => {
      // Scores above 1 should clamp
      expect(planner.calculateConfidence({ notes: 1.5 })).toBe(1.0);
      // Scores below 0 should clamp
      expect(planner.calculateConfidence({ notes: -0.5 })).toBe(0.0);
    });

    it('handles all required fields', () => {
      const confidences = {
        customerId: 1.0,   // required → 2x
        amount: 1.0,       // required → 2x
        currency: 1.0,     // required → 2x
      };
      expect(planner.calculateConfidence(confidences)).toBe(1.0);
    });
  });

  // ─── Proposal Management ──────────────────────────────────────────────

  describe('proposal management', () => {
    it('getProposal returns undefined for non-existent ID', () => {
      expect(planner.getProposal('non-existent')).toBeUndefined();
    });

    it('removeProposal removes a staged proposal', () => {
      const result = planner.createProposal({
        type: 'SEND_EMAIL',
        entityType: 'Email',
        fields: { to: 'test@example.com' },
        fieldConfidences: { to: 0.95 },
        description: 'Send email',
        conversationId: 'conv-1',
        agentId: 'agent-1',
        userId: 'user-1',
        companyId: 'company-1',
        agentGuardrails: makeGuardrails({ canWrite: ['Email'] }),
      });

      expect(planner.removeProposal(result.proposal.id)).toBe(true);
      expect(planner.getProposal(result.proposal.id)).toBeUndefined();
      expect(planner.stagedCount).toBe(0);
    });

    it('removeProposal returns false for non-existent ID', () => {
      expect(planner.removeProposal('non-existent')).toBe(false);
    });

    it('takeProposal atomically retrieves and removes a staged proposal', () => {
      const result = planner.createProposal({
        type: 'SEND_EMAIL',
        entityType: 'Email',
        fields: { to: 'test@example.com' },
        fieldConfidences: { to: 0.95 },
        description: 'Send email',
        conversationId: 'conv-1',
        agentId: 'agent-1',
        userId: 'user-1',
        companyId: 'company-1',
        agentGuardrails: makeGuardrails({ canWrite: ['Email'] }),
      });

      const taken = planner.takeProposal(result.proposal.id);
      expect(taken).toEqual(result);
      // Should be removed after take
      expect(planner.getProposal(result.proposal.id)).toBeUndefined();
      expect(planner.stagedCount).toBe(0);
    });

    it('takeProposal returns undefined for non-existent ID', () => {
      expect(planner.takeProposal('non-existent')).toBeUndefined();
    });

    it('takeProposal prevents double-confirm (second take returns undefined)', () => {
      const result = planner.createProposal({
        type: 'SEND_EMAIL',
        entityType: 'Email',
        fields: { to: 'test@example.com' },
        fieldConfidences: { to: 0.95 },
        description: 'Send email',
        conversationId: 'conv-1',
        agentId: 'agent-1',
        userId: 'user-1',
        companyId: 'company-1',
        agentGuardrails: makeGuardrails({ canWrite: ['Email'] }),
      });

      const firstTake = planner.takeProposal(result.proposal.id);
      expect(firstTake).toBeDefined();

      const secondTake = planner.takeProposal(result.proposal.id);
      expect(secondTake).toBeUndefined();
    });

    it('takeProposal includes userId for ownership verification', () => {
      const result = planner.createProposal({
        type: 'SEND_EMAIL',
        entityType: 'Email',
        fields: { to: 'test@example.com' },
        fieldConfidences: { to: 0.95 },
        description: 'Send email',
        conversationId: 'conv-1',
        agentId: 'agent-1',
        userId: 'user-42',
        companyId: 'company-1',
        agentGuardrails: makeGuardrails({ canWrite: ['Email'] }),
      });

      const taken = planner.takeProposal(result.proposal.id);
      expect(taken).toBeDefined();
      expect(taken!.userId).toBe('user-42');
    });
  });
});
