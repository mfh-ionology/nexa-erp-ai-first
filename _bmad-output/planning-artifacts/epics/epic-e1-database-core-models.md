# Epic E1: Database + Core Models

**Tier:** 0 | **Dependencies:** E0 | **Type:** Data foundation
**FRs:** FR80 (user management), FR84 (company settings), FR86 (number series), FR171-FR177 (multi-company & company RBAC), FR193-FR197 (platform tenant management)
**Models:** CompanyProfile, Currency, ExchangeRate, Country, Department, PaymentTerms, VatCode, Tag, BankHoliday, SystemSetting, NumberSeries, User, RegisterSharingRule, UserCompanyRole; Platform: Tenant, Plan, TenantModuleOverride, TenantFeatureFlag, TenantBilling, PlatformUser, PlatformAuditLog, ImpersonationSession, TenantAiUsage, TenantAiQuota
**Enums:** SharingMode, UserRole, ViewScope, TenantStatus, BillingStatus, EnforcementAction, PlatformRole
**Business Rules:** IMP-001 (DB per tenant), IMP-002 (Decimal 19,4), BR-SYS-011/012 (number series)

---

## Story Status Summary

| Story | Title | Status |
|-------|-------|--------|
| E1.1 | Prisma Schema Foundation | Pending |
| E1.2 | System Module Models | Pending |
| E1.3 | Multi-Company Models | Pending |
| E1.4 | User & Session Models | Pending |
| E1.5 | Number Series Service | Pending |
| E1.6 | Platform Database Schema | Pending |

---

## Story E1.S1: Prisma Schema Foundation

**User Story:** As a developer, I want the ERP Prisma schema initialised with base configuration and migration tooling, so that I can define and evolve database models with versioned migrations.

**Acceptance Criteria:**
1. GIVEN packages/db/prisma/schema.prisma WHEN I run `prisma generate` THEN it produces a typed PrismaClient with no errors
2. GIVEN the Prisma schema WHEN I run `prisma migrate dev` against the ERP PostgreSQL container THEN the migration creates all tables in the nexa_erp_dev database
3. GIVEN the schema uses snake_case table mapping WHEN I inspect PostgreSQL THEN all table names use snake_case via @@map() and all column names use snake_case via @map()
4. GIVEN the schema WHEN I review the datasource THEN it connects via DATABASE_URL environment variable pointing to PgBouncer or direct PostgreSQL
5. GIVEN seed scripts WHEN I run `prisma db seed` THEN reference data (currencies, countries, default company) is populated

