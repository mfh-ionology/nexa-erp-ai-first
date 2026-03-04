# Visual Checkpoints — Journey 8: Notification Preferences Page Load

## Checkpoint 1: Preferences Page Initial Load
- **When**: After navigating to `/system/notification-preferences` and page fully loads (Step 1)
- **Screenshot file**: `step-1-preferences-page-loaded.png`
- **What to look for**:
  - Page header with title "Notification Preferences"
  - Breadcrumbs showing "System > Notification Preferences"
  - Action bar with "Reset to Defaults" button and disabled "Save" button
  - Description text below header
  - Preference matrix with collapsible category sections expanded
  - Each category has event rows with three toggle columns (In-App, Email, Push)
  - Purple-tinted design theme (Concept D)

## Checkpoint 2: Category Sections with Toggle Grid
- **When**: After verifying category sections and column headers exist (Steps 2-4)
- **Screenshot file**: `step-4-toggle-switches-visible.png`
- **What to look for**:
  - At least one expanded category section with its header (e.g., "Approval", "Invoice")
  - Column headers: Event, In-App, Email, Push visible in the grid
  - Switch toggle components in each row — some checked (purple), some unchecked
  - Chevron icons on category headers indicating expanded state

## Checkpoint 3: Save Button Disabled State
- **When**: After verifying Save button is disabled (Step 6)
- **Screenshot file**: `step-6-save-button-disabled.png`
- **What to look for**:
  - Save button visible but greyed out / disabled (not purple)
  - No "Unsaved Changes" amber warning visible
  - Clean state — no modifications have been made
