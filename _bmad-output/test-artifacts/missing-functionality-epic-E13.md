# Missing Functionality - Epic E13

> Auto-generated during frontend E2E testing

## Missing: Print Preferences sidebar navigation link
- **Journey**: Journey 1 (Navigate to Print Preferences Page), Steps 2-3
- **Expected**: A "Print Preferences" link should appear in the sidebar navigation under the System/Administration section, with a Printer icon, allowing users to navigate to /system/print-preferences
- **Actual**: The sidebar (app-sidebar.tsx) has hardcoded NAV_GROUPS that do NOT include a Print Preferences entry. The route exists in navigation-config.ts (key: system.printPreferences, icon: Printer, path: /system/print-preferences, alwaysVisible: true) and is registered in routeTree.gen.ts, but it was never added to the sidebar's NAV_GROUPS. The ADMINISTRATION section only contains: Settings, Users, Access Groups.
- **Related Story**: E13-1
- **Suggested Story Title**: Add Print Preferences link to sidebar navigation

## Missing: Print Preferences i18n key in navigation namespace
- **Journey**: Journey 1 (Navigate to Print Preferences Page), Step 2
- **Expected**: The navigation.json i18n file should contain a key "system.printPreferences" with value "Print Preferences"
- **Actual**: The key "system.printPreferences" does not exist in packages/i18n/locales/en/navigation.json. The navigation-config.ts references labelKey "navigation:system.printPreferences" but this translation key was never added.
- **Related Story**: E13-1
- **Suggested Story Title**: Add Print Preferences translation key to navigation i18n

## Bug: Non-admin users can see Company Default column in print preferences table
- **Journey**: Journey 6 (Non-Admin Cannot See Company Defaults Section), Step 3
- **Expected**: STAFF role users should see only 2 columns in the print preferences table: "Document Type" and "My Preference". The "Company Default" column should only be visible to ADMIN/SUPER_ADMIN users (per E13-1 AC#2).
- **Actual**: The STAFF user sees all 3 columns including "Company Default". The backend correctly returns 403 for the company-defaults API endpoint, but the frontend still renders the column. Root cause: `apps/web/src/features/print/preferences/print-preferences-page.tsx:336` passes `companyDefaults={companyDefaults}` unconditionally to `PrintPreferenceTable`. It should be `companyDefaults={isAdmin ? companyDefaults : undefined}`. Note: the Company Defaults *section* (separate admin-only section below) is correctly gated with `{isAdmin && (...)}` on line 340 — only the column prop is wrong.
- **Related Story**: E13-1
- **Suggested Story Title**: Gate Company Default column visibility by admin role in print preferences

## Missing: Print preference API routes missing successEnvelope response wrapper
- **Journey**: Journey 3 (Change User Print Preference and Save), Step 1
- **Expected**: All API endpoints should return responses in the standard `{ success: true, data: [...] }` envelope format, using the `successEnvelope()` helper from `core/schemas/envelope.ts`, consistent with all other API routes (e.g., email-template.routes.ts, company-profile.routes.ts)
- **Actual**: The print-preference routes (`apps/api/src/modules/system/routes/print-preference.routes.ts`) return raw arrays directly via `reply.send(preferences)` without wrapping in the success envelope. The response schemas use `getPreferencesResponseSchema` (a `z.array(...)`) instead of `successEnvelope(getPreferencesResponseSchema)`. This causes the frontend `ApiClient` to throw an error because it expects `json.success === true` in the response (see `packages/api-client/src/client.ts:126`). The page shows "Failed to load print preferences" error state on every load. All 5 print-preference endpoints (GET/PUT /print-preferences, GET/PUT /print-preferences/company-defaults, DELETE /print-preferences/reset) are affected.
- **Related Story**: E13-1
- **Suggested Story Title**: Wrap print-preference API responses in standard success envelope

