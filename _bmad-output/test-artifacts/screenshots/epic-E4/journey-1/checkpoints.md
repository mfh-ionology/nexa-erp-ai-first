# Visual Checkpoint Manifest — Journey 1: Login Page Shows Translated English Text

## Journey ID: j01-login-page-translated-labels
## Epic: E4 (i18n Infrastructure)
## Priority: Critical

---

### Checkpoint 1: Login Page Initial Load
- **When**: After navigating to /login (Step 1)
- **Screenshot file**: `step-1-login-page-loaded.png`
- **What to look for**:
  - Login form is visible with an email input field
  - Password input field is visible
  - A "Sign In" or "Log In" submit button is present
  - All text is in plain English — no raw translation keys like `common.submit`, `auth.login`, `field.email`, or `auth:signIn` visible
  - No `{{variable}}` interpolation syntax visible anywhere
  - Page heading/title shows a meaningful English string (e.g., "Sign In to Nexa ERP" or "Login")
  - No error states or broken layout visible
  - Form fields have proper labels or placeholder text, not key identifiers

### Checkpoint 2: Email Field Label Verification
- **When**: After verifying email field label (Step 2) — no separate screenshot, verified via assertions
- **What to look for**: Email field has label text "Email" or "Email Address", not `field.email`

### Checkpoint 3: Password Field Label Verification
- **When**: After verifying password field label (Step 3) — no separate screenshot, verified via assertions
- **What to look for**: Password field has label text "Password", not `field.password`

### Checkpoint 4: Submit Button Text Verification
- **When**: After verifying submit button text (Step 4) — no separate screenshot, verified via assertions
- **What to look for**: Button reads "Sign In", "Log In", or "Submit", not `common.submit` or `auth.login`

### Checkpoint 5: Page Heading Verification
- **When**: After verifying page heading (Step 5) — no separate screenshot, verified via assertions
- **What to look for**: Heading is a translated English string, no i18next key fragments like colons or dots in unexpected places

---

## Summary
This journey has **1 screenshot checkpoint** (the initial login page load). The remaining verifications are assertion-based (text content checks on specific elements). The key visual concern is that all user-facing text comes from the i18n system and renders as proper English, with no leaked translation keys or template syntax.
