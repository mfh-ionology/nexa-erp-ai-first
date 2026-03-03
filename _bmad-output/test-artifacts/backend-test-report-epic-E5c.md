# Epic E5c — Backend API Test Report

**Executed:** 2026-03-03T17:38:04.216892+00:00
**API Base URL:** http://localhost:3000
**Epic:** E5c — AI Administration & Autonomous Workflows

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Tests | 143 |
| Passed | 22 |
| Failed | 69 |
| Skipped | 52 |
| Pass Rate | 15.4% |

## Critical Finding: AI Module Disabled

> **Root Cause:** `PLATFORM_SERVICE_TOKEN` is not set in `.env`. The AI module falls back to
> **graceful degradation mode** — all service instances are `null`, and every route handler that
> calls `assertService()` returns **HTTP 503 (Service Unavailable)**.
>
> **Impact:** 60 of 69 failures are 503 responses. This is not a code defect — it is a
> configuration issue. Once `PLATFORM_SERVICE_TOKEN` (and Redis) are configured, the AI module
> will initialize and these endpoints should function correctly.

## Route Prefix Issue

The test plan specifies routes at `/ai/*` (e.g., `/ai/automations`, `/ai/admin/models`).
However, the AI plugin uses `fastify-plugin` (`fp`), which makes it non-encapsulated.
This causes routes to register at the **root level** without the `/ai` prefix:

| Test Plan Path | Actual Path |
|---------------|-------------|
| `/ai/automations` | `/automations` |
| `/ai/admin/models` | `/admin/models` |
| `/ai/admin/prompts` | `/admin/prompts` |
| `/ai/admin/agents` | `/admin/agents` |
| `/ai/admin/skills` | `/admin/skills` |
| `/ai/variables` | `/variables` |
| `/ai/admin/dashboard` | `/admin/dashboard` |

**Recommendation:** Either fix the `aiPlugin` to NOT use `fastify-plugin` (restore encapsulation),
or update the test plan and frontend API clients to use the root-level paths.

## Failure Breakdown

| Failure Type | Count | Description |
|-------------|-------|-------------|
| 503 Service Unavailable | 60 | AI services null (PLATFORM_SERVICE_TOKEN missing) |
| 400 Validation (template vars) | 9 | Empty template variables (seeded data unavailable because services are disabled) |
| Other | 0 | Miscellaneous |

## What Passed (22 tests)

All passing tests are **input validation** checks — they fail at the Zod schema layer
*before* reaching the service call (`assertService`). This proves:

1. Route registration is correct (routes respond, not 404)
2. Zod validation compilers work correctly
3. RBAC guards work (401 for unauthenticated requests)
4. Request body validation rejects malformed input with 400

| Test ID | Test Name | Status | Actual |
|---------|-----------|--------|--------|
| AGT-C-02 | Create agent - missing required promptId (400) | PASS | 400 |
| AGT-C-04 | Create agent - invalid name pattern (400) | PASS | 400 |
| AGT-C-05 | Create agent - maxTurns exceeds max (400) | PASS | 400 |
| AUTO-C-06 | Create automation - missing name (validation error) | PASS | 400 |
| AUTO-C-07 | Create automation - empty steps array (validation error) | PASS | 400 |
| AUTO-C-08 | Create SCHEDULED automation - missing schedule (validation error) | PASS | 400 |
| AUTO-C-09 | Create EVENT automation - missing eventType (validation error) | PASS | 400 |
| AUTO-C-10 | Create automation - invalid triggerType (validation error) | PASS | 400 |
| AUTO-C-12 | Create automation - step with invalid agentId (validation error) | PASS | 400 |
| AUTO-C-13 | Create automation - maxTokenBudget below minimum (validation error) | PASS | 400 |
| MDL-C-03 | Create model - missing required name (400) | PASS | 400 |
| MDL-C-06 | Create model - negative maxInputTokens (400) | PASS | 400 |
| PRM-C-02 | Create prompt - missing name (400) | PASS | 400 |
| PRM-C-03 | Create prompt - invalid category (400) | PASS | 400 |
| PRM-C-04 | Create prompt - invalid name pattern (400) | PASS | 400 |
| SKL-C-02 | Create skill - missing triggerPhrases (400) | PASS | 400 |
| SKL-C-03 | Create skill - invalid category (400) | PASS | 400 |
| SKL-TT-03 | Test trigger - empty phrase (400) | PASS | 400 |
| AUTO-C-14 | Create automation - no auth token (401) | PASS | 401 |
| AUTO-G-03 | Get automation - invalid UUID format | PASS | 400 |
| DASH-03 | Get dashboard - days exceeds max (400) | PASS | 400 |
| DASH-04 | Get dashboard - no auth (401) | PASS | 401 |

