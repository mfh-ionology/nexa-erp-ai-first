# V6 Story Workflow - Comprehensive Analysis

**Date:** 2026-01-21
**Analyst:** Claude Code
**Script:** `auto-bmad_pack/scripts/v6-story-workflow.sh`

---

## Executive Summary

The v6-story-workflow.sh script automates the BMAD V6 story lifecycle but suffers from several architectural weaknesses that cause frequent failures. The most recent failure (Story 0-3, Task 4) occurred because the script has **no way to determine if Claude is making progress** - it only knows when Claude hits a hard limit (50 turns) or produces an error.

**Key Finding:** The script uses a deterministic approach where success is measured by exit codes and file existence checks, but Claude CLI can return exit code 0 even when tasks fail silently. The script lacks an intelligent orchestrator that can assess actual task completion.

---

## How The Script Works

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      v6-story-workflow.sh                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   1. STORY CREATION (SM Agent)                                     │
│      └─ Creates detailed story from epic                            │
│                                                                     │
│   2. ATDD (TEA Agent) - Optional                                   │
│      └─ Writes acceptance tests                                     │
│                                                                     │
│   3. DEV-CR LOOP (max 3 iterations)                                │
│      ├─ Iteration 1: DEV develops all tasks (one per session)      │
│      │   └─ Code Review (adds [AI-Review] issues to story)         │
│      │                                                              │
│      └─ Iteration 2+: DEV fixes CR issues                          │
│          └─ Test Review                                             │
│          └─ Code Review (if issues remain)                         │
│                                                                     │
│   4. TEST REVIEW (TEA Agent) - Optional final validation           │
│                                                                     │
│   5. MARK DONE                                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Per-Task Session Model

The script splits development into **one Claude session per task** to prevent context overflow:

```
Task 1 ──┐
Task 2 ──┤
Task 3 ──┼── Each task runs in fresh Claude session with --max-turns 50
Task 4 ──┤
  ...    │
Task N ──┘
```

This is good for context management but creates problems because there's no way to:
- Know if 50 turns is enough for a specific task
- Detect if Claude is stuck vs making progress
- Resume a task that ran out of turns

### Execution Flow

```bash
# Each task is executed via:
claude -p --dangerously-skip-permissions --max-turns 50 \
  "/bmad:bmm:workflows:dev-story
   0-3

   EXECUTE ONLY TASK 4:
   1. Read the story file and find Task 4
   2. Implement ONLY the subtasks under Task 4
   ..."
```

The script then:
1. Checks exit code (unreliable - Claude returns 0 even on errors)
2. Validates output (checks file size > 100 bytes, line count > 5)
3. Checks for transient errors (connection errors, API errors)
4. Saves state for resume

---

## Why Task 4 Failed

### The Immediate Cause

Task 4 (Install and Configure shadcn/ui) hit the 50-turn limit:

```
Error: Reached max turns (50)
```

This task required:
- Running `pnpm dlx shadcn-ui@latest init`
- Configuring components.json
- Installing 12 individual components (Button, Card, Input, etc.)
- Verifying each component renders correctly

**50 turns was simply not enough** for this task. The script had no way to detect that Claude was making progress but needed more turns.

### The Underlying Issues

1. **No Progress Detection**: The script can't tell if Claude completed 80% of work vs 0%
2. **Fixed Turn Limit**: 50 turns is arbitrary - some tasks need 20, others need 100+
3. **Silent Failure**: The log only contains `Error: Reached max turns (50)` - no context about what was accomplished
4. **No Adaptive Behavior**: Script treats all tasks identically regardless of complexity

---

## Weaknesses Analysis

### 1. Deterministic Success Detection (CRITICAL)

**Problem:** The script determines success through:
- Exit code (unreliable)
- File existence checks
- Task checkbox counting

**Reality:** None of these tell you if the actual work was done correctly.

```bash
# Current validation logic
validate_claude_output() {
    local file_size=$(wc -c < "$log_file")
    if [[ "$file_size" -lt 100 ]]; then
        return 1  # Fail
    fi
    # ... more simplistic checks
}
```

**Failure Mode:** Claude can write 500 lines to a log file but not accomplish the task.

### 2. No Slack Notifications (CONFIRMED BROKEN)

**Problem:** The `.bmad-secrets` file does not exist - only `.bmad-secrets.example`.

**Location:** `auto-bmad_pack/config/.bmad-secrets`

**Result:** All `notify_*` calls silently do nothing:

```bash
# From notify.sh
notify_slack() {
    [[ -z "$SLACK_WEBHOOK" ]] && return 0  # Silently returns if not configured
    ...
}
```

**Fix Required:** Create `.bmad-secrets` with actual webhook URL.

### 3. Fixed Turn Limits Per Task (DESIGN FLAW)

