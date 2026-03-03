# Epic E5 — Backend API Test Report

**Executed at:** 2026-02-23T02:57:46Z
**API Base URL:** http://localhost:3000
**Auth Available:** False

## Executive Summary

> **Login endpoint (POST /auth/login) returned HTTP 500 (INTERNAL_ERROR). All authenticated endpoints returned 401 and were marked as skipped. Only unauthenticated tests (missing auth -> 401) could be verified.**

| Metric | Count |
|--------|-------|
| **Total Test Cases** | 146 |
| **Passed** | 12 |
| **Failed** | 0 |
| **Skipped** | 134 |
| **Pass Rate (of executed)** | 100.0% |

### Skip Breakdown

| Reason | Count |
|--------|-------|
| No auth token (login returned 500) | 49 |
| Precondition not met (requires specific JWT/state) | 33 |
| WebSocket tests (require Socket.io client) | 15 |
| Unit tests (require vitest runner) | 34 |

### Verdict

All 12 executed tests **passed**. These were the unauthenticated access tests (missing `Authorization` header -> 401 `UNAUTHORIZED`), confirming that all AI endpoints correctly enforce JWT authentication.

The remaining 134 tests were **skipped** because:
1. The login endpoint (`POST /auth/login`) returned HTTP 500, so no JWT token could be obtained
2. WebSocket tests require a Socket.io client library, not curl
3. Unit tests require the vitest test runner
4. Some tests require specific preconditions (degraded AI service, specific user roles, etc.)

---

## Detailed Results by Endpoint

### `POST /ai/chat/sessions`

**Results:** 1 passed, 0 failed, 5 skipped

| ID | Test Name | Type | Status | Expected | Actual | Error |
|-----|-----------|------|--------|----------|--------|-------|
| E5-TC-001 | Create session - happy path with default channel | happy_path | SKIP | 201 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-002 | Create session - happy path with explicit channel and agentId | happy_path | SKIP | 201 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-003 | Create session - missing auth returns 401 | auth_error | PASS | 401 | 401 |  |
| E5-TC-004 | Create session - invalid channel value returns 400 | validation_error | SKIP | 400 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-005 | Create session - invalid agentId format returns 400 | validation_error | SKIP | 400 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-006 | Create session - AI service degraded returns 503 | edge_case | SKIP | 503 | 0 | Requires AI plugin to be in degraded state - cannot simulate via curl |

### `POST /ai/chat/message`

**Results:** 1 passed, 0 failed, 9 skipped

| ID | Test Name | Type | Status | Expected | Actual | Error |
|-----|-----------|------|--------|----------|--------|-------|
| E5-TC-007 | Chat message - happy path returns AI text response | happy_path | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-008 | Chat message - happy path with page context | happy_path | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-009 | Chat message - missing auth returns 401 | auth_error | PASS | 401 | 401 |  |
| E5-TC-010 | Chat message - missing sessionId returns 400 | validation_error | SKIP | 400 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-011 | Chat message - empty content returns 400 | validation_error | SKIP | 400 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-012 | Chat message - content exceeds 10000 chars returns 400 | validation_error | SKIP | 400 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-013 | Chat message - AI service degraded returns 503 | edge_case | SKIP | 503 | 0 | Requires AI orchestrator to be null - cannot simulate via curl |
| E5-TC-014 | Chat message - AI quota exceeded returns 429 | edge_case | SKIP | 429 | 0 | Requires AI Gateway to return quota error - cannot simulate via curl |
| E5-TC-015 | Chat message - AI returns action_proposal type | happy_path | SKIP | 200 | 0 | Requires AI to generate specific action intent - cannot guarantee via curl |
| E5-TC-016 | Chat message - multi-turn context preserved | happy_path | SKIP | 200 | 0 | Requires session with history - depends on TC-007 success |

### `GET /ai/chat/history`

**Results:** 1 passed, 0 failed, 6 skipped

