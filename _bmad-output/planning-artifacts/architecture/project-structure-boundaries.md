# Project Structure & Boundaries

## Complete Project Directory Structure

```
nexa-erp-ai-first/
│
├── .github/
│   └── workflows/
│       ├── ci.yml                          # Build, lint, test on PR
│       ├── deploy-staging.yml              # Deploy to staging on merge to main
│       └── deploy-production.yml           # Deploy to production (manual trigger)
│
├── apps/
│   ├── api/                                # Fastify backend (Node.js 22)
│   │   ├── src/
│   │   │   ├── index.ts                    # Entry point: starts Fastify server
│   │   │   ├── app.ts                      # Fastify app factory (plugins, hooks, routes)
│   │   │   │
│   │   │   ├── core/                       # Shared infrastructure (cross-cutting)
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.service.ts          # JWT issue/verify, password validation
│   │   │   │   │   ├── auth.service.test.ts
│   │   │   │   │   ├── auth.routes.ts           # /auth/login, /auth/refresh, /auth/logout
│   │   │   │   │   ├── mfa.service.ts           # TOTP generation/verification
│   │   │   │   │   └── auth.schema.ts
│   │   │   │   ├── rbac/
│   │   │   │   │   ├── rbac.guard.ts            # Fastify hook: role + module check
│   │   │   │   │   ├── rbac.service.ts          # Permission evaluation
│   │   │   │   │   └── rbac.types.ts            # Role, Permission, ModuleAccess types
│   │   │   │   ├── tenant/
│   │   │   │   │   ├── tenant-db.manager.ts     # PrismaClient factory (per-tenant)
│   │   │   │   │   ├── tenant.middleware.ts      # Extracts tenantId from JWT, attaches db
│   │   │   │   │   └── tenant.types.ts
│   │   │   │   ├── audit/
│   │   │   │   │   ├── audit.service.ts         # Writes to audit_log table
│   │   │   │   │   └── audit.types.ts
│   │   │   │   ├── events/
│   │   │   │   │   ├── event-bus.ts             # Typed event bus implementation
│   │   │   │   │   └── event-bus.types.ts       # BusinessEvents interface
│   │   │   │   ├── errors/
│   │   │   │   │   ├── app-error.ts             # AppError base class
│   │   │   │   │   ├── domain-error.ts          # DomainError (422)
│   │   │   │   │   ├── auth-error.ts            # AuthError (401/403)
│   │   │   │   │   ├── not-found-error.ts       # NotFoundError (404)
│   │   │   │   │   └── validation-error.ts      # ValidationError (400)
│   │   │   │   ├── logger/
│   │   │   │   │   └── logger.ts                # Pino structured logger setup
│   │   │   │   ├── middleware/
│   │   │   │   │   ├── correlation-id.ts        # Assigns request correlation ID
│   │   │   │   │   ├── request-logger.ts        # Logs request/response
│   │   │   │   │   └── rate-limiter.ts          # Per-user and per-tenant rate limiting
│   │   │   │   ├── state-machine/
│   │   │   │   │   ├── document-state-machine.ts    # Generic OKFlag state machine
│   │   │   │   │   └── document-state-machine.test.ts
│   │   │   │   ├── number-series/
│   │   │   │   │   ├── number-series.service.ts     # Gap-free number generation
│   │   │   │   │   └── number-series.service.test.ts
│   │   │   │   └── views/
│   │   │   │       ├── views.routes.ts              # CRUD for saved views + favourites
│   │   │   │       ├── views.service.ts             # View save/load, default resolution
│   │   │   │       ├── views.service.test.ts
│   │   │   │       ├── views.repository.ts          # Prisma queries for saved_views
│   │   │   │       ├── views.schema.ts              # Zod schemas for view config
│   │   │   │       ├── filter-builder.ts            # Generic filter → Prisma where converter
│   │   │   │       ├── filter-builder.test.ts
│   │   │   │       └── entity-metadata.types.ts     # EntityMetadata interface
│   │   │   │
│   │   │   ├── modules/                    # Domain modules (ERP business logic)
│   │   │   │   ├── finance/                # GL, journals, periods, bank rec
│   │   │   │   │   ├── index.ts
│   │   │   │   │   ├── routes/
│   │   │   │   │   │   ├── account.routes.ts
│   │   │   │   │   │   ├── journal-entry.routes.ts
│   │   │   │   │   │   ├── financial-period.routes.ts
│   │   │   │   │   │   └── bank-reconciliation.routes.ts
│   │   │   │   │   ├── services/
│   │   │   │   │   │   ├── account.service.ts
│   │   │   │   │   │   ├── journal-entry.service.ts
│   │   │   │   │   │   ├── financial-period.service.ts
│   │   │   │   │   │   ├── bank-reconciliation.service.ts
│   │   │   │   │   │   └── *.service.test.ts
│   │   │   │   │   ├── repositories/
│   │   │   │   │   │   ├── account.repository.ts
│   │   │   │   │   │   ├── journal-entry.repository.ts
│   │   │   │   │   │   └── financial-period.repository.ts
│   │   │   │   │   ├── schemas/
│   │   │   │   │   │   ├── account.schema.ts
│   │   │   │   │   │   └── journal-entry.schema.ts
│   │   │   │   │   ├── events/
│   │   │   │   │   │   └── finance.events.ts
│   │   │   │   │   └── types/
│   │   │   │   │       └── finance.types.ts
│   │   │   │   │
│   │   │   │   ├── ar/                     # Customers, invoices, payments, credit notes
│   │   │   │   │   └── [same structure as finance]
│   │   │   │   ├── ap/                     # Suppliers, bills, payment runs
│   │   │   │   │   └── [same structure]
│   │   │   │   ├── sales/                  # Quotes, orders, shipments
│   │   │   │   │   └── [same structure]
│   │   │   │   ├── purchasing/             # POs, goods receipt
│   │   │   │   │   └── [same structure]
│   │   │   │   ├── inventory/              # Items, stock movements, warehouses
│   │   │   │   │   └── [same structure]
│   │   │   │   ├── crm/                    # Contacts, accounts, activities, leads
│   │   │   │   │   └── [same structure]
│   │   │   │   ├── hr/                     # Employees, leave, payroll
│   │   │   │   │   └── [same structure]
│   │   │   │   ├── manufacturing/          # BOMs, work orders, routing
│   │   │   │   │   └── [same structure]
│   │   │   │   ├── reporting/              # Report generation, export
│   │   │   │   │   └── [same structure]
│   │   │   │   └── admin/                  # Users, settings, number series, imports
│   │   │   │       └── [same structure]
│   │   │   │
│   │   │   ├── ai/                         # AI orchestration layer
│   │   │   │   ├── orchestrator.ts              # Main AI request handler
│   │   │   │   ├── orchestrator.test.ts
│   │   │   │   ├── context-engine.ts            # User + business context from Redis
│   │   │   │   ├── action-planner.ts            # Multi-step operation decomposition
│   │   │   │   ├── guardrails.ts                # Financial approval enforcement
│   │   │   │   ├── response-formatter.ts        # AI response → structured UI response
│   │   │   │   ├── briefing-engine.ts           # Daily briefing generation
│   │   │   │   ├── briefing-engine.test.ts
│   │   │   │   └── websocket.handler.ts         # Socket.io event handling
│   │   │   │
│   │   │   ├── integrations/               # External service adapters
│   │   │   │   ├── hmrc/
│   │   │   │   │   ├── mtd-vat.adapter.ts       # MTD VAT API client
│   │   │   │   │   ├── rti.adapter.ts           # RTI API client
│   │   │   │   │   └── government-gateway.ts    # OAuth flow
│   │   │   │   ├── banking/
│   │   │   │   │   ├── bank-feed.adapter.ts     # Plaid/TrueLayer/Yapily
│   │   │   │   │   ├── bacs-generator.ts        # BACS payment file
│   │   │   │   │   └── statement-parser.ts      # OFX/CSV/MT940 import
│   │   │   │   ├── payroll/
│   │   │   │   │   └── staffology.adapter.ts    # Staffology API client
│   │   │   │   ├── document-processing/
│   │   │   │   │   ├── extraction.service.ts    # AI document field extraction (Claude Vision)
│   │   │   │   │   ├── matching.service.ts      # Supplier/PO/item matching from extracted data
│   │   │   │   │   ├── ingestion.service.ts     # Document intake (email/upload/camera)
│   │   │   │   │   └── learning.service.ts      # Per-supplier extraction profile learning
│   │   │   │   ├── exchange-rates/
│   │   │   │   │   └── boe-rates.adapter.ts     # Bank of England daily rates
│   │   │   │   └── email/
│   │   │   │       └── email.adapter.ts         # SMTP send, IMAP receive
│   │   │   │
│   │   │   └── workers/                    # BullMQ background job processors
│   │   │       ├── bank-feed-sync.worker.ts
│   │   │       ├── payroll-run.worker.ts
│   │   │       ├── report-generation.worker.ts
│   │   │       ├── briefing-generation.worker.ts
│   │   │       ├── exchange-rate-fetch.worker.ts
│   │   │       └── email-send.worker.ts
│   │   │
│   │   ├── e2e/                            # End-to-end API tests
│   │   │   ├── setup.ts
│   │   │   ├── finance/
│   │   │   ├── ar/
│   │   │   └── sales/
│   │   ├── Dockerfile
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── platform-api/                        # Platform API server (Fastify, central services)
│   │   ├── src/
│   │   │   └── index.ts                    # Entry point
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── platform-admin/                      # Platform admin dashboard (Vite + React)
│   │   ├── src/
│   │   │   └── index.ts                    # Entry point
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── mobile/                             # React Native + Expo (AI-first mobile)
│   │   ├── app/                            # Expo Router file-based routing
│   │   │   ├── _layout.tsx                 # Root layout (auth check, providers)
│   │   │   ├── (auth)/
│   │   │   │   ├── login.tsx               # Login with biometric option
│   │   │   │   └── mfa.tsx                 # MFA challenge
│   │   │   ├── (tabs)/
│   │   │   │   ├── _layout.tsx             # Tab bar (Chat, Briefing, Approvals, More)
│   │   │   │   ├── chat.tsx                # AI chat (primary screen)
│   │   │   │   ├── briefing.tsx            # Daily briefing with action cards
│   │   │   │   ├── approvals.tsx           # Pending approvals queue
│   │   │   │   └── more.tsx                # Module quick-access grid
│   │   │   ├── invoices/
│   │   │   │   ├── [id].tsx                # Invoice detail + approve action
│   │   │   │   └── index.tsx               # Invoice list (simplified)
│   │   │   ├── scanner.tsx                 # Barcode/QR scanner (goods receipt, stock)
│   │   │   └── notifications.tsx           # Notification centre
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   ├── chat-bubble.tsx
│   │   │   │   ├── streaming-response.tsx
│   │   │   │   └── approval-action.tsx
│   │   │   ├── briefing/
│   │   │   │   ├── briefing-card.tsx
│   │   │   │   └── action-button.tsx
│   │   │   ├── scanner/
│   │   │   │   └── barcode-scanner.tsx     # expo-camera barcode scanning
│   │   │   └── common/
│   │   │       ├── card.tsx
│   │   │       ├── button.tsx
│   │   │       └── status-badge.tsx
│   │   ├── hooks/
│   │   │   ├── use-biometric-auth.ts       # Face ID / fingerprint
│   │   │   ├── use-push-notifications.ts   # Expo push notifications
│   │   │   ├── use-scanner.ts              # Barcode scanning hook
│   │   │   └── use-ai-chat.ts              # WebSocket chat (shared logic pattern)
│   │   ├── lib/
│   │   │   ├── api-client.ts               # Uses packages/api-client
│   │   │   ├── secure-storage.ts           # expo-secure-store for tokens
│   │   │   └── query-client.ts             # TanStack Query config (mobile)
│   │   ├── stores/
│   │   │   ├── auth.store.ts
│   │   │   └── chat.store.ts
│   │   ├── app.json                        # Expo config
│   │   ├── eas.json                        # EAS Build / Submit config
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── web/                                # Vite + React frontend (full ERP desktop/tablet)
│       ├── src/
│       │   ├── main.tsx                    # React root mount
│       │   ├── App.tsx                     # Root component, router, providers
│       │   │
│       │   ├── features/                   # Feature modules (mirrors backend)
│       │   │   ├── finance/
│       │   │   │   ├── pages/
│       │   │   │   │   ├── chart-of-accounts.tsx
│       │   │   │   │   ├── journal-entries.tsx
│       │   │   │   │   ├── journal-entry-form.tsx
│       │   │   │   │   ├── trial-balance.tsx
│       │   │   │   │   └── bank-reconciliation.tsx
│       │   │   │   ├── components/
│       │   │   │   ├── hooks/
│       │   │   │   │   └── use-journal-entries.ts
│       │   │   │   ├── api.ts              # API client functions for finance
│       │   │   │   └── routes.tsx           # Lazy-loaded route definitions
│       │   │   ├── ar/
│       │   │   │   ├── pages/
│       │   │   │   │   ├── customers.tsx
│       │   │   │   │   ├── customer-form.tsx
│       │   │   │   │   ├── invoices.tsx
│       │   │   │   │   ├── invoice-form.tsx
│       │   │   │   │   └── payments.tsx
│       │   │   │   ├── components/
│       │   │   │   │   └── invoice-line-items.tsx
│       │   │   │   ├── hooks/
│       │   │   │   ├── api.ts
│       │   │   │   └── routes.tsx
│       │   │   ├── ap/                     # [same pattern]
│       │   │   ├── sales/
│       │   │   ├── purchasing/
│       │   │   ├── inventory/
│       │   │   ├── crm/
│       │   │   ├── hr/
│       │   │   ├── manufacturing/
│       │   │   ├── reporting/
│       │   │   ├── admin/
│       │   │   └── auth/                   # Login, MFA, password reset
│       │   │       ├── pages/
│       │   │       │   ├── login.tsx
│       │   │       │   └── mfa-challenge.tsx
│       │   │       └── routes.tsx
│       │   │
│       │   ├── components/                 # Shared component library
│       │   │   ├── ui/                     # Shadcn UI primitives
│       │   │   │   ├── button.tsx
│       │   │   │   ├── input.tsx
│       │   │   │   ├── dialog.tsx
│       │   │   │   ├── select.tsx
│       │   │   │   ├── toast.tsx
│       │   │   │   └── ...
│       │   │   ├── data-table/             # Enhanced DataTable with views & filters
│       │   │   │   ├── data-table.tsx               # Main component (TanStack Table wrapper)
│       │   │   │   ├── data-table-toolbar.tsx        # View selector, column toggle, filter btn
│       │   │   │   ├── data-table-column-toggle.tsx  # Column visibility + drag reorder
│       │   │   │   ├── data-table-filter-panel.tsx   # Advanced multi-field filter builder
│       │   │   │   ├── data-table-filter-row.tsx     # Single filter condition (field+op+value)
│       │   │   │   ├── data-table-view-selector.tsx  # Saved views dropdown with ★ favourites
│       │   │   │   ├── data-table-save-view.tsx      # Save/rename view dialog
│       │   │   │   ├── data-table-pagination.tsx     # Cursor-based pagination
│       │   │   │   └── use-data-table-views.ts       # Hook: load/save/apply views
│       │   │   ├── forms/                  # Reusable ERP form patterns
│       │   │   │   ├── address-form.tsx
│       │   │   │   ├── line-items-table.tsx
│       │   │   │   ├── currency-input.tsx
│       │   │   │   ├── date-picker.tsx
│       │   │   │   └── entity-search.tsx
│       │   │   ├── layout/
│       │   │   │   ├── app-shell.tsx
│       │   │   │   ├── sidebar.tsx
│       │   │   │   ├── header.tsx
│       │   │   │   ├── breadcrumbs.tsx
│       │   │   │   └── module-guard.tsx
│       │   │   └── ai/
│       │   │       ├── chat-panel.tsx
│       │   │       ├── chat-message.tsx
│       │   │       ├── briefing-card.tsx
│       │   │       ├── approval-card.tsx
│       │   │       └── confidence-indicator.tsx
│       │   │
│       │   ├── hooks/
│       │   │   ├── use-auth.ts
│       │   │   ├── use-tenant.ts
│       │   │   ├── use-ai-chat.ts
│       │   │   └── use-websocket.ts
│       │   │
│       │   ├── lib/
│       │   │   ├── api-client.ts           # Axios/fetch wrapper with auth, tenant headers
│       │   │   ├── query-client.ts         # TanStack Query client config
│       │   │   ├── formatters.ts           # Date, currency, number formatting
│       │   │   └── validators.ts           # Client-side validation helpers
│       │   │
│       │   ├── stores/
│       │   │   ├── auth.store.ts           # Auth state (Zustand)
│       │   │   ├── ui.store.ts             # UI state (sidebar, theme)
│       │   │   └── ai-chat.store.ts        # Chat conversation state
│       │   │
│       │   └── styles/
│       │       └── globals.css             # Tailwind imports + custom tokens
│       │
│       ├── index.html
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       ├── tsconfig.json
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   ├── db/                                 # Prisma schema, client, migrations
│   │   ├── prisma/
│   │   │   ├── schema.prisma              # Main schema (or split per module)
│   │   │   ├── migrations/                # Versioned migrations
│   │   │   └── seed.ts                    # Default data: CoA template, settings, admin user
│   │   ├── src/
│   │   │   ├── index.ts                   # Re-exports PrismaClient and types
│   │   │   └── client.ts                  # PrismaClient instantiation helper
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── api-client/                        # Typed API client (consumed by web + mobile)
│   │   ├── src/
│   │   │   ├── client.ts                  # Base HTTP client (fetch-based, platform-agnostic)
│   │   │   ├── auth.ts                    # Token management, refresh logic
│   │   │   ├── modules/                   # Per-module typed API functions
│   │   │   │   ├── finance.api.ts
│   │   │   │   ├── ar.api.ts
│   │   │   │   ├── ap.api.ts
│   │   │   │   ├── sales.api.ts
│   │   │   │   ├── inventory.api.ts
│   │   │   │   ├── crm.api.ts
│   │   │   │   ├── hr.api.ts
│   │   │   │   └── admin.api.ts
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── shared/                            # Shared types, schemas, constants
│   │   ├── src/
│   │   │   ├── schemas/                   # Zod schemas (used by frontend + backend)
│   │   │   │   ├── finance.schema.ts
│   │   │   │   ├── ar.schema.ts
│   │   │   │   ├── ap.schema.ts
│   │   │   │   ├── sales.schema.ts
│   │   │   │   ├── inventory.schema.ts
│   │   │   │   ├── hr.schema.ts
│   │   │   │   └── common.schema.ts       # Pagination, filters, address, etc.
│   │   │   ├── types/
│   │   │   │   ├── api-responses.types.ts  # { data: T }, { error: E } wrappers
│   │   │   │   ├── auth.types.ts
│   │   │   │   └── common.types.ts
│   │   │   ├── constants/
│   │   │   │   ├── error-codes.ts         # All error codes
│   │   │   │   ├── status-enums.ts        # DocumentStatus, PaymentMethod, etc.
│   │   │   │   ├── roles.ts              # Role definitions, module permissions
│   │   │   │   └── modules.ts            # Module identifiers
│   │   │   └── utils/
│   │   │       ├── money.ts              # Decimal arithmetic helpers
│   │   │       ├── dates.ts              # Date formatting/parsing
│   │   │       └── validation.ts         # Common validation helpers
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── ai-tools/                          # AI tool definitions
│   │   ├── src/
│   │   │   ├── index.ts                   # Exports all tools
│   │   │   ├── tools/
│   │   │   │   ├── finance.tools.ts
│   │   │   │   ├── ar.tools.ts
│   │   │   │   ├── ap.tools.ts
│   │   │   │   ├── sales.tools.ts
│   │   │   │   ├── inventory.tools.ts
│   │   │   │   ├── crm.tools.ts
│   │   │   │   ├── hr.tools.ts
│   │   │   │   ├── manufacturing.tools.ts
│   │   │   │   ├── reporting.tools.ts
│   │   │   │   └── admin.tools.ts
│   │   │   └── types.ts                   # Tool input/output types
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── platform-client/                    # Platform API client SDK
│   │   ├── src/
│   │   │   └── index.ts                   # Exports Platform API client
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── config/                            # Shared tooling configs
│       ├── eslint/
│       │   └── base.js                    # Shared ESLint config
│       ├── typescript/
│       │   └── base.json                  # Shared tsconfig
│       └── tailwind/
│           └── base.ts                    # Shared Tailwind config
│
├── docker-compose.yml                     # PostgreSQL + Redis for local dev
├── docker-compose.prod.yml                # Production compose (optional)
├── turbo.json                             # Turborepo task config
├── pnpm-workspace.yaml                    # Workspace definitions
├── package.json                           # Root package.json
├── .env.example                           # Environment variable template
├── .gitignore
├── CLAUDE.md                              # Claude Code conventions and rules
└── _bmad-output/                          # BMAD planning artifacts (not deployed)
```

