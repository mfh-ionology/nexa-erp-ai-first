# Journey 11: Admin Skill Detail & Override — Visual Checkpoint Manifest

## Checkpoint 1: Skill Detail Sheet Open (after Step 2)
- **When**: After clicking first skill card on the Skills page
- **Screenshot file**: `step-2-skill-detail-sheet-open.png`
- **What to look for**:
  - Slide-out sheet visible from right side, max-width ~440px
  - Sheet header shows skill display name (serif font, text-lg) and description
  - Active/Inactive toggle switch visible (ADMIN only) with purple checked state
  - Editable trigger phrases section with green pills and text input
  - Editable priority number input (ADMIN only)
  - Read-only skill instructions in monospace `<pre>` block with secondary background
  - Read-only required tools as outline badges
  - Footer with "Reset to Default" button (disabled if no override), "Cancel" button, and purple "Save Override" button
  - Concept D styling: 12px radius cards, purple accents (#7c3aed)

## Checkpoint 2: Override Saved (after Step 6)
- **When**: After clicking "Save Override" button
- **Screenshot file**: `step-6-override-saved-toast.png`
- **What to look for**:
  - Success toast notification visible with "Skill override saved" text
  - Sheet has closed (no longer visible)
  - Skill card in list may show "Custom override applied" badge
  - Skills page visible in background with module groups

## Checkpoint 3: Sheet Re-opened with Overrides (after Step 7)
- **When**: After clicking the same skill card again
- **Screenshot file**: `step-7-sheet-with-overrides.png`
- **What to look for**:
  - Sheet re-opened showing the overridden values
  - Toggle reflects the toggled state from step 3
  - New trigger phrase "display records" visible as green pill
  - Priority shows overridden value (150 or capped at 100)
  - "Custom override applied" badge visible in sheet header
  - "Reset to Default" button now ENABLED (since override exists)

## Checkpoint 4: Override Reset (after Step 8)
- **When**: After clicking "Reset to Default" button
- **Screenshot file**: `step-8-override-reset-toast.png`
- **What to look for**:
  - Success toast notification visible with "Override removed — using default settings" text
  - Sheet has closed
  - Skill card no longer shows override badge
  - Skills page visible, skill card back to default state
