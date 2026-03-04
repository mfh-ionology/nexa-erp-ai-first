# Visual Checkpoint Manifest — Journey 5: Duplicate Recipient Detection Across Fields

## Checkpoint 1: Email dialog opened with customer email in To field
- **When**: After opening email dialog from POSTED invoice (Step 2)
- **Screenshot file**: `step-2-email-dialog-opened.png`
- **What to look for**: Email composition dialog visible with purple accent top border, To field containing pre-filled customer email chip (purple styling), "+ Cc" toggle visible

## Checkpoint 2: CC field expanded and duplicate email entered
- **When**: After entering the same email as To field into CC and pressing Enter (Step 5)
- **Screenshot file**: `step-5-duplicate-chip-warning.png`
- **What to look for**: CC field visible with a chip showing the duplicate email address. The chip should have warning/error styling (red/amber: `bg-red-50 text-red-700 border-red-200`) instead of the normal purple chip styling, with a "Duplicate recipient" tooltip. The original To field chip should remain with normal purple styling.
