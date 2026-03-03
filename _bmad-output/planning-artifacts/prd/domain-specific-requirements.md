# Domain-Specific Requirements

*Multi-tenancy architecture defined in SaaS B2B Specific Requirements > Tenant Model.*

## Compliance & Regulatory

**UK Tax & VAT:**
- HMRC Making Tax Digital (MTD) — mandatory digital VAT return submission via approved API
- VAT scheme support: Standard, Flat Rate, Cash Accounting, Annual Accounting
- VAT rate handling: Standard (20%), Reduced (5%), Zero (0%), Exempt, Outside Scope, Reverse Charge
- EC Sales List / Postponed VAT Accounting (post-Brexit imports)
- Construction Industry Scheme (CIS) deductions if applicable

**UK Payroll & Employment:**
- Real Time Information (RTI) — FPS and EPS submissions to HMRC per pay period
- PAYE tax calculations using current HMRC tax tables and codes
- National Insurance contributions (employer + employee, multiple categories)
- Student Loan deductions (Plan 1, 2, 4, Postgraduate)
- Statutory payments: SSP, SMP, SPP, ShPP, SAP
- Auto-enrolment pension: eligibility assessment, opt-in/opt-out, contribution calculations
- P45/P46/Starter Declaration handling
- P60 year-end certificates, P11D benefits reporting

**Financial Reporting:**
- Companies House annual accounts (iXBRL format for small/medium companies)
- UK GAAP (FRS 102 / FRS 105 for micro-entities) chart of accounts structure
- Audit trail requirements — immutable once financial periods are closed
- Anti-money laundering (AML) — know-your-customer for financial transactions

**Data Protection:**
- GDPR compliance: data minimisation, right to erasure, data portability, consent management
- Employee data handling per UK Data Protection Act 2018
- Data retention policies (HMRC requires 6 years for financial records)
- Cross-border data transfer restrictions (UK adequacy decisions)

## Technical Constraints

**Security:**
- Encryption at rest (AES-256) and in transit (TLS 1.3)
- Database-per-tenant isolation — zero cross-tenant data leakage by architecture
- Role-based access control with module-level gating
- Session management with configurable timeout
- Audit log for all financial transactions (immutable, tamper-evident)
- API authentication (OAuth 2.0 / API keys) with rate limiting

**Financial Integrity:**
- ACID-compliant transactions for all financial operations
- Double-entry bookkeeping enforcement — every debit has a credit
- Period locking — prevent modifications to closed financial periods
- OKFlag/approval pattern — draft→approved→posted state machine for transactional documents
- Rounding rules per UK VAT guidance (round per line vs round per invoice)
- Multi-currency with daily exchange rate feeds (Bank of England / ECB)

*Performance, availability, and scalability targets specified in Non-Functional Requirements.*

## Integration Requirements

**Banking:**
- Open Banking API (UK) — account information and payment initiation (future)
- Bank feed providers (Plaid, TrueLayer, or Yapily) for transaction ingestion
- OFX/CSV/MT940 file import for manual bank statement upload
- BACS payment file generation for supplier payments and payroll
- Faster Payments / CHAPS support via bank API

**HMRC:**
- MTD VAT API — submit VAT returns, retrieve obligations, view liabilities
- RTI API — submit FPS, EPS, retrieve notifications
- Government Gateway OAuth authentication

**Payroll:**
- UK payroll engine integration (Staffology or PayRun.io API)
- Pension provider API (NEST, People's Pension, or others)
- P45/P60 generation per HMRC specifications

**Third-Party:**
- Email integration (SMTP/IMAP for invoice delivery and bill ingestion)
- AI document understanding service for invoice/receipt/expense extraction (multi-format: PDF, JPEG, PNG, TIFF)
- Exchange rate feed (Bank of England daily rates)
- Companies House API (company lookup, filing)

*Risk assessment consolidated in Project Scoping & Phased Development > Risk Mitigation Strategy.*
