# Visual Checkpoint Manifest — Journey 5: Switch Company Context

## Checkpoint 1: Dashboard with Company Switcher
- **When**: After Step 1 — navigating to "/" and authenticating
- **Screenshot file**: step-1-dashboard-with-company-switcher.png
- **What to look for**:
  - App shell loaded with sidebar on the left
  - Company switcher visible at top of sidebar showing current company name ("Nexa Ltd") and initials ("NL")
  - ChevronsUpDown icon visible next to company name (indicating dropdown is available)
  - Dashboard heading visible in main content area

## Checkpoint 2: Company Dropdown Open
- **When**: After Step 2 — clicking the company switcher dropdown
- **Screenshot file**: step-2-company-dropdown-open.png
- **What to look for**:
  - Dropdown menu visible with "Switch Company" label header
  - At least two companies listed (Nexa Ltd, Acme Corp)
  - Current company (Nexa Ltd) has a checkmark indicator
  - Second company (Acme Corp) does NOT have a checkmark
  - Each company shows initials avatar and name

## Checkpoint 3: Company Switched — New Context
- **When**: After Step 3 — clicking the second company and switch completing
- **Screenshot file**: step-3-company-switched.png
- **What to look for**:
  - Success toast visible with text "Switched to Acme Corp"
  - Sidebar company switcher now shows "Acme Corp" as the current company name
  - Company initials updated to "AC"
  - Dropdown is closed
  - Sidebar modules may have changed based on new permissions
