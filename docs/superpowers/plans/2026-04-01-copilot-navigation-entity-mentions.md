# Copilot Navigation & Entity Mention Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable the AI copilot to auto-navigate users to report pages via natural language prompts, and refactor entity mentions to use `//` as an explicit trigger character.

**Architecture:** New `navigate` WebSocket message type flows from query tool results through the orchestrator to the frontend router. Report pages gain `autoRun` support to auto-fetch data when navigated to by the copilot. Entity mention detection is refactored from bare trigger words to `//` prefix with context-word scoping.

**Tech Stack:** Fastify (WebSocket/Socket.io), TanStack Query, TanStack Router, Zustand, Zod

**Spec:** `docs/superpowers/specs/2026-04-01-copilot-navigation-entity-mentions-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/api/src/ai/ai.types.ts` | Modify | Add `navigate` to AiStreamChunk |
| `apps/api/src/ai/orchestrator.ts` | Modify | Detect `_navigateTo` in tool results, yield navigate chunk |
| `apps/api/src/ai/websocket.handler.ts` | Modify | Forward `navigate` chunks to client |
| `apps/api/src/modules/finance/finance-skills.ts` | Modify | Add report navigation + dimension listing tools |
| `apps/web/src/hooks/use-ai-chat.ts` | Modify | Handle `navigate` message, call router |
| `apps/web/src/features/ai/entity-mentions/use-mention-detection.ts` | Modify | Refactor to `//` trigger with context word |
| `apps/web/src/features/ai/entity-mentions/use-mention-detection.test.ts` | Modify | Update tests for `//` trigger |
| `apps/web/src/features/ai/entity-mentions/entity-mention-input.tsx` | Modify | Update replacement format to `{id : name}` |
| `apps/web/src/features/finance/pages/profit-and-loss-page.tsx` | Modify | Add `autoRun` support |
| `apps/web/src/features/finance/pages/balance-sheet-page.tsx` | Modify | Add `autoRun` support |
| `apps/web/src/features/finance/pages/trial-balance-page.tsx` | Modify | Add `autoRun` support |
| `apps/web/src/features/finance/pages/gl-detail-page.tsx` | Modify | Add `autoRun` support |
| `apps/web/src/features/finance/pages/general-ledger-page.tsx` | Modify | Add `autoRun` support |
| `apps/web/src/features/finance/pages/budget-variance-page.tsx` | Modify | Add `autoRun` support |
| `apps/web/src/features/finance/pages/DepartmentalPnlPage.tsx` | Modify | Add `autoRun` support |
| `apps/web/src/features/finance/pages/transaction-journal-page.tsx` | Modify | Add `autoRun` support |

---

### Task 1: Add `navigate` type to AiStreamChunk and AiChatServerMessage

**Files:**
- Modify: `apps/api/src/ai/ai.types.ts:155-165`
- Modify: `apps/api/src/ai/websocket.handler.ts:670-729`

- [ ] **Step 1: Add `navigate` to AiStreamChunk type union**

In `apps/api/src/ai/ai.types.ts`, find the `AiStreamChunk` interface (line ~155) and add `'navigate'` to the type union and a `route` field:

```typescript
export interface AiStreamChunk {
  type: 'content_delta' | 'tool_use_delta' | 'done' | 'error' | 'action_proposal' | 'navigate';
  content?: string;
  toolCall?: { id: string; name: string; input: Record<string, unknown> };
  usage?: { inputTokens: number; outputTokens: number; latencyMs: number };
  finishReason?: string;
  error?: string;
  action?: ActionProposal;
  guardrailDecision?: GuardrailDecision;
  requiresApproval?: boolean;
  route?: string; // present when type === 'navigate'
}
```

- [ ] **Step 2: Add `navigate` case to WebSocket forwardChunk**

In `apps/api/src/ai/websocket.handler.ts`, find the `forwardChunk` method's switch statement (line ~670) and add a new case before the closing of the switch:

```typescript
    case 'navigate': {
      const navigateMsg: AiChatServerMessage = {
        type: 'navigate',
        sessionId,
        messageId,
        route: chunk.route,
      };
      socket.emit('chat:response', navigateMsg);
      break;
    }
```

