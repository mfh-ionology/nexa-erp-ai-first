# Nexa ERP — Project Rules

## Document Synchronisation Rule (MANDATORY)

Whenever requirements, features, or architectural decisions are **added, modified, or removed**, ALL of the following documents MUST be updated to stay in sync:

### Core Specification Documents (sharded into folders)

1. **PRD** — `_bmad-output/planning-artifacts/prd/` (index.md + sharded sections)
2. **Architecture** — `_bmad-output/planning-artifacts/architecture/` (index.md + sharded sections)
3. **UX Design Specification** — `_bmad-output/planning-artifacts/ux-design-specification/` (index.md + sharded sections)

### Reference Documents (Implementation Detail)

4. **API Contracts** — `_bmad-output/planning-artifacts/api-contracts/` (sharded by module)
5. **Data Models** — `_bmad-output/planning-artifacts/data-models/` (sharded by module)
6. **Event Catalog** — `_bmad-output/planning-artifacts/event-catalog.md`
7. **State Machine Reference** — `_bmad-output/planning-artifacts/state-machine-reference.md`
8. **Business Rules Compendium** — `_bmad-output/planning-artifacts/business-rules-compendium.md`

### Cross-Cutting & Tracking

9. **Project Context** — `_bmad-output/planning-artifacts/project-context.md` (architectural decisions, cross-cutting patterns)
10. **Traceability Workbook** — `_bmad-output/planning-artifacts/Nexa-ERP-Traceability-Workbook-v1.xlsx` (regenerate via `scripts/generate-traceability-workbook.py` after updating the script data)

### Epic & Story Registry

11. **Epic Files** — `_bmad-output/implementation-artifacts/epics/` (epic-E0.md, epic-E1.md, etc.)
12. **Current Epic Stories** — `_bmad-output/planning-artifacts/epics.md` (active epic being worked on)

No document should contradict another. If a feature is removed from the PRD, it must also be removed from all other documents. If a new FR/NFR is added, it must appear in all relevant documents. The Project Context document is the authoritative source for cross-cutting architectural decisions (multi-company, i18n, RBAC, etc.).

## Project Context

- AI-first ERP for UK SMEs, greenfield, database-per-tenant (multi-company: companyId on every table)
- Tech: TypeScript/Node.js, React, PostgreSQL, Prisma ORM
- ALL coding done exclusively with Claude Opus 4.6
- Legacy sources: HansaWorld HAL codebase (requirements only) + Old_Spec (requirements only, no code/design)
- 11 MVP modules: System, Finance, AR, AP, Sales, Purchasing, Inventory, CRM, HR/Payroll, Manufacturing, Reporting
- Build sequence: E0-E26+ (Tier 0: Foundation, Tier 1: Core Platform, Tier 2: First Business Module, Tier 3: Business Modules)
- Cross-cutting patterns: companyId scoping, i18n translation keys, typed event emission, mobile adaptation — see `project-context.md`

## BMAD Workflow Rule (MANDATORY)

Under NO circumstances should any coding be done for any Epic without using the BMAD method. All Epic implementation MUST go through the full BMAD orchestrated workflow (`auto-bmad_pack/scripts/v7-orchestrated-epic.sh`), which includes:

1. **Story creation** — via the Story Manager (SM) agent
2. **Story complexity assessment** — automatic task breakdown
3. **Code implementation** — via the Developer (Dev) agent, task by task
4. **Task validation** — after each task completion
5. **Code review** — adversarial review of each story
6. **Test review** — via the Test Architect (TEA) agent
7. **Post-completion verification** — file and artifact updates
8. **Retrospective** — after epic completion

No ad-hoc coding, no manual implementation plans, no skipping the BMAD pipeline. If the orchestrated script is not available or fails, fix the script — do not bypass it.

## Pre-Epic Frontend Design Gate (MANDATORY)

Before running the orchestrator for any epic with frontend stories, run the **Pre-Epic Frontend Design Gate** workflow:

```
/bmad-bmm-pre-epic-frontend-design {EPIC_ID}
```

This workflow:

1. **Analyses** the epic's UI requirements — identifies all pages, maps to templates (T1-T8), identifies new components needed
2. **Generates a v0 prompt** — complete Concept D design system base + epic-specific screen definitions
3. **Pauses for Mohammed's approval** — he reviews, optionally runs in v0, commits reference components

