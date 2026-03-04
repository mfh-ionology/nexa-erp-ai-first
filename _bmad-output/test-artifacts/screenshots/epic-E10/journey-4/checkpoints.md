# Journey 4: Email Recipient Validation — Invalid Format

## Visual Checkpoints

### Checkpoint 1: Invalid email chip highlighted in red
- **When**: After step 4 — pressing Enter on "not-an-email" in To input
- **Screenshot file**: `step-4-invalid-email-chip-red.png`
- **What to look for**: To field shows the original valid customer email chip with normal styling AND a new "not-an-email" chip highlighted in red/error styling (red border, red background tint). Error tooltip may be visible indicating RFC 5322 validation failure.

### Checkpoint 2: After removing first invalid chip
- **When**: After step 7 — clicking × on the "not-an-email" chip
- **Screenshot file**: `step-7-invalid-chip-removed.png`
- **What to look for**: To field shows the valid customer email chip AND the remaining invalid chip "missing@domain" (still red-highlighted). The "not-an-email" chip should be gone. Dialog should still be open and functional.
