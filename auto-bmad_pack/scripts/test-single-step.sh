#!/bin/bash
# Test a single Claude Code step
# Usage: ./test-single-step.sh "<prompt>"

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="${PROJECT_ROOT}/logs/workflow"
mkdir -p "$LOG_DIR"

PROMPT="${1:?Usage: $0 '<prompt>'}"
STEP_LOG="${LOG_DIR}/test-step-$(date +%Y%m%d-%H%M%S).log"

echo "Project root: $PROJECT_ROOT"
echo "Prompt: $PROMPT"
echo "Log: $STEP_LOG"
echo ""
echo "Running Claude Code..."

# Run Claude Code
cd "$PROJECT_ROOT"
claude -p --dangerously-skip-permissions "$PROMPT" 2>&1 | tee "$STEP_LOG"

echo ""
echo "Done. Log saved to: $STEP_LOG"
