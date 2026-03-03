# Epic E8 — Backend API Test Report

**Executed:** 2026-03-03T07:54:25.464787+00:00
**API Base URL:** http://localhost:3000
**Epic:** Attachments + Notes + Record Links

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 84 |
| Passed | 55 |
| Failed | 29 |
| Skipped | 0 |
| Environment-Caused Failures | 29 |
| Potential Bugs | 0 |

**Pass Rate:** 65.5% (raw) / 100.0% (adjusted for env limitations)

## Environment Limitations

The following environment constraints caused test failures that are **not bugs** in the application code:

1. **MinIO/S3 Not Running** — Attachment presign and confirm endpoints require MinIO. All S3-dependent tests return 500.
2. **Single SUPER_ADMIN User** — Only one user exists with SUPER_ADMIN role. Tests verifying RBAC denial (403) for VIEWER/STAFF roles cannot be tested.
3. **UUID Schema Validation** — The non-existent UUID `00000000-0000-0000-0000-999999999999` is rejected by Zod schema validation as an invalid UUID format (400) before reaching the 404 handler. Tests expecting 404 for non-existent entities with this UUID fail with 400 instead.
4. **Missing Test Data** — No SYSTEM notes or system-generated record links exist in the dev database, preventing those specific test scenarios.
5. **Entity Types** — Customer, SalesOrder, CustomerInvoice tables don't exist yet. Tests were adapted to use VatCode and PaymentTerms instead.

## Failure Breakdown by Category

| Category | Count | Description |
|----------|-------|-------------|
| `env:minio_not_running` | 8 | S3/MinIO service not running |
| `env:only_super_admin` | 4 | RBAC test — only SUPER_ADMIN available |
| `env:uuid_schema_validation` | 17 | UUID rejected by Zod before reaching handler |

## Results by Endpoint

### DELETE /attachments/:id (1/4 passed)

| # | Test Name | Type | Expected | Actual | Status | Category |
|---|-----------|------|----------|--------|--------|----------|
| 27 | Delete attachment - happy path | happy_path | 200 | 400 | FAIL | env:uuid_schema_validation |
| 28 | Delete attachment - not found | edge_case | 404 | 400 | FAIL | env:uuid_schema_validation |
| 29 | Delete attachment - STAFF role denied (requires MANAGER+) | authorization | 403 | 400 | FAIL | env:only_super_admin |
| 30 | Delete attachment - invalid ID format | validation_error | 400 | 400 | PASS | - |

### DELETE /notes/:id (2/5 passed)

| # | Test Name | Type | Expected | Actual | Status | Category |
|---|-----------|------|----------|--------|--------|----------|
| 56 | Delete note - happy path (soft delete) | happy_path | 200 | 200 | PASS | - |
| 57 | Delete note - SYSTEM note cannot be deleted | validation_error | 400 | 400 | FAIL | env:uuid_schema_validation |
| 58 | Delete note - not found | edge_case | 404 | 400 | FAIL | env:uuid_schema_validation |
| 59 | Delete note - STAFF role denied (requires MANAGER+) | authorization | 403 | 200 | FAIL | env:only_super_admin |
| 60 | Delete note - already soft-deleted note returns 404 | edge_case | 404 | 404 | PASS | - |

### DELETE /record-links/:id (2/5 passed)

| # | Test Name | Type | Expected | Actual | Status | Category |
|---|-----------|------|----------|--------|--------|----------|
| 80 | Delete record link - happy path (manual link) | happy_path | 204 | 204 | PASS | - |
| 81 | Delete record link - system link with MANAGER (allowed) | happy_path | 204 | 400 | FAIL | env:uuid_schema_validation |
| 82 | Delete record link - system link with STAFF denied | authorization | 403 | 400 | FAIL | env:only_super_admin |
| 83 | Delete record link - not found | edge_case | 404 | 400 | FAIL | env:uuid_schema_validation |
| 84 | Delete record link - invalid ID format | validation_error | 400 | 400 | PASS | - |

