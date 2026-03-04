# Visual Checkpoints — Journey 9: Toggle a Preference and Save

## Checkpoint 1: Preferences page loaded
- **When**: After navigating to /system/notification-preferences and page is ready
- **Screenshot**: `step-1-preferences-page-loaded.png`
- **What to look for**: Page title "Notification Preferences" visible. Action bar with "Reset to Defaults" (ghost) and "Save" (disabled/greyed) buttons. Preference matrix with category sections expanded, showing toggle switches for In-App, Email, Push columns.

## Checkpoint 2: Toggle changed — unsaved state
- **When**: After clicking the Email toggle for the first notification template
- **Screenshot**: `step-2-toggle-changed-unsaved.png`
- **What to look for**: One toggle has flipped state. Amber "Unsaved Changes" warning with triangle icon visible in the action bar. Save button is now enabled (purple background, not greyed). The changed toggle reflects its new position.

## Checkpoint 3: After saving — clean state restored
- **When**: After clicking Save and the save operation completes
- **Screenshot**: `step-3-saved-clean-state.png`
- **What to look for**: No "Unsaved Changes" warning visible. Save button is disabled again (greyed out). The toggle remains in its new saved position. No error toasts or messages.

## Checkpoint 4: Persistence verified after reload
- **When**: After navigating away and back to /system/notification-preferences
- **Screenshot**: `step-4-persistence-after-reload.png`
- **What to look for**: Preferences page fully loaded again. The Email toggle that was changed earlier still reflects the saved value (not reverted to original). This confirms the change persisted to the backend and loads correctly.
