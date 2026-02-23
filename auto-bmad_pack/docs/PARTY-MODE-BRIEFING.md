# Party Mode Briefing: Workflow Orchestrator Design

**Date:** 2026-01-21
**Purpose:** Design an intelligent workflow orchestrator for BMAD V6 automated story/epic execution
**Participants:** Architect (Winston) + PM (John) + You

---

## Mission

Design a **hybrid orchestration system** that combines:
- Bash scripts for process management (start, stop, resume, logging, notifications)
- AI-powered validation for intelligent decision-making (assess completion, decide actions)

---

## The Problem We're Solving

The current bash automation (`v6-story-workflow.sh`) fails because:

1. **No completion assessment** - Can't tell if work was done correctly
2. **Fixed turn limits** - All tasks get same turns regardless of complexity
3. **No progress tracking** - Can't detect partial completion
4. **No intelligent decisions** - Can't decide retry vs split vs escalate

**Recent Failure Example:** Task 4 (install 12 shadcn components) hit 50-turn limit. Script had no way to know Claude was making progress but needed more time.

---

## What We Need Designed

### 1. AI Validator Workflow

A new BMAD workflow that assesses task completion:

**Inputs:**
- Story file path
- Development log file
- Task number
- Failure type (max_turns, error, timeout)

**Outputs (JSON):**
```json
{
  "action": "continue|retry|split|escalate",
  "reason": "explanation",
  "details": {
    "subtasks_total": N,
    "subtasks_completed": N,
    "progress_percentage": N,
    "recommended_turns": N,
    "issues_found": []
  }
}
```

**Decision Logic:**
| Condition | Action |
|-----------|--------|
| All subtasks [x] | continue |
| >50% done + max_turns | retry_with_more_turns |
| 0% done + max_turns | split_task |
| Tests failing | fix_tests_first |
| Blocked by external | escalate_to_human |

### 2. Integration Architecture

How the bash script calls the AI Validator:

```
┌─────────────────────────────────────────────────────────────┐
│                   v7-orchestrated-workflow.sh               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   For each task:                                            │
│     1. [AI] Assess complexity → get turn limit              │
│     2. [Bash] Execute task with turn limit                  │
│     3. [AI] Validate completion → get action                │
│     4. [Bash] Handle action (continue/retry/split/alert)    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. State Management

Enhanced state tracking for resume:
- Subtask-level progress (not just task-level)
- Complexity assessments history
- Decision audit trail
- Partial work preservation

### 4. Epic-Level Orchestration

Same pattern for `v7-orchestrated-epic.sh`:
- Per-story validation
- Cross-story dependency handling
- Epic-level quality gates

---

## Reference Materials

### Current Scripts (in auto-bmad_pack/scripts/)

| Script | Purpose | Status |
|--------|---------|--------|
| `v6-story-workflow.sh` | Story execution with DEV-CR loop | Working but limited |
| `v6-epic-workflow.sh` | Epic execution (calls story workflow) | Working but limited |
| `v4-story-workflow.sh` | Legacy story execution | Deprecated |
| `notify.sh` | Slack notification system | Working (needs webhook) |

### BMAD V6 Workflows (in _bmad/bmm/workflows/)

| Path | Purpose |
|------|---------|
| `4-implementation/dev-story/` | Execute story tasks |
| `4-implementation/code-review/` | Adversarial code review |
| `4-implementation/create-story/` | Create story from epic |
| `4-implementation/sprint-planning/` | Generate sprint-status.yaml |
| `4-implementation/sprint-status/` | Check sprint status |
| `4-implementation/correct-course/` | Handle off-track situations |
| `testarch/atdd/` | Acceptance test design |
| `testarch/test-review/` | Test quality review |

### BMAD V6 Agents (in _bmad/bmm/agents/)

| Agent | Role | Relevant For |
|-------|------|--------------|
| `sm.md` (Bob) | Scrum Master - story prep | Creating orchestrator story |
| `architect.md` (Winston) | System architecture | Designing orchestrator |
| `dev.md` (James) | Full-stack development | Implementing orchestrator |
| `pm.md` (John) | Product management | Requirements validation |
| `tea.md` (Quinn) | Test architecture | Quality gates |

### Key Files

```
/Users/mfh/MFH_Docs/My Projects/Ionology/urban-brain-mvp/
├── auto-bmad_pack/
│   ├── scripts/
│   │   ├── v6-story-workflow.sh    # Current script (just improved)
│   │   ├── v6-epic-workflow.sh     # Current epic script
│   │   └── notify.sh               # Slack notifications
│   ├── config/
│   │   └── .bmad-secrets           # Slack webhook (needs your URL)
│   └── docs/
│       ├── V6-WORKFLOW-ANALYSIS.md     # Detailed analysis
│       ├── ORCHESTRATOR-PROPOSAL.md    # Architecture proposal
│       └── PARTY-MODE-BRIEFING.md      # This file
│
└── _bmad/bmm/
    ├── agents/                     # Agent definitions
    ├── workflows/                  # Workflow definitions
    │   └── 4-implementation/       # Implementation phase workflows
    └── config.yaml                 # BMAD configuration
```

---

## Questions for Party Mode Discussion

### Architecture Questions (Winston)
1. Should the AI Validator be a standalone workflow or integrated into dev-story?
2. How should state be persisted between validator calls?
3. What's the right granularity for validation (subtask vs task vs story)?

### Product Questions (John)
1. What's the acceptable failure rate before human escalation?
2. Should the system auto-split tasks or just recommend splitting?
3. What notifications matter most for workflow health?

### Implementation Questions
1. Where should the new workflow live? (`auto-bmad_pack/workflows/` or `_bmad/bmm/workflows/`)
2. How to test the orchestrator without running full workflows?
3. Should we version the script as v7 or enhance v6?

---

## Success Criteria

The designed system should:

1. **Detect completion accurately** - Know when work is actually done
2. **Adapt to complexity** - More turns for harder tasks
3. **Recover intelligently** - Retry, split, or escalate appropriately
4. **Preserve progress** - Never lose partial work
5. **Communicate proactively** - Slack alerts for important events
6. **Be auditable** - Decision trail for debugging

---

## Improvements Already Made

Before this Party Mode session, the following quick fixes were applied to `v6-story-workflow.sh`:

1. **Dynamic turn limits** - Tasks now get turns based on subtask count (30 base + 10 per subtask, up to 150)
2. **Max-turns detection** - Script now detects "Reached max turns" error
3. **Max-turns retry** - Automatically retries with 2x turns (up to 200)
4. **Slack config file** - Created `.bmad-secrets` (needs webhook URL)

These are stopgap measures. The full solution needs the intelligent AI Validator.

---

## How to Start Party Mode

```
/bmad:core:workflows:party-mode
```

Then specify participants: **Architect (Winston) + PM (John)**

Focus: Design the AI Validator workflow and integration architecture.

---

## Expected Outputs from Party Mode

1. **AI Validator Workflow Spec** - YAML + instructions for the validator
2. **Integration Design** - How bash script calls the validator
3. **State Management Design** - Enhanced state tracking
4. **Implementation Story** - Ready for SM to refine

After Party Mode, use SM (Bob) to create the implementation story, then Dev (James) to build it.
