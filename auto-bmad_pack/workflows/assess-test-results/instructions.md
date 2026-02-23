# Assess Test Results - Instructions

## Purpose

Analyze backend or frontend test results to determine an overall verdict, identify critical failures, and recommend the next action for the orchestrator.

## Critical Rules

1. **Output ONLY valid JSON** - No markdown, no explanations, just JSON to stdout
2. **Distinguish critical from non-critical** - A failing edge case is not the same as a failing CRUD operation
3. **Be actionable** - Recommendations must be specific enough for the orchestrator to act on

## Inputs

- `{{test_results_file}}`: Path to the test results JSON file
- `{{test_type}}`: Either "backend" or "frontend"

## Execution Steps

### Step 1: Parse Test Results

Read the test results file at `{{test_results_file}}` and extract:

1. Total test count
2. Pass/fail/skip counts
3. Pass rate percentage
4. List of all failures with details

### Step 2: Classify Failures

For each failure, determine severity:

| Severity | Criteria |
|----------|----------|
| `critical` | Core CRUD operations fail, data corruption, server errors (5xx) |
| `high` | Important features broken, validation not working, wrong status codes |
| `medium` | Edge cases, cosmetic issues, non-blocking errors |

**Backend severity indicators:**
- 5xx response = critical
- CRUD happy path fails = critical
- Validation returns wrong status = high
- Edge case fails = medium

**Frontend severity indicators:**
- Page doesn't load = critical
- Form submission fails = critical
- Navigation broken = critical
- Element not found but page loads = high
- Visual/text mismatch = medium
- Optional feature missing = medium

### Step 3: Determine Verdict

```
pass_rate = (passed / total) * 100

If pass_rate >= 95% AND no critical failures:
  verdict = "pass"
  action = "proceed"

If pass_rate >= 70% OR only medium/high failures:
  verdict = "partial"
  action = "fix"

If pass_rate < 70% OR any critical failures:
  verdict = "fail"
  action = "escalate" (if critical) or "fix" (if no critical)
```

### Step 4: Output JSON

Output ONLY this JSON structure:

```json
{
  "verdict": "pass|partial|fail",
  "test_type": "backend|frontend",
  "pass_rate": 92.5,
  "summary": {
    "total": 40,
    "passed": 37,
    "failed": 3,
    "skipped": 0
  },
  "critical_failures": [
    {
      "test_name": "Create project - happy path",
      "endpoint_or_journey": "POST /api/projects",
      "severity": "critical",
      "description": "Returns 500 instead of 201, server error in project creation"
    }
  ],
  "non_critical_failures": [
    {
      "test_name": "Create project - name too long",
      "endpoint_or_journey": "POST /api/projects",
      "severity": "medium",
      "description": "Returns 500 instead of 400 for oversized name"
    }
  ],
  "action": "fix",
  "action_details": "Fix 3 failures: 1 critical (project creation 500 error), 2 medium (validation edge cases)",
  "timestamp": "2025-01-01T00:00:00Z"
}
```

## Action Mapping

| Action | Orchestrator Behavior |
|--------|----------------------|
| `proceed` | Continue to next phase |
| `fix` | Invoke bug fix loop, then retest |
| `escalate` | Send Slack notification, halt for human review |

## Error Handling

If results file cannot be parsed:

```json
{
  "verdict": "fail",
  "test_type": "unknown",
  "action": "escalate",
  "action_details": "Could not parse test results file",
  "critical_failures": [],
  "error": "Test results file is empty or invalid JSON"
}
```