Also update the `AiChatServerMessage` interface to include `'navigate'` in its type union and add `route?: string`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project apps/api/tsconfig.json 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/ai/ai.types.ts apps/api/src/ai/websocket.handler.ts
git commit -m "feat(ai): add navigate type to AiStreamChunk and WebSocket messages"
```

---

### Task 2: Detect `_navigateTo` in orchestrator tool results

**Files:**
- Modify: `apps/api/src/ai/orchestrator.ts:685-713`

- [ ] **Step 1: Add navigation detection before action proposal creation**

In `apps/api/src/ai/orchestrator.ts`, find the block that processes `lastToolCall` after stream ends (line ~685). Add navigation detection BEFORE the action proposal logic:

```typescript
// After stream_end: check if tool result contains navigation intent
if (lastToolCall && lastToolCall.input?._navigateTo) {
  yield {
    type: 'navigate' as const,
    route: lastToolCall.input._navigateTo as string,
  };
}
```

However, `lastToolCall.input` is the INPUT to the tool, not the RESULT. The navigation route comes from the tool's RESULT. The orchestrator needs to store the last query tool result.

Find where query tool results are handled in the orchestrator (search for `queryExecutor.execute` or where tool results are accumulated). After the query executor returns a result, check for `_navigateTo`:

```typescript
// After query tool execution:
const toolResult = await this.queryExecutor.execute(toolName, { companyId, input: toolCall.input });

// Detect navigation intent in tool result
if (toolResult?.data?._navigateTo) {
  // Store for emission after stream completes
  pendingNavigation = toolResult.data._navigateTo as string;
}
```

Then after the stream ends, yield the navigate chunk:

```typescript
// After stream_end persistence, before action_proposal:
if (pendingNavigation) {
  yield {
    type: 'navigate' as const,
    route: pendingNavigation,
  };
}
```

**Note:** The exact insertion point depends on the orchestrator's query tool execution flow. Search for `queryExecutor` usage in the file to find where tool results are processed. The pattern is: intercept the result, check for `_navigateTo`, store it, and yield a navigate chunk after the text stream completes.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project apps/api/tsconfig.json 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/ai/orchestrator.ts
git commit -m "feat(ai): detect _navigateTo in query tool results and emit navigate chunk"
```

---

### Task 3: Add finance navigation and dimension query tools

**Files:**
- Modify: `apps/api/src/modules/finance/finance-skills.ts`

- [ ] **Step 1: Add `finance_run_report` tool definition**

In `apps/api/src/modules/finance/finance-skills.ts`, add to the `FINANCE_TOOLS` array (after the existing tool definitions, before the closing `]`):

```typescript
  {
    name: 'finance_run_report',
    description:
      'Open a financial report page with specified parameters. Use this when the user asks to run, view, or show a financial report such as P&L, Balance Sheet, Trial Balance, etc.',
    moduleKey: 'finance',
    type: 'query' as const,
    inputSchema: {
      type: 'object',
      properties: {
        reportType: {
          type: 'string',
          enum: [
            'profit-and-loss',
            'balance-sheet',
            'trial-balance',
            'gl-detail',
            'general-ledger',
            'budget-variance',
            'departmental-pnl',
            'transaction-journal',
          ],
          description: 'The type of financial report to run',
        },
        fiscalYear: { type: 'number', description: 'Fiscal year (e.g. 2025)' },
        periodFrom: { type: 'number', description: 'Start period (1-13), defaults to 1' },
        periodTo: { type: 'number', description: 'End period (1-13), defaults to 12' },
        dimensionTypeId: { type: 'string', description: 'Dimension type UUID for filtering' },
        dimensionValueId: { type: 'string', description: 'Dimension value UUID for filtering' },
        includeSimulations: { type: 'boolean', description: 'Include simulation entries' },
      },
      required: ['reportType', 'fiscalYear'],
    },
  },
```

- [ ] **Step 2: Add `finance_list_dimensions` tool definition**

Add to `FINANCE_TOOLS`:

```typescript
  {
    name: 'finance_list_dimensions',
    description:
      'List available dimension types and their values. Use when the user asks about dimensions, departments, cost centres, or wants to filter reports by dimension.',
    moduleKey: 'finance',
    type: 'query' as const,
    inputSchema: {
      type: 'object',
      properties: {
        dimensionTypeId: {
          type: 'string',
          description: 'If provided, returns values for this dimension type only',
        },
      },
    },
  },
```