**Problem:** Every task gets exactly 50 turns regardless of complexity.

| Task | Complexity | Turns Needed (est.) | Turns Allowed |
|------|-----------|---------------------|---------------|
| Task 1: Init Next.js | Simple | ~20 | 50 |
| Task 4: Install 12 shadcn components | Complex | ~100+ | 50 |
| Task 11: Run all validations | Medium | ~40 | 50 |

**Result:** Simple tasks waste capacity, complex tasks fail.

### 4. No Progress Tracking Within Tasks

**Problem:** Script doesn't track subtask completion during a task.

**Example:** Task 4 has 14 subtasks:
```markdown
- [ ] Run `pnpm dlx shadcn-ui@latest init`
- [ ] Select New York style
- [ ] Configure `components.json` with correct paths
- [ ] Install essential base components:
  - [ ] Button
  - [ ] Card
  - [ ] Input
  ... (8 more)
```

The script has no way to know:
- How many subtasks Claude completed before hitting the limit
- Whether to retry from the beginning or continue where it left off
- If Claude got stuck on a specific subtask

### 5. No Intelligent Orchestration (FUNDAMENTAL)

**Problem:** The script is "dumb" - it runs commands and checks files.

**Missing:** An AI agent that:
- Assesses whether work was actually completed
- Decides if more turns are needed
- Determines if a task should be split
- Detects when Claude is stuck in a loop

**Current Architecture:**
```
Bash Script ──run──> Claude ──output──> File ──check──> Bash Script
      │                                                      │
      └──── No intelligence in the loop ─────────────────────┘
```

**Ideal Architecture:**
```
Bash Script ──run──> Claude ──output──> Orchestrator Agent ──decide──>
                                               │
                                               ├── Success → continue
                                               ├── Partial → resume with context
                                               ├── Stuck → break down task
                                               └── Failed → alert human
```

### 6. Error Recovery is Limited

**Current Retry Logic:**
- Transient errors (network): 3 retries with 30s delay
- Session limits: 60 retries with 5min delay
- Task failures: Prompt user to continue or abort

**Missing:**
- No retry for "max turns reached"
- No automatic task splitting
- No intelligent error analysis
- No way to resume a task from where it left off

### 7. State File Fragility

**Problem:** State is stored in simple key-value format:

```bash
STEP=3
CR_ITERATION=1
CURRENT_TASK=4
PHASE=dev
STORY_FILE="/path/to/story.md"
```

**Issues:**
- No tracking of subtask progress
- No record of what was accomplished before failure
- No way to resume mid-task

---

## Recommendations

### Immediate Fixes (Quick Wins)

#### 1. Configure Slack Notifications

```bash
# Create /auto-bmad_pack/config/.bmad-secrets
BMAD_SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
BMAD_SLACK_ENABLED="true"
```

#### 2. Add "Max Turns Reached" Detection

```bash
check_max_turns_error() {
    local log_file="$1"
    if grep -q "Reached max turns" "$log_file" 2>/dev/null; then
        return 0  # Max turns was hit
    fi
    return 1
}
```

Then add retry logic for max turns failures.

#### 3. Dynamic Turn Limits Based on Task Complexity

```bash
get_task_turn_limit() {
    local task_num="$1"
    local subtask_count=$(count_subtasks_for_task "$task_num")

    # Base 30 turns + 10 per subtask
    local turns=$((30 + subtask_count * 10))

    # Cap at 150 to prevent runaway
    [[ $turns -gt 150 ]] && turns=150

    echo "$turns"
}
```

### Medium-Term Improvements

#### 4. Add Progress Detection

Create a function that reads the story file during execution to check subtask completion:

```bash
check_task_progress() {
    local task_num="$1"
    local before_count="$2"

    local after_count=$(count_completed_subtasks_for_task "$task_num")
    local progress=$((after_count - before_count))

    echo "$progress"
}
```

#### 5. Implement Task Resumption

When a task hits max turns but made progress:

```bash
if check_max_turns_error "$log_file"; then
    local progress=$(check_task_progress "$task_num" "$before_subtasks")

    if [[ $progress -gt 0 ]]; then
        log "INFO" "Task $task_num made progress ($progress subtasks) - resuming"
        # Continue with remaining subtasks
    else
        log "ERROR" "Task $task_num stuck - no progress after 50 turns"
        # Different handling for stuck tasks
    fi
fi
```

### Long-Term Architecture Changes

#### 6. Add Orchestrator Agent (RECOMMENDED)

Replace deterministic bash checks with an AI agent that:

**Option A: Use Existing BMAD Agent**
Use the `pm` (Product Manager) or `sm` (Scrum Master) agent to assess completion:

