import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuardrailsService, FINANCIAL_ACTION_TYPES } from './guardrails.js';
import type { AgentGuardrails } from './ai.types.js';

// ─── Mock Logger ────────────────────────────────────────────────────────────

const mockLogger = {
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('GuardrailsService', () => {
  let service: GuardrailsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GuardrailsService(mockLogger as any);
  });

  // ─── Financial Safety (Rule 3 — NFR16 IMMUTABLE) ─────────────────────

  describe('financial safety', () => {
    it('CREATE_INVOICE always requires approval', () => {
      const decision = service.evaluate({
        actionType: 'CREATE_INVOICE',
        entityType: 'CustomerInvoice',
        agentGuardrails: makeGuardrails({ requiresApproval: false }),
      });

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(true);
      expect(decision.rulesTriggered).toContain('FINANCIAL_SAFETY');
    });

    it('POST_JOURNAL always requires approval', () => {
      const decision = service.evaluate({
        actionType: 'POST_JOURNAL',
        entityType: 'JournalEntry',
        agentGuardrails: makeGuardrails({ canWrite: ['JournalEntry'] }),
      });

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(true);
      expect(decision.rulesTriggered).toContain('FINANCIAL_SAFETY');
    });

    it('CREATE_PAYMENT always requires approval', () => {
      const decision = service.evaluate({
        actionType: 'CREATE_PAYMENT',
        entityType: 'Payment',
        agentGuardrails: makeGuardrails({ canWrite: ['Payment'] }),
      });

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(true);
      expect(decision.rulesTriggered).toContain('FINANCIAL_SAFETY');
    });

    it('RUN_PAYROLL always requires approval', () => {
      const decision = service.evaluate({
        actionType: 'RUN_PAYROLL',
        entityType: 'Payroll',
        agentGuardrails: makeGuardrails({ canWrite: ['Payroll'] }),
      });

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(true);
      expect(decision.rulesTriggered).toContain('FINANCIAL_SAFETY');
    });
  });

  // ─── Non-Financial Actions ───────────────────────────────────────────

  describe('non-financial actions', () => {
    it('SEND_EMAIL does NOT require approval when agent guardrails allow', () => {
      const decision = service.evaluate({
        actionType: 'SEND_EMAIL',
        entityType: 'Email',
        agentGuardrails: makeGuardrails({ requiresApproval: false }),
      });

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(false);
      expect(decision.rulesTriggered).toEqual([]);
      expect(decision.reason).toBe('Action allowed');
    });
  });

  // ─── Blocklist (Rule 1) ──────────────────────────────────────────────

  describe('operation blocklist', () => {
    it('blocked operation returns allowed=false', () => {
      const decision = service.evaluate({
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

    it('blocklist check is case-insensitive', () => {
      const decision = service.evaluate({
        actionType: 'delete_customer',
        entityType: 'Customer',
        agentGuardrails: makeGuardrails({
          blockedOperations: ['DELETE_CUSTOMER'],
        }),
      });

      expect(decision.allowed).toBe(false);
      expect(decision.rulesTriggered).toContain('OPERATION_BLOCKLIST');
    });
  });

  // ─── Write Permission (Rule 2) ───────────────────────────────────────

  describe('write permission', () => {
    it('entity not in canWrite returns allowed=false', () => {
      const decision = service.evaluate({
        actionType: 'CREATE_ORDER',
        entityType: 'SalesOrder',
        agentGuardrails: makeGuardrails({
          canWrite: ['CustomerInvoice'],
        }),
      });

      expect(decision.allowed).toBe(false);
      expect(decision.reason).toBe('Agent lacks write permission for this entity type');
      expect(decision.rulesTriggered).toContain('WRITE_PERMISSION');
    });

    it('read-only actions are not blocked by write permission check', () => {
      const decision = service.evaluate({
        actionType: 'QUERY_INVOICES',
        entityType: 'CustomerInvoice',
        agentGuardrails: makeGuardrails({
          canWrite: [], // no write permissions
        }),
      });

      // QUERY_ is not a write prefix, so write permission check is skipped
      expect(decision.allowed).toBe(true);
    });
  });

  // ─── Amount Threshold (Rule 4) ───────────────────────────────────────

  describe('amount threshold', () => {
    it('amount above threshold sets requiresApproval=true', () => {
      const decision = service.evaluate({
        actionType: 'SEND_EMAIL',
        entityType: 'Email',
        agentGuardrails: makeGuardrails({
          maxAmountWithoutApproval: '1000',
        }),
        amount: 5000,
      });

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(true);
      expect(decision.rulesTriggered).toContain('AMOUNT_THRESHOLD');
    });

    it('amount below threshold does NOT set requiresApproval for non-financial action', () => {
      const decision = service.evaluate({
        actionType: 'SEND_EMAIL',
        entityType: 'Email',
        agentGuardrails: makeGuardrails({
          maxAmountWithoutApproval: '1000',
        }),
        amount: 500,
      });

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(false);
      expect(decision.rulesTriggered).not.toContain('AMOUNT_THRESHOLD');
    });

    it('amount exactly at threshold does NOT trigger approval', () => {
      const decision = service.evaluate({
        actionType: 'SEND_EMAIL',
        entityType: 'Email',
        agentGuardrails: makeGuardrails({
          maxAmountWithoutApproval: '1000',
        }),
        amount: 1000,
      });

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(false);
    });
  });

  // ─── Agent-Level Approval (Rule 5) ───────────────────────────────────

  describe('agent-level approval', () => {
    it('agent with requiresApproval=true forces approval on all actions', () => {
      const decision = service.evaluate({
        actionType: 'SEND_EMAIL',
        entityType: 'Email',
        agentGuardrails: makeGuardrails({
          requiresApproval: true,
        }),
      });

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(true);
      expect(decision.rulesTriggered).toContain('AGENT_REQUIRES_APPROVAL');
    });
  });

  // ─── isFinancialAction ───────────────────────────────────────────────

  describe('isFinancialAction', () => {
    it('returns true for all FINANCIAL_ACTION_TYPES', () => {
      for (const actionType of FINANCIAL_ACTION_TYPES) {
        expect(service.isFinancialAction(actionType)).toBe(true);
      }
    });

    it('returns false for non-financial types', () => {
      expect(service.isFinancialAction('SEND_EMAIL')).toBe(false);
      expect(service.isFinancialAction('CREATE_CONTACT')).toBe(false);
      expect(service.isFinancialAction('UPDATE_CUSTOMER')).toBe(false);
      expect(service.isFinancialAction('QUERY_INVOICES')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(service.isFinancialAction('create_invoice')).toBe(true);
      expect(service.isFinancialAction('Create_Invoice')).toBe(true);
      expect(service.isFinancialAction('post_journal')).toBe(true);
    });
  });

  // ─── Logging ─────────────────────────────────────────────────────────

  describe('logging', () => {
    it('guardrail decision logs include all triggered rules', () => {
      service.evaluate({
        actionType: 'CREATE_INVOICE',
        entityType: 'CustomerInvoice',
        agentGuardrails: makeGuardrails({
          requiresApproval: true,
          maxAmountWithoutApproval: '100',
        }),
        amount: 5000,
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'CREATE_INVOICE',
          entityType: 'CustomerInvoice',
          allowed: true,
          requiresApproval: true,
          rulesTriggered: expect.arrayContaining([
            'FINANCIAL_SAFETY',
            'AMOUNT_THRESHOLD',
            'AGENT_REQUIRES_APPROVAL',
          ]),
        }),
        'Guardrail decision',
      );
    });

    it('logs blocked operations', () => {
      service.evaluate({
        actionType: 'DELETE_ALL',
        entityType: 'Customer',
        agentGuardrails: makeGuardrails({
          blockedOperations: ['DELETE_ALL'],
        }),
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          actionType: 'DELETE_ALL',
          allowed: false,
          rulesTriggered: ['OPERATION_BLOCKLIST'],
        }),
        'Guardrail decision',
      );
    });
  });

  // ─── Combined Rules ──────────────────────────────────────────────────

  describe('combined rules', () => {
    it('financial action with amount threshold triggers both rules', () => {
      const decision = service.evaluate({
        actionType: 'CREATE_INVOICE',
        entityType: 'CustomerInvoice',
        agentGuardrails: makeGuardrails({
          maxAmountWithoutApproval: '1000',
        }),
        amount: 5000,
      });

      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(true);
      expect(decision.rulesTriggered).toContain('FINANCIAL_SAFETY');
      expect(decision.rulesTriggered).toContain('AMOUNT_THRESHOLD');
    });

    it('blocklist takes precedence over all other rules', () => {
      const decision = service.evaluate({
        actionType: 'CREATE_INVOICE',
        entityType: 'CustomerInvoice',
        agentGuardrails: makeGuardrails({
          blockedOperations: ['CREATE_INVOICE'],
        }),
      });

      // Blocklist returns early — no financial safety or other checks
      expect(decision.allowed).toBe(false);
      expect(decision.rulesTriggered).toEqual(['OPERATION_BLOCKLIST']);
      expect(decision.rulesTriggered).not.toContain('FINANCIAL_SAFETY');
    });
  });
});
