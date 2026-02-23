#!/bin/bash
# V6 Story Workflow - Executes full BMAD V6 story lifecycle
# Usage: ./v6-story-workflow.sh <story-id> [options]
#
# Options:
#   --skip-at          Skip ATDD step
#   --skip-rv          Skip final Test Review step
#   --skip-cs          Skip Create Story step (resume from existing)
#   --start-task N     Start development from task N (skips 1 to N-1)
#   --max-turns N      Max turns per Claude session (default: 50)
#   --max-cr-loops N   Max DEV-CR loop iterations (default: 3)
#   --resume           Force resume from saved state (even if stale)
#   --fresh            Start fresh, ignore any saved state
#
# RESUME FEATURE:
# The workflow automatically saves state after each major step. If interrupted:
#   - Running the same story again will auto-detect and resume from last step
#   - State is saved in: logs/workflow/<story-id>-resume-state.txt
#   - Use --fresh to ignore saved state and start over
#   - State expires after 7 days (auto-starts fresh)
#
# V6 Flow (with DEV-CR loop):
#   1. SM  create-story       - Create detailed story from epic
#   2. TEA atdd               - Write failing acceptance tests (optional)
#   3. DEV-CR LOOP (max 3 iterations):
#      ITERATION 1:
#        a. DEV dev-story     - Implement tasks (ONE TASK AT A TIME, each in NEW session)
#        b. DEV code-review   - Adversarial review (auto-selects option 2: add issues to story)
#      ITERATION 2+ (if CR found issues):
#        a. DEV fix-issues    - Fix ALL [AI-Review] issues (fresh session)
#        b. TEA test-review   - Verify fixes with test review
#        c. Check if DONE     - If all issues fixed → mark DONE and EXIT EARLY
#        d. DEV code-review   - Re-review (only if issues remain)
#      EXIT CONDITIONS:
#        - All issues fixed after test-review → mark DONE, exit loop
#        - CR PASS → exit loop
#        - CR MAJOR_REWORK → abort (human review)
#   4. TEA test-review        - Final test quality review (optional)
#   5. Mark DONE              - Update story status
#
# Each step runs in a fresh Claude Code session with auto-accept permissions
# Story files are the shared state between sessions
#
# CONTEXT WINDOW HANDLING:
# The CLI with -p (print mode) does NOT auto-compact, so we:
# 1. Use --max-turns to limit each session (default 50)
# 2. Split DS (develop) into per-task sessions - EACH TASK IN NEW CHAT/SESSION
# 3. Fix-issues runs in fresh session separate from dev tasks
# 4. Each step is isolated to prevent context overflow
#
# RATE LIMIT HANDLING (Claude Max/Pro Subscription):
# Session limit (5-hour rolling reset):
#   - Auto-waits and retries every 5 minutes
#   - Maximum 60 retries (5 hours of waiting)
#   - Resumes automatically when limit resets
#
# Weekly limit (fixed reset time):
#   - Notifies user with instructions to check reset time
#   - Saves pause state for manual resume
#   - Does NOT auto-wait (could be days)
#
# Step Validation:
# - After CS: Story file must exist with tasks defined
# - After DS: Tasks must have [x] completions
# - After CR: Session resumes to fix issues if found

set -e  # Exit on error

# Load notification system
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/notify.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
STORY_ID="${1:?Usage: $0 <story-id> [--skip-at] [--skip-rv] [--skip-cs] [--start-task N] [--max-turns N] [--max-cr-loops N] [--resume] [--fresh]}"
SKIP_AT=false
SKIP_RV=false
SKIP_CS=false
START_TASK=1  # Default: start from task 1
MAX_TURNS=50  # Default: limit each session to 50 turns to avoid context overflow
MAX_CR_LOOPS=3  # Default: max 3 DEV-CR iterations before failing
RESUME_MODE=auto  # auto=resume if state exists, force=always resume, fresh=ignore state
# Project root detection - prefer git root, fall back to relative path
# Using git root ensures we always find the correct project directory
if git rev-parse --show-toplevel >/dev/null 2>&1; then
    PROJECT_ROOT="$(git rev-parse --show-toplevel)"
else
    # Fallback: two levels up from scripts dir (auto-bmad_pack/scripts -> urban-brain-mvp)
    PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
fi
AUTO_BMAD_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
IMPL_ARTIFACTS="${PROJECT_ROOT}/_bmad-output/implementation-artifacts"
# Log directory - per-story subdirectory for better organization
LOG_BASE_DIR="${AUTO_BMAD_DIR}/logs/workflow"
LOG_DIR="${LOG_BASE_DIR}/${STORY_ID}"

# V6 Skill paths (full workflow paths)
SKILL_CREATE_STORY="/bmad:bmm:workflows:create-story"
SKILL_DEV_STORY="/bmad:bmm:workflows:dev-story"
SKILL_CODE_REVIEW="/bmad:bmm:workflows:code-review"
SKILL_ATDD="/bmad:bmm:workflows:testarch-atdd"
SKILL_TEST_REVIEW="/bmad:bmm:workflows:testarch-test-review"
SKILL_SPRINT_STATUS="/bmad:bmm:workflows:sprint-status"

# ============================================================================
# RESUME STATE MANAGEMENT
# ============================================================================
# State is saved after each major step to allow resuming on failure
# State file format (simple key=value):
#   STEP=<1-5>           # 1=CS, 2=AT, 3=DEV-CR, 4=RV, 5=DONE
#   CR_ITERATION=<1-3>   # Which DEV-CR loop iteration
#   CURRENT_TASK=<1-N>   # Which task we're on (or completed up to)
#   PHASE=<dev|cr|fix|test-review>  # Phase within DEV-CR loop
#   LAST_UPDATE=<timestamp>
# ============================================================================

# State file path (created after LOG_DIR is set)
get_state_file() {
    echo "${LOG_DIR}/${STORY_ID}-resume-state.txt"
}

# Save current workflow state for resume
save_state() {
    local step="$1"           # 1-5
    local cr_iteration="$2"   # 1-3 (0 if not in CR loop)
    local current_task="$3"   # task number (0 if not in task loop)
    local phase="$4"          # dev, cr, fix, test-review, or empty

    local state_file=$(get_state_file)

    cat > "$state_file" << EOF
# V6 Story Workflow Resume State
# Story: ${STORY_ID}
# Last updated: $(date -Iseconds)

STEP=${step}
CR_ITERATION=${cr_iteration:-0}
CURRENT_TASK=${current_task:-0}
PHASE=${phase:-none}
STORY_FILE="${STORY_FILE:-}"
LAST_UPDATE=$(date +%s)
EOF

    log "INFO" "State saved: step=$step, cr_iter=$cr_iteration, task=$current_task, phase=$phase"
}

# Load previous workflow state
# Returns 0 if state exists and is valid, 1 otherwise
# Sets global variables: RESUME_STEP, RESUME_CR_ITER, RESUME_TASK, RESUME_PHASE
load_state() {
    local state_file=$(get_state_file)

    if [[ ! -f "$state_file" ]]; then
        return 1
    fi

    # Source the state file (it's just key=value pairs)
    # shellcheck disable=SC1090
    source "$state_file" 2>/dev/null || return 1

    # Validate required fields
    if [[ -z "$STEP" ]]; then
        return 1
    fi

    # Export to RESUME_ prefixed variables
    RESUME_STEP="$STEP"
    RESUME_CR_ITER="${CR_ITERATION:-0}"
    RESUME_TASK="${CURRENT_TASK:-0}"
    RESUME_PHASE="${PHASE:-none}"
    RESUME_STORY_FILE="${STORY_FILE:-}"

    # Check if state is stale (older than 7 days)
    local now=$(date +%s)
    local age=$((now - ${LAST_UPDATE:-0}))
    local max_age=$((7 * 24 * 60 * 60))  # 7 days in seconds

    if [[ $age -gt $max_age ]]; then
        log "WARN" "Resume state is stale (${age}s old) - will start fresh"
        return 1
    fi

    return 0
}

# Clear state file (called on successful completion)
clear_state() {
    local state_file=$(get_state_file)
    if [[ -f "$state_file" ]]; then
        rm -f "$state_file"
        log "INFO" "Resume state cleared"
    fi
}

# Display resume information
show_resume_info() {
    local state_file=$(get_state_file)

    if ! load_state; then
        echo -e "${BLUE}No previous state found - starting fresh${NC}"
        return 1
    fi

    local step_name
    case "$RESUME_STEP" in
        1) step_name="CS (Create Story)" ;;
        2) step_name="AT (ATDD)" ;;
        3) step_name="DEV-CR Loop (iteration $RESUME_CR_ITER, phase: $RESUME_PHASE, task: $RESUME_TASK)" ;;
        4) step_name="RV (Test Review)" ;;
        5) step_name="DONE" ;;
        *) step_name="Unknown" ;;
    esac

    local state_age=""
    if [[ -f "$state_file" ]]; then
        local file_time=$(stat -f %m "$state_file" 2>/dev/null || stat -c %Y "$state_file" 2>/dev/null)
        local now=$(date +%s)
        local age_secs=$((now - file_time))
        local age_mins=$((age_secs / 60))
        local age_hours=$((age_mins / 60))

        if [[ $age_hours -gt 0 ]]; then
            state_age="${age_hours}h ${age_mins}m ago"
        elif [[ $age_mins -gt 0 ]]; then
            state_age="${age_mins}m ago"
        else
            state_age="${age_secs}s ago"
        fi
    fi

    echo -e "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  📂 RESUME STATE FOUND                                     ║${NC}"
    echo -e "${YELLOW}╠════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${YELLOW}║  Story: ${STORY_ID}${NC}"
    echo -e "${YELLOW}║  Last step: ${step_name}${NC}"
    echo -e "${YELLOW}║  Saved: ${state_age}${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"

    return 0
}

# Token tracking configuration
# Claude session files are stored here - we parse them for real token counts
# Dynamically construct the path: ~/.claude/projects/<path-with-dashes>
# PROJECT_ROOT like /Users/mfh/foo/bar becomes -Users-mfh-foo-bar
# Claude encodes: slashes->dashes, spaces->dashes, underscores->dashes
CLAUDE_SESSIONS_DIR="${HOME}/.claude/projects/$(echo "$PROJECT_ROOT" | sed 's|[/ _]|-|g')"
TOKEN_WARN_THRESHOLD=150000   # Warn when context exceeds 150K tokens
TOKEN_ABORT_THRESHOLD=180000  # Abort when context exceeds 180K tokens (leaves buffer before 200K)

# Session tracking for resume capability
CR_SESSION_ID=""
STORY_FILE=""
LAST_SESSION_ID=""  # For continuation between task sessions

# ============================================================================
# SUBSCRIPTION LIMIT HANDLING (Claude Max/Pro)
# ============================================================================
# Session limit: Resets every 5 hours (rolling window)
# Weekly limit: Resets at specific day/time
# ============================================================================