- [ ] **Step 3: Add `finance_list_fiscal_years` tool definition**

Add to `FINANCE_TOOLS`:

```typescript
  {
    name: 'finance_list_fiscal_years',
    description: 'List available fiscal years configured in the system.',
    moduleKey: 'finance',
    type: 'query' as const,
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
```

- [ ] **Step 4: Create query handler for `finance_run_report`**

Add a new handler factory function:

```typescript
function createRunReportHandler(): QueryToolHandler {
  return async ({ input }) => {
    const reportType = input.reportType as string;
    const fiscalYear = input.fiscalYear as number;
    const periodFrom = (input.periodFrom as number) ?? 1;
    const periodTo = (input.periodTo as number) ?? 12;

    const params = new URLSearchParams();
    params.set('fiscalYear', String(fiscalYear));
    params.set('periodFrom', String(periodFrom));
    params.set('periodTo', String(periodTo));
    if (input.dimensionTypeId) params.set('dimensionTypeId', input.dimensionTypeId as string);
    if (input.dimensionValueId) params.set('dimensionValueId', input.dimensionValueId as string);
    if (input.includeSimulations) params.set('includeSimulations', 'true');
    params.set('autoRun', 'true');

    const route = `/finance/reports/${reportType}?${params.toString()}`;

    return {
      data: {
        _navigateTo: route,
        description: `${reportType.replace(/-/g, ' ')} report for FY ${fiscalYear} (periods ${periodFrom}-${periodTo})`,
      },
      rowCount: 1,
    };
  };
}
```

- [ ] **Step 5: Create query handler for `finance_list_dimensions`**

```typescript
function createListDimensionsHandler(db: PrismaClient): QueryToolHandler {
  return async ({ companyId, input }) => {
    const dimensionTypeId = input.dimensionTypeId as string | undefined;

    if (dimensionTypeId) {
      const values = await db.dimensionValue.findMany({
        where: { companyId, dimensionTypeId, isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
      });
      return { data: { values }, rowCount: values.length };
    }

    const types = await db.dimensionType.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        values: {
          where: { isActive: true },
          select: { id: true, code: true, name: true },
          orderBy: { code: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return { data: { dimensionTypes: types }, rowCount: types.length };
  };
}
```

- [ ] **Step 6: Create query handler for `finance_list_fiscal_years`**

```typescript
function createListFiscalYearsHandler(db: PrismaClient): QueryToolHandler {
  return async ({ companyId }) => {
    const years = await db.fiscalYear.findMany({
      where: { companyId },
      select: { id: true, year: true, isClosed: true },
      orderBy: { year: 'desc' },
    });
    return { data: { fiscalYears: years }, rowCount: years.length };
  };
}
```

- [ ] **Step 7: Register new query handlers in `registerFinanceQueryHandlers`**

Add to the existing `registerFinanceQueryHandlers` function:

```typescript
  queryExecutor.registerHandler('finance_run_report', createRunReportHandler());
  queryExecutor.registerHandler('finance_list_dimensions', createListDimensionsHandler(db));
  queryExecutor.registerHandler('finance_list_fiscal_years', createListFiscalYearsHandler(db));
```

- [ ] **Step 8: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project apps/api/tsconfig.json 2>&1 | head -20`
Expected: No new errors

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/finance/finance-skills.ts
git commit -m "feat(finance): add report navigation, dimension listing, and fiscal year tools"
```

---

### Task 4: Frontend — handle `navigate` WebSocket message

**Files:**
- Modify: `apps/web/src/hooks/use-ai-chat.ts:76-143`

- [ ] **Step 1: Add router import and `navigate` case**

In `apps/web/src/hooks/use-ai-chat.ts`, add the TanStack Router import at the top:

```typescript
import { useRouter } from '@tanstack/react-router';
```

Inside the hook function, get the router instance:

```typescript
const router = useRouter();
```

In the `handleServerMessage` switch statement (line ~76), add a new case:

```typescript
    case 'navigate': {
      if (data.route) {
        // Use setTimeout to ensure navigation happens after React render cycle
        setTimeout(() => {
          void router.navigate({ to: data.route! });
        }, 100);
      }
      break;
    }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -v "test\\.tsx" | head -20`
