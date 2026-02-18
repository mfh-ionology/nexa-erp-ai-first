# Nexa ERP — Project Rules

## Document Synchronisation Rule (MANDATORY)

Whenever requirements, features, or architectural decisions are **added, modified, or removed**, ALL of the following documents MUST be updated to stay in sync:

### Core Specification Documents
1. **PRD** — `_bmad-output/planning-artifacts/prd.md`
2. **Architecture** — `_bmad-output/planning-artifacts/architecture.md`
3. **UX Design Specification** — `_bmad-output/planning-artifacts/ux-design-specification.md`

### Reference Documents (Implementation Detail)
4. **API Contracts** — `_bmad-output/planning-artifacts/api-contracts.md`
5. **State Machine Reference** — `_bmad-output/planning-artifacts/state-machine-reference.md`
6. **Event Catalog** — `_bmad-output/planning-artifacts/event-catalog.md`
7. **Data Models** — `_bmad-output/planning-artifacts/data-models.md`
8. **Business Rules Compendium** — `_bmad-output/planning-artifacts/business-rules-compendium.md`

### Cross-Cutting & Tracking
9. **Project Context** — `_bmad-output/planning-artifacts/project-context.md` (architectural decisions, cross-cutting patterns)
10. **Traceability Workbook** — `_bmad-output/planning-artifacts/Nexa-ERP-Traceability-Workbook-v1.xlsx` (regenerate via `scripts/generate-traceability-workbook.py` after updating the script data)

No document should contradict another. If a feature is removed from the PRD, it must also be removed from all other documents. If a new FR/NFR is added, it must appear in all relevant documents. The Project Context document is the authoritative source for cross-cutting architectural decisions (multi-company, i18n, RBAC, etc.).

## Project Context

- AI-first ERP for UK SMEs, greenfield, database-per-tenant (multi-company: companyId on every table)
- Tech: TypeScript/Node.js, React, PostgreSQL, Prisma ORM
- ALL coding done exclusively with Claude Opus 4.6
- Legacy sources: HansaWorld HAL codebase (requirements only) + Old_Spec (requirements only, no code/design)
- 11 MVP modules: System, Finance, AR, AP, Sales, Purchasing, Inventory, CRM, HR/Payroll, Manufacturing, Reporting
- Build sequence: E0-E26+ (Tier 0: Foundation, Tier 1: Core Platform, Tier 2: First Business Module, Tier 3: Business Modules)
- Cross-cutting patterns: companyId scoping, i18n translation keys, typed event emission, mobile adaptation — see `project-context.md`

## Epic Page Approval Gate (MANDATORY)

Before starting implementation of ANY Epic, the following process MUST be completed:

1. **Page Inventory** — List all pages/screens that will be created or modified in this Epic, using the 8 Standardised Screen Templates (T1–T8) from the UX Design Specification
2. **Initial Page Design** — For each page, produce a detailed design showing: layout (which template), action bar configuration (primary actions, persistent tools, overflow menu sections), AI interactions, field groupings, and status-driven behaviour
3. **Mohammed's Review & Approval** — Present the full page inventory and designs to Mohammed for review. He may add pages, remove pages, or specify requirements for individual pages
4. **No Epic Starts Without Approval** — Implementation MUST NOT begin until Mohammed has explicitly approved the page designs for that Epic

This ensures every screen gets genuine design thinking (not bulk fill-in) and Mohammed maintains control over the UX before code is written.

## 8-Document Rule for Story Creation (MANDATORY)

When the **Story Manager (SM)**, **Developer (Dev)**, or **Test Architect (TEA)** agents create stories, acceptance criteria, or test plans, they MUST reference ALL 8 key specification documents:

1. **PRD** — `_bmad-output/planning-artifacts/prd.md`
2. **Architecture** — `_bmad-output/planning-artifacts/architecture.md`
3. **UX Design Specification** — `_bmad-output/planning-artifacts/ux-design-specification.md`
4. **API Contracts** — `_bmad-output/planning-artifacts/api-contracts.md`
5. **Data Models** — `_bmad-output/planning-artifacts/data-models.md`
6. **Event Catalog** — `_bmad-output/planning-artifacts/event-catalog.md`
7. **State Machine Reference** — `_bmad-output/planning-artifacts/state-machine-reference.md`
8. **Business Rules Compendium** — `_bmad-output/planning-artifacts/business-rules-compendium.md`

No story should be created by reading only 1-2 documents. Cross-referencing all 8 ensures:
- UX screens match the data model fields and API endpoints
- Status transitions in the UI match the state machine definitions
- Events fired match the event catalog
- Business rules are enforced in both frontend validation and backend logic
- Acceptance criteria are testable against the Architecture's NFRs

## Key Directories

- Spec-pack: `docs/spec-pack/`
- Planning artifacts: `_bmad-output/planning-artifacts/`
- Legacy HAL source: `legacy-src/c8520240417/`
- BMAD commands: `.claude/commands/`
- Scripts: `scripts/`