# Check if we hit a subscription usage limit
check_subscription_limit() {
    local log_file="$1"

    # Check for session limit patterns
    if grep -qiE "usage limit|limit reached|rate limit|try again|session limit|exceeded.*limit" "$log_file" 2>/dev/null; then
        # Try to determine if it's session or weekly limit
        if grep -qiE "weekly|week" "$log_file" 2>/dev/null; then
            return 2  # Weekly limit
        fi
        return 1  # Session limit (5-hour reset)
    fi
    return 0  # No limit hit
}

# Check for transient errors that should be retried
# These are temporary API/network errors, not rate limits
check_transient_error() {
    local log_file="$1"

    # Patterns for transient errors that warrant automatic retry
    # Added: "API Error.*Connection" and "Connection error" for internet outages
    if grep -qiE "No messages returned|connection.*reset|Connection error|API Error.*[Cc]onnection|timeout|ECONNRESET|socket hang up|network.*error|request failed|500 Internal|502 Bad Gateway|503 Service|504 Gateway|fetch failed|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH" "$log_file" 2>/dev/null; then
        return 0  # Is a transient error - should retry
    fi
    return 1  # Not a transient error
}

# Check if Claude produced valid output (not just an error message)
# Returns 0 if output is valid, 1 if output is empty/error-only
validate_claude_output() {
    local log_file="$1"
    local min_lines="${2:-5}"  # Minimum lines for valid output (default 5)

    if [[ ! -f "$log_file" ]]; then
        return 1
    fi

    # Check file size - valid Claude output should be more than a few bytes
    local file_size=$(wc -c < "$log_file" | tr -d ' ')
    if [[ "$file_size" -lt 100 ]]; then
        log "WARN" "Output too small (${file_size} bytes) - likely failed"
        return 1
    fi

    # Check for error-only output
    if check_transient_error "$log_file"; then
        log "WARN" "Output contains transient error"
        return 1
    fi

    # Check line count - valid output should have multiple lines of content
    local line_count=$(wc -l < "$log_file" | tr -d ' ')
    if [[ "$line_count" -lt "$min_lines" ]]; then
        log "WARN" "Output too short (${line_count} lines) - may have failed"
        return 1
    fi

    return 0
}

# Check if Claude hit max turns limit
# Returns 0 if max turns was hit, 1 otherwise
check_max_turns_error() {
    local log_file="$1"
    if grep -q "Reached max turns" "$log_file" 2>/dev/null; then
        return 0  # Max turns was hit
    fi
    return 1
}

# Get dynamic turn limit based on task complexity (subtask count)
# More subtasks = more turns needed
get_task_turn_limit() {
    local task_num="$1"

    if [[ -z "$STORY_FILE" || ! -f "$STORY_FILE" ]]; then
        echo "$MAX_TURNS"
        return
    fi

    # Count subtasks for this task (lines starting with "  - [" after "Task N:")
    local subtask_count=$(grep -A100 "Task ${task_num}:" "$STORY_FILE" 2>/dev/null | \
        grep -m1 -B100 "^\- \[.\] \*\*Task" | \
        grep -c "^  - \[" 2>/dev/null || echo 5)

    # Base 30 turns + 10 per subtask, minimum MAX_TURNS, capped at 150
    local turns=$((30 + subtask_count * 10))
    [[ $turns -lt $MAX_TURNS ]] && turns=$MAX_TURNS
    [[ $turns -gt 150 ]] && turns=150

    log "INFO" "Task $task_num has ~$subtask_count subtasks, using $turns turns"
    echo "$turns"
}

# Max turns retry configuration
MAX_TURNS_RETRY_MULTIPLIER=2  # Double the turns on retry
MAX_TURNS_MAX_RETRIES=1       # Only retry once with more turns

# Transient error retry configuration
TRANSIENT_RETRY_DELAY=30     # Wait 30 seconds before retry
TRANSIENT_MAX_RETRIES=3      # Max 3 retries for transient errors

# Retry a function on transient error
handle_transient_error() {
    local step_name="$1"
    local retry_func="$2"
    local retry_args="$3"
    local step_log="${LOG_DIR}/${STORY_ID}-${step_name}.log"

    local retry_count=0

    while [[ $retry_count -lt $TRANSIENT_MAX_RETRIES ]]; do
        ((retry_count++))

        echo -e "${YELLOW}  ⚠ Transient error detected. Retry ${retry_count}/${TRANSIENT_MAX_RETRIES} in ${TRANSIENT_RETRY_DELAY}s...${NC}"
        log "WARN" "Transient error for $step_name - retry ${retry_count}/${TRANSIENT_MAX_RETRIES}"

        sleep "$TRANSIENT_RETRY_DELAY"

        echo -e "${CYAN}  🔄 Retrying $step_name...${NC}"

        if $retry_func $retry_args; then
            log "SUCCESS" "$step_name succeeded on retry ${retry_count}"
            return 0
        fi

        # Check if new error is also transient
        if ! check_transient_error "$step_log"; then
            # Different type of error - stop retrying
            log "ERROR" "$step_name failed with non-transient error after retry ${retry_count}"
            return 1
        fi
    done

    log "ERROR" "$step_name failed after ${TRANSIENT_MAX_RETRIES} transient error retries"
    return 1
}

# Session limit retry configuration
# Retry every 5 minutes (short enough to resume quickly after reset)
# Max retries: 60 (covers 5 hours = 300 minutes, at 5 min intervals)
SESSION_RETRY_INTERVAL=300  # 5 minutes in seconds
SESSION_MAX_RETRIES=60      # 60 retries * 5 min = 5 hours coverage

# Get retry interval for session limit
get_session_retry_interval() {
    echo "$SESSION_RETRY_INTERVAL"
}

# Handle session limit - auto-wait and retry
# This keeps retrying every 5 minutes until session resets (up to 5 hours)
handle_session_limit() {
    local step_name="$1"
    local retry_func="$2"
    local retry_args="$3"

    local wait_seconds=$(get_session_retry_interval)
    local wait_minutes=$((wait_seconds / 60))

    echo -e "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  SESSION LIMIT REACHED                                     ║${NC}"
    echo -e "${YELLOW}║  Session resets every 5 hours (rolling window)             ║${NC}"
    echo -e "${YELLOW}║  Auto-waiting and will retry every ${wait_minutes} minutes...             ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"

    log "WARN" "Session limit reached for $step_name - entering wait loop (retry every ${wait_minutes} min)"

    local retry_count=0

    while [[ $retry_count -lt $SESSION_MAX_RETRIES ]]; do
        ((retry_count++))
        local elapsed_mins=$((retry_count * wait_minutes))

        echo -e "${CYAN}Retry ${retry_count}/${SESSION_MAX_RETRIES} - Waiting ${wait_minutes} minutes (${elapsed_mins} min total)...${NC}"
        log "INFO" "Waiting ${wait_minutes} minutes (retry ${retry_count}/${SESSION_MAX_RETRIES}, ${elapsed_mins} min elapsed)"

        # Show countdown every minute
        local remaining=$wait_seconds
        while [[ $remaining -gt 0 ]]; do
            local mins_left=$((remaining / 60))
            local secs_left=$((remaining % 60))
            printf "\r${BLUE}  ⏳ Time until retry: %d:%02d${NC}    " "$mins_left" "$secs_left"
            sleep 30
            ((remaining -= 30))
        done
        echo ""

        echo -e "${CYAN}🔄 Retrying $step_name...${NC}"
        log "INFO" "Retrying $step_name after ${wait_minutes} min wait"

        # Retry the step - return success if it works
        if $retry_func $retry_args; then
            echo -e "${GREEN}✓ Retry successful after ${elapsed_mins} minutes wait${NC}"
            log "SUCCESS" "$step_name succeeded after retry ${retry_count} (${elapsed_mins} min total)"
            return 0
        fi

        # Check if still rate limited
        local latest_log="${LOG_DIR}/${STORY_ID}-${step_name}.log"
        check_subscription_limit "$latest_log"
        local limit_status=$?

        if [[ $limit_status -eq 0 ]]; then
            # Different error, not rate limit - fail
            echo -e "${RED}Step failed with non-rate-limit error${NC}"
            return 1
        elif [[ $limit_status -eq 2 ]]; then
            # Weekly limit - can't auto-wait
            handle_weekly_limit "$step_name"
            return 1
        fi
        # Still session limited, continue waiting
        echo -e "${YELLOW}Still rate limited. Continuing to wait...${NC}"
    done

    local total_wait=$((SESSION_MAX_RETRIES * wait_minutes))
    echo -e "${RED}Max retries reached after ${total_wait} minutes. Manual intervention needed.${NC}"
    log "ERROR" "Max retries reached for $step_name after ${total_wait} min"
    return 1
}

# Handle weekly limit - notify only (wait could be days)
handle_weekly_limit() {
    local step_name="${1:-unknown}"

    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  🚫 WEEKLY LIMIT REACHED                                   ║${NC}"
    echo -e "${RED}║                                                            ║${NC}"
    echo -e "${RED}║  Weekly limits reset at a specific day/time.               ║${NC}"
    echo -e "${RED}║  Check your Claude subscription status for reset time.     ║${NC}"
    echo -e "${RED}║                                                            ║${NC}"
    echo -e "${RED}║  How to check reset time:                                  ║${NC}"
    echo -e "${RED}║    1. Run: claude (interactive mode)                       ║${NC}"
    echo -e "${RED}║    2. Look at status bar or run /status                    ║${NC}"
    echo -e "${RED}║                                                            ║${NC}"
    echo -e "${RED}║  Workflow paused at: ${step_name}                          ║${NC}"
    echo -e "${RED}║  Resume manually when limit resets.                        ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"

    log "ERROR" "Weekly limit reached at $step_name - manual intervention required"

    # Save current progress for resume
    local pause_file="${LOG_DIR}/${STORY_ID}-pause-state.txt"
    cat > "$pause_file" << EOF
PAUSED_AT=$(date -Iseconds)
REASON=weekly_limit
STEP_NAME=${step_name}
STORY_ID=${STORY_ID}
STORY_FILE="${STORY_FILE}"
PROJECT_ROOT="${PROJECT_ROOT}"
EOF

    # Send Slack notification
    notify_weekly_limit "$STORY_ID" "$step_name"

    echo -e "${YELLOW}Progress saved to: ${pause_file}${NC}"
    echo -e "${YELLOW}Slack notification sent.${NC}"
    echo -e "${YELLOW}To resume later, run the workflow again or continue from ${step_name}${NC}"
}

# Parse optional flags
shift
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-at) SKIP_AT=true; shift ;;
        --skip-rv) SKIP_RV=true; shift ;;
        --skip-cs) SKIP_CS=true; shift ;;
        --start-task) START_TASK="$2"; shift 2 ;;
        --max-turns) MAX_TURNS="$2"; shift 2 ;;
        --max-cr-loops) MAX_CR_LOOPS="$2"; shift 2 ;;
        --resume) RESUME_MODE=force; shift ;;
        --fresh) RESUME_MODE=fresh; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Create log directory
mkdir -p "$LOG_DIR"
WORKFLOW_LOG="${LOG_DIR}/${STORY_ID}-$(date +%Y%m%d-%H%M%S).log"

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$WORKFLOW_LOG"
}

