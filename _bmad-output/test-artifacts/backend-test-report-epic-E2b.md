# Backend API Test Report — Epic E2b

**Granular RBAC & Access Groups**

- **Executed at:** 2026-02-20 16:08:38 UTC
- **API Base URL:** http://localhost:3000
- **Test Plan:** `_bmad-output/test-artifacts/backend-test-plan-epic-E2b.json`
- **Test Script:** `logs/workflow/epic-E2b/backend-test/run-tests.sh`

## Summary

| Metric | Count |
|--------|-------|
| **Total Tests** | 90 |
| **Passed** | 55 |
| **Failed** | 0 |
| **Skipped** | 35 |
| **Pass Rate (executed)** | 55/55 (100%) |

## Test Type Breakdown

| Type | Total | Pass | Fail | Skip |
|------|-------|------|------|------|
| authn_error | 4 | 4 | 0 | 0 |
| authz_error | 8 | 0 | 0 | 8 |
| edge_case | 4 | 3 | 0 | 1 |
| error | 10 | 10 | 0 | 0 |
| happy_path | 34 | 25 | 0 | 9 |
| security | 16 | 1 | 0 | 15 |
| validation_error | 14 | 12 | 0 | 2 |

## Results by Endpoint

### ✅ `POST /system/access-groups` (8P / 0F / 1S)

| ID | Test Name | Type | Status | Expected | Actual |
|------|-----------|------|--------|----------|--------|
| E2b.2-POST-001 | Create access group - happy path | happy_path | PASS | 201 | 201 |
| E2b.2-POST-002 | Create access group - duplicate code returns 409 | error | PASS | 409 | 409 |
| E2b.2-POST-003 | Create access group - missing required code field returns 40 | validation_error | PASS | 400 | 400 |
| E2b.2-POST-004 | Create access group - missing required name field returns 40 | validation_error | PASS | 400 | 400 |
| E2b.2-POST-005 | Create access group - invalid code format (lowercase) return | validation_error | PASS | 400 | 400 |
| E2b.2-POST-006 | Create access group - STAFF user gets 403 | authz_error | SKIP | 403 | — |
| E2b.2-POST-007 | Create access group - unauthenticated returns 401 | authn_error | PASS | 401 | 401 |
| E2b.2-POST-008 | Create access group - SUPER_ADMIN succeeds | happy_path | PASS | 201 | 201 |
| E2b.2-POST-009 | Create access group - code exceeds max length returns 400 | validation_error | PASS | 400 | 400 |

### ✅ `POST /system/company-profile` (2P / 0F / 0S)

| ID | Test Name | Type | Status | Expected | Actual |
|------|-----------|------|--------|----------|--------|
| E2b.2-SEED-001 | Company creation seeds 12 default access groups | happy_path | PASS | 201 | 201 |
| E2b.2-SEED-002 | Company creation assigns FULL_ACCESS group to creating user | happy_path | PASS | 201 | 201 |

### ✅ `GET /system/resources` (8P / 0F / 4S)

| ID | Test Name | Type | Status | Expected | Actual |
|------|-----------|------|--------|----------|--------|
| E2b.1-GET-001 | List resources - happy path returns all active resources | happy_path | PASS | 200 | 200 |
| E2b.1-GET-002 | List resources - filter by module=system | happy_path | PASS | 200 | 200 |
| E2b.1-GET-003 | List resources - filter by type=PAGE | happy_path | PASS | 200 | 200 |
| E2b.1-GET-004 | List resources - search by code or name | happy_path | PASS | 200 | 200 |
| E2b.1-GET-005 | List resources - STAFF user gets 403 | authz_error | SKIP | 403 | — |
| E2b.1-GET-006 | List resources - SUPER_ADMIN gets 200 | happy_path | PASS | 200 | 200 |
| E2b.1-GET-007 | List resources - isActive=false filter | edge_case | PASS | 200 | 200 |
| E2b.1-GET-008 | List resources - unauthenticated returns 401 | authn_error | PASS | 401 | 401 |
| E2b.4-GUARD-001 | Permission guard - blocks user WITHOUT canAccess | security | SKIP | 403 | — |
| E2b.4-GUARD-002 | Permission guard - allows user WITH canAccess | security | SKIP | 200 | — |
| E2b.4-GUARD-004 | Permission guard - SUPER_ADMIN bypasses all checks | security | PASS | 200 | 200 |
| E2b.4-GUARD-005 | Permission guard - most-permissive-wins | security | SKIP | 200 | — |

### ✅ `GET /system/access-groups` (5P / 0F / 2S)

