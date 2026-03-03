# Phase 1.2a Gate — Governance Baseline (Spec + Gap Matrix + Approved Execution Plan)

Single Source of Truth:
- Master Plan (VERBATIM): docs/master-plan/nexa-erp-v1-master-plan.md
- Phase 1.2a Spec Binding: docs/spec-intake/phase-1.2a.external.md

What Phase 1.2a IS:
- A governance baseline that makes the full Master Plan mechanically checkable and execution-controlled.
- It produces: (1) the Master Plan embedded verbatim, (2) a Gap Matrix comparing Master Plan vs repo reality, and (3) an approved execution plan that sequences implementation work.

What Phase 1.2a IS NOT:
- It is NOT the requirement that the entire Nexa ERP v1 Master Plan is implemented in this phase.

Phase 1.2a GREEN (completion criteria):
A) Master Plan is embedded verbatim in this gate document (no divergence).
B) A Gap Matrix exists at: reports/verification/phase-1.2a-gap-matrix-<timestamp>/
   - It enumerates ALL Master Plan requirements and marks each as PRESENT / MISSING / FEATURE-FLAGGED / UNKNOWN.
   - Every PRESENT item includes file path evidence.
   - FEATURE-FLAGGED is allowed only if a real flag exists in code and is referenced (include evidence).
C) An execution plan exists at: docs/plans/phase-1.2a-execution-plan.md
   - It is derived from the Gap Matrix.
   - It sequences work into atomic phases with explicit acceptance criteria and verification commands.
   - It includes a change-control rule: any deviation requires updating the plan and re-approval.
D) Approval record exists at: docs/approvals/phase-1.2a.md
   - It records: date (UTC), approver name, approved commit SHA, approved Gap Matrix folder path, and approved plan path.

Hard-fail rules (governance):
- If Gap Matrix has UNKNOWN items, they must be explicitly resolved or explicitly accepted in the approval record before implementation begins.
- No implementation work may proceed unless docs/approvals/phase-1.2a.md exists and references an approved plan + matrix.

Evidence expectations (for subsequent phases, not required for Phase 1.2a GREEN):
- typecheck, unit, integration/API, Playwright E2E, accessibility, Lighthouse budgets, security headers scan, Prisma runtime error scan.
- Evidence packs stored under reports/verification/<timestamp>/.


## Master Plan (VERBATIM) — Requirements for Phase 1.2a Gate


# Nexa ERP v1 Master Plan (Exhaustive Reference)

This is the single source of truth for scope, architecture, routes, RBAC, tenancy, schema, integrations, compliance, testing, performance/resilience, and go-live gates.

⸻

0) Non-negotiables
	•	Multi-tenant isolation is enforced everywhere (API + server + DB constraints + tests).
	•	RBAC is enforced everywhere (UI + API + server).
	•	No placeholders, no TODOs, no silent failures, no “works locally only”.
	•	Every module has:
	•	Routes + APIs
	•	Data model + constraints
	•	RBAC + tenancy tests
	•	Audit trail
	•	Observability
	•	Performance budgets
	•	Production is always deployable: migrations safe, seeds safe, rollbacks defined.

⸻

1) Product pillars (full scope)
	1.	Nexa ERP Multi-tenant Core Platform
	2.	Nexa AI Engine (server-layer intelligence + orchestration)
	3.	Nexa Chat (Slack-like, tenant-scoped)
	4.	Nexa Calls (audio) (WebRTC)
	5.	Nexa Video Calls (WebRTC)
	6.	Nexa DMS (Document Management System)
	7.	Healthcare PCN / GP vertical suite
	8.	Supply Chain + WMS suite
	9.	Manufacturing suite
	10.	Projects / PSA suite
	11.	POS + Retail suite
	12.	Finance + Banking suite
	13.	CRM + Sales suite

⸻

2) Environments, deployment, and lifecycle

