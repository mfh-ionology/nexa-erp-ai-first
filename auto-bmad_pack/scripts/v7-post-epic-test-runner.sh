#!/bin/bash
# V7 Post-Epic Test Runner - Orchestrates all post-epic testing phases
# Runs build verification, backend API tests, and (optionally) frontend E2E tests in sequence.
# Frontend testing is auto-detected: if apps/web exists, it runs; otherwise it's skipped.
# Compiles results, handles missing functionality, and optionally creates new stories.
# Adapted for Nexa ERP: Node.js/Fastify backend (port 5100), React/Vite frontend (when present).
#
# Usage: ./v7-post-epic-test-runner.sh <epic-id> [options]
#
# Options:
#   --skip-build          Skip build verification
#   --skip-backend        Skip backend API tests
#   --skip-frontend       Skip frontend E2E tests
#   --frontend-url URL    Override frontend URL
#   --api-url URL         Override API URL
#   --fix-bugs            Auto-fix bugs in all phases
#   --create-stories      Auto-create stories for missing functionality via SM
#   --resume              Resume from state file
#   --max-turns N         Max Claude turns per phase (default: 75)

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
SKIP_BUILD=false
SKIP_BACKEND=false
SKIP_FRONTEND=true   # Default true — no frontend in early epics; auto-detected below
FRONTEND_URL=""
API_URL=""

# Auto-detect frontend: if apps/web exists AND epic has frontend stories, enable frontend testing
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
if [[ -d "${PROJECT_ROOT}/apps/web" ]]; then
    SKIP_FRONTEND=false
fi
FIX_BUGS=false
CREATE_STORIES=false
RESUME_FROM_STATE=false
MAX_TURNS=75

shift
while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-build) SKIP_BUILD=true; shift ;;
        --skip-backend) SKIP_BACKEND=true; shift ;;
        --skip-frontend) SKIP_FRONTEND=true; shift ;;
        --frontend-url) FRONTEND_URL="$2"; shift 2 ;;
        --api-url) API_URL="$2"; shift 2 ;;
        --fix-bugs) FIX_BUGS=true; shift ;;
        --create-stories) CREATE_STORIES=true; shift ;;
        --resume) RESUME_FROM_STATE=true; shift ;;
        --max-turns) MAX_TURNS="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Directories
ensure_test_dirs "$EPIC_ID"
RUNNER_LOG_DIR="${LOG_DIR}/epic-${EPIC_ID}/test-runner"
mkdir -p "$RUNNER_LOG_DIR"

WORKFLOW_LOG="${RUNNER_LOG_DIR}/test-runner-$(date +%Y%m%d-%H%M%S).log"
RUNNER_STATE_FILE="${STATE_DIR}/epic-${EPIC_ID}-test-runner-state.yaml"

# File paths
SUMMARY_FILE="${TEST_ARTIFACTS}/epic-${EPIC_ID}-test-summary.md"
MISSING_FUNC_FILE="${TEST_ARTIFACTS}/missing-functionality-epic-${EPIC_ID}.md"

# BMAD references
EPIC_FILE="${PLANNING_ARTIFACTS}/epics/epic-${EPIC_ID}.md"
SPRINT_STATUS_FILE="${IMPL_ARTIFACTS}/sprint-status.yaml"

# Track server PIDs
BUILD_BACKEND_PID=""
BUILD_FRONTEND_PID=""

# ============================================================================
# STATE MANAGEMENT
# ============================================================================

