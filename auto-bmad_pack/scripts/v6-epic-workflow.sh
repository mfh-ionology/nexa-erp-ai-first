#!/bin/bash
# V6 Epic Workflow - Executes full BMAD V6 epic lifecycle
# Usage: ./v6-epic-workflow.sh <epic-id> [--skip-at] [--skip-rv] [--skip-td] [--skip-pre] [--skip-post] [--start-story N] [--max-turns N] [--is-last-epic]
#
# V6 Epic Flow:
#   PRE-EPIC PHASE:
#     1. SM  *SP - Sprint planning and status setup
#     2. TEA *TD - Epic-level test design (test planning)
#
#   STORY LOOP:
#     3. For each story: v6-story-workflow.sh
#        - Track completion status
#        - Validate each step succeeded before continuing
#
#   POST-EPIC PHASE:
#     4. TEA *TR - Traceability gate (requirements coverage)
#     5. TEA *NR - NFR assessment (if --is-last-epic)
#     6. Final validation and Slack notification
#
# STEP VALIDATION:
# - Each pre-epic step must succeed before proceeding to stories
# - Story failures prompt for continue/abort decision
# - Post-epic phase skipped if stories failed
#
# CONTEXT WINDOW HANDLING:
# The CLI with -p (print mode) does NOT auto-compact, so we:
# 1. Use --max-turns to limit each session (default 50)
# 2. Pass --max-turns to story workflows
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

set -e

# Load notification system
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "${SCRIPT_DIR}/notify.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
EPIC_ID="${1:?Usage: $0 <epic-id> [--skip-at] [--skip-rv] [--skip-td] [--skip-pre] [--skip-post] [--start-story N] [--max-turns N] [--max-cr-loops N] [--is-last-epic]}"
SKIP_AT=false
SKIP_RV=false
SKIP_TD=false
SKIP_PRE=false    # Skip pre-epic phase (SM *SP, TEA *TD)
SKIP_POST=false   # Skip post-epic phase (TEA *TR, TEA *NR)
START_STORY=1     # Default: start from story 1
MAX_TURNS=50      # Default: limit each session to 50 turns
MAX_CR_LOOPS=3    # Default: max 3 DEV-CR iterations per story
IS_LAST_EPIC=false  # If true, run TEA *NR after *TR
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLANNING_ARTIFACTS="${PROJECT_ROOT}/_bmad-output/planning-artifacts"
IMPL_ARTIFACTS="${PROJECT_ROOT}/_bmad-output/implementation-artifacts"
LOG_DIR="${PROJECT_ROOT}/logs/workflow"
EPIC_LOG_DIR=""   # Will be set to LOG_DIR/epic-<id>

# V6 Skill paths (full workflow paths)
SKILL_SPRINT_PLANNING="/bmad:bmm:workflows:sprint-planning"
SKILL_TEST_DESIGN="/bmad:bmm:workflows:testarch-test-design"
SKILL_TRACE="/bmad:bmm:workflows:testarch-trace"
SKILL_NFR="/bmad:bmm:workflows:testarch-nfr"
SKILL_RETROSPECTIVE="/bmad:bmm:workflows:retrospective"

# Token tracking configuration
# Claude session files are stored in ~/.claude/projects/<project-hash>/
# We dynamically find the correct directory based on PROJECT_ROOT
CLAUDE_SESSIONS_DIR=""  # Will be set after PROJECT_ROOT is known
TOKEN_WARN_THRESHOLD=150000
TOKEN_ABORT_THRESHOLD=180000

# Epic file location
EPIC_FILE=""

# ============================================================================
# SUBSCRIPTION LIMIT HANDLING (Claude Max/Pro)
# ============================================================================

# Check if we hit a subscription usage limit
check_subscription_limit() {
    local log_file="$1"

    if grep -qiE "usage limit|limit reached|rate limit|try again|session limit|exceeded.*limit" "$log_file" 2>/dev/null; then
        if grep -qiE "weekly|week" "$log_file" 2>/dev/null; then
            return 2  # Weekly limit
        fi
        return 1  # Session limit (5-hour reset)
    fi
    return 0  # No limit hit
}

# Session limit retry configuration
SESSION_RETRY_INTERVAL=300  # 5 minutes in seconds
SESSION_MAX_RETRIES=60      # 60 retries * 5 min = 5 hours coverage

