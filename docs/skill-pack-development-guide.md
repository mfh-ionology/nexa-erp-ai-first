# Skill Pack Development Guide

> How to register an AI skill pack for a new Nexa ERP module.
> **Reference implementation:** E7 Views module (the first fully wired skill pack).

---

## Overview

Every Nexa module that integrates with the AI Co-Pilot must provide **4 artifacts**. These artifacts teach the AI what the module can do, how to route user intent, and what tools to call.

| # | Artifact | Location | Purpose |
|---|----------|----------|---------|
| 1 | Skill Pack Seed | `packages/db/prisma/seeds/skill-packs/<module>.ts` | Defines skills with trigger phrases, negative triggers, parameters, and examples |
| 2 | Module Knowledge Seed | `packages/db/prisma/seeds/module-knowledge/<module>.ts` | Injects domain knowledge (overview, entities, workflows) into AI context |
| 3 | Entity Trigger Seed | `packages/db/prisma/seeds/entity-triggers/<module>.ts` | Enables `@` mention autocomplete for module entities in chat |
| 4 | Tool Definitions | `packages/ai-tools/src/modules/<module>.ts` | Registers tool schemas (inputs, outputs) and types (query vs action) in the ToolRegistry |

All four artifacts are required. The AI routing chain (L0→L1→L2) uses skill pack data for intent classification and skill selection, module knowledge for contextual understanding, entity triggers for chat mentions, and tool definitions for execution.

---

## Artifact 1: Skill Pack Seed

**File:** `packages/db/prisma/seeds/skill-packs/<module>.ts`
**Template:** `packages/db/prisma/seeds/skill-packs/_template.ts`
**Type:** `SkillPackSeed`
**Function:** `seedSkillPack(prisma, pack)`
**Idempotency:** Upserts by unique skill `name`.

### Structure

```typescript
import type { PrismaClient } from '../../../generated/prisma/client';
import { seedSkillPack, type SkillPackSeed } from './_template.js';

export const MY_MODULE_SKILL_PACK: SkillPackSeed = {
  moduleKey: 'mymodule',      // Must match across all 4 artifacts
  packKey: 'mymodule-core',   // Identifies this pack within the module
  skills: [
    {
      // Identity
      name: 'my_skill',                    // Unique across all modules
      displayName: 'My Skill',
      description: 'What this skill does',
      category: 'navigation' | 'search' | 'filter' | 'create' | 'report',

      // AI instructions (injected into context at L2)
      skillContent: `Full instructions for the AI explaining how to use this skill...`,

      // Routing (used by L1 for skill selection)
      triggerPhrases: ['show me', 'open', 'go to'],
      negativeTriggers: ['delete', 'create an invoice'],
      priority: 100,                        // Higher = preferred when multiple match
      contextRequired: [],                  // e.g., ['screen:entity-list']

      // Orchestration
      orchestrationPattern: 'CONTEXT_AWARE', // See §Orchestration Patterns below

      // Tools (resolved from ToolRegistry at L2)
      requiredTools: ['my_tool'],

      // Schema
      inputSchema: {
        type: 'object',
        properties: {
          viewKey: { type: 'string', description: 'View key' },
        },
        required: ['viewKey'],
      },
      outputType: 'navigation' | 'data' | 'action',
      parameters: {
        viewKey: { type: 'string', required: true, description: 'View key' },
      },

      // Examples (used by the AI for few-shot learning)
      examples: [
        { input: 'show me all invoices', output: "my_tool(viewKey: 'INVOICES')" },
      ],
    },
    // ... more skills
  ],
};

export async function seedMyModuleSkillPack(prisma: PrismaClient): Promise<void> {
  await seedSkillPack(prisma, MY_MODULE_SKILL_PACK);
}
```

### Key Fields

| Field | Purpose | Notes |
|-------|---------|-------|
| `name` | Unique skill identifier | Used for upsert, must be globally unique |
| `skillContent` | Full AI instructions | Injected at L2 activation. Keep concise (~200 words) |
| `triggerPhrases` | Positive routing triggers | L1 matches these against user messages |
| `negativeTriggers` | Phrases that should NOT activate this skill | Prevents cross-skill confusion |
| `priority` | Selection precedence | Higher value wins when multiple skills match |
| `contextRequired` | Screen/state prerequisites | Skill only activates when prerequisites are met |
| `requiredTools` | Tool names resolved from ToolRegistry | Must match tool `name` values in Artifact 4 |
| `inputSchema` | JSON Schema for the tool input | Used by the AI to generate correct tool calls |
| `examples` | Input/output pairs | Few-shot examples improve AI accuracy |

