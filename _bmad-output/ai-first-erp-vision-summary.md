# AI-First ERP for SMEs — Vision Summary

## Document Context

- **Date:** 2026-02-02
- **Source:** BMAD Party Mode collaborative discussion
- **Contributing Agents:** John (PM), Winston (Architect), Sally (UX), Mary (Analyst)
- **Purpose:** Shared reference for all agents working on this product

---

## 1. Product Vision (John — Product Manager)

### Core Principle

AI-First means the AI is the **interaction paradigm**, not a feature bolted onto traditional workflows.

### Key Requirements

- **AI as primary interface** — Users issue natural language commands ("reorder stock for items running low this week"), not navigate menus
- **Cross-module context awareness** — Finance knows inventory state; HR knows project staffing; the AI connects dots humans miss
- **Decision-first, not data-first** — The system recommends actions ("cash flow tight in 3 weeks — here are 3 options"), not just displays dashboards
- **SME constraint: zero-config, opinionated defaults** — No IT department; progressive complexity; simplest thing that solves the 80% case
- **Module focus** — Pick 3-4 core modules and make the AI experience in those exceptional; do not try to be SAP

---

## 2. Architecture (Winston — Architect)

### Core Architecture Principles

1. **Event-Driven Backbone** — Every business action (invoice created, stock moved, employee onboarded) emits events. The AI reasoning layer subscribes to build context.

2. **Unified Data Layer** — No per-module data silos. Entities are linked across domains (Customer connected to invoices, support tickets, inventory orders). Graph-based or well-normalized relational with knowledge graph overlay.

3. **AI Orchestration Layer** (sits between UI and business logic):
   - **Intent Recognition** — Natural language to structured business operations
   - **Context Engine** — Maintains user context, business state, recent activity
   - **Action Planning** — Breaks complex requests into multi-step workflows
   - **Guardrails** — Confirmation flows for destructive or financial actions

4. **API-First Modules** — Each ERP domain exposes clean APIs. AI layer composes across them. Enables traditional UI fallback for complex operations.

5. **Multi-tenant, Cloud-native** — SaaS delivery. Operational costs proportional to tenant size.

### Suggested Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Backend | Node.js/TypeScript or Python (FastAPI) | Strong AI ecosystem support |
| Database | PostgreSQL + pgvector | Relational + semantic search in one |
| AI Layer | LLM orchestration (Claude API / tool use) | Intent recognition, action planning, NL reporting |
| Message Bus | Redis Streams or NATS | Lightweight, appropriate for SME scale |
| Infrastructure | Containerized (Kubernetes) | Cloud-agnostic, scalable per tenant |

### Design Philosophy

Boring technology for everything except the AI layer. Proven, stable foundations; cutting-edge only where it creates the differentiator.

---

## 3. Frontend & UX (Sally — UX Designer)

### Design Philosophy

Users don't want to "use an ERP." They want to run their business. The frontend should feel like talking to a brilliant assistant who knows everything about the business.

### Key Frontend Patterns

1. **Conversational Command Center**
   - Home screen is a conversation + smart activity feed, not a 47-widget dashboard
   - Feed shows AI-noticed items: overdue invoices, stock alerts, anomalies
   - Each feed card is actionable — one tap to approve, dismiss, or dig deeper

2. **Progressive Disclosure**
   - Primary path: natural language ("Create an invoice for Acme Corp for consulting last month")
   - Traditional forms available one level deep for users who prefer them
   - Never force the AI path

3. **AI Companion Pattern**
   - Ever-present, non-intrusive assistant panel
   - Anticipates needs based on context (viewing a client pre-loads payment history)
   - Learns user patterns ("You usually run payroll on the 25th — want me to prepare it?")

4. **Mobile-First**
   - SME owners live on phones; mobile is the primary experience, not a shrunk desktop
   - Approvals, quick queries, notifications
   - Chat interface is naturally mobile-friendly

5. **Visual Language**
   - Clean, breathable layouts — no dense ERP screens
   - Status-driven color coding (not decorative)
   - Data visualization only when it tells a story
   - Guided conversational onboarding

---

## 4. Market & Business Analysis (Mary — Business Analyst)

### Essential Module Prioritization

| Priority | Module | Rationale |
|---|---|---|
| 1 | Invoicing & Accounts | Cash flow is oxygen — non-negotiable |
| 2 | Inventory / Stock | Required if selling physical goods |
| 3 | CRM Basics | Customer relationships, not Salesforce complexity |
| 4 | HR / Payroll | Once past ~10 employees |
| 5 | Reporting | AI-generated insights, not self-service BI |

### AI-First Differentiators (Competitive Moat)

- **Predictive cash flow** — "You'll be short 5K in 3 weeks based on current AR/AP patterns"
- **Automated bookkeeping** — Bank feed ingestion + AI categorization + human confirmation
- **Smart procurement** — "Based on sales velocity, reorder Widget-X by Thursday or you'll stock out"
- **Natural language reporting** — "How did Q4 compare to Q3?" answered in plain English with a chart

### Competitive Landscape

- Odoo, Zoho, ERPNext own traditional SME ERP space
- AI-first angle is genuinely underserved — most competitors are adding chatbots to existing UIs, not rethinking the paradigm
- This is the opportunity window

### Critical Success Factor

**The "magic moment" must happen in under 5 minutes.** Example: connect a bank account, AI categorizes the last 30 days of transactions, and the user instantly has a financial picture. That is the hook.

---

## 5. Summary of Non-Negotiable Principles

1. AI is the interaction paradigm, not a feature
2. Event-driven architecture with unified data layer
3. Conversational-first UI with progressive disclosure to traditional forms
4. Mobile-first design for SME owners
5. 3-4 focused modules done exceptionally, not 20 done poorly
6. Zero-config onboarding with magic moment under 5 minutes
7. Decision-first output — recommendations over raw data
8. Boring tech stack except where AI creates the differentiator
