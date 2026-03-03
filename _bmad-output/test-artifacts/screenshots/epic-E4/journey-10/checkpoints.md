# Visual Checkpoints — Journey 10: Company Profile Default Language for Fallback Chain

## Checkpoint 1: Login Page Loaded
- **When**: After navigating to /login (step 1)
- **Screenshot file**: step-1-login-page.png
- **What to look for**: Login form visible with email/password fields and Sign In button. All text in English, no raw translation keys.

## Checkpoint 2: Dashboard After Login
- **When**: After successful login (step 3 — click Sign In)
- **Screenshot file**: step-3-dashboard-after-login.png
- **What to look for**: App shell loaded with sidebar navigation. Dashboard or main page visible confirming successful authentication.

## Checkpoint 3: Company Profile Page
- **When**: After navigating to /system/company-profile (step 4)
- **Screenshot file**: step-4-company-profile-page.png
- **What to look for**: Company profile page visible with company details. A 'Default Language' or 'Language' field is visible showing the company's default locale setting (e.g., 'en'). All labels on this page are translated English text — no raw i18n keys like 'common:xxx' visible anywhere. This is the KEY checkpoint for this journey.

## Checkpoint 4: No Raw i18n Keys Verification
- **When**: After verifying no raw keys on the page (step 6)
- **Screenshot file**: step-6-no-raw-keys.png
- **What to look for**: Final state of company profile page. Confirming that no 'common:' namespace prefixes or other raw translation key patterns appear in the rendered page content.