---

## Artifact 2: Module Knowledge Seed

**File:** `packages/db/prisma/seeds/module-knowledge/<module>.ts`
**Template:** `packages/db/prisma/seeds/module-knowledge/_template.ts`
**Type:** `ModuleKnowledgeSeed`
**Function:** `seedModuleKnowledge(prisma, seed)`
**Idempotency:** Delete-and-recreate within a transaction.

### Structure

```typescript
import type { PrismaClient } from '../../../generated/prisma/client';
import { seedModuleKnowledge, type ModuleKnowledgeSeed } from './_template.js';

export const MY_MODULE_KNOWLEDGE: ModuleKnowledgeSeed = {
  moduleKey: 'mymodule',
  entries: [
    {
      knowledgeType: 'OVERVIEW',
      title: 'My Module Overview',
      content: `Concise description (~100 words) of what the module does...`,
      priority: 100,
    },
    {
      knowledgeType: 'ENTITIES',
      title: 'My Module Entities',
      content: `Structured descriptions of core entities with key fields...`,
      priority: 90,
    },
    {
      knowledgeType: 'WORKFLOWS',
      title: 'My Module Workflows',
      content: `Key user workflows: create, edit, approve, etc...`,
      priority: 80,
    },
  ],
};

export async function seedMyModuleKnowledge(prisma: PrismaClient): Promise<void> {
  await seedModuleKnowledge(prisma, MY_MODULE_KNOWLEDGE);
}
```

### Required Knowledge Types

Every module must provide at minimum these 3 entry types:

| Type | Priority | Content Guidelines |
|------|----------|-------------------|
| `OVERVIEW` | 100 | What the module does, ~100 words. Covers capabilities and scope. |
| `ENTITIES` | 90 | Core data model entities with key fields. Use bold entity names, describe relationships. |
| `WORKFLOWS` | 80 | Numbered list of key user workflows. Include operators, presets, and patterns relevant to the module. |

**Token budget:** Keep total knowledge content under ~500 tokens when injected. The AI context has a ~5000 token budget for the full skill chain including knowledge.

---

## Artifact 3: Entity Trigger Seed

**File:** `packages/db/prisma/seeds/entity-triggers/<module>.ts`
**Template:** `packages/db/prisma/seeds/entity-triggers/_template.ts`
**Type:** `EntityTriggerSeed`
**Function:** `seedEntityTriggers(prisma, seed)`
**Idempotency:** Upserts by `[moduleKey, triggerWord]` compound key.

### Structure

```typescript
import type { PrismaClient } from '../../../generated/prisma/client';
import { seedEntityTriggers, type EntityTriggerSeed } from './_template';

export const MY_MODULE_TRIGGERS: EntityTriggerSeed = {
  moduleKey: 'mymodule',
  triggers: [
    {
      triggerWord: 'invoice',           // Word that activates autocomplete
      entityType: 'Invoice',            // Prisma model name
      searchEndpoint: '/api/v1/finance/invoices', // API endpoint for search
      displayField: 'invoiceNumber',    // Primary display field in results
      subtitleField: 'customerName',    // Secondary display field (optional)
      icon: 'FileText',                 // Lucide icon name (optional)
      priority: 100,
    },
    // ... more triggers
  ],
};

export async function seedMyModuleTriggers(prisma: PrismaClient): Promise<void> {
  await seedEntityTriggers(prisma, MY_MODULE_TRIGGERS);
}
```

### Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `triggerWord` | Yes | The word or phrase (e.g., `'invoice'`, `'saved view'`) that activates autocomplete in the chat input |
| `entityType` | Yes | The Prisma model name for this entity |
| `searchEndpoint` | Yes | The API endpoint to call for searching entities |
| `displayField` | Yes | The entity field shown as the primary label in autocomplete results |
| `subtitleField` | No | The entity field shown as secondary text |
| `scopeBy` | No | Additional scope field (e.g., `'companyId'`) |
| `icon` | No | Lucide icon name for the autocomplete result |
| `priority` | Yes | Higher = shown first when multiple triggers match |

