#!/bin/bash
# V4 Story Workflow - Executes full BMAD V4 story lifecycle
# Usage: ./v4-story-workflow.sh <story-id> [--skip-risk] [--skip-nfr] [--max-turns N]
#
# V4 Flow (11 steps):
#   1. SM   *draft {story}                    - Create story draft
#   2. QA   *risk-profile {story}             - Risk assessment
#   3. QA   *test-design {story}              - Test design/scenarios
#   4. PO   *validate-story-draft {story}     - Validate → READY FOR DEV or Slack FAIL
#   5. DEV  *develop-story {story}            - Implementation (per-task fresh context)
#   6. QA   *trace {story}                    - Requirements traceability
#   7. QA   *nfr-assess {story}               - Non-functional requirements
#   8. QA   *review {story}                   - Quality review
#   9. DEV  *review-qa {story}                - Apply QA fixes
#  10. QA   *gate {story}                     - Final gate → set DONE
#  11. PO   Check status                      - Slack notification (success or issues)
#
# Each step runs in a fresh Claude Code session with auto-accept permissions

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
STORY_ID="${1:?Usage: $0 <story-id> [--skip-risk] [--skip-nfr] [--max-turns N]}"
SKIP_RISK=false
SKIP_NFR=false
MAX_TURNS=50
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IMPL_ARTIFACTS="${PROJECT_ROOT}/_bmad-output/implementation-artifacts"
LOG_DIR="${PROJECT_ROOT}/logs/workflow"
STORY_FILE=""

# Parse optional flags
shift
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-risk) SKIP_RISK=true; shift ;;
        --skip-nfr) SKIP_NFR=true; shift ;;
        --max-turns) MAX_TURNS="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Create log directory
mkdir -p "$LOG_DIR"
WORKFLOW_LOG="${LOG_DIR}/${STORY_ID}-v4-$(date +%Y%m%d-%H%M%S).log"

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

# Run Claude Code with a specific skill and command
run_claude_step() {
    local skill="$1"
    local command="$2"
    local step_name="$3"
    local step_log="${LOG_DIR}/${STORY_ID}-v4-${step_name}.log"

    log "INFO" "Running: $skill -> $command"

    # Build prompt with batch mode
    local prompt
    if [[ "$command" == *"*"* ]]; then
        prompt="Run the skill ${skill}.

BATCH MODE - SKIP MENU DISPLAY:
- Do NOT display the agent greeting or menu
- Do NOT wait for user input
- Immediately execute command: ${command}
- Story ID: ${STORY_ID}

Execute the workflow instructions exactly. When complete, provide a brief summary."
    else
        prompt="Run the skill ${skill}. ${command}"
    fi

    log "INFO" "Prompt: $prompt"
    echo -e "${YELLOW}Running Claude Code (max $MAX_TURNS turns)...${NC}"

    if (cd "$PROJECT_ROOT" && claude -p --dangerously-skip-permissions --max-turns "$MAX_TURNS" "$prompt") > "$step_log" 2>&1; then
        log "SUCCESS" "$step_name completed"
        echo -e "${GREEN}✓ $step_name completed${NC}"
        tail -5 "$step_log" | sed 's/^/  /'
        return 0
    else
        local exit_code=$?
        log "ERROR" "$step_name failed with exit code $exit_code"
        echo -e "${RED}✗ $step_name failed (exit code: $exit_code)${NC}"
        tail -10 "$step_log" | sed 's/^/  /'
        return $exit_code
    fi
}

