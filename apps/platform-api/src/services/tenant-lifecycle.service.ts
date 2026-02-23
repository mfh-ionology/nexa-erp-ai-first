// ---------------------------------------------------------------------------
// TenantLifecycleService — Tenant state machine + lifecycle business logic
// Source: State Machine Reference §20.1, BR-PLT-001 (strict state machine),
// BR-PLT-003 (ARCHIVED irrecoverable), BR-PLT-017 (every state-changing action logged)
// ---------------------------------------------------------------------------

import {
  TenantStatus,
  EnforcementAction,
} from '../../generated/platform-prisma/client';
import { getPlatformPrisma } from '../client.js';
import { DomainError, NotFoundError } from '../core/errors/app-error.js';
import type { PlatformAuditService } from '../core/audit/platform-audit.service.js';
import type {
  WebhookEventName,
  WebhookEventPayload,
} from './webhook.service.js';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Webhook service interface — implementation in webhook.service.ts (Task 3) */
export interface WebhookService {
  pushWebhook(
    tenantCode: string,
    event: WebhookEventName,
    payload: WebhookEventPayload,
  ): Promise<void>;
}

/** Request context for audit logging */
export interface AuditContext {
  platformUserId: string;
  ipAddress: string;
  userAgent?: string;
}

/** Data required to create a new tenant */
export interface CreateTenantData {
  code: string;
  displayName: string;
  legalName?: string;
  planId: string;
  region: string;
  dbHost: string;
  dbName: string;
  dbPort: number;
  sandboxEnabled: boolean;
  /** Plan's monthly AI token allowance — passed from route to avoid redundant plan lookup */
  monthlyAiTokenAllowance: bigint;
}

// ---------------------------------------------------------------------------
// State machine (State Machine Reference §20.1)
// ---------------------------------------------------------------------------

/**
 * Valid tenant lifecycle state transitions.
 *
 * PROVISIONING -> [ACTIVE]
 * ACTIVE       -> [SUSPENDED, READ_ONLY]
 * READ_ONLY    -> [ACTIVE, SUSPENDED]
 * SUSPENDED    -> [ACTIVE, ARCHIVED]
 * ARCHIVED     -> [] (terminal — no outbound transitions, BR-PLT-003)
 *
 * Note: BR-PLT-001 says "Only ACTIVE tenants can be suspended" but State
 * Machine Reference §20.1 explicitly allows READ_ONLY -> SUSPENDED as a
 * billing escalation path. We follow §20.1 as the more detailed authority.
 * BR-PLT-001 wording should be updated to reflect this.
 */
const VALID_TRANSITIONS: Record<TenantStatus, TenantStatus[]> = {
  [TenantStatus.PROVISIONING]: [TenantStatus.ACTIVE],
  [TenantStatus.ACTIVE]: [TenantStatus.SUSPENDED, TenantStatus.READ_ONLY],
  [TenantStatus.READ_ONLY]: [TenantStatus.ACTIVE, TenantStatus.SUSPENDED],
  [TenantStatus.SUSPENDED]: [TenantStatus.ACTIVE, TenantStatus.ARCHIVED],
  [TenantStatus.ARCHIVED]: [],
};