```bash
assess_task_completion() {
    local task_num="$1"
    local log_file="$2"

    # Have an agent assess the work
    local assessment=$(claude -p --max-turns 5 \
        "/bmad:bmm:agents:sm

        Assess Task $task_num completion for story $STORY_ID:

        1. Read the story file at $STORY_FILE
        2. Check which subtasks in Task $task_num are now complete
        3. Review the development log at $log_file
        4. Return JSON: {\"complete\": true/false, \"progress_pct\": N, \"issues\": []}")

    echo "$assessment"
}
```

**Option B: Create Dedicated Orchestrator Agent**

Create a new BMAD agent specifically for workflow orchestration:

```yaml
# _bmad/agents/orchestrator.yaml
name: "Workflow Orchestrator"
role: "Assess task completion and manage workflow state"
tools:
  - read_story_file
  - read_log_file
  - assess_completion
  - determine_next_action
```

#### 7. Implement Event-Driven Architecture

Instead of linear execution, use an event-driven model:

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐
│ Task Runner │────>│ Event Queue  │────>│ Orchestrator  │
└─────────────┘     └──────────────┘     └───────────────┘
       │                                        │
       │         ┌──────────────────────────────┤
       │         │         │         │          │
       v         v         v         v          v
   SUCCESS    PARTIAL   STUCK    FAILED    NEEDS_REVIEW
       │         │         │         │          │
       v         v         v         v          v
   Next Task  Resume    Split    Alert     Slack/Human
```

---

## Proposed New Architecture: Agent-Orchestrated Workflow

### Concept

Replace the deterministic bash script with an AI-orchestrated workflow:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    WORKFLOW ORCHESTRATOR (AI Agent)                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Responsibilities:                                                  │
│  - Assess task complexity before execution                         │
│  - Monitor progress during execution                               │
│  - Determine success/failure intelligently                         │
│  - Decide on retries, splits, or escalation                        │
│  - Send appropriate notifications                                   │
│  - Maintain detailed state                                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              v
┌─────────────────────────────────────────────────────────────────────┐
│                        EXECUTION LAYER                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   DEV Agent ←──────────────────────────────────────────→ Orchestrator
│      │                                                      │      │
│      └── Execute Task                                       │      │
│      └── Report Progress                                    │      │
│      └── Request More Turns ──────────────────────────────→ │      │
│      └── Signal Completion ───────────────────────────────→ │      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Implementation Sketch

```bash
#!/bin/bash
# v7-orchestrated-workflow.sh

# The orchestrator runs continuously and coordinates work
run_orchestrator() {
    claude -p --dangerously-skip-permissions \
        "/bmad:bmm:workflows:orchestrate-story

        You are the workflow orchestrator for story $STORY_ID.

        Your job:
        1. Read the story file and determine remaining work
        2. For each task:
           a. Assess complexity and set appropriate turn limit
           b. Execute the task (spawn dev agent)
           c. Assess completion
           d. Decide: continue, retry, split, or escalate
        3. Run code review after development
        4. Manage fix iterations
        5. Send Slack notifications on important events

        You have access to:
        - Story file: $STORY_FILE
        - Log directory: $LOG_DIR
        - Slack webhook: configured

        Begin orchestrating..."
}
```

---

## Action Items

### Immediate (Do Now)

1. [ ] **Configure Slack** - Create `.bmad-secrets` with webhook URL
2. [ ] **Add max-turns detection** - Don't treat it as silent success
3. [ ] **Increase Task 4 turn limit** - At least 100 turns for component installation

### Short-Term (This Week)

4. [ ] **Implement dynamic turn limits** - Based on subtask count
5. [ ] **Add progress detection** - Track subtask completion during tasks
6. [ ] **Improve error messages** - Include context in failure notifications

### Medium-Term (This Month)

7. [ ] **Create orchestrator agent** - Use BMAD agent framework
8. [ ] **Implement task resumption** - Resume from partial completion
9. [ ] **Add detailed state tracking** - Track subtask-level progress

### Long-Term (Future)

10. [ ] **Event-driven architecture** - Replace linear execution
11. [ ] **Self-healing workflow** - Auto-split stuck tasks
12. [ ] **Learning system** - Track which tasks need more turns

---

## Conclusion

The v6-story-workflow.sh script is a solid foundation but fails at the critical task of **understanding whether work was actually completed**. The deterministic approach (check exit code, check file exists) cannot handle the nuanced reality of AI-driven development.

The recommended path forward is to **add an intelligent orchestrator** - either using existing BMAD agents or creating a dedicated orchestration agent - that can assess completion, manage retries intelligently, and make decisions that a bash script cannot.

The most impactful immediate fix is to **configure Slack notifications** so failures are communicated, and **add max-turns detection** with appropriate retry logic.