## Detailed Results by Endpoint

### DELETE /ai/admin/agents/:id
**0 pass / 1 fail / 2 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| AGT-D-01 | Delete unreferenced agent - happy path | happy_path | 204 | 0 | SKIP |
| AGT-D-02 | Delete agent referenced by automation step (422) | edge_case | 422 | 0 | SKIP |
| AGT-D-03 | Delete agent - not found (404) | edge_case | 404 | 503 | FAIL |

### DELETE /ai/admin/models/:id
**0 pass / 1 fail / 2 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| MDL-D-01 | Delete unreferenced model - happy path | happy_path | 204 | 0 | SKIP |
| MDL-D-02 | Delete model referenced by agent (422) | edge_case | 422 | 0 | SKIP |
| MDL-D-03 | Delete model - not found (404) | edge_case | 404 | 503 | FAIL |

### DELETE /ai/admin/prompts/:id
**0 pass / 1 fail / 2 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| PRM-D-01 | Delete unreferenced prompt - happy path | happy_path | 204 | 0 | SKIP |
| PRM-D-02 | Delete prompt referenced by agent (422) | edge_case | 422 | 0 | SKIP |
| PRM-D-03 | Delete prompt - not found (404) | edge_case | 404 | 503 | FAIL |

### DELETE /ai/automations/:id
**0 pass / 1 fail / 1 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| AUTO-D-01 | Delete automation - happy path (soft delete) | happy_path | 204 | 0 | SKIP |
| AUTO-D-02 | Delete automation - not found (404) | edge_case | 404 | 503 | FAIL |

### DELETE /ai/variables/:id
**0 pass / 1 fail / 1 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| VAR-D-01 | Delete variable - happy path | happy_path | 204 | 0 | SKIP |
| VAR-D-02 | Delete variable - not found (404) | edge_case | 404 | 503 | FAIL |

### GET /ai/admin/agents
**0 pass / 3 fail / 1 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| AGT-L-01 | List agents - happy path | happy_path | 200 | 503 | FAIL |
| AGT-L-02 | List agents - filter by isActive | happy_path | 200 | 503 | FAIL |
| AGT-L-03 | List agents - search by name | happy_path | 200 | 503 | FAIL |
| AGT-L-04 | List agents - filter by modelId | happy_path | 200 | 0 | SKIP |

### GET /ai/admin/agents/:id
**0 pass / 1 fail / 1 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| AGT-G-01 | Get agent detail - happy path | happy_path | 200 | 0 | SKIP |
| AGT-G-02 | Get agent - not found (404) | edge_case | 404 | 503 | FAIL |