Output is saved to `_bmad-output/implementation-artifacts/pre-epic-designs/`. Only after approval should the orchestrator (`v7-orchestrated-epic.sh`) be launched.

Skip this for backend-only epics (no UI stories).

## Epic Page Approval Gate (MANDATORY)

Before starting implementation of ANY Epic, the following process MUST be completed:

1. **Page Inventory** — List all pages/screens that will be created or modified in this Epic, using the 8 Standardised Screen Templates (T1–T8) from the UX Design Specification
2. **Initial Page Design** — For each page, produce a detailed design showing: layout (which template), action bar configuration (primary actions, persistent tools, overflow menu sections), AI interactions, field groupings, and status-driven behaviour
3. **Mohammed's Review & Approval** — Present the full page inventory and designs to Mohammed for review. He may add pages, remove pages, or specify requirements for individual pages
4. **No Epic Starts Without Approval** — Implementation MUST NOT begin until Mohammed has explicitly approved the page designs for that Epic

This ensures every screen gets genuine design thinking (not bulk fill-in) and Mohammed maintains control over the UX before code is written.

## 8-Document Rule for Story Creation (MANDATORY)

When the **Story Manager (SM)**, **Developer (Dev)**, or **Test Architect (TEA)** agents create stories, acceptance criteria, or test plans, they MUST reference ALL 8 key specification documents:

1. **PRD** — `_bmad-output/planning-artifacts/prd/` (index.md + sharded sections)
2. **Architecture** — `_bmad-output/planning-artifacts/architecture/` (index.md + sharded sections)
3. **UX Design Specification** — `_bmad-output/planning-artifacts/ux-design-specification/` (index.md + sharded sections)
4. **API Contracts** — `_bmad-output/planning-artifacts/api-contracts/` (sharded by module)
5. **Data Models** — `_bmad-output/planning-artifacts/data-models/` (sharded by module)
6. **Event Catalog** — `_bmad-output/planning-artifacts/event-catalog.md`
7. **State Machine Reference** — `_bmad-output/planning-artifacts/state-machine-reference.md`
8. **Business Rules Compendium** — `_bmad-output/planning-artifacts/business-rules-compendium.md`

No story should be created by reading only 1-2 documents. Cross-referencing all 8 ensures:

- UX screens match the data model fields and API endpoints
- Status transitions in the UI match the state machine definitions
- Events fired match the event catalog
- Business rules are enforced in both frontend validation and backend logic
- Acceptance criteria are testable against the Architecture's NFRs

## Git Push Rule (MANDATORY)

Before any `git push`, switch to the correct GitHub account:

```bash
gh auth switch --user mfshussein
```

This ensures pushes authenticate against the correct GitHub account. Always run this before pushing.

## Orchestrator Script Launch Rule (MANDATORY)

When launching `v7-orchestrated-epic.sh` or `v7-post-epic-test-runner.sh` from within a Claude Code session, you **MUST** unset the `CLAUDECODE` environment variable. Claude Code sets this variable, and the orchestrator scripts spawn child Claude Code processes that will refuse to run if they detect they're nested inside another Claude Code session.

```bash
# CORRECT — launch from within Claude Code:
nohup env -u CLAUDECODE bash auto-bmad_pack/scripts/v7-orchestrated-epic.sh E4 --run-tests > /tmp/e4-orchestrator.log 2>&1 &

# WRONG — will fail with "cannot be launched inside another Claude Code session":
nohup bash auto-bmad_pack/scripts/v7-orchestrated-epic.sh E4 --run-tests > /tmp/e4-orchestrator.log 2>&1 &
```

This applies to any BMAD script that spawns `claude` subprocesses.

## Visual Design Fidelity Rule (MANDATORY)

All frontend code MUST match the approved **Concept D** prototype (`_bmad-output/planning-artifacts/ux-prototypes/concept-d-purple-copilot.html`). Stock/generic Shadcn UI defaults are NOT acceptable. Key requirements:

