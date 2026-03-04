# Journey 24: Concept D Visual Design Fidelity Check — Visual Checkpoints

## Checkpoint 1: Dashboard — Concept D Theme
- **When**: After navigating to `/ai/admin` and page loads
- **Screenshot**: `step-1-dashboard-concept-d-theme.png`
- **What to look for**:
  - Background color is light purple (#f4f2ff), NOT white or grey
  - Summary cards have 12px border-radius and subtle shadow
  - Primary buttons use purple (#7c3aed)
  - Headings use Plus Jakarta Sans (font-serif class)
  - Body text uses Inter (font-sans class)
  - Numeric counts use JetBrains Mono (font-mono class)
  - Cards appear with fadeInUp animation (may not capture in static screenshot)

## Checkpoint 2: Models List — Concept D Styling
- **When**: After navigating to `/ai/admin/models`
- **Screenshot**: `step-2-models-list-concept-d.png`
- **What to look for**:
  - Model names displayed in monospace font
  - Routing tags shown as purple badges (purple background tint with purple text)
  - StatusBadge: green dot + "Active" or grey dot + "Inactive"
  - "Default" model marked with purple badge
  - Table headers present with sort indicators
  - Overall Concept D purple theme maintained

## Checkpoint 3: Agents List — Concept D Styling
- **When**: After navigating to `/ai/admin/agents`
- **Screenshot**: `step-3-agents-list-concept-d.png`
- **What to look for**:
  - Agent cards/rows with Concept D card shadows
  - Purple primary action buttons
  - Routing tag badges visible
  - Status badges with coloured dots (green=active, grey=inactive)
  - Light purple background maintained

## Checkpoint 4: Skills Manager — Concept D Styling
- **When**: After navigating to `/ai/admin/skills`
- **Screenshot**: `step-4-skills-manager-concept-d.png`
- **What to look for**:
  - Skills grouped in accordion/collapsible sections
  - Trigger phrases displayed as blue pills/badges
  - Negative triggers displayed as red pills/badges
  - Orchestration pattern badges visible
  - Active toggle switches present
  - Concept D card styling with proper shadows

## Checkpoint 5: Automations List — Concept D Styling
- **When**: After navigating to `/ai/admin/automations`
- **Screenshot**: `step-5-automations-list-concept-d.png`
- **What to look for**:
  - Trigger type badges: purple (Scheduled), blue (Event), amber (Chain), grey (Manual)
  - Step counts displayed in monospace font
  - StatusBadge for last run status
  - Active toggle switches
  - Concept D card shadows and purple theme

## Checkpoint 6: Automation Runs — Concept D Styling
- **When**: After navigating to `/ai/admin/automations/runs`
- **Screenshot**: `step-6-automation-runs-concept-d.png`
- **What to look for**:
  - Token counts and costs in JetBrains Mono (monospace)
  - Status badges with coloured dots (green=completed, red=failed, amber=running)
  - Trigger type badges matching automation list styling
  - Formatted dates (not raw ISO strings)
  - Concept D card styling maintained
