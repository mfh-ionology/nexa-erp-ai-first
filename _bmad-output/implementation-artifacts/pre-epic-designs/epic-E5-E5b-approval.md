# Epic E5 + E5b — Frontend Design Approval

**Date:** 2026-03-01
**Approved by:** Mohammed

## Page Inventory
- [X] Reviewed and approved (see epic-E5-E5b-page-inventory.md)

## v0 Prompt
- [X] Generated and reviewed (see epic-E5-E5b-v0-prompt.md)

## v0 Output
- [X] Used as reference code (saved to apps/web/src/components/v0-reference/epic-E5-E5b/)
- [ ] Used as visual reference only (saved screenshots)
- [ ] Not used (standard templates sufficient)

### v0 Reference Files
| File | Component(s) | Screen |
|------|-------------|--------|
| briefing-page.tsx | AIBriefingPage, Sparkline, BriefingSkeleton | AI Morning Briefing |
| briefing-action-card.tsx | BriefingActionCard | Briefing actionable items |
| memory-page.tsx | AIMemoryPage, MemorySettingsPanel, ForgetAllDialog, EditDialog, DeleteDialog | AI Memory Management |
| memory-card.tsx | MemoryCard (with category/source badges) | Memory card component |
| skills-page.tsx | AISkillsPage, SkillCard, SkillDetailSheet, TestPhrase panel | AI Skills Browser |
| copilot-drawer.tsx | CopilotDrawer with entity mentions, trigger detection, autocomplete | Co-Pilot with inline entity mentions |
| entity-autocomplete.tsx | EntityAutocompleteDropdown | Autocomplete dropdown |
| entity-chip.tsx | EntityChip, EntityMention type, EntityType type | Inline entity chip |

## New Components Installed
- None — all required Shadcn components already installed

## Decisions from Mohammed
1. **Sidebar:** New top-level "AI" section (NOT under Settings). Routes: `/ai/briefing`, `/ai/memory`, `/ai/skills`
2. **AI Settings vs AI Config:** User-facing AI pages under top-level "AI" section. Admin configuration pages (E5c/E5d) stay under Settings > AI Configuration
3. **Entity Mentions scope:** To be determined during implementation — can start with subset
4. **v0 refinement:** Review after epic implementation, add refinement story if needed

## Design System Compliance
- [X] Purple primary (#7c3aed) throughout
- [X] Card 12px radius + purple hover shadow
- [X] JetBrains Mono for amounts/codes
- [X] Semantic status colours
- [X] fadeInUp/slideIn/stepIn animations with stagger delays
- [X] Skeleton loading states (no spinners)
- [X] Empty states with illustration + CTA
- [X] Plus Jakarta Sans headings
- [X] Focus rings on inputs

## Notes
- v0 generated Next.js App Router pages — our app uses TanStack Router. Dev agent must adapt routing.
- v0 hardcoded English strings — Dev agent must use useI18n() / translation keys.
- v0 rebuilt CopilotDrawer from scratch — Dev agent should extract entity mention logic as enhancement to existing CopilotInput, not replace the full drawer.
- erp-nav.tsx from v0 is NOT used — we have our own app-sidebar.tsx.

## Ready for Orchestrator
- [X] Frontend design approved
- [X] All required Shadcn components installed
- [X] v0 reference materials committed
- [X] Ready to run: v7-orchestrated-epic.sh E5b
