#!/bin/bash
# V7 Post-Epic Backend API Testing
# Tests API endpoints via HTTP, verifies DB alignment, and optionally fixes bugs.
#
# Usage: ./v7-post-epic-backend-test.sh <epic-id> [options]
#
# Options:
#   --api-url URL         Backend URL (default: http://localhost:3000 or $SERVER_API_URL)
#   --skip-schema         Skip DB schema verification
#   --fix-bugs            Auto-fix bugs found during testing
#   --max-turns N         Claude turns per test phase (default: 50)
#   --max-fix-retries N   Max fix-retest cycles (default: 3)

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
API_URL="${SERVER_API_URL:-http://localhost:3000}"
SKIP_SCHEMA=false
FIX_BUGS=false
MAX_TURNS=50
MAX_FIX_RETRIES=3

shift
while [[ $# -gt 0 ]]; do
    case "$1" in
        --api-url) API_URL="$2"; shift 2 ;;
        --skip-schema) SKIP_SCHEMA=true; shift ;;
        --fix-bugs) FIX_BUGS=true; shift ;;
        --max-turns) MAX_TURNS="$2"; shift 2 ;;
        --max-fix-retries) MAX_FIX_RETRIES="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Directories
ensure_test_dirs "$EPIC_ID"
BACKEND_LOG_DIR="${LOG_DIR}/epic-${EPIC_ID}/backend-test"
mkdir -p "$BACKEND_LOG_DIR"

WORKFLOW_LOG="${BACKEND_LOG_DIR}/backend-test-$(date +%Y%m%d-%H%M%S).log"

# File paths
EPIC_FILE="${PLANNING_ARTIFACTS}/epics/epic-${EPIC_ID}.md"
STORIES_DIR="${IMPL_ARTIFACTS}/stories"
TEST_PLAN_FILE="${TEST_ARTIFACTS}/backend-test-plan-epic-${EPIC_ID}.json"
TEST_RESULTS_FILE="${TEST_ARTIFACTS}/backend-test-results-epic-${EPIC_ID}.json"
TEST_REPORT_FILE="${TEST_ARTIFACTS}/backend-test-report-epic-${EPIC_ID}.md"

# Auth token (populated by seed_and_auth phase)
AUTH_TOKEN=""
SEED_USER_EMAIL="admin@nexa-erp.dev"
SEED_USER_PASSWORD="NexaDev2026"

# ============================================================================
# PHASE 0: SEED DATABASE & ACQUIRE AUTH TOKEN
# ============================================================================

seed_database() {
    log_phase "0: Seed Database"

    log "INFO" "Running Prisma seed..."
    echo -e "${BLUE}Seeding database...${NC}"

    # Export .env so prisma can find DATABASE_URL / DIRECT_URL
    if [[ -f "${PROJECT_ROOT}/.env" ]]; then
        set -a
        # shellcheck disable=SC1091
        source "${PROJECT_ROOT}/.env"
        set +a
    fi

    local seed_log="${BACKEND_LOG_DIR}/seed-$(date +%H%M%S).log"
    if (cd "${PROJECT_ROOT}/packages/db" && npx prisma db seed) > "$seed_log" 2>&1; then
        log "SUCCESS" "Database seeded"
        echo -e "${GREEN}Database seeded${NC}"
    else
        log "ERROR" "Seed failed — see $seed_log"
        echo -e "${RED}Seed failed${NC}"
        tail -10 "$seed_log" 2>/dev/null | sed 's/^/  /'
        return 1
    fi
}

