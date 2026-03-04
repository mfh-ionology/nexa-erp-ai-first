# Epic E9 — Backend API Test Report

**Epic:** E9 — Notifications (Templates, Preferences, In-App, Role Defaults)
**Executed:** 2026-03-04T08:02:10.578669+00:00
**API Base URL:** http://localhost:5100

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 92 |
| Passed | 90 |
| Failed | 0 |
| Skipped | 2 |
| **Pass Rate** | **97.8%** |

### Results by Test Type

| Type | Pass | Fail | Skip | Total |
|------|------|------|------|-------|
| authorization | 26 | 0 | 0 | 26 |
| cleanup | 1 | 0 | 0 | 1 |
| edge_case | 8 | 0 | 0 | 8 |
| happy_path | 32 | 0 | 2 | 34 |
| validation | 23 | 0 | 0 | 23 |

### Results by Endpoint

| Endpoint | Pass | Fail | Skip | Total |
|----------|------|------|------|-------|
| ✅ `POST /auth/login` | 4 | 0 | 0 | 4 |
| ✅ `POST /notifications/templates` | 11 | 0 | 0 | 11 |
| ✅ `GET /notifications/templates` | 3 | 0 | 0 | 3 |
| ✅ `GET /notifications/templates?isActive=true` | 1 | 0 | 0 | 1 |
| ✅ `GET /notifications/templates?isActive=false` | 1 | 0 | 0 | 1 |
| ✅ `GET /notifications/templates?search=approval` | 1 | 0 | 0 | 1 |
| ✅ `GET /notifications/templates?limit=5&offset=0` | 1 | 0 | 0 | 1 |
| ✅ `GET /notifications/templates?search=zzzznonexistent` | 1 | 0 | 0 | 1 |
| ✅ `GET /notifications/templates/61ecee83-280e-47b1-8064-6af66355a387` | 2 | 0 | 0 | 2 |
| ✅ `GET /notifications/templates/00000000-0000-4000-a000-ffffffffffff` | 1 | 0 | 0 | 1 |
| ✅ `GET /notifications/templates/not-a-uuid` | 1 | 0 | 0 | 1 |
| ✅ `PATCH /notifications/templates/d3545e4a-f3fc-4b99-b43b-48e8352d377e` | 4 | 0 | 0 | 4 |
| ✅ `PATCH /notifications/templates/00000000-0000-4000-a000-ffffffffffff` | 1 | 0 | 0 | 1 |
| ✅ `PATCH /notifications/templates/not-a-uuid` | 1 | 0 | 0 | 1 |
| ✅ `GET /notifications` | 4 | 0 | 0 | 4 |
| ✅ `GET /notifications?status=DELIVERED` | 1 | 0 | 0 | 1 |
| ✅ `GET /notifications?limit=5` | 1 | 0 | 0 | 1 |
| ✅ `GET /notifications?status=INVALID_STATUS` | 1 | 0 | 0 | 1 |
| ✅ `GET /notifications?limit=101` | 1 | 0 | 0 | 1 |
| ✅ `GET /notifications/unread-count` | 3 | 0 | 0 | 3 |
| ✅ `PATCH /notifications/mark-all-read` | 3 | 0 | 0 | 3 |
| ⚠️ `PATCH /notifications/:id/read` | 0 | 0 | 1 | 1 |
| ✅ `PATCH /notifications/00000000-0000-4000-a000-ffffffffffff/read` | 2 | 0 | 0 | 2 |
| ✅ `PATCH /notifications/not-a-uuid/read` | 1 | 0 | 0 | 1 |
| ⚠️ `POST /notifications/:id/dismiss` | 0 | 0 | 1 | 1 |
| ✅ `POST /notifications/00000000-0000-4000-a000-ffffffffffff/dismiss` | 2 | 0 | 0 | 2 |
| ✅ `POST /notifications/not-a-uuid/dismiss` | 1 | 0 | 0 | 1 |
| ✅ `GET /notifications/preferences` | 4 | 0 | 0 | 4 |
| ✅ `PUT /notifications/preferences` | 7 | 0 | 0 | 7 |
| ✅ `DELETE /notifications/preferences/reset` | 3 | 0 | 0 | 3 |
| ✅ `GET /notifications/preferences/role-defaults?role=STAFF` | 4 | 0 | 0 | 4 |
| ✅ `GET /notifications/preferences/role-defaults?role=MANAGER` | 1 | 0 | 0 | 1 |
| ✅ `GET /notifications/preferences/role-defaults` | 1 | 0 | 0 | 1 |
| ✅ `GET /notifications/preferences/role-defaults?role=INVALID_ROLE` | 1 | 0 | 0 | 1 |
| ✅ `PUT /notifications/preferences/role-defaults` | 10 | 0 | 0 | 10 |
| ✅ `DELETE /notifications/templates/db0e562c-4f9f-44ec-bd22-23f5e95df778` | 1 | 0 | 0 | 1 |
| ✅ `DELETE /notifications/templates/00000000-0000-4000-a000-ffffffffffff` | 1 | 0 | 0 | 1 |
| ✅ `DELETE /notifications/templates/not-a-uuid` | 1 | 0 | 0 | 1 |
| ✅ `DELETE /notifications/templates/d3545e4a-f3fc-4b99-b43b-48e8352d377e` | 3 | 0 | 0 | 3 |