init_runner_state() {
    if [[ "$RESUME_FROM_STATE" == "true" && -f "$RUNNER_STATE_FILE" ]]; then
        log "INFO" "Resuming from state file: $RUNNER_STATE_FILE"
        return 0
    fi

    # Set frontend_e2e initial state based on whether frontend exists
    local frontend_initial_state="pending"
    if [[ "$SKIP_FRONTEND" == "true" ]]; then
        frontend_initial_state="skipped"
    fi

    cat > "$RUNNER_STATE_FILE" << EOF
# V7 Post-Epic Test Runner State
epic_id: "${EPIC_ID}"
started_at: "$(date -Iseconds)"
updated_at: "$(date -Iseconds)"

phases:
  build_verify: "pending"
  backend_test: "pending"
  frontend_e2e: "${frontend_initial_state}"
  compile_results: "pending"
  create_stories: "pending"
  cleanup: "pending"

api_url: ""
frontend_url: ""
backend_pid: ""
frontend_pid: ""

results:
  build: "pending"
  backend_pass_rate: ""
  frontend_pass_rate: ""
  missing_features: 0
  stories_created: 0
EOF
    log "INFO" "Created test runner state file: $RUNNER_STATE_FILE"
}

# ============================================================================
# PHASE 1: BUILD VERIFICATION
# ============================================================================

run_build_verification() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        log "INFO" "Skipping build verification (--skip-build)"
        echo -e "${YELLOW}Skipping build verification${NC}"
        update_state_field "$RUNNER_STATE_FILE" "phases.build_verify" "skipped"

        # Use provided URLs or defaults
        API_URL="${API_URL:-http://localhost:5100}"
        FRONTEND_URL="${FRONTEND_URL:-http://localhost:5110}"
        export SERVER_API_URL="$API_URL"
        export SERVER_FRONTEND_URL="$FRONTEND_URL"
        return 0
    fi

    log_phase "1: Build Verification"
    update_state_field "$RUNNER_STATE_FILE" "phases.build_verify" "in_progress"

    local build_args=("$EPIC_ID" "--keep-servers")
    [[ -n "$API_URL" ]] && build_args+=("--api-url" "$API_URL")
    [[ -n "$FRONTEND_URL" ]] && build_args+=("--frontend-url" "$FRONTEND_URL")

    local build_output_file="${RUNNER_LOG_DIR}/build-verify-output.txt"

    if "${SCRIPT_DIR}/v7-post-epic-build-verify.sh" "${build_args[@]}" | tee "$build_output_file"; then
        # Extract URLs and PIDs from build script output (anchored grep for reliability)
        API_URL=$(grep "^BUILD_VERIFY_API_URL=" "$build_output_file" 2>/dev/null | tail -1 | cut -d= -f2 || echo "${API_URL:-http://localhost:5100}")
        FRONTEND_URL=$(grep "^BUILD_VERIFY_FRONTEND_URL=" "$build_output_file" 2>/dev/null | tail -1 | cut -d= -f2 || echo "${FRONTEND_URL:-http://localhost:5110}")
        BUILD_BACKEND_PID=$(grep "^BUILD_VERIFY_BACKEND_PID=" "$build_output_file" 2>/dev/null | tail -1 | cut -d= -f2 || echo "")
        BUILD_FRONTEND_PID=$(grep "^BUILD_VERIFY_FRONTEND_PID=" "$build_output_file" 2>/dev/null | tail -1 | cut -d= -f2 || echo "")

        export SERVER_API_URL="$API_URL"
        export SERVER_FRONTEND_URL="$FRONTEND_URL"

        update_state_field "$RUNNER_STATE_FILE" "phases.build_verify" "completed"
        update_state_field "$RUNNER_STATE_FILE" "api_url" "$API_URL"
        update_state_field "$RUNNER_STATE_FILE" "frontend_url" "$FRONTEND_URL"
        update_state_field "$RUNNER_STATE_FILE" "backend_pid" "$BUILD_BACKEND_PID"
        update_state_field "$RUNNER_STATE_FILE" "frontend_pid" "$BUILD_FRONTEND_PID"
        update_state_field "$RUNNER_STATE_FILE" "results.build" "success"

        log "SUCCESS" "Build verification passed"
        echo -e "${GREEN}Build verification passed${NC}"
        return 0
    else
        update_state_field "$RUNNER_STATE_FILE" "phases.build_verify" "failed"
        update_state_field "$RUNNER_STATE_FILE" "results.build" "failed"
        log "ERROR" "Build verification failed"
        echo -e "${RED}Build verification failed - cannot continue testing${NC}"
        return 1
    fi
}

