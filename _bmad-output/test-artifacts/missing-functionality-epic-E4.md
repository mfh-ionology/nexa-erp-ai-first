# Missing Functionality - Epic E4

> Auto-generated during frontend E2E testing

## Missing: Web Frontend Application (Vite + React shell, routing, login page)
- **Journey**: j01-login-page-translated-labels, Step 1
- **Expected**: Navigating to http://localhost:5173/login should load a React-based login page with i18n-translated form fields (email, password), a submit button, and a page heading — all rendered via the t() translation helper from react-i18next
- **Actual**: No frontend dev server exists. `apps/web` is a stub containing only `export {};` — no Vite config, no React components, no router, no login page. Connection refused on localhost:5173.
- **Related Story**: NEW (depends on E6)
- **Suggested Story Title**: E6-1: Web Frontend Shell — Vite + React app with login page, i18n provider, and routing

## Missing: Login form error handling with i18n-translated API error messages
- **Journey**: j02-login-invalid-credentials-translated-error, Steps 1-5
- **Expected**: Submitting invalid credentials (nonexistent@example.com / WrongPassword123!) on the login page should display a translated error message "Invalid email or password" from errors.json AUTH_INVALID_CREDENTIALS key. The frontend should resolve the messageKey from the API error envelope via t() — no raw translation keys like "errors:AUTH_INVALID_CREDENTIALS" visible.
- **Actual**: No frontend application exists. `apps/web` is a stub with no React runtime, no login form, no API integration, and no i18n error message resolution. Connection refused on localhost:5173.
- **Related Story**: NEW (depends on E6)
- **Suggested Story Title**: E6-2: Login page with API error handling and i18n error message resolution from messageKey envelope

## Missing: Login form client-side validation with i18n interpolation
- **Journey**: j03-login-validation-errors-interpolation, Steps 1-5
- **Expected**: Clicking Sign In with empty fields should display inline validation errors with interpolated field names (e.g., "Email is required", "Password is required"). The validation.json template '{{field}} is required' must be resolved via i18next interpolation — no raw '{{field}}' template syntax or 'validation:' namespace prefixes visible.
- **Actual**: No frontend application exists. `apps/web` is a stub with no React runtime, no login form, no client-side Zod validation, and no i18n interpolation. Connection refused on localhost:5173.
- **Related Story**: NEW (depends on E6)
- **Suggested Story Title**: E6-3: Login form client-side validation with i18n interpolated field-name error messages

## Missing: Account lockout error display with translated ACCOUNT_LOCKED message
- **Journey**: j04-login-account-locked-translated-error, Steps 1-14
- **Expected**: After 6 failed login attempts with the admin email (admin@nexa-test.co.uk), the UI should display a translated lockout error: "Account temporarily locked due to too many failed attempts" from errors.json ACCOUNT_LOCKED key. The error message should be resolved via the messageKey in the API error envelope using t(). No raw translation key "errors:ACCOUNT_LOCKED" should be visible.
- **Actual**: No frontend application exists. `apps/web` is a stub with no React runtime, no login form, no API integration, and no i18n error message resolution. Connection refused on localhost:5173.
- **Related Story**: NEW (depends on E6)
- **Suggested Story Title**: E6-4: Login page account lockout error display with translated ACCOUNT_LOCKED message from API error envelope

## Missing: App shell with sidebar navigation showing translated module names
- **Journey**: j05-sidebar-navigation-translated-labels, Steps 1-8
- **Expected**: After logging in as admin (admin@nexa-test.co.uk / Admin123!), the app shell should load with a sidebar navigation panel displaying translated module names from navigation.json via t('navigation.xxx'). Expected visible items: "Dashboard", "System", "Users", "Settings". No raw i18n keys like 'navigation.dashboard', 'navigation:system', or 'navigation.users' should be visible anywhere on the page.
- **Actual**: No frontend application exists. `apps/web` is a stub containing only `export {};` — no Vite config, no React components, no router, no app shell, no sidebar navigation component. Connection refused on localhost:5173.
- **Related Story**: NEW (depends on E6)
- **Suggested Story Title**: E6-2: App Shell with sidebar navigation using i18n-translated module names from navigation.json