## Detailed Results

### `POST /auth/login`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| AUTH-01 | Login as admin - happy path | happy_path | 200 | 200 | ✅ pass |
| AUTH-02 | Login as staff - happy path | happy_path | 200 | 200 | ✅ pass |
| AUTH-03 | Login as manager - happy path | happy_path | 200 | 200 | ✅ pass |
| AUTH-04 | Login as viewer - happy path | happy_path | 200 | 200 | ✅ pass |

### `POST /notifications/templates`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| TMPL-CREATE-01 | Create template - happy path with all fields | happy_path | 201 | 201 | ✅ pass |
| TMPL-CREATE-02 | Create template - minimal required fields only | happy_path | 201 | 201 | ✅ pass |
| TMPL-CREATE-03 | Create template - missing required field code returns 400 | validation | 400 | 400 | ✅ pass |
| TMPL-CREATE-04 | Create template - missing required field eventName returns 400 | validation | 400 | 400 | ✅ pass |
| TMPL-CREATE-05 | Create template - empty defaultChannels array returns 400 | validation | 400 | 400 | ✅ pass |
| TMPL-CREATE-06 | Create template - invalid channel enum value returns 400 | validation | 400 | 400 | ✅ pass |
| TMPL-CREATE-07 | Create template - invalid priority enum returns 400 | validation | 400 | 400 | ✅ pass |
| TMPL-CREATE-08 | Create template - VIEWER denied (403) | authorization | 403 | 403 | ✅ pass |
| TMPL-CREATE-09 | Create template - STAFF denied (403) | authorization | 403 | 403 | ✅ pass |
| TMPL-CREATE-10 | Create template - MANAGER denied (403) | authorization | 403 | 403 | ✅ pass |
| TMPL-CREATE-11 | Create template - no auth token returns 401 | authorization | 401 | 401 | ✅ pass |

### `GET /notifications/templates`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| TMPL-LIST-01 | List templates - happy path (default params) | happy_path | 200 | 200 | ✅ pass |
| TMPL-LIST-07 | List templates - VIEWER denied (403) | authorization | 403 | 403 | ✅ pass |
| TMPL-LIST-08 | List templates - STAFF denied (403) | authorization | 403 | 403 | ✅ pass |

### `GET /notifications/templates?isActive=true`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| TMPL-LIST-02 | List templates - filter by isActive=true | happy_path | 200 | 200 | ✅ pass |

### `GET /notifications/templates?isActive=false`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| TMPL-LIST-03 | List templates - filter by isActive=false | happy_path | 200 | 200 | ✅ pass |

### `GET /notifications/templates?search=approval`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| TMPL-LIST-04 | List templates - search by name | happy_path | 200 | 200 | ✅ pass |

