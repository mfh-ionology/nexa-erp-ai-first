#!/bin/bash
# V7 Post-Epic Frontend E2E Testing
# Tests user journeys through Playwright headless browser testing.
# Generates test plan, executes journeys, captures screenshots, tracks missing functionality.
#
# Usage: ./v7-post-epic-frontend-e2e.sh <epic-id> [options]
#
# Options:
#   --frontend-url URL    Frontend URL (default: http://localhost:5173 or $SERVER_FRONTEND_URL)
#   --api-url URL         Backend URL for reference (default: http://localhost:3777 or $SERVER_API_URL)
#   --fix-bugs            Auto-fix bugs found during testing
#   --max-turns N         Claude turns per journey (default: 100)
#   --max-fix-retries N   Max fix-retest cycles per journey (default: 3)
#   --start-journey N     Resume from journey N (1-based)
#   --resume              Resume from state file

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Source shared library
source "${SCRIPT_DIR}/lib-common.sh"

# Source notification system
[[ -f "${SCRIPT_DIR}/notify.sh" ]] && source "${SCRIPT_DIR}/notify.sh" || true

# Load secrets
CONFIG_DIR="${SCRIPT_DIR}/../config"
[[ -f "${CONFIG_DIR}/.bmad-secrets" ]] && source "${CONFIG_DIR}/.bmad-secrets" || true

# ============================================================================
# CONFIGURATION
# ============================================================================

EPIC_ID="${1:?Usage: $0 <epic-id> [options]}"
FRONTEND_URL="${SERVER_FRONTEND_URL:-http://localhost:5173}"
API_URL="${SERVER_API_URL:-http://localhost:3777}"
FIX_BUGS=false
MAX_TURNS=100
MAX_FIX_RETRIES=3
START_JOURNEY=1
RESUME_FROM_STATE=false

shift
while [[ $# -gt 0 ]]; do
    case "$1" in
        --frontend-url) FRONTEND_URL="$2"; shift 2 ;;
        --api-url) API_URL="$2"; shift 2 ;;
        --fix-bugs) FIX_BUGS=true; shift ;;
        --max-turns) MAX_TURNS="$2"; shift 2 ;;
        --max-fix-retries) MAX_FIX_RETRIES="$2"; shift 2 ;;
        --start-journey) START_JOURNEY="$2"; shift 2 ;;
        --resume) RESUME_FROM_STATE=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Directories
ensure_test_dirs "$EPIC_ID"
E2E_LOG_DIR="${LOG_DIR}/epic-${EPIC_ID}/frontend-e2e"
SCREENSHOTS_DIR="${TEST_ARTIFACTS}/screenshots/epic-${EPIC_ID}"
mkdir -p "$E2E_LOG_DIR"
mkdir -p "$SCREENSHOTS_DIR"

# Playwright test infrastructure
PW_DIR="${TEST_ARTIFACTS}/playwright/epic-${EPIC_ID}"
PW_TESTS_DIR="${PW_DIR}/tests"
PW_CONFIG="${PW_DIR}/playwright.config.ts"
PW_RESULTS="${PW_DIR}/results.json"
mkdir -p "$PW_TESTS_DIR"

WORKFLOW_LOG="${E2E_LOG_DIR}/frontend-e2e-$(date +%Y%m%d-%H%M%S).log"

# File paths
EPIC_FILE="${PLANNING_ARTIFACTS}/epics/epic-${EPIC_ID}.md"
STORIES_DIR="${IMPL_ARTIFACTS}/stories"
TEST_PLAN_FILE="${TEST_ARTIFACTS}/frontend-test-plan-epic-${EPIC_ID}.json"
TEST_REPORT_FILE="${TEST_ARTIFACTS}/frontend-test-report-epic-${EPIC_ID}.md"
MISSING_FUNC_FILE="${TEST_ARTIFACTS}/missing-functionality-epic-${EPIC_ID}.md"
E2E_STATE_FILE="${STATE_DIR}/epic-${EPIC_ID}-frontend-e2e-state.yaml"

