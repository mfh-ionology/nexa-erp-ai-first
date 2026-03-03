# Visual Checkpoint Manifest — Journey 11: Dates Display in DD/MM/YYYY Format for en-GB

## Checkpoint 1: User List with Date Columns
- **When**: After navigating to /system/users (Step 4)
- **Screenshot file**: `step-4-user-list-date-columns.png`
- **What to look for**:
  - User list table is visible with date columns (Created At, Last Login, or similar)
  - Date values are formatted as DD/MM/YYYY (e.g., '22/02/2026')
  - Dates are NOT in MM/DD/YYYY format (US style)
  - Dates are NOT raw ISO 8601 strings (e.g., '2026-02-22T00:00:00.000Z')
  - Dates are NOT raw timestamps or epoch numbers
  - The formatDate() utility with en-GB locale is being used via the useFormatDate() hook

## Checkpoint 2: Date Format Verification Close-up
- **When**: After verifying date patterns match DD/MM/YYYY (Step 5)
- **Screenshot file**: `step-5-date-format-verified.png`
- **What to look for**:
  - At least one date value clearly shows DD/MM/YYYY pattern
  - Day comes before month (British format, not American)
  - Forward slashes as separators (not hyphens or dots)
  - Four-digit year
