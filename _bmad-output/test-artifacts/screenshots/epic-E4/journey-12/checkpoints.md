# Visual Checkpoint Manifest — Journey 12: Currency Values Display with Correct GBP Formatting

## Checkpoint 1: Dashboard/Home Page After Login
- **When**: After step 4 — navigating to `/` (dashboard) post-login
- **Screenshot file**: `step-4-dashboard-loaded.png`
- **What to look for**:
  - Dashboard or main landing page has loaded successfully
  - If any monetary values are displayed (totals, balances, KPI widgets), they should use GBP formatting: `£` symbol prefix, comma thousands separator (e.g., `£1,234.56`), exactly 2 decimal places
  - No raw numbers without currency symbol (e.g., not `1234.56` or `1234.5600`)
  - No US-style formatting (e.g., not `$1,234.56`)
  - If no monetary values exist on dashboard yet, note as informational (E4 is infrastructure, business modules come later)

## Checkpoint 2: Company Profile Page with Base Currency
- **When**: After step 5 — navigating to `/system/company-profile`
- **Screenshot file**: `step-5-company-profile-currency.png`
- **What to look for**:
  - Company profile page loaded with company details visible
  - Base Currency field or display showing `GBP` — this is the currency that drives formatting throughout the app
  - If any monetary amounts are displayed on this page, they use `£` symbol and `.XX` decimal formatting
  - All field labels are translated English text (no raw i18n keys)
  - No raw currency codes used in place of formatted values (e.g., not showing `GBP 1234.56` instead of `£1,234.56`)
