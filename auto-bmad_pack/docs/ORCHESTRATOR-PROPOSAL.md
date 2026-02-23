# Workflow Orchestrator - Design Proposal

**Date:** 2026-01-21
**Purpose:** Define the approach for building a robust, intelligent workflow orchestration system for BMAD V6
**Location:** auto-bmad_pack/

---

## The Problem

The current `v6-story-workflow.sh` bash script fails because it's **deterministic but the work is non-deterministic**:

| What the Script Knows | What the Script Doesn't Know |
|----------------------|------------------------------|
| Exit code (0 or 1) | Whether work was actually completed |
| File exists/doesn't exist | Quality of the work |
| Turn count reached | Whether progress was made |
| Transient error patterns | Why Claude got stuck |
| Log file size | What to do next |

**Core Issue:** A bash script cannot make intelligent decisions about AI-driven work.

---

## Script vs Agent-Based Approach

### Option A: Enhanced Bash Script (Current Path)

**Pros:**
- Already exists
- Simple to debug
- Runs unattended
- Low token cost

**Cons:**
- Cannot assess work quality
- Cannot make intelligent retry decisions
- Cannot adapt to task complexity
- Will continue to fail in unpredictable ways

**Verdict:** Can be improved but has fundamental limitations.

### Option B: Pure Agent Orchestration

**Pros:**
- Can assess completion intelligently
- Can adapt to task complexity
- Can make nuanced decisions
- Native to BMAD ecosystem

**Cons:**
- High token cost (orchestrator runs continuously)
- Context window limits for long workflows
- May need human handoff for multi-hour runs
- No persistent state between sessions

**Verdict:** Powerful but expensive and session-limited.

### Option C: Hybrid Architecture (RECOMMENDED)

**Bash script handles:**
- Process management (start, stop, resume)
- Logging and state persistence
- Rate limit handling
- Slack notifications
- Session scheduling

**AI orchestrator handles:**
- Assess task complexity before execution
- Validate completion after execution
- Decide: retry, continue, split, or escalate
- Provide intelligent error analysis

**Verdict:** Best of both worlds - cheap management + intelligent decisions.

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     HYBRID ORCHESTRATION SYSTEM                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │              v7-orchestrated-workflow.sh (Bash Layer)               │   │
│   │                                                                     │   │
│   │   • Start/stop/resume workflows                                     │   │
│   │   • Manage logging and state files                                  │   │
│   │   • Handle rate limits and transient errors                         │   │
│   │   • Send Slack notifications                                        │   │
│   │   • Schedule and track sessions                                     │   │
│   │   • Call AI Validator at decision points                            │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │               AI VALIDATOR (BMAD Workflow)                          │   │
│   │                                                                     │   │
│   │   Called at decision points to:                                     │   │
│   │   • Assess task complexity → set turn limits                        │   │
│   │   • Validate completion → did the work actually happen?             │   │
│   │   • Analyze failures → what went wrong?                             │   │
│   │   • Recommend action → retry, continue, split, escalate             │   │
│   │                                                                     │   │
│   │   Returns JSON: { action: "continue|retry|split|escalate",          │   │
│   │                   reason: "...", turns_needed: N }                  │   │
│   │                                                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Which BMAD Agent to Work With

### For DESIGNING the System: **Architect (Winston)**

The Architect agent specializes in:
- System architecture and technical design
- Scalable patterns and technology selection
- Connecting decisions to business value

**Invoke:** `/bmad-architect` → `CA` (Create Architecture) or `CH` (Chat)

**Task:** Design the AI Validator workflow specification

### For IMPLEMENTING the System: **Dev (James)**

The Dev agent specializes in:
- Full-stack implementation
- Code quality and testing
- Following project-context.md patterns

**Invoke:** `/bmad-dev` → `DS` (Dev Story) or workflow execution

**Task:** Implement the bash script and AI Validator workflow

### For CREATING Stories: **Scrum Master (Bob)**

The SM agent specializes in:
- Story preparation and sprint planning
- Creating actionable user stories
- Managing sprint-status.yaml

**Invoke:** `/bmad-sm` → `CS` (Create Story)

**Task:** Create the implementation story for the orchestrator

---

## Proposed Implementation Path

### Phase 1: Design with Architect (Party Mode or Direct)

Use Party Mode with Architect + PM to design:

1. **AI Validator Workflow Specification**
   - Inputs: story file, log file, task number, failure info
   - Outputs: JSON with action, reason, configuration
   - Decision tree for common scenarios

2. **Enhanced State Management**
   - Track subtask-level progress
   - Store complexity assessments
   - Record decision history

3. **Notification Strategy**
   - What triggers Slack notifications
   - What information to include
   - Escalation paths

### Phase 2: Create Story with SM

Have the Scrum Master create a story for implementing:

1. **AI Validator Workflow** (new BMAD workflow)
   - `auto-bmad_pack/workflows/validate-completion/workflow.yaml`
   - `auto-bmad_pack/workflows/validate-completion/instructions.md`

2. **Enhanced v7-orchestrated-workflow.sh**
   - Integration points with AI Validator
   - Improved state management
   - Slack notification fixes