## Architectural Boundaries

**API Boundaries:**

| Boundary | Internal Side | External Side | Contract |
|----------|-------------|--------------|----------|
| Frontend ↔ API | React (TanStack Query) | Fastify REST routes | OpenAPI schema, Zod validation |
| API ↔ AI | AI orchestration service | Multi-LLM Provider Adapters (packages/ai-gateway/src/providers/) | Unified tool definitions in packages/ai-tools, provider adapters in ai-gateway |
| API ↔ Database | Repository classes | PostgreSQL (via Prisma) | Prisma schema + migrations |
| API ↔ Cache | Service layer | Redis | Key naming convention: `{tenantId}:{module}:{entity}:{id}` |
| API ↔ External | Integration adapters | HMRC, bank, payroll APIs | Adapter interface per integration |
| Frontend ↔ AI | WebSocket (Socket.io) | AI orchestrator (backend) | Typed message protocol |

**Module Boundaries (Backend):**

Modules communicate ONLY through:
1. **Event bus** — for cross-module side effects (invoice.approved → GL journal creation)
2. **Shared types** — from packages/shared (never import from another module directly)
3. **API endpoints** — AI orchestrator calls module routes via internal HTTP

Modules NEVER:
- Import services/repositories from other modules
- Access another module's database tables directly
- Share mutable state

