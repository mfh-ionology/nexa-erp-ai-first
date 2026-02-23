# Generate Backend Test Plan - Instructions

## Purpose

Analyze all completed stories for an epic, read the actual route/repository/schema files, and generate a comprehensive API test plan. The test plan will be executed via `curl` by a subsequent script.

## Critical Rules

1. **Read actual source code** - Do not guess endpoints from stories alone; read route files to get exact paths and parameters
2. **Include DB verification** - For mutating operations (POST/PUT/DELETE), include a DB query to verify the state change
3. **Test validation rules** - Check that invalid inputs return proper error responses
4. **Order tests logically** - Create/setup operations before read/verify operations
5. **Output valid JSON** - The test plan must be parseable JSON

## Inputs

- `{{epic_id}}`: Epic identifier (e.g., "1")
- `{{epic_file_path}}`: Path to the epic markdown file
- `{{stories_dir}}`: Path to the stories directory (e.g., `_bmad-output/implementation-artifacts/stories/`)
- `{{project_root}}`: Path to the project root

## Execution Steps

### Step 1: Read Epic and Story Files

1. Read the epic file at `{{epic_file_path}}`
2. Read all story files in `{{stories_dir}}` that belong to epic `{{epic_id}}`
   - Match pattern: `{{epic_id}}-*` files
3. Extract from each completed story:
   - API endpoints mentioned (method, path, purpose)
   - Acceptance criteria (expected behaviors)
   - Validation rules (required fields, formats, constraints)

### Step 2: Read Source Code

1. Read route files in `{{project_root}}/packages/server/src/routes/`
   - Identify all registered routes (GET, POST, PUT, DELETE, PATCH)
   - Extract path parameters, query parameters, request body schemas
2. Read repository files in `{{project_root}}/packages/server/src/repositories/` (if present)
   - Understand data access patterns
3. Read Drizzle schema in `{{project_root}}/packages/server/src/db/schema.ts`
   - Understand table structures for DB verification queries
4. Read validation schemas (Zod/Drizzle-zod) if present
   - Extract exact validation rules

### Step 3: Generate Test Cases

For each endpoint discovered:

#### 3a. Happy Path Tests
- Valid request with all required fields
- Expected 200/201 response
- Verify response body contains expected fields

#### 3b. Validation Error Tests
- Missing required fields -> expect 400
- Invalid field types -> expect 400
- Invalid field values (too short, too long, invalid format) -> expect 400

#### 3c. Error/Edge Case Tests
- Resource not found -> expect 404
- Duplicate creation (if applicable) -> expect 409 or appropriate error
- Empty lists -> expect 200 with empty array

#### 3d. DB Verification
For mutating operations, add a verification step:
- After POST: SELECT to verify row was created
- After PUT: SELECT to verify fields were updated
- After DELETE: SELECT to verify row was removed or soft-deleted

### Step 4: Order Test Cases

Order the test plan so that:
1. Creation endpoints run first (creates test data)
2. Read/list endpoints run second (verifies created data)
3. Update endpoints run third (modifies test data)
4. Delete endpoints run last (cleans up)

### Step 5: Output JSON

Write the test plan as JSON. Structure:

```json
{
  "epic_id": "1",
  "generated_at": "2025-01-01T00:00:00Z",
  "total_test_cases": 25,
  "endpoints": [
    {
      "method": "POST",
      "path": "/api/projects",
      "description": "Create a new project",
      "source_file": "packages/server/src/routes/projects.ts",
      "test_cases": [
        {
          "name": "Create project - happy path",
          "type": "happy_path",
          "request": {
            "method": "POST",
            "url": "/api/projects",
            "headers": {"Content-Type": "application/json"},
            "body": {
              "name": "Test Project",
              "description": "Test description"
            }
          },
          "expected": {
            "status": 201,
            "body_contains": ["id", "name", "createdAt"],
            "body_schema": {
              "id": "number",
              "name": "string"
            }
          },
          "db_verification": {
            "enabled": true,
            "table": "projects",
            "query": "SELECT * FROM projects WHERE name = 'Test Project'",
            "expected": "Row exists with matching name and description"
          }
        },
        {
          "name": "Create project - missing name",
          "type": "validation",
          "request": {
            "method": "POST",
            "url": "/api/projects",
            "headers": {"Content-Type": "application/json"},
            "body": {"description": "No name field"}
          },
          "expected": {
            "status": 400,
            "body_contains": ["error"]
          },
          "db_verification": {"enabled": false}
        }
      ]
    }
  ]
}
```

## Error Handling

If epic or story files cannot be found:

```json
{
  "epic_id": "1",
  "error": "No story files found for epic 1",
  "endpoints": [],
  "total_test_cases": 0
}
```