2.1 Environments
	•	Local: deterministic seeds, test DB, mocked external integrations.
	•	Staging: production-like config, real integrations in sandbox modes.
	•	Production: locked down, audited changes only.

2.2 CI/CD gates
	•	Typecheck + lint
	•	Unit tests
	•	Integration/API tests
	•	Playwright E2E full pass
	•	Accessibility gate (WCAG checks)
	•	Lighthouse/perf budgets
	•	Security headers scan
	•	Prisma runtime error scan in logs
	•	Evidence pack generated per run (artifacts + summaries)

2.3 Release process
	•	Feature flags for risky modules (chat/calls/AI/verticals).
	•	DB migrations:
	•	Expand → Backfill → Contract pattern
	•	No destructive changes without staged rollout
	•	Long-running migration protections
	•	Rollback plan:
	•	App rollback always possible
	•	DB rollback only when compatible; otherwise “forward fix” runbook

⸻

3) Tenancy model (core design)

3.1 Tenancy principles
	•	Every business record is tenant-scoped (tenantId) except truly global reference tables.
	•	tenantId is:
	•	Required everywhere
	•	Indexed in composite indexes with business keys
	•	Part of uniqueness constraints
	•	Cross-tenant access is impossible by default.

3.2 Tenant provisioning flow (required)
	•	Route: /onboarding/new-tenant
	•	Steps:
	1.	Company details (legal name, trading name, addresses, VAT, locale, currency, timezone)
	2.	Plan selection + Stripe subscription (or manual invoicing flag)
	3.	Create tenant + default chart of accounts + tax configs + number sequences
	4.	Create ADMIN user + role assignments
	5.	Optional imports (contacts, items, opening balances)
	6.	Confirm and land in /dashboard

3.3 Tenant lifecycle
	•	Active / Suspended / Closed
	•	Data retention policy + export tools
	•	Billing state sync (Stripe → tenant entitlements)
	•	Tenant deletion: soft delete only (legal retention)

⸻

4) Identity, authentication, and sessions

4.1 Auth mechanisms
	•	Credentials login (bcrypt)
	•	OAuth (Google, Microsoft)
	•	Session persistence
	•	CSRF protections
	•	MFA (TOTP) for ADMIN and optional for STAFF
	•	Device/session management

4.2 User tiers (minimum)
	•	SUPER_ADMIN: platform operator (cross-tenant)
	•	ADMIN: tenant admin
	•	STAFF: tenant user with scoped permissions

(You can add fine-grained permissions later, but these three must be perfect first.)

4.3 Required auth routes
	•	/login
	•	/logout
	•	/forgot-password
	•	/reset-password
	•	/mfa/setup
	•	/mfa/verify
	•	/account/sessions
	•	/account/profile