### `GET /notifications/templates?limit=5&offset=0`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| TMPL-LIST-05 | List templates - pagination with limit and offset | happy_path | 200 | 200 | ✅ pass |

### `GET /notifications/templates?search=zzzznonexistent`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| TMPL-LIST-06 | List templates - search with no results returns empty array | edge_case | 200 | 200 | ✅ pass |

### `GET /notifications/templates/61ecee83-280e-47b1-8064-6af66355a387`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| TMPL-GET-01 | Get template by ID - happy path (seeded APPROVAL_REQUESTED) | happy_path | 200 | 200 | ✅ pass |
| TMPL-GET-04 | Get template by ID - VIEWER denied (403) | authorization | 403 | 403 | ✅ pass |

### `GET /notifications/templates/00000000-0000-4000-a000-ffffffffffff`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| TMPL-GET-02 | Get template by ID - not found (valid UUID, no record) | edge_case | 404 | 404 | ✅ pass |

### `GET /notifications/templates/not-a-uuid`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| TMPL-GET-03 | Get template by ID - invalid UUID format returns 400 | validation | 400 | 400 | ✅ pass |

### `PATCH /notifications/templates/d3545e4a-f3fc-4b99-b43b-48e8352d377e`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| TMPL-UPDATE-01 | Update template - happy path (update name and priority) | happy_path | 200 | 200 | ✅ pass |
| TMPL-UPDATE-02 | Update template - set description to null | happy_path | 200 | 200 | ✅ pass |
| TMPL-UPDATE-05 | Update template - empty defaultChannels returns 400 | validation | 400 | 400 | ✅ pass |
| TMPL-UPDATE-06 | Update template - STAFF denied (403) | authorization | 403 | 403 | ✅ pass |

### `PATCH /notifications/templates/00000000-0000-4000-a000-ffffffffffff`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| TMPL-UPDATE-03 | Update template - not found returns 404 | edge_case | 404 | 404 | ✅ pass |

### `PATCH /notifications/templates/not-a-uuid`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| TMPL-UPDATE-04 | Update template - invalid UUID returns 400 | validation | 400 | 400 | ✅ pass |

### `GET /notifications`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| NOTIF-LIST-01 | List notifications - happy path (default params) | happy_path | 200 | 200 | ✅ pass |
| NOTIF-LIST-06 | List notifications - VIEWER denied (403) | authorization | 403 | 403 | ✅ pass |
| NOTIF-LIST-07 | List notifications - no auth returns 401 | authorization | 401 | 401 | ✅ pass |
| NOTIF-LIST-08 | List notifications - MANAGER allowed (200) | happy_path | 200 | 200 | ✅ pass |

### `GET /notifications?status=DELIVERED`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| NOTIF-LIST-02 | List notifications - filter by status=DELIVERED | happy_path | 200 | 200 | ✅ pass |

### `GET /notifications?limit=5`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| NOTIF-LIST-03 | List notifications - with limit parameter | happy_path | 200 | 200 | ✅ pass |

### `GET /notifications?status=INVALID_STATUS`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| NOTIF-LIST-04 | List notifications - invalid status value returns 400 | validation | 400 | 400 | ✅ pass |

### `GET /notifications?limit=101`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| NOTIF-LIST-05 | List notifications - limit exceeds max (101) returns 400 | validation | 400 | 400 | ✅ pass |

### `GET /notifications/unread-count`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| NOTIF-UNREAD-01 | Unread count - happy path | happy_path | 200 | 200 | ✅ pass |
| NOTIF-UNREAD-02 | Unread count - VIEWER denied (403) | authorization | 403 | 403 | ✅ pass |
| NOTIF-UNREAD-03 | Unread count - no auth returns 401 | authorization | 401 | 401 | ✅ pass |

### `PATCH /notifications/mark-all-read`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| NOTIF-MARKALL-01 | Mark all as read - happy path | happy_path | 200 | 200 | ✅ pass |
| NOTIF-MARKALL-02 | Mark all as read - no unread notifications returns updated=0 | edge_case | 200 | 200 | ✅ pass |
| NOTIF-MARKALL-03 | Mark all as read - VIEWER denied (403) | authorization | 403 | 403 | ✅ pass |

