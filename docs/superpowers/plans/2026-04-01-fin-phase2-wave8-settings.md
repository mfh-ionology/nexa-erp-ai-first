# Finance Phase 2 Wave 8: Settings Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 new settings tabs (Dimensions, Number Series, Approval Rules, Rounding) to the Finance Settings page, integrate Budget Version and Budget Key management into the settings UI, and update the backend settings schema and service to support the new tabs.

**Architecture:** This wave spans API (settings schema + service update) and Frontend (4 new settings tab forms + 2 budget management sections). The API work extends the existing `settings.schema.ts` / `settings.service.ts` pattern. The frontend work adds new tab components to the existing `/finance/settings` page.

**Tech Stack:** Fastify 5, Zod, React 19, TanStack Router, Tailwind 4, Shadcn UI

**Depends on:** Wave 1 (DB), Wave 4 (Budget Version + Budget Key APIs must exist)

**Blocked by this plan:** Nothing (this wave is a leaf node)

---

## File Structure

### Modified Files — API
```
apps/api/src/modules/finance/settings.schema.ts          — Add 4 new tab schemas + update combined schema
apps/api/src/modules/finance/settings.service.ts          — Add defaults for new tabs, update TAB_NAMES
apps/api/src/modules/finance/settings.routes.ts           — No changes needed (generic tab handling)
apps/api/src/modules/finance/settings.routes.test.ts      — Add tests for new tabs
```

### Modified Files — Frontend
```
apps/web/src/routes/_authenticated/finance/settings.tsx   — Add new tab entries to sidebar + lazy-load new panels
```

### New Files — Frontend
```
apps/web/src/features/finance/settings/DimensionsTab.tsx       — Dimensions settings form
apps/web/src/features/finance/settings/ApprovalsTab.tsx        — Approval rules settings form
apps/web/src/features/finance/settings/NumberSeriesTab.tsx     — Number series configuration form
apps/web/src/features/finance/settings/RoundingTab.tsx         — Rounding settings form
apps/web/src/features/finance/settings/BudgetVersionsTab.tsx   — Budget versions list + create/rename UI
apps/web/src/features/finance/settings/BudgetKeysTab.tsx       — Budget keys list + create/edit UI
```

### Reference Files (read-only)
```
apps/api/src/modules/finance/settings.schema.ts          — Existing 8-tab schema pattern
apps/api/src/modules/finance/settings.service.ts          — Existing defaults + save/load logic
apps/web/src/routes/_authenticated/finance/settings.tsx   — Existing settings page layout
docs/superpowers/specs/2026-04-01-fin-phase2-design.md   — Design spec sections 5 + 4.7
```

### Protected Files (DO NOT MODIFY)
```
packages/db/src/client.ts
packages/db/src/index.ts
```

---

## Task 1: Extend Settings Schema with 4 New Tabs

**Files:**
- Modify: `apps/api/src/modules/finance/settings.schema.ts`

- [ ] **Step 1: Read the current settings.schema.ts to understand the pattern**

The existing file defines 8 individual tab schemas and combines them into `financeSettingsSchema`. We add 4 new tab schemas between the existing ones.

- [ ] **Step 2: Add Dimensions settings schema**

After `tagsSettingsSchema`, add:

```typescript
// ---------------------------------------------------------------------------
// Dimensions Settings Tab
// ---------------------------------------------------------------------------

export const dimensionsSettingsSchema = z.object({
  enableDimensions: z.boolean().default(false),
  requireDimensionsOnManualJournals: z.boolean().default(false),
  defaultDimensionBehavior: z.enum(['NONE', 'SUGGEST', 'REQUIRE']).default('NONE'),
  maxDimensionTypes: z.number().int().min(1).max(20).default(10),
});
```

- [ ] **Step 3: Add Approvals settings schema**

After `dataEntrySettingsSchema`, add:

```typescript
// ---------------------------------------------------------------------------
// Approvals Settings Tab
// ---------------------------------------------------------------------------

export const approvalsSettingsSchema = z.object({
  journalApprovalEnabled: z.boolean().default(false),
  journalApprovalThreshold: z.number().min(0).default(10000),
  budgetApprovalRequired: z.boolean().default(true),
  yearEndApprovalRequired: z.boolean().default(true),
});
```

- [ ] **Step 4: Add Number Series settings schema**

After `multiCurrencySettingsSchema`, add:

```typescript
// ---------------------------------------------------------------------------
// Number Series Settings Tab
// ---------------------------------------------------------------------------

export const numberSeriesSettingsSchema = z.object({
  journalPrefix: z.string().max(10).default('JNL'),
  journalPadding: z.number().int().min(4).max(10).default(5),
  simulationPrefix: z.string().max(10).default('SIM'),
  simulationPadding: z.number().int().min(4).max(10).default(5),
  budgetPrefix: z.string().max(10).default('BDG'),
  budgetPadding: z.number().int().min(4).max(10).default(5),
});
```

- [ ] **Step 5: Add Rounding settings schema**

After `numberSeriesSettingsSchema`, add:

```typescript
// ---------------------------------------------------------------------------
// Rounding Settings Tab
// ---------------------------------------------------------------------------

export const roundingSettingsSchema = z.object({
  currencyRoundingMethod: z.enum(['HALF_UP', 'HALF_EVEN', 'CEILING', 'FLOOR']).default('HALF_UP'),
  displayDecimals: z.number().int().min(0).max(4).default(2),
  internalDecimals: z.number().int().min(2).max(4).default(4),
});
```

- [ ] **Step 6: Update the combined financeSettingsSchema**

Replace the existing `financeSettingsSchema` to include the 4 new tabs:

```typescript
export const financeSettingsSchema = z.object({
  general: generalSettingsSchema,
  vat: vatSettingsSchema,
  subSystems: subSystemsSettingsSchema,
  tags: tagsSettingsSchema,
  dimensions: dimensionsSettingsSchema,           // NEW
  dataEntry: dataEntrySettingsSchema,
  approvals: approvalsSettingsSchema,              // NEW
  reconciliation: reconciliationSettingsSchema,
  multiCurrency: multiCurrencySettingsSchema,
  numberSeries: numberSeriesSettingsSchema,        // NEW
  rounding: roundingSettingsSchema,                // NEW
  reporting: reportingSettingsSchema,
});
```

- [ ] **Step 7: Update the updateFinanceSettingsSchema**

Add the 4 new partial optional entries:

```typescript
export const updateFinanceSettingsSchema = z.object({
  general: generalSettingsSchema.partial().optional(),
  vat: vatSettingsSchema.partial().optional(),
  subSystems: subSystemsSettingsSchema.partial().optional(),
  tags: tagsSettingsSchema.partial().optional(),
  dimensions: dimensionsSettingsSchema.partial().optional(),      // NEW
  dataEntry: dataEntrySettingsSchema.partial().optional(),
  approvals: approvalsSettingsSchema.partial().optional(),        // NEW
  reconciliation: reconciliationSettingsSchema.partial().optional(),
  multiCurrency: multiCurrencySettingsSchema.partial().optional(),
  numberSeries: numberSeriesSettingsSchema.partial().optional(),  // NEW
  rounding: roundingSettingsSchema.partial().optional(),          // NEW
  reporting: reportingSettingsSchema.partial().optional(),
});
```

---

## Task 2: Update Settings Service Defaults

**Files:**
- Modify: `apps/api/src/modules/finance/settings.service.ts`

- [ ] **Step 1: Read the current service to find TAB_NAMES and FINANCE_DEFAULTS**

- [ ] **Step 2: Add new tab names to TAB_NAMES array**

Find the `TAB_NAMES` array and add 4 entries in the correct positions:

```typescript
export const TAB_NAMES = [
  'general',
  'vat',
  'subSystems',
  'tags',
  'dimensions',       // NEW — between tags and dataEntry
  'dataEntry',
  'approvals',        // NEW — after dataEntry
  'reconciliation',
  'multiCurrency',
  'numberSeries',     // NEW — after multiCurrency
  'rounding',         // NEW — after numberSeries
  'reporting',
] as const;
```

- [ ] **Step 3: Add default values for new tabs in FINANCE_DEFAULTS**

Find the `FINANCE_DEFAULTS` object and add:

```typescript
  dimensions: {
    enableDimensions: false,
    requireDimensionsOnManualJournals: false,
    defaultDimensionBehavior: 'NONE',
    maxDimensionTypes: 10,
  },
  approvals: {
    journalApprovalEnabled: false,
    journalApprovalThreshold: 10000,
    budgetApprovalRequired: true,
    yearEndApprovalRequired: true,
  },
  numberSeries: {
    journalPrefix: 'JNL',
    journalPadding: 5,
    simulationPrefix: 'SIM',
    simulationPadding: 5,
    budgetPrefix: 'BDG',
    budgetPadding: 5,
  },
  rounding: {
    currencyRoundingMethod: 'HALF_UP',
    displayDecimals: 2,
    internalDecimals: 4,
  },
```

---

## Task 3: Update Settings Tests

**Files:**
- Modify: `apps/api/src/modules/finance/settings.routes.test.ts`

- [ ] **Step 1: Add test for saving dimensions settings**