## Missing: User list page with translated headers, action buttons, and status labels
- **Journey**: j06-user-list-translated-ui-elements, Steps 1-9
- **Expected**: After logging in as admin and navigating to /system/users, the user list page should display: a page heading "Users" (from navigation.json), a "Create" button, a "Search" input/button (from common.json), column headers in English (Name, Email, Role, Status), and status column values showing translated "Active"/"Inactive" labels instead of raw booleans. No raw i18n namespace prefixes like 'common:' or 'navigation:' should be visible on the page.
- **Actual**: No frontend application exists. `apps/web` is a stub containing only `export {};` — no Vite config, no React components, no router, no user list page, no data table component with i18n-translated headers/status labels. Connection refused on localhost:5173.
- **Related Story**: NEW (depends on E6)
- **Suggested Story Title**: E6-5: User list page with i18n-translated column headers, action buttons, search, and status labels

## Missing: Create User form with i18n-interpolated validation error messages
- **Journey**: j07-user-create-validation-interpolation, Steps 1-9
- **Expected**: After logging in as admin (admin@nexa-test.co.uk / Admin123!), navigating to /system/users, and clicking "Create", a Create User form should open with fields for email, firstName, lastName, password, and role — all with translated English labels. Clicking "Save" with empty fields should trigger Zod validation and display field-level errors with i18n interpolation: "email is required", "firstName is required" (from validation.json template '{{field}} is required'). No raw template syntax '{{field}}' or namespace prefix 'validation:' should be visible. An optional top-level error banner "Please correct the errors below" (from errors.json VALIDATION_ERROR) may also appear.
- **Actual**: No frontend application exists. `apps/web` is a stub containing only `export {};` — no Vite config, no React components, no router, no Create User form, no client-side Zod validation with i18n interpolation. Connection refused on localhost:5173.
- **Related Story**: NEW (depends on E6)
- **Suggested Story Title**: E6-6: Create User form with Zod client-side validation and i18n-interpolated field-name error messages

## Missing: Create User form with duplicate email error translated via API messageKey
- **Journey**: j08-user-create-duplicate-email-error, Steps 1-8
- **Expected**: After logging in as admin (admin@nexa-test.co.uk / Admin123!), navigating to /system/users, clicking "Create", and filling the Create User form with an email that already exists (admin@nexa-test.co.uk, firstName: Duplicate, lastName: User, password: DuplicatePass123!), clicking "Save" should submit the form to the API. The API should return a DUPLICATE_EMAIL error with a messageKey in the error envelope. The frontend should resolve this messageKey via t() and display the translated error message: "A user with this email already exists" (from errors.json DUPLICATE_EMAIL key). No raw translation key 'errors:DUPLICATE_EMAIL' or 'DUPLICATE_EMAIL' should be visible on the page.
- **Actual**: No frontend application exists. `apps/web` is a stub containing only `export {};` — no Vite config, no React components, no router, no Create User form, no API error handling with i18n messageKey resolution. Connection refused on localhost:5173.
- **Related Story**: NEW (depends on E6)
- **Suggested Story Title**: E6-7: Create User form with API error handling and i18n-translated duplicate email error from messageKey envelope

## Missing: User locale preference editing with i18n fallback chain verification
- **Journey**: j09-user-locale-preference, Steps 1-11
- **Expected**: After logging in as admin (admin@nexa-test.co.uk / Admin123!), navigating to /system/users, and clicking on the admin user row to open the user detail/edit page, a "Locale" or "Language" field should be visible showing the current value 'en'. The field should be editable (dropdown or text input). Changing the locale to 'en-GB' and clicking Save should succeed with a success toast. The entire UI must still render in English because the i18n fallback chain resolves 'en-GB' -> 'en'. The sidebar navigation should continue showing 'Dashboard', 'System', 'Users', 'Settings' — no raw i18n keys or broken translations. Resetting the locale back to 'en' and saving should also succeed.
- **Actual**: No frontend application exists. `apps/web` is a stub containing only `export {};` — no Vite config, no React components, no router, no user detail/edit page, no locale field on user profile, no i18n fallback chain integration. Connection refused on localhost:5173.
- **Related Story**: NEW (depends on E6)
- **Suggested Story Title**: E6-8: User detail/edit page with locale preference field and i18n fallback chain verification

