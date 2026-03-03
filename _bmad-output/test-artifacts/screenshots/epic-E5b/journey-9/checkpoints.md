# Visual Checkpoint Manifest — Journey 9: AI Skills Browser Page Load & Layout

## Checkpoint 1: Skills Page Initial Load
- **When**: After step 1 — clicking "Skills" link in sidebar and page loads
- **Screenshot file**: `step-1-skills-page-loaded.png`
- **What to look for**:
  - Page navigated to /ai/skills
  - Page title "AI Skills" visible with Wand2 icon
  - Concept D styling: light purple (#f4f2ff) background
  - Search input visible with "Search skills..." placeholder
  - Module filter dropdown visible
  - Accordion sections grouped by module visible below controls
  - Skeleton loading should have completed (no loading placeholders)

## Checkpoint 2: Skill Cards Detail View
- **When**: After step 4 — verifying skill card contents in the first expanded module group
- **Screenshot file**: `step-4-skill-cards-detail.png`
- **What to look for**:
  - Skill cards with 12px border-radius and custom shadow
  - Each card shows: skill display name, description text
  - Green pill tags for trigger phrases (bg-[#d1fae5] text-[#065f46])
  - Red pill tags for negative triggers if present (bg-[#fee2e2] text-[#991b1b])
  - Green dot with "Active" label for active skills
  - Orchestration pattern badge with semantic colour coding
  - Skill count badge on module group header
  - fadeInUp animation on card entry (cards visible, not mid-animation)
  - Cards with purple-tinted hover shadow on interaction
