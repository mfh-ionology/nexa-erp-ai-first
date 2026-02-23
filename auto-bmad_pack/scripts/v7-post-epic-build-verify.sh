#!/bin/bash
# V7 Post-Epic Build Verification
# Builds the monorepo, starts dev servers, and verifies health endpoints.
# If build fails, invokes Claude to fix errors and retries.
#
# Usage: ./v7-post-epic-build-verify.sh <epic-id> [options]
#
# Options:
#   --api-url URL         Backend URL (default: http://localhost:3000)
#   --frontend-url URL    Frontend URL (default: empty; set to enable frontend checks)
#   --skip-build          Skip build, just start servers
#   --keep-servers        Don't stop servers on exit (for subsequent scripts)
#   --max-build-retries N Max build-fix-retry cycles (default: 3)
#   --max-turns N         Claude turns for fixes (default: 30)

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
API_URL="http://localhost:3000"
FRONTEND_URL=""  # Empty by default; apps/web is a stub until React UI epics
SKIP_BUILD=false
KEEP_SERVERS=false
MAX_BUILD_RETRIES=3
MAX_TURNS=30
HEALTH_TIMEOUT=120  # seconds to wait for servers (Fastify starts fast; increase if needed)

shift
while [[ $# -gt 0 ]]; do
    case "$1" in
        --api-url) API_URL="$2"; shift 2 ;;
        --frontend-url) FRONTEND_URL="$2"; shift 2 ;;
        --skip-build) SKIP_BUILD=true; shift ;;
        --keep-servers) KEEP_SERVERS=true; shift ;;
        --max-build-retries) MAX_BUILD_RETRIES="$2"; shift 2 ;;
        --max-turns) MAX_TURNS="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Determine whether frontend is enabled (apps/web has a dev script and real content)
FRONTEND_ENABLED=false
if [[ -n "$FRONTEND_URL" ]] && [[ -d "${PROJECT_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}/apps/web" ]]; then
    # Check if apps/web/package.json has a "dev" script (not just build/typecheck)
    if grep -q '"dev"' "${PROJECT_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}/apps/web/package.json" 2>/dev/null; then
        FRONTEND_ENABLED=true
    fi
fi

# Export URLs for downstream scripts
export SERVER_API_URL="$API_URL"
export SERVER_FRONTEND_URL="$FRONTEND_URL"

# Directories
ensure_test_dirs "$EPIC_ID"
BUILD_LOG_DIR="${LOG_DIR}/epic-${EPIC_ID}/build-verify"
mkdir -p "$BUILD_LOG_DIR"

WORKFLOW_LOG="${BUILD_LOG_DIR}/build-verify-$(date +%Y%m%d-%H%M%S).log"
BUILD_STATE_FILE="${STATE_DIR}/epic-${EPIC_ID}-build-state.yaml"
REPORT_FILE="${TEST_ARTIFACTS}/build-verification-epic-${EPIC_ID}.md"

# Track server PIDs for cleanup
BACKEND_PID=""
FRONTEND_PID=""

# ============================================================================
# CLEANUP
# ============================================================================

cleanup() {
    if [[ "$KEEP_SERVERS" == "true" ]]; then
        log "INFO" "Keeping servers running (--keep-servers)"
        return 0
    fi
    stop_servers
}

stop_servers() {
    if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        log "INFO" "Stopping backend server (PID: $BACKEND_PID)"
        kill "$BACKEND_PID" 2>/dev/null || true
        sleep 2
        kill -9 "$BACKEND_PID" 2>/dev/null || true
    fi
    if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        log "INFO" "Stopping frontend server (PID: $FRONTEND_PID)"
        kill "$FRONTEND_PID" 2>/dev/null || true
        sleep 2
        kill -9 "$FRONTEND_PID" 2>/dev/null || true
    fi
}

trap cleanup EXIT

# ============================================================================
# STATE MANAGEMENT
# ============================================================================

