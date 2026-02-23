// ---------------------------------------------------------------------------
// BillingEnforcementService — Billing enforcement state machine
// Source: State Machine Reference §20.2, BR-PLT-004, BR-PLT-005, BR-PLT-017
// Story: E3b.5 Task 4
// ---------------------------------------------------------------------------

import {
  BillingStatus,
  EnforcementAction,
  TenantStatus,
} from '../../generated/platform-prisma/client';
import { getPlatformPrisma } from '../client.js';
import { DomainError, NotFoundError } from '../core/errors/app-error.js';
import type { PlatformAuditService } from '../core/audit/platform-audit.service.js';
import type { WebhookEventName, WebhookEventPayload } from './webhook.service.js';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Webhook pusher — uses the typed WebhookService interface */
export interface BillingWebhookPusher {
  pushWebhook(
    tenantCode: string,
    event: WebhookEventName,
    payload: WebhookEventPayload,
  ): Promise<void>;
}

export interface EnforcementAuditContext {
  platformUserId: string;
  ipAddress: string;
  userAgent?: string;
}

export interface EnforcementTransitionResult {
  tenantId: string;
  previousAction: string;
  newAction: string;
  effectiveAt: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Enforcement State Machine (BR-PLT-004)
// ---------------------------------------------------------------------------

/**
 * Valid billing enforcement state transitions.
 *
 * NONE      -> [WARNING]
 * WARNING   -> [NONE, READ_ONLY]
 * READ_ONLY -> [NONE, WARNING, SUSPENDED]
 * SUSPENDED -> [NONE]
 *
 * Skipping levels (e.g. NONE -> READ_ONLY) is NOT allowed.
 * Reactivation from SUSPENDED goes directly to NONE (full payment + admin).
 */
const VALID_ENFORCEMENT_TRANSITIONS: Record<EnforcementAction, EnforcementAction[]> = {
  [EnforcementAction.NONE]: [EnforcementAction.WARNING],
  [EnforcementAction.WARNING]: [EnforcementAction.NONE, EnforcementAction.READ_ONLY],
  [EnforcementAction.READ_ONLY]: [
    EnforcementAction.NONE,
    EnforcementAction.WARNING,
    EnforcementAction.SUSPENDED,
  ],
  [EnforcementAction.SUSPENDED]: [EnforcementAction.NONE],
};

/** Map enforcement action to billing status for Tenant.billingStatus */
const ENFORCEMENT_TO_BILLING_STATUS: Record<EnforcementAction, BillingStatus> = {
  [EnforcementAction.NONE]: BillingStatus.CURRENT,
  [EnforcementAction.WARNING]: BillingStatus.GRACE,
  [EnforcementAction.READ_ONLY]: BillingStatus.OVERDUE,
  [EnforcementAction.SUSPENDED]: BillingStatus.BLOCKED,
};

/**
 * Validate whether an enforcement transition is allowed.
 */
export function validateEnforcementTransition(
  current: EnforcementAction,
  target: EnforcementAction,
): boolean {
  return VALID_ENFORCEMENT_TRANSITIONS[current].includes(target);
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/** Minimal logger interface matching Fastify's BaseLogger */
export interface EnforcementLogger {
  error: (...args: unknown[]) => void;
}

export class BillingEnforcementService {
  private readonly logger: EnforcementLogger;

  constructor(
    private readonly platformAudit: PlatformAuditService,
    private readonly webhookService: BillingWebhookPusher,
    logger?: EnforcementLogger,
  ) {
    this.logger = logger ?? console;
  }

  /**
   * Transition a tenant's billing enforcement action.
   *
   * - Validates the transition is allowed per the state machine
   * - Updates TenantBilling.enforcementAction and Tenant.billingStatus in a transaction
   * - If transitioning to SUSPENDED, also sets Tenant.status = SUSPENDED
   * - If reactivating from SUSPENDED → NONE, sets Tenant.status = ACTIVE
   * - Pushes billing.enforcement_changed webhook
   * - Creates PlatformAuditLog entry (BR-PLT-017)
   * - Idempotent: if already at target action, returns 200 without side effects
   */
  async transitionEnforcement(
    tenantId: string,
    newAction: EnforcementAction,
    reason: string,
    ctx: EnforcementAuditContext,
    gracePeriodDays?: number,
  ): Promise<EnforcementTransitionResult> {
    const prisma = getPlatformPrisma();

    // All reads and writes inside a single transaction to prevent TOCTOU races
    const { tenant, previousAction, wasIdempotent } = await prisma.$transaction(async (tx) => {
      // Validate tenant exists
      const t = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, code: true, status: true },
      });

      if (!t) {
        throw new NotFoundError('TENANT_NOT_FOUND', 'Tenant not found');
      }

      // Get or create billing record (upsert pattern to avoid race on concurrent create)
      let billing = await tx.tenantBilling.findUnique({
        where: { tenantId },
      });

      if (!billing) {
        billing = await tx.tenantBilling.create({
          data: {
            tenantId,
            enforcementAction: EnforcementAction.NONE,
            dunningLevel: 0,
            gracePeriodDays: 14,
          },
        });
      }

      const prevAction = billing.enforcementAction;

      // Idempotent: already at target action — return without side effects
      if (prevAction === newAction) {
        return { tenant: t, previousAction: prevAction, wasIdempotent: true };
      }

      // Validate transition per state machine (BR-PLT-004)
      if (!validateEnforcementTransition(prevAction, newAction)) {
        throw new DomainError(
          'INVALID_ENFORCEMENT_TRANSITION',
          `Cannot transition enforcement from ${prevAction} to ${newAction}`,
          {
            currentAction: [prevAction],
            targetAction: [newAction],
            allowedTransitions: VALID_ENFORCEMENT_TRANSITIONS[prevAction].map(String),
          },
        );
      }

      const newBillingStatus = ENFORCEMENT_TO_BILLING_STATUS[newAction];

      // Update TenantBilling enforcement action (+ optional grace period)
      await tx.tenantBilling.update({
        where: { tenantId },
        data: {
          enforcementAction: newAction,
          ...(gracePeriodDays !== undefined ? { gracePeriodDays } : {}),
        },
      });

      // Build tenant update: always update billingStatus
      const tenantUpdate: {
        billingStatus: BillingStatus;
        status?: TenantStatus;
        lastActivityAt?: Date;
      } = {
        billingStatus: newBillingStatus,
      };

      // If escalating to SUSPENDED, also set Tenant.status = SUSPENDED
      if (newAction === EnforcementAction.SUSPENDED) {
        tenantUpdate.status = TenantStatus.SUSPENDED;
      }

      // If reactivating from SUSPENDED → NONE, set Tenant.status = ACTIVE
      if (
        prevAction === EnforcementAction.SUSPENDED &&
        newAction === EnforcementAction.NONE
      ) {
        tenantUpdate.status = TenantStatus.ACTIVE;
        tenantUpdate.lastActivityAt = new Date();
      }

      await tx.tenant.update({
        where: { id: tenantId },
        data: tenantUpdate,
      });

      return { tenant: t, previousAction: prevAction, wasIdempotent: false };
    });