```typescript
describe('PUT /finance/settings — dimensions tab', () => {
  it('saves and loads dimension settings', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/finance/settings',
      headers: authHeaders,
      payload: {
        dimensions: {
          enableDimensions: true,
          requireDimensionsOnManualJournals: true,
          defaultDimensionBehavior: 'SUGGEST',
          maxDimensionTypes: 5,
        },
      },
    });
    expect(res.statusCode).toBe(200);

    const getRes = await app.inject({
      method: 'GET',
      url: '/finance/settings',
      headers: authHeaders,
    });
    const data = getRes.json().data;
    expect(data.dimensions.enableDimensions).toBe(true);
    expect(data.dimensions.maxDimensionTypes).toBe(5);
  });
});
```

- [ ] **Step 2: Add tests for approvals, numberSeries, and rounding tabs**

Follow the same pattern: PUT partial settings, GET to verify persistence. Test both custom values and reset-to-defaults behavior.

- [ ] **Step 3: Test that defaults are returned for new companies**

When no settings have been saved for a new company, GET should return the default values for all 12 tabs including the 4 new ones.

---

## Task 4: Create Dimensions Settings Tab Component

**Files:**
- Create: `apps/web/src/features/finance/settings/DimensionsTab.tsx`

- [ ] **Step 1: Create the form component**

```typescript
// DimensionsTab.tsx
// Form fields:
// - enableDimensions: Switch
// - requireDimensionsOnManualJournals: Switch (disabled when enableDimensions is false)
// - defaultDimensionBehavior: Select (NONE | SUGGEST | REQUIRE)
// - maxDimensionTypes: NumberInput (1-20)
//
// Pattern: match existing settings tab forms with Save + Reset buttons
// Use react-hook-form with zod resolver
// On Save: PATCH /finance/settings with { dimensions: { ...values } }
// On Reset: reload defaults from GET /finance/settings
```

Key UI elements:
- Section header: "Dimension Configuration"
- Help text under `enableDimensions`: "When enabled, dimension types can be created and assigned to journal entries"
- Help text under `defaultDimensionBehavior`: "Controls whether dimensions are suggested or required when entering manual journals"
- Conditional: when `enableDimensions` is false, other fields are greyed out with a notice

---

## Task 5: Create Approvals Settings Tab Component

**Files:**
- Create: `apps/web/src/features/finance/settings/ApprovalsTab.tsx`

- [ ] **Step 1: Create the form component**

```typescript
// ApprovalsTab.tsx
// Form fields:
// - journalApprovalEnabled: Switch
// - journalApprovalThreshold: NumberInput (currency, shown when journalApprovalEnabled is true)
// - budgetApprovalRequired: Switch
// - yearEndApprovalRequired: Switch
//
// Help text under threshold: "Journals with total debit exceeding this amount require approval before posting"
// Note banner: "Approval workflow integration is coming in a future release. These settings prepare the configuration."
```

---

## Task 6: Create Number Series Settings Tab Component

**Files:**
- Create: `apps/web/src/features/finance/settings/NumberSeriesTab.tsx`

- [ ] **Step 1: Create the form component**

```typescript
// NumberSeriesTab.tsx
// 3 grouped sections, each with prefix + padding:
//
// Section 1: "Journal Entry Numbers"
//   - journalPrefix: TextInput (max 10 chars, uppercase)
//   - journalPadding: NumberInput (4-10)
//   - Preview: "JNL-00001" (computed from prefix + padding)
//
// Section 2: "Simulation Numbers"
//   - simulationPrefix: TextInput
//   - simulationPadding: NumberInput
//   - Preview: "SIM-00001"
//
// Section 3: "Budget Numbers"
//   - budgetPrefix: TextInput
//   - budgetPadding: NumberInput
//   - Preview: "BDG-00001"
//
// Each preview dynamically updates as the user types.
// On Save: writes to settings AND updates the NumberSeries table entries via the API.
```

---

## Task 7: Create Rounding Settings Tab Component

**Files:**
- Create: `apps/web/src/features/finance/settings/RoundingTab.tsx`

- [ ] **Step 1: Create the form component**

```typescript
// RoundingTab.tsx
// Form fields:
// - currencyRoundingMethod: Select dropdown
//   Options: HALF_UP ("Round Half Up (standard)"), HALF_EVEN ("Banker's Rounding"),
//            CEILING ("Always Round Up"), FLOOR ("Always Round Down")
// - displayDecimals: NumberInput (0-4)
// - internalDecimals: NumberInput (2-4)
//
// Validation: internalDecimals >= displayDecimals (show inline warning if violated)
// Help text: "Display decimals affects how amounts appear in the UI.
//             Internal decimals controls calculation precision."
// Example preview: "1234.5678 displays as 1,234.57" (computed from displayDecimals)
```