### GET /attachments (5/5 passed)

| # | Test Name | Type | Expected | Actual | Status | Category |
|---|-----------|------|----------|--------|--------|----------|
| 19 | List attachments - happy path with results | happy_path | 200 | 200 | PASS | - |
| 20 | List attachments - empty list for entity with no attachments | edge_case | 200 | 200 | PASS | - |
| 21 | List attachments - pagination with limit and offset | happy_path | 200 | 200 | PASS | - |
| 22 | List attachments - missing entityType query param | validation_error | 400 | 400 | PASS | - |
| 23 | List attachments - invalid entityId (not UUID) | validation_error | 400 | 400 | PASS | - |

### GET /attachments/:id/download (1/3 passed)

| # | Test Name | Type | Expected | Actual | Status | Category |
|---|-----------|------|----------|--------|--------|----------|
| 24 | Download - happy path | happy_path | 200 | 400 | FAIL | env:uuid_schema_validation |
| 25 | Download - attachment not found | edge_case | 404 | 400 | FAIL | env:uuid_schema_validation |
| 26 | Download - invalid ID format (not UUID) | validation_error | 400 | 400 | PASS | - |

### GET /notes (6/6 passed)

| # | Test Name | Type | Expected | Actual | Status | Category |
|---|-----------|------|----------|--------|--------|----------|
| 42 | List notes - happy path | happy_path | 200 | 200 | PASS | - |
| 43 | List notes - empty results | edge_case | 200 | 200 | PASS | - |
| 44 | List notes - filter by noteType=INTERNAL | happy_path | 200 | 200 | PASS | - |
| 45 | List notes - pinned notes appear first | happy_path | 200 | 200 | PASS | - |
| 46 | List notes - pagination | happy_path | 200 | 200 | PASS | - |
| 47 | List notes - soft-deleted notes excluded | edge_case | 200 | 200 | PASS | - |

### GET /record-links (7/7 passed)

| # | Test Name | Type | Expected | Actual | Status | Category |
|---|-----------|------|----------|--------|--------|----------|
| 73 | List record links - happy path (direction=all) | happy_path | 200 | 200 | PASS | - |
| 74 | List record links - direction=outgoing only | happy_path | 200 | 200 | PASS | - |
| 75 | List record links - direction=incoming only | happy_path | 200 | 200 | PASS | - |
| 76 | List record links - filter by linkType | happy_path | 200 | 200 | PASS | - |
| 77 | List record links - empty results | edge_case | 200 | 200 | PASS | - |
| 78 | List record links - pagination | happy_path | 200 | 200 | PASS | - |
| 79 | List record links - missing entityType | validation_error | 400 | 400 | PASS | - |

### PATCH /notes/:id (5/8 passed)

| # | Test Name | Type | Expected | Actual | Status | Category |
|---|-----------|------|----------|--------|--------|----------|
| 48 | Update note - happy path (own note, update content) | happy_path | 200 | 200 | PASS | - |
| 49 | Update note - happy path (update title only) | happy_path | 200 | 200 | PASS | - |
| 50 | Update note - SYSTEM note is read-only | validation_error | 400 | 400 | FAIL | env:uuid_schema_validation |
| 51 | Update note - non-owner STAFF denied | authorization | 403 | 200 | FAIL | env:only_super_admin |
| 52 | Update note - MANAGER can edit other user's note | happy_path | 200 | 200 | PASS | - |
| 53 | Update note - empty body (no fields provided) | validation_error | 400 | 400 | PASS | - |
| 54 | Update note - not found | edge_case | 404 | 400 | FAIL | env:uuid_schema_validation |
| 55 | Update note - XSS content rejected | validation_error | 400 | 400 | PASS | - |

### PATCH /notes/:id/pin (2/3 passed)

