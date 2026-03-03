# AI Engine v2.1 — Behavior Hardening Summary

## Overview

AI Engine v2.1 expands intent coverage, implements ERP-aware fallback behavior, and ensures SUPER_ADMIN can execute safe configuration actions directly.

## New Intents Added

### SUPER_ADMIN Intents (Config/Oversight Only)

**User Management:**
- `superadmin.create_user` — "Create a new admin user for customer Acme with email admin@acme.com"
- `superadmin.disable_user` — "Disable user john@example.com"
- `superadmin.enable_user` — "Reactivate user jane@example.com"

**Customer/Tenant Management:**
- `superadmin.update_tenant` — "Update customer Acme region to UK" or "Change customer Acme billing plan to Growth"

**Integration Management:**
- `superadmin.update_integration` — "Update the description for the Xero integration" or "Disable the Twilio integration"

**AI & Compliance Config:**
- `superadmin.update_ai_config` — "Loosen AI restrictions for ADMIN users"
- `superadmin.update_compliance_config` — "Tighten compliance checks for healthcare tenants"

**Analytics:**
- `superadmin.user_ai_performance` — "Show me the top 10 users by AI usage this month"
- `superadmin.customer_ai_usage` — "Show me which customers have the highest AI usage"

### ADMIN Intents (Operational Guidance)

**"How Do I" Intents:**
- `admin.how_to_create_customer` — "How do I create a new customer?"
- `admin.how_to_post_invoice` — "How do I create and post an invoice?"
- `admin.how_to_create_po` — "How do I create a purchase order?"
- `admin.how_to_adjust_stock` — "How do I adjust stock for item X?"
- `admin.how_to_create_work_order` — "How do I create a work order?"
- `admin.how_to_setup_tax` — "How do I set up tax codes for UK VAT?"

### STAFF Intents (Read-Only/Light Ops)

**"How Do I" Intents:**
- `staff.how_to_view_stock` — "How do I see our current stock for item X?"
- `staff.how_to_log_time` — "How do I log my time on a project?"
- `staff.how_to_view_payslip` — "How do I see my payslip?" (if supported)
- `staff.how_to_find_invoices` — "How do I find customer Acme's recent invoices?"

## General Fallback Behavior

### Before v2.1
- Generic "unsupported query" or "I can't help with that" messages
- No ERP-specific guidance
- No role-aware context

### After v2.1
- **SUPER_ADMIN:** System architect perspective
  - Explains how Nexa models platform configuration
  - References Super Admin Console modules and screens
  - Provides actionable guidance for config/oversight tasks
  - Example: "Here's how Nexa models this. Tenants are managed in Super Admin → Customers..."

- **ADMIN:** Operational tenant admin perspective
  - References specific modules (Finance, CRM, Inventory, etc.)
  - Provides step-by-step guidance for business operations
  - Never mentions `/super-admin/**` routes
  - Example: "Go to Finance → Accounts Receivable → Invoices → New Invoice..."

- **STAFF:** Simple guidance perspective
  - Emphasizes what they can view/do
  - Suggests contacting ADMIN for config changes
  - No admin-only screen references
  - Example: "Go to Inventory → Items and search for the item..."

## Action Execution

### SUPER_ADMIN Execution

**Safe Actions That Can Be Executed Directly:**
- `SUPER_ADMIN_CREATE_USER` — Create users for tenants
- `SUPER_ADMIN_DISABLE_USER` / `ENABLE_USER` — Enable/disable user accounts
- `SUPER_ADMIN_UPDATE_TENANT_PLAN` — Update tenant billing plans
- `SUPER_ADMIN_UPDATE_TENANT` — Update tenant config (region, status, etc.)
- `SUPER_ADMIN_UPDATE_INTEGRATION_CONFIG` — Update integration metadata
- `SUPER_ADMIN_UPDATE_AI_CONFIG` — Update AI configuration per role
- `SUPER_ADMIN_UPDATE_COMPLIANCE_CONFIG` — Update compliance settings

**Execution Behavior:**
- When `allowExecution=true` and `requireConfirmation=false` (default for SUPER_ADMIN):
  - Actions are executed automatically via `executeAction` (server-side, no HTTP hop)
  - Returns success message: "✅ Successfully executed 1 action: created user admin@acme.com for customer Acme UK. You can verify this in Super Admin → Users."
  - Includes UI pointers for verification

- When `requireConfirmation=true`:
  - Action plan is generated but not executed
  - User must confirm before execution

**Actions NOT Executed (Task K Compliance):**
- Day-to-day business operations (posting invoices, POS sessions, creating POs)
- Tenant-level operational workflows
- Any action that violates SUPER_ADMIN isolation

### ADMIN Execution

