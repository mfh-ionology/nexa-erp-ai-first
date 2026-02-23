#!/bin/bash
# Format Slack messages for BMAD workflow notifications
#
# Usage:
#   format-slack-message.sh escalation <story_file> <task_info> <analysis> <recommendations>
#   format-slack-message.sh story_complete <story_id> <task_count>
#   format-slack-message.sh epic_complete <epic_id> <story_count>
#
# Outputs JSON payload for Slack webhook

set -e

MESSAGE_TYPE="${1:?Usage: $0 <type> <args...>}"
shift

# Escape special characters for JSON
json_escape() {
    local str="$1"
    str="${str//\\/\\\\}"  # Backslash
    str="${str//\"/\\\"}"  # Quote
    str="${str//$'\n'/\\n}" # Newline
    str="${str//$'\t'/\\t}" # Tab
    echo "$str"
}

# Format RED escalation message
format_escalation() {
    local story_file="$1"
    local task_info="$2"
    local analysis="$3"
    local recommendations="$4"

    local story_name=$(basename "$story_file")
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # Escape for JSON
    task_info=$(json_escape "$task_info")
    analysis=$(json_escape "$analysis")
    recommendations=$(json_escape "$recommendations")

    cat << EOF
{
    "blocks": [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": ":rotating_light: WORKFLOW BLOCKED - Human Decision Required",
                "emoji": true
            }
        },
        {
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": "*Story:*\n${story_name}"
                },
                {
                    "type": "mrkdwn",
                    "text": "*Task:*\n${task_info}"
                }
            ]
        },
        {
            "type": "divider"
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*ISSUE:*\n${analysis}"
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*RECOMMENDED ACTION:*\n${recommendations}"
            }
        },
        {
            "type": "divider"
        },
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": ":clock1: ${timestamp} | Reply: \`/continue\` | \`/abort\` | \`/restructured\`"
                }
            ]
        }
    ]
}
EOF
}

# Format story completion message
format_story_complete() {
    local story_id="$1"
    local task_count="$2"
    local duration="${3:-unknown}"
    local tokens="${4:-}"
    local cost="${5:-}"

    # Build usage context line if data is available
    local usage_block=""
    if [[ -n "$tokens" && "$tokens" != "0" ]]; then
        usage_block=',
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": ":bar_chart: '"${tokens}"' tokens | Est. $'"${cost}"'"
                }
            ]
        }'
    fi

    cat << EOF
{
    "blocks": [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": ":white_check_mark: *Story Completed*\n*${story_id}*\n${task_count} tasks executed successfully"
            }
        },
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": ":clock1: $(date '+%Y-%m-%d %H:%M:%S') | Duration: ${duration}"
                }
            ]
        }${usage_block}
    ]
}
EOF
}

# Format epic completion message
format_epic_complete() {
    local epic_id="$1"
    local story_count="$2"
    local duration="${3:-unknown}"
    local tokens="${4:-}"
    local cost="${5:-}"

    # Build usage text if data is available
    local usage_text=""
    if [[ -n "$tokens" && "$tokens" != "0" ]]; then
        usage_text="\n:bar_chart: *Usage:* ${tokens} tokens | Est. \$${cost}"
    fi

    cat << EOF
{
    "blocks": [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": ":tada: Epic Completed!",
                "emoji": true
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": "*Epic:* ${epic_id}\n*Stories completed:* ${story_count}\n*Total duration:* ${duration}${usage_text}"
            }
        },
        {
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": ":clock1: $(date '+%Y-%m-%d %H:%M:%S')"
                }
            ]
        }
    ]
}
EOF
}

# Format retry notification
format_retry() {
    local story_id="$1"
    local task_num="$2"
    local attempt="$3"
    local reason="$4"

    reason=$(json_escape "$reason")

    cat << EOF
{
    "blocks": [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": ":arrows_counterclockwise: *Task Retry*\nStory: ${story_id}\nTask: ${task_num}\nAttempt: ${attempt}\nReason: ${reason}"
            }
        }
    ]
}
EOF
}

# Format simple text message
format_simple() {
    local text="$1"
    text=$(json_escape "$text")

    cat << EOF
{
    "text": "${text}"
}
EOF
}

# Main dispatch
case "$MESSAGE_TYPE" in
    escalation)
        format_escalation "$@"
        ;;
    story_complete)
        format_story_complete "$@"
        ;;
    epic_complete)
        format_epic_complete "$@"
        ;;
    retry)
        format_retry "$@"
        ;;
    simple)
        format_simple "$@"
        ;;
    *)
        echo "Unknown message type: $MESSAGE_TYPE" >&2
        echo "Types: escalation, story_complete, epic_complete, retry, simple" >&2
        exit 1
        ;;
esac