---

## Artifact 4: Tool Definitions

**File:** `packages/ai-tools/src/modules/<module>.ts`
**Type:** `ToolDefinition` from `@nexa/ai-tools`
**Registry:** `ToolRegistry`

### Structure

```typescript
import type { ToolDefinition } from '../types.js';
import type { ToolRegistry } from '../tool-registry.js';

export const MY_MODULE_TOOLS: ToolDefinition[] = [
  {
    name: 'my_query_tool',
    description: 'What this tool does',
    moduleKey: 'mymodule',
    type: 'query',     // Read-only — executed via QueryExecutor, no user confirmation
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Record ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'my_action_tool',
    description: 'What this tool does',
    moduleKey: 'mymodule',
    type: 'action',    // Write operation — requires user confirmation via ActionExecutor
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name for the record' },
      },
      required: ['name'],
    },
  },
];

export function registerMyModuleTools(registry: ToolRegistry): void {
  for (const definition of MY_MODULE_TOOLS) {
    if (definition.type === 'action') {
      registry.registerTool({ definition: definition as ToolDefinition & { type: 'action' } });
    } else {
      registry.registerTool({
        definition: definition as ToolDefinition & { type: 'query' },
        handler: async () => ({ data: null, rowCount: 0 }),
      });
    }
  }
}
```

### Tool Types

| Type | Executor | User Confirmation | Use For |
|------|----------|-------------------|---------|
| `query` | QueryExecutor | No | Read-only operations: listing, searching, fetching details |
| `action` | ActionExecutor | Yes | Write operations: creating, updating, deleting records |

### Query Handler Registration

Query tools also need server-side handlers in the API layer:

**File:** `apps/api/src/ai/tools/<module>-query-handlers.ts`

```typescript
import type { PrismaClient } from '@nexa/db';

export function registerMyModuleQueryHandlers(
  queryExecutor: QueryExecutor,
  db: PrismaClient,
): void {
  queryExecutor.registerHandler('my_query_tool', async ({ companyId, userId, input }) => {
    const result = await db.myEntity.findFirst({
      where: { companyId, id: input.id as string },
    });
    return { data: result, rowCount: result ? 1 : 0 };
  });
}
```

**Critical:** All query handlers MUST enforce `companyId` scoping on every Prisma query.

---

## Wiring Into the Application

### 1. Wire seeds into `packages/db/prisma/seed.ts`

```typescript
import { seedMyModuleSkillPack } from './seeds/skill-packs/mymodule.js';
import { seedMyModuleKnowledge } from './seeds/module-knowledge/mymodule.js';
import { seedMyModuleTriggers } from './seeds/entity-triggers/mymodule.js';

// Inside the seed() function:
try {
  await seedMyModuleSkillPack(prisma);
  await seedMyModuleKnowledge(prisma);
  await seedMyModuleTriggers(prisma);
} catch (error) {
  console.error('Failed to seed mymodule AI data:', error);
}
```

### 2. Register tools and handlers in `apps/api/src/ai/index.ts`

```typescript
import { registerMyModuleTools } from '@nexa/ai-tools';
import { registerMyModuleQueryHandlers } from './tools/mymodule-query-handlers.js';

// In the AI module plugin register hook:
registerMyModuleTools(toolRegistry);
registerMyModuleQueryHandlers(queryExecutor, fastify.prisma);
```

### 3. Export from `packages/ai-tools/src/index.ts`

```typescript
export { MY_MODULE_TOOLS, registerMyModuleTools } from './modules/mymodule.js';
```

---

## Trigger Phrase Engineering

Trigger phrases are the primary mechanism for L1 skill selection. Well-crafted triggers are critical for accurate intent routing.

### Writing Effective Positive Triggers

1. **Cover natural language variations** — Think about the different ways a UK English speaker might express the same intent:
   - "show me all invoices" / "open invoices" / "go to invoices" / "list all invoices"
   - "filter by this month" / "show only this month" / "just show this month's"

2. **Include entity-specific phrases** — Add triggers that combine the action with common entity names:
   - Generic: `'show me'`, `'open'`, `'go to'`
   - Specific: `'show invoices'`, `'show customers'`, `'open invoices'`