- Action plans may be generated but require confirmation
- No auto-execution (default: `requireConfirmation=true`)
- No access to `/super-admin/**` routes

### STAFF Execution

- No action execution (`allowExecution=false`)
- Guidance only, no mutations

## Implementation Details

### Intent Matching Helpers

**New Helper Functions:**
- `matchSuperAdminConfigIntent()` — Matches SUPER_ADMIN config/oversight actions
- `matchAdminHowToIntent()` — Matches ADMIN "how do I" operational queries
- `matchStaffHowToIntent()` — Matches STAFF "how do I" read-only queries

**Integration:**
- Helpers are called early in `resolveIntent()` before generic fallbacks
- Each helper returns `IntentResult | null` (null if no match)
- Maintains existing truncation and demo-filtering behavior

### Action Plan Generation

**Enhanced `generateActionPlanFromIntent()`:**
- Handles new explicit intents (`superadmin.create_user`, `superadmin.disable_user`, etc.)
- Extracts parameters from intent data (email, tenant name, field, value)
- Sets `requiresConfirmation: false` for safe SUPER_ADMIN actions (allows auto-execution)
- Falls back to prompt parsing for ambiguous queries

### Fallback Messages

**Role-Aware Fallback:**
- SUPER_ADMIN: Platform configuration guidance
- ADMIN: Operational module guidance (no super-admin routes)
- STAFF: Simple viewing guidance

**ERP-Specific Content:**
- References actual Nexa modules and screens
- Provides actionable next steps
- Avoids generic "unsupported query" messages

## Tests Added

### Intent Resolution Tests

1. **SUPER_ADMIN Action Intents:**
   - `resolves SUPER_ADMIN 'Create a new admin user for customer Acme with email admin@acme.com' query`
   - `resolves SUPER_ADMIN 'Disable user john@example.com' query`
   - `resolves SUPER_ADMIN 'Update customer Acme region to UK' query`
   - `resolves SUPER_ADMIN 'Show me the top 10 users by AI usage this month' query`

2. **ADMIN "How Do I" Intents:**
   - `resolves ADMIN 'How do I create and post an invoice?' query`
   - `resolves ADMIN 'How do I create a purchase order?' query`

3. **STAFF "How Do I" Intents:**
   - `resolves STAFF 'How do I view stock levels for item X?' query`
   - Verifies STAFF guidance does not mention `/super-admin` routes

4. **Fallback Behavior Tests:**
   - `provides ERP-aware fallback for SUPER_ADMIN generic queries`
   - `provides ERP-aware fallback for ADMIN generic queries`
   - Verifies fallback messages contain ERP-specific content (Finance, AR, invoices, etc.)
   - Verifies ADMIN fallback does not mention super-admin routes

## Manual Testing Examples

### SUPER_ADMIN

**Action Execution:**
```
Query: "Create a new admin user for customer Acme UK with email admin@acme.com"
Expected: Action executed automatically + success message with UI pointer
```

```
Query: "Update customer Acme UK billing plan to Growth"
Expected: Action executed automatically + success message
```

**Analytics:**
```
Query: "Show me the top 10 users by AI usage this month"
Expected: Top 10 users with AI usage stats + footer (truncated to 10 rows)
```

### ADMIN

**Operational Guidance:**
```
Query: "How do I create a new customer?"
Expected: Step-by-step instructions referencing CRM → Customers → New Customer
```

```
Query: "How do I create and post an invoice?"
Expected: Detailed steps referencing Finance → AR → Invoices → New Invoice → Post
```

### STAFF

**Read-Only Guidance:**
```
Query: "How do I view stock levels for item X?"
Expected: Simple guidance referencing Inventory → Items (no admin screens)
```

## Files Changed

### Core AI Logic
- `apps/web/src/lib/ai/intents.ts` — Added helper functions and new intent matching
- `apps/web/src/lib/ai/orchestrator.ts` — Enhanced action plan generation, improved fallback messages
- `apps/web/app/api/ai/query/route.ts` — (No changes, uses existing orchestrator)

### Tests
- `apps/web/tests/rbac/super-admin-ai-intents.test.ts` — Added tests for new intents and fallback behavior

### Documentation
- `apps/web/docs/nexa/ai/ai-engine-v2.1-summary.md` — This document

## Test Status

- ✅ All AI intent tests passing
- ✅ Truncation tests passing
- ✅ Fallback behavior tests passing
- ⚠️ Some pre-existing failures in billing plans tests (unrelated to AI changes)

## Build Status

- ✅ Lint: Passes
- ✅ Build: Passes
- ✅ AI Tests: All passing

## Next Steps

1. Manual smoke testing on production (https://app.nexaai.co.uk)
2. Monitor AI usage analytics for new intent patterns
3. Gather user feedback on fallback behavior
4. Consider adding more specific intents based on common queries

