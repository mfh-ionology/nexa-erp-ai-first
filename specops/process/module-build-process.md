# Nexa ERP — Module Build Process

How every module gets specified and built. This is the single source of truth for the process.

---

## 1. Module Specification Structure

Every module MUST be defined with these sections, in this order:

### 1.1 Settings

Define first. Everything else depends on these being in place.

- **LOVs (List of Values)** — dropdown/select options (e.g., payment terms, customer groups, adjustment reason codes)
- **Configuration tables** — system parameters that control module behaviour (e.g., costing method, number series format, matching tolerances)
- **Number Series** — auto-generated reference numbers per document type (e.g., INV-00001, PO-00001)
- **Default accounts** — GL account mappings for the module (e.g., receivables control, revenue, COGS)
- **Seed data** — any data that ships with the system (e.g., standard VAT codes, default payment terms)

For each setting, define:

- Name and description
- Data type and validation rules
- Default value (if any)
- Who can change it (admin only, or per-user)
- Which pages/features depend on this setting

### 1.2 Pages

The screens users interact with. Each page is one of:

- **List Page** — shows a filterable, sortable table of records (e.g., list of invoices)
- **Detail/View Page** — shows a single record with all its data, read-only or editable
- **New/Edit Page** — form to create or edit a record (often combined with Detail)
- **Dashboard Page** — summary view with cards, charts, KPIs

For each page, define:

**List Page:**

- Fields displayed as columns (with data types)
- Default sort order
- Available filters (which fields, filter types: text/date/dropdown/range)
- Quick search fields
- Status tabs or segments (e.g., All / Draft / Posted / Reversed)
- Row actions (view, edit, delete, duplicate, etc.)
- Bulk actions (if any)
- Action bar: primary action (e.g., "+ New Invoice"), secondary actions

**Detail / New / Edit Page:**

- All fields with: name, data type, required/optional, validation rules, source (manual entry, LOV, lookup, calculated)
- Field grouping (sections/cards on the page)
- Line items (if applicable — e.g., invoice lines, journal lines)
- Status flow and allowed transitions (e.g., Draft → Pending → Posted)
- Actions available per status (e.g., Post, Reverse, Void, Duplicate)
- Related data displayed (e.g., payment history on an invoice, stock levels on an item)
- Computed/derived fields (e.g., total = sum of lines, balance = debit - credit)

### 1.3 Reports

Each report definition includes:

- Report name and description
- Parameters (filters the user sets before running — date range, account, status, etc.)
- Columns / data fields in the output
- Grouping and subtotals
- Sort order
- Report format (tabular, financial statement, chart)
- Export formats (PDF, Excel, CSV)

_Reports follow the T8 Report Template — see UX Design Specification._

### 1.4 Batch Jobs (Maintenances)

Background processes that run on demand or on schedule:

- Job name and description
- Parameters (what the user configures before running)
- What it does (step by step)
- Prerequisite checks (what must be true before it can run)
- Output (what changes in the system after it runs)
- Frequency (on-demand, daily, monthly, year-end)
- Estimated duration / can it be cancelled

### 1.5 Exports & Imports

- What data can be exported (and in what format)
- What data can be imported (and the expected format)
- Validation rules for imports
- How conflicts are handled (skip, overwrite, flag for review)

### 1.6 Forms (Printable Documents)

Business documents with a specific layout (not reports):

- Document name (e.g., Sales Invoice, Delivery Note)
- When it's generated (manually, on status change, on batch)
- Template variables available ({{customer.name}}, {{lines}}, etc.)
- Layout requirements (A4, thermal receipt, label)
- Branding options (logo, bank details, VAT number)

---

## 2. Database Structure Considerations

Before building any page, define the full data model:

### 2.1 Primary Tables

The main entity table (e.g., `Invoice`, `Item`, `Customer`).

- All fields with data types, nullable, defaults
- Foreign keys and relationships
- companyId scoping (every table, always)
- Indexes for common queries
- Soft delete or hard delete

### 2.2 Line Item Tables

Child tables for documents with lines (e.g., `InvoiceLine`, `JournalLine`).

- Parent FK (e.g., invoiceId)
- Line-specific fields (qty, price, discount, amount, account, VAT code)
- Line ordering (sortOrder or sequence)

### 2.3 Setting/Config Tables

Tables that store module settings and LOVs.

- Seeded with defaults on first deploy
- Admin-only write access

### 2.4 Computed / Hidden Tables

Tables that are not directly visible in the UI but are maintained by the system:

