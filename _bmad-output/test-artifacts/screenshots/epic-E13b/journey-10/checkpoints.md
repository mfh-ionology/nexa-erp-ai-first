# Visual Checkpoint Manifest — Journey 10: Create and Edit Subscription Plans

## Checkpoint 1: Plans page loaded
- **When**: After navigating to /plans (step 1)
- **Screenshot file**: 01-plans-page-loaded.png
- **What to look for**: Page header "Plans", "+ New Plan" button visible, card grid showing existing seeded plans with displayName, code (monospace), maxUsers, maxCompanies, AI token allowance, API rate limit, enabled modules (pill badges), active/inactive indicators

## Checkpoint 2: Create plan dialog opened
- **When**: After clicking "+ New Plan" button (step 2)
- **Screenshot file**: 02-create-plan-dialog-open.png
- **What to look for**: Modal dialog with form fields: Code input, Display Name input, Max Users, Max Companies, Monthly AI Token Allowance, AI Hard Limit checkbox, Enabled Modules (toggle buttons), API Rate Limit, "Create Plan" submit button, "Cancel" button

## Checkpoint 3: Plan created successfully
- **When**: After submitting create form (step 5)
- **Screenshot file**: 03-plan-created-success.png
- **What to look for**: Success toast with "Enterprise Plus" created message, dialog closed, plan grid now includes new "Enterprise Plus" card with code "test-enterprise-plus", maxUsers 200, maxCompanies 20, correct token allowance, System and Finance module pills visible

## Checkpoint 4: Edit plan dialog opened
- **When**: After clicking edit icon on the new plan card (step 6)
- **Screenshot file**: 04-edit-plan-dialog-open.png
- **What to look for**: Edit dialog with fields pre-populated (displayName: "Enterprise Plus", maxUsers: 200, etc.), Code field NOT visible (immutable in edit mode), "Plan is active" toggle visible, "Save Changes" button

## Checkpoint 5: Plan updated successfully
- **When**: After saving edited plan (step 8)
- **Screenshot file**: 05-plan-updated-success.png
- **What to look for**: Success toast with "Enterprise Plus" updated message, dialog closed, plan card reflects updated maxUsers value of 250
