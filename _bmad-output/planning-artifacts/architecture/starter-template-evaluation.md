# Starter Template Evaluation

## Existing Technical Preferences

From PRD, vision document, and Old_Spec architecture:

- **Language:** TypeScript (strict mode) — non-negotiable
- **Frontend:** React — established in PRD and vision
- **Backend:** Node.js — established in PRD ("TypeScript/Node.js full-stack")
- **Database:** PostgreSQL — established (with Prisma ORM)
- **Runtime:** Node.js 22 LTS — per Old_Spec architecture
- **Package manager:** pnpm — standard for monorepo workspaces
- **Deployment:** Containerised (Docker/Kubernetes) — per PRD
- **AI:** Multi-LLM Provider Adapters (tool use / function calling) — per vision doc

## Primary Technology Domain

**Full-stack web application** with separate frontend and backend services in a monorepo. The separation is driven by:
1. Database-per-tenant requires dedicated connection management on the API server
2. AI orchestration layer sits on the backend, not in the frontend
3. Background jobs (bank feeds, payroll, reports) run server-side
4. Traditional ERP forms + conversational AI UI are both frontend concerns
5. OpenAPI documentation requires a defined API surface (NFR45)

## Starter Options Evaluated

**Option 1: Off-the-shelf Turborepo + Next.js + Prisma starters**

Multiple community starters exist (turbo-prisma-shadcn-starter, turborepo-tailwind-prisma-nextjs-starter, fullstack-turborepo-starter). However, all are Next.js-centric with API routes as the backend — not suitable for an enterprise ERP requiring a dedicated API server with database-per-tenant routing, background workers, and complex domain logic.

**Verdict:** Rejected. No off-the-shelf starter matches the architecture needs.

**Option 2: NestJS + React monorepo**

NestJS provides module system, DI, guards, interceptors, and built-in OpenAPI — maps well to 10 ERP modules. However, NestJS adds significant abstraction (decorators, metadata reflection, DI container) that increases complexity. The "boring tech" vision principle suggests avoiding heavy frameworks where simpler alternatives exist.

**Verdict:** Considered but not selected. Over-engineered for AI-driven development.

**Option 3: Custom Turborepo monorepo with Fastify + Vite/React** (Selected)

Custom monorepo using Turborepo for build orchestration, Fastify for the API (performant, TypeScript-first, plugin architecture, schema validation via ajv), and Vite + React for the frontend. Prisma as shared database package. This follows the "boring tech except where AI creates the differentiator" principle.

**Verdict:** Selected. Best fit for project requirements.

## Selected Approach: Custom Turborepo Monorepo

**Rationale:**
1. No off-the-shelf starter matches an enterprise ERP with AI layer, database-per-tenant, and 10 domain modules
2. Custom structure allows precise alignment with architectural requirements
3. Turborepo provides build caching, task orchestration, and parallel execution with minimal overhead
4. Simpler than Nx for a small team (AI-driven development) — Turborepo onboards in <10 minutes vs Nx's enterprise learning curve

## Technology Stack Decisions

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| **Monorepo** | Turborepo + pnpm workspaces | Latest | Simple, fast build caching, good for small team. pnpm for efficient disk usage and strict dependency resolution. |
| **Frontend** | Vite + React + React Router | Vite 6.x, React 19.x | Fast DX, no SSR overhead (app is behind auth — no SEO), simpler than Next.js for a SaaS dashboard. |
| **Backend** | Fastify | 5.x | 70k+ req/s, built-in schema validation (ajv → OpenAPI), plugin architecture maps to ERP modules, TypeScript-first. |
| **ORM** | Prisma | 7.x | Schema-first, versioned migrations (NFR44), TypeScript client, supports multiple database connections for database-per-tenant. Prisma 7 rewritten in TypeScript (no Rust engine). |
| **Database** | PostgreSQL | 17.x | Relational integrity for financial data, ACID, CHECK constraints for double-entry, pgvector potential for AI semantic search. |
| **Styling** | Tailwind CSS + Shadcn UI | Tailwind 4.x | Utility-first CSS for rapid UI development. Shadcn for accessible, composable components (forms, tables, dialogs). |
| **Testing** | Vitest + Playwright | Latest | Vitest for unit/integration (compatible with Vite), Playwright for E2E. Same assertion API across both. |
| **Validation** | Zod | Latest | Runtime type validation shared between frontend and backend. Schema → TypeScript types → OpenAPI. |
| **API Documentation** | OpenAPI via Fastify Swagger | Latest | Auto-generated from Fastify route schemas (NFR45). |
| **Background Jobs** | BullMQ + Redis | Latest | Job queues for bank feeds, payroll processing, report generation, email sending. Redis also for caching. |
| **AI** | Multi-LLM Provider Adapters | Latest | Provider-agnostic `LLMProvider` interface in AI Gateway. Anthropic (Claude) + OpenAI (GPT-4o) initially; any provider addable via single adapter file. `providerOptions` passthrough for provider-specific features. BYOK for Enterprise tenants. Fallback chains across providers. |
| **Auth** | Custom JWT + bcrypt/argon2 | — | JWT for stateless API auth, refresh tokens, MFA (TOTP). No third-party auth service needed for MVP. |
| **Mobile** | React Native + Expo | Expo SDK 52+ | Native mobile app for AI chat, briefings, approvals, barcode scanning. Shares packages/shared with web. |
| **Mobile Testing** | Detox or Maestro | Latest | E2E mobile testing for critical flows (login, chat, approval). |
| **Runtime** | Node.js | 22 LTS | Long-term support, stable, matches Old_Spec architecture. |

