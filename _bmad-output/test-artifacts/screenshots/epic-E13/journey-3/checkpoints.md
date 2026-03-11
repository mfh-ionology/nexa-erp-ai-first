# Visual Checkpoints — Journey 3: Change User Print Preference and Save

## Checkpoint 1: Unsaved changes warning after changing Sales Invoice preference
- **When**: After step 5 — Sales Invoice changed to a different value
- **Screenshot file**: `step-5-unsaved-changes-warning.png`
- **What to look for**:
  - Amber warning triangle icon with text "You have unsaved changes" visible in the action bar
  - Save Preferences button is now enabled (purple #7c3aed background, not greyed out)
  - Sales Invoice row dropdown shows new value (different from company default)
  - Rest of the table rows still show their default values
- **Result**: PASS — All expected visual elements present. Warning text, enabled save button, changed dropdown value all correct.

## Checkpoint 2: Success toast after saving preferences
- **When**: After step 9 — Save Preferences clicked, both Sales Invoice and Purchase Order changes saved
- **Screenshot file**: `step-9-save-success-toast.png`
- **What to look for**:
  - Green/success toast notification visible with text "Print preferences saved successfully"
  - Save Preferences button returns to disabled state (greyed out)
  - "You have unsaved changes" warning has disappeared from the action bar
- **Result**: PASS — Green success toast at top-right with correct text. Save button disabled. Warning gone.

## Checkpoint 3: Persisted values after page reload
- **When**: After step 12 — Navigated away and returned to the Print Preferences page
- **Screenshot file**: `step-12-persisted-values-after-reload.png`
- **What to look for**:
  - Print Preferences page has reloaded with correct persisted values
  - Sales Invoice and Purchase Order show the values we set (persisted)
  - Save Preferences button is disabled (no pending changes)
  - No "unsaved changes" warning visible
- **Result**: PASS — Values persisted correctly. Save button disabled. No warning.

## Bug Found During Testing

**Print Preference API Missing Success Envelope** — The print-preference API routes return raw JSON arrays instead of the standard `{ success: true, data: [...] }` envelope format expected by the frontend `ApiClient`. This causes the page to always show "Failed to load print preferences" error state. The test uses a Playwright route interceptor to wrap responses as a workaround. See `missing-functionality-epic-E13.md` for full details.
