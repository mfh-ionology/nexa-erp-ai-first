# Epic E11 - Backend API Test Report

**Executed:** 2026-03-05T07:57:50.237829+00:00
**API Base URL:** http://localhost:5100
**Epic:** E11 - Task Management

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 78 |
| Passed | 76 |
| Failed | 0 |
| Test Plan Defects | 2 |
| Skipped | 0 |
| **Pass Rate** | **97%** (excl. test plan defects: **100%**) |

> 2 tests failed due to incorrect URLs in the test plan (missing /status suffix). The actual API implementation is correct.

## Results by Endpoint

### POST /auth/login

| # | Test Name | Type | Status | Expected | Actual |
|---|-----------|------|--------|----------|--------|
| 1 | Login as SUPER_ADMIN - happy path | happy_path | PASS | 200 | 200 |
| 2 | Login as MANAGER - happy path | happy_path | PASS | 200 | 200 |
| 3 | Login as STAFF - happy path | happy_path | PASS | 200 | 200 |
| 4 | Login as VIEWER - happy path | happy_path | PASS | 200 | 200 |

### POST /tasks

| # | Test Name | Type | Status | Expected | Actual |
|---|-----------|------|--------|----------|--------|
| 1 | Create task - minimal fields (title only) as STAFF | happy_path | PASS | 201 | 201 |
| 2 | Create task - all fields as ADMIN | happy_path | PASS | 201 | 201 |
| 3 | Create task - with entity link as MANAGER | happy_path | PASS | 201 | 201 |
| 4 | Create task - VIEWER denied (403) | authorization | PASS | 403 | 403 |
| 5 | Create task - no auth token (401) | authorization | PASS | 401 | 401 |
| 6 | Create task - missing title (400) | validation | PASS | 400 | 400 |
| 7 | Create task - empty title (400) | validation | PASS | 400 | 400 |
| 8 | Create task - title too long (400) | validation | PASS | 400 | 400 |
| 9 | Create task - invalid priority enum (400) | validation | PASS | 400 | 400 |
| 10 | Create task - entityType without entityId (400 - refinement) | validation | PASS | 400 | 400 |
| 11 | Create task - entityId without entityType (400 - refinement) | validation | PASS | 400 | 400 |
| 12 | Create task - invalid entityType (400 or 404 from entity registry) | validation | PASS | [400, 404] | 400 |
| 13 | Create task - invalid assigneeId UUID format (400) | validation | PASS | 400 | 400 |
| 14 | Create task - nonexistent assigneeId (404 from service) | edge_case | PASS | [400, 404] | 400 |

### GET /tasks

| # | Test Name | Type | Status | Expected | Actual |
|---|-----------|------|--------|----------|--------|
| 1 | List tasks - no filters as VIEWER | happy_path | PASS | 200 | 200 |
| 2 | List tasks - filter by status=OPEN | happy_path | PASS | 200 | 200 |
| 3 | List tasks - filter by priority=HIGH | happy_path | PASS | 200 | 200 |
| 4 | List tasks - filter by assigneeId | happy_path | PASS | 200 | 200 |
| 5 | List tasks - search by title keyword | happy_path | PASS | 200 | 200 |
| 6 | List tasks - pagination with limit and offset | happy_path | PASS | 200 | 200 |
| 7 | List tasks - search returns empty list | edge_case | PASS | 200 | 200 |
| 8 | List tasks - invalid status enum (400) | validation | PASS | 400 | 400 |
| 9 | List tasks - invalid limit (400) | validation | PASS | 400 | 400 |
| 10 | List tasks - no auth (401) | authorization | PASS | 401 | 401 |

### GET /tasks/my

