# Finance Phase 2 Wave 9: Frontend — Dimensions, Simulations, and Budget Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the frontend pages for Dimension management (types, values with tree view, requirements, defaults), Simulation CRUD (list + form mirroring journals), and Budget form enhancements (version selector, budget key quick-apply, dimensional split modal).

**Architecture:** 3 independent frontend stories (FE-1, FE-2, FE-3) that can be built in parallel. Each creates route pages under `/finance/` and feature components under `apps/web/src/features/finance/`. All pages consume APIs built in Waves 2-4.

**Tech Stack:** React 19, TanStack Router, TanStack Query, Zustand, Tailwind 4, Shadcn UI, Plus Jakarta Sans / Inter fonts

**Depends on:** Wave 2 (Dimension APIs), Wave 3 (Simulation APIs), Wave 4 (Budget Version/Key/Split APIs)

**Blocked by this plan:** Nothing (leaf node)

**Visual Reference:** `_bmad-output/planning-artifacts/ux-prototypes/concept-d-purple-copilot.html` — all pages must match Concept D styling (purple theme, 12px radius cards, custom shadows).

---

## File Structure

### New Files — Dimension Pages (FE-1 + FE-2)
```
apps/web/src/routes/_authenticated/finance/dimensions/index.tsx         — Dimension Types list (T2)
apps/web/src/routes/_authenticated/finance/dimensions/$typeId/values.tsx — Dimension Values for type (T2 tree)
apps/web/src/routes/_authenticated/finance/dimensions/requirements.tsx  — Dimension Requirements list (T2)
apps/web/src/routes/_authenticated/finance/dimensions/defaults.tsx      — Dimension Defaults list (T2)
apps/web/src/features/finance/dimensions/DimensionTypeList.tsx          — Dimension types list component
apps/web/src/features/finance/dimensions/DimensionTypeDialog.tsx        — Create/edit dimension type dialog
apps/web/src/features/finance/dimensions/DimensionValueTree.tsx         — Tree-table view for dimension values
apps/web/src/features/finance/dimensions/DimensionValueDialog.tsx       — Create/edit dimension value dialog
apps/web/src/features/finance/dimensions/DimensionRequirementList.tsx   — Requirements list component
apps/web/src/features/finance/dimensions/DimensionRequirementDialog.tsx — Create/edit requirement dialog
apps/web/src/features/finance/dimensions/DimensionDefaultList.tsx       — Defaults list component
apps/web/src/features/finance/dimensions/DimensionDefaultDialog.tsx     — Create default dialog
apps/web/src/features/finance/dimensions/api.ts                         — TanStack Query hooks for dimension APIs
```

### New Files — Simulation Pages (FE-3)
```
apps/web/src/routes/_authenticated/finance/simulations/index.tsx        — Simulations list (T2)
apps/web/src/routes/_authenticated/finance/simulations/new.tsx          — New simulation form (T3)
apps/web/src/routes/_authenticated/finance/simulations/$id.tsx          — Edit/view simulation form (T3)
apps/web/src/features/finance/simulations/SimulationList.tsx            — Simulations list component
apps/web/src/features/finance/simulations/SimulationForm.tsx            — Simulation form component (mirrors journal form)
apps/web/src/features/finance/simulations/api.ts                        — TanStack Query hooks for simulation APIs
```

### New Files — Budget Enhancements
```
apps/web/src/features/finance/budgets/BudgetKeyApplyPopover.tsx         — Budget key selection + apply popover
apps/web/src/features/finance/budgets/DimensionSplitModal.tsx           — Modal for splitting budget line by dimension
apps/web/src/features/finance/budgets/BudgetVersionSelector.tsx         — Budget version dropdown component
```

### Modified Files
```
apps/web/src/routes/_authenticated/finance/budgets/$id.tsx              — Add version selector, budget key, dimension split
apps/web/src/routeTree.gen.ts                                           — Auto-generated (run codegen after adding routes)
```