# ============================================================================
# STATE MANAGEMENT
# ============================================================================

init_e2e_state() {
    if [[ "$RESUME_FROM_STATE" == "true" && -f "$E2E_STATE_FILE" ]]; then
        log "INFO" "Resuming from state file: $E2E_STATE_FILE"
        # Extract start journey from state
        if [[ "$START_JOURNEY" -eq 1 ]]; then
            local last_completed
            last_completed=$(grep -c "status: \"completed\"" "$E2E_STATE_FILE" 2>/dev/null || true)
            if [[ "$last_completed" -gt 0 ]]; then
                START_JOURNEY=$((last_completed + 1))
                log "INFO" "Resuming from journey $START_JOURNEY"
            fi
        fi
        return 0
    fi

    cat > "$E2E_STATE_FILE" << EOF
# V7 Post-Epic Frontend E2E State
epic_id: "${EPIC_ID}"
started_at: "$(date -Iseconds)"
updated_at: "$(date -Iseconds)"
frontend_url: "${FRONTEND_URL}"

journeys: {}

summary:
  total_journeys: 0
  completed: 0
  failed: 0
  bugs_found: 0
  bugs_fixed: 0
  missing_features: 0
EOF
    log "INFO" "Created E2E state file: $E2E_STATE_FILE"
}

update_journey_state() {
    local journey_id="$1"
    local status="$2"
    local details="${3:-}"

    local journey_key
    journey_key=$(echo "$journey_id" | tr '-' '_')
    local timestamp
    timestamp=$(date -Iseconds)

    # Write journey state to a separate tracking file (simpler than modifying YAML in-place)
    local journey_track_file="${STATE_DIR}/epic-${EPIC_ID}-journey-tracking.log"
    echo "${timestamp} | ${journey_key} | ${status} | ${details}" >> "$journey_track_file"

    # Also update the main state file timestamp
    if [[ -f "$E2E_STATE_FILE" ]]; then
        sed -i.bak "s|^updated_at:.*|updated_at: \"${timestamp}\"|" "$E2E_STATE_FILE"
        rm -f "${E2E_STATE_FILE}.bak"
    fi
}

# ============================================================================
# PLAYWRIGHT SETUP
# ============================================================================

setup_playwright() {
    cat > "$PW_CONFIG" << 'PWEOF'
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: process.env.FRONTEND_URL || 'http://localhost:5173',
    headless: true,
    screenshot: 'on',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
  },
  reporter: [
    ['json', { outputFile: process.env.PW_RESULTS_FILE || './results.json' }],
    ['list'],
  ],
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
PWEOF
    log "INFO" "Generated Playwright config: $PW_CONFIG"
}

# ============================================================================
# PHASE 1: GENERATE TEST PLAN
# ============================================================================