# ============================================================================
# SERVER HEALTH CHECK (between phases)
# ============================================================================

check_servers_alive() {
    # Check PIDs if we have them (build-verify started the servers)
    if [[ -n "$BUILD_BACKEND_PID" ]] && ! kill -0 "$BUILD_BACKEND_PID" 2>/dev/null; then
        log "ERROR" "Backend server (PID $BUILD_BACKEND_PID) has died"
        echo -e "${RED}Backend server is no longer running${NC}"
        return 1
    fi
    if [[ -n "$BUILD_FRONTEND_PID" ]] && ! kill -0 "$BUILD_FRONTEND_PID" 2>/dev/null; then
        log "ERROR" "Frontend server (PID $BUILD_FRONTEND_PID) has died"
        echo -e "${RED}Frontend server is no longer running${NC}"
        return 1
    fi
    # If no PIDs (--skip-build), verify API URL is reachable
    if [[ -z "$BUILD_BACKEND_PID" ]] && [[ -n "$API_URL" ]]; then
        if ! curl -s -o /dev/null --max-time 3 "$API_URL" 2>/dev/null; then
            log "ERROR" "Backend at $API_URL is not reachable"
            echo -e "${RED}Backend at $API_URL is not reachable${NC}"
            return 1
        fi
    fi
    return 0
}

# ============================================================================
# PHASE 2: BACKEND TESTS
# ============================================================================

run_backend_tests() {
    if [[ "$SKIP_BACKEND" == "true" ]]; then
        log "INFO" "Skipping backend tests (--skip-backend)"
        echo -e "${YELLOW}Skipping backend tests${NC}"
        update_state_field "$RUNNER_STATE_FILE" "phases.backend_test" "skipped"
        return 0
    fi

    log_phase "2: Backend API Tests"
    update_state_field "$RUNNER_STATE_FILE" "phases.backend_test" "in_progress"

    local backend_args=("$EPIC_ID")
    [[ -n "$API_URL" ]] && backend_args+=("--api-url" "$API_URL")
    [[ "$FIX_BUGS" == "true" ]] && backend_args+=("--fix-bugs")
    backend_args+=("--max-turns" "$MAX_TURNS")

    if "${SCRIPT_DIR}/v7-post-epic-backend-test.sh" "${backend_args[@]}"; then
        update_state_field "$RUNNER_STATE_FILE" "phases.backend_test" "completed"
        log "SUCCESS" "Backend tests completed"
        return 0
    else
        update_state_field "$RUNNER_STATE_FILE" "phases.backend_test" "failed"
        log "WARN" "Backend tests had failures"
        return 1
    fi
}

# ============================================================================
# PHASE 3: FRONTEND E2E TESTS
# ============================================================================