### Reference Files (read-only)
```
apps/web/src/routes/_authenticated/finance/journals/new.tsx             — Pattern for journal form (simulation mirrors this)
apps/web/src/routes/_authenticated/finance/journals/index.tsx           — Pattern for list pages
apps/web/src/routes/_authenticated/finance/chart-of-accounts/index.tsx  — Pattern for list with row navigation
docs/superpowers/specs/2026-04-01-fin-phase2-design.md                  — Design spec sections 2.4, 3.6, 4.7
```

---

## Task 1: Create Dimension API Hooks

**Files:**
- Create: `apps/web/src/features/finance/dimensions/api.ts`

- [ ] **Step 1: Define TanStack Query hooks for all dimension endpoints**

```typescript
// api.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api'; // or whatever the project's fetch wrapper is

// --- Dimension Types ---

export const dimensionTypeKeys = {
  all: ['finance', 'dimension-types'] as const,
  list: (params?: Record<string, unknown>) => [...dimensionTypeKeys.all, 'list', params] as const,
  detail: (id: string) => [...dimensionTypeKeys.all, 'detail', id] as const,
};

export function useDimensionTypes(params?: { isActive?: boolean }) {
  return useQuery({
    queryKey: dimensionTypeKeys.list(params),
    queryFn: () => api.get('/finance/dimensions/types', { params }),
  });
}

export function useDimensionType(id: string) {
  return useQuery({
    queryKey: dimensionTypeKeys.detail(id),
    queryFn: () => api.get(`/finance/dimensions/types/${id}`),
    enabled: !!id,
  });
}

export function useCreateDimensionType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/finance/dimensions/types', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: dimensionTypeKeys.all }),
  });
}

export function useUpdateDimensionType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.patch(`/finance/dimensions/types/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: dimensionTypeKeys.all }),
  });
}

// --- Dimension Values ---
// Similar pattern for: useDimensionValues(typeId), useCreateDimensionValue(typeId),
// useUpdateDimensionValue(typeId)

// --- Dimension Requirements ---
// useDimensionRequirements(), useCreateDimensionRequirement(),
// useUpdateDimensionRequirement(), useDeleteDimensionRequirement()

// --- Dimension Defaults ---
// useDimensionDefaults(params), useCreateDimensionDefault(),
// useDeleteDimensionDefault()
```

---

## Task 2: Build Dimension Types List Page

**Files:**
- Create: `apps/web/src/routes/_authenticated/finance/dimensions/index.tsx`
- Create: `apps/web/src/features/finance/dimensions/DimensionTypeList.tsx`
- Create: `apps/web/src/features/finance/dimensions/DimensionTypeDialog.tsx`

- [ ] **Step 1: Create the route page**

```typescript
// routes/_authenticated/finance/dimensions/index.tsx
import { createFileRoute } from '@tanstack/react-router';
import { DimensionTypeList } from '@/features/finance/dimensions/DimensionTypeList';