init_build_state() {
    cat > "$BUILD_STATE_FILE" << EOF
# V7 Post-Epic Build State
epic_id: "${EPIC_ID}"
started_at: "$(date -Iseconds)"
updated_at: "$(date -Iseconds)"

build_status: "pending"
build_attempts: []

backend_url: "${API_URL}"
backend_pid: ""
backend_status: "pending"
frontend_enabled: ${FRONTEND_ENABLED}
frontend_url: "${FRONTEND_URL}"
frontend_pid: ""
frontend_status: "$(if [[ "$FRONTEND_ENABLED" == "true" ]]; then echo "pending"; else echo "skipped"; fi)"
EOF
    log "INFO" "Created build state file: $BUILD_STATE_FILE"
}

record_build_attempt() {
    local exit_code="$1"
    local error_summary="${2:-}"
    local timestamp
    timestamp=$(date -Iseconds)

    # Append to build_attempts array in state file
    local temp_file
    temp_file=$(mktemp)
    awk -v ts="$timestamp" -v ec="$exit_code" -v es="$error_summary" '
        /^build_attempts:/ {
            print $0
            print "  - timestamp: \"" ts "\""
            print "    exit_code: " ec
            print "    error_summary: \"" es "\""
            next
        }
        {print}
    ' "$BUILD_STATE_FILE" > "$temp_file"
    mv "$temp_file" "$BUILD_STATE_FILE"
}

# ============================================================================
# BUILD PHASE
# ============================================================================

# Holds the path to the last build log (set by run_build on failure)
LAST_BUILD_LOG=""

run_build() {
    log "INFO" "Running pnpm build..."
    echo -e "${BLUE}Building monorepo...${NC}"

    LAST_BUILD_LOG="${BUILD_LOG_DIR}/pnpm-build-$(date +%H%M%S).log"

    cd "$PROJECT_ROOT"
    if pnpm build > "$LAST_BUILD_LOG" 2>&1; then
        log "SUCCESS" "Build succeeded"
        echo -e "${GREEN}Build succeeded${NC}"
        record_build_attempt 0
        return 0
    else
        local exit_code=$?
        log "ERROR" "Build failed (exit code: $exit_code)"
        echo -e "${RED}Build failed${NC}"

        # Extract error summary (last 20 lines)
        local error_summary
        error_summary=$(tail -20 "$LAST_BUILD_LOG" | tr '\n' ' ' | cut -c1-200)
        record_build_attempt "$exit_code" "$error_summary"

        return $exit_code
    fi
}

fix_build_errors() {
    local build_log="$1"
    local fix_log="${BUILD_LOG_DIR}/fix-build-$(date +%H%M%S).log"

    log "INFO" "Invoking Claude to fix build errors..."
    echo -e "${YELLOW}Asking Claude to fix build errors...${NC}"

    local prompt
    prompt="You are fixing build errors for a pnpm monorepo (Nexa ERP: TypeScript, Fastify, Prisma, PostgreSQL).

Read the build error log at: ${build_log}
Project root: ${PROJECT_ROOT}

Follow the fix-build-errors workflow instructions:
1. Parse and categorize all errors from the log
2. Read the source files that have errors
3. Fix errors in dependency order: packages/shared -> packages/db -> apps/api
4. Only fix type errors, imports, and configuration - do not change business logic
5. After fixes, run 'pnpm build' from ${PROJECT_ROOT} to verify

Output a brief summary of what you fixed."

    if run_claude_with_timeout 600 "$fix_log" -p "$prompt" --max-turns "$MAX_TURNS"; then
        log "SUCCESS" "Claude fix attempt completed"
        return 0
    else
        log "ERROR" "Claude fix attempt failed"
        return 1
    fi
}