run_frontend_tests() {
    if [[ "$SKIP_FRONTEND" == "true" ]]; then
        log "INFO" "Skipping frontend E2E tests (--skip-frontend)"
        echo -e "${YELLOW}Skipping frontend E2E tests${NC}"
        update_state_field "$RUNNER_STATE_FILE" "phases.frontend_e2e" "skipped"
        return 0
    fi

    # Auto-detect: skip if apps/web directory doesn't exist yet
    if [[ ! -d "${PROJECT_ROOT}/apps/web" ]]; then
        log "INFO" "Skipping frontend E2E tests — apps/web directory not found (frontend not yet created)"
        echo -e "${YELLOW}Skipping frontend E2E tests — no apps/web directory${NC}"
        update_state_field "$RUNNER_STATE_FILE" "phases.frontend_e2e" "skipped"
        return 0
    fi

    # Auto-detect: skip if epic has no frontend stories (backend-only epic)
    # Check epic file for frontend indicators: UI, screen, page, component, frontend, UX, web
    local epic_file=""
    local impl_dir="${PROJECT_ROOT}/_bmad-output/implementation-artifacts/epics"
    local plan_dir="${PROJECT_ROOT}/_bmad-output/planning-artifacts/epics"
    local epic_id_lower
    epic_id_lower=$(echo "$EPIC_ID" | tr '[:upper:]' '[:lower:]')

    # Find epic file in implementation-artifacts or planning-artifacts
    for dir in "$impl_dir" "$plan_dir"; do
        if [[ -d "$dir" ]]; then
            for f in "${dir}"/epic-*.md; do
                [[ -f "$f" ]] || continue
                local f_lower
                f_lower=$(basename "$f" | tr '[:upper:]' '[:lower:]')
                if [[ "$f_lower" == "epic-${epic_id_lower}-"* || "$f_lower" == "epic-${epic_id_lower}.md" ]]; then
                    epic_file="$f"
                    break 2
                fi
            done
        fi
    done

    if [[ -n "$epic_file" ]]; then
        # Check if epic contains frontend-related keywords in story TITLES and USER STORIES only
        # Exclude: reference table rows (| ... |), lines with "N/A"/"no UI", and "UX Design Spec" references
        local frontend_indicators
        frontend_indicators=$(grep -iE '(frontend|web ui|screen|page layout|component|dashboard|form design|ux design|user interface|\breact\b|web shell|mobile scaffold)' "$epic_file" 2>/dev/null \
            | grep -vE '^\|' 2>/dev/null \
            | grep -cviE '(N/A|no UI|not applicable|N/A —|UX Design Spec|Reference Documents)' 2>/dev/null || echo "0")
        if [[ "$frontend_indicators" -eq 0 ]]; then
            log "INFO" "Skipping frontend E2E tests — epic ${EPIC_ID} is backend-only (no frontend stories detected)"
            echo -e "${YELLOW}Skipping frontend E2E tests — backend-only epic (no UI stories)${NC}"
            update_state_field "$RUNNER_STATE_FILE" "phases.frontend_e2e" "skipped"
            return 0
        else
            log "INFO" "Epic ${EPIC_ID} has ${frontend_indicators} frontend indicators — running frontend E2E tests"
        fi
    fi

    log_phase "3: Frontend E2E Tests"
    update_state_field "$RUNNER_STATE_FILE" "phases.frontend_e2e" "in_progress"

    local frontend_args=("$EPIC_ID")
    [[ -n "$FRONTEND_URL" ]] && frontend_args+=("--frontend-url" "$FRONTEND_URL")
    [[ -n "$API_URL" ]] && frontend_args+=("--api-url" "$API_URL")
    [[ "$FIX_BUGS" == "true" ]] && frontend_args+=("--fix-bugs")
    frontend_args+=("--max-turns" "$MAX_TURNS")

    if "${SCRIPT_DIR}/v7-post-epic-frontend-e2e.sh" "${frontend_args[@]}"; then
        update_state_field "$RUNNER_STATE_FILE" "phases.frontend_e2e" "completed"
        log "SUCCESS" "Frontend E2E tests completed"
        return 0
    else
        update_state_field "$RUNNER_STATE_FILE" "phases.frontend_e2e" "failed"
        log "WARN" "Frontend E2E tests had failures"
        return 1
    fi
}

# ============================================================================
# PHASE 4: COMPILE RESULTS
# ============================================================================