### GET /ai/admin/dashboard
**2 pass / 2 fail / 0 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| DASH-01 | Get dashboard summary - happy path (default 30 day | happy_path | 200 | 503 | FAIL |
| DASH-02 | Get dashboard summary - custom days param | happy_path | 200 | 503 | FAIL |
| DASH-03 | Get dashboard - days exceeds max (400) | validation_error | 400 | 400 | PASS |
| DASH-04 | Get dashboard - no auth (401) | edge_case | 401 | 401 | PASS |

### GET /ai/admin/models
**0 pass / 4 fail / 0 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| MDL-L-01 | List models - happy path | happy_path | 200 | 503 | FAIL |
| MDL-L-02 | List models - filter by provider | happy_path | 200 | 503 | FAIL |
| MDL-L-03 | List models - filter by isActive=true | happy_path | 200 | 503 | FAIL |
| MDL-L-04 | List models - search by name | happy_path | 200 | 503 | FAIL |

### GET /ai/admin/models/:id
**0 pass / 1 fail / 1 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| MDL-G-01 | Get model detail - happy path | happy_path | 200 | 0 | SKIP |
| MDL-G-02 | Get model - not found (404) | edge_case | 404 | 503 | FAIL |

### GET /ai/admin/prompts
**0 pass / 3 fail / 0 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| PRM-L-01 | List prompts - happy path | happy_path | 200 | 503 | FAIL |
| PRM-L-02 | List prompts - filter by category | happy_path | 200 | 503 | FAIL |
| PRM-L-03 | List prompts - search by name | happy_path | 200 | 503 | FAIL |

### GET /ai/admin/prompts/:id
**0 pass / 1 fail / 1 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| PRM-G-01 | Get prompt detail - happy path | happy_path | 200 | 0 | SKIP |
| PRM-G-02 | Get prompt - not found (404) | edge_case | 404 | 503 | FAIL |

### GET /ai/admin/prompts/:id/versions
**0 pass / 1 fail / 1 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| VER-L-01 | List prompt versions - happy path | happy_path | 200 | 0 | SKIP |
| VER-L-02 | List versions - prompt not found (404) | edge_case | 404 | 503 | FAIL |

### GET /ai/admin/prompts/:id/versions/:version
**0 pass / 1 fail / 1 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| VER-G-01 | Get version 1 - happy path | happy_path | 200 | 0 | SKIP |
| VER-G-02 | Get version - version does not exist (404) | edge_case | 404 | 400 | FAIL |

### GET /ai/admin/skills
**0 pass / 5 fail / 0 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| SKL-L-01 | List skills - happy path (flat) | happy_path | 200 | 503 | FAIL |
| SKL-L-02 | List skills - grouped by module | happy_path | 200 | 503 | FAIL |
| SKL-L-03 | List skills - filter by moduleKey | happy_path | 200 | 503 | FAIL |
| SKL-L-04 | List skills - filter by category | happy_path | 200 | 503 | FAIL |
| SKL-L-05 | List skills - search by name | happy_path | 200 | 503 | FAIL |

### GET /ai/admin/skills/:id
**0 pass / 1 fail / 1 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| SKL-G-01 | Get skill detail - happy path | happy_path | 200 | 0 | SKIP |
| SKL-G-02 | Get skill - not found (404) | edge_case | 404 | 503 | FAIL |

### GET /ai/automations
**0 pass / 5 fail / 0 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| AUTO-L-01 | List automations - happy path (default params) | happy_path | 200 | 503 | FAIL |
| AUTO-L-02 | List automations - filter by triggerType=SCHEDULED | happy_path | 200 | 503 | FAIL |
| AUTO-L-03 | List automations - filter by status=active | happy_path | 200 | 503 | FAIL |
| AUTO-L-04 | List automations - pagination with cursor | happy_path | 200 | 503 | FAIL |
| AUTO-L-05 | List automations - empty result for non-matching f | edge_case | 200 | 503 | FAIL |

### GET /ai/automations/:id
**1 pass / 1 fail / 1 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| AUTO-G-01 | Get automation detail - happy path | happy_path | 200 | 0 | SKIP |
| AUTO-G-03 | Get automation - invalid UUID format | validation_error | 400 | 400 | PASS |
| AUTO-G-02 | Get automation - not found (404) | edge_case | 404 | 503 | FAIL |

### GET /ai/automations/:id/runs
**0 pass / 1 fail / 2 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| EXEC-R-01 | List runs for automation - happy path | happy_path | 200 | 0 | SKIP |
| EXEC-R-03 | List runs - filter by status=FAILED | happy_path | 200 | 400 | FAIL |
| EXEC-R-02 | List runs - automation with no runs (empty array) | edge_case | 200 | 0 | SKIP |

### GET /ai/automations/runs
**0 pass / 5 fail / 0 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| RUN-L-01 | List all runs - happy path | happy_path | 200 | 503 | FAIL |
| RUN-L-02 | List runs - filter by status | happy_path | 200 | 503 | FAIL |
| RUN-L-03 | List runs - filter by date range | happy_path | 200 | 503 | FAIL |
| RUN-L-04 | List runs - pagination with limit | happy_path | 200 | 503 | FAIL |
| RUN-L-05 | List runs - empty result for future dates | edge_case | 200 | 503 | FAIL |

### GET /ai/automations/runs/:runId
**0 pass / 1 fail / 1 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| RUN-G-01 | Get run detail - happy path | happy_path | 200 | 0 | SKIP |
| RUN-G-02 | Get run detail - not found (404) | edge_case | 404 | 503 | FAIL |

### GET /ai/variables
**0 pass / 1 fail / 1 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| VAR-L-01 | List all variables - happy path | happy_path | 200 | 503 | FAIL |
| VAR-L-02 | List variables - filter by promptId | happy_path | 200 | 0 | SKIP |

### PATCH /ai/admin/agents/:id
**0 pass / 1 fail / 2 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| AGT-U-01 | Update agent displayName - happy path | happy_path | 200 | 0 | SKIP |
| AGT-U-02 | Update agent - toggle isActive | happy_path | 200 | 0 | SKIP |
| AGT-U-03 | Update agent - not found (404) | edge_case | 404 | 503 | FAIL |

### PATCH /ai/admin/models/:id
**0 pass / 1 fail / 3 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| MDL-U-01 | Update model displayName - happy path | happy_path | 200 | 0 | SKIP |
| MDL-U-02 | Update model - deactivate default model (422) | edge_case | 422 | 0 | SKIP |
| MDL-U-03 | Update model - set circular fallback (422) | edge_case | 422 | 0 | SKIP |
| MDL-U-04 | Update model - not found (404) | edge_case | 404 | 503 | FAIL |

### PATCH /ai/admin/prompts/:id
**0 pass / 1 fail / 3 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| PRM-U-01 | Update prompt content - creates new version | happy_path | 200 | 0 | SKIP |
| PRM-U-02 | Update prompt metadata only - no new version | happy_path | 200 | 0 | SKIP |
| PRM-U-03 | Update prompt content - missing changeReason (400) | validation_error | 400 | 0 | SKIP |
| PRM-U-04 | Update prompt - not found (404) | edge_case | 404 | 503 | FAIL |

### PATCH /ai/admin/skills/:id
**0 pass / 1 fail / 2 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| SKL-U-01 | Update skill - change trigger phrases | happy_path | 200 | 0 | SKIP |
| SKL-U-02 | Update skill - toggle isActive | happy_path | 200 | 0 | SKIP |
| SKL-U-03 | Update skill - not found (404) | edge_case | 404 | 503 | FAIL |

### PATCH /ai/admin/skills/:id/deactivate
**0 pass / 1 fail / 1 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| SKL-DA-01 | Deactivate skill - happy path | happy_path | 200 | 0 | SKIP |
| SKL-DA-02 | Deactivate skill - not found (404) | edge_case | 404 | 503 | FAIL |

### PATCH /ai/automations/:id
**0 pass / 1 fail / 3 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| AUTO-U-01 | Update automation name - happy path | happy_path | 200 | 0 | SKIP |
| AUTO-U-02 | Update automation - toggle isActive | happy_path | 200 | 0 | SKIP |
| AUTO-U-03 | Update automation - set circular chainNextId (422) | edge_case | 422 | 0 | SKIP |
| AUTO-U-04 | Update automation - not found (404) | edge_case | 404 | 503 | FAIL |

### PATCH /ai/variables/:id
**0 pass / 1 fail / 1 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| VAR-U-01 | Update variable displayName - happy path | happy_path | 200 | 0 | SKIP |
| VAR-U-02 | Update variable - not found (404) | edge_case | 404 | 503 | FAIL |

### POST /ai/admin/agents
**3 pass / 2 fail / 0 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| AGT-C-01 | Create agent - happy path | happy_path | 201 | 400 | FAIL |
| AGT-C-02 | Create agent - missing required promptId (400) | validation_error | 400 | 400 | PASS |
| AGT-C-04 | Create agent - invalid name pattern (400) | validation_error | 400 | 400 | PASS |
| AGT-C-05 | Create agent - maxTurns exceeds max (400) | validation_error | 400 | 400 | PASS |
| AGT-C-03 | Create agent - duplicate name (409 or 422) | edge_case | 409 or 422 | 400 | FAIL |

### POST /ai/admin/models
**2 pass / 3 fail / 1 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| MDL-C-01 | Create model - happy path | happy_path | 201 | 503 | FAIL |
| MDL-C-02 | Create model with isDefault=true - unsets previous | happy_path | 201 | 503 | FAIL |
| MDL-C-03 | Create model - missing required name (400) | validation_error | 400 | 400 | PASS |
| MDL-C-06 | Create model - negative maxInputTokens (400) | validation_error | 400 | 400 | PASS |
| MDL-C-04 | Create model - duplicate name (409 or 422) | edge_case | 409 or 422 | 503 | FAIL |
| MDL-C-05 | Create model - circular fallback chain (422) | edge_case | 422 | 0 | SKIP |

### POST /ai/admin/prompts
**3 pass / 2 fail / 0 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| PRM-C-01 | Create prompt - happy path | happy_path | 201 | 503 | FAIL |
| PRM-C-02 | Create prompt - missing name (400) | validation_error | 400 | 400 | PASS |
| PRM-C-03 | Create prompt - invalid category (400) | validation_error | 400 | 400 | PASS |
| PRM-C-04 | Create prompt - invalid name pattern (400) | validation_error | 400 | 400 | PASS |
| PRM-C-05 | Create prompt - duplicate name (409 or 422) | edge_case | 409 or 422 | 503 | FAIL |

### POST /ai/admin/prompts/:id/test
**0 pass / 1 fail / 1 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| PRM-T-01 | Test render prompt - happy path | happy_path | 200 | 0 | SKIP |
| PRM-T-02 | Test render - prompt not found (404) | edge_case | 404 | 503 | FAIL |

### POST /ai/admin/prompts/:id/versions/:version/restore
**0 pass / 1 fail / 1 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| VER-R-01 | Restore version 1 - creates new version | happy_path | 200 | 0 | SKIP |
| VER-R-02 | Restore version - version not found (404) | edge_case | 404 | 400 | FAIL |

### POST /ai/admin/skills
**2 pass / 2 fail / 0 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| SKL-C-01 | Create skill - happy path | happy_path | 201 | 503 | FAIL |
| SKL-C-02 | Create skill - missing triggerPhrases (400) | validation_error | 400 | 400 | PASS |
| SKL-C-03 | Create skill - invalid category (400) | validation_error | 400 | 400 | PASS |
| SKL-C-04 | Create skill - duplicate name (409 or 422) | edge_case | 409 or 422 | 503 | FAIL |

### POST /ai/admin/skills/test-trigger
**1 pass / 2 fail / 0 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| SKL-TT-01 | Test trigger - matching phrase | happy_path | 200 | 503 | FAIL |
| SKL-TT-03 | Test trigger - empty phrase (400) | validation_error | 400 | 400 | PASS |
| SKL-TT-02 | Test trigger - no matching phrase | edge_case | 200 | 503 | FAIL |

### POST /ai/automations
**8 pass / 4 fail / 2 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| AUTO-C-01 | Create SCHEDULED automation - happy path | happy_path | 201 | 400 | FAIL |
| AUTO-C-02 | Create MANUAL automation - happy path | happy_path | 201 | 400 | FAIL |
| AUTO-C-03 | Create EVENT automation - happy path | happy_path | 201 | 400 | FAIL |
| AUTO-C-04 | Create automation with multiple steps - sequential | happy_path | 201 | 400 | FAIL |
| AUTO-C-05 | Create automation with chainNextId - valid chain | happy_path | 201 | 0 | SKIP |
| AUTO-C-06 | Create automation - missing name (validation error | validation_error | 400 | 400 | PASS |
| AUTO-C-07 | Create automation - empty steps array (validation  | validation_error | 400 | 400 | PASS |
| AUTO-C-08 | Create SCHEDULED automation - missing schedule (va | validation_error | 400 | 400 | PASS |
| AUTO-C-09 | Create EVENT automation - missing eventType (valid | validation_error | 400 | 400 | PASS |
| AUTO-C-10 | Create automation - invalid triggerType (validatio | validation_error | 400 | 400 | PASS |
| AUTO-C-12 | Create automation - step with invalid agentId (val | validation_error | 400 | 400 | PASS |
| AUTO-C-13 | Create automation - maxTokenBudget below minimum ( | validation_error | 400 | 400 | PASS |
| AUTO-C-11 | Create automation - circular chain (422) | edge_case | 422 | 0 | SKIP |
| AUTO-C-14 | Create automation - no auth token (401) | edge_case | 401 | 401 | PASS |

### POST /ai/automations/:id/run
**0 pass / 1 fail / 3 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| EXEC-01 | Run Now - happy path (202 accepted) | happy_path | 202 | 0 | SKIP |
| EXEC-02 | Run Now - with custom input | happy_path | 202 | 0 | SKIP |
| EXEC-03 | Run Now - automation not found (404) | edge_case | 404 | 503 | FAIL |
| EXEC-04 | Run Now - inactive automation (should reject or 50 | edge_case | 422 or 503 | 0 | SKIP |

### POST /ai/automations/runs/:runId/retry
**0 pass / 1 fail / 2 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| RUN-RT-01 | Retry from failed step - happy path (202) | happy_path | 202 | 0 | SKIP |
| RUN-RT-02 | Retry - run not found (404) | edge_case | 404 | 503 | FAIL |
| RUN-RT-03 | Retry - run is not FAILED (should reject) | edge_case | 422 or 400 | 0 | SKIP |

### POST /ai/variables
**0 pass / 0 fail / 6 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| VAR-C-01 | Create SYSTEM variable - happy path | happy_path | 201 | 0 | SKIP |
| VAR-C-02 | Create DB_FIELD variable - happy path | happy_path | 201 | 0 | SKIP |
| VAR-C-03 | Create EXPRESSION variable - happy path | happy_path | 201 | 0 | SKIP |
| VAR-C-04 | Create variable - missing variableName (400) | validation_error | 400 | 0 | SKIP |
| VAR-C-05 | Create variable - invalid sourceType (400) | validation_error | 400 | 0 | SKIP |
| VAR-C-06 | Create variable - duplicate variableName for same  | edge_case | 409 or 422 | 0 | SKIP |

### POST /ai/variables/:id/test
**0 pass / 1 fail / 1 skip**

| Test ID | Name | Type | Expected | Actual | Status |
|---------|------|------|----------|--------|--------|
| VAR-T-01 | Test resolve SYSTEM variable - happy path | happy_path | 200 | 0 | SKIP |
| VAR-T-02 | Test resolve - variable not found (404) | edge_case | 404 | 503 | FAIL |

## Skipped Tests (52)

Tests were skipped due to missing dynamic context (IDs from earlier create operations that
returned 503 instead of 201):

| Test ID | Reason |
|---------|--------|
| AUTO-C-05 | Required context variable 'existing_automation_id' is empty (dependency not avai |
| EXEC-01 | Required context variable 'existing_automation_id' is empty (dependency not avai |
| EXEC-02 | Required context variable 'existing_automation_id' is empty (dependency not avai |
| PRM-T-01 | Required context variable 'seeded_prompt_id' is empty (dependency not available) |
| RUN-RT-01 | Required context variable 'failed_run_id' is empty (dependency not available) |
| VAR-C-01 | Required context variable 'seeded_prompt_id' is empty (dependency not available) |
| VAR-C-02 | Required context variable 'seeded_prompt_id' is empty (dependency not available) |
| VAR-C-03 | Required context variable 'seeded_prompt_id' is empty (dependency not available) |
| VAR-T-01 | Required context variable 'system_variable_id' is empty (dependency not availabl |
| VER-R-01 | Required context variable 'multi_version_prompt_id' is empty (dependency not ava |
| VAR-C-04 | Required context variable 'seeded_prompt_id' is empty (dependency not available) |
| VAR-C-05 | Required context variable 'seeded_prompt_id' is empty (dependency not available) |
| AUTO-C-11 | Requires complex multi-step setup (circular chain detection) |
| EXEC-04 | Required context variable 'deactivated_automation_id' is empty (dependency not a |
| MDL-C-05 | Requires complex multi-step setup (circular chain detection) |
| RUN-RT-03 | Required context variable 'completed_run_id' is empty (dependency not available) |
| VAR-C-06 | Required context variable 'seeded_prompt_id' is empty (dependency not available) |
| AGT-G-01 | Required context variable 'seeded_agent_id' is empty (dependency not available) |
| AGT-L-04 | Required context variable 'seeded_model_id' is empty (dependency not available) |
| AUTO-G-01 | Required context variable 'existing_automation_id' is empty (dependency not avai |
| EXEC-R-01 | Required context variable 'existing_automation_id' is empty (dependency not avai |
| MDL-G-01 | Required context variable 'seeded_model_id' is empty (dependency not available) |
| PRM-G-01 | Required context variable 'seeded_prompt_id' is empty (dependency not available) |
| RUN-G-01 | Required context variable 'existing_run_id' is empty (dependency not available) |
| SKL-G-01 | Required context variable 'seeded_skill_id' is empty (dependency not available) |
| VAR-L-02 | Required context variable 'seeded_prompt_id' is empty (dependency not available) |
| VER-G-01 | Required context variable 'seeded_prompt_id' is empty (dependency not available) |
| VER-L-01 | Required context variable 'seeded_prompt_id' is empty (dependency not available) |
| EXEC-R-02 | Required context variable 'automation_with_no_runs_id' is empty (dependency not  |
| AGT-U-01 | Required context variable 'created_agent_id' is empty (dependency not available) |
| AGT-U-02 | Required context variable 'created_agent_id' is empty (dependency not available) |
| AUTO-U-01 | Required context variable 'existing_automation_id' is empty (dependency not avai |
| AUTO-U-02 | Required context variable 'existing_automation_id' is empty (dependency not avai |
| MDL-U-01 | Required context variable 'created_model_id' is empty (dependency not available) |
| PRM-U-01 | Required context variable 'created_prompt_id' is empty (dependency not available |
| PRM-U-02 | Required context variable 'created_prompt_id' is empty (dependency not available |
| SKL-DA-01 | Required context variable 'created_skill_id' is empty (dependency not available) |
| SKL-U-01 | Required context variable 'created_skill_id' is empty (dependency not available) |
| SKL-U-02 | Required context variable 'created_skill_id' is empty (dependency not available) |
| VAR-U-01 | Required context variable 'existing_variable_id' is empty (dependency not availa |
| PRM-U-03 | Required context variable 'created_prompt_id' is empty (dependency not available |
| AUTO-U-03 | Required context variable 'automation_A_id' is empty (dependency not available) |
| MDL-U-02 | Required context variable 'default_model_id' is empty (dependency not available) |
| MDL-U-03 | Required context variable 'model_A_id' is empty (dependency not available) |
| AGT-D-01 | Required context variable 'unreferenced_agent_id' is empty (dependency not avail |
| AUTO-D-01 | Required context variable 'created_automation_id' is empty (dependency not avail |
| MDL-D-01 | Required context variable 'unreferenced_model_id' is empty (dependency not avail |
| PRM-D-01 | Required context variable 'unreferenced_prompt_id' is empty (dependency not avai |
| VAR-D-01 | Required context variable 'created_variable_id' is empty (dependency not availab |
| AGT-D-02 | Required context variable 'agent_used_in_automation_id' is empty (dependency not |
| MDL-D-02 | Required context variable 'model_used_by_agent_id' is empty (dependency not avai |
| PRM-D-02 | Required context variable 'prompt_used_by_agent_id' is empty (dependency not ava |

## Recommendations

1. **Set `PLATFORM_SERVICE_TOKEN`** in `.env` and restart the API server
2. **Set `REDIS_URL`** for context caching and scheduling features
3. **Fix route prefix** — either remove `fastify-plugin` wrapper from `aiPlugin` or update
   test plan paths to match actual mount points
4. **Re-run this test suite** after environment configuration to validate CRUD operations
5. **Seed test data** — ensure AI models, prompts, agents, and skills are seeded before testing