Expected: No new errors from our changes

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/use-ai-chat.ts
git commit -m "feat(web): handle navigate WebSocket message in copilot chat"
```

---

### Task 5: Add `autoRun` support to P&L report page

**Files:**
- Modify: `apps/web/src/features/finance/pages/profit-and-loss-page.tsx`

- [ ] **Step 1: Read URL search params and auto-run**

In `apps/web/src/features/finance/pages/profit-and-loss-page.tsx`, add at the top of the component function:

```typescript
import { useSearch } from '@tanstack/react-router';
```

Inside the component, after the existing state declarations, add:

```typescript
// Auto-run support: when navigated from copilot with autoRun=true
const searchParams = useSearch({ strict: false }) as Record<string, string | undefined>;
const autoRunTriggered = useRef(false);

useEffect(() => {
  if (searchParams.autoRun === 'true' && !autoRunTriggered.current) {
    autoRunTriggered.current = true;

    // Override params from URL search params
    const urlFiscalYear = searchParams.fiscalYear ? Number(searchParams.fiscalYear) : undefined;
    const urlPeriodFrom = searchParams.periodFrom ? Number(searchParams.periodFrom) : undefined;
    const urlPeriodTo = searchParams.periodTo ? Number(searchParams.periodTo) : undefined;

    if (urlFiscalYear) {
      const newParams: ReportParams = {
        fiscalYear: urlFiscalYear,
        periodFrom: urlPeriodFrom ?? 1,
        periodTo: urlPeriodTo ?? 12,
        ...(searchParams.dimensionTypeId ? { dimensionTypeId: searchParams.dimensionTypeId } : {}),
        ...(searchParams.dimensionValueId ? { dimensionValueId: searchParams.dimensionValueId } : {}),
        ...(searchParams.includeSimulations === 'true' ? { includeSimulations: true } : {}),
      };
      setParams(newParams);
      setSubmittedParams(newParams);
      // Trigger refetch after state update
      setTimeout(() => void refetchStandard(), 100);
    }
  }
}, [searchParams]);
```

Also add `useRef` and `useEffect` to the React import if not already present.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep "profit-and-loss" | head -10`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/finance/pages/profit-and-loss-page.tsx
git commit -m "feat(web): add autoRun support to P&L report page"
```

---

### Task 6: Add `autoRun` support to remaining report pages

**Files:**
- Modify: `apps/web/src/features/finance/pages/balance-sheet-page.tsx`
- Modify: `apps/web/src/features/finance/pages/trial-balance-page.tsx`
- Modify: `apps/web/src/features/finance/pages/gl-detail-page.tsx`
- Modify: `apps/web/src/features/finance/pages/general-ledger-page.tsx`
- Modify: `apps/web/src/features/finance/pages/budget-variance-page.tsx`
- Modify: `apps/web/src/features/finance/pages/DepartmentalPnlPage.tsx`
- Modify: `apps/web/src/features/finance/pages/transaction-journal-page.tsx`

- [ ] **Step 1: Apply the same `autoRun` pattern to each report page**

For each file, apply the same pattern as Task 5:
1. Import `useSearch` from `@tanstack/react-router` and `useRef`/`useEffect` from React
2. Read `searchParams` with `useSearch({ strict: false })`
3. Add `autoRunTriggered` ref
4. Add `useEffect` that reads URL params and calls the page's run/submit handler

Each page has a slightly different state structure (some use `setSubmittedParams`, some use `handleRunReport`, etc.). Read each page first to understand its trigger mechanism, then adapt the pattern.

The key pattern for each page:
```typescript
const searchParams = useSearch({ strict: false }) as Record<string, string | undefined>;
const autoRunTriggered = useRef(false);

useEffect(() => {
  if (searchParams.autoRun === 'true' && !autoRunTriggered.current) {
    autoRunTriggered.current = true;
    // Parse URL params → set form state → trigger report fetch
  }
}, [searchParams]);
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep -E "(balance-sheet|trial-balance|gl-detail|general-ledger|budget-variance|Departmental|transaction-journal)" | head -20`
Expected: No errors from our changes

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/finance/pages/
git commit -m "feat(web): add autoRun support to all finance report pages"
```

---

### Task 7: Refactor entity mention detection to use `//` trigger

**Files:**
- Modify: `apps/web/src/features/ai/entity-mentions/use-mention-detection.ts`
- Modify: `apps/web/src/features/ai/entity-mentions/use-mention-detection.test.ts`

