# Pricing Plans — Nexa ERP

**Last updated:** 2025-11-29  
**Status:** v1 Early Access

---

## Overview

Nexa ERP v1 is currently available as an early access offering. Pricing is structured to reflect the core ERP capabilities, integrated communication features (Nexa Chat and audio/video calls), and AI-powered assistance that are available today.

---

## Plan Structure

### Early Access Plan

**Included Features:**

**Core ERP Modules:**
- Finance (ledgers, invoices, bills, payments, VAT/MTD compliance)
- Inventory & WMS (stock management, movements, lot/batch tracking)
- Manufacturing (work orders, BOMs, cost roll-ups)
- Sales & CRM (opportunities, quotes, orders, customers)
- Purchasing (purchase orders, suppliers, 3-way match)
- Projects & PSA (timesheets, tasks, project billing)
- HR & Payroll (employee records, payroll runs, access controls)
- POS (point of sale, till management)
- Planning (budgets, forecasts)
- Workflow (approval chains, multi-step processes)
- Healthcare (rota management, operational metrics)

**Nexa Chat:**
- Internal messaging across modules
- Tenant-isolated channels
- Role-based access controls
- Message history and search
- Chat read access logging for audit

**Audio/Video Calls:**
- Internal call signalling within Nexa (browser-based)
- Call metadata (who, when, duration)
- No audio/video recording by default
- No PSTN integration (no external phone network)
- No automatic transcription

**AI Engine:**
- Data Q&A across ERP modules
- Summaries (finance, projects, inventory, etc.)
- Operational recommendations and workflow hints
- Healthcare mode with operational-only AI assistance (no diagnosis/treatment)
- PHI redaction for healthcare tenants
- AI interaction logging (with PHI redaction where applicable)

**Administration:**
- SUPER_ADMIN role for tenant configuration and security
- User and role management (ADMIN, MANAGER, STAFF, VIEWER)
- Module enablement per tenant
- Audit logs and sensitive read access tracking
- Configuration change auditing

**Security & Compliance:**
- Multi-tenant data isolation
- Role-based access control (RBAC) with field-level visibility
- Sensitive read logging
- High-risk configuration change protection (re-authentication, audit)
- MFA support (strongly recommended for SUPER_ADMIN)
- Data export capabilities

**Not Included (Planned for Future):**
- External integrations (QuickBooks, Sage, Xero, CRM sync, logistics) — roadmap
- PSTN/SMS integration — roadmap
- Call recording/transcription — roadmap
- Advanced AI features (autonomous agents, real-time voice AI) — roadmap

---

## SUPER_ADMIN

**Important:** SUPER_ADMIN is a tenant-level administrative role, not a separate paid feature. Each tenant includes SUPER_ADMIN capabilities for:

- Tenant configuration (region, base currency, timezone, healthcare mode)
- User and role management
- Module enablement
- Audit log access and monitoring
- Security and compliance controls

SUPER_ADMIN is designed for tenant administrators to manage their own organisation's configuration and security, not as a Nexa staff backdoor.

---

## Pricing Model

**Current Status:**
- Early access pricing is customised per tenant
- Contact sales for pricing details
- Pricing is based on:
  - Number of users
  - Modules enabled
  - Support level required

**Future Plans:**
- Standardised pricing tiers will be introduced as Nexa ERP moves to general availability
- Pricing will remain transparent and aligned with included features

---

## Feature Comparison

| Feature | Early Access |
|---------|--------------|
| Core ERP modules | ✓ All modules |
| Nexa Chat | ✓ Included |
| Audio/video calls | ✓ Included (signalling only, no recording) |
| AI Engine | ✓ Included (Q&A, summaries, operational hints) |
| Healthcare mode | ✓ Included |
| SUPER_ADMIN | ✓ Included (tenant-level admin) |
| External integrations | ✗ Roadmap |
| PSTN/SMS | ✗ Roadmap |
| Call recording | ✗ Roadmap |

---

## Notes

- All features listed are available in v1 and have been verified through Tasks A–G
- Features marked as "roadmap" are planned but not yet implemented
- SUPER_ADMIN is always included as a tenant-level administrative capability
- Chat and calls are internal to Nexa (no external phone network integration)
- AI features are assistive only (no autonomous agents, no clinical/financial advice)

---

## Related Documentation

- [GTM Overview](./gtm-overview.md) — Go-to-market positioning
- [Product Overview](../../product-overview.md) — Core ERP capabilities
- [AI Engine Behaviour](../ai-engine-behaviour.md) — AI capabilities and limits
- [SUPER_ADMIN Handbook](../super-admin-handbook.md) — SUPER_ADMIN role and responsibilities

