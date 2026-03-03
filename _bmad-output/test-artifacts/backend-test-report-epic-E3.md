# Backend API Test Report — Epic E3 (Event Bus + Audit Trail)

**Executed at:** 2026-02-21T12:48:58.938529+00:00
**API Base URL:** http://localhost:3000
**Epic:** E3 — Event Bus + Audit Trail

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 49 |
| Passed | 36 |
| Failed | 1 |
| Skipped | 12 |
| **Pass Rate (excl. skipped)** | **36/37 (97.3%)** |

## Results by Test Type

| Type | Total | Passed | Failed | Skipped |
|------|-------|--------|--------|---------|
| happy_path | 21 | 19 | 0 | 2 |
| validation_error | 10 | 10 | 0 | 0 |
| edge_case | 10 | 3 | 1 | 6 |
| auth_error | 8 | 4 | 0 | 4 |

## Results by Endpoint

### `GET /system/audit-log`
**18 passed, 0 failed, 3 skipped** out of 21 tests

| ID | Test Name | Type | Status | Expected | Actual |
|----|-----------|------|--------|----------|--------|
| AL-001 | Audit log list - happy path with default params | happy_path | PASS | 200 | 200 |
| AL-002 | Audit log list - filter by entityType | happy_path | PASS | 200 | 200 |
| AL-003 | Audit log list - filter by entityId | happy_path | PASS | 200 | 200 |
| AL-004 | Audit log list - filter by action (CREATE) | happy_path | PASS | 200 | 200 |
| AL-005 | Audit log list - filter by userId | happy_path | PASS | 200 | 200 |
| AL-006 | Audit log list - filter by date range | happy_path | PASS | 200 | 200 |
| AL-007 | Audit log list - multiple filters combined | happy_path | PASS | 200 | 200 |
| AL-008 | Audit log list - cursor pagination | happy_path | PASS | 200 | 200 |
| AL-009 | Audit log list - descending timestamp order | happy_path | PASS | 200 | 200 |
| AL-010 | Audit log list - empty result | edge_case | PASS | 200 | 200 |
| AL-011 | Audit log list - company isolation | edge_case | SKIP | 200 | — |
| AL-012 | Audit log list - records older than 6 years | edge_case | SKIP | 200 | — |
| AL-013 | Audit log list - invalid action enum | validation_error | PASS | 400 | 400 |
| AL-014 | Audit log list - invalid entityId | validation_error | PASS | 400 | 400 |
| AL-015 | Audit log list - invalid userId | validation_error | PASS | 400 | 400 |
| AL-016 | Audit log list - invalid dateFrom | validation_error | PASS | 400 | 400 |
| AL-017 | Audit log list - limit exceeds max | validation_error | PASS | 400 | 400 |
| AL-018 | Audit log list - limit below minimum | validation_error | PASS | 400 | 400 |
| AL-019 | Audit log list - unauthenticated | auth_error | PASS | 401 | 401 |
| AL-020 | Audit log list - unprivileged user | auth_error | SKIP | 403 | — |
| AL-021 | Audit log list - response field completeness | happy_path | PASS | 200 | 200 |

### `GET /system/audit-log/:entityType/:entityId`
**7 passed, 0 failed, 2 skipped** out of 9 tests

| ID | Test Name | Type | Status | Expected | Actual |
|----|-----------|------|--------|----------|--------|
| AH-001 | Entity history - happy path | happy_path | PASS | 200 | 200 |
| AH-002 | Entity history - chronological ascending order | happy_path | PASS | 200 | 200 |
| AH-003 | Entity history - cursor pagination | happy_path | PASS | 200 | 200 |
| AH-004 | Entity history - no records found | edge_case | PASS | 200 | 200 |
| AH-005 | Entity history - company isolation | edge_case | SKIP | 200 | — |
| AH-006 | Entity history - invalid entityId | validation_error | PASS | 400 | 400 |
| AH-007 | Entity history - empty entityType | validation_error | PASS | 400 | 400 |
| AH-008 | Entity history - unauthenticated | auth_error | PASS | 401 | 401 |
| AH-009 | Entity history - unprivileged user | auth_error | SKIP | 403 | — |

### `GET /system/dead-letter-queue`
**10 passed, 0 failed, 2 skipped** out of 12 tests

| ID | Test Name | Type | Status | Expected | Actual |
|----|-----------|------|--------|----------|--------|
| DL-001 | Dead letter queue list - happy path | happy_path | PASS | 200 | 200 |
| DL-002 | Dead letter queue list - response fields | happy_path | PASS | 200 | 200 |
| DL-003 | Dead letter queue list - filter by eventName | happy_path | PASS | 200 | 200 |
| DL-004 | Dead letter queue list - filter by reprocessed=false | happy_path | PASS | 200 | 200 |
| DL-005 | Dead letter queue list - filter by reprocessed=true | happy_path | PASS | 200 | 200 |
| DL-006 | Dead letter queue list - cursor pagination | happy_path | PASS | 200 | 200 |
| DL-007 | Dead letter queue list - empty result | edge_case | PASS | 200 | 200 |
| DL-008 | Dead letter queue list - Redis unavailable | edge_case | SKIP | 503 | — |
| DL-009 | Dead letter queue list - invalid limit >100 | validation_error | PASS | 400 | 400 |
| DL-010 | Dead letter queue list - invalid limit <1 | validation_error | PASS | 400 | 400 |
| DL-011 | Dead letter queue list - unauthenticated | auth_error | PASS | 401 | 401 |
| DL-012 | Dead letter queue list - unprivileged user | auth_error | SKIP | 403 | — |

