# Partner Notes — Nexa ERP v1

**Last updated:** 2025-11-29  
**Status:** Early Access

---

## Overview for Partners

Nexa ERP v1 (Early Access) is a modular, auditable ERP platform designed for UK businesses. This document provides a concise overview for partners, resellers, and integrators.

---

## What Nexa Offers Today (v1)

### Core ERP Scope

**Complete ERP Platform:**
- Finance (ledgers, invoices, bills, payments, VAT/MTD)
- Inventory & WMS (stock management, movements, lot tracking)
- Manufacturing (work orders, BOMs, cost roll-ups)
- Sales & CRM (opportunities, quotes, orders)
- Purchasing (POs, suppliers, 3-way match)
- Projects & PSA (timesheets, tasks, billing)
- HR & Payroll (employees, payroll runs)
- POS (point of sale, till management)
- Planning (budgets, forecasts)
- Workflow (approval chains, multi-step processes)
- Healthcare (rota management, operational metrics)

**Key Characteristics:**
- Multi-tenant architecture with tenant isolation
- Role-based access control (RBAC) with field-level visibility
- Complete audit trails for all sensitive actions
- UK GDPR alignment and data residency options

### Nexa Chat

**What It Is:**
- Internal messaging system built into the platform
- Tenant-isolated channels with role-based access
- Message history and search
- Chat read access logging for audit

**What It Does:**
- Enables internal communication across modules
- Supports team collaboration within Nexa
- Provides audit trail for message access

**What It Does Not Do:**
- No external messaging (no SMS, no email integration)
- No PSTN integration (no external phone network)
- No automatic message forwarding

### Audio/Video Calls

**What It Is:**
- Browser-based audio/video call signalling within Nexa
- Call metadata (who, when, duration)
- Signalling/status events for operation

**What It Does:**
- Enables internal voice/video communication
- Provides call metadata for audit and reporting
- Supports team collaboration

**What It Does Not Do:**
- No PSTN integration (no external phone network)
- No SMS or external messaging
- No audio/video recording by default
- No automatic transcription
- No external call routing

**Current Status:**
- Call signalling is implemented as a stub (returns `sandbox: true`)
- Real WebRTC signalling and audio/video are planned for future releases

### AI Features

**What It Is:**
- AI-powered operational assistance
- Data Q&A across ERP modules
- Summaries and insights
- Operational recommendations and workflow hints

**What It Does:**
- Answers questions about tenant data
- Provides summaries (finance, projects, inventory, etc.)
- Suggests next steps and workflow improvements
- Respects RBAC and field-level visibility controls

**What It Does Not Do:**
- No autonomous agents performing unattended actions
- No clinical diagnosis or treatment recommendations (healthcare mode)
- No financial or legal advice beyond operational assistance
- No real-time voice AI
- No data fabrication or "best guesses"

**Healthcare Mode:**
- Operational-only AI assistance
- No diagnosis or treatment recommendations
- PHI redaction before logging
- Nexa ERP is not a medical device

---

## SUPER_ADMIN vs Normal Users

### SUPER_ADMIN Role

**Purpose:**
- Tenant-level administrative role for configuration and security
- Not a Nexa staff account
- Not for day-to-day operations

**Responsibilities:**
- Configure tenant settings (region, base currency, timezone, healthcare mode)
- Manage users and roles (ADMIN, MANAGER, STAFF, VIEWER)
- Enable/disable modules
- Access audit logs and sensitive read logs
- Monitor configuration changes

**Security:**
- MFA strongly recommended for SUPER_ADMIN accounts (where available)
- Maximum 3 SUPER_ADMIN users globally per deployment
- Self-promotion prevention (users cannot promote themselves)
- All actions heavily audited

**What SUPER_ADMIN Is Not:**
- Not for invoice entry or PO creation (use ADMIN/STAFF roles)
- Not for daily transaction processing
- Not a Nexa staff backdoor

### Normal User Roles

