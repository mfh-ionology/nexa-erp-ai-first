# Journey 13: Automation Step Reorder and Variable Autocomplete — Visual Checkpoints

## Checkpoint 1: Automation builder with existing steps
- **When**: After clicking the 'Weekly PO Review' automation row (Step 2)
- **Screenshot**: `step-2-builder-with-two-steps.png`
- **What to look for**: Automation builder open showing Step 1 and Step 2 cards with purple number badges, assigned agents, goal text, vertical connector line between steps, drag handles (grip icon) on each step

## Checkpoint 2: Step 3 added
- **When**: After clicking "Add Step" button (Step 3)
- **Screenshot**: `step-3-third-step-added.png`
- **What to look for**: Three step cards visible (badges showing 1, 2, 3), new Step 3 card at bottom with empty goal textarea, vertical connector lines between all steps, Add Step dashed button below Step 3

## Checkpoint 3: Variable autocomplete dropdown visible
- **When**: After typing '{{' in the Step 3 goal textarea (Step 4)
- **Screenshot**: `step-4-variable-autocomplete-dropdown.png`
- **What to look for**: Autocomplete dropdown (role=listbox) visible below the textarea, variables grouped by source: System (today, currentUser.name, company.name, company.baseCurrency), Previous Steps (step1.output.*, step2.output.*), each with colored group badges

## Checkpoint 4: Variable inserted in goal text
- **When**: After selecting a step2.output.* variable from autocomplete (Step 5)
- **Screenshot**: `step-5-variable-inserted.png`
- **What to look for**: Goal textarea now contains the inserted variable reference (e.g. `{{step2.output.*}}`), autocomplete dropdown dismissed, variable text visible in the textarea

## Checkpoint 5: Step 3 removed, back to 2 steps
- **When**: After clicking delete on Step 3 and confirming (Step 6)
- **Screenshot**: `step-6-step-deleted-back-to-two.png`
- **What to look for**: Only 2 step cards visible (badges 1 and 2), Step 3 gone, numbering correct, vertical connector between Step 1 and Step 2 only
