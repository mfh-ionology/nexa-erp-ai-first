# Epic E10 — Email Integration: Design Gate Approval

**Date:** 2026-03-04
**Epic:** E10 — Email Integration
**Approved by:** Pending Mohammed's review

---

## Approval Status: PENDING

### Pages/Components for Review

| # | Page/Component | Template | Story | Status |
|---|---------------|----------|-------|--------|
| 1 | Email Template Editor | T7 (Settings, split-pane) | E10.S2 | Pending |
| 2 | Email Composition Dialog | Dialog (modal) | E10.S3 | Pending |

### v0 Prompt Status

- v0 prompt generated: `epic-E10-v0-prompt.md`
- Uses existing design system base from `epic-E5-E5b-v0-prompt.md`
- E10 designs also pre-defined in `v0-prompts-E5c-to-E13b.md` (E10 section)

### Notes

- E10 has 3 stories: S1 (SMTP Outbound backend), S2 (Email Template Editor UI), S3 (Document-to-Email Dialog)
- S1 is backend-only — no design gate needed
- The Email Composition Dialog integrates into existing document detail pages (T3 template) via Action Bar overflow
- HTML editor for template body — consider Monaco Editor or lighter alternative
- Auto-generated PDF depends on E12 (Document Templates) — placeholder if not ready

### Design Gate Checklist

- [x] Page inventory created
- [x] Template assignments verified (T7 for editor, Dialog for composition)
- [x] v0 prompt generated with Concept D design system base
- [x] All UI stories have wireframes
- [x] Component list identified
- [x] Responsive breakpoints specified
- [ ] Approval recorded

### Post-Approval: Ready for Orchestrator

```bash
nohup env -u CLAUDECODE bash auto-bmad_pack/scripts/v7-orchestrated-epic.sh E10 --run-tests > /tmp/e10-orchestrator.log 2>&1 &
```
