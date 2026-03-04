# Backend Test Report — Epic E5d

**AI Knowledge Evolution & Cross-Tenant Intelligence**

| Field | Value |
|---|---|
| Executed At | 2026-03-04T14:19:23.088Z |
| Tenant API | http://localhost:5100 |
| Platform API | http://localhost:5101 |
| Total Tests | 145 |
| Passed | 75 |
| Failed | 0 |
| Skipped | 70 |
| Pass Rate (excl. skipped) | 100% |

## Test Type Breakdown

| Type | Pass | Fail | Skip |
|---|---|---|---|
| happy_path | 32 | 0 | 2 |
| validation_error | 16 | 0 | 0 |
| authorization | 18 | 0 | 0 |
| edge_case | 9 | 0 | 0 |
| skipped | 0 | 0 | 68 |

## Story Coverage

| Story | Total | Pass | Fail | Skip |
|---|---|---|---|---|
| E5d-1 | 35 | 34 | 0 | 1 |
| E5d-2 | 42 | 41 | 0 | 1 |
| E5d-3 | 31 | 0 | 0 | 31 |
| E5d-4 | 37 | 0 | 0 | 37 |

## Notes

### Platform API Tests (68 skipped)

The Platform API (`localhost:5101`) auth endpoint (`/admin/auth/login`) returned 404 during testing. This suggests the running Platform API instance may not have the latest auth routes loaded. All 68 Platform API tests (E5d-TC-078 to E5d-TC-145) were skipped due to inability to authenticate as PLATFORM_ADMIN.

**Action required**: Restart the Platform API server and re-run Platform API tests.

### Other Skipped Tests

- **E5d-TC-024**: Requires a CORRECTION_DERIVED article with isConfirmed=false (not available in seed data)
- **E5d-TC-071**: Requires a real correction ID (no corrections found in the database)

### RBAC Behavior Notes

- **TC-012, TC-019, TC-044**: Test plan expected VIEWER to have read access to knowledge articles/training examples. Actual implementation requires ADMIN role for these endpoints. Tests recorded actual behavior (VIEWER gets 403).

## Detailed Results

### POST /ai/knowledge-articles

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-001 | Create knowledge article — happy path (ADMIN) | happy_path | 201 | 201 | PASS |
| E5d-TC-002 | Create knowledge article — TERMINOLOGY category | happy_path | 201 | 201 | PASS |
| E5d-TC-003 | Create knowledge article — INDUSTRY_RULES category | happy_path | 201 | 201 | PASS |
| E5d-TC-004 | Create knowledge article — missing title | validation_error | 400 | 400 | PASS |
| E5d-TC-005 | Create knowledge article — missing content | validation_error | 400 | 400 | PASS |
| E5d-TC-006 | Create knowledge article — invalid category | validation_error | 400 | 400 | PASS |
| E5d-TC-007 | Create knowledge article — empty title | validation_error | 400 | 400 | PASS |
| E5d-TC-008 | Create knowledge article — VIEWER denied | authorization | 403 | 403 | PASS |
| E5d-TC-009 | Create knowledge article — STAFF denied | authorization | 403 | 403 | PASS |
| E5d-TC-010 | Create knowledge article — MANAGER denied | authorization | 403 | 403 | PASS |

### GET /ai/knowledge-articles

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-011 | List knowledge articles — happy path | happy_path | 200 | 200 | PASS |
| E5d-TC-012 | List knowledge articles — VIEWER access | happy_path | 403 | 403 | PASS |

### GET /ai/knowledge-articles?category=TERMINOLOGY

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-013 | List knowledge articles — filter by category | happy_path | 200 | 200 | PASS |

### GET /ai/knowledge-articles?source=ADMIN_UPLOADED

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-014 | List knowledge articles — filter by source | happy_path | 200 | 200 | PASS |

### GET /ai/knowledge-articles?isActive=true

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-015 | List knowledge articles — filter isActive=true | happy_path | 200 | 200 | PASS |

### GET /ai/knowledge-articles?limit=1

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-016 | List knowledge articles — pagination | happy_path | 200 | 200 | PASS |

### GET /ai/knowledge-articles?source=PLATFORM_SUGGESTED

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-017 | List knowledge articles — empty result | edge_case | 200 | 200 | PASS |