| # | Test Name | Type | Status | Expected | Actual |
|---|-----------|------|--------|----------|--------|
| 1 | Get my tasks - as ADMIN (assigned to admin) | happy_path | PASS | 200 | 200 |
| 2 | Get my tasks - as STAFF (assigned to staff) | happy_path | PASS | 200 | 200 |
| 3 | Get my tasks - filter by status=OPEN | happy_path | PASS | 200 | 200 |
| 4 | Get my tasks - VIEWER denied (403) | authorization | PASS | 403 | 403 |
| 5 | Get my tasks - no auth (401) | authorization | PASS | 401 | 401 |

### GET /tasks/:id

| # | Test Name | Type | Status | Expected | Actual |
|---|-----------|------|--------|----------|--------|
| 1 | Get task detail - existing OPEN task as VIEWER | happy_path | PASS | 200 | 200 |
| 2 | Get task detail - existing COMPLETED task | happy_path | PASS | 200 | 200 |
| 3 | Get task detail - nonexistent task (404) | edge_case | PASS | 404 | 404 |
| 4 | Get task detail - invalid UUID format (400) | validation | PASS | 400 | 400 |
| 5 | Get task detail - no auth (401) | authorization | PASS | 401 | 401 |

### PATCH /tasks/:id

| # | Test Name | Type | Status | Expected | Actual |
|---|-----------|------|--------|----------|--------|
| 1 | Update task - change title as STAFF | happy_path | PASS | 200 | 200 |
| 2 | Update task - change priority and description as MANAGER | happy_path | PASS | 200 | 200 |
| 3 | Update task - set dueDate | happy_path | PASS | 200 | 200 |
| 4 | Update task - clear dueDate (set to null) | happy_path | PASS | 200 | 200 |
| 5 | Update task - COMPLETED task rejected (422 - BR-TASK-006) | edge_case | PASS | 422 | 422 |
| 6 | Update task - nonexistent task (404) | edge_case | PASS | 404 | 404 |
| 7 | Update task - empty body (400 - refinement: at least one field) | validation | PASS | 400 | 400 |
| 8 | Update task - invalid UUID (400) | validation | PASS | 400 | 400 |
| 9 | Update task - VIEWER denied (403) | authorization | PASS | 403 | 403 |

### PATCH /tasks/:id/status

| # | Test Name | Type | Status | Expected | Actual |
|---|-----------|------|--------|----------|--------|
| 1 | Status transition - OPEN to IN_PROGRESS | happy_path | DEFECT | 200 | 400 |
| 2 | Status transition - IN_PROGRESS to COMPLETED (sets completedAt) | happy_path | DEFECT | 200 | 400 |
| 3 | Status transition - OPEN to CANCELLED | happy_path | PASS | 200 | 200 |
| 4 | Status transition - COMPLETED to IN_PROGRESS rejected (422 - terminal state BR-TASK-006) | edge_case | PASS | 422 | 422 |
| 5 | Status transition - COMPLETED to OPEN rejected (422 - terminal state) | edge_case | PASS | 422 | 422 |
| 6 | Status transition - CANCELLED to OPEN rejected (422 - terminal state) | edge_case | PASS | 422 | 422 |
| 7 | Status transition - nonexistent task (404) | edge_case | PASS | 404 | 404 |
| 8 | Status transition - invalid status value (400) | validation | PASS | 400 | 400 |
| 9 | Status transition - missing status field (400) | validation | PASS | 400 | 400 |
| 10 | Status transition - VIEWER denied (403) | authorization | PASS | 403 | 403 |

**Status transition - OPEN to IN_PROGRESS:** TEST PLAN DEFECT: URL should be /tasks/:id/status, not /tasks/:id. The test plan sends PATCH to /tasks/00000000-0000-4000-a000-000000000103 (the update endpoint) instead of /tasks/00000000-0000-4000-a000-000000000103/status (the status transition endpoint). Verified manually that the correct endpoint returns 200.

**Status transition - IN_PROGRESS to COMPLETED (sets completedAt):** TEST PLAN DEFECT: URL should be /tasks/:id/status, not /tasks/:id. Same issue as above. Verified manually that the correct endpoint works.

### POST /tasks/:id/assignees

