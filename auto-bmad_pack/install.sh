#!/bin/bash
# Auto-BMAD Installation Script
# Installs V4 workflow scripts and skills into a project with BMAD V4
#
# Usage: ./auto-bmad_pack/install.sh
# Run from the root of your target project

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PACK_DIR="$SCRIPT_DIR"

echo -e "${CYAN}"
echo "=================================================================="
echo "  Auto-BMAD Installation"
echo "  V4 Workflow Automation for BMAD Projects"
echo "=================================================================="
echo -e "${NC}"

# ============================================================================
# STEP 1: Validate pack contents
# ============================================================================
echo -e "${BLUE}Step 1: Validating auto-bmad_pack contents...${NC}"

REQUIRED_FILES=(
    "scripts/v4-story-workflow.sh"
    "scripts/v4-epic-workflow.sh"
    "scripts/notify.sh"
    "claude-commands/auto-bmad/run-story.md"
    "claude-commands/auto-bmad/run-epic.md"
    "config/.bmad-secrets.example"
    "README.md"
)

MISSING_FILES=()
for file in "${REQUIRED_FILES[@]}"; do
    if [[ ! -f "$PACK_DIR/$file" ]]; then
        MISSING_FILES+=("$file")
        echo -e "  ${RED}MISSING: $file${NC}"
    else
        echo -e "  ${GREEN}OK: $file${NC}"
    fi
done

