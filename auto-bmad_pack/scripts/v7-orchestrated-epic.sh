#!/bin/bash
# V7 Orchestrated Epic Workflow - Executes full BMAD epic lifecycle with intelligent orchestration
# Usage: ./v7-orchestrated-epic.sh <epic-id> [options]
#
# V7 Epic Flow (Enhanced with Orchestration):
#   PRE-EPIC PHASE:
#     1. SM  *SP - Sprint planning and status setup
#     2. TEA *TD - Epic-level test design (test planning)
#     3. Pre-validation of ALL stories (assess complexity upfront)
#
#   STORY LOOP (Orchestrated):
#     4. For each story: v7-orchestrated-workflow.sh
#        - Pre-validation per story (already done at epic level, but double-check)
#        - Intelligent retry/split/escalate decisions
#        - State persistence for resume capability
#
#   POST-EPIC PHASE:
#     5. TEA *TR - Traceability gate (requirements coverage)
#     6. TEA *NR - NFR assessment (if --is-last-epic)
#     7. Retrospective
#     8. Epic completion Slack notification
#
# ORCHESTRATION FEATURES:
# - Epic-level state file tracking all story attempts and decisions
# - Cross-story dependency detection (won't start story B if A failed and B depends on A)
# - Slack notifications for epic start, story completions, and epic completion
# - Resume capability from epic state file
#
# OPTIONS:
#   --skip-at            Skip acceptance tests
#   --skip-rv            Skip review phase
#   --skip-td            Skip test design phase
#   --skip-pre           Skip pre-epic phase (SM *SP, TEA *TD)
#   --skip-post          Skip post-epic phase (TEA *TR, TEA *NR)
#   --start-story N      Resume from story N
#   --stop-after-story X Stop after completing story X (e.g., 1-2-role-based-access)
#   --max-turns N        Max turns per Claude session (default: 50)
#   --max-cr-loops N     Max DEV-CR iterations per story (default: 3)
#   --is-last-epic       Run TEA *NR after *TR
#   --resume             Resume from epic state file
#   --validate-only      Validate story sources without executing (check epic registry vs files)
#   --sync-from-epic     Sync sprint-status.yaml FROM epic file's story_registry
#   --run-tests          Run post-epic testing after story loop (build, backend, frontend)
#   --test-frontend-url  Frontend URL for tests
#   --test-api-url       API URL for tests
#   --fix-test-bugs      Auto-fix bugs discovered during testing
#   --create-test-stories Create stories for missing functionality found during testing
#
# STORY SOURCE PRIORITY (for determining which stories to run):
#   1. Epic file's story_registry (YAML frontmatter) - canonical source of truth
#   2. Story files in stories/ directory - for existing implementations
#   3. Sprint-status.yaml - fallback for legacy workflows
#
# EPIC FILE FORMAT:
#   Epic files should have YAML frontmatter with a story_registry section:
#   ---
#   epic_id: "3"
#   story_registry:
#     - id: "3-1"
#       slug: "ocr-processing-pipeline"
#       title: "OCR Processing Pipeline"
#       status: "done"
#       frs: ["FR9", "FR9a"]
#       depends_on: []
#   ---

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load notification system
[[ -f "${SCRIPT_DIR}/notify.sh" ]] && source "${SCRIPT_DIR}/notify.sh" || true

# Load secrets for Slack
CONFIG_DIR="${SCRIPT_DIR}/../config"
SECRETS_FILE="${CONFIG_DIR}/.bmad-secrets"
if [[ -f "$SECRETS_FILE" ]]; then
    source "$SECRETS_FILE"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Configuration
EPIC_ID="${1:?Usage: $0 <epic-id> [options]}"
SKIP_AT=false
SKIP_RV=false
SKIP_TD=false
SKIP_PRE=false
SKIP_POST=false
START_STORY=1
STOP_AFTER_STORY=""
MAX_TURNS=75
MAX_CR_LOOPS=3
STEP_TIMEOUT=900  # 15 minutes for pre/post epic Claude steps
IS_LAST_EPIC=false
RESUME_FROM_STATE=false

# Post-epic testing options
RUN_TESTS=false
TEST_FRONTEND_URL=""
TEST_API_URL=""
FIX_TEST_BUGS=false
CREATE_TEST_STORIES=false

PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PLANNING_ARTIFACTS="${PROJECT_ROOT}/_bmad-output/planning-artifacts"
IMPL_ARTIFACTS="${PROJECT_ROOT}/_bmad-output/implementation-artifacts"
LOG_DIR="${PROJECT_ROOT}/logs/workflow"
EPIC_LOG_DIR=""
STATE_DIR="${LOG_DIR}/orchestrator-state"

# BMAD agent paths (activate first)
AGENT_SM="/bmad:bmm:agents:sm"
AGENT_TEA="/bmad:bmm:agents:tea"

# BMAD workflow paths (invoke after agent)
WORKFLOW_SPRINT_PLANNING="/bmad:bmm:workflows:sprint-planning"
WORKFLOW_TEST_DESIGN="/bmad:bmm:workflows:testarch-test-design"
WORKFLOW_TRACE="/bmad:bmm:workflows:testarch-trace"
WORKFLOW_NFR="/bmad:bmm:workflows:testarch-nfr"
WORKFLOW_RETROSPECTIVE="/bmad:bmm:workflows:retrospective"

# Wait for Slack proceed signal
PROCEED_WAIT_DIR="${LOG_DIR}/proceed-signals"
PROCEED_POLL_INTERVAL=30  # seconds

# Epic file location
EPIC_FILE=""
EPIC_STATE_FILE=""

# Sprint status file (primary source of truth for stories)
SPRINT_STATUS_FILE="${IMPL_ARTIFACTS}/sprint-status.yaml"

# New validation/sync modes
VALIDATE_ONLY=false
SYNC_FROM_EPIC=false

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
        --stop-after-story) STOP_AFTER_STORY="$2"; shift 2 ;;
        --max-turns) MAX_TURNS="$2"; shift 2 ;;
        --max-cr-loops) MAX_CR_LOOPS="$2"; shift 2 ;;
        --is-last-epic) IS_LAST_EPIC=true; shift ;;
        --resume) RESUME_FROM_STATE=true; shift ;;
        --validate-only) VALIDATE_ONLY=true; shift ;;
        --sync-from-epic) SYNC_FROM_EPIC=true; shift ;;
        --run-tests) RUN_TESTS=true; shift ;;
        --test-frontend-url) TEST_FRONTEND_URL="$2"; shift 2 ;;
        --test-api-url) TEST_API_URL="$2"; shift 2 ;;
        --fix-test-bugs) FIX_TEST_BUGS=true; shift ;;
        --create-test-stories) CREATE_TEST_STORIES=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Create directories
EPIC_LOG_DIR="${LOG_DIR}/epic-${EPIC_ID}"
mkdir -p "$LOG_DIR"
mkdir -p "$EPIC_LOG_DIR"
mkdir -p "$STATE_DIR"
mkdir -p "$PROCEED_WAIT_DIR"
mkdir -p "$IMPL_ARTIFACTS/stories"

WORKFLOW_LOG="${EPIC_LOG_DIR}/${EPIC_ID}-epic-v7-$(date +%Y%m%d-%H%M%S).log"
EPIC_STATE_FILE="${STATE_DIR}/${EPIC_ID}-epic-orchestrator-state.yaml"

# ============================================================================
# LOGGING
# ============================================================================

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

# Format duration in seconds to human-readable string (e.g., "1h 23m 45s")
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
# USAGE TRACKING (via ccusage)
# ============================================================================

# Query usage for today using ccusage
# Returns: tokens|cost (pipe-separated)
query_ccusage_today() {
    local today
    today=$(date -u +"%Y%m%d")
    local usage_output

    # Try ccusage (prefer global install, fallback to npx with timeout)
    if command -v ccusage &> /dev/null; then
        usage_output=$(timeout 15 ccusage daily --json --since "$today" 2>/dev/null) || {
            echo "0|0.00"
            return
        }
    else
        usage_output=$(timeout 30 npx ccusage@latest daily --json --since "$today" 2>/dev/null) || {
            echo "0|0.00"
            return
        }
    fi

    # Parse JSON output for totals
    local tokens cost
    tokens=$(echo "$usage_output" | grep -oE '"totalTokens":\s*[0-9]+' | head -1 | grep -oE '[0-9]+' || echo 0)
    cost=$(echo "$usage_output" | grep -oE '"totalCost":\s*[0-9.]+' | head -1 | grep -oE '[0-9.]+' || echo "0.00")

    echo "${tokens}|${cost}"
}

# Format token count for display (e.g., 1250000 -> "1.25M")
format_tokens() {
    local tokens="$1"
    if [[ "$tokens" -ge 1000000 ]]; then
        awk -v t="$tokens" 'BEGIN { printf "%.2fM", t/1000000 }'
    elif [[ "$tokens" -ge 1000 ]]; then
        awk -v t="$tokens" 'BEGIN { printf "%.1fK", t/1000 }'
    else
        echo "$tokens"
    fi
}

# Calculate usage delta between two measurements
# Args: prev_tokens, prev_cost, curr_tokens, curr_cost
# Returns: delta_tokens|delta_cost
calc_usage_delta() {
    local prev_tokens="${1:-0}"
    local prev_cost="${2:-0.00}"
    local curr_tokens="${3:-0}"
    local curr_cost="${4:-0.00}"

    local delta_tokens=$((curr_tokens - prev_tokens))
    local delta_cost
    delta_cost=$(awk -v c="$curr_cost" -v p="$prev_cost" 'BEGIN { printf "%.2f", c - p }')

    # Handle negative (shouldn't happen but be safe)
    [[ $delta_tokens -lt 0 ]] && delta_tokens=0

    echo "${delta_tokens}|${delta_cost}"
}

