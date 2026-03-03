## Integrations Surface (Foundations)

Last updated: 2025-11-15

### Purpose
Define the core integration surface for Nexa ERP: canonical resources, events, endpoints, and protocols that external systems (EHR, lab, logistics, ecommerce, payroll, etc.) can use to integrate with Nexa in a secure, tenant‑aware, versioned fashion.

### Scope
- Describes event taxonomy and webhook contract
- Describes OAuth2 / API key authentication model
- Outlines resource schemas to be provisioned via migration (see `docs/migrations/2025-11-Phase5-billing-lifecycle.md` and `.../2025-11-PhaseX-...` for canonical tables)
- Provides example requests and expected responses

### Core Principles
- **Tenant Isolation:** All calls include `X-Tenant-Id` or are scoped by token to a specific tenant; data is never leaked across tenants.
- **No PII leakage:** Audit logs and webhooks redact `password`, `secret`, and sensitive fields. PII requires explicit consent and is limited on a per‑integration basis.
- **Idempotency:** Write operations support `Idempotency-Key` headers; webhooks include deterministic `event.id` for de‑duplication.
- **Versioning:** Every endpoint is versioned under `/api/v{N}/...`; clients must set `Accept: application/json`.
- **Least Privilege:** Fine‑grained scopes (e.g., `sales.read`, `inventory.write`, `payroll.read`) are issued per tenant and per integration.

### Key Resources
- `Customer`, `Supplier`, `Product`, `InventoryItem`, `InventoryLot`, `PurchaseOrder`, `SalesOrder`, `Invoice`, `Payment`, `JournalEntry`, `QualityInspection`, `RMA`, `WorkflowInstance`.

> See `docs/migrations/2025-11-Phase5-billing-lifecycle.md` for `Billing*` models and `UserPermission`, `UserModuleAccess`, `WorkflowDefinition`, `WorkflowInstance`, `WorkflowStep` etc.

### Event Types (excerpt)
- `sales.order.created|updated|cancelled`
- `sales.invoice.created|paid|refunded`
- `inventory.grn.posted`
- `inventory.transfer.completed`
- `mfg.workorder.released|completed`
- `supply.rfq.created|responded|awarded`
- `supply.rma.opened|approved|rejected|closed`
- `workflow.instance.created|approved|rejected`
- `auth.user.created|updated|deactivated`
- `system.backup.completed`

Events are delivered via the `/api/webhooks/invoke` channel to registered `ExternalSystemConnection` endpoints (see schema doc). Retries are exponential backoff with signed payloads (`X-Nexa-Signature`) including HMAC SHA256 over body.

### REST Endpoints (selected)
- `POST /api/sales/order`: Create SO (idempotent).
- `POST /api/sales/invoice/from-order`: Convert SO→Invoice (idempotent).
- `POST /api/purchasing/po`: Create Purchase Order (idempotent).
- `POST /api/purchasing/rfq`: Create RFQ (idempotent). `POST /api/purchasing/rfq/:id/respond`, `:id/award`.
- `GET /api/finance/reports/*`: P&L, balance sheet, ledger extracts (tenant‑scoped).
- `POST /api/workflow/instances`: Start workflow instance on entity.
- `GET /api/health`, `GET /api/status`: health and status pingable by monitoring tools.
- `GET /api/_diag/stripe-live-check`, `GET /api/_diag/ai-selftest`: non‑destructive provider health checks.

### Authentication
- OAuth2 clients and API keys (HMAC). All calls must include `Authorization: Bearer <token>` or `X-Api-Key`.
- Scopes enforced via RBAC (`tenant:...`, `sales:...`, `inventory:...`, etc.), configured by Tenant Admin. Support for per‑integration scopes planned.

### Webhook Delivery
- Configure via `POST /api/admin/integrations` (SUPER_ADMIN or Tenant Admin).
- Webhooks signed with secret; payload schema `{ id, type, tenantId, createdAt, data }`.
- Retries with exponential backoff; failures recorded in `Notification/NotificationJob`.

### Security
- All endpoints are rate‑limited; higher allowances available with enterprise plans.
- TLS 1.2+ enforced; HSTS enabled; CORS policy limited to configured origins.
- All write endpoints require CSRF token (for session‑based clients) and `Idempotency-Key`.
- All support‑session invocations attach `X-Act-As` and are audited with `actorId` and `impersonatedUserId`.

### Next Steps
- Implement DB migrations for additional resources per `docs/migrations/2025-11-Phase5-billing-lifecycle.md`.
- Expand webhook catalog with schema registry and CloudEvents‑compatible envelopes.
- Enhance developer onboarding tooling (API Console, SDKs for Node/Java/Python).