**ADMIN:**
- Tenant administration, user management, module configuration
- For tenant administrators managing their organisation

**MANAGER:**
- Operational oversight, approvals, reporting
- For managers overseeing operations

**STAFF:**
- Day-to-day operations, data entry, transactions
- For operational staff performing daily work

**VIEWER:**
- Read-only access, reporting, dashboards
- For users who need visibility but not edit access

---

## How to Position AI Features

### Supporting Insights and Summaries

**Position AI as:**
- "AI-powered operational assistance"
- "Data Q&A and insights"
- "Operational recommendations"
- "Workflow hints and suggestions"

**Do Not Position AI as:**
- "Autonomous decision-maker"
- "Clinical advisor" (healthcare)
- "Financial advisor"
- "Legal advisor"
- "Agent that performs actions automatically"

### Healthcare Positioning

**For Healthcare Tenants:**
- Emphasise operational assistance only
- Highlight PHI redaction and compliance safeguards
- Clarify that Nexa ERP is not a medical device
- Position as administrative and operational support tool

---

## Integration Status

### Current Integrations (v1)

**Available:**
- REST APIs for core modules
- Webhook support for event-driven workflows
- API keys and OAuth2 client support
- Tenant-scoped API access

**Not Yet Available (Roadmap):**
- QuickBooks integration (planned)
- Sage integration (planned)
- Xero integration (planned)
- CRM sync (planned)
- Logistics/3PL connectors (planned)
- PSTN/SMS integration (planned)

**Important:** Do not promise integrations that are not yet implemented. Mark future features clearly as "roadmap" or "planned".

---

## Target Markets

### Healthcare (PCN/GP Practices)

**Value Proposition:**
- Healthcare rota management
- Operational metrics and reporting
- Healthcare mode with AI constraints
- PHI redaction for compliance

**Key Message:**
- "Operational support for healthcare administration"
- "Not a medical device — administrative use only"

### Manufacturing

**Value Proposition:**
- Work orders and production planning
- Cost accounting and variance analysis
- Material requirements planning
- Work-in-progress tracking

**Key Message:**
- "Complete manufacturing ERP with strong controls"
- "Cost roll-ups and variance tracking built-in"

### Retail

**Value Proposition:**
- Point of sale (POS) transactions
- Multi-location inventory management
- Sales tracking and reporting
- Till management

**Key Message:**
- "Unified retail platform with POS and inventory"
- "Multi-location support with real-time visibility"

### Projects & Professional Services

**Value Proposition:**
- Project and task management
- Timesheet tracking and approval
- Project billing and invoicing
- Revenue recognition

**Key Message:**
- "Complete project management with billing"
- "Time and expense tracking with approvals"

---

## Messaging Do's and Don'ts

### Do Say

- "Integrated communication within the platform"
- "AI-powered operational assistance"
- "Strong controls and audit trails"
- "Tenant-level administration and security"
- "UK GDPR aligned with data residency options"

### Don't Say

- "Autonomous AI agents" (not implemented)
- "External phone integration" (no PSTN)
- "Call recording" (not by default)
- "Clinical diagnosis" (not supported)
- "Financial advice" (operational assistance only)
- "Available integrations" (only APIs/webhooks available)

---

## Related Documentation

- [GTM Overview](./gtm-overview.md) — Complete go-to-market positioning
- [Pricing Plans](./pricing-plans.md) — Pricing structure
- [AI Engine Behaviour](../ai-engine-behaviour.md) — AI capabilities and limits
- [SUPER_ADMIN Handbook](../super-admin-handbook.md) — SUPER_ADMIN role

---

## Notes

- All features listed are available in v1 and verified through Tasks A–G
- Future features are clearly marked as "roadmap" or "planned"
- SUPER_ADMIN is always a tenant-level role, not Nexa staff access
- Chat and calls are internal to Nexa (no external network integration)
- AI is assistive only (no autonomous agents, no clinical/financial advice)

