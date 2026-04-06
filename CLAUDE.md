# Nexa ERP — Project Rules

## Project Context

AI-first ERP for UK SMEs. Database-per-tenant (companyId on every table). TypeScript/Node.js, React, PostgreSQL, Prisma ORM. All coding done with Claude.

| Layer    | Technology                                                           |
| -------- | -------------------------------------------------------------------- |
| Frontend | React 19, Vite 6, TanStack Router, Zustand, Tailwind 4, Shadcn UI    |
| Backend  | Fastify 5, TypeScript strict                                         |
| Database | PostgreSQL 17, Prisma 7                                              |
| AI       | Anthropic Claude (primary), OpenAI GPT-4o (fallback), via AI Gateway |
| Jobs     | BullMQ + Redis                                                       |
| Monorepo | Turborepo + pnpm                                                     |

**Pilot modules:** Finance, Sales, Inventory, Manufacturing. Others follow.

## How We Build Modules

All module development follows the process in `specops/`. Start there.

```
specops/README.md                         → Entry point: module index, how to navigate
specops/process/module-build-process.md   → Full methodology
specops/modules/{mod}/index.md            → Module overview (settings, pages, reports, status)
specops/modules/{mod}/pages/{page}.md     → Detailed page spec (DB, API, UI)
specops/modules/{mod}/tasks/{task-id}.md  → Executable task → feed to Superpowers
```

**Module requirements overview:** `docs/module-requirements/all-modules-summary.md`

### What Page Specs Define

Every page spec (`specops/modules/{mod}/pages/{page}.md`) includes:

- DB tables (primary, line items, computed/hidden)
- API endpoints (CRUD + custom actions)
- **Record Lifecycle Rules** — defaults on create, validation before save, post-save side effects, delete guards (from HansaWorld RActions pattern)
- **Field Cascading Rules** — what happens when a field changes (e.g., selecting a customer populates price list, address, payment terms — from HansaWorld WActions pattern)
- Status transitions with roles, conditions, and side effects
- Notifications triggered by events
- Happy path scenario for testing
- Frontend layout (list columns, form fields, filters)

### Build Order (always)

1. **Settings & LOVs first** — all dropdowns, defaults, and configurable behaviour depend on settings tables being built and seeded. Check HansaWorld manuals and HAL source (`RecordDefaults()`, `WAction EFAfter()`) to identify all settings needed. No page work starts until its settings are in place.
2. **Backend (DB + API)** — Prisma schema, migrations, seed data, CRUD endpoints, record lifecycle rules, field cascading logic, status transitions, tests. Must be complete and tested BEFORE frontend starts.
3. **Frontend** — List page, detail/form, field cascading UI, status flow, API integration. Never combine Backend + Frontend in one task.

### Execution (Superpowers Skills)

1. `writing-plans` — create plan from task spec
2. `executing-plans` — write the code
3. `test-driven-development` — TDD within each task
4. `verification-before-completion` — verify before marking done

## Mandatory Rules

### Prisma Migrations

- **NEVER use `prisma db push`** — always `prisma migrate dev`
- Set `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=yes` in `.env`
- Partial unique indexes: use `--create-only`, add raw SQL, then apply

### Git Push

Before any `git push`:

```bash
gh auth switch --user mfshussein
```

### Dev Ports (5100–5200 range)

| Service      | Port |
| ------------ | ---- |
| API          | 5100 |
| Platform API | 5101 |
| Web (Vite)   | 5110 |

### Visual Design — Concept D

All frontend MUST match the Concept D prototype (`_bmad-output/planning-artifacts/ux-prototypes/concept-d-purple-copilot.html`). Key values:

- Primary: `#7c3aed`, hover: `#5b21b6`
- Background: `#f4f2ff` (light purple)
- Typography: Plus Jakarta Sans (headings), Inter (body), JetBrains Mono (amounts/codes)
- Cards: 12px radius, custom shadow
- See `ux-design-specification/ux-quality-contract.md` for full checklist

### Protected Files

Do NOT delete or overwrite these unless explicitly required:

- `packages/db/src/client.ts` — PrismaClient singleton
- `packages/db/src/index.ts` — barrel exports for @nexa/db
- `packages/db/src/utils/sharing.ts` — getVisibleCompanyIds
- `packages/db/src/utils/rbac.ts` — resolveUserRole
- `packages/db/src/services/number-series.service.ts` — nextNumber
- `packages/config/eslint/base.js` — shared ESLint config

## HansaWorld Reference (Requirements Source)

Two sources of truth for understanding ERP business logic:

### 1. HansaWorld Manuals

Online at `https://hansaworldmanuals.com` — browse by module for feature descriptions, field explanations, and workflow documentation.

### 2. HansaWorld HAL Source Code

Located at `legacy-src/c8520240417/hal/`. The code is organised by function:

| Folder                 | Purpose                                                                   | What to look for                                      |
| ---------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------- |
| `WActions/`            | **Field cascading logic** — what happens when a field changes on a form   | Price lookups, customer defaults, line recalculations |
| `RActions/`            | **Record lifecycle** — defaults, validation, pre/post save, delete guards | Business rules, computed fields, side effects         |
| `Reports/`             | Report definitions and calculations                                       | Report structure, data sources                        |
| `Maint/`               | Batch jobs / maintenance procedures                                       | Year-end, revaluations, data fixes                    |
| `Documents/`           | Form/document layout definitions                                          | Field layout, sections                                |
| `amaster/datadef*.hal` | Core data structure definitions                                           | Entity fields, record types                           |

**Module prefixes:** `Acc`=Accounts, `TR`=Transactions/NL, `IV`=Invoice, `OR`=Sales Order, `PO`=Purchase Order, `CU`=Customer, `SU`=Supplier, `IN`=Inventory, `BA`=Bank, `HR`=HR, `ST`=Stock Transfer, `DO`=Delivery, `AT2`=Assets

**When speccing a page**, always check the corresponding HAL files for business logic that must be replicated. Example: for Sales Invoice, check `IVVcWAction.hal` (field cascading) and `IVVcRAction.hal` (record lifecycle).

## Key Directories

| Purpose                                  | Path                                                       |
| ---------------------------------------- | ---------------------------------------------------------- |
| **Module specs & tasks**                 | `specops/`                                                 |
| **Module requirements**                  | `docs/module-requirements/`                                |
| **HansaWorld HAL source**                | `legacy-src/c8520240417/hal/`                              |
| **HansaWorld module research**           | `~/Desktop/HansaWorld-Modules/{CODE}/`                     |
| Planning artifacts (read-only reference) | `_bmad-output/planning-artifacts/`                         |
| UX Design & Screen Templates             | `_bmad-output/planning-artifacts/ux-design-specification/` |
| API Contracts (reference)                | `_bmad-output/planning-artifacts/api-contracts/`           |
| Data Models (reference)                  | `_bmad-output/planning-artifacts/data-models/`             |

## What's Built

- **Tier 0 (E0-E1):** Foundation — database, auth, multi-company isolation [COMPLETE]
- **Tier 1 (E2-E13):** Core platform — RBAC, events, AI copilot, frontend shell, cross-cutting [~85% COMPLETE]
- **Tier 2+ (E14+):** Business modules [IN PROGRESS — Finance partially built]

The `_bmad-output/` planning artifacts are READ-ONLY reference for Tier 0-1 work. All new module work uses `specops/`.