acquire_auth_token() {
    # Acquire a fresh JWT right before test execution (token has 15-min TTL)
    log "INFO" "Acquiring auth token via login..."
    echo -e "${BLUE}Logging in as seed admin user...${NC}"

    local login_response
    login_response=$(curl -s -X POST "${API_URL}/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"${SEED_USER_EMAIL}\",\"password\":\"${SEED_USER_PASSWORD}\"}" \
        --max-time 10 2>/dev/null)

    # Extract access token (handles both { data: { accessToken } } and { accessToken } shapes)
    AUTH_TOKEN=$(echo "$login_response" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    # Try nested envelope first, then flat
    token = d.get('data', d).get('accessToken', '')
    print(token)
except:
    print('')
" 2>/dev/null)

    if [[ -z "$AUTH_TOKEN" ]]; then
        log "ERROR" "Failed to acquire auth token. Login response:"
        echo "$login_response" | head -5 | sed 's/^/  /'
        echo -e "${RED}Auth token acquisition failed — authenticated tests will return 401${NC}"
        return 1
    fi

    log "SUCCESS" "Auth token acquired (${#AUTH_TOKEN} chars)"
    echo -e "${GREEN}Auth token acquired${NC}"
}

# ============================================================================
# PHASE 1: DB SCHEMA ALIGNMENT
# ============================================================================

run_schema_check() {
    if [[ "$SKIP_SCHEMA" == "true" ]]; then
        log "INFO" "Skipping schema check (--skip-schema)"
        echo -e "${YELLOW}Skipping DB schema check${NC}"
        return 0
    fi

    log_phase "1: DB Schema Alignment Check"

    local schema_log="${BACKEND_LOG_DIR}/schema-check-$(date +%H%M%S).log"

    local prompt
    prompt="Verify DB schema alignment for the Nexa ERP project.

Project root: ${PROJECT_ROOT}

Steps:
1. Read the Prisma schema at packages/db/prisma/schema.prisma
2. Read migration files in packages/db/prisma/migrations/ (if they exist)
3. Connect to PostgreSQL using the DATABASE_URL from the .env file at project root
4. Use psql or npx prisma db pull --print to inspect the actual database schema
5. Compare the Prisma schema definition with the actual DB schema
6. Report any differences: missing tables, missing columns, type mismatches, missing constraints

Output a summary of findings. If everything is aligned, say 'DB schema is aligned'.
If there are issues, list each one clearly."

    if run_claude_with_timeout 300 "$schema_log" -p "$prompt" --max-turns 20; then
        log "SUCCESS" "Schema check completed"
        echo -e "${GREEN}Schema check completed${NC}"

        # Check if actual issues were found (skip if schema is clearly aligned)
        if ! grep -qi "schema is aligned\|all.*match\|no.*drift detected\|everything is aligned" "$schema_log" 2>/dev/null; then
            log "WARN" "Schema issues detected"
            echo -e "${YELLOW}Schema issues detected - see log for details${NC}"

            if [[ "$FIX_BUGS" == "true" ]]; then
                log "INFO" "Attempting to fix schema issues..."
                local fix_log="${BACKEND_LOG_DIR}/schema-fix-$(date +%H%M%S).log"
                local fix_prompt
                fix_prompt="Fix the DB schema alignment issues you found.

Project root: ${PROJECT_ROOT}

Read the previous analysis and fix the schema/migration issues.
After fixing, verify by running the schema comparison again."

                run_claude_with_timeout 300 "$fix_log" -p "$fix_prompt" --max-turns 20 || true
            fi
        fi
    else
        log "ERROR" "Schema check failed"
        echo -e "${RED}Schema check failed${NC}"
    fi
}

# ============================================================================
# PHASE 2: GENERATE TEST PLAN
# ============================================================================

generate_test_plan() {
    log_phase "2: Generate Backend Test Plan"

    local plan_log="${BACKEND_LOG_DIR}/generate-plan-$(date +%H%M%S).log"

    local prompt
    prompt="Generate a backend API test plan for Epic ${EPIC_ID}.

Read the following files:
1. Epic file: ${EPIC_FILE}
2. Story files in: ${STORIES_DIR} (files matching pattern ${EPIC_ID}-*)
3. Route files in: ${PROJECT_ROOT}/apps/api/src/core/routes/ and ${PROJECT_ROOT}/apps/api/src/modules/
4. Schema file: ${PROJECT_ROOT}/packages/db/prisma/schema.prisma
5. Service/repository files in: ${PROJECT_ROOT}/apps/api/src/modules/ (services contain DB logic)

For each API endpoint discovered:
- Create happy path test cases (valid inputs, expected 200/201)
- Create validation error tests (missing required fields, invalid types -> 400)
- Create edge case tests (not found -> 404, empty lists -> 200 with [])
- For mutating operations (POST/PUT/DELETE), include DB verification queries

Order tests: creates first, then reads, then updates, then deletes.

Write the test plan as JSON to: ${TEST_PLAN_FILE}

The JSON structure should be:
{
  \"epic_id\": \"${EPIC_ID}\",
  \"generated_at\": \"<ISO timestamp>\",
  \"total_test_cases\": <number>,
  \"api_base_url\": \"${API_URL}\",
  \"endpoints\": [
    {
      \"method\": \"POST\",
      \"path\": \"/api/auth/login\",
      \"description\": \"Authenticate user and return JWT\",
      \"test_cases\": [
        {
          \"name\": \"Login - happy path\",
          \"type\": \"happy_path\",
          \"request\": {\"method\": \"POST\", \"url\": \"/api/auth/login\", \"headers\": {\"Content-Type\": \"application/json\"}, \"body\": {}},
          \"expected\": {\"status\": 200, \"body_contains\": [\"token\", \"user\"]},
          \"db_verification\": {\"enabled\": false, \"query\": \"\", \"expected\": \"\"}
        }
      ]
    }
  ]
}"

    if run_claude_with_timeout 600 "$plan_log" -p "$prompt" --max-turns "$MAX_TURNS"; then
        if [[ -f "$TEST_PLAN_FILE" ]]; then
            log "SUCCESS" "Test plan generated: $TEST_PLAN_FILE"
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
# PHASE 3: EXECUTE API TESTS
# ============================================================================