4.4 Required APIs
	•	/api/auth/* (provider-specific)
	•	/api/auth/forgot-password
	•	/api/auth/reset-password
	•	/api/auth/mfa/*
	•	/api/_auth-diag (internal diagnostics, locked down)

⸻

5) RBAC model (exhaustive baseline)

5.1 Global rules
	•	SUPER_ADMIN:
	•	Can access platform console + cross-tenant support tools
	•	Cannot silently mutate tenant financial data without explicit “support mode” audit marker
	•	ADMIN:
	•	Full tenant access except platform console
	•	STAFF:
	•	Least privilege; cannot access admin console, tenant billing, sensitive security settings

5.2 RBAC matrix by domain (minimum)

Domain	SUPER_ADMIN	ADMIN	STAFF
Platform Console	Full	None	None
Tenant Settings	Read/Write (support-audited)	Full	Read-limited
Users & Roles	Full	Full	None
Finance (AR/AP/GL)	Read/Write (support-audited)	Full	Scoped (day-to-day)
Banking/Open Banking	Support-audited	Full	Limited (view/submit)
Supply Chain/WMS	Support-audited	Full	Scoped
Manufacturing	Support-audited	Full	Scoped
Projects/PSA	Support-audited	Full	Scoped
POS	Support-audited	Full	Scoped
CRM/Sales	Support-audited	Full	Scoped
DMS	Support-audited	Full	Scoped
Chat/Calls	Full	Full	Full (tenant-only)
AI Engine	Full	Full	Limited (prompt/ask; no policy edits)
Audit Logs	Full	Full	Read-limited
Billing/Plans	Full	Full	None

5.3 RBAC enforcement layers (required)
	1.	Middleware route gate (redirect/deny)
	2.	UI component gate (hide + block)
	3.	API route guard (hard deny 403)
	4.	Server/service guard (hard deny)
	5.	DB constraints (tenantId scoping prevents cross-tenant leakage even with bugs)

⸻

6) Route map (modules + pages)

Below is the required route surface. Implement as Next.js App Router groups. Every route is tenant-scoped unless explicitly platform console.

6.1 Public
	•	/
	•	/login
	•	/forgot-password
	•	/reset-password
	•	/legal/privacy
	•	/legal/terms
	•	/legal/cookies
	•	/status

6.2 Core app shell
	•	/dashboard
	•	/search (global tenant search)
	•	/notifications
	•	/tasks
	•	/activity

6.3 Platform Console (SUPER_ADMIN only)
	•	/sa
	•	/sa/tenants
	•	/sa/tenants/[tenantId]
	•	/sa/users
	•	/sa/billing
	•	/sa/support (impersonation/support mode)
	•	/sa/audit
	•	/sa/monitoring
	•	/sa/feature-flags
	•	/sa/migrations
	•	/sa/integrations

6.4 Tenant Admin Console (ADMIN only)
	•	/admin
	•	/admin/company
	•	/admin/users
	•	/admin/roles
	•	/admin/security (mfa policy, sessions, ip allowlist if used)
	•	/admin/billing
	•	/admin/integrations
	•	/admin/numbering (sequences)
	•	/admin/tax
	•	/admin/audit
	•	/admin/data-import
	•	/admin/data-export

6.5 Finance suite
	•	/finance/overview
	•	/finance/ar/customers
	•	/finance/ar/invoices
	•	/finance/ar/invoices/new
	•	/finance/ar/invoices/[id]
	•	/finance/ar/credit-notes
	•	/finance/ar/payments
	•	/finance/ap/suppliers
	•	/finance/ap/bills
	•	/finance/ap/bills/new
	•	/finance/ap/bills/[id]
	•	/finance/ap/payments
	•	/finance/gl/journals
	•	/finance/gl/journals/new
	•	/finance/gl/ledger
	•	/finance/gl/accounts
	•	/finance/gl/period-close
	•	/finance/tax/vat
	•	/finance/tax/vat/returns
	•	/finance/tax/vat/returns/[id]
	•	/finance/banking/accounts
	•	/finance/banking/transactions
	•	/finance/banking/reconciliation
	•	/finance/reports (must render Not Authorised for STAFF if restricted)
	•	/finance/settings

6.6 CRM + Sales
	•	/sales/overview
	•	/sales/leads
	•	/sales/opportunities
	•	/sales/accounts
	•	/sales/contacts
	•	/sales/activities
	•	/sales/pipeline
	•	/sales/quotes
	•	/sales/orders

6.7 Supply Chain + WMS
	•	/inventory/overview
	•	/inventory/items
	•	/inventory/items/new
	•	/inventory/items/[id]
	•	/inventory/locations
	•	/inventory/bins
	•	/inventory/stock
	•	/inventory/adjustments
	•	/inventory/transfers
	•	/inventory/receiving/grn
	•	/inventory/receiving/grn/[id]
	•	/inventory/shipping/dispatch
	•	/inventory/shipments
	•	/inventory/reorder
	•	/inventory/suppliers
	•	/inventory/purchase-orders
	•	/inventory/purchase-orders/new
	•	/inventory/purchase-orders/[id]

6.8 Manufacturing
	•	/mfg/overview
	•	/mfg/boms
	•	/mfg/boms/new
	•	/mfg/boms/[id]
	•	/mfg/work-orders
	•	/mfg/work-orders/new
	•	/mfg/work-orders/[id]
	•	/mfg/mrp
	•	/mfg/routings
	•	/mfg/consumption
	•	/mfg/quality (optional if in scope, otherwise feature-flag)

6.9 Projects / PSA
	•	/projects/overview
	•	/projects/projects
	•	/projects/projects/new
	•	/projects/projects/[id]
	•	/projects/timesheets
	•	/projects/expenses
	•	/projects/resources
	•	/projects/billing
	•	/projects/reports

6.10 POS + Retail
	•	/pos
	•	/pos/register
	•	/pos/sales
	•	/pos/returns
	•	/pos/customers
	•	/pos/products
	•	/pos/pricing
	•	/pos/cashup
	•	/pos/reports

6.11 DMS
	•	/dms
	•	/dms/folders
	•	/dms/files/[id]
	•	/dms/search
	•	/dms/retention
	•	/dms/approvals

6.12 Chat + Calls
	•	/chat
	•	/chat/channels/[id]
	•	/chat/dm/[id]
	•	/calls
	•	/calls/rooms/[id]
	•	/calls/history
	•	/calls/settings

6.13 AI Engine surfaces
	•	/ai
	•	/ai/ask
	•	/ai/insights
	•	/ai/alerts
	•	/ai/policies (ADMIN only)
	•	/ai/runs
	•	/ai/tools (ADMIN only)
	•	/ai/audit

6.14 Healthcare PCN/GP (vertical)

Feature-flagged but fully specified.
	•	/healthcare
	•	/healthcare/pcn/overview
	•	/healthcare/patients (if stored, must be heavily controlled)
	•	/healthcare/appointments (integration-driven)
	•	/healthcare/referrals
	•	/healthcare/compliance
	•	/healthcare/reports

⸻

7) API surface (required patterns)

7.1 API principles
	•	All APIs are:
	•	Tenant-scoped by derived tenantId from session (never client input)
	•	RBAC guarded
	•	Idempotent where required (POS, payments, GRN)
	•	Validated with strict schemas
	•	Return stable domain error codes (no Prisma leaks)
	•	No “open” endpoints except public auth/legal/status.

7.2 API namespaces (minimum)
	•	/api/admin/*
	•	/api/finance/*
	•	/api/sales/*
	•	/api/inventory/*
	•	/api/mfg/*
	•	/api/projects/*
	•	/api/pos/*
	•	/api/dms/*
	•	/api/chat/*
	•	/api/calls/*
	•	/api/ai/*
	•	/api/sa/* (SUPER_ADMIN only)

⸻

8) Data model (canonical entities)

8.1 Core tables (must exist)
	•	Tenant
	•	User
	•	Role (or enum role on user)
	•	UserSession
	•	PasswordResetToken
	•	MfaSecret
	•	AuditLog
	•	FeatureFlag
	•	IntegrationCredential (encrypted)
	•	NumberSequence
	•	Notification
	•	Task

8.2 Shared master data
	•	Address
	•	Contact
	•	Customer
	•	Supplier
	•	Item (SKU/product)
	•	PriceList
	•	TaxCode
	•	Currency
	•	ExchangeRate
	•	UnitOfMeasure
	•	Attachment (links to DMS objects)

8.3 Finance (minimum)
	•	Invoice + InvoiceLine
	•	CreditNote + lines
	•	ARPayment
	•	Bill + BillLine
	•	APPayment
	•	Journal + JournalLine
	•	Account (GL)
	•	LedgerEntry
	•	BankAccount
	•	BankTransaction
	•	Reconciliation
	•	VATReturn
	•	PeriodClose
	•	PostingLock

8.4 Supply Chain / WMS
	•	Location
	•	Bin
	•	StockLedger
	•	StockBalance (optional derived)
	•	StockAdjustment
	•	Transfer
	•	PurchaseOrder + lines
	•	GoodsReceiptNote (GRN) + lines
	•	Shipment / Dispatch + lines
	•	Lot / Serial (if enabled)
	•	ReorderRule

8.5 Manufacturing
	•	BOM + BOMLine
	•	Routing + steps
	•	WorkOrder + lines
	•	ConsumptionEvent
	•	ProductionReceipt
	•	MRPPlan (optional)

8.6 Projects / PSA
	•	Project
	•	Milestone
	•	Timesheet + entries
	•	Expense + entries
	•	ResourceAssignment
	•	ProjectInvoice (or link to Invoice)

8.7 POS
	•	PosRegister
	•	PosShift
	•	PosSale + lines
	•	PosPayment
	•	PosReturn
	•	Cashup

8.8 DMS
	•	Document
	•	DocumentVersion
	•	Folder
	•	RetentionPolicy
	•	ApprovalWorkflow

8.9 Chat/Calls
	•	Channel
	•	ChannelMember
	•	Message
	•	MessageRead
	•	CallRoom
	•	CallParticipant
	•	CallRecordingMeta (if enabled)

8.10 AI Engine
	•	AiPolicy
	•	AiRun
	•	AiTool
	•	AiToolInvocation
	•	AiInsight
	•	AiAlert
	•	AiFeedback
	•	AiPromptTemplate

⸻

9) Schema hardening (required rules)

9.1 Constraints
	•	tenantId required on all tenant data tables.
	•	All business identifiers are unique within tenant:
	•	e.g., Invoice.number unique on (tenantId, number)
	•	Prevent orphan records:
	•	Strict foreign keys
	•	Money fields:
	•	Store minor units (integer) + currency
	•	Dates:
	•	UTC in DB
	•	Soft deletes:
	•	Standard deletedAt where needed (do not leak soft-deleted in queries)

9.2 Indexes (minimum)
	•	Composite indexes on high-cardinality tenant queries:
	•	(tenantId, createdAt)
	•	(tenantId, status, createdAt)
	•	(tenantId, number)
	•	Search indexes if using text search (optional but defined)
	•	Ledger tables: write-optimized indexes, avoid over-indexing

9.3 Migration safety
	•	Expand/backfill/contract.
	•	Avoid table rewrites in production.
	•	Always include data backfill scripts when adding non-null columns.

⸻

10) Seeding and demo data (required)

10.1 Seeds must include
	•	SUPER_ADMIN account
	•	At least one demo tenant:
	•	ADMIN + STAFF users
	•	Chart of accounts
	•	Tax codes (UK VAT baseline)
	•	Currency + FX example
	•	Sample customers/suppliers/items
	•	Minimal AR/AP transactions
	•	Inventory with stock
	•	One BOM + work order
	•	One project + timesheet
	•	One POS sale
	•	Sample DMS docs
	•	Sample chat channel

10.2 Seed safety
	•	Seeds are idempotent
	•	Seeds never overwrite production data
	•	Seeds respect environment gates

⸻

11) Integrations (full planned set)

11.1 Billing and payments
	•	Stripe:
	•	Subscriptions, metering (optional), invoices, dunning
	•	Webhooks → entitlements
	•	Customer portal link for ADMIN

11.2 Email and notifications
	•	SMTP provider (SendGrid/Mailgun/etc.)
	•	Templates:
	•	Welcome + temp password
	•	Reset password
	•	Invoice/bill notifications
	•	Alerts

11.3 Accounting and tax
	•	HMRC VAT (MTD) if in-scope for v1: feature-flag with sandbox first
	•	Export formats:
	•	CSV/Excel
	•	Xero/QuickBooks connectors (feature-flag)

11.4 Banking
	•	Open Banking aggregator (TrueLayer, Yapily, etc.) in sandbox first
	•	Bank feeds → reconciliation

11.5 Chat/Calls infra
	•	WebRTC signalling server
	•	TURN/STUN (managed TURN recommended)
	•	Recording (optional, heavily consented)
	•	Transcription (optional, controlled)

11.6 Storage
	•	Object storage for DMS (S3-compatible)
	•	Signed URLs, virus scanning pipeline (required if upload enabled)

11.7 Observability
	•	Sentry (frontend + backend)
	•	Structured logs with redaction
	•	Metrics (latency, error rate, queue depth)
	•	Tracing (OpenTelemetry optional but defined)

11.8 Background jobs
	•	Queue system (DB-backed or managed queue)
	•	Job types:
	•	Email sends
	•	VAT return generation
	•	AI insight generation
	•	Document processing
	•	Bank sync
	•	Report materialisation

⸻

12) Security (required baseline)

12.1 AppSec
	•	Security headers:
	•	CSP, HSTS, XFO, XCTO, Referrer-Policy
	•	Rate limiting on auth and sensitive APIs
	•	Input validation on all endpoints
	•	Output encoding in UI
	•	Dependency scanning + lockfile integrity
	•	Secrets management: env vars + rotation runbook

12.2 Data security
	•	Encryption in transit (TLS)
	•	Encryption at rest (provider)
	•	Sensitive fields encrypted at app layer where required (integration creds)
	•	Row-level tenant protections via app-level scoping + constraints (and optional DB RLS)

12.3 Access controls
	•	Session invalidation on password reset
	•	Admin session management
	•	Optional IP allowlisting for admin console (feature-flag)

12.4 Auditability
	•	Every sensitive action emits AuditLog:
	•	Auth events, role changes, finance postings, approvals, exports, support mode, integration changes

⸻

13) Compliance (required deliverables)

13.1 GDPR baseline
	•	Data processing inventory
	•	Sub-processor list
	•	DPA template
	•	Data subject rights workflow:
	•	Export
	•	Rectification
	•	Deletion (where legally permitted)
	•	Retention policies (DMS + audit logs)

13.2 Legal pages (must exist)
	•	Terms
	•	Privacy
	•	Cookies
	•	Acceptable use
	•	Security statement

13.3 Healthcare vertical compliance (if enabled)
	•	Strict minimisation: do not store patient data unless unavoidable
	•	Access logging, least privilege, enhanced audit
	•	Segregation, encryption, retention, consent

⸻

14) Performance and resilience gates

14.1 Performance budgets
	•	Page load budgets (Lighthouse)
	•	API p95 latency targets
	•	DB query budgets (per endpoint)
	•	Background job completion SLOs

14.2 Load and concurrency
	•	GRN concurrency correctness
	•	POS idempotency under retries
	•	Manufacturing consumption determinism
	•	Period close locking correctness

14.3 Resilience
	•	Backups:
	•	Automated DB snapshots
	•	Restore drills
	•	DR plan:
	•	RPO/RTO targets
	•	Runbooks
	•	Chaos testing (minimal):
	•	External integration failures
	•	Queue delays
	•	Partial outages

⸻

15) Test matrix (exhaustive)

15.1 Tenancy isolation tests (must exist)
	•	Cross-tenant reads blocked (API + server)
	•	Cross-tenant writes blocked
	•	Cross-tenant search cannot leak
	•	Attachments/DMS signed URLs tenant-bound
	•	Chat/calls cannot cross tenant boundaries
	•	AI queries cannot retrieve other tenant data
	•	Support mode actions are explicitly flagged and audited

15.2 RBAC tests (must exist)
	•	STAFF blocked from admin console routes
	•	STAFF blocked from tenant billing/integrations/security settings
	•	STAFF sees Not Authorised pages where applicable
	•	API returns 403 (not 404 masking unless explicitly desired)
	•	Sidebar/menu hides forbidden routes

15.3 Module correctness tests
	•	Finance:
	•	Invoice numbering uniqueness per tenant
	•	VAT totals, posting, period close lock
	•	No Prisma error leaks
	•	Inventory:
	•	Stock ledger balance correctness
	•	Transfers and adjustments invariant tests
	•	Manufacturing:
	•	BOM consumption equals issued stock, no double-consumption
	•	Projects:
	•	Timesheet rollups deterministic
	•	POS:
	•	Idempotent sale create, safe retries
	•	DMS:
	•	Upload, versioning, retention policy enforcement
	•	Chat/calls:
	•	Channel membership enforcement, message visibility
	•	AI:
	•	Policy enforcement + tool allowlist + audit trails

15.4 E2E gates
	•	Full Playwright suite pass
	•	Zero skips unless explicitly accepted
	•	Post-run scan for Prisma runtime errors in logs
	•	Evidence pack stored with timestamps

⸻

16) AI Engine (server-layer specification)

16.1 Capabilities
	•	Ask questions over tenant data (“why did margin drop”, “what changed”)
	•	Proactive alerts (variance, stockouts, late approvals)
	•	Explainability:
	•	Show source records used
	•	Provide reasoning trace suitable for users (not internal chain-of-thought)
	•	Tooling:
	•	Read tools (queries)
	•	Write tools (admin-approved only, with confirmation + audit)
	•	Policy engine:
	•	Allowed data domains by role
	•	Redaction rules
	•	Safe output rules

16.2 AI data access rules
	•	Never cross tenant
	•	STAFF cannot access sensitive areas unless granted
	•	Every run stored with:
	•	Inputs (redacted)
	•	Tools called
	•	Records referenced
	•	Outputs
	•	Feedback

⸻

17) Real-time (required where claimed)

If you claim “real-time” anywhere, you implement:
	•	Server push mechanism (WebSocket/SSE)
	•	Events:
	•	New customer/user
	•	Invoice/bill created/approved
	•	Stock movements
	•	Chat messages
	•	Call presence
	•	Tenant-scoped channels only
	•	Backpressure + reconnect logic
	•	Audit on critical events

⸻

18) Operational tooling (must exist)

18.1 Admin/support tooling
	•	Support mode with explicit tenant selection
	•	Impersonation requires:
	•	Explicit reason
	•	Time limit
	•	Audit record
	•	Data export tooling (tenant admin)
	•	Incident tooling:
	•	Feature flag kill switches
	•	Integration disable toggles

18.2 Runbooks
	•	Incident response
	•	Migration rollback/forward-fix
	•	DB restore drill
	•	Stripe webhook failure recovery
	•	Email provider outage handling

⸻

19) Go-live gates (no-exceptions)

You do not declare “ready” until all are true:
	•	All routes above exist or are explicitly feature-flagged with documented rationale.
	•	RBAC: all enforced at middleware + UI + API + server.
	•	Tenancy: isolation tests pass; no cross-tenant leakage possible.
	•	Security headers + rate limiting + CSRF + session persistence verified in production.
	•	Full E2E pass, zero skips unless explicitly accepted.
	•	No Prisma runtime errors in logs post-run.
	•	Evidence pack generated and archived.
	•	Backups verified + restore drill performed.
	•	Legal pages published.
	•	Monitoring/alerting enabled.
	•	Onboarding flow works end-to-end including billing (or billing feature-flagged with manual process documented).

⸻

20) Definition of Done per module (mandatory checklist)

For every module (Finance, Inventory, Mfg, Projects, POS, CRM, DMS, Chat/Calls, AI, Healthcare):
	•	Routes implemented
	•	APIs implemented
	•	Data model implemented
	•	Tenancy enforcement implemented + tests
	•	RBAC enforcement implemented + tests
	•	Audit coverage implemented
	•	Observability added (errors, logs, key metrics)
	•	Performance budgets met
	•	E2E coverage exists
	•	Documentation exists (user + admin + runbook)