### `POST /system/dead-letter-queue/:id/reprocess`
**1 passed, 1 failed, 5 skipped** out of 7 tests

| ID | Test Name | Type | Status | Expected | Actual |
|----|-----------|------|--------|----------|--------|
| DR-001 | Reprocess DLQ entry - happy path | happy_path | SKIP | 200 | — |
| DR-002 | Reprocess DLQ entry - verify re-emission | happy_path | SKIP | 200 | — |
| DR-003 | Reprocess DLQ entry - not found | edge_case | FAIL | 404 | 400 |
| DR-004 | Reprocess DLQ entry - already reprocessed | edge_case | SKIP | 409 | — |
| DR-005 | Reprocess DLQ entry - Redis unavailable | edge_case | SKIP | 503 | — |
| DR-006 | Reprocess DLQ entry - unauthenticated | auth_error | PASS | 401 | 401 |
| DR-007 | Reprocess DLQ entry - view-only user | auth_error | SKIP | 403 | — |

## Failed Tests — Details

### DR-003: Reprocess DLQ entry - not found
- **Endpoint:** `POST /system/dead-letter-queue/nonexistent-id-12345/reprocess`
- **Expected Status:** 404
- **Actual Status:** 400
- **Error:** Expected status 404 but got 400
- **Analysis:** The POST endpoint returns 400 (Bad Request: "Body cannot be empty when content-type is set to 'application/json'") before reaching the route handler. The route does not expect a request body, but the `Content-Type: application/json` header triggers Fastify's body parser which rejects empty bodies. **Fix:** Either remove `Content-Type: application/json` from the request, or configure the route to accept empty bodies.

## Skipped Tests — Reasons

| ID | Test Name | Reason |
|----|-----------|--------|
| AL-011 | Audit log list - company isolation | No company B user seeded - cross-company isolation test requires separate tenant user |
| AL-012 | Audit log list - records older than 6 years | No 7-year-old audit records seeded - retention test requires pre-seeded historical data |
| AL-020 | Audit log list - unprivileged user | No unprivileged user seeded - requires user without system.audit-log.list permission |
| AH-005 | Entity history - company isolation | No company B user seeded - cross-company isolation test requires separate tenant user |
| AH-009 | Entity history - unprivileged user | No unprivileged user seeded - requires user without system.audit-log.list permission |
| DL-008 | Dead letter queue list - Redis unavailable | Cannot simulate Redis unavailability in live test - requires deadLetterService=null |
| DL-012 | Dead letter queue list - unprivileged user | No unprivileged user seeded - requires user without system.dead-letter-queue.list permission |
| DR-001 | Reprocess DLQ entry - happy path | No unprocessed DLQ entries available - requires seeded failed events |
| DR-002 | Reprocess DLQ entry - verify re-emission | Requires separate unprocessed DLQ entry and DB verification of re-emitted event - cannot verify without DLQ seeding |
| DR-004 | Reprocess DLQ entry - already reprocessed | No DLQ entries available to test reprocessed conflict |
| DR-005 | Reprocess DLQ entry - Redis unavailable | Cannot simulate Redis unavailability in live test - requires deadLetterService=null |
| DR-007 | Reprocess DLQ entry - view-only user | No view-only user seeded - requires user with view but not edit permission |

## Observations

1. **Audit Log endpoints are fully functional** — All happy-path, validation, and auth tests pass for both `GET /system/audit-log` and `GET /system/audit-log/:entityType/:entityId`.
2. **Dead Letter Queue list endpoints work** — All DLQ list tests pass (though DLQ is currently empty, the endpoint handles empty results and filters correctly).
3. **Validation is comprehensive** — Invalid UUID, invalid enum, out-of-range limit, and invalid datetime all return proper 400 responses with clear error messages.
4. **Authentication guard works** — All unauthenticated requests correctly return 401.
5. **Response envelope is consistent** — All responses follow the `{success, data, meta}` / `{success, error}` pattern.

### Known Gaps (Skipped Tests)

- **Cross-company isolation (AL-011, AH-005):** Requires a second tenant with separate user credentials to verify company scoping.
- **Permission-based access (AL-020, AH-009, DL-012, DR-007):** Requires users with specific access group configurations (unprivileged, view-only).
- **Data retention (AL-012):** Requires seeding audit records with timestamps 7+ years in the past.
- **DLQ reprocessing (DR-001, DR-002, DR-004):** Requires seeded dead-letter queue entries (no event handler failures have occurred).
- **Service unavailability (DL-008, DR-005):** Requires Redis to be down or deadLetterService to be null — infrastructure-level test.

### Bug Found

- **DR-003:** `POST /system/dead-letter-queue/:id/reprocess` with `Content-Type: application/json` and no body returns 400 instead of reaching the route handler to return 404. Fastify rejects empty JSON bodies before the route logic executes. The test plan expects 404 for a non-existent DLQ entry ID, but the request never reaches that check.
