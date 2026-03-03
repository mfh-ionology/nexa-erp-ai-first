# Backend Test Report — Epic E5b

**Executed:** 2026-03-02T03:47:42.942744+00:00
**API Base URL:** http://localhost:3000
**Epic:** E5b — AI Co-Pilot Intelligence — Memory, Skills & Dynamic Context

## Summary

| Metric | Count |
|--------|-------|
| Total Tests | 97 |
| Passed | 14 |
| Failed | 77 |
| Skipped | 6 |
| **Pass Rate** | **14.4%** |

## Failure Breakdown

| Category | Count | Description |
|----------|-------|-------------|
| 503 AI Degraded | 33 | `PLATFORM_SERVICE_TOKEN` not set — AI services unavailable |
| 401 Auth/Permission | 22 | Token expiry, missing permissions, or RBAC guard blocking |
| 0 Dependent | 17 | Tests requiring resource IDs from failed create operations |
| 429 Rate Limited | 4 | Rate limiter triggered by rapid sequential requests |
| Other | 1 | Unexpected status code mismatch |

## Environment Issues

### Critical: AI Module in Degraded Mode

The AI module initializes in **graceful degradation** because `PLATFORM_SERVICE_TOKEN` is not set.
This causes all service-dependent endpoints to return **503 AI_DEGRADED**.
To run these tests with full functionality, set the following environment variables:

```bash
PLATFORM_SERVICE_TOKEN=<token>
PLATFORM_API_URL=http://localhost:3001/api/v1
REDIS_URL=redis://localhost:6379
```

### Route Prefix Mismatch

The test plan specifies routes under `/api/v1/ai/*` but the actual API routes are at `/*` (root level).
This is because the AI plugin uses `fastify-plugin` (`fp()`) which strips the `/ai` prefix from `app.ts`.
The test runner corrects this automatically by stripping `/api/v1/ai` from all paths.

### Role-Based Tests Skipped

6 tests requiring STAFF or ADMIN role tokens were skipped because only a SUPER_ADMIN token is available.
These tests need separate user accounts with lower privilege levels.

## Passing Tests (14)

| Test ID | Endpoint | Test Name | Type |
|---------|----------|-----------|------|
| MEM-C-05 | `POST /api/v1/ai/memories` | Create memory — missing content field | validation_error |
| MEM-C-06 | `POST /api/v1/ai/memories` | Create memory — missing category field | validation_error |
| MEM-C-07 | `POST /api/v1/ai/memories` | Create memory — invalid category value | validation_error |
| MEM-C-08 | `POST /api/v1/ai/memories` | Create memory — empty content string | validation_error |
| MEM-C-12 | `POST /api/v1/ai/memories` | Create memory — unauthenticated request | edge_case |
| MEM-R-06 | `GET /api/v1/ai/memories?category=BOGUS` | List memories — invalid category filter | validation_error |
| MEM-U-05 | `PATCH /api/v1/ai/memories/not-a-uuid` | Update memory — invalid UUID param | validation_error |
| MEM-S-R-01 | `GET /api/v1/ai/memories/settings` | Get settings — happy path (existing settings) | happy_path |
| MEM-S-U-01 | `PATCH /api/v1/ai/memories/settings` | Update settings — toggle isEnabled off | happy_path |
| MEM-S-U-02 | `PATCH /api/v1/ai/memories/settings` | Update settings — change enabled categories | happy_path |
| MEM-S-U-03 | `PATCH /api/v1/ai/memories/settings` | Update settings — change retentionDays | happy_path |
| MEM-S-U-04 | `PATCH /api/v1/ai/memories/settings` | Update settings — retentionDays below minimum (0) | validation_error |
| MEM-S-U-05 | `PATCH /api/v1/ai/memories/settings` | Update settings — retentionDays above maximum (3651) | validation_error |
| MEM-S-U-06 | `PATCH /api/v1/ai/memories/settings` | Update settings — maxMemories below minimum (5) | validation_error |

## Results by Endpoint