export const Route = createFileRoute('/_authenticated/finance/dimensions/')({
  component: DimensionTypeList,
});
```

- [ ] **Step 2: Create DimensionTypeList component**

Template: T2 (List Page)

```typescript
// DimensionTypeList.tsx
// Layout:
//   Page header: "Dimension Types" with breadcrumb: Finance > Dimensions
//   Action bar: "New Type" primary button
//   Data table columns:
//     - Code (sortable)
//     - Name (sortable)
//     - Single Select (Badge: Yes/No)
//     - Allow Manual Entry (Badge: Yes/No)
//     - Sort Order
//     - Active (Badge: green/grey)
//     - Values Count
//   Row click: navigate to /finance/dimensions/{typeId}/values
//   Row actions: Edit (opens dialog), Activate/Deactivate toggle
//
// Data: useDimensionTypes()
// Empty state: "No dimension types configured. Create your first dimension type to start tagging journal entries."
```

- [ ] **Step 3: Create DimensionTypeDialog component**

```typescript
// DimensionTypeDialog.tsx
// Shadcn Dialog with form:
//   - Code: TextInput (readonly on edit, required, uppercase regex validation)
//   - Name: TextInput (required)
//   - Description: Textarea (optional, max 500)
//   - Single Select: Switch (default: true)
//   - Allow Manual Entry: Switch (default: false)
//   - Sort Order: NumberInput (0-999)
//
// Mode: create (POST) or edit (PATCH)
// On success: close dialog, invalidate query cache
```

---

## Task 3: Build Dimension Values Page with Tree View

**Files:**
- Create: `apps/web/src/routes/_authenticated/finance/dimensions/$typeId/values.tsx`
- Create: `apps/web/src/features/finance/dimensions/DimensionValueTree.tsx`
- Create: `apps/web/src/features/finance/dimensions/DimensionValueDialog.tsx`

- [ ] **Step 1: Create the route page**

```typescript
// routes/_authenticated/finance/dimensions/$typeId/values.tsx
import { createFileRoute } from '@tanstack/react-router';
import { DimensionValueTree } from '@/features/finance/dimensions/DimensionValueTree';

export const Route = createFileRoute('/_authenticated/finance/dimensions/$typeId/values')({
  component: () => {
    const { typeId } = Route.useParams();
    return <DimensionValueTree typeId={typeId} />;
  },
});
```

- [ ] **Step 2: Create DimensionValueTree component**

This is the most complex component in this wave — a tree-table showing hierarchical values.

```typescript
// DimensionValueTree.tsx
// Layout:
//   Page header: breadcrumb "Finance > Dimensions > {Type Name}"
//   Toggle: "Tree View" / "Flat List" switch
//   Action bar: "New Value" primary button, search input
//
//   Tree View mode:
//     - Rows indented by depth level (4px * depth padding)
//     - Expand/collapse chevrons for nodes with children
//     - Columns: Code, Name, Parent, Active (badge)
//     - Build tree structure from flat data:
//       1. Fetch all values for typeId (useDimensionValues)
//       2. Group by parentId to build tree
//       3. Render recursively with indentation
//
//   Flat List mode:
//     - Standard table view (same columns) with search/filter
//     - Paginated via cursor
//
//   Row actions: Edit (opens dialog), Activate/Deactivate
//
// Performance note: for types with many values, use flat list by default
// and show a note "Switch to tree view to see hierarchy"
```

Implementation approach for tree rendering:
```typescript
interface TreeNode {
  value: DimensionValue;
  children: TreeNode[];
  depth: number;
  isExpanded: boolean;
}

