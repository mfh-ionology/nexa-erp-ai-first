# Nexa ERP — SpecOps

This folder contains everything needed to specify and build any module in the ERP. It is structured as a drill-down hierarchy: start at the top, navigate down to the specific task you need to execute.

## Document Hierarchy

```
Level 0: MODULE INDEX (this file)
  │
  │   Lists all modules and their build status.
  │   Entry point for everything.
  │
  ├── Level 1: MODULE SPEC — modules/{MODULE}/index.md
  │     │
  │     │   One file per module. Lists all settings, pages,
  │     │   reports, batch jobs, exports/imports, forms for
  │     │   that module. Overview only — no implementation detail.
  │     │
  │     ├── Level 2: PAGE SPEC — modules/{MODULE}/pages/{page-name}.md
  │     │     │
  │     │     │   One file per page. Full specification:
  │     │     │   DB tables, fields, API endpoints, UI layout,
  │     │     │   filters, status flow, validation rules.
  │     │     │   This is the detailed spec.
  │     │     │
  │     │     └── Level 3: TASK — modules/{MODULE}/tasks/{TASK-ID}.md
  │     │           │
  │     │           │   One file per small executable task.
  │     │           │   Single layer (DB or API or FE) for one page.
  │     │           │   This is what gets fed to Superpowers.
  │     │           │   Contains: what to build, acceptance criteria,
  │     │           │   files to create/modify, tests to write.
  │     │           │
  │     │           └── (Superpowers executes: plan → code → review → test)
  │     │
  │     ├── Level 2: SETTINGS SPEC — modules/{MODULE}/settings.md
  │     │     Full specification of all settings, LOVs, config tables.
  │     │
  │     └── Level 2: REPORTS SPEC — modules/{MODULE}/reports/{report-name}.md
  │           One file per report. Parameters, columns, grouping, format.
  │
  └── process/
        module-build-process.md  — How to build any module (the methodology)
        page-spec-template.md    — Blank template for creating a page spec
        task-template.md         — Blank template for creating a task
        report-spec-template.md  — Blank template for creating a report spec
```

## Module Index

| #   | Module                 | Code | Status                                | Spec                         |
| --- | ---------------------- | ---- | ------------------------------------- | ---------------------------- |
| 1   | Finance                | FIN  | Tier 2 — partially built (E14 Wave 1) | [modules/fin/](modules/fin/) |
| 2   | Fixed Assets           | FA   | Not started                           | [modules/fa/](modules/fa/)   |
| 3   | Inventory & Stock      | INV  | Not started                           | [modules/inv/](modules/inv/) |
| 4   | Sales                  | SAL  | Not started                           | [modules/sal/](modules/sal/) |
| 5   | Purchasing             | PUR  | Not started                           | [modules/pur/](modules/pur/) |
| 6   | POS                    | POS  | Not started                           | [modules/pos/](modules/pos/) |
| 7   | CRM                    | CRM  | Not started                           | [modules/crm/](modules/crm/) |
| 8   | Warehouse              | WH   | Not started                           | [modules/wh/](modules/wh/)   |
| 9   | Production             | PRD  | Not started                           | [modules/prd/](modules/prd/) |
| 10  | Projects & Job Costing | PRJ  | Not started                           | [modules/prj/](modules/prj/) |
| 11  | HR & Payroll           | HR   | Not started                           | [modules/hr/](modules/hr/)   |

**Pilot modules (build first):** FIN, SAL, INV, PRD

## How to Use This

### Starting a new module

1. Read this file → find the module
2. Open the module's `index.md` → see all pages, settings, reports
3. **Identify ALL settings and LOVs** needed across all pages — check HansaWorld manuals and HAL source (`RecordDefaults()` for defaults, `WAction EFAfter()` for lookups). Document in `modules/{mod}/settings.md`
4. **Build settings first** (`{MOD}-BE-settings` → `{MOD}-FE-settings`) — all LOVs seeded before any page work
5. Pick the first page to build (usually the most important one)
6. Open/create the page spec (`pages/{page-name}.md`) → fill in §2.4 Settings Dependencies
7. Verify settings are built and seeded → create tasks (BE then FE)
8. Execute tasks using Superpowers skills

### Starting a coding session

1. Open this file → find the module you're working on
2. Open the module's `index.md` → find the current page/feature being built
3. Open the task file for the current task → read the spec and acceptance criteria
4. Use Superpowers: `writing-plans` → `executing-plans` → `test-driven-development` → `verification-before-completion`

### Creating a new page spec

1. Copy `process/page-spec-template.md` to `modules/{MODULE}/pages/{page-name}.md`
2. Fill in all sections (DB tables, fields, API, UI, filters, status flow)
3. Create tasks from the spec

### Creating a new task

1. Copy `process/task-template.md` to `modules/{MODULE}/tasks/{TASK-ID}.md`
2. Fill in: objective, acceptance criteria, files to create/modify, tests
3. Execute via Superpowers

## Reference Documents

| Document                    | Path                                                       | Purpose                                                                 |
| --------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| Module Requirements Summary | `docs/module-requirements/all-modules-summary.md`          | High-level overview of all modules (pages, settings, features, reports) |
| Module Build Process        | `specops/process/module-build-process.md`                  | The methodology — how to spec and build any module                      |
| UX Design Specification     | `_bmad-output/planning-artifacts/ux-design-specification/` | Screen templates (T1-T8), visual design (Concept D)                     |
| Existing API Contracts      | `_bmad-output/planning-artifacts/api-contracts/`           | Reference for API patterns already established                          |
| Existing Data Models        | `_bmad-output/planning-artifacts/data-models/`             | Reference for DB patterns already established                           |
