import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantLifecycleService } from '../services/tenant-lifecycle.service.js';
import type { PlatformAuditService } from '../core/audit/platform-audit.service.js';
import type { WebhookService } from '../services/tenant-lifecycle.service.js';

// ---------------------------------------------------------------------------
// Mock constants
// ---------------------------------------------------------------------------

const TENANT_ID = '00000000-0000-4000-b000-000000000100';
const PLAN_ID = '00000000-0000-4000-b000-000000000200';
const ADMIN_USER_ID = '00000000-0000-4000-b000-000000000020';

const AUDIT_CTX = {
  platformUserId: ADMIN_USER_ID,
  ipAddress: '127.0.0.1',
  userAgent: 'test-agent',
};

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------

const mockTenantCreate = vi.fn();
const mockTenantUpdate = vi.fn();
const mockTenantBillingCreate = vi.fn();
const mockTenantAiQuotaCreate = vi.fn();
const mockPlanFindUniqueOrThrow = vi.fn();
const mockQueryRaw = vi.fn();

const mockTransaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
  const txProxy = {
    tenant: {
      create: (...args: unknown[]) => mockTenantCreate(...args),
      update: (...args: unknown[]) => mockTenantUpdate(...args),
    },
    tenantBilling: {
      create: (...args: unknown[]) => mockTenantBillingCreate(...args),
    },
    tenantAiQuota: {
      create: (...args: unknown[]) => mockTenantAiQuotaCreate(...args),
    },
    plan: {
      findUniqueOrThrow: (...args: unknown[]) => mockPlanFindUniqueOrThrow(...args),
    },
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  };
  return fn(txProxy);
});

vi.mock('../../src/client.js', () => ({
  getPlatformPrisma: () => ({
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  }),
}));

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockAuditLog = vi.fn().mockResolvedValue(undefined);
const mockPushWebhook = vi.fn().mockResolvedValue(undefined);

const mockAuditService = {
  log: mockAuditLog,
  setLogger: vi.fn(),
} as unknown as PlatformAuditService;

