# AI Engine Behaviour

**Last updated:** 2025-11-29  
**Applies to:** All users, Tenant admins, SUPER_ADMIN

---

## Overview

The Nexa AI Engine provides operational assistance across ERP modules. It is designed to be data-backed, truthful, and constrained to prevent inappropriate responses.

### Core Principles

- **Read-only:** AI does not perform writes or side-effects
- **Data-backed:** Answers are based on actual ERP data, not fabricated
- **Truthful:** If data is missing or insufficient, AI returns "I don't know" rather than guessing
- **Operational assistance only:** No clinical, legal, or financial advice beyond operational guidance

---

## Capabilities

### Supported Use Cases

**Data Q&A Across Modules:**
- **Finance:** Journal summaries, transaction queries, financial reporting questions
- **Inventory:** On-hand stock levels, stock movements, inventory valuations
- **Supply Chain:** Stock-out risks, replenishment suggestions, supplier performance
- **Manufacturing:** Work-in-progress (WIP) overview, production status
- **Sales/CRM:** Pipeline summaries, opportunity stages, open quotes
- **POS:** Today's sales totals, transaction counts
- **Projects:** Timesheet summaries, project status
- **HR/Payroll:** Headcount, payroll run counts
- **Healthcare:** Rota coverage (operational metrics only)
- **Planning:** Budget summaries, planning data
- **Workflow:** Pending approvals, workflow status

**Summaries:**
- Financial summaries (e.g., "What were last month's sales?")
- Project summaries (e.g., "How many timesheets are pending approval?")
- Inventory summaries (e.g., "What items are low on stock?")

**Operational Recommendations:**
- Workflow hints (e.g., "Consider approving pending timesheets")
- Task suggestions (e.g., "Review stock-out risks for these items")
- Administrative guidance (e.g., "Use this workflow for invoice approval")

### Use of Chat and DMS Content

**Current Implementation:**
- The AI engine does **not** currently use chat history or DMS documents as context in prompts
- AI queries ERP data directly via structured intents
- Chat messages and DMS documents are stored separately and are not included in AI prompts

**Future Considerations:**
- Chat history integration may be added in future releases
- DMS document summarisation may be implemented
- Any future integration will respect RBAC and field-level visibility controls

### Nexa Chat and Calls Integration

**Chat Messages:**
- Chat messages are stored in tenant-isolated channels
- Chat read access is logged as sensitive reads (Task F3)
- AI does not currently access chat messages for context
- Chat timestamps are stored in UTC and displayed in tenant/user timezone

**Call Metadata:**
- Call logs store metadata only (who, when, duration)
- No audio or video recordings are stored by default
- Call metadata is not currently used by AI
- Call timestamps are stored in UTC and displayed in tenant/user timezone

**Future Integration:**
- Thread summaries or meeting notes may be added in future releases
- Any integration will respect healthcare constraints and PHI redaction

---

## Limits

### What AI Does Not Do

**Clinical Decisions:**
- **No medical diagnosis or treatment recommendations** (healthcare tenants)
- **No clinical risk judgements** (healthcare tenants)
- **No interpretation of clinical data** (healthcare tenants)
- AI is limited to operational assistance only for healthcare tenants

**Legal and Financial Advice:**
- AI does not provide legal advice beyond operational guidance
- AI does not provide financial advice beyond operational assistance
- AI does not make investment or tax advice recommendations

**Data Fabrication:**
- AI does not invent or fabricate data
- AI does not make "best guesses" when data is missing
- AI returns "I don't know" when data is insufficient

### When AI Should Say "I Don't Know"

**Missing Data:**
- Requested data does not exist in the ERP
- No transactions match the query criteria
- Insufficient data to answer the question

**Conflicting Data:**
- Data inconsistencies detected
- Multiple conflicting sources
- Ambiguous query that cannot be resolved

**Access Restrictions:**
- User lacks RBAC permissions for the requested module
- Module is disabled for the tenant
- Field-level visibility restrictions prevent access to required data

**Example Responses:**
- "I don't have access to that data" (RBAC restriction)
- "Insufficient data for on-hand inventory" (missing data)
- "No stock-out risks or suggestions available" (no data matching criteria)

---

## Healthcare Constraints

### Healthcare Mode

**When Enabled:**
- Healthcare mode is enabled per tenant via **Admin** → **Tenants** → Healthcare Mode
- When enabled, all AI prompts for that tenant include explicit healthcare constraints

**Constraints Applied:**
- **CRITICAL HEALTHCARE CONSTRAINTS** are added to every AI prompt
- AI is instructed: "You MUST NOT provide medical diagnosis, treatment recommendations, or clinical risk judgements"
- AI is limited to operational assistance only:
  - Workflow hints and scheduling assistance
  - Documentation and coding prompts (e.g., ICD-10 codes)
  - Administrative and operational guidance
  - Generic explanations of ERP features

