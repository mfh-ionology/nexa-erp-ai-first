#!/bin/bash
# V4 Epic Workflow - Executes all stories in an epic using V4 story workflow
# Usage: ./v4-epic-workflow.sh <epic-id> [--skip-risk] [--skip-nfr] [--max-turns N]
#
# V4 Epic Flow:
#   1. PO loads epic file and extracts story list
#   2. For each story in epic:
#      - Run v4-story-workflow.sh
#      - Track completion status
#   3. PO checks all stories are done
#   4. Send Slack notification with epic summary
#
# Epic files expected in: docs/epics/ or _bmad-output/planning-artifacts/epics/

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
EPIC_ID="${1:?Usage: $0 <epic-id> [--skip-risk] [--skip-nfr] [--max-turns N]}"
SKIP_RISK=false
SKIP_NFR=false
MAX_TURNS=50
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLANNING_ARTIFACTS="${PROJECT_ROOT}/_bmad-output/planning-artifacts"
LOG_DIR="${PROJECT_ROOT}/logs/workflow"
EPIC_FILE=""

# Pass-through flags for story workflow
STORY_FLAGS=""

# Parse optional flags
shift
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-risk) SKIP_RISK=true; STORY_FLAGS="${STORY_FLAGS} --skip-risk"; shift ;;
        --skip-nfr) SKIP_NFR=true; STORY_FLAGS="${STORY_FLAGS} --skip-nfr"; shift ;;
        --max-turns) MAX_TURNS="$2"; STORY_FLAGS="${STORY_FLAGS} --max-turns $2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Create log directory
mkdir -p "$LOG_DIR"
WORKFLOW_LOG="${LOG_DIR}/${EPIC_ID}-epic-$(date +%Y%m%d-%H%M%S).log"

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$WORKFLOW_LOG"
}

log_step() {
    echo -e "\n${CYAN}==================================================================${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}==================================================================${NC}\n"
    log "STEP" "$1"
}

# Find epic file
find_epic_file() {
    # Pattern 1: In planning-artifacts/epics
    for f in "${PLANNING_ARTIFACTS}/epics/${EPIC_ID}"*.md; do
        if [[ -f "$f" ]]; then
            EPIC_FILE="$f"
            log "INFO" "Found epic file: $EPIC_FILE"
            return 0
        fi
    done

    # Pattern 2: In docs/epics
    for f in "${PROJECT_ROOT}/docs/epics/${EPIC_ID}"*.md; do
        if [[ -f "$f" ]]; then
            EPIC_FILE="$f"
            log "INFO" "Found epic file: $EPIC_FILE"
            return 0
        fi
    done

    # Pattern 3: Direct match with name
    for f in "${PLANNING_ARTIFACTS}/epics/"*"${EPIC_ID}"*.md; do
        if [[ -f "$f" ]]; then
            EPIC_FILE="$f"
            log "INFO" "Found epic file: $EPIC_FILE"
            return 0
        fi
    done

    # Pattern 4: In _bmad-output root
    for f in "${PLANNING_ARTIFACTS}/${EPIC_ID}"*.md; do
        if [[ -f "$f" ]]; then
            EPIC_FILE="$f"
            log "INFO" "Found epic file: $EPIC_FILE"
            return 0
        fi
    done

    log "ERROR" "Epic file not found for: $EPIC_ID"
    return 1
}

