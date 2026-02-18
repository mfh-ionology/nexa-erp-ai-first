# Functional Requirements

## AI Interaction & Intelligence

- FR1: Users can issue natural language commands to create, query, and manage business records across all modules with >90% correct interpretation rate for supported entity types and AI responses within 3 seconds (95th percentile)
- FR2: The system can pre-fill record fields using contextual knowledge (customer history, default terms, recent patterns, user behaviour) achieving >90% field accuracy as measured by the approval-without-edit ratio
- FR3: Users can receive a personalised daily briefing based on their role, job description, and system usage patterns
- FR4: Users can ask business questions in natural language and receive accurate answers with supporting data, achieving >95% accuracy for queries within the supported question taxonomy and responding within 3 seconds (95th percentile)
- FR5: The system can recommend actions to users with explanation and one-tap approval path
- FR6: Users can approve, modify, or reject any AI-generated record or recommendation before it takes effect
- FR7: The system can maintain conversational context across a session to handle multi-step operations
- FR8: Users can fall back to traditional form-based interfaces for any operation at any time
- FR9: The system can log all AI actions, suggestions, and user responses for audit and learning purposes
- FR10: The system can display confidence scoring for AI-generated records and recommendations

## Document Understanding (MVP)

- FR164: Users can upload, photograph, or forward financial documents (purchase invoices, receipts, expense claims, credit notes) via web upload, mobile camera, or email for AI-powered data extraction
- FR165: The system can extract structured fields from financial documents (supplier name, invoice number, date, line items, amounts, VAT, payment terms, bank details) with field-level confidence scoring, achieving >85% extraction accuracy for standard UK invoice and receipt formats
- FR166: The system can automatically match extracted document data to existing supplier records, purchase orders, and GL accounts, creating draft purchase invoices or expense records following the "told, shown, approve, done" pattern
- FR167: Users can review, correct, and approve AI-extracted document records before posting, with corrections feeding back to improve future extraction accuracy for that supplier
- FR168: The system can process documents in PDF, JPEG, PNG, and TIFF formats with automatic orientation correction and quality validation, rejecting unreadable documents with a clear re-upload prompt

## Document Knowledge Base (Phase 2)

- FR169: Administrators can upload company documents (employee contracts, handbooks, policy manuals, procedure guides) for AI indexing and storage in a vector knowledge base
- FR170: Users can ask natural language questions about company policies, procedures, and employment terms, receiving accurate answers with source document references and page citations

## Finance & General Ledger

- FR11: Administrators can configure a chart of accounts based on UK GAAP (FRS 102) templates
- FR12: Users can create, edit, and post journal entries with double-entry enforcement
- FR13: Users can generate trial balance, profit & loss, and balance sheet reports for any date range
- FR14: Administrators can open and close financial periods with enforcement preventing posting to closed periods
- FR15: Users can manage multiple currencies with configurable exchange rates from external feeds
- FR16: Users can perform bank reconciliation matching bank statement lines to ledger transactions
- FR17: Users can import bank statements in OFX, CSV, and MT940 formats
- FR18: The system can automatically match bank transactions to open invoices and bills based on amount and reference

## Accounts Receivable

- FR19: Users can create and manage customer records with comprehensive fields (contacts, addresses, payment terms, VAT registration, credit limits, bank details)
- FR20: Users can create, approve, and post sales invoices following the draft→approved→posted lifecycle
- FR21: Users can record customer payments and allocate them against specific invoices (full or partial)
- FR22: Users can generate and send customer statements
- FR23: Users can create credit notes linked to original invoices
- FR24: Users can view AR aging analysis by customer and date band
- FR25: Users can manage multiple billing and shipping addresses per customer

## Accounts Payable

- FR26: Users can create and manage supplier records with comprehensive fields (contacts, addresses, payment terms, VAT registration, bank details)
- FR27: Users can create, approve, and post supplier bills following the draft→approved→posted lifecycle
- FR28: Users can record supplier payments and allocate them against specific bills
- FR29: Users can generate BACS payment files for bulk supplier payments
- FR30: Users can view AP aging analysis by supplier and date band
- FR31: The system can match supplier bills to purchase orders (3-way matching with goods receipt)
- FR32: The system can ingest supplier bills via email/OCR and extract key fields for review

