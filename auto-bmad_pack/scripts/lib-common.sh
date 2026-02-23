#!/bin/bash
# BMAD V7 Shared Library - Common functions for all orchestration scripts
# Source this file: source "${SCRIPT_DIR}/lib-common.sh"
#
# Provides:
#   - Color constants
#   - Path resolution (PROJECT_ROOT, PLANNING_ARTIFACTS, IMPL_ARTIFACTS, etc.)
#   - log(), log_phase(), format_duration()
#   - run_claude_with_timeout()
#   - check_and_wait_for_rate_limit()
#   - State file helpers

# Guard against double-sourcing
[[ -n "${_LIB_COMMON_LOADED:-}" ]] && return 0
_LIB_COMMON_LOADED=1

# ============================================================================
# COLORS
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# ============================================================================
# PATH RESOLUTION
# ============================================================================

# Resolve the directory where this library file is located
LIB_COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Only set PROJECT_ROOT if not already set by the calling script
if [[ -z "${PROJECT_ROOT:-}" ]]; then
    PROJECT_ROOT="$(cd "${LIB_COMMON_DIR}/../.." && pwd)"
fi

PLANNING_ARTIFACTS="${PLANNING_ARTIFACTS:-${PROJECT_ROOT}/_bmad-output/planning-artifacts}"
IMPL_ARTIFACTS="${IMPL_ARTIFACTS:-${PROJECT_ROOT}/_bmad-output/implementation-artifacts}"
TEST_ARTIFACTS="${TEST_ARTIFACTS:-${PROJECT_ROOT}/_bmad-output/test-artifacts}"
LOG_DIR="${LOG_DIR:-${PROJECT_ROOT}/logs/workflow}"
STATE_DIR="${STATE_DIR:-${LOG_DIR}/orchestrator-state}"

# ============================================================================
# LOGGING
# ============================================================================

# WORKFLOW_LOG must be set by the calling script before calling log()
log() {
    local level="$1"
    local message="$2"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    if [[ -n "${WORKFLOW_LOG:-}" ]]; then
        echo -e "${timestamp} [${level}] ${message}" | tee -a "$WORKFLOW_LOG"
    else
        echo -e "${timestamp} [${level}] ${message}"
    fi
}

log_phase() {
    echo -e "\n${CYAN}======================================================${NC}"
    echo -e "${CYAN}  PHASE: $1${NC}"
    echo -e "${CYAN}======================================================${NC}\n"
    log "PHASE" "$1"
}

format_duration() {
    local total_secs="$1"
    local hours=$((total_secs / 3600))
    local mins=$(((total_secs % 3600) / 60))
    local secs=$((total_secs % 60))

    if [[ $hours -gt 0 ]]; then
        echo "${hours}h ${mins}m ${secs}s"
    elif [[ $mins -gt 0 ]]; then
        echo "${mins}m ${secs}s"
    else
        echo "${secs}s"
    fi
}

# ============================================================================
# CLAUDE EXECUTION WITH TIMEOUT
# ============================================================================
# Usage: run_claude_with_timeout <timeout_secs> <log_file> <claude_args...>
# Returns: exit code from claude (or 124 if timed out, 125 if stale)