build_with_retries() {
    local attempt=0

    while [[ $attempt -lt $MAX_BUILD_RETRIES ]]; do
        attempt=$((attempt + 1))
        log "INFO" "Build attempt $attempt of $MAX_BUILD_RETRIES"
        echo -e "${BLUE}Build attempt ${attempt}/${MAX_BUILD_RETRIES}${NC}"

        if run_build; then
            return 0
        fi

        # LAST_BUILD_LOG is set by run_build on failure
        if [[ $attempt -lt $MAX_BUILD_RETRIES ]]; then
            if [[ -f "$LAST_BUILD_LOG" ]]; then
                fix_build_errors "$LAST_BUILD_LOG" || true
            else
                log "ERROR" "No build log found to fix"
                return 1
            fi
        fi
    done

    log "ERROR" "Build failed after $MAX_BUILD_RETRIES attempts"
    echo -e "${RED}Build failed after ${MAX_BUILD_RETRIES} attempts${NC}"
    update_state_field "$BUILD_STATE_FILE" "build_status" "failed"

    # Notify
    if type notify &>/dev/null 2>&1; then
        notify "workflow_failed" "epic-${EPIC_ID}" "Build failed after ${MAX_BUILD_RETRIES} attempts"
    fi

    return 1
}

# ============================================================================
# SERVER STARTUP
# ============================================================================

start_servers() {
    log "INFO" "Starting dev servers..."
    echo -e "${BLUE}Starting dev servers...${NC}"

    cd "$PROJECT_ROOT"

    # Extract port from API URL
    local api_port="${API_URL##*:}"       # e.g. 3000 from http://localhost:3000

    # Build list of ports to clear
    local ports_to_clear=("$api_port")
    local frontend_port=""
    if [[ "$FRONTEND_ENABLED" == "true" ]]; then
        frontend_port="${FRONTEND_URL##*:}"
        ports_to_clear+=("$frontend_port")
    fi

    # Kill any existing processes on target ports to avoid EADDRINUSE
    for port in "${ports_to_clear[@]}"; do
        local existing_pids
        existing_pids=$(lsof -ti :"$port" 2>/dev/null || true)
        if [[ -n "$existing_pids" ]]; then
            log "WARN" "Port $port already in use (PIDs: $existing_pids) — killing"
            echo "$existing_pids" | xargs kill 2>/dev/null || true
            sleep 2
            # Force-kill any survivors
            existing_pids=$(lsof -ti :"$port" 2>/dev/null || true)
            if [[ -n "$existing_pids" ]]; then
                echo "$existing_pids" | xargs kill -9 2>/dev/null || true
                sleep 1
            fi
        fi
    done

    # Export environment variables from project root .env (if present)
    if [[ -f "${PROJECT_ROOT}/.env" ]]; then
        set -a
        # shellcheck disable=SC1091
        source "${PROJECT_ROOT}/.env"
        set +a
        log "INFO" "Loaded environment from ${PROJECT_ROOT}/.env"
    fi

    # Start backend (Node.js/Fastify via tsx watch)
    local backend_log="${BUILD_LOG_DIR}/backend-server.log"
    (cd "${PROJECT_ROOT}/apps/api" && PORT="$api_port" npx tsx watch src/index.ts) > "$backend_log" 2>&1 &
    BACKEND_PID=$!
    log "INFO" "Backend launched (PID: $BACKEND_PID)"

    # Start frontend (only if enabled — apps/web has a dev script)
    if [[ "$FRONTEND_ENABLED" == "true" ]]; then
        local frontend_log="${BUILD_LOG_DIR}/frontend-server.log"
        (cd "${PROJECT_ROOT}/apps/web" && PORT="$frontend_port" pnpm dev --port "$frontend_port") > "$frontend_log" 2>&1 &
        FRONTEND_PID=$!
        log "INFO" "Frontend launched (PID: $FRONTEND_PID)"
    else
        log "INFO" "Frontend not started (apps/web has no dev server yet)"
        echo -e "  ${YELLOW}Frontend skipped — apps/web is a stub${NC}"
    fi

    # Verify processes actually started (give them 3s to fail fast)
    sleep 3
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        log "ERROR" "Backend process died immediately (PID: $BACKEND_PID)"
        echo -e "  ${RED}Backend failed to start. Log:${NC}"
        tail -10 "$backend_log" 2>/dev/null | sed 's/^/    /'
        return 1
    fi
    if [[ "$FRONTEND_ENABLED" == "true" ]] && [[ -n "${FRONTEND_PID:-}" ]]; then
        if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
            log "ERROR" "Frontend process died immediately (PID: $FRONTEND_PID)"
            echo -e "  ${RED}Frontend failed to start. Log:${NC}"
            tail -10 "${BUILD_LOG_DIR}/frontend-server.log" 2>/dev/null | sed 's/^/    /'
            return 1
        fi
    fi

    # Wait for health endpoints
    wait_for_health
}

