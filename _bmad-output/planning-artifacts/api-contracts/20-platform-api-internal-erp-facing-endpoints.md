# 20. Platform API — Internal (ERP-Facing) Endpoints

> **Base URL:** `https://platform-api.nexa-erp.internal/api/v1`
>
> These endpoints are consumed by the ERP application at runtime. They are NOT accessible to tenant users or the public internet. Authenticated via internal service tokens (not user JWTs). See Architecture §2.31.

## 20.1 Entitlements

| Method | Path | Purpose | Auth | FR |
|--------|------|---------|------|-----|
| `GET` | `/platform/tenants/:tenantId/entitlements` | Full entitlement payload: status, plan, billing, enforcement, modules, flags, limits | Service Token | FR219 |
| `GET` | `/platform/tenants/:tenantId/modules/:moduleKey/access` | Check if specific module is enabled for tenant | Service Token | FR220 |
| `GET` | `/platform/tenants/:tenantId/users/quota` | Current user count vs max users, canAddUser boolean | Service Token | FR220 |
| `GET` | `/platform/tenants/:tenantId/status` | Quick status check: tenant status, billing, enforcement, maintenance mode | Service Token | FR219 |

**GET /platform/tenants/:tenantId/entitlements**

```typescript
// Response
{
  status: TenantStatus;          // "ACTIVE" | "SUSPENDED" | "READ_ONLY" | "ARCHIVED"
  planCode: string;              // "core" | "pro" | "enterprise"
  billingStatus: BillingStatus;  // "CURRENT" | "GRACE" | "OVERDUE" | "BLOCKED"
  enforcementAction: EnforcementAction; // "NONE" | "WARNING" | "READ_ONLY" | "SUSPENDED"
  maxUsers: number;
  maxCompanies: number;
  enabledModules: string[];      // ["finance", "ar", "ap", "sales", ...]
  featureFlags: Record<string, boolean>; // { "ai_forecasting": true, ... }
}
```

**GET /platform/tenants/:tenantId/modules/:moduleKey/access**

```typescript
// Response
{
  allowed: boolean;
  reason?: string;  // "Module not included in your plan" | "Module disabled by admin"
}
```

**GET /platform/tenants/:tenantId/users/quota**

```typescript
// Response
{
  currentCount: number;
  maxUsers: number;
  canAddUser: boolean;
}
```

## 20.2 AI Gateway

| Method | Path | Purpose | Auth | FR |
|--------|------|---------|------|-----|
| `POST` | `/platform/tenants/:tenantId/ai/check` | Pre-flight quota check before AI call | Service Token | FR205 |
| `POST` | `/platform/tenants/:tenantId/ai/record` | Record AI usage after response | Service Token | FR206 |
| `GET` | `/platform/tenants/:tenantId/ai/usage` | Current period usage summary | Service Token | FR207 |

**POST /platform/tenants/:tenantId/ai/check**

```typescript
// Request
{
  estimatedTokens: number;
  featureKey: string;  // "chat", "document_processing", "forecasting"
}

// Response
{
  allowed: boolean;
  remainingTokens: number;
  quotaPct: number;     // 0-100+
  warning?: string;     // "Approaching AI quota limit (82%)"
}
```

**POST /platform/tenants/:tenantId/ai/record**

```typescript
// Request
{
  userId: string;
  featureKey: string;
  provider: string;        // 'anthropic', 'openai', 'google' — which LLM provider
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEstimate: string;    // Decimal
  requestId: string;       // Trace ID
  isByok: boolean;         // true if tenant's own API key was used (don't bill against quota)
  latencyMs: number;       // end-to-end latency in milliseconds
  fallbackUsed: boolean;   // true if primary model failed and fallback was used
  fallbackFrom?: string;   // original model ID if fallback triggered
}

// Response
{
  recorded: true;
  quotaPct: number;
}
```

## 20.3 Webhooks (Platform → ERP)

| Method | Path (on ERP side) | Purpose | FR |
|--------|-------------------|---------|-----|
| `POST` | `/webhooks/platform` | Receive platform events for cache invalidation | FR221 |

```typescript
// Webhook payload
{
  event: string;      // "tenant.suspended" | "tenant.plan_changed" | "tenant.quota_warning" | ...
  timestamp: string;  // ISO 8601
  payload: Record<string, unknown>;
}
```

---
