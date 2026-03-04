# Visual Checkpoints — Journey 10: Reset Preferences to Defaults

## Checkpoint 1: Preferences page loaded with custom preference
- **When**: After login and navigation to /system/notification-preferences, and after toggling+saving a preference to ensure a custom override exists
- **Screenshot**: `step-1-preferences-with-custom-override.png`
- **What to look for**: Notification preferences page loaded. Preference matrix visible with toggle switches. At least one toggle reflects a custom (non-default) value. Save button disabled (no pending changes).

## Checkpoint 2: Reset confirmation dialog appears
- **When**: After clicking the 'Reset to Defaults' button (ghost button with RotateCcw icon)
- **Screenshot**: `step-2-reset-confirmation-dialog.png`
- **What to look for**: AlertDialog modal visible over the preferences page. Title says "Reset to Defaults". Description warns "Reset all preferences to their default values? This cannot be undone." Two buttons: "Cancel" and "Reset to Defaults" (destructive red style).

## Checkpoint 3: Preferences reset to template defaults
- **When**: After clicking "Reset to Defaults" in the confirmation dialog
- **Screenshot**: `step-3-preferences-reset-to-defaults.png`
- **What to look for**: Preferences page with matrix reloaded. Success toast "Preferences reset to defaults" may be visible. All toggles now reflect template default values. Source labels beneath toggles show "(default)" text, indicating no user-level overrides exist.
