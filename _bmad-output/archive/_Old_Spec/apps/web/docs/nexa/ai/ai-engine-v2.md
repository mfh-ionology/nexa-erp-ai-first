# AI Engine v2 — Behavior & Configuration

## Overview

The Nexa ERP AI Engine provides role-aware, config-driven assistance across SUPER_ADMIN, ADMIN, and STAFF roles. It respects RBAC boundaries, executes actions when configured, and provides concise, actionable responses.

## Role-Based Behavior

### SUPER_ADMIN AI

**What it can do:**
- **Configuration & Oversight Actions:**
  - Create/update/delete customers (tenants)
  - Create/update/delete users
  - Update billing plans and tenant billing configuration
  - Update integration metadata (Stripe, OpenAI, SMTP, etc.)
  - Update RBAC policies and compliance configuration
  - Update AI configuration per role
  - View platform-wide analytics (tenants, users, billing, AI usage)
  - Execute allowed actions automatically when `allowExecution=true` and `requireConfirmation=false`

**What it cannot do:**
- Day-to-day business operations (posting invoices, running POS sessions, creating purchase orders)
- Tenant-level operational workflows (Finance, Inventory, CRM, etc.)
- Any action that violates Task K isolation principles

**Default Configuration:**
- `allowExecution: true`
- `requireConfirmation: false` (can auto-execute)
- `verbosity: "normal"`

**Response Format:**
- Analytics queries: Truncated to top 10 rows with footer: "Showing 10 of N rows. For full detail, use the AI & Analytics screen."
- Action execution: Clear success messages with UI pointers (e.g., "You can verify this in Super Admin → Users.")
- "How do I" queries: Step-by-step instructions referencing actual Super Admin Console paths

### ADMIN AI

**What it can do:**
- **Operational Guidance:**
  - "How do I..." step-by-step instructions for business modules (create customer, post invoice, create PO, create work order, update stock levels)
  - Summarize data (open invoices, stock alerts) by calling existing read endpoints/services
  - Execute tenant-scoped actions within ADMIN RBAC (create customer in their tenant, create users under their tenant)

**What it cannot do:**
- SUPER_ADMIN-only actions (tenant creation, global config changes)
- Actions outside their tenant scope
- Actions that require SUPER_ADMIN permissions

**Default Configuration:**
- `allowExecution: true`
- `requireConfirmation: true` (requires confirmation before execution)
- `verbosity: "normal"`

**Response Format:**
- "How do I" queries: Detailed step-by-step instructions with actual UI paths (e.g., "Go to CRM → Customers → New Customer")
- Action plans: Generated but not auto-executed (requires confirmation)
- Data summaries: Concise, readable summaries of tenant data

### STAFF AI

**What it can do:**
- **Basic Guidance:**
  - Simple, safe guidance and read-only summaries
  - View-only data retrieval (stock levels, totals, etc.)
  - Basic "how do I view information" instructions

**What it cannot do:**
- Execute any admin-level actions
- Perform SUPER_ADMIN or ADMIN operations
- Access admin-only screens or features

**Default Configuration:**
- `allowExecution: false` (no action execution)
- `requireConfirmation: true`
- `verbosity: "low"` (concise responses)

**Response Format:**
- Simple, short step-by-step responses
- No admin-only screen references
- Basic guidance only

## Configuration

AI behavior is configured per role via the AI Config Service (`src/server/super-admin/ai-config.service.ts`). Configuration is stored in the PLATFORM tenant's `TenantConfig.config.aiConfig`.

### Configuration Structure

```typescript
interface AIConfig {
  perRole: {
    SUPER_ADMIN?: Partial<PerRoleAIConfig>;
    ADMIN?: Partial<PerRoleAIConfig>;
    STAFF?: Partial<PerRoleAIConfig>;
  };
  global?: {
    modelHint?: string;
    loggingLevel?: "debug" | "info" | "warn" | "error";
  };
}

interface PerRoleAIConfig {
  allowExecution: boolean;      // Can AI execute actions?
  requireConfirmation: boolean; // Require confirmation before execution?
  verbosity: "low" | "normal" | "high";
}
```

### Default Configuration

- **SUPER_ADMIN:** `allowExecution: true`, `requireConfirmation: false`, `verbosity: "normal"`
- **ADMIN:** `allowExecution: true`, `requireConfirmation: true`, `verbosity: "normal"`
- **STAFF:** `allowExecution: false`, `requireConfirmation: true`, `verbosity: "low"`

### Updating Configuration

Configuration can be updated via:
- Super Admin Console → AI & Analytics → Configuration
- Direct API call to `/api/super-admin/ai-config` (SUPER_ADMIN only)

## Response Formatting

### Truncation

All analytics-style responses are truncated to a maximum of 10 rows with a consistent footer:

```
Showing 10 of N rows. For full detail, use the AI & Analytics screen.
```