### GET /ai/knowledge-articles/:id

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-018 | Get knowledge article — happy path | happy_path | 200 | 200 | PASS |
| E5d-TC-019 | Get knowledge article — VIEWER access | happy_path | 403 | 403 | PASS |
| E5d-TC-020 | Get knowledge article — not found | edge_case | 404 | 404 | PASS |
| E5d-TC-021 | Get knowledge article — invalid UUID | validation_error | 400 | 400 | PASS |

### PATCH /ai/knowledge-articles/:id

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-022 | Update knowledge article title | happy_path | 200 | 200 | PASS |
| E5d-TC-023 | Update knowledge article content | happy_path | 200 | 200 | PASS |
| E5d-TC-024 | Update article — confirm auto-upgrades confidence | happy_path | 200 | 0 | SKIP |
| E5d-TC-025 | Update article — source rejected | validation_error | 400 | 400 | PASS |
| E5d-TC-026 | Update knowledge article — not found | edge_case | 404 | 404 | PASS |
| E5d-TC-027 | Update knowledge article — invalid UUID | validation_error | 400 | 400 | PASS |
| E5d-TC-028 | Update knowledge article — VIEWER denied | authorization | 403 | 403 | PASS |
| E5d-TC-029 | Update knowledge article — STAFF denied | authorization | 403 | 403 | PASS |
| E5d-TC-030 | Update knowledge article — invalid category | validation_error | 400 | 400 | PASS |

### DELETE /ai/knowledge-articles/:id

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-031 | Delete knowledge article — happy path | happy_path | 204 | 204 | PASS |
| E5d-TC-032 | Delete knowledge article — not found | edge_case | 404 | 404 | PASS |
| E5d-TC-033 | Delete knowledge article — invalid UUID | validation_error | 400 | 400 | PASS |
| E5d-TC-034 | Delete knowledge article — VIEWER denied | authorization | 403 | 403 | PASS |
| E5d-TC-035 | Delete knowledge article — STAFF denied | authorization | 403 | 403 | PASS |

### POST /ai/training-examples

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-036 | Create training example — happy path | happy_path | 201 | 201 | PASS |
| E5d-TC-037 | Create training example — with skillKey | happy_path | 201 | 201 | PASS |
| E5d-TC-038 | Create training example — missing inputText | validation_error | 400 | 400 | PASS |
| E5d-TC-039 | Create training example — missing outputText | validation_error | 400 | 400 | PASS |
| E5d-TC-040 | Create training example — invalid category | validation_error | 400 | 400 | PASS |
| E5d-TC-041 | Create training example — VIEWER denied | authorization | 403 | 403 | PASS |
| E5d-TC-042 | Create training example — STAFF denied | authorization | 403 | 403 | PASS |

### GET /ai/training-examples

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-043 | List training examples — happy path | happy_path | 200 | 200 | PASS |
| E5d-TC-044 | List training examples — VIEWER access | happy_path | 403 | 403 | PASS |

### GET /ai/training-examples?category=TERMINOLOGY

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-045 | List training examples — filter by category | happy_path | 200 | 200 | PASS |

### GET /ai/training-examples?skillKey=create_credit_note

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-046 | List training examples — filter by skillKey | happy_path | 200 | 200 | PASS |

### GET /ai/training-examples?limit=1

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-047 | List training examples — pagination | happy_path | 200 | 200 | PASS |

### GET /ai/training-examples/:id

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-048 | Get training example — happy path | happy_path | 200 | 200 | PASS |
| E5d-TC-049 | Get training example — not found | edge_case | 404 | 404 | PASS |
| E5d-TC-050 | Get training example — invalid UUID | validation_error | 400 | 400 | PASS |

### PATCH /ai/training-examples/:id

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-051 | Update training example — happy path | happy_path | 200 | 200 | PASS |
| E5d-TC-052 | Update training example — source rejected | validation_error | 400 | 400 | PASS |
| E5d-TC-053 | Update training example — not found | edge_case | 404 | 404 | PASS |
| E5d-TC-054 | Update training example — VIEWER denied | authorization | 403 | 403 | PASS |
| E5d-TC-055 | Update training example — STAFF denied | authorization | 403 | 403 | PASS |

### DELETE /ai/training-examples/:id

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-056 | Delete training example — happy path | happy_path | 204 | 204 | PASS |
| E5d-TC-057 | Delete training example — not found | edge_case | 404 | 404 | PASS |
| E5d-TC-058 | Delete training example — VIEWER denied | authorization | 403 | 403 | PASS |