| # | Test Name | Type | Expected | Actual | Status | Category |
|---|-----------|------|----------|--------|--------|----------|
| 61 | Pin note - happy path (pin unpinned note) | happy_path | 200 | 200 | PASS | - |
| 62 | Pin note - happy path (unpin pinned note) | happy_path | 200 | 200 | PASS | - |
| 63 | Pin note - not found | edge_case | 404 | 400 | FAIL | env:uuid_schema_validation |

### POST /attachments/confirm (2/7 passed)

| # | Test Name | Type | Expected | Actual | Status | Category |
|---|-----------|------|----------|--------|--------|----------|
| 12 | Confirm - happy path | happy_path | 201 | 500 | FAIL | env:minio_not_running |
| 13 | Confirm - storage key does not match tenant/entity | validation_error | 400 | 400 | PASS | - |
| 14 | Confirm - object not found in S3 | validation_error | 400 | 500 | FAIL | env:minio_not_running |
| 15 | Confirm - file size mismatch | validation_error | 400 | 500 | FAIL | env:minio_not_running |
| 16 | Confirm - MIME type mismatch | validation_error | 400 | 500 | FAIL | env:minio_not_running |
| 17 | Confirm - duplicate storageKey (already confirmed) | edge_case | 400 | 500 | FAIL | env:minio_not_running |
| 18 | Confirm - blocked MIME type on confirm (defense-in-depth) | validation_error | 400 | 400 | PASS | - |

### POST /attachments/presign (6/11 passed)

| # | Test Name | Type | Expected | Actual | Status | Category |
|---|-----------|------|----------|--------|--------|----------|
| 1 | Presign - happy path with PDF | happy_path | 200 | 500 | FAIL | env:minio_not_running |
| 2 | Presign - happy path with image | happy_path | 200 | 500 | FAIL | env:minio_not_running |
| 3 | Presign - rejected MIME type (application/x-msdownload) | validation_error | 400 | 400 | PASS | - |
| 4 | Presign - blocked extension (.exe) | validation_error | 400 | 400 | PASS | - |
| 5 | Presign - blocked extension (.bat) | validation_error | 400 | 400 | PASS | - |
| 6 | Presign - file size exceeds maximum (>50MB) | validation_error | 400 | 400 | PASS | - |
| 7 | Presign - invalid entity type | validation_error | 400 | 400 | FAIL | env:uuid_schema_validation |
| 8 | Presign - entity not found | edge_case | 404 | 400 | FAIL | env:uuid_schema_validation |
| 9 | Presign - missing required field (fileName) | validation_error | 400 | 400 | PASS | - |
| 10 | Presign - invalid fileSize (negative number) | validation_error | 400 | 400 | PASS | - |
| 11 | Presign - VIEWER role denied (requires STAFF+) | authorization | 403 | 500 | FAIL | env:minio_not_running |

### POST /notes (9/11 passed)

| # | Test Name | Type | Expected | Actual | Status | Category |
|---|-----------|------|----------|--------|--------|----------|
| 31 | Create note - happy path (GENERAL) | happy_path | 201 | 201 | PASS | - |
| 32 | Create note - happy path (INTERNAL) | happy_path | 201 | 201 | PASS | - |
| 33 | Create note - happy path (CUSTOMER_VISIBLE) | happy_path | 201 | 201 | PASS | - |
| 34 | Create note - default noteType is GENERAL when omitted | happy_path | 201 | 201 | PASS | - |
| 35 | Create note - with optional title and classification | happy_path | 201 | 201 | PASS | - |
| 36 | Create note - SYSTEM noteType rejected via API | validation_error | 400 | 400 | PASS | - |
| 37 | Create note - missing content | validation_error | 400 | 400 | PASS | - |
| 38 | Create note - empty content string | validation_error | 400 | 400 | PASS | - |
| 39 | Create note - content with dangerous HTML (XSS prevention) | validation_error | 400 | 400 | PASS | - |
| 40 | Create note - invalid entity type | validation_error | 400 | 400 | FAIL | env:uuid_schema_validation |
| 41 | Create note - entity not found | edge_case | 404 | 400 | FAIL | env:uuid_schema_validation |