**Data Boundaries:**

| Layer | Responsibility | Access Pattern |
|-------|---------------|----------------|
| Routes | HTTP handling, schema validation, auth checks | Calls service methods |
| Services | Business logic, event emission, audit logging | Calls repository methods |
| Repositories | Database queries via Prisma | Returns typed entities |
| Prisma Client | SQL generation, connection management | Provided by tenant middleware |

## Requirements to Structure Mapping

| FR Category | Backend Module | Frontend Feature | Shared Schemas |
|-------------|---------------|-----------------|----------------|
| AI (FR1-10) | `api/src/ai/` | `web/src/components/ai/` | `ai-tools/src/` |
| Finance (FR11-18) | `api/src/modules/finance/` | `web/src/features/finance/` | `shared/src/schemas/finance.schema.ts` |
| AR (FR19-25) | `api/src/modules/ar/` | `web/src/features/ar/` | `shared/src/schemas/ar.schema.ts` |
| AP (FR26-32) | `api/src/modules/ap/` | `web/src/features/ap/` | `shared/src/schemas/ap.schema.ts` |
| Sales (FR33-40) | `api/src/modules/sales/` | `web/src/features/sales/` | `shared/src/schemas/sales.schema.ts` |
| Purchasing (FR41-45, FR154) | `api/src/modules/purchasing/` | `web/src/features/purchasing/` | `shared/src/schemas/purchasing.schema.ts` |
| Inventory (FR46-53) | `api/src/modules/inventory/` | `web/src/features/inventory/` | `shared/src/schemas/inventory.schema.ts` |
| CRM (FR54-58, FR95-100) | `api/src/modules/crm/` | `web/src/features/crm/` | `shared/src/schemas/crm.schema.ts` |
| HR (FR59-67, FR101-108) | `api/src/modules/hr/` | `web/src/features/hr/` | `shared/src/schemas/hr.schema.ts` |
| Manufacturing (FR68-73, FR109-115) | `api/src/modules/manufacturing/` | `web/src/features/manufacturing/` | `shared/src/schemas/manufacturing.schema.ts` |
| Reporting (FR74-79, FR153) | `api/src/modules/reporting/` | `web/src/features/reporting/` | `shared/src/schemas/reporting.schema.ts` |
| Admin (FR80-88) | `api/src/modules/admin/` | `web/src/features/admin/` | `shared/src/schemas/admin.schema.ts` |
| Compliance (FR89-94, FR155-157) | Spread across finance, hr modules + `api/src/core/fraud-detection/` | Spread across finance, hr features | VAT logic in finance schema |
| POS (FR116-122) | `api/src/modules/pos/` | `web/src/features/pos/` | `shared/src/schemas/pos.schema.ts` |
| Projects (FR123-129) | `api/src/modules/projects/` | `web/src/features/projects/` | `shared/src/schemas/projects.schema.ts` |
| Contracts (FR130-134) | `api/src/modules/contracts/` | `web/src/features/contracts/` | `shared/src/schemas/contracts.schema.ts` |
| Warehouse (FR135-140) | `api/src/modules/warehouse/` | `web/src/features/warehouse/` | `shared/src/schemas/warehouse.schema.ts` |
| Intercompany (FR141-144) | `api/src/modules/intercompany/` | `web/src/features/intercompany/` | `shared/src/schemas/intercompany.schema.ts` |
| Communications (FR145-148) | `api/src/modules/communications/` | `web/src/features/communications/` | `shared/src/schemas/communications.schema.ts` |
| Service Orders (FR149-152) | `api/src/modules/service-orders/` | `web/src/features/service-orders/` | `shared/src/schemas/service-orders.schema.ts` |