---

## Task 8: Create Budget Versions Settings Section

**Files:**
- Create: `apps/web/src/features/finance/settings/BudgetVersionsTab.tsx`

- [ ] **Step 1: Create the Budget Versions management section**

This is a data management section (not a simple form), nested within Finance Settings as a "Budgets" tab.

```typescript
// BudgetVersionsTab.tsx
// Layout:
// - Year selector dropdown at top (populated from available fiscal years)
// - Table: Version Number | Version Name | Copied From | Created Date | Budget Count
// - Actions: "New Version" button (primary), per-row "Rename" and "Copy" actions
//
// "New Version" dialog:
//   - Version Name: TextInput
//   - Copy From: optional dropdown of existing versions for this year
//   - On submit: POST /finance/budget-versions
//
// "Copy Version" action:
//   - Opens dialog with version name pre-filled as "Copy of {original}"
//   - On submit: POST /finance/budget-versions with copyFromVersionId
//
// Data fetched from: GET /finance/budget-versions?fiscalYear={year}
```

---

## Task 9: Create Budget Keys Settings Section

**Files:**
- Create: `apps/web/src/features/finance/settings/BudgetKeysTab.tsx`

- [ ] **Step 1: Create the Budget Keys management section**

```typescript
// BudgetKeysTab.tsx
// Layout:
// - Table: Name | P1-P12 (compact columns) | Total (%) | Active (badge)
// - Actions: "New Key" button (primary), per-row "Edit" and "Delete"
//
// "New Key" / "Edit" dialog:
//   - Name: TextInput
//   - 12 percentage fields (pct1-pct12): NumberInput with step 0.01
//   - Running total displayed: must equal 100.0000
//   - Validation: sum of pct1-pct12 must equal 100
//   - Quick-fill buttons: "Even Split" (fills 8.3333 x 12, last absorbs rounding)
//
// Data fetched from: GET /finance/budget-keys
// Create: POST /finance/budget-keys
// Update: PATCH /finance/budget-keys/:id
// Delete: DELETE /finance/budget-keys/:id
```

---

## Task 10: Integrate New Tabs into Settings Page

**Files:**
- Modify: `apps/web/src/routes/_authenticated/finance/settings.tsx`

- [ ] **Step 1: Read the existing settings page structure**

Identify the tab list/sidebar and the content area rendering pattern.

- [ ] **Step 2: Add 6 new tab entries to the sidebar**

Insert in the correct order:
1. After "Tags" -> "Dimensions"
2. After "Data Entry" -> "Approvals"
3. After "Multi-Currency" -> "Number Series"
4. After "Number Series" -> "Rounding"
5. Add a "Budgets" group with "Budget Versions" and "Budget Keys" sections

Full tab order (12 tabs + 2 budget sections):
```
General | VAT | Sub-Systems | Tags | Dimensions | Data Entry | Approvals |
Reconciliation | Multi-Currency | Number Series | Rounding | Reporting |
--- Budget Management ---
Budget Versions | Budget Keys
```

- [ ] **Step 3: Import and render the new tab components**

```typescript
import { DimensionsTab } from '@/features/finance/settings/DimensionsTab';
import { ApprovalsTab } from '@/features/finance/settings/ApprovalsTab';
import { NumberSeriesTab } from '@/features/finance/settings/NumberSeriesTab';
import { RoundingTab } from '@/features/finance/settings/RoundingTab';
import { BudgetVersionsTab } from '@/features/finance/settings/BudgetVersionsTab';
import { BudgetKeysTab } from '@/features/finance/settings/BudgetKeysTab';
```

Wire each to the corresponding tab content area, matching the existing pattern for how tab panels are rendered.

---

## Verification

- [ ] Run: `cd apps/api && pnpm exec tsc --noEmit` — no type errors
- [ ] Run: `cd apps/api && pnpm test -- --grep settings` — all settings tests pass (including new tabs)
- [ ] Run: `cd apps/web && pnpm exec tsc --noEmit` — no type errors
- [ ] Manual: Navigate to `/finance/settings` — all 12+ tabs visible in sidebar
- [ ] Manual: Switch to Dimensions tab, toggle enableDimensions on, save, reload page — value persists
- [ ] Manual: Switch to Number Series tab, change journal prefix to "GL", save — preview shows "GL-00001"
- [ ] Manual: Switch to Budget Versions section, select a fiscal year — versions table loads
- [ ] Manual: Switch to Budget Keys section — table of budget keys loads with percentage columns
