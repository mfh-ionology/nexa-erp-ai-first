# Assess Story Complexity - Instructions

## Purpose

Analyze a story file BEFORE dev execution to identify complexity risks and recommend task splits. This enables the orchestrator to make intelligent decisions about execution strategy.

## Critical Rules

1. **Output ONLY valid JSON** - No markdown, no explanations, just JSON to stdout
2. **Be conservative** - When in doubt, flag as higher risk
3. **Analyze ALL tasks** - Do not skip any task in the story
4. **Consider cross-cutting concerns** - Tasks touching auth, state, routing are higher risk

## Execution Steps

### Step 1: Parse Story File

Read the story file at `{{story_file_path}}` and extract:

1. **Story metadata**: title, status
2. **Acceptance criteria**: list all ACs
3. **Tasks and subtasks**: parse the task tree structure

### Step 2: Analyze Each Task

For each task in the story:

#### 2a. Count Subtasks

```
subtask_count = number of "- [ ]" items under the task header
```

#### 2b. Calculate Estimated Turns

```
estimated_turns = min(TURN_BASE + (subtask_count * TURN_PER_SUBTASK), TURN_CAP)

Where:
  TURN_BASE = 30
  TURN_PER_SUBTASK = 10
  TURN_CAP = 150
```

#### 2c. Assess Complexity Flags

Check for these risk indicators in task description and subtasks:

| Flag | Trigger | Risk Boost |
|------|---------|------------|
| `cross_cutting` | mentions auth, routing, state management, middleware | +1 risk level |
| `external_deps` | mentions npm install, pip install, external APIs | +0.5 risk |
| `file_heavy` | >8 distinct file paths mentioned | +0.5 risk |
| `architectural` | mentions "design", "architecture", "pattern selection" | +1 risk level |
| `multi_service` | touches >2 services/packages | +0.5 risk |

#### 2d. Determine Risk Level (PER-TASK)

**IMPORTANT: These thresholds apply to INDIVIDUAL TASKS, not total story.**

```
Base risk from subtask count (per task):
  subtasks < 12  → green
  subtasks 12-20 → yellow
  subtasks > 20  → red

Adjust for flags:
  Each +1 risk boost moves green→yellow or yellow→red
  Each +0.5 accumulates (2x +0.5 = +1 level)

Maximum possible risk boost from flags: +1 level (capped)
```

### Step 3: Generate Split Recommendations

For tasks flagged yellow or red:

#### 3a. Identify Split Strategy

| Pattern | Strategy |
|---------|----------|
| Sequential subtasks | `split_sequential` - group first half / second half |
| By component type | `split_by_type` - group UI vs logic vs tests |
| By dependency | `split_by_dependency` - independent chunks |
| By file location | `split_by_location` - group by directory/package |

#### 3b. Suggest Groups

Create 2-3 suggested groups, each with:
- Group name (e.g., "4a", "4b")
- Subtask numbers included
- Brief rationale

Example:
```json
{
  "should_split": true,
  "strategy": "split_by_type",
  "suggested_groups": [
    { "name": "4a", "subtasks": [1,2,3,4,5,6], "rationale": "UI components" },
    { "name": "4b", "subtasks": [7,8,9,10,11,12], "rationale": "Form components" }
  ]
}
```

### Step 4: Calculate Overall Assessment

**CRITICAL: Follow this logic EXACTLY. Do not override based on total turns alone.**

```
overall_status (based on INDIVIDUAL task risk levels):
  ALL tasks green → "green"
  ANY task yellow, none red → "yellow"
  ANY task red → "red"

overall_risk (secondary metric):
  green status + total_turns < 400 → "low"
  green status + total_turns >= 400 → "medium"
  yellow status → "medium"
  red status → "high"

estimated_total_turns = sum of all task estimated_turns
```

**DO NOT mark status as "red" just because total turns is high.**
Total turns is informational only. A story with 10 green tasks totaling 800 turns is still "green" status.
The status is determined ONLY by individual task risk levels.

### Step 5: Output JSON

Output ONLY this JSON structure (no other text):

```json
{
  "status": "green|yellow|red",
  "overall_risk": "low|medium|high|critical",
  "estimated_total_turns": <number>,
  "story_file": "<path>",
  "analysis_timestamp": "<ISO timestamp>",
  "tasks": [
    {
      "task_number": 1,
      "task_title": "Task title from story",
      "subtask_count": 5,
      "estimated_turns": 80,
      "risk_level": "green",
      "flags": [],
      "split_recommendation": {
        "should_split": false,
        "strategy": null,
        "suggested_groups": []
      }
    },
    {
      "task_number": 4,
      "task_title": "Complex task example",
      "subtask_count": 12,
      "estimated_turns": 150,
      "risk_level": "red",
      "flags": ["file_heavy", "cross_cutting"],
      "split_recommendation": {
        "should_split": true,
        "strategy": "split_by_type",
        "suggested_groups": [
          { "name": "4a", "subtasks": [1,2,3,4,5,6], "rationale": "Setup and config" },
          { "name": "4b", "subtasks": [7,8,9,10,11,12], "rationale": "Implementation" }
        ]
      }
    }
  ],
  "recommendations": [
    "Task 4 should be split before execution",
    "Consider running Task 1 first to establish patterns"
  ]
}
```

## Risk Level Mapping

| Status | Action by Orchestrator |
|--------|----------------------|
| `green` | Execute normally with calculated turn limits |
| `yellow` | Auto-invoke rewrite-story-splits workflow, then continue |
| `red` | Send Slack notification, halt for human decision |

## Error Handling

If story file cannot be parsed:

```json
{
  "status": "error",
  "error": "Could not parse story file: <reason>",
  "story_file": "<path>"
}
```