# Extract stories from epic file
extract_stories() {
    if [[ -z "$EPIC_FILE" ]]; then
        echo ""
        return
    fi

    local stories=""

    # Pattern 1: Table format | E01-S01 | or | 1-1 |
    local table_stories=$(grep -oE '\|\s*[A-Z0-9]+-S[0-9]+\s*\|' "$EPIC_FILE" 2>/dev/null | sed 's/|//g' | tr -d ' ' | sort -u)
    if [[ -n "$table_stories" ]]; then
        stories="$table_stories"
    fi

    # Pattern 2: Story ID format like E01-S01, E1-S1, 1-1
    local id_stories=$(grep -oE '[A-Z]?[0-9]+-S[0-9]+' "$EPIC_FILE" 2>/dev/null | sort -u)
    if [[ -n "$id_stories" ]]; then
        stories="${stories}"$'\n'"${id_stories}"
    fi

    # Pattern 3: Numbered format like 1.1, 1.2
    local num_stories=$(grep -oE 'Story [0-9]+\.[0-9]+' "$EPIC_FILE" 2>/dev/null | sed 's/Story //' | sort -u)
    if [[ -n "$num_stories" ]]; then
        for s in $num_stories; do
            local converted=$(echo "$s" | tr '.' '-')
            stories="${stories}"$'\n'"${converted}"
        done
    fi

    # Deduplicate and sort
    echo "$stories" | grep -v '^$' | sort -u
}

# Get epic name from file
get_epic_name() {
    if [[ -z "$EPIC_FILE" ]]; then
        echo "$EPIC_ID"
        return
    fi

    local name=$(grep -m1 "^# " "$EPIC_FILE" 2>/dev/null | sed 's/^# //')
    echo "${name:-$EPIC_ID}"
}

