# Visual Checkpoint Manifest — Journey 1: AI Section Appears in Sidebar Navigation

## Checkpoint 1: App Shell Loaded
- **When**: After navigating to `/` (Step 1)
- **Screenshot file**: `step-1-app-shell-loaded.png`
- **What to look for**: App shell renders with purple sidebar visible on left, top bar with 'N' logo, sidebar showing module sections (Main, Operations, Other, AI, Administration). Light purple (#f4f2ff) background. Sidebar is expanded (not collapsed).

## Checkpoint 2: AI Section Visible with All 3 Nav Items
- **When**: After verifying AI section and its items (Steps 2-4 combined)
- **Screenshot file**: `step-3-ai-section-with-items.png`
- **What to look for**: AI section group visible in sidebar with "AI" section heading (uppercase, small text). Below it, 3 navigation links visible:
  1. "Morning Briefing" with Sun icon
  2. "My Memory" with Brain icon
  3. "Skills" with Wand2 icon
  A divider line should appear above the AI section (showDivider: true). All items should have muted text colour (not active/highlighted since none are the current route).
