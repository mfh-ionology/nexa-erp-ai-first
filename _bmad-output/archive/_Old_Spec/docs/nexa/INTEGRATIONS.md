# Nexa ERP — External Integrations (Task B7)

## Overview

Nexa ERP v1 includes **plumbing only** for external business system integrations. All integrations are feature-flagged, stubbed, and safe by default. **No live production sync is performed in v1.**

## Integration Types

### Accounting Providers

- **QuickBooks** — Stub implementation behind `QUICKBOOKS_ENABLED` flag
- **Sage** — Stub implementation behind `SAGE_ENABLED` flag
- **Xero** — Stub implementation behind `XERO_ENABLED` flag

**Status:** Plumbing only. No real API clients or OAuth flows in v1.

### CRM Sync

- **Generic CRM** — Stub implementation behind `GENERIC_CRM_ENABLED` flag

**Status:** Plumbing only. Mapping tables and sync orchestration exist, but no live connectors.

### Logistics / 3PL

- **Generic Logistics** — Stub implementation behind `LOGISTICS_ENABLED` flag

**Status:** Plumbing only. EDI-style schema exists, but no live carrier/3PL connectors.

### Regulated Integrations

- **HMRC MTD** — Sandbox/stub only, returns `sandbox: true`
- **Open Banking** — Sandbox/stub only, returns synthetic data with `sandbox: true`

**Status:** Stubs only. No real submissions or live API calls.

## Tenant Integrations UI

Tenants can view integration status at **Settings → Integrations** (`/settings/integrations`):

- Shows tiles for Accounting, CRM, and Logistics
- Displays provider, connection status, last sync time/error
- Shows "Not enabled / Coming soon" when flags are off
- "Connect" actions are disabled when flags are off

## Super Admin Integrations Dashboard

Super Admins can view an integrations overview at **Admin → Integrations** (`/admin/integrations`):

- Lists tenants vs providers with status and last sync
- Allows marking tenants as SANDBOX for testing
- Allows triggering stubbed syncs for SANDBOX tenants

## Environment Flags

All integrations default to **disabled**:

```bash
QUICKBOOKS_ENABLED=false
SAGE_ENABLED=false
XERO_ENABLED=false
GENERIC_CRM_ENABLED=false
LOGISTICS_ENABLED=false
```

When flags are `false` or missing:
- UI shows "Not enabled / Coming soon"
- No external HTTP calls are attempted
- Stub clients return safe defaults

## Schema

Integration configuration is stored in:

- `TenantIntegrationConfig` — Provider selection and connection status
- `IntegrationConnection` — Connection metadata
- `IntegrationSyncJob` — Sync job history
- `IntegrationImportLog` — Import/sync logs

## Sync Orchestration

The `runExternalSync()` orchestrator:

- Is idempotent (safe to re-run)
- Writes to sync/import/mapping tables
- Respects feature flags (no calls when disabled)
- Only allows stubbed syncs in v1

## Future Work (Beyond v1)

- Real QuickBooks/Sage/Xero OAuth flows
- Live CRM sync connectors
- Live logistics/3PL/carrier APIs
- Production HMRC MTD submissions
- Production Open Banking connections

**Note:** All of the above require additional development and are explicitly **out of scope for v1 plumbing**.