3. **Configuration**
   - `.bmad-secrets` for Slack webhook
   - Turn limit settings
   - Retry configuration

### Phase 3: Implement with Dev

Have the Dev agent implement:

1. Create the AI Validator workflow
2. Refactor the bash script
3. Add integration tests
4. Document the system

---

## Immediate Actions (Do Now)

While designing the full system, fix the critical issues:

### 1. Configure Slack Notifications

```bash
# Create auto-bmad_pack/config/.bmad-secrets
cat > /path/to/auto-bmad_pack/config/.bmad-secrets << 'EOF'
# BMAD Workflow Secrets
# This file should NOT be committed to git

# Slack Webhook for notifications
BMAD_SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
BMAD_SLACK_ENABLED="true"
EOF
```

### 2. Add Max-Turns Detection

Add to v6-story-workflow.sh:

```bash
check_max_turns_error() {
    local log_file="$1"
    if grep -q "Reached max turns" "$log_file" 2>/dev/null; then
        return 0  # Max turns was hit
    fi
    return 1
}
```

### 3. Dynamic Turn Limits (Quick Win)

```bash
# Estimate turns based on subtask count
get_task_turn_limit() {
    local task_num="$1"
    local subtask_count=$(grep -A50 "Task ${task_num}:" "$STORY_FILE" | grep -c "^  - \[" || echo 5)

    # 30 base + 10 per subtask, capped at 150
    local turns=$((30 + subtask_count * 10))
    [[ $turns -gt 150 ]] && turns=150

    echo "$turns"
}
```

---

## AI Validator Workflow Specification (Draft)

### Workflow: validate-completion

**Purpose:** Assess whether a task was completed successfully and recommend next action.

**Inputs:**
```yaml
story_file: "{implementation_artifacts}/{story-id}.md"
log_file: "{log_dir}/{story-id}-develop-task-{n}.log"
task_number: N
failure_type: "max_turns|error|timeout|unknown"
```

**Instructions (AI Prompt):**
```markdown
You are assessing task completion for automated workflow orchestration.

## Your Task
1. Read the story file and find Task {task_number}
2. Count completed vs uncompleted subtasks
3. Review the development log for progress indicators
4. Determine the appropriate action

## Decision Matrix

| Condition | Action | Reason |
|-----------|--------|--------|
| All subtasks [x] | continue | Task completed successfully |
| >50% subtasks [x] + max_turns | retry_with_more | Progress made, need more turns |
| 0% subtasks [x] + max_turns | split_task | Task too complex, needs breakdown |
| Error in log | analyze_error | Need to understand failure |
| Tests failing | fix_tests | Tests need attention first |

## Output Format (JSON)
{
  "action": "continue|retry|split|escalate|fix",
  "reason": "Brief explanation",
  "details": {
    "subtasks_total": N,
    "subtasks_completed": N,
    "progress_percentage": N,
    "recommended_turns": N,
    "issues_found": ["..."]
  }
}
```

---

## Epic Workflow Considerations

The same hybrid architecture applies to epic workflows:

```
v7-orchestrated-epic.sh
    │
    ├── For each story in epic:
    │   ├── Assess story complexity
    │   ├── Run v7-orchestrated-workflow.sh for story
    │   ├── Validate story completion
    │   └── Update sprint-status.yaml
    │
    └── AI Validator checkpoints:
        ├── After each story
        ├── After code review cycles
        └── Before marking epic complete
```

---

## Recommended Next Steps

### Option A: Quick Path (2-3 Hours)

1. **Now:** Fix Slack notifications (I can do this immediately)
2. **Now:** Add max-turns detection and retry logic
3. **Now:** Add dynamic turn limits
4. **Later:** Design full orchestrator with Architect

### Option B: Full Path (Design First)

1. **Now:** Start Party Mode with Architect + PM
2. **Design:** Create AI Validator specification
3. **Story:** Have SM create implementation story
4. **Implement:** Have Dev implement the system

### My Recommendation

**Start with Option A** to get the immediate wins (Slack, max-turns handling), then **proceed with Option B** to build the proper system.

The Architect (Winston) should design the AI Validator workflow specification. This is an architectural decision about how AI agents communicate and make decisions - exactly his expertise.

---

## Summary

| Question | Answer |
|----------|--------|
| Script or Agent? | **Hybrid** - Bash for management, AI for decisions |
| Which agent to design? | **Architect (Winston)** |
| Which agent to implement? | **Dev (James)** |
| Where does code go? | `auto-bmad_pack/` folder |
| First action? | Fix Slack + max-turns handling |

---

## File Locations

All new files will be created in:

```
auto-bmad_pack/
├── config/
│   └── .bmad-secrets           # Slack webhook (create now)
├── docs/
│   ├── V6-WORKFLOW-ANALYSIS.md  # Already created
│   └── ORCHESTRATOR-PROPOSAL.md # This file
├── workflows/
│   └── validate-completion/     # New AI Validator workflow
│       ├── workflow.yaml
│       └── instructions.md
└── scripts/
    ├── v6-story-workflow.sh     # Current (fix now)
    ├── v7-orchestrated-workflow.sh  # New hybrid script
    └── v7-orchestrated-epic.sh  # New epic orchestrator
```
