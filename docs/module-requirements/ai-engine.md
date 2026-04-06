# AI Engine (Cross-Module Intelligence Layer)

The AI Engine sits on top of all ERP modules. It turns raw transactions into answers, explanations, and controlled actions — without breaking the rules of accounting, tenancy, or permissions.

---

## Already Specified (in existing PRD, Architecture, and Epics)

### 1. AI Copilot — Conversational Assistant
> Source: PRD innovation-novel-patterns.md, Epic E5.S1-S2

- Unified header input ("Search or Ask Nexa anything...", Cmd+K)
- Collapsible right-side Co-Pilot drawer (380px) for multi-turn chat
- WebSocket-based streaming responses
- Chat history with persistent conversations
- Role-based preset prompts (Quick Prompts)
- Page-aware context (knows what screen the user is on)
- Entity mentions in chat (@customer, @invoice)
- Daily briefing that connects dots across Finance, Inventory, Sales, HR

### 2. AI Action Framework — Automation with Guardrails
> Source: Epic E5.S3 (AI Action Framework), PRD project-scoping.md

- AI proposes actions (create journal, send email, update record)
- User reviews preview data and confirms or rejects before execution
- **Financial actions ALWAYS require user confirmation** — no auto-execution
- Action confidence scoring
- Full audit trail of all AI proposals, confirmations, and rejections
- Guardrail principle: **"Approve, don't automate"** — AI proposes, never executes without consent

### 3. Anomaly & Fraud Detection
> Source: PRD FR155-FR157, Epic E5.S4

- Duplicate payment detection (matching supplier, amount, invoice reference, date proximity)
- Suspicious transaction flagging based on configurable rules:
  - Unusual amounts
  - Out-of-pattern timing
  - New supplier with large first payment
  - Sequential invoice numbers from same supplier
- Fraud risk summary report with flagged transactions and anomaly patterns
- Confidence scores on flagged items

### 4. Cash Flow Forecasting
> Source: PRD FR153, Epic E25.S5

- 8–52 week projection periods
- Scenario analysis: best case, expected, worst case
- Based on: AR/AP aging, recurring invoices, historical payment patterns, known commitments
- AI-driven recommendations

### 5. Prediction Explainability
> Source: Epic E5.S4, `POST /ai/explain`

- Human-readable explanation of AI reasoning for predictions
- Source breakdowns for cash flow forecasts (which invoices, which commitments)
- Limited to predictions — does NOT trace across modules

### 6. Document Understanding
> Source: PRD FR164-FR167

- Extract fields from uploaded financial documents (invoices, receipts)
- Confidence scoring per extracted field
- Learning from user corrections to improve future accuracy

### 7. Autonomous Workflows
> Source: Epic E5c, project-context.md §16

- Trigger types: Scheduled (cron), Event-driven, Chained (output→input), Manual
- Circuit breaker: auto-pause after 3 consecutive failures
- Token budget limits (default 50K) and duration limits (default 5 min)
- Admin UI for creating and managing workflows

### 8. AI-Powered Ad-Hoc Queries
> Source: Epic E25.S4

- Natural language → SQL → tabular/chart results
- >95% accuracy requirement
- Works across all module data the user has permission to access

---

## New / Expected (not yet in specs — from stakeholder requirements)

### 9. Risk Detection (NEW)
> Not in current specs. Only implied through anomaly detection (FR155-157).

AI proactively identifies business risks across all modules:

- **Credit Risk** — customers approaching or exceeding credit limits, deteriorating payment patterns, concentration risk (too much revenue from one customer)
- **Supply Chain Risk** — single-source suppliers, long lead times with no safety stock, supplier quality/delivery score declining
- **Cash Flow Risk** — projected cash shortfalls, overdue receivables trending up, large upcoming commitments
- **Regulatory Risk** — VAT returns approaching deadline, overdue HMRC submissions, pension auto-enrolment compliance gaps
- **Operational Risk** — stock below reorder point with no PO raised, production orders without sufficient materials, overdue maintenance on fixed assets

Each risk presented with severity (high/medium/low), affected records, and suggested actions.

### 10. Data Quality Improvement (NEW)
> Not in current specs. Document understanding (FR164-167) learns from corrections but there is no proactive data quality capability.