get_session_retry_interval() {
    echo "$SESSION_RETRY_INTERVAL"
}

# Handle session limit - auto-wait and retry
handle_session_limit() {
    local step_name="$1"
    local retry_func="$2"
    local retry_args="$3"

    local wait_seconds=$(get_session_retry_interval)
    local wait_minutes=$((wait_seconds / 60))

    echo -e "${YELLOW}======================================================${NC}"
    echo -e "${YELLOW}  SESSION LIMIT REACHED${NC}"
    echo -e "${YELLOW}  Session resets every 5 hours (rolling window)${NC}"
    echo -e "${YELLOW}  Auto-waiting and will retry every ${wait_minutes} minutes...${NC}"
    echo -e "${YELLOW}======================================================${NC}"

    log "WARN" "Session limit reached for $step_name - entering wait loop"

    local retry_count=0

    while [[ $retry_count -lt $SESSION_MAX_RETRIES ]]; do
        ((retry_count++))
        local elapsed_mins=$((retry_count * wait_minutes))

        echo -e "${CYAN}Retry ${retry_count}/${SESSION_MAX_RETRIES} - Waiting ${wait_minutes} minutes...${NC}"
        log "INFO" "Waiting ${wait_minutes} minutes (retry ${retry_count})"

        local remaining=$wait_seconds
        while [[ $remaining -gt 0 ]]; do
            local mins_left=$((remaining / 60))
            local secs_left=$((remaining % 60))
            printf "\r${BLUE}  Time until retry: %d:%02d${NC}    " "$mins_left" "$secs_left"
            sleep 30
            ((remaining -= 30))
        done
        echo ""

        echo -e "${CYAN}Retrying $step_name...${NC}"

        if $retry_func $retry_args; then
            echo -e "${GREEN}Retry successful after ${elapsed_mins} minutes${NC}"
            log "SUCCESS" "$step_name succeeded after retry ${retry_count}"
            return 0
        fi

        local latest_log="${LOG_DIR}/${EPIC_ID}-${step_name}.log"
        check_subscription_limit "$latest_log"
        local limit_status=$?

        if [[ $limit_status -eq 0 ]]; then
            echo -e "${RED}Step failed with non-rate-limit error${NC}"
            return 1
        elif [[ $limit_status -eq 2 ]]; then
            handle_weekly_limit "$step_name"
            return 1
        fi
        echo -e "${YELLOW}Still rate limited. Continuing to wait...${NC}"
    done

    local total_wait=$((SESSION_MAX_RETRIES * wait_minutes))
    echo -e "${RED}Max retries reached after ${total_wait} minutes.${NC}"
    log "ERROR" "Max retries reached for $step_name"
    return 1
}

# Handle weekly limit - notify only
handle_weekly_limit() {
    local step_name="${1:-unknown}"

    echo -e "${RED}======================================================${NC}"
    echo -e "${RED}  WEEKLY LIMIT REACHED${NC}"
    echo -e "${RED}  Weekly limits reset at a specific day/time.${NC}"
    echo -e "${RED}  Check your Claude subscription status for reset time.${NC}"
    echo -e "${RED}  Workflow paused at: ${step_name}${NC}"
    echo -e "${RED}======================================================${NC}"

    log "ERROR" "Weekly limit reached at $step_name"

    local pause_file="${LOG_DIR}/${EPIC_ID}-pause-state.txt"
    cat > "$pause_file" << EOF
PAUSED_AT=$(date -Iseconds)
REASON=weekly_limit
STEP_NAME=${step_name}
EPIC_ID=${EPIC_ID}
PROJECT_ROOT=${PROJECT_ROOT}
EOF

    notify_weekly_limit "$EPIC_ID" "$step_name"

    echo -e "${YELLOW}Progress saved to: ${pause_file}${NC}"
}

# Parse optional flags
shift
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-at) SKIP_AT=true; shift ;;
        --skip-rv) SKIP_RV=true; shift ;;
        --skip-td) SKIP_TD=true; shift ;;
        --skip-pre) SKIP_PRE=true; shift ;;
        --skip-post) SKIP_POST=true; shift ;;
        --start-story) START_STORY="$2"; shift 2 ;;
        --max-turns) MAX_TURNS="$2"; shift 2 ;;
        --max-cr-loops) MAX_CR_LOOPS="$2"; shift 2 ;;
        --is-last-epic) IS_LAST_EPIC=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Create epic-specific log directory