execute_tests() {
    log_phase "3: Execute API Tests"

    local exec_log="${BACKEND_LOG_DIR}/execute-tests-$(date +%H%M%S).log"

    # Build auth context for the prompt
    local auth_context=""
    if [[ -n "$AUTH_TOKEN" ]]; then
        auth_context="
IMPORTANT - Authentication:
A valid JWT access token is available for authenticated requests:
  Authorization: Bearer ${AUTH_TOKEN}

Seed user credentials (for login tests): email=${SEED_USER_EMAIL} password=${SEED_USER_PASSWORD}
Use the token above for ALL endpoints that require authentication (anything except /health, /auth/login, /auth/refresh, /auth/logout).
If the token expires during testing (you get 401), re-login with: curl -s -X POST ${API_URL}/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"${SEED_USER_EMAIL}\",\"password\":\"${SEED_USER_PASSWORD}\"}'
and extract the new token from data.accessToken in the JSON response."
    else
        auth_context="
WARNING: No auth token available. Authenticated endpoints will return 401.
Login first with: curl -s -X POST ${API_URL}/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"${SEED_USER_EMAIL}\",\"password\":\"${SEED_USER_PASSWORD}\"}'
and extract the token from data.accessToken in the JSON response."
    fi

    local prompt
    prompt="Execute the backend API test plan for Epic ${EPIC_ID}.

Test plan file: ${TEST_PLAN_FILE}
API base URL: ${API_URL}
${auth_context}

EFFICIENCY: To save time, batch your curl commands. Write a bash script to ${BACKEND_LOG_DIR}/run-tests.sh that executes ALL test cases, then run it. The script should:
- For each test: run curl, capture status code and body, output JSON result line
- Use -w '%{http_code}' for status codes
- Output one JSON line per test to stdout

After running the script, parse its output and write:
1. Results JSON to: ${TEST_RESULTS_FILE}
2. Markdown report to: ${TEST_REPORT_FILE}

Results JSON structure:
{
  \"epic_id\": \"${EPIC_ID}\",
  \"executed_at\": \"<ISO timestamp>\",
  \"api_base_url\": \"${API_URL}\",
  \"summary\": {\"total\": N, \"passed\": N, \"failed\": N, \"skipped\": N},
  \"results\": [{\"endpoint\": \"POST /auth/login\", \"test_name\": \"...\", \"type\": \"happy_path\", \"status\": \"pass|fail|skip\", \"expected_status\": 200, \"actual_status\": 200, \"assertions\": [{\"check\": \"status code\", \"passed\": true}], \"error\": null}]
}

Report should be markdown with summary table and per-endpoint results with failure details."

    if run_claude_with_timeout 1800 "$exec_log" -p "$prompt" --max-turns 100; then
        if [[ -f "$TEST_RESULTS_FILE" ]]; then
            log "SUCCESS" "Tests executed, results: $TEST_RESULTS_FILE"
            echo -e "${GREEN}Tests executed${NC}"
            return 0
        else
            log "ERROR" "Claude completed but test results file was not created: $TEST_RESULTS_FILE"
            echo -e "${RED}Test results file was not generated${NC}"
            return 1
        fi
    else
        log "ERROR" "Test execution failed"
        return 1
    fi
}

# ============================================================================
# PHASE 4: BUG FIX LOOP
# ============================================================================

