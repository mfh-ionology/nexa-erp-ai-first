# Visual Checkpoint Manifest — Journey 2: Memory Management Page Load & Layout

## Checkpoint 1: Memory Page Title and Header
- **When**: After navigating to /ai/memory and page loads (Step 2)
- **Screenshot file**: step-2-memory-page-loaded.png
- **What to look for**:
  - Page title "My Memory" visible with Brain icon
  - Concept D styling: light purple (#f4f2ff) background
  - Purple accents on active elements
  - Settings panel visible at top of page
  - Skeleton loading should have completed (no skeleton placeholders visible)

## Checkpoint 2: Settings Panel Elements
- **When**: After verifying settings panel exists (Step 3)
- **Screenshot file**: step-3-settings-panel.png
- **What to look for**:
  - "Enable AI Memory" toggle switch in ON state (purple/checked)
  - Category checkboxes all checked: Preferences, Instructions, Workflows, Decisions, Entity Context
  - Retention Period selector visible
  - "Forget Everything" red destructive button visible in danger zone
  - Cards with 12px border-radius and custom shadows

## Checkpoint 3: Full Memory List with Grouped Cards
- **When**: After verifying memory list renders grouped by category (Step 6)
- **Screenshot file**: step-6-memory-list-grouped.png
- **What to look for**:
  - Memory cards displayed grouped by category sections
  - Collapsible category section headers with count badges
  - Category badges with semantic colours (blue for Preferences, green for Workflows, etc.)
  - Source badges: "Explicit" (purple-tinted) and "Learned" (grey)
  - Creation dates visible on cards
  - Cards with 12px radius, fadeInUp animation style
  - Memory content displayed in quoted format