EPIC_LOG_DIR="${LOG_DIR}/epic-${EPIC_ID}"

# Create directories
mkdir -p "$LOG_DIR"
mkdir -p "$EPIC_LOG_DIR"
mkdir -p "$IMPL_ARTIFACTS/stories"

WORKFLOW_LOG="${EPIC_LOG_DIR}/${EPIC_ID}-epic-$(date +%Y%m%d-%H%M%S).log"

# Set up Claude sessions directory dynamically
# Convert PROJECT_ROOT to the format Claude uses: replace / with - and prepend with -
CLAUDE_PROJECT_HASH=$(echo "$PROJECT_ROOT" | sed 's|^/|-|' | sed 's|/|-|g')
CLAUDE_SESSIONS_DIR="${HOME}/.claude/projects/${CLAUDE_PROJECT_HASH}"

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$WORKFLOW_LOG"
}

log_phase() {
    echo -e "\n${CYAN}======================================================${NC}"
    echo -e "${CYAN}  PHASE: $1${NC}"
    echo -e "${CYAN}======================================================${NC}\n"
    log "PHASE" "$1"
}

# ============================================================================
# STEP OUTPUT VALIDATION (from v4 patterns)
# ============================================================================

# Check step output for errors (even if exit code is 0)
check_step_output() {
    local step_log="$1"
    local step_name="$2"

    if [[ ! -f "$step_log" ]]; then
        return 1
    fi

    # Check for max turns error
    if grep -qi "Reached max turns" "$step_log"; then
        log "ERROR" "$step_name hit max turns limit"
        return 2
    fi

    # Check for subscription limits
    if grep -qiE "you.*(ve|have).*(exceeded|reached).*limit|limit (has been )?(reached|exceeded)" "$step_log" 2>/dev/null; then
        if grep -qiE "weekly.*limit" "$step_log" 2>/dev/null; then
            return 12  # Weekly limit
        fi
        return 11  # Session limit
    fi

    # Check for permission errors
    if grep -qE "EPERM:|EACCES:|Error:.*permission denied" "$step_log"; then
        log "ERROR" "$step_name had permission errors"
        return 3
    fi

    # Check for network errors
    if grep -qE "ECONNREFUSED|ETIMEDOUT|Error:.*network|Error:.*ENOTFOUND" "$step_log"; then
        log "ERROR" "$step_name had network/API errors"
        return 4
    fi

    return 0
}

# ============================================================================
# TOKEN TRACKING FROM CLAUDE SESSION FILES
# ============================================================================

