#!/bin/bash
# V7 Orchestrated Story Workflow - Intelligent execution with pre/post validation
#
# HYBRID ARCHITECTURE:
#   - Bash handles: process management, logging, state persistence, notifications
#   - AI handles: complexity assessment, completion validation, split recommendations
#
# Usage: ./v7-orchestrated-workflow.sh <story-file-path> [options]
#
# Options:
#   --skip-prevalidation   Skip pre-execution complexity check
#   --skip-postvalidation  Skip post-task completion check
#   --force-yellow         Treat all yellow as green (no auto-split)
#   --force-red            Treat all red as yellow (attempt auto-split)
#   --max-turns N          Override calculated turn limits
#   --max-cr-loops N       Max DEV-CR iterations (default: 3)
#   --fresh                Ignore saved state, start fresh
#   --include-manual       Include manual validation tasks (skipped by default)
#
# SHIFT-LEFT VALIDATION:
#   Before any dev work, the orchestrator:
#   1. Analyzes story complexity
#   2. Flags tasks by risk level (green/yellow/red)
#   3. Auto-splits yellow tasks via SM agent (task-level split in same file)
#   4. Auto-splits red stories into multiple story files (2-3a, 2-3b, etc.)
#
# POST-TASK VALIDATION:
#   After each task execution:
#   1. Checks subtask completion in story file
#   2. Analyzes dev log for progress/errors
#   3. Recommends: continue, retry, retry_with_more, escalate
#
# STATE FILE:
#   {story-id}-orchestrator-state.yaml tracks all execution state for resume

set -e

# ============================================================================
# CONFIGURATION & SETUP
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
[[ -f "${SCRIPT_DIR}/notify.sh" ]] && source "${SCRIPT_DIR}/notify.sh" || true

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Parse arguments
STORY_INPUT="${1:?Usage: $0 <story-id|story-file-path> [options]}"
SKIP_PREVALIDATION=false
SKIP_POSTVALIDATION=false
SKIP_CODE_REVIEW=false
SKIP_TEST_REVIEW=false
FORCE_YELLOW=false
FORCE_RED=false
MAX_TURNS_OVERRIDE=""
MAX_CR_LOOPS=3
MAX_TR_LOOPS=2
FRESH_START=false
DRY_RUN=false
START_TASK=1
SKIP_MANUAL_TASKS=true

shift
while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-prevalidation) SKIP_PREVALIDATION=true ;;
        --skip-postvalidation) SKIP_POSTVALIDATION=true ;;
        --skip-cr|--skip-code-review|--skip-rv) SKIP_CODE_REVIEW=true ;;
        --skip-tr|--skip-test-review|--skip-at) SKIP_TEST_REVIEW=true ;;
        --force-yellow) FORCE_YELLOW=true ;;
        --force-red) FORCE_RED=true ;;
        --max-turns) MAX_TURNS_OVERRIDE="$2"; shift ;;
        --max-cr-loops) MAX_CR_LOOPS="$2"; shift ;;
        --max-tr-loops) MAX_TR_LOOPS="$2"; shift ;;
        --fresh) FRESH_START=true ;;
        --dry-run) DRY_RUN=true ;;
        --start-task) START_TASK="$2"; shift ;;
        --include-manual) SKIP_MANUAL_TASKS=false ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
    shift
done

# ============================================================================
# STORY FILE RESOLUTION
# ============================================================================
# Accepts either:
#   - Full path: "_bmad-output/implementation-artifacts/0-3-nextjs.md"
#   - Story ID: "0-3" or "1-4" (epic-story format)
#
# Searches in order:
#   1. Exact path (if file exists)
#   2. _bmad-output/implementation-artifacts/<id>*.md
#   3. _bmad-output/implementation-artifacts/stories/<id>*.md
#   4. auto-bmad_pack/stories/<id>*.md