run_claude_with_timeout() {
    local timeout_secs="$1"
    local log_file="$2"
    shift 2

    # Use gtimeout if available (macOS with coreutils), fallback to timeout, fallback to no timeout
    local timeout_cmd=""
    if command -v gtimeout &>/dev/null; then
        timeout_cmd="gtimeout --signal=TERM --kill-after=30 ${timeout_secs}"
    elif command -v timeout &>/dev/null; then
        timeout_cmd="timeout --signal=TERM --kill-after=30 ${timeout_secs}"
    fi

    # Unset CLAUDECODE to allow nested Claude sessions when launched from within Claude Code
    unset CLAUDECODE 2>/dev/null || true

    if [[ -n "$timeout_cmd" ]]; then
        $timeout_cmd claude --model opus --dangerously-skip-permissions "$@" > "$log_file" 2>&1
        local exit_code=$?
        if [[ $exit_code -eq 124 ]]; then
            log "WARN" "Claude process timed out after ${timeout_secs}s"
        fi

        # Check for rate limit - if hit, wait and retry
        if grep -q "You've hit your limit" "$log_file" 2>/dev/null; then
            check_and_wait_for_rate_limit "$log_file"
            log "INFO" "Retrying command after rate limit wait"
            $timeout_cmd claude --model opus --dangerously-skip-permissions "$@" > "$log_file" 2>&1
            exit_code=$?
        fi

        return $exit_code
    else
        # No timeout command available - use background + staleness watchdog
        local stale_limit=600  # 10 minutes of no output = stale
        local start_seconds=$SECONDS
        claude --model opus --dangerously-skip-permissions "$@" > "$log_file" 2>&1 &
        local pid=$!
        local last_size=0
        local stale_secs=0

        while kill -0 "$pid" 2>/dev/null; do
            sleep 30
            local cur_size
            cur_size=$(stat -f%z "$log_file" 2>/dev/null || echo 0)
            if [[ "$cur_size" == "$last_size" ]]; then
                stale_secs=$((stale_secs + 30))
                if [[ $stale_secs -ge $stale_limit ]]; then
                    log "WARN" "Claude process stale for ${stale_secs}s, killing PID $pid"
                    kill "$pid" 2>/dev/null
                    sleep 5
                    kill -9 "$pid" 2>/dev/null
                    wait "$pid" 2>/dev/null
                    return 125  # Custom code for staleness kill
                fi
            else
                stale_secs=0
                last_size=$cur_size
            fi

            # Also enforce hard timeout
            local elapsed=$((SECONDS - start_seconds))
            if [[ $elapsed -ge $timeout_secs ]]; then
                log "WARN" "Claude process exceeded hard timeout of ${timeout_secs}s, killing PID $pid"
                kill "$pid" 2>/dev/null
                sleep 5
                kill -9 "$pid" 2>/dev/null
                wait "$pid" 2>/dev/null
                return 124
            fi
        done
        wait "$pid"
        local exit_code=$?

        # Check for rate limit - if hit, wait and retry
        if grep -q "You've hit your limit" "$log_file" 2>/dev/null; then
            check_and_wait_for_rate_limit "$log_file"
            log "INFO" "Retrying command after rate limit wait"
            run_claude_with_timeout "$timeout_secs" "$log_file" "$@"
            return $?
        fi

        return $exit_code
    fi
}

# ============================================================================
# RATE LIMIT DETECTION & WAITING
# ============================================================================
# Detects "You've hit your limit . resets Xam/pm (Timezone)" and waits until reset