get_latest_session_file() {
    if [[ ! -d "$CLAUDE_SESSIONS_DIR" ]]; then
        echo ""
        return
    fi
    ls -t "${CLAUDE_SESSIONS_DIR}"/*.jsonl 2>/dev/null | grep -v '/agent-' | head -1
}

get_session_token_usage() {
    local session_file="$1"

    LAST_INPUT_TOKENS=0
    LAST_CACHE_TOKENS=0
    LAST_OUTPUT_TOKENS=0

    if [[ ! -f "$session_file" ]]; then
        echo "0"
        return
    fi

    LAST_CACHE_TOKENS=$(grep -o '"cache_read_input_tokens":[0-9]*' "$session_file" 2>/dev/null | \
        cut -d: -f2 | sort -n | tail -1)
    LAST_CACHE_TOKENS=${LAST_CACHE_TOKENS:-0}

    LAST_INPUT_TOKENS=$(grep -o '"input_tokens":[0-9]*' "$session_file" 2>/dev/null | \
        tail -1 | cut -d: -f2)
    LAST_INPUT_TOKENS=${LAST_INPUT_TOKENS:-0}

    LAST_OUTPUT_TOKENS=$(grep -o '"output_tokens":[0-9]*' "$session_file" 2>/dev/null | \
        cut -d: -f2 | awk '{sum+=$1} END {print sum}')
    LAST_OUTPUT_TOKENS=${LAST_OUTPUT_TOKENS:-0}

    local total=$((LAST_CACHE_TOKENS + LAST_INPUT_TOKENS))
    echo "$total"
}

estimate_context_from_log() {
    local log_file="$1"

    local session_file=$(get_latest_session_file)
    if [[ -n "$session_file" ]]; then
        local total_tokens=$(get_session_token_usage "$session_file")
        if [[ "$total_tokens" -gt 0 ]]; then
            local total_k=$((total_tokens / 1000))
            echo "${total_k}K tokens"
            return
        fi
    fi

    if [[ -f "$log_file" ]]; then
        local size_bytes=$(wc -c < "$log_file" | tr -d ' ')
        local est_tokens=$((size_bytes / 4))
        local est_k=$((est_tokens / 1000))
        echo "${est_k}K tokens (est)"
        return
    fi

    echo "0K"
}

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

        local token_log="${LOG_DIR}/${EPIC_ID}-tokens.log"
        echo "$(date '+%Y-%m-%d %H:%M:%S') | $step_name | total: ${total} | cache: ${LAST_CACHE_TOKENS} | input: ${LAST_INPUT_TOKENS} | output: ${LAST_OUTPUT_TOKENS}" >> "$token_log"
    fi
}

# Internal function to execute a single Claude step
_execute_claude_step() {
    local skill="$1"
    local command="$2"
    local step_name="$3"
    local step_log="${EPIC_LOG_DIR}/${EPIC_ID}-${step_name}.log"

    local prompt
    if [[ "$command" == *"*"* ]]; then
        prompt="Run the skill ${skill}.

BATCH MODE - SKIP MENU DISPLAY:
- Do NOT display the agent greeting or menu
- Do NOT wait for user input
- Immediately execute command: ${command}
- Epic ID: ${EPIC_ID}

Execute the workflow instructions exactly. When complete, provide a brief summary."
    else
        prompt="Run the skill ${skill}. ${command}"
    fi

    if (cd "$PROJECT_ROOT" && claude -p --dangerously-skip-permissions --max-turns "$MAX_TURNS" "$prompt") > "$step_log" 2>&1; then
        return 0
    else
        return $?
    fi
}

# Run Claude Code with a specific skill and command
# Returns: 0 = success, non-zero = failure
# Includes output validation to catch errors even when exit code is 0
run_claude_step() {
    local skill="$1"
    local command="$2"
    local step_name="$3"
    local step_log="${EPIC_LOG_DIR}/${EPIC_ID}-${step_name}.log"

    log "INFO" "Running: $skill -> $command (max-turns: $MAX_TURNS)"
    echo -e "${YELLOW}Running Claude Code (max $MAX_TURNS turns)...${NC}"

    if _execute_claude_step "$skill" "$command" "$step_name"; then
        # Check output even on success (v4 pattern)
        check_step_output "$step_log" "$step_name"
        local check_result=$?

        if [[ $check_result -eq 11 ]]; then
            echo -e "${YELLOW}Detected session rate limit. Entering auto-retry mode...${NC}"
            if handle_session_limit "$step_name" "_execute_claude_step" "$skill $command $step_name"; then
                log "SUCCESS" "$step_name completed after rate limit wait"
                echo -e "${GREEN}✓ $step_name completed (after rate limit wait)${NC}"
                return 0
            fi
            return 1
        elif [[ $check_result -eq 12 ]]; then
            handle_weekly_limit "$step_name"
            return 1
        elif [[ $check_result -ne 0 ]]; then
            log "ERROR" "$step_name completed but had errors (code: $check_result)"
            echo -e "${RED}✗ $step_name had errors${NC}"
            tail -10 "$step_log" | sed 's/^/  /'
            return $check_result
        fi

        local context_est=$(estimate_context_from_log "$step_log")
        log_token_usage "$step_name"

        log "SUCCESS" "$step_name completed [$context_est]"
        echo -e "${GREEN}✓ $step_name completed${NC} ${BLUE}[$context_est]${NC}"

        echo -e "${BLUE}Last output:${NC}"
        tail -5 "$step_log" | sed 's/^/  /'

        return 0
    fi

    # Step failed
    local exit_code=$?
    log "ERROR" "$step_name failed with exit code $exit_code"

    # Check for rate limits
    check_step_output "$step_log" "$step_name"
    local check_result=$?

    if [[ $check_result -eq 11 ]]; then
        echo -e "${YELLOW}Detected session rate limit. Entering auto-retry mode...${NC}"
        if handle_session_limit "$step_name" "_execute_claude_step" "$skill $command $step_name"; then
            local context_est=$(estimate_context_from_log "$step_log")
            log_token_usage "$step_name"
            log "SUCCESS" "$step_name completed after rate limit wait [$context_est]"
            echo -e "${GREEN}✓ $step_name completed (after rate limit wait)${NC}"
            return 0
        else
            return 1
        fi
    elif [[ $check_result -eq 12 ]]; then
        handle_weekly_limit "$step_name"
        return 1
    fi

    echo -e "${RED}✗ $step_name failed (exit code: $exit_code)${NC}"
    echo -e "${RED}See log: $step_log${NC}"
    tail -10 "$step_log" | sed 's/^/  /'

    return $exit_code
}

# Find and validate epic file exists
# Checks: _bmad-output/implementation-artifacts/epics/<epic-id>*.md
find_epic_file() {
    local epic_dir="${IMPL_ARTIFACTS}/epics"

    # Pattern 1: Exact match with .md extension
    if [[ -f "${epic_dir}/${EPIC_ID}.md" ]]; then
        EPIC_FILE="${epic_dir}/${EPIC_ID}.md"
        log "INFO" "Found epic file: $EPIC_FILE"
        return 0
    fi

    # Pattern 2: Match with name suffix (e.g., 2-sync-infrastructure.md)
    for f in "${epic_dir}/${EPIC_ID}"*.md; do
        if [[ -f "$f" ]]; then
            EPIC_FILE="$f"
            log "INFO" "Found epic file: $EPIC_FILE"
            return 0
        fi
    done

    # Pattern 3: Match with epic- prefix
    for f in "${epic_dir}/epic-${EPIC_ID}"*.md; do
        if [[ -f "$f" ]]; then
            EPIC_FILE="$f"
            log "INFO" "Found epic file: $EPIC_FILE"
            return 0
        fi
    done

    log "ERROR" "Epic file not found in: $epic_dir"
    return 1
}

# Extract story IDs from epic file
get_stories_from_epic() {
    if [[ -z "$EPIC_FILE" || ! -f "$EPIC_FILE" ]]; then
        log "ERROR" "Epic file not set or not found"
        return 1
    fi

    # Extract story IDs from the epic file
    # Looking for patterns like: id: E01-S01 or - id: S-01-001 or 1-1, 1-2, etc.
    grep -oE '(E[0-9]+-S[0-9]+|S-[0-9]+-[0-9]+|[0-9]+-[0-9]+)' "$EPIC_FILE" | sort -u
}

# Check if all stories are done
check_all_stories_done() {
    local sprint_status="${IMPL_ARTIFACTS}/sprint-status.yaml"

    if [[ ! -f "$sprint_status" ]]; then
        log "WARN" "Sprint status file not found"
        return 1
    fi

    if grep -A5 "epic: ${EPIC_ID}" "$sprint_status" | grep -qE "status: (draft|ready|in-progress|review)"; then
        return 1  # Not all done
    fi
    return 0  # All done
}

# Main workflow execution
main() {
    log "INFO" "Starting V6 Epic Workflow for ${EPIC_ID}"
    log "INFO" "Project root: ${PROJECT_ROOT}"
    log "INFO" "Flags - Skip AT: ${SKIP_AT}, Skip RV: ${SKIP_RV}, Skip TD: ${SKIP_TD}, Skip Pre: ${SKIP_PRE}, Skip Post: ${SKIP_POST}, Is Last Epic: ${IS_LAST_EPIC}"
    log "INFO" "Start from story: ${START_STORY}, Max turns: ${MAX_TURNS}, Max CR loops: ${MAX_CR_LOOPS}"

    echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  V6 EPIC WORKFLOW: ${EPIC_ID}${NC}"
    echo -e "${GREEN}║  (with pre/post epic phases + DEV-CR loop)${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}\n"

    # =========================================================================
    # VALIDATE EPIC FILE EXISTS
    # =========================================================================
    echo -e "${BLUE}Validating epic file exists...${NC}"
    if ! find_epic_file; then
        echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║  ERROR: Epic file not found!${NC}"
        echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
        echo -e "${RED}Expected location: ${IMPL_ARTIFACTS}/epics/${EPIC_ID}*.md${NC}"
        echo -e "${YELLOW}Available epic files:${NC}"
        ls -la "${IMPL_ARTIFACTS}/epics/"*.md 2>/dev/null || echo "  (none found)"
        notify_failed "$EPIC_ID" "Epic file not found in ${IMPL_ARTIFACTS}/epics/"
        exit 1
    fi
    echo -e "${GREEN}✓ Found epic file: ${EPIC_FILE}${NC}"
    log "INFO" "Epic file validated: ${EPIC_FILE}"

    # Track story results for post-epic decisions
    local completed_stories=()
    local failed_stories=()
    local skipped_stories=()

    # =========================================================================
    # PRE-EPIC PHASE: SM *SP + TEA *TD
    # =========================================================================
    if [[ "$SKIP_PRE" == "true" ]]; then
        echo -e "${YELLOW}Skipping pre-epic phase (--skip-pre flag)${NC}"
        log "INFO" "Pre-epic phase skipped by flag"
    else
        # Phase 1A: SM *SP - Sprint Planning (FIRST - generates sprint-status.yaml)
        log_phase "1A: SM *SP - Sprint Planning"
        echo -e "${CYAN}This step extracts stories from epic and creates sprint-status.yaml${NC}"
        if ! run_claude_step "$SKILL_SPRINT_PLANNING" "${EPIC_ID}" "sm-sprint-planning"; then
            echo -e "${RED}SM *SP failed${NC}"
            log "ERROR" "SM sprint-planning failed for epic ${EPIC_ID}"
            notify_failed "$EPIC_ID" "SM *SP (sprint-planning) failed. Cannot proceed with epic."
            exit 1
        fi
        echo -e "${GREEN}✓ SM *SP completed - sprint-status.yaml created${NC}"

        # Brief pause between pre-epic steps
        sleep 3

        # Phase 1B: TEA *TD - Epic-level Test Design (SECOND)
        if [[ "$SKIP_TD" == "false" ]]; then
            log_phase "1B: TEA *TD - Epic Test Design"
            echo -e "${CYAN}This step creates epic-level test plan and testing strategy${NC}"
            if ! run_claude_step "$SKILL_TEST_DESIGN" "${EPIC_ID}" "tea-test-design"; then
                echo -e "${RED}TEA *TD failed${NC}"
                log "ERROR" "TEA test-design failed for epic ${EPIC_ID}"
                notify_failed "$EPIC_ID" "TEA *TD (test-design) failed. Cannot proceed with epic."
                exit 1
            fi
            echo -e "${GREEN}✓ TEA *TD completed - test plan created${NC}"
        else
            log_phase "1B: TEA *TD - SKIPPED (--skip-td flag)"
        fi

        # Brief pause before story loop
        echo -e "${BLUE}Pausing 5 seconds before starting story loop...${NC}"
        sleep 5
    fi

    # =========================================================================
    # STORY LOOP PHASE (with DEV-CR loop per story)
    # =========================================================================
    log_phase "2: Story Execution Loop"

    local stories=($(get_stories_from_epic))
    local story_count=${#stories[@]}
    local current=1

    log "INFO" "Found ${story_count} stories in epic ${EPIC_ID}"
    echo -e "${BLUE}Each story will run DEV-CR loop (max ${MAX_CR_LOOPS} iterations)${NC}"

    # Send start notification
    notify "needs_fixes" "$EPIC_ID" "Starting epic with ${story_count} stories. DEV-CR loop: max ${MAX_CR_LOOPS} iterations per story."

    if [[ "$START_STORY" -gt 1 ]]; then
        echo -e "${YELLOW}Resuming from Story $START_STORY (skipping stories 1-$((START_STORY-1)))${NC}"
        log "INFO" "Resuming from Story $START_STORY"
    fi

    for story_id in "${stories[@]}"; do
        # Skip stories before START_STORY
        if [[ $current -lt $START_STORY ]]; then
            echo -e "${BLUE}Skipping story ${current}/${story_count}: ${story_id} (resuming from ${START_STORY})${NC}"
            skipped_stories+=("$story_id")
            ((current++))
            continue
        fi

        echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${YELLOW}  Story ${current}/${story_count}: ${story_id}${NC}"
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
        log "INFO" "Processing story ${story_id} (${current}/${story_count})"

        # Build story workflow flags - pass through all relevant flags
        local story_flags=""
        [[ "$SKIP_AT" == "true" ]] && story_flags="$story_flags --skip-at"
        [[ "$SKIP_RV" == "true" ]] && story_flags="$story_flags --skip-rv"
        story_flags="$story_flags --max-turns $MAX_TURNS"
        story_flags="$story_flags --max-cr-loops $MAX_CR_LOOPS"

        # Run story workflow (includes DEV-CR loop)
        if "${SCRIPT_DIR}/v6-story-workflow.sh" "$story_id" $story_flags; then
            log "SUCCESS" "Story ${story_id} completed"
            completed_stories+=("$story_id")
        else
            local exit_code=$?
            log "ERROR" "Story ${story_id} failed with exit code $exit_code"
            failed_stories+=("$story_id")

            if [[ $exit_code -eq 2 ]]; then
                # MAJOR_REWORK exit code
                notify_failed "$story_id" "Story requires MAJOR_REWORK during epic ${EPIC_ID}"
                echo -e "${RED}Story ${story_id} requires MAJOR_REWORK (human review needed)${NC}"
            else
                notify_failed "$story_id" "Story failed during epic ${EPIC_ID} execution"
            fi

            echo -e "${RED}Story ${story_id} failed. Continue with next story? (y/n)${NC}"
            read -r response
            if [[ "$response" != "y" ]]; then
                log "ERROR" "Epic workflow aborted by user"
                notify_failed "$EPIC_ID" "Epic workflow aborted at story ${story_id}"
                exit 1
            fi
        fi

        ((current++))

        # Brief pause between stories
        echo -e "${BLUE}Pausing 5 seconds before next story...${NC}"
        sleep 5
    done

    # =========================================================================
    # POST-EPIC PHASE: TEA *TR (+ optional *NR for last epic)
    # =========================================================================
    if [[ "$SKIP_POST" == "true" ]]; then
        echo -e "${YELLOW}Skipping post-epic phase (--skip-post flag)${NC}"
        log "INFO" "Post-epic phase skipped by flag"
    elif [[ ${#failed_stories[@]} -gt 0 ]]; then
        echo -e "${YELLOW}Skipping post-epic phase due to ${#failed_stories[@]} failed stories${NC}"
        log "WARN" "Post-epic phase skipped - ${#failed_stories[@]} stories failed"
    else
        # Phase 3: TEA *TR - Traceability Gate (EPIC-LEVEL FINAL TEST)
        log_phase "3: TEA *TR - Epic Traceability & Quality Gate"
        echo -e "${CYAN}This is the EPIC-LEVEL FINAL TEST - validates all requirements traced to tests${NC}"
        if ! run_claude_step "$SKILL_TRACE" "${EPIC_ID}" "tea-trace"; then
            echo -e "${YELLOW}TEA *TR had issues, continuing to summary...${NC}"
            log "WARN" "TEA trace had issues for epic ${EPIC_ID}"
        else
            echo -e "${GREEN}✓ TEA *TR completed${NC}"

            # Check gate result
            local gate_log="${EPIC_LOG_DIR}/${EPIC_ID}-tea-trace.log"
            if grep -qi "FAIL" "$gate_log"; then
                log "ERROR" "Quality gate FAILED - review required"
                echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
                echo -e "${RED}║  QUALITY GATE: FAIL${NC}"
                echo -e "${RED}║  Review: ${gate_log}${NC}"
                echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
                notify_failed "$EPIC_ID" "Quality gate (TEA *TR) failed. Review required."
            elif grep -qi "CONCERNS" "$gate_log"; then
                log "WARN" "Quality gate passed with CONCERNS"
                echo -e "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
                echo -e "${YELLOW}║  QUALITY GATE: PASS (with concerns)${NC}"
                echo -e "${YELLOW}║  Review recommended${NC}"
                echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
            else
                log "SUCCESS" "Quality gate PASSED"
                echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
                echo -e "${GREEN}║  QUALITY GATE: PASS${NC}"
                echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
            fi
        fi

        # Brief pause
        sleep 3

        # Phase 4: TEA *NR - NFR Assessment (if last epic - comprehensive non-functional review)
        if [[ "$IS_LAST_EPIC" == "true" ]]; then
            log_phase "4: TEA *NR - NFR Assessment (Last Epic - Production Readiness)"
            echo -e "${CYAN}This is the FINAL NFR CHECK - performance, security, reliability${NC}"
            run_claude_step "$SKILL_NFR" "${EPIC_ID}" "tea-nfr" || log "WARN" "NFR assessment had issues, continuing..."
        else
            log_phase "4: TEA *NR - SKIPPED (not last epic)"
            log "INFO" "NFR assessment skipped - use --is-last-epic flag if this is the final epic"
        fi

        # Phase 5: Retrospective (optional, after successful epic)
        log_phase "5: Retrospective"
        echo -e "${CYAN}Running epic retrospective to capture lessons learned${NC}"
        run_claude_step "$SKILL_RETROSPECTIVE" "${EPIC_ID}" "retrospective" || log "WARN" "Retrospective had issues, continuing..."
    fi

    # =========================================================================
    # FINAL SUMMARY AND NOTIFICATION
    # =========================================================================
    log_phase "FINAL: Epic Summary"

    local completed_count=${#completed_stories[@]}
    local failed_count=${#failed_stories[@]}
    local skipped_count=${#skipped_stories[@]}

    echo -e "${BLUE}Epic Summary:${NC}"
    echo -e "  Total stories:     ${story_count}"
    echo -e "  Completed:         ${completed_count}"
    echo -e "  Skipped (resume):  ${skipped_count}"
    echo -e "  Failed:            ${failed_count}"
    echo -e "  DEV-CR loop max:   ${MAX_CR_LOOPS} iterations per story"
    echo -e "  Pre-epic phase:    $([ "$SKIP_PRE" == "true" ] && echo "skipped" || echo "completed")"
    echo -e "  Post-epic phase:   $([ "$SKIP_POST" == "true" ] && echo "skipped" || ([ ${#failed_stories[@]} -gt 0 ] && echo "skipped (failures)" || echo "completed"))"

    local summary="Epic ${EPIC_ID} workflow complete.\n"
    summary="${summary}Total: ${story_count} stories\n"
    summary="${summary}Completed: ${completed_count}\n"
    summary="${summary}Skipped: ${skipped_count}\n"
    summary="${summary}Failed: ${failed_count}\n"
    summary="${summary}DEV-CR loop: max ${MAX_CR_LOOPS} iterations\n"
    summary="${summary}Pre-epic: $([ "$SKIP_PRE" == "true" ] && echo "skipped" || echo "completed")\n"
    summary="${summary}Post-epic: $([ "$SKIP_POST" == "true" ] && echo "skipped" || ([ ${#failed_stories[@]} -gt 0 ] && echo "skipped (failures)" || echo "completed"))"

    if [[ ${#failed_stories[@]} -gt 0 ]]; then
        summary="${summary}\n\nFailed stories:"
        for s in "${failed_stories[@]}"; do
            summary="${summary}\n- ${s}"
        done
    fi

    if [[ $failed_count -eq 0 ]]; then
        echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  EPIC COMPLETE: ${EPIC_ID}${NC}"
        echo -e "${GREEN}║  All ${story_count} stories done!${NC}"
        echo -e "${GREEN}║  Quality gate: PASSED${NC}"
        echo -e "${GREEN}║  Log: ${WORKFLOW_LOG}${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}\n"

        notify_complete "$EPIC_ID" "$summary"
        log "SUCCESS" "V6 Epic Workflow completed for ${EPIC_ID}"
    else
        echo -e "\n${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║  EPIC INCOMPLETE: ${EPIC_ID}${NC}"
        echo -e "${YELLOW}║  ${failed_count} stories failed${NC}"
        echo -e "${YELLOW}║  Log: ${WORKFLOW_LOG}${NC}"
        echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}\n"

        notify_failed "$EPIC_ID" "$summary"
        log "WARN" "V6 Epic Workflow incomplete for ${EPIC_ID} - ${failed_count} stories failed"
    fi

    log "INFO" "Full log: ${WORKFLOW_LOG}"
}

# Run main
main "$@"