# Find story file
find_story_file() {
    # Get the actual repo root (parent of auto-bmad_pack)
    local REPO_ROOT="$(cd "${PROJECT_ROOT}/.." && pwd)"

    # Pattern 1: Direct in impl-artifacts
    for f in "${IMPL_ARTIFACTS}/${STORY_ID}"*.md; do
        if [[ -f "$f" ]]; then
            STORY_FILE="$f"
            log "INFO" "Found story file: $STORY_FILE"
            return 0
        fi
    done

    # Pattern 2: In stories subdirectory
    for f in "${IMPL_ARTIFACTS}/stories/${STORY_ID}"*.md; do
        if [[ -f "$f" ]]; then
            STORY_FILE="$f"
            log "INFO" "Found story file: $STORY_FILE"
            return 0
        fi
    done

    # Pattern 3: In docs/stories (at repo root, not PROJECT_ROOT)
    for f in "${REPO_ROOT}/docs/stories/${STORY_ID}"*.md; do
        if [[ -f "$f" ]]; then
            STORY_FILE="$f"
            log "INFO" "Found story file: $STORY_FILE"
            return 0
        fi
    done

    # Pattern 4: In PROJECT_ROOT/docs/stories (fallback)
    for f in "${PROJECT_ROOT}/docs/stories/${STORY_ID}"*.md; do
        if [[ -f "$f" ]]; then
            STORY_FILE="$f"
            log "INFO" "Found story file: $STORY_FILE"
            return 0
        fi
    done

    log "WARN" "Story file not found for: $STORY_ID"
    return 1
}

# Check PO validation result
check_po_validation() {
    local po_log="${LOG_DIR}/${STORY_ID}-v4-po-validate.log"

    if [[ ! -f "$po_log" ]]; then
        log "WARN" "PO validation log not found"
        return 1
    fi

    # Check for definitive decision markers (more specific patterns)
    # Look for final decision line: "Decision" followed by GO/NO-GO
    if grep -qE '\*\*Decision\*\*.*NO-GO|Verdict:.*NO-GO|Decision:.*NO-GO' "$po_log"; then
        return 1  # Failed
    fi

    if grep -qE '\*\*Decision\*\*.*GO|Verdict:.*GO|Decision:.*GO' "$po_log"; then
        return 0  # Passed
    fi

    # Fallback: Check for blocking issues
    if grep -qiE "Critical Issues.*Must Fix|Story Blocked|NOT READY FOR DEVELOPMENT" "$po_log"; then
        return 1  # Failed
    fi

    # Fallback: Check for ready indicators
    if grep -qiE "READY FOR DEVELOPMENT|ready for implementation|Implementation Readiness.*[89]/10" "$po_log"; then
        return 0  # Passed
    fi

    # Default: assume needs review
    log "WARN" "Could not determine PO validation result"
    return 1
}

# Get story status from file
# Supports both formats:
#   - "Status: Done" (inline)
#   - "## Status\n\nDone" (markdown section)
get_story_status() {
    if [[ -z "$STORY_FILE" ]] && ! find_story_file; then
        echo "unknown"
        return
    fi

    # Try inline format first: "Status: value"
    local status=$(grep -m1 "^Status:" "$STORY_FILE" 2>/dev/null | sed 's/Status: *//' | tr -d '[:space:]')

    # If not found, try markdown section format: "## Status\n\nvalue"
    if [[ -z "$status" || "$status" == "unknown" ]]; then
        status=$(awk '/^## Status/{getline; getline; print; exit}' "$STORY_FILE" 2>/dev/null | tr -d '[:space:]')
    fi

    echo "${status:-unknown}"
}

# Get story name from file
get_story_name() {
    if [[ -z "$STORY_FILE" ]] && ! find_story_file; then
        echo "$STORY_ID"
        return
    fi

    local name=$(grep -m1 "^# " "$STORY_FILE" 2>/dev/null | sed 's/^# //')
    echo "${name:-$STORY_ID}"
}

# Check gate result from gate YAML file
# Returns: PASS, FAIL, or UNKNOWN
check_gate_result() {
    local REPO_ROOT="$(cd "${PROJECT_ROOT}/.." && pwd)"

    # Look for gate file in docs/qa/gates/
    local gate_file=""
    for f in "${REPO_ROOT}/docs/qa/gates/${STORY_ID}"*.yml "${REPO_ROOT}/docs/qa/gates/${STORY_ID}"*.yaml; do
        if [[ -f "$f" ]]; then
            gate_file="$f"
            break
        fi
    done

    if [[ -z "$gate_file" || ! -f "$gate_file" ]]; then
        echo "UNKNOWN"
        return
    fi

    # Extract gate value from YAML
    local gate=$(grep -m1 "^gate:" "$gate_file" 2>/dev/null | sed 's/gate: *//' | tr -d '[:space:]')
    echo "${gate:-UNKNOWN}"
}

