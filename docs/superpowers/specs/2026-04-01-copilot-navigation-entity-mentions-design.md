# Copilot Navigation, Entity Mentions & Intent Types

**Date:** 2026-04-01
**Status:** Draft
**Author:** Mohammed + Claude

## Overview

Define three copilot intent types (Navigate, Reply, Action) and refactor the entity mention trigger system to use `//` instead of bare trigger words.

## 1. Three Copilot Intent Types

Every user prompt to the copilot resolves to one of three types:

### Type 1: Navigate

**When:** User asks to view, open, or run something that has a dedicated page.

**Examples:**
- "Run the P&L report for 2025"
- "Show me customer ABC's invoices"
- "Open today's journal entries"
- "Run the P&L report for 2025 for dimension //Sales Dept"

**Flow:**
1. User message sent to AI model with entity mentions
2. AI model calls a registered query tool (e.g., `finance_run_report`)
3. Tool validates params, resolves entity IDs, builds a frontend route with query params + `autoRun=true`
4. Orchestrator detects `_navigateTo` in tool result
5. WebSocket handler sends a `navigate` server message: `{ type: 'navigate', route: '/finance/reports/profit-and-loss?fiscalYear=2025&autoRun=true' }`
6. AI also generates a text response ("Opening P&L for 2025...") sent as normal `stream_chunk` messages
7. Frontend `useAiChat` hook receives the `navigate` message and calls `router.navigate()`
8. Report page detects `autoRun=true` in URL search params and auto-triggers the data fetch (bypasses the manual "Run Report" button)

### Type 2: Reply

**When:** User asks a question that can be answered with data in the chat.

**Examples:**
- "What is the expected cash to be paid by end of next week?"
- "What's the balance on account 1000?"
- "How many overdue invoices do we have?"

**Flow:**
1. User message sent to AI model
2. AI model calls a registered query tool (e.g., `finance_check_account_balance`)
3. Tool queries the database, returns structured data
4. Data passed back to AI model as tool result
5. AI model formulates a natural language answer
6. Answer streamed to the user in the chat

### Type 3: Action (already built)

**When:** User asks to create, update, approve, or otherwise mutate data.

**Examples:**
- "Create a journal entry for..."
- "Approve invoice INV-001"

**Flow:** Existing action framework — propose → confirm → execute.

## 2. Entity Mention Refactor: `//` Trigger

### Current State

The entity mention system uses **bare trigger words** (e.g., typing `customer pol` activates customer search). This conflicts with natural language — typing "I want to communicate with a customer about an invoice" would accidentally trigger autocomplete.

### New Design

**Trigger character: `//`**

The `//` prefix is an explicit, intentional signal that the user wants to reference an entity. Normal text is never intercepted.

**Context word determines entity type:**
- The word immediately before `//` is checked against the entity trigger map
- `customer //POL` → search entity type `Customer` for "POL"
- `account //100` → search entity type `ChartOfAccount` for "100"
- `dimension //dep` → search entity type `DimensionValue` for "dep"
- `//POL` (no context word) → universal search across all entity types

**Detection algorithm:**
1. On every keystroke, scan backwards from cursor for `//`
2. If found, extract the search query after `//` (must be >= 2 chars to activate)
3. Look at the word immediately before `//` (if any)
4. Match the preceding word against the trigger map (case-insensitive)
5. If matched → scoped search for that entity type
6. If no match or no preceding word → universal search

**Autocomplete dropdown:**
- Appears below the input when `//` + 2 chars detected
- Shows filtered results grouped by entity type (for universal search)
- Keyboard navigation: Arrow Up/Down, Enter to select, Escape to dismiss
- Debounced API call: 200ms after last keystroke

**Entity selection and replacement:**
- User selects "Polish International" (id: 02882) from dropdown
- Input text `customer //POL` is replaced with `customer {02882 : Polish International}`
- The `{id : name}` format is a display token in the input
- Internally stored as a structured `EntityMention`: `{ id: '02882', type: 'Customer', name: 'Polish International' }`
- On send, mentions are included in the WebSocket message alongside the text

**Search API:**
- Existing endpoint: `GET /ai/entity-search?type={entityType}&q={query}`
- For universal search: `GET /ai/entity-search?q={query}` (no type filter)
- Returns: `Array<{ id, displayName, subtitle, entityType }>`

## 3. Navigate WebSocket Message

### New Server Message Type

Add `'navigate'` to `AiChatServerMessage`:

```typescript
interface AiChatServerMessage {
  type: 'text' | 'action_proposal' | 'record_created' | 'error'
       | 'stream_chunk' | 'stream_end'
       | 'navigate';  // NEW
  sessionId: string;
  messageId: string;

  // Present on 'navigate'
  route?: string;  // Frontend route with query params
}
```

### Frontend Handling

In `useAiChat` hook, when a `navigate` message is received:

```typescript
case 'navigate':
  if (msg.route) {
    router.navigate({ to: msg.route });
  }
  break;
```