3. **Include contextual keywords** — Words that strongly signal intent even without a verb:
   - `'overdue'`, `'outstanding'` → likely a filter operation
   - `'saved views'`, `'my views'` → likely a list views operation

4. **Use lowercase** — Trigger matching is case-insensitive, but store triggers in lowercase for consistency.

### Writing Effective Negative Triggers

Negative triggers prevent cross-skill confusion. They are critical when skill trigger phrases overlap.

1. **Block CRUD confusion** — If your skill is `open_entity_list`, add negatives for create/edit/delete of that entity:
   - `'create an invoice'` prevents "show me" + "invoice" from matching when the real intent is "create"
   - `'delete'`, `'edit'`, `'update'`, `'modify'` block general CRUD verbs

2. **Block sibling skill triggers** — If `create_saved_view` has trigger `'create a view'`, the `search_views` skill should have negative trigger `'create a view'`.

3. **Be specific in negatives** — `'create an invoice'` is better than just `'create'` because `'create a view'` is a legitimate trigger for another skill.

### Priority Values

Priority determines which skill wins when multiple skills match a message:

| Priority | Use For |
|----------|---------|
| 100 | Primary navigation skills (most common user actions) |
| 90 | Search/lookup skills |
| 80 | Filter/refinement skills |
| 70 | List/enumerate skills |
| 60 | Create/write skills |

When two skills have the same priority, the one with more trigger phrase matches wins.

### Context Requirements

Use `contextRequired` to limit when a skill activates:

```typescript
contextRequired: ['screen:entity-list']  // Only when user is on an entity list page
contextRequired: ['screen:invoice-form']  // Only on the invoice form
contextRequired: []                       // Activates from any screen (default)
```

This prevents filter skills from activating when the user isn't on a list page.

---

## Orchestration Patterns

Every skill declares an `orchestrationPattern` that tells the AI how to execute the skill's tools.

### SEQUENTIAL

Execute tools one after another. The output of one tool feeds into the next.

```
User: "find the overdue view and open it"
→ search_views(query: 'overdue') → get result → open_entity_list(viewKey: result.viewKey)
```

**Use when:** The skill requires a lookup followed by an action on the result.

### PARALLEL

Execute multiple independent tool calls simultaneously.

```
User: "show me invoices and customers side by side"
→ open_entity_list(viewKey: 'INVOICES') + open_entity_list(viewKey: 'CUSTOMERS')
```

**Use when:** Multiple independent operations can run concurrently.

### ITERATIVE

Execute tools in a loop, refining results with each iteration.

```
User: "filter invoices by this month and amount over 10000"
→ apply_filter(conditions: [dateCondition]) → apply_filter(conditions: [amountCondition])
```

**Use when:** The skill builds up state through repeated applications (e.g., adding filters one by one).

### CONTEXT_AWARE

A single tool call that adapts based on current screen context and user state.

```
User: "show me all invoices"
→ Check current screen → open_entity_list(viewKey: 'INVOICES')
```

**Use when:** The skill's behaviour depends on where the user currently is in the application.

### DOMAIN_INTELLIGENCE

Complex multi-step reasoning involving domain rules, calculations, or business logic.

```
User: "what's my outstanding balance across all customers?"
→ Aggregate query with business rule application → formatted result
```

**Use when:** The skill requires domain-specific reasoning beyond simple CRUD operations.

---

## Reference Implementation: Views Module

The E7 Views module is the first complete skill pack implementation. Use it as a template:

| Artifact | File |
|----------|------|
| Skill Pack Seed | [`packages/db/prisma/seeds/skill-packs/views.ts`](../packages/db/prisma/seeds/skill-packs/views.ts) |
| Module Knowledge Seed | [`packages/db/prisma/seeds/module-knowledge/views.ts`](../packages/db/prisma/seeds/module-knowledge/views.ts) |
| Entity Trigger Seed | [`packages/db/prisma/seeds/entity-triggers/views.ts`](../packages/db/prisma/seeds/entity-triggers/views.ts) |
| Tool Definitions | [`packages/ai-tools/src/modules/views.ts`](../packages/ai-tools/src/modules/views.ts) |
| Query Handlers | [`apps/api/src/ai/tools/views-query-handlers.ts`](../apps/api/src/ai/tools/views-query-handlers.ts) |
| Seed Wiring | [`packages/db/prisma/seed.ts`](../packages/db/prisma/seed.ts) |
| API Registration | [`apps/api/src/ai/index.ts`](../apps/api/src/ai/index.ts) |