function buildTree(values: DimensionValue[]): TreeNode[] {
  const map = new Map<string | null, DimensionValue[]>();
  for (const v of values) {
    const pid = v.parentId ?? null;
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid)!.push(v);
  }
  // Recursive build from root (parentId = null)
  function build(parentId: string | null, depth: number): TreeNode[] {
    return (map.get(parentId) ?? []).map((v) => ({
      value: v,
      children: build(v.id, depth + 1),
      depth,
      isExpanded: depth < 2, // auto-expand first 2 levels
    }));
  }
  return build(null, 0);
}
```

- [ ] **Step 3: Create DimensionValueDialog component**

```typescript
// DimensionValueDialog.tsx
// Form fields:
//   - Code: TextInput (readonly on edit, required, uppercase + dash regex)
//   - Name: TextInput (required, max 200)
//   - Parent: Dropdown/combobox populated with existing values of same type
//             (optional, for hierarchy)
//   - Metadata: JSON editor or key-value pairs (optional, advanced)
//
// Validation:
//   - Server returns error if parentId would create > 5 levels deep
//   - Show warning if parent is inactive
```

---

## Task 4: Build Dimension Requirements Page

**Files:**
- Create: `apps/web/src/routes/_authenticated/finance/dimensions/requirements.tsx`
- Create: `apps/web/src/features/finance/dimensions/DimensionRequirementList.tsx`
- Create: `apps/web/src/features/finance/dimensions/DimensionRequirementDialog.tsx`

- [ ] **Step 1: Create the route and list component**

Template: T2 (List Page)

```typescript
// DimensionRequirementList.tsx
// Page header: "Dimension Requirements" with breadcrumb: Finance > Dimensions > Requirements
// Action bar: "New Requirement" primary button
// Table columns:
//   - Dimension Type (name, from joined dimensionType)
//   - Account Range (formatted as "From - To")
//   - Required (Badge: Yes/No)
//   - Active (Badge)
// Row actions: Edit (dialog), Delete (confirm dialog)
//
// Data: useDimensionRequirements()
```

- [ ] **Step 2: Create DimensionRequirementDialog**

```typescript
// DimensionRequirementDialog.tsx
// Form fields:
//   - Dimension Type: Dropdown (populated from useDimensionTypes, active only)
//   - Account Code From: Combobox with account search (GET /finance/accounts/search)
//   - Account Code To: Combobox with account search
//   - Required: Switch (default: true)
//
// Validation:
//   - accountCodeFrom <= accountCodeTo (lexicographic, show inline error)
//   - Both accounts must exist (validated by autocomplete selection)
```

---

## Task 5: Build Dimension Defaults Page

**Files:**
- Create: `apps/web/src/routes/_authenticated/finance/dimensions/defaults.tsx`
- Create: `apps/web/src/features/finance/dimensions/DimensionDefaultList.tsx`
- Create: `apps/web/src/features/finance/dimensions/DimensionDefaultDialog.tsx`

- [ ] **Step 1: Create the route and list component**

Template: T2 (List Page with filters)

```typescript
// DimensionDefaultList.tsx
// Page header: "Dimension Defaults" with breadcrumb: Finance > Dimensions > Defaults
// Filter bar:
//   - Entity Type: Dropdown (ACCOUNT, CUSTOMER, SUPPLIER, ITEM, COMPANY)
//   - Dimension Type: Dropdown (from useDimensionTypes)
// Action bar: "New Default" primary button
// Table columns:
//   - Dimension Type (name)
//   - Dimension Value (code + name)
//   - Entity Type (badge)
//   - Entity (name/code — lookup from entity type + entityId)
// Row actions: Delete (confirm dialog, no edit — delete and recreate)
//
// Data: useDimensionDefaults({ entityType, dimensionTypeId })
// Note: when Entity Type is COMPANY and entityId is null, show "Company-wide default"
```

- [ ] **Step 2: Create DimensionDefaultDialog**

```typescript
// DimensionDefaultDialog.tsx
// Form fields:
//   - Dimension Type: Dropdown (required)
//   - Dimension Value: Combobox (filtered by selected type, required)
//   - Entity Type: Dropdown (required)
//   - Entity: Combobox (shown when entityType != COMPANY)
//     - For ACCOUNT: search chart of accounts
//     - For CUSTOMER/SUPPLIER: search contacts (future, placeholder)
//     - For ITEM: search items (future, placeholder)
//     - For COMPANY: hidden (entityId is null)
```

---

## Task 6: Create Simulation API Hooks

**Files:**
- Create: `apps/web/src/features/finance/simulations/api.ts`

- [ ] **Step 1: Define TanStack Query hooks for simulation endpoints**

```typescript
// api.ts
export const simulationKeys = {
  all: ['finance', 'simulations'] as const,
  list: (params?: Record<string, unknown>) => [...simulationKeys.all, 'list', params] as const,
  detail: (id: string) => [...simulationKeys.all, 'detail', id] as const,
};