## Sales Management

- FR33: Users can create sales quotes with line items, pricing, discounts, and VAT calculation
- FR34: Users can convert approved quotes to sales orders
- FR35: Users can manage sales orders through the full lifecycle (draft→confirmed→shipped→invoiced)
- FR36: Users can create shipments/delivery notes against sales orders (full or partial)
- FR37: Users can convert sales orders to invoices (single or batch)
- FR38: The system can check stock availability during order entry and alert on shortfalls
- FR39: Users can manage customer-specific pricing and discount rules
- FR40: Users can view sales pipeline with weighted values and activity tracking

## Purchasing

- FR41: Users can create purchase orders with line items, pricing, and VAT calculation
- FR42: Users can manage PO approval workflows
- FR43: Users can record goods receipt against purchase orders (full or partial)
- FR154: Users can scan item barcodes during goods receipt to automatically identify items, validate against the purchase order, and record received quantities
- FR44: The system can suggest reorder purchase orders based on stock levels and reorder points
- FR45: Users can track PO status through the lifecycle (draft→approved→ordered→received)

## Inventory & Stock

- FR46: Users can create and manage item records with typed relational fields (name, description, type, UoM, barcode, weight, dimensions, cost price, sales price, VAT code, reorder point)
- FR47: Users can manage item groups with default GL account mappings
- FR48: Users can record stock movements (receipt, issue, transfer, adjustment) with audit trail
- FR49: Users can manage multiple warehouse locations with bin-level tracking
- FR50: Users can perform stock takes with variance reporting
- FR51: Users can track items by serial number or batch number
- FR52: Users can view real-time stock levels across all locations
- FR53: The system can alert users when items fall below reorder point

## CRM

- FR54: Users can create and manage contacts and accounts with activity history
- FR55: Users can log activities (calls, meetings, emails, notes) against contacts and accounts
- FR56: Users can manage leads with status tracking and conversion to customers/quotes
- FR57: Users can view pipeline reporting with stages, values, and probability weighting
- FR58: Users can link CRM records to sales transactions (quotes, orders, invoices)

## HR & Payroll

- FR59: Users can create and manage employee records with typed fields required by UK employment law (NI number, tax code, employment type, start/end dates, department, job title, pay details)
- FR60: Users can manage employee onboarding with configurable checklist and self-service data collection
- FR61: Users can manage leave requests (request, approve, reject) with entitlement tracking
- FR62: Users can prepare and run monthly payroll with PAYE, NI, student loan, and pension calculations
- FR63: The system can submit Full Payment Submissions (FPS) and Employer Payment Summaries (EPS) to HMRC via RTI
- FR64: Users can generate BACS payment files for payroll payments
- FR65: The system can assess employee auto-enrolment pension eligibility and track opt-in/opt-out status
- FR66: Users can generate payslips, P45s, and P60s per HMRC specifications
- FR67: Users can manage statutory payments (SSP, SMP, SPP, ShPP, SAP)

## Manufacturing

- FR68: Users can create and manage Bills of Materials (BOM) with multi-level component structures
- FR69: Users can create and manage work orders with material requirements and routing operations
- FR70: Users can schedule production based on sales order priority and material availability
- FR71: Users can record material consumption against work orders
- FR72: Users can record finished goods receipt from completed work orders
- FR73: The system can check material availability before work order confirmation and alert on shortages

## Reporting & Analytics

- FR74: Users can generate standard financial reports (P&L, Balance Sheet, Trial Balance, Cash Flow Statement)
- FR75: Users can generate operational reports (AR/AP Aging, Stock Valuation, Bank Reconciliation)
- FR76: Users can generate HR reports (Payslips, Employee List)
- FR77: Users can generate VAT returns for HMRC MTD submission
- FR78: Users can export reports in PDF and CSV formats
- FR79: Users can ask ad-hoc reporting questions in natural language and receive data-backed tabular or chart answers generated from live data, achieving >95% accuracy for supported query patterns (aggregations, comparisons, trend analysis, filtered listings)
- FR153: Users can generate AI-driven cash flow forecasts for 8-52 week projection periods with scenario analysis (best case, expected, worst case) based on AR/AP aging, recurring invoices, historical payment patterns, and known commitments