### `POST /api/v1/ai/memories` — 5/12 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| MEM-C-01 | Create memory — happy path (EXPLICIT PREFERENCE) | happy_path | 201 | 503 | FAIL |
| MEM-C-02 | Create memory — happy path (IMPLICIT WORKFLOW) | happy_path | 201 | 503 | FAIL |
| MEM-C-03 | Create memory — all 5 categories accepted | happy_path | 201 | 503 | FAIL |
| MEM-C-04 | Create memory — with optional metadata | happy_path | 201 | 503 | FAIL |
| MEM-C-05 | Create memory — missing content field | validation_error | 400 | 400 | PASS |
| MEM-C-06 | Create memory — missing category field | validation_error | 400 | 400 | PASS |
| MEM-C-07 | Create memory — invalid category value | validation_error | 400 | 400 | PASS |
| MEM-C-08 | Create memory — empty content string | validation_error | 400 | 400 | PASS |
| MEM-C-09 | Create memory — content exceeds 10000 chars | validation_error | 400 | 503 | FAIL |
| MEM-C-10 | Create memory — memory disabled returns domain error | edge_case | 400 | 503 | FAIL |
| MEM-C-11 | Create memory — disabled category returns domain error | edge_case | 400 | 503 | FAIL |
| MEM-C-12 | Create memory — unauthenticated request | edge_case | 401 | 401 | PASS |

**Failure Details:**
- **MEM-C-01**: Expected status 201 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI memory service is not available", "messageKey": "ai.error.degraded"}}
- **MEM-C-02**: Expected status 201 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI memory service is not available", "messageKey": "ai.error.degraded"}}
- **MEM-C-03**: Expected status 201 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI memory service is not available", "messageKey": "ai.error.degraded"}}
- **MEM-C-04**: Expected status 201 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI memory service is not available", "messageKey": "ai.error.degraded"}}
- **MEM-C-09**: Expected status 400 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI memory service is not available", "messageKey": "ai.error.degraded"}}
- **MEM-C-10**: Expected status 400 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI memory service is not available", "messageKey": "ai.error.degraded"}}
- **MEM-C-11**: Expected status 400 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI memory service is not available", "messageKey": "ai.error.degraded"}}