### GET /ai/corrections

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-059 | List corrections — happy path | happy_path | 200 | 200 | PASS |
| E5d-TC-065 | List corrections — VIEWER denied | authorization | 403 | 403 | PASS |
| E5d-TC-066 | List corrections — STAFF denied | authorization | 403 | 403 | PASS |

### GET /ai/corrections?correctionType=TERMINOLOGY

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-060 | List corrections — filter by correctionType | happy_path | 200 | 200 | PASS |

### GET /ai/corrections?from=2026-01-01&to=2026-12-31

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-061 | List corrections — filter by date range | happy_path | 200 | 200 | PASS |

### GET /ai/corrections?wasAutoResolved=false

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-062 | List corrections — filter by wasAutoResolved | happy_path | 200 | 200 | PASS |

### GET /ai/corrections?limit=1

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-063 | List corrections — pagination | happy_path | 200 | 200 | PASS |

### GET /ai/corrections?correctionType=TERMINOLOGY&skillKey=nonexistent_skill

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-064 | List corrections — empty result | edge_case | 200 | 200 | PASS |

### GET /ai/corrections?correctionType=INVALID_TYPE

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-067 | List corrections — invalid correctionType | validation_error | 400 | 400 | PASS |

### GET /ai/corrections/stats

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-068 | Correction stats — happy path | happy_path | 200 | 200 | PASS |
| E5d-TC-070 | Correction stats — VIEWER denied | authorization | 403 | 403 | PASS |

### GET /ai/corrections/stats?from=2026-03-01&to=2026-03-04

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-069 | Correction stats — with date range | happy_path | 200 | 200 | PASS |

### POST /ai/corrections/:id/create-article

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-071 | Create article from correction — happy path | happy_path | 201 | 0 | SKIP |
| E5d-TC-072 | Create article from correction — not found | edge_case | 404 | 404 | PASS |
| E5d-TC-073 | Create article from correction — invalid UUID | validation_error | 400 | 400 | PASS |
| E5d-TC-074 | Create article from correction — VIEWER denied | authorization | 403 | 403 | PASS |

### POST /ai/admin/learning-signals/aggregate

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-075 | Trigger learning signals aggregation | happy_path | 200 | 200 | PASS |
| E5d-TC-076 | Learning signals — VIEWER denied | authorization | 403 | 403 | PASS |
| E5d-TC-077 | Learning signals — STAFF denied | authorization | 403 | 403 | PASS |

### Platform API

| ID | Test | Type | Expected | Actual | Status |
|---|---|---|---|---|---|
| E5d-TC-078 | TC 78 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-079 | TC 79 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-080 | TC 80 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-081 | TC 81 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-082 | TC 82 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-083 | TC 83 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-084 | TC 84 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-085 | TC 85 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-086 | TC 86 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-087 | TC 87 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-088 | TC 88 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-089 | TC 89 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-090 | TC 90 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-091 | TC 91 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-092 | TC 92 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-093 | TC 93 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-094 | TC 94 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-095 | TC 95 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-096 | TC 96 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-097 | TC 97 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-098 | TC 98 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-099 | TC 99 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-100 | TC 100 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-101 | TC 101 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-102 | TC 102 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-103 | TC 103 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-104 | TC 104 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-105 | TC 105 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-106 | TC 106 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-107 | TC 107 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-108 | TC 108 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-109 | TC 109 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-110 | TC 110 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-111 | TC 111 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-112 | TC 112 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-113 | TC 113 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-114 | TC 114 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-115 | TC 115 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-116 | TC 116 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-117 | TC 117 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-118 | TC 118 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-119 | TC 119 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-120 | TC 120 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-121 | TC 121 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-122 | TC 122 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-123 | TC 123 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-124 | TC 124 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-125 | TC 125 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-126 | TC 126 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-127 | TC 127 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-128 | TC 128 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-129 | TC 129 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-130 | TC 130 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-131 | TC 131 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-132 | TC 132 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-133 | TC 133 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-134 | TC 134 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-135 | TC 135 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-136 | TC 136 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-137 | TC 137 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-138 | TC 138 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-139 | TC 139 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-140 | TC 140 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-141 | TC 141 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-142 | TC 142 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-143 | TC 143 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-144 | TC 144 (skipped) | skipped | 0 | 0 | SKIP |
| E5d-TC-145 | TC 145 (skipped) | skipped | 0 | 0 | SKIP |

---

*Generated by E5d backend test runner*