- **Cards**: 12px radius, custom shadow, purple-tinted hover shadow
- **Buttons**: Primary `#7c3aed`, hover `#5b21b6`, 8px radius
- **Sidebar**: Active item purple bg + white text, hover `#f5f3ff`
- **Header**: 56px, purple "N" logo mark, centered search
- **Typography**: Plus Jakarta Sans (headings), Inter (body), JetBrains Mono (amounts/codes)
- **Background**: `#f4f2ff` (light purple), NOT white or grey
- **Animations**: fadeInUp, slideIn, stepIn with `prefers-reduced-motion` respect

Before marking any frontend story as complete, open the Concept D prototype HTML side-by-side with the running app and verify visual parity. See `ux-design-specification/ux-quality-contract.md` §4 for full checklist.

## Prisma Migration Rules (MANDATORY)

- **NEVER use `prisma db push`** — always use `prisma migrate dev`. Using `db push` corrupts migration state and causes subsequent `migrate dev` to fail with drift detection errors.
- **Set `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=yes`** in `.env` for dev environments. Prisma 7 blocks destructive operations without this.
- **Partial unique indexes** (PostgreSQL `WHERE` clauses) cannot be expressed in Prisma schema. Add them as raw SQL at the end of the migration file BEFORE applying. Use `prisma migrate dev --create-only` to generate the migration, add the raw SQL, then apply.

## Protected Files (MANDATORY)

When working on a story, do NOT delete or overwrite files created by previous stories unless the current story explicitly requires modifying them. Key protected files from E0/E1:

- `packages/db/src/client.ts` — PrismaClient singleton
- `packages/db/src/index.ts` — barrel exports for @nexa/db
- `packages/db/src/utils/sharing.ts` — getVisibleCompanyIds
- `packages/db/src/utils/rbac.ts` — resolveUserRole
- `packages/db/src/services/number-series.service.ts` — nextNumber
- `packages/db/package.json` — do not strip dependencies
- `packages/config/eslint/base.js` — shared ESLint config
- `apps/platform-api/src/client.ts` — Platform PrismaClient
- `apps/platform-api/src/index.ts` — barrel exports for platform-api

If a story retry subprocess needs to regenerate code, it must preserve existing exports and utilities from prior stories.

## Key Directories

- Spec-pack: `docs/spec-pack/`
- Planning artifacts: `_bmad-output/planning-artifacts/`
- Implementation artifacts: `_bmad-output/implementation-artifacts/`
- Legacy HAL source: `legacy-src/c8520240417/`
- BMAD commands: `.claude/commands/`
- Scripts: `scripts/`
- Module architecture detail: `_bmad-output/planning-artifacts/arch-sections/` (per-module, supplementary — consult when working on specific business module epics E14+)
- Archive (old/superseded): `_bmad-output/archive/` (do NOT reference for current work)

## Canonical Documents (ALWAYS CONSULT)

When creating epics, stories, acceptance criteria, test plans, or doing any implementation work, these are the authoritative source documents. Always cross-reference them:

### Core Specifications (sharded folders — read index.md first)

| Document                | Path                                                       |
| ----------------------- | ---------------------------------------------------------- |
| PRD                     | `_bmad-output/planning-artifacts/prd/`                     |
| Architecture            | `_bmad-output/planning-artifacts/architecture/`            |
| UX Design Specification | `_bmad-output/planning-artifacts/ux-design-specification/` |
| API Contracts           | `_bmad-output/planning-artifacts/api-contracts/`           |
| Data Models             | `_bmad-output/planning-artifacts/data-models/`             |

### Reference Documents (single files)

| Document                  | Path                                                           |
| ------------------------- | -------------------------------------------------------------- |
| Event Catalog             | `_bmad-output/planning-artifacts/event-catalog.md`             |
| State Machine Reference   | `_bmad-output/planning-artifacts/state-machine-reference.md`   |
| Business Rules Compendium | `_bmad-output/planning-artifacts/business-rules-compendium.md` |
| Project Context           | `_bmad-output/planning-artifacts/project-context.md`           |

### Implementation Tracking

| Document            | Path                                                       |
| ------------------- | ---------------------------------------------------------- |
| Epic Registry       | `_bmad-output/implementation-artifacts/epics/`             |
| Active Epic Stories | `_bmad-output/planning-artifacts/epics.md`                 |
| Sprint Status       | `_bmad-output/implementation-artifacts/sprint-status.yaml` |
