# Journey 9: Company Default Changes Affect User Preference Resolution — Visual Checkpoints

## Checkpoint 1: Initial state — Delivery Note with system default
- **When**: After navigating to Print Preferences and verifying Delivery Note shows "(system default)"
- **Screenshot file**: step-3-delivery-note-system-default.png
- **What to look for**: Delivery Note row in user preferences table shows "No Action" with "(system default)" source label in dimmed text. Company Default column for Delivery Note should be empty or show "No Action". Save buttons disabled.

## Checkpoint 2: Company default changed and saved — success toast
- **When**: After saving the company default for Delivery Note to Auto-Download PDF
- **Screenshot file**: step-7-company-default-saved-toast.png
- **What to look for**: Green success toast "Company print defaults saved successfully" visible. Save Company Defaults button returns to disabled state. Delivery Note row in Company Defaults section shows "Auto-Download PDF".

## Checkpoint 3: After reload — Delivery Note shows "(company default)" label
- **When**: After navigating away and back to Print Preferences, verifying persistence
- **Screenshot file**: step-10-delivery-note-company-default-after-reload.png
- **What to look for**: Delivery Note row in user preferences table now shows "Auto-Download PDF" with "(company default)" source label in dimmed text (changed from "(system default)"). Company Default column shows "Auto-Download PDF". Save buttons disabled (no unsaved changes).