| ID | Test Name | Type | Status | Expected | Actual | Error |
|-----|-----------|------|--------|----------|--------|-------|
| E5-TC-017 | List sessions - happy path returns conversations sorted by startedAt desc | happy_path | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-018 | List sessions - empty list for user with no conversations | edge_case | SKIP | 200 | 0 | Requires new user JWT with no conversations |
| E5-TC-019 | List sessions - cursor pagination returns next page | happy_path | SKIP | 200 | 0 | Requires 25+ conversations for pagination test |
| E5-TC-020 | List sessions - only returns own conversations | security | SKIP | 200 | 0 | Requires multiple user JWTs to verify isolation |
| E5-TC-021 | List sessions - only returns own company conversations | security | SKIP | 200 | 0 | Requires multi-company JWT to verify tenant isolation |
| E5-TC-022 | List sessions - missing auth returns 401 | auth_error | PASS | 401 | 401 |  |
| E5-TC-024 | List sessions - AI degraded returns 503 | edge_case | SKIP | 503 | 0 | Requires chatSessionService to be null |

### `GET /ai/chat/history?limit=999`

**Results:** 0 passed, 0 failed, 1 skipped

| ID | Test Name | Type | Status | Expected | Actual | Error |
|-----|-----------|------|--------|----------|--------|-------|
| E5-TC-023 | List sessions - invalid limit value returns 400 | validation_error | SKIP | 400 | 401 | No auth token available; cannot test authenticated endpoint |

### `GET /ai/chat/history/00000000-0000-0000-0000-000000000000`

**Results:** 1 passed, 0 failed, 4 skipped

| ID | Test Name | Type | Status | Expected | Actual | Error |
|-----|-----------|------|--------|----------|--------|-------|
| E5-TC-025 | Get session - happy path returns conversation with messages | happy_path | SKIP | 200 | 0 | No valid session ID available |
| E5-TC-026 | Get session - non-existent session returns 404 | edge_case | SKIP | 404 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-027 | Get session - other user's session returns 404 | security | SKIP | 404 | 0 | Requires different user JWT |
| E5-TC-029 | Get session - message pagination with cursor | happy_path | SKIP | 200 | 0 | Requires session with 60+ messages |
| E5-TC-030 | Get session - missing auth returns 401 | auth_error | PASS | 401 | 401 |  |

### `GET /ai/chat/history/not-a-uuid`

**Results:** 0 passed, 0 failed, 1 skipped

| ID | Test Name | Type | Status | Expected | Actual | Error |
|-----|-----------|------|--------|----------|--------|-------|
| E5-TC-028 | Get session - invalid sessionId format returns 400 | validation_error | SKIP | 400 | 401 | No auth token available; cannot test authenticated endpoint |

### `POST /ai/chat/sessions/00000000-0000-0000-0000-000000000000/end`

**Results:** 1 passed, 0 failed, 3 skipped

| ID | Test Name | Type | Status | Expected | Actual | Error |
|-----|-----------|------|--------|----------|--------|-------|
| E5-TC-031 | End session - happy path sets status to completed | happy_path | SKIP | 200 | 0 | No valid session ID available |
| E5-TC-032 | End session - non-existent session returns 200 | edge_case | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-034 | End session - missing auth returns 401 | auth_error | PASS | 401 | 401 |  |
| E5-TC-035 | End session - AI degraded returns 503 | edge_case | SKIP | 503 | 0 | Requires chatSessionService to be null |

### `POST /ai/chat/sessions/not-a-uuid/end`

**Results:** 0 passed, 0 failed, 1 skipped

| ID | Test Name | Type | Status | Expected | Actual | Error |
|-----|-----------|------|--------|----------|--------|-------|
| E5-TC-033 | End session - invalid sessionId format returns 400 | validation_error | SKIP | 400 | 401 | No auth token available; cannot test authenticated endpoint |

### `POST /ai/predict/cash-flow`

**Results:** 1 passed, 0 failed, 9 skipped

