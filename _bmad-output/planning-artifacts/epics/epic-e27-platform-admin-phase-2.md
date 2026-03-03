# Epic E27+: Platform Admin Phase 2

> **Advanced platform administration including auto-provisioning, Stripe billing integration, advanced monitoring, GDPR tooling, and operational automation.** This extends the Platform Admin Portal (E13b) with production-grade operational features.

**Architecture:** §2.31 Platform Layer
**FRs:** FR193–FR222 (extends E13b coverage)
**NFRs:** NFR46–NFR50

**Dependencies:** E13b (Platform Admin Portal Phase 1), E3b (Platform API + AI Gateway)

---

## Story E27.S1: Auto-Provisioning & Tenant Lifecycle Automation

**User Story:** As a platform administrator, I want tenant provisioning to be fully automated (database creation, schema migration, initial data seeding, DNS configuration) so that new tenants are onboarded in under 60 seconds.

**Acceptance Criteria:**

```gherkin
Scenario: Automated tenant provisioning
  Given a new tenant signs up via the self-service portal
  When the provisioning pipeline runs
  Then a new database is created, schema is migrated, initial data seeded, and the tenant is active (NFR26)
  And the entire process completes within 60 seconds

Scenario: Self-service tenant creation
  Given a prospect completes the signup form
  When they confirm their email
  Then their tenant is automatically provisioned without platform admin intervention
```

**Key Tasks:**
1. Implement automated provisioning pipeline — database creation, Prisma migration, seed data
2. Implement self-service signup flow with email verification
3. Implement provisioning status tracking and rollback on failure
4. Write tests — provisioning under 60s, rollback on failure

**FR/NFR References:** FR193, NFR26

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.20 Platform Admin (FR193) | Tenant provisioning, lifecycle |
| Architecture | §2.31 Platform Layer | Auto-provisioning pipeline |
| UX Design Specification | N/A | Self-service signup UX |
| API Contracts | §2.28 Platform Admin | Provisioning endpoints |
| Data Models | §20 Platform | Tenant, ProvisioningJob models |
| State Machine Reference | N/A | Provisioning pipeline states |
| Event Catalog | N/A | tenant.provisioned event |
| Business Rules Compendium | N/A | Provisioning rules |

---

## Story E27.S2: Stripe Billing Integration

**User Story:** As a platform operator, I want billing automated via Stripe (subscription management, invoice generation, payment processing, dunning) so that tenant payments are handled without manual intervention.

**Acceptance Criteria:**

```gherkin
Scenario: Stripe subscription created on tenant signup
  Given a new tenant selects the "Pro" plan
  When provisioning completes
  Then a Stripe subscription is created and the first invoice is generated

Scenario: Automated dunning on payment failure
  Given a tenant's payment fails
  When the grace period expires
  Then the tenant is moved to read-only mode per enforcement controls (FR203)
```

**Key Tasks:**
1. Implement Stripe integration — subscriptions, invoices, webhooks
2. Implement plan-to-Stripe-price mapping
3. Implement dunning workflow — grace period, read-only, suspension
4. Write tests

**FR/NFR References:** FR201, FR202, FR203, FR204

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.20 Platform Admin (FR201-FR204) | Billing, dunning, enforcement |
| Architecture | §2.31 Platform Layer | Stripe integration design |
| UX Design Specification | N/A | Billing dashboard UI |
| API Contracts | §2.28 Platform Admin | Billing endpoints |
| Data Models | §20 Platform | BillingProfile, Subscription models |
| State Machine Reference | N/A | Billing lifecycle |
| Event Catalog | N/A | billing.payment.failed, tenant.suspended events |
| Business Rules Compendium | N/A | Billing enforcement rules |

---

## Story E27.S3: Advanced Monitoring & Alerting

**User Story:** As a platform operator, I want advanced monitoring dashboards with error rate tracking, latency metrics, and automated alerting so that platform issues are detected and resolved before tenants are impacted.

**Acceptance Criteria:**

```gherkin
Scenario: Platform health dashboard
  Given the platform is serving 100 tenants
  When I view the health dashboard
  Then I see error rates, latency percentiles, queue depths, and uptime status (FR211)

Scenario: Automated alert on error spike
  Given error rate exceeds threshold for 5 minutes
  When the alert fires
  Then platform admins receive email/Slack notification
```