### autoRun Query Param

Report pages (and any page supporting auto-execution) check for `autoRun=true` in URL search params:

```typescript
const searchParams = new URLSearchParams(window.location.search);
const autoRun = searchParams.get('autoRun') === 'true';

// In the report page's useEffect or initial render:
if (autoRun && hasValidParams) {
  runReport();  // Trigger the TanStack Query refetch
}
```

**Pages that need `autoRun` support:**
- P&L Report (`/finance/reports/profit-and-loss`)
- Balance Sheet (`/finance/reports/balance-sheet`)
- Trial Balance (`/finance/reports/trial-balance`)
- GL Detail (`/finance/reports/gl-detail`)
- General Ledger (`/finance/reports/general-ledger`)
- Budget Variance (`/finance/reports/budget-variance`)
- Departmental P&L (`/finance/reports/departmental-pnl`)
- Transaction Journal (`/finance/reports/transaction-journal`)

## 4. Query Tools for Navigation

Register new query tools that the AI model can call to build navigation routes:

### `finance_run_report`

```typescript
{
  name: 'finance_run_report',
  description: 'Open a financial report page with specified parameters. Returns a navigation route.',
  moduleKey: 'finance',
  type: 'query',
  inputSchema: {
    type: 'object',
    properties: {
      reportType: {
        type: 'string',
        enum: ['profit-and-loss', 'balance-sheet', 'trial-balance', 'gl-detail',
               'general-ledger', 'budget-variance', 'departmental-pnl', 'transaction-journal'],
        description: 'The type of financial report to run'
      },
      fiscalYear: { type: 'number', description: 'Fiscal year (e.g. 2025)' },
      periodFrom: { type: 'number', description: 'Start period (1-13), defaults to 1' },
      periodTo: { type: 'number', description: 'End period (1-13), defaults to 12' },
      dimensionTypeId: { type: 'string', description: 'Dimension type UUID (optional)' },
      dimensionValueId: { type: 'string', description: 'Dimension value UUID (optional)' },
      includeSimulations: { type: 'boolean', description: 'Include simulation entries' }
    },
    required: ['reportType', 'fiscalYear']
  }
}
```

**Handler returns:**
```typescript
{
  data: {
    _navigateTo: '/finance/reports/profit-and-loss?fiscalYear=2025&periodFrom=1&periodTo=12&autoRun=true',
    description: 'P&L Report for FY 2025'
  },
  rowCount: 1
}
```

The `_navigateTo` field is a convention: when the orchestrator sees it in a tool result, it emits a `navigate` WebSocket message.

### `finance_list_fiscal_years`

```typescript
{
  name: 'finance_list_fiscal_years',
  description: 'List available fiscal years for reports',
  moduleKey: 'finance',
  type: 'query',
  inputSchema: { type: 'object', properties: {} }
}
```

### `finance_list_dimensions`

```typescript
{
  name: 'finance_list_dimensions',
  description: 'List available dimension types and their values for report filtering',
  moduleKey: 'finance',
  type: 'query',
  inputSchema: {
    type: 'object',
    properties: {
      dimensionTypeId: { type: 'string', description: 'Filter values by dimension type UUID' }
    }
  }
}
```

## 5. Orchestrator Changes

The orchestrator needs to detect `_navigateTo` in tool results and emit a navigate chunk:

**In `processStream()` or `process()`, after tool execution:**
```
if (toolResult.data._navigateTo) {
  emit AiStreamChunk { type: 'navigate', route: toolResult.data._navigateTo }
}
```

The WebSocket handler maps this to the new `navigate` server message type.

## 6. Files to Create/Modify

### New Files
- None — all changes go into existing files

### Modified Files

**Backend:**
- `apps/api/src/ai/websocket.handler.ts` — add `navigate` message type handling
- `apps/api/src/ai/orchestrator.ts` — detect `_navigateTo` in tool results, emit navigate chunk
- `apps/api/src/ai/ai.types.ts` — add `navigate` to `AiStreamChunk` type
- `apps/api/src/modules/finance/finance-skills.ts` — add `finance_run_report`, `finance_list_fiscal_years`, `finance_list_dimensions` tools + query handlers

**Frontend:**
- `apps/web/src/hooks/use-ai-chat.ts` — handle `navigate` server message → call router
- `apps/web/src/features/ai/entity-mentions/use-mention-detection.ts` — refactor detection to use `//` trigger with context word
- `apps/web/src/features/ai/entity-mentions/entity-mention-input.tsx` — update replacement format to `{id : name}`
- `apps/web/src/features/finance/pages/profit-and-loss-page.tsx` — add `autoRun` support
- `apps/web/src/features/finance/pages/*.tsx` — add `autoRun` support to all report pages (7 more files)

## 7. Out of Scope

- Inline report rendering in chat (Type 2 could evolve into this later)
- Non-finance navigation (sales, purchasing, etc.) — same pattern, different tools, future work
- Chat history persistence of navigation events
- Undo/back navigation from copilot
