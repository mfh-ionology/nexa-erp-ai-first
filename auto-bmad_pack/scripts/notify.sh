#!/bin/bash
# BMAD Workflow Notification System
# Sends notifications to Slack (and optionally other channels)
#
# Usage:
#   source scripts/notify.sh
#   notify "major_rework" "story-id" "Details about the issue"
#   notify "weekly_limit" "story-id" "Paused at step X"
#   notify "workflow_complete" "story-id" "All tasks done"
#   notify "needs_fixes" "story-id" "CR found 3 issues"

# Load secrets
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Only set PROJECT_ROOT if not already set (e.g., by lib-common.sh)
if [[ -z "${PROJECT_ROOT:-}" ]]; then
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
fi
SECRETS_FILE="${SCRIPT_DIR}/../config/.bmad-secrets"

if [[ -f "$SECRETS_FILE" ]]; then
    source "$SECRETS_FILE"
elif [[ -f "${PROJECT_ROOT}/.bmad-secrets" ]]; then
    source "${PROJECT_ROOT}/.bmad-secrets"
fi

# Notification configuration
SLACK_ENABLED="${BMAD_SLACK_ENABLED:-true}"
SLACK_WEBHOOK="${BMAD_SLACK_WEBHOOK:-}"

# ============================================================================
# SLACK NOTIFICATION
# ============================================================================

notify_slack() {
    local event="$1"
    local story_id="$2"
    local details="$3"
    local report_file="${4:-}"

    # Skip if not configured
    [[ -z "$SLACK_WEBHOOK" ]] && return 0
    [[ "$SLACK_ENABLED" != "true" ]] && return 0

    # Event-specific formatting
    local emoji="📋"
    local color="#6c757d"
    local title=""
    local urgency=""

    case "$event" in
        major_rework)
            emoji="🔴"
            color="#dc3545"
            title="MAJOR REWORK REQUIRED"
            urgency="Story needs fundamental changes. Human review required."
            ;;
        needs_fixes)
            emoji="🟡"
            color="#ffc107"
            title="Code Review: Fixes Needed"
            urgency="Attempting auto-fix. Will notify if unsuccessful."
            ;;
        fixes_failed)
            emoji="🟠"
            color="#fd7e14"
            title="Auto-Fix Failed"
            urgency="Manual intervention required to resolve issues."
            ;;
        weekly_limit)
            emoji="⏸️"
            color="#6c757d"
            title="Weekly Limit Reached"
            urgency="Workflow paused. Resume when limit resets."
            ;;
        session_limit)
            emoji="⏳"
            color="#17a2b8"
            title="Session Limit - Auto-Waiting"
            urgency="Will auto-retry every 5 minutes (up to 5 hours)."
            ;;
        workflow_complete)
            emoji="✅"
            color="#28a745"
            title="Workflow Complete"
            urgency=""
            ;;
        workflow_failed)
            emoji="❌"
            color="#dc3545"
            title="Workflow Failed"
            urgency="Check logs for details."
            ;;
        test_build_failed)
            emoji="🔨"
            color="#dc3545"
            title="Post-Epic: Build Failed"
            urgency="Build failed after max retries. Manual intervention required."
            ;;
        test_backend_complete)
            emoji="🧪"
            color="#17a2b8"
            title="Post-Epic: Backend Tests Complete"
            urgency=""
            ;;
        test_frontend_complete)
            emoji="🖥️"
            color="#17a2b8"
            title="Post-Epic: Frontend E2E Complete"
            urgency=""
            ;;
        test_all_complete)
            emoji="🏁"
            color="#28a745"
            title="Post-Epic: All Tests Complete"
            urgency=""
            ;;
        test_stories_created)
            emoji="📝"
            color="#ffc107"
            title="Post-Epic: New Stories Created"
            urgency="Stories created for missing functionality found during testing."
            ;;
        *)
            emoji="📋"
            color="#6c757d"
            title="Workflow Update"
            urgency=""
            ;;
    esac

    # Build message blocks
    local blocks=""

    # Header
    blocks=$(cat <<EOF
{
    "type": "header",
    "text": {"type": "plain_text", "text": "${emoji} ${title}", "emoji": true}
}
EOF
)

    # Story ID section
    blocks="${blocks},"
    blocks="${blocks}"$(cat <<EOF
{
    "type": "section",
    "fields": [
        {"type": "mrkdwn", "text": "*Story:*\n\`${story_id}\`"},
        {"type": "mrkdwn", "text": "*Time:*\n$(date '+%Y-%m-%d %H:%M')"}
    ]
}
EOF
)

    # Details section
    if [[ -n "$details" ]]; then
        blocks="${blocks},"
        blocks="${blocks}"$(cat <<EOF
{
    "type": "section",
    "text": {"type": "mrkdwn", "text": "*Details:*\n${details}"}
}
EOF
)
    fi

    # Urgency/action section
    if [[ -n "$urgency" ]]; then
        blocks="${blocks},"
        blocks="${blocks}"$(cat <<EOF
{
    "type": "context",
    "elements": [{"type": "mrkdwn", "text": "⚡ ${urgency}"}]
}
EOF
)
    fi

    # Report file section
    if [[ -n "$report_file" && -f "$report_file" ]]; then
        blocks="${blocks},"
        blocks="${blocks}"$(cat <<EOF
{
    "type": "section",
    "text": {"type": "mrkdwn", "text": "*Report:*\n\`${report_file}\`"}
}
EOF
)
    fi

    # Send to Slack
    local payload=$(cat <<EOF
{
    "attachments": [{
        "color": "${color}",
        "blocks": [${blocks}]
    }]
}
EOF
)

    # Debug: log what we're sending
    echo "[NOTIFY] Sending ${event} notification for ${story_id}" >&2

    # Send request
    local http_code
    local body
    body=$(curl -s -w "\n%{http_code}" -X POST "$SLACK_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "$payload" 2>&1)

    # Extract HTTP code (last line)
    http_code=$(echo "$body" | tail -n 1)
    # Remove HTTP code from body
    body=$(echo "$body" | sed '$d')

    if [[ "$http_code" == "200" ]]; then
        echo "[NOTIFY] Slack notification sent successfully" >&2
        return 0
    else
        echo "[NOTIFY] Slack notification failed (HTTP $http_code): $body" >&2
        return 1
    fi
}