### `PATCH /notifications/:id/read`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| NOTIF-READ-01 | Mark as read - happy path (requires DELIVERED notification) | happy_path | 200 | 0 | ⏭️ skip |

### `PATCH /notifications/00000000-0000-4000-a000-ffffffffffff/read`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| NOTIF-READ-02 | Mark as read - not found (valid UUID, no record) | edge_case | 404 | 404 | ✅ pass |
| NOTIF-READ-04 | Mark as read - VIEWER denied (403) | authorization | 403 | 403 | ✅ pass |

### `PATCH /notifications/not-a-uuid/read`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| NOTIF-READ-03 | Mark as read - invalid UUID returns 400 | validation | 400 | 400 | ✅ pass |

### `POST /notifications/:id/dismiss`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| NOTIF-DISMISS-01 | Dismiss notification - happy path | happy_path | 200 | 0 | ⏭️ skip |

### `POST /notifications/00000000-0000-4000-a000-ffffffffffff/dismiss`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| NOTIF-DISMISS-02 | Dismiss notification - not found (valid UUID) | edge_case | 404 | 404 | ✅ pass |
| NOTIF-DISMISS-04 | Dismiss notification - VIEWER denied (403) | authorization | 403 | 403 | ✅ pass |

### `POST /notifications/not-a-uuid/dismiss`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| NOTIF-DISMISS-03 | Dismiss notification - invalid UUID returns 400 | validation | 400 | 400 | ✅ pass |

### `GET /notifications/preferences`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| PREF-GET-01 | Get preferences - happy path (staff user) | happy_path | 200 | 200 | ✅ pass |
| PREF-GET-02 | Get preferences - returns all active templates with source field | happy_path | 200 | 200 | ✅ pass |
| PREF-GET-03 | Get preferences - admin user gets preferences too | happy_path | 200 | 200 | ✅ pass |
| PREF-GET-04 | Get preferences - VIEWER denied (403) | authorization | 403 | 403 | ✅ pass |

### `PUT /notifications/preferences`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| PREF-UPDATE-01 | Update preferences - happy path (toggle off email) | happy_path | 200 | 200 | ✅ pass |
| PREF-UPDATE-02 | Update preferences - bulk update multiple templates | happy_path | 200 | 200 | ✅ pass |
| PREF-UPDATE-03 | Update preferences - with priority override and mute | happy_path | 200 | 200 | ✅ pass |
| PREF-UPDATE-04 | Update preferences - empty preferences array returns 400 | validation | 400 | 400 | ✅ pass |
| PREF-UPDATE-05 | Update preferences - invalid template UUID returns 400 | validation | 400 | 400 | ✅ pass |
| PREF-UPDATE-06 | Update preferences - invalid priority override returns 400 | validation | 400 | 400 | ✅ pass |
| PREF-UPDATE-07 | Update preferences - VIEWER denied (403) | authorization | 403 | 403 | ✅ pass |

### `DELETE /notifications/preferences/reset`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| PREF-RESET-01 | Reset preferences - happy path | happy_path | 200 | 200 | ✅ pass |
| PREF-RESET-02 | Reset preferences - no preferences returns deleted=0 | edge_case | 200 | 200 | ✅ pass |
| PREF-RESET-03 | Reset preferences - VIEWER denied (403) | authorization | 403 | 403 | ✅ pass |

### `GET /notifications/preferences/role-defaults?role=STAFF`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| ROLEDEF-GET-01 | Get role defaults - happy path for STAFF role | happy_path | 200 | 200 | ✅ pass |
| ROLEDEF-GET-05 | Get role defaults - STAFF denied (403) | authorization | 403 | 403 | ✅ pass |
| ROLEDEF-GET-06 | Get role defaults - MANAGER denied (403) | authorization | 403 | 403 | ✅ pass |
| ROLEDEF-GET-07 | Get role defaults - VIEWER denied (403) | authorization | 403 | 403 | ✅ pass |