| ID | Test Name | Type | Status | Expected | Actual | Error |
|-----|-----------|------|--------|----------|--------|-------|
| E5-TC-036 | Cash flow forecast - happy path returns projections | happy_path | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-037 | Cash flow forecast - with specific bankAccountIds | happy_path | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-038 | Cash flow forecast - NEGATIVE_BALANCE alert generated | happy_path | SKIP | 200 | 0 | Requires AI to return forecast with negative closing balance |
| E5-TC-039 | Cash flow forecast - startDate after endDate returns 400 | validation_error | SKIP | 400 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-040 | Cash flow forecast - missing startDate returns 400 | validation_error | SKIP | 400 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-041 | Cash flow forecast - invalid date format returns 400 | validation_error | SKIP | 400 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-042 | Cash flow forecast - missing auth returns 401 | auth_error | PASS | 401 | 401 |  |
| E5-TC-043 | Cash flow forecast - insufficient permission returns 403 | auth_error | SKIP | 403 | 0 | Requires user JWT without ai.predictions:view permission |
| E5-TC-044 | Cash flow forecast - AI degraded returns 503 | edge_case | SKIP | 503 | 0 | Requires aiPredictionService to be null |
| E5-TC-045 | Cash flow forecast - graceful degradation when business models not yet built | edge_case | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |

### `POST /ai/detect/anomalies`

**Results:** 1 passed, 0 failed, 7 skipped

| ID | Test Name | Type | Status | Expected | Actual | Error |
|-----|-----------|------|--------|----------|--------|-------|
| E5-TC-046 | Anomaly detection - happy path returns flagged items | happy_path | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-047 | Anomaly detection - with entity type filter | happy_path | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-048 | Anomaly detection - confidence levels correctly applied | happy_path | SKIP | 200 | 0 | Requires AI to return anomalies with various confidence scores |
| E5-TC-049 | Anomaly detection - lookbackDays below minimum returns 400 | validation_error | SKIP | 400 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-050 | Anomaly detection - lookbackDays above maximum returns 400 | validation_error | SKIP | 400 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-051 | Anomaly detection - invalid entityTypes returns 400 | validation_error | SKIP | 400 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-052 | Anomaly detection - missing auth returns 401 | auth_error | PASS | 401 | 401 |  |
| E5-TC-053 | Anomaly detection - AI degraded returns 503 | edge_case | SKIP | 503 | 0 | Requires aiPredictionService to be null |

### `POST /ai/detect/duplicates`

**Results:** 1 passed, 0 failed, 8 skipped

| ID | Test Name | Type | Status | Expected | Actual | Error |
|-----|-----------|------|--------|----------|--------|-------|
| E5-TC-054 | Duplicate detection - happy path for Customer | happy_path | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-055 | Duplicate detection - for Supplier entityType | happy_path | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-056 | Duplicate detection - for Contact entityType | happy_path | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-057 | Duplicate detection - field comparisons include per-field similarity | happy_path | SKIP | 200 | 0 | Requires AI to return duplicate pairs with field-level comparisons |
| E5-TC-058 | Duplicate detection - invalid entityType returns 400 | validation_error | SKIP | 400 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-059 | Duplicate detection - missing entityType returns 400 | validation_error | SKIP | 400 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-060 | Duplicate detection - limit exceeds max returns 400 | validation_error | SKIP | 400 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-061 | Duplicate detection - missing auth returns 401 | auth_error | PASS | 401 | 401 |  |
| E5-TC-062 | Duplicate detection - AI degraded returns 503 | edge_case | SKIP | 503 | 0 | Requires aiPredictionService to be null |

### `GET /ai/confidence/Customer/00000000-0000-0000-0000-000000000000`

**Results:** 1 passed, 0 failed, 4 skipped

| ID | Test Name | Type | Status | Expected | Actual | Error |
|-----|-----------|------|--------|----------|--------|-------|
| E5-TC-063 | Confidence score - happy path returns confidence | happy_path | SKIP | 200 | 0 | Requires entity created by AI with confidence data |
| E5-TC-064 | Confidence score - non-AI entity returns 404 | edge_case | SKIP | 404 | 0 | Requires manually created entity to verify 404 |
| E5-TC-065 | Confidence score - non-existent entityId returns 404 | edge_case | SKIP | 404 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-067 | Confidence score - missing auth returns 401 | auth_error | PASS | 401 | 401 |  |
| E5-TC-068 | Confidence score - AI degraded returns 503 | edge_case | SKIP | 503 | 0 | Requires aiPredictionService to be null |

