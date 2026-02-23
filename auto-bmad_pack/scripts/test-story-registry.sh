#!/bin/bash
# Test script for epic story registry parsing
# Usage: ./test-story-registry.sh [epic-id]
# This tests the new story_registry parsing without running any workflows

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
IMPL_ARTIFACTS="${PROJECT_ROOT}/_bmad-output/implementation-artifacts"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

EPIC_ID="${1:-3}"
EPIC_FILE="${IMPL_ARTIFACTS}/epics/epic-${EPIC_ID}.md"

echo -e "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  STORY REGISTRY PARSING TEST                               ║${NC}"
echo -e "${CYAN}║  Epic: ${EPIC_ID}                                                    ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}\n"

# ============================================================================
# TEST 1: Check epic file exists and has frontmatter
# ============================================================================
echo -e "${BLUE}TEST 1: Epic file validation${NC}"

if [[ ! -f "$EPIC_FILE" ]]; then
    echo -e "${RED}  ✗ Epic file not found: $EPIC_FILE${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Epic file exists: $EPIC_FILE${NC}"

if head -1 "$EPIC_FILE" | grep -q "^---$"; then
    echo -e "${GREEN}  ✓ Epic file has YAML frontmatter${NC}"
else
    echo -e "${RED}  ✗ Epic file missing YAML frontmatter (must start with ---)${NC}"
    exit 1
fi

# ============================================================================
# TEST 2: Parse story_registry
# ============================================================================
echo -e "\n${BLUE}TEST 2: Parse story_registry from epic file${NC}"

# Parse function (same as in v7-orchestrated-epic.sh)
parse_epic_story_registry() {
    local epic_file="$1"
    awk '
        /^---$/ {
            if (in_frontmatter) exit
            in_frontmatter = 1
            next
        }
        in_frontmatter && /^story_registry:/ { in_registry = 1; next }
        in_frontmatter && in_registry && /^[a-z_]+:/ && !/^  / { exit }
        in_frontmatter && in_registry && /^  - id:/ {
            gsub(/^  - id: *"?|"?$/, "")
            print
        }
    ' "$epic_file"
}

stories=($(parse_epic_story_registry "$EPIC_FILE"))
story_count=${#stories[@]}

if [[ $story_count -eq 0 ]]; then
    echo -e "${RED}  ✗ No stories found in story_registry${NC}"
    exit 1
fi

echo -e "${GREEN}  ✓ Found ${story_count} stories in story_registry${NC}"
echo -e "${CYAN}  Stories:${NC}"
for story in "${stories[@]}"; do
    echo -e "    - ${story}"
done

# ============================================================================
# TEST 3: Get story status from registry
# ============================================================================
echo -e "\n${BLUE}TEST 3: Parse story status from registry${NC}"

get_story_status_from_registry() {
    local story_id="$1"
    local epic_file="$2"
    awk -v story="$story_id" '
        /^---$/ {
            if (in_frontmatter) exit
            in_frontmatter = 1
            next
        }
        in_frontmatter && /^  - id:/ {
            gsub(/^  - id: *"?|"?$/, "")
            current_id = $0
        }
        in_frontmatter && current_id == story && /^    status:/ {
            gsub(/^    status: *"?|"?$/, "")
            print
            exit
        }
    ' "$epic_file"
}

done_count=0
backlog_count=0
ready_count=0

for story_id in "${stories[@]}"; do
    status=$(get_story_status_from_registry "$story_id" "$EPIC_FILE")
    case "$status" in
        done) ((done_count++)) ;;
        backlog) ((backlog_count++)) ;;
        ready-for-dev) ((ready_count++)) ;;
    esac
    echo -e "  ${story_id}: ${status}"
done

echo -e "\n${CYAN}  Summary: ${done_count} done, ${ready_count} ready, ${backlog_count} backlog${NC}"

# ============================================================================
# TEST 4: Match stories to files
# ============================================================================
echo -e "\n${BLUE}TEST 4: Match registry stories to story files${NC}"

stories_dir="${IMPL_ARTIFACTS}/stories"
files_found=0
files_missing=0

for story_id in "${stories[@]}"; do
    # Try to find file matching this story ID
    found_file=""
    while IFS= read -r -d '' f; do
        if [[ -f "$f" ]]; then
            found_file=$(basename "$f")
            break
        fi
    done < <(find "$stories_dir" -maxdepth 1 -name "${story_id}-*.md" -print0 2>/dev/null)

    status=$(get_story_status_from_registry "$story_id" "$EPIC_FILE")

    if [[ -n "$found_file" ]]; then
        echo -e "${GREEN}  ✓ ${story_id}: ${found_file}${NC}"
        ((files_found++))
    elif [[ "$status" == "backlog" ]]; then
        echo -e "${CYAN}  ○ ${story_id}: no file (backlog)${NC}"
    else
        echo -e "${RED}  ✗ ${story_id}: NO FILE (status: ${status})${NC}"
        ((files_missing++))
    fi
done

echo -e "\n${CYAN}  Files found: ${files_found}, Missing (non-backlog): ${files_missing}${NC}"

# ============================================================================
# TEST 5: Check for orphan files
# ============================================================================
echo -e "\n${BLUE}TEST 5: Check for orphan files (in directory but not in registry)${NC}"

orphan_count=0
while IFS= read -r -d '' f; do
    filename=$(basename "$f" .md)
    file_story_id=$(echo "$filename" | grep -oE "^${EPIC_ID}-[0-9]+[a-z0-9]*")

    found=false
    for reg_id in "${stories[@]}"; do
        if [[ "$file_story_id" == "$reg_id" ]]; then
            found=true
            break
        fi
    done

    if [[ "$found" == "false" ]]; then
        echo -e "${YELLOW}  ⚠ Orphan: ${filename}${NC}"
        ((orphan_count++))
    fi
done < <(find "$stories_dir" -maxdepth 1 -name "${EPIC_ID}-*.md" -print0 2>/dev/null)

if [[ $orphan_count -eq 0 ]]; then
    echo -e "${GREEN}  ✓ No orphan files${NC}"
else
    echo -e "${YELLOW}  Found ${orphan_count} orphan files${NC}"
fi

# ============================================================================
# SUMMARY
# ============================================================================
echo -e "\n${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║  TEST SUMMARY                                              ║${NC}"
echo -e "${CYAN}╠════════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║  Stories in registry: ${story_count}${NC}"
echo -e "${CYAN}║  Done: ${done_count}, Ready: ${ready_count}, Backlog: ${backlog_count}${NC}"
echo -e "${CYAN}║  Files found: ${files_found}${NC}"
echo -e "${CYAN}║  Files missing (errors): ${files_missing}${NC}"
echo -e "${CYAN}║  Orphan files: ${orphan_count}${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"

if [[ $files_missing -gt 0 ]]; then
    echo -e "\n${RED}Some tests failed. Fix missing story files or update registry.${NC}"
    exit 1
fi

echo -e "\n${GREEN}All tests passed!${NC}"
echo -e "\n${BLUE}You can now run:${NC}"
echo -e "  ${CYAN}./v7-orchestrated-epic.sh ${EPIC_ID} --validate-only${NC}  # Full validation"
echo -e "  ${CYAN}./v7-orchestrated-epic.sh ${EPIC_ID} --sync-from-epic${NC}  # Sync sprint-status"
