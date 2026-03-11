# Journey 8: Navigation Blocker for Unsaved Changes — Visual Checkpoints

## Checkpoint 1: Page loaded with preference table
- **When**: After navigating to /system/print-preferences and table loads
- **Screenshot file**: step-1-print-preferences-loaded.png
- **What to look for**: Print Preferences page with header, preference table showing all 14 document types, Save Preferences button disabled, no unsaved changes warning

## Checkpoint 2: Unsaved change made — dirty state visible
- **When**: After changing Credit Note dropdown to "Browser Print Dialog"
- **Screenshot file**: step-3-unsaved-change-made.png
- **What to look for**: Credit Note row shows "Browser Print Dialog" in dropdown. Amber warning "You have unsaved changes" visible in action bar. Save Preferences button is now enabled (purple).

## Checkpoint 3: Navigation blocker dialog visible
- **When**: After clicking Dashboard link in sidebar with unsaved changes
- **Screenshot file**: step-4-navigation-blocker-dialog.png
- **What to look for**: AlertDialog overlay with title "You have unsaved changes", description "Your changes will be lost if you leave this page without saving.", Cancel button and destructive "Discard & Leave" button visible.

## Checkpoint 4: Still on Print Preferences after cancelling blocker
- **When**: After clicking Cancel in the blocker dialog
- **Screenshot file**: step-7-still-on-print-preferences.png
- **What to look for**: Print Preferences page still visible. Page heading "Print Preferences" present. Credit Note still shows "Browser Print Dialog". Unsaved changes warning still visible.

## Checkpoint 5: Navigated to Dashboard after discarding changes
- **When**: After clicking "Discard & Leave" in the blocker dialog
- **Screenshot file**: step-10-dashboard-after-discard.png
- **What to look for**: Dashboard page loaded — URL is "/" or "/dashboard". Print Preferences page is no longer visible. No blocker dialog visible. Dashboard content or greeting visible.