# Collect issues from workflow logs
collect_issues() {
    local issues=""

    # Check QA review log for issues
    local qa_log="${LOG_DIR}/${STORY_ID}-v4-qa-review.log"
    if [[ -f "$qa_log" ]]; then
        local qa_issues=$(grep -iE "issue|problem|fail|error|concern" "$qa_log" | head -5)
        if [[ -n "$qa_issues" ]]; then
            issues="${issues}\n*QA Review Issues:*\n${qa_issues}"
        fi
    fi

    # Check gate log
    local gate_log="${LOG_DIR}/${STORY_ID}-v4-qa-gate.log"
    if [[ -f "$gate_log" ]]; then
        local gate_issues=$(grep -iE "FAIL|CONCERNS|blocked" "$gate_log" | head -3)
        if [[ -n "$gate_issues" ]]; then
            issues="${issues}\n*Gate Issues:*\n${gate_issues}"
        fi
    fi

    echo -e "$issues"
}

# Main workflow execution
main() {
    log "INFO" "Starting V4 Story Workflow for ${STORY_ID}"
    log "INFO" "Project root: ${PROJECT_ROOT}"
    log "INFO" "Skip Risk: ${SKIP_RISK}, Skip NFR: ${SKIP_NFR}"

    echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  V4 STORY WORKFLOW: ${STORY_ID}${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}\n"

    # =========================================================================
    # Step 1: SM *draft - Create Story Draft
    # =========================================================================
    log_step "1/11: SM *draft - Create Story Draft"
    run_claude_step "/bmad-sm" "*draft ${STORY_ID}" "sm-draft"

    # =========================================================================
    # Step 2: QA *risk-profile - Risk Assessment
    # =========================================================================
    if [[ "$SKIP_RISK" == "false" ]]; then
        log_step "2/11: QA *risk-profile - Risk Assessment"
        run_claude_step "/bmad-qa" "*risk-profile ${STORY_ID}" "qa-risk" || log "WARN" "Risk profile had issues, continuing..."
    else
        log_step "2/11: QA *risk-profile - SKIPPED"
        log "INFO" "Risk profile step skipped by flag"
    fi

    # =========================================================================
    # Step 3: QA *test-design - Test Design
    # =========================================================================
    log_step "3/11: QA *test-design - Test Design"
    run_claude_step "/bmad-qa" "*test-design ${STORY_ID}" "qa-test-design" || log "WARN" "Test design had issues, continuing..."

    # =========================================================================
    # Step 4: PO *validate-story-draft - Validate Story
    # =========================================================================
    log_step "4/11: PO *validate-story-draft - Validate Story"
    run_claude_step "/bmad-po" "*validate-story-draft ${STORY_ID}" "po-validate"

    # Check validation result
    if ! check_po_validation; then
        log "ERROR" "PO validation FAILED"
        echo -e "${RED}PO validation FAILED - Story not ready for development${NC}"

        # Send Slack notification for failure
        notify "workflow_failed" "$STORY_ID" "PO validation failed. Story not ready for development. Review the story draft and fix issues before retrying."

        echo -e "${YELLOW}Slack notification sent. Fix issues and re-run workflow.${NC}"
        exit 1
    fi

    echo -e "${GREEN}✓ Story validated - READY FOR DEVELOPMENT${NC}"
    notify "needs_fixes" "$STORY_ID" "Story validated and ready for development. Starting implementation."

    # =========================================================================
    # Step 5: DEV *develop-story - Implementation
    # =========================================================================
    log_step "5/11: DEV *develop-story - Implementation"
    run_claude_step "/bmad-dev" "*develop-story ${STORY_ID}" "dev-story"

    # =========================================================================
    # Step 6: QA *trace - Requirements Traceability
    # =========================================================================
    log_step "6/11: QA *trace - Requirements Traceability"
    run_claude_step "/bmad-qa" "*trace ${STORY_ID}" "qa-trace" || log "WARN" "Trace had issues, continuing..."

    # =========================================================================
    # Step 7: QA *nfr-assess - Non-Functional Requirements
    # =========================================================================
    if [[ "$SKIP_NFR" == "false" ]]; then
        log_step "7/11: QA *nfr-assess - NFR Assessment"
        run_claude_step "/bmad-qa" "*nfr-assess ${STORY_ID}" "qa-nfr" || log "WARN" "NFR assessment had issues, continuing..."
    else
        log_step "7/11: QA *nfr-assess - SKIPPED"
        log "INFO" "NFR assessment step skipped by flag"
    fi

    # =========================================================================
    # Step 8: QA *review - Quality Review
    # =========================================================================
    log_step "8/11: QA *review - Quality Review"
    run_claude_step "/bmad-qa" "*review ${STORY_ID}" "qa-review"

    # =========================================================================
    # Step 9: DEV *review-qa - Apply QA Fixes
    # =========================================================================
    log_step "9/11: DEV *review-qa - Apply QA Fixes"
    run_claude_step "/bmad-dev" "*review-qa ${STORY_ID}" "dev-review-qa" || log "WARN" "Review-QA had issues, continuing..."

    # =========================================================================
    # Step 10: QA *gate - Final Quality Gate
    # =========================================================================
    log_step "10/11: QA *gate - Final Quality Gate"
    run_claude_step "/bmad-qa" "*gate ${STORY_ID}" "qa-gate"

    # =========================================================================
    # Step 11: PO Check - Final Status Check + Slack Notification
    # =========================================================================
    log_step "11/11: PO Check - Final Status + Slack Notification"

    # Find story file and get status
    find_story_file
    local status=$(get_story_status)
    local story_name=$(get_story_name)

    log "INFO" "Story status: $status"
    log "INFO" "Story name: $story_name"

    # Check gate file for PASS result - if PASS, auto-update story status to Done
    local gate_result=$(check_gate_result)
    log "INFO" "Gate result: $gate_result"

    if [[ "$gate_result" == "PASS" && "$status" != "Done" && "$status" != "done" && "$status" != "DONE" ]]; then
        log "INFO" "Gate is PASS - automatically updating story status to Done"
        if [[ -n "$STORY_FILE" && -f "$STORY_FILE" ]]; then
            # Update "Ready for Review" or similar to "Done"
            sed -i 's/^Ready for Review$/Done/' "$STORY_FILE"
            sed -i 's/^In Progress$/Done/' "$STORY_FILE"
            sed -i 's/^In Development$/Done/' "$STORY_FILE"
            status="Done"
            log "SUCCESS" "Story status updated to Done"
        fi
    fi

    if [[ "$status" == "done" || "$status" == "Done" || "$status" == "DONE" || "$status" == "complete" || "$status" == "Complete" || "$gate_result" == "PASS" ]]; then
        # Success - story is DONE
        echo -e "${GREEN}✓ Story ${STORY_ID} is DONE${NC}"
        notify "workflow_complete" "$STORY_ID" "Story '${story_name}' completed successfully. All quality gates passed."
        log "SUCCESS" "Story completed and Slack notification sent"
    else
        # Issues - story not done
        echo -e "${YELLOW}Story ${STORY_ID} status: ${status}${NC}"

        # Collect issues from logs
        local issues=$(collect_issues)

        if [[ -n "$issues" ]]; then
            notify "workflow_failed" "$STORY_ID" "Story '${story_name}' has issues:\n${issues}"
        else
            notify "workflow_failed" "$STORY_ID" "Story '${story_name}' not marked as DONE. Status: ${status}. Review gate decision."
        fi

        log "WARN" "Story not complete - issues found"
        echo -e "${YELLOW}Slack notification sent with issues list.${NC}"
    fi

    # Summary
    echo -e "\n${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  V4 WORKFLOW COMPLETE: ${STORY_ID}${NC}"
    echo -e "${GREEN}║  Status: ${status}${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    log "SUCCESS" "V4 Story Workflow completed for ${STORY_ID}"
    log "INFO" "Full log: ${WORKFLOW_LOG}"
}

# Run main
main "$@"