## Missing: Company profile page with defaultLanguage field for i18n fallback chain
- **Journey**: j10-company-profile-default-language, Steps 1-6
- **Expected**: After logging in as admin (admin@nexa-test.co.uk / Admin123!) and navigating to /system/company-profile, the company profile page should load displaying company details. A "Default Language" or "Language" field must be visible showing the company's default locale setting (e.g., 'en'). This field feeds the i18n fallback chain: when a user has no locale set, the company's default language is used before falling back to 'en'. All labels on this page must be translated English text — no raw i18n namespace prefixes like 'common:', 'navigation:', or 'validation:' should appear anywhere on the page.
- **Actual**: No frontend application exists. `apps/web` is a stub containing only `export {};` — no Vite config, no React components, no router, no company profile page, no defaultLanguage field. Connection refused on localhost:5173.
- **Related Story**: NEW (depends on E6)
- **Suggested Story Title**: E6-9: Company profile page with defaultLanguage field and i18n-translated labels

## Missing: User list page with DD/MM/YYYY date formatting using en-GB locale
- **Journey**: j11-date-formatting-en-gb, Steps 1-6
- **Expected**: After logging in as admin (admin@nexa-test.co.uk / Admin123!) and navigating to /system/users, the user list page should display date columns (Created At, Last Login) formatted as DD/MM/YYYY (e.g., '22/02/2026') using the Intl API with en-GB locale via the formatDate() utility and useFormatDate() hook from @nexa/shared. Dates must NOT appear in MM/DD/YYYY (US format), ISO 8601 strings (2026-02-22T00:00:00Z), or raw timestamps. At least one date value should match the DD/MM/YYYY pattern with forward slash separators.
- **Actual**: No frontend application exists. `apps/web` is a stub containing only `export {};` — no Vite config, no React components, no router, no user list page, no date formatting columns, no useFormatDate() hook integration. Connection refused on localhost:5173.
- **Related Story**: NEW (depends on E6)
- **Suggested Story Title**: E6-10: User list page with en-GB DD/MM/YYYY date formatting via useFormatDate() hook

## Missing: Dashboard and company profile pages with GBP currency formatting (£ symbol, comma thousands, 2dp)
- **Journey**: j12-currency-formatting-gbp, Steps 1-7
- **Expected**: After logging in as admin (admin@nexa-test.co.uk / Admin123!) and navigating to the dashboard (/), any monetary values displayed (totals, balances, KPI widgets) should use GBP formatting: £ symbol prefix, comma thousands separator (e.g., £1,234.56), and exactly 2 decimal places (GBP minorUnit=2). Navigating to /system/company-profile should show the base currency field as 'GBP'. Any monetary amounts on the company profile should also use the £ symbol and correct decimal formatting via formatCurrency() from @nexa/shared with en-GB locale. No US dollar signs ($) or unformatted raw numbers should appear for monetary values.
- **Actual**: No frontend application exists. `apps/web` is a stub containing only `export {};` — no Vite config, no React components, no router, no dashboard page, no company profile page, no currency formatting integration via formatCurrency() or useFormatCurrency() hook. Connection refused on localhost:5173.
- **Related Story**: NEW (depends on E6)
- **Suggested Story Title**: E6-11: Dashboard and company profile pages with GBP currency formatting via formatCurrency() from @nexa/shared

## Missing: Permission denied error display with translated FORBIDDEN message for VIEWER users
- **Journey**: j13-permission-denied-translated-error, Steps 1-7
- **Expected**: After logging in as a limited user (viewer@nexa-test.co.uk / View123! with VIEWER role) and navigating to /system/users, attempting a restricted action (clicking "Create" button or navigating directly to /system/users/new) should display a translated permission denied error message: "You do not have permission to perform this action" from errors.json FORBIDDEN key. The frontend should resolve the messageKey from the API error envelope via t(). No raw translation key 'errors:FORBIDDEN' or raw 'FORBIDDEN' string should be visible anywhere on the page. The error should appear as a toast, alert, or inline message — not a crash or 500 error page.
- **Actual**: No frontend application exists. `apps/web` is a stub containing only `export {};` — no Vite config, no React components, no router, no user list page, no permission-based UI gating (hiding Create button for VIEWER), no API error handling with i18n messageKey resolution for FORBIDDEN errors. Connection refused on localhost:5173.
- **Related Story**: NEW (depends on E6)
- **Suggested Story Title**: E6-12: Permission denied error handling with i18n-translated FORBIDDEN message from API error envelope and role-based UI element visibility
