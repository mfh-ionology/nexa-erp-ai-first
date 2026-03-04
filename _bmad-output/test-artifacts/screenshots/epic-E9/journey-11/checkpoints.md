# Journey 11: Navigation Blocker for Unsaved Changes — Visual Checkpoints

## Checkpoint 1: Preferences Page Loaded
- **When**: After navigating to /system/notification-preferences and page fully loads
- **Screenshot file**: `step-1-preferences-page-loaded.png`
- **What to look for**: Page heading "Notification Preferences" visible. Preference matrix with category sections showing toggle switches. Save button visible but disabled (no changes yet). No unsaved changes warning.

## Checkpoint 2: Toggle Changed — Dirty State Active
- **When**: After clicking a channel toggle switch to create unsaved changes
- **Screenshot file**: `step-2-toggle-changed-dirty-state.png`
- **What to look for**: One toggle has flipped state. Amber "Unsaved Changes" warning with triangle icon visible in the action bar area. Save button is now enabled (purple background).

## Checkpoint 3: Navigation Blocker Dialog Appears
- **When**: After clicking sidebar Dashboard link while unsaved changes exist
- **Screenshot file**: `step-3-navigation-blocker-dialog.png`
- **What to look for**: AlertDialog modal overlay visible. Title says "Unsaved Changes". Description warns about losing changes. Two buttons: "Cancel" (stay on page) and "Discard & Leave" (destructive red style). Preferences page is still visible behind the dialog.

## Checkpoint 4: Navigated Away After Discarding Changes
- **When**: After clicking "Discard & Leave" in the blocker dialog
- **Screenshot file**: `step-4-navigated-to-dashboard.png`
- **What to look for**: User has navigated away from preferences page. Dashboard or target page is loaded. No navigation blocker dialog visible. Preferences page changes were discarded.