This applies to:
- User AI performance tables
- AI usage summaries
- Billing issues lists
- Setup issues lists
- Inventory on-hand queries
- All module responses (finance, CRM, manufacturing, etc.)

### Formatters

Truncation logic is centralized in `src/lib/ai/formatters.ts`:
- `formatTruncatedArray()` — Format arrays with truncation
- `formatTruncatedTable()` — Format object arrays as tables
- `formatTruncatedList()` — Format string lists

## Demo Data Filtering

**Production Behavior:**
- Demo tenants and demo users are **excluded** from AI analytics by default
- Only canonical/real accounts appear in SUPER_ADMIN analytics
- Demo filtering is applied at the query level, not just in UI

**Demo Detection:**
- Tenants: `TenantConfig.config.demo === true` or naming patterns (e.g., "Minimal Tenant *", "Test Tenant *", "Demo Tenant *")
- Users: Email patterns (`*@example.com`) or belonging to demo tenants
- Canonical accounts (info@nexaai.co.uk, admin@nexa.test, staff@nexa.test) are **never** filtered

**Services:**
- `ai-usage.service.ts` — Filters demo tenants/users from usage aggregation
- `users.service.ts` — `searchUsers()` excludes demo users by default (`includeDemo: false`)
- `tenants.service.ts` — `listTenantsForSuperAdmin()` excludes demo tenants by default

## Safety Guarantees

### RBAC Enforcement

- **AI never bypasses RBAC:** All actions are checked against the role capability matrix (`src/lib/ai/capabilities.ts`)
- **SUPER_ADMIN isolation:** SUPER_ADMIN AI cannot perform operational module actions (no invoices, POS, POs)
- **ADMIN/STAFF constraints:** ADMIN/STAFF AI behavior is constrained by both RBAC and AI config

### Action Execution

- **SUPER_ADMIN:** Can auto-execute config/oversight actions when `allowExecution=true` and `requireConfirmation=false`
- **ADMIN:** Generates action plans but requires confirmation (`requireConfirmation=true`)
- **STAFF:** Never executes actions (`allowExecution=false`)

### Error Handling

- Failed executions fall back to showing action plans
- Clear error messages with UI pointers
- No silent failures

## Testing

AI behavior is tested in:
- `tests/rbac/super-admin-ai-intents.test.ts` — Intent resolution, action plan generation, execution behavior, truncation

### Test Coverage

- SUPER_ADMIN analytics queries return truncated tables (max 10 rows)
- SUPER_ADMIN action queries generate and execute actions (when configured)
- ADMIN "how do I" queries return step-by-step instructions
- STAFF queries return simple guidance (no action execution)
- Demo data is excluded from analytics

## Architecture

### Key Files

- `src/lib/ai/orchestrator.ts` — Main orchestrator (intent resolution, action planning, execution)
- `src/lib/ai/intents.ts` — Intent resolution (natural language → intent + data)
- `src/lib/ai/formatters.ts` — Response formatting and truncation
- `src/lib/ai/capabilities.ts` — Role capability matrix
- `src/lib/ai/actions.ts` — Action type definitions
- `app/api/ai/query/route.ts` — AI query API endpoint
- `app/api/ai/execute/route.ts` — AI action execution endpoint
- `src/server/super-admin/ai-config.service.ts` — AI configuration service
- `src/server/super-admin/ai-usage.service.ts` — AI usage analytics (with demo filtering)

### Flow

1. User submits query → `/api/ai/query`
2. Query route loads AI config for user's role
3. Orchestrator resolves intent (`resolveIntent()`)
4. Orchestrator generates action plan (if applicable)
5. If `allowExecution=true` and `requireConfirmation=false` → Execute actions directly
6. Format response with truncation/formatters
7. Return formatted response to user

## Manual Testing

### SUPER_ADMIN

1. **Analytics Query:**
   - Query: "Tabulate all users and show their AI performance"
   - Expected: Top 10 users with AI usage stats + footer
   - Verify: No demo users appear

2. **Action Query:**
   - Query: "Create a new admin user for customer Acme UK with email admin@acme.com"
   - Expected: Action executed automatically + success message with UI pointer
   - Verify: User created in database

3. **"How Do I" Query:**
   - Query: "How do I create a new customer?"
   - Expected: Step-by-step instructions referencing Super Admin → Customers

### ADMIN

1. **"How Do I" Query:**
   - Query: "How do I create a new customer?"
   - Expected: Step-by-step instructions referencing CRM → Customers → New Customer

2. **Action Query:**
   - Query: "Create a new customer Acme Corp"
   - Expected: Action plan generated but NOT auto-executed (requires confirmation)

### STAFF

1. **Guidance Query:**
   - Query: "How do I view information?"
   - Expected: Simple, short guidance without admin-only references

2. **Action Query:**
   - Query: "Create a new customer"
   - Expected: Guidance only (no action execution)

