# Auto-BMAD Pack

Automated workflow orchestration for BMAD projects. Runs complete story and epic lifecycles using Claude Code subprocesses with intelligent validation, auto-splitting, and self-healing capabilities.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Install](#quick-install)
- [Architecture](#architecture)
- [Directory Structure](#directory-structure)
- [Workflow Versions](#workflow-versions)
  - [V4 - Basic Automation](#v4---basic-automation)
  - [V6 - Enhanced with CR Loop](#v6---enhanced-with-cr-loop)
  - [V7 - Intelligent Orchestration](#v7---intelligent-orchestration-recommended)
- [Scripts Reference](#scripts-reference)
- [Workflows Reference](#workflows-reference)
- [Post-Epic Testing Pipeline](#post-epic-testing-pipeline)
- [Slack Notifications](#slack-notifications)
- [Proceed Signals](#proceed-signals)
- [File Location Conventions](#file-location-conventions)
- [Configuration](#configuration)
- [Adapting for a New Project](#adapting-for-a-new-project)
- [Troubleshooting](#troubleshooting)
- [Updating](#updating)

---

## Overview

Auto-BMAD Pack automates the BMAD agile workflow by orchestrating Claude Code sessions to execute stories and epics end-to-end. It uses a **hybrid architecture**:

- **Bash layer**: Process management, logging, state persistence, rate limit handling, Slack notifications
- **AI layer**: Complexity assessment, completion validation, code review, test review, intelligent decision-making

Each story task runs in its own Claude Code session (`claude --dangerously-skip-permissions -p`), preventing context window overflow and enabling automatic retry/resume.

## Prerequisites

| Requirement | Purpose |
|------------|---------|
| **BMAD V4+** installed in project | Agents: `/bmad-sm`, `/bmad-po`, `/bmad-qa`, `/bmad-dev` (or equivalent) |
| **Claude Code CLI** | AI execution engine |
| **Bash 4.0+** | Script execution |
| **curl** | API testing, Slack notifications |
| **jq** (optional) | JSON parsing for test results |
| **Playwright** (optional) | Frontend E2E testing (`npx playwright`) |
| **pnpm** (optional) | Monorepo builds (configurable) |
| **gtimeout** or **timeout** | Subprocess timeouts |

## Quick Install

```bash
# Copy auto-bmad_pack/ to your project root, then:
./auto-bmad_pack/install.sh
```

The installer will:
1. Verify BMAD is installed (`_bmad/` directory exists)
2. Copy scripts to `scripts/`
3. Copy Claude Code commands to `.claude/commands/auto-bmad/`
4. Create `config/.bmad-secrets` from template (if not exists)
5. Add `.bmad-secrets` to `.gitignore`

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Epic Orchestrator                     │
│              v7-orchestrated-epic.sh                     │
│  Pre-Epic → Story Loop → Post-Epic → Test Pipeline      │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────▼──────────────┐
        │    Story Orchestrator        │
        │  v7-orchestrated-workflow.sh │
        │                              │
        │  ┌────────────────────────┐  │
        │  │ Pre-Validation (AI)    │  │
        │  │ assess-story-complexity│  │
        │  └──────────┬─────────────┘  │
        │             │                │
        │  ┌──────────▼─────────────┐  │
        │  │ Task Execution Loop    │  │
        │  │ For each task:         │  │
        │  │  1. claude -p (DEV)    │  │
        │  │  2. validate-task (AI) │  │
        │  │  3. decide next action │  │
        │  └──────────┬─────────────┘  │
        │             │                │
        │  ┌──────────▼─────────────┐  │
        │  │ Code Review Loop       │  │
        │  │ (up to 3 rounds)       │  │
        │  │  CR → Fix → CR → ...   │  │
        │  └──────────┬─────────────┘  │
        │             │                │
        │  ┌──────────▼─────────────┐  │
        │  │ TEA Test Review        │  │
        │  └────────────────────────┘  │
        └──────────────────────────────┘
```

## Directory Structure

```
auto-bmad_pack/
├── README.md
├── install.sh                              # Installation script
├── config/
│   ├── .bmad-secrets.example               # Slack/notification config template
│   └── .bmad-secrets                       # Your secrets (git-ignored)
├── scripts/
│   ├── lib-common.sh                       # Shared library (colors, paths, logging)
│   ├── notify.sh                           # Slack notification system
│   ├── format-slack-message.sh             # Slack message payload formatter
│   ├── proceed.sh                          # Trigger proceed signals
│   ├── v4-story-workflow.sh                # V4: 11-step story automation
│   ├── v4-epic-workflow.sh                 # V4: Epic loop (all stories)
│   ├── v6-story-workflow.sh                # V6: Enhanced with CR loop
│   ├── v6-epic-workflow.sh                 # V6: Epic loop with resume
│   ├── v7-orchestrated-workflow.sh         # V7: Intelligent story orchestration
│   ├── v7-orchestrated-epic.sh             # V7: Epic orchestration with phases
│   ├── v7-post-epic-build-verify.sh        # Post-epic: Build & verify
│   ├── v7-post-epic-backend-test.sh        # Post-epic: API tests
│   ├── v7-post-epic-frontend-e2e.sh        # Post-epic: Playwright E2E tests
│   ├── v7-post-epic-test-runner.sh         # Post-epic: Test orchestrator
│   ├── test-story-registry.sh              # Utility: Test epic parsing
│   └── test-single-step.sh                 # Utility: Test single workflow step
├── workflows/
│   ├── assess-story-complexity/            # Pre-execution risk assessment
│   │   ├── workflow.yaml
│   │   └── instructions.md
│   ├── validate-task-completion/           # Post-task completion check
│   │   ├── workflow.yaml
│   │   └── instructions.md
│   ├── rewrite-story-splits/              # Auto-split complex tasks
│   │   ├── workflow.yaml
│   │   └── instructions.md
│   ├── fix-build-errors/                  # Auto-fix build failures
│   │   ├── workflow.yaml
│   │   └── instructions.md
│   ├── generate-backend-test-plan/        # Generate API test plan
│   │   ├── workflow.yaml
│   │   └── instructions.md
│   ├── generate-frontend-test-plan/       # Generate E2E test plan
│   │   ├── workflow.yaml
│   │   └── instructions.md
│   └── assess-test-results/               # Analyze test results
│       ├── workflow.yaml
│       └── instructions.md
├── claude-commands/
│   └── auto-bmad/
│       ├── run-story.md                   # /auto-bmad-story skill
│       └── run-epic.md                    # /auto-bmad-epic skill
├── docs/
│   ├── ORCHESTRATOR-PROPOSAL.md           # V7 design document
│   ├── V7-ORCHESTRATOR-STATUS.md          # Implementation status
│   ├── v7-epic-workflow-test-guide.md     # Testing guide
│   ├── V6-WORKFLOW-ANALYSIS.md            # V6 analysis
│   └── PARTY-MODE-BRIEFING.md             # Hybrid architecture brief
└── logs/                                   # Runtime logs (git-ignored)
    └── workflow/
        ├── <story-id>/                    # Per-story task logs
        ├── orchestrator-state/            # State files for resume
        └── proceed-signals/               # Proceed signal files
```

---

## Workflow Versions

### V4 - Basic Automation

The simplest workflow. Runs 11 sequential steps, each in a fresh Claude session.

```bash
# Single story
./scripts/v4-story-workflow.sh E01-S01

# With options
./scripts/v4-story-workflow.sh E01-S01 --skip-risk --skip-nfr

# Entire epic
./scripts/v4-epic-workflow.sh E01 --max-turns 75
```

**11-Step Flow:**

| Step | Agent | Command | Purpose |
|------|-------|---------|---------|
| 1 | SM | `*draft` | Create story draft |
| 2 | QA | `*risk-profile` | Risk assessment (skippable) |
| 3 | QA | `*test-design` | Test scenarios |
| 4 | PO | `*validate-story-draft` | Validate -> READY FOR DEV |
| 5 | DEV | `*develop-story` | Implementation |
| 6 | QA | `*trace` | Requirements traceability |
| 7 | QA | `*nfr-assess` | NFR validation (skippable) |
| 8 | QA | `*review` | Quality review |
| 9 | DEV | `*review-qa` | Apply QA fixes |
| 10 | QA | `*gate` | Final gate -> DONE |
| 11 | PO | Check status | Slack notification |

### V6 - Enhanced with CR Loop

Adds per-task execution, DEV-CR loops, and resume capability.

```bash
./scripts/v6-story-workflow.sh 1-3 --max-cr-loops 3
./scripts/v6-story-workflow.sh 1-3 --resume --start-task 4
```

**Key improvements over V4:**
- Each task runs in its own session (prevents context overflow)
- Code review loop: DEV -> CR -> Fix -> CR (up to N rounds)
- State file for resume after failures
- Rate limit detection and auto-wait

### V7 - Intelligent Orchestration (Recommended)

The production workflow. Adds AI-powered pre/post validation, auto-splitting, and intelligent decision-making.

```bash
# Single story
./scripts/v7-orchestrated-workflow.sh 2-5

# Full epic with testing
./scripts/v7-orchestrated-epic.sh 2 --run-tests --fix-test-bugs --max-turns 75

# Resume from specific story
./scripts/v7-orchestrated-epic.sh 2 --start-story 5

# Skip pre-validation
./scripts/v7-orchestrated-workflow.sh 2-5 --skip-prevalidation
```

**V7 Story Flow:**

```
1. Complexity Assessment (AI)
   ├── GREEN: Execute normally
   ├── YELLOW: Auto-split complex tasks, then execute
   └── RED: Halt, notify Slack, wait for human decision

2. Task Execution Loop
   For each task:
   a. Calculate turn limits from complexity data
   b. Execute in Claude session (DEV agent)
   c. Validate completion (AI)
      ├── continue: Next task
      ├── retry: Same task, same turns
      ├── retry_with_more: Same task, 2x turns
      ├── fix_tests: Re-run with test focus
      └── escalate: Halt, notify Slack

3. Code Review (up to 3 rounds)
   CR -> identify issues -> Fix -> CR -> verify

4. TEA Test Review
   Review test quality, coverage, patterns

5. Story Complete
```

**V7 Epic Flow:**

```
Pre-Epic Phase:
  - SM Sprint Planning
  - TEA Test Design

Story Loop:
  - Run v7-orchestrated-workflow.sh for each story
  - Auto-retry failed stories (up to 3 attempts)
  - Session handoff on context overflow

Post-Epic Phase:
  - TEA Traceability
  - SM Retrospective
  - Post-Epic Test Pipeline (if --run-tests)
```

---

## Scripts Reference

### Core Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `v7-orchestrated-epic.sh` | Epic-level orchestration | `./scripts/v7-orchestrated-epic.sh <epic-id> [options]` |
| `v7-orchestrated-workflow.sh` | Story-level orchestration | `./scripts/v7-orchestrated-workflow.sh <story-id> [options]` |
| `v4-story-workflow.sh` | Basic 11-step story | `./scripts/v4-story-workflow.sh <story-id> [options]` |
| `v4-epic-workflow.sh` | Basic epic loop | `./scripts/v4-epic-workflow.sh <epic-id> [options]` |

### V7 Epic Options

| Option | Description |
|--------|-------------|
| `--start-story N` | Start from story N (skip earlier stories) |
| `--stop-after-story X` | Stop after completing story X |
| `--skip-pre` | Skip pre-epic phase (sprint planning, test design) |
| `--skip-post` | Skip post-epic phase |
| `--skip-td` | Skip TEA test design |
| `--run-tests` | Run post-epic test pipeline |
| `--fix-test-bugs` | Auto-fix bugs found during testing |
| `--max-turns N` | Max Claude turns per task (default: 50) |
| `--max-cr-loops N` | Max code review rounds (default: 3) |
| `--resume` | Resume from saved state |

### V7 Story Options

| Option | Description |
|--------|-------------|
| `--skip-prevalidation` | Skip complexity assessment |
| `--skip-postvalidation` | Skip task completion validation |
| `--skip-cr` | Skip code review |
| `--skip-tr` | Skip TEA test review |
| `--force-yellow` | Force yellow risk level |
| `--force-red` | Force red risk level |
| `--start-task N` | Resume from task N |
| `--max-turns N` | Override turn limit |
| `--fresh` | Ignore saved state, start fresh |

### Helper Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `lib-common.sh` | Shared library (source, don't execute) | `source scripts/lib-common.sh` |
| `notify.sh` | Slack notification functions | `source scripts/notify.sh` |
| `format-slack-message.sh` | Format Slack payloads | `./scripts/format-slack-message.sh <type> <args>` |
| `proceed.sh` | Trigger proceed signals | `./scripts/proceed.sh [signal-name]` |
| `test-story-registry.sh` | Test epic parsing | `./scripts/test-story-registry.sh [epic-id]` |

---

## Workflows Reference

All workflows are invoked by the orchestration scripts. They accept inputs via Claude prompts and output structured JSON.

### assess-story-complexity

**When**: Before task execution (pre-validation)
**Purpose**: Analyze story complexity, flag risky tasks, recommend splits

**Risk thresholds (per task):**
- Subtasks: <12=green, 12-20=yellow, >20=red
- Risk flags: `cross_cutting`, `external_deps`, `file_heavy`, `architectural`, `multi_service`

**Output**: `{ status: "green|yellow|red", tasks: [{ risk_level, split_recommendation }] }`

### validate-task-completion

**When**: After each task execution
**Purpose**: Check completion status, recommend next action

**Actions**: `continue | retry | retry_with_more | split | escalate | fix_tests`

### rewrite-story-splits

**When**: After yellow/red complexity assessment
**Purpose**: Split complex tasks into smaller, manageable pieces

**Strategies**: `split_sequential`, `split_by_type`, `split_by_dependency`, `split_by_location`

### fix-build-errors

**When**: Build failure during post-epic testing
**Purpose**: Analyze and fix TypeScript/import/config errors

### generate-backend-test-plan

**When**: Post-epic testing phase
**Purpose**: Generate API test plan from epic stories and route files
**Output**: JSON with endpoints, test cases (happy path, validation, error, edge case)

### generate-frontend-test-plan

**When**: Post-epic testing phase
**Purpose**: Generate E2E user journey test plan for Playwright
**Output**: JSON with journeys and steps using Playwright action vocabulary

### assess-test-results

**When**: After test execution
**Purpose**: Analyze results, determine verdict (pass/partial/fail)

---

## Post-Epic Testing Pipeline

Runs automatically when `--run-tests` is passed to the epic orchestrator.

```
v7-post-epic-test-runner.sh
  │
  ├── Phase 1: Build Verification
  │   └── v7-post-epic-build-verify.sh
  │       ├── pnpm build (with auto-fix on failure, up to 3 retries)
  │       ├── Start backend/frontend dev servers
  │       └── Health check endpoints
  │
  ├── Phase 2: Backend API Tests
  │   └── v7-post-epic-backend-test.sh
  │       ├── Generate test plan (AI)
  │       ├── Execute curl-based API tests
  │       ├── DB verification for mutations
  │       └── Assess results (AI)
  │
  └── Phase 3: Frontend E2E Tests
      └── v7-post-epic-frontend-e2e.sh
          ├── Generate journey test plan (AI)
          ├── Write Playwright test scripts (AI)
          ├── Execute headlessly via npx playwright test
          ├── Screenshots at key checkpoints
          └── Assess results (AI)
```

**Test runner options:**

| Option | Description |
|--------|-------------|
| `--skip-build` | Skip build verification |
| `--skip-backend` | Skip API tests |
| `--skip-frontend` | Skip E2E tests |
| `--fix-bugs` | Auto-fix failures and rerun |
| `--api-url URL` | Backend URL (default: http://localhost:3001) |
| `--frontend-url URL` | Frontend URL (default: http://localhost:5173) |

---

## Slack Notifications

### Setup

Edit `config/.bmad-secrets`:

```bash
BMAD_SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
BMAD_SLACK_ENABLED="true"
```

### Event Types

| Event | Emoji | When |
|-------|-------|------|
| `story_complete` | | Story finished successfully |
| `epic_complete` | | All stories in epic done |
| `major_rework` | | Story needs fundamental changes |
| `needs_fixes` | | Code review found issues |
| `fixes_failed` | | Auto-fix unsuccessful |
| `session_limit` | | Claude session limit (auto-waits) |
| `weekly_limit` | | Claude weekly limit reached |
| `workflow_complete` | | Workflow success |
| `workflow_failed` | | Workflow failure |
| `test_build_failed` | | Build failure |
| `test_backend_complete` | | Backend tests done |

---

## Proceed Signals

When the orchestrator halts for human decision (story failure, red risk, etc.), you can send proceed signals:

### Web-based (npoint.io)

Configure in `.bmad-secrets`:
```bash
BMAD_NPOINT_API_URL="https://api.npoint.io/YOUR_ID"
BMAD_NPOINT_EDIT_URL="https://www.npoint.io/docs/YOUR_ID"
```

Set the JSON value to: `retry`, `skip`, `split`, or `stop`

### File-based

```bash
# List waiting signals
./scripts/proceed.sh

# Send retry signal
./scripts/proceed.sh <signal-name>

# Stop the entire workflow
touch logs/workflow/proceed-signals/do-not-proceed
```

### Signal Actions

| Signal | Effect |
|--------|--------|
| `retry` | Retry the failed story |
| `skip` | Skip story, continue to next |
| `split` | Invoke SM to split the story |
| `stop` | Stop the entire workflow |

---

## File Location Conventions

The scripts search for files in these locations (in order):

### Epic Files
1. `_bmad-output/planning-artifacts/epics/<epic-id>*.md`
2. `docs/epics/<epic-id>*.md`

### Story Files
1. `_bmad-output/implementation-artifacts/<story-id>*.md`
2. `_bmad-output/implementation-artifacts/stories/<story-id>*.md`
3. `docs/stories/<story-id>*.md`

### Logs & State
- Task logs: `auto-bmad_pack/logs/workflow/<story-slug>/`
- Epic logs: `logs/workflow/epic-<id>/`
- State files: `logs/workflow/orchestrator-state/`
- Proceed signals: `auto-bmad_pack/logs/workflow/proceed-signals/`

### Test Artifacts
- Backend test plan: `_bmad-output/test-artifacts/backend-tests-<epic-id>.json`
- Frontend test plan: `_bmad-output/test-artifacts/frontend-tests-<epic-id>.json`
- Build verification: `_bmad-output/test-artifacts/build-verification-<epic-id>.md`
- Screenshots: `_bmad-output/test-artifacts/screenshots/epic-<id>/`
- Playwright tests: `_bmad-output/test-artifacts/playwright/epic-<id>/`

### Sprint Status
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

---

## Configuration

### Environment Variables

These can be set in `.bmad-secrets` or exported in your shell:

| Variable | Default | Description |
|----------|---------|-------------|
| `BMAD_SLACK_WEBHOOK` | (none) | Slack webhook URL |
| `BMAD_SLACK_ENABLED` | `false` | Enable Slack notifications |
| `BMAD_NPOINT_API_URL` | (none) | npoint.io API URL for proceed signals |
| `BMAD_NPOINT_EDIT_URL` | (none) | npoint.io edit URL (shown in Slack) |

### Path Overrides

Set in environment to override defaults in `lib-common.sh`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PLANNING_ARTIFACTS` | `$PROJECT_ROOT/_bmad-output/planning-artifacts` | Planning artifacts directory |
| `IMPL_ARTIFACTS` | `$PROJECT_ROOT/_bmad-output/implementation-artifacts` | Implementation artifacts directory |
| `TEST_ARTIFACTS` | `$PROJECT_ROOT/_bmad-output/test-artifacts` | Test artifacts directory |

---

## Adapting for a New Project

When copying `auto-bmad_pack/` to a new project, here's what needs attention:

### Required Changes

1. **Secrets file** - Create `config/.bmad-secrets` from `.bmad-secrets.example` with your Slack webhook URL

2. **npoint.io setup** (optional) - Create a new npoint.io document for proceed signals and update the URLs in `.bmad-secrets`

### Check These Files

3. **`scripts/v7-post-epic-backend-test.sh`** (line ~81) - Contains a hardcoded project name reference (`Spec-It`). Change to your project name.

### May Need Changes (depends on your tech stack)

> **Note:** The post-epic testing scripts (build, backend, frontend E2E) were built for a pnpm monorepo with Fastify + Vite + SQLite. Review and update the items below to match your project's technology and infrastructure.

4. **Build commands** - The post-epic test scripts assume a **pnpm monorepo** with `pnpm build`. If your project uses a different build tool (npm, yarn, Turborepo, etc.):
   - `v7-post-epic-build-verify.sh` - Update `pnpm build` and `pnpm dev` commands to match your build system
   - `v7-post-epic-backend-test.sh` - Update server start commands and package filter names (e.g. `pnpm --filter @your-app/server dev`)
   - `v7-post-epic-frontend-e2e.sh` - Update dev server start commands

5. **Server URLs and ports** - Default ports are:
   - Backend: `http://localhost:3001`
   - Frontend: `http://localhost:5173`
   - These can be overridden at runtime with `--api-url` and `--frontend-url` flags, or update the defaults in the scripts

6. **Health check endpoints** - `v7-post-epic-build-verify.sh` checks `GET /api/health` to verify the backend is running. If your API uses a different health endpoint, update the script.

7. **Database path** - `v7-post-epic-backend-test.sh` assumes SQLite at `packages/server/data/spec-it.db` for DB verification queries. Update if your project uses a different database or path.

8. **Monorepo package paths** - The post-epic test scripts reference paths like `packages/server/src/routes/` and `packages/shared/src/`. If your project has a different directory structure, update these path references in:
   - `v7-post-epic-backend-test.sh` - Route file discovery
   - `v7-post-epic-build-verify.sh` - Build error fix workflow context

### No Changes Needed

- All BMAD agent paths use the standard `/bmad:bmm:agents:*` pattern
- All workflow paths use relative references
- `lib-common.sh` paths are environment-variable overridable
- Log directories are created automatically
- The `install.sh` script is project-agnostic

### Clean Up Before Sharing

Delete these directories (they contain project-specific runtime data):
```bash
rm -rf auto-bmad_pack/logs/workflow/*/
```

---

## Troubleshooting

### "BMAD installation not detected"
Ensure your project has `_bmad/` directory with V4+ agents installed.

### "Epic file not found"
Check that your epic file matches the naming pattern: `<epic-id>*.md` in the expected location.

### "Story file not found"
The orchestrator will create it automatically via the `create-story` workflow. If it still fails, check that the epic file contains the story definition.

### Rate limits
- **Session limit**: Auto-detected and auto-waited (5-minute intervals, up to 5 hours)
- **Weekly limit**: Sends Slack notification with reset time. Requires manual resume.
- Use `--max-turns` to control tokens per task

### Story stuck / long-running task
- Tasks have a 30-minute timeout (`gtimeout 1800`)
- CR fix phases have a 20-minute timeout (`gtimeout 1200`)
- On timeout, the orchestrator retries or moves to the next phase

### Context window overflow
- The orchestrator generates a **developer handoff document** when a session hits its context limit
- The next session loads the handoff as context and continues where the previous left off
- No manual intervention needed

### Killing a running workflow
```bash
# Find the orchestrator PID
ps aux | grep "v7-orchestrated-epic" | grep -v grep

# Kill it (waits for current subprocess to finish)
kill <PID>

# Resume later
./scripts/v7-orchestrated-epic.sh <epic-id> --start-story <next-story>
```

---

## Updating

To update Auto-BMAD Pack:
1. Replace `auto-bmad_pack/` with the new version
2. Re-run `./auto-bmad_pack/install.sh`
3. Existing `.bmad-secrets` will be preserved
4. Review the changelog for any new configuration options

---

## License

Part of the BMAD Method. See main BMAD repository for license.
