# SpecOps — Developer Onboarding

How to navigate and use the specops folder for building Nexa ERP modules.

---

## Structure

```
specops/
├── README.md                    ← START HERE — lists all modules, explains navigation
├── ONBOARDING.md                ← You are here
├── process/                     ← How we work (don't change these)
│   ├── module-build-process.md  ← The full methodology
│   ├── page-spec-template.md   ← Copy this to create a new page spec
│   ├── task-template.md        ← Copy this to create a new task
│   └── report-spec-template.md ← Copy this to create a new report spec
└── modules/                     ← One folder per module
    ├── fin/                     ← Finance (has content)
    │   ├── index.md            ← Module overview: all settings, pages, reports, status
    │   ├── pages/              ← One spec file per page (e.g., journal-entries.md)
    │   ├── reports/            ← One spec file per report
    │   └── tasks/              ← One task file per executable unit of work
    ├── sal/                     ← Sales (folders ready, specs to be filled)
    ├── inv/                     ← Inventory
    ├── prd/                     ← Production
    └── ... (all other modules)
```

---

## The 4 Levels

### Level 0 — `specops/README.md`

Entry point. Lists all 11 modules with status. Tells you where to go.

### Level 1 — `specops/modules/{mod}/index.md`

One file per module. Lists everything in that module: settings, pages, reports, batch jobs, workflows. Shows what's built and what's not. This is the overview — no implementation detail.

### Level 2 — `specops/modules/{mod}/pages/{page-name}.md`

One file per page/screen. This is the detailed spec. Contains:

- Database tables (all fields, types, relations)
- API endpoints (CRUD + custom actions)
- Record lifecycle rules — what happens on create, save, update, delete (defaults, validation, side effects)
- Field cascading rules — what happens when a field value changes (e.g., selecting a customer auto-fills their address, price list, payment terms)
- Status transitions with conditions
- Frontend layout (list columns, form fields, filters)
- Happy path scenario for testing

### Level 3 — `specops/modules/{mod}/tasks/{task-id}.md`

One file per coding task. Each page produces **2 tasks**: one Backend (DB + API) and one Frontend. This is what gets executed. Contains: what to build, files to create/modify, acceptance criteria, verification checklist.

---

## How to Work

1. Open `specops/README.md` → find the module
2. Open the module's `index.md` → find the page to build
3. Open or create the page spec → read/write the full detail
4. Create tasks from the page spec (one per layer: DB, API, FE)
5. Execute each task using Superpowers skills:
   - `writing-plans` → create plan
   - `executing-plans` → write code
   - `test-driven-development` → tests
   - `verification-before-completion` → verify

### Build Order — Always

```
Settings (BE → FE) → then Pages (BE → FE, one page at a time) → then Reports → then Batch Jobs
```

Each page = 2 tasks: **Backend** (DB schema + API + business logic + tests) then **Frontend** (list + form + cascading + status flow). Backend must be complete and tested before frontend starts.

### Settings & LOVs Come First

**No page work starts until its settings and LOVs are built and seeded.** Every dropdown, default value, and configurable behaviour on a page depends on settings tables existing with data in them.

Before starting any page:

1. Check the page spec §2.4 "Settings & LOV Dependencies" — lists every setting this page needs
2. Verify the setting tables exist, seed data is loaded, and the API returns correct values
3. If anything is missing → build it first via the `{MOD}-BE-settings` task

**Where to find what settings are needed:**

- HansaWorld manual (`https://hansaworldmanuals.com` → module → settings)
- HAL source: `legacy-src/c8520240417/hal/RActions/{PREFIX}VcRAction.hal` → `RecordDefaults()` shows what settings are read on record creation
- HAL source: `hal/WActions/{PREFIX}VcWAction.hal` → field `EFAfter()` handlers show what LOVs are used in dropdowns and lookups

### Task Naming