**Key Tasks:**
1. Implement monitoring data collection — error rates, latency, queue metrics
2. Build health dashboard — FR211
3. Implement alerting rules engine — configurable thresholds, notification channels
4. Implement background jobs dashboard — FR212
5. Write tests

**FR/NFR References:** FR211, FR212, FR213, NFR17

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.20 Platform Admin (FR211-FR213) | Monitoring, background jobs, emergency controls |
| Architecture | §2.31 Platform Layer | Monitoring infrastructure |
| UX Design Specification | T4 (Briefing) | Health dashboard |
| API Contracts | §2.28 Platform Admin | Monitoring endpoints |
| Data Models | §20 Platform | Metrics, AlertRule models |
| State Machine Reference | N/A | N/A |
| Event Catalog | N/A | alert.fired event |
| Business Rules Compendium | N/A | Alerting threshold rules |

---

## Story E27.S4: GDPR Tooling & Data Compliance

**User Story:** As a platform administrator, I want GDPR compliance tools (data subject access requests, data deletion/anonymisation, data retention policy configuration) so that we meet regulatory obligations.

**Acceptance Criteria:**

```gherkin
Scenario: Process DSAR (Data Subject Access Request)
  Given a tenant requests data export
  When I trigger the DSAR process
  Then all tenant data is exported in a portable format (FR215)
  And the export is logged in the audit trail

Scenario: Data deletion/anonymisation
  Given a tenant requests data deletion
  When I execute the deletion process
  Then personal data is anonymised where deletion is not possible
  And financial records are retained for 6 years per HMRC (NFR40)
```

**Key Tasks:**
1. Implement DSAR export — gather all tenant data, package in standard format
2. Implement data deletion/anonymisation — selective anonymisation preserving financial integrity
3. Implement retention policy configuration per tenant
4. Build GDPR tools in platform admin portal
5. Write tests

**FR/NFR References:** FR215, FR216, FR93, NFR40

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.20 Platform Admin (FR215, FR216) | GDPR operations, data access logs |
| Architecture | §2.31 Platform Layer | GDPR tooling design |
| UX Design Specification | T7 (Settings) | GDPR tools interface |
| API Contracts | §2.28 Platform Admin | GDPR endpoints |
| Data Models | §20 Platform | DsarRequest, DataRetentionPolicy models |
| State Machine Reference | N/A | DSAR processing lifecycle |
| Event Catalog | N/A | gdpr.dsar.completed event |
| Business Rules Compendium | N/A | Data retention rules, HMRC 6-year rule |

---

## Story E27.S5: Support Console & Runbook Operations

**User Story:** As a support engineer, I want a support console to search for tenants, view diagnostics, and execute safe runbook operations so that tenant issues can be resolved quickly.

**Acceptance Criteria:**

```gherkin
Scenario: Search and diagnose tenant
  Given a tenant reports an issue
  When I search by domain or company name
  Then I see tenant diagnostics: auth status, webhook health, email deliverability, integrations (FR217)

Scenario: Execute runbook operation
  Given a background job failed for a tenant
  When I execute the "re-run failed job" runbook from the console
  Then the job is re-queued and the operation is logged (FR218)
```

**Key Tasks:**
1. Implement tenant search and diagnostics endpoint
2. Implement safe runbook operations — re-run jobs, rebuild indexes, rotate tokens, re-sync
3. Build support console UI — search, diagnostics view, runbook execution
4. Implement audit logging for all support actions
5. Write tests

**FR/NFR References:** FR217, FR218, FR214, NFR49

**Reference Documents:**

| Document | Section | Key Content |
|----------|---------|-------------|
| PRD | §3.1.20 Platform Admin (FR217, FR218, FR214) | Support console, runbooks, audit |
| Architecture | §2.31 Platform Layer | Support console design |
| UX Design Specification | T1 (Entity List), T2 (Record Detail) | Tenant search, diagnostics view |
| API Contracts | §2.28 Platform Admin | Support console endpoints |
| Data Models | §20 Platform | SupportAction, RunbookExecution models |
| State Machine Reference | N/A | Runbook execution lifecycle |
| Event Catalog | N/A | support.runbook.executed event |
| Business Rules Compendium | N/A | Runbook safety rules |

---
