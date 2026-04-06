# Task: {TASK-ID}

**Module:** {MODULE CODE}
**Page:** {Page name}
**Layer:** Backend (DB + API) / Frontend
**Status:** Not Started / In Progress / Done
**Blocked by:** {list prerequisite task IDs, or "none"}

---

## Objective

{One sentence: what this task produces when done.}

---

## Context

**Page spec:** `specops/modules/{mod}/pages/{page}.md`
**Module spec:** `specops/modules/{mod}/index.md`
**HansaWorld ref:** `legacy-src/c8520240417/hal/{WActions|RActions|Reports}/{PREFIX}*.hal`

{Any additional context — decisions made, constraints, gotchas.}

---

## Pre-Flight: Settings & LOV Readiness (Backend tasks only)

Before starting a backend page task, verify ALL settings and LOVs this page depends on are built and seeded. Check the page spec §2.4 for the full list.

| Setting / LOV | Table Exists | Seed Data Loaded | API Endpoint Works |
| ------------- | ------------ | ---------------- | ------------------ |
|               | Yes/No       | Yes/No           | Yes/No             |

**If any row is "No" → stop. Build the settings first (`{MOD}-BE-settings` task).**

---

## What to Build

{Specific, concrete deliverables. Name the files, functions, endpoints.}

### Files to Create

- `{path/to/file}` — {what it does}

### Files to Modify

- `{path/to/file}` — {what changes}

---

## Acceptance Criteria

- [ ] {AC 1}
- [ ] {AC 2}
- [ ] {AC 3}

---

## Tests to Write

- `{test file path}` — {what it tests}
  - {test case 1}
  - {test case 2}

---

## Verification Checklist

Standard checks — use the section that matches this task's layer.

### Backend Task (DB + API)

- [ ] Prisma schema matches page spec field definitions
- [ ] Migration created with `prisma migrate dev` (not `db push`)
- [ ] companyId on every new table
- [ ] Audit fields present (createdAt, updatedAt, createdBy, updatedBy)
- [ ] Indexes added for common query patterns
- [ ] Seed data created for LOVs/settings (if applicable)
- [ ] All CRUD endpoints work (list with pagination/filter, get, create, update, delete)
- [ ] Zod validation on all inputs
- [ ] Company-scoped queries (WHERE companyId = ?)
- [ ] Record lifecycle rules implemented (defaults, validation, pre/post save, delete guard)
- [ ] Field cascading logic implemented (if applicable — e.g., customer selection populates price list)
- [ ] Status transitions enforced (if applicable)
- [ ] Side effects work (GL entries, stock updates, aging, etc.)
- [ ] Error responses follow consistent format
- [ ] All tests pass
- [ ] No existing protected files modified

### Frontend Task

- [ ] List page follows T1 template (data table, filters, search, action bar)
- [ ] Form page follows T3/T4 template (field groups, validation, save/cancel)
- [ ] Visual design matches Concept D (purple theme, correct typography, card styles)
- [ ] All CRUD operations work end-to-end via API calls
- [ ] Field cascading works in UI (selecting customer updates address, price list, etc.)
- [ ] Status transitions reflected in UI (buttons, badges, allowed actions per status)
- [ ] i18n translation keys for all user-visible text
- [ ] Mobile responsive
- [ ] No console errors

---

## Superpowers Execution

1. `writing-plans` — review this task, create implementation plan
2. `executing-plans` — write the code
3. `test-driven-development` — write and run tests
4. `verification-before-completion` — run through verification checklist above
