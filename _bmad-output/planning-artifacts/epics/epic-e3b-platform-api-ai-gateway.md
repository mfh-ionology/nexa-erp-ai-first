# Epic E3b: Platform API + AI Gateway

**Tier:** 0 | **Dependencies:** E1 (Platform DB schema) | **Type:** Platform infrastructure
**FRs:** FR198-FR210 (AI Gateway, quota), FR193-FR197 (platform admin auth), FR219-FR222 (ERP runtime integration)
**Platform Models:** Tenant, Plan, TenantAiUsage, TenantAiQuota, ImpersonationSession, PlatformUser
**Business Rules:** BR-PLT-001 to BR-PLT-021 (tenant lifecycle, billing, AI quota, impersonation, audit)
**NFRs:** NFR46 (Platform API <50ms), NFR47 (AI Gateway <100ms added), NFR48 (mandatory MFA), NFR49 (immutable audit), NFR50 (durable AI records), NFR51 (webhook <30s cache invalidation)

---

## Story E3b.S1: Platform API Server

**User Story:** As a platform developer, I want a separate Fastify instance for the Platform API with its own authentication system, so that platform admin operations and ERP runtime entitlement checks are served independently from tenant ERP requests.

**Acceptance Criteria:**
1. GIVEN the Platform API server in apps/platform-api WHEN it starts THEN it connects to the Platform database (not any tenant ERP database) and serves on a separate port
2. GIVEN a PlatformUser with PLATFORM_ADMIN role and MFA enabled WHEN they POST /admin/auth/login with correct credentials and TOTP code THEN a platform-level JWT is issued with platformUserId and platformRole claims
3. GIVEN a PLATFORM_ADMIN account WHEN MFA is not enabled THEN login is blocked per BR-PLT-018 (mandatory MFA for PLATFORM_ADMIN)
4. GIVEN the Platform API WHEN GET /admin/monitoring/health is called THEN it returns platform health status including database connectivity, Redis availability, and uptime
5. GIVEN an internal service token WHEN ERP calls GET /platform/tenants/:id/entitlements THEN the request is authenticated and the endpoint responds within 50ms (NFR46)
6. GIVEN the Platform API WHEN any state-changing admin action is performed THEN a PlatformAuditLog record is created with actor, action, target, details, IP, and timestamp (BR-PLT-017)