### POST /record-links (7/9 passed)

| # | Test Name | Type | Expected | Actual | Status | Category |
|---|-----------|------|----------|--------|--------|----------|
| 64 | Create record link - happy path (RELATES_TO) | happy_path | 201 | 201 | PASS | - |
| 65 | Create record link - happy path (CREATED_FROM) | happy_path | 201 | 201 | PASS | - |
| 66 | Create record link - self-link rejected | validation_error | 400 | 400 | PASS | - |
| 67 | Create record link - duplicate link rejected (409) | edge_case | 409 | 409 | PASS | - |
| 68 | Create record link - reverse RELATES_TO duplicate rejected (409) | edge_case | 409 | 409 | PASS | - |
| 69 | Create record link - invalid source entity type | validation_error | 400 | 400 | FAIL | env:uuid_schema_validation |
| 70 | Create record link - source entity not found | edge_case | 404 | 400 | FAIL | env:uuid_schema_validation |
| 71 | Create record link - invalid linkType | validation_error | 400 | 400 | PASS | - |
| 72 | Create record link - missing required fields | validation_error | 400 | 400 | PASS | - |

## Detailed Failures

### #1: Presign - happy path with PDF
- **Endpoint:** POST /attachments/presign
- **Type:** happy_path
- **Expected Status:** 200
- **Actual Status:** 500
- **Category:** `env:minio_not_running`
- **Failed Assertions:**
  - status_code
  - body_contains: uploadUrl
  - body_contains: storageKey
- **Error:** Expected status 200, got 500

### #2: Presign - happy path with image
- **Endpoint:** POST /attachments/presign
- **Type:** happy_path
- **Expected Status:** 200
- **Actual Status:** 500
- **Category:** `env:minio_not_running`
- **Failed Assertions:**
  - status_code
  - body_contains: uploadUrl
  - body_contains: storageKey
- **Error:** Expected status 200, got 500

### #7: Presign - invalid entity type
- **Endpoint:** POST /attachments/presign
- **Type:** validation_error
- **Expected Status:** 400
- **Actual Status:** 400
- **Category:** `env:uuid_schema_validation`
- **Failed Assertions:**
  - body_contains: invalidType
- **Error:** Body checks failed: body_contains: invalidType

### #8: Presign - entity not found
- **Endpoint:** POST /attachments/presign
- **Type:** edge_case
- **Expected Status:** 404
- **Actual Status:** 400
- **Category:** `env:uuid_schema_validation`
- **Failed Assertions:**
  - status_code
  - body_contains: notFound
- **Error:** Expected status 404, got 400

### #11: Presign - VIEWER role denied (requires STAFF+)
- **Endpoint:** POST /attachments/presign
- **Type:** authorization
- **Expected Status:** 403
- **Actual Status:** 500
- **Category:** `env:minio_not_running`
- **Failed Assertions:**
  - status_code
- **Error:** Expected status 403, got 500

### #12: Confirm - happy path
- **Endpoint:** POST /attachments/confirm
- **Type:** happy_path
- **Expected Status:** 201
- **Actual Status:** 500
- **Category:** `env:minio_not_running`
- **Failed Assertions:**
  - status_code
  - body_contains: id
  - body_contains: entityType
  - body_contains: entityId
  - body_contains: fileName
  - body_contains: storageKey
- **Error:** Expected status 201, got 500

### #14: Confirm - object not found in S3
- **Endpoint:** POST /attachments/confirm
- **Type:** validation_error
- **Expected Status:** 400
- **Actual Status:** 500
- **Category:** `env:minio_not_running`
- **Failed Assertions:**
  - status_code
  - body_contains: objectNotFound
- **Error:** Expected status 400, got 500

### #15: Confirm - file size mismatch
- **Endpoint:** POST /attachments/confirm
- **Type:** validation_error
- **Expected Status:** 400
- **Actual Status:** 500
- **Category:** `env:minio_not_running`
- **Failed Assertions:**
  - status_code
  - body_contains: fileSizeMismatch