/** Fields selected when returning tenant records from service methods */
const TENANT_SELECT = {
  id: true,
  code: true,
  displayName: true,
  legalName: true,
  status: true,
  billingStatus: true,
  planId: true,
  region: true,
  sandboxEnabled: true,
  lastActivityAt: true,
  createdAt: true,
  updatedAt: true,
  plan: { select: { id: true, code: true, displayName: true } },
} as const;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class TenantLifecycleService {
  constructor(
    private readonly platformAudit: PlatformAuditService,
    private readonly webhookService: WebhookService,
  ) {}

  // -------------------------------------------------------------------------
  // State machine validation
  // -------------------------------------------------------------------------

  /**
   * Validate a state transition against the tenant lifecycle state machine.
   * Throws DomainError (422) if the transition is not allowed (BR-PLT-001).
   */
  validateTransition(
    currentStatus: TenantStatus,
    targetStatus: TenantStatus,
  ): void {
    const allowed = VALID_TRANSITIONS[currentStatus];
    if (!allowed.includes(targetStatus)) {
      throw new DomainError(
        'INVALID_STATE_TRANSITION',
        `Cannot transition tenant from ${currentStatus} to ${targetStatus}`,
        {
          currentStatus: [currentStatus as string],
          targetStatus: [targetStatus as string],
          allowedTransitions: allowed.map(String),
        },
      );
    }
  }

  // -------------------------------------------------------------------------
  // Tenant creation
  // -------------------------------------------------------------------------

  /**
   * Create a new tenant in PROVISIONING status.
   * Creates Tenant + TenantBilling + TenantAiQuota in a single transaction.
   */
  async createTenant(data: CreateTenantData, ctx: AuditContext) {
    const prisma = getPlatformPrisma();

    const tenant = await prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          code: data.code,
          displayName: data.displayName,
          legalName: data.legalName ?? null,
          planId: data.planId,
          region: data.region,
          dbHost: data.dbHost,
          dbName: data.dbName,
          dbPort: data.dbPort,
          sandboxEnabled: data.sandboxEnabled,
          status: TenantStatus.PROVISIONING,
        },
        select: TENANT_SELECT,
      });

      // Create TenantBilling record with defaults
      await tx.tenantBilling.create({
        data: {
          tenantId: created.id,
          gracePeriodDays: 14,
          enforcementAction: EnforcementAction.NONE,
        },
      });

      // Create TenantAiQuota record based on plan's token allowance
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);
      // Clamp to avoid month overflow (e.g., Jan 31 + 1 month = Mar 3, not Feb 28)
      if (periodEnd.getDate() < now.getDate()) {
        periodEnd.setDate(0); // Last day of the intended month
      }

      await tx.tenantAiQuota.create({
        data: {
          tenantId: created.id,
          periodStart: now,
          periodEnd: periodEnd,
          tokenAllowance: data.monthlyAiTokenAllowance,
        },
      });

      return created;
    });

    // Audit log (try/catch — audit failures must not break operations, BR-PLT-017)
    try {
      await this.platformAudit.log({
        platformUserId: ctx.platformUserId,
        action: 'tenant.create',
        targetType: 'tenant',
        targetId: tenant.id,
        details: { code: tenant.code, planId: data.planId },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    } catch {
      // Audit failures must not break operations (BR-PLT-017)
    }

    return tenant;
  }

  // -------------------------------------------------------------------------
  // Lifecycle transitions
  // -------------------------------------------------------------------------

  /**
   * Activate a tenant: PROVISIONING -> ACTIVE.
   * Sets lastActivityAt. Creates audit log entry.
   * Fires tenant.created webhook (Event Catalog §19).
   */
  async activateTenant(tenantId: string, ctx: AuditContext) {
    const prisma = getPlatformPrisma();

    const { tenant, previousStatus } = await prisma.$transaction(
      async (tx) => {
        // SELECT FOR UPDATE to prevent race conditions
        const rows = await tx.$queryRaw<
          Array<{ id: string; status: string }>
        >`SELECT id, status FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;

        const row = rows[0];
        if (!row) {
          throw new NotFoundError('TENANT_NOT_FOUND', 'Tenant not found');
        }

        const prevStatus = row.status as TenantStatus;
        this.validateTransition(prevStatus, TenantStatus.ACTIVE);

        const updated = await tx.tenant.update({
          where: { id: tenantId },
          data: {
            status: TenantStatus.ACTIVE,
            lastActivityAt: new Date(),
          },
          select: TENANT_SELECT,
        });

        return { tenant: updated, previousStatus: prevStatus };
      },
    );

    // Audit log
    try {
      await this.platformAudit.log({
        platformUserId: ctx.platformUserId,
        action: 'tenant.activate',
        targetType: 'tenant',
        targetId: tenantId,
        details: { previousStatus },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    } catch {
      // Audit failures must not break operations (BR-PLT-017)
    }

    // tenant.created event is emitted internally (AC #2) but NOT pushed as a
    // webhook to ERP — the ERP is not provisioned yet at this point (Event
    // Catalog §19, "Webhook to ERP? No"). The audit log above captures the event.

    return tenant;
  }

  /**
   * Suspend a tenant: ACTIVE -> SUSPENDED or READ_ONLY -> SUSPENDED.
   * Requires a reason (BR-PLT-001). Pushes tenant.suspended webhook.
   */
  async suspendTenant(tenantId: string, reason: string, ctx: AuditContext) {
    const prisma = getPlatformPrisma();

    const { tenant, previousStatus } = await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{ id: string; status: string }>
        >`SELECT id, status FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;

        const row = rows[0];
        if (!row) {
          throw new NotFoundError('TENANT_NOT_FOUND', 'Tenant not found');
        }

        const prevStatus = row.status as TenantStatus;
        this.validateTransition(prevStatus, TenantStatus.SUSPENDED);

        const updated = await tx.tenant.update({
          where: { id: tenantId },
          data: { status: TenantStatus.SUSPENDED },
          select: TENANT_SELECT,
        });

        return { tenant: updated, previousStatus: prevStatus };
      },
    );

    // Audit log
    try {
      await this.platformAudit.log({
        platformUserId: ctx.platformUserId,
        action: 'tenant.suspend',
        targetType: 'tenant',
        targetId: tenantId,
        details: { reason, previousStatus },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    } catch {
      // Audit failures must not break operations (BR-PLT-017)
    }

    // Webhook: fire-and-forget (webhook service handles retries and logging)
    this.fireWebhook(tenant.code, 'tenant.suspended', {
      tenantId,
      reason,
      suspendedBy: ctx.platformUserId,
      enforcementAction: EnforcementAction.SUSPENDED,
    });

    return tenant;
  }

  /**
   * Reactivate a tenant: SUSPENDED -> ACTIVE (or READ_ONLY -> ACTIVE).
   * Sets lastActivityAt. Pushes tenant.reactivated webhook.
   */
  async reactivateTenant(tenantId: string, ctx: AuditContext) {
    const prisma = getPlatformPrisma();

    const { tenant, previousStatus } = await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{ id: string; status: string }>
        >`SELECT id, status FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;

        const row = rows[0];
        if (!row) {
          throw new NotFoundError('TENANT_NOT_FOUND', 'Tenant not found');
        }

        const prevStatus = row.status as TenantStatus;
        this.validateTransition(prevStatus, TenantStatus.ACTIVE);

        const updated = await tx.tenant.update({
          where: { id: tenantId },
          data: {
            status: TenantStatus.ACTIVE,
            lastActivityAt: new Date(),
          },
          select: TENANT_SELECT,
        });

        return { tenant: updated, previousStatus: prevStatus };
      },
    );

    // Audit log
    try {
      await this.platformAudit.log({
        platformUserId: ctx.platformUserId,
        action: 'tenant.reactivate',
        targetType: 'tenant',
        targetId: tenantId,
        details: { previousStatus },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    } catch {
      // Audit failures must not break operations (BR-PLT-017)
    }

    // Webhook: fire-and-forget
    this.fireWebhook(tenant.code, 'tenant.reactivated', {
      tenantId,
      reactivatedBy: ctx.platformUserId,
    });

    return tenant;
  }

  /**
   * Archive a tenant: SUSPENDED -> ARCHIVED.
   * ARCHIVED is irrecoverable from UI (BR-PLT-003).
   * Pushes tenant.archived webhook.
   */
  async archiveTenant(tenantId: string, ctx: AuditContext) {
    const prisma = getPlatformPrisma();

    const { tenant, previousStatus } = await prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          Array<{ id: string; status: string }>
        >`SELECT id, status FROM tenants WHERE id = ${tenantId}::uuid FOR UPDATE`;

        const row = rows[0];
        if (!row) {
          throw new NotFoundError('TENANT_NOT_FOUND', 'Tenant not found');
        }

        const prevStatus = row.status as TenantStatus;
        this.validateTransition(prevStatus, TenantStatus.ARCHIVED);

        const updated = await tx.tenant.update({
          where: { id: tenantId },
          data: { status: TenantStatus.ARCHIVED },
          select: TENANT_SELECT,
        });

        return { tenant: updated, previousStatus: prevStatus };
      },
    );

    // Audit log
    try {
      await this.platformAudit.log({
        platformUserId: ctx.platformUserId,
        action: 'tenant.archive',
        targetType: 'tenant',
        targetId: tenantId,
        details: { previousStatus },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    } catch {
      // Audit failures must not break operations (BR-PLT-017)
    }

    // Webhook: fire-and-forget
    this.fireWebhook(tenant.code, 'tenant.archived', {
      tenantId,
      archivedBy: ctx.platformUserId,
    });

    return tenant;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Fire a webhook without blocking the caller.
   * The webhook service handles retries and error logging internally.
   */
  private fireWebhook(
    tenantCode: string,
    event: WebhookEventName,
    payload: WebhookEventPayload,
  ): void {
    this.webhookService
      .pushWebhook(tenantCode, event, payload)
      .catch(() => {
        // Webhook service already logs failures — this catch prevents unhandled rejection
      });
  }
}
