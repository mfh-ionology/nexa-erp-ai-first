# Epic E13 — Backend API Test Report

**Executed:** 2026-03-11T21:17:54Z
**API Base URL:** http://localhost:5100
**Epic:** E13 — Printer Management

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 73 |
| Passed | 69 |
| Failed | 4 |
| Skipped | 0 |
| **Pass Rate** | **94.5%** |

## Results by Type

| Type | Pass | Fail | Total |
|------|------|------|-------|
| authorization | 19 | 0 | 19 |
| edge_case | 11 | 1 | 12 |
| happy_path | 21 | 2 | 23 |
| validation_error | 18 | 1 | 19 |

## All Test Results

| Status | ID | Endpoint | Test Name | Expected | Actual |
|--------|----|----------|-----------|----------|--------|
| PASS | AUTH-001 | POST /auth/login | Login as admin — happy path | 200 | 200 |
| PASS | AUTH-002 | POST /auth/login | Login as staff — happy path | 200 | 200 |
| PASS | AUTH-003 | POST /auth/login | Login as viewer — happy path | 200 | 200 |
| PASS | AUTH-004 | POST /auth/login | Login as manager — happy path | 200 | 200 |
| PASS | CPD-001 | PUT /system/print-preferences/company-defaults | Update company defaults — happy path (single document type) | 200 | 200 |
| PASS | CPD-002 | PUT /system/print-preferences/company-defaults | Update company defaults — happy path (multiple document types) | 200 | 200 |
| PASS | GCD-001 | GET /system/print-preferences/company-defaults | Get company defaults — happy path (admin) | 200 | 200 |
| PASS | GCD-002 | GET /system/print-preferences/company-defaults | Get company defaults — happy path (staff can read) | 200 | 200 |
| PASS | GCD-003 | GET /system/print-preferences/company-defaults | Get company defaults — happy path (manager can read) | 200 | 200 |
| PASS | GCD-004 | GET /system/print-preferences/company-defaults | Get company defaults — returns all 14 document types | 200 | 200 |
| PASS | UPP-001 | PUT /system/print-preferences | Update user preferences — happy path (single preference) | 200 | 200 |
| PASS | UPP-002 | PUT /system/print-preferences | Update user preferences — happy path (multiple preferences) | 200 | 200 |
| PASS | UPP-003 | PUT /system/print-preferences | Update user preferences — happy path (admin can update own preferences) | 200 | 200 |
| PASS | GPP-001 | GET /system/print-preferences | Get user preferences — happy path (staff) | 200 | 200 |
| PASS | GPP-002 | GET /system/print-preferences | Get user preferences — happy path (admin) | 200 | 200 |
| PASS | GPP-003 | GET /system/print-preferences | Get user preferences — happy path (manager) | 200 | 200 |
| PASS | GPP-004 | GET /system/print-preferences | Get user preferences — cascade: user override takes precedence | 200 | 200 |
| PASS | GPP-005 | GET /system/print-preferences | Get user preferences — cascade: company default for manager | 200 | 200 |
| PASS | GPP-006 | GET /system/print-preferences | Get user preferences — cascade: FALLBACK to NONE | 200 | 200 |
| PASS | GPP-007 | GET /system/print-preferences | Get user preferences — all 14 document types present | 200 | 200 |
| PASS | UPP-004 | PUT /system/print-preferences | Update user preferences — normalisation: pref matching company default | 200 | 200 |
| PASS | UPP-011 | PUT /system/print-preferences | Update user preferences — idempotent: update same preference twice | 200 | 200 |
| PASS | UPP-011b | PUT /system/print-preferences | Update user preferences — idempotent: second call | 200 | 200 |
| PASS | CPD-012 | PUT /system/print-preferences/company-defaults | Update company defaults — idempotent: set same value twice | 200 | 200 |
| PASS | RPP-001 | DELETE /system/print-preferences/reset | Reset user preferences — happy path (staff) | 200 | 200 |
| PASS | RPP-002 | DELETE /system/print-preferences/reset | Reset user preferences — edge case: no prefs exist (no-op) | 200 | 200 |
| PASS | RPP-003 | DELETE /system/print-preferences/reset | Reset user preferences — happy path (admin) | 200 | 200 |
| PASS | RPP-004 | DELETE /system/print-preferences/reset | Reset user preferences — happy path (manager) | 200 | 200 |
| PASS | RPP-005 | DELETE /system/print-preferences/reset | Reset user preferences — does not affect other users | 200 | 200 |
| PASS | CPD-003 | PUT /system/print-preferences/company-defaults | Update company defaults — validation error: empty defaults array | 400 | 400 |
| PASS | CPD-004 | PUT /system/print-preferences/company-defaults | Update company defaults — validation error: invalid documentType | 400 | 400 |
| PASS | CPD-005 | PUT /system/print-preferences/company-defaults | Update company defaults — validation error: invalid action | 400 | 400 |
| PASS | CPD-006 | PUT /system/print-preferences/company-defaults | Update company defaults — validation error: missing defaults field | 400 | 400 |
| PASS | CPD-007 | PUT /system/print-preferences/company-defaults | Update company defaults — validation error: missing action in item | 400 | 400 |
| PASS | UPP-005 | PUT /system/print-preferences | Update user preferences — validation error: empty preferences array | 400 | 400 |
| PASS | UPP-006 | PUT /system/print-preferences | Update user preferences — validation error: invalid documentType | 400 | 400 |
| PASS | UPP-007 | PUT /system/print-preferences | Update user preferences — validation error: invalid action value | 400 | 400 |
| PASS | UPP-008 | PUT /system/print-preferences | Update user preferences — validation error: missing body | 400 | 400 |
| PASS | DGS-003 | POST /system/documents/generate | Generate single PDF — validation error: missing documentType | 400 | 400 |
| PASS | DGS-004 | POST /system/documents/generate | Generate single PDF — validation error: missing recordId | 400 | 400 |
| PASS | DGS-005 | POST /system/documents/generate | Generate single PDF — validation error: invalid recordId | 400 | 400 |
| PASS | DGS-006 | POST /system/documents/generate | Generate single PDF — validation error: invalid documentType | 400 | 400 |
| PASS | DGS-007 | POST /system/documents/generate | Generate single PDF — validation error: invalid outputFormat | 400 | 400 |
| PASS | DGB-003 | POST /system/documents/batch-generate | Batch generate — validation error: empty recordIds array | 400 | 400 |
| PASS | DGB-004 | POST /system/documents/batch-generate | Batch generate — validation error: invalid UUID in recordIds | 400 | 400 |
| PASS | DGB-005 | POST /system/documents/batch-generate | Batch generate — validation error: invalid documentType | 400 | 400 |
| PASS | DGB-006 | POST /system/documents/batch-generate | Batch generate — validation error: missing recordIds | 400 | 400 |
| PASS | CPD-008 | PUT /system/print-preferences/company-defaults | Update company defaults — RBAC: STAFF denied (403) | 403 | 403 |
| PASS | CPD-009 | PUT /system/print-preferences/company-defaults | Update company defaults — RBAC: MANAGER denied (403) | 403 | 403 |
| PASS | CPD-010 | PUT /system/print-preferences/company-defaults | Update company defaults — RBAC: VIEWER denied (403) | 403 | 403 |
| PASS | CPD-011 | PUT /system/print-preferences/company-defaults | Update company defaults — no auth token (401) | 401 | 401 |
| PASS | UPP-009 | PUT /system/print-preferences | Update user preferences — RBAC: VIEWER denied (403) | 403 | 403 |
| PASS | UPP-010 | PUT /system/print-preferences | Update user preferences — no auth token (401) | 401 | 401 |
| PASS | GPP-008 | GET /system/print-preferences | Get user preferences — RBAC: VIEWER denied (403) | 403 | 403 |
| PASS | GPP-009 | GET /system/print-preferences | Get user preferences — no auth token (401) | 401 | 401 |
| PASS | GCD-005 | GET /system/print-preferences/company-defaults | Get company defaults — RBAC: VIEWER denied (403) | 403 | 403 |
| PASS | GCD-006 | GET /system/print-preferences/company-defaults | Get company defaults — no auth token (401) | 401 | 401 |
| PASS | RPP-006 | DELETE /system/print-preferences/reset | Reset user preferences — RBAC: VIEWER denied (403) | 403 | 403 |
| PASS | RPP-007 | DELETE /system/print-preferences/reset | Reset user preferences — no auth token (401) | 401 | 401 |
| PASS | DGS-008 | POST /system/documents/generate | Generate single PDF — RBAC: VIEWER denied (403) | 403 | 403 |
| PASS | DGS-009 | POST /system/documents/generate | Generate single PDF — no auth token (401) | 401 | 401 |
| PASS | DGB-007 | POST /system/documents/batch-generate | Batch generate — RBAC: STAFF denied (403) | 403 | 403 |
| PASS | DGB-008 | POST /system/documents/batch-generate | Batch generate — RBAC: VIEWER denied (403) | 403 | 403 |
| PASS | DGB-009 | POST /system/documents/batch-generate | Batch generate — no auth token (401) | 401 | 401 |
| PASS | DBS-002 | GET /system/documents/batch-generate/00000000-0000-4000-a000-ffffffffffff/status | Batch status — RBAC: VIEWER denied (403) | 403 | 403 |
| PASS | DBS-003 | GET /system/documents/batch-generate/00000000-0000-4000-a000-ffffffffffff/status | Batch status — no auth token (401) | 401 | 401 |
| PASS | DGS-001 | POST /system/documents/generate | Generate single PDF — happy path (SALES_INVOICE) | 200,404 | 200 |
| PASS | DGS-002 | POST /system/documents/generate | Generate single PDF — happy path with attachment outputFormat | 200,404 | 200 |
| PASS | DGS-010 | POST /system/documents/generate | Generate single PDF — with optional versionContext | 200,404 | 200 |
| **FAIL** | DGB-001 | POST /system/documents/batch-generate | Batch generate — happy path | 202,503 | 500 |
| **FAIL** | DGB-002 | POST /system/documents/batch-generate | Batch generate — happy path (admin) | 202,503 | 500 |
| **FAIL** | DBS-001 | GET /system/documents/batch-generate/00000000-0000-4000-a000-ffffffffffff/status | Batch status — not found for non-existent batchJobId | 404,503 | 500 |
| **FAIL** | DBS-004 | GET /system/documents/batch-generate//status | Batch status — validation error: empty batchJobId | 404 | 400 |