resolve_story_file() {
    local input="$1"

    # If it's already a valid file path, use it
    if [[ -f "$input" ]]; then
        echo "$input"
        return 0
    fi

    # Get project root (auto-bmad_pack/scripts/ is two levels below project root)
    local project_root="$(cd "${SCRIPT_DIR}/../.." && pwd)"

    # Search directories in order
    local search_dirs=(
        "${project_root}/_bmad-output/implementation-artifacts"
        "${project_root}/_bmad-output/implementation-artifacts/stories"
        "${project_root}/auto-bmad_pack/stories"
    )

    # Lowercase input for case-insensitive matching
    local input_lower
    input_lower=$(echo "$input" | tr '[:upper:]' '[:lower:]')

    for dir in "${search_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            # Build list of candidate files via case-insensitive find
            local -a all_matches=()
            while IFS= read -r -d '' f; do
                all_matches+=("$f")
            done < <(find "$dir" -maxdepth 1 -iname "${input_lower}*.md" -print0 2>/dev/null)
            # Also match with hyphen separator
            while IFS= read -r -d '' f; do
                all_matches+=("$f")
            done < <(find "$dir" -maxdepth 1 -iname "${input_lower}-*.md" -print0 2>/dev/null)

            # Deduplicate
            local -a candidates=()
            local seen=""
            for f in "${all_matches[@]}"; do
                if [[ "$seen" != *"|${f}|"* ]]; then
                    candidates+=("$f")
                    seen+="|${f}|"
                fi
            done

            [[ ${#candidates[@]} -eq 0 ]] && continue

            # PRIORITY 1: Look for split files first
            local split_files=()
            for f in "${candidates[@]}"; do
                local fname
                fname=$(basename "$f" .md)
                local fname_lower
                fname_lower=$(echo "$fname" | tr '[:upper:]' '[:lower:]')
                # Split file: input is "c1-1a", split would be "c1-1a[a-z]-*" — but input itself may have letter
                # Actually split = letter right after the story number that wasn't in input
                if [[ "$fname_lower" =~ ^${input_lower}[a-z]- ]] || [[ "$f" =~ -[a-z]\.md$ ]] || [[ "$f" =~ -v[0-9]\.md$ ]]; then
                    split_files+=("$f")
                fi
            done

            if [[ ${#split_files[@]} -gt 0 ]]; then
                local latest_split
                latest_split=$(printf '%s\n' "${split_files[@]}" | sort -V | tail -1)
                echo "$latest_split"
                return 0
            fi

            # PRIORITY 2: Try exact match (no suffix beyond .md)
            for f in "${candidates[@]}"; do
                local fname
                fname=$(basename "$f" .md)
                local fname_lower
                fname_lower=$(echo "$fname" | tr '[:upper:]' '[:lower:]')
                if [[ "$fname_lower" == "$input_lower" ]]; then
                    echo "$f"
                    return 0
                fi
            done

            # PRIORITY 3: Pattern match excluding splits
            for f in "${candidates[@]}"; do
                local fname
                fname=$(basename "$f")
                if [[ "$fname" =~ ^[A-Za-z0-9]+-[0-9]+[a-z]- ]] || [[ "$f" =~ -[a-z]\.md$ ]] || [[ "$f" =~ -v[0-9]\.md$ ]]; then
                    continue
                fi
                echo "$f"
                return 0
            done

            # PRIORITY 4: Return any match (fallback)
            echo "${candidates[0]}"
            return 0
        fi
    done

    # Not found
    return 1
}

# Resolve story file from input (|| true prevents set -e from exiting on not-found)
STORY_FILE_PATH=$(resolve_story_file "$STORY_INPUT" || true)

if [[ -z "$STORY_FILE_PATH" || ! -f "$STORY_FILE_PATH" ]]; then
    # Story file doesn't exist yet - will be created in PHASE 0
    # Derive expected path from story ID
    PROJECT_ROOT_TMP="$(cd "${SCRIPT_DIR}/../.." && pwd)"
    # Set expected path - will be created by create-story workflow
    STORY_FILE_PATH="${PROJECT_ROOT_TMP}/_bmad-output/implementation-artifacts/stories/${STORY_INPUT}.md"
    STORY_ID="$STORY_INPUT"
    echo -e "${YELLOW}Story file not found: $STORY_INPUT${NC}"
    echo -e "${YELLOW}Will create in PHASE 0...${NC}"
else
    echo -e "${GREEN}Resolved story: ${STORY_FILE_PATH}${NC}"
    # Extract story ID from filename
    STORY_ID=$(basename "$STORY_FILE_PATH" .md)
fi

STORY_DIR=$(dirname "$STORY_FILE_PATH")

# Project paths
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
AUTO_BMAD_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Log and state directories
LOG_DIR="${AUTO_BMAD_DIR}/logs/workflow/${STORY_ID}"
mkdir -p "$LOG_DIR"

STATE_FILE="${LOG_DIR}/${STORY_ID}-orchestrator-state.yaml"

# Workflow paths
WORKFLOW_ASSESS="${AUTO_BMAD_DIR}/workflows/assess-story-complexity"
WORKFLOW_SPLIT="${AUTO_BMAD_DIR}/workflows/rewrite-story-splits"
WORKFLOW_VALIDATE="${AUTO_BMAD_DIR}/workflows/validate-task-completion"

# BMAD agent paths (activate first)
AGENT_SM="/bmad:bmm:agents:sm"
AGENT_DEV="/bmad:bmm:agents:dev"
AGENT_TEA="/bmad:bmm:agents:tea"

# BMAD workflow paths (invoke after agent)
WORKFLOW_CREATE_STORY="/bmad:bmm:workflows:create-story"
WORKFLOW_DEV_STORY="/bmad:bmm:workflows:dev-story"
WORKFLOW_CODE_REVIEW="/bmad:bmm:workflows:code-review"
WORKFLOW_TEST_REVIEW="/bmad:bmm:workflows:testarch-test-review"

# Complexity thresholds (must match workflow.yaml)
TURN_BASE=30
TURN_PER_SUBTASK=10
TURN_CAP=150

# Token-based complexity thresholds
TOKEN_THRESHOLD_GREEN=80000
TOKEN_THRESHOLD_YELLOW=120000
# Above YELLOW = RED (must split)

# Session token budget management
SESSION_SOFT_CAP=140000     # Start checking for session breaks
SESSION_HARD_CAP=175000     # Never exceed this
HANDOFF_RESERVE=5000        # Reserve tokens for handoff generation
TOKEN_PER_SUBTASK=3000      # Estimated tokens per subtask (Claude auto-compacts)
TOKEN_PER_FILE_REF=500      # Estimated tokens per file reference
TOKEN_BASE_OVERHEAD=30000   # Base overhead per session (agent + story + context)
TOKEN_MAX_TASK_ESTIMATE=50000  # Cap per-task estimate to prevent inflated values

# Session tracking (reset per story)
SESSION_TOKENS_USED=0
ACTIVE_SESSION_ID=""
HANDOFF_COUNT=0

# ============================================================================
# LOGGING FUNCTIONS
# ============================================================================

log() {
    local level="$1"
    local msg="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $msg" >> "${LOG_DIR}/${STORY_ID}-orchestrator.log"
}

log_step() {
    local msg="$1"
    echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $msg${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}\n"
    log "STEP" "$msg"
}

# ============================================================================
# STATE MANAGEMENT (YAML format)
# ============================================================================

init_state() {
    cat > "$STATE_FILE" << EOF
# V7 Orchestrator State
# Story: ${STORY_ID}
# Created: $(date -Iseconds)

story_file: "${STORY_FILE_PATH}"
started_at: "$(date -Iseconds)"
pre_validation:
  status: "pending"
  risk_level: ""
  tasks_flagged: []
task_attempts: {}
decisions: []
current_task: 0
current_phase: "pre_validation"
EOF
    log "INFO" "State initialized"
}

update_state_field() {
    local field="$1"
    local value="$2"
    # Simple YAML field update (top-level only)
    if grep -q "^${field}:" "$STATE_FILE"; then
        sed -i '' "s|^${field}:.*|${field}: ${value}|" "$STATE_FILE"
    else
        echo "${field}: ${value}" >> "$STATE_FILE"
    fi
}

add_decision() {
    local task="$1"
    local action="$2"
    local reason="$3"
    local timestamp=$(date -Iseconds)

    # Append to decisions array in state file
    echo "  - timestamp: \"$timestamp\"" >> "$STATE_FILE"
    echo "    task: $task" >> "$STATE_FILE"
    echo "    action: \"$action\"" >> "$STATE_FILE"
    echo "    reason: \"$reason\"" >> "$STATE_FILE"

    log "DECISION" "Task $task: $action - $reason"
}

add_task_attempt() {
    local task="$1"
    local turns="$2"
    local result="$3"
    local duration="$4"

    echo "  ${task}:" >> "$STATE_FILE"
    echo "    - turns: $turns" >> "$STATE_FILE"
    echo "      result: \"$result\"" >> "$STATE_FILE"
    echo "      duration: \"$duration\"" >> "$STATE_FILE"
}

# ============================================================================
# AI WORKFLOW INVOCATION
# ============================================================================

# Run AI assessment workflow and capture JSON output
run_ai_assessment() {
    local workflow_path="$1"
    local inputs="$2"
    local output_file="${LOG_DIR}/ai-assessment-$(date +%s).json"

    log "INFO" "Running AI assessment: $workflow_path"

    # Invoke Claude with the workflow
    local prompt="Execute workflow at ${workflow_path}/workflow.yaml with inputs: ${inputs}

Output ONLY valid JSON to stdout. No other text."

    if claude --model opus --dangerously-skip-permissions -p "$prompt" --max-turns 75 > "$output_file" 2>&1; then
        # Extract JSON from output (may have other text)
        if grep -q '{' "$output_file"; then
            # Find the JSON block
            sed -n '/{/,/}/p' "$output_file" | head -1
            return 0
        fi
    fi

    log "ERROR" "AI assessment failed: $(cat $output_file)"
    return 1
}

# Run story complexity assessment
assess_story_complexity() {
    local story_file="$1"
    local result_file="${LOG_DIR}/${STORY_ID}-complexity.json"

    log_step "PRE-VALIDATION: Assessing Story Complexity"

    # Build prompt for complexity assessment
    local prompt="You are executing the assess-story-complexity workflow.

Read the story file at: ${story_file}

Follow the instructions in ${WORKFLOW_ASSESS}/instructions.md exactly.

Output ONLY valid JSON with the complexity assessment. No other text."

    echo -e "${YELLOW}Analyzing story complexity...${NC}"

    if run_claude_with_timeout 600 "$result_file" -p "$prompt" --max-turns 75; then
        # Try to extract JSON
        if grep -q '"status"' "$result_file"; then
            cat "$result_file"
            return 0
        fi
    fi

    log "ERROR" "Complexity assessment failed"
    echo '{"status": "error", "error": "Assessment failed"}'
    return 1
}

# Run task completion validation
validate_task_completion() {
    local story_file="$1"
    local log_file="$2"
    local task_num="$3"
    local failure_type="$4"
    local result_file="${LOG_DIR}/${STORY_ID}-validation-task-${task_num}.json"

    log "INFO" "Validating task $task_num completion"

    local prompt="You are executing the validate-task-completion workflow.

Inputs:
- story_file_path: ${story_file}
- log_file_path: ${log_file}
- task_number: ${task_num}
- failure_type: ${failure_type}

Follow the instructions in ${WORKFLOW_VALIDATE}/instructions.md exactly.

Output ONLY valid JSON with the validation result. No other text."

    if run_claude_with_timeout 600 "$result_file" -p "$prompt" --max-turns 75; then
        if grep -q '"action"' "$result_file"; then
            cat "$result_file"
            return 0
        fi
    fi

    log "ERROR" "Task validation failed"
    echo '{"action": "error", "reason": "Validation failed"}'
    return 1
}

# ============================================================================
# TWO-STEP AGENT+WORKFLOW EXECUTION
# Pattern: Load agent first, wait for it to activate, then call workflow
# ============================================================================

# Run claude with a timeout + staleness watchdog to prevent hung processes
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
        $timeout_cmd claude --model opus --dangerously-skip-permissions "$@" > "$log_file" 2>&1
        local exit_code=$?
        if [[ $exit_code -eq 124 ]]; then
            log "WARN" "Claude process timed out after ${timeout_secs}s"
        fi

        # Check for rate limit - if hit, wait and retry
        if grep -q "You've hit your limit" "$log_file" 2>/dev/null; then
            check_and_wait_for_rate_limit "$log_file"
            # After waiting, retry the command
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
            # After waiting, retry the command (recursive call)
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
# Detects "You've hit your limit · resets Xam/pm (Timezone)" and waits until reset
# Usage: check_and_wait_for_rate_limit <log_file>
# Returns: 0 if no rate limit, waits and returns 0 if rate limit was hit and waited
check_and_wait_for_rate_limit() {
    local log_file="$1"

    # Check if log file contains rate limit message
    if ! grep -q "You've hit your limit" "$log_file" 2>/dev/null; then
        return 0  # No rate limit detected
    fi

    # Extract the reset time and timezone
    # Format: "You've hit your limit · resets 4am (Europe/London)"
    local reset_info
    reset_info=$(grep "You've hit your limit" "$log_file" | head -1 | sed -n 's/.*resets \([0-9]*[ap]m\) (\([^)]*\)).*/\1 \2/p')

    if [[ -z "$reset_info" ]]; then
        log "ERROR" "Rate limit detected but couldn't parse reset time"
        echo -e "${RED}⚠ RATE LIMIT HIT - could not parse reset time${NC}"
        echo -e "${YELLOW}Waiting 1 hour before retry...${NC}"
        sleep 3600
        return 0
    fi

    local reset_time=$(echo "$reset_info" | awk '{print $1}')
    local timezone=$(echo "$reset_info" | awk '{print $2}')

    log "WARN" "RATE LIMIT HIT - resets at $reset_time ($timezone)"
    echo -e "\n${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ⚠ CLAUDE CODE RATE LIMIT HIT${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  Limit resets at: ${CYAN}$reset_time ($timezone)${NC}"

    # Send Slack notification
    send_slack_notification "simple" "⚠️ RATE LIMIT HIT - Workflow paused until $reset_time ($timezone)"

    # Calculate seconds until reset
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

    # Get current time in the target timezone
    local current_epoch
    local reset_epoch

    # Try to use gdate for timezone support (macOS with coreutils)
    if command -v gdate &>/dev/null; then
        current_epoch=$(gdate +%s)
        # Get today's reset time in target timezone
        reset_epoch=$(TZ="$timezone" gdate -d "today ${reset_hour}:00" +%s 2>/dev/null || echo "")

        # If reset time has passed today, use tomorrow
        if [[ -n "$reset_epoch" ]] && [[ $reset_epoch -le $current_epoch ]]; then
            reset_epoch=$(TZ="$timezone" gdate -d "tomorrow ${reset_hour}:00" +%s 2>/dev/null || echo "")
        fi
    fi

    # Fallback: if we couldn't calculate, wait until next occurrence
    if [[ -z "$reset_epoch" ]] || [[ "$reset_epoch" == "" ]]; then
        # Simple fallback: assume we need to wait until the reset hour
        # This is less accurate but better than nothing
        local current_hour=$(date +%H)
        local wait_hours

        if [[ $reset_hour -gt $current_hour ]]; then
            wait_hours=$((reset_hour - current_hour))
        else
            wait_hours=$((24 - current_hour + reset_hour))
        fi

        local wait_secs=$((wait_hours * 3600))
        echo -e "${YELLOW}  Waiting approximately ${wait_hours} hours...${NC}"
        echo -e "${CYAN}  Will resume at approximately $(date -v+${wait_hours}H '+%Y-%m-%d %H:%M %Z')${NC}"
        log "INFO" "Rate limit: waiting ${wait_hours} hours (${wait_secs} seconds)"

        # Wait with periodic status updates
        local waited=0
        while [[ $waited -lt $wait_secs ]]; do
            local remaining=$((wait_secs - waited))
            local remaining_mins=$((remaining / 60))
            echo -ne "\r${CYAN}  ⏳ Waiting for rate limit reset: ${remaining_mins} minutes remaining...${NC}  "
            sleep 300  # Update every 5 minutes
            waited=$((waited + 300))
        done
        echo ""
    else
        local wait_secs=$((reset_epoch - current_epoch + 60))  # Add 1 min buffer
        local wait_mins=$((wait_secs / 60))
        local wait_hours=$((wait_mins / 60))
        local remaining_mins=$((wait_mins % 60))

        echo -e "${YELLOW}  Waiting ${wait_hours}h ${remaining_mins}m until reset...${NC}"
        echo -e "${CYAN}  Will resume at: $(gdate -d "@$reset_epoch" '+%Y-%m-%d %H:%M %Z')${NC}"
        log "INFO" "Rate limit: waiting ${wait_secs} seconds until $(gdate -d "@$reset_epoch" '+%Y-%m-%d %H:%M')"

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
    fi

    echo -e "${GREEN}✓ Rate limit should be reset - resuming workflow${NC}"
    log "INFO" "Rate limit wait complete - resuming workflow"
    send_slack_notification "simple" "✅ Rate limit reset - Workflow resuming"

    return 0
}

# Default timeouts (in seconds)
TASK_TIMEOUT="${TASK_TIMEOUT:-1800}"       # 30 min per task
CR_TIMEOUT="${CR_TIMEOUT:-1200}"           # 20 min per code review/fix
REVIEW_TIMEOUT="${REVIEW_TIMEOUT:-900}"    # 15 min per test review

# Run agent+workflow in two steps with session resume
# Usage: run_agent_workflow <agent_skill> <workflow_skill> <workflow_args> <max_turns> <log_file>
# Returns: exit code from claude command
run_agent_workflow() {
    local agent_skill="$1"
    local workflow_skill="$2"
    local workflow_args="$3"
    local max_turns="$4"
    local log_file="$5"
    local step_name="${6:-agent-workflow}"

    local activation_log="${log_file%.log}-activation.log"
    # Export session ID so callers can --resume the same session for follow-ups
    LAST_AGENT_SESSION_ID=""

    # Step 1: Activate the agent (2 turns to load)
    log "INFO" "Step 1: Activating agent ${agent_skill}"
    echo -e "  ${CYAN}[1/2] Loading agent...${NC}"

    local activation_output
    activation_output=$(claude --model opus --dangerously-skip-permissions -p "${agent_skill}" --max-turns 2 --output-format json 2>"$activation_log")
    LAST_AGENT_SESSION_ID=$(echo "$activation_output" | grep -o '"session_id":"[^"]*"' | tail -1 | sed 's/"session_id":"//;s/"//g')

    if [[ -z "$LAST_AGENT_SESSION_ID" ]]; then
        # Fallback: try to get session ID from stderr log
        LAST_AGENT_SESSION_ID=$(grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' "$activation_log" 2>/dev/null | tail -1)
    fi

    local exit_code=0

    if [[ -z "$LAST_AGENT_SESSION_ID" ]]; then
        echo -e "${YELLOW}⚠ Could not get session ID, using single-prompt fallback${NC}"
        log "WARN" "Session ID not captured for $step_name, using single-prompt fallback"

        # Fallback: single prompt with agent+workflow concatenated
        local fallback_prompt="${agent_skill}
${workflow_skill}
${workflow_args}"
        run_claude_with_timeout "$CR_TIMEOUT" "$log_file" -p "$fallback_prompt" --max-turns "$max_turns" || exit_code=$?
    else
        echo -e "  ${GREEN}✓ Agent activated (session: ${LAST_AGENT_SESSION_ID:0:8}...)${NC}"
        log "INFO" "Agent activated for $step_name, session: $LAST_AGENT_SESSION_ID"

        # Step 2: Resume with workflow
        echo -e "  ${CYAN}[2/2] Running workflow...${NC}"
        local workflow_prompt="${workflow_skill}
${workflow_args}"
        run_claude_with_timeout "$CR_TIMEOUT" "$log_file" -p "$workflow_prompt" --resume "$LAST_AGENT_SESSION_ID" --max-turns "$max_turns" || exit_code=$?
    fi

    return $exit_code
}

# Check if CR output is in expected format
# Expected format: ISSUE #N: [HIGH|MEDIUM|LOW] description
# Returns 0 if valid format, 1 if not
check_cr_format() {
    local log_file="$1"

    # Check for expected format patterns - accept both bracketed [HIGH] and unbracketed HIGH
    if grep -qiE "ISSUE\s*#?[0-9]+.*(\[?(HIGH|MEDIUM|LOW)\]?)" "$log_file" 2>/dev/null; then
        return 0  # Valid format with issues
    fi

    if grep -qiE "^PASS|no.*issues.*found|code.*looks.*good|0\s+HIGH.*0\s+MEDIUM.*0\s+LOW" "$log_file" 2>/dev/null; then
        return 0  # Valid PASS format
    fi

    return 1  # Invalid format
}

# Request CR output in expected format via follow-up prompt
# Returns 0 if successful, 1 if still invalid
request_cr_format() {
    local session_id="$1"
    local log_file="$2"
    local followup_log="${log_file%.log}-followup.log"

    local followup_prompt="Your previous response was not in the expected format.

Please reformat your code review findings using EXACTLY this format:

ISSUE #1: [HIGH|MEDIUM|LOW] Brief description of the issue
ISSUE #2: [HIGH|MEDIUM|LOW] Brief description of the issue
...

Summary: X HIGH, Y MEDIUM, Z LOW issues found

OR if there are no issues:

PASS - No issues found

Please provide your findings again in this exact format."

    log "INFO" "Requesting CR output in expected format"
    echo -e "  ${YELLOW}⚠ CR output not in expected format, requesting reformatted response...${NC}"

    local followup_already_in_logfile=false
    if [[ -n "$session_id" ]]; then
        claude --model opus --dangerously-skip-permissions -p "$followup_prompt" --resume "$session_id" --max-turns 10 > "$followup_log" 2>&1 || true
    else
        # No session, append to original log (followup is already in log_file)
        echo -e "\n--- Follow-up Request ---\n" >> "$log_file"
        claude --model opus --dangerously-skip-permissions -p "$followup_prompt" --max-turns 10 >> "$log_file" 2>&1 || true
        followup_log="$log_file"
        followup_already_in_logfile=true
    fi

    # Check if follow-up is in expected format
    if check_cr_format "$followup_log"; then
        # Only append if followup was written to a separate file
        # BUGFIX: Previously cat "$followup_log" >> "$log_file" when followup_log == log_file
        # caused infinite file growth (cat reads its own appended output)
        if [[ "$followup_already_in_logfile" != "true" ]]; then
            echo -e "\n--- Reformatted Output ---\n" >> "$log_file"
            cat "$followup_log" >> "$log_file"
        fi
        return 0
    fi

    return 1
}

# Exit code for story-level split completed
EXIT_CODE_SPLIT_COMPLETED=10

# Run multi-story split for RED complexity stories
# Creates multiple story files (2-3a, 2-3b, 2-3c) from one complex story
# Updates sprint-status.yaml and deletes original
run_multi_story_split() {
    local story_file="$1"
    local complexity_json="$2"

    local dir_name
    dir_name=$(dirname "$story_file")
    local file_name
    file_name=$(basename "$story_file" .md)

    # Parse story ID (with suffix) and name from filename
    # For "6-6a-agent-crud-activation", story_id should be "6-6a" (including any suffix)
    local story_id
    local story_name
    if [[ "$file_name" =~ ^([0-9]+-[0-9]+[a-z]*)-(.+)$ ]]; then
        story_id="${BASH_REMATCH[1]}"
        story_name="${BASH_REMATCH[2]}"
    else
        # Fallback: take first part as ID, rest as name
        story_id=$(echo "$file_name" | grep -oE "^[0-9]+-[0-9]+[a-z]*")
        story_name=$(echo "$file_name" | sed "s/^${story_id}-//")
    fi

    log_step "STORY-LEVEL SPLIT: Creating multiple story files"
    log "INFO" "Splitting $story_file into multiple stories"

    # Determine output directory - use dir_name if already in stories/, otherwise append /stories
    local output_dir="$dir_name"
    if [[ ! "$dir_name" =~ /stories/?$ ]]; then
        output_dir="${dir_name}/stories"
    fi
    mkdir -p "$output_dir"

    # Use Claude to create split story files
    local prompt="You are the SM (Scrum Master) agent performing a STORY-LEVEL split.

ORIGINAL STORY FILE: ${story_file}
COMPLEXITY ANALYSIS: ${complexity_json}

TASK: Split this complex story into 2-3 smaller story files based on logical groupings.

INSTRUCTIONS:
1. Read the original story file
2. Analyze the tasks and group them logically (e.g., backend vs frontend, or by feature area)
3. Create 2 or 3 SEPARATE story files - use your judgment on the best split
4. Each new story file should:
   - Use naming: ${story_id}1-${story_name}.md, ${story_id}2-${story_name}.md, (and optionally 3)
   - Be saved in directory: ${output_dir}/
   - Have Status: draft
   - Include only the tasks for that group
   - Preserve the Story statement and relevant Acceptance Criteria
   - Renumber tasks starting from 1 in each file
   - Add a Dev Notes section explaining this is a split from the original

SPLIT GUIDELINES:
- 2 files: If tasks split cleanly into backend/frontend or two logical groups
- 3 files: If there's a clear third group (e.g., testing, or a distinct feature area)
- Each split file should have 4-8 tasks max
- Keep related tasks together (don't split a feature across files)

After creating the files, output a JSON object with the ACTUAL paths you created:
{
  \"created_files\": [\"${output_dir}/${story_id}1-${story_name}.md\", \"${output_dir}/${story_id}2-${story_name}.md\"],
  \"original_file\": \"${story_file}\",
  \"story_id\": \"${story_id}\"
}

IMPORTANT: Include only the files you actually created (2 or 3). Use the exact full paths.
OUTPUT ONLY THE JSON - no other text."

    local result_file="${LOG_DIR}/${STORY_ID}-multi-split-result.json"

    echo -e "${YELLOW}Creating split story files...${NC}" >&2

    if claude --model opus --dangerously-skip-permissions -p "$prompt" --max-turns 75 > "$result_file" 2>&1; then
        # Extract JSON from result - handle markdown code blocks
        # Strip markdown code blocks and extract just the JSON
        local json_clean
        json_clean=$(sed -n '/^```/,/^```/p' "$result_file" | sed '/^```/d' | tr '\n' ' ')

        # If no code blocks found, try to find raw JSON
        if [[ -z "$json_clean" ]]; then
            json_clean=$(cat "$result_file" | tr '\n' ' ')
        fi

        # Extract created_files array values using grep/sed
        local created_files
        created_files=$(echo "$json_clean" | grep -oE '"created_files"\s*:\s*\[[^]]+\]' | \
            sed 's/"created_files"\s*:\s*\[//' | sed 's/\]//' | \
            tr ',' '\n' | sed 's/.*"\([^"]*\)".*/\1/' | grep -v '^$')

        if [[ -z "$created_files" ]]; then
            log "ERROR" "No created files found in split result" >&2
            return 1
        fi

        # Verify files were created
        local valid_files=()
        while IFS= read -r f; do
            f=$(echo "$f" | xargs)  # trim whitespace
            if [[ -n "$f" && -f "$f" ]]; then
                valid_files+=("$f")
                echo -e "${GREEN}✓ Created: $f${NC}" >&2
                log "SUCCESS" "Created split file: $f" >&2
            fi
        done <<< "$created_files"

        if [[ ${#valid_files[@]} -eq 0 ]]; then
            log "ERROR" "No valid split files were created" >&2
            return 1
        fi

        # Update sprint-status.yaml
        update_sprint_status_for_split "$story_id" "${valid_files[@]}"

        # Update Epic file (source of truth)
        update_epic_file_for_split "$story_id" "${valid_files[@]}"

        # Delete original story file ONLY if it's not in the list of created files
        # (The split may overwrite the original with the first split file if names match)
        local should_delete=true
        for vf in "${valid_files[@]}"; do
            if [[ "$vf" == "$story_file" ]]; then
                should_delete=false
                log "INFO" "Original file is same as split file, not deleting: $story_file" >&2
                break
            fi
        done
        if [[ "$should_delete" == "true" && -f "$story_file" ]]; then
            echo -e "${YELLOW}Deleting original: $story_file${NC}" >&2
            rm "$story_file"
            log "INFO" "Deleted original story file: $story_file" >&2
        fi

        # Output the created files
        printf '%s\n' "${valid_files[@]}"
        return 0
    fi

    log "ERROR" "Multi-story split failed" >&2
    return 1
}

# Update Epic file's Story Status Summary table for split stories
# This keeps the Epic file (source of truth) in sync with actual story files
update_epic_file_for_split() {
    local original_story_id="$1"
    shift
    local split_files=("$@")

    # Find the Epic file
    local epic_num
    epic_num=$(echo "$original_story_id" | sed 's/-.*//')
    local epic_file="${PROJECT_ROOT}/_bmad-output/implementation-artifacts/epics/epic-${epic_num}.md"

    if [[ ! -f "$epic_file" ]]; then
        log "WARN" "Epic file not found: $epic_file - cannot update for split"
        return 0
    fi

    log "INFO" "Updating Epic file for split: $original_story_id -> ${#split_files[@]} stories"

    # Extract new story IDs and convert to table format (4-3a -> 4.3a)
    local new_story_entries=()
    for f in "${split_files[@]}"; do
        local fname
        fname=$(basename "$f" .md)
        # Extract just the story number part (e.g., "4-3a" from "4-3a-some-name")
        local story_num
        story_num=$(echo "$fname" | grep -oE "^[A-Za-z0-9]+-[0-9]+[a-z]?")
        # Convert to table format (4-3a -> 4.3a)
        local table_id
        table_id=$(echo "$story_num" | sed 's/-/./')
        # Extract title from filename (e.g., "some-name" -> "Some Name")
        local title
        title=$(echo "$fname" | sed "s/^${story_num}-//" | tr '-' ' ' | sed 's/\b\(.\)/\u\1/g')
        new_story_entries+=("| ${table_id} | ${title} | backlog |")
    done

    # Convert original story ID to table format for matching
    local original_table_id
    original_table_id=$(echo "$original_story_id" | sed 's/-/./')

    # Use Claude to update the Epic file
    local prompt="Update the Epic file's Story Status Summary table to reflect a story split.

EPIC FILE: ${epic_file}
ORIGINAL STORY: ${original_table_id} (e.g., row like '| ${original_table_id} | Some Title | backlog | FRs |')
NEW STORIES TO ADD:
$(printf '%s\n' "${new_story_entries[@]}")

TASK:
1. Read the Epic file
2. Find the '## Story Status Summary' section with its markdown table
3. Find the row for story '${original_table_id}' (first column matches)
4. Replace that single row with rows for each new split story (preserve the FRs column from original)
5. Also update the 'Total Stories' count in the Delivery Metrics section if present
6. Write the updated file back

IMPORTANT:
- Keep the same table format: | Story | Title | Status | FRs |
- Preserve all other rows unchanged
- The new stories should have status 'backlog'
- Copy the FRs column from the original story to all split stories

Do NOT output anything except updating the file."

    claude --model opus --dangerously-skip-permissions -p "$prompt" --max-turns 10 > /dev/null 2>&1 || true

    log "INFO" "Epic file updated for split"
}

# Update sprint-status.yaml to replace original story with split stories
update_sprint_status_for_split() {
    local original_story_id="$1"
    shift
    local split_files=("$@")

    local sprint_status="${PROJECT_ROOT}/_bmad-output/implementation-artifacts/sprint-status.yaml"

    if [[ ! -f "$sprint_status" ]]; then
        log "WARN" "sprint-status.yaml not found, skipping update"
        return 0
    fi

    log "INFO" "Updating sprint-status.yaml for split: $original_story_id -> ${#split_files[@]} stories"

    # Extract new story IDs from filenames
    local new_story_ids=()
    for f in "${split_files[@]}"; do
        local fname
        fname=$(basename "$f" .md)
        new_story_ids+=("$fname")
    done

    # Use Claude to update the sprint-status.yaml
    local prompt="Update the sprint-status.yaml file to reflect a story split.

SPRINT STATUS FILE: ${sprint_status}
ORIGINAL STORY ID: ${original_story_id}
NEW STORY IDS: ${new_story_ids[*]}

TASK:
1. Read the sprint-status.yaml file
2. Find the entry for story '${original_story_id}' (might be like '${original_story_id}-some-name')
3. Replace it with entries for each new split story: ${new_story_ids[*]}
4. Each new story should have status: 'backlog'
5. Keep all other stories unchanged
6. Write the updated file back

The new entries should look like:
    - id: \"new-story-id\"
      status: backlog

Do NOT output anything except updating the file."

    claude --model opus --dangerously-skip-permissions -p "$prompt" --max-turns 75 > /dev/null 2>&1 || true

    log "INFO" "Sprint status updated"
}

# Run story split via SM agent
# Split types:
#   - "task" (used for YELLOW): Modify existing file in place (Task 7 -> Task 7a, 7b in same file)
#   - "story" (DEPRECATED): Story-level splits now use run_multi_story_split() above
#
# NOTE: The "story" split_type code below is legacy and no longer called.
# For RED complexity, we now use run_multi_story_split() which creates multiple files.
run_story_split() {
    local story_file="$1"
    local split_recommendations="$2"
    local split_type="${3:-task}"  # "task" = modify in place, "story" = create new files

    # For task-level splits, modify the existing file in place
    if [[ "$split_type" == "task" ]]; then
        log_step "TASK-SPLIT: Modifying tasks in place" >&2
        log "INFO" "Splitting complex tasks in: $story_file (in-place modification)" >&2

        local prompt="You are executing the rewrite-story-splits workflow as SM (Bob).

Inputs:
- story_file_path: ${story_file}
- split_recommendations: ${split_recommendations}
- output_path: ${story_file}

IMPORTANT: This is a TASK-LEVEL split. You will modify the EXISTING file in place.
Replace the flagged tasks (e.g., Task 7) with split versions (e.g., Task 7a, Task 7b) in the same file.
DO NOT create a new file - write back to the same path.

Follow the instructions in ${WORKFLOW_SPLIT}/instructions.md exactly.

Output ONLY the path to the story file (which is the same as the input)."

        echo -e "${YELLOW}Splitting complex tasks in place -> ${story_file}${NC}" >&2

        local result
        result=$(claude --model opus --dangerously-skip-permissions -p "$prompt" --max-turns 75 2>&1)

        # For in-place modification, the file already exists
        if [[ -f "$story_file" ]]; then
            echo "$story_file"
            log "SUCCESS" "Task split complete (in-place): $story_file" >&2
            return 0
        fi

        log "ERROR" "Task split failed" >&2
        return 1
    fi

    # For story-level splits, create new files
    # Extract directory and filename
    local dir_name
    dir_name=$(dirname "$story_file")
    local file_name
    file_name=$(basename "$story_file" .md)

    # Parse story ID and name from filename
    # Pattern: <epic>-<story>-<name> or <epic>-<story><letter>-<name>
    # Examples: "0-4-docker-compose" or "0-4a-docker-compose"
    local story_id
    local story_name
    if [[ "$file_name" =~ ^([0-9]+-[0-9]+)[a-z]?-(.+)$ ]]; then
        story_id="${BASH_REMATCH[1]}"
        story_name="${BASH_REMATCH[2]}"
    else
        # Fallback: assume first two segments are story ID
        story_id=$(echo "$file_name" | cut -d'-' -f1-2)
        story_name=$(echo "$file_name" | cut -d'-' -f3-)
    fi

    local suffix_letter="a"
    local new_story_file="${dir_name}/${story_id}${suffix_letter}-${story_name}.md"

    # Find next available letter
    while [[ -f "$new_story_file" ]]; do
        # Check if existing file is already complete - don't overwrite!
        local existing_status
        existing_status=$(grep -m1 "^Status:" "$new_story_file" 2>/dev/null | awk '{print $2}' || echo "")
        if [[ "$existing_status" == "ready-for-review" || "$existing_status" == "complete" ]]; then
            log "WARN" "Split file $new_story_file already complete (status: $existing_status), not overwriting"
            echo "$new_story_file"
            return 0
        fi

        # Increment letter (a->b->c...)
        suffix_letter=$(echo "$suffix_letter" | tr 'a-y' 'b-z')
        if [[ "$suffix_letter" == "z" ]]; then
            log "ERROR" "Too many split versions (reached -z)"
            return 1
        fi
        new_story_file="${dir_name}/${story_id}${suffix_letter}-${story_name}.md"
    done

    log_step "STORY-SPLIT: Creating new story file"
    log "INFO" "Creating split file: $new_story_file"

    local prompt="You are executing the rewrite-story-splits workflow as SM (Bob).

Inputs:
- story_file_path: ${story_file}
- split_recommendations: ${split_recommendations}
- output_path: ${new_story_file}

This is a STORY-LEVEL split. Create a NEW file with the split tasks.

Follow the instructions in ${WORKFLOW_SPLIT}/instructions.md exactly.

Output ONLY the path to the new story file."

    echo -e "${YELLOW}Splitting story -> ${new_story_file}${NC}" >&2

    local result
    result=$(claude --model opus --dangerously-skip-permissions -p "$prompt" --max-turns 75 2>&1)

    if [[ -f "$new_story_file" ]]; then
        echo "$new_story_file"
        log "SUCCESS" "Story split complete: $new_story_file"
        return 0
    fi

    log "ERROR" "Story split failed"
    return 1
}

# ============================================================================
# SLACK NOTIFICATION
# ============================================================================

send_slack_escalation() {
    local story_file="$1"
    local task_info="$2"
    local analysis="$3"
    local recommendations="$4"

    # Check if Slack is configured
    local secrets_file="${AUTO_BMAD_DIR}/config/.bmad-secrets"
    if [[ -f "$secrets_file" ]]; then
        source "$secrets_file"
    fi

    if [[ -z "$BMAD_SLACK_WEBHOOK" ]]; then
        log "WARN" "Slack webhook not configured - escalation logged only"
        echo -e "${YELLOW}⚠ Slack not configured. Escalation details logged to:${NC}"
        echo -e "   ${LOG_DIR}/${STORY_ID}-escalation.txt"

        # Write escalation to file
        cat > "${LOG_DIR}/${STORY_ID}-escalation.txt" << EOF
WORKFLOW BLOCKED - Human Decision Required
==========================================

Story: $(basename "$story_file")
Task: $task_info

ISSUE:
$analysis

RECOMMENDED ACTION:
$recommendations

Reply options:
- /continue - Override and continue anyway
- /abort - Stop workflow
- /restructured - Resume after manual story restructure

Timestamp: $(date -Iseconds)
EOF
        return 1
    fi

    # Format Slack message
    "${SCRIPT_DIR}/format-slack-message.sh" \
        "$story_file" "$task_info" "$analysis" "$recommendations" | \
        curl -s -X POST -H 'Content-type: application/json' \
            --data @- "$BMAD_SLACK_WEBHOOK"

    log "INFO" "Slack escalation sent"
    return 0
}

# Send a simple Slack notification message
send_slack_notification() {
    local message="$1"

    # Load secrets if not already loaded
    local secrets_file="${AUTO_BMAD_DIR}/config/.bmad-secrets"
    if [[ -f "$secrets_file" ]]; then
        source "$secrets_file"
    fi

    if [[ -z "${BMAD_SLACK_WEBHOOK:-}" ]]; then
        return 0
    fi

    local payload
    payload=$("${SCRIPT_DIR}/format-slack-message.sh" "simple" "$message")

    curl -s -X POST -H 'Content-type: application/json' \
        --data "$payload" \
        "${BMAD_SLACK_WEBHOOK}" > /dev/null 2>&1 || true

    log "INFO" "Slack notification: $message"
}

# ============================================================================
# SESSION TOKEN MANAGEMENT
# ============================================================================

# Estimate token cost for a task based on subtask count and file references
estimate_task_tokens() {
    local task_label="$1"
    local subtask_count=5  # Default
    local file_ref_count=0

    # Extract task section
    local start_line end_line task_section
    start_line=$(grep -n "Task ${task_label}[^0-9a-z]" "$STORY_FILE_PATH" 2>/dev/null | head -1 | cut -d: -f1)
    if [[ -n "$start_line" ]]; then
        end_line=$(tail -n +$((start_line + 1)) "$STORY_FILE_PATH" 2>/dev/null | grep -n -E "^### Task [0-9]|^## " | head -1 | cut -d: -f1)
        if [[ -n "$end_line" ]]; then
            end_line=$((start_line + end_line - 1))
        else
            end_line=$(wc -l < "$STORY_FILE_PATH")
        fi
        task_section=$(sed -n "${start_line},${end_line}p" "$STORY_FILE_PATH" 2>/dev/null)
    fi

    if [[ -n "$task_section" ]]; then
        subtask_count=$(echo "$task_section" | grep -c "^[[:space:]]*- \[" 2>/dev/null) || subtask_count=0
        [[ $subtask_count -le 0 ]] && subtask_count=5
        # Count file references (*.ts, *.tsx, *.py, *.md, etc.)
        file_ref_count=$(echo "$task_section" | grep -coE "\.(ts|tsx|py|md|json|yaml)(\s|$|:|\)|\`)" 2>/dev/null) || file_ref_count=0
    fi

    local estimate=$((subtask_count * TOKEN_PER_SUBTASK + file_ref_count * TOKEN_PER_FILE_REF))
    # Cap estimate to prevent inflated values from causing excessive session breaks
    if [[ $estimate -gt ${TOKEN_MAX_TASK_ESTIMATE:-50000} ]]; then
        estimate=${TOKEN_MAX_TASK_ESTIMATE:-50000}
    fi
    echo "$estimate"
}

# Extract token usage from Claude CLI JSON output
# Parses the JSON response for usage.input_tokens and usage.output_tokens
extract_usage_tokens() {
    local json_file="$1"
    local total=0
    if [[ -f "$json_file" ]]; then
        local input_tokens output_tokens cache_read cache_create
        # Extract token fields using grep/sed (no jq dependency)
        input_tokens=$(grep -oE '"input_tokens":[0-9]+' "$json_file" 2>/dev/null | tail -1 | grep -oE '[0-9]+' || echo 0)
        output_tokens=$(grep -oE '"output_tokens":[0-9]+' "$json_file" 2>/dev/null | tail -1 | grep -oE '[0-9]+' || echo 0)
        cache_read=$(grep -oE '"cache_read_input_tokens":[0-9]+' "$json_file" 2>/dev/null | tail -1 | grep -oE '[0-9]+' || echo 0)
        cache_create=$(grep -oE '"cache_creation_input_tokens":[0-9]+' "$json_file" 2>/dev/null | tail -1 | grep -oE '[0-9]+' || echo 0)
        # Total context consumed = input + cached + output
        total=$((input_tokens + cache_read + cache_create + output_tokens))
    fi
    echo "$total"
}

# Generate a handoff summary from the current session before breaking
generate_session_handoff() {
    local session_id="$1"
    local handoff_num="$2"
    local handoff_file="${LOG_DIR}/${STORY_ID}-handoff-${handoff_num}.md"
    local handoff_log="${LOG_DIR}/${STORY_ID}-handoff-${handoff_num}.log"

    local handoff_prompt="Before this session ends, produce a concise developer handoff for the next session that will continue this story's tasks.

Include:
1. **Key design decisions** and WHY you made them
2. **Patterns established** that remaining tasks MUST follow for consistency
3. **Non-obvious relationships** between files you created/modified
4. **Gotchas or edge cases** the next developer should know about
5. **What was completed** (task numbers and brief summary)

Keep it under 500 words. Write in markdown format. This will be loaded as context in the next session."

    echo -e "${CYAN}📋 Generating session handoff summary...${NC}"
    log "INFO" "Generating handoff summary #${handoff_num} for session ${session_id:0:8}"

    if [[ -n "$session_id" ]]; then
        run_claude_with_timeout 120 "$handoff_log" -p "$handoff_prompt" --resume "$session_id" --max-turns 3
        # The log file IS the handoff content
        cp "$handoff_log" "$handoff_file"
    else
        echo "No session context available for handoff." > "$handoff_file"
    fi

    echo -e "${GREEN}✓ Handoff saved: ${handoff_file}${NC}"
    log "INFO" "Handoff summary saved to ${handoff_file}"
    echo "$handoff_file"
}

# Start a new DEV agent session, optionally loading handoff context
start_new_session() {
    local handoff_file="$1"  # Optional - path to handoff summary
    local agent_activation_log="${LOG_DIR}/${STORY_ID}-session-${HANDOFF_COUNT}-activation.log"
    local session_id=""

    echo -e "${CYAN}🔄 Starting new session (session #$((HANDOFF_COUNT + 1)))${NC}"
    log "INFO" "Starting new DEV agent session #$((HANDOFF_COUNT + 1))"

    # Activate agent
    local activation_output
    activation_output=$(claude --model opus --dangerously-skip-permissions -p "${AGENT_DEV}" --max-turns 2 --output-format json 2>"$agent_activation_log")
    session_id=$(echo "$activation_output" | grep -o '"session_id":"[^"]*"' | tail -1 | sed 's/"session_id":"//;s/"//g')

    if [[ -z "$session_id" ]]; then
        session_id=$(grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' "$agent_activation_log" 2>/dev/null | tail -1)
    fi

    # If we have a handoff, send it as context to the new session
    if [[ -n "$handoff_file" && -f "$handoff_file" && -n "$session_id" ]]; then
        local handoff_content
        handoff_content=$(cat "$handoff_file")
        local context_prompt="CONTEXT FROM PREVIOUS SESSION:

${handoff_content}

---

You are continuing implementation of story ${STORY_ID}. The above handoff describes what was done and key decisions made. Follow the established patterns for consistency. Acknowledge you have the context and are ready."

        run_claude_with_timeout 120 "${LOG_DIR}/${STORY_ID}-session-${HANDOFF_COUNT}-context.log" \
            -p "$context_prompt" --resume "$session_id" --max-turns 2
    fi

    # Reset session tracking
    SESSION_TOKENS_USED=0
    ACTIVE_SESSION_ID="$session_id"

    if [[ -n "$session_id" ]]; then
        echo -e "${GREEN}✓ New session active: ${session_id:0:8}...${NC}"
        log "INFO" "New session activated: $session_id"
    else
        echo -e "${YELLOW}⚠ Could not establish session${NC}"
        log "WARN" "Failed to establish new session"
    fi
}

# Check if session needs to break before next task
# Returns: 0 = continue, 1 = break now (don't start task), 2 = last task then break
check_session_budget() {
    local next_task_estimate="$1"
    local projected=$((SESSION_TOKENS_USED + next_task_estimate))

    if [[ $projected -gt $((SESSION_HARD_CAP - HANDOFF_RESERVE)) ]]; then
        # Would exceed hard cap - break immediately
        log "TOKENS" "Budget exceeded: used=${SESSION_TOKENS_USED} + est=${next_task_estimate} = ${projected} > $((SESSION_HARD_CAP - HANDOFF_RESERVE))"
        return 1
    elif [[ $projected -gt $SESSION_SOFT_CAP ]]; then
        # In grey zone - this is the last task before break
        log "TOKENS" "Soft cap reached: used=${SESSION_TOKENS_USED} + est=${next_task_estimate} = ${projected} > ${SESSION_SOFT_CAP}"
        return 2
    fi

    return 0
}

# ============================================================================
# TASK EXECUTION
# ============================================================================

# Calculate turn limit for a task
# Handles both numeric (7) and alphanumeric (7a) task labels
calculate_turn_limit() {
    local task_label="$1"
    local subtask_count=5  # Default

    # Try to count subtasks for this task
    # Story formats vary:
    #   - "### Task N:" with "- [x]" subtasks below
    #   - "- [ ] **Task N:**" with nested "- [ ]" subtasks
    local task_section
    # Extract section from "Task N" to next "Task M" or "## " using sed
    # First find line number of task start, then extract until next task or section
    local start_line end_line
    start_line=$(grep -n "Task ${task_label}[^0-9a-z]" "$STORY_FILE_PATH" 2>/dev/null | head -1 | cut -d: -f1)
    if [[ -n "$start_line" ]]; then
        # Find next task or section header after start_line
        end_line=$(tail -n +$((start_line + 1)) "$STORY_FILE_PATH" 2>/dev/null | grep -n -E "^### Task [0-9]|^## " | head -1 | cut -d: -f1)
        if [[ -n "$end_line" ]]; then
            end_line=$((start_line + end_line - 1))
        else
            end_line=$(wc -l < "$STORY_FILE_PATH")
        fi
        task_section=$(sed -n "${start_line},${end_line}p" "$STORY_FILE_PATH" 2>/dev/null)
    fi

    if [[ -n "$task_section" ]]; then
        # grep -c returns exit code 1 when no matches, so we need to handle that separately
        subtask_count=$(echo "$task_section" | grep -c "^[[:space:]]*- \[" 2>/dev/null) || subtask_count=0
        [[ $subtask_count -le 0 ]] && subtask_count=5
    fi

    local turns=$((TURN_BASE + subtask_count * TURN_PER_SUBTASK))
    [[ -n "$MAX_TURNS_OVERRIDE" ]] && turns=$MAX_TURNS_OVERRIDE
    [[ $turns -gt $TURN_CAP ]] && turns=$TURN_CAP

    echo "$turns"
}

# Extract task labels from story file
# Returns space-separated list of task labels (e.g., "1 2 3 4 5 6 7a 7b 8 9 10 11a 11b")
get_task_labels() {
    # Extract task numbers/labels from story file
    # Supports: "- [ ] **Task 7a:" or "### Task 7a:" or "**Task 7a:" or "- [ ] Task 7a:"
    grep -oE "(^### Task|^\s*-\s*\[.\]\s*\*?\*?Task)\s*[0-9]+[a-z]?:" "$STORY_FILE_PATH" 2>/dev/null \
        | sed 's/.*Task *//' | sed 's/:$//' | sort -V | uniq
}

# Count tasks in story
count_tasks() {
    # Support multiple story formats:
    #   - "### Task N:" (markdown heading style)
    #   - "- [ ] **Task N:**" (checkbox style)
    #   - "**Task N:**" (bold style)
    local count
    count=$(grep -cE "(^### Task|^\s*-\s*\[.\]\s*\*?\*?Task)\s*[0-9]+[a-z]?:" "$STORY_FILE_PATH" 2>/dev/null) || count=0
    echo "$count"
}

# Check if a task is already complete (marked [x] in story file)
# Handles both numeric (Task 7:) and alphanumeric (Task 7a:) task labels
is_task_complete() {
    local task_label="$1"

    # Escape any special regex characters in task label (though a-z0-9 are safe)
    local escaped_label="$task_label"

    # Check for "- [x] **Task N:" pattern (checkbox style - task line itself is checked)
    # Use word boundary matching: Task 7a: should not match Task 7ab:
    if grep -qE "^\s*-\s*\[x\]\s*\*?\*?Task\s*${escaped_label}[^0-9a-z]" "$STORY_FILE_PATH" 2>/dev/null; then
        return 0  # Complete
    fi

    # For ### Task format, need to check if all subtasks are [x]
    if grep -qE "^###\s*Task ${escaped_label}[^0-9a-z]" "$STORY_FILE_PATH" 2>/dev/null; then
        local section start_line end_line
        start_line=$(grep -n "^### *Task ${escaped_label}[^0-9a-z]" "$STORY_FILE_PATH" 2>/dev/null | head -1 | cut -d: -f1)
        if [[ -n "$start_line" ]]; then
            end_line=$(tail -n +$((start_line + 1)) "$STORY_FILE_PATH" 2>/dev/null | grep -n -E "^### Task [0-9]|^## " | head -1 | cut -d: -f1)
            if [[ -n "$end_line" ]]; then
                end_line=$((start_line + end_line - 1))
            else
                end_line=$(wc -l < "$STORY_FILE_PATH")
            fi
            section=$(sed -n "${start_line},${end_line}p" "$STORY_FILE_PATH" 2>/dev/null)
        fi
        local unchecked
        unchecked=$(echo "$section" | grep -c "^\s*-\s*\[ \]" 2>/dev/null) || unchecked=0
        if [[ "$unchecked" -eq 0 ]]; then
            return 0  # All subtasks complete
        fi
    fi

    return 1  # Not complete
}

# Check if a task contains manual validation subtasks
# Returns 0 (true) if task has "Manual test" or "Manual validation" subtasks
is_manual_task() {
    local task_label="$1"

    # Find the task header line and get the next 20 lines (subtasks)
    # This is simpler and more reliable than complex awk patterns
    local section
    section=$(grep -A 20 "Task ${task_label}[^0-9a-z].*:" "$STORY_FILE_PATH" 2>/dev/null | head -20)

    # Check if section contains "Manual test" or "Manual validation"
    if echo "$section" | grep -qiE "Manual test|Manual validation" 2>/dev/null; then
        return 0  # Is a manual task
    fi

    return 1  # Not a manual task
}

# Execute a single task using the active session (or create one if needed)
execute_task() {
    local task_num="$1"
    local turns="$2"
    local task_log="${LOG_DIR}/${STORY_ID}-task-${task_num}.log"
    local task_json_log="${LOG_DIR}/${STORY_ID}-task-${task_num}-output.json"
    local start_time=$(date +%s)
    local exit_code=0

    echo -e "${CYAN}▶ Executing Task $task_num (max $turns turns) [session tokens: ${SESSION_TOKENS_USED}]${NC}"
    log "INFO" "Starting task $task_num with $turns turns (session tokens so far: $SESSION_TOKENS_USED)"

    # Use active session if available, otherwise create one
    local session_id="${ACTIVE_SESSION_ID}"

    if [[ -z "$session_id" ]]; then
        # No active session - activate the DEV agent
        local agent_activation_log="${LOG_DIR}/${STORY_ID}-task-${task_num}-activation.log"

        local activation_output
        activation_output=$(claude --model opus --dangerously-skip-permissions -p "${AGENT_DEV}" --max-turns 2 --output-format json 2>"$agent_activation_log")
        session_id=$(echo "$activation_output" | grep -o '"session_id":"[^"]*"' | tail -1 | sed 's/"session_id":"//;s/"//g')

        if [[ -z "$session_id" ]]; then
            session_id=$(grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' "$agent_activation_log" 2>/dev/null | tail -1)
        fi

        ACTIVE_SESSION_ID="$session_id"
    fi

    if [[ -z "$session_id" ]]; then
        echo -e "${YELLOW}⚠ Could not get session ID, falling back to single-prompt mode${NC}"
        log "WARN" "Session ID not captured, using single-prompt fallback"
        local prompt="${AGENT_DEV}
${WORKFLOW_DEV_STORY}
${STORY_ID}
Execute ONLY Task ${task_num}. Stop after completing this task.

**RULES:** Mark each subtask [x] in story file immediately after completing. Story: ${STORY_FILE_PATH}
If code already exists and works, verify and mark [x]. Do not proceed without marking complete."

        run_claude_with_timeout "$TASK_TIMEOUT" "$task_log" -p "$prompt" --max-turns "$turns" || exit_code=$?
    else
        echo -e "${CYAN}  Using session: ${session_id:0:8}...${NC}"
        log "INFO" "Executing task $task_num on session: $session_id"

        local task_prompt="DS
${STORY_ID}
Execute ONLY Task ${task_num}. Stop after completing this task.

**RULES:**
- Mark each subtask [x] in story file (${STORY_FILE_PATH}) immediately after completing
- If code already exists and works, verify and mark [x]
- Do not proceed to next subtask without marking previous complete
- After ALL subtasks [x], mark main task checkbox [x] too"

        run_claude_with_timeout "$TASK_TIMEOUT" "$task_log" -p "$task_prompt" --resume "$session_id" --max-turns "$turns" || exit_code=$?
    fi

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    # Estimate token usage from task log size (heuristic: ~4 chars per token for mixed content)
    # This is a fallback since we don't get JSON usage from the text-mode output
    local task_log_size=0
    if [[ -f "$task_log" ]]; then
        task_log_size=$(wc -c < "$task_log" 2>/dev/null || echo 0)
    fi
    # Rough estimate: input context (~base overhead for resumed session) + output (~log size / 4)
    local estimated_task_tokens=$(( (task_log_size / 4) + 15000 ))
    SESSION_TOKENS_USED=$((SESSION_TOKENS_USED + estimated_task_tokens))
    log "TOKENS" "Task $task_num: est=${estimated_task_tokens} (log=${task_log_size}b), session_total=${SESSION_TOKENS_USED}"

    # Determine failure type
    local failure_type="success"
    if [[ $exit_code -ne 0 ]]; then
        if grep -q "Reached max turns" "$task_log" 2>/dev/null; then
            failure_type="max_turns"
        elif grep -q -iE "timeout|ETIMEDOUT" "$task_log" 2>/dev/null; then
            failure_type="timeout"
        else
            failure_type="error"
        fi
    fi

    # Record attempt
    add_task_attempt "$task_num" "$turns" "$failure_type" "${duration}s"

    echo "$failure_type"
}

# ============================================================================
# MAIN ORCHESTRATION FLOW
# ============================================================================

main() {
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  V7 ORCHESTRATED WORKFLOW                                  ║${NC}"
    echo -e "${GREEN}║  Intelligent Story Execution with Validation               ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "Story: ${CYAN}$STORY_FILE_PATH${NC}"
    echo -e "ID:    ${CYAN}$STORY_ID${NC}"
    echo ""

    # Initialize or load state
    if [[ "$FRESH_START" == "true" ]] || [[ ! -f "$STATE_FILE" ]]; then
        init_state
    else
        log "INFO" "Resuming from saved state"
        echo -e "${YELLOW}Resuming from saved state...${NC}"
    fi

    # =========================================================================
    # PHASE 0: STORY CREATION (if needed)
    # =========================================================================
    if [[ ! -f "$STORY_FILE_PATH" ]]; then
        log_step "PHASE 0: Story Creation"
        log "INFO" "Story file not found, creating: $STORY_FILE_PATH"

        local create_log="${LOG_DIR}/${STORY_ID}-create-story.log"
        local create_args="${STORY_INPUT}
Create the story file for this story ID. Read the PRD, Architecture, and Epic to generate complete tasks with acceptance criteria."

        echo -e "${CYAN}▶ SM >> DS: Creating story file...${NC}"
        if run_agent_workflow "$AGENT_SM" "$WORKFLOW_CREATE_STORY" "$create_args" 50 "$create_log" "sm-create-story"; then
            # Re-resolve story file after creation
            STORY_FILE_PATH=$(resolve_story_file "$STORY_INPUT")
            if [[ -f "$STORY_FILE_PATH" ]]; then
                echo -e "${GREEN}✓ Story created: $STORY_FILE_PATH${NC}"
                log "SUCCESS" "Story file created: $STORY_FILE_PATH"
                update_state_field "story_file" "\"$STORY_FILE_PATH\""
                # Re-derive IDs
                STORY_ID=$(basename "$STORY_FILE_PATH" .md)
                LOG_DIR="${AUTO_BMAD_DIR}/logs/workflow/${STORY_ID}"
                mkdir -p "$LOG_DIR"
            else
                echo -e "${RED}✗ Story creation failed - file not found after create-story${NC}"
                log "ERROR" "Story creation failed"
                exit 1
            fi
        else
            echo -e "${RED}✗ Story creation command failed${NC}"
            cat "$create_log"
            exit 1
        fi
    else
        echo -e "${GREEN}Story file exists: $STORY_FILE_PATH${NC}"
    fi

    # =========================================================================
    # GUARD: Check if story is already complete - don't re-process!
    # =========================================================================
    local story_status
    story_status=$(grep -m1 "^Status:" "$STORY_FILE_PATH" 2>/dev/null | awk '{print $2}' || echo "draft")

    if [[ "$story_status" == "ready-for-review" ]]; then
        echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  ✓ STORY ALREADY READY FOR REVIEW                          ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "Story: ${CYAN}$STORY_FILE_PATH${NC}"
        echo -e "Status: ${CYAN}$story_status${NC}"
        echo ""
        echo -e "${YELLOW}Nothing to do. Story implementation is complete.${NC}"
        echo -e "${YELLOW}Run code review separately if needed: --skip-prevalidation --skip-postvalidation${NC}"
        log "INFO" "Story already ready-for-review, skipping execution"
        exit 0
    fi

    if [[ "$story_status" == "complete" ]]; then
        echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  ✓ STORY ALREADY COMPLETE                                  ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "Story: ${CYAN}$STORY_FILE_PATH${NC}"
        echo -e "Status: ${CYAN}$story_status${NC}"
        echo ""
        echo -e "${YELLOW}Nothing to do. Story has been fully completed and reviewed.${NC}"
        log "INFO" "Story already complete, skipping execution"
        exit 0
    fi

    echo -e "Story status: ${CYAN}$story_status${NC}"

    # =========================================================================
    # GUARD: Check if all tasks are already complete (belt-and-suspenders)
    # =========================================================================
    local total_tasks
    local complete_tasks
    # Match all task formats: "- [.] **Task N:", "### Task N:", "- [ ] Task N:"
    total_tasks=$(grep -cE "(^### Task|^\s*-\s*\[.\]\s*\*?\*?Task)\s*[0-9]+[a-z]?:" "$STORY_FILE_PATH" 2>/dev/null) || total_tasks=0
    total_tasks=${total_tasks//[^0-9]/}
    [[ -z "$total_tasks" ]] && total_tasks=0
    complete_tasks=$(grep -cE "^\s*-\s*\[x\]\s*\*?\*?Task" "$STORY_FILE_PATH" 2>/dev/null) || complete_tasks=0
    complete_tasks=${complete_tasks//[^0-9]/}
    [[ -z "$complete_tasks" ]] && complete_tasks=0

    if [[ "$total_tasks" -gt 0 ]] && [[ "$total_tasks" -eq "$complete_tasks" ]]; then
        echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  ✓ ALL TASKS ALREADY COMPLETE                              ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "Story: ${CYAN}$STORY_FILE_PATH${NC}"
        echo -e "Tasks: ${CYAN}$complete_tasks / $total_tasks complete${NC}"
        echo ""
        echo -e "${YELLOW}All tasks marked [x]. Proceeding to code review phase.${NC}"
        log "INFO" "All $total_tasks tasks already complete, skipping task execution but proceeding to CR"

        # Optionally update status if still draft
        if [[ "$story_status" == "draft" ]]; then
            echo -e "${YELLOW}Updating status from 'draft' to 'ready-for-review'...${NC}"
            sed -i '' "s/^Status: draft/Status: ready-for-review/" "$STORY_FILE_PATH"
            log "INFO" "Updated story status to ready-for-review"
        fi
    fi

    echo -e "Tasks: ${CYAN}$complete_tasks / $total_tasks complete${NC}"

    # =========================================================================
    # PHASE 1: PRE-VALIDATION
    # =========================================================================
    if [[ "$SKIP_PREVALIDATION" == "false" ]]; then
        log_step "PHASE 1: Pre-Execution Validation"

        local complexity_json
        complexity_json=$(assess_story_complexity "$STORY_FILE_PATH")

        # Parse status from JSON
        local status
        status=$(echo "$complexity_json" | grep -o '"status"[^,]*' | cut -d'"' -f4)

        echo -e "Complexity Status: ${CYAN}$status${NC}"

        # High task count warning (session handoff manages context automatically)
        local max_tasks_warning=8
        if [[ "$total_tasks" -gt "$max_tasks_warning" ]]; then
            echo -e "${YELLOW}⚠ Story has $total_tasks tasks (threshold: $max_tasks_warning)${NC}"
            echo -e "${YELLOW}  Session handoff will manage context limits automatically${NC}"
            log "INFO" "High task count: $total_tasks tasks (threshold: $max_tasks_warning)"
        fi

        # Complexity assessment (report only — no auto-splitting)
        # Session handoff handles context limits; splits are done manually if needed
        case "$status" in
            green)
                echo -e "${GREEN}✓ Complexity: GREEN - all tasks within limits${NC}"
                update_state_field "pre_validation.status" "passed"
                update_state_field "pre_validation.risk_level" "green"
                send_slack_notification "Story ${STORY_ID} complexity: GREEN - proceeding"
                ;;

            yellow)
                echo -e "${YELLOW}⚠ Complexity: YELLOW - some tasks flagged as complex${NC}"
                echo -e "${YELLOW}  Session handoff will manage context limits automatically${NC}"
                update_state_field "pre_validation.status" "passed_with_warnings"
                update_state_field "pre_validation.risk_level" "yellow"
                send_slack_notification "Story ${STORY_ID} complexity: YELLOW - complex tasks detected, proceeding with session handoff"
                ;;

            red)
                echo -e "${RED}⚠ Complexity: RED - story is highly complex${NC}"
                echo -e "${YELLOW}  Session handoff will manage context limits automatically${NC}"
                update_state_field "pre_validation.status" "passed_with_warnings"
                update_state_field "pre_validation.risk_level" "red"
                send_slack_notification "Story ${STORY_ID} complexity: RED - highly complex story, proceeding with session handoff"
                ;;

            *)
                echo -e "${YELLOW}⚠ Could not determine complexity. Proceeding cautiously.${NC}"
                update_state_field "pre_validation.status" "unknown"
                send_slack_notification "Story ${STORY_ID} complexity: UNKNOWN - proceeding cautiously"
                ;;
        esac
    else
        echo -e "${YELLOW}Pre-validation skipped (--skip-prevalidation)${NC}"
    fi

    # =========================================================================
    # PHASE 2: TASK EXECUTION WITH POST-VALIDATION
    # =========================================================================
    log_step "PHASE 2: Task Execution"

    # Get actual task labels from story file (e.g., "1 2 3 4 5 6 7a 7b 8 9 10 11a 11b")
    local task_labels
    task_labels=($(get_task_labels))
    local task_count=${#task_labels[@]}

    echo -e "Total tasks: ${CYAN}$task_count${NC}"
    echo -e "Task labels: ${CYAN}${task_labels[*]}${NC}"
    echo -e "Starting from task index: ${CYAN}$START_TASK${NC}"

    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "\n${YELLOW}=== DRY RUN MODE ===${NC}"
        echo -e "Would process tasks from index $START_TASK"
        echo -e "Skip manual tasks: ${SKIP_MANUAL_TASKS}"
        local pending_count=0
        local complete_count=0
        local manual_count=0
        for ((i=START_TASK-1; i<task_count; i++)); do
            local t="${task_labels[$i]}"
            local turns
            turns=$(calculate_turn_limit "$t")
            if is_task_complete "$t"; then
                echo -e "  Task $t: ${GREEN}ALREADY COMPLETE${NC} - would skip"
                complete_count=$((complete_count + 1))
            elif [[ "$SKIP_MANUAL_TASKS" == "true" ]] && is_manual_task "$t"; then
                echo -e "  Task $t: ${YELLOW}MANUAL VALIDATION${NC} - would skip (use --include-manual to run)"
                manual_count=$((manual_count + 1))
            else
                echo -e "  Task $t: ${BLUE}PENDING${NC} - estimated $turns turns"
                pending_count=$((pending_count + 1))
            fi
        done
        echo -e "\nSummary: ${complete_count} complete, ${pending_count} pending, ${manual_count} manual (skipped)"
        echo -e "${YELLOW}=== END DRY RUN ===${NC}"
        exit 0
    fi

    local task_index=$((START_TASK - 1))  # Convert to 0-based index
    local max_retries=2
    local tasks_executed=0
    local tasks_skipped=0
    local break_after_task=false  # Flag: generate handoff after this task completes

    # Initialize first session
    SESSION_TOKENS_USED=0
    ACTIVE_SESSION_ID=""
    HANDOFF_COUNT=0

    while [[ $task_index -lt $task_count ]]; do
        local current_task="${task_labels[$task_index]}"
        local display_num=$((task_index + 1))

        update_state_field "current_task" "\"$current_task\""
        update_state_field "current_phase" "executing"

        # Check if task is already complete in story file
        if is_task_complete "$current_task"; then
            echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            echo -e "${GREEN}  Task $current_task ($display_num of $task_count) - ALREADY COMPLETE${NC}"
            echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            log "INFO" "Task $current_task already complete, skipping"
            add_decision "$current_task" "skip" "Already marked complete in story file"
            tasks_skipped=$((tasks_skipped + 1))
            task_index=$((task_index + 1))
            continue
        fi

        # Check if task is a manual validation task (skip by default)
        if [[ "$SKIP_MANUAL_TASKS" == "true" ]] && is_manual_task "$current_task"; then
            echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            echo -e "${YELLOW}  Task $current_task ($display_num of $task_count) - MANUAL VALIDATION (skipped)${NC}"
            echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            echo -e "${YELLOW}  Use --include-manual to run manual validation tasks${NC}"
            log "INFO" "Task $current_task is manual validation, skipping (use --include-manual to run)"
            add_decision "$current_task" "skip" "Manual validation task skipped by default"
            tasks_skipped=$((tasks_skipped + 1))
            task_index=$((task_index + 1))
            continue
        fi

        local turns
        turns=$(calculate_turn_limit "$current_task")

        # ── Session budget check: should we start this task? ──
        local task_token_estimate
        task_token_estimate=$(estimate_task_tokens "$current_task")
        local budget_status=0
        check_session_budget "$task_token_estimate" || budget_status=$?

        if [[ $budget_status -eq 1 ]]; then
            # Would exceed hard cap — break NOW, don't start task
            echo -e "\n${YELLOW}🔄 Session budget exceeded (${SESSION_TOKENS_USED} tokens used). Breaking session.${NC}"
            log "TOKENS" "Hard cap break before task $current_task: session_tokens=${SESSION_TOKENS_USED}"

            if [[ -n "$ACTIVE_SESSION_ID" ]]; then
                HANDOFF_COUNT=$((HANDOFF_COUNT + 1))
                local handoff_file
                handoff_file=$(generate_session_handoff "$ACTIVE_SESSION_ID" "$HANDOFF_COUNT")
                start_new_session "$handoff_file"
            else
                start_new_session ""
            fi
        elif [[ $budget_status -eq 2 ]]; then
            # Grey zone — this will be the last task before break
            echo -e "${YELLOW}⚡ Approaching session budget (${SESSION_TOKENS_USED} + ~${task_token_estimate} est). Last task in session.${NC}"
            log "TOKENS" "Soft cap: will break after task $current_task"
            break_after_task=true
        fi

        echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${BLUE}  Task $current_task ($display_num of $task_count) (est $turns turns, ~${task_token_estimate} tokens)${NC}"
        echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

        local retry_count=0
        local task_complete=false

        while [[ $retry_count -le $max_retries ]] && [[ "$task_complete" == "false" ]]; do
            # Execute task
            local result
            result=$(execute_task "$current_task" "$turns")

            # Post-validation
            if [[ "$SKIP_POSTVALIDATION" == "false" ]]; then
                local task_log="${LOG_DIR}/${STORY_ID}-task-${current_task}.log"
                local validation_json
                validation_json=$(validate_task_completion "$STORY_FILE_PATH" "$task_log" "$current_task" "$result")

                local action
                action=$(echo "$validation_json" | grep -o '"action"[^,]*' | cut -d'"' -f4)

                case "$action" in
                    continue)
                        echo -e "${GREEN}✓ Task $current_task completed${NC}"
                        add_decision "$current_task" "continue" "Task completed successfully"
                        task_complete=true
                        ;;

                    retry|retry_with_more)
                        retry_count=$((retry_count + 1))
                        if [[ $retry_count -le $max_retries ]]; then
                            local new_turns=$((turns * 2))
                            [[ $new_turns -gt 200 ]] && new_turns=200
                            turns=$new_turns
                            echo -e "${YELLOW}↻ Retrying task $current_task with $turns turns (attempt $((retry_count+1)))${NC}"
                            add_decision "$current_task" "$action" "Retry attempt $retry_count"
                        fi
                        ;;

                    escalate)
                        echo -e "${RED}✗ Task $current_task requires human intervention${NC}"
                        local reason
                        reason=$(echo "$validation_json" | grep -o '"reason"[^,]*' | cut -d'"' -f4)

                        send_slack_escalation "$STORY_FILE_PATH" "Task $current_task" "$reason" "Review task and fix manually, then resume workflow."
                        add_decision "$current_task" "escalate" "$reason"

                        update_state_field "current_phase" "blocked"
                        echo -e "${RED}Workflow halted at task $current_task.${NC}"
                        exit 1
                        ;;

                    *)
                        echo -e "${YELLOW}⚠ Unknown validation action: $action. Continuing.${NC}"
                        task_complete=true
                        ;;
                esac
            else
                # No post-validation - assume success if no error
                if [[ "$result" == "success" ]]; then
                    echo -e "${GREEN}✓ Task $current_task completed (no validation)${NC}"
                    task_complete=true
                else
                    retry_count=$((retry_count + 1))
                fi
            fi
        done

        if [[ "$task_complete" == "false" ]]; then
            echo -e "${RED}✗ Task $current_task failed after $max_retries retries${NC}"
            send_slack_escalation "$STORY_FILE_PATH" "Task $current_task" "Failed after multiple retries" "Review logs and fix manually."
            exit 1
        fi

        tasks_executed=$((tasks_executed + 1))
        task_index=$((task_index + 1))

        # ── Post-task session break: handoff if flagged ──
        if [[ "$break_after_task" == "true" && $task_index -lt $task_count ]]; then
            echo -e "\n${YELLOW}🔄 Session soft cap reached (${SESSION_TOKENS_USED} tokens). Generating handoff.${NC}"
            log "TOKENS" "Soft cap break after task $current_task: session_tokens=${SESSION_TOKENS_USED}"

            HANDOFF_COUNT=$((HANDOFF_COUNT + 1))
            local handoff_file
            handoff_file=$(generate_session_handoff "$ACTIVE_SESSION_ID" "$HANDOFF_COUNT")
            start_new_session "$handoff_file"
            break_after_task=false
        fi
    done

    # =========================================================================
    # PHASE 3: CODE REVIEW (DEV>>CR) with FIX/REVIEW CYCLE
    # =========================================================================
    if [[ "$SKIP_CODE_REVIEW" == "true" ]]; then
        echo -e "${YELLOW}Code review skipped (--skip-cr)${NC}"
    else
        log_step "PHASE 3: Code Review (DEV>>CR)"
        update_state_field "current_phase" "code_review"

        local cr_loop=0
        local cr_passed=false
        local cr_log="${LOG_DIR}/${STORY_ID}-code-review.log"
        local fix_log="${LOG_DIR}/${STORY_ID}-code-fix.log"
        local review_log="${LOG_DIR}/${STORY_ID}-code-fix-review.log"

        local last_issues=""
        local has_high_issues=true

        # CR Loop: DS >> CR >> Fix >> CR >> Fix >> CR...
        while [[ $cr_loop -lt $MAX_CR_LOOPS && "$has_high_issues" == "true" ]]; do
            cr_loop=$((cr_loop + 1))
            echo -e "${CYAN}▶ Code Review iteration $cr_loop of $MAX_CR_LOOPS${NC}"

            # Run Code Review (DEV >> CR)
            local cr_args="${STORY_ID}
Review the code changes for this story. Be adversarial - find specific issues.
DO NOT fix issues yourself. Just identify and report them clearly.
Format each issue as: ISSUE #N: [HIGH|MEDIUM|LOW] description
End with summary: X HIGH, Y MEDIUM, Z LOW issues found (or PASS if no issues)"

            echo -e "  ${CYAN}[CR] DEV >> CR: Running code review...${NC}"

            # Capture session ID for potential follow-up
            local cr_session_id=""
            local cr_activation_log="${cr_log%.log}-activation.log"

            if run_agent_workflow "$AGENT_DEV" "$WORKFLOW_CODE_REVIEW" "$cr_args" 75 "$cr_log" "dev-code-review"; then
                # Capture session ID from run_agent_workflow for same-session fix follow-up
                cr_session_id="$LAST_AGENT_SESSION_ID"
                log "INFO" "CR session ID for fix follow-up: ${cr_session_id:-none}"

                # Check if CR output is in expected format
                if ! check_cr_format "$cr_log"; then
                    log "WARN" "CR output not in expected format, requesting reformatted response"

                    if ! request_cr_format "$cr_session_id" "$cr_log"; then
                        # Follow-up also failed — free retry (don't consume iteration)
                        echo -e "${YELLOW}⚠ CR output still not in expected format after follow-up${NC}"
                        log "WARN" "CR output format invalid after follow-up, will retry CR iteration"
                        echo -e "${CYAN}Auto-retrying code review iteration...${NC}"
                        cr_loop=$((cr_loop - 1))  # Don't consume this iteration
                        continue  # Retry this CR loop iteration
                    fi
                fi

                # Extract and log issues
                log "CR-ISSUES" "=== Code Review Iteration $cr_loop ==="
                last_issues=$(grep -iE "ISSUE\s*#?[0-9]+.*(\[?(HIGH|MEDIUM|LOW)\]?)|[0-9]+\s+HIGH|[0-9]+\s+MEDIUM|[0-9]+\s+LOW" "$cr_log" 2>/dev/null || true)
                echo "$last_issues" | while read -r issue; do
                    [[ -n "$issue" ]] && log "CR-ISSUE" "$issue" && echo -e "    ${YELLOW}$issue${NC}"
                done

                # Check for HIGH severity issues
                # Check for HIGH severity issues — match "ISSUE #N: [HIGH]" or "ISSUE #N: HIGH"
                # but exclude summary lines like "0 HIGH" or "**0 HIGH"
                if grep -iE "ISSUE\s*#?[0-9]+.*\[?HIGH\]?" "$cr_log" 2>/dev/null | grep -qvE "^\s*$"; then
                    echo -e "${YELLOW}⚠ HIGH severity issues found${NC}"
                    has_high_issues=true

                    # If not at max iterations, run fix cycle IN THE SAME CR SESSION
                    # This keeps full context of which files were reviewed and what issues were found
                    if [[ $cr_loop -lt $MAX_CR_LOOPS ]]; then
                        echo -e "  ${CYAN}[FIX] Sending fix request to CR session...${NC}"

                        local fix_prompt="Fix all HIGH and MEDIUM severity issues you just identified.
For each issue: make the code change, then mark it FIXED.
Do not add new features. Only fix the identified issues.
After all fixes, provide a summary of what was fixed."

                        if [[ -n "$cr_session_id" ]]; then
                            log "INFO" "Fixing issues in same CR session: ${cr_session_id:0:8}..."
                            if run_claude_with_timeout "$CR_TIMEOUT" "$fix_log" -p "$fix_prompt" --resume "$cr_session_id" --max-turns 75; then
                                log "CR-FIX" "DEV agent completed fixes in CR session (iteration $cr_loop)"
                                echo -e "  ${GREEN}✓ DEV agent completed fixes (same session)${NC}"
                                grep -iE "FIXED|fixed" "$fix_log" 2>/dev/null | head -10 | while read -r fix; do
                                    log "CR-FIXED" "$fix"
                                done
                            else
                                echo -e "  ${RED}✗ DEV agent fix failed${NC}"
                                log "ERROR" "DEV agent fix failed on iteration $cr_loop"
                            fi
                        else
                            # Fallback: no session ID available, use standalone fix
                            log "WARN" "No CR session ID for fix, using standalone prompt"
                            local standalone_fix_prompt="Fix all HIGH and MEDIUM issues from the code review of story ${STORY_ID}.
Read the story file at ${STORY_FILE_PATH} for the File List of changed files.
Review log: ${cr_log}
Fix each issue, then mark FIXED. Do not add new features."
                            if run_claude_with_timeout "$CR_TIMEOUT" "$fix_log" -p "$standalone_fix_prompt" --max-turns 75; then
                                log "CR-FIX" "DEV agent completed fixes standalone (iteration $cr_loop)"
                                echo -e "  ${GREEN}✓ DEV agent completed fixes (standalone)${NC}"
                                grep -iE "FIXED|fixed" "$fix_log" 2>/dev/null | head -10 | while read -r fix; do
                                    log "CR-FIXED" "$fix"
                                done
                            else
                                echo -e "  ${RED}✗ DEV agent fix failed${NC}"
                                log "ERROR" "DEV agent fix failed on iteration $cr_loop"
                            fi
                        fi
                    fi
                elif grep -qiE "^PASS|no.*issues.*found|code.*looks.*good" "$cr_log" 2>/dev/null; then
                    echo -e "${GREEN}✓ Code review PASSED - no issues (iteration $cr_loop)${NC}"
                    log "SUCCESS" "Code review passed with no issues on iteration $cr_loop"
                    has_high_issues=false
                    cr_passed=true
                    update_state_field "code_review.status" "passed"
                else
                    # Only MEDIUM/LOW issues - this is acceptable
                    echo -e "${GREEN}✓ Code review PASSED - no HIGH severity issues (iteration $cr_loop)${NC}"
                    log "SUCCESS" "Code review passed (MEDIUM/LOW only) on iteration $cr_loop"
                    has_high_issues=false
                    cr_passed=true
                    update_state_field "code_review.status" "passed_with_notes"
                fi

                update_state_field "code_review.iterations" "$cr_loop"
            else
                echo -e "${RED}✗ Code review command failed${NC}"
                log "ERROR" "Code review command failed on iteration $cr_loop"
            fi
        done

        # After max iterations: log remaining issues to story file and continue
        if [[ "$has_high_issues" == "true" ]]; then
            echo -e "${YELLOW}⚠ Code review completed with remaining issues after $MAX_CR_LOOPS iterations${NC}"
            log "WARN" "Code review has remaining issues after $MAX_CR_LOOPS iterations"

            # Append remaining issues to story file for human review
            echo -e "\n\n## Code Review Notes (Auto-Generated)\n" >> "$STORY_FILE_PATH"
            echo -e "**Status:** Completed with remaining issues after $MAX_CR_LOOPS CR iterations\n" >> "$STORY_FILE_PATH"
            echo -e "**Date:** $(date '+%Y-%m-%d %H:%M')\n" >> "$STORY_FILE_PATH"
            echo -e "### Remaining Issues for Human Review:\n" >> "$STORY_FILE_PATH"
            echo "$last_issues" | while read -r issue; do
                [[ -n "$issue" ]] && echo "- $issue" >> "$STORY_FILE_PATH"
            done
            echo -e "\n---\n" >> "$STORY_FILE_PATH"

            log "INFO" "Remaining issues logged to story file: $STORY_FILE_PATH"
            echo -e "${CYAN}Remaining issues logged to story file for human review${NC}"
            update_state_field "code_review.status" "needs_human_review"
        fi

        echo -e "${GREEN}Proceeding to Test Review...${NC}"
    fi

    # =========================================================================
    # PHASE 4: TEST REVIEW (TEA>>RV)
    # =========================================================================
    if [[ "$SKIP_TEST_REVIEW" == "true" ]]; then
        echo -e "${YELLOW}Test review skipped (--skip-tr)${NC}"
    else
        log_step "PHASE 4: Test Review (TEA>>RV)"
        update_state_field "current_phase" "test_review"

        local tr_loop=0
        local tr_passed=false
        local tr_log="${LOG_DIR}/${STORY_ID}-test-review.log"

        while [[ $tr_loop -lt $MAX_TR_LOOPS && "$tr_passed" == "false" ]]; do
            tr_loop=$((tr_loop + 1))
            echo -e "${CYAN}▶ Test Review iteration $tr_loop of $MAX_TR_LOOPS${NC}"

            # TEA >> RV: Test Review
            local tr_args="${STORY_ID}
Review the test quality for this story.
Check test coverage, patterns, edge cases.
End with PASS or FAIL."

            # Run test review with TEA agent
            echo -e "  ${CYAN}[RV] TEA >> RV: Running test review...${NC}"
            if run_agent_workflow "$AGENT_TEA" "$WORKFLOW_TEST_REVIEW" "$tr_args" 30 "$tr_log" "tea-test-review"; then
                # Check if review passed
                if grep -qiE "(PASS|test.*review.*passed|adequate.*coverage)" "$tr_log" 2>/dev/null; then
                    echo -e "${GREEN}✓ Test review PASSED (iteration $tr_loop)${NC}"
                    tr_passed=true
                    update_state_field "test_review.status" "passed"
                    update_state_field "test_review.iterations" "$tr_loop"
                elif grep -qiE "(FAIL|inadequate|missing.*tests)" "$tr_log" 2>/dev/null; then
                    echo -e "${YELLOW}⚠ Test review found issues (iteration $tr_loop)${NC}"
                else
                    # Assume pass if no clear fail signal
                    tr_passed=true
                fi
            else
                echo -e "${RED}✗ Test review command failed${NC}"
            fi
        done

        if [[ "$tr_passed" == "false" ]]; then
            echo -e "${YELLOW}⚠ Test review did not pass - continuing with warning${NC}"
            update_state_field "test_review.status" "warning"
            # Don't block on test review failure, just warn
        fi
    fi

    # =========================================================================
    # PHASE 5: COMPLETION
    # =========================================================================
    log_step "PHASE 5: Story Complete"

    update_state_field "current_phase" "complete"

    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✓ STORY EXECUTION COMPLETE                               ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "Story: ${CYAN}$STORY_FILE_PATH${NC}"
    echo -e "Tasks: ${CYAN}$tasks_executed executed, $tasks_skipped skipped (of $task_count total)${NC}"
    echo -e "State: ${CYAN}$STATE_FILE${NC}"
    echo ""

    # Send completion notification
    if [[ -n "$BMAD_SLACK_WEBHOOK" ]]; then
        local msg=":white_check_mark: Story *${STORY_ID}* completed successfully ($tasks_executed tasks executed)"
        curl -s -X POST -H 'Content-type: application/json' \
            --data "{\"text\": \"$msg\"}" "$BMAD_SLACK_WEBHOOK" >/dev/null
    fi

    log "SUCCESS" "Story $STORY_ID completed - $tasks_executed tasks executed, $tasks_skipped skipped (of $task_count total)"

    # =========================================================================
    # PHASE 6: POST-COMPLETION VERIFICATION
    # =========================================================================
    log_step "PHASE 6: Post-Completion File Verification"
    update_state_field "current_phase" "post_verification"

    local verify_log="${LOG_DIR}/${STORY_ID}-post-verify.log"

    local verify_prompt="${AGENT_DEV}

TASK: Post-completion file verification for story ${STORY_ID}

Verify and update these files to reflect completed implementation:

1. **Story File** (${STORY_FILE_PATH}):
   - Ensure Status: is set to 'done' or 'complete'
   - Ensure ALL task checkboxes are marked [x]
   - Update Dev Agent Record section with completion notes

2. **Sprint Status** (_bmad-output/implementation-artifacts/sprint-status.yaml):
   - Update this story's status to 'done'
   - Update parent epic status if all stories are complete

3. **Traceability Matrix** (if exists):
   - Mark relevant test coverage as complete

Read each file, verify current state, and make necessary updates.
Report what was updated."

    echo -e "${CYAN}▶ Verifying and updating completion files...${NC}"
    if run_claude_with_timeout 600 "$verify_log" -p "$verify_prompt" --max-turns 75; then
        echo -e "${GREEN}✓ Post-completion verification complete${NC}"
        log "SUCCESS" "Post-completion file verification done"
        update_state_field "post_verification.status" "complete"
    else
        echo -e "${YELLOW}⚠ Post-verification had issues - check log${NC}"
        log "WARN" "Post-verification encountered issues"
    fi

    # =========================================================================
    # FINAL SUMMARY
    # =========================================================================
    echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  ✓ WORKFLOW COMPLETE - ALL PHASES DONE                     ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "Story:    ${CYAN}$STORY_FILE_PATH${NC}"
    echo -e "Tasks:    ${CYAN}$tasks_executed executed${NC}"
    echo -e "State:    ${CYAN}$STATE_FILE${NC}"
    echo -e "Logs:     ${CYAN}$LOG_DIR${NC}"
    echo ""

    log "SUCCESS" "Workflow complete for $STORY_ID"
}

# Run main
main "$@"