wait_for_health() {
    local elapsed=0
    local backend_ready=false
    local frontend_ready=false
    local status_code

    # If frontend is not enabled, mark it as ready immediately
    if [[ "$FRONTEND_ENABLED" != "true" ]]; then
        frontend_ready=true
    fi

    echo -e "${YELLOW}Waiting for servers to be ready (timeout: ${HEALTH_TIMEOUT}s)...${NC}"

    while [[ $elapsed -lt $HEALTH_TIMEOUT ]]; do
        # Check backend — hit /health endpoint, accept any non-000 HTTP response
        if [[ "$backend_ready" == "false" ]]; then
            status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "${API_URL}/health" 2>/dev/null || true)
            # Trim to last 3 chars in case curl concatenates redirect codes
            status_code="${status_code: -3}"
            if [[ -n "$status_code" && "$status_code" != "000" ]]; then
                backend_ready=true
                log "INFO" "Backend is ready at ${API_URL} (HTTP ${status_code})"
                echo -e "  ${GREEN}Backend ready (HTTP ${status_code})${NC}"
            fi
        fi

        # Check frontend — only if enabled
        if [[ "$FRONTEND_ENABLED" == "true" ]] && [[ "$frontend_ready" == "false" ]]; then
            status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${FRONTEND_URL}/" 2>/dev/null || true)
            status_code="${status_code: -3}"
            if [[ -n "$status_code" && "$status_code" != "000" ]]; then
                frontend_ready=true
                log "INFO" "Frontend is ready at ${FRONTEND_URL} (HTTP ${status_code})"
                echo -e "  ${GREEN}Frontend ready (HTTP ${status_code})${NC}"
            fi
        fi

        if [[ "$backend_ready" == "true" && "$frontend_ready" == "true" ]]; then
            log "SUCCESS" "All servers ready"
            echo -e "${GREEN}All servers ready${NC}"
            return 0
        fi

        sleep 2
        elapsed=$((elapsed + 2))
        echo -ne "\r  ${CYAN}Waiting... ${elapsed}s/${HEALTH_TIMEOUT}s${NC}  "
    done

    echo ""
    log "ERROR" "Server health check timed out after ${HEALTH_TIMEOUT}s"
    echo -e "${RED}Server health check timed out${NC}"

    if [[ "$backend_ready" == "false" ]]; then
        echo -e "  ${RED}Backend NOT ready at ${API_URL}${NC}"
    fi
    if [[ "$FRONTEND_ENABLED" == "true" ]] && [[ "$frontend_ready" == "false" ]]; then
        echo -e "  ${RED}Frontend NOT ready at ${FRONTEND_URL}${NC}"
    fi

    return 1
}

# ============================================================================
# REPORT GENERATION
# ============================================================================