if [[ ${#MISSING_FILES[@]} -gt 0 ]]; then
    echo -e "\n${RED}ERROR: ${#MISSING_FILES[@]} required files are missing from auto-bmad_pack${NC}"
    echo -e "${YELLOW}Please ensure the pack is complete before installing.${NC}"
    echo -e "\nMissing files:"
    for f in "${MISSING_FILES[@]}"; do
        echo -e "  - $f"
    done
    exit 1
fi

echo -e "${GREEN}All pack files validated.${NC}\n"

# ============================================================================
# STEP 2: Check for BMAD V4 installation
# ============================================================================
echo -e "${BLUE}Step 2: Checking for BMAD V4 installation...${NC}"

BMAD_INDICATORS=(
    "_bmad"
    ".claude/commands"
)

BMAD_FOUND=false
for indicator in "${BMAD_INDICATORS[@]}"; do
    if [[ -d "$PROJECT_ROOT/$indicator" ]]; then
        BMAD_FOUND=true
        echo -e "  ${GREEN}Found: $indicator${NC}"
    fi
done

if [[ "$BMAD_FOUND" == "false" ]]; then
    echo -e "${YELLOW}WARNING: BMAD installation not detected.${NC}"
    echo -e "${YELLOW}Auto-BMAD requires BMAD V4 agents (/bmad-sm, /bmad-po, /bmad-qa, /bmad-dev)${NC}"
    echo -e "\nContinue anyway? (y/n)"
    read -r response
    if [[ "$response" != "y" && "$response" != "Y" ]]; then
        echo "Installation cancelled."
        exit 0
    fi
else
    echo -e "${GREEN}BMAD installation detected.${NC}\n"
fi

# ============================================================================
# STEP 3: Create required directories
# ============================================================================
echo -e "${BLUE}Step 3: Creating directories...${NC}"

DIRS_TO_CREATE=(
    "scripts"
    "logs/workflow"
    ".claude/commands/auto-bmad"
)

for dir in "${DIRS_TO_CREATE[@]}"; do
    if [[ ! -d "$PROJECT_ROOT/$dir" ]]; then
        mkdir -p "$PROJECT_ROOT/$dir"
        echo -e "  ${GREEN}Created: $dir${NC}"
    else
        echo -e "  ${CYAN}Exists: $dir${NC}"
    fi
done
echo ""

# ============================================================================
# STEP 4: Copy scripts
# ============================================================================
echo -e "${BLUE}Step 4: Installing workflow scripts...${NC}"

SCRIPTS=(
    "v4-story-workflow.sh"
    "v4-epic-workflow.sh"
    "notify.sh"
)

for script in "${SCRIPTS[@]}"; do
    src="$PACK_DIR/scripts/$script"
    dst="$PROJECT_ROOT/scripts/$script"

    if [[ -f "$dst" ]]; then
        echo -e "  ${YELLOW}Backup: $script -> $script.bak${NC}"
        cp "$dst" "$dst.bak"
    fi

    cp "$src" "$dst"
    chmod +x "$dst"
    echo -e "  ${GREEN}Installed: scripts/$script${NC}"
done
echo ""

# ============================================================================
# STEP 5: Copy skills/commands
# ============================================================================
echo -e "${BLUE}Step 5: Installing Claude skills...${NC}"

SKILLS=(
    "run-story.md"
    "run-epic.md"
)

for skill in "${SKILLS[@]}"; do
    src="$PACK_DIR/claude-commands/auto-bmad/$skill"
    dst="$PROJECT_ROOT/.claude/commands/auto-bmad/$skill"

    cp "$src" "$dst"
    echo -e "  ${GREEN}Installed: .claude/commands/auto-bmad/$skill${NC}"
done
echo ""

# ============================================================================
# STEP 6: Setup secrets file
# ============================================================================
echo -e "${BLUE}Step 6: Setting up configuration...${NC}"

SECRETS_FILE="$PROJECT_ROOT/.bmad-secrets"
if [[ ! -f "$SECRETS_FILE" ]]; then
    cp "$PACK_DIR/config/.bmad-secrets.example" "$SECRETS_FILE"
    echo -e "  ${GREEN}Created: .bmad-secrets (from template)${NC}"
    echo -e "  ${YELLOW}NOTE: Edit .bmad-secrets to add your Slack webhook URL${NC}"
else
    echo -e "  ${CYAN}Exists: .bmad-secrets (not overwritten)${NC}"
fi

# Add to .gitignore if not already there
GITIGNORE="$PROJECT_ROOT/.gitignore"
if [[ -f "$GITIGNORE" ]]; then
    if ! grep -q ".bmad-secrets" "$GITIGNORE"; then
        echo ".bmad-secrets" >> "$GITIGNORE"
        echo -e "  ${GREEN}Added .bmad-secrets to .gitignore${NC}"
    fi
fi
echo ""

# ============================================================================
# STEP 7: Verify installation
# ============================================================================
echo -e "${BLUE}Step 7: Verifying installation...${NC}"

VERIFY_FILES=(
    "scripts/v4-story-workflow.sh"
    "scripts/v4-epic-workflow.sh"
    "scripts/notify.sh"
    ".claude/commands/auto-bmad/run-story.md"
    ".claude/commands/auto-bmad/run-epic.md"
    ".bmad-secrets"
)

ALL_OK=true
for file in "${VERIFY_FILES[@]}"; do
    if [[ -f "$PROJECT_ROOT/$file" ]]; then
        echo -e "  ${GREEN}OK: $file${NC}"
    else
        echo -e "  ${RED}MISSING: $file${NC}"
        ALL_OK=false
    fi
done

echo ""

# ============================================================================
# Summary
# ============================================================================
if [[ "$ALL_OK" == "true" ]]; then
    echo -e "${GREEN}=================================================================="
    echo "  Installation Complete!"
    echo "==================================================================${NC}"
    echo ""
    echo -e "${CYAN}Available Skills:${NC}"
    echo "  /auto-bmad-story  - Run V4 story workflow"
    echo "  /auto-bmad-epic   - Run V4 epic workflow"
    echo ""
    echo -e "${CYAN}Direct Script Usage:${NC}"
    echo "  ./scripts/v4-story-workflow.sh <story-id>"
    echo "  ./scripts/v4-epic-workflow.sh <epic-id>"
    echo ""
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "  1. Edit .bmad-secrets with your Slack webhook URL"
    echo "  2. Ensure BMAD V4 agents are available"
    echo "  3. Run: ./scripts/v4-story-workflow.sh E01-S01"
    echo ""
else
    echo -e "${RED}=================================================================="
    echo "  Installation Incomplete - Some files missing"
    echo "==================================================================${NC}"
    exit 1
fi