compile_results() {
    log_phase "4: Compile Test Results"
    update_state_field "$RUNNER_STATE_FILE" "phases.compile_results" "in_progress"

    # Read backend results
    local backend_results_file="${TEST_ARTIFACTS}/backend-test-results-epic-${EPIC_ID}.json"
    local backend_total=0 backend_passed=0 backend_failed=0
    local backend_status="not run"

    if [[ -f "$backend_results_file" ]]; then
        backend_total=$(grep -c '"total":' "$backend_results_file" 2>/dev/null || true)
        backend_passed=$(grep -c '"status": "pass"' "$backend_results_file" 2>/dev/null || true)
        backend_failed=$(grep -c '"status": "fail"' "$backend_results_file" 2>/dev/null || true)
        backend_total=$((backend_passed + backend_failed))
        if [[ $backend_total -gt 0 ]]; then
            backend_status="${backend_passed}/${backend_total} passed"
        fi
    fi

    # Read frontend results (only if frontend was not skipped)
    local frontend_report_file="${TEST_ARTIFACTS}/frontend-test-report-epic-${EPIC_ID}.md"
    local frontend_status="skipped"
    local frontend_was_run=false
    if [[ "$SKIP_FRONTEND" != "true" ]] && [[ -d "${PROJECT_ROOT}/apps/web" ]]; then
        frontend_status="not run"
        frontend_was_run=true
        if [[ -f "$frontend_report_file" ]]; then
            frontend_status=$(grep "Total\|Passed\|Failed" "$frontend_report_file" 2>/dev/null | head -1 || echo "see report")
        fi
    fi

    # Read missing functionality
    local missing_count=0
    if [[ -f "$MISSING_FUNC_FILE" ]]; then
        missing_count=$(grep -c "^## Missing:" "$MISSING_FUNC_FILE" 2>/dev/null || true)
    fi

    # Read build report
    local build_report_file="${TEST_ARTIFACTS}/build-verification-epic-${EPIC_ID}.md"
    local build_status="not run"
    if [[ -f "$build_report_file" ]]; then
        build_status=$(grep "Status" "$build_report_file" 2>/dev/null | head -1 | sed 's/.*: //' || echo "see report")
    fi

    # Read DB schema check status
    local schema_status="not checked"

    # Generate summary report
    cat > "$SUMMARY_FILE" << EOF
# Epic ${EPIC_ID} - Post-Epic Test Summary

**Date**: $(date '+%Y-%m-%d %H:%M:%S')

## Overall Status

| Phase | Status |
|-------|--------|
| Build Verification | ${build_status} |
| DB Schema Alignment | ${schema_status} |
| Backend API Tests | ${backend_status} |
| Frontend E2E Tests | ${frontend_status} |
| Missing Features | ${missing_count} found |

## Backend API Tests

$(if [[ -f "$backend_results_file" ]]; then
    echo "- Total tests: ${backend_total}"
    echo "- Passed: ${backend_passed}"
    echo "- Failed: ${backend_failed}"
    if [[ $backend_total -gt 0 ]]; then
        local pass_pct=$((backend_passed * 100 / backend_total))
        echo "- Pass rate: ${pass_pct}%"
    fi
    echo ""
    echo "Full results: \`${backend_results_file}\`"
    echo "Full report: \`${TEST_ARTIFACTS}/backend-test-report-epic-${EPIC_ID}.md\`"
else
    echo "Not run or no results file."
fi)

## Frontend E2E Tests

$(if [[ "$frontend_was_run" != "true" ]]; then
    echo "Skipped — no frontend exists yet (apps/web not found)."
elif [[ -f "$frontend_report_file" ]]; then
    echo "Full report: \`${frontend_report_file}\`"
    echo "Screenshots: \`${TEST_ARTIFACTS}/screenshots/epic-${EPIC_ID}/\`"
else
    echo "Not run or no report file."
fi)

## Missing Functionality

$(if [[ $missing_count -gt 0 ]]; then
    echo "${missing_count} missing feature(s) documented in:"
    echo "\`${MISSING_FUNC_FILE}\`"
else
    echo "No missing functionality detected."
fi)

## Artifacts

| Artifact | Path |
|----------|------|
| Build Report | \`${build_report_file}\` |
| Backend Test Plan | \`${TEST_ARTIFACTS}/backend-test-plan-epic-${EPIC_ID}.json\` |
| Backend Test Results | \`${backend_results_file}\` |
$(if [[ "$frontend_was_run" == "true" ]]; then
    echo "| Frontend Test Plan | \`${TEST_ARTIFACTS}/frontend-test-plan-epic-${EPIC_ID}.json\` |"
    echo "| Frontend Test Report | \`${frontend_report_file}\` |"
    echo "| Screenshots | \`${TEST_ARTIFACTS}/screenshots/epic-${EPIC_ID}/\` |"
fi)
| Missing Functionality | \`${MISSING_FUNC_FILE}\` |
| Test Summary | \`${SUMMARY_FILE}\` |
EOF

    update_state_field "$RUNNER_STATE_FILE" "results.missing_features" "$missing_count"
    update_state_field "$RUNNER_STATE_FILE" "phases.compile_results" "completed"

    log "SUCCESS" "Test summary compiled: $SUMMARY_FILE"
    echo -e "${GREEN}Test summary: ${SUMMARY_FILE}${NC}"
}

# ============================================================================
# PHASE 5: HANDLE MISSING FUNCTIONALITY
# ============================================================================

create_missing_stories() {
    if [[ "$CREATE_STORIES" != "true" ]]; then
        log "INFO" "Skipping story creation (--create-stories not set)"
        update_state_field "$RUNNER_STATE_FILE" "phases.create_stories" "skipped"
        return 0
    fi

    if [[ ! -f "$MISSING_FUNC_FILE" ]]; then
        log "INFO" "No missing functionality file"
        update_state_field "$RUNNER_STATE_FILE" "phases.create_stories" "skipped"
        return 0
    fi

    local missing_count
    missing_count=$(grep -c "^## Missing:" "$MISSING_FUNC_FILE" 2>/dev/null || true)

    if [[ "$missing_count" -eq 0 ]]; then
        log "INFO" "No missing functionality to create stories for"
        update_state_field "$RUNNER_STATE_FILE" "phases.create_stories" "skipped"
        return 0
    fi

    log_phase "5: Create Stories for Missing Functionality"
    update_state_field "$RUNNER_STATE_FILE" "phases.create_stories" "in_progress"

    echo -e "${BLUE}Creating stories for ${missing_count} missing features...${NC}"

    local create_log="${RUNNER_LOG_DIR}/create-stories-$(date +%H%M%S).log"

    local prompt
    prompt="Create new user stories for missing functionality found during Epic ${EPIC_ID} testing.

Missing functionality file: ${MISSING_FUNC_FILE}
Epic file: ${EPIC_FILE}
Stories directory: ${IMPL_ARTIFACTS}/stories/
Sprint status file: ${SPRINT_STATUS_FILE}

For each missing feature in the file:
1. Read the description, expected behavior, and related story
2. Create a new story file in the stories directory
3. Follow the existing story format (look at existing stories for the template)
4. Set status to 'backlog'
5. Add the story to sprint-status.yaml under epic ${EPIC_ID}
6. If the epic file has a story_registry in its YAML frontmatter, add the new story there too

Name the story files following the pattern: ${EPIC_ID}-<next-number>-<slug>.md
Use the next available story number for this epic.

After creating all stories, output a summary of what was created."

    if run_claude_with_timeout 600 "$create_log" -p "$prompt" --max-turns "$MAX_TURNS"; then
        log "SUCCESS" "Story creation completed"
        echo -e "${GREEN}Stories created for missing functionality${NC}"
        update_state_field "$RUNNER_STATE_FILE" "phases.create_stories" "completed"
        update_state_field "$RUNNER_STATE_FILE" "results.stories_created" "$missing_count"
    else
        log "ERROR" "Story creation failed"
        echo -e "${RED}Story creation failed${NC}"
        update_state_field "$RUNNER_STATE_FILE" "phases.create_stories" "failed"
    fi
}

# ============================================================================
# PHASE 6: CLEANUP
# ============================================================================

cleanup_servers() {
    log_phase "6: Cleanup"
    update_state_field "$RUNNER_STATE_FILE" "phases.cleanup" "in_progress"

    # Stop servers started by build-verify
    if [[ -n "$BUILD_BACKEND_PID" ]] && kill -0 "$BUILD_BACKEND_PID" 2>/dev/null; then
        log "INFO" "Stopping backend server (PID: $BUILD_BACKEND_PID)"
        kill "$BUILD_BACKEND_PID" 2>/dev/null || true
        sleep 2
        kill -9 "$BUILD_BACKEND_PID" 2>/dev/null || true
    fi
    if [[ -n "$BUILD_FRONTEND_PID" ]] && kill -0 "$BUILD_FRONTEND_PID" 2>/dev/null; then
        log "INFO" "Stopping frontend server (PID: $BUILD_FRONTEND_PID)"
        kill "$BUILD_FRONTEND_PID" 2>/dev/null || true
        sleep 2
        kill -9 "$BUILD_FRONTEND_PID" 2>/dev/null || true
    fi

    update_state_field "$RUNNER_STATE_FILE" "phases.cleanup" "completed"
    log "INFO" "Cleanup complete"
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    log "INFO" "Starting post-epic test runner for Epic ${EPIC_ID}"

    local frontend_label
    if [[ "$SKIP_FRONTEND" == "true" ]]; then
        frontend_label="[Frontend] (skipped)"
    else
        frontend_label="Frontend"
    fi

    echo -e "\n${MAGENTA}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║  POST-EPIC TEST RUNNER - Epic ${EPIC_ID}${NC}"
    echo -e "${MAGENTA}║  Build → Backend → ${frontend_label} → Summary${NC}"
    echo -e "${MAGENTA}╚════════════════════════════════════════════════════════════╝${NC}\n"

    local start_time
    start_time=$(date +%s)

    init_runner_state

    local overall_status="success"

    # Phase 1: Build
    if ! run_build_verification; then
        overall_status="failed"
        echo -e "${RED}Build failed - stopping test runner${NC}"

        if type notify &>/dev/null 2>&1; then
            notify "workflow_failed" "epic-${EPIC_ID}" "Post-epic testing failed: build verification error"
        fi

        exit 1
    fi

    # Phase 2: Backend tests
    if ! check_servers_alive; then
        log "ERROR" "Servers died before backend tests"
        overall_status="failed"
    elif ! run_backend_tests; then
        overall_status="partial"
    fi

    # Phase 3: Frontend E2E tests
    if ! check_servers_alive; then
        log "ERROR" "Servers died before frontend tests"
        overall_status="failed"
    elif ! run_frontend_tests; then
        overall_status="partial"
    fi

    # Phase 4: Compile results
    compile_results

    # Phase 5: Create stories for missing features
    create_missing_stories

    # Phase 6: Cleanup
    cleanup_servers

    local end_time
    end_time=$(date +%s)
    local duration
    duration=$(format_duration $((end_time - start_time)))

    # Final output
    echo -e "\n${MAGENTA}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║  POST-EPIC TEST RUNNER COMPLETE${NC}"
    echo -e "${MAGENTA}║  Epic: ${EPIC_ID}${NC}"
    echo -e "${MAGENTA}║  Status: ${overall_status}${NC}"
    echo -e "${MAGENTA}║  Duration: ${duration}${NC}"
    echo -e "${MAGENTA}╚════════════════════════════════════════════════════════════╝${NC}\n"

    echo -e "  Summary: ${SUMMARY_FILE}"
    echo -e "  State:   ${RUNNER_STATE_FILE}"

    # Send final Slack notification
    if type notify &>/dev/null 2>&1; then
        if [[ "$overall_status" == "success" ]]; then
            notify "workflow_complete" "epic-${EPIC_ID}" "Post-epic testing complete: all phases passed (${duration})"
        else
            notify "needs_fixes" "epic-${EPIC_ID}" "Post-epic testing complete with issues: ${overall_status} (${duration})"
        fi
    fi

    log "SUCCESS" "Post-epic test runner complete for Epic ${EPIC_ID} (${duration})"

    # Return non-zero if any phase failed
    if [[ "$overall_status" == "failed" ]]; then
        exit 1
    fi
}

main
