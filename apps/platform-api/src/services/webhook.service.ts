// ---------------------------------------------------------------------------
// WebhookService — Push webhook notifications to ERP tenants
// Source: Event Catalog §19, NFR51 (webhook within 30s of state change),
// Story E3b.2 Task 3
// ---------------------------------------------------------------------------

import { EnforcementAction } from '../../generated/platform-prisma/client';

// ---------------------------------------------------------------------------
// Typed event payloads (Event Catalog §19)
// ---------------------------------------------------------------------------

export interface TenantCreatedPayload {
  tenantId: string;
  code: string;
  planCode: string;
  region: string;
  createdBy: string;
}

export interface TenantSuspendedPayload {
  tenantId: string;
  reason: string;
  suspendedBy: string;
  enforcementAction: EnforcementAction;
}

export interface TenantReactivatedPayload {
  tenantId: string;
  reactivatedBy: string;
}

export interface TenantArchivedPayload {
  tenantId: string;
  archivedBy: string;
}

export interface TenantModulesChangedPayload {
  tenantId: string;
  moduleKey: string;
  enabled: boolean;
  changedBy: string;
}

export interface TenantPlanChangedPayload {
  tenantId: string;
  oldPlanCode: string;
  newPlanCode: string;
  changedBy: string;
  enabledModules: unknown;
}

export interface BillingEnforcementChangedPayload {
  tenantId: string;
  oldAction: string;
  newAction: string;
  reason: string;
}

export type WebhookEventPayload =
  | TenantCreatedPayload
  | TenantSuspendedPayload
  | TenantReactivatedPayload
  | TenantArchivedPayload
  | TenantModulesChangedPayload
  | TenantPlanChangedPayload
  | BillingEnforcementChangedPayload;

export type WebhookEventName =
  | 'tenant.created'
  | 'tenant.suspended'
  | 'tenant.reactivated'
  | 'tenant.archived'
  | 'tenant.modules_changed'
  | 'tenant.plan_changed'
  | 'billing.enforcement_changed';

// ---------------------------------------------------------------------------
// Webhook request body
// ---------------------------------------------------------------------------

interface WebhookBody {
  event: string;
  timestamp: string;
  payload: WebhookEventPayload;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 1_000;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export interface WebhookLogger {
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

export class WebhookServiceImpl {
  private readonly baseUrl: string | undefined;
  private readonly serviceToken: string;
  private readonly logger: WebhookLogger;

  constructor(logger?: WebhookLogger) {
    this.logger = logger ?? console;
    // PLATFORM_WEBHOOK_BASE_URL overrides the default URL derivation.
    // In dev, set to e.g. "http://localhost:5100" to avoid real DNS lookups.
    this.baseUrl = process.env.PLATFORM_WEBHOOK_BASE_URL || undefined;
    this.serviceToken = process.env.PLATFORM_SERVICE_TOKEN ?? '';
    if (!this.serviceToken) {
      this.logger.warn(
        '[webhook] PLATFORM_SERVICE_TOKEN is not set — webhooks will send unauthenticated requests',
      );
    }
  }

  /**
   * Resolve the webhook URL for a tenant.
   * Default: https://{tenantCode}.nexa-erp.com/webhooks/platform
   * Override via PLATFORM_WEBHOOK_BASE_URL env var.
   */
  private resolveWebhookUrl(tenantCode: string): string {
    if (this.baseUrl) {
      return `${this.baseUrl}/webhooks/platform`;
    }
    return `https://${tenantCode}.nexa-erp.com/webhooks/platform`;
  }

  /**
   * Push a webhook notification to an ERP tenant.
   *
   * - Uses the provided tenantCode to construct the webhook URL (no DB lookup)
   * - Sends POST with Authorization header and JSON body
   * - Retries up to 3 attempts with exponential backoff (1s, 2s, 4s)
   * - Logs failures but NEVER throws — webhook failures must not block admin actions
   * - NFR51: webhook sent within 30 seconds of state change
   */
  async pushWebhook(
    tenantCode: string,
    event: WebhookEventName,
    payload: WebhookEventPayload,
  ): Promise<void> {
    const url = this.resolveWebhookUrl(tenantCode);
    const body: WebhookBody = {
      event,
      timestamp: new Date().toISOString(),
      payload,
    };

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.serviceToken}`,
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            return; // Success — done
          }

          this.logger.error(
            `[webhook] ${event} to ${url} attempt ${attempt}/${MAX_ATTEMPTS} failed: HTTP ${response.status}`,
          );
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          throw fetchErr;
        }
      } catch (err) {
        const isAbort = err instanceof Error && err.name === 'AbortError';
        const errMsg = isAbort ? 'timeout' : err instanceof Error ? err.message : String(err);

        this.logger.error(
          `[webhook] ${event} to ${url} attempt ${attempt}/${MAX_ATTEMPTS} failed: ${errMsg}`,
        );
      }

      // Exponential backoff before next attempt (1s, 2s, 4s)
      if (attempt < MAX_ATTEMPTS) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }

    this.logger.error(
      `[webhook] ${event} to ${url} failed after ${MAX_ATTEMPTS} attempts — giving up`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