**Key Tasks:**
- [ ] Create Platform API Fastify app (AC: #1)
  - [ ] apps/platform-api/src/app.ts — separate Fastify instance
  - [ ] Connect to Platform PrismaClient (separate schema)
  - [ ] Register CORS, Helmet, rate limiting, error handler
  - [ ] Separate port from ERP API
- [ ] Implement Platform auth (AC: #2, #3)
  - [ ] POST /admin/auth/login — PlatformUser auth with Argon2id
  - [ ] Mandatory MFA verification for PLATFORM_ADMIN (BR-PLT-018)
  - [ ] POST /admin/auth/mfa/verify, POST /admin/auth/refresh
  - [ ] Platform JWT with platformUserId, platformRole claims
- [ ] Implement internal service token auth (AC: #5)
  - [ ] Middleware for ERP-facing endpoints (/platform/*)
  - [ ] Validate internal service bearer token
  - [ ] Optimise for <50ms response time
- [ ] Implement health endpoint (AC: #4)
  - [ ] GET /admin/monitoring/health
  - [ ] Check DB connectivity, Redis ping, uptime
- [ ] Implement platform audit middleware (AC: #6)
  - [ ] Automatic PlatformAuditLog creation for all state-changing routes
  - [ ] Capture platformUserId, action, targetType, targetId, IP, userAgent
- [ ] Implement platform user management (AC: #2)
  - [ ] GET /admin/users, POST /admin/users, PATCH /admin/users/:id
  - [ ] PLATFORM_ADMIN role required for management

**FR/NFR:** FR197 (platform admin auth), FR214 (platform audit); NFR46 (Platform API <50ms), NFR48 (mandatory MFA), NFR49 (immutable audit)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31.1 Architecture Overview, §2.31.2 Platform Database Schema | Platform API = separate Fastify, internal service tokens, Platform DB |
| API Contracts | §21.9 Platform Auth, §21.6 Platform Monitoring | /admin/auth/login, /admin/auth/mfa/verify, /admin/monitoring/health |
| Data Models | §5 Platform Database Models | PlatformUser, PlatformAuditLog, PlatformRole enum |
| State Machines | N/A | N/A — Platform API server startup is not a state machine |
| Event Catalog | §19 Platform Admin Events | All platform admin actions produce audit entries |
| Business Rules | §14b BR-PLT-016 to BR-PLT-018 | Immutable audit log, every state change logged, mandatory MFA for PLATFORM_ADMIN |
| UX Design Spec | §Platform Admin Portal | Separate app with dark sidebar, PLATFORM ADMIN branding |
| Project Context | §8b Platform Layer Architecture | Two databases, two applications, Platform audit is append-only |

---

## Story E3b.S2: Tenant Management API

**User Story:** As a platform administrator, I want to manage tenant lifecycle (create, view, suspend, reactivate, archive), so that I can onboard new customers and control their access.

**Acceptance Criteria:**
1. GIVEN PLATFORM_ADMIN role WHEN POST /admin/tenants is called with valid tenant data THEN a new Tenant record is created in PROVISIONING status with the assigned plan, database connection metadata, and a PlatformAuditLog entry
2. GIVEN a tenant in PROVISIONING status WHEN provisioning completes THEN the status transitions to ACTIVE and a `tenant.created` event is emitted
3. GIVEN a tenant in ACTIVE status WHEN POST /admin/tenants/:id/suspend is called with a reason THEN the status transitions to SUSPENDED, a `tenant.suspended` webhook is pushed to the ERP, and a PlatformAuditLog entry is created
4. GIVEN a tenant in SUSPENDED status WHEN POST /admin/tenants/:id/reactivate is called THEN the status transitions to ACTIVE, a `tenant.reactivated` webhook is pushed, and a PlatformAuditLog entry is created
5. GIVEN a tenant in SUSPENDED status WHEN POST /admin/tenants/:id/archive is called THEN the status transitions to ARCHIVED (irrecoverable from UI), a `tenant.archived` webhook is pushed, and a PlatformAuditLog entry is created
6. GIVEN invalid state transitions (e.g., ACTIVE to ARCHIVED directly) WHEN attempted THEN a 422 INVALID_STATE_TRANSITION error is returned per BR-PLT-001

**Key Tasks:**
- [ ] Implement tenant CRUD routes (AC: #1)
  - [ ] POST /admin/tenants — create with plan assignment
  - [ ] GET /admin/tenants — list with filters (status, plan, search)
  - [ ] GET /admin/tenants/:id — full detail
  - [ ] PATCH /admin/tenants/:id — update settings
- [ ] Implement tenant lifecycle state machine (AC: #2-#6)
  - [ ] State transitions: PROVISIONING->ACTIVE, ACTIVE->SUSPENDED, SUSPENDED->ACTIVE, SUSPENDED->ARCHIVED
  - [ ] Invalid transitions rejected with 422
  - [ ] All transitions create PlatformAuditLog entries
- [ ] Implement suspend/reactivate/archive endpoints (AC: #3, #4, #5)
  - [ ] POST /admin/tenants/:id/suspend (requires reason)
  - [ ] POST /admin/tenants/:id/reactivate
  - [ ] POST /admin/tenants/:id/archive
- [ ] Implement webhook push for lifecycle events (AC: #3, #4, #5)
  - [ ] Push tenant.suspended, tenant.reactivated, tenant.archived to ERP webhook
  - [ ] POST to https://{tenant-slug}.nexa-erp.com/webhooks/platform
- [ ] Implement module and feature flag management (AC: #1)
  - [ ] PUT /admin/tenants/:id/modules — set module overrides
  - [ ] PUT /admin/tenants/:id/feature-flags — set feature flags
  - [ ] Push tenant.modules_changed webhook on change
- [ ] Write tests for all lifecycle transitions (AC: #2-#6)
  - [ ] Valid transitions succeed
  - [ ] Invalid transitions return 422
  - [ ] Audit log created for each action

**FR/NFR:** FR193-FR196 (tenant CRUD, lifecycle, modules, flags); NFR49 (audit), NFR51 (webhook <30s)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31.2 Platform Database Schema | Tenant model, TenantStatus enum, TenantModuleOverride, TenantFeatureFlag |
| API Contracts | §21.1 Tenant Management, §21.2 Tenant User Management | POST/GET/PATCH /admin/tenants, suspend, reactivate, archive, modules, flags |
| Data Models | §5 Platform Database Models — Tenant, TenantModuleOverride, TenantFeatureFlag | All fields, enums, relations |
| State Machines | §20.1 Tenant Lifecycle | PROVISIONING->ACTIVE->SUSPENDED->ARCHIVED with guards and side effects |
| Event Catalog | §19 Platform Admin Events | tenant.created, tenant.suspended, tenant.reactivated, tenant.archived, tenant.modules_changed |
| Business Rules | §14b BR-PLT-001 to BR-PLT-003 | Strict state machine, suspension within 30s, archived = irrecoverable from UI |
| UX Design Spec | §Platform Admin Portal — Navigation | Tenants section: list, detail (overview/modules/users/AI/billing/diagnostics/audit tabs), create wizard |
| Project Context | §8b Platform Layer Architecture | ERP checks entitlements via Platform Client SDK, webhook for cache invalidation |

---

## Story E3b.S3: AI Gateway Service + Provider Adapters

**User Story:** As a developer, I want a single AI Gateway service through which all LLM calls are routed, so that every AI interaction is quota-checked, proxied, and usage-recorded with zero loss.

**Acceptance Criteria:**
1. GIVEN any ERP module WHEN it needs to call an LLM THEN it must call `aiGateway.complete()` (no direct LLM API calls — all provider SDKs encapsulated in adapters) per BR-PLT-007
2. GIVEN an AI call request WHEN the AI Gateway receives it THEN it first calls POST /platform/tenants/:id/ai/check with estimated tokens and feature key, and only proceeds if `allowed: true`
3. GIVEN the quota check returns `allowed: false` (hard limit reached) WHEN `plan.aiHardLimit = true` THEN the gateway returns an AI_QUOTA_EXCEEDED error without calling the LLM
4. GIVEN a successful AI call WHEN the LLM response is received THEN the gateway calls POST /platform/tenants/:id/ai/record with usage data (fire-and-forget with retry queue) and returns the response to the calling module
5. GIVEN the Platform API is unreachable WHEN the gateway performs a quota check THEN it serves from cached quota data and queues the usage record for later sync per BR-PLT-020
6. GIVEN the AI Gateway adds overhead WHEN measured end-to-end THEN the quota check + usage recording adds no more than 100ms latency per NFR47
7. GIVEN the AI Gateway WHEN it receives a completion request THEN it resolves the provider adapter from the AiModel registry, resolves credentials (vendor key or tenant BYOK), calls the provider adapter, and normalises the response to a unified LLMResponse format
8. GIVEN a primary model fails (rate limit, 5xx, timeout >10s) WHEN a fallbackModelId is configured on the AiModel THEN the gateway retries with the fallback model and records `fallbackUsed: true` in the usage record

**Key Tasks:**
- [ ] Create AI Gateway package (AC: #1)
  - [ ] packages/ai-gateway/src/index.ts
  - [ ] Export `AiGateway` class with `complete()` method
  - [ ] Accept: tenantId, userId, featureKey, messages, tools
- [ ] Implement pre-call quota check (AC: #2, #3)
  - [ ] Call POST /platform/tenants/:id/ai/check
  - [ ] Handle `allowed: false` — throw AiQuotaExceededError
  - [ ] Handle soft limit warnings — attach to response metadata
- [ ] Implement LLM provider adapter layer (AC: #4, #7)
  - [ ] Define `LLMProvider` interface in `packages/ai-gateway/src/providers/llm-provider.interface.ts`
  - [ ] Implement `ProviderRegistry` in `packages/ai-gateway/src/providers/provider-registry.ts`
  - [ ] Implement `AnthropicAdapter` in `packages/ai-gateway/src/providers/adapters/anthropic.adapter.ts`
  - [ ] Implement `OpenAIAdapter` in `packages/ai-gateway/src/providers/adapters/openai.adapter.ts`
  - [ ] Implement unified message/tool converters (`message-converter.ts`, `tool-converter.ts`)
  - [ ] Resolve provider from `AiModel.provider` field at call time
  - [ ] Stream or complete based on caller preference (provider-agnostic)
  - [ ] Measure prompt/completion tokens from unified `LLMResponse`
- [ ] Implement credential resolution (AC: #7)
  - [ ] `packages/ai-gateway/src/credentials/credential-resolver.ts`
  - [ ] Resolution order: (1) tenant BYOK key from `TenantProviderCredential`, (2) vendor platform key
  - [ ] Decrypt BYOK keys at call time (AES-256)
  - [ ] Pass resolved credentials to provider adapter
- [ ] Implement fallback chain (AC: #8)
  - [ ] On provider error (rate limit, 5xx, timeout >10s), resolve `AiModel.fallbackModelId`
  - [ ] Retry with fallback model (may be different provider)
  - [ ] Record `fallbackUsed: true` and `fallbackFrom` in usage data
- [ ] Implement post-call usage recording (AC: #4, #5)
  - [ ] POST /platform/tenants/:id/ai/record
  - [ ] Fire-and-forget with local retry queue (BullMQ)
  - [ ] Zero-loss guarantee: queue locally if Platform unreachable
- [ ] Implement circuit breaker for Platform API (AC: #5)
  - [ ] If Platform unreachable for >10s, serve stale cached quota
  - [ ] Log degraded state
- [ ] Write performance tests (AC: #6)
  - [ ] Measure overhead of quota check + recording
  - [ ] Assert <100ms added latency

**FR/NFR:** FR205, FR206, FR223 (multi-LLM provider adapters), FR224 (BYOK), FR225 (fallback chains); NFR47, NFR50

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31.3 AI Gateway Service, §6.1b Provider Adapter Interface | Flow: ERP -> aiGateway.complete() -> quota check -> resolve provider -> provider adapter -> usage record -> return; LLMProvider interface, ProviderRegistry, credential resolution, fallback chains |
| API Contracts | §20.2 AI Gateway | POST /platform/tenants/:id/ai/check, POST /platform/tenants/:id/ai/record, GET /platform/tenants/:id/ai/usage |
| Data Models | §5 Platform Database Models — TenantAiUsage, TenantAiQuota | Usage record fields, quota tracking fields |
| State Machines | §20.3 AI Quota State (Runtime) | NORMAL->ALERT_50->SOFT_LIMIT->HARD_LIMIT->ANOMALY thresholds |
| Event Catalog | §19 Platform Admin Events | tenant.quota_warning, tenant.quota_exceeded events |
| Business Rules | §14b BR-PLT-007 to BR-PLT-011 | All AI via gateway, quota check before every call, durable usage records, configurable thresholds, spike detection |
| UX Design Spec | §Platform Admin Portal — AI Usage | Token dashboards, quota alerts, CSV export |
| Project Context | §8b Platform Layer Architecture — AI Gateway | Mandatory routing, no direct LLM API calls from business modules |

---

## Story E3b.S4: Platform Client SDK

**User Story:** As a developer, I want a thin Platform Client SDK library that every ERP service imports, so that entitlement checks, AI quota queries, and cache invalidation are handled consistently with circuit breaker resilience.

**Acceptance Criteria:**
1. GIVEN the SDK in packages/platform-client WHEN an ERP service calls `getEntitlements(tenantId)` THEN it returns cached TenantEntitlements (status, planCode, billingStatus, enforcementAction, maxUsers, maxCompanies, enabledModules, featureFlags) with 5-minute TTL
2. GIVEN the SDK WHEN `checkModuleAccess(tenantId, moduleKey)` is called THEN it returns `{ allowed: boolean, reason?: string }` from cached entitlements without a network call
3. GIVEN the SDK WHEN `checkAiQuota(tenantId, estimatedTokens, featureKey)` is called THEN it makes a live call to the Platform API (no caching for quota — must be real-time)
4. GIVEN a webhook event `tenant.plan_changed` WHEN the ERP webhook listener receives it THEN it calls `invalidateCache(tenantId)` to bust the entitlement cache immediately
5. GIVEN the Platform API is unreachable for >10 seconds WHEN the circuit breaker triggers THEN the SDK serves stale cached entitlements with `degraded: true` flag and does not throw
6. GIVEN the webhook endpoint at POST /webhooks/platform WHEN the ERP receives a platform event THEN it validates the internal service token, parses the event, and routes to the appropriate handler

**Key Tasks:**
- [ ] Create Platform Client SDK package (AC: #1, #2)
  - [ ] packages/platform-client/src/index.ts
  - [ ] Implement PlatformClient interface per Architecture §2.31.4
  - [ ] getEntitlements(), checkModuleAccess(), checkUserQuota(), getTenantStatus()
- [ ] Implement entitlement caching (AC: #1)
  - [ ] Redis cache (production) or in-memory LRU (development)
  - [ ] 5-minute TTL on entitlements
  - [ ] Cache key: `platform:entitlements:{tenantId}`
- [ ] Implement AI quota methods (AC: #3)
  - [ ] checkAiQuota() — live call, no cache
  - [ ] recordAiUsage() — async, queued, zero-loss
- [ ] Implement cache invalidation (AC: #4)
  - [ ] invalidateCache(tenantId) — delete from Redis/LRU
  - [ ] Called by webhook handler
- [ ] Implement circuit breaker (AC: #5)
  - [ ] If Platform API unreachable for >10s, serve stale cache
  - [ ] Return `degraded: true` flag in response
  - [ ] Log circuit breaker state changes
- [ ] Implement webhook listener route (AC: #6)
  - [ ] POST /webhooks/platform on ERP API
  - [ ] Validate internal service token
  - [ ] Parse event: tenant.suspended, tenant.plan_changed, tenant.quota_warning
  - [ ] Route to appropriate handler (cache invalidation, banner display, etc.)
- [ ] Write tests (AC: #1-#6)
  - [ ] Test caching and TTL expiry
  - [ ] Test circuit breaker behaviour
  - [ ] Test webhook event processing

**FR/NFR:** FR219-FR222 (ERP runtime integration — entitlements, module access, webhook invalidation, circuit breaker); NFR51 (<30s cache invalidation)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31.4 Platform Client SDK, §2.31.5 ERP Integration Points | PlatformClient interface, TenantEntitlements type, caching strategy, circuit breaker, webhook listener |
| API Contracts | §20.1 Entitlements, §20.3 Webhooks | GET /platform/tenants/:id/entitlements response schema, webhook payload format |
| Data Models | §5 Platform Database Models | TenantEntitlements derived from Tenant + Plan + TenantModuleOverride + TenantFeatureFlag |
| State Machines | §20.1 Tenant Lifecycle | Tenant status determines entitlement: SUSPENDED blocks login, READ_ONLY blocks writes |
| Event Catalog | §19 Platform Admin Events, §ERP Webhook Delivery | tenant.suspended, tenant.plan_changed, tenant.quota_warning events delivered via webhook |
| Business Rules | §14b BR-PLT-019 to BR-PLT-021 | ERP must check at login, degrade gracefully if unreachable, deny module access if not in plan |
| UX Design Spec | N/A | N/A — SDK is backend infrastructure |
| Project Context | §8b Platform Layer Architecture — Platform Client SDK | 5-min TTL, webhook-invalidated, circuit breaker serves stale cache, ERP never crashes due to Platform outage |

---

## Story E3b.S5: Plan & Billing Management

**User Story:** As a platform administrator, I want to manage subscription plans and track billing status per tenant, so that I can enforce plan limits and handle payment escalation.

**Acceptance Criteria:**
1. GIVEN PLATFORM_ADMIN role WHEN I call POST /admin/plans with plan data THEN a new Plan is created with code, displayName, maxUsers, maxCompanies, monthlyAiTokenAllowance, aiHardLimit, enabledModules, apiRateLimit
2. GIVEN PLATFORM_ADMIN role WHEN I call POST /admin/tenants/:id/assign-plan with a new planId THEN the tenant's plan is changed, a `tenant.plan_changed` webhook is pushed to the ERP, and a PlatformAuditLog entry is created
3. GIVEN a tenant's billing status WHEN GET /admin/tenants/:id/billing is called THEN it returns stripeCustomerId, subscriptionStatus, currentPeriodEnd, gracePeriodDays, lastPaymentAt, dunningLevel, and current enforcementAction
4. GIVEN billing enforcement escalation WHEN a tenant's payment becomes overdue THEN the system progresses through NONE->WARNING->READ_ONLY->SUSPENDED based on configurable dunning thresholds per BR-PLT-004
5. GIVEN a tenant in READ_ONLY enforcement WHEN the ERP checks entitlements THEN write operations are blocked and a billing notice is shown (BR-PLT-005)
6. GIVEN a plan change WHEN it takes effect THEN the new module entitlements apply immediately after the webhook invalidates the ERP cache (BR-PLT-006)

**Key Tasks:**
- [ ] Implement Plan CRUD routes (AC: #1)
  - [ ] GET /admin/plans — list all plans
  - [ ] POST /admin/plans — create plan
  - [ ] PATCH /admin/plans/:id — update plan limits/modules
  - [ ] Plan code uniqueness enforcement
- [ ] Implement plan assignment (AC: #2, #6)
  - [ ] POST /admin/tenants/:id/assign-plan
  - [ ] Update tenant.planId
  - [ ] Push tenant.plan_changed webhook
  - [ ] Create PlatformAuditLog entry
- [ ] Implement billing status endpoints (AC: #3)
  - [ ] GET /admin/tenants/:id/billing
  - [ ] Return TenantBilling record with all fields
- [ ] Implement billing enforcement engine (AC: #4, #5)
  - [ ] PATCH /admin/tenants/:id/billing/enforcement
  - [ ] Enforcement state machine: NONE->WARNING->READ_ONLY->SUSPENDED
  - [ ] Push billing.enforcement_changed webhook on transitions
  - [ ] Background job for automated dunning escalation
- [ ] Implement TenantAiQuota management (AC: #1)
  - [ ] GET /admin/tenants/:id/ai/quota
  - [ ] PATCH /admin/tenants/:id/ai/quota — update allowance, soft/hard limits
- [ ] Write tests (AC: #1-#6)
  - [ ] Plan CRUD
  - [ ] Plan assignment with webhook push
  - [ ] Billing enforcement transitions
  - [ ] Audit logging for all actions

**FR/NFR:** FR201-FR204 (plan management, billing, enforcement, runtime limits); NFR46 (<50ms entitlement checks), NFR51 (webhook <30s)

**Reference Documents:**
| Document | Section | Key Items |
|----------|---------|-----------|
| Architecture | §2.31.2 Platform Database Schema | Plan model, TenantBilling model, EnforcementAction enum |
| API Contracts | §21.4 Plans & Billing, §21.5 AI Usage & Quotas | Plan CRUD, assign-plan, billing status, enforcement controls, quota management |
| Data Models | §5 Platform Database Models — Plan, TenantBilling, TenantAiQuota | Plan fields (maxUsers, enabledModules, aiHardLimit), billing fields (dunningLevel, enforcementAction) |
| State Machines | §20.2 Billing Enforcement Lifecycle | NONE->WARNING->READ_ONLY->SUSPENDED with triggers, guards, and ERP impact |
| Event Catalog | §19 Platform Admin Events | tenant.plan_changed, billing.payment_received, billing.payment_failed, billing.enforcement_changed |
| Business Rules | §14b BR-PLT-004 to BR-PLT-006 | Billing escalation, READ_ONLY blocks writes, plan change immediate effect |
| UX Design Spec | §Platform Admin Portal — Navigation | Plans section, Billing section (overview, enforcement controls) |
| Project Context | §8b Platform Layer Architecture | ERP checks enforcementAction from cached entitlements before every write |