### Views Module Skills Summary

| Skill | Category | Pattern | Priority | Type |
|-------|----------|---------|----------|------|
| `open_entity_list` | navigation | CONTEXT_AWARE | 100 | query |
| `search_views` | search | SEQUENTIAL | 90 | query |
| `apply_filter` | filter | ITERATIVE | 80 | action |
| `list_saved_views` | search | SEQUENTIAL | 70 | query |
| `create_saved_view` | create | SEQUENTIAL | 60 | action |

---

## Testing Pattern

Every skill pack must include integration tests that validate the L0→L1→L2 routing chain deterministically (no LLM calls).

**Reference test:** [`apps/api/src/ai/views-skill-routing.integration.test.ts`](../apps/api/src/ai/views-skill-routing.integration.test.ts)

### Test Structure

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

// 1. Mock setup via vi.hoisted()
const { mockPrisma, mockEventBus, ... } = vi.hoisted(() => ({
  mockPrisma: { aiSkill: { findMany: vi.fn(), ... }, ... },
  mockEventBus: { emit: vi.fn() },
  ...
}));

// 2. Mock module imports
vi.mock('@nexa/db', () => ({ prisma: mockPrisma }));

// 3. Import the real modules under test
import { SkillRouter } from './skill-router.js';

describe('Views Skill Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Seed mock DB with skill pack data matching your seed file
    mockPrisma.aiSkill.findMany.mockResolvedValue([...]);
  });

  // 4. Test each routing scenario
  it('L0 classifies "show me all invoices" → module=views', async () => { ... });
  it('L1 selects open_entity_list for "show me all invoices"', async () => { ... });
  it('L2 activates open_entity_list with tools resolved', async () => { ... });

  // 5. Test negative triggers
  it('"create an invoice" does NOT activate views skills', async () => { ... });

  // 6. Test dynamic context assembly
  it('context assembly includes views skill chain', async () => { ... });

  // 7. Test events
  it('emits ai.skill.packLoaded and ai.skill.activated', async () => { ... });
});
```

### Required Test Scenarios

For each skill pack, test at minimum:

1. **L0 classification** — User message routes to the correct module
2. **L1 skill selection** — Each skill is selected for its expected trigger phrases
3. **L2 activation** — Tools are resolved, skill content and knowledge are injected
4. **Negative triggers** — Messages that should NOT activate any skill in the pack
5. **Dynamic context assembly** — Full context includes skill chain + module knowledge + tools
6. **Event emission** — `ai.skill.packLoaded` and `ai.skill.activated` events fire correctly

### Query Handler Unit Tests

**Reference test:** [`apps/api/src/ai/tools/views-query-handlers.test.ts`](../apps/api/src/ai/tools/views-query-handlers.test.ts)

For each query handler, test:

1. **Correct data returned** — Handler returns expected shape from mock DB
2. **CompanyId scoping** — Every Prisma call includes `where: { companyId }`
3. **Empty results** — Handler returns `{ data: [], rowCount: 0 }` gracefully
4. **Input filtering** — Optional parameters (e.g., `viewKey`) correctly filter results

---

## Checklist for New Module Skill Packs

Before marking a skill pack story as complete:

- [ ] Skill pack seed created with `SkillPackSeed` type and `seedSkillPack()` call
- [ ] Module knowledge seed created with `ModuleKnowledgeSeed` type and `seedModuleKnowledge()` call
- [ ] Entity trigger seed created with `EntityTriggerSeed` type and `seedEntityTriggers()` call
- [ ] Tool definitions created with `ToolDefinition` type and `registerTools()` function
- [ ] All 3 seeds wired into `packages/db/prisma/seed.ts`
- [ ] Tools registered in `apps/api/src/ai/index.ts`
- [ ] Tools exported from `packages/ai-tools/src/index.ts`
- [ ] Query handlers implemented with companyId scoping
- [ ] Integration tests cover L0→L1→L2 for every skill
- [ ] Negative trigger tests prevent cross-skill confusion
- [ ] Seeds are idempotent (run twice without errors or duplicates)
- [ ] `moduleKey` is consistent across all 4 artifacts