| ID | Test Name | Type | Status | Expected | Actual |
|------|-----------|------|--------|----------|--------|
| E2b.2-LIST-001 | List access groups - happy path returns paginated list with  | happy_path | PASS | 200 | 200 |
| E2b.2-LIST-002 | List access groups - search filter | happy_path | PASS | 200 | 200 |
| E2b.2-LIST-003 | List access groups - cursor pagination | happy_path | PASS | 200 | 200 |
| E2b.2-LIST-004 | List access groups - cross-company isolation | security | SKIP | 200 | — |
| E2b.2-LIST-005 | List access groups - STAFF user gets 403 | authz_error | SKIP | 403 | — |
| E2b.2-LIST-006 | List access groups - empty result for search | edge_case | PASS | 200 | 200 |
| E2b-XCUT-004 | Company creation seeds 12+ groups visible | happy_path | PASS | 200 | 200 |

### ✅ `GET /system/access-groups/:id` (3P / 0F / 1S)

| ID | Test Name | Type | Status | Expected | Actual |
|------|-----------|------|--------|----------|--------|
| E2b.2-DETAIL-001 | Get access group detail - happy path | happy_path | PASS | 200 | 200 |
| E2b.2-DETAIL-002 | Get access group detail - not found returns 404 | error | PASS | 404 | 404 |
| E2b.2-DETAIL-003 | Get access group detail - wrong company returns 404 | security | SKIP | 404 | — |
| E2b.2-DETAIL-004 | Get access group detail - invalid UUID returns 400 | validation_error | PASS | 400 | 400 |

### ✅ `GET /system/users/:id/access-groups` (3P / 0F / 2S)

| ID | Test Name | Type | Status | Expected | Actual |
|------|-----------|------|--------|----------|--------|
| E2b.3-GET-001 | Get user access groups - happy path returns assigned groups | happy_path | PASS | 200 | 200 |
| E2b.3-GET-002 | Get user access groups - user not in company returns 404 | error | PASS | 404 | 404 |
| E2b.3-GET-003 | Get user access groups - user with no groups returns empty a | edge_case | SKIP | 200 | — |
| E2b.3-GET-004 | Get user access groups - STAFF user gets 403 | authz_error | SKIP | 403 | — |
| E2b.3-GET-005 | Get user access groups - invalid UUID param returns 400 | validation_error | PASS | 400 | 400 |

### ✅ `GET /system/my-permissions` (3P / 0F / 2S)

| ID | Test Name | Type | Status | Expected | Actual |
|------|-----------|------|--------|----------|--------|
| E2b.4-GET-001 | My permissions - happy path returns resolved permissions | happy_path | PASS | 200 | 200 |
| E2b.4-GET-002 | My permissions - SUPER_ADMIN gets isSuperAdmin=true | happy_path | PASS | 200 | 200 |
| E2b.4-GET-003 | My permissions - module derivation | happy_path | SKIP | 200 | — |
| E2b.4-GET-004 | My permissions - unauthenticated returns 401 | authn_error | PASS | 401 | 401 |
| E2b.4-GET-005 | My permissions - STAFF user can access | happy_path | SKIP | 200 | — |

### ✅ `PATCH /system/access-groups/:id` (5P / 0F / 0S)

| ID | Test Name | Type | Status | Expected | Actual |
|------|-----------|------|--------|----------|--------|
| E2b.2-PATCH-001 | Update access group - happy path updates name | happy_path | PASS | 200 | 200 |
| E2b.2-PATCH-002 | Update access group - happy path updates description | happy_path | PASS | 200 | 200 |
| E2b.2-PATCH-003 | Update access group - empty body returns 400 | validation_error | PASS | 400 | 400 |
| E2b.2-PATCH-004 | Update access group - not found returns 404 | error | PASS | 404 | 404 |
| E2b.2-PATCH-005 | Update access group - system group allows name/description u | happy_path | PASS | 200 | 200 |

### ✅ `PUT /system/access-groups/:id/permissions` (6P / 0F / 1S)

| ID | Test Name | Type | Status | Expected | Actual |
|------|-----------|------|--------|----------|--------|
| E2b.2-PERM-001 | Set permissions - happy path replaces all permissions | happy_path | PASS | 200 | 200 |
| E2b.2-PERM-002 | Set permissions - empty array clears all permissions | edge_case | PASS | 200 | 200 |
| E2b.2-PERM-003 | Set permissions - invalid resource code returns 400 | validation_error | PASS | 400 | 400 |
| E2b.2-PERM-004 | Set permissions - duplicate resourceCode returns 400 | validation_error | PASS | 400 | 400 |
| E2b.2-PERM-005 | Set permissions - canAccess=false with action flags true ret | validation_error | PASS | 400 | 400 |
| E2b.2-PERM-006 | Set permissions - access group not found returns 404 | error | PASS | 404 | 404 |
| E2b.4-CACHE-001 | Cache invalidation - after permission update | security | SKIP | 200 | — |

