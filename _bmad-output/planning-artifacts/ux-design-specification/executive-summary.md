# Executive Summary

## Project Vision

Nexa ERP inverts the traditional ERP interaction model. Instead of users learning the system, the system learns the user. The core differentiator is the **"Told, Shown, Approve, Done"** paradigm — users state intent in natural language, the AI pre-fills complete records using business context (customer history, default terms, seasonal patterns), the user reviews and approves, and the record is committed. No major ERP vendor has shipped an AI-first interaction paradigm; competitors (SAP, Oracle, Sage, Xero, Odoo, Zoho) have only added AI as sidebar features while keeping form-driven workflows unchanged.

The UX embodies this philosophy across every screen: AI as the primary interaction path, traditional forms as the always-available fallback — both paths using the same API and data layer. The purple theme (from prototypes D/E/F) establishes the visual identity. **Concept D: Co-Pilot Dock** has been chosen as the AI interaction model — a collapsible drawer on the right side of the screen that provides contextual AI assistance, chat history, and preset prompts.

**Target market:** UK SMEs (10–250 employees) currently on legacy desktop ERPs (HansaWorld, Sage, custom systems). SaaS B2B, database-per-tenant, greenfield codebase. Tech stack: TypeScript, React 19, Tailwind CSS 4, Shadcn UI, Fastify, PostgreSQL, Prisma ORM, Claude API.

## Target Users

Eight personas spanning phone, tablet, and desktop — each starting their day with a role-based AI briefing:

| Persona | Role | Device | Primary Pain Point | Key UX Need |
|---------|------|--------|--------------------|-------------|
| **Sarah** | Business Owner (45-person manufacturing) | Phone | 2-hour morning slog across 15+ screens | 15-min briefing with one-tap actions, period comparisons |
| **David** | Finance Manager | Desktop | 3-day month-end, manual bank matching, 200 invoices/month | AI document extraction, batch approval, month-end checklist |
| **Priya** | Sales/CRM Manager | Desktop | CRM disconnected from Sales Orders | Pipeline-to-invoice lifecycle without module switching |
| **Marcus** | Warehouse/Production Manager | Tablet | 4 phone calls + 3 spreadsheets for coordination | Real-time stock, barcode scanning, production scheduling |
| **Fatima** | HR Manager | Desktop | 2-day payroll, manual compliance tracking | AI payroll prep, proactive compliance alerts |
| **Tom** | System Admin | Desktop | Complex setup, 15 users to manage | Single console, 30 min/week admin target |
| **Claire** | External Accountant (Phase 2) | Desktop | VPN/physical access needed for financials | Scoped read access + journal posting |
| **New User** | Any first-time user | Any | ERPs take months to learn | "Magic Moment" in under 5 minutes |

**Cross-persona UX patterns:** Every persona starts with a role-based daily briefing, follows "AI prepares, human approves", needs cross-module awareness (no siloed views), and can always drop to traditional forms.

## Key Design Challenges

1. **The Form Complexity Problem** — Legacy HansaWorld has 313-field customer forms, 211-field item forms, 280-field invoices. Nexa must handle this breadth through progressive disclosure and tabbed layouts while keeping the AI path effortlessly simple. 18 different Header+Lines form types (invoices, orders, POs, journals, etc.) share a common pattern that must be designed once and reused everywhere.

2. **Status + Events + Notifications at Scale** — 37 entity state machines, 97 business events, 7 cross-module flow chains (Order-to-Cash, Procure-to-Pay, Document-to-Pay, Payroll, Month-End Close, Manufacturing, Lead-to-Customer). Status must be displayed consistently across all entities using a semantic colour system. Notifications must be tiered (immediate toast vs. notification centre vs. audit-only) and actionable (inline approve/reject buttons). A generic `<StatusBadge>`, `<StatusTimeline>`, `<NotificationCentre>`, `<RealtimeIndicator>`, and `<EventFlowTracker>` component set is required.

3. **Dashboard Philosophy** — Dashboards must show period comparisons, not single numbers. The PRD defines role-based daily briefings that are contextual, personalised, actionable, and cross-module — this replaces the traditional static dashboard. Every KPI must show delta/trend (e.g., "Revenue £142K ↑12% vs last month"), not bare numbers.

4. **Responsive Strategy** — Sarah uses phone, Marcus uses tablet, others use desktop. No mobile-first FR/NFR exists yet (validation gap). The UX must define breakpoints (375px+), touch targets (44x44px minimum), and mobile-specific navigation patterns.

5. **AI Confidence & Trust** — AI pre-fills must show confidence scoring (>=90% green/auto-suggest, 70–89% amber/review, <70% red/manual). Document Understanding needs side-by-side original document view with bounding boxes alongside extracted data. Users need to always know what the AI "did" and "why."

6. **Approval UX at Every Level** — Financial AI actions NEVER execute without user approval (NFR16). PO approvals are multi-level with configurable thresholds. Bank feed matching needs batch approval. Leave requests, journals, and payroll all have approval workflows. The system needs a unified approval UX pattern: one-tap approve, batch approve, multi-level routing display.

## Design Opportunities

1. **"The Briefing" as the Home Screen** — Replace the traditional dashboard with a personalised AI briefing that is the first thing every user sees. Each item is actionable (one-tap chase, approve, review). This is Nexa's signature UX moment — no competitor does this.

2. **Cross-Module Event Flow Visualisation** — Show users the full lifecycle of their business processes (Quote → Order → Dispatch → Invoice → Payment) in a horizontal process tracker. Real-time status updates as downstream entities are created. This gives ERP users something they've never had: visibility into where a transaction sits across the entire business.

3. **Document Understanding as the AI "Wow Moment"** — Upload a supplier invoice (web, camera, or email), AI extracts all fields with confidence scores, matches to PO, presents for one-click approval. This turns 45 minutes of data entry into 3 minutes of review.

4. **Generic Status System** — A data-driven status configuration that maps any entity's status enum to semantic categories (Initial, InProgress, AwaitingAction, Success, Partial, Cancelled, Error, Warning, Terminal) with consistent colours, icons, and animations. Adding a new entity type requires only a config entry, no component changes.

5. **Saved Views as a Power Feature** — Users can save personalised views (columns, filters, sorting) per entity type, star favourites, and AI can create views from natural language ("show me overdue invoices sorted by amount"). This bridges the gap between the AI path and the traditional path.
