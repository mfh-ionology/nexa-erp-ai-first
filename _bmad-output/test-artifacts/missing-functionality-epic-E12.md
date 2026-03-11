# Missing Functionality - Epic E12

> Auto-generated during frontend E2E testing

## Missing: Document Templates sidebar navigation link
- **Journey**: Navigate to Document Templates Page, Step 2-3
- **Expected**: Clicking "System" section in sidebar should show a "Document Templates" sub-item with FileText icon. Clicking it should navigate to /settings/document-templates.
- **Actual**: The sidebar's Administration group contains Settings, Users, and Access Groups, but no "Document Templates" link. The navigation-config.ts defines the entry (system.documentTemplates) and the route /settings/document-templates exists and works, but the sidebar (app-sidebar.tsx NAV_GROUPS) does not include it.
- **Related Story**: E12-2
- **Suggested Story Title**: Add Document Templates link to sidebar navigation under Administration group

## Missing: Toast notification i18n translation for template creation
- **Journey**: Create a Custom Sales Invoice Template, Step 6
- **Expected**: Success toast should display human-readable text like "Template created successfully" after saving a new template.
- **Actual**: Toast displays the raw i18n translation key `documentTemplates.toast.created` instead of the translated string. The key is not being resolved by the i18n system.
- **Related Story**: E12-2
- **Suggested Story Title**: Add i18n translations for Document Template toast notifications
- **Also affects**: Journey 8 (Set a Template as Default), Step 4 — toast shows raw key `documentTemplates.toast.updated` instead of "Template updated successfully"
- **Also affects**: Journey 16 (Deactivate a Template and Show Inactive Templates), Step 3 — toast shows raw key `documentTemplates.toast.deleted` instead of "Template deactivated"
- **Also affects**: Journey 18 (Delete a Template Version with Confirmation Dialog), Step 9 — toast shows raw key `documentTemplates.toast.versionDeleted` instead of "Version deleted successfully"

## Missing: Toast notification i18n translation for duplicate name error (409 conflict)
- **Journey**: Verify Duplicate Name Constraint (409 Conflict), Step 4
- **Expected**: Error toast should display human-readable text like "A template with this name already exists for this document type" when a 409 conflict occurs.
- **Actual**: Toast displays the raw i18n translation key `documentTemplates.error.duplicateName` instead of the translated string. The error handling correctly catches the 409 and shows a toast, but the i18n key is not resolved.
- **Related Story**: E12-2
- **Suggested Story Title**: Add i18n translations for Document Template error messages (extends existing toast translation issue)

## Missing: Version overflow "Preview" action does not auto-generate PDF preview
- **Journey**: Preview a Specific Template Version, Step 4
- **Expected**: Clicking "Preview" from the version overflow menu should automatically initiate PDF generation for that specific version with its overrides applied.
- **Actual**: Clicking "Preview" from the version overflow menu does not auto-generate the PDF. The Preview panel remains in its initial "Click Generate Preview to see a PDF preview with sample data" state. The user must additionally click the "Generate Preview" button to trigger generation.
- **Related Story**: E12-2
- **Suggested Story Title**: Auto-generate PDF preview when clicking Preview from version overflow menu