- [ ] **Step 1: Write failing tests for new `//` trigger detection**

In the test file, add new test cases:

```typescript
describe('detectMention with // trigger', () => {
  const triggerMap = new Map<string, EntityTrigger>([
    ['customer', { id: '1', moduleKey: 'sales', triggerWord: 'customer', entityType: 'Customer', searchEndpoint: '/search', displayField: 'name', subtitleField: null, scopeBy: null, icon: null, priority: 10 }],
    ['account', { id: '2', moduleKey: 'finance', triggerWord: 'account', entityType: 'ChartOfAccount', searchEndpoint: '/search', displayField: 'name', subtitleField: null, scopeBy: null, icon: null, priority: 10 }],
    ['dimension', { id: '3', moduleKey: 'finance', triggerWord: 'dimension', entityType: 'DimensionValue', searchEndpoint: '/search', displayField: 'name', subtitleField: null, scopeBy: null, icon: null, priority: 10 }],
  ]);

  it('detects // with context word "customer"', () => {
    const result = detectMention(triggerMap, 'run report for customer //POL');
    expect(result).not.toBeNull();
    expect(result!.trigger.entityType).toBe('Customer');
    expect(result!.searchQuery).toBe('POL');
  });

  it('detects // with context word "account"', () => {
    const result = detectMention(triggerMap, 'show account //100');
    expect(result).not.toBeNull();
    expect(result!.trigger.entityType).toBe('ChartOfAccount');
    expect(result!.searchQuery).toBe('100');
  });

  it('returns null when no // present', () => {
    const result = detectMention(triggerMap, 'I want to communicate with a customer about an invoice');
    expect(result).toBeNull();
  });

  it('returns null when // has less than 2 chars after it', () => {
    const result = detectMention(triggerMap, 'customer //P');
    expect(result).toBeNull();
  });

  it('uses universal search when no context word matches', () => {
    const result = detectMention(triggerMap, 'find //POL');
    expect(result).not.toBeNull();
    expect(result!.trigger.entityType).toBe('_universal');
    expect(result!.searchQuery).toBe('POL');
  });

  it('handles // at start of input with context word', () => {
    const result = detectMention(triggerMap, 'customer //Polish');
    expect(result).not.toBeNull();
    expect(result!.searchQuery).toBe('Polish');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run apps/web/src/features/ai/entity-mentions/use-mention-detection.test.ts 2>&1 | tail -20`
Expected: FAIL — new tests fail

- [ ] **Step 3: Rewrite `detectMention` function for `//` trigger**

Replace the `detectMention` function in `use-mention-detection.ts`:

```typescript
/**
 * Detect entity mention using // trigger.
 *
 * Algorithm:
 * 1. Find the last occurrence of '//' in the input
 * 2. Extract the search query after '//' (must be >= 2 chars)
 * 3. Look at the word immediately before '//' for context (entity type)
 * 4. If context word matches a trigger → scoped search
 * 5. If no match → universal search with a synthetic trigger
 */
export function detectMention(
  triggerMap: Map<string, EntityTrigger>,
  inputText: string,
): MentionDetectionResult | null {
  if (!inputText || triggerMap.size === 0) {
    return null;
  }

  // Find last occurrence of '//'
  const triggerIndex = inputText.lastIndexOf('//');
  if (triggerIndex === -1) {
    return null;
  }

  // Extract search query after '//'
  const searchQuery = inputText.substring(triggerIndex + 2).trimEnd();
  if (searchQuery.length < 2) {
    return null;
  }

  // Look at the word immediately before '//'
  const beforeTrigger = inputText.substring(0, triggerIndex).trimEnd();
  const lastSpaceIndex = beforeTrigger.lastIndexOf(' ');
  const contextWord = lastSpaceIndex === -1
    ? beforeTrigger.toLowerCase()
    : beforeTrigger.substring(lastSpaceIndex + 1).toLowerCase();

  // Try to match context word against trigger map
  const trigger = contextWord ? triggerMap.get(contextWord) : undefined;

  if (trigger) {
    return {
      trigger,
      searchQuery,
      triggerStartIndex: lastSpaceIndex === -1 ? 0 : lastSpaceIndex + 1,
    };
  }

  // No matching context word — universal search
  const universalTrigger: EntityTrigger = {
    id: '_universal',
    moduleKey: '_all',
    triggerWord: '//',
    entityType: '_universal',
    searchEndpoint: '/ai/entity-search',
    displayField: 'name',
    subtitleField: null,
    scopeBy: null,
    icon: null,
    priority: 0,
  };

  return {
    trigger: universalTrigger,
    searchQuery,
    triggerStartIndex: triggerIndex,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run apps/web/src/features/ai/entity-mentions/use-mention-detection.test.ts 2>&1 | tail -20`