# ============================================================================
# RATE LIMIT DETECTION & WAITING
# ============================================================================
# Checks workflow logs for rate limit message and waits until reset
# Usage: check_rate_limit_in_story_logs <story_id>
# Returns: 0 if rate limit found and waited, 1 if no rate limit found
check_rate_limit_in_story_logs() {
    local story_id="$1"

    # Find the workflow log directory for this story
    # LOG_DIR is typically {PROJECT_ROOT}/logs/workflow
    local workflow_log_dir="${LOG_DIR}/${story_id}"
    if [[ ! -d "$workflow_log_dir" ]]; then
        # Try alternative naming patterns (story ID might have different format)
        local story_slug
        story_slug=$(echo "$story_id" | tr '.' '-')
        workflow_log_dir=$(find "${LOG_DIR}" -maxdepth 1 -type d -name "${story_slug}*" 2>/dev/null | head -1)
    fi
    if [[ ! -d "$workflow_log_dir" ]]; then
        # Also check auto-bmad_pack/logs/workflow
        local auto_bmad_log_dir="${SCRIPT_DIR}/../logs/workflow"
        workflow_log_dir=$(find "$auto_bmad_log_dir" -maxdepth 1 -type d -name "*${story_id}*" 2>/dev/null | head -1)
    fi

    if [[ -z "$workflow_log_dir" ]] || [[ ! -d "$workflow_log_dir" ]]; then
        return 1  # No log directory found
    fi

    # Check all log files in the directory for rate limit message
    local rate_limit_log
    rate_limit_log=$(grep -l "You've hit your limit" "$workflow_log_dir"/*.log 2>/dev/null | head -1)

    if [[ -z "$rate_limit_log" ]]; then
        return 1  # No rate limit found
    fi

    # Extract the reset time and timezone
    local reset_info
    reset_info=$(grep "You've hit your limit" "$rate_limit_log" | head -1 | sed -n 's/.*resets \([0-9]*[ap]m\) (\([^)]*\)).*/\1 \2/p')

    if [[ -z "$reset_info" ]]; then
        log "ERROR" "Rate limit detected in $rate_limit_log but couldn't parse reset time"
        echo -e "${RED}⚠ RATE LIMIT HIT - could not parse reset time${NC}"
        echo -e "${YELLOW}Waiting 1 hour before retry...${NC}"
        send_slack_notification "simple" "⚠️ RATE LIMIT HIT - Waiting 1 hour (could not parse reset time)"
        sleep 3600
        return 0
    fi

    local reset_time=$(echo "$reset_info" | awk '{print $1}')
    local timezone=$(echo "$reset_info" | awk '{print $2}')

    log "WARN" "RATE LIMIT DETECTED - resets at $reset_time ($timezone)"
    echo -e "\n${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ⚠ CLAUDE CODE RATE LIMIT HIT${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  Limit resets at: ${CYAN}$reset_time ($timezone)${NC}"

    send_slack_notification "simple" "⚠️ RATE LIMIT HIT - Epic ${EPIC_ID} paused until $reset_time ($timezone)"

    # Calculate seconds until reset
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

    # Get current time in the target timezone
    local current_epoch reset_epoch wait_secs

    if command -v gdate &>/dev/null; then
        current_epoch=$(gdate +%s)
        reset_epoch=$(TZ="$timezone" gdate -d "today ${reset_hour}:00" +%s 2>/dev/null || echo "")

        if [[ -n "$reset_epoch" ]] && [[ $reset_epoch -le $current_epoch ]]; then
            reset_epoch=$(TZ="$timezone" gdate -d "tomorrow ${reset_hour}:00" +%s 2>/dev/null || echo "")
        fi
    fi

    if [[ -z "$reset_epoch" ]] || [[ "$reset_epoch" == "" ]]; then
        # Fallback calculation
        local current_hour=$(date +%H)
        local wait_hours

        if [[ $reset_hour -gt $current_hour ]]; then
            wait_hours=$((reset_hour - current_hour))
        else
            wait_hours=$((24 - current_hour + reset_hour))
        fi

        wait_secs=$((wait_hours * 3600))
        echo -e "${YELLOW}  Waiting approximately ${wait_hours} hours...${NC}"
        log "INFO" "Rate limit: waiting ${wait_hours} hours (${wait_secs} seconds)"
    else
        wait_secs=$((reset_epoch - current_epoch + 60))  # Add 1 min buffer
        local wait_mins=$((wait_secs / 60))
        local wait_hours=$((wait_mins / 60))
        local remaining_mins=$((wait_mins % 60))

        echo -e "${YELLOW}  Waiting ${wait_hours}h ${remaining_mins}m until reset...${NC}"
        log "INFO" "Rate limit: waiting ${wait_secs} seconds"
    fi

    # Wait with periodic status updates
    local waited=0
    while [[ $waited -lt $wait_secs ]]; do
        local remaining=$((wait_secs - waited))
        local remaining_mins=$((remaining / 60))
        local remaining_hours=$((remaining_mins / 60))
        remaining_mins=$((remaining_mins % 60))
        echo -ne "\r${CYAN}  ⏳ Rate limit reset in: ${remaining_hours}h ${remaining_mins}m   ${NC}"
        sleep 300  # Update every 5 minutes
        waited=$((waited + 300))
    done
    echo ""

    echo -e "${GREEN}✓ Rate limit should be reset - resuming epic workflow${NC}"
    log "INFO" "Rate limit wait complete - resuming"
    send_slack_notification "simple" "✅ Rate limit reset - Epic ${EPIC_ID} resuming"

    return 0
}

# ============================================================================
# SLACK INTEGRATION
# ============================================================================

send_slack_notification() {
    local message_type="$1"
    shift

    if [[ "${BMAD_SLACK_ENABLED:-true}" != "true" ]]; then
        log "INFO" "Slack notifications disabled"
        return 0
    fi

    if [[ -z "${BMAD_SLACK_WEBHOOK:-}" ]]; then
        log "WARN" "Slack webhook not configured - notification skipped"
        return 0
    fi

    local payload
    payload=$("${SCRIPT_DIR}/format-slack-message.sh" "$message_type" "$@")

    if curl -s -X POST -H 'Content-type: application/json' \
        --data "$payload" \
        "${BMAD_SLACK_WEBHOOK}" > /dev/null 2>&1; then
        log "INFO" "Slack notification sent: $message_type"
    else
        log "WARN" "Failed to send Slack notification"
    fi
}

# ============================================================================
# WAIT FOR PROCEED SIGNAL (Web-based via npoint.io or local file)
# ============================================================================

wait_for_proceed_web() {
    local story_id="$1"

    if [[ -z "${BMAD_NPOINT_API_URL:-}" ]]; then
        log "ERROR" "BMAD_NPOINT_API_URL not configured"
        return 1
    fi

    local edit_url="${BMAD_NPOINT_EDIT_URL:-https://www.npoint.io}"

    # Auto-populate npoint with story ID and clear proceed
    curl -s -X POST "${BMAD_NPOINT_API_URL}" \
        -H "Content-Type: application/json" \
        -d "{\"story\":\"${story_id}\",\"proceed\":\"\"}" > /dev/null 2>&1 || true

    echo -e "\n${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  WAITING FOR PROCEED SIGNAL                                ║${NC}"
    echo -e "${YELLOW}╠════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${YELLOW}║  Story: ${CYAN}${story_id}${YELLOW}${NC}"
    echo -e "${YELLOW}╠════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${YELLOW}║  Options (set 'proceed' to one of these):                  ║${NC}"
    echo -e "${YELLOW}║                                                            ║${NC}"
    echo -e "${YELLOW}║    ${CYAN}retry${YELLOW}  - Retry the same story                         ║${NC}"
    echo -e "${YELLOW}║    ${CYAN}split${YELLOW}  - Retry (auto-split happens on complexity fail)║${NC}"
    echo -e "${YELLOW}║    ${CYAN}skip${YELLOW}   - Skip this story and move to next             ║${NC}"
    echo -e "${YELLOW}║    ${CYAN}stop${YELLOW}   - Stop the entire workflow                     ║${NC}"
    echo -e "${YELLOW}║                                                            ║${NC}"
    echo -e "${YELLOW}║  Edit URL: ${CYAN}${edit_url}${YELLOW}${NC}"
    echo -e "${YELLOW}║  Or abort with Ctrl+C                                      ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}\n"

    log "INFO" "Waiting for proceed signal for story: ${story_id}"
    log "INFO" "Options: retry | split | skip | stop"
    log "INFO" "Edit URL: ${edit_url}"

    # Send Slack notification
    send_slack_notification "simple" "Story ${story_id} needs attention. Options: retry | split | skip | stop | Edit: ${edit_url}"

    # Poll npoint.io for the proceed code
    while true; do
        local response
        response=$(curl -s "${BMAD_NPOINT_API_URL}" 2>/dev/null || echo '{"proceed":""}')

        # Extract proceed value from JSON
        local current_code
        current_code=$(echo "$response" | grep -oE '"proceed"\s*:\s*"[^"]*"' | sed 's/.*: *"\([^"]*\)".*/\1/' || echo "")

        if [[ "$current_code" == "retry" ]]; then
            # Clear the proceed code but keep story
            curl -s -X POST "${BMAD_NPOINT_API_URL}" \
                -H "Content-Type: application/json" \
                -d "{\"story\":\"${story_id}\",\"proceed\":\"\"}" > /dev/null 2>&1 || true

            echo -e "\n${GREEN}✓ RETRY signal received - retrying story${NC}"
            log "INFO" "Proceed signal: retry - will retry story ${story_id}"
            return 0  # 0 = retry the story
        fi

        if [[ "$current_code" == "split" ]]; then
            # Clear the proceed code but keep story
            curl -s -X POST "${BMAD_NPOINT_API_URL}" \
                -H "Content-Type: application/json" \
                -d "{\"story\":\"${story_id}\",\"proceed\":\"\"}" > /dev/null 2>&1 || true

            echo -e "\n${CYAN}✓ SPLIT signal received - will invoke SM to split story${NC}"
            log "INFO" "Proceed signal: split - will split story ${story_id}"
            return 3  # 3 = split the story
        fi

        if [[ "$current_code" == "stop" ]]; then
            # Clear all
            curl -s -X POST "${BMAD_NPOINT_API_URL}" \
                -H "Content-Type: application/json" \
                -d '{"story":"","proceed":""}' > /dev/null 2>&1 || true

            echo -e "\n${RED}✗ STOP signal received - stopping workflow${NC}"
            log "INFO" "Proceed signal: stop - stopping workflow"
            return 2  # 2 = stop the entire workflow
        fi

        if [[ "$current_code" == "skip" ]]; then
            # User wants to skip this story - change proceed to "-" and return skip code
            curl -s -X POST "${BMAD_NPOINT_API_URL}" \
                -H "Content-Type: application/json" \
                -d "{\"story\":\"${story_id}\",\"proceed\":\"-\"}" > /dev/null 2>&1 || true

            echo -e "\n${YELLOW}→ SKIP signal received - skipping story${NC}"
            log "INFO" "Proceed signal: skip - will skip story ${story_id}"
            return 4  # 4 = skip the story
        fi

        echo -ne "${CYAN}Polling... (every ${PROCEED_POLL_INTERVAL}s) Current: '${current_code}'${NC}\r"
        sleep "$PROCEED_POLL_INTERVAL"
    done
}

wait_for_proceed_file() {
    local signal_name="$1"
    local signal_file="${PROCEED_WAIT_DIR}/${signal_name}-proceed"
    local stop_file="${PROCEED_WAIT_DIR}/do-not-proceed"

    mkdir -p "$PROCEED_WAIT_DIR"

    echo -e "\n${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  WAITING FOR PROCEED SIGNAL (File)                         ║${NC}"
    echo -e "${YELLOW}╠════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${YELLOW}║  To RETRY this story:                                      ║${NC}"
    echo -e "${YELLOW}║    touch \"${signal_file}\"${NC}"
    echo -e "${YELLOW}║                                                            ║${NC}"
    echo -e "${YELLOW}║  To STOP the entire workflow:                              ║${NC}"
    echo -e "${YELLOW}║    touch \"${stop_file}\"${NC}"
    echo -e "${YELLOW}║                                                            ║${NC}"
    echo -e "${YELLOW}║  Or abort with Ctrl+C                                      ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}\n"

    log "INFO" "Waiting for file proceed signal: ${signal_file} (or ${stop_file} to stop)"

    # Send Slack notification about waiting
    send_slack_notification "simple" "Epic ${EPIC_ID} waiting for proceed signal. RETRY: touch \"${signal_file}\" | STOP: touch \"${stop_file}\""

    # Poll for signal file
    while true; do
        if [[ -f "$signal_file" ]]; then
            rm -f "$signal_file"
            echo -e "\n${GREEN}✓ Proceed signal received - RETRYING story${NC}"
            log "INFO" "File proceed signal received - will retry story"
            return 0  # 0 = retry the story
        fi

        if [[ -f "$stop_file" ]]; then
            rm -f "$stop_file"
            echo -e "\n${RED}✗ Stop signal received - STOPPING workflow${NC}"
            log "INFO" "File stop signal received - stopping workflow"
            return 2  # 2 = stop the entire workflow
        fi

        echo -ne "${CYAN}Waiting for proceed signal... (checking every ${PROCEED_POLL_INTERVAL}s)${NC}\r"
        sleep "$PROCEED_POLL_INTERVAL"
    done
}

wait_for_proceed() {
    local signal_name="$1"

    if [[ "${BMAD_PROCEED_WEB_ENABLED:-false}" == "true" && -n "${BMAD_NPOINT_API_URL:-}" ]]; then
        # Use web-based proceed (npoint.io)
        wait_for_proceed_web "$signal_name"
    else
        # Fall back to local file-based proceed
        wait_for_proceed_file "$signal_name"
    fi
}

# ============================================================================
# EPIC STATE MANAGEMENT
# ============================================================================

init_epic_state() {
    if [[ "$RESUME_FROM_STATE" == "true" && -f "$EPIC_STATE_FILE" ]]; then
        log "INFO" "Resuming from existing state file: $EPIC_STATE_FILE"
        # Extract START_STORY from state file if not explicitly set
        if [[ "$START_STORY" -eq 1 ]]; then
            local last_completed
            last_completed=$(grep -E "^\s+status:\s*completed" -B5 "$EPIC_STATE_FILE" 2>/dev/null | \
                grep -oE "story_[A-Za-z0-9]+" | tail -1 | sed 's/story_//')
            if [[ -n "$last_completed" ]]; then
                START_STORY=$((last_completed + 1))
                log "INFO" "Resuming from story $START_STORY (last completed: $last_completed)"
            fi
        fi
        return 0
    fi

    cat > "$EPIC_STATE_FILE" << EOF
# V7 Orchestrated Epic State
epic_id: "${EPIC_ID}"
epic_file: ""
started_at: "$(date -Iseconds)"
updated_at: "$(date -Iseconds)"

pre_epic:
  status: "pending"
  sprint_planning: "pending"
  test_design: "pending"

story_validation:
  status: "pending"
  stories_assessed: 0
  green_count: 0
  yellow_count: 0
  red_count: 0
  blocked_stories: []

stories: {}

post_epic:
  status: "pending"
  traceability: "pending"
  nfr_assessment: "pending"
  retrospective: "pending"
  testing: "pending"

summary:
  total_stories: 0
  completed: 0
  failed: 0
  skipped: 0
  escalated: 0
EOF
    log "INFO" "Created new epic state file: $EPIC_STATE_FILE"
}

update_epic_state() {
    local key="$1"
    local value="$2"

    if [[ "$key" == *.* ]]; then
        # Nested key: "parent.child" -> find indented child within parent YAML section
        local parent="${key%%.*}"
        local child="${key#*.}"
        sed -i.bak "/^${parent}:/,/^[^ ]/s|^  ${child}:.*|  ${child}: \"${value}\"|" "$EPIC_STATE_FILE"
    else
        # Top-level key
        if grep -q "^${key}:" "$EPIC_STATE_FILE"; then
            sed -i.bak "s|^${key}:.*|${key}: \"${value}\"|" "$EPIC_STATE_FILE"
        fi
    fi

    # Update timestamp
    sed -i.bak "s|^updated_at:.*|updated_at: \"$(date -Iseconds)\"|" "$EPIC_STATE_FILE"
    rm -f "${EPIC_STATE_FILE}.bak"
}

update_story_state() {
    local story_id="$1"
    local status="$2"
    local details="$3"

    # Append story state to the stories section
    local story_key=$(echo "$story_id" | tr '-' '_')

    # Check if story already exists in state
    if grep -q "  ${story_key}:" "$EPIC_STATE_FILE"; then
        # Update existing entry
        sed -i.bak "/  ${story_key}:/,/^  [a-z]/s/status:.*/status: \"${status}\"/" "$EPIC_STATE_FILE"
    else
        # Add new entry before post_epic section
        local temp_file=$(mktemp)
        local timestamp=$(date -Iseconds)
        awk -v story="$story_key" -v status="$status" -v details="$details" -v ts="$timestamp" '
            /^post_epic:/ {
                print "  " story ":"
                print "    status: \"" status "\""
                print "    details: \"" details "\""
                print "    timestamp: \"" ts "\""
                print ""
            }
            {print}
        ' "$EPIC_STATE_FILE" > "$temp_file"
        mv "$temp_file" "$EPIC_STATE_FILE"
    fi

    sed -i.bak "s|^updated_at:.*|updated_at: \"$(date -Iseconds)\"|" "$EPIC_STATE_FILE"
    rm -f "${EPIC_STATE_FILE}.bak"
}

# ============================================================================
# INTELLIGENT PRE-PHASE DETECTION
# ============================================================================

# Check if sprint-status.yaml exists (indicates SM>>SP was done)
check_sprint_planning_done() {
    if [[ -f "$SPRINT_STATUS_FILE" ]]; then
        log "INFO" "Sprint status file exists: $SPRINT_STATUS_FILE"
        log "INFO" "SM>>SP already completed - will skip sprint planning"
        return 0
    fi
    return 1
}

# Check if test-design-epic-{N}.md exists (indicates TEA>>TD was done)
check_test_design_done() {
    local td_file="${IMPL_ARTIFACTS}/test-design-epic-${EPIC_ID}.md"

    if [[ -f "$td_file" ]]; then
        log "INFO" "Test design file exists: $td_file"
        log "INFO" "TEA>>TD already completed - will skip test design"
        return 0
    fi

    # Also check planning artifacts location
    td_file="${PLANNING_ARTIFACTS}/test-design-epic-${EPIC_ID}.md"
    if [[ -f "$td_file" ]]; then
        log "INFO" "Test design file exists: $td_file"
        log "INFO" "TEA>>TD already completed - will skip test design"
        return 0
    fi

    return 1
}

# ============================================================================
# SPRINT STATUS HANDLING (Primary source of truth)
# ============================================================================

# Get stories from sprint-status.yaml for the given epic
get_stories_from_sprint_status() {
    if [[ ! -f "$SPRINT_STATUS_FILE" ]]; then
        log "ERROR" "Sprint status file not found: $SPRINT_STATUS_FILE"
        return 1
    fi

    # Extract story IDs for this epic (format: X-Y-story-name: status)
    # Pattern matches lines like "0-1-monorepo-scaffolding: review"
    # Also matches split stories like "2-3a-story-name" with letter suffix
    # Supports alphanumeric epic IDs like "C1-1-story-name"
    grep -E "^  ${EPIC_ID}-[0-9]+[a-z]?[0-9]*-" "$SPRINT_STATUS_FILE" 2>/dev/null | \
        sed 's/:.*//' | \
        sed 's/^  //' | \
        sort -V
}

# Get status of a story from sprint-status.yaml
# Matches by story ID prefix (e.g., "3-1" matches "3-1-ocr-processing-pipeline")
get_story_status_from_sprint() {
    local story_id="$1"

    if [[ ! -f "$SPRINT_STATUS_FILE" ]]; then
        echo "unknown"
        return
    fi

    # Extract status for this story - match by prefix to handle both formats:
    # - Short ID: "3-1: done"
    # - Full name: "3-1-ocr-processing-pipeline: done"
    local status
    status=$(grep -E "^  ${story_id}(-[a-z]|-[a-z0-9]+)?:" "$SPRINT_STATUS_FILE" 2>/dev/null | \
        head -1 | sed 's/.*: *//' | tr -d ' ')

    if [[ -n "$status" ]]; then
        echo "$status"
    else
        echo "unknown"
    fi
}

# Check if story is already completed (done, complete, or ready-for-review status)
is_story_completed() {
    local story_id="$1"
    local story_file="$2"

    # Check sprint-status.yaml first
    local sprint_status
    sprint_status=$(get_story_status_from_sprint "$story_id")

    if [[ "$sprint_status" == "done" ]]; then
        log "INFO" "Story $story_id marked as 'done' in sprint-status.yaml"
        return 0
    fi

    # Also check story file for completion statuses: done, complete, ready-for-review
    if [[ -f "$story_file" ]]; then
        if grep -qiE "^Status:.*(done|complete|ready-for-review)" "$story_file" 2>/dev/null; then
            local file_status
            file_status=$(grep -i "^Status:" "$story_file" 2>/dev/null | head -1 | awk '{print $2}')
            log "INFO" "Story $story_id has 'Status: ${file_status}' in story file"
            return 0
        fi
    fi

    return 1
}

# Check if story needs to be created first (backlog status, no file)
needs_story_creation() {
    local story_id="$1"
    local story_file="$2"

    local sprint_status
    sprint_status=$(get_story_status_from_sprint "$story_id")

    # If status is backlog and no story file exists, needs creation
    if [[ "$sprint_status" == "backlog" && ! -f "$story_file" ]]; then
        return 0
    fi

    return 1
}

# ============================================================================
# EPIC STORY REGISTRY PARSING (NEW - Single Source of Truth)
# ============================================================================

# Parse story_registry from epic file YAML frontmatter
# Returns list of story IDs in execution order
parse_epic_story_registry() {
    # ==========================================================================
    # Parse stories from Epic file's "Story Status Summary" markdown table
    # This is the CANONICAL source of truth for stories in an epic
    #
    # Supported table formats:
    # 1. Dot notation:   | 4.1 | Title | Status |  -> normalized to 4-1
    # 2. Hyphen notation: | 3-1 | Title | Status | -> already normalized
    # 3. Bold markers:   | **3-11** | Title |     -> strips bold
    #
    # Returns story IDs in file format: 4-1, 4-2a, 3-11a, etc.
    # ==========================================================================
    local epic_file="${1:-$EPIC_FILE}"

    if [[ ! -f "$epic_file" ]]; then
        log "ERROR" "Epic file not found: $epic_file" >&2
        return 1
    fi

    # Parse the "Story Status Summary" markdown table
    # Handles both dot notation (4.1) and hyphen notation (3-1)
    # Also handles bold markers (**3-11**) and sub-section headers
    awk '
        /^## Story Status Summary/ { in_section = 1; next }
        in_section && /^## [^#]/ { exit }
        in_section && /^### / { next }  # Skip sub-section headers like "### Completed Stories"
        in_section && /^\| Story \|/ { next }
        in_section && /^\|[-]+\|/ { next }
        # Match: | 4.1 | or | 3-1 | or | **3-11** | or | C1.1 | (with optional letter suffix)
        in_section && /^\| *\*?\*?[A-Za-z0-9]/ {
            gsub(/^\| */, "")
            split($0, cols, / *\| */)
            story_id = cols[1]
            # Remove bold markers
            gsub(/\*\*/, "", story_id)
            # Convert dot to hyphen (4.1 -> 4-1, C1.1 -> C1-1)
            gsub(/\./, "-", story_id)
            # Trim whitespace
            gsub(/^ +| +$/, "", story_id)
            # Only print if it looks like a valid story ID (numeric or alphanumeric prefix)
            if (match(story_id, /^[A-Za-z0-9]+-[0-9]+/)) print story_id
        }
    ' "$epic_file"
}

# Get story status from epic file's Story Status Summary table
get_story_status_from_registry() {
    local story_id="$1"
    local epic_file="${2:-$EPIC_FILE}"

    if [[ ! -f "$epic_file" ]]; then
        echo "unknown"
        return
    fi

    # Try both formats: dot notation (4.1) and hyphen notation (3-1)
    local dot_story_id hyphen_story_id
    dot_story_id=$(echo "$story_id" | sed 's/-/./')
    hyphen_story_id="$story_id"

    # Extract status for the given story ID from markdown table
    local status
    status=$(awk -v dot_story="$dot_story_id" -v hyphen_story="$hyphen_story_id" '
        /^## Story Status Summary/ { in_section = 1; next }
        in_section && /^## [^#]/ { exit }
        in_section && /^### / { next }
        in_section && /^\| Story \|/ { next }
        in_section && /^\|[-]+\|/ { next }
        in_section && /^\|/ {
            gsub(/^\| */, "")
            split($0, cols, / *\| */)
            row_story = cols[1]
            # Remove bold markers
            gsub(/\*\*/, "", row_story)
            gsub(/^ +| +$/, "", row_story)
            # Match either format
            if (row_story == dot_story || row_story == hyphen_story) {
                status = cols[3]
                # Remove bold markers from status too
                gsub(/\*\*/, "", status)
                gsub(/^ +| +$/, "", status)
                print tolower(status)
                exit
            }
        }
    ' "$epic_file")

    if [[ -n "$status" ]]; then
        echo "$status"
    else
        echo "unknown"
    fi
}

# Validate that story sources are in sync
# Checks: epic registry vs sprint-status vs story files
validate_story_sources() {
    local epic_file="${1:-$EPIC_FILE}"
    local issues=0
    local warnings=0

    echo -e "${BLUE}Validating story sources...${NC}"
    log "INFO" "Validating story sources for epic ${EPIC_ID}"

    # Get canonical story list from epic file's story_registry
    local -a registry_stories=()
    while IFS= read -r story_id; do
        [[ -n "$story_id" ]] && registry_stories+=("$story_id")
    done < <(parse_epic_story_registry "$epic_file")

    if [[ ${#registry_stories[@]} -eq 0 ]]; then
        log "WARN" "No story_registry found in epic file - using fallback methods"
        echo -e "${YELLOW}  ⚠ No story_registry in epic file - cannot validate${NC}"
        return 0  # Don't fail, just warn
    fi

    echo -e "${CYAN}  Found ${#registry_stories[@]} stories in epic story_registry${NC}"

    local stories_dir="${IMPL_ARTIFACTS}/stories"

    for story_id in "${registry_stories[@]}"; do
        local registry_status=$(get_story_status_from_registry "$story_id" "$epic_file")
        local sprint_status=$(get_story_status_from_sprint "$story_id")
        local story_file=$(find_story_file "$story_id" 2>/dev/null || true)

        # Check 1: Story exists in sprint-status.yaml
        if [[ "$sprint_status" == "unknown" ]]; then
            echo -e "${YELLOW}  ⚠ Story $story_id: in epic but missing from sprint-status.yaml${NC}"
            log "WARN" "Story $story_id in epic file but missing from sprint-status.yaml"
            warnings=$((warnings + 1))
        fi

        # Check 2: Non-backlog stories should have files
        if [[ "$registry_status" != "backlog" && -z "$story_file" ]]; then
            echo -e "${RED}  ✗ Story $story_id: status '$registry_status' but no story file exists${NC}"
            log "ERROR" "Story $story_id has status '$registry_status' but no story file exists"
            issues=$((issues + 1))
        fi

        # Check 3: Done stories must have files
        if [[ "$registry_status" == "done" && -z "$story_file" ]]; then
            echo -e "${RED}  ✗ Story $story_id: marked DONE but no story file found${NC}"
            log "ERROR" "Story $story_id marked done but no story file found"
            issues=$((issues + 1))
        fi

        # Check 4: File exists for story
        if [[ -n "$story_file" ]]; then
            echo -e "${GREEN}  ✓ Story $story_id: file exists, registry=$registry_status, sprint=$sprint_status${NC}"
        elif [[ "$registry_status" == "backlog" ]]; then
            echo -e "${CYAN}  ○ Story $story_id: backlog (no file yet)${NC}"
        fi
    done

    # Check for orphan files (files not in epic registry)
    echo -e "\n${BLUE}Checking for orphan story files...${NC}"
    local orphan_count=0
    while IFS= read -r -d '' f; do
        local filename=$(basename "$f" .md)
        # Extract just the story ID portion (e.g., "3-1" from "3-1-ocr-processing-pipeline")
        local file_story_id=$(echo "$filename" | grep -oE "^${EPIC_ID}-[0-9]+[a-z]?[0-9]*")

        local found=false
        for reg_id in "${registry_stories[@]}"; do
            if [[ "$file_story_id" == "$reg_id" ]]; then
                found=true
                break
            fi
        done

        if [[ "$found" == "false" ]]; then
            echo -e "${YELLOW}  ⚠ Orphan file: $filename (not in story_registry)${NC}"
            log "WARN" "Story file '$filename' exists but not in epic story_registry"
            orphan_count=$((orphan_count + 1))
            warnings=$((warnings + 1))
        fi
    done < <(find "$stories_dir" -maxdepth 1 -name "${EPIC_ID}-*.md" -print0 2>/dev/null)

    if [[ $orphan_count -eq 0 ]]; then
        echo -e "${GREEN}  ✓ No orphan files found${NC}"
    fi

    # Summary
    echo ""
    if [[ $issues -gt 0 ]]; then
        echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║  VALIDATION FAILED: $issues errors, $warnings warnings${NC}"
        echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
        log "ERROR" "Story source validation failed: $issues errors, $warnings warnings"
        return 1
    elif [[ $warnings -gt 0 ]]; then
        echo -e "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║  VALIDATION PASSED WITH WARNINGS: $warnings warnings${NC}"
        echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
        log "WARN" "Story source validation passed with $warnings warnings"
        return 0
    else
        echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  VALIDATION PASSED: All story sources in sync${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
        log "INFO" "Story source validation passed"
        return 0
    fi
}

# Sync sprint-status.yaml FROM epic file's story_registry
# This ensures sprint-status.yaml matches the canonical epic definition
sync_from_epic_registry() {
    local epic_file="${1:-$EPIC_FILE}"

    echo -e "${BLUE}Syncing sprint-status.yaml from epic story_registry...${NC}"
    log "INFO" "Syncing sprint-status.yaml from epic file: $epic_file"

    if [[ ! -f "$SPRINT_STATUS_FILE" ]]; then
        log "ERROR" "Sprint status file not found: $SPRINT_STATUS_FILE"
        return 1
    fi

    # Get stories from epic registry
    local -a registry_stories=()
    while IFS= read -r story_id; do
        [[ -n "$story_id" ]] && registry_stories+=("$story_id")
    done < <(parse_epic_story_registry "$epic_file")

    if [[ ${#registry_stories[@]} -eq 0 ]]; then
        log "WARN" "No story_registry found in epic file"
        echo -e "${YELLOW}  ⚠ No story_registry in epic file - cannot sync${NC}"
        return 1
    fi

    local added=0
    local updated=0
    local in_sync=0

    for story_id in "${registry_stories[@]}"; do
        local registry_status=$(get_story_status_from_registry "$story_id" "$epic_file")
        local sprint_status=$(get_story_status_from_sprint "$story_id")

        if [[ "$sprint_status" == "unknown" ]]; then
            # Story not in sprint-status, add it
            echo -e "${GREEN}  + Adding $story_id (status: $registry_status)${NC}"
            log "INFO" "Adding story $story_id to sprint-status.yaml with status: $registry_status"

            # Find insertion point (after epic line or after last story for this epic)
            local epic_line_num
            epic_line_num=$(grep -n "^  epic-${EPIC_ID}:" "$SPRINT_STATUS_FILE" | cut -d: -f1 | head -1)

            if [[ -n "$epic_line_num" ]]; then
                local last_story_line
                last_story_line=$(grep -n "^  ${EPIC_ID}-" "$SPRINT_STATUS_FILE" | tail -1 | cut -d: -f1)

                local insert_after=${last_story_line:-$epic_line_num}

                # Use sed to insert (macOS compatible)
                sed -i '' "${insert_after}a\\
  ${story_id}: ${registry_status}" "$SPRINT_STATUS_FILE"
                added=$((added + 1))
            fi
        elif [[ "$sprint_status" != "$registry_status" && "$registry_status" == "done" ]]; then
            # Status mismatch and registry says done - update sprint-status
            echo -e "${CYAN}  ~ Updating $story_id: $sprint_status -> $registry_status${NC}"
            log "INFO" "Updating story $story_id status: $sprint_status -> $registry_status"
            # Update by prefix match to handle both short and full names
            sed -i '' "s/^  ${story_id}\(-[a-z0-9-]*\)\?: .*$/  ${story_id}\1: ${registry_status}/" "$SPRINT_STATUS_FILE"
            updated=$((updated + 1))
        else
            # Already in sync
            echo -e "${GREEN}  ✓ $story_id: already in sync (status: $sprint_status)${NC}"
            in_sync=$((in_sync + 1))
        fi
    done

    echo -e "\n${GREEN}  Sync complete: $added added, $updated updated, $in_sync already in sync${NC}"
    log "INFO" "Sprint-status sync complete: $added added, $updated updated, $in_sync already in sync"
    return 0
}

# ============================================================================
# EPIC FILE HANDLING (Updated to use story_registry first)
# ============================================================================

# Normalize a planning epic file for the orchestrator:
# 1. Convert story IDs from E3.S1 → E3.1 format (remove 'S' prefix on story numbers)
# 2. Add Story Status Summary table if missing
prepare_epic_from_planning() {
    local source_file="$1"
    local target_file="$2"

    log "INFO" "Preparing epic from planning artifact: $(basename "$source_file")"
    cp "$source_file" "$target_file"

    # --- Normalize story IDs: E3.S1 → E3.1, E3b.S2 → E3b.2 ---
    # Matches patterns like E3.S1, E3b.S12, E2b.S3 and removes the 'S'
    if grep -qE "${EPIC_ID}\\.S[0-9]" "$target_file" 2>/dev/null; then
        log "INFO" "Normalizing story IDs: removing 'S' prefix (${EPIC_ID}.S1 → ${EPIC_ID}.1)"
        sed -i '' -E "s/${EPIC_ID}\\.S([0-9])/${EPIC_ID}.\\1/g" "$target_file"
    fi

    # --- Add Story Status Summary table if missing ---
    if ! grep -q "## Story Status Summary" "$target_file" 2>/dev/null; then
        log "INFO" "Generating Story Status Summary table"
        local stories_block=""
        stories_block=$(awk -v epic="${EPIC_ID}" '
            /^## Story [A-Za-z0-9]+\.[0-9]+:/ {
                # Extract story ID and title from heading
                line = $0
                sub(/^## Story /, "", line)
                # Split on ": " to get ID and title
                idx = index(line, ": ")
                if (idx > 0) {
                    story_id = substr(line, 1, idx - 1)
                    title = substr(line, idx + 2)
                    print "| " story_id " | " title " | backlog |"
                }
            }
        ' "$target_file")

        if [[ -n "$stories_block" ]]; then
            # Append the table at the end of the file
            {
                echo ""
                echo "## Story Status Summary"
                echo ""
                echo "| Story | Title | Status |"
                echo "|-------|-------|--------|"
                echo "$stories_block"
            } >> "$target_file"
            log "INFO" "Added Story Status Summary with $(echo "$stories_block" | wc -l | tr -d ' ') stories"
        else
            log "WARN" "Could not extract stories from headings to build summary table"
        fi
    fi

    log "INFO" "Epic prepared: $target_file"
}

find_epic_file() {
    # Primary source: Always use the epic file from epics folder
    local epic_dir="${IMPL_ARTIFACTS}/epics"
    mkdir -p "$epic_dir"

    # Pattern 1: Exact match epic-N.md (preferred)
    if [[ -f "${epic_dir}/epic-${EPIC_ID}.md" ]]; then
        EPIC_FILE="${epic_dir}/epic-${EPIC_ID}.md"
        log "INFO" "Found epic file: $EPIC_FILE"
        return 0
    fi

    # Pattern 2: Match with just the number (e.g., 3.md)
    if [[ -f "${epic_dir}/${EPIC_ID}.md" ]]; then
        EPIC_FILE="${epic_dir}/${EPIC_ID}.md"
        log "INFO" "Found epic file: $EPIC_FILE"
        return 0
    fi

    # Pattern 3: Match with name suffix (e.g., 2-sync-infrastructure.md)
    for f in "${epic_dir}/${EPIC_ID}"*.md; do
        if [[ -f "$f" ]]; then
            EPIC_FILE="$f"
            log "INFO" "Found epic file: $EPIC_FILE"
            return 0
        fi
    done

    # Pattern 4: Auto-import from planning-artifacts/epics/ (new)
    local planning_dir="${PLANNING_ARTIFACTS}/epics"
    if [[ -d "$planning_dir" ]]; then
        # Try case-insensitive match: epic-e3-*.md, epic-E3-*.md, epic-E3b-*.md, etc.
        local epic_id_lower
        epic_id_lower=$(echo "$EPIC_ID" | tr '[:upper:]' '[:lower:]')
        for f in "${planning_dir}"/epic-*.md; do
            if [[ -f "$f" ]]; then
                local basename_lower
                basename_lower=$(basename "$f" | tr '[:upper:]' '[:lower:]')
                if [[ "$basename_lower" == "epic-${epic_id_lower}-"* || "$basename_lower" == "epic-${epic_id_lower}.md" ]]; then
                    local target="${epic_dir}/epic-${EPIC_ID}.md"
                    log "INFO" "Found planning epic: $f → auto-importing to $target"
                    prepare_epic_from_planning "$f" "$target"
                    EPIC_FILE="$target"
                    return 0
                fi
            fi
        done
    fi

    # Pattern 5: Check planning artifacts for combined epics.md (legacy fallback)
    if [[ -f "${PLANNING_ARTIFACTS}/epics.md" ]]; then
        EPIC_FILE="${PLANNING_ARTIFACTS}/epics.md"
        log "INFO" "Found combined epics file: $EPIC_FILE"
        return 0
    fi

    log "ERROR" "No epic file found for epic ${EPIC_ID}"
    return 1
}

get_stories_from_epic() {
    # ==========================================================================
    # EPIC FILE IS THE CANONICAL SOURCE OF TRUTH FOR STORIES
    #
    # Strategy:
    # 1. Parse stories from Epic file's "Story Status Summary" table
    # 2. For each Epic story, check for story files (including split variants)
    # 3. If mismatch with sprint-status.yaml, send Slack alert
    # 4. Return list with actual file names (for splits) or base IDs (for backlog)
    # ==========================================================================

    local stories_dir="${IMPL_ARTIFACTS}/stories"

    # STEP 1: Parse Epic file - this is REQUIRED, not optional
    if [[ -z "$EPIC_FILE" || ! -f "$EPIC_FILE" ]]; then
        log "ERROR" "EPIC FILE NOT FOUND: $EPIC_FILE - Cannot determine stories" >&2
        send_slack_notification "simple" "FATAL: Epic file not found for Epic ${EPIC_ID}. Cannot determine stories." >&2
        return 1
    fi

    local -a epic_stories=()
    while IFS= read -r story_id; do
        [[ -n "$story_id" ]] && epic_stories+=("$story_id")
    done < <(parse_epic_story_registry "$EPIC_FILE")

    if [[ ${#epic_stories[@]} -eq 0 ]]; then
        log "ERROR" "EPIC FILE HAS NO STORIES in Story Status Summary table" >&2
        send_slack_notification "simple" "FATAL: Epic ${EPIC_ID} file has no stories in Story Status Summary table." >&2
        return 1
    fi

    log "INFO" "Epic file contains ${#epic_stories[@]} stories (canonical source)" >&2

    # STEP 2: For each Epic story, find matching files (including split variants)
    local -a result_stories=()
    for story_id in "${epic_stories[@]}"; do
        # Check for exact match or split variants (4-1, 4-1a, 4-1b)
        local -a matching_files=()

        if [[ -d "$stories_dir" ]]; then
            while IFS= read -r -d '' f; do
                if [[ -f "$f" ]]; then
                    matching_files+=("$(basename "$f" .md)")
                fi
            done < <(find "$stories_dir" -maxdepth 1 \( -iname "${story_id}-*.md" -o -iname "${story_id}[a-z]-*.md" \) -print0 2>/dev/null)
        fi

        if [[ ${#matching_files[@]} -gt 0 ]]; then
            # Sort matching files alphabetically (4-1a before 4-1b)
            local sorted_files
            sorted_files=$(printf '%s\n' "${matching_files[@]}" | sort)
            while IFS= read -r match; do
                [[ -n "$match" ]] && result_stories+=("$match")
            done <<< "$sorted_files"
            log "DEBUG" "Story ${story_id}: found ${#matching_files[@]} file(s)" >&2
        else
            # No file yet - use the base story ID (for backlog stories)
            result_stories+=("$story_id")
            log "DEBUG" "Story ${story_id}: no file yet (backlog)" >&2
        fi
    done

    # STEP 3: Validate against sprint-status.yaml and alert on mismatch
    if [[ -f "$SPRINT_STATUS_FILE" ]]; then
        local -a sprint_stories=()
        while IFS= read -r story_id; do
            [[ -n "$story_id" ]] && sprint_stories+=("$story_id")
        done < <(get_stories_from_sprint_status)

        # Check for stories in Epic but not in sprint-status
        local mismatches=""
        for epic_story in "${epic_stories[@]}"; do
            local found=false
            for sprint_story in "${sprint_stories[@]}"; do
                # Extract base ID from sprint story (e.g., 4-1 from 4-1-name or 4-1a-name)
                local sprint_base
                sprint_base=$(echo "$sprint_story" | grep -oE "^${EPIC_ID}-[0-9]+[a-z]?[0-9]*")
                if [[ "$sprint_base" == "$epic_story" || "$sprint_base" == "${epic_story}"* ]]; then
                    found=true
                    break
                fi
            done
            if [[ "$found" != "true" ]]; then
                mismatches+="Epic story ${epic_story} missing from sprint-status.yaml; "
            fi
        done

        if [[ -n "$mismatches" ]]; then
            log "WARN" "Mismatch between Epic file and sprint-status.yaml: $mismatches" >&2
            send_slack_notification "simple" "WARNING: Epic ${EPIC_ID} mismatch with sprint-status.yaml: ${mismatches}" >&2
        fi
    fi

    # Return the result
    if [[ ${#result_stories[@]} -gt 0 ]]; then
        log "INFO" "Returning ${#result_stories[@]} stories from Epic ${EPIC_ID}" >&2
        printf '%s\n' "${result_stories[@]}"
        return 0
    fi

    log "ERROR" "No stories resolved from Epic file" >&2
    return 1
}

# Sync sprint-status.yaml with actual story files from stories directory
# This ensures sprint-status.yaml reflects the actual story files
sync_sprint_status_with_stories() {
    local stories_dir="${IMPL_ARTIFACTS}/stories"

    if [[ ! -f "$SPRINT_STATUS_FILE" ]]; then
        log "WARN" "Sprint status file not found, cannot sync: $SPRINT_STATUS_FILE"
        return 1
    fi

    if [[ ! -d "$stories_dir" ]]; then
        log "INFO" "Stories directory not found, nothing to sync"
        return 0
    fi

    log "INFO" "Syncing sprint-status.yaml with story files for epic ${EPIC_ID}..."

    # Find all story files for this epic
    local -a story_files=()
    while IFS= read -r -d '' f; do
        if [[ -f "$f" ]]; then
            local filename
            filename=$(basename "$f" .md)
            story_files+=("$filename")
        fi
    done < <(find "$stories_dir" -maxdepth 1 -name "${EPIC_ID}-*.md" -print0 2>/dev/null)

    if [[ ${#story_files[@]} -eq 0 ]]; then
        log "INFO" "No story files found for epic ${EPIC_ID}"
        return 0
    fi

    local changes_made=false

    # For each story file, ensure it exists in sprint-status.yaml
    for story_id in "${story_files[@]}"; do
        if ! grep -q "^  ${story_id}:" "$SPRINT_STATUS_FILE" 2>/dev/null; then
            log "INFO" "Adding missing story to sprint-status.yaml: ${story_id}"

            # Determine where to insert (after the epic line or after the last story for this epic)
            local epic_line_num
            epic_line_num=$(grep -n "^  epic-${EPIC_ID}:" "$SPRINT_STATUS_FILE" | cut -d: -f1 | head -1)

            if [[ -n "$epic_line_num" ]]; then
                # Insert after the epic line (or after existing stories)
                # Find the last line for this epic's stories
                local last_story_line
                last_story_line=$(grep -n "^  ${EPIC_ID}-" "$SPRINT_STATUS_FILE" | tail -1 | cut -d: -f1)

                local insert_after
                if [[ -n "$last_story_line" ]]; then
                    insert_after=$last_story_line
                else
                    insert_after=$epic_line_num
                fi

                # Use sed to insert after the line (macOS compatible)
                sed -i '' "${insert_after}a\\
  ${story_id}: ready-for-dev" "$SPRINT_STATUS_FILE"
                changes_made=true
            fi
        fi
    done

    # Check for stories in sprint-status.yaml that no longer have files
    local sprint_stories
    sprint_stories=$(grep -E "^  ${EPIC_ID}-[0-9]+[a-z]?[0-9]*-" "$SPRINT_STATUS_FILE" 2>/dev/null | sed 's/:.*//' | sed 's/^  //')

    while IFS= read -r sprint_story; do
        [[ -z "$sprint_story" ]] && continue

        # Check if this story has a corresponding file
        local story_file="${stories_dir}/${sprint_story}.md"
        if [[ ! -f "$story_file" ]]; then
            # Story in sprint-status but no file - log warning but don't remove
            # (it might be a backlog item not yet created)
            local status
            status=$(grep "^  ${sprint_story}:" "$SPRINT_STATUS_FILE" 2>/dev/null | sed 's/.*: *//')
            if [[ "$status" != "backlog" && "$status" != "done" ]]; then
                log "WARN" "Story ${sprint_story} in sprint-status.yaml has no file (status: ${status})"
            fi
        fi
    done <<< "$sprint_stories"

    if [[ "$changes_made" == "true" ]]; then
        log "INFO" "Sprint-status.yaml synced with story files"
    else
        log "INFO" "Sprint-status.yaml already in sync"
    fi

    return 0
}

# Find story file path from story ID
find_story_file() {
    local story_id="$1"
    local found_file=""

    # Primary location: directly in implementation-artifacts (exact match first)
    found_file="${IMPL_ARTIFACTS}/${story_id}.md"
    if [[ -f "$found_file" ]]; then
        echo "$found_file"
        return 0
    fi

    # Try glob pattern with name suffix (handle paths with spaces properly)
    while IFS= read -r -d '' f; do
        if [[ -f "$f" ]]; then
            echo "$f"
            return 0
        fi
    done < <(find "$IMPL_ARTIFACTS" -maxdepth 1 -name "${story_id}-*.md" -print0 2>/dev/null)

    # Secondary location: stories subdirectory
    local stories_dir="${IMPL_ARTIFACTS}/stories"

    if [[ -d "$stories_dir" ]]; then
        # Exact match
        found_file="${stories_dir}/${story_id}.md"
        if [[ -f "$found_file" ]]; then
            echo "$found_file"
            return 0
        fi

        # Try glob patterns
        while IFS= read -r -d '' f; do
            if [[ -f "$f" ]]; then
                echo "$f"
                return 0
            fi
        done < <(find "$stories_dir" -maxdepth 1 \( -name "${story_id}.md" -o -name "${story_id}-*.md" -o -name "story-${story_id}.md" \) -print0 2>/dev/null)
    fi

    return 1
}

# ============================================================================
# CROSS-STORY DEPENDENCY HANDLING
# ============================================================================

check_story_dependencies() {
    local story_id="$1"
    local story_file="$2"

    if [[ ! -f "$story_file" ]]; then
        return 0  # No file, no dependencies to check
    fi

    # Look for dependency markers in story file
    # Patterns: "Depends on:", "Prerequisite:", "Requires story:", "After story:"
    local dependencies
    dependencies=$(grep -iE "(depends on|prerequisite|requires story|after story|blocked by):" "$story_file" 2>/dev/null | \
        grep -oE '(E[A-Za-z0-9]+-S[0-9]+|S-[0-9]+-[0-9]+|[A-Za-z0-9]+-[0-9]+)' || true)

    if [[ -z "$dependencies" ]]; then
        return 0  # No dependencies
    fi

    log "INFO" "Story $story_id has dependencies: $dependencies"

    # Check if all dependencies are completed
    for dep in $dependencies; do
        local dep_key=$(echo "$dep" | tr '-' '_')
        if ! grep -q "  ${dep_key}:.*status.*completed" "$EPIC_STATE_FILE" 2>/dev/null; then
            log "WARN" "Story $story_id blocked by incomplete dependency: $dep"
            echo "$dep"
            return 1
        fi
    done

    return 0
}

# ============================================================================
# COMPLEXITY FAILURE DETECTION
# ============================================================================
# Note: Auto-split is now handled automatically by v7-orchestrated-workflow.sh.
# When a story is too complex (RED status), the workflow auto-splits it into
# multiple story files (e.g., 2-3a, 2-3b, 2-3c) and exits with code 10.
# This epic script handles code 10 by refreshing the story list and continuing.

# Check if a story failed due to complexity (red status)
# Checks the workflow state file for pre_validation.risk_level == "red"
is_complexity_failure() {
    local story_id="$1"
    # State file is in auto-bmad_pack/logs/workflow/{story_id}/{story_id}-orchestrator-state.yaml
    local auto_bmad_dir="${SCRIPT_DIR}/.."
    local state_file="${auto_bmad_dir}/logs/workflow/${story_id}/${story_id}-orchestrator-state.yaml"

    if [[ -f "$state_file" ]]; then
        if grep -q 'risk_level:.*red' "$state_file" 2>/dev/null; then
            log "INFO" "Detected complexity failure (red) for ${story_id}"
            return 0  # true - is complexity failure
        fi
        if grep -q 'pre_validation.status.*blocked' "$state_file" 2>/dev/null; then
            log "INFO" "Detected blocked pre-validation for ${story_id}"
            return 0  # true - blocked by pre-validation
        fi
    else
        log "WARN" "State file not found for complexity check: ${state_file}"
    fi

    return 1  # false - not a complexity failure
}

# ============================================================================
# CLAUDE STEP EXECUTION
# ============================================================================

# Run claude with a timeout + staleness watchdog to prevent hung processes
# (MCP server child processes can outlive the conversation, causing hangs)
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

    if [[ -n "$timeout_cmd" ]]; then
        $timeout_cmd claude --model opus "$@" > "$log_file" 2>&1
        local exit_code=$?
        if [[ $exit_code -eq 124 ]]; then
            log "WARN" "Claude process timed out after ${timeout_secs}s"
        fi
        return $exit_code
    else
        # No timeout command available - use background + staleness watchdog
        local stale_limit=600  # 10 minutes of no output = stale
        local start_seconds=$SECONDS
        claude --model opus "$@" > "$log_file" 2>&1 &
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

        wait "$pid" 2>/dev/null
        return $?
    fi
}

run_claude_step() {
    local agent="$1"
    local workflow="$2"
    local command="$3"
    local step_name="$4"
    local step_log="${EPIC_LOG_DIR}/${EPIC_ID}-${step_name}.log"

    log "INFO" "Running: Agent=${agent} Workflow=${workflow} Command=${command} (max-turns: $MAX_TURNS)"
    echo -e "${YELLOW}Running Claude Code (max $MAX_TURNS turns)...${NC}"

    # Build prompt with agent activation then workflow execution
    local prompt
    prompt="STEP 1: Activate the agent by running the skill: ${agent}

STEP 2: Once agent is active, invoke the workflow skill: ${workflow}

BATCH MODE - SKIP MENU DISPLAY:
- Do NOT display the agent greeting or menu
- Do NOT wait for user input between steps
- After agent activation, immediately invoke the workflow
- Workflow command/argument: ${command}
- Epic ID: ${EPIC_ID}

Execute the workflow instructions exactly. When complete, provide a brief summary."

    cd "$PROJECT_ROOT"
    if run_claude_with_timeout "$STEP_TIMEOUT" "$step_log" -p --dangerously-skip-permissions --max-turns "$MAX_TURNS" "$prompt"; then
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

# ============================================================================
# MAIN WORKFLOW
# ============================================================================

main() {
    log "INFO" "Starting V7 Orchestrated Epic Workflow for ${EPIC_ID}"
    log "INFO" "Project root: ${PROJECT_ROOT}"
    log "INFO" "Options: Skip AT=$SKIP_AT, Skip RV=$SKIP_RV, Skip TD=$SKIP_TD, Skip Pre=$SKIP_PRE, Skip Post=$SKIP_POST"
    log "INFO" "Start story: $START_STORY, Stop after: ${STOP_AFTER_STORY:-none}, Max turns: $MAX_TURNS, Max CR loops: $MAX_CR_LOOPS, Is last epic: $IS_LAST_EPIC"

    # Track epic start time for duration calculation
    local epic_start_time
    epic_start_time=$(date +%s)

    echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  V7 ORCHESTRATED EPIC WORKFLOW: ${EPIC_ID}${NC}"
    echo -e "${GREEN}║  (with intelligent orchestration + Slack notifications)${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}\n"

    # Initialize epic state
    init_epic_state

    # =========================================================================
    # VALIDATE STORY SOURCE EXISTS (sprint-status.yaml or epic file)
    # =========================================================================
    echo -e "${BLUE}Validating story source exists...${NC}"
    if ! find_epic_file; then
        echo -e "${RED}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║  ERROR: No story source found!${NC}"
        echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
        echo -e "${RED}Expected: ${SPRINT_STATUS_FILE} or epic file${NC}"
        echo -e "${YELLOW}Run SM>>SP (sprint-planning) first to create sprint-status.yaml${NC}"
        send_slack_notification "simple" "Epic ${EPIC_ID} workflow failed: No story source found"
        exit 1
    fi

    echo -e "${GREEN}✓ Found epic file: ${EPIC_FILE}${NC}"
    update_epic_state "epic_file" "$EPIC_FILE"

    # =========================================================================
    # HANDLE --sync-from-epic FLAG (sync sprint-status from epic registry)
    # =========================================================================
    if [[ "$SYNC_FROM_EPIC" == "true" ]]; then
        echo -e "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${CYAN}║  SYNC MODE: Syncing sprint-status.yaml from epic registry  ║${NC}"
        echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

        if sync_from_epic_registry "$EPIC_FILE"; then
            echo -e "\n${GREEN}Sync complete. Run without --sync-from-epic to execute stories.${NC}"
        else
            echo -e "\n${RED}Sync failed. Check epic file has story_registry.${NC}"
            exit 1
        fi
        exit 0
    fi

    # =========================================================================
    # HANDLE --validate-only FLAG (validate without executing)
    # =========================================================================
    if [[ "$VALIDATE_ONLY" == "true" ]]; then
        echo -e "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${CYAN}║  VALIDATE MODE: Checking story sources only                ║${NC}"
        echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

        if validate_story_sources "$EPIC_FILE"; then
            echo -e "\n${GREEN}Validation passed. Run without --validate-only to execute.${NC}"
            exit 0
        else
            echo -e "\n${RED}Validation failed. Fix issues before running epic.${NC}"
            echo -e "${YELLOW}Options:${NC}"
            echo -e "  1. Run: $0 $EPIC_ID --sync-from-epic  # Add missing stories to sprint-status${NC}"
            echo -e "  2. Create missing story files using SM create-story workflow${NC}"
            echo -e "  3. Update epic file story_registry if IDs are wrong${NC}"
            exit 1
        fi
    fi

    # Sync sprint-status.yaml with actual story files (non-fatal if missing)
    sync_sprint_status_with_stories || true

    # Get stories list (from epic registry first, then fallbacks)
    local stories=($(get_stories_from_epic))
    local story_count=${#stories[@]}

    if [[ $story_count -eq 0 ]]; then
        echo -e "${RED}No stories found for epic ${EPIC_ID}${NC}"
        log "ERROR" "No stories found for epic ${EPIC_ID}"
        exit 1
    fi

    log "INFO" "Found ${story_count} stories in epic ${EPIC_ID}"
    echo -e "${BLUE}Stories to process:${NC}"
    for s in "${stories[@]}"; do
        local s_status=$(get_story_status_from_sprint "$s")
        echo -e "  - ${s} [${s_status}]"
    done
    echo ""

    # Track story results
    local completed_stories=()
    local failed_stories=()
    local skipped_stories=()
    local escalated_stories=()

    # Epic-level usage tracking
    local EPIC_TOTAL_TOKENS=0
    local EPIC_TOTAL_COST="0.00"
    local EPIC_START_USAGE
    EPIC_START_USAGE=$(query_ccusage_today)
    local epic_start_tokens epic_start_cost
    epic_start_tokens=$(echo "$EPIC_START_USAGE" | cut -d'|' -f1)
    epic_start_cost=$(echo "$EPIC_START_USAGE" | cut -d'|' -f2)
    log "INFO" "Epic start usage baseline: ${epic_start_tokens} tokens, \$${epic_start_cost}"

    # =========================================================================
    # PRE-EPIC PHASE (with intelligent detection)
    # =========================================================================
    if [[ "$SKIP_PRE" == "true" ]]; then
        echo -e "${YELLOW}Skipping pre-epic phase (--skip-pre flag)${NC}"
        log "INFO" "Pre-epic phase skipped by flag"
    else
        # Intelligent detection: Check if SM>>SP already done
        if check_sprint_planning_done; then
            echo -e "${GREEN}✓ SM *SP already completed (sprint-status.yaml exists)${NC}"
            update_epic_state "pre_epic.sprint_planning" "already_completed"
        else
            log_phase "1A: SM *SP - Sprint Planning"
            if ! run_claude_step "$AGENT_SM" "$WORKFLOW_SPRINT_PLANNING" "${EPIC_ID}" "sm-sprint-planning"; then
                echo -e "${RED}SM *SP failed${NC}"
                update_epic_state "pre_epic.sprint_planning" "failed"
                send_slack_notification "simple" "Epic ${EPIC_ID}: Sprint planning failed"
                exit 1
            fi
            update_epic_state "pre_epic.sprint_planning" "completed"
            sleep 3
        fi

        # Intelligent detection: Check if TEA>>TD already done
        if [[ "$SKIP_TD" == "true" ]]; then
            echo -e "${YELLOW}Skipping TEA *TD (--skip-td flag)${NC}"
        elif check_test_design_done; then
            echo -e "${GREEN}✓ TEA *TD already completed (test-design-epic-${EPIC_ID}.md exists)${NC}"
            update_epic_state "pre_epic.test_design" "already_completed"
        else
            log_phase "1B: TEA *TD - Epic Test Design"
            if ! run_claude_step "$AGENT_TEA" "$WORKFLOW_TEST_DESIGN" "${EPIC_ID}" "tea-test-design"; then
                echo -e "${YELLOW}TEA *TD failed, continuing...${NC}"
                update_epic_state "pre_epic.test_design" "failed"
            else
                update_epic_state "pre_epic.test_design" "completed"
            fi
        fi

        update_epic_state "pre_epic.status" "completed"
        sleep 3
    fi

    # =========================================================================
    # SEND EPIC START NOTIFICATION
    # =========================================================================
    send_slack_notification "simple" "Starting Epic ${EPIC_ID} with ${story_count} stories. Orchestrated workflow v7 with intelligent retry/split/escalate."

    # =========================================================================
    # STORY LOOP (ORCHESTRATED)
    # =========================================================================
    log_phase "2: Orchestrated Story Execution Loop"

    echo -e "${BLUE}Processing ${story_count} stories with v7-orchestrated-workflow.sh${NC}"

    if [[ "$START_STORY" -gt 1 ]]; then
        echo -e "${YELLOW}Resuming from Story $START_STORY${NC}"
    fi

    local current=$START_STORY
    local retry_count=0
    while [[ $current -le $story_count ]]; do
        # Get story_id from array (0-indexed, current is 1-indexed)
        local story_id="${stories[$((current-1))]}"

        # Get current status from sprint-status.yaml
        local sprint_status
        sprint_status=$(get_story_status_from_sprint "$story_id")

        echo -e "\n${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${MAGENTA}  Story ${current}/${story_count}: ${story_id} [${sprint_status}]${NC}"
        echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
        log "INFO" "Processing story ${story_id} (${current}/${story_count}) - status: ${sprint_status}"

        # Find story file (|| true prevents set -e from exiting on not-found)
        local story_file
        story_file=$(find_story_file "$story_id" || true)

        # Check if story is already completed (done or review status)
        if [[ "$sprint_status" == "done" ]]; then
            log "INFO" "Story ${story_id} already done in sprint-status, skipping"
            echo -e "${GREEN}✓ Story already completed (status: done), skipping${NC}"
            completed_stories+=("$story_id")
            update_story_state "$story_id" "already_completed" "Was already done"
            current=$((current + 1))
            continue
        fi

        # Skip stories in review (dev work complete, pending code review)
        if [[ "$sprint_status" == "review" ]]; then
            log "INFO" "Story ${story_id} in review (dev complete), skipping dev workflow"
            echo -e "${GREEN}✓ Story in review (dev work complete), skipping to next${NC}"
            echo -e "${YELLOW}  → Run code-review workflow separately if needed${NC}"
            completed_stories+=("$story_id")
            update_story_state "$story_id" "in_review" "Dev complete, pending code review"
            current=$((current + 1))
            continue
        fi

        # If story file exists, check if already completed
        if [[ -n "$story_file" && -f "$story_file" ]]; then
            # Double-check: verify story file doesn't have "Status: done"
            if is_story_completed "$story_id" "$story_file"; then
                log "INFO" "Story ${story_id} marked done in story file, skipping"
                echo -e "${GREEN}✓ Story already completed (Status: done in file), skipping${NC}"
                completed_stories+=("$story_id")
                update_story_state "$story_id" "already_completed" "Done in story file"
                current=$((current + 1))
                continue
            fi

            # Check cross-story dependencies
            local blocking_dep
            if ! blocking_dep=$(check_story_dependencies "$story_id" "$story_file"); then
                log "WARN" "Story ${story_id} blocked by dependency: ${blocking_dep}"
                echo -e "${YELLOW}Story blocked by incomplete dependency: ${blocking_dep}${NC}"
                skipped_stories+=("$story_id")
                update_story_state "$story_id" "blocked" "Blocked by dependency: ${blocking_dep}"
                current=$((current + 1))
                continue
            fi
        else
            # No story file - v7-orchestrated-workflow.sh will create it via SM >> create-story
            log "INFO" "Story file not found for ${story_id} - workflow will create it"
            echo -e "${CYAN}Story file not found - will be created by SM agent${NC}"
        fi

        # Determine what to pass to workflow: file path if exists, otherwise story ID
        local workflow_input="${story_file:-$story_id}"

        # Build flags for story workflow
        local story_flags=""
        [[ "$SKIP_AT" == "true" ]] && story_flags="$story_flags --skip-at"
        [[ "$SKIP_RV" == "true" ]] && story_flags="$story_flags --skip-rv"
        story_flags="$story_flags --max-turns $MAX_TURNS"
        story_flags="$story_flags --max-cr-loops $MAX_CR_LOOPS"

        # Run v7 orchestrated story workflow (handles story creation if file doesn't exist)
        update_story_state "$story_id" "in_progress" "Started at $(date -Iseconds)"

        # Track start time for duration calculation
        local story_start_time
        story_start_time=$(date +%s)

        # Capture usage before story starts
        local story_pre_usage story_pre_tokens story_pre_cost
        story_pre_usage=$(query_ccusage_today)
        story_pre_tokens=$(echo "$story_pre_usage" | cut -d'|' -f1)
        story_pre_cost=$(echo "$story_pre_usage" | cut -d'|' -f2)

        if "${SCRIPT_DIR}/v7-orchestrated-workflow.sh" "$workflow_input" $story_flags; then
            log "SUCCESS" "Story ${story_id} completed"
            completed_stories+=("$story_id")
            update_story_state "$story_id" "completed" "Completed successfully"

            # Calculate duration
            local story_end_time
            story_end_time=$(date +%s)
            local story_duration_secs=$((story_end_time - story_start_time))
            local story_duration
            story_duration=$(format_duration "$story_duration_secs")

            # Re-find story file in case it was created by SM agent during workflow
            local completed_story_file
            completed_story_file=$(find_story_file "$story_id" 2>/dev/null || true)

            # Send story completion notification (count completed [x] tasks from story file)
            local task_count
            if [[ -n "$completed_story_file" && -f "$completed_story_file" ]]; then
                # Count completed checkboxes [x] for accurate "tasks executed" count
                task_count=$(grep -cE "^\s*-\s*\[x\]\s*\*\*Task" "$completed_story_file" 2>/dev/null) || task_count=0
                # If no checkboxes found, fallback to counting all task headings
                if [[ "$task_count" -eq 0 ]]; then
                    task_count=$(grep -cE "(^### Task|^\s*-\s*\[.\]\s*\*\*Task|\*\*Task )[0-9]+[a-z]?:" "$completed_story_file" 2>/dev/null) || task_count=0
                fi
            else
                task_count=0
                log "WARN" "Could not find story file for task count: $story_id"
            fi

            # Query usage after story completion and calculate delta
            local story_post_usage story_post_tokens story_post_cost
            story_post_usage=$(query_ccusage_today)
            story_post_tokens=$(echo "$story_post_usage" | cut -d'|' -f1)
            story_post_cost=$(echo "$story_post_usage" | cut -d'|' -f2)

            local story_usage_delta story_tokens story_cost
            story_usage_delta=$(calc_usage_delta "$story_pre_tokens" "$story_pre_cost" "$story_post_tokens" "$story_post_cost")
            story_tokens=$(echo "$story_usage_delta" | cut -d'|' -f1)
            story_cost=$(echo "$story_usage_delta" | cut -d'|' -f2)

            # Accumulate for epic totals
            EPIC_TOTAL_TOKENS=$((EPIC_TOTAL_TOKENS + story_tokens))
            EPIC_TOTAL_COST=$(awk -v a="$EPIC_TOTAL_COST" -v b="$story_cost" 'BEGIN { printf "%.2f", a + b }')

            # Format tokens for display
            local tokens_display
            tokens_display=$(format_tokens "$story_tokens")

            log "INFO" "Story ${story_id} usage: ${tokens_display} tokens (\$${story_cost})"
            send_slack_notification "story_complete" "$story_id" "$task_count" "$story_duration" "$tokens_display" "$story_cost"
        else
            local exit_code=$?
            log "ERROR" "Story ${story_id} failed with exit code $exit_code"

            if [[ $exit_code -eq 10 ]]; then
                # Exit code 10 = story was auto-split into multiple stories
                echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
                echo -e "${GREEN}║  ✓ STORY AUTO-SPLIT COMPLETED                              ║${NC}"
                echo -e "${GREEN}╠════════════════════════════════════════════════════════════╣${NC}"
                echo -e "${GREEN}║  Story ${story_id} was too complex and has been split.     ${NC}"
                echo -e "${GREEN}║  Refreshing story list to include split stories...         ║${NC}"
                echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"

                log "INFO" "Story ${story_id} auto-split completed, refreshing story list"
                update_story_state "$story_id" "split_completed" "Auto-split into multiple stories"

                send_slack_notification "simple" "Story ${story_id} was auto-split into smaller stories. Continuing with split stories."

                # Sync sprint-status.yaml with story files and refresh the list
                log "INFO" "Syncing and refreshing story list after split"
                sync_sprint_status_with_stories
                stories=($(get_stories_from_epic))
                story_count=${#stories[@]}
                log "INFO" "Refreshed: found ${story_count} stories in epic ${EPIC_ID}"
                echo -e "${CYAN}Refreshed story list: ${story_count} stories${NC}"

                # Don't increment current - re-process from current position
                # The split stories should now be in the list
                continue

            elif [[ $exit_code -eq 3 ]]; then
                # Exit code 3 = escalated to human (has unresolved issues but completed)
                escalated_stories+=("$story_id")
                update_story_state "$story_id" "escalated" "Escalated to human review"
                echo -e "${YELLOW}Story ${story_id} has unresolved issues - escalated to human review${NC}"

                # Send detailed notification about the escalation
                send_slack_notification "simple" "Story ${story_id} completed with unresolved issues. Please review: ${story_file}"

                # Continue to next story (escalated but not blocking)
                current=$((current + 1))
                continue

            elif [[ $exit_code -eq 1 ]] && is_complexity_failure "$story_id"; then
                # Exit code 1 with complexity failure - this shouldn't happen anymore
                # since workflow.sh now auto-splits and exits with code 10
                # But keep as fallback for edge cases
                echo -e "${RED}Story ${story_id} complexity failure - split may have failed${NC}"
                log "WARN" "Story ${story_id} complexity failure without auto-split (code 1)"

                failed_stories+=("$story_id")
                update_story_state "$story_id" "complexity_failed" "Auto-split failed"

                send_slack_notification "simple" "Story ${story_id} auto-split FAILED. Manual intervention required."

            else
                # Other failures - but first check if it's a rate limit
                # Check for rate limit in story logs BEFORE counting as failure
                if check_rate_limit_in_story_logs "$story_id"; then
                    # Rate limit was detected and we waited - DON'T count as failure attempt
                    log "INFO" "Rate limit wait complete for story ${story_id} - retrying immediately"
                    echo -e "${GREEN}Rate limit resolved - retrying story ${story_id}${NC}"
                    # Don't increment retry_count, don't add to failed_stories
                    # Just continue to retry the same story
                    continue
                fi

                failed_stories+=("$story_id")
                update_story_state "$story_id" "failed" "Exit code: $exit_code"
                echo -e "${RED}Story ${story_id} failed (exit code: $exit_code)${NC}"

                # Send notification about the failure
                send_slack_notification "simple" "Story ${story_id} FAILED with exit code $exit_code. Manual intervention required."
            fi

            # Auto-retry logic: retry up to MAX_STORY_RETRIES times, with 10 min wait for human override
            local max_story_retries="${MAX_STORY_RETRIES:-3}"
            retry_count=$((retry_count + 1))

            if [[ $retry_count -ge $max_story_retries ]]; then
                echo -e "${RED}Story ${story_id} failed after ${retry_count} attempts - skipping${NC}"
                log "ERROR" "Story ${story_id} exhausted ${max_story_retries} retries - moving to next story"
                skipped_stories+=("$story_id")
                update_story_state "$story_id" "failed_max_retries" "Failed after ${retry_count} retries"
                send_slack_notification "simple" "Story ${story_id} FAILED after ${retry_count} retries. Skipping to next story."
                retry_count=0
                current=$((current + 1))
                continue
            fi

            # Wait 10 minutes for human override, default to retry
            echo -e "${YELLOW}Story ${story_id} failed (attempt ${retry_count}/${max_story_retries}). Auto-retry in 10 minutes.${NC}"
            echo -e "${YELLOW}Send a proceed signal to override: retry/split/stop${NC}"
            log "INFO" "Story ${story_id} failed (attempt ${retry_count}/${max_story_retries}). Auto-retry in 10 min. Waiting for human override..."
            send_slack_notification "simple" "Story ${story_id} FAILED (attempt ${retry_count}/${max_story_retries}). Auto-retry in 10 min. Send proceed signal to override."

            # Poll for human override for 10 minutes, then auto-retry
            local wait_start
            wait_start=$(date +%s)
            local wait_timeout=600  # 10 minutes
            local got_signal=false
            local proceed_result=0  # default: retry

            while true; do
                local elapsed=$(( $(date +%s) - wait_start ))
                if [[ $elapsed -ge $wait_timeout ]]; then
                    echo -e "${CYAN}No human override received. Auto-retrying story ${story_id}...${NC}"
                    log "INFO" "Auto-retry timeout reached for ${story_id}, retrying automatically"
                    break
                fi

                # Check for human signal
                local current_code=""
                current_code=$(curl -s "${BMAD_NPOINT_API_URL}" 2>/dev/null | grep -oE '"proceed"\s*:\s*"[^"]+"' 2>/dev/null | sed 's/.*"proceed"[[:space:]]*:[[:space:]]*"//;s/"//' || true)

                if [[ "$current_code" == "stop" ]]; then
                    got_signal=true
                    proceed_result=2
                    curl -s -X POST "${BMAD_NPOINT_API_URL}" -H "Content-Type: application/json" \
                        -d '{"story":"","proceed":""}' > /dev/null 2>&1 || true
                    break
                elif [[ "$current_code" == "split" ]]; then
                    got_signal=true
                    proceed_result=3
                    curl -s -X POST "${BMAD_NPOINT_API_URL}" -H "Content-Type: application/json" \
                        -d '{"story":"","proceed":""}' > /dev/null 2>&1 || true
                    break
                elif [[ "$current_code" == "retry" ]]; then
                    got_signal=true
                    proceed_result=0
                    curl -s -X POST "${BMAD_NPOINT_API_URL}" -H "Content-Type: application/json" \
                        -d '{"story":"","proceed":""}' > /dev/null 2>&1 || true
                    break
                fi

                local remaining=$(( wait_timeout - elapsed ))
                echo -ne "${CYAN}Auto-retry in ${remaining}s (send proceed signal to override)${NC}\r"
                sleep 30
            done

            if [[ $proceed_result -eq 2 ]]; then
                echo -e "${RED}Workflow stopped by user request${NC}"
                log "INFO" "Workflow stopped by user - stop signal received"
                send_slack_notification "simple" "Epic ${EPIC_ID} workflow STOPPED by user request."
                exit 0
            fi

            if [[ $proceed_result -eq 3 ]]; then
                echo -e "${CYAN}Split requested - retrying story...${NC}"
                log "INFO" "User requested split/retry for ${story_id}"
                send_slack_notification "simple" "Retrying ${story_id} (split requested)..."
                sleep 3
                continue
            fi

            # Default: retry the story
            echo -e "${CYAN}Retrying story ${story_id} (attempt $((retry_count + 1))/${max_story_retries})...${NC}"
            log "INFO" "Retrying story ${story_id} (attempt $((retry_count + 1))/${max_story_retries})"
            sleep 3
            continue
        fi

        # Story succeeded - move to next
        retry_count=0
        current=$((current + 1))

        # Check if we should stop after this story
        if [[ -n "$STOP_AFTER_STORY" && "$story_id" == *"$STOP_AFTER_STORY"* ]]; then
            echo -e "\n${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
            echo -e "${YELLOW}║  STOPPING AFTER STORY: ${story_id}${NC}"
            echo -e "${YELLOW}║  (--stop-after-story ${STOP_AFTER_STORY})${NC}"
            echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
            log "INFO" "Stopping after story ${story_id} as requested (--stop-after-story)"
            send_slack_notification "simple" "Epic ${EPIC_ID} paused after story ${story_id} (--stop-after-story). Resume with --start-story $((current+1))"

            # Skip post-epic phase since we're stopping early
            echo -e "${YELLOW}Skipping post-epic phase (stopped early by request)${NC}"
            update_epic_state "post_epic.status" "skipped_early_stop"

            # Print resume instructions
            echo -e "\n${CYAN}To resume from the next story, run:${NC}"
            echo -e "${CYAN}  $0 ${EPIC_ID} --start-story ${current}${NC}\n"

            exit 0
        fi

        sleep 3
    done

    # =========================================================================
    # POST-EPIC PHASE
    # =========================================================================
    if [[ "$SKIP_POST" == "true" ]]; then
        echo -e "${YELLOW}Skipping post-epic phase (--skip-post flag)${NC}"
        update_epic_state "post_epic.status" "skipped"
    elif [[ ${#failed_stories[@]} -gt 0 ]]; then
        echo -e "${YELLOW}Skipping post-epic phase due to ${#failed_stories[@]} failed stories${NC}"
        update_epic_state "post_epic.status" "skipped_failures"
    else
        log_phase "3: TEA *TR - Epic Traceability & Quality Gate"
        if run_claude_step "$AGENT_TEA" "$WORKFLOW_TRACE" "${EPIC_ID}" "tea-trace"; then
            update_epic_state "post_epic.traceability" "completed"
        else
            update_epic_state "post_epic.traceability" "failed"
        fi

        if [[ "$IS_LAST_EPIC" == "true" ]]; then
            log_phase "4: TEA *NR - NFR Assessment"
            if run_claude_step "$AGENT_TEA" "$WORKFLOW_NFR" "${EPIC_ID}" "tea-nfr"; then
                update_epic_state "post_epic.nfr_assessment" "completed"
            else
                update_epic_state "post_epic.nfr_assessment" "failed"
            fi
        fi

        log_phase "5: Retrospective"
        if run_claude_step "$AGENT_SM" "$WORKFLOW_RETROSPECTIVE" "${EPIC_ID}" "sm-retrospective"; then
            update_epic_state "post_epic.retrospective" "completed"
        else
            update_epic_state "post_epic.retrospective" "failed"
        fi

        update_epic_state "post_epic.status" "completed"
    fi

    # =========================================================================
    # POST-EPIC TESTING PHASE
    # =========================================================================
    if [[ "$RUN_TESTS" == "true" ]]; then
        log_phase "6: POST-EPIC TESTING"

        local test_args=("${EPIC_ID}")
        [[ -n "$TEST_FRONTEND_URL" ]] && test_args+=(--frontend-url "$TEST_FRONTEND_URL")
        [[ -n "$TEST_API_URL" ]] && test_args+=(--api-url "$TEST_API_URL")
        [[ "$FIX_TEST_BUGS" == "true" ]] && test_args+=(--fix-bugs)
        [[ "$CREATE_TEST_STORIES" == "true" ]] && test_args+=(--create-stories)

        if "${SCRIPT_DIR}/v7-post-epic-test-runner.sh" "${test_args[@]}"; then
            update_epic_state "post_epic.testing" "completed"
            log "SUCCESS" "Post-epic testing completed"
        else
            update_epic_state "post_epic.testing" "failed"
            log "WARN" "Post-epic testing completed with failures"
        fi
    else
        update_epic_state "post_epic.testing" "skipped"
    fi

    # =========================================================================
    # FINAL SUMMARY
    # =========================================================================
    log_phase "FINAL: Epic Summary"

    local completed_count=${#completed_stories[@]}
    local failed_count=${#failed_stories[@]}
    local skipped_count=${#skipped_stories[@]}
    local escalated_count=${#escalated_stories[@]}

    echo -e "${BLUE}Epic Summary:${NC}"
    echo -e "  Total stories:     ${story_count}"
    echo -e "  Completed:         ${completed_count}"
    echo -e "  Skipped:           ${skipped_count}"
    echo -e "  Failed:            ${failed_count}"
    echo -e "  Escalated:         ${escalated_count}"
    echo -e "  State file:        ${EPIC_STATE_FILE}"

    # Update summary in state file
    sed -i.bak "s|total_stories:.*|total_stories: ${story_count}|" "$EPIC_STATE_FILE"
    sed -i.bak "s|completed:.*|completed: ${completed_count}|" "$EPIC_STATE_FILE"
    sed -i.bak "s|failed:.*|failed: ${failed_count}|" "$EPIC_STATE_FILE"
    sed -i.bak "s|skipped:.*|skipped: ${skipped_count}|" "$EPIC_STATE_FILE"
    sed -i.bak "s|escalated:.*|escalated: ${escalated_count}|" "$EPIC_STATE_FILE"
    rm -f "${EPIC_STATE_FILE}.bak"

    # Calculate epic duration
    local epic_end_time
    epic_end_time=$(date +%s)
    local epic_duration_secs=$((epic_end_time - epic_start_time))
    local epic_duration
    epic_duration=$(format_duration "$epic_duration_secs")

    # Format epic usage totals for display
    local epic_tokens_display
    epic_tokens_display=$(format_tokens "$EPIC_TOTAL_TOKENS")
    log "INFO" "Epic ${EPIC_ID} total usage: ${epic_tokens_display} tokens (\$${EPIC_TOTAL_COST})"

    # Send epic completion notification
    if [[ $failed_count -eq 0 && $escalated_count -eq 0 ]]; then
        echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  EPIC COMPLETE: ${EPIC_ID}${NC}"
        echo -e "${GREEN}║  All ${completed_count} stories completed successfully!${NC}"
        echo -e "${GREEN}║  Duration: ${epic_duration}${NC}"
        echo -e "${GREEN}║  Usage: ${epic_tokens_display} tokens | Est. \$${EPIC_TOTAL_COST}${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}\n"

        send_slack_notification "epic_complete" "$EPIC_ID" "$completed_count" "$epic_duration" "$epic_tokens_display" "$EPIC_TOTAL_COST"
        log "SUCCESS" "V7 Orchestrated Epic Workflow completed for ${EPIC_ID} in ${epic_duration}"
    else
        echo -e "\n${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}║  EPIC INCOMPLETE: ${EPIC_ID}${NC}"
        echo -e "${YELLOW}║  Completed: ${completed_count}, Failed: ${failed_count}, Escalated: ${escalated_count}${NC}"
        echo -e "${YELLOW}║  Duration: ${epic_duration}${NC}"
        echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}\n"

        send_slack_notification "simple" "Epic ${EPIC_ID} incomplete (${epic_duration}): ${completed_count} completed, ${failed_count} failed, ${escalated_count} escalated"
        log "WARN" "V7 Orchestrated Epic Workflow incomplete for ${EPIC_ID} after ${epic_duration}"
    fi

    log "INFO" "Epic state file: ${EPIC_STATE_FILE}"
    log "INFO" "Full log: ${WORKFLOW_LOG}"
}

# Run main
main "$@"
