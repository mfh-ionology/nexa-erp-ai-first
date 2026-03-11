# Journey 4: Reset Preferences to Company Defaults — Visual Checkpoints

## Checkpoint 1: Confirmation Dialog Appears
- **When**: After clicking "Reset to Defaults" button (step 2-4)
- **Screenshot file**: step-4-reset-confirmation-dialog.png
- **What to look for**: AlertDialog overlay visible with title "Reset to Defaults", description "Reset all print preferences to company defaults? This cannot be undone.", Cancel button, and destructive-styled "Reset to Defaults" action button.

## Checkpoint 2: Dialog Dismissed on Cancel
- **When**: After clicking Cancel in the confirmation dialog (step 5)
- **Screenshot file**: step-5-dialog-cancelled.png
- **What to look for**: Dialog is closed. Print Preferences page still visible with unchanged preferences. No toast notification.

## Checkpoint 3: Reset Success Toast
- **When**: After confirming reset via the destructive "Reset to Defaults" button in dialog (steps 6-7-8)
- **Screenshot file**: step-8-reset-success-toast.png
- **What to look for**: Success toast "Preferences reset to defaults" visible. Preference table rows should show source labels like "(company default)" or "(system default)" for inherited values. Dropdown text should be dimmed for inherited values.
