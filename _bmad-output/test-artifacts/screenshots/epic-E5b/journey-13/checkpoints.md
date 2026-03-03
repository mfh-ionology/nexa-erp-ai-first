# Visual Checkpoint Manifest — Journey 13: Concept D Visual Compliance Check

## Checkpoint 1: Memory Page Full Render
- **When**: After navigating to /ai/memory and waiting for content to load (Step 2)
- **Screenshot file**: `step-2-memory-page-concept-d.png`
- **What to look for**:
  - Light purple (#f4f2ff) page background — NOT white or grey
  - Purple primary (#7c3aed) on action buttons and toggle switches
  - Cards with 12px border-radius and custom shadow
  - Plus Jakarta Sans on headings (check font rendering)
  - Inter body text on labels and descriptions
  - Skeleton loading must be completed (no skeleton placeholders visible)
  - Focus rings visible on interactive elements if focused
  - Settings panel, stats panel, and memory list all visible

## Checkpoint 2: Skills Page Full Render
- **When**: After navigating to /ai/skills and waiting for content to load (Step 4)
- **Screenshot file**: `step-4-skills-page-concept-d.png`
- **What to look for**:
  - Light purple (#f4f2ff) background consistent with memory page
  - Category badges with semantic colours on skill cards
  - Green trigger phrase tags (green pill badges)
  - Red negative trigger tags (if any skills have them)
  - Purple active status indicators (green dot + "Active" text)
  - Cards with 12px border-radius and purple-tinted hover shadow
  - fadeInUp animation visible on card entry (may show in final state)
  - Module groups with accordion expand/collapse
  - Search input and module filter dropdown visible

## Checkpoint 3: Focus Ring Accessibility
- **When**: After tabbing through interactive elements on skills page (Step 5)
- **Screenshot file**: `step-5-focus-ring-check.png`
- **What to look for**:
  - Visible focus ring (outline/ring) on the currently focused interactive element
  - Focus ring should be clearly visible — not hidden or invisible
  - WCAG 2.1 AA compliance: 3:1 contrast ratio for focus indicator
  - Focus ring should appear on buttons, links, inputs, toggles