**PHI Redaction:**
- Protected Health Information (PHI) is redacted from AI logs before storage
- Redacted information includes:
  - Names (patient, staff, or identifiable individuals)
  - NHS numbers
  - Phone numbers (normalised detection, 9+ digits)
  - Email addresses
  - Postcodes
  - Clinical notes and free-text PHI
- Redaction is applied in "strict mode" for AI logs (more aggressive than prompt redaction)

**Important:** Nexa ERP is **not a medical device** and must not be used for clinical diagnosis or treatment decisions.

---

## Evaluation

### Golden Prompts

**Purpose:**
- Golden prompts are used to regularly validate AI behaviour
- They ensure AI responses remain consistent and truthful
- They help identify regressions or unexpected changes

**Current Status:**
- Golden prompts are not yet fully implemented
- Evaluation harness may be added in future releases
- Known safe patterns are documented in test suites

### Known Safe Patterns

**Finance Queries:**
- "What were last month's sales?" → Returns actual sales data from POS or Sales modules
- "Show me journal entries" → Returns recent journal entries with timestamps

**Inventory Queries:**
- "What items are on hand?" → Returns on-hand stock levels (dimension-scoped)
- "Show stock-out risks" → Returns items with low stock or stock-out risks

**CRM Queries:**
- "What's in the pipeline?" → Returns opportunity stages with amounts (converted to base currency)

### Known Limitations and Edge Cases

**FX Conversion:**
- AI receives pre-converted amounts with explicit currency labels
- AI does not perform its own FX conversion
- If FX rates are missing, conversion may fail (AI will return "I don't know")

**Date Boundaries:**
- "Today" queries use UTC date boundaries
- Dates are formatted in tenant timezone for display
- Timezone mismatches may cause "today" queries to return unexpected results

**RBAC Restrictions:**
- Users with VIEWER role may see masked data (sensitive fields shown as "[REDACTED]")
- AI responses respect field-level visibility controls
- Healthcare rota data is filtered before inclusion in AI prompts for restricted roles

**Module Availability:**
- If a module is disabled for the tenant, AI cannot answer questions about that module
- AI returns "unauthorized" or "module not available" for disabled modules

---

## AI User Preferences

### How Preferences Affect AI

**Role:**
- User's role (e.g., "Finance Manager") is included in AI prompts
- AI tailors responses to the user's role context
- Example: Finance-focused answers for finance managers

**Experience Level:**
- **Beginner:** AI provides more detailed explanations and step-by-step guidance
- **Intermediate:** Balanced explanations suitable for users familiar with ERP concepts (default)
- **Advanced:** Concise, technical responses for experienced users

**Answer Style:**
- **Concise:** Short, direct answers
- **Balanced:** Moderate detail (default)
- **Detailed:** Comprehensive explanations with context

See [Profile, Tenant, and AI Preferences](./profile-tenant-ai-preferences.md) for details on configuring these settings.

---

## Logging and Audit

### AI Logging

**What is Logged:**
- All AI prompts and responses are logged to `AIEngineLog` table
- Logs include:
  - Prompt text (PHI redacted for healthcare tenants)
  - Response text (PHI redacted for healthcare tenants)
  - Intent classification
  - Model used (e.g., "gpt-4o-mini" or "offline")
  - Token usage (estimated)
  - Latency (milliseconds)
  - Correlation ID for tracing

**PHI Redaction:**
- For healthcare tenants, PHI is redacted before logging
- Redaction covers names, NHS numbers, phones, emails, postcodes, clinical notes
- Non-healthcare tenant logs are unchanged

**Audit Events:**
- Each AI query generates an audit event: `ai.query.executed`
- Audit events include tenant ID, user ID, intent, duration, row count
- SUPER_ADMIN can view AI logs in audit dashboards

### Access to AI Logs

**Users:**
- Users cannot view their own AI history (managed by administrators)
- AI history is not exposed in the user interface

**SUPER_ADMIN:**
- SUPER_ADMIN can view all AI logs via audit dashboards
- Logs can be filtered by tenant, user, date range, intent
- PHI-redacted logs are visible for healthcare tenants

---

## Rate Limiting

### Rate Limits

- AI queries are rate-limited per tenant: `rateLimitTenant("ai-query", tenantId, userId)`
- Rate limits prevent abuse and ensure fair usage
- If rate limit is exceeded, AI returns HTTP 429 with "rate-limited" message

### Token Caps

- Token caps are enforced per request and per user (if implemented)
- Token caps prevent excessive token usage
- Exceeding token caps may result in truncated responses

---

## Related Documentation

- [Profile, Tenant, and AI Preferences](./profile-tenant-ai-preferences.md) — User AI preferences
- [Currencies, FX, and Time Zones](./currencies-fx-timezones.md) — How AI handles FX and dates
- [SUPER_ADMIN Handbook](./super-admin-handbook.md) — AI configuration and monitoring

---

## Notes

- AI engine is read-only and does not perform writes or side-effects
- AI responses are data-backed and truthful (no fabrication)
- Healthcare constraints are automatically applied for healthcare tenants
- PHI redaction is applied before logging for healthcare tenants
- Chat and DMS content are not currently used as AI context (may be added in future)

