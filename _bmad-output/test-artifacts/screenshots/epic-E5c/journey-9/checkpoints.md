# Journey 9: Skill Edit Form & Test Trigger Panel — Visual Checkpoints

## Checkpoint 1: Skill Edit Form (after Step 2)
- **When**: After clicking a skill card to open the edit form
- **Screenshot file**: `step-2-skill-edit-form.png`
- **What to look for**: Skill form page at /ai/admin/skills/{id}. Tabs visible: Main, Triggers, Content, Schema. Main tab active showing: name field (mono font), display name, description, category dropdown, module key dropdown, output type dropdown, priority input, active toggle. Concept D purple styling.

## Checkpoint 2: Triggers Tab (after Step 3)
- **When**: After clicking the Triggers tab
- **Screenshot file**: `step-3-triggers-tab.png`
- **What to look for**: Triggers tab active. Tag inputs visible: trigger phrases shown as blue pill badges, negative triggers as red pill badges, context required as grey pill badges. Add/remove functionality visible on each tag group.

## Checkpoint 3: Content Tab (after Step 4)
- **When**: After clicking the Content tab
- **Screenshot file**: `step-4-content-tab.png`
- **What to look for**: Content tab active. Large mono font textarea visible containing the full skillContent (SKILL.md markdown). Textarea should be sizeable for editing long content.

## Checkpoint 4: Test Trigger Panel Open (after Step 6)
- **When**: After clicking the Test Trigger button on Skill Pack Manager
- **Screenshot file**: `step-6-test-trigger-panel.png`
- **What to look for**: Test Trigger sheet/panel visible, sliding in from the right. Contains a text input for typing trigger phrases and a results area below. Panel overlay or slide-in animation complete.

## Checkpoint 5: Trigger Test Results (after Step 8)
- **When**: After entering "show me overdue invoices" and clicking Test/Run
- **Screenshot file**: `step-8-trigger-test-results.png`
- **What to look for**: L0>L1>L2 routing results displayed in the panel. Should show: L0 matched module (e.g. 'ar') with confidence score, L1 matched skill name with confidence score, L2 required tools list and first 200 chars of skill content preview. Results should appear within 3 seconds of clicking Test/Run.