`{MOD}-BE-{page}` for backend, `{MOD}-FE-{page}` for frontend.
Examples: `INV-BE-items`, `INV-FE-items`, `SAL-BE-invoices`, `SAL-FE-invoices`

### Creating a New Page Spec

1. Copy `specops/process/page-spec-template.md` to `specops/modules/{mod}/pages/{page-name}.md`
2. Fill in all sections — consult HansaWorld references for business logic
3. Create tasks from the spec

### Creating a New Task

1. Copy `specops/process/task-template.md` to `specops/modules/{mod}/tasks/{TASK-ID}.md`
2. Task ID format: `{MOD}-{LAYER}-{page}-{action}` (e.g., `INV-API-items-crud`)
3. Fill in: objective, acceptance criteria, files to create/modify, tests
4. Execute via Superpowers

---

## Reference Material

When writing a page spec, always check two sources for business logic:

### HansaWorld Manuals

Online at `https://hansaworldmanuals.com` — browse by module for feature descriptions, field explanations, and workflow documentation.

### HansaWorld HAL Source Code

Located at `legacy-src/c8520240417/hal/`. The code is organised by function:

| Folder                 | What it contains                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `WActions/`            | **Field cascading logic** — what happens when a field changes on a form (e.g., price lookups, customer defaults, line recalculations) |
| `RActions/`            | **Record lifecycle** — defaults on create, validation before save, post-save side effects, delete guards                              |
| `Reports/`             | Report definitions and calculations                                                                                                   |
| `Maint/`               | Batch jobs / maintenance procedures                                                                                                   |
| `Documents/`           | Form/document layout definitions                                                                                                      |
| `amaster/datadef*.hal` | Core data structure definitions (entity fields)                                                                                       |

**Module prefixes in file names:** `Acc`=Accounts, `TR`=Transactions/NL, `IV`=Invoice, `OR`=Sales Order, `PO`=Purchase Order, `CU`=Customer, `SU`=Supplier, `IN`=Inventory, `BA`=Bank, `HR`=HR, `ST`=Stock Transfer, `DO`=Delivery, `AT2`=Assets

**Example:** To understand Sales Invoice business logic, read:

- `hal/WActions/IVVcWAction.hal` — field cascading (customer selection, item lookup, price calculation)
- `hal/RActions/IVVcRAction.hal` — record lifecycle (validation, posting, GL entries)

---

## Key Files Outside SpecOps

| File                                                                          | What it is                                                              |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `CLAUDE.md`                                                                   | Project rules — loaded every Claude Code session. Read this first.      |
| `docs/module-requirements/all-modules-summary.md`                             | High-level overview of ALL modules (pages, settings, features, reports) |
| `docs/module-requirements/{module}.md`                                        | Detailed requirements per module                                        |
| `_bmad-output/planning-artifacts/ux-design-specification/`                    | Screen templates (T1-T8) and visual design (Concept D)                  |
| `_bmad-output/planning-artifacts/ux-prototypes/concept-d-purple-copilot.html` | The visual prototype — all frontend must match this                     |

---

## Tech Stack

| Layer    | Technology                                                        |
| -------- | ----------------------------------------------------------------- |
| Frontend | React 19, Vite 6, TanStack Router, Zustand, Tailwind 4, Shadcn UI |
| Backend  | Fastify 5, TypeScript strict                                      |
| Database | PostgreSQL 17, Prisma 7                                           |
| AI       | Anthropic Claude (primary), OpenAI GPT-4o (fallback)              |
| Jobs     | BullMQ + Redis                                                    |
| Monorepo | Turborepo + pnpm                                                  |

---

## Critical Rules

1. **Never use `prisma db push`** — always `prisma migrate dev`
2. **Never combine API + Frontend** in one task — API must be tested before FE starts
3. **companyId on every table** — multi-tenant isolation
4. **Visual design must match Concept D** — purple theme, not stock Shadcn defaults
5. **Before git push:** run `gh auth switch --user mfshussein`
6. **Dev ports:** API=5100, Platform API=5101, Web=5110
