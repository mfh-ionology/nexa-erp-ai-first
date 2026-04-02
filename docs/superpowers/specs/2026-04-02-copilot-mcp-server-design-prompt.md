# Next Session: Build Nexa ERP MCP Server for AI Copilot

## Start here

Read this document first, then read the design spec and plan from the previous session:
- `docs/superpowers/specs/2026-04-01-copilot-navigation-entity-mentions-design.md`
- `docs/superpowers/plans/2026-04-01-copilot-navigation-entity-mentions.md`

## Context — What was built (2026-04-01 session)

The AI copilot now has a working end-to-end connection:
- **DeepSeek** configured as the default LLM provider (API key stored encrypted in DB)
- **Socket.io** chat connection works (frontend → server → DeepSeek → response streamed back)
- **Entity mentions** with `//` trigger (e.g., `customer //POL` shows autocomplete dropdown)
- **Navigation pipeline** infrastructure built (navigate WebSocket message type, autoRun on report pages)
- **Provider settings page** at AI Admin > Providers

## The Problem — What's NOT working

The AI responds to messages but **can't take actions**. When the user says "Run the P&L report for 2025", the AI gives a text answer describing what it would do — but doesn't actually navigate or call any tools. This is because:

1. The orchestrator's interactive streaming path (`processStream`) does NOT pass tool definitions to the LLM
2. The LLM has no knowledge of available tools/capabilities
3. Even if it did, the streaming path doesn't execute tool calls — it accumulates them for action proposals only

We registered query tools (`finance_run_report`, `finance_list_dimensions`, etc.) but the LLM never sees them.

## The Solution — MCP Server

Build an **MCP (Model Context Protocol) server** for Nexa ERP that exposes the ERP's capabilities to the AI:

### Why MCP

- **Standard protocol** for exposing tools, resources, and prompts to LLMs
- **Tool discovery** — the LLM knows what it can do because MCP advertises the tool list
- **Structured execution** — tool calls follow a standard request/response flow
- **Extensible** — new modules add their tools to the MCP server without modifying the orchestrator
- **Provider-agnostic** — works with DeepSeek, Claude, GPT, any LLM that supports tool calling

### Architecture

```
User message → Orchestrator → LLM (with MCP tool list)
                                    ↓
                              LLM calls tool
                                    ↓
                          MCP Server executes
                          (navigate / query / action)
                                    ↓
                          Result → back to LLM → response
                                    ↓
                          + navigate message to FE
```

### Three Intent Types (from design session)

| Type | Example | MCP Tool | Result |
|------|---------|----------|--------|
| **Navigate** | "Run P&L for 2025" | `navigate_to_page` | FE route + autoRun |
| **Navigate** | "Show customer invoices for Polish International" | `navigate_to_page` | FE route with params |
| **Query** | "What's the balance on account 1000?" | `query_data` | Data → LLM → chat reply |
| **Query** | "How many overdue invoices do we have?" | `query_data` | SQL → data → LLM → chat reply |
| **Action** | "Create a journal entry..." | `execute_action` | Existing action framework |

### MCP Server Scope (this session)

**Build:**
1. **`navigate_to_page` tool** — Takes a page key + params, returns FE route. Uses a page registry (code-based initially, DB later)
2. **`query_data` tool** — Takes a natural language data question, generates SQL, executes, returns structured data
3. **`list_pages` resource** — Exposes all navigable pages with their param schemas
4. **`list_entities` resource** — Exposes searchable entity types

**Page Registry** (code-based, covers existing pages):
```
finance/profit-and-loss → /finance/reports/profit-and-loss?fiscalYear=X&autoRun=true
finance/balance-sheet → /finance/reports/balance-sheet?fiscalYear=X&autoRun=true
finance/trial-balance → /finance/reports/trial-balance?fiscalYear=X&autoRun=true
finance/gl-detail → /finance/reports/gl-detail?accountId=X&autoRun=true
system/users → /system/users
system/access-groups → /system/access-groups
finance/dimensions → /finance/dimensions
finance/chart-of-accounts → /finance/chart-of-accounts
finance/journals → /finance/journals
```

**Wire into orchestrator:**
- Pass MCP tool definitions to the LLM in the `processStream` prompt
- Execute tool calls via MCP server when the LLM responds with tool_use
- Forward results back to the LLM for final response generation
- Detect `_navigateTo` in results and emit navigate WebSocket message

### Key Files to Understand

**Backend:**
- `apps/api/src/ai/orchestrator.ts` — AI orchestration, processStream method
- `apps/api/src/ai/websocket.handler.ts` — WebSocket chat handler, forwardChunk
- `apps/api/src/ai/ai.types.ts` — AiStreamChunk with navigate type
- `apps/api/src/modules/finance/finance-skills.ts` — Existing finance tool definitions

**Frontend (already working):**
- `apps/web/src/hooks/use-ai-chat.ts` — Socket.io client, handles navigate messages
- `apps/web/src/features/ai/entity-mentions/` — `//` trigger entity search

**AI Gateway:**
- `packages/ai-gateway/src/` — Provider adapters, credential resolution, model registry
- DeepSeek is the default model (supports tool calling via OpenAI-compatible API)

### Prerequisites

Before starting:
1. Ensure Redis is running: `brew services start redis`
2. Start Platform API: `pnpm --filter platform-api dev`
3. Start API: `pnpm --filter api dev`
4. Start Web: `pnpm --filter web dev`
5. Login: `admin@nexa-erp.dev` / `NexaDev2026!`

### Out of Scope (for later sessions)

- **Write/Action intents** — Create, edit, approve (existing action framework handles this)
- **RAG/Knowledge** — "How do I create a journal?" type questions
- **DB-backed page registry** — Start with code, migrate to DB later
- **Multi-turn tool calling** — Single tool call per message initially