export function useSimulations(params?: { status?: string; periodId?: string }) { ... }
export function useSimulation(id: string) { ... }
export function useCreateSimulation() { ... }
export function useUpdateSimulation() { ... }
export function useDeleteSimulation() { ... }
export function useConvertSimulation() {
  // POST /finance/simulations/:id/convert
  // On success: invalidate simulations + journals queries
}
export function useInvalidateSimulation() {
  // POST /finance/simulations/:id/invalidate
}
```

---

## Task 7: Build Simulations List Page

**Files:**
- Create: `apps/web/src/routes/_authenticated/finance/simulations/index.tsx`
- Create: `apps/web/src/features/finance/simulations/SimulationList.tsx`

- [ ] **Step 1: Create the route and list component**

Template: T2 (List Page)

```typescript
// SimulationList.tsx
// Page header: "Simulations" with breadcrumb: Finance > Simulations
// Action bar: "New Simulation" primary button
// Filter bar: Status dropdown (ACTIVE / TRANSFERRED / INVALID / All)
// Table columns:
//   - Entry Number (link to detail)
//   - Date (formatted)
//   - Description
//   - Reference
//   - Status (colour-coded badge):
//     ACTIVE: purple, TRANSFERRED: green, INVALID: grey
//   - Total Debit (currency formatted)
//   - Total Credit (currency formatted)
// Row actions (conditional on status):
//   - ACTIVE: Convert to Journal, Invalidate, Edit, Delete
//   - TRANSFERRED: View Journal (link to /finance/journals/{transferredToId})
//   - INVALID: Delete
//
// Row click: navigate to /finance/simulations/{id}
// Empty state: "No simulations found. Create a simulation to model what-if scenarios."
```

---

## Task 8: Build Simulation Form Page

**Files:**
- Create: `apps/web/src/routes/_authenticated/finance/simulations/new.tsx`
- Create: `apps/web/src/routes/_authenticated/finance/simulations/$id.tsx`
- Create: `apps/web/src/features/finance/simulations/SimulationForm.tsx`

- [ ] **Step 1: Create route files**

```typescript
// new.tsx
export const Route = createFileRoute('/_authenticated/finance/simulations/new')({
  component: () => <SimulationForm />,
});

