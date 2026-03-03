# Visual Checkpoint Manifest — Journey 7: Forget Everything — Destructive Action

## Checkpoint 1: Memory Page Loaded
- **When**: After navigating to /ai/memory and waiting for settings panel to load
- **Screenshot file**: `step-1-memory-page-loaded.png`
- **What to look for**: Memory page with Concept D purple styling. Settings panel visible with "Enable AI Memory" toggle, category checkboxes, retention period selector, and red "Forget Everything" danger zone. Memory list below with grouped memory cards.

## Checkpoint 2: Forget Everything Dialog Opened
- **When**: After clicking the "Forget Everything" button in the danger zone
- **Screenshot file**: `step-2-forget-dialog-opened.png`
- **What to look for**: AlertDialog overlay with warning triangle icon in red circle, title "Forget Everything" in red text, body text "This will permanently delete ALL of your AI memories. This action cannot be undone.", text input with placeholder "FORGET" and label "Type FORGET to confirm", disabled red "Forget Everything" confirm button, and "Cancel" button.

## Checkpoint 3: Partial Confirmation — Button Still Disabled
- **When**: After typing "FORG" (incomplete) in the confirmation input
- **Screenshot file**: `step-3-partial-confirm-disabled.png`
- **What to look for**: Confirmation input shows "FORG", the red "Forget Everything" confirm button is still disabled (opacity-40), Cancel button still active.

## Checkpoint 4: Full Confirmation — Button Enabled
- **When**: After typing "FORGET" in the confirmation input
- **Screenshot file**: `step-4-full-confirm-enabled.png`
- **What to look for**: Confirmation input shows "FORGET", the red "Forget Everything" confirm button is now enabled (full opacity, clickable), Cancel button still active.

## Checkpoint 5: Empty State After Forget All
- **When**: After clicking the confirm button and waiting for the operation to complete
- **Screenshot file**: `step-5-empty-state-after-forget.png`
- **What to look for**: Dialog dismissed. Toast notification "All memories have been deleted" visible. Memory list replaced by empty state: Lightbulb icon in purple circle, heading "No memories yet", description "As you interact with the AI, it will remember your preferences and decisions". Settings panel still visible above.
