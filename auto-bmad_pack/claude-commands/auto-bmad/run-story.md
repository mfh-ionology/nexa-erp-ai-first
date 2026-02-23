---
name: 'auto-bmad-story'
description: 'Run V4 story workflow - 11-step automated story lifecycle with SM, QA, PO, DEV agents'
---

# Auto-BMAD Story Workflow

Execute the full V4 story workflow for a given story ID.

## What This Does

Runs an 11-step automated workflow:

| Step | Agent | Command | Purpose |
|------|-------|---------|---------|
| 1 | SM | `*draft` | Create story draft |
| 2 | QA | `*risk-profile` | Risk assessment |
| 3 | QA | `*test-design` | Test scenarios |
| 4 | PO | `*validate-story-draft` | Validate → READY FOR DEV (Slack on fail) |
| 5 | DEV | `*develop-story` | Implementation |
| 6 | QA | `*trace` | Requirements traceability |
| 7 | QA | `*nfr-assess` | Non-functional requirements |
| 8 | QA | `*review` | Quality review |
| 9 | DEV | `*review-qa` | Apply QA fixes |
| 10 | QA | `*gate` | Final gate → set DONE |
| 11 | PO | Check status | Slack notification |

## Usage

When user invokes this skill, extract the story ID from their request and run:

```bash
./scripts/v4-story-workflow.sh <story-id> [options]
```

### Options
- `--skip-risk` - Skip risk profile step (Step 2)
- `--skip-nfr` - Skip NFR assessment step (Step 7)
- `--max-turns N` - Set max Claude turns per step (default: 50)

## Examples

User says: "Run story workflow for E01-S01"
→ Execute: `./scripts/v4-story-workflow.sh E01-S01`

User says: "Run E11.01 story skipping risk"
→ Execute: `./scripts/v4-story-workflow.sh E11.01 --skip-risk`

User says: "Execute story E02-S03 with max 75 turns"
→ Execute: `./scripts/v4-story-workflow.sh E02-S03 --max-turns 75`

## Prerequisites

- BMAD V4 installed with agents: `/bmad-sm`, `/bmad-po`, `/bmad-qa`, `/bmad-dev`
- Slack webhook configured in `.bmad-secrets` (optional, for notifications)
- Epic/story files in expected locations

## Output

- Logs saved to `logs/workflow/<story-id>-v4-<timestamp>.log`
- Slack notifications on PO validation fail and workflow completion
- Story status updated to DONE on success

<execution>
1. Parse the user's request to extract the story ID
2. Identify any options (--skip-risk, --skip-nfr, --max-turns)
3. Run the script: `./scripts/v4-story-workflow.sh <story-id> [options]`
4. Report progress and final status to user
</execution>
