# 5. Platform Database Models (Section 2.31)

> **IMPORTANT:** These models live in a **separate database** from the ERP tenant databases. They are defined in `apps/platform-api/prisma/schema.prisma`, NOT in the tenant Prisma schema. The Platform database is central (not per-tenant) and holds cross-tenant operational data.

## Tenant
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `tenants` | Central tenant registry |
| **PK** | `id` UUID | |
| code | String(50) | Unique slug, e.g. "acme-ltd" |
| displayName | String | Trading name |
| legalName | String? | Registered legal name |
| status | TenantStatus | PROVISIONING, ACTIVE, SUSPENDED, READ_ONLY, ARCHIVED |
| planId | String | FK to Plan |
| billingStatus | BillingStatus | CURRENT, GRACE, OVERDUE, BLOCKED |
| region | String(30) | Default "uk-south" |
| dbHost, dbName, dbPort | String/Int | Tenant database connection metadata |
| sandboxEnabled | Boolean | Default false |
| lastActivityAt | DateTime? | Last user activity in tenant |
| **Relations** | plan, moduleOverrides[], featureFlags[], aiQuota, aiUsageRecords[], billing, impersonations[] |

## Plan
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `plans` | Subscription plan catalogue |
| **PK** | `id` UUID | |
| code | String(30) | Unique: core, pro, enterprise, custom |
| displayName | String | |
| maxUsers | Int | User seat limit |
| maxCompanies | Int | Company limit per tenant |
| monthlyAiTokenAllowance | BigInt | Monthly AI token budget |
| aiHardLimit | Boolean | Default true — blocks AI at 100% |
| enabledModules | Json (JsonB) | String array of module keys |
| apiRateLimit | Int | Default 1000 req/min |
| **Relations** | tenants[] |

## TenantModuleOverride
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `tenant_module_overrides` | Per-tenant module on/off |
| **PK** | `id` UUID | |
| tenantId | String | FK to Tenant |
| moduleKey | String(50) | e.g. "manufacturing" |
| enabled | Boolean | |
| reason, changedBy, changedAt | | Audit fields |
| **Unique** | [tenantId, moduleKey] | |

## TenantFeatureFlag
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `tenant_feature_flags` | Per-tenant feature toggles |
| **PK** | `id` UUID | |
| tenantId | String | FK to Tenant |
| featureKey | String(100) | |
| enabled | Boolean | |
| changedBy, changedAt | | Audit fields |
| **Unique** | [tenantId, featureKey] | |

## TenantAiUsage
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `tenant_ai_usage` | Per-call AI usage records (append-only) |
| **PK** | `id` UUID | |
| tenantId | String | FK to Tenant |
| userId | String(100) | Tenant user ID or "system" |
| featureKey | String(100) | "chat", "document_processing", "forecasting", etc. |
| model | String(100) | LLM model ID |
| promptTokens | Int | |
| completionTokens | Int | |
| totalTokens | Int | |
| costEstimate | Decimal(10,6) | Unit price snapshot at call time |
| requestId | String(100) | Unique trace ID |
| timestamp | DateTime (Timestamptz) | UTC |
| provider | String(50) | 'anthropic', 'openai', 'google' — which LLM provider was called |
| isByok | Boolean | Default false — true if tenant's own API key was used |
| latencyMs | Int? | End-to-end latency in milliseconds |
| fallbackUsed | Boolean | Default false — true if primary model failed and fallback was used |
| fallbackFrom | String?(100) | Original model ID if fallback was triggered |
| **Indexes** | [tenantId, timestamp], [tenantId, featureKey] | |

## TenantProviderCredential

| Field | Type | Notes |
|-------|------|-------|
| **Table** | `tenant_provider_credentials` | BYOK API keys for Enterprise tenants |
| **PK** | `id` UUID | |
| tenantId | String | FK to Tenant |
| providerId | String(50) | 'anthropic', 'openai', 'google', etc. |
| encryptedKey | String | AES-256 encrypted API key |
| isActive | Boolean | Default true |
| createdAt | DateTime (Timestamptz) | |
| updatedAt | DateTime (Timestamptz) | |
| **Unique** | [tenantId, providerId] | One key per provider per tenant |

## TenantAiQuota
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `tenant_ai_quotas` | Rolling quota tracking per tenant |
| **PK** | `id` UUID | |
| tenantId | String | Unique FK to Tenant |
| periodStart, periodEnd | Date | Current billing period |
| tokensUsed | BigInt | Running total, default 0 |
| tokenAllowance | BigInt | From plan or override |
| softLimitPct | Int | Default 80 |
| hardLimitPct | Int | Default 100 |
| burstAllowance | BigInt? | Optional burst buffer |

## TenantBilling
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `tenant_billing` | Billing/payment state per tenant |
| **PK** | `id` UUID | |
| tenantId | String | Unique FK to Tenant |
| stripeCustomerId | String? | Stripe integration (Phase 2) |
| subscriptionStatus | String?(30) | |
| currentPeriodEnd | DateTime? | |
| gracePeriodDays | Int | Default 14 |
| lastPaymentAt | DateTime? | |
| dunningLevel | Int | 0-3 |
| enforcementAction | EnforcementAction | NONE, WARNING, READ_ONLY, SUSPENDED |

## PlatformUser
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `platform_users` | Super Admin accounts (vendor staff only) |
| **PK** | `id` UUID | |
| email | String | Unique |
| passwordHash | String | Argon2id |
| displayName | String | |
| role | PlatformRole | PLATFORM_ADMIN, PLATFORM_VIEWER |
| mfaEnabled | Boolean | Default false (must be true for PLATFORM_ADMIN) |
| mfaSecret | String? | TOTP secret |
| isActive | Boolean | |
| **Relations** | auditLogs[], impersonations[] |

## PlatformAuditLog
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `platform_audit_log` | Immutable audit trail for all platform admin actions |
| **PK** | `id` UUID | |
| platformUserId | String | FK to PlatformUser |
| action | String(100) | e.g. "tenant.suspend", "impersonation.start" |
| targetType | String?(50) | "tenant", "plan", "platform_user" |
| targetId | String? | |
| details | Json? (JsonB) | Action-specific payload |
| ipAddress | String(45) | |
| userAgent | String?(500) | |
| timestamp | DateTime (Timestamptz) | UTC |
| **Indexes** | [platformUserId, timestamp], [targetType, targetId] | |

## ImpersonationSession
| Field | Type | Notes |
|-------|------|-------|
| **Table** | `impersonation_sessions` | Time-limited support access sessions |
| **PK** | `id` UUID | |
| platformUserId | String | FK to PlatformUser |
| tenantId | String | FK to Tenant |
| reason | String | Mandatory justification |
| startedAt | DateTime | |
| endedAt | DateTime? | Null while active |
| expiresAt | DateTime | Hard time limit |
| actionsLog | Json? (JsonB) | Array of actions during session |
| **Indexes** | [tenantId, startedAt] | |

## Platform Enums

| Enum | Values | Used By |
|------|--------|---------|
| TenantStatus | PROVISIONING, ACTIVE, SUSPENDED, READ_ONLY, ARCHIVED | Tenant.status |
| BillingStatus | CURRENT, GRACE, OVERDUE, BLOCKED | Tenant.billingStatus |
| EnforcementAction | NONE, WARNING, READ_ONLY, SUSPENDED | TenantBilling.enforcementAction |
| PlatformRole | PLATFORM_ADMIN, PLATFORM_VIEWER | PlatformUser.role |
