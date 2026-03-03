# Go-To-Market Overview — Nexa ERP v1

**Last updated:** 2025-11-29  
**Status:** Early Access

---

## Overview

Nexa ERP is a modular, auditable ERP platform designed for UK businesses. Version 1 (Early Access) provides core back-office functions with integrated communication (Nexa Chat and audio/video calls) and AI-powered operational assistance.

---

## Core Value Proposition

**Replace Spreadsheets and Siloed Apps:**
- Unified ERP platform replacing disconnected tools
- Opinionated processes and approvals built-in
- Strong controls and audit trails

**Accurate Data Through Validation and Reconciliation:**
- Automated validation and reconciliation
- Complete audit trails for all sensitive actions
- Field-level access controls for sensitive data

**Open APIs and Explainable Integrations:**
- REST APIs for core modules
- Webhook support for event-driven workflows
- Every integration is testable and auditable

---

## Key Features (v1)

### Core ERP Modules

**Finance:**
- Reliable ledgers and journal entries
- Fast period close
- VAT (UK MTD) compliance
- Accounts receivable and payable
- Bank reconciliation

**Sales & CRM:**
- Predictable pipeline management
- Faster quote→order→invoice flow
- Customer relationship data
- Opportunity tracking

**Inventory & WMS:**
- Traceable stock movements
- High stock accuracy
- Timely picks and shipments
- Lot/batch tracking

**Purchasing:**
- Budget control
- 3-way match (PO, receipt, invoice)
- Clean AP ageing
- Supplier management

**Projects & PSA:**
- Approved time and expenses
- Accurate project billing
- Revenue recognition
- Task and timesheet management

**HR & Payroll:**
- People data and employee records
- Payroll runs and payslips
- Proper access boundaries (field-level controls)
- Department and team management

**Manufacturing:**
- Controlled work orders
- Cost roll-ups and variance tracking
- Bills of Materials (BOMs)
- Work-in-progress (WIP) accounting

**POS:**
- Point of sale transactions
- Till management
- Store and location support

**Planning:**
- Budgets and forecasts
- Planning reports and analysis

**Workflow:**
- Multi-step approval chains
- Workflow definitions and instances
- Evidence stored with records

**Healthcare:**
- Rota management (operational metrics)
- Healthcare mode with AI constraints
- PHI redaction for compliance

### Nexa Chat

**Internal Messaging:**
- Tenant-isolated channels
- Role-based access controls
- Message history and search
- Chat read access logging for audit

**What It Does:**
- Enables internal communication across modules
- Supports team collaboration within the platform
- Provides audit trail for message access

**What It Does Not Do:**
- No external messaging (no SMS, no email integration)
- No PSTN integration (no external phone network)
- No automatic message forwarding

### Audio/Video Calls

**Internal Call Signalling:**
- Browser-based audio/video calls within Nexa
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

### AI Engine

**Operational Assistance:**
- Data Q&A across ERP modules
- Summaries (finance, projects, inventory, etc.)
- Operational recommendations and workflow hints
- Context-aware responses based on user role and preferences

**What It Does:**
- Answers questions about your tenant data
- Provides summaries and insights
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

### SUPER_ADMIN

**Tenant-Level Administration:**
- Configuration and control for your organisation
- User and role management
- Module enablement
- Security and compliance controls

**What It Is:**
- Your organisation's high-level administrative role
- For configuring tenant settings, users, and security
- Includes audit log access and monitoring

**What It Is Not:**
- Not a Nexa staff account
- Not for day-to-day operations (use ADMIN/STAFF roles instead)
- Not a backdoor for Nexa support access

---

## Target Industries and Verticals

### Healthcare (PCN/GP Practices)

**Supported Features:**
- Healthcare rota management
- Operational metrics and reporting
- Healthcare mode with AI constraints
- PHI redaction for compliance

**Use Cases:**
- Primary Care Network (PCN) administration
- GP practice management
- Rota scheduling and coverage
- Operational reporting (not clinical)

**Important:** Nexa ERP is not a medical device and must not be used for clinical diagnosis or treatment decisions.

### Manufacturing

**Supported Features:**
- Work orders and production runs
- Bills of Materials (BOMs)
- Cost roll-ups and variance tracking
- Material consumption tracking

**Use Cases:**
- Production planning and scheduling
- Cost accounting and variance analysis
- Material requirements planning
- Work-in-progress tracking

### Retail

**Supported Features:**
- Point of sale (POS) transactions
- Inventory management
- Multi-location support
- Sales reporting

**Use Cases:**
- Store operations
- Inventory management across locations
- Sales tracking and reporting
- Till management

### Projects & Professional Services

**Supported Features:**
- Project and task management
- Timesheet tracking
- Project billing and invoicing
- Revenue recognition

**Use Cases:**
- Professional services firms
- Project-based businesses
- Time and expense tracking
- Client billing

---

## Positioning

### For Business Owners

**Why Nexa ERP:**
- Replace spreadsheets with a unified platform
- Reduce errors through validation and audit
- Improve visibility with real-time reporting
- Ensure compliance with built-in controls

### For Finance Teams

**Why Nexa ERP:**
- Reliable ledgers and fast period close
- VAT (UK MTD) compliance built-in
- Complete audit trails
- Automated reconciliation

### For Operations Teams

**Why Nexa ERP:**
- Integrated communication (Chat and calls)
- AI-powered insights and recommendations
- Workflow automation
- Real-time visibility across modules

### For IT/Admin Teams

**Why Nexa ERP:**
- Tenant-level control (SUPER_ADMIN)
- Role-based access control (RBAC)
- Field-level visibility controls
- Comprehensive audit logging

---

## Competitive Differentiation

**Integrated Communication:**
- Nexa Chat and calls built into the platform
- No need for separate communication tools
- Audit trail for all communication

**AI-Powered Assistance:**
- Operational insights and recommendations
- Data Q&A across modules
- Healthcare mode with compliance safeguards

**Strong Controls:**
- Field-level access controls
- Sensitive read logging
- Configuration change auditing
- Complete audit trails

**UK-Focused:**
- VAT (UK MTD) compliance
- UK GDPR alignment
- British English throughout
- UK data residency options

---

## Messaging Guidelines

### Do Say

- "Nexa ERP helps teams work quickly and safely"
- "Integrated communication within the platform"
- "AI-powered operational assistance"
- "Strong controls and audit trails"
- "Tenant-level administration and security"

### Don't Say

- "Autonomous AI agents" (not implemented)
- "External phone integration" (no PSTN)
- "Call recording" (not by default)
- "Clinical diagnosis" (not supported)
- "Financial advice" (operational assistance only)

---

## Related Documentation

- [Pricing Plans](./pricing-plans.md) — Pricing structure and features
- [Product Overview](../../product-overview.md) — Core ERP capabilities
- [AI Engine Behaviour](../ai-engine-behaviour.md) — AI capabilities and limits
- [SUPER_ADMIN Handbook](../super-admin-handbook.md) — SUPER_ADMIN role

---

## Notes

- All features listed are available in v1 and verified through Tasks A–G
- Future features (integrations, PSTN, call recording) are marked as roadmap
- SUPER_ADMIN is always a tenant-level role, not Nexa staff access
- Chat and calls are internal to Nexa (no external network integration)
- AI is assistive only (no autonomous agents, no clinical/financial advice)

