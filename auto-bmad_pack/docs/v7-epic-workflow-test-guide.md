# V7 Epic Workflow Test Guide

## Scripts Updated

| Script | Purpose |
|--------|---------|
| `v7-orchestrated-epic.sh` | Epic-level orchestration with SM/TEA agents |
| `v7-orchestrated-workflow.sh` | Story-level orchestration (already tested) |
| `proceed.sh` | Helper to trigger local proceed signals |

## Key Changes

### 1. Agent + Workflow Pattern
All Claude steps now activate agent first, then invoke workflow:
```
Agent: /bmad:bmm:agents:sm → Workflow: /bmad:bmm:workflows:sprint-planning
Agent: /bmad:bmm:agents:tea → Workflow: /bmad:bmm:workflows:testarch-test-design
```

### 2. Web-based Proceed Signal (npoint.io)
When a story has issues, workflow waits for proceed signal via web.

**Config** (in `auto-bmad_pack/config/.bmad-secrets`):
```bash
BMAD_NPOINT_API_URL="https://api.npoint.io/811525f278297577708b"
BMAD_NPOINT_EDIT_URL="https://www.npoint.io/docs/811525f278297577708b"
BMAD_PROCEED_WEB_ENABLED="true"
```

**Proceed Code Format**: `proceed-<story-id>`
- Story 0-4 → `proceed-0-4`
- Story 1-2 → `proceed-1-2`

**To trigger proceed from mobile**:
1. Open: https://www.npoint.io/docs/811525f278297577708b
2. Change `{"proceed": ""}` to `{"proceed": "proceed-0-4"}`
3. Save

### 3. Code Review Pass Condition
- **PASS**: No HIGH severity issues (MEDIUM/LOW acceptable)
- **After 3 iterations**: Log remaining issues to story file, continue to TEA>>RV
- Human reviews all stories after EPIC completion

## Test Commands

### Test Epic 0 (Full Run)
```bash
cd auto-bmad_pack/scripts
./v7-orchestrated-epic.sh 0
```

### Test with Skip Options
```bash
# Skip pre-epic phase (SM *SP, TEA *TD)
./v7-orchestrated-epic.sh 0 --skip-pre

# Skip test design only
./v7-orchestrated-epic.sh 0 --skip-td

# Start from specific story
./v7-orchestrated-epic.sh 0 --start-story 3

# Resume from state file
./v7-orchestrated-epic.sh 0 --resume
```

### Test Proceed Signal (Manual)
```bash
# Check current npoint value
curl -s https://api.npoint.io/811525f278297577708b

# Set proceed signal
curl -X POST https://api.npoint.io/811525f278297577708b \
  -H "Content-Type: application/json" \
  -d '{"proceed": "proceed-0-4"}'

# Clear proceed signal
curl -X POST https://api.npoint.io/811525f278297577708b \
  -H "Content-Type: application/json" \
  -d '{"proceed": ""}'
```

## Epic 0 Flow

```
PRE-EPIC:
  1. SM *SP (Sprint Planning) → Creates sprint-status.yaml
  2. TEA *TD (Test Design) → Epic-level test planning

STORY LOOP:
  For each story in epic:
    - Run v7-orchestrated-workflow.sh
    - If issues: Send Slack notification, wait for proceed signal
    - Continue to next story after proceed

POST-EPIC:
  3. TEA *TR (Traceability) → Requirements coverage
  4. SM Retrospective → Lessons learned
```

## Expected Log Locations

```
logs/workflow/epic-0/
├── 0-epic-v7-YYYYMMDD-HHMMSS.log  # Main epic log
├── 0-sm-sprint-planning.log       # SM *SP output
├── 0-tea-test-design.log          # TEA *TD output
├── 0-tea-trace.log                # TEA *TR output
└── 0-sm-retrospective.log         # Retrospective output

logs/workflow/orchestrator-state/
└── 0-epic-orchestrator-state.yaml # Epic state file
```

## Troubleshooting

### Proceed signal not detected
- Check npoint.io JSON is valid: `{"proceed": "proceed-0-4"}`
- Verify URL in config matches
- Check curl can reach npoint.io

### Agent not activating
- Ensure skill path starts with `/bmad:bmm:agents:`
- Check logs for skill invocation errors

### Story workflow failing
- Review story-level logs in `logs/workflow/<story-id>/`
- Check if story file exists in `_bmad-output/implementation-artifacts/`