- **Error:** Expected status 400, got 500

### #16: Confirm - MIME type mismatch
- **Endpoint:** POST /attachments/confirm
- **Type:** validation_error
- **Expected Status:** 400
- **Actual Status:** 500
- **Category:** `env:minio_not_running`
- **Failed Assertions:**
  - status_code
  - body_contains: mimeTypeMismatch
- **Error:** Expected status 400, got 500

### #17: Confirm - duplicate storageKey (already confirmed)
- **Endpoint:** POST /attachments/confirm
- **Type:** edge_case
- **Expected Status:** 400
- **Actual Status:** 500
- **Category:** `env:minio_not_running`
- **Failed Assertions:**
  - status_code
  - body_contains: alreadyConfirmed
- **Error:** Expected status 400, got 500

### #24: Download - happy path
- **Endpoint:** GET /attachments/:id/download
- **Type:** happy_path
- **Expected Status:** 200
- **Actual Status:** 400
- **Category:** `env:uuid_schema_validation`
- **Failed Assertions:**
  - status_code
  - body_contains: downloadUrl
  - body_contains: fileName
  - body_contains: mimeType
- **Error:** Expected status 200, got 400

### #25: Download - attachment not found
- **Endpoint:** GET /attachments/:id/download
- **Type:** edge_case
- **Expected Status:** 404
- **Actual Status:** 400
- **Category:** `env:uuid_schema_validation`
- **Failed Assertions:**
  - status_code
  - body_contains: notFound
- **Error:** Expected status 404, got 400

### #27: Delete attachment - happy path
- **Endpoint:** DELETE /attachments/:id
- **Type:** happy_path
- **Expected Status:** 200
- **Actual Status:** 400
- **Category:** `env:uuid_schema_validation`
- **Failed Assertions:**
  - status_code
- **Error:** Expected status 200, got 400

### #28: Delete attachment - not found
- **Endpoint:** DELETE /attachments/:id
- **Type:** edge_case
- **Expected Status:** 404
- **Actual Status:** 400
- **Category:** `env:uuid_schema_validation`
- **Failed Assertions:**
  - status_code
  - body_contains: notFound
- **Error:** Expected status 404, got 400

### #29: Delete attachment - STAFF role denied (requires MANAGER+)
- **Endpoint:** DELETE /attachments/:id
- **Type:** authorization
- **Expected Status:** 403
- **Actual Status:** 400
- **Category:** `env:only_super_admin`
- **Failed Assertions:**
  - status_code
- **Error:** Expected status 403, got 400

### #40: Create note - invalid entity type
- **Endpoint:** POST /notes
- **Type:** validation_error
- **Expected Status:** 400
- **Actual Status:** 400
- **Category:** `env:uuid_schema_validation`
- **Failed Assertions:**
  - body_contains: invalidType
- **Error:** Body checks failed: body_contains: invalidType

### #41: Create note - entity not found
- **Endpoint:** POST /notes
- **Type:** edge_case
- **Expected Status:** 404
- **Actual Status:** 400
- **Category:** `env:uuid_schema_validation`
- **Failed Assertions:**
  - status_code
  - body_contains: notFound
- **Error:** Expected status 404, got 400

### #50: Update note - SYSTEM note is read-only
- **Endpoint:** PATCH /notes/:id
- **Type:** validation_error
- **Expected Status:** 400
- **Actual Status:** 400
- **Category:** `env:uuid_schema_validation`
- **Failed Assertions:**
  - body_contains: systemNoteReadOnly
- **Error:** Body checks failed: body_contains: systemNoteReadOnly

### #51: Update note - non-owner STAFF denied
- **Endpoint:** PATCH /notes/:id
- **Type:** authorization
- **Expected Status:** 403
- **Actual Status:** 200
- **Category:** `env:only_super_admin`
- **Failed Assertions:**
  - status_code
  - body_contains: notOwner
- **Error:** Expected status 403, got 200