> **✅ DECISION CONFIRMED — Frontend Framework:** **Vite + React for web, React Native + Expo for mobile.** The AI-first ERP requires a proper native mobile app (briefings on the go, approvals, barcode scanning, biometric auth). Web app (Vite + React) handles complex ERP forms, tables, and reports — the desktop/tablet experience. Mobile app (Expo) handles the conversational AI interface, briefings, approvals, and scanning — the phone experience. Both share `packages/shared` (Zod schemas, types, constants) and consume the same Fastify API. Next.js rejected: SSR adds complexity behind auth, and doesn't help with mobile.

> **✅ DECISION CONFIRMED — Backend Framework:** **Fastify.** 2x throughput vs NestJS (70k vs 30k req/s), simpler mental model for AI-driven development (less decorator/DI abstraction = cleaner generated code), built-in schema validation feeds directly into OpenAPI. Plugin system maps naturally to ERP modules. Less magic = fewer bugs, faster development, better sustainability when Claude Opus 4.6 manages the entire codebase.

## Monorepo Structure

```
nexa-erp-ai-first/
├── apps/
│   ├── web/                    # Vite + React frontend (desktop/tablet — full ERP)
│   │   ├── src/
│   │   │   ├── components/     # Shared UI components
│   │   │   ├── features/       # Feature modules (finance, inventory, etc.)
│   │   │   ├── ai/             # AI chat interface, briefing UI
│   │   │   ├── layouts/        # App shell, navigation
│   │   │   └── lib/            # Client utilities, API client
│   │   └── vite.config.ts
│   │
│   ├── mobile/                 # React Native + Expo (phone — AI-first mobile)
│   │   ├── app/                # Expo Router file-based routing
│   │   │   ├── (auth)/         # Login, MFA screens
│   │   │   ├── (tabs)/         # Tab navigation (Chat, Briefing, Approvals, More)
│   │   │   │   ├── chat.tsx    # AI conversational interface (primary screen)
│   │   │   │   ├── briefing.tsx # Daily briefing with action cards
│   │   │   │   ├── approvals.tsx # Pending approvals queue
│   │   │   │   └── more.tsx    # Quick access to key modules
│   │   │   └── _layout.tsx     # Root layout
│   │   ├── components/         # Mobile-specific components
│   │   │   ├── chat/           # Chat bubbles, streaming response, approval cards
│   │   │   ├── briefing/       # Briefing cards, action buttons
│   │   │   ├── scanner/        # Barcode/QR scanner (camera API)
│   │   │   └── common/         # Buttons, inputs, cards (mobile-optimised)
│   │   ├── hooks/              # Mobile hooks (useBiometricAuth, useScanner, usePushNotifications)
│   │   ├── lib/                # API client (shared logic from packages/shared)
│   │   ├── app.json            # Expo config
│   │   ├── eas.json            # Expo Application Services (build/submit)
│   │   └── package.json
│   │
│   ├── api/                    # Fastify backend
│   │   ├── src/
│   │   │   ├── modules/        # Domain modules (finance, ar, ap, sales, etc.)
│   │   │   ├── ai/             # AI orchestration layer
│   │   │   ├── core/           # Auth, RBAC, audit, event bus, tenant routing
│   │   │   ├── integrations/   # HMRC, bank, payroll, OCR adapters
│   │   │   └── workers/        # Background job processors
│   │   └── fastify.config.ts
│   │
│   └── worker/                 # Background job runner (optional separate process)
│
├── packages/
│   ├── db/                     # Prisma schema, client, migrations, seed
│   ├── shared/                 # Shared types, constants, validation schemas (Zod)
│   ├── api-client/             # Typed API client (consumed by both web and mobile)
│   ├── ai-tools/               # AI tool definitions (shared between AI layer and API)
│   └── config/                 # ESLint, TypeScript, Tailwind shared configs
│
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── docker-compose.yml          # PostgreSQL, Redis for local dev
```

## Initialization Command

```bash
# Create Turborepo monorepo
npx create-turbo@latest nexa-erp-ai-first --package-manager pnpm

# Then manually structure apps/web, apps/api, packages/* per the structure above
# Each app/package initialised individually with its own package.json
```

**Note:** Project initialisation using this structure should be the first implementation story. The monorepo scaffold, shared configs, Docker Compose for local dev, and CI pipeline are the foundation everything else builds on.
