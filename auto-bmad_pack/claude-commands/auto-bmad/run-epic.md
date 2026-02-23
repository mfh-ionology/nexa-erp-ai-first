---
name: 'auto-bmad-epic'
description: 'Run V4 epic workflow - loops through all stories in an epic using the story workflow'
---

# Auto-BMAD Epic Workflow

Execute the V4 epic workflow that processes all stories in an epic.

## What This Does

1. **Load Epic** - Find and parse epic file to extract story list
2. **Loop Stories** - For each story in the epic:
   - Skip if already DONE
   - Run `v4-story-workflow.sh` (11 steps)
   - Track completion status
3. **PO Check** - Verify all stories complete
4. **Notify** - Send Slack summary with epic results

## Usage

When user invokes this skill, extract the epic ID from their request and run:

```bash
./scripts/v4-epic-workflow.sh <epic-id> [options]
```

### Options
- `--skip-risk` - Skip risk profile step for all stories
- `--skip-nfr` - Skip NFR assessment step for all stories
- `--max-turns N` - Set max Claude turns per step (default: 50)

## Examples

User says: "Run epic workflow for E01"
→ Execute: `./scripts/v4-epic-workflow.sh E01`

User says: "Process epic E11 skipping risk and NFR"
→ Execute: `./scripts/v4-epic-workflow.sh E11 --skip-risk --skip-nfr`

User says: "Run all stories in epic 3"
→ Execute: `./scripts/v4-epic-workflow.sh E03`

## Prerequisites

- BMAD V4 installed with agents: `/bmad-sm`, `/bmad-po`, `/bmad-qa`, `/bmad-dev`
- Epic file in `docs/epics/` or `_bmad-output/planning-artifacts/epics/`
- Slack webhook configured in `.bmad-secrets` (optional)

## Epic File Locations

The script searches for epic files in:
1. `_bmad-output/planning-artifacts/epics/<epic-id>*.md`
2. `docs/epics/<epic-id>*.md`
3. `_bmad-output/planning-artifacts/<epic-id>*.md`

## Story ID Patterns Recognized

- Table format: `| E01-S01 |`
- ID format: `E01-S01`, `E1-S1`
- Numbered: `Story 1.1`, `Story 1.2`

## Output

- Logs saved to `logs/workflow/<epic-id>-epic-<timestamp>.log`
- Individual story logs in `logs/workflow/<story-id>-v4-*.log`
- Slack notification with epic summary:
  - Total stories
  - Completed count
  - Skipped (already done) count
  - Failed count
  - List of failed stories (if any)

## Behavior

- **Already done stories** are skipped automatically
- **On story failure**, prompts whether to continue with remaining stories
- **5-second pause** between stories to avoid rate limits

<execution>
1. Parse the user's request to extract the epic ID
2. Identify any options (--skip-risk, --skip-nfr, --max-turns)
3. Run the script: `./scripts/v4-epic-workflow.sh <epic-id> [options]`
4. Monitor progress and report status updates to user
5. Report final epic summary
</execution>