## Administration & Configuration

- FR80: Administrators can create, edit, and deactivate user accounts with role assignment
- FR81: Administrators can assign roles (SUPER_ADMIN, ADMIN, MANAGER, STAFF, VIEWER) with module-level access gating
- FR82: Administrators can enable/disable modules per tenant configuration
- FR83: Administrators can configure per-module settings (payment terms defaults, VAT schemes, number series, currency, etc.)
- FR84: Administrators can manage integration connections (bank feeds, HMRC, payroll API) with health monitoring
- FR85: Administrators can view audit logs of all system actions including AI-generated operations
- FR86: Administrators can configure number series (prefix + sequential counter) per document type
- FR87: Administrators can import data (customers, suppliers, items, opening balances) from CSV files
- FR88: Administrators can manage backup and restore operations

## Compliance & VAT

- FR89: The system can calculate VAT at standard (20%), reduced (5%), zero (0%), exempt, and reverse charge rates
- FR90: Users can configure VAT schemes (Standard, Flat Rate, Cash Accounting)
- FR91: The system can generate and submit VAT returns to HMRC via the MTD API
- FR92: The system can maintain immutable audit trails for all financial transactions
- FR93: Administrators can manage GDPR compliance operations (data export, data deletion requests)
- FR94: The system can enforce period locks preventing modification of closed financial period data
- FR155: The system can detect and alert on duplicate payment attempts by matching supplier, amount, invoice reference, and date proximity
- FR156: The system can flag suspicious transactions based on configurable rules (unusual amounts, out-of-pattern timing, new supplier with large first payment, sequential invoice numbers from same supplier)
- FR157: The system can generate a fraud risk summary report showing flagged transactions, duplicate payment attempts, and anomaly patterns for administrator review

## CRM — Expanded

- FR95: Users can create and manage marketing campaigns with recipient lists, media types, status tracking, and response analysis
- FR96: Users can manage sales opportunities with weighted pipeline stages, probability percentages, and expected revenue calculations
- FR97: Administrators can configure pipeline Kanban board stages at system level, and users can create personal pipeline views
- FR98: Administrators can define activity auto-creation rules that automatically generate activities for key CRM events (e.g., new lead, opportunity stage change, overdue follow-up)
- FR99: Users can assign lead ratings (Cold, Warm, Hot) and manage lead lifecycle from initial contact through qualification to conversion or closure
- FR100: Administrators can configure CRM-specific activity types and activity groups for structured activity tracking

## HR & Payroll — Expanded

- FR101: Users can manage employment contracts through a full lifecycle (draft, approve, active, terminate) with immutable change history
- FR102: The system can track contract changes (salary adjustments, job title changes, department transfers) with full audit trail and effective dates
- FR103: Users can conduct performance appraisals using configurable factor and rating matrices with multi-level approval workflows
- FR104: Users can manage employee skills and competencies with rating evaluations and point-in-time reporting for workforce planning
- FR105: Users can create and manage training plans with scheduling, automatic double-booking detection, and auto-closure on completion
- FR106: Administrators can define job positions and organisational structure hierarchies for departmental reporting
- FR107: Users can manage employee benefits on contracts with configurable benefit types, amounts, and payment frequencies
- FR108: Users can manage onboarding and offboarding checklists using configurable checkpoint templates with assignment and completion tracking

## Manufacturing — Expanded

- FR109: Users can trigger recipe/BOM explosion across document types including quotes, sales orders, and invoices to automatically generate component line items
- FR110: Users can define and manage production shift schedules with worker assignments per shift
- FR111: Users can register time worked by multiple workers per production operation with start/stop tracking
- FR112: The system can post operation-level costs to GL accounts including work-in-progress (WIP) accounting entries
- FR113: The system can run Material Requirements Planning (MRP) calculations based on demand, stock levels, lead times, and open orders
- FR114: Users can manage machine and work centre capacity with availability calendars and utilisation tracking
- FR115: Users can perform quality inspections at the production operation level with pass/fail recording and defect tracking

## POS

