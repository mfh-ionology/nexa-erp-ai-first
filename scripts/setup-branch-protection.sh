#!/usr/bin/env bash
# setup-branch-protection.sh
#
# Applies GitHub Repository Rulesets to protect the main branch.
# Uses the modern Rulesets API (not classic branch protection).
#
# Prerequisites:
#   - GitHub CLI (gh) installed and authenticated
#   - Repo admin permissions
#
# Usage:
#   ./scripts/setup-branch-protection.sh [owner/repo]
#
# If owner/repo is omitted, it is inferred from the current git remote.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$REPO_ROOT/.github/branch-protection.json"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: Config file not found at $CONFIG_FILE"
  exit 1
fi

# Determine repo (owner/name)
if [ -n "${1:-}" ]; then
  REPO="$1"
else
  REPO="$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null)" || {
    echo "Error: Could not determine repository. Pass owner/repo as argument or run from within the repo."
    exit 1
  }
fi

echo "Applying branch protection rulesets to $REPO..."

# Check if a 'protect-main' ruleset already exists
EXISTING_ID=$(gh api "repos/$REPO/rulesets" --jq '.[] | select(.name == "protect-main") | .id' 2>/dev/null || true)

if [ -n "$EXISTING_ID" ]; then
  echo "Updating existing ruleset (ID: $EXISTING_ID)..."
  gh api \
    --method PUT \
    "repos/$REPO/rulesets/$EXISTING_ID" \
    --input "$CONFIG_FILE"
else
  echo "Creating new ruleset..."
  gh api \
    --method POST \
    "repos/$REPO/rulesets" \
    --input "$CONFIG_FILE"
fi

echo "Branch protection rulesets applied successfully."
echo ""
echo "Rules configured:"
echo "  - Require PR reviews (minimum 1 approving review)"
echo "  - Require CI status checks to pass (CI / build-and-test)"
echo "  - Require linear history (no merge commits)"
echo "  - Disallow force push (non-fast-forward)"
echo "  - Disallow branch deletion"