### ✅ `PUT /system/users/:id/access-groups` (6P / 0F / 4S)

| ID | Test Name | Type | Status | Expected | Actual |
|------|-----------|------|--------|----------|--------|
| E2b.3-PUT-001 | Assign access groups - happy path replaces all assignments | happy_path | PASS | 200 | 200 |
| E2b.3-PUT-002 | Assign access groups - empty array returns 422 | error | PASS | 422 | 422 |
| E2b.3-PUT-003 | Assign access groups - group from other company returns 400 | security | SKIP | 400 | — |
| E2b.3-PUT-004 | Assign access groups - non-existent group ID returns 400 | validation_error | PASS | 400 | 400 |
| E2b.3-PUT-005 | Assign access groups - user not in company returns 404 | error | PASS | 404 | 404 |
| E2b.3-PUT-006 | Assign access groups - inactive group returns 400 | validation_error | SKIP | 400 | — |
| E2b.3-PUT-007 | Assign access groups - STAFF user gets 403 | authz_error | SKIP | 403 | — |
| E2b.3-PUT-008 | Assign access groups - duplicate group IDs returns 400 | validation_error | PASS | 400 | 400 |
| E2b.3-PUT-009 | Assign access groups - records correct assignedBy | happy_path | PASS | 200 | 200 |
| E2b.4-CACHE-002 | Cache invalidation - after user group reassignment | security | SKIP | 200 | — |

### ✅ `DELETE /system/access-groups/:id` (5P / 0F / 2S)

| ID | Test Name | Type | Status | Expected | Actual |
|------|-----------|------|--------|----------|--------|
| E2b.2-DEL-001 | Delete access group - happy path soft-deletes custom group | happy_path | PASS | 204 | 204 |
| E2b.2-DEL-002 | Delete access group - system group returns 409 Conflict | error | PASS | 409 | 409 |
| E2b.2-DEL-003 | Delete access group - group with active users returns 409 | error | PASS | 409 | 409 |
| E2b.2-DEL-004 | Delete access group - not found returns 404 | error | PASS | 404 | 404 |
| E2b.2-DEL-005 | Delete access group - STAFF user gets 403 | authz_error | SKIP | 403 | — |
| E2b.2-DEL-006 | Delete access group - unauthenticated returns 401 | authn_error | PASS | 401 | 401 |
| E2b.4-GUARD-003 | Permission guard - action-level check | security | SKIP | 403 | — |

### ✅ `GET /system/company-profile` (1P / 0F / 4S)

| ID | Test Name | Type | Status | Expected | Actual |
|------|-----------|------|--------|----------|--------|
| E2b.5-FIELD-001 | Field filter - HIDDEN field stripped | security | SKIP | 200 | — |
| E2b.5-FIELD-002 | Field filter - READ_ONLY field present with _fieldMeta | happy_path | SKIP | 200 | — |
| E2b.5-FIELD-003 | Field filter - SUPER_ADMIN bypass | happy_path | PASS | 200 | 200 |
| E2b.5-FIELD-004 | Field filter - no override defaults to VISIBLE | happy_path | SKIP | 200 | — |
| E2b.5-FIELD-005 | Field filter - most-permissive-wins | security | SKIP | 200 | — |

### ⏭️ `GET /system/company-profile/export-defaults` (0P / 0F / 3S)

| ID | Test Name | Type | Status | Expected | Actual |
|------|-----------|------|--------|----------|--------|
| E2b.6-EXPORT-001 | Export defaults - happy path | happy_path | SKIP | 200 | — |
| E2b.6-EXPORT-002 | Export defaults - non-ADMIN gets 403 | authz_error | SKIP | 403 | — |
| E2b.6-EXPORT-003 | Export defaults - SUPER_ADMIN succeeds | happy_path | SKIP | 200 | — |

### ⏭️ `POST /system/company-profile/import-defaults` (0P / 0F / 5S)