### `GET /ai/confidence/Customer/not-a-uuid`

**Results:** 0 passed, 0 failed, 1 skipped

| ID | Test Name | Type | Status | Expected | Actual | Error |
|-----|-----------|------|--------|----------|--------|-------|
| E5-TC-066 | Confidence score - invalid entityId format returns 400 | validation_error | SKIP | 400 | 401 | No auth token available; cannot test authenticated endpoint |

### `POST /ai/explain`

**Results:** 1 passed, 0 failed, 7 skipped

| ID | Test Name | Type | Status | Expected | Actual | Error |
|-----|-----------|------|--------|----------|--------|-------|
| E5-TC-069 | Explain - happy path for entity creation decision | happy_path | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-070 | Explain - for anomaly decision type | happy_path | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-071 | Explain - for forecast decision type | happy_path | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-072 | Explain - invalid decisionType returns 400 | validation_error | SKIP | 400 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-073 | Explain - missing entityType returns 400 | validation_error | SKIP | 400 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-074 | Explain - invalid entityId format returns 400 | validation_error | SKIP | 400 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-075 | Explain - missing auth returns 401 | auth_error | PASS | 401 | 401 |  |
| E5-TC-076 | Explain - AI degraded returns 503 | edge_case | SKIP | 503 | 0 | Requires aiPredictionService to be null |

### `GET /ai/briefing`

**Results:** 1 passed, 0 failed, 9 skipped

| ID | Test Name | Type | Status | Expected | Actual | Error |
|-----|-----------|------|--------|----------|--------|-------|
| E5-TC-077 | Briefing - happy path returns role-based briefing | happy_path | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-078 | Briefing - cached response returned on subsequent request | happy_path | SKIP | 200 | 0 | Requires prior briefing request to populate cache |
| E5-TC-080 | Briefing - Finance Manager role gets finance-specific items | happy_path | SKIP | 200 | 0 | Requires Finance Manager JWT |
| E5-TC-081 | Briefing - Business Owner role gets owner-specific items | happy_path | SKIP | 200 | 0 | Requires Owner/Super Admin JWT |
| E5-TC-082 | Briefing - items include actionable links and metrics | happy_path | SKIP | 200 | 0 | Dependent on TC-077 response structure |
| E5-TC-083 | Briefing - stale cache returns isStale=true | edge_case | SKIP | 200 | 0 | Requires cached briefing older than 24 hours |
| E5-TC-084 | Briefing - missing auth returns 401 | auth_error | PASS | 401 | 401 |  |
| E5-TC-085 | Briefing - insufficient permission returns 403 | auth_error | SKIP | 403 | 0 | Requires user JWT without ai.briefing:view permission |
| E5-TC-086 | Briefing - AI degraded returns 503 | edge_case | SKIP | 503 | 0 | Requires aiBriefingEngine to be null |
| E5-TC-087 | Briefing - graceful degradation with empty database | edge_case | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |

### `GET /ai/briefing?forceRefresh=true`

**Results:** 0 passed, 0 failed, 1 skipped

| ID | Test Name | Type | Status | Expected | Actual | Error |
|-----|-----------|------|--------|----------|--------|-------|
| E5-TC-079 | Briefing - forceRefresh bypasses cache | happy_path | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |

### `POST /ai/suggestions`

**Results:** 1 passed, 0 failed, 9 skipped