fix_and_retest() {
    if [[ "$FIX_BUGS" != "true" ]]; then
        return 0
    fi

    # Check if there are failures
    if [[ ! -f "$TEST_RESULTS_FILE" ]]; then
        return 0
    fi

    local failed_count
    failed_count=$(grep -c '"status": "fail"' "$TEST_RESULTS_FILE" 2>/dev/null || true)

    if [[ "$failed_count" -eq 0 ]]; then
        log "INFO" "No failures to fix"
        return 0
    fi

    log_phase "4: Bug Fix Loop"
    echo -e "${YELLOW}Found ${failed_count} failed tests, attempting fixes...${NC}"

    local retry=0
    while [[ $retry -lt $MAX_FIX_RETRIES && $failed_count -gt 0 ]]; do
        retry=$((retry + 1))
        log "INFO" "Fix attempt $retry of $MAX_FIX_RETRIES ($failed_count failures)"

        local fix_log="${BACKEND_LOG_DIR}/fix-bugs-${retry}-$(date +%H%M%S).log"

        local prompt
        prompt="Fix backend API bugs found during testing for Epic ${EPIC_ID}.

Test results: ${TEST_RESULTS_FILE}
Project root: ${PROJECT_ROOT}

For each failed test:
1. Read the test result to understand what failed
2. Read the relevant route/service/Prisma schema file in apps/api/src/ and packages/db/prisma/
3. Identify the root cause (wrong status code, missing validation, incorrect Prisma query, etc.)
4. Fix the code
5. Do NOT change the test expectations - fix the implementation

After fixing, re-run ONLY the previously failed tests using curl against ${API_URL}.
Update the results file at ${TEST_RESULTS_FILE} with the new results."

        if run_claude_with_timeout 600 "$fix_log" -p "$prompt" --max-turns "$MAX_TURNS"; then
            # Recount failures
            if [[ -f "$TEST_RESULTS_FILE" ]]; then
                failed_count=$(grep -c '"status": "fail"' "$TEST_RESULTS_FILE" 2>/dev/null || true)
                log "INFO" "After fix attempt $retry: $failed_count failures remaining"
            fi
        else
            log "ERROR" "Fix attempt $retry failed"
        fi
    done

    if [[ $failed_count -gt 0 ]]; then
        log "WARN" "$failed_count failures remain after $MAX_FIX_RETRIES fix attempts"
        echo -e "${YELLOW}${failed_count} failures remain after fix attempts${NC}"
    else
        log "SUCCESS" "All failures fixed"
        echo -e "${GREEN}All failures fixed${NC}"
    fi
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    log "INFO" "Starting backend API testing for Epic ${EPIC_ID}"
    echo -e "\n${CYAN}======================================================${NC}"
    echo -e "${CYAN}  POST-EPIC BACKEND API TESTING - Epic ${EPIC_ID}${NC}"
    echo -e "${CYAN}======================================================${NC}\n"

    local start_time
    start_time=$(date +%s)

    # Phase 0: Seed database (early — ensures test data exists)
    seed_database || log "WARN" "Seed failed — continuing with limited test coverage"

    # Phase 1: Schema check
    run_schema_check

    # Phase 2: Generate test plan
    if ! generate_test_plan; then
        log "ERROR" "Cannot proceed without test plan"
        exit 1
    fi

    # Acquire fresh auth token just before test execution (15-min TTL)
    acquire_auth_token || log "WARN" "Auth token failed — authenticated tests will return 401"

    # Phase 3: Execute tests
    execute_tests

    # Phase 4: Fix bugs (if enabled)
    fix_and_retest

    local end_time
    end_time=$(date +%s)
    local duration
    duration=$(format_duration $((end_time - start_time)))

    # Summary
    echo -e "\n${GREEN}Backend testing complete (${duration})${NC}"
    echo -e "  Test plan:    ${TEST_PLAN_FILE}"
    echo -e "  Results:      ${TEST_RESULTS_FILE}"
    echo -e "  Report:       ${TEST_REPORT_FILE}"

    # Notify
    if [[ -f "$TEST_RESULTS_FILE" ]]; then
        local total passed failed
        total=$(grep -c '"total":' "$TEST_RESULTS_FILE" 2>/dev/null || true)
        passed=$(grep -c '"passed":' "$TEST_RESULTS_FILE" 2>/dev/null || true)
        failed=$(grep -c '"status": "fail"' "$TEST_RESULTS_FILE" 2>/dev/null || true)

        if type notify &>/dev/null 2>&1; then
            if [[ "$failed" -gt 0 ]]; then
                notify "needs_fixes" "epic-${EPIC_ID}" "Backend tests: ${failed} failures"
            else
                notify "workflow_complete" "epic-${EPIC_ID}" "Backend tests passed"
            fi
        fi
    fi

    log "SUCCESS" "Backend testing complete for Epic ${EPIC_ID} (${duration})"
}

main