generate_report() {
    local status="$1"

    local backend_status_str
    if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        backend_status_str="Running (PID: ${BACKEND_PID})"
    else
        backend_status_str="Not running"
    fi

    local frontend_row=""
    local frontend_pid_line="Frontend PID: skipped (not enabled)"
    if [[ "$FRONTEND_ENABLED" == "true" ]]; then
        local frontend_status_str
        if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
            frontend_status_str="Running (PID: ${FRONTEND_PID})"
        else
            frontend_status_str="Not running"
        fi
        frontend_row="| Frontend | ${FRONTEND_URL} | ${frontend_status_str} |"
        frontend_pid_line="Frontend PID: ${FRONTEND_PID:-none}"
    fi

    cat > "$REPORT_FILE" << EOF
# Build Verification Report - Epic ${EPIC_ID}

**Date**: $(date '+%Y-%m-%d %H:%M:%S')
**Status**: ${status}

## Build

- **Build status**: ${status}
- **Max retries**: ${MAX_BUILD_RETRIES}

## Servers

| Server | URL | Status |
|--------|-----|--------|
| Backend | ${API_URL} | ${backend_status_str} |
${frontend_row}

## Server PIDs

Backend PID: ${BACKEND_PID:-none}
${frontend_pid_line}

Keep servers flag: ${KEEP_SERVERS}
EOF

    log "INFO" "Report written to: $REPORT_FILE"
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    log "INFO" "Starting build verification for Epic ${EPIC_ID}"
    echo -e "\n${CYAN}======================================================${NC}"
    echo -e "${CYAN}  POST-EPIC BUILD VERIFICATION - Epic ${EPIC_ID}${NC}"
    echo -e "${CYAN}======================================================${NC}\n"

    init_build_state

    # Phase 1: Build
    if [[ "$SKIP_BUILD" == "false" ]]; then
        log_phase "1: Build Monorepo"
        if ! build_with_retries; then
            generate_report "failed"
            exit 1
        fi
        update_state_field "$BUILD_STATE_FILE" "build_status" "success"
    else
        log "INFO" "Skipping build (--skip-build)"
        echo -e "${YELLOW}Skipping build (--skip-build)${NC}"
        update_state_field "$BUILD_STATE_FILE" "build_status" "skipped"
    fi

    # Phase 2: Start servers and verify health
    log_phase "2: Start & Verify Servers"
    if ! start_servers; then
        # Try to diagnose with Claude
        local diag_log="${BUILD_LOG_DIR}/diagnose-startup-$(date +%H%M%S).log"
        log "WARN" "Server startup failed, invoking Claude to diagnose..."

        local backend_log="${BUILD_LOG_DIR}/backend-server.log"

        local frontend_context=""
        if [[ "$FRONTEND_ENABLED" == "true" ]]; then
            frontend_context="Frontend log: ${BUILD_LOG_DIR}/frontend-server.log
Frontend should serve HTML at: ${FRONTEND_URL}"
        fi

        local prompt
        prompt="Dev servers failed to start for Nexa ERP (Node.js/Fastify API). Diagnose and fix:

Backend log: ${backend_log}
${frontend_context}
Project root: ${PROJECT_ROOT}

Read the server logs, identify why servers aren't responding, fix the issue.
Backend is a Fastify API and should respond at: ${API_URL}/health"

        stop_servers
        if run_claude_with_timeout 600 "$diag_log" -p "$prompt" --max-turns "$MAX_TURNS"; then
            log "INFO" "Retrying server startup after Claude fix..."
            if ! start_servers; then
                generate_report "failed"
                exit 1
            fi
        else
            generate_report "failed"
            exit 1
        fi
    fi

    # Success - write final state and report
    generate_report "success"

    echo -e "\n${GREEN}Build verification complete${NC}"
    echo -e "  Backend:  ${API_URL}"
    if [[ "$FRONTEND_ENABLED" == "true" ]]; then
        echo -e "  Frontend: ${FRONTEND_URL}"
    else
        echo -e "  Frontend: (not enabled)"
    fi
    echo -e "  Report:   ${REPORT_FILE}"

    # Output URLs for downstream scripts to capture
    echo "BUILD_VERIFY_API_URL=${API_URL}"
    echo "BUILD_VERIFY_FRONTEND_URL=${FRONTEND_URL}"
    echo "BUILD_VERIFY_BACKEND_PID=${BACKEND_PID}"
    echo "BUILD_VERIFY_FRONTEND_PID=${FRONTEND_PID:-}"
}

main