| # | Test Name | Type | Status | Expected | Actual |
|---|-----------|------|--------|----------|--------|
| 1 | Add assignee - add viewer user to task as STAFF | happy_path | PASS | 201 | 201 |
| 2 | Add assignee - duplicate assignee (409) | edge_case | PASS | 409 | 409 |
| 3 | Add assignee - nonexistent user (404) | edge_case | PASS | [400, 404] | 400 |
| 4 | Add assignee - nonexistent task (404) | edge_case | PASS | 404 | 404 |
| 5 | Add assignee - invalid userId (400) | validation | PASS | 400 | 400 |
| 6 | Add assignee - invalid task ID (400) | validation | PASS | 400 | 400 |
| 7 | Add assignee - missing userId field (400) | validation | PASS | 400 | 400 |
| 8 | Add assignee - VIEWER denied (403) | authorization | PASS | 403 | 403 |

### DELETE /tasks/:id/assignees/:userId

| # | Test Name | Type | Status | Expected | Actual |
|---|-----------|------|--------|----------|--------|
| 1 | Remove assignee - remove viewer user from task 101 | happy_path | PASS | 204 | 204 |
| 2 | Remove assignee - nonexistent assignment (404) | edge_case | PASS | 404 | 404 |
| 3 | Remove assignee - nonexistent task (404) | edge_case | PASS | 404 | 404 |
| 4 | Remove assignee - invalid UUID params (400) | validation | PASS | 400 | 400 |
| 5 | Remove assignee - VIEWER denied (403) | authorization | PASS | 403 | 403 |

### DELETE /tasks/:id

| # | Test Name | Type | Status | Expected | Actual |
|---|-----------|------|--------|----------|--------|
| 1 | Delete task - creator deletes own task as STAFF | happy_path | PASS | 204 | 204 |
| 2 | Delete task - MANAGER deletes another user's task | happy_path | PASS | 204 | 204 |
| 3 | Delete task - ADMIN deletes any task | happy_path | PASS | 204 | 204 |
| 4 | Delete task - STAFF cannot delete another user's task (403) | authorization | PASS | 403 | 403 |
| 5 | Delete task - VIEWER denied (403) | authorization | PASS | 403 | 403 |
| 6 | Delete task - nonexistent task (404) | edge_case | PASS | 404 | 404 |
| 7 | Delete task - invalid UUID (400) | validation | PASS | 400 | 400 |
| 8 | Delete task - already deleted task not visible in list | edge_case | PASS | 200 | 200 |

## Test Plan Defects Found

### 1. Status transition tests use wrong URL (2 tests)

**Affected tests:**
- `Status transition - OPEN to IN_PROGRESS`
- `Status transition - IN_PROGRESS to COMPLETED (sets completedAt)`

**Issue:** The test plan specifies `PATCH /tasks/:id` but the correct endpoint is `PATCH /tasks/:id/status`. The `/tasks/:id` endpoint is the general update endpoint, which only accepts `title`, `description`, `priority`, and `dueDate` fields - not `status`. Sending `{"status": "IN_PROGRESS"}` to the update endpoint correctly returns 400 (validation error).

**Fix:** Change the URL in the test plan from `/tasks/00000000-0000-4000-a000-000000000103` to `/tasks/00000000-0000-4000-a000-000000000103/status` for both test cases.

**Verification:** Manually tested `PATCH /tasks/:id/status` with the correct URL and confirmed it returns 200 with proper status transitions.

## Conclusion

All 76 correctly-specified tests pass. The 2 failures are attributable to test plan URL errors, not implementation bugs. The Task Management API (Epic E11) is functioning correctly across all tested scenarios:

- CRUD operations (create, read, update, delete)
- Status transitions with state machine enforcement
- Assignee management (add/remove)
- Filtering, search, and pagination
- RBAC enforcement (VIEWER denied write operations)
- Input validation (missing fields, invalid enums, bad UUIDs)
- Edge cases (nonexistent resources, duplicate assignees, terminal states)