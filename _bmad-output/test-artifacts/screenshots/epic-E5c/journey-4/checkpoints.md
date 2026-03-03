# Journey 4: Prompt Template CRUD with Versioning — Visual Checkpoints

## Checkpoint 1: Prompt List Page Loaded
- **When:** After navigating to /ai/admin/prompts (Step 1)
- **Screenshot file:** step-1-prompt-list-loaded.png
- **What to look for:** T1 Entity List with "Prompt Templates" heading. Table with columns: Name (mono), Category (coloured badge), Version (mono vN), Variables, Status (active dot + text), Last Updated. At least 6 seeded prompt rows visible. Purple-themed Concept D styling.
- **ACTUAL RESULT:** PARTIAL PASS. Page structure correct — heading "Prompt Templates", breadcrumb "AI Administration > Prompt Templates", table columns (NAME, CATEGORY, VERSION, VARIABLES, STATUS, LAST UPDATED), search bar, "All Categories" filter dropdown, "+ New" button. Sidebar navigation shows AI Administration and Prompt Templates highlighted in purple. However, table shows "No results found" because GET `/api/v1/ai/admin/prompts` returns 404 (API route not registered).

## Checkpoint 2: New Prompt Editor Page
- **When:** After clicking "+ New" and navigating to /ai/admin/prompts/new (Step 3)
- **Screenshot file:** step-3-new-prompt-editor.png
- **What to look for:** "New Prompt Template" heading. Form fields: Name input, Category dropdown, Description textarea, Active toggle. Two editor areas: "System Prompt" and "User Template" with mono font. No version sidebar (create mode). Concept D styling.
- **ACTUAL RESULT:** PASS. "New Prompt Template" heading visible. Breadcrumb: "AI Administration > Prompt Templates > New Prompt Template". Fields present: Name (placeholder "record-creation-invoice"), Category (dropdown "Select category"), Description (textarea with placeholder), Active toggle (ON by default). System Prompt section with "Type {{ to insert variables" help text. Cancel and Save buttons in action bar. Concept D purple-themed styling with rounded cards and proper shadows. No version sidebar (correct for create mode).

## Checkpoint 3: Prompt Created — Version 1
- **When:** After saving the new prompt (Step 5)
- **Screenshot file:** step-5-prompt-created-v1.png
- **What to look for:** Success toast "Prompt template created". Page shows saved prompt in edit mode. Version sidebar visible on right showing "Version History" with v1 as only entry, marked "Active".
- **ACTUAL RESULT:** FAIL. Red error toast "Route not found" visible in top-right. POST to `/api/v1/ai/admin/prompts` returned 404. Page remains on "New Prompt Template" (create mode). No version sidebar. Form data is still populated (Name: "test-e2e-prompt", Category: "Analysis", Description: "E2E test prompt for automated testing", System Prompt with template variables). The frontend correctly filled all fields and attempted save, but the backend route does not exist.

## Checkpoint 4: Change Reason Modal — NOT REACHED
## Checkpoint 5: Version 2 Created — NOT REACHED
## Checkpoint 6: Diff View — v1 vs v2 — NOT REACHED
## Checkpoint 7: Version Restored — v3 Created — NOT REACHED
## Checkpoint 8: List Shows v3 — NOT REACHED

**Root Cause:** AI admin API routes (`/ai/admin/*`) return 404 on the running API server. The AI plugin's route registration fails silently. All steps from 5 onwards are blocked.