const mockWebhookService: WebhookService = {
  pushWebhook: mockPushWebhook,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTenantRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: TENANT_ID,
    code: 'acme-corp',
    displayName: 'Acme Corp',
    legalName: null,
    status: 'PROVISIONING',
    billingStatus: 'CURRENT',
    planId: PLAN_ID,
    region: 'uk-south',
    sandboxEnabled: false,
    lastActivityAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    plan: { id: PLAN_ID, code: 'starter', displayName: 'Starter Plan' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TenantLifecycleService (E3b.2 Task 7)', () => {
  let service: TenantLifecycleService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TenantLifecycleService(mockAuditService, mockWebhookService);
  });

  // =========================================================================
  // validateTransition
  // =========================================================================
  describe('validateTransition', () => {
    describe('valid transitions pass', () => {
      it.each([
        ['PROVISIONING', 'ACTIVE'],
        ['ACTIVE', 'SUSPENDED'],
        ['ACTIVE', 'READ_ONLY'],
        ['READ_ONLY', 'ACTIVE'],
        ['READ_ONLY', 'SUSPENDED'],
        ['SUSPENDED', 'ACTIVE'],
        ['SUSPENDED', 'ARCHIVED'],
      ])('%s -> %s should not throw', (from, to) => {
        expect(() => service.validateTransition(from as any, to as any)).not.toThrow();
      });
    });

    describe('invalid transitions throw DomainError', () => {
      it.each([
        ['PROVISIONING', 'SUSPENDED'],
        ['PROVISIONING', 'ARCHIVED'],
        ['PROVISIONING', 'READ_ONLY'],
        ['ACTIVE', 'PROVISIONING'],
        ['ACTIVE', 'ARCHIVED'],
        ['SUSPENDED', 'PROVISIONING'],
        ['SUSPENDED', 'READ_ONLY'],
        ['ARCHIVED', 'PROVISIONING'],
        ['ARCHIVED', 'ACTIVE'],
        ['ARCHIVED', 'SUSPENDED'],
        ['ARCHIVED', 'READ_ONLY'],
      ])('%s -> %s should throw INVALID_STATE_TRANSITION', (from, to) => {
        expect(() => service.validateTransition(from as any, to as any)).toThrow(
          'Cannot transition tenant from',
        );
      });
    });

    it('ARCHIVED has no outbound transitions (BR-PLT-003)', () => {
      const allStatuses = ['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'READ_ONLY', 'ARCHIVED'] as const;
      for (const target of allStatuses) {
        expect(() =>
          service.validateTransition('ARCHIVED' as any, target as any),
        ).toThrow('Cannot transition tenant from');
      }
    });
  });

  // =========================================================================
  // createTenant
  // =========================================================================
  describe('createTenant', () => {
    it('creates Tenant + TenantBilling + TenantAiQuota in a transaction', async () => {
      const created = makeTenantRecord();
      mockTenantCreate.mockResolvedValue(created);
      mockTenantBillingCreate.mockResolvedValue({ id: 'billing-1' });
      mockTenantAiQuotaCreate.mockResolvedValue({ id: 'quota-1' });

      const result = await service.createTenant(
        {
          code: 'acme-corp',
          displayName: 'Acme Corp',
          planId: PLAN_ID,
          region: 'uk-south',
          dbHost: 'db-1.internal',
          dbName: 'tenant_acme',
          dbPort: 5432,
          sandboxEnabled: false,
          monthlyAiTokenAllowance: BigInt(1_000_000),
        },
        AUDIT_CTX,
      );

      // Transaction was called
      expect(mockTransaction).toHaveBeenCalledTimes(1);

      // Tenant created in PROVISIONING status
      expect(mockTenantCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            code: 'acme-corp',
            status: 'PROVISIONING',
          }) as Record<string, unknown>,
        }),
      );

      // TenantBilling created
      expect(mockTenantBillingCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            gracePeriodDays: 14,
          }) as Record<string, unknown>,
        }),
      );

      // TenantAiQuota created with passed token allowance (no redundant plan query)
      expect(mockTenantAiQuotaCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_ID,
            tokenAllowance: BigInt(1_000_000),
          }) as Record<string, unknown>,
        }),
      );

      // Audit log created
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tenant.create',
          targetType: 'tenant',
          targetId: TENANT_ID,
        }),
      );

      expect(result.id).toBe(TENANT_ID);
      expect(result.status).toBe('PROVISIONING');
    });

    it('audit failure does not break creation (BR-PLT-017)', async () => {
      mockTenantCreate.mockResolvedValue(makeTenantRecord());
      mockTenantBillingCreate.mockResolvedValue({ id: 'billing-1' });
      mockTenantAiQuotaCreate.mockResolvedValue({ id: 'quota-1' });
      mockAuditLog.mockRejectedValueOnce(new Error('DB connection failed'));

      const result = await service.createTenant(
        {
          code: 'acme-corp',
          displayName: 'Acme Corp',
          planId: PLAN_ID,
          region: 'uk-south',
          dbHost: 'db-1.internal',
          dbName: 'tenant_acme',
          dbPort: 5432,
          sandboxEnabled: false,
          monthlyAiTokenAllowance: BigInt(1_000_000),
        },
        AUDIT_CTX,
      );

      // Operation still succeeds despite audit failure
      expect(result.id).toBe(TENANT_ID);
    });
  });

  // =========================================================================
  // activateTenant
  // =========================================================================
  describe('activateTenant', () => {
    it('transitions PROVISIONING -> ACTIVE', async () => {
      mockQueryRaw.mockResolvedValue([{ id: TENANT_ID, status: 'PROVISIONING' }]);
      const activated = makeTenantRecord({ status: 'ACTIVE', lastActivityAt: new Date() });
      mockTenantUpdate.mockResolvedValue(activated);

      const result = await service.activateTenant(TENANT_ID, AUDIT_CTX);

      expect(result.status).toBe('ACTIVE');
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'tenant.activate' }),
      );
    });

    it('does NOT fire tenant.created webhook on PROVISIONING -> ACTIVE (ERP not provisioned yet)', async () => {
      mockQueryRaw.mockResolvedValue([{ id: TENANT_ID, status: 'PROVISIONING' }]);
      const activated = makeTenantRecord({ status: 'ACTIVE', lastActivityAt: new Date() });
      mockTenantUpdate.mockResolvedValue(activated);

      await service.activateTenant(TENANT_ID, AUDIT_CTX);

      // tenant.created event is internal only — NOT pushed as webhook to ERP
      // because the ERP is not provisioned yet at this point (Event Catalog §19)
      expect(mockPushWebhook).not.toHaveBeenCalled();
    });

    it('throws NotFoundError for non-existent tenant', async () => {
      mockQueryRaw.mockResolvedValue([]);

      await expect(
        service.activateTenant(TENANT_ID, AUDIT_CTX),
      ).rejects.toThrow('Tenant not found');
    });

    it('throws DomainError for invalid transition', async () => {
      mockQueryRaw.mockResolvedValue([{ id: TENANT_ID, status: 'ARCHIVED' }]);

      await expect(
        service.activateTenant(TENANT_ID, AUDIT_CTX),
      ).rejects.toThrow('Cannot transition tenant from');
    });
  });

  // =========================================================================
  // suspendTenant
  // =========================================================================
  describe('suspendTenant', () => {
    it('transitions ACTIVE -> SUSPENDED and fires webhook', async () => {
      mockQueryRaw.mockResolvedValue([{ id: TENANT_ID, status: 'ACTIVE' }]);
      const suspended = makeTenantRecord({ status: 'SUSPENDED' });
      mockTenantUpdate.mockResolvedValue(suspended);

      const result = await service.suspendTenant(TENANT_ID, 'Non-payment', AUDIT_CTX);

      expect(result.status).toBe('SUSPENDED');
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tenant.suspend',
          details: expect.objectContaining({ reason: 'Non-payment' }) as Record<string, unknown>,
        }),
      );
      expect(mockPushWebhook).toHaveBeenCalledWith(
        'acme-corp',
        'tenant.suspended',
        expect.objectContaining({
          tenantId: TENANT_ID,
          reason: 'Non-payment',
          suspendedBy: ADMIN_USER_ID,
        }),
      );
    });

    it('transitions READ_ONLY -> SUSPENDED', async () => {
      mockQueryRaw.mockResolvedValue([{ id: TENANT_ID, status: 'READ_ONLY' }]);
      mockTenantUpdate.mockResolvedValue(makeTenantRecord({ status: 'SUSPENDED' }));

      const result = await service.suspendTenant(TENANT_ID, 'Escalation', AUDIT_CTX);
      expect(result.status).toBe('SUSPENDED');
    });
  });

  // =========================================================================
  // reactivateTenant
  // =========================================================================
  describe('reactivateTenant', () => {
    it('transitions SUSPENDED -> ACTIVE and fires webhook', async () => {
      mockQueryRaw.mockResolvedValue([{ id: TENANT_ID, status: 'SUSPENDED' }]);
      const reactivated = makeTenantRecord({ status: 'ACTIVE' });
      mockTenantUpdate.mockResolvedValue(reactivated);

      const result = await service.reactivateTenant(TENANT_ID, AUDIT_CTX);

      expect(result.status).toBe('ACTIVE');
      expect(mockPushWebhook).toHaveBeenCalledWith(
        'acme-corp',
        'tenant.reactivated',
        expect.objectContaining({
          tenantId: TENANT_ID,
          reactivatedBy: ADMIN_USER_ID,
        }),
      );
    });
  });

  // =========================================================================
  // archiveTenant
  // =========================================================================
  describe('archiveTenant', () => {
    it('transitions SUSPENDED -> ARCHIVED and fires webhook', async () => {
      mockQueryRaw.mockResolvedValue([{ id: TENANT_ID, status: 'SUSPENDED' }]);
      const archived = makeTenantRecord({ status: 'ARCHIVED' });
      mockTenantUpdate.mockResolvedValue(archived);

      const result = await service.archiveTenant(TENANT_ID, AUDIT_CTX);

      expect(result.status).toBe('ARCHIVED');
      expect(mockPushWebhook).toHaveBeenCalledWith(
        'acme-corp',
        'tenant.archived',
        expect.objectContaining({
          tenantId: TENANT_ID,
          archivedBy: ADMIN_USER_ID,
        }),
      );
    });

    it('rejects ACTIVE -> ARCHIVED (must go through SUSPENDED first)', async () => {
      mockQueryRaw.mockResolvedValue([{ id: TENANT_ID, status: 'ACTIVE' }]);

      await expect(
        service.archiveTenant(TENANT_ID, AUDIT_CTX),
      ).rejects.toThrow('Cannot transition tenant from');
    });
  });
});