Expected: All new tests PASS (some old tests may need updating if they relied on the old trigger word detection)

- [ ] **Step 5: Fix any failing old tests**

Old tests that used bare trigger words (e.g., `detectMention(map, 'customer pol')`) will now fail because the function requires `//`. Update them to use the `//` syntax (e.g., `'customer //pol'`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/ai/entity-mentions/use-mention-detection.ts apps/web/src/features/ai/entity-mentions/use-mention-detection.test.ts
git commit -m "feat(web): refactor entity mention detection to use // trigger with context word"
```

---

### Task 8: Update entity mention input replacement format

**Files:**
- Modify: `apps/web/src/features/ai/entity-mentions/entity-mention-input.tsx:93-115`

- [ ] **Step 1: Update `handleSelectEntity` to use `{id : name}` format**

In `entity-mention-input.tsx`, modify the `handleSelectEntity` callback. Currently it removes the trigger text and adds the entity as a chip. Update it to insert `{id : name}` into the text AND add the chip:

```typescript
  const handleSelectEntity = useCallback(
    (result: EntitySearchResult) => {
      const mention: EntityMention = {
        id: result.id,
        type: result.entityType,
        name: result.displayName,
        subtitle: result.subtitle ?? undefined,
      };
      setMentions((prev) => (prev.some((m) => m.id === mention.id) ? prev : [...prev, mention]));

      // Replace // trigger + context word + search text with {id : name}
      if (detected) {
        const before = inputText.slice(0, detected.triggerStartIndex).trimEnd();
        const replacement = `{${result.id} : ${result.displayName}}`;
        setInputText(before ? `${before} ${replacement} ` : `${replacement} `);
      }

      setDismissed(true);
      setSelectedIndex(0);
      inputRef.current?.focus();
    },
    [detected, inputText],
  );
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep "entity-mention" | head -10`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/ai/entity-mentions/entity-mention-input.tsx
git commit -m "feat(web): update entity mention replacement to {id : name} format"
```

---

### Task 9: Update entity search to handle universal `//` search

**Files:**
- Modify: `apps/web/src/features/ai/entity-mentions/use-entity-search.ts`

- [ ] **Step 1: Read the existing `useEntitySearch` hook**

Read `apps/web/src/features/ai/entity-mentions/use-entity-search.ts` to understand the current API call pattern.

- [ ] **Step 2: Handle `_universal` entity type**

When `type` is `_universal`, make the search API call without a type filter so it searches across all entity types:

```typescript
// In the query function:
const searchType = type === '_universal' ? undefined : type;
const params = new URLSearchParams();
if (searchType) params.set('type', searchType);
params.set('q', q);
// ... make API call
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --project apps/web/tsconfig.json 2>&1 | grep "entity-search" | head -10`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/ai/entity-mentions/use-entity-search.ts
git commit -m "feat(web): support universal entity search when no context word matches"
```

---

### Task 10: Verify end-to-end flow

- [ ] **Step 1: Start dev servers**

Run: `pnpm dev` (starts API on 5100, Web on 5110)

- [ ] **Step 2: Verify the copilot drawer opens**

Navigate to `http://localhost:5110`, click the chat bubble icon in the header.

- [ ] **Step 3: Test entity mention with `//` trigger**

In the copilot input, type: `customer //` then continue typing a customer name. Verify:
- Autocomplete dropdown appears after 2+ characters
- Selecting an entity replaces the text with `{id : name}` format
- Entity chip appears in the input

- [ ] **Step 4: Test report navigation (requires AI backend running with a configured provider)**

Type: "Run the P&L report for 2025"
Verify:
- AI responds with text
- Browser auto-navigates to `/finance/reports/profit-and-loss?fiscalYear=2025&autoRun=true`
- Report auto-runs and displays data

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address integration issues from end-to-end testing"
```