### `GET /notifications/preferences/role-defaults?role=MANAGER`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| ROLEDEF-GET-02 | Get role defaults - happy path for MANAGER role | happy_path | 200 | 200 | ✅ pass |

### `GET /notifications/preferences/role-defaults`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| ROLEDEF-GET-03 | Get role defaults - missing role query param returns 400 | validation | 400 | 400 | ✅ pass |

### `GET /notifications/preferences/role-defaults?role=INVALID_ROLE`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| ROLEDEF-GET-04 | Get role defaults - invalid role value returns 400 | validation | 400 | 400 | ✅ pass |

### `PUT /notifications/preferences/role-defaults`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| ROLEDEF-UPDATE-01 | Update role defaults - happy path (set STAFF defaults) | happy_path | 200 | 200 | ✅ pass |
| ROLEDEF-UPDATE-02 | Update role defaults - bulk update for MANAGER | happy_path | 200 | 200 | ✅ pass |
| ROLEDEF-UPDATE-03 | Update role defaults - empty preferences array returns 400 | validation | 400 | 400 | ✅ pass |
| ROLEDEF-UPDATE-04 | Update role defaults - missing role field returns 400 | validation | 400 | 400 | ✅ pass |
| ROLEDEF-UPDATE-05 | Update role defaults - invalid role value returns 400 | validation | 400 | 400 | ✅ pass |
| ROLEDEF-UPDATE-06 | Update role defaults - invalid template UUID returns 400 | validation | 400 | 400 | ✅ pass |
| ROLEDEF-UPDATE-07 | Update role defaults - missing required boolean fields returns 400 | validation | 400 | 400 | ✅ pass |
| ROLEDEF-UPDATE-08 | Update role defaults - STAFF denied (403) | authorization | 403 | 403 | ✅ pass |
| ROLEDEF-UPDATE-09 | Update role defaults - MANAGER denied (403) | authorization | 403 | 403 | ✅ pass |
| ROLEDEF-UPDATE-10 | Update role defaults - VIEWER denied (403) | authorization | 403 | 403 | ✅ pass |

### `DELETE /notifications/templates/db0e562c-4f9f-44ec-bd22-23f5e95df778`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| TMPL-DELETE-01 | Delete template - happy path (soft delete) | happy_path | 200 | 200 | ✅ pass |

### `DELETE /notifications/templates/00000000-0000-4000-a000-ffffffffffff`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| TMPL-DELETE-02 | Delete template - not found returns 404 | edge_case | 404 | 404 | ✅ pass |

### `DELETE /notifications/templates/not-a-uuid`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| TMPL-DELETE-03 | Delete template - invalid UUID returns 400 | validation | 400 | 400 | ✅ pass |

### `DELETE /notifications/templates/d3545e4a-f3fc-4b99-b43b-48e8352d377e`

| ID | Test Name | Type | Expected | Actual | Status |
|-----|-----------|------|----------|--------|--------|
| TMPL-DELETE-04 | Delete template - STAFF denied (403) | authorization | 403 | 403 | ✅ pass |
| TMPL-DELETE-05 | Delete template - MANAGER denied (403) | authorization | 403 | 403 | ✅ pass |
| CLEANUP-01 | Cleanup - soft-delete test template | cleanup | 200 | 200 | ✅ pass |

## Skipped Tests

- **NOTIF-READ-01** — Mark as read - happy path (requires DELIVERED notification)
  - Reason: no DELIVERED notification found
- **NOTIF-DISMISS-01** — Dismiss notification - happy path
  - Reason: no DELIVERED/READ notification found

## Coverage Notes

- **RBAC coverage:** Tests cover SUPER_ADMIN, MANAGER, STAFF, VIEWER, and unauthenticated access
- **Template CRUD:** Full create/read/update/delete lifecycle tested with validation and authorization
- **Notification actions:** List, unread count, mark-read, mark-all-read, dismiss tested
- **Preferences:** User preferences CRUD, bulk update, reset, and role defaults tested
- **Validation:** Missing fields, invalid enums, invalid UUIDs, empty arrays all covered
- **Skipped tests** are due to no DELIVERED notifications existing for the staff user (no notification dispatch has occurred)
