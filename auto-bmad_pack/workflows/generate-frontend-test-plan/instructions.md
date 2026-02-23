# Generate Frontend Test Plan - Instructions

## Purpose

Analyze completed stories and UX design specs to create an ordered list of user journeys that cover all acceptance criteria through the frontend UI. Each journey has step-by-step actions that can be executed using Playwright headless browser testing.

## Critical Rules

1. **Test through the UI only** - Never use backend shortcuts; every action must go through the frontend
2. **Order journeys by dependency** - Create/setup journeys before journeys that depend on that data
3. **Include screenshots at key points** - After form submissions, after navigation, after data changes
4. **Be specific about selectors** - Use descriptive element names (e.g., "Create Project button", "project name input field")
5. **Include verification steps** - After every action, verify the expected UI change

## Inputs

- `{{epic_id}}`: Epic identifier (e.g., "1")
- `{{epic_file_path}}`: Path to the epic markdown file
- `{{stories_dir}}`: Path to stories directory
- `{{project_root}}`: Path to project root
- `{{ux_spec_path}}`: Optional path to UX design specification

## Execution Steps

### Step 1: Read Source Materials

1. Read the epic file at `{{epic_file_path}}`
2. Read all completed story files for this epic from `{{stories_dir}}`
3. If available, read the UX design spec at `{{ux_spec_path}}`
4. Read key frontend source files to understand the actual UI:
   - Router/navigation configuration
   - Main page components
   - Form components

### Step 2: Identify User Workflows

From the stories and acceptance criteria, identify distinct user workflows:

| Priority | Criteria |
|----------|----------|
| Critical | Core CRUD operations, primary user flow |
| High | Important features, configuration, secondary flows |
| Medium | Edge cases, optional features, polish |

### Step 3: Create Journey Steps

For each journey, create detailed steps using this action vocabulary (mapped to Playwright APIs):

| Action | Playwright API | Example |
|--------|---------------|---------|
| `navigate` | `page.goto(url)` | Navigate to /projects |
| `click` | `page.click('selector')` or `page.getByRole().click()` | Click "Create Project" button |
| `fill_form` | `page.fill('selector', value)` or `page.getByLabel().fill()` | Fill project name with "Test Project" |
| `select` | `page.selectOption()` | Select "Active" from status dropdown |
| `verify_text` | `expect(page.getByText()).toBeVisible()` | Verify "Project created" message appears |
| `verify_element` | `expect(page.locator()).toBeVisible()` | Verify project appears in list |
| `verify_navigation` | `expect(page).toHaveURL()` | Verify URL is /projects/1 |
| `screenshot` | `page.screenshot({ path })` | Capture current state |
| `wait` | `page.waitForSelector()` or `page.waitForLoadState()` | Wait for loading to finish |

**Locator strategy preferences** (most reliable to least):
1. `getByRole()`, `getByLabel()`, `getByText()`, `getByPlaceholder()` — accessible, semantic locators
2. `locator('css-selector')` — CSS selectors as fallback
3. Avoid fragile selectors tied to implementation details (auto-generated class names, deep nesting)

### Step 4: Add Verification Points & Visual Checkpoints

After each significant action, add verification:
- After navigation: verify page title or key element
- After form submission: verify success message or redirect
- After data change: verify the change is reflected in UI (lists, dashboards, etc.)

Mark steps that require **visual verification** by setting `"screenshot": true` and adding a
`"visual_check"` field describing what the agent should SEE in the screenshot. Only add visual
checkpoints at moments that matter — not after every click. Focus on:

- **State-changing actions**: after create/save/delete/submit — e.g., "Success toast visible", "New item appears at top of list"
- **Navigation transitions**: after routing to a new page — e.g., "Project detail page with correct title"
- **Async feedback**: after operations complete — e.g., "Loading spinner gone, data table populated"
- **Visual state changes**: enable/disable, progress bars, badges — e.g., "Submit button now disabled", "Status badge shows Active"

Example step with visual checkpoint:
```json
{
  "step_number": 4,
  "action": "click",
  "target": "Save button",
  "input_data": {},
  "expected_result": "Project saved, success toast appears",
  "screenshot": true,
  "visual_check": "Green success toast with 'Project saved' text; form fields reset; project list in background shows new entry"
}
```

### Step 5: Output JSON

Write the test plan as JSON. Structure:

```json
{
  "epic_id": "1",
  "generated_at": "2025-01-01T00:00:00Z",
  "total_journeys": 5,
  "total_steps": 45,
  "journeys": [
    {
      "id": "j1-create-project",
      "name": "Create a New Project",
      "description": "Test the complete project creation flow from dashboard to project detail page",
      "priority": "critical",
      "related_stories": ["1-1", "1-2"],
      "preconditions": "App is running, no existing projects",
      "steps": [
        {
          "step_number": 1,
          "action": "navigate",
          "target": "/",
          "input_data": {},
          "expected_result": "Dashboard page loads with empty project list or welcome message",
          "screenshot": true
        },
        {
          "step_number": 2,
          "action": "click",
          "target": "Create Project button",
          "input_data": {},
          "expected_result": "Project creation form or modal appears",
          "screenshot": false
        },
        {
          "step_number": 3,
          "action": "fill_form",
          "target": "project creation form",
          "input_data": {
            "project_name": "Test Project Alpha",
            "description": "A test project for E2E verification"
          },
          "expected_result": "Form fields are populated",
          "screenshot": false
        },
        {
          "step_number": 4,
          "action": "click",
          "target": "Submit/Save button",
          "input_data": {},
          "expected_result": "Project is created, redirects to project detail or shows success",
          "screenshot": true
        },
        {
          "step_number": 5,
          "action": "verify_text",
          "target": "page",
          "input_data": {"text": "Test Project Alpha"},
          "expected_result": "Project name visible on detail page or in project list",
          "screenshot": true
        }
      ]
    }
  ]
}
```

## Journey Ordering

Order journeys so dependencies are satisfied:
1. **Setup journeys** - Create base data (projects, users, configs)
2. **Configuration journeys** - Set up AI providers, templates, etc.
3. **Workflow journeys** - Test main application workflows
4. **Dashboard/reporting journeys** - Verify aggregated data views
5. **Cleanup/delete journeys** - Test deletion and cleanup flows

## Error Handling

If no stories are found:

```json
{
  "epic_id": "1",
  "error": "No completed story files found for epic 1",
  "journeys": [],
  "total_journeys": 0,
  "total_steps": 0
}
```