- FR116: Users can open and close POS sessions with cash float entry, end-of-day cash counting, and Z-report generation
- FR117: Users can look up products by name, code, or barcode scan at the point of sale
- FR118: Users can process multiple payment methods per transaction including cash, card, voucher, and split payments
- FR119: Users can print receipts or send email receipts to customers from the POS terminal
- FR120: Administrators can configure POS-specific pricing rules and promotional discounts
- FR121: The system can operate in offline mode and automatically synchronise transactions when connectivity is restored
- FR122: Users can manage cash drawer operations with till reconciliation and variance reporting

## Projects & Job Costing

- FR123: Users can create and manage projects with budgets, phases, milestones, and status tracking
- FR124: Users can record time entries against projects with billable and non-billable classification
- FR125: Users can record expenses against projects with receipt attachment and approval workflow
- FR126: Users can view project budget versus actual reports with variance analysis by phase and cost category
- FR127: The system can resolve billing rates using a priority hierarchy: project-specific rate, customer rate, employee rate, then default rate
- FR128: The system can post job costs to GL accounts per project with cost centre tracking
- FR129: The system can calculate work-in-progress (WIP) values and support revenue recognition for long-running projects

## Contracts & Agreements

- FR130: Users can create and manage contracts for rental, lease, and service agreements with defined terms and conditions
- FR131: The system can automatically generate recurring invoices from active contracts based on configured billing schedules
- FR132: Users can manage contract renewal and termination workflows with advance notification and approval steps
- FR133: Users can manage loan agreements with repayment schedule calculations supporting annuity, linear, and bullet repayment methods
- FR134: Users can configure contract-based pricing and payment terms that override default customer terms

## Warehouse Management

- FR135: Users can define and manage warehouse positions and bin locations with capacity and zone classification
- FR136: Users can generate pick lists from sales orders and manage pick completion with quantity tracking
- FR137: Users can receive goods into specific warehouse positions with automatic or manual bin assignment
- FR138: Users can create internal transfer orders to move stock between warehouse positions
- FR139: Users can perform cycle counts by warehouse position with variance reporting and adjustment posting
- FR140: Users can manage packing and dispatch operations with shipment tracking and carrier assignment

## Intercompany & Consolidation

- FR141: The system can route intercompany transactions so that a purchase order in one company automatically creates a corresponding sales order in the counterpart company
- FR142: The system can generate intercompany elimination journal entries for consolidated financial reporting
- FR143: Users can generate consolidated financial reports (P&L, Balance Sheet) across multiple companies
- FR144: The system can perform currency translation for foreign subsidiary consolidation using closing rate and average rate methods

## Communications

- FR145: Users can send and receive internal messages and notifications within the ERP system
- FR146: Users can send and receive emails from within the ERP with automatic linking to relevant business entities
- FR147: Users can view a chronological activity feed per entity (customer, supplier, employee, project) showing all related interactions
- FR148: Users can attach documents to any business record with version tracking and access control

## Service Orders

- FR149: Users can create and manage service orders with assignment to service personnel, status tracking, and completion recording
- FR150: Users can track service items (equipment or assets under service contract) with service history and warranty information
- FR151: Users can schedule field service visits with calendar integration and technician availability checking
- FR152: Users can convert completed service orders to invoices with automatic line item generation from service activities and parts used

## Fixed Assets (Phase 2)

- FR158: Users can create and manage fixed asset records with acquisition date, cost, useful life, residual value, asset category, location, and responsible person
- FR159: The system can calculate depreciation using straight-line, reducing balance, and sum-of-digits methods per UK GAAP (FRS 102 Section 17)
- FR160: The system can automatically post monthly depreciation journal entries to the general ledger
- FR161: Users can record asset disposals with gain/loss calculation and GL posting
- FR162: Users can perform asset revaluations with revaluation reserve posting per FRS 102
- FR163: Users can generate a fixed asset register report showing cost, accumulated depreciation, and net book value per asset and category

## Multi-Company Management

- FR171: Administrators can create and manage multiple companies within a single tenant, each with its own name, legal name, registration number, VAT number, base currency, address, and branding
- FR172: Users can switch between companies via the application header, with all subsequent queries automatically scoped to the selected company
- FR173: Administrators can configure per-entity register sharing rules between companies (e.g., share customers between Company 1 and Company 2 but not Company 3) with modes: no sharing, share with all companies, or share with selected companies
- FR174: The system must scope every database query by company, ensuring complete data isolation between companies unless sharing rules explicitly permit cross-company visibility