| ID | Test Name | Type | Status | Expected | Actual | Error |
|-----|-----------|------|--------|----------|--------|-------|
| E5-TC-088 | Suggestions - happy path with page context | happy_path | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-089 | Suggestions - happy path without page context returns generic suggestions | happy_path | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-090 | Suggestions - customer detail page returns customer-specific suggestions | happy_path | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-091 | Suggestions - invoice list page returns invoice-specific suggestions | happy_path | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-092 | Suggestions - dashboard page returns morning briefing suggestion | happy_path | SKIP | 200 | 401 | No auth token available; cannot test authenticated endpoint |
| E5-TC-093 | Suggestions - RBAC filtering excludes suggestions for inaccessible modules | security | SKIP | 200 | 0 | Requires user JWT without AR module access |
| E5-TC-094 | Suggestions - missing auth returns 401 | auth_error | PASS | 401 | 401 |  |
| E5-TC-095 | Suggestions - insufficient permission returns 403 | auth_error | SKIP | 403 | 0 | Requires user JWT without ai.suggestions:view permission |
| E5-TC-096 | Suggestions - AI degraded returns 503 | edge_case | SKIP | 503 | 0 | Requires aiSuggestionsService to be null |
| E5-TC-097 | Suggestions - pageRoute exceeds max length returns 400 | validation_error | SKIP | 400 | 401 | No auth token available; cannot test authenticated endpoint |

### `WEBSOCKET /ai/chat`

**Results:** 0 passed, 0 failed, 15 skipped

| ID | Test Name | Type | Status | Expected | Actual | Error |
|-----|-----------|------|--------|----------|--------|-------|
| E5-TC-098 | WebSocket test - skipped (requires Socket.io client) | websocket | SKIP | 0 | 0 | WebSocket tests cannot be executed via curl |
| E5-TC-099 | WebSocket test - skipped (requires Socket.io client) | websocket | SKIP | 0 | 0 | WebSocket tests cannot be executed via curl |
| E5-TC-100 | WebSocket test - skipped (requires Socket.io client) | websocket | SKIP | 0 | 0 | WebSocket tests cannot be executed via curl |
| E5-TC-101 | WebSocket test - skipped (requires Socket.io client) | websocket | SKIP | 0 | 0 | WebSocket tests cannot be executed via curl |
| E5-TC-102 | WebSocket test - skipped (requires Socket.io client) | websocket | SKIP | 0 | 0 | WebSocket tests cannot be executed via curl |
| E5-TC-103 | WebSocket test - skipped (requires Socket.io client) | websocket | SKIP | 0 | 0 | WebSocket tests cannot be executed via curl |
| E5-TC-104 | WebSocket test - skipped (requires Socket.io client) | websocket | SKIP | 0 | 0 | WebSocket tests cannot be executed via curl |
| E5-TC-105 | WebSocket test - skipped (requires Socket.io client) | websocket | SKIP | 0 | 0 | WebSocket tests cannot be executed via curl |
| E5-TC-106 | WebSocket test - skipped (requires Socket.io client) | websocket | SKIP | 0 | 0 | WebSocket tests cannot be executed via curl |
| E5-TC-107 | WebSocket test - skipped (requires Socket.io client) | websocket | SKIP | 0 | 0 | WebSocket tests cannot be executed via curl |
| E5-TC-108 | WebSocket test - skipped (requires Socket.io client) | websocket | SKIP | 0 | 0 | WebSocket tests cannot be executed via curl |
| E5-TC-109 | WebSocket test - skipped (requires Socket.io client) | websocket | SKIP | 0 | 0 | WebSocket tests cannot be executed via curl |
| E5-TC-110 | WebSocket test - skipped (requires Socket.io client) | websocket | SKIP | 0 | 0 | WebSocket tests cannot be executed via curl |
| E5-TC-111 | WebSocket test - skipped (requires Socket.io client) | websocket | SKIP | 0 | 0 | WebSocket tests cannot be executed via curl |
| E5-TC-112 | WebSocket test - skipped (requires Socket.io client) | websocket | SKIP | 0 | 0 | WebSocket tests cannot be executed via curl |

### `UNIT_TEST apps/api/src/ai/*.ts`

**Results:** 0 passed, 0 failed, 34 skipped

| ID | Test Name | Type | Status | Expected | Actual | Error |
|-----|-----------|------|--------|----------|--------|-------|
| E5-TC-113 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-114 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-115 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-116 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-117 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-118 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-119 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-120 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-121 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-122 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-123 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-124 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-125 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-126 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-127 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-128 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-129 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-130 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-131 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-132 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-133 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-134 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-135 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-136 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-137 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-138 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-139 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-140 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-141 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-142 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-143 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-144 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-145 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |
| E5-TC-146 | Unit test - skipped (requires vitest runner) | unit | SKIP | 0 | 0 | Unit tests must be run via vitest, not curl |