### `GET /api/v1/ai/memories` — 0/4 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| MEM-R-01 | List memories — happy path (no filters) | happy_path | 200 | 503 | FAIL |
| MEM-R-05 | List memories — empty list returns 200 with empty array | edge_case | 200 | 401 | FAIL |
| MEM-R-07 | List memories — company scoping (user cannot see other compa | edge_case | 200 | 401 | FAIL |
| MEM-R-08 | List memories — ordered by importance DESC then recency | happy_path | 200 | 503 | FAIL |

**Failure Details:**
- **MEM-R-01**: Expected status 200 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI memory service is not available", "messageKey": "ai.error.degraded"}}
- **MEM-R-05**: Expected status 200 got 401. Body: {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}
- **MEM-R-07**: Expected status 200 got 401. Body: {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}
- **MEM-R-08**: Expected status 200 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI memory service is not available", "messageKey": "ai.error.degraded"}}

### `GET /api/v1/ai/memories?category=PREFERENCE` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| MEM-R-02 | List memories — filter by category | happy_path | 200 | 503 | FAIL |

**Failure Details:**
- **MEM-R-02**: Expected status 200 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI memory service is not available", "messageKey": "ai.error.degraded"}}

### `GET /api/v1/ai/memories?search=invoice` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| MEM-R-03 | List memories — filter by search text | happy_path | 200 | 503 | FAIL |

**Failure Details:**
- **MEM-R-03**: Expected status 200 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI memory service is not available", "messageKey": "ai.error.degraded"}}

### `GET /api/v1/ai/memories?limit=2` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| MEM-R-04 | List memories — cursor-based pagination | happy_path | 200 | 503 | FAIL |

**Failure Details:**
- **MEM-R-04**: Expected status 200 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI memory service is not available", "messageKey": "ai.error.degraded"}}

### `GET /api/v1/ai/memories?category=BOGUS` — 1/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| MEM-R-06 | List memories — invalid category filter | validation_error | 400 | 400 | PASS |

### `PATCH /api/v1/ai/memories/{{memoryId}}` — 0/2 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| MEM-U-01 | Update memory — happy path (content change) | happy_path | 200 | 0 | FAIL |
| MEM-U-02 | Update memory — happy path (category change) | happy_path | 200 | 0 | FAIL |

**Failure Details:**
- **MEM-U-01**: Request error: invalid literal for int() with base 10: ''
- **MEM-U-02**: Request error: invalid literal for int() with base 10: ''

### `PATCH /api/v1/ai/memories/00000000-0000-0000-0000-000000000000` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| MEM-U-03 | Update memory — not found (wrong id) | edge_case | 404 | 503 | FAIL |

**Failure Details:**
- **MEM-U-03**: Expected status 404 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI memory service is not available", "messageKey": "ai.error.degraded"}}

### `PATCH /api/v1/ai/memories/{{userAMemoryId}}` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| MEM-U-04 | Update memory — ownership enforcement (other user's memory) | edge_case | 404 | 0 | FAIL |

**Failure Details:**
- **MEM-U-04**: Request error: invalid literal for int() with base 10: ''

### `PATCH /api/v1/ai/memories/not-a-uuid` — 1/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| MEM-U-05 | Update memory — invalid UUID param | validation_error | 400 | 400 | PASS |

### `DELETE /api/v1/ai/memories/{{memoryId}}` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| MEM-D-01 | Delete memory — happy path | happy_path | 204 | 0 | FAIL |

**Failure Details:**
- **MEM-D-01**: Request error: invalid literal for int() with base 10: ''

### `DELETE /api/v1/ai/memories/00000000-0000-0000-0000-000000000000` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| MEM-D-02 | Delete memory — not found | edge_case | 404 | 503 | FAIL |

**Failure Details:**
- **MEM-D-02**: Expected status 404 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI memory service is not available", "messageKey": "ai.error.degraded"}}

### `DELETE /api/v1/ai/memories/{{userAMemoryId}}` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| MEM-D-03 | Delete memory — ownership enforcement (other user's memory) | edge_case | 404 | 0 | FAIL |

**Failure Details:**
- **MEM-D-03**: Request error: invalid literal for int() with base 10: ''

### `POST /api/v1/ai/memories/forget-all` — 0/3 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| MEM-FA-01 | Forget all — happy path with existing memories | happy_path | 200 | 503 | FAIL |
| MEM-FA-02 | Forget all — no memories returns deletedCount 0 | edge_case | 200 | 503 | FAIL |
| MEM-FA-03 | Forget all — does not delete other company's memories | edge_case | 200 | 401 | FAIL |

**Failure Details:**
- **MEM-FA-01**: Expected status 200 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI memory service is not available", "messageKey": "ai.error.degraded"}}
- **MEM-FA-02**: Expected status 200 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI memory service is not available", "messageKey": "ai.error.degraded"}}
- **MEM-FA-03**: Expected status 200 got 401. Body: {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}

### `GET /api/v1/ai/memories/settings` — 1/2 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| MEM-S-R-01 | Get settings — happy path (existing settings) | happy_path | 200 | 200 | PASS |
| MEM-S-R-02 | Get settings — lazy upsert creates defaults for new user | happy_path | 200 | 401 | FAIL |

**Failure Details:**
- **MEM-S-R-02**: Expected status 200 got 401. Body: {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}

### `PATCH /api/v1/ai/memories/settings` — 6/6 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| MEM-S-U-01 | Update settings — toggle isEnabled off | happy_path | 200 | 200 | PASS |
| MEM-S-U-02 | Update settings — change enabled categories | happy_path | 200 | 200 | PASS |
| MEM-S-U-03 | Update settings — change retentionDays | happy_path | 200 | 200 | PASS |
| MEM-S-U-04 | Update settings — retentionDays below minimum (0) | validation_error | 400 | 400 | PASS |
| MEM-S-U-05 | Update settings — retentionDays above maximum (3651) | validation_error | 400 | 400 | PASS |
| MEM-S-U-06 | Update settings — maxMemories below minimum (5) | validation_error | 400 | 400 | PASS |

### `POST /api/v1/ai/skills` — 0/4 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| SKL-C-01 | Create skill — happy path | happy_path | 201 | 401 | FAIL |
| SKL-C-02 | Create skill — missing required fields | validation_error | 400 | 401 | FAIL |
| SKL-C-03 | Create skill — ADMIN role rejected (requires SUPER_ADMIN) | edge_case | 403 | N/A | SKIP |
| SKL-C-04 | Create skill — empty triggerPhrases array | validation_error | 400 | 401 | FAIL |

**Failure Details:**
- **SKL-C-01**: Expected status 201 got 401. Body: {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}
- **SKL-C-02**: Expected status 400 got 401. Body: {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}
- **SKL-C-04**: Expected status 400 got 401. Body: {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}

### `GET /api/v1/ai/skills` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| SKL-R-01 | List skills — happy path (all skills) | happy_path | 200 | 503 | FAIL |

**Failure Details:**
- **SKL-R-01**: Expected status 200 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI skills service is not available", "messageKey": "ai.error.degraded"}}

### `GET /api/v1/ai/skills?moduleKey=views` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| SKL-R-02 | List skills — filter by moduleKey=views | happy_path | 200 | 503 | FAIL |

**Failure Details:**
- **SKL-R-02**: Expected status 200 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI skills service is not available", "messageKey": "ai.error.degraded"}}

### `GET /api/v1/ai/skills?moduleKey=nonexistent` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| SKL-R-03 | List skills — non-existent moduleKey returns empty | edge_case | 200 | 503 | FAIL |

**Failure Details:**
- **SKL-R-03**: Expected status 200 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI skills service is not available", "messageKey": "ai.error.degraded"}}

### `GET /api/v1/ai/skills/{{skillId}}` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| SKL-R-04 | Get skill by ID — happy path | happy_path | 200 | 0 | FAIL |

**Failure Details:**
- **SKL-R-04**: Request error: invalid literal for int() with base 10: ''

### `GET /api/v1/ai/skills/00000000-0000-0000-0000-000000000000` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| SKL-R-05 | Get skill by ID — not found | edge_case | 404 | 503 | FAIL |

**Failure Details:**
- **SKL-R-05**: Expected status 404 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI skills service is not available", "messageKey": "ai.error.degraded"}}

### `PATCH /api/v1/ai/skills/{{skillId}}` — 0/2 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| SKL-U-01 | Update skill — happy path (description change) | happy_path | 200 | 0 | FAIL |
| SKL-U-03 | Update skill — STAFF role rejected (requires ADMIN) | edge_case | 403 | N/A | SKIP |

**Failure Details:**
- **SKL-U-01**: Request error: invalid literal for int() with base 10: ''

### `PATCH /api/v1/ai/skills/00000000-0000-0000-0000-000000000000` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| SKL-U-02 | Update skill — not found | edge_case | 404 | 401 | FAIL |

**Failure Details:**
- **SKL-U-02**: Expected status 404 got 401. Body: {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}

### `DELETE /api/v1/ai/skills/{{skillId}}` — 0/2 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| SKL-D-01 | Delete skill — happy path | happy_path | 204 | 0 | FAIL |
| SKL-D-03 | Delete skill — STAFF role rejected | edge_case | 403 | N/A | SKIP |

**Failure Details:**
- **SKL-D-01**: Request error: invalid literal for int() with base 10: ''

### `DELETE /api/v1/ai/skills/00000000-0000-0000-0000-000000000000` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| SKL-D-02 | Delete skill — not found | edge_case | 404 | 401 | FAIL |

**Failure Details:**
- **SKL-D-02**: Expected status 404 got 401. Body: {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}

### `GET /api/v1/ai/skill-overrides` — 0/3 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| OVR-R-01 | List overrides — happy path | happy_path | 200 | 401 | FAIL |
| OVR-R-02 | List overrides — empty when no overrides exist | edge_case | 200 | 401 | FAIL |
| OVR-R-03 | List overrides — STAFF role rejected | edge_case | 403 | N/A | SKIP |

**Failure Details:**
- **OVR-R-01**: Expected status 200 got 401. Body: {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}
- **OVR-R-02**: Expected status 200 got 401. Body: {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}

### `PUT /api/v1/ai/skill-overrides/{{skillId}}` — 0/2 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| OVR-C-01 | Upsert override — create new override | happy_path | 200 | 0 | FAIL |
| OVR-C-02 | Upsert override — update existing override | happy_path | 200 | 0 | FAIL |

**Failure Details:**
- **OVR-C-01**: Request error: invalid literal for int() with base 10: ''
- **OVR-C-02**: Request error: invalid literal for int() with base 10: ''

### `PUT /api/v1/ai/skill-overrides/00000000-0000-0000-0000-000000000000` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| OVR-C-03 | Upsert override — skill not found | edge_case | 404 | 401 | FAIL |

**Failure Details:**
- **OVR-C-03**: Expected status 404 got 401. Body: {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}

### `DELETE /api/v1/ai/skill-overrides/{{skillId}}` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| OVR-D-01 | Delete override — happy path | happy_path | 204 | 0 | FAIL |

**Failure Details:**
- **OVR-D-01**: Request error: invalid literal for int() with base 10: ''

### `DELETE /api/v1/ai/skill-overrides/00000000-0000-0000-0000-000000000000` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| OVR-D-02 | Delete override — not found | edge_case | 404 | 401 | FAIL |

**Failure Details:**
- **OVR-D-02**: Expected status 404 got 401. Body: {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}

### `POST /api/v1/ai/knowledge` — 0/3 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| KNW-C-01 | Create knowledge — happy path | happy_path | 201 | 401 | FAIL |
| KNW-C-02 | Create knowledge — missing required fields | validation_error | 400 | 401 | FAIL |
| KNW-C-03 | Create knowledge — STAFF role rejected | edge_case | 403 | N/A | SKIP |

**Failure Details:**
- **KNW-C-01**: Expected status 201 got 401. Body: {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}
- **KNW-C-02**: Expected status 400 got 401. Body: {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}

### `GET /api/v1/ai/knowledge` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| KNW-R-01 | List knowledge — happy path (no filters) | happy_path | 200 | 503 | FAIL |

**Failure Details:**
- **KNW-R-01**: Expected status 200 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI knowledge service is not available", "messageKey": "ai.error.degraded"}}

### `GET /api/v1/ai/knowledge?moduleKey=views` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| KNW-R-02 | List knowledge — filter by moduleKey | happy_path | 200 | 503 | FAIL |

**Failure Details:**
- **KNW-R-02**: Expected status 200 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI knowledge service is not available", "messageKey": "ai.error.degraded"}}

### `GET /api/v1/ai/knowledge?type=ENTITIES` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| KNW-R-03 | List knowledge — filter by type | happy_path | 200 | 503 | FAIL |

**Failure Details:**
- **KNW-R-03**: Expected status 200 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI knowledge service is not available", "messageKey": "ai.error.degraded"}}

### `GET /api/v1/ai/knowledge?moduleKey=nonexistent` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| KNW-R-04 | List knowledge — empty result for unknown module | edge_case | 200 | 503 | FAIL |

**Failure Details:**
- **KNW-R-04**: Expected status 200 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI knowledge service is not available", "messageKey": "ai.error.degraded"}}

### `GET /api/v1/ai/knowledge/{{knowledgeId}}` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| KNW-R-05 | Get knowledge by ID — happy path | happy_path | 200 | 0 | FAIL |

**Failure Details:**
- **KNW-R-05**: Request error: invalid literal for int() with base 10: ''

### `GET /api/v1/ai/knowledge/00000000-0000-0000-0000-000000000000` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| KNW-R-06 | Get knowledge by ID — not found | edge_case | 404 | 503 | FAIL |

**Failure Details:**
- **KNW-R-06**: Expected status 404 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI knowledge service is not available", "messageKey": "ai.error.degraded"}}

### `PATCH /api/v1/ai/knowledge/{{knowledgeId}}` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| KNW-U-01 | Update knowledge — happy path | happy_path | 200 | 0 | FAIL |

**Failure Details:**
- **KNW-U-01**: Request error: invalid literal for int() with base 10: ''

### `PATCH /api/v1/ai/knowledge/00000000-0000-0000-0000-000000000000` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| KNW-U-02 | Update knowledge — not found | edge_case | 404 | 401 | FAIL |

**Failure Details:**
- **KNW-U-02**: Expected status 404 got 401. Body: {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}

### `DELETE /api/v1/ai/knowledge/{{knowledgeId}}` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| KNW-D-01 | Delete knowledge — happy path | happy_path | 204 | 0 | FAIL |

**Failure Details:**
- **KNW-D-01**: Request error: invalid literal for int() with base 10: ''

### `DELETE /api/v1/ai/knowledge/00000000-0000-0000-0000-000000000000` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| KNW-D-02 | Delete knowledge — not found | edge_case | 404 | 401 | FAIL |

**Failure Details:**
- **KNW-D-02**: Expected status 404 got 401. Body: {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}

### `POST /api/v1/ai/entity-triggers` — 0/3 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| TRG-C-01 | Create entity trigger — happy path | happy_path | 201 | 401 | FAIL |
| TRG-C-02 | Create entity trigger — missing required fields | validation_error | 400 | 401 | FAIL |
| TRG-C-03 | Create entity trigger — STAFF role rejected | edge_case | 403 | N/A | SKIP |

**Failure Details:**
- **TRG-C-01**: Expected status 201 got 401. Body: {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}
- **TRG-C-02**: Expected status 400 got 401. Body: {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}

### `GET /api/v1/ai/entity-triggers` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| TRG-R-01 | List entity triggers — happy path | happy_path | 200 | 503 | FAIL |

**Failure Details:**
- **TRG-R-01**: Expected status 200 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI entity trigger service is not available", "messageKey": "ai.error.degraded"}}

### `GET /api/v1/ai/entity-triggers?moduleKey=views` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| TRG-R-02 | List entity triggers — filter by moduleKey | happy_path | 200 | 503 | FAIL |

**Failure Details:**
- **TRG-R-02**: Expected status 200 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI entity trigger service is not available", "messageKey": "ai.error.degraded"}}

### `GET /api/v1/ai/entity-triggers?isActive=true` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| TRG-R-03 | List entity triggers — filter isActive=true | happy_path | 200 | 503 | FAIL |

**Failure Details:**
- **TRG-R-03**: Expected status 200 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI entity trigger service is not available", "messageKey": "ai.error.degraded"}}

### `GET /api/v1/ai/entity-triggers/{{triggerId}}` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| TRG-R-04 | Get entity trigger by ID — happy path | happy_path | 200 | 0 | FAIL |

**Failure Details:**
- **TRG-R-04**: Request error: invalid literal for int() with base 10: ''

### `GET /api/v1/ai/entity-triggers/00000000-0000-0000-0000-000000000000` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| TRG-R-05 | Get entity trigger by ID — not found | edge_case | 404 | 503 | FAIL |

**Failure Details:**
- **TRG-R-05**: Expected status 404 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI entity trigger service is not available", "messageKey": "ai.error.degraded"}}

### `PATCH /api/v1/ai/entity-triggers/{{triggerId}}` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| TRG-U-01 | Update entity trigger — happy path | happy_path | 200 | 0 | FAIL |

**Failure Details:**
- **TRG-U-01**: Request error: invalid literal for int() with base 10: ''

### `PATCH /api/v1/ai/entity-triggers/00000000-0000-0000-0000-000000000000` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| TRG-U-02 | Update entity trigger — not found | edge_case | 404 | 401 | FAIL |

**Failure Details:**
- **TRG-U-02**: Expected status 404 got 401. Body: {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}

### `DELETE /api/v1/ai/entity-triggers/{{triggerId}}` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| TRG-D-01 | Delete entity trigger — happy path | happy_path | 204 | 0 | FAIL |

**Failure Details:**
- **TRG-D-01**: Request error: invalid literal for int() with base 10: ''

### `DELETE /api/v1/ai/entity-triggers/00000000-0000-0000-0000-000000000000` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| TRG-D-02 | Delete entity trigger — not found | edge_case | 404 | 401 | FAIL |

**Failure Details:**
- **TRG-D-02**: Expected status 404 got 401. Body: {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}

### `GET /api/v1/ai/entity-search?type=DataView&q=in` — 0/2 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| SRCH-01 | Entity search — happy path (DataView) | happy_path | 200 | 503 | FAIL |
| SRCH-10 | Entity search — companyId scoping | edge_case | 200 | 401 | FAIL |

**Failure Details:**
- **SRCH-01**: Expected status 200 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI entity search service is not available", "messageKey": "ai.error.degraded"}}
- **SRCH-10**: Expected status 200 got 401. Body: {"success": false, "error": {"code": "UNAUTHORIZED", "message": "Authentication required"}}

### `GET /api/v1/ai/entity-search?type=SavedView&q=ov` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| SRCH-02 | Entity search — happy path (SavedView) | happy_path | 200 | 503 | FAIL |

**Failure Details:**
- **SRCH-02**: Expected status 200 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI entity search service is not available", "messageKey": "ai.error.degraded"}}

### `GET /api/v1/ai/entity-search?type=SavedView&q=ov&scopeBy=viewKey&scopeValue=00000000-0000-0000-0000-000000000001` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| SRCH-03 | Entity search — with scope params | happy_path | 200 | 400 | FAIL |

**Failure Details:**
- **SRCH-03**: Expected status 200 got 400. Body: {"success": false, "error": {"code": "VALIDATION_ERROR", "message": "Please correct the errors below", "messageKey": "errors:VALIDATION_ERROR", "details": {"scopeVal

### `GET /api/v1/ai/entity-search?type=DataView&q=vi` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| SRCH-04 | Entity search — max 8 results | edge_case | 200 | 503 | FAIL |

**Failure Details:**
- **SRCH-04**: Expected status 200 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI entity search service is not available", "messageKey": "ai.error.degraded"}}

### `GET /api/v1/ai/entity-search?type=UnknownEntity&q=test` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| SRCH-05 | Entity search — unknown entity type | edge_case | 404 | 503 | FAIL |

**Failure Details:**
- **SRCH-05**: Expected status 404 got 503. Body: {"success": false, "error": {"code": "AI_DEGRADED", "message": "AI entity search service is not available", "messageKey": "ai.error.degraded"}}

### `GET /api/v1/ai/entity-search?type=DataView&q=a` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| SRCH-06 | Entity search — query too short (1 char) | validation_error | 400 | 429 | FAIL |

**Failure Details:**
- **SRCH-06**: Expected status 400 got 429. Body: {"success": false, "error": {"code": "RATE_LIMITED", "message": "Rate limit exceeded, retry in 10 seconds", "messageKey": "errors:RATE_LIMITED"}}

### `GET /api/v1/ai/entity-search?q=test` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| SRCH-07 | Entity search — missing type parameter | validation_error | 400 | 429 | FAIL |

**Failure Details:**
- **SRCH-07**: Expected status 400 got 429. Body: {"success": false, "error": {"code": "RATE_LIMITED", "message": "Rate limit exceeded, retry in 10 seconds", "messageKey": "errors:RATE_LIMITED"}}

### `GET /api/v1/ai/entity-search?type=DataView&q=test&scopeBy=viewKey` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| SRCH-08 | Entity search — scopeBy without scopeValue rejected | validation_error | 400 | 429 | FAIL |

**Failure Details:**
- **SRCH-08**: Expected status 400 got 429. Body: {"success": false, "error": {"code": "RATE_LIMITED", "message": "Rate limit exceeded, retry in 10 seconds", "messageKey": "errors:RATE_LIMITED"}}

### `GET /api/v1/ai/entity-search?type=DataView&q=zzzznonexistent` — 0/1 passed

| Test ID | Test Name | Type | Expected | Actual | Status |
|---------|-----------|------|----------|--------|--------|
| SRCH-09 | Entity search — empty results returns empty array | edge_case | 200 | 429 | FAIL |

**Failure Details:**
- **SRCH-09**: Expected status 200 got 429. Body: {"success": false, "error": {"code": "RATE_LIMITED", "message": "Rate limit exceeded, retry in 10 seconds", "messageKey": "errors:RATE_LIMITED"}}

## Recommendations

1. **Set `PLATFORM_SERVICE_TOKEN`** to enable the AI module and unblock 33 tests returning 503
2. **Fix route prefix** in test plan — change `/api/v1/ai/*` to `/*` to match actual Fastify routes
3. **Create test users** with STAFF and ADMIN roles to validate RBAC permission guards (6 skipped tests)
4. **Increase rate limit** for test environment or add delays between requests (4 tests hit 429)
5. **Investigate 401 errors** on POST/PATCH/DELETE for skills, knowledge, triggers, and overrides — likely RBAC guard issue or token not including required permissions
6. **Run with `--run-tests` after env setup** to get accurate pass/fail on the 33 degraded + 18 dependent tests
