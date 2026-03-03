# Visual Checkpoints — Journey 10: Create a New Access Group

## Checkpoint 1: Access Group List Page Loaded
- **When**: After navigating to /system/access-groups (Step 1)
- **Screenshot file**: step-1-access-group-list-page.png
- **What to look for**:
  - Page title "Access Groups" visible as heading
  - Breadcrumbs: System > Access Groups
  - Data table with columns: Code, Name, System, Users, Created
  - [+ New] button visible in action area (top right or above table)
  - Existing access groups (mock data) shown in table rows

## Checkpoint 2: Create Access Group Form Loaded
- **When**: After clicking [+ New] button (Step 2)
- **Screenshot file**: step-2-create-form-loaded.png
- **What to look for**:
  - Page title "Create Access Group"
  - Breadcrumbs: System > Access Groups > Create New
  - Form fields visible: Code (text input with placeholder "e.g., SALES_MGR"), Name (text input with placeholder "e.g., Sales Manager"), Description (textarea with placeholder)
  - Create button visible (primary)
  - Cancel button visible (secondary/ghost)

## Checkpoint 3: Form Filled with Data
- **When**: After filling code, name, and description fields (Step 3)
- **Screenshot file**: step-3-form-filled.png
- **What to look for**:
  - Code field shows "TEST_SALES_REP" (auto-uppercased from "test_sales_rep")
  - Name field shows "Test Sales Representative"
  - Description field shows "Access group for sales representatives"
  - Create button should be enabled

## Checkpoint 4: Success Toast and Detail Page
- **When**: After clicking Create button and API returns success (Step 4)
- **Screenshot file**: step-4-success-toast-and-detail.png
- **What to look for**:
  - Success toast visible with text "Access group created successfully"
  - Redirected to access group detail page
  - Page shows "TEST_SALES_REP" as the code (disabled/read-only input, monospace)
  - Page shows "Test Sales Representative" as the name
  - Permissions tab and Field Overrides tab visible
  - Breadcrumbs: System > Access Groups > Test Sales Representative