**Cross-Cutting Concerns Mapping:**

| Concern | Location |
|---------|----------|
| Auth/JWT/MFA | `api/src/core/auth/` |
| RBAC + Module gating | `api/src/core/rbac/` + `web/src/components/layout/module-guard.tsx` |
| Tenant DB routing | `api/src/core/tenant/` |
| Audit trail | `api/src/core/audit/` |
| Event bus | `api/src/core/events/` |
| State machine (OKFlag) | `api/src/core/state-machine/` |
| Number series | `api/src/core/number-series/` |
| Fraud detection | `api/src/core/fraud-detection/` |
| Error handling | `api/src/core/errors/` |
| Structured logging | `api/src/core/logger/` |
| Saved views & filters | `api/src/core/views/` + `web/src/components/data-table/` |
| Background jobs | `api/src/workers/` |

## Data Flow

```
User (Browser)
    │
    ├── Traditional path: React form → TanStack Query → Fetch API
    │                                                      │
    └── AI path: Chat panel → WebSocket (Socket.io) ───────┤
                                                            │
                                                            ▼
                                                    Fastify API Server
                                                            │
                        ┌───────────────────────────────────┼───────────────────────┐
                        │                                   │                       │
                        ▼                                   ▼                       ▼
                 Core Middleware                      AI Orchestrator          Background Workers
                 (auth, tenant, audit)               (AI Gateway)            (BullMQ + Redis)
                        │                                   │                       │
                        ▼                                   │                       │
                 Module Routes                              │                       │
                        │                                   │                       │
                        ▼                                   │                       │
                 Module Services ◄──────────────────────────┘                       │
                        │                                                           │
                        ├── Event Bus ──► Subscribers (other modules) ◄─────────────┘
                        │
                        ▼
                 Module Repositories
                        │
                        ▼
                 Prisma Client (tenant-specific)
                        │
                        ▼
                 PostgreSQL (tenant database)
```