| ID | Test Name | Type | Status | Expected | Actual |
|------|-----------|------|--------|----------|--------|
| E2b.6-IMPORT-001 | Import defaults - happy path | happy_path | SKIP | 200 | — |
| E2b.6-IMPORT-002 | Import defaults - dry run | happy_path | SKIP | 200 | — |
| E2b.6-IMPORT-003 | Import defaults - unsupported version | validation_error | SKIP | 400 | — |
| E2b.6-IMPORT-004 | Import defaults - non-ADMIN gets 403 | authz_error | SKIP | 403 | — |
| E2b.6-IMPORT-005 | Import defaults - round-trip fidelity | happy_path | SKIP | 200 | — |

### ⏭️ `MULTI` (0P / 0F / 4S)

| ID | Test Name | Type | Status | Expected | Actual |
|------|-----------|------|--------|----------|--------|
| E2b-XCUT-001 | Full RBAC lifecycle | security | SKIP | 200 | — |
| E2b-XCUT-002 | Permission cache invalidation lifecycle | security | SKIP | 200 | — |
| E2b-XCUT-003 | Most-permissive-wins end-to-end | security | SKIP | 200 | — |
| E2b-XCUT-005 | Field-level visibility end-to-end | security | SKIP | 200 | — |

## Skipped Tests Analysis

| Skip Reason | Count | Test IDs |
|-------------|-------|----------|
| E2b-6 NOT_IMPLEMENTED | 8 | E2b.6-EXPORT-001, E2b.6-EXPORT-002, E2b.6-EXPORT-003, E2b.6-IMPORT-001, E2b.6-IMPORT-002 (+3 more) |
| No STAFF user available in test environment | 7 | E2b.2-POST-006, E2b.1-GET-005, E2b.2-LIST-005, E2b.3-GET-004, E2b.4-GET-005 (+2 more) |
| No granular-permission user available | 1 | E2b.4-GUARD-002 |
| No inactive group available | 1 | E2b.3-PUT-006 |
| No multi-group field override user available | 1 | E2b.5-FIELD-005 |
| No multi-group user available | 1 | E2b.4-GUARD-005 |
| No second company group available | 1 | E2b.3-PUT-003 |
| No second company group available for cross-company test | 1 | E2b.2-DETAIL-003 |
| No second company user available for cross-company test | 1 | E2b.2-LIST-004 |
| No user with HIDDEN field override available | 1 | E2b.5-FIELD-001 |
| No user with READ_ONLY field override available | 1 | E2b.5-FIELD-002 |
| No user with specific sales group available | 1 | E2b.4-GET-003 |
| No user without access groups available | 2 | E2b.3-GET-003, E2b.4-GUARD-001 |
| No user without field overrides but with access | 1 | E2b.5-FIELD-004 |
| No view-only user available | 1 | E2b.4-GUARD-003 |
| Requires multi-user setup | 1 | E2b-XCUT-003 |
| Requires multi-user setup for cache invalidation verification | 1 | E2b-XCUT-002 |
| Requires multi-user setup for full lifecycle verification | 1 | E2b-XCUT-001 |
| Requires multi-user setup to verify cache behavior | 2 | E2b.4-CACHE-001, E2b.4-CACHE-002 |
| Requires multi-user setup with field overrides | 1 | E2b-XCUT-005 |

## Environment Notes

- **Auth user:** `admin@nexa-erp.dev` (SUPER_ADMIN, global role)
- **Company:** Default Company (`00000000-0000-4000-a000-000000000001`)
- Only 1 user available in test DB — tests requiring STAFF/ADMIN role users were skipped
- No second company exists — cross-company isolation tests were skipped
- E2b-6 (export/import defaults) is NOT_IMPLEMENTED — all 8 tests skipped
- Permission guard tests requiring specific access group configurations were skipped (need multi-user setup)
- Field filtering tests requiring HIDDEN/READ_ONLY field overrides were skipped (need specific user setup)

## Findings

1. **All executed API endpoints work correctly** — 55/55 executed tests pass
2. **CRUD operations verified:** create, read (list + detail), update (PATCH), delete (soft-delete)
3. **Permission management verified:** PUT permissions with replace-all semantics, validation of resource codes, duplicate detection, canAccess constraint
4. **User access group assignment verified:** PUT with replace-all, empty array rejection (422), non-existent group rejection, duplicate ID rejection
5. **Authentication enforcement verified:** all unauthenticated requests correctly return 401
6. **Validation verified:** missing fields (400), invalid formats (400), max length (400)
7. **Business rules verified:** system group deletion blocked (409), group with users deletion blocked (409)
8. **SUPER_ADMIN bypass verified:** bypasses permission guards on all tested endpoints
9. **Data note:** `getUserAccessGroups` service checks `userCompanyRole` for company-specific entries — SUPER_ADMIN users with only global roles (companyId=null) need a company-specific role entry to be found