# ============================================================================
# MAIN NOTIFICATION DISPATCHER
# ============================================================================

notify() {
    local event="$1"
    local story_id="$2"
    local details="${3:-}"
    local report_file="${4:-}"

    # Send to all configured channels
    notify_slack "$event" "$story_id" "$details" "$report_file"

    # Future: add more notification channels here
    # notify_email "$event" "$story_id" "$details"
    # notify_discord "$event" "$story_id" "$details"
}

# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

notify_major_rework() {
    local story_id="$1"
    local report_file="$2"
    local details="${3:-Story requires fundamental changes based on code review findings.}"

    notify "major_rework" "$story_id" "$details" "$report_file"
}

notify_fixes_needed() {
    local story_id="$1"
    local issue_count="${2:-unknown}"

    notify "needs_fixes" "$story_id" "Code review found ${issue_count} issue(s). Attempting auto-fix."
}

notify_fixes_failed() {
    local story_id="$1"
    local report_file="$2"

    notify "fixes_failed" "$story_id" "Auto-fix unsuccessful. Manual review required." "$report_file"
}

notify_weekly_limit() {
    local story_id="$1"
    local step_name="$2"

    notify "weekly_limit" "$story_id" "Paused at: ${step_name}. Check Claude subscription for reset time."
}

notify_complete() {
    local story_id="$1"
    local summary="${2:-All tasks completed successfully.}"

    notify "workflow_complete" "$story_id" "$summary"
}

notify_failed() {
    local story_id="$1"
    local reason="${2:-Unknown error}"

    notify "workflow_failed" "$story_id" "$reason"
}

# ============================================================================
# POST-EPIC TESTING CONVENIENCE FUNCTIONS
# ============================================================================

notify_test_build_failed() {
    local epic_id="$1"
    local attempts="${2:-unknown}"

    notify "test_build_failed" "epic-${epic_id}" "Build failed after ${attempts} attempts."
}

notify_test_backend_complete() {
    local epic_id="$1"
    local passed="${2:-0}"
    local total="${3:-0}"

    notify "test_backend_complete" "epic-${epic_id}" "Backend API tests: ${passed}/${total} passed."
}

notify_test_frontend_complete() {
    local epic_id="$1"
    local journeys="${2:-0}"
    local bugs="${3:-0}"
    local missing="${4:-0}"

    notify "test_frontend_complete" "epic-${epic_id}" "Frontend E2E: ${journeys} journeys, ${bugs} bugs, ${missing} missing features."
}

notify_test_all_complete() {
    local epic_id="$1"
    local summary="${2:-Post-epic testing complete.}"

    notify "test_all_complete" "epic-${epic_id}" "$summary"
}

notify_test_stories_created() {
    local epic_id="$1"
    local count="${2:-0}"

    notify "test_stories_created" "epic-${epic_id}" "${count} new stories created for missing functionality."
}

# ============================================================================
# TEST FUNCTION
# ============================================================================

test_notifications() {
    echo "Testing Slack notification..."
    notify "workflow_complete" "TEST-001" "This is a test notification from BMAD workflow scripts."
    echo "Done. Check your Slack channel."
}

# If run directly, execute test
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    test_notifications
fi
