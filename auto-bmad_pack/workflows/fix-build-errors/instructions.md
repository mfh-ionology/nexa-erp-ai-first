# Fix Build Errors - Instructions

## Purpose

Analyze build error output from `pnpm build` and fix TypeScript, ESM, import, and configuration errors across the monorepo. This workflow is invoked by the post-epic build verification script when a build fails.

## Critical Rules

1. **Output ONLY valid JSON** - No markdown, no explanations, just JSON to stdout
2. **Fix errors in dependency order** - shared package first, then server, then client
3. **Do not change business logic** - Only fix type errors, imports, and configuration
4. **Verify each fix** - After modifying a file, ensure the change is syntactically correct
5. **Do not add new dependencies** - Only work with existing packages

## Inputs

- `{{build_error_log}}`: Path to file containing the raw build error output
- `{{project_root}}`: Path to the project root directory

## Execution Steps

### Step 1: Parse Build Errors

Read the build error log at `{{build_error_log}}` and categorize errors:

1. **TypeScript errors** - Type mismatches, missing properties, incompatible types
2. **Import errors** - Missing modules, incorrect paths, ESM/CJS conflicts
3. **Configuration errors** - tsconfig issues, vite config, drizzle config
4. **Syntax errors** - Unexpected tokens, malformed expressions

For each error, extract:
- File path
- Line number (if available)
- Error code (e.g., TS2345, TS2307)
- Error message

### Step 2: Analyze Root Causes

For each error group:

#### 2a. Read Source Files
Read each file that has errors. Understand the context around the error location.

#### 2b. Identify Fix Strategy

| Error Type | Strategy |
|-----------|----------|
| Missing import | Add the import statement from the correct package |
| Wrong import path | Fix the path (check `packages/shared/src/index.ts` exports) |
| Type mismatch | Adjust the type annotation or cast appropriately |
| Missing property | Add the property to the interface/type or make it optional |
| ESM/CJS conflict | Use proper ESM import syntax (`import x from 'y'`) |
| Unused variable | Remove the variable or prefix with underscore |

### Step 3: Apply Fixes

For each identified fix:

1. Read the current file content
2. Apply the minimal change needed
3. Write the fixed file

**Fix order matters - follow monorepo dependency chain:**
1. `packages/shared/` first (types, schemas, utilities)
2. `packages/server/` second (depends on shared)
3. `packages/client/` last (depends on shared)

### Step 4: Verify Build

Run `pnpm build` from `{{project_root}}` to verify fixes resolved the errors.

- If build succeeds: set `build_verified: true`
- If new errors appear: attempt to fix those too (up to 2 additional rounds)
- If errors persist after 3 rounds: set `status: "needs_human"`

### Step 5: Output JSON

Output ONLY this JSON structure:

```json
{
  "status": "fixed|partial|needs_human",
  "files_modified": [
    {
      "file_path": "packages/shared/src/types.ts",
      "change_description": "Added missing ProjectStatus type export"
    }
  ],
  "errors_remaining": [
    {
      "error": "TS2345: Argument of type 'string' is not assignable...",
      "file": "packages/server/src/routes/projects.ts",
      "reason": "Requires architectural change beyond simple fix"
    }
  ],
  "build_verified": true,
  "fix_rounds": 1,
  "timestamp": "2025-01-01T00:00:00Z"
}
```

## Error Handling

If the build error log cannot be read or is empty:

```json
{
  "status": "needs_human",
  "files_modified": [],
  "errors_remaining": [],
  "build_verified": false,
  "error": "Build error log is empty or unreadable",
  "timestamp": "2025-01-01T00:00:00Z"
}
```