**Key Tasks:**
- [ ] Initialize Prisma in packages/db (AC: #1, #4)
  - [ ] Run `prisma init` with PostgreSQL provider
  - [ ] Configure datasource with DATABASE_URL
  - [ ] Set Prisma 7.x in package.json
- [ ] Create base Prisma schema with UUID and timestamp conventions (AC: #3)
  - [ ] Define id as `@id @default(uuid())`
  - [ ] Define createdAt/updatedAt with @default(now()) and @updatedAt
  - [ ] Apply @@map("snake_case") to all models, @map("snake_case") to all fields
- [ ] Configure migration tooling (AC: #2)
  - [ ] Create initial migration script
  - [ ] Document migration workflow for per-tenant migrations
- [ ] Create seed script framework (AC: #5)
  - [ ] packages/db/prisma/seed.ts with upsert pattern
  - [ ] Seed ISO 4217 currencies (GBP, EUR, USD minimum)
  - [ ] Seed UK country record
- [ ] Export PrismaClient and types from packages/db (AC: #1)
  - [ ] Create packages/db/src/index.ts exporting client and generated types

**FR/NFR:** FR84 (company settings foundation); NFR38 (fixed-point decimal), NFR44 (versioned migrations)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.1 Monetary Representation, §2.2 Database-per-Tenant, §2.3 Schema Design Principles | DECIMAL(19,4), UUID PKs, snake_case mapping, companyId on every table |
| API Contracts | §1 Data Conventions | Decimal as string, ISO dates, UUID IDs |
| Data Models | §1 Overview, §6 Common Patterns | 234 ERP models, UUID PKs, snake_case, audit fields |
| State Machines | N/A | N/A — no stateful entities in this story |
| Event Catalog | N/A | N/A — no events in this story |
| Business Rules | §14 IMP-001, IMP-002 | Database-per-tenant, Decimal(19,4) for monetary |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §1 Multi-Company Architecture | companyId on EVERY table from Day 1 |

---

## Story E1.S2: System Module Models

**User Story:** As a developer, I want all System module Prisma models defined and migrated, so that the application has reference data entities for currencies, countries, departments, payment terms, VAT codes, and system settings.

**Acceptance Criteria:**
1. GIVEN the Prisma schema WHEN I review System module models THEN CompanyProfile, Currency (natural key code), ExchangeRate, Country, Department, PaymentTerms, VatCode, Tag, BankHoliday, and SystemSetting models are all defined with correct field types and relationships
2. GIVEN all reference entities (Currency, Country, Department, PaymentTerms, VatCode, Tag, BankHoliday) WHEN I inspect their schema THEN each has an `isActive Boolean @default(true)` field per the Active/Inactive Pattern (Architecture §2.3.1)
3. GIVEN the CompanyProfile model WHEN I inspect its fields THEN it includes name, legalName, registrationNumber, vatNumber, utrNumber, baseCurrencyCode (FK to Currency), timezone, vatScheme, address fields, contact fields, and branding fields
4. GIVEN the Currency model WHEN I inspect its primary key THEN it uses code (String, 3 chars, ISO 4217) as natural key (not UUID)
5. GIVEN all monetary fields WHEN I inspect their types THEN they use `Decimal @db.Decimal(19,4)` for amounts and `Decimal @db.Decimal(18,8)` for exchange rates
6. GIVEN seed scripts WHEN I run `prisma db seed` THEN ISO 4217 currencies (minimum GBP, EUR, USD), UK country, default VAT codes (20%, 5%, 0%, Exempt, Reverse Charge), and standard UK payment terms (Net 30, Net 60) are created

**Key Tasks:**
- [ ] Define CompanyProfile model (AC: #3)
  - [ ] Fields: name, legalName, registrationNo, vatNumber, utrNumber, baseCurrencyCode, timezone, vatScheme
  - [ ] Address and contact inline fields
  - [ ] FK to Currency via baseCurrencyCode
- [ ] Define Currency model with natural key (AC: #4)
  - [ ] PK: code String(3) — no UUID
  - [ ] Fields: name, symbol, minorUnit, roundTotal, roundVat, roundLine, isActive
- [ ] Define ExchangeRate model (AC: #5)
  - [ ] Fields: currencyCode FK, rateDate, buyRate Decimal(18,8), sellRate Decimal(18,8)
- [ ] Define remaining reference models (AC: #1, #2)
  - [ ] Country, Department, PaymentTerms, VatCode, Tag, BankHoliday, SystemSetting
  - [ ] All with isActive, companyId, createdAt, updatedAt
- [ ] Create seed data (AC: #6)
  - [ ] ISO 4217 currencies, UK countries, 5 VAT codes, payment terms
- [ ] Add indexes per Architecture patterns (AC: #1)
  - [ ] Composite indexes on [companyId, isActive] for reference entities

**FR/NFR:** FR83 (system settings), FR84 (company configuration); NFR38 (fixed-point decimal)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.3 Schema Design Principles, §2.3.1 Active/Inactive Pattern, §2.8 Number Series | companyId on every table, isActive on reference entities, Decimal types |
| API Contracts | §2.2 System Module | CRUD for currencies, exchange-rates, countries, departments, payment-terms, vat-codes, tags, bank-holidays, system-settings |
| Data Models | §3.1 System Module (Sections 2.8-2.12) | CompanyProfile, Currency, ExchangeRate, Country, Department, PaymentTerms, VatCode, Tag, BankHoliday, SystemSetting |
| State Machines | N/A | N/A — reference entities are not stateful (use isActive instead) |
| Event Catalog | §16 System Events | `settings.updated` event (consumed later in E3) |
| Business Rules | §14 IMP-002, IMP-004 | Decimal(19,4) for monetary, single base currency with FX |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §1 Multi-Company Architecture | companyId on every table, query scoping |

---

## Story E1.S3: Multi-Company Models

**User Story:** As a developer, I want RegisterSharingRule and UserCompanyRole models defined, so that the system supports per-entity register sharing between companies and per-company role overrides.

**Acceptance Criteria:**
1. GIVEN the RegisterSharingRule model WHEN I inspect it THEN it has entityType, sharingMode (SharingMode enum: NONE, ALL_COMPANIES, SELECTED), sourceCompanyId, and optional targetCompanyId fields with a unique constraint on [entityType, sourceCompanyId, targetCompanyId]
2. GIVEN the UserCompanyRole model WHEN I inspect it THEN it has userId, optional companyId (null = global role), and role (UserRole enum) with a unique constraint on [userId, companyId]
3. GIVEN the SharingMode enum WHEN I inspect it THEN it contains exactly NONE, ALL_COMPANIES, SELECTED values
4. GIVEN the UserRole enum WHEN I inspect it THEN it contains SUPER_ADMIN, ADMIN, MANAGER, STAFF, VIEWER in hierarchy order
5. GIVEN a helper function getVisibleCompanyIds(companyId, entityType) WHEN called THEN it returns the set of companyIds visible based on RegisterSharingRule configuration per Project Context §1

**Key Tasks:**
- [ ] Define SharingMode enum (AC: #3)
  - [ ] NONE, ALL_COMPANIES, SELECTED
- [ ] Define RegisterSharingRule model (AC: #1)
  - [ ] Fields: entityType, sharingMode, sourceCompanyId, targetCompanyId (nullable)
  - [ ] Named relations to Company: SharingSource, SharingTarget
  - [ ] Unique constraint: [entityType, sourceCompanyId, targetCompanyId]
- [ ] Define UserRole enum (AC: #4)
  - [ ] SUPER_ADMIN, ADMIN, MANAGER, STAFF, VIEWER
- [ ] Define UserCompanyRole model (AC: #2)
  - [ ] Fields: userId, companyId (nullable for global), role
  - [ ] Unique constraint: [userId, companyId]
  - [ ] Relations to User and Company
- [ ] Implement getVisibleCompanyIds utility (AC: #5)
  - [ ] In packages/db/src/utils/sharing.ts
  - [ ] Query RegisterSharingRule, compute visible company set
  - [ ] Unit tests for NONE, ALL_COMPANIES, SELECTED modes

**FR/NFR:** FR171-FR174 (multi-company), FR175-FR177 (company RBAC)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.3 Schema Design Principles | companyId on every table, RegisterSharingRule pattern |
| API Contracts | §1 RBAC Roles | SUPER_ADMIN > ADMIN > MANAGER > STAFF > VIEWER hierarchy |
| Data Models | §3.1 System Module, §4.1 System Module Enums | RegisterSharingRule, UserCompanyRole, SharingMode, UserRole enums |
| State Machines | N/A | N/A — these are configuration entities, not stateful |
| Event Catalog | N/A | N/A — no events emitted for config changes (audit only) |
| Business Rules | §14 IMP-007 | RBAC with 5 default roles |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §1 Multi-Company Architecture, §2 RBAC: Global Role + Per-Company Exceptions | getVisibleCompanyIds query pattern, role resolution: company-specific then global then no-access |

---

## Story E1.S4: User & Session Models

**User Story:** As a developer, I want User and Session models defined with all authentication-related fields, so that the auth system in E2 has its data foundation.

**Acceptance Criteria:**
1. GIVEN the User model WHEN I inspect it THEN it includes email (unique), passwordHash, firstName, lastName, role, mfaEnabled, mfaSecret (nullable), isActive, lastLoginAt, and standard audit fields
2. GIVEN the User model WHEN I inspect the passwordHash field THEN it is stored as String with no length constraint (Argon2id hashes vary in length)
3. GIVEN the User model WHEN I inspect its relations THEN it relates to UserCompanyRole[], Session[], and has companyId FK (the user's default company)
4. GIVEN a Session or RefreshToken model WHEN I inspect it THEN it includes userId, token (hashed), expiresAt, ipAddress, userAgent, createdAt, and revokedAt (nullable for revocation)
5. GIVEN the User model WHEN I check for enabledModules THEN it has an enabledModules Json field (string array) for per-user module gating

**Key Tasks:**
- [ ] Define User model (AC: #1, #2, #3, #5)
  - [ ] Fields: email, passwordHash, firstName, lastName, mfaEnabled, mfaSecret, isActive, lastLoginAt, enabledModules (Json)
  - [ ] companyId FK to CompanyProfile (default company)
  - [ ] Relations to UserCompanyRole[], RefreshToken[]
  - [ ] Unique constraint on email
- [ ] Define RefreshToken model (AC: #4)
  - [ ] Fields: userId, tokenHash, expiresAt, ipAddress, userAgent, createdAt, revokedAt
  - [ ] Index on tokenHash for fast lookup
  - [ ] Index on [userId, revokedAt] for active session queries
- [ ] Add seed data for initial admin user (AC: #1)
  - [ ] Default SUPER_ADMIN user with known credentials for development
- [ ] Run migration and verify (AC: #1-#5)
  - [ ] `prisma migrate dev --name add-user-session-models`
  - [ ] Verify tables created in PostgreSQL

**FR/NFR:** FR80 (user management); NFR10 (MFA support), NFR13 (Argon2 password hashing)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §3 Authentication & Security | Argon2id, JWT, TOTP MFA, session management, 15min access + 7d refresh |
| API Contracts | §2.1 Auth & Session, §3.1 Auth Endpoints | Login/logout/refresh/mfa/password endpoints |
| Data Models | §3.1 System Module | User model fields, relations |
| State Machines | N/A | N/A — user accounts use isActive, not state machine |
| Event Catalog | §16 System Events | `user.login` event payload includes userId, loginMethod, ipAddress |
| Business Rules | §14 IMP-007, IMP-008 | RBAC with 5 roles, MFA support |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §2 RBAC: Global Role + Per-Company Exceptions | Role resolution: company-specific then global then no-access |

---

## Story E1.S5: Number Series Service

**User Story:** As a developer, I want a number series model and atomic generation service, so that every document type (invoices, POs, SOs, etc.) gets unique, gap-free, sequential reference numbers.

**Acceptance Criteria:**
1. GIVEN the NumberSeries model WHEN I inspect it THEN it includes companyId, entityType (unique per company), prefix, nextValue, padding, suffix (optional), isActive, and optional date-range sub-range fields
2. GIVEN the nextNumber() service function WHEN called concurrently by 10 simultaneous requests for the same entityType THEN all 10 receive unique sequential numbers with no gaps or duplicates
3. GIVEN a NumberSeries with prefix "INV-" and padding 5 WHEN nextNumber('INVOICE') is called THEN it returns "INV-00001", "INV-00002", etc.
4. GIVEN a NumberSeries with date-range sub-ranges WHEN the current date falls within a sub-range THEN the sub-range prefix and counter are used instead of the main series
5. GIVEN seed data WHEN the database is seeded THEN default number series exist for INVOICE, CREDIT_NOTE, PURCHASE_ORDER, SALES_ORDER, JOURNAL_ENTRY, DISPATCH, GOODS_RECEIPT, SUPPLIER_BILL

**Key Tasks:**
- [ ] Define NumberSeries model (AC: #1)
  - [ ] Fields: companyId, entityType, prefix, nextValue, padding, suffix, isActive
  - [ ] Unique constraint: [companyId, entityType]
  - [ ] Optional sub-range fields: validFrom, validTo, subRangePrefix
- [ ] Implement atomic nextNumber() function (AC: #2, #3)
  - [ ] Use UPDATE ... RETURNING with row-level lock for gap-free generation
  - [ ] In packages/db/src/services/number-series.service.ts
  - [ ] Accept companyId and entityType, return formatted string
- [ ] Implement date-range sub-range logic (AC: #4)
  - [ ] Check if current date falls within any sub-range
  - [ ] Use sub-range prefix/counter if applicable
- [ ] Write concurrency tests (AC: #2)
  - [ ] 10 parallel calls must produce unique sequential numbers
  - [ ] Test with Vitest using real database (integration test)
- [ ] Create seed data for default series (AC: #5)
  - [ ] INVOICE (INV-), CREDIT_NOTE (CN-), PURCHASE_ORDER (PO-), SALES_ORDER (SO-), JOURNAL_ENTRY (JE-), DISPATCH (DSP-), GOODS_RECEIPT (GRN-), SUPPLIER_BILL (BILL-)

**FR/NFR:** FR86 (number series configuration); NFR18 (zero data loss — ACID)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.8 Number Series | PostgreSQL function next_number(), gap-free via UPDATE lock, prefix + LPAD |
| API Contracts | §2.2 System Module | CRUD `/system/number-series` endpoint |
| Data Models | §6.2 Number Series Integration | NumberSeries model, entityType pattern |
| State Machines | N/A | N/A — number series is not a stateful entity |
| Event Catalog | N/A | N/A — number generation does not emit events |
| Business Rules | §12 BR-SYS-011, BR-SYS-012 | Atomic generation in DB transaction, date-range sub-ranges with overlap validation |
| UX Design Spec | N/A | N/A — no UI in this story |
| Project Context | §1 Multi-Company Architecture | companyId scoping — number series are per-company |

---

## Story E1.S6: Platform Database Schema

**User Story:** As a developer, I want the Platform database Prisma schema defined and migrated with all platform-level models, so that tenant management, billing, AI usage tracking, and platform admin operations have their data foundation.

**Acceptance Criteria:**
1. GIVEN the Platform Prisma schema at apps/platform-api/prisma/schema.prisma WHEN I run `prisma generate` THEN it produces a separate PlatformPrismaClient with no conflicts with the ERP PrismaClient
2. GIVEN the Tenant model WHEN I inspect it THEN it includes code (unique slug), displayName, legalName, status (TenantStatus enum), planId FK, billingStatus, region, dbHost, dbName, dbPort, sandboxEnabled, lastActivityAt, and relations to Plan, TenantModuleOverride[], TenantFeatureFlag[], TenantAiQuota, TenantAiUsage[], TenantBilling, ImpersonationSession[]
3. GIVEN the Plan model WHEN I inspect it THEN it includes code (unique), displayName, maxUsers, maxCompanies, monthlyAiTokenAllowance (BigInt), aiHardLimit (Boolean), enabledModules (Json), apiRateLimit, isActive
4. GIVEN the PlatformUser model WHEN I inspect it THEN it includes email (unique), passwordHash, displayName, role (PlatformRole: PLATFORM_ADMIN, PLATFORM_VIEWER), mfaEnabled, mfaSecret, isActive
5. GIVEN the PlatformAuditLog model WHEN I inspect it THEN it is append-only by design with no updatedAt field, and includes platformUserId, action, targetType, targetId, details (Json), ipAddress, userAgent, timestamp
6. GIVEN seed scripts WHEN I run the platform seed THEN default plans (Core, Pro, Enterprise), a founding tenant record, and a default PLATFORM_ADMIN account are created

**Key Tasks:**
- [ ] Create Platform Prisma schema (AC: #1)
  - [ ] Separate schema file at apps/platform-api/prisma/schema.prisma
  - [ ] Separate datasource pointing to PLATFORM_DATABASE_URL
  - [ ] Configure separate output directory for generated client
- [ ] Define Tenant and TenantStatus enum (AC: #2)
  - [ ] TenantStatus: PROVISIONING, ACTIVE, SUSPENDED, READ_ONLY, ARCHIVED
  - [ ] BillingStatus: CURRENT, GRACE, OVERDUE, BLOCKED
  - [ ] All fields per Architecture §2.31.2
- [ ] Define Plan model (AC: #3)
  - [ ] Natural plan codes: core, pro, enterprise, custom
  - [ ] enabledModules as JsonB (string array of module keys)
- [ ] Define supporting models (AC: #2)
  - [ ] TenantModuleOverride, TenantFeatureFlag, TenantAiUsage, TenantAiQuota, TenantBilling
  - [ ] EnforcementAction enum: NONE, WARNING, READ_ONLY, SUSPENDED
- [ ] Define PlatformUser and PlatformRole (AC: #4)
  - [ ] PlatformRole: PLATFORM_ADMIN, PLATFORM_VIEWER
  - [ ] MFA fields, isActive, lastLoginAt
- [ ] Define PlatformAuditLog (AC: #5)
  - [ ] Append-only: no updatedAt, indexes on [platformUserId, timestamp] and [targetType, targetId]
- [ ] Define ImpersonationSession (AC: #2)
  - [ ] Fields: platformUserId, tenantId, reason, startedAt, endedAt, expiresAt, actionsLog (Json)
- [ ] Create platform seed data (AC: #6)
  - [ ] 3 default plans with module entitlements
  - [ ] Founding tenant record for development
  - [ ] Default PLATFORM_ADMIN user
- [ ] Run migration (AC: #1-#6)
  - [ ] `prisma migrate dev` against platform-db container

**FR/NFR:** FR193-FR197 (tenant management, plans, billing, platform admin identity); NFR49 (immutable platform audit)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31 Platform Admin — full section (2.31.1-2.31.5) | Platform DB schema, AI Gateway, Platform Client SDK, ERP integration points |
| API Contracts | §20 Platform API (Internal), §21 Platform Admin API | Entitlement endpoints, tenant CRUD, plan/billing, AI usage/quota, impersonation |
| Data Models | §5 Platform Database Models (Section 2.31) | Tenant, Plan, TenantModuleOverride, TenantFeatureFlag, TenantAiUsage, TenantAiQuota, TenantBilling, PlatformUser, PlatformAuditLog, ImpersonationSession |
| State Machines | §20.1 Tenant Lifecycle, §20.2 Billing Enforcement, §20.3 AI Quota State | PROVISIONING->ACTIVE->SUSPENDED->ARCHIVED, NONE->WARNING->READ_ONLY->SUSPENDED |
| Event Catalog | §19 Platform Admin Events | tenant.created, tenant.suspended, tenant.reactivated, tenant.archived, tenant.plan_changed, billing.*, platform.impersonation.* |
| Business Rules | §14b BR-PLT-001 to BR-PLT-021 | Tenant lifecycle, billing enforcement, AI quota, impersonation safeguards, platform audit |
| UX Design Spec | §Platform Admin Portal | Separate app, dark sidebar, PLATFORM ADMIN branding, tenant detail tabs |
| Project Context | §8b Platform Layer Architecture | Two databases, two applications, ERP never calls Platform DB directly |

---
