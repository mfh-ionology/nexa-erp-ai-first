#!/bin/bash
# Helper script to trigger a proceed signal for waiting epic workflows
# Usage: ./proceed.sh <signal-name>
#
# Examples:
#   ./proceed.sh 0-story-3           # Continue epic 0 after story 3
#   ./proceed.sh 1-story-5           # Continue epic 1 after story 5
#   ./proceed.sh                     # List all waiting signals

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
PROCEED_WAIT_DIR="${PROJECT_ROOT}/logs/workflow/proceed-signals"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Ensure directory exists
mkdir -p "$PROCEED_WAIT_DIR"

# No argument - list waiting signals
if [[ $# -eq 0 ]]; then
    echo -e "${CYAN}Proceed Signal Helper${NC}"
    echo -e "Usage: $0 <signal-name>\n"

    echo -e "${YELLOW}Currently waiting workflows:${NC}"

    # Check the main proceed-signals directory
    waiting_count=0
    if [[ -d "$PROCEED_WAIT_DIR" ]]; then
        shopt -s nullglob
        for expected in "$PROCEED_WAIT_DIR"/*-proceed; do
            if [[ -f "$expected" ]]; then
                signal_name=$(basename "$expected" | sed 's/-proceed$//')
                echo "  - ${signal_name}"
                ((waiting_count++)) || true
            fi
        done
        shopt -u nullglob
    fi

    if [[ $waiting_count -eq 0 ]]; then
        echo "  (no workflows currently waiting)"
    fi

    echo -e "\n${CYAN}To trigger proceed:${NC}"
    echo "  $0 <epic-id>-story-<n>"
    echo -e "\n${CYAN}Signal directory:${NC}"
    echo "  $PROCEED_WAIT_DIR"
    exit 0
fi

# Argument provided - create the signal
SIGNAL_NAME="$1"
SIGNAL_FILE="${PROCEED_WAIT_DIR}/${SIGNAL_NAME}-proceed"

echo -e "${GREEN}Creating proceed signal: ${SIGNAL_FILE}${NC}"
touch "$SIGNAL_FILE"

echo -e "${GREEN}✓ Proceed signal created!${NC}"
echo -e "The waiting workflow should continue shortly."