## Company-Specific RBAC

- FR175: Administrators can assign users a global role that applies across all companies within the tenant
- FR176: Administrators can assign per-company role overrides that take precedence over the global role for specific companies (e.g., ADMIN globally but VIEWER for Company 3)
- FR177: The system must resolve user permissions by checking for a company-specific role first, then falling back to the global role, with no access granted if neither exists

## i18n / Localization Infrastructure

- FR178: All user-facing text (labels, messages, placeholders, validation errors, system messages) must use translation keys via a centralised translation system, with no hardcoded strings in the UI
- FR179: Administrators can set a default language per company, and users can select their preferred language in profile settings, with fallback chain: user language, then company language, then English
- FR180: The system must format numbers, dates, and currency values according to the user's locale using standard internationalisation APIs

## Cross-Cutting Tasks

- FR181: Users can create tasks from any business record (invoice, purchase order, customer, employee, etc.) with title, description, priority (Low/Normal/High/Urgent), and due date
- FR182: Users can assign tasks to one or more users, with task assignees receiving notifications on assignment and status changes
- FR183: Users can view and manage their assigned tasks from a centralised task list with filtering by status, priority, due date, and source entity

## Notifications

- FR184: The system can deliver real-time notifications via in-app (WebSocket), push (mobile), and email channels, triggered by business events (approval requests, task assignments, status changes, AI alerts)
- FR185: Users can configure per-channel, per-event-type notification preferences (opt-in/out for each notification type per delivery channel)
- FR186: Users can view a notification centre showing all recent notifications with read/unread status and direct links to related records

## Email Integration

- FR187: The system can send business documents (invoices, statements, purchase orders, payslips, notifications) via email using configurable per-company SMTP settings
- FR188: Users can send emails from within the ERP directly from business records (e.g., "Email this invoice") with document PDF attachment and customisable email templates
- FR189: Administrators can configure email templates per document type with merge fields for dynamic content (company name, recipient, document details)

## Printer Management

- FR190: Users can configure print preferences per document type (auto-print on save, manual print, or download PDF only)
- FR191: The system can generate PDF documents via the Document Templates engine and present them via the browser Print API or as downloadable files
- FR192: Administrators can set default print preferences per document type at the company level, which users can override with personal preferences

## Platform Admin — Tenant Management

- FR193: Platform administrators can create, view, suspend, reactivate, and archive tenants with full lifecycle tracking including legal entity details, billing profile, and database provisioning status
- FR194: Platform administrators can view a tenant list with status, plan, region, created date, last activity, active user count, and enabled modules
- FR195: Platform administrators can configure per-tenant module entitlements (allowed modules), feature flags, and environment toggles (sandbox mode) that override plan defaults
- FR196: Platform administrators can force password resets for tenant users, revoke tenant user sessions, and rotate tenant API keys/webhook secrets from the platform admin portal

## Platform Admin — Identity & Access

- FR197: Platform administrators can manage platform admin accounts with mandatory MFA enforcement, including adding/removing platform admins and emergency "break glass" account handling
- FR198: Platform administrators can view tenant user lists and roles (read-only), reset tenant user MFA, and lock/unlock tenant user accounts
- FR199: Platform administrators can initiate time-limited, fully audited impersonation sessions to access a tenant's ERP as a support user, with a visible banner always displayed: "You are impersonating [tenant name]"
- FR200: The system must record every impersonation session with start time, end time, platform admin identity, target tenant, and all actions performed during the session in the platform audit log

## Platform Admin — Billing & Plan Enforcement

- FR201: Platform administrators can manage a plan catalogue (Core/Pro/Enterprise/Custom) defining user limits, module entitlements, API rate limits, and AI token quotas per plan
- FR202: Platform administrators can view per-tenant billing status including current subscription, payment status, invoices/receipts, and dunning flags
- FR203: Platform administrators can configure billing enforcement controls per tenant: grace period duration, read-only mode activation, and hard stop (suspension) triggers based on payment status
- FR204: The system must enforce plan limits at runtime: the ERP queries the Platform API for entitlements at login and caches with short TTL, blocking module access, user creation, or AI usage when limits are exceeded

## Platform Admin — AI Gateway & Token Metering