- **Aging tables** — e.g., AR aging buckets updated on invoice save/payment
- **Balance tables** — e.g., running account balances updated on posting
- **Summary/cache tables** — pre-calculated aggregates for dashboard performance
- **Audit tables** — transaction history for compliance

These MUST be identified upfront because they affect the write path of core operations.

### 2.5 Prisma Migration

- Always use `prisma migrate dev` (never `db push`)
- Partial unique indexes: use `--create-only`, add raw SQL, then apply
- Set `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=yes` in dev

---

## 3. Build Sequence for a Module

### Phase 1: Settings & Foundation

**Settings MUST be built and seeded BEFORE any page work starts.** Pages depend on settings for dropdowns, defaults, number series, and configurable behaviour.

**How to identify all settings needed:**

1. Go through every page in the module's `index.md`
2. For each page, list every dropdown, configurable default, and auto-generated value
3. Check the HansaWorld manual (`https://hansaworldmanuals.com` → module → settings) for what settings exist
4. Check the HAL source (`legacy-src/c8520240417/hal/RActions/{PREFIX}VcRAction.hal` → `RecordDefaults()`) for what defaults are set on record creation
5. Check the HAL source (`hal/WActions/{PREFIX}VcWAction.hal`) for what LOVs are referenced in field lookups
6. Document all settings in the module's `settings.md` with: name, data type, default values, seed data source

**Build steps:**

1. Define all setting/config tables and LOV tables (Prisma schema + migration)
2. Create seed data — initial values that ship with the system (e.g., standard VAT codes, default payment terms)
3. Build settings API routes (CRUD for each setting type)
4. Build settings UI pages (admin-only)

### Phase 2: Core Pages (one page at a time)

Pick the most important page first (e.g., Items for Inventory, Invoices for Sales).

**Before starting any page, verify its settings dependencies are met** — see the page spec §2.4 "Settings & LOV Dependencies" table. Every dropdown and default must have a working API and seed data.

Each page produces **2 tasks**:

**Task 1 — Backend (DB + API)**

- Prisma schema for the entity + line items + computed/hidden tables
- Migration + seed data
- CRUD endpoints: list (with pagination, filtering, sorting), get by ID, create, update, delete
- Record lifecycle rules: defaults on create, validation before save, pre/post save side effects, delete guards
- Field cascading logic: what happens when key fields change (e.g., customer selected → look up price list, payment terms)
- Status transitions with conditions and side effects
- Posting logic (if applicable — e.g., journal posting, stock movements)
- Tests for all endpoints and business logic

**Task 2 — Frontend**

- List page: data table with columns, filters, search, action bar (T1 template)
- Detail/New/Edit page: form with all fields, validation, save/submit (T3/T4 template)
- Field cascading UI (API calls on field change, auto-populate dependent fields)
- Status flow UI (buttons, badges, allowed actions per status)
- Concept D visual design (purple theme, card styles, typography)
- i18n translation keys
- Mobile responsive

**Backend must be complete and tested before frontend starts.**

### Phase 3: Reports

- Build each report following the T8 Report Template
- Parameter panel → query → results table
- Export to PDF/Excel

### Phase 4: Batch Jobs, Exports/Imports, Forms

- Batch jobs with BullMQ workers
- Export/import with CSV/Excel support
- Printable forms with document template engine (E12)

---

## 4. Task Chunking

Every piece of work is a small, focused task that Claude Code can execute in one session.

### Task Naming Convention

```
{MODULE}-{LAYER}-{PAGE}
```

Examples:

- `INV-BE-items` — Backend: Items schema + API + business logic + tests
- `INV-FE-items` — Frontend: Items list page + form + field cascading + status flow
- `INV-BE-settings` — Backend: All Inventory settings tables + API + seed data
- `INV-FE-settings` — Frontend: Inventory settings pages
- `FIN-RPT-trial-balance` — Trial Balance report (DB query + UI)
- `SAL-BATCH-statement-gen` — Customer statement batch job

### Task Size Rules

- **2 tasks per page:** one Backend (DB + API), one Frontend
- Never combine Backend + Frontend in one task
- Backend must be complete and tested before Frontend starts
- Settings are also 2 tasks: BE (tables + API + seed) then FE (settings pages)
- Reports and batch jobs are typically 1 task each (query + UI together)
- Each task should be completable in a single Claude Code session
- Each task has clear acceptance criteria (what does "done" look like)

### Task Execution Flow (using Superpowers skills)

1. **Brainstorm / Plan** — `writing-plans` skill: define what the task does, what files to create/modify, what tests to write
2. **Execute** — `executing-plans` skill: write the code following the plan
3. **Test** — `test-driven-development` skill: run tests, verify CRUD, check UI
4. **Review** — `verification-before-completion` skill: check against spec, check UI matches design, check no regressions

