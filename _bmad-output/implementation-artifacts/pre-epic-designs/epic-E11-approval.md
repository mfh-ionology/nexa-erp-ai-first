# Epic E11 — Cross-cutting Tasks: Design Gate Approval

**Date:** 2026-03-04
**Epic:** E11 — Cross-cutting Tasks
**Approved by:** Mohammed (2026-03-04)

---

## Approval Status: APPROVED

### Pages/Components for Review

| # | Page/Component | Template | Story | Status |
|---|---------------|----------|-------|--------|
| 1 | My Tasks Page | T1 (Entity List) | E11.S2 | Pending |
| 2 | Create Task Dialog | Dialog (modal) | E11.S2 | Pending |
| 3 | Task Detail Sheet | Sheet (slide-in) | E11.S2 | Pending |
| 4 | Task Panel (embedded) | Section in T2/T3 | E11.S2 | Pending |
| 5 | Tasks Today Card | T4 (existing update) | E11.S2 | Pending |

### v0 Prompt Status

- v0 prompt generated: `epic-E11-v0-prompt.md`
- Uses existing design system base from `epic-E5-E5b-v0-prompt.md`
- E11 designs also defined in `v0-prompts-E5c-to-E13b.md` (E11 section)

### Notes

- **Task Panel is cross-cutting** — it will eventually be embedded on every T2/T3 record detail page across all modules. For E11.S2, it should be implemented as a reusable component and initially wired into 2-3 existing detail pages (e.g. Customer, Invoice) as proof of concept.
- **No full Task Detail page** — uses Sheet (slide-in) instead to keep user in context. If Mohammed prefers a full page, this can be changed.
- **User Multi-Select** — the assignee picker should follow the same pattern as Access Group member assignment from E5b.
- **Entity Link routing** — needs a shared `entityTypeToRoute` mapping utility for navigating from entity codes to detail pages.
- **Dashboard wiring** — lightweight update to existing bottom-cards.tsx, replacing mock data with real API.

### Design Gate Checklist

- [x] Page inventory created (`epic-E11-page-inventory.md`)
- [x] Template assignments verified (T1, Dialog, Sheet, Section, T4-update)
- [x] v0 prompt generated with Concept D design system base
- [x] All UI stories have wireframes
- [x] Component list identified (12 new components)
- [x] Responsive breakpoints specified
- [x] Mohammed's approval recorded (2026-03-04)
- [ ] v0 reference components committed to `v0-nexa-design/`

### Post-Approval: Ready for Orchestrator

```bash
nohup env -u CLAUDECODE bash auto-bmad_pack/scripts/v7-orchestrated-epic.sh E11 --run-tests > /tmp/e11-orchestrator.log 2>&1 &
```