AI proactively detects and suggests fixes for bad data across all modules:

- **Missing Fields** — customers without email, suppliers without bank details, items without reorder points
- **Inconsistent Records** — address format mismatches, duplicate customers/suppliers (fuzzy matching), phone number format inconsistencies
- **Stale Data** — pricing not updated in X months, inactive customers with open balances, supplier contracts expired but still in use
- **Orphaned Records** — items with no transactions, accounts with no postings, contacts not linked to any customer/supplier
- **Completeness Scoring** — percentage completeness per record, per module, with drill-down to missing fields

Data quality dashboard showing overall health score per module, trending over time.

### 11. End-to-End Trace Explanations (NEW)
> Partially specified — E5.S4 has `POST /ai/explain` for prediction explainability but does NOT cover cross-module transaction tracing.

AI explains business outcomes by tracing the full chain across modules. This is the core differentiator.

**Example:** "Why did margin drop on order SO-00412?"
→ AI traces:
1. Supplier price increased 8% on raw material (Purchasing)
2. Rush freight added £200 due to stockout (Inventory → Purchasing)
3. Substituted item X for item Y which has lower markup (Inventory → Sales)
4. Customer received 5% volume discount (Sales → Pricing)
5. FX rate moved unfavourably on EUR purchase (Finance → Purchasing)

**Capabilities needed:**
- Cross-module data traversal following transaction links (SO → DO → GRN → PO → Supplier Invoice → GL)
- Causal chain construction — not just showing data but explaining WHY
- Comparison to baseline/expected values to identify deviations
- Natural language narrative generation
- Drill-down from summary explanation to source transactions

**Example use cases:**
- "Why is cash flow lower than forecast this month?"
- "What caused the variance on budget line 6000?"
- "Why was this customer's invoice £500 more than their quote?"
- "Explain the stock discrepancy at warehouse A"
- "Why did cost of goods increase 12% this quarter?"

### 12. Sales Forecasting & Demand Prediction (NEW — was Phase 3)
> Listed in PRD project-scoping.md as "Phase 3 — Expansion" under Predictive Intelligence.

- Historical sales analysis by item, customer, region, period
- AI-generated demand forecasts
- Seasonal pattern recognition
- Feed into Purchase Plans and Production Plans (cross-module)
- Forecast accuracy tracking (predicted vs actual)

### 13. Smart Feed / Role-Based AI Behaviour (NEW)
> Copilot is specified but not the role-based intelligence layer.

The AI adapts its behaviour, suggestions, and proactive alerts based on who the user is:

- **Finance Manager** → sees cash flow risks, budget variances, month-end checklist, fraud alerts
- **Sales Rep** → sees pipeline updates, customer follow-up reminders, quote expiry warnings, cross-sell suggestions
- **Warehouse Operator** → sees picking priorities, stock alerts, incoming deliveries, put-away tasks
- **HR Manager** → sees contract renewals due, probation reviews, leave conflicts, training compliance gaps
- **CEO/Owner** → sees KPI summary, cross-module anomalies, strategic recommendations

Each user's copilot experience is personalised by role, permissions, and recent activity.

---

## Summary: What's Specified vs What's New

| # | Capability | Status |
|---|-----------|--------|
| 1 | AI Copilot (conversational) | Specified (E5.S1-S2) |
| 2 | Action Framework (guardrails) | Specified (E5.S3) |
| 3 | Anomaly & Fraud Detection | Specified (FR155-157) |
| 4 | Cash Flow Forecasting | Specified (FR153) |
| 5 | Prediction Explainability | Specified (E5.S4) |
| 6 | Document Understanding | Specified (FR164-167) |
| 7 | Autonomous Workflows | Specified (E5c) |
| 8 | Ad-Hoc NL Queries | Specified (E25.S4) |
| 9 | Risk Detection | **NEW** |
| 10 | Data Quality Improvement | **NEW** |
| 11 | End-to-End Trace Explanations | **NEW** |
| 12 | Sales Forecast / Demand Prediction | **Deferred** (was Phase 3) |
| 13 | Smart Feed / Role-Based AI | **NEW** |