---

## Passed Tests Detail

All 12 passed tests verified that endpoints return `401 UNAUTHORIZED` when no `Authorization` header is provided:

- **E5-TC-003** `POST /ai/chat/sessions` — Create session - missing auth returns 401
  - Response: `{"success":false,"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}`
- **E5-TC-009** `POST /ai/chat/message` — Chat message - missing auth returns 401
  - Response: `{"success":false,"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}`
- **E5-TC-022** `GET /ai/chat/history` — List sessions - missing auth returns 401
  - Response: `{"success":false,"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}`
- **E5-TC-030** `GET /ai/chat/history/00000000-0000-0000-0000-000000000000` — Get session - missing auth returns 401
  - Response: `{"success":false,"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}`
- **E5-TC-034** `POST /ai/chat/sessions/00000000-0000-0000-0000-000000000000/end` — End session - missing auth returns 401
  - Response: `{"success":false,"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}`
- **E5-TC-042** `POST /ai/predict/cash-flow` — Cash flow forecast - missing auth returns 401
  - Response: `{"success":false,"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}`
- **E5-TC-052** `POST /ai/detect/anomalies` — Anomaly detection - missing auth returns 401
  - Response: `{"success":false,"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}`
- **E5-TC-061** `POST /ai/detect/duplicates` — Duplicate detection - missing auth returns 401
  - Response: `{"success":false,"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}`
- **E5-TC-067** `GET /ai/confidence/Customer/00000000-0000-0000-0000-000000000000` — Confidence score - missing auth returns 401
  - Response: `{"success":false,"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}`
- **E5-TC-075** `POST /ai/explain` — Explain - missing auth returns 401
  - Response: `{"success":false,"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}`
- **E5-TC-084** `GET /ai/briefing` — Briefing - missing auth returns 401
  - Response: `{"success":false,"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}`
- **E5-TC-094** `POST /ai/suggestions` — Suggestions - missing auth returns 401
  - Response: `{"success":false,"error":{"code":"UNAUTHORIZED","message":"Authentication required"}}`

---

## Recommendations

### Blocking Issues

1. **Login endpoint returns HTTP 500** — `POST /auth/login` with seeded credentials `admin@nexa-erp.dev` / `NexaDev2026` returns `INTERNAL_ERROR`. This blocks all authenticated API testing. Likely causes:
   - Database not seeded with admin user
   - Missing environment variable (e.g., `JWT_SECRET`)
   - Prisma client connection issue

### To Complete Full Test Coverage

1. **Fix login** — Resolve the 500 error on `/auth/login`, then re-run this test suite with `AUTH_TOKEN=<token> bash run-tests.sh`
2. **WebSocket tests (15 cases)** — Run via the vitest integration tests in `apps/api/src/ai/` which use Socket.io client
3. **Unit tests (34 cases)** — Run `pnpm --filter @nexa/api test` to execute vitest unit tests for orchestrator, prompt-manager, response-parser, guardrails, and action-executor
4. **Multi-user/role tests** — Create additional test users with different roles (Finance Manager, Owner, no-AI-permission user) to test RBAC, cross-user isolation, and permission guards
5. **Edge case tests** — AI degraded (503), quota exceeded (429), and stale cache tests require mocking the AI service layer

### Known Issues from Code Review (Reference)

| Issue | Description |
|-------|-------------|
| E5.2-CR#2 | `POST /chat/sessions/:sessionId/end` returns 200 even when session not found (should be 404) |
| E5.2-CR#1 | `endSession` TOCTOU race in ownership check |
| E5.4-CR#1 | PredictionService silently swallows AI errors, returns empty results instead of 429/503 |
| E5.3-CR#5 | In-memory action proposal storage breaks in multi-instance deployments |
| E5.5-CR#1 | `resolveRole()` uses string pattern matching instead of access-group-based resolution |

---

*Report generated: 2026-02-23T02:58:25Z*