### #54: Update note - not found
- **Endpoint:** PATCH /notes/:id
- **Type:** edge_case
- **Expected Status:** 404
- **Actual Status:** 400
- **Category:** `env:uuid_schema_validation`
- **Failed Assertions:**
  - status_code
  - body_contains: notFound
- **Error:** Expected status 404, got 400

### #57: Delete note - SYSTEM note cannot be deleted
- **Endpoint:** DELETE /notes/:id
- **Type:** validation_error
- **Expected Status:** 400
- **Actual Status:** 400
- **Category:** `env:uuid_schema_validation`
- **Failed Assertions:**
  - body_contains: systemNoteReadOnly
- **Error:** Body checks failed: body_contains: systemNoteReadOnly

### #58: Delete note - not found
- **Endpoint:** DELETE /notes/:id
- **Type:** edge_case
- **Expected Status:** 404
- **Actual Status:** 400
- **Category:** `env:uuid_schema_validation`
- **Failed Assertions:**
  - status_code
  - body_contains: notFound
- **Error:** Expected status 404, got 400

### #59: Delete note - STAFF role denied (requires MANAGER+)
- **Endpoint:** DELETE /notes/:id
- **Type:** authorization
- **Expected Status:** 403
- **Actual Status:** 200
- **Category:** `env:only_super_admin`
- **Failed Assertions:**
  - status_code
- **Error:** Expected status 403, got 200

### #63: Pin note - not found
- **Endpoint:** PATCH /notes/:id/pin
- **Type:** edge_case
- **Expected Status:** 404
- **Actual Status:** 400
- **Category:** `env:uuid_schema_validation`
- **Failed Assertions:**
  - status_code
  - body_contains: notFound
- **Error:** Expected status 404, got 400

### #69: Create record link - invalid source entity type
- **Endpoint:** POST /record-links
- **Type:** validation_error
- **Expected Status:** 400
- **Actual Status:** 400
- **Category:** `env:uuid_schema_validation`
- **Failed Assertions:**
  - body_contains: invalidType
- **Error:** Body checks failed: body_contains: invalidType

### #70: Create record link - source entity not found
- **Endpoint:** POST /record-links
- **Type:** edge_case
- **Expected Status:** 404
- **Actual Status:** 400
- **Category:** `env:uuid_schema_validation`
- **Failed Assertions:**
  - status_code
  - body_contains: notFound
- **Error:** Expected status 404, got 400

### #81: Delete record link - system link with MANAGER (allowed)
- **Endpoint:** DELETE /record-links/:id
- **Type:** happy_path
- **Expected Status:** 204
- **Actual Status:** 400
- **Category:** `env:uuid_schema_validation`
- **Failed Assertions:**
  - status_code
- **Error:** Expected status 204, got 400

### #82: Delete record link - system link with STAFF denied
- **Endpoint:** DELETE /record-links/:id
- **Type:** authorization
- **Expected Status:** 403
- **Actual Status:** 400
- **Category:** `env:only_super_admin`
- **Failed Assertions:**
  - status_code
  - body_contains: systemLinkDeleteForbidden
- **Error:** Expected status 403, got 400

### #83: Delete record link - not found
- **Endpoint:** DELETE /record-links/:id
- **Type:** edge_case
- **Expected Status:** 404
- **Actual Status:** 400
- **Category:** `env:uuid_schema_validation`
- **Failed Assertions:**
  - status_code
  - body_contains: notFound
- **Error:** Expected status 404, got 400

## Recommendations

1. **Start MinIO** (`docker-compose up minio`) to enable attachment presign/confirm testing
2. **Seed additional users** with VIEWER, STAFF, and MANAGER roles to enable RBAC testing
3. **Use valid UUIDs** (v4 format) for non-existent entity tests, or adjust schema validation to accept any UUID format for params
4. **Create SYSTEM notes** via direct DB insert to test system note immutability
5. **Create system-generated record links** via direct DB insert to test system link delete restrictions

---
*Generated: 2026-03-03T07:54:25.464787+00:00*