---

## 5. Standards to Follow (Every Task)

### Database

- companyId on every table (multi-company isolation)
- Prisma schema conventions: camelCase fields, explicit relations
- Always `prisma migrate dev`, never `db push`
- Audit fields: createdAt, updatedAt, createdBy, updatedBy

### API

- Fastify 5 routes with Zod schema validation
- Company-scoped queries (WHERE companyId = ?)
- Consistent error responses
- Pagination: offset/limit with total count
- Filtering: field-based query params
- Sorting: sortBy + sortOrder params

### Frontend

- React 19 + TanStack Router + Zustand
- Shadcn UI components styled to Concept D (purple theme)
- T1 List Template for all list pages
- T3/T4 Form Templates for detail/edit pages
- T8 Report Template for all reports
- Tailwind 4 for styling
- i18n translation keys for all user-visible text
- Mobile-responsive (adapts to phone/tablet/desktop)

### UI Patterns (must be consistent across all modules)

- **List pages**: Data table with column headers, row click to open detail, action bar with "+ New" primary action, filter/sort button, search box, status tabs
- **Detail pages**: Card-based layout with field groups, action bar with context-sensitive buttons, breadcrumb navigation
- **Forms**: Field labels above inputs, required field indicators, inline validation errors, save/cancel buttons
- **Filters**: Filter & Sort modal with simple and advanced modes, date presets, LOV dropdowns, active filter badge count

---

## 6. Relationship to Existing Tools

### SpecOps MCP

SpecOps is the spec management database. It stores entities, APIs, pages, rules, stories, and packets.

- Use SpecOps to store structured specs once a module is ready to build
- Use `get_execution_packet` to get everything a coding agent needs for a story
- SpecOps is the machine-readable spec; the markdown files in `specops/` are the human-readable requirements

### Superpowers Skills

Skills used during execution:

- `writing-plans` — create implementation plan from requirements
- `executing-plans` — sequential execution with review checkpoints
- `test-driven-development` — TDD within each task
- `verification-before-completion` — verify before marking done

### BMAD (Retired)

BMAD was the previous methodology. It produced planning artifacts in `_bmad-output/planning-artifacts/`.

- These files are READ-ONLY reference for Tier 0-1 work (E0-E13b)
- Do NOT use BMAD orchestrator, epic files, or multi-agent pipeline for new work
- All new work uses the process defined in THIS document

### Module Requirements Files

- `docs/module-requirements/all-modules-summary.md` — overview of all modules with pages, settings, features, reports
- `docs/module-requirements/{module}.md` — detailed requirements per module
- `specops/` — process documents and detailed page-level specs (this folder)

---

## 7. Checklist: Before Starting a New Module

- [ ] Module requirements reviewed and approved (from `docs/module-requirements/`)
- [ ] HansaWorld manual reviewed for this module (`https://hansaworldmanuals.com`)
- [ ] HansaWorld HAL source scanned for settings blocks (`amaster/datadef*.hal`)
- [ ] ALL settings and LOVs identified across all pages — documented in `modules/{mod}/settings.md`
- [ ] Settings seed data defined (what ships with the system vs what the user creates)
- [ ] Core pages identified and prioritised (which page to build first)
- [ ] Database tables designed (primary, line items, settings, computed/hidden)
- [ ] UI template assignment per page (T1/T3/T4/T7/T8)
- [ ] Tasks created: settings BE → settings FE → then per page (BE → FE)

---

## 8. Checklist: Before Starting a New Page

### Settings Readiness (GATE — must pass before page work begins)

- [ ] All settings/LOVs this page depends on are listed in page spec §2.4
- [ ] HansaWorld manual checked for settings relevant to this page
- [ ] HAL `RecordDefaults()` checked for what defaults reference settings
- [ ] HAL `WAction EFAfter()` handlers checked for what lookups reference LOVs
- [ ] Setting tables exist in DB with seed data loaded
- [ ] Setting API endpoints return correct data

### Page Spec Completeness

- [ ] Database table designed with all fields, relations, indexes
- [ ] Computed/hidden tables identified (if any)
- [ ] Record lifecycle rules defined (defaults, validation, pre/post save, delete guard)
- [ ] Field cascading rules defined (what happens when each key field changes)
- [ ] Status flow defined (if applicable)
- [ ] Line items defined (if applicable)
- [ ] Happy path scenario written
- [ ] Tasks created: BE then FE