# Check if story is already done
is_story_done() {
    local story_id="$1"
    local story_file=""

    for f in "${PROJECT_ROOT}/_bmad-output/implementation-artifacts/${story_id}"*.md \
             "${PROJECT_ROOT}/_bmad-output/implementation-artifacts/stories/${story_id}"*.md \
             "${PROJECT_ROOT}/docs/stories/${story_id}"*.md; do
        if [[ -f "$f" ]]; then
            story_file="$f"
            break
        fi
    done

    if [[ -z "$story_file" ]]; then
        return 1
    fi

    local status=$(grep -m1 "^Status:" "$story_file" 2>/dev/null | sed 's/Status: *//' | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')

    if [[ "$status" == "done" || "$status" == "complete" || "$status" == "completed" ]]; then
        return 0
    fi

    return 1
}

# Main workflow execution
main() {
    log "INFO" "Starting V4 Epic Workflow for ${EPIC_ID}"
    log "INFO" "Project root: ${PROJECT_ROOT}"

    echo -e "\n${GREEN}+================================================================+${NC}"
    echo -e "${GREEN}|  V4 EPIC WORKFLOW: ${EPIC_ID}${NC}"
    echo -e "${GREEN}+================================================================+${NC}\n"

    # Step 1: Find and load epic file
    log_step "STEP 1: Load Epic File"

    if ! find_epic_file; then
        echo -e "${RED}ERROR: Epic file not found for ${EPIC_ID}${NC}"
        echo -e "${YELLOW}Expected locations:${NC}"
        echo -e "  - ${PLANNING_ARTIFACTS}/epics/${EPIC_ID}*.md"
        echo -e "  - ${PROJECT_ROOT}/docs/epics/${EPIC_ID}*.md"
        notify "workflow_failed" "$EPIC_ID" "Epic file not found. Cannot start epic workflow."
        exit 1
    fi

    local epic_name=$(get_epic_name)
    echo -e "${GREEN}Found epic: ${epic_name}${NC}"
    echo -e "${BLUE}  File: ${EPIC_FILE}${NC}"

    # Step 2: Extract stories from epic
    log_step "STEP 2: Extract Stories from Epic"

    local stories=$(extract_stories)

    if [[ -z "$stories" ]]; then
        echo -e "${RED}ERROR: No stories found in epic file${NC}"
        notify "workflow_failed" "$EPIC_ID" "No stories found in epic file. Check epic format."
        exit 1
    fi

    local story_array=()
    while IFS= read -r story; do
        [[ -n "$story" ]] && story_array+=("$story")
    done <<< "$stories"

    local total_stories=${#story_array[@]}
    echo -e "${GREEN}Found ${total_stories} stories in epic${NC}"
    for s in "${story_array[@]}"; do
        echo -e "  - ${s}"
    done

    notify "needs_fixes" "$EPIC_ID" "Starting epic '${epic_name}' with ${total_stories} stories."

    # Step 3: Execute each story
    local completed_stories=()
    local failed_stories=()
    local skipped_stories=()
    local story_num=0

    for story_id in "${story_array[@]}"; do
        ((story_num++))
        log_step "STORY ${story_num}/${total_stories}: ${story_id}"

        if is_story_done "$story_id"; then
            echo -e "${CYAN}Story ${story_id} already DONE - skipping${NC}"
            log "INFO" "Story ${story_id} already done, skipping"
            skipped_stories+=("$story_id")
            continue
        fi

        echo -e "${YELLOW}Running v4-story-workflow.sh for ${story_id}${NC}"
        log "INFO" "Starting story workflow for ${story_id}"

        if "${SCRIPT_DIR}/v4-story-workflow.sh" "$story_id" $STORY_FLAGS; then
            echo -e "${GREEN}Story ${story_id} completed${NC}"
            log "SUCCESS" "Story ${story_id} completed"
            completed_stories+=("$story_id")
        else
            local exit_code=$?
            echo -e "${RED}Story ${story_id} failed (exit code: ${exit_code})${NC}"
            log "ERROR" "Story ${story_id} failed with exit code ${exit_code}"
            failed_stories+=("$story_id")

            echo -e "${YELLOW}Continue with remaining stories? (y/n)${NC}"
            read -r response
            if [[ "$response" != "y" && "$response" != "Y" ]]; then
                log "INFO" "User aborted epic workflow after story failure"
                break
            fi
        fi

        echo -e "${BLUE}Pausing 5 seconds before next story...${NC}"
        sleep 5
    done

    # Step 4: PO Check - Verify all stories complete
    log_step "FINAL: PO Check - Epic Completion Status"

    local completed_count=${#completed_stories[@]}
    local failed_count=${#failed_stories[@]}
    local skipped_count=${#skipped_stories[@]}

    echo -e "${BLUE}Epic Summary:${NC}"
    echo -e "  Total stories:     ${total_stories}"
    echo -e "  Completed:         ${completed_count}"
    echo -e "  Previously done:   ${skipped_count}"
    echo -e "  Failed:            ${failed_count}"

    local summary="Epic '${epic_name}' workflow complete.\n"
    summary="${summary}Total: ${total_stories} stories\n"
    summary="${summary}Completed: ${completed_count}\n"
    summary="${summary}Previously done: ${skipped_count}\n"
    summary="${summary}Failed: ${failed_count}"

    if [[ ${#failed_stories[@]} -gt 0 ]]; then
        summary="${summary}\n\nFailed stories:"
        for s in "${failed_stories[@]}"; do
            summary="${summary}\n- ${s}"
        done
    fi

    if [[ $failed_count -eq 0 ]]; then
        echo -e "\n${GREEN}+================================================================+${NC}"
        echo -e "${GREEN}|  EPIC COMPLETE: ${EPIC_ID}${NC}"
        echo -e "${GREEN}|  All ${total_stories} stories done!${NC}"
        echo -e "${GREEN}+================================================================+${NC}"

        notify "workflow_complete" "$EPIC_ID" "$summary"
        log "SUCCESS" "Epic ${EPIC_ID} completed successfully"
    else
        echo -e "\n${YELLOW}+================================================================+${NC}"
        echo -e "${YELLOW}|  EPIC INCOMPLETE: ${EPIC_ID}${NC}"
        echo -e "${YELLOW}|  ${failed_count} stories failed${NC}"
        echo -e "${YELLOW}+================================================================+${NC}"

        notify "workflow_failed" "$EPIC_ID" "$summary"
        log "WARN" "Epic ${EPIC_ID} incomplete - ${failed_count} stories failed"
    fi

    log "INFO" "Full log: ${WORKFLOW_LOG}"
}

# Run main
main "$@"
