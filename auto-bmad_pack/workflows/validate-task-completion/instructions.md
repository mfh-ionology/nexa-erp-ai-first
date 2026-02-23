# Validate Task Completion - Instructions

## Purpose

After a task execution attempt, assess whether the work was completed successfully and recommend the appropriate next action for the orchestrator.

## Critical Rules

1. **Output ONLY valid JSON** - No markdown, no explanations, just JSON to stdout
2. **Be accurate** - Check actual subtask completion, don't guess
3. **Analyze the log** - Look for progress indicators, errors, and patterns
4. **Recommend actionable next steps** - The orchestrator needs a clear decision

## Inputs

1. `story_file_path`: Path to story markdown file
2. `log_file_path`: Path to the dev execution log
3. `task_number`: Which task was executed (e.g., "1", "4a")
4. `failure_type`: How the execution ended
   - `success`: Clean exit, no errors
   - `max_turns`: Hit turn limit
   - `error`: Execution error occurred
   - `timeout`: Process timed out
5. `turns_used`: How many turns were consumed (optional)

## Execution Steps

### Step 1: Parse Story File

Read `{{story_file_path}}` and find Task `{{task_number}}`:

1. Extract all subtasks for this task
2. Count total subtasks
3. Count completed subtasks (marked `[x]`)
4. Calculate progress percentage

### Step 2: Analyze Execution Log

Read `{{log_file_path}}` and scan for:

#### 2a. Progress Indicators (Positive)

```
- "Task X.Y completed" or "Subtask X.Y done"
- "✓" or "[x]" markers in output
- "Test passed" or "All tests passing"
- File creation/modification confirmations
- Successful command outputs
```

#### 2b. Problem Indicators (Negative)

```
- "Error:" or "ERROR:" prefixes
- "Failed:" or "FAILED:" messages
- "Test failed" or test assertion failures
- "Cannot find" or "not found" errors
- Stack traces or exception dumps
- "Reached max turns" message
- Repeated attempts at same operation
```

#### 2c. Blocked Indicators

```
- "Waiting for" or "blocked by"
- "Need human input" or "clarification needed"
- "Missing dependency" or "cannot proceed"
- Circular retry patterns
```

### Step 3: Apply Decision Matrix

Based on analysis, determine action:

| Condition | Action | Reason Template |
|-----------|--------|-----------------|
| All subtasks `[x]` + no errors | `continue` | "Task {n} completed successfully" |
| All subtasks `[x]` + tests failing | `fix_tests` | "Implementation complete but {x} tests failing" |
| >50% subtasks `[x]` + max_turns | `retry_with_more` | "{x}% complete, need more turns" |
| 0% subtasks `[x]` + max_turns | `escalate` | "No progress made, task may need restructuring" |
| 1-50% subtasks `[x]` + max_turns | `retry_with_more` | "{x}% complete, task proving complex" |
| Error in log + fixable | `retry` | "Error encountered: {error}, will retry" |
| Error in log + blocked | `escalate` | "Blocked by: {blocker}" |
| Timeout | `retry_with_more` | "Timeout, may need extended execution" |
| >2 retry attempts already | `escalate` | "Multiple retries failed, needs human review" |

### Step 4: Calculate Recommended Turns

For `retry` or `retry_with_more` actions:

```
If failure_type == "max_turns":
  recommended_turns = min(turns_used * 2, 200)
Else if failure_type == "timeout":
  recommended_turns = min(turns_used * 1.5, 200)
Else:
  recommended_turns = turns_used  # Same turns for simple retry
```

### Step 5: Identify Next Task

If action is `continue`:

1. Parse story for task sequence
2. Find task immediately after `{{task_number}}`
3. If no more tasks, set `next_task` to `"STORY_COMPLETE"`

### Step 6: Compile Issues Found

List specific issues from log analysis:

```json
"issues_found": [
  "Test 'auth.test.ts' failing: Expected 200, got 401",
  "npm install shadcn-ui timed out after 30s",
  "File 'components/Button.tsx' not found"
]
```

### Step 7: Output JSON

Output ONLY this JSON structure:

```json
{
  "action": "continue|retry|retry_with_more|split|escalate|fix_tests",
  "reason": "Human-readable explanation",
  "details": {
    "task_number": "4",
    "subtasks_total": 6,
    "subtasks_completed": 6,
    "progress_percentage": 100,
    "recommended_turns": null,
    "issues_found": [],
    "next_task": "5"
  },
  "analysis_timestamp": "2026-01-21T10:15:00Z"
}
```

## Action Definitions

| Action | Orchestrator Response |
|--------|----------------------|
| `continue` | Move to next task |
| `retry` | Re-run same task with same turn limit |
| `retry_with_more` | Re-run with increased turn limit |
| `split` | Invoke rewrite-story-splits, then retry |
| `escalate` | Send Slack notification, halt |
| `fix_tests` | Re-run with focus on fixing failing tests |

## Example Outputs

### Success Case

```json
{
  "action": "continue",
  "reason": "Task 3 completed successfully. All 5 subtasks marked complete, tests passing.",
  "details": {
    "task_number": "3",
    "subtasks_total": 5,
    "subtasks_completed": 5,
    "progress_percentage": 100,
    "recommended_turns": null,
    "issues_found": [],
    "next_task": "4"
  }
}
```

### Partial Progress Case

```json
{
  "action": "retry_with_more",
  "reason": "Task 4 reached max turns with 75% progress (9/12 subtasks). Recommending retry with 100 turns.",
  "details": {
    "task_number": "4",
    "subtasks_total": 12,
    "subtasks_completed": 9,
    "progress_percentage": 75,
    "recommended_turns": 100,
    "issues_found": [
      "Reached max turns at subtask 4.10"
    ],
    "next_task": null
  }
}
```

### Escalation Case

```json
{
  "action": "escalate",
  "reason": "Task 4 failed after 2 retry attempts with 0% progress. Task may be incorrectly specified or blocked.",
  "details": {
    "task_number": "4",
    "subtasks_total": 12,
    "subtasks_completed": 0,
    "progress_percentage": 0,
    "recommended_turns": null,
    "issues_found": [
      "Repeated 'module not found' errors for @auth/core",
      "Appears to require package not in dependencies"
    ],
    "next_task": null
  }
}
```

## Error Handling

If inputs are invalid:

```json
{
  "action": "error",
  "reason": "Could not validate: {specific error}",
  "details": {
    "task_number": "{{task_number}}",
    "subtasks_total": 0,
    "subtasks_completed": 0,
    "progress_percentage": 0,
    "recommended_turns": null,
    "issues_found": ["Invalid input: {detail}"],
    "next_task": null
  }
}
```