log_step() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  STEP: $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    log "STEP" "$1"
}

# Internal function to execute a single Claude step (no retry logic)
_execute_claude_step() {
    local skill="$1"
    local story_id="$2"
    local step_name="$3"
    local step_log="${LOG_DIR}/${STORY_ID}-${step_name}.log"

    # Build the prompt - slash command on its own, story ID as input
    local prompt="${skill}
${story_id}"

    # Run Claude Code
    if (cd "$PROJECT_ROOT" && claude -p --dangerously-skip-permissions --max-turns "$MAX_TURNS" "$prompt") > "$step_log" 2>&1; then
        return 0
    else
        return $?
    fi
}

# Run Claude Code with a specific workflow and story ID
# Returns exit code from Claude
# Uses --max-turns to prevent context overflow in print mode
# Includes rate limit detection, auto-retry, and token tracking
run_claude_step() {
    local skill="$1"
    local story_id="$2"
    local step_name="$3"
    local step_log="${LOG_DIR}/${STORY_ID}-${step_name}.log"

    log "INFO" "Running: $skill with story $story_id (max-turns: $MAX_TURNS)"

    # Slash command on its own line, story ID as input
    local prompt="${skill}
${story_id}"

    log "INFO" "Prompt: $prompt"
    echo -e "${YELLOW}Running Claude Code (max $MAX_TURNS turns)...${NC}"

    # Execute the step
    _execute_claude_step "$skill" "$story_id" "$step_name"
    local exit_code=$?

    # IMPORTANT: Claude CLI may return exit code 0 even on connection errors
    # Always validate the output content regardless of exit code
    if ! validate_claude_output "$step_log"; then
        log "WARN" "$step_name exit code was $exit_code but output validation failed"
        # Treat as transient error and continue to error handling below
        exit_code=1
    fi

    if [[ $exit_code -eq 0 ]]; then
        # Success - get real token usage from session files
        local context_est=$(estimate_context_from_log "$step_log")
        log_token_usage "$step_name"

        log "SUCCESS" "$step_name completed [$context_est]"
        echo -e "${GREEN}✓ $step_name completed${NC} ${BLUE}[$context_est]${NC}"

        # Show last 5 lines of output for visibility
        echo -e "${BLUE}Last output:${NC}"
        tail -5 "$step_log" | sed 's/^/  /'

        # Check context threshold
        check_context_threshold
        local threshold_status=$?
        if [[ $threshold_status -eq 2 ]]; then
            log "ERROR" "Aborting workflow due to context overflow"
            return 99
        fi

        return 0
    fi

    # Step failed - check if it's a rate limit
    log "ERROR" "$step_name failed with exit code $exit_code"

    # Check for subscription limit
    check_subscription_limit "$step_log"
    local limit_status=$?

    if [[ $limit_status -eq 1 ]]; then
        # Session limit - auto-wait and retry
        echo -e "${YELLOW}Detected session rate limit. Entering auto-retry mode...${NC}"
        if handle_session_limit "$step_name" "_execute_claude_step" "$skill $command $step_name"; then
            # Retry succeeded - get token usage
            local context_est=$(estimate_context_from_log "$step_log")
            log_token_usage "$step_name"

            log "SUCCESS" "$step_name completed after rate limit wait [$context_est]"
            echo -e "${GREEN}✓ $step_name completed (after rate limit wait)${NC} ${BLUE}[$context_est]${NC}"
            echo -e "${BLUE}Last output:${NC}"
            tail -5 "$step_log" | sed 's/^/  /'

            # Check context threshold
            check_context_threshold
            if [[ $? -eq 2 ]]; then
                return 99
            fi
            return 0
        else
            return 1
        fi
    elif [[ $limit_status -eq 2 ]]; then
        # Weekly limit - notify and pause
        handle_weekly_limit "$step_name"
        return 1
    fi

    # Check for transient errors (network issues, API errors, "No messages returned")
    if check_transient_error "$step_log"; then
        echo -e "${YELLOW}Detected transient error. Attempting automatic retry...${NC}"
        if handle_transient_error "$step_name" "_execute_claude_step" "$skill $story_id $step_name"; then
            local context_est=$(estimate_context_from_log "$step_log")
            log_token_usage "$step_name"
            log "SUCCESS" "$step_name completed after transient error retry [$context_est]"
            echo -e "${GREEN}✓ $step_name completed (after retry)${NC} ${BLUE}[$context_est]${NC}"
            echo -e "${BLUE}Last output:${NC}"
            tail -5 "$step_log" | sed 's/^/  /'
            check_context_threshold
            if [[ $? -eq 2 ]]; then
                return 99
            fi
            return 0
        else
            echo -e "${RED}✗ $step_name failed after retries (see: $step_log)${NC}"
            tail -10 "$step_log" | sed 's/^/  /'
            return 1
        fi
    fi

    # Not a rate limit or transient error - regular failure
    echo -e "${RED}✗ $step_name failed (exit code: $exit_code)${NC}"
    echo -e "${RED}See log: $step_log${NC}"
    echo -e "${RED}Last output:${NC}"
    tail -10 "$step_log" | sed 's/^/  /'

    return $exit_code
}

# Check if story file exists after CS step
# Stories are created directly in implementation-artifacts/ not in a stories/ subdirectory
check_story_created() {
    # Try multiple possible locations and naming patterns
    local story_file=""

    # Pattern 1: Direct in impl-artifacts (e.g., 1-3-state-management-module.md)
    if ls "${IMPL_ARTIFACTS}/${STORY_ID}"*.md 2>/dev/null | head -1 | read -r found; then
        story_file="$found"
    fi

    # Pattern 2: In stories subdirectory
    if [[ -z "$story_file" ]] && ls "${IMPL_ARTIFACTS}/stories/${STORY_ID}"*.md 2>/dev/null | head -1 | read -r found; then
        story_file="$found"
    fi

    # Pattern 3: Exact match
    if [[ -z "$story_file" ]] && [[ -f "${IMPL_ARTIFACTS}/${STORY_ID}.md" ]]; then
        story_file="${IMPL_ARTIFACTS}/${STORY_ID}.md"
    fi

    if [[ -n "$story_file" ]] && [[ -f "$story_file" ]]; then
        log "INFO" "Story file found: $story_file"
        STORY_FILE="$story_file"  # Export for later use
        return 0
    else
        log "WARN" "Story file not found yet (may be created by SM *CS)"
        return 0  # Don't fail - CS step will create it
    fi
}

# Check code review output for issues and determine severity
# Args: $1 = iteration number (optional, defaults to checking both patterns)
# Returns: 0 = PASS, 1 = NEEDS_FIXES, 2 = MAJOR_REWORK
# Sets CR_ISSUES variable with extracted issue text
check_cr_for_issues() {
    local iteration="${1:-}"
    local cr_log=""

    # Try iteration-specific log first, then fall back to base name
    if [[ -n "$iteration" ]] && [[ -f "${LOG_DIR}/${STORY_ID}-code-review-iter-${iteration}.log" ]]; then
        cr_log="${LOG_DIR}/${STORY_ID}-code-review-iter-${iteration}.log"
    elif [[ -f "${LOG_DIR}/${STORY_ID}-code-review.log" ]]; then
        cr_log="${LOG_DIR}/${STORY_ID}-code-review.log"
    else
        # Try to find the most recent CR log
        cr_log=$(ls -t "${LOG_DIR}/${STORY_ID}-code-review"*.log 2>/dev/null | head -1)
    fi

    if [[ -z "$cr_log" ]] || [[ ! -f "$cr_log" ]]; then
        log "WARN" "CR log not found for iteration ${iteration:-any}"
        return 0
    fi

    log "INFO" "Checking CR log: $cr_log"

    # Extract the result text from JSON output if present
    # JSON format: {"result":"...actual review text..."}
    local result_text=""
    if grep -q '"result"' "$cr_log"; then
        # Extract result field from JSON (handles escaped characters)
        result_text=$(grep -o '"result":"[^"]*"' "$cr_log" | head -1 | sed 's/"result":"//;s/"$//' | sed 's/\\n/\n/g')
    fi

    # If no JSON result, use the full log
    if [[ -z "$result_text" ]]; then
        result_text=$(cat "$cr_log")
    fi

    # First check for MAJOR_REWORK indicators
    if echo "$result_text" | grep -qiE "MAJOR_REWORK|fundamental|redesign|architecture violation|scope creep|wrong approach|security vulnerability|completely rewrite|start over"; then
        log "WARN" "Code review indicates MAJOR_REWORK required"
        CR_ISSUES="$result_text"
        return 2  # MAJOR_REWORK
    fi

    # Check for issues patterns - CR workflow typically asks "What should I do with these issues"
    # or lists numbered issues, or mentions "Fix them"
    if echo "$result_text" | grep -qiE "issues|problems|fix them|should I do|action items|Issue [0-9]|Problem [0-9]|\*\*Issue"; then
        log "INFO" "Code review found issues requiring attention"
        CR_ISSUES="$result_text"
        return 1  # NEEDS_FIXES
    fi

    # Check for explicit PASS indication
    if echo "$result_text" | grep -qiE "PASS|no issues|looks good|approved|all good|clean"; then
        log "INFO" "Code review passed - no issues found"
        return 0  # PASS
    fi

    # If CR is asking for user input (interactive), treat as issues found
    if echo "$result_text" | grep -qiE "Choose \[|What should I|which issue"; then
        log "INFO" "Code review waiting for input - issues present"
        CR_ISSUES="$result_text"
        return 1  # NEEDS_FIXES
    fi

    # Default: assume no blocking issues if nothing explicit found
    log "WARN" "Could not determine CR result from output, assuming pass"
    return 0
}