// $id.tsx
export const Route = createFileRoute('/_authenticated/finance/simulations/$id')({
  component: () => {
    const { id } = Route.useParams();
    return <SimulationForm simulationId={id} />;
  },
});
```

- [ ] **Step 2: Create SimulationForm component — mirrors Journal Entry form**

```typescript
// SimulationForm.tsx
// This MUST mirror the existing journal entry form layout (apps/web/src/routes/_authenticated/finance/journals/new.tsx)
// Read that file first to match the exact pattern.
//
// Header section:
//   - Transaction Date: DatePicker
//   - Description: TextInput (required)
//   - Reference: TextInput (optional)
//   - Period: Dropdown (from financial periods, auto-selected from date)
//
// Lines table (editable):
//   - # (line number, auto)
//   - Account Code: Combobox with account search
//   - Description: TextInput
//   - Debit: CurrencyInput
//   - Credit: CurrencyInput
//   - VAT Code: Dropdown (optional)
//   - Dimensions: Multi-select per active dimension type
//   - Row action: Remove line
//   - "Add Line" button at bottom
//
// Running totals bar (sticky bottom):
//   - Total Debit | Total Credit | Difference
//   - Difference highlighted red if non-zero, green if zero
//
// Action bar:
//   - New: "Save" (POST)
//   - Existing ACTIVE: "Save" (PATCH), "Convert to Journal" (POST convert),
//     "Invalidate" (POST invalidate), "Delete"
//   - Existing TRANSFERRED: read-only, "View Journal" link
//   - Existing INVALID: read-only, "Delete"
//
// "Convert to Journal" shows confirmation dialog:
//   "This will create a DRAFT journal entry with the same lines and mark this
//    simulation as TRANSFERRED. Continue?"
//
// On convert success: navigate to /finance/journals/{newJournalId}
```

---

## Task 9: Enhance Budget Form with Version Selector and Budget Key

**Files:**
- Create: `apps/web/src/features/finance/budgets/BudgetVersionSelector.tsx`
- Create: `apps/web/src/features/finance/budgets/BudgetKeyApplyPopover.tsx`
- Create: `apps/web/src/features/finance/budgets/DimensionSplitModal.tsx`
- Modify: `apps/web/src/routes/_authenticated/finance/budgets/$id.tsx`

- [ ] **Step 1: Create BudgetVersionSelector component**

```typescript
// BudgetVersionSelector.tsx
// Dropdown populated from GET /finance/budget-versions?fiscalYear={selectedYear}
// Shows: "Version {number}: {name}"
// On change: sets the budgetVersionId on the budget form
// Only shown when creating a new budget or editing one without a version
```

- [ ] **Step 2: Create BudgetKeyApplyPopover component**

```typescript
// BudgetKeyApplyPopover.tsx
// Trigger: small "Key" icon button on each budget line row
// Popover content:
//   - Budget Key dropdown (from GET /finance/budget-keys, active only)
//   - Annual Amount: CurrencyInput
//   - Preview: 12 readonly fields showing calculated distribution
//   - "Apply" button
//
// On Apply:
//   1. Call POST /finance/budget-keys/{keyId}/apply with { budgetLineId, annualAmount }
//   2. Response returns { period1-12 } calculated values
//   3. Fill the budget line's period columns with the returned values
//   4. Close popover
```

- [ ] **Step 3: Create DimensionSplitModal component**

```typescript
// DimensionSplitModal.tsx
// Trigger: "Split by Dimension" button on each budget line row (only visible when dimensions enabled)
// Modal content:
//   - Dimension Type selector dropdown
//   - Once type selected: table with rows = active dimension values for that type
//   - Columns: Dimension Value Name | P1 | P2 | ... | P12 | Total
//   - Last row: "Totals" showing sum per period
//   - Parent line values shown above for reference
//   - Validation: each period column total must match parent line period amount
//     (show red highlight on mismatched columns)
//
// On Save: PUT /finance/budgets/{budgetId}/lines/{lineId}/dimension-splits
// On Clear: DELETE /finance/budgets/{budgetId}/lines/{lineId}/dimension-splits/{dimensionTypeId}
```

- [ ] **Step 4: Integrate into budget form**

Modify the existing budget form (`budgets/$id.tsx`) to:
1. Add `BudgetVersionSelector` in the header section (next to fiscal year)
2. Add `BudgetKeyApplyPopover` as a per-line action column
3. Add `DimensionSplitModal` as a per-line "Split" action button
4. Pass the `budgetVersionId` when creating/updating budgets

---

## Task 10: Run Route Codegen and Verify

- [ ] **Step 1: Regenerate route tree**

```bash
cd apps/web && pnpm exec tsr generate
```

This updates `apps/web/src/routeTree.gen.ts` with all new route entries.

- [ ] **Step 2: Verify all new routes are registered**

Check that `routeTree.gen.ts` includes:
- `/_authenticated/finance/dimensions/`
- `/_authenticated/finance/dimensions/$typeId/values`
- `/_authenticated/finance/dimensions/requirements`
- `/_authenticated/finance/dimensions/defaults`
- `/_authenticated/finance/simulations/`
- `/_authenticated/finance/simulations/new`
- `/_authenticated/finance/simulations/$id`

---

## Verification

- [ ] Run: `cd apps/web && pnpm exec tsc --noEmit` — no type errors
- [ ] Run: `cd apps/web && pnpm dev` — starts without errors on port 5110
- [ ] Manual: Navigate to `/finance/dimensions` — types list loads
- [ ] Manual: Click "New Type", fill form, save — type appears in list
- [ ] Manual: Click a type row — navigates to values page with tree view
- [ ] Manual: Navigate to `/finance/simulations` — list loads
- [ ] Manual: Click "New Simulation" — form matches journal form layout
- [ ] Manual: Create simulation with 2 balanced lines, save — appears in list as ACTIVE
- [ ] Manual: Click "Convert to Journal" — navigates to new draft journal
- [ ] Manual: Open budget form — version selector and budget key button visible
- [ ] Visual: Compare all pages against Concept D prototype — purple theme, card radius, typography