    // Idempotent: already at target action — return without side effects
    if (wasIdempotent) {
      return {
        tenantId,
        previousAction,
        newAction,
        effectiveAt: new Date().toISOString(),
        reason,
      };
    }

    const effectiveAt = new Date().toISOString();

    // Push billing.enforcement_changed webhook (fire-and-forget)
    this.fireWebhook(tenant.code, 'billing.enforcement_changed', {
      tenantId,
      oldAction: previousAction,
      newAction,
      reason,
    });

    // If escalating to SUSPENDED, also push tenant.suspended webhook
    if (newAction === EnforcementAction.SUSPENDED) {
      this.fireWebhook(tenant.code, 'tenant.suspended', {
        tenantId,
        reason,
        suspendedBy: ctx.platformUserId,
        enforcementAction: EnforcementAction.SUSPENDED,
      });
    }

    // If reactivating from SUSPENDED → NONE, push tenant.reactivated webhook
    if (
      previousAction === EnforcementAction.SUSPENDED &&
      newAction === EnforcementAction.NONE
    ) {
      this.fireWebhook(tenant.code, 'tenant.reactivated', {
        tenantId,
        reactivatedBy: ctx.platformUserId,
      });
    }

    // Audit log (BR-PLT-017) — wrap in try/catch
    try {
      await this.platformAudit.log({
        platformUserId: ctx.platformUserId,
        action: 'billing.enforcement_changed',
        targetType: 'tenant',
        targetId: tenantId,
        details: {
          previousAction,
          newAction,
          reason,
          billingStatus: ENFORCEMENT_TO_BILLING_STATUS[newAction],
          ...(gracePeriodDays !== undefined ? { gracePeriodDays } : {}),
        },
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    } catch (err) {
      // Audit failures must not break operations (BR-PLT-017)
      this.logger.error('Failed to create audit log for billing.enforcement_changed', err);
    }

    return {
      tenantId,
      previousAction,
      newAction,
      effectiveAt,
      reason,
    };
  }

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