# Extract issues from CR JSON output and add them to the story file
# This ensures the story file remains the source of truth
# Returns: number of issues added
extract_and_add_cr_issues() {
    local cr_log="${LOG_DIR}/${STORY_ID}-code-review.log"
    local issues_added=0

    if [[ ! -f "$cr_log" ]]; then
        log "WARN" "CR log not found for issue extraction: $cr_log"
        return 0
    fi

    if [[ -z "$STORY_FILE" || ! -f "$STORY_FILE" ]]; then
        log "ERROR" "Story file not found for adding CR issues"
        return 0
    fi

    # Extract issues from CR JSON output
    # Look for patterns like: **[HIGH]**, **[MEDIUM]**, **[LOW]**
    local result_text=""
    if grep -q '"result"' "$cr_log"; then
        # Extract full result from JSON - use Python for proper JSON parsing
        result_text=$(python3 -c "
import json
import sys
try:
    with open('$cr_log', 'r') as f:
        data = json.load(f)
        print(data.get('result', ''))
except:
    sys.exit(1)
" 2>/dev/null)
    fi

    if [[ -z "$result_text" ]]; then
        log "WARN" "Could not extract result text from CR log"
        return 0
    fi

    # Create a temp file for the issues section
    local issues_file=$(mktemp)

    # Extract numbered issues with severity from the result text
    # Format: N. **[SEVERITY] Description**
    echo "$result_text" | grep -E "^[0-9]+\. \*\*\[(HIGH|MEDIUM|LOW)\]" | while read -r line; do
        # Extract severity and description
        local num=$(echo "$line" | grep -oE "^[0-9]+")
        local severity=$(echo "$line" | grep -oE "\[(HIGH|MEDIUM|LOW)\]" | tr -d '[]')
        local desc=$(echo "$line" | sed 's/^[0-9]*\. \*\*\[[A-Z]*\] //' | sed 's/\*\*$//')

        # Skip if this is a pre-existing, documentation-only, or intentional design issue
        # These are informational findings, not code bugs to fix
        if echo "$desc" | grep -qiE "pre-existing|already documented|git tracking|not committed|E2E test failures|intentionally|documented but not ideal|design choice|Missing.*barrel export"; then
            continue
        fi

        echo "- [ ] [AI-Review][$severity] $desc" >> "$issues_file"
        ((issues_added++))
    done

    # If we found issues, add them to the story
    if [[ -s "$issues_file" && $issues_added -gt 0 ]]; then
        log "INFO" "Adding $issues_added CR issues to story file"

        # Check if story already has a CR Review section
        if grep -q "## CR Review Issues" "$STORY_FILE"; then
            log "INFO" "CR Review section already exists, appending issues"
            # Append to existing section (before the next ## section)
            # This is complex, so we'll just append at the end of the section
        else
            # Add new section before "## Dev Notes" or at the end
            if grep -q "## Dev Notes" "$STORY_FILE"; then
                # Insert before Dev Notes
                sed -i.bak '/## Dev Notes/i\
## CR Review Issues\
\
The following issues were identified during code review and need to be addressed:\
\
'"$(cat "$issues_file")"'\
\
' "$STORY_FILE"
                rm -f "${STORY_FILE}.bak"
            else
                # Append at end
                echo "" >> "$STORY_FILE"
                echo "## CR Review Issues" >> "$STORY_FILE"
                echo "" >> "$STORY_FILE"
                echo "The following issues were identified during code review and need to be addressed:" >> "$STORY_FILE"
                echo "" >> "$STORY_FILE"
                cat "$issues_file" >> "$STORY_FILE"
                echo "" >> "$STORY_FILE"
            fi
        fi

        log "SUCCESS" "Added $issues_added CR issues to story"
    else
        log "INFO" "No actionable issues to add to story"
    fi

    rm -f "$issues_file"
    echo "$issues_added"
}

# Handle MAJOR_REWORK scenario - notify and exit cleanly
handle_major_rework() {
    local cr_log="${LOG_DIR}/${STORY_ID}-code-review.log"

    echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  🔴 MAJOR REWORK REQUIRED                                  ║${NC}"
    echo -e "${RED}║                                                            ║${NC}"
    echo -e "${RED}║  Code review found fundamental issues that require         ║${NC}"
    echo -e "${RED}║  significant changes beyond simple fixes.                  ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"

    # Generate detailed report
    local report_file="${IMPL_ARTIFACTS}/${STORY_ID}_cr_report.md"

    cat > "$report_file" << EOF
# MAJOR REWORK Report: ${STORY_ID}

**Generated:** $(date '+%Y-%m-%d %H:%M:%S')
**Story File:** ${STORY_FILE:-unknown}
**Status:** MAJOR_REWORK

---

## Critical Issues

${CR_ISSUES}

---

## Recommended Actions

1. **Review the issues** - Understand the fundamental problems identified
2. **Revise the story** - Use SM agent to update story scope/approach
3. **Consider splitting** - This story may need to be broken into smaller pieces
4. **Update architecture** - If architecture violations found, update docs first
5. **Re-run workflow** - After revisions, restart from create-story step

## To Resume

\`\`\`bash
# After making necessary revisions:
./scripts/v6-story-workflow.sh ${STORY_ID}
\`\`\`

---

## Full CR Log Excerpt

\`\`\`
$(tail -100 "$cr_log")
\`\`\`

---

*Report generated by v6-story-workflow.sh*
EOF

    log "ERROR" "MAJOR_REWORK required - report saved: $report_file"

    # Update story status
    if [[ -n "$STORY_FILE" && -f "$STORY_FILE" ]]; then
        sed -i '' 's/^Status:.*/Status: blocked/' "$STORY_FILE" 2>/dev/null || true
    fi

    # Send Slack notification
    notify_major_rework "$STORY_ID" "$report_file" "Code review found fundamental issues requiring story revision. See report for details."

    echo -e "${YELLOW}Report saved: ${report_file}${NC}"
    echo -e "${YELLOW}Slack notification sent.${NC}"
    echo -e "${YELLOW}Please review the report and revise the story before re-running.${NC}"

    # Exit with specific code for MAJOR_REWORK
    exit 2
}

# Extract summary from a log file for context passing
extract_summary() {
    local log_file="$1"
    local lines="${2:-20}"

    # Get last N lines, filter out noise
    tail -"$lines" "$log_file" | grep -v "^$\|Running\|Completed\|timestamp"
}

# ============================================================================
# STEP VALIDATION FUNCTIONS
# ============================================================================

# Find the story file (called after CS step)
find_story_file() {
    # Pattern 1: Direct match with name suffix
    for f in "${IMPL_ARTIFACTS}/${STORY_ID}"*.md; do
        if [[ -f "$f" ]]; then
            STORY_FILE="$f"
            log "INFO" "Found story file: $STORY_FILE"
            return 0
        fi
    done

    # Pattern 2: Check without prefix (e.g., just the name part)
    local name_part=$(echo "$STORY_ID" | sed 's/^[0-9]*-[0-9]*-//')
    for f in "${IMPL_ARTIFACTS}"/*"${name_part}"*.md; do
        if [[ -f "$f" ]]; then
            STORY_FILE="$f"
            log "INFO" "Found story file by name: $STORY_FILE"
            return 0
        fi
    done

    log "ERROR" "Story file not found for: $STORY_ID"
    return 1
}

# Validate story file exists and has tasks
validate_after_cs() {
    log "INFO" "Validating after CS step..."

    if ! find_story_file; then
        echo -e "${RED}ERROR: Story file was not created by SM *CS${NC}"
        return 1
    fi

    # Check that tasks section exists
    if ! grep -q "## Tasks" "$STORY_FILE" && ! grep -q "## Tasks / Subtasks" "$STORY_FILE"; then
        log "WARN" "Story file missing Tasks section"
        echo -e "${YELLOW}WARNING: Story file may be incomplete (no Tasks section)${NC}"
    fi

    # Count tasks
    local task_count=$(grep -c "^\- \[" "$STORY_FILE" 2>/dev/null || echo 0)
    log "INFO" "Story has $task_count tasks defined"
    echo -e "${GREEN}✓ Story file validated: $task_count tasks${NC}"

    return 0
}

# Validate that DEV actually completed work
validate_after_ds() {
    log "INFO" "Validating after DS step..."

    if [[ -z "$STORY_FILE" ]] && ! find_story_file; then
        log "ERROR" "Cannot validate - story file not found"
        return 1
    fi

    # Count completed vs total tasks
    local total_tasks=$(grep -c "^\- \[" "$STORY_FILE" 2>/dev/null || echo 0)
    local completed_tasks=$(grep -c "^\- \[x\]" "$STORY_FILE" 2>/dev/null || echo 0)

    log "INFO" "Tasks: $completed_tasks / $total_tasks completed"

    if [[ "$completed_tasks" -eq 0 ]]; then
        echo -e "${RED}ERROR: No tasks were marked complete after DS${NC}"
        echo -e "${YELLOW}DEV *DS may have failed to update the story file${NC}"
        return 1
    fi

    local completion_pct=$((completed_tasks * 100 / total_tasks))
    echo -e "${GREEN}✓ Development validated: $completed_tasks/$total_tasks tasks ($completion_pct%)${NC}"

    if [[ "$completed_tasks" -lt "$total_tasks" ]]; then
        echo -e "${YELLOW}WARNING: Not all tasks completed. Review story file.${NC}"
    fi

    return 0
}

# ============================================================================
# FINAL VALIDATION - Check story is truly complete before marking DONE
# ============================================================================

# Validate story is ready to be marked as DONE
# Returns: 0 = ready, 1 = not ready (with details)
validate_before_done() {
    log "INFO" "Final validation before marking DONE..."

    if [[ -z "$STORY_FILE" ]] && ! find_story_file; then
        log "ERROR" "Cannot validate - story file not found"
        return 1
    fi

    local issues=0
    local warnings=0

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  FINAL VALIDATION CHECKLIST${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Check 1: All main tasks completed
    local total_tasks=$(count_story_tasks)
    local completed_tasks=$(count_completed_tasks)
    local uncompleted_tasks=$(count_uncompleted_tasks)

    if [[ "$uncompleted_tasks" -gt 0 ]]; then
        echo -e "${RED}  ✗ FAIL: $uncompleted_tasks of $total_tasks tasks still uncompleted${NC}"
        log "ERROR" "Final validation: $uncompleted_tasks tasks uncompleted"
        ((issues++))
    else
        echo -e "${GREEN}  ✓ PASS: All $total_tasks tasks completed${NC}"
    fi

    # Check 2: No pending [AI-Review] issues
    local pending_reviews=$(grep -c "\- \[ \] \[AI-Review\]" "$STORY_FILE" 2>/dev/null || echo "0")
    if [[ "$pending_reviews" -gt 0 ]]; then
        echo -e "${RED}  ✗ FAIL: $pending_reviews [AI-Review] issues still pending${NC}"
        log "ERROR" "Final validation: $pending_reviews AI-Review issues pending"
        ((issues++))
    else
        local total_reviews=$(grep -c "\[AI-Review\]" "$STORY_FILE" 2>/dev/null || echo "0")
        if [[ "$total_reviews" -gt 0 ]]; then
            echo -e "${GREEN}  ✓ PASS: All $total_reviews [AI-Review] issues addressed${NC}"
        else
            echo -e "${GREEN}  ✓ PASS: No [AI-Review] issues to address${NC}"
        fi
    fi

    # Check 3: Story status is not already 'done' or 'blocked'
    local current_status=$(get_story_status)
    if [[ "$current_status" == "blocked" ]]; then
        echo -e "${RED}  ✗ FAIL: Story status is 'blocked' - requires manual review${NC}"
        log "ERROR" "Final validation: Story is blocked"
        ((issues++))
    elif [[ "$current_status" == "done" ]]; then
        echo -e "${YELLOW}  ⚠ WARN: Story already marked 'done'${NC}"
        ((warnings++))
    else
        echo -e "${GREEN}  ✓ PASS: Story status is '$current_status' (will be updated to 'done')${NC}"
    fi

    # Check 4: All subtasks in completed tasks are also completed
    # (This catches cases like Task 12 where main task might be checked but subtasks aren't)
    local unchecked_subtasks=$(grep -A50 "^\- \[x\] \*\*Task" "$STORY_FILE" 2>/dev/null | grep -c "^  - \[ \]" || echo "0")
    if [[ "$unchecked_subtasks" -gt 0 ]]; then
        echo -e "${YELLOW}  ⚠ WARN: $unchecked_subtasks subtasks unchecked within completed tasks${NC}"
        log "WARN" "Final validation: $unchecked_subtasks subtasks unchecked"
        ((warnings++))
    else
        echo -e "${GREEN}  ✓ PASS: All subtasks in completed tasks are checked${NC}"
    fi

    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    if [[ $issues -gt 0 ]]; then
        echo -e "${RED}  RESULT: $issues issue(s), $warnings warning(s) - NOT READY${NC}"
        log "ERROR" "Final validation FAILED: $issues issues, $warnings warnings"
        return 1
    elif [[ $warnings -gt 0 ]]; then
        echo -e "${YELLOW}  RESULT: 0 issues, $warnings warning(s) - PROCEED WITH CAUTION${NC}"
        log "WARN" "Final validation PASSED with warnings: $warnings warnings"
        return 0
    else
        echo -e "${GREEN}  RESULT: All checks passed - READY FOR DONE${NC}"
        log "SUCCESS" "Final validation PASSED"
        return 0
    fi
}

# Get story status from file
get_story_status() {
    if [[ -z "$STORY_FILE" ]] && ! find_story_file; then
        echo "unknown"
        return
    fi

    # Look for Status: line at top of file
    local status=$(grep -m1 "^Status:" "$STORY_FILE" | sed 's/Status: *//' | tr -d '[:space:]')
    echo "${status:-unknown}"
}

# ============================================================================
# PER-TASK DEVELOPMENT (Context Window Mitigation)
# ============================================================================

# Count ALL tasks in story file (both completed and uncompleted)
count_story_tasks() {
    if [[ -z "$STORY_FILE" ]] && ! find_story_file; then
        echo 0
        return
    fi

    # Count main task headers (lines like "- [ ] **Task 1:" or "- [x] **Task 1:")
    # Uses [.] to match any character (space for uncompleted, x for completed)
    grep -c "^\- \[.\] \*\*Task [0-9]" "$STORY_FILE" 2>/dev/null || echo 0
}

# Count UNCOMPLETED tasks only (for determining what work remains)
count_uncompleted_tasks() {
    if [[ -z "$STORY_FILE" ]] && ! find_story_file; then
        echo 0
        return
    fi

    # Count only uncompleted task headers (- [ ] **Task N:)
    grep -c "^\- \[ \] \*\*Task [0-9]" "$STORY_FILE" 2>/dev/null || echo 0
}

# Count COMPLETED tasks (for progress tracking)
count_completed_tasks() {
    if [[ -z "$STORY_FILE" ]] && ! find_story_file; then
        echo 0
        return
    fi

    # Count only completed task headers (- [x] **Task N:)
    grep -c "^\- \[x\] \*\*Task [0-9]" "$STORY_FILE" 2>/dev/null || echo 0
}

# Get the first uncompleted task number
get_first_uncompleted_task() {
    if [[ -z "$STORY_FILE" ]] && ! find_story_file; then
        echo 1
        return
    fi

    # Find first uncompleted task and extract task number
    local first_uncompleted=$(grep -n "^\- \[ \] \*\*Task [0-9]" "$STORY_FILE" 2>/dev/null | head -1 | grep -oE "Task [0-9]+" | grep -oE "[0-9]+")
    echo "${first_uncompleted:-1}"
}

# ============================================================================
# TOKEN TRACKING FROM CLAUDE SESSION FILES
# ============================================================================
# Claude stores session data in ~/.claude/projects/<project-hash>/*.jsonl
# Each message includes usage stats with input_tokens and cache_read_input_tokens
# We parse the most recent session file to get actual token usage
# ============================================================================

# Get the most recently modified session file
get_latest_session_file() {
    if [[ ! -d "$CLAUDE_SESSIONS_DIR" ]]; then
        echo ""
        return
    fi

    # Find the most recently modified .jsonl file (excluding agent- prefixed files)
    ls -t "${CLAUDE_SESSIONS_DIR}"/*.jsonl 2>/dev/null | grep -v '/agent-' | head -1
}

# Get token usage from a session file
# Returns: total_tokens (input + cache_read + output)
# Sets global variables: LAST_INPUT_TOKENS, LAST_CACHE_TOKENS, LAST_OUTPUT_TOKENS
get_session_token_usage() {
    local session_file="$1"

    LAST_INPUT_TOKENS=0
    LAST_CACHE_TOKENS=0
    LAST_OUTPUT_TOKENS=0

    if [[ ! -f "$session_file" ]]; then
        echo "0"
        return
    fi

    # Get the maximum cache_read_input_tokens from the session (represents peak context)
    LAST_CACHE_TOKENS=$(grep -o '"cache_read_input_tokens":[0-9]*' "$session_file" 2>/dev/null | \
        cut -d: -f2 | sort -n | tail -1)
    LAST_CACHE_TOKENS=${LAST_CACHE_TOKENS:-0}

    # Get the last input_tokens value
    LAST_INPUT_TOKENS=$(grep -o '"input_tokens":[0-9]*' "$session_file" 2>/dev/null | \
        tail -1 | cut -d: -f2)
    LAST_INPUT_TOKENS=${LAST_INPUT_TOKENS:-0}

    # Sum output tokens (cumulative over session)
    LAST_OUTPUT_TOKENS=$(grep -o '"output_tokens":[0-9]*' "$session_file" 2>/dev/null | \
        cut -d: -f2 | awk '{sum+=$1} END {print sum}')
    LAST_OUTPUT_TOKENS=${LAST_OUTPUT_TOKENS:-0}

    # Total context is cache + input (output doesn't count toward context limit)
    local total=$((LAST_CACHE_TOKENS + LAST_INPUT_TOKENS))
    echo "$total"
}

# Estimate context usage - tries session files first, falls back to log estimation
# Returns human-readable string like "85K tokens" or "12K tokens (est)"
estimate_context_from_log() {
    local log_file="$1"

    # First try to get real token counts from the latest session file
    local session_file=$(get_latest_session_file)
    if [[ -n "$session_file" ]]; then
        local total_tokens=$(get_session_token_usage "$session_file")
        if [[ "$total_tokens" -gt 0 ]]; then
            local total_k=$((total_tokens / 1000))
            echo "${total_k}K tokens"
            return
        fi
    fi

    # Fallback: Try to extract from JSON in log file
    if [[ -f "$log_file" ]]; then
        local input_tokens=$(grep -o '"input_tokens":[0-9]*' "$log_file" 2>/dev/null | head -1 | grep -o '[0-9]*')
        local cache_tokens=$(grep -o '"cache_read_input_tokens":[0-9]*' "$log_file" 2>/dev/null | head -1 | grep -o '[0-9]*')

        if [[ -n "$input_tokens" || -n "$cache_tokens" ]]; then
            local total=$((${input_tokens:-0} + ${cache_tokens:-0}))
            local total_k=$((total / 1000))
            echo "${total_k}K tokens"
            return
        fi

        # Last resort: estimate from file size (~4 chars per token)
        local size_bytes=$(wc -c < "$log_file" | tr -d ' ')
        local est_tokens=$((size_bytes / 4))
        local est_k=$((est_tokens / 1000))
        echo "${est_k}K tokens (est)"
        return
    fi

    echo "0K"
}

# Check if context is approaching dangerous levels
# Returns: 0 = OK, 1 = WARNING (>150K), 2 = ABORT (>180K)
check_context_threshold() {
    local session_file=$(get_latest_session_file)
    if [[ -z "$session_file" ]]; then
        return 0  # Can't check, assume OK
    fi

    local total_tokens=$(get_session_token_usage "$session_file")

    if [[ "$total_tokens" -ge "$TOKEN_ABORT_THRESHOLD" ]]; then
        log "ERROR" "Context threshold exceeded: ${total_tokens} tokens (limit: ${TOKEN_ABORT_THRESHOLD})"
        echo -e "${RED}🚨 CONTEXT OVERFLOW WARNING: ${total_tokens} tokens exceeds ${TOKEN_ABORT_THRESHOLD} limit${NC}"
        echo -e "${RED}   Aborting to prevent quality degradation${NC}"
        return 2
    elif [[ "$total_tokens" -ge "$TOKEN_WARN_THRESHOLD" ]]; then
        log "WARN" "Context approaching limit: ${total_tokens} tokens (warning at: ${TOKEN_WARN_THRESHOLD})"
        echo -e "${YELLOW}⚠️  Context warning: ${total_tokens} tokens (approaching ${TOKEN_ABORT_THRESHOLD} limit)${NC}"
        return 1
    fi

    return 0
}

# Log detailed token usage for a completed step
log_token_usage() {
    local step_name="$1"
    local session_file=$(get_latest_session_file)

    if [[ -n "$session_file" ]]; then
        local total=$(get_session_token_usage "$session_file")
        local total_k=$((total / 1000))
        local cache_k=$((LAST_CACHE_TOKENS / 1000))
        local input_k=$((LAST_INPUT_TOKENS / 1000))
        local output_k=$((LAST_OUTPUT_TOKENS / 1000))

        log "TOKEN" "$step_name: ${total_k}K total (cache: ${cache_k}K, input: ${input_k}K, output: ${output_k}K)"

        # Also log to a separate token tracking file for analysis
        local token_log="${LOG_DIR}/${STORY_ID}-tokens.log"
        echo "$(date '+%Y-%m-%d %H:%M:%S') | $step_name | total: ${total} | cache: ${LAST_CACHE_TOKENS} | input: ${LAST_INPUT_TOKENS} | output: ${LAST_OUTPUT_TOKENS}" >> "$token_log"
    fi
}

# Internal function to execute a single task (no retry logic)
# Args: task_num [turn_limit]
_execute_ds_task() {
    local task_num="$1"
    local turn_limit="${2:-$MAX_TURNS}"  # Use provided limit or default
    local step_log="${LOG_DIR}/${STORY_ID}-develop-task-${task_num}.log"

    # Slash command on its own line, then story ID and task instructions
    local prompt="${SKILL_DEV_STORY}
${STORY_ID}

EXECUTE ONLY TASK ${task_num}:
1. Read the story file and find Task ${task_num}
2. Implement ONLY the subtasks under Task ${task_num}
3. Mark each subtask [x] as you complete it
4. Run tests for Task ${task_num} code only
5. DO NOT proceed to Task $((task_num + 1)) or any other tasks
6. When Task ${task_num} is fully complete with tests passing, STOP and summarize"

    log "INFO" "Executing Task $task_num with $turn_limit turns"
    if (cd "$PROJECT_ROOT" && claude -p --dangerously-skip-permissions --max-turns "$turn_limit" "$prompt") > "$step_log" 2>&1; then
        return 0
    else
        return $?
    fi
}

# Run DS for a single task only, with fresh context
# Includes rate limit detection, auto-retry, max-turns handling, and token tracking
run_ds_for_task() {
    local task_num="$1"
    local step_name="develop-task-${task_num}"
    local step_log="${LOG_DIR}/${STORY_ID}-${step_name}.log"

    # Get dynamic turn limit based on task complexity
    local task_turns=$(get_task_turn_limit "$task_num")

    log "INFO" "Running DEV *DS for Task $task_num only..."
    echo -e "${CYAN}  ▶ Task $task_num${NC}"
    echo -e "${YELLOW}Running Claude Code (Task $task_num, max $task_turns turns)...${NC}"

    # Execute the task with dynamic turn limit
    _execute_ds_task "$task_num" "$task_turns"
    local exit_code=$?

    # IMPORTANT: Claude CLI may return exit code 0 even on connection errors
    # Always validate the output content regardless of exit code
    if ! validate_claude_output "$step_log"; then
        log "WARN" "Task $task_num exit code was $exit_code but output validation failed"
        # Treat as transient error and continue to error handling below
        exit_code=1
    fi

    if [[ $exit_code -eq 0 ]]; then
        # Get real token usage from session files
        local context_est=$(estimate_context_from_log "$step_log")
        log_token_usage "$step_name"

        log "SUCCESS" "Task $task_num completed ($context_est)"
        echo -e "${GREEN}  ✓ Task $task_num completed${NC} ${BLUE}[$context_est]${NC}"

        # Check context threshold after successful completion
        check_context_threshold
        local threshold_status=$?
        if [[ $threshold_status -eq 2 ]]; then
            log "ERROR" "Aborting workflow due to context overflow"
            return 99  # Special exit code for context overflow
        fi

        return 0
    fi

    # Task failed - check if it's a rate limit
    log "ERROR" "Task $task_num failed with exit code $exit_code"

    # Check for subscription limit
    check_subscription_limit "$step_log"
    local limit_status=$?

    if [[ $limit_status -eq 1 ]]; then
        # Session limit - auto-wait and retry
        echo -e "${YELLOW}  Detected session rate limit. Entering auto-retry mode...${NC}"
        if handle_session_limit "$step_name" "_execute_ds_task" "$task_num"; then
            # Retry succeeded - get token usage
            local context_est=$(estimate_context_from_log "$step_log")
            log_token_usage "$step_name"

            log "SUCCESS" "Task $task_num completed after rate limit wait ($context_est)"
            echo -e "${GREEN}  ✓ Task $task_num completed (after rate limit wait)${NC} ${BLUE}[$context_est]${NC}"

            # Check context threshold
            check_context_threshold
            if [[ $? -eq 2 ]]; then
                return 99
            fi
            return 0
        else
            return 1
        fi
    elif [[ $limit_status -eq 2 ]]; then
        # Weekly limit - notify and pause
        handle_weekly_limit "$step_name"
        return 1
    fi

    # Check for transient errors (network issues, API errors, "No messages returned")
    if check_transient_error "$step_log"; then
        echo -e "${YELLOW}  Detected transient error. Attempting automatic retry...${NC}"
        if handle_transient_error "$step_name" "_execute_ds_task" "$task_num $task_turns"; then
            # Retry succeeded
            local context_est=$(estimate_context_from_log "$step_log")
            log_token_usage "$step_name"

            log "SUCCESS" "Task $task_num completed after transient error retry ($context_est)"
            echo -e "${GREEN}  ✓ Task $task_num completed (after retry)${NC} ${BLUE}[$context_est]${NC}"

            # Check context threshold
            check_context_threshold
            if [[ $? -eq 2 ]]; then
                return 99
            fi
            return 0
        else
            # Retries exhausted
            echo -e "${RED}  ✗ Task $task_num failed after retries (see: $step_log)${NC}"
            tail -5 "$step_log" | sed 's/^/    /'
            return 1
        fi
    fi

    # Check for max turns error - retry with more turns
    if check_max_turns_error "$step_log"; then
        local retry_turns=$((task_turns * MAX_TURNS_RETRY_MULTIPLIER))
        [[ $retry_turns -gt 200 ]] && retry_turns=200  # Cap at 200

        echo -e "${YELLOW}  ⚠ Task hit max turns ($task_turns). Retrying with $retry_turns turns...${NC}"
        log "WARN" "Task $task_num hit max turns ($task_turns) - retrying with $retry_turns"

        # Retry with more turns
        _execute_ds_task "$task_num" "$retry_turns"
        local retry_exit=$?

        if [[ $retry_exit -eq 0 ]] && validate_claude_output "$step_log"; then
            local context_est=$(estimate_context_from_log "$step_log")
            log_token_usage "$step_name"
            log "SUCCESS" "Task $task_num completed on retry with $retry_turns turns ($context_est)"
            echo -e "${GREEN}  ✓ Task $task_num completed (with extended turns)${NC} ${BLUE}[$context_est]${NC}"
            return 0
        fi

        # Still hitting max turns or failed
        if check_max_turns_error "$step_log"; then
            echo -e "${RED}  ✗ Task $task_num still incomplete after $retry_turns turns${NC}"
            echo -e "${YELLOW}  Consider splitting this task into smaller subtasks${NC}"
            log "ERROR" "Task $task_num incomplete after $retry_turns turns - may need to be split"
            notify_failed "$STORY_ID" "Task $task_num too complex - hit max turns ($retry_turns). Consider splitting."
        fi

        tail -5 "$step_log" | sed 's/^/    /'
        return 1
    fi

    # Not a rate limit, transient error, or max turns - regular failure
    echo -e "${RED}  ✗ Task $task_num failed (see: $step_log)${NC}"
    tail -5 "$step_log" | sed 's/^/    /'
    return $exit_code
}

# Run DS as multiple per-task sessions to avoid context overflow
run_ds_per_task() {
    local task_count=$(count_story_tasks)

    if [[ "$task_count" -eq 0 ]]; then
        log "WARN" "Could not count tasks - falling back to single DS session"
        run_claude_step "$SKILL_DEV_STORY" "${STORY_ID}" "develop-story"
        return $?
    fi

    # Check for pre-completed tasks
    local completed=$(count_completed_tasks)
    local uncompleted=$(count_uncompleted_tasks)
    local first_uncompleted=$(get_first_uncompleted_task)

    log "INFO" "Story has $task_count tasks: $completed completed, $uncompleted remaining"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  TASK STATUS: $completed/$task_count complete, $uncompleted remaining${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # If all tasks already completed, nothing to do
    if [[ "$uncompleted" -eq 0 ]]; then
        echo -e "${GREEN}✓ All $task_count tasks already completed!${NC}"
        log "INFO" "All tasks pre-completed - skipping development phase"
        return 0
    fi

    # Detect if we should auto-start from first uncompleted task
    local effective_start="$START_TASK"
    if [[ "$START_TASK" -eq 1 && "$completed" -gt 0 ]]; then
        echo -e "${YELLOW}Detected $completed pre-completed tasks.${NC}"
        echo -e "${YELLOW}Auto-starting from Task $first_uncompleted (first uncompleted).${NC}"
        effective_start="$first_uncompleted"
        log "INFO" "Auto-adjusted START_TASK from 1 to $first_uncompleted (pre-completed detection)"
    elif [[ "$START_TASK" -gt 1 ]]; then
        echo -e "${YELLOW}Resuming from Task $START_TASK (user-specified)${NC}"
        log "INFO" "Resuming from Task $START_TASK"
    fi

    echo -e "${BLUE}Running development for tasks $effective_start through $task_count${NC}"
    echo -e "${BLUE}Each task runs in a separate session to prevent context overflow${NC}"

    local failed_tasks=()

    for task_num in $(seq "$effective_start" "$task_count"); do
        if ! run_ds_for_task "$task_num"; then
            failed_tasks+=("$task_num")
            # Save state so we can resume from this task
            save_state 3 1 "$task_num" "dev"
            echo -e "${YELLOW}Task $task_num failed. Continue with remaining tasks? (y/n)${NC}"
            read -r response
            if [[ "$response" != "y" ]]; then
                log "ERROR" "Aborted at Task $task_num"
                return 1
            fi
        else
            # Save state after each successful task (next task number)
            local next_task=$((task_num + 1))
            if [[ $next_task -le $task_count ]]; then
                save_state 3 1 "$next_task" "dev"
            fi
        fi

        # Brief pause between tasks
        sleep 2
    done

    if [[ ${#failed_tasks[@]} -gt 0 ]]; then
        log "WARN" "Some tasks failed: ${failed_tasks[*]}"
        echo -e "${YELLOW}Failed tasks: ${failed_tasks[*]}${NC}"
        return 1
    fi

    log "SUCCESS" "All $task_count tasks completed"
    echo -e "${GREEN}✓ All $task_count tasks completed successfully${NC}"
    return 0
}

# ============================================================================
# FIX CR ISSUES - Run DEV to fix issues identified by Code Review
# ============================================================================
# Called after CR finds issues and adds them to the story file
# Runs in a fresh Claude session to fix all [AI-Review] issues
# ============================================================================

# Internal function to execute fix-issues (no retry logic)
_execute_fix_issues() {
    local iteration="$1"
    local step_log="${LOG_DIR}/${STORY_ID}-fix-issues-iter-${iteration}.log"

    # Slash command on its own line, then story ID and fix instructions
    local prompt="${SKILL_DEV_STORY}
${STORY_ID}

FIX ALL CR ISSUES:
1. Read the story file: ${STORY_FILE}
2. Find ALL unchecked [AI-Review] issues in the story (marked as - [ ])
3. For EACH issue:
   a. Understand the issue description and severity
   b. Navigate to the file and line mentioned
   c. Implement the fix
   d. Mark the issue as complete: - [x]
4. Run tests to verify fixes don't break anything
5. STOP when ALL [AI-Review] issues are marked [x]

This is a FIX-ONLY session. Do NOT implement new tasks, only fix CR issues."

    if (cd "$PROJECT_ROOT" && claude -p --dangerously-skip-permissions --max-turns "$MAX_TURNS" "$prompt") > "$step_log" 2>&1; then
        return 0
    else
        return $?
    fi
}

# Run DEV to fix all CR issues - runs in a fresh session
run_fix_cr_issues() {
    local iteration="$1"
    local step_name="fix-issues-iter-${iteration}"
    local step_log="${LOG_DIR}/${STORY_ID}-${step_name}.log"

    log "INFO" "Running DEV to fix CR issues (iteration $iteration)..."
    echo -e "${CYAN}▶ DEV: Fix all CR issues (fresh session)${NC}"
    echo -e "${YELLOW}Running Claude Code to fix issues (max $MAX_TURNS turns)...${NC}"

    # Execute the fix-issues step
    _execute_fix_issues "$iteration"
    local exit_code=$?

    # IMPORTANT: Claude CLI may return exit code 0 even on connection errors
    # Always validate the output content regardless of exit code
    if ! validate_claude_output "$step_log"; then
        log "WARN" "Fix issues exit code was $exit_code but output validation failed"
        exit_code=1
    fi

    if [[ $exit_code -eq 0 ]]; then
        # Get real token usage from session files
        local context_est=$(estimate_context_from_log "$step_log")
        log_token_usage "$step_name"

        log "SUCCESS" "Fix issues completed ($context_est)"
        echo -e "${GREEN}✓ Fix issues completed${NC} ${BLUE}[$context_est]${NC}"

        # Show summary
        echo -e "${BLUE}Last output:${NC}"
        tail -5 "$step_log" | sed 's/^/  /'

        # Check context threshold
        check_context_threshold
        local threshold_status=$?
        if [[ $threshold_status -eq 2 ]]; then
            log "ERROR" "Aborting workflow due to context overflow"
            return 99
        fi

        return 0
    fi

    # Step failed - check if it's a rate limit
    log "ERROR" "Fix issues failed with exit code $exit_code"

    # Check for subscription limit
    check_subscription_limit "$step_log"
    local limit_status=$?

    if [[ $limit_status -eq 1 ]]; then
        # Session limit - auto-wait and retry
        echo -e "${YELLOW}Detected session rate limit. Entering auto-retry mode...${NC}"
        if handle_session_limit "$step_name" "_execute_fix_issues" "$iteration"; then
            local context_est=$(estimate_context_from_log "$step_log")
            log_token_usage "$step_name"
            log "SUCCESS" "Fix issues completed after rate limit wait ($context_est)"
            echo -e "${GREEN}✓ Fix issues completed (after rate limit wait)${NC} ${BLUE}[$context_est]${NC}"
            check_context_threshold
            if [[ $? -eq 2 ]]; then
                return 99
            fi
            return 0
        else
            return 1
        fi
    elif [[ $limit_status -eq 2 ]]; then
        # Weekly limit - notify and pause
        handle_weekly_limit "$step_name"
        return 1
    fi

    # Check for transient errors (network issues, API errors, "No messages returned")
    if check_transient_error "$step_log"; then
        echo -e "${YELLOW}Detected transient error. Attempting automatic retry...${NC}"
        if handle_transient_error "$step_name" "_execute_fix_issues" "$iteration"; then
            local context_est=$(estimate_context_from_log "$step_log")
            log_token_usage "$step_name"
            log "SUCCESS" "Fix issues completed after transient error retry ($context_est)"
            echo -e "${GREEN}✓ Fix issues completed (after retry)${NC} ${BLUE}[$context_est]${NC}"
            check_context_threshold
            if [[ $? -eq 2 ]]; then
                return 99
            fi
            return 0
        else
            echo -e "${RED}✗ Fix issues failed after retries (see: $step_log)${NC}"
            tail -5 "$step_log" | sed 's/^/    /'
            return 1
        fi
    fi

    # Not a rate limit or transient error - regular failure
    echo -e "${RED}✗ Fix issues failed (see: $step_log)${NC}"
    tail -5 "$step_log" | sed 's/^/    /'
    return $exit_code
}

# ============================================================================
# SESSION MANAGEMENT FOR CR -> FIX FLOW
# ============================================================================

# Run Claude and capture session ID for potential resume
# Uses --max-turns to prevent context overflow
run_claude_with_session() {
    local skill="$1"
    local story_id="$2"
    local step_name="$3"
    local step_log="${LOG_DIR}/${STORY_ID}-${step_name}.log"

    log "INFO" "Running: $skill with story $story_id (max-turns: $MAX_TURNS)"

    # Slash command on its own line, story ID as input
    # For code review, add instructions to auto-select option 2
    local prompt
    if [[ "$skill" == *"code-review"* ]]; then
        # Special handling for Code Review - auto-select option 2 (create action items)
        prompt="${skill}
${story_id}

CRITICAL FOR CODE REVIEW:
When the CR workflow asks 'What should I do with these issues?':
- AUTOMATICALLY choose option [2] - Create action items
- Add ALL issues as [AI-Review][SEVERITY] tasks to the story file
- DO NOT ask the user - just do it automatically
- Make sure each issue has: severity, description, and file:line reference"
    else
        prompt="${skill}
${story_id}"
    fi

    log "INFO" "Prompt: $prompt"
    echo -e "${YELLOW}Running Claude Code (max $MAX_TURNS turns)...${NC}"

    # Use JSON output to capture session ID
    # --max-turns prevents context overflow in print mode
    local result
    if result=$(cd "$PROJECT_ROOT" && claude -p --dangerously-skip-permissions --max-turns "$MAX_TURNS" --output-format json "$prompt" 2>&1); then
        # Extract session ID from JSON output
        CR_SESSION_ID=$(echo "$result" | grep -o '"session_id":"[^"]*"' | cut -d'"' -f4 || echo "")

        # Save full output to log
        echo "$result" > "$step_log"

        log "SUCCESS" "$step_name completed (session: ${CR_SESSION_ID:-unknown})"
        echo -e "${GREEN}✓ $step_name completed${NC}"

        # Show last part of result
        echo -e "${BLUE}Last output:${NC}"
        echo "$result" | tail -c 500 | sed 's/^/  /'

        return 0
    else
        local exit_code=$?
        echo "$result" > "$step_log"
        log "ERROR" "$step_name failed with exit code $exit_code"
        echo -e "${RED}✗ $step_name failed (exit code: $exit_code)${NC}"
        tail -10 "$step_log" | sed 's/^/  /'
        return $exit_code
    fi
}

# Resume a Claude session to continue work
resume_claude_session() {
    local session_id="$1"
    local prompt="$2"
    local step_name="$3"
    local step_log="${LOG_DIR}/${STORY_ID}-${step_name}.log"

    log "INFO" "Resuming session $session_id: $prompt"
    echo -e "${CYAN}Resuming Claude session to fix issues...${NC}"

    if (cd "$PROJECT_ROOT" && claude -p --dangerously-skip-permissions --resume "$session_id" "$prompt") > "$step_log" 2>&1; then
        log "SUCCESS" "$step_name completed"
        echo -e "${GREEN}✓ $step_name completed${NC}"
        tail -5 "$step_log" | sed 's/^/  /'
        return 0
    else
        local exit_code=$?
        log "ERROR" "$step_name failed with exit code $exit_code"
        echo -e "${RED}✗ $step_name failed${NC}"
        tail -10 "$step_log" | sed 's/^/  /'
        return $exit_code
    fi
}

# Main workflow execution
main() {
    log "INFO" "Starting V6 Story Workflow for ${STORY_ID}"
    log "INFO" "Project root: ${PROJECT_ROOT}"
    log "INFO" "Skip AT: ${SKIP_AT}, Skip RV: ${SKIP_RV}, Max CR Loops: ${MAX_CR_LOOPS}"

    echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  V6 STORY WORKFLOW: ${STORY_ID}${NC}"
    echo -e "${GREEN}║  (with DEV-CR loop, max ${MAX_CR_LOOPS} iterations)${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}\n"

    # =========================================================================
    # RESUME STATE CHECK
    # =========================================================================
    local resume_from_step=0
    local resume_from_cr_iter=0
    local resume_from_task=0
    local resume_from_phase=""

    if [[ "$RESUME_MODE" != "fresh" ]]; then
        if show_resume_info; then
            # State exists - apply resume settings
            resume_from_step=$RESUME_STEP
            resume_from_cr_iter=$RESUME_CR_ITER
            resume_from_task=$RESUME_TASK
            resume_from_phase=$RESUME_PHASE

            # Restore STORY_FILE from state if available
            if [[ -n "$RESUME_STORY_FILE" && -f "$RESUME_STORY_FILE" ]]; then
                STORY_FILE="$RESUME_STORY_FILE"
            fi

            log "INFO" "Resuming from step $resume_from_step (CR iter: $resume_from_cr_iter, task: $resume_from_task, phase: $resume_from_phase)"

            # Auto-set skip flags based on resume state
            if [[ $resume_from_step -ge 1 ]]; then
                SKIP_CS=true
            fi
            if [[ $resume_from_step -ge 2 ]]; then
                SKIP_AT=true
            fi
            if [[ $resume_from_step -ge 3 && $resume_from_task -gt 0 ]]; then
                # Resume from specific task
                START_TASK=$resume_from_task
            fi

            echo -e "${GREEN}Resuming workflow...${NC}\n"
        else
            echo -e "${BLUE}Starting fresh workflow${NC}\n"
        fi
    else
        echo -e "${BLUE}Starting fresh workflow (--fresh flag)${NC}\n"
        # Clear any existing state
        clear_state
    fi

    # =========================================================================
    # Step 1: SM - Create Story
    # =========================================================================
    if [[ "$SKIP_CS" == "false" ]]; then
        log_step "1/5: SM - Create Story"
        run_claude_step "$SKILL_CREATE_STORY" "${STORY_ID}" "create-story"
        save_state 1 0 0 ""
    else
        log_step "1/5: SM - Create Story - SKIPPED (resuming)"
        log "INFO" "Create story step skipped - resuming from existing story"
    fi

    # VALIDATION: Story file must exist with tasks
    if ! validate_after_cs; then
        echo -e "${RED}ABORT: Story creation failed validation${NC}"
        notify_failed "$STORY_ID" "Story creation failed - no story file or tasks found"
        exit 1
    fi

    # =========================================================================
    # Step 2: TEA - ATDD (optional)
    # =========================================================================
    if [[ "$SKIP_AT" == "false" ]]; then
        log_step "2/5: TEA - Acceptance Test Design (ATDD)"
        run_claude_step "$SKILL_ATDD" "${STORY_ID}" "atdd" || log "WARN" "ATDD step had issues, continuing..."
        save_state 2 0 0 ""
    else
        log_step "2/5: TEA - ATDD - SKIPPED"
        log "INFO" "ATDD step skipped by flag"
    fi

    # =========================================================================
    # Step 3: DEV-CR LOOP (max MAX_CR_LOOPS iterations)
    # =========================================================================
    log_step "3/5: DEV-CR Loop (Development + Code Review)"

    local cr_loop_iteration=0
    local cr_passed=false

    while [[ $cr_loop_iteration -lt $MAX_CR_LOOPS && "$cr_passed" == "false" ]]; do
        ((cr_loop_iteration++))

        echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${CYAN}  DEV-CR LOOP: Iteration ${cr_loop_iteration}/${MAX_CR_LOOPS}${NC}"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
        log "INFO" "Starting DEV-CR loop iteration ${cr_loop_iteration}/${MAX_CR_LOOPS}"

        # ---------------------------------------------------------------------
        # Step 3a: DEV - Develop Story OR Fix CR Issues
        # Iteration 1: Run per-task development (each task in fresh session)
        # Iteration 2+: Run fix-issues only (fix CR issues in fresh session)
        # ---------------------------------------------------------------------
        if [[ $cr_loop_iteration -eq 1 ]]; then
            # FIRST ITERATION: Develop all tasks (each in separate session)
            echo -e "${YELLOW}▶ DEV: Develop Story (one task at a time, each in new session)${NC}"
            log "INFO" "Running initial development phase - per-task sessions"

            if ! run_ds_per_task; then
                log "ERROR" "Development failed in iteration $cr_loop_iteration"
                echo -e "${RED}Development failed. Continue to code review anyway? (y/n)${NC}"
                read -r response
                if [[ "$response" != "y" ]]; then
                    log "ERROR" "Workflow aborted - development failed"
                    notify_failed "$STORY_ID" "Development failed in DEV-CR loop iteration $cr_loop_iteration"
                    exit 1
                fi
            fi

            # VALIDATION: Check tasks were completed
            if ! validate_after_ds; then
                echo -e "${YELLOW}WARNING: Development validation found issues${NC}"
                echo -e "${YELLOW}Will check in code review${NC}"
            fi

            # Save state: dev phase complete, moving to CR
            save_state 3 "$cr_loop_iteration" 0 "cr"
        else
            # SUBSEQUENT ITERATIONS: Fix CR issues only (fresh session)
            echo -e "${YELLOW}▶ DEV: Fix all CR issues (fresh session)${NC}"
            log "INFO" "Running fix-issues phase - iteration $cr_loop_iteration"

            if ! run_fix_cr_issues "$cr_loop_iteration"; then
                log "ERROR" "Fix issues failed in iteration $cr_loop_iteration"
                save_state 3 "$cr_loop_iteration" 0 "fix"
                echo -e "${RED}Fix issues failed. Continue to code review anyway? (y/n)${NC}"
                read -r response
                if [[ "$response" != "y" ]]; then
                    log "ERROR" "Workflow aborted - fix issues failed"
                    notify_failed "$STORY_ID" "Fix issues failed in DEV-CR loop iteration $cr_loop_iteration"
                    exit 1
                fi
            fi

            # Save state: fix phase complete, moving to test-review
            save_state 3 "$cr_loop_iteration" 0 "test-review"

            # After fixing issues, run test review to verify fixes
            echo -e "${YELLOW}▶ TEA: Test Review after fixes (fresh session)${NC}"
            log "INFO" "Running test review after fix-issues - iteration $cr_loop_iteration"
            run_claude_step "$SKILL_TEST_REVIEW" "${STORY_ID}" "test-review-iter-${cr_loop_iteration}" || log "WARN" "Test review had issues, continuing to CR..."

            # Check if all [AI-Review] issues are now complete
            local remaining_issues=0
            if [[ -n "$STORY_FILE" && -f "$STORY_FILE" ]]; then
                remaining_issues=$(grep -c "\- \[ \] \[AI-Review\]" "$STORY_FILE" 2>/dev/null || echo "0")
            fi

            if [[ "$remaining_issues" -eq 0 ]]; then
                echo -e "${GREEN}✓ All CR issues have been fixed!${NC}"
                log "SUCCESS" "All [AI-Review] issues marked complete"

                # Mark story as DONE since all issues are fixed and tests passed
                echo -e "${GREEN}▶ Marking story as DONE${NC}"
                if [[ -n "$STORY_FILE" && -f "$STORY_FILE" ]]; then
                    if grep -q "^Status:" "$STORY_FILE"; then
                        sed -i '' 's/^Status:.*/Status: done/' "$STORY_FILE" 2>/dev/null || \
                        sed -i 's/^Status:.*/Status: done/' "$STORY_FILE"
                    fi
                    log "SUCCESS" "Story marked as DONE - all issues fixed, tests passed"
                    echo -e "${GREEN}✓ Story ${STORY_ID} is now DONE${NC}"
                fi

                # Exit the CR loop early - all issues fixed
                cr_passed=true
                echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                echo -e "${GREEN}  STORY COMPLETE - All issues fixed, tests passed${NC}"
                echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                continue  # Skip to next iteration check (will exit loop since cr_passed=true)
            else
                echo -e "${YELLOW}⚠ $remaining_issues CR issues still unchecked${NC}"
                log "WARN" "$remaining_issues [AI-Review] issues remain unchecked"
            fi
        fi

        # Brief pause before code review
        sleep 2

        # Save state: moving to CR phase
        save_state 3 "$cr_loop_iteration" 0 "cr"

        # ---------------------------------------------------------------------
        # Step 3b: DEV - Code Review
        # ---------------------------------------------------------------------
        echo -e "${YELLOW}▶ DEV: Code Review${NC}"
        log "INFO" "Running code review phase"

        run_claude_with_session "$SKILL_CODE_REVIEW" "${STORY_ID}" "code-review-iter-${cr_loop_iteration}"

        # Check CR result - returns: 0=PASS, 1=NEEDS_FIXES, 2=MAJOR_REWORK
        CR_ISSUES=""  # Will be set by check_cr_for_issues
        check_cr_for_issues "$cr_loop_iteration"
        local cr_result=$?

        case $cr_result in
            0)
                # PASS - no blocking issues found
                echo -e "${GREEN}✓ Code review PASSED in iteration ${cr_loop_iteration}${NC}"
                log "SUCCESS" "Code review passed in iteration $cr_loop_iteration"
                cr_passed=true
                ;;
            2)
                # MAJOR_REWORK - fundamental issues, cannot auto-fix
                echo -e "${RED}Code review found MAJOR issues requiring human review${NC}"
                log "ERROR" "MAJOR_REWORK required in iteration $cr_loop_iteration"
                handle_major_rework
                # handle_major_rework exits with code 2
                exit 2
                ;;
            1)
                # NEEDS_FIXES - extract issues and prepare for next iteration
                log "WARN" "Code review found issues - iteration $cr_loop_iteration"

                # Extract issues from CR JSON and add them to the story file
                local issue_count=$(extract_and_add_cr_issues)
                log "INFO" "Extracted $issue_count fixable issues from CR output"

                # Count total [AI-Review] tasks
                local total_issues=0
                if [[ -n "$STORY_FILE" && -f "$STORY_FILE" ]]; then
                    total_issues=$(grep -c "\[AI-Review\]" "$STORY_FILE" 2>/dev/null || echo "0")
                fi

                if [[ $total_issues -eq 0 ]]; then
                    # CR found issues but none are actionable code fixes
                    log "INFO" "No actionable code issues - treating as PASS"
                    echo -e "${YELLOW}CR found informational issues only (no code changes needed)${NC}"
                    cr_passed=true
                else
                    echo -e "${YELLOW}CR found $total_issues issues requiring fixes${NC}"

                    if [[ $cr_loop_iteration -lt $MAX_CR_LOOPS ]]; then
                        echo -e "${CYAN}Will fix in next DEV-CR iteration...${NC}"
                        notify_fixes_needed "$STORY_ID" "$total_issues (iteration $cr_loop_iteration)"

                        # Brief pause before next iteration
                        echo -e "${BLUE}Pausing 3 seconds before next iteration...${NC}"
                        sleep 3
                    else
                        # Max iterations reached
                        echo -e "${RED}Max CR iterations ($MAX_CR_LOOPS) reached with unresolved issues${NC}"
                        log "ERROR" "Max CR iterations reached - $total_issues issues remain"
                        notify_fixes_failed "$STORY_ID" "$STORY_FILE"

                        echo -e "${YELLOW}Continue to test review anyway? (y/n)${NC}"
                        read -r response
                        if [[ "$response" == "y" ]]; then
                            log "WARN" "User chose to continue despite unresolved CR issues"
                            cr_passed=true  # Force exit loop
                        else
                            log "ERROR" "Workflow aborted - max CR iterations with unresolved issues"
                            exit 1
                        fi
                    fi
                fi
                ;;
        esac
    done

    if [[ "$cr_passed" == "false" ]]; then
        echo -e "${RED}DEV-CR loop failed after $MAX_CR_LOOPS iterations${NC}"
        log "ERROR" "DEV-CR loop exhausted without passing"
        notify_failed "$STORY_ID" "DEV-CR loop failed after $MAX_CR_LOOPS iterations"
        exit 1
    fi

    echo -e "${GREEN}✓ DEV-CR loop completed successfully in ${cr_loop_iteration} iteration(s)${NC}"
    log "SUCCESS" "DEV-CR loop completed in $cr_loop_iteration iterations"

    # =========================================================================
    # Step 4: TEA - Test Review (optional)
    # =========================================================================
    if [[ "$SKIP_RV" == "false" ]]; then
        log_step "4/5: TEA - Test Review"
        run_claude_step "$SKILL_TEST_REVIEW" "${STORY_ID}" "test-review" || log "WARN" "Test review had issues, continuing..."
        save_state 4 0 0 ""
    else
        log_step "4/5: TEA - Test Review - SKIPPED"
        log "INFO" "Test review step skipped by flag"
    fi

    # =========================================================================
    # Step 5: Mark Story as DONE (with final validation)
    # =========================================================================
    log_step "5/5: Final Validation & Update Story Status"

    # Run final validation checklist
    if ! validate_before_done; then
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}  STORY NOT READY FOR DONE${NC}"
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${YELLOW}The story has unresolved issues that must be addressed.${NC}"
        echo -e "${YELLOW}Mark as 'done' anyway? (y/n)${NC}"
        read -r response
        if [[ "$response" != "y" ]]; then
            log "ERROR" "Workflow completed but story NOT marked done due to validation failures"
            # Update status to in-progress instead of done
            if [[ -n "$STORY_FILE" && -f "$STORY_FILE" ]]; then
                if grep -q "^Status:" "$STORY_FILE"; then
                    sed -i '' 's/^Status:.*/Status: in-progress/' "$STORY_FILE" 2>/dev/null || \
                    sed -i 's/^Status:.*/Status: in-progress/' "$STORY_FILE"
                fi
            fi
            notify_failed "$STORY_ID" "Workflow completed but final validation failed. Story left as in-progress."
            exit 1
        fi
        log "WARN" "User overrode validation failures - marking done anyway"
    fi

    # Update story file status
    if [[ -n "$STORY_FILE" && -f "$STORY_FILE" ]]; then
        # Update status in story file
        if grep -q "^Status:" "$STORY_FILE"; then
            sed -i '' 's/^Status:.*/Status: done/' "$STORY_FILE" 2>/dev/null || \
            sed -i 's/^Status:.*/Status: done/' "$STORY_FILE"
        fi
        log "INFO" "Updated story file status to done"
    fi

    # Update sprint-status.yaml
    local sprint_status="${IMPL_ARTIFACTS}/sprint-status.yaml"
    if [[ -f "$sprint_status" ]]; then
        # Use sed to update the story status
        sed -i '' "s/\(id: ${STORY_ID}.*\n.*status: \)[a-z-]*/\1done/" "$sprint_status" 2>/dev/null || \
        sed -i "s/\(id: ${STORY_ID}.*\n.*status: \)[a-z-]*/\1done/" "$sprint_status" 2>/dev/null || \
        log "WARN" "Could not update sprint-status.yaml automatically"
    fi

    echo -e "${GREEN}✓ Story marked as DONE${NC}"

    # =========================================================================
    # Summary
    # =========================================================================
    echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  WORKFLOW COMPLETE: ${STORY_ID}${NC}"
    echo -e "${GREEN}║  DEV-CR iterations: ${cr_loop_iteration}/${MAX_CR_LOOPS}${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    log "SUCCESS" "V6 Story Workflow completed for ${STORY_ID}"
    log "INFO" "Full log: ${WORKFLOW_LOG}"

    # Clear resume state on successful completion
    clear_state

    # Send completion notification
    notify_complete "$STORY_ID" "Story completed successfully. DEV-CR loop: ${cr_loop_iteration} iterations. Tests passing, CR approved."
}

# Run main
main "$@"