check_and_wait_for_rate_limit() {
    local log_file="$1"

    if ! grep -q "You've hit your limit" "$log_file" 2>/dev/null; then
        return 0
    fi

    local reset_info
    reset_info=$(grep "You've hit your limit" "$log_file" | head -1 | sed -n 's/.*resets \([0-9]*[ap]m\) (\([^)]*\)).*/\1 \2/p')

    if [[ -z "$reset_info" ]]; then
        log "ERROR" "Rate limit detected but couldn't parse reset time"
        echo -e "${RED}Rate limit hit - could not parse reset time. Waiting 1 hour...${NC}"
        sleep 3600
        return 0
    fi

    local reset_time
    reset_time=$(echo "$reset_info" | awk '{print $1}')
    local timezone
    timezone=$(echo "$reset_info" | awk '{print $2}')

    log "WARN" "RATE LIMIT HIT - resets at $reset_time ($timezone)"
    echo -e "\n${RED}CLAUDE CODE RATE LIMIT HIT${NC}"
    echo -e "${YELLOW}  Limit resets at: ${CYAN}$reset_time ($timezone)${NC}"

    # Send Slack notification if notify is loaded
    if type send_slack_notification &>/dev/null 2>&1; then
        send_slack_notification "simple" "Rate limit hit - paused until $reset_time ($timezone)"
    elif type notify &>/dev/null 2>&1; then
        notify "session_limit" "rate-limit" "Paused until $reset_time ($timezone)"
    fi

    # Convert reset time to 24h format
    local reset_hour
    local am_pm="${reset_time: -2}"
    local hour_num="${reset_time%[ap]m}"

    if [[ "$am_pm" == "am" ]]; then
        if [[ "$hour_num" == "12" ]]; then
            reset_hour=0
        else
            reset_hour=$hour_num
        fi
    else
        if [[ "$hour_num" == "12" ]]; then
            reset_hour=12
        else
            reset_hour=$((hour_num + 12))
        fi
    fi

    local current_epoch=""
    local reset_epoch=""

    if command -v gdate &>/dev/null; then
        current_epoch=$(gdate +%s)
        reset_epoch=$(TZ="$timezone" gdate -d "today ${reset_hour}:00" +%s 2>/dev/null || echo "")
        if [[ -n "$reset_epoch" ]] && [[ $reset_epoch -le $current_epoch ]]; then
            reset_epoch=$(TZ="$timezone" gdate -d "tomorrow ${reset_hour}:00" +%s 2>/dev/null || echo "")
        fi
    fi

    if [[ -z "$reset_epoch" ]] || [[ "$reset_epoch" == "" ]]; then
        local current_hour
        current_hour=$(date +%H)
        local wait_hours
        if [[ $reset_hour -gt $current_hour ]]; then
            wait_hours=$((reset_hour - current_hour))
        else
            wait_hours=$((24 - current_hour + reset_hour))
        fi
        local wait_secs=$((wait_hours * 3600))
        echo -e "${YELLOW}  Waiting approximately ${wait_hours} hours...${NC}"
        log "INFO" "Rate limit: waiting ${wait_hours} hours (${wait_secs} seconds)"

        local waited=0
        while [[ $waited -lt $wait_secs ]]; do
            local remaining=$((wait_secs - waited))
            local remaining_mins=$((remaining / 60))
            echo -ne "\r${CYAN}  Rate limit reset in: ${remaining_mins} minutes remaining...${NC}  "
            sleep 300
            waited=$((waited + 300))
        done
        echo ""
    else
        local wait_secs=$((reset_epoch - current_epoch + 60))
        local wait_mins=$((wait_secs / 60))
        local wait_hours=$((wait_mins / 60))
        local remaining_mins=$((wait_mins % 60))

        echo -e "${YELLOW}  Waiting ${wait_hours}h ${remaining_mins}m until reset...${NC}"
        log "INFO" "Rate limit: waiting ${wait_secs} seconds"

        local waited=0
        while [[ $waited -lt $wait_secs ]]; do
            local remaining=$((wait_secs - waited))
            local remaining_mins=$((remaining / 60))
            local remaining_hours=$((remaining_mins / 60))
            remaining_mins=$((remaining_mins % 60))
            echo -ne "\r${CYAN}  Rate limit reset in: ${remaining_hours}h ${remaining_mins}m   ${NC}"
            sleep 300
            waited=$((waited + 300))
        done
        echo ""
    fi

    echo -e "${GREEN}Rate limit should be reset - resuming${NC}"
    log "INFO" "Rate limit wait complete - resuming"

    if type send_slack_notification &>/dev/null 2>&1; then
        send_slack_notification "simple" "Rate limit reset - resuming"
    elif type notify &>/dev/null 2>&1; then
        notify "workflow_complete" "rate-limit" "Rate limit reset - resuming"
    fi

    return 0
}

# ============================================================================
# DIRECTORY SETUP HELPERS
# ============================================================================

ensure_test_dirs() {
    local epic_id="$1"
    mkdir -p "$TEST_ARTIFACTS"
    mkdir -p "${TEST_ARTIFACTS}/screenshots/epic-${epic_id}"
    mkdir -p "$LOG_DIR"
    mkdir -p "$STATE_DIR"
}

# ============================================================================
# STATE FILE HELPERS (generic YAML state management)
# ============================================================================

# Update a key in a YAML state file. Supports "parent.child" notation (2 levels only).
# For simple values only - does not handle multi-line YAML values.
# Returns 0 on success, 1 on failure (non-fatal - callers should use `|| true` under set -e).
update_state_field() {
    local state_file="$1"
    local key="$2"
    local value="$3"

    if [[ ! -f "$state_file" ]]; then
        return 0  # Non-fatal: state file may not exist yet
    fi

    # Format value: quote strings, leave numbers unquoted
    local formatted_value
    if [[ "$value" =~ ^[0-9]+$ ]]; then
        formatted_value="$value"
    else
        formatted_value="\"${value}\""
    fi

    if [[ "$key" == *.* ]]; then
        local parent="${key%%.*}"
        local child="${key#*.}"
        # Match indented child key within parent section (stops at next top-level key)
        sed -i.bak "/^${parent}:/,/^[^ ]/s|^  ${child}:.*|  ${child}: ${formatted_value}|" "$state_file"
    else
        if grep -q "^${key}:" "$state_file"; then
            sed -i.bak "s|^${key}:.*|${key}: ${formatted_value}|" "$state_file"
        fi
    fi

    # Update timestamp if the field exists
    if grep -q "^updated_at:" "$state_file" 2>/dev/null; then
        sed -i.bak "s|^updated_at:.*|updated_at: \"$(date -Iseconds)\"|" "$state_file"
    fi
    rm -f "${state_file}.bak"
}