- FR205: All AI calls from the ERP must be routed through a single internal AI Gateway service that checks tenant token quota before forwarding to the AI model provider and records usage after response
- FR206: The system must record per-AI-call usage data: tenantId, userId, featureKey (which ERP feature triggered the call), model, promptTokens, completionTokens, totalTokens, costEstimate (using unit price snapshot at time of call), requestId/traceId, and UTC timestamp
- FR207: Platform administrators can view per-tenant AI token dashboards showing usage today/this week/this month, rolling 30-day usage, cost estimates, and usage split by ERP feature
- FR208: Platform administrators can configure per-tenant AI token quotas: monthly token allowance (by plan), soft limit percentage (warn), hard limit percentage (block/require top-up), and optional burst allowance
- FR209: The system must alert platform administrators at configurable quota thresholds (default: 50%, 80%, 100%) and flag unusual usage spikes for investigation
- FR210: Platform administrators can export AI usage data as CSV for finance and margin tracking per tenant, with dispute-proof audit trail linking every billable AI call to a trace ID

## Platform Admin — Platform Monitoring & Incident Control

- FR211: Platform administrators can view a platform health dashboard showing error rates, top issues by affected tenant count, latency metrics, and uptime status
- FR212: Platform administrators can view a background jobs dashboard showing queue depths, failure counts, retry status, and dead letter items with the ability to re-run failed jobs
- FR213: Platform administrators can activate system-wide or per-tenant maintenance mode, disable specific regions, and trigger feature kill-switches for emergency incident response

## Platform Admin — Compliance & Audit

- FR214: The system must maintain an immutable platform audit log recording every platform admin action: tenant lifecycle changes, impersonation sessions, plan changes, quota changes, user resets, data access events, with actor identity, timestamp, IP address, and action details
- FR215: Platform administrators can perform GDPR compliance operations: export all tenant data (DSAR), delete/anonymise tenant data (where lawful), and configure data retention policies per tenant
- FR216: Platform administrators can view data access logs showing which platform admin viewed which tenant's data and the stated reason

## Platform Admin — Support Console

- FR217: Platform administrators can search for tenants by domain, company name, admin email, or customer ID and view tenant diagnostic information including auth status, webhook health, email deliverability, and integration connection status
- FR218: Platform administrators can execute safe "runbook" operations from the support console: re-run failed background jobs, rebuild tenant database indexes, rotate integration tokens, and trigger data re-sync for specific integrations

## Platform API — ERP Runtime Integration

- FR219: The ERP must call the Platform API at tenant login/app initialisation to retrieve entitlements (tenant status, plan, billing status, enforcement action, max users, max companies, enabled modules, feature flags) and cache the response with configurable TTL (default 5 minutes)
- FR220: The ERP must check cached entitlements before loading any module, adding users, or performing write operations, degrading gracefully (showing upgrade prompts or billing notices) when limits are reached or enforcement actions are active
- FR221: The Platform must push real-time events (tenant.suspended, tenant.plan_changed, tenant.quota_warning) to the ERP via webhook to bust the entitlement cache immediately, ensuring enforcement actions take effect within seconds rather than waiting for TTL expiry
- FR222: The ERP must continue operating using last-cached entitlements if the Platform API is unreachable, with AI usage records queued locally for later sync (circuit breaker pattern)

## Platform API — Multi-LLM Provider Abstraction

- FR223: The AI Gateway must route all LLM calls through a provider-agnostic adapter interface (`LLMProvider`), supporting multiple LLM providers (Anthropic, OpenAI, and any future provider via a single adapter class) with unified message, tool, and response formats
- FR224: Enterprise tier tenants can configure their own API keys (BYOK) per LLM provider; BYOK credentials are stored encrypted (AES-256) in the Platform database, and BYOK usage is recorded for audit/observability but not billed against the tenant's token quota
- FR225: The AI Gateway must implement automatic fallback chains — when a primary model fails (rate limit, 5xx error, or timeout exceeding 10 seconds), the gateway retries with the configured fallback model (which may be a different provider), recording fallback usage in the audit trail
- FR226: Platform administrators can manage vendor-level LLM provider API keys, view per-provider AI usage dashboards, and manage Enterprise tenant BYOK key configurations through the Platform Admin Portal