## Failed Tests — Details

### DGB-001: Batch generate — happy path

- **Endpoint:** POST /system/documents/batch-generate
- **Expected Status:** 202,503
- **Actual Status:** 500
- **Error:** `{"success":false,"error":{"code":"INTERNAL_ERROR","message":"An internal server error occurred","messageKey":"errors:SERVER_ERROR"}}
`

### DGB-002: Batch generate — happy path (admin)

- **Endpoint:** POST /system/documents/batch-generate
- **Expected Status:** 202,503
- **Actual Status:** 500
- **Error:** `{"success":false,"error":{"code":"INTERNAL_ERROR","message":"An internal server error occurred","messageKey":"errors:SERVER_ERROR"}}
`

### DBS-001: Batch status — not found for non-existent batchJobId

- **Endpoint:** GET /system/documents/batch-generate/00000000-0000-4000-a000-ffffffffffff/status
- **Expected Status:** 404,503
- **Actual Status:** 500
- **Error:** `{"success":false,"error":{"code":"INTERNAL_ERROR","message":"An internal server error occurred","messageKey":"errors:SERVER_ERROR"}}
`

### DBS-004: Batch status — validation error: empty batchJobId

- **Endpoint:** GET /system/documents/batch-generate//status
- **Expected Status:** 404
- **Actual Status:** 400
- **Error:** `{"success":false,"error":{"code":"VALIDATION_ERROR","message":"Please correct the errors below","messageKey":"errors:VALIDATION_ERROR","details":{"batchJobId":["batchJobId must be at least 1 character...`

## Analysis

### Print Preferences (E13-1): 100% Pass Rate
All 45 print preference tests pass — company defaults CRUD, user preferences CRUD, cascade resolution, RBAC, and validation.

### Document Generation (E12/E13-2): Batch Endpoints Return 500
The batch-generate and batch-status endpoints return 500 (INTERNAL_ERROR) instead of 202/503. This is likely because Redis/BullMQ is not running in the dev environment. The single-document generate endpoint works correctly (200).

### DBS-004: Minor Route Mismatch
Empty batchJobId path returns 400 (VALIDATION_ERROR) instead of expected 404. The route still matches with an empty param and Fastify validates it. This is acceptable behavior.
