# Rewrite Story Splits - Instructions

## Purpose

Take a story file and split recommendations from assess-story-complexity, then produce a new story file with the flagged tasks split into smaller, more manageable tasks.

## Critical Rules

1. **Preserve all metadata** - Status, story statement, acceptance criteria must remain intact
2. **Maintain AC mappings** - Split tasks must still reference their original ACs
3. **Use SM principles** - Clear, unambiguous task definitions
4. **Output valid story format** - New file must be parseable by the orchestrator

## Inputs

1. `story_file_path`: Path to original story markdown file
2. `split_recommendations`: JSON output from assess-story-complexity containing:
   ```json
   {
     "tasks": [
       {
         "task_number": 4,
         "split_recommendation": {
           "should_split": true,
           "strategy": "split_by_type",
           "suggested_groups": [
             { "name": "4a", "subtasks": [1,2,3], "rationale": "Setup" },
             { "name": "4b", "subtasks": [4,5,6], "rationale": "Implementation" }
           ]
         }
       }
     ]
   }
   ```

## Execution Steps

### Step 1: Load Original Story

Read `{{story_file_path}}` and parse into sections:
- Header (title, status)
- Story statement (As a / I want / So that)
- Acceptance Criteria
- Tasks / Subtasks
- Dev Notes
- Dev Agent Record

### Step 2: Identify Tasks to Split

From `{{split_recommendations}}`, find all tasks where:
```
task.split_recommendation.should_split == true
```

### Step 3: Apply Splits

For each task to split:

#### 3a. Parse Original Task

Extract:
- Task number and title
- AC references (from "AC: X, Y" notation)
- All subtasks with their checkbox states

#### 3b. Create Split Tasks

For each suggested group in `split_recommendation.suggested_groups`:

1. **New task number**: Use original + letter (e.g., "4a", "4b")

2. **New task title**: `{original_title} - {group.rationale}`

3. **AC mapping**: Keep same AC references (the work still satisfies same criteria)

4. **Subtasks**: Move only the subtasks listed in `group.subtasks`

5. **Renumber subtasks**:
   - Task 4a subtasks become: 4a.1, 4a.2, 4a.3...
   - Task 4b subtasks become: 4b.1, 4b.2, 4b.3...

#### Example Transformation

**Before:**
```markdown
### Task 4: Install shadcn components (AC: 1, 3)

- [ ] 4.1 Install button component
- [ ] 4.2 Install input component
- [ ] 4.3 Install card component
- [ ] 4.4 Configure button variants
- [ ] 4.5 Configure input validation
- [ ] 4.6 Configure card layouts
```

**After (with split_by_type):**
```markdown
### Task 4a: Install shadcn components - Base Installation (AC: 1, 3)

- [ ] 4a.1 Install button component
- [ ] 4a.2 Install input component
- [ ] 4a.3 Install card component

### Task 4b: Install shadcn components - Configuration (AC: 1, 3)

- [ ] 4b.1 Configure button variants
- [ ] 4b.2 Configure input validation
- [ ] 4b.3 Configure card layouts
```

### Step 4: Reconstruct Story File

Build new story file in order:

1. **Header**: Same as original
2. **Status**: Keep as `ready-for-dev`
3. **Story statement**: Same as original
4. **Acceptance Criteria**: Same as original
5. **Tasks / Subtasks**:
   - Non-split tasks: Keep as-is with original numbering
   - Split tasks: Insert new split tasks in place of original
6. **Dev Notes**: Same as original, add note about auto-split
7. **Dev Agent Record**: Same as original

### Step 5: Add Split Metadata

Add to Dev Notes section:

```markdown
### Auto-Split Record

This story was automatically split by the orchestrator on {{timestamp}}.

**Original Task → Split Tasks:**
- Task 4 → Task 4a, Task 4b
  - Strategy: split_by_type
  - Rationale: Reduce complexity for reliable automated execution
```

### Step 6: Write New Story File

1. Determine output path:
   - If `{{output_path}}` provided: use that
   - Otherwise: `{original_path_without_ext}-v2.md`

2. Write the reconstructed story

3. Output the new file path to stdout:
   ```
   /path/to/story-v2.md
   ```

## Output

Single line to stdout: the path to the new story file.

```
/path/to/auto-bmad_pack/stories/0-1-hybrid-workflow-orchestrator-v2.md
```

## Error Handling

If split cannot be applied:

```
ERROR: Could not apply split to task {n}: {reason}
```

Exit with non-zero status.

## Validation Checklist

Before outputting:
- [ ] All original ACs preserved
- [ ] All subtasks accounted for (none lost)
- [ ] Task numbering is consistent (no duplicates)
- [ ] Story format is valid markdown
- [ ] Split metadata added to Dev Notes