generate_test_plan() {
    log_phase "1: Generate Frontend Test Plan"

    # Check if plan already exists (for resume)
    if [[ -f "$TEST_PLAN_FILE" && "$START_JOURNEY" -gt 1 ]]; then
        log "INFO" "Using existing test plan (resuming)"
        echo -e "${YELLOW}Using existing test plan (resuming from journey $START_JOURNEY)${NC}"
        return 0
    fi

    local plan_log="${E2E_LOG_DIR}/generate-plan-$(date +%H%M%S).log"

    # Check for UX spec
    local ux_spec_path=""
    local ux_candidates=(
        "${PLANNING_ARTIFACTS}/ux-design-specification.md"
        "${PLANNING_ARTIFACTS}/ux-design-spec.md"
        "${PLANNING_ARTIFACTS}/ux-spec.md"
        "${PLANNING_ARTIFACTS}/ui-design.md"
    )
    for candidate in "${ux_candidates[@]}"; do
        if [[ -f "$candidate" ]]; then
            ux_spec_path="$candidate"
            break
        fi
    done

    local prompt
    prompt="Generate a frontend E2E test plan for Epic ${EPIC_ID}.

Read the following files:
1. Epic file: ${EPIC_FILE}
2. Story files in: ${STORIES_DIR} (files matching pattern ${EPIC_ID}-*)
3. Frontend source files in: ${PROJECT_ROOT}/packages/client/src/ (router, pages, components)
$(if [[ -n "$ux_spec_path" ]]; then echo "4. UX design spec: ${ux_spec_path}"; fi)

Create user journeys that test all acceptance criteria through the browser UI.
Each journey should have step-by-step actions using these action types:
- navigate: Go to a URL
- click: Click a button/link (describe the element, e.g. 'Create Project button')
- fill_form: Enter data in form fields (specify field names and values)
- verify_text: Check that specific text is visible
- verify_element: Check that an element exists
- screenshot: Capture the current state

For steps where visual verification matters (after state changes, navigation, async results,
UI feedback like toasts/badges/status), set screenshot: true and include a visual_check field
describing exactly what should be visible in the screenshot. Only add visual checkpoints at
moments that matter - not after every action.

Order journeys: setup/create first, then configure, then verify, then cleanup.

Write the test plan as JSON to: ${TEST_PLAN_FILE}

JSON structure:
{
  \"epic_id\": \"${EPIC_ID}\",
  \"generated_at\": \"<ISO timestamp>\",
  \"frontend_url\": \"${FRONTEND_URL}\",
  \"total_journeys\": <number>,
  \"total_steps\": <number>,
  \"journeys\": [
    {
      \"id\": \"j1-create-project\",
      \"name\": \"Create a New Project\",
      \"description\": \"Test project creation flow\",
      \"priority\": \"critical\",
      \"related_stories\": [\"1-1\"],
      \"steps\": [
        {
          \"step_number\": 1,
          \"action\": \"navigate\",
          \"target\": \"/\",
          \"input_data\": {},
          \"expected_result\": \"Dashboard loads\",
          \"screenshot\": true,
          \"visual_check\": \"App shell with sidebar and top bar visible, Projects link in navigation\"
        },
        {
          \"step_number\": 4,
          \"action\": \"click\",
          \"target\": \"Save button\",
          \"input_data\": {},
          \"expected_result\": \"Project created successfully\",
          \"screenshot\": true,
          \"visual_check\": \"Success toast visible, project list shows new project at top\"
        }
      ]
    }
  ]
}"

    if run_claude_with_timeout 600 "$plan_log" -p "$prompt" --max-turns 50; then
        if [[ -f "$TEST_PLAN_FILE" ]]; then
            log "SUCCESS" "Frontend test plan generated: $TEST_PLAN_FILE"
            echo -e "${GREEN}Test plan generated${NC}"
            return 0
        else
            log "ERROR" "Test plan file not created"
            echo -e "${RED}Test plan file was not created${NC}"
            return 1
        fi
    else
        log "ERROR" "Test plan generation failed"
        return 1
    fi
}

# ============================================================================
# PHASE 2: EXECUTE USER JOURNEYS
# ============================================================================

