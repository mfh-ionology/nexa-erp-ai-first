# Missing Functionality - Epic E6

> Auto-generated during frontend E2E testing

## Missing: /finance/journals route does not exist — unauthenticated access shows 404 instead of login redirect
- **Journey**: Journey 3 (Unauthenticated Access Redirects to Login), Step 1
- **Expected**: Navigating to /finance/journals without authentication should redirect to /login
- **Actual**: Page shows 404 "The page you are looking for does not exist" with a "Back to Home" button. URL stays at /finance/journals. No redirect occurs because the route does not exist in TanStack Router — only /finance (index) is defined, not /finance/journals. The _authenticated layout's beforeLoad auth guard never fires for non-existent routes.
- **Related Story**: NEW
- **Suggested Story Title**: Add Finance sub-module routes (Journals, Chart of Accounts, etc.) under /_authenticated/finance/

## Missing: Finance sub-module route pages prevent sidebar active highlighting
- **Journey**: Journey 4 — Sidebar Module Navigation, Step 3
- **Expected**: Clicking "Journals" in the Finance sidebar group navigates to /finance/journals and renders a Journals page within the authenticated app shell (sidebar + header remain visible, active route highlighted with purple border)
- **Actual**: Navigation to /finance/journals shows a root-level 404 page ("The page you are looking for does not exist") without the app shell sidebar or header. The route file `routes/_authenticated/finance/journals.tsx` does not exist — only the Finance module index `/finance/` exists. This prevents testing sidebar active route highlighting for Finance sub-items.
- **Related Story**: NEW
- **Suggested Story Title**: Add placeholder route pages for Finance sub-modules (Chart of Accounts, Journals, Financial Periods, Bank Reconciliation, Budgets)

## Missing: Sales sub-module route pages (Quotes, Orders, Delivery Notes)
- **Journey**: Journey 4 — Sidebar Module Navigation, Step 5
- **Expected**: Clicking "Quotes" in the Sales sidebar group navigates to /sales/quotes and renders a Quotes page within the authenticated app shell with active route highlighting
- **Actual**: Navigation to /sales/quotes would show a root-level 404 page without the app shell. The route file `routes/_authenticated/sales/quotes.tsx` does not exist — only the Sales module index `/sales/` exists. Same issue for Orders and Delivery Notes.
- **Related Story**: NEW
- **Suggested Story Title**: Add placeholder route pages for Sales sub-modules (Quotes, Orders, Delivery Notes)

## Missing: Module route guard does not cover sub-routes — /finance/journals shows 404 instead of 403 for unauthorized users
- **Journey**: Journey 18 (Route Guard: 403 Access Denied Page), Step 1
- **Expected**: A user without finance module access navigating to /finance/journals should see the 403 Access Denied page (route guard intercepts the request and redirects to /403)
- **Actual**: The page shows a 404 "The page you are looking for does not exist" because /finance/journals is not a registered route in TanStack Router. The module guard on /_authenticated/finance/ (index route) only covers the exact /finance path. There is no parent layout route (_authenticated/finance.tsx) with a beforeLoad guard that would catch all /finance/* sub-routes and redirect to /403. The test was adapted to navigate to /finance (which correctly shows 403), but the sub-route gap remains.
- **Related Story**: NEW
- **Suggested Story Title**: Add finance layout route with module guard to catch all /finance/* sub-routes

## Missing: /finance/journals route prevents SUPER_ADMIN bypass verification
- **Journey**: Journey 22 (SUPER_ADMIN Sees All Modules and Routes), Step 4
- **Expected**: SUPER_ADMIN navigating to /finance/journals should see the Journals page load normally (no 403 redirect), verifying that SUPER_ADMIN bypasses all permission checks
- **Actual**: Page shows 404 "The page you are looking for does not exist" because `/finance/journals` is not a registered route. The route file `routes/_authenticated/finance/journals.tsx` does not exist. While the SUPER_ADMIN permission bypass works correctly (all 11 sidebar modules visible, /system/resources and /system/access-groups load fine), the Journals sub-route cannot be tested because the page hasn't been built yet.
- **Related Story**: NEW (same root cause as Journey 3/4/18 entries above)
- **Suggested Story Title**: Add placeholder route pages for Finance sub-modules (Journals, Chart of Accounts, Financial Periods, Bank Reconciliation, Budgets)

