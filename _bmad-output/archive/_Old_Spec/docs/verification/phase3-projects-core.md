# Phase 3.12 — projects_core

- BASE_REF: `f9dcda2`
- HEAD: `edfae60`
- Slice: `projects_core`
- Evidence: `reports/verification/phase3-projects_core-20260115-222349`

## Permissions & module gate
- Read: `ui:finance_reports:view`
- Manage: `inventory:manage`
- Module gate: `assertModuleEnabled('projects')`

## Endpoints
- Boards: `GET/POST /api/projects/boards`; `GET/PATCH /api/projects/boards/[boardId]`; `POST /api/projects/boards/[boardId]/disable`; `POST /api/projects/boards/[boardId]/enable`; `GET /api/projects/boards/[boardId]/rollup`
- Tasks: `GET/POST /api/projects/boards/[boardId]/tasks`; `GET/PATCH /api/projects/tasks/[taskId]`; `POST /api/projects/tasks/[taskId]/move`; `POST /api/projects/tasks/[taskId]/close`; `POST /api/projects/tasks/[taskId]/reopen`; `GET /api/projects/tasks/[taskId]/rollup`
- Timesheets: `GET/POST /api/projects/timesheets`; `GET/PATCH/DELETE /api/projects/timesheets/[entryId]`

## UI routes
- `/projects`
- `/projects/boards`
- `/projects/boards/[boardId]`
- `/projects/tasks/[taskId]`
- `/projects/timesheets`

## Rules
- Boards default columns Backlog/In Progress/Done; disable blocks task creation.
- Tasks support create/update/move with deterministic ordering; close/reopen adjusts status.
- Timesheets store integer minutes; optional lock days not enforced unless set; staff default to own entries, manage can filter userId.
- Rollups sum minutes per task and per board deterministically.

## Seed / unseed / verifier
- Seed (`scripts/qa/seed_projects_core.ts`): creates tenant, board, 3 tasks (sequential), moves one task to In Progress, logs timesheets (60m, 30m), computes rollups.
- Unseed (`scripts/qa/unseed_projects_core.ts`): removes tenant config and tenant by runId.
- Verifier (`scripts/verification/verify_phase3_projects_core.mjs`): uses TEST_DATABASE_URL; runs seed; asserts data present, rollups non-zero, cross-tenant isolation (other tenant empty), unseed cleanup.

## Evidence / commands
- Evidence folder: `reports/verification/phase3-projects_core-20260115-222349`
- Commands:
  - `pnpm -s spec:coverage`
  - `TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/nexa_vitest?schema=phase3_main_projects_db01 SLICE_KEY=projects_core BASE_REF=f9dcda2 bash scripts/verification/run_phase3_slice.sh`