execute_journeys() {
    log_phase "2: Execute User Journeys"

    if [[ ! -f "$TEST_PLAN_FILE" ]]; then
        log "ERROR" "No test plan file found"
        return 1
    fi

    # Initialize missing functionality file
    if [[ ! -f "$MISSING_FUNC_FILE" ]]; then
        cat > "$MISSING_FUNC_FILE" << EOF
# Missing Functionality - Epic ${EPIC_ID}

> Auto-generated during frontend E2E testing

EOF
    fi

    # Count journeys from test plan (prefer jq, fallback to grep for "journeys" array entries)
    local journey_count
    if command -v jq &>/dev/null; then
        journey_count=$(jq '.journeys | length' "$TEST_PLAN_FILE" 2>/dev/null) || journey_count=0
    else
        # Count top-level journey objects by looking for "id" fields that follow journey array structure
        journey_count=$(grep -c '"id": "j[0-9]' "$TEST_PLAN_FILE" 2>/dev/null || true)
        # Fallback: count all "id" fields (may overcount but better than 0)
        if [[ "$journey_count" -eq 0 ]]; then
            journey_count=$(grep -c '"id":' "$TEST_PLAN_FILE" 2>/dev/null || true)
        fi
    fi

    if [[ "$journey_count" -eq 0 ]]; then
        log "WARN" "No journeys found in test plan"
        echo -e "${YELLOW}No journeys found in test plan${NC}"
        return 0
    fi

    log "INFO" "Found $journey_count journeys, starting from journey $START_JOURNEY"
    echo -e "${BLUE}Executing $journey_count journeys (starting from #${START_JOURNEY})${NC}"

    # Initialize report
    cat > "$TEST_REPORT_FILE" << EOF
# Frontend E2E Test Report - Epic ${EPIC_ID}

**Date**: $(date '+%Y-%m-%d %H:%M:%S')
**Frontend URL**: ${FRONTEND_URL}

## Journey Results

EOF

    local journey_num=0
    local passed=0
    local failed=0
    local total_bugs=0
    local total_fixed=0

    # Execute each journey via Claude generating and running Playwright tests
    # We iterate by calling Claude once per journey
    local current=$START_JOURNEY
    while [[ $current -le $journey_count ]]; do
        journey_num=$((journey_num + 1))
        log "INFO" "Running journey $current of $journey_count"
        echo -e "\n${BLUE}Journey ${current}/${journey_count}${NC}"

        local journey_log="${E2E_LOG_DIR}/journey-${current}-$(date +%H%M%S).log"
        local journey_screenshots="${SCREENSHOTS_DIR}/journey-${current}"
        mkdir -p "$journey_screenshots"

        local fix_instruction=""
        if [[ "$FIX_BUGS" == "true" ]]; then
            fix_instruction="If you find a bug:
1. Document it in the test report
2. Read the relevant source code and fix the bug
3. Wait a moment for hot reload
4. Re-test the failed step
5. If the fix works, note it as fixed in the report"
        else
            fix_instruction="If you find a bug, document it but do not fix it."
        fi

        local prompt
        prompt="Execute frontend E2E journey #${current} from the test plan.

Test plan file: ${TEST_PLAN_FILE}
Frontend URL: ${FRONTEND_URL}
Playwright config: ${PW_CONFIG}
Test file to write: ${PW_TESTS_DIR}/journey-${current}.spec.ts
Screenshots directory: ${journey_screenshots}
Visual checkpoint manifest: ${journey_screenshots}/checkpoints.md

IMPORTANT RULES:
- Write a Playwright test that tests this user journey through the frontend
- NEVER do anything in the backend as a shortcut - we are testing the FRONTEND
- Use Playwright's page API: page.goto(), page.click(), page.fill(), page.locator(), expect()

For journey #${current} in the test plan:

STEP 1 - READ & PLAN VISUAL CHECKPOINTS:
Read the journey steps from the test plan JSON. Then THINK about what you need to
visually verify at key moments. Ask yourself:
- After this action, what should I SEE on screen? (toast message? updated list? new row?)
- What visual state changes matter? (button enabled/disabled, progress bar, loading spinner gone?)
- Where are the moments the UI should look meaningfully different?

Write a checkpoint manifest to ${journey_screenshots}/checkpoints.md listing each
visual checkpoint with:
  - When: after which step/action
  - Screenshot file: descriptive name (e.g. step-3-toast-confirmation.png, step-5-invoice-in-list.png)
  - What to look for: specific visual expectations (e.g. 'Green success toast visible with text Project created',
    'Project list shows new project as first item with correct name')

Only plan checkpoints at moments that MATTER - not after every click. Focus on:
  - After state-changing actions (create, save, delete, submit)
  - After navigation to a new page (verify correct page loaded)
  - After async operations complete (verify result is displayed)
  - When visual feedback is expected (toasts, badges, status changes, enable/disable)

STEP 2 - WRITE THE PLAYWRIGHT TEST:
Write a Playwright test file to: ${PW_TESTS_DIR}/journey-${current}.spec.ts
   - Import { test, expect } from '@playwright/test'
   - Use test.describe() with the journey name
   - Implement each step using Playwright APIs
   - Prefer accessible locators: getByRole(), getByLabel(), getByText(), getByPlaceholder()
   - Use locator('css-selector') as fallback
   - At each visual checkpoint from your manifest, add:
     await page.screenshot({ path: '<path-from-manifest>' })
   - Use descriptive screenshot filenames that indicate WHAT you expect to see

STEP 3 - RUN THE TEST:
   FRONTEND_URL=${FRONTEND_URL} PW_RESULTS_FILE=${PW_DIR}/journey-${current}-results.json npx playwright test ${PW_TESTS_DIR}/journey-${current}.spec.ts --config ${PW_CONFIG}

STEP 4 - VISUAL REVIEW:
Read the checkpoint manifest, then for EACH checkpoint screenshot:
   a. Read the screenshot file using the Read tool (it supports PNG images)
   b. Compare what you SEE against the expected visual state from the manifest
   c. Check for: correct text/data displayed, expected UI elements visible,
      proper visual state (enabled/disabled, selected, highlighted),
      no broken layouts or unexpected error messages
   d. If something looks wrong visually EVEN IF the Playwright assertions passed,
      flag it as a visual issue

STEP 5 - ANALYZE RESULTS:
Read the Playwright results JSON and test output.
If the test fails:
   - Review failure screenshots alongside your visual checkpoints
   - Determine if it's a bug in the code or missing functionality
   ${fix_instruction}

${fix_instruction}

If functionality is MISSING (feature doesn't exist yet):
Append to: ${MISSING_FUNC_FILE}
Format:
## Missing: <feature description>
- **Journey**: journey name, Step N
- **Expected**: what should happen
- **Actual**: what happened or didn't happen
- **Related Story**: story ID or 'NEW'
- **Suggested Story Title**: title for new story

After completing the journey, output a brief summary using EXACTLY this format
(plain text, no markdown bold, no asterisks - the script parses these lines):
JOURNEY_RESULT: passed|failed|error
BUGS_FOUND: <count>
BUGS_FIXED: <count>
MISSING_FEATURES: <count>
VISUAL_ISSUES: <count>"

        local journey_result="unknown"
        if run_claude_with_timeout 1200 "$journey_log" -p "$prompt" --max-turns "$MAX_TURNS"; then
            # Parse structured result from Claude output (tolerate markdown bold **JOURNEY_RESULT:**)
            if grep -q "JOURNEY_RESULT.*passed" "$journey_log" 2>/dev/null; then
                journey_result="passed"
                passed=$((passed + 1))
            elif grep -q "JOURNEY_RESULT.*failed" "$journey_log" 2>/dev/null; then
                journey_result="failed"
                failed=$((failed + 1))
            elif grep -q "JOURNEY_RESULT.*error" "$journey_log" 2>/dev/null; then
                journey_result="error"
                failed=$((failed + 1))
            else
                # Fallback: check Playwright results JSON
                local pw_results="${PW_DIR}/journey-${current}-results.json"
                if [[ -f "$pw_results" ]] && command -v jq &>/dev/null; then
                    local pw_status
                    pw_status=$(jq -r '.suites[0].specs[0].tests[0].results[0].status // "unknown"' "$pw_results" 2>/dev/null || echo "unknown")
                    if [[ "$pw_status" == "passed" ]]; then
                        journey_result="passed"
                        passed=$((passed + 1))
                    else
                        journey_result="failed"
                        failed=$((failed + 1))
                    fi
                else
                    journey_result="unknown"
                    failed=$((failed + 1))
                fi
            fi
            log "INFO" "Journey $current result: $journey_result"
            echo -e "  Result: ${journey_result}"
        else
            journey_result="error"
            failed=$((failed + 1))
            log "ERROR" "Journey $current execution failed"
            echo -e "  ${RED}Journey $current execution error${NC}"
        fi

        update_journey_state "journey-${current}" "$journey_result"

        # Append to report
        cat >> "$TEST_REPORT_FILE" << EOF
### Journey ${current}: ${journey_result}
- **Status**: ${journey_result}
- **Log**: ${journey_log}
- **Screenshots**: ${journey_screenshots}/

EOF

        current=$((current + 1))
        sleep 2
    done

    # Update report with summary
    local summary_text="**Total**: ${journey_count} | **Passed**: ${passed} | **Failed**: ${failed}"
    sed -i.bak "s/## Journey Results/## Summary\n\n${summary_text}\n\n## Journey Results/" "$TEST_REPORT_FILE" 2>/dev/null || true
    rm -f "${TEST_REPORT_FILE}.bak"

    # Update state summary
    update_state_field "$E2E_STATE_FILE" "summary.total_journeys" "$journey_count"
    update_state_field "$E2E_STATE_FILE" "summary.completed" "$passed"
    update_state_field "$E2E_STATE_FILE" "summary.failed" "$failed"

    echo -e "\n${BLUE}Journey execution complete: ${passed}/${journey_count} passed${NC}"
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    log "INFO" "Starting frontend E2E testing for Epic ${EPIC_ID}"
    echo -e "\n${CYAN}======================================================${NC}"
    echo -e "${CYAN}  POST-EPIC FRONTEND E2E TESTING - Epic ${EPIC_ID}${NC}"
    echo -e "${CYAN}======================================================${NC}\n"

    local start_time
    start_time=$(date +%s)

    init_e2e_state
    setup_playwright

    # Phase 1: Generate test plan
    if ! generate_test_plan; then
        log "ERROR" "Cannot proceed without test plan"
        exit 1
    fi

    # Phase 2: Execute journeys
    execute_journeys

    local end_time
    end_time=$(date +%s)
    local duration
    duration=$(format_duration $((end_time - start_time)))

    # Summary
    echo -e "\n${GREEN}Frontend E2E testing complete (${duration})${NC}"
    echo -e "  Test plan:           ${TEST_PLAN_FILE}"
    echo -e "  Report:              ${TEST_REPORT_FILE}"
    echo -e "  Missing features:    ${MISSING_FUNC_FILE}"
    echo -e "  Screenshots:         ${SCREENSHOTS_DIR}"
    echo -e "  Playwright tests:    ${PW_DIR}"
    echo -e "  State:               ${E2E_STATE_FILE}"

    # Count missing functionality entries
    local missing_count=0
    if [[ -f "$MISSING_FUNC_FILE" ]]; then
        missing_count=$(grep -c "^## Missing:" "$MISSING_FUNC_FILE" 2>/dev/null || true)
    fi

    if [[ $missing_count -gt 0 ]]; then
        echo -e "  ${YELLOW}Missing features found: ${missing_count}${NC}"
    fi

    # Notify
    if type notify &>/dev/null 2>&1; then
        local completed
        completed=$(grep -c "status: \"completed\"\|status: \"passed\"" "$E2E_STATE_FILE" 2>/dev/null || true)
        local failed
        failed=$(grep -c "status: \"failed\"\|status: \"error\"" "$E2E_STATE_FILE" 2>/dev/null || true)
        notify "workflow_complete" "epic-${EPIC_ID}" "Frontend E2E: ${completed} passed, ${failed} failed, ${missing_count} missing features"
    fi

    log "SUCCESS" "Frontend E2E testing complete for Epic ${EPIC_ID} (${duration})"
}

main
