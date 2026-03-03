# Product Overview — Nexa ERP

Nexa ERP is a modular, auditable platform that runs core back‑office functions. It favours simple British English, guided flows and strong controls so teams can work quickly and safely.

## Vision and scope
- Replace spreadsheets and siloed apps with opinionated processes and approvals.
- Keep data accurate through validation, audit and reconciliations.
- Provide open APIs and logs so every integration is explainable and testable.
- Integrated communication (Nexa Chat and audio/video calls) within the platform.
- AI-powered operational assistance for insights and recommendations.

## Modules and outcomes
- Finance: reliable ledgers, fast period close, VAT (UK MTD) compliance.
- Sales & CRM: predictable pipeline, faster quote→order→invoice.
- Inventory & WMS: traceable stock moves, high stock accuracy, timely picks/ships.
- Purchasing: budget control, 3‑way match, clean AP ageing.
- Projects: approved time/expenses, accurate billing, revenue recognition.
- HR & Payroll: people data and journals, with proper access boundaries.
- Manufacturing: controlled work orders, cost roll‑ups and variance tracking.
- POS: point of sale transactions and till management.
- Planning: budgets, forecasts, and planning reports.
- Workflow: multi-step approval chains with evidence storage.
- Healthcare: rota management with operational-only AI assistance.

## Communication and collaboration
- **Nexa Chat:** Internal messaging across modules with tenant-isolated channels and role-based access controls.
- **Audio/Video Calls:** Browser-based internal calls with metadata (who, when, duration). No PSTN integration, no default recording.

## AI-powered assistance
- Data Q&A across ERP modules with context-aware responses.
- Summaries and insights (finance, projects, inventory, etc.).
- Operational recommendations and workflow hints.
- Healthcare mode with operational-only AI assistance (no diagnosis/treatment) and PHI redaction.

## Policies and approvals
- Segregation of Duties (SoD) on payments, posting, price/discount overrides.
- Amount thresholds and multi‑step approvals; evidence stored next to records.

## Evidence and audit
- Every sensitive action writes an append‑only audit row (who, when, before/after).
- Reports include links back to source documents and retained evidence.
- Sensitive read logging for HR/payroll, healthcare, tenant config, DMS, and chat.
- Configuration change auditing with before/after snapshots.

## Administration and security
- **SUPER_ADMIN:** Tenant-level administrative role for configuration, user management, and security (not a Nexa staff account).
- Role-based access control (RBAC) with field-level visibility controls.
- MFA support (strongly recommended for SUPER_ADMIN where available).
- Complete audit trails for compliance and security.

Read the module guides in `modules/`, detailed architecture in `technical/`, and GTM materials in `docs/nexa/commercial/`.
