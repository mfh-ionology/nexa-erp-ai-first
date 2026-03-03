# Executive Summary

**Nexa ERP** is an AI-first, cloud-native ERP platform for UK SMEs (10-250 employees). The core differentiator: AI is the interaction paradigm, not a feature. Users talk to the system in natural language to create records, retrieve information, and manage their business. The AI pre-fills records using contextual knowledge; users review, approve, and move on — "told, shown, approve, done."

**Target market:** UK SMEs currently on legacy desktop ERPs (HansaWorld, Sage, custom systems) seeking modern cloud alternatives.

**Product type:** SaaS B2B, database-per-tenant, greenfield codebase. Requirements mined from two legacy sources: HansaWorld ERP (HAL — 1,055 entities, 3,170 fields, 300+ business rules) and Old_Spec (previous Nexa ERP specifications, 90+ documents). No code or design carried forward — requirements only.

**MVP scope:** 10 core business modules (Finance, AR, AP, Sales, Purchasing, Inventory, CRM, HR/Payroll, Manufacturing, Reporting) with full AI integration, plus Platform Admin (Super Admin portal for tenant management, billing, AI token metering, and platform operations), plus cross-cutting platform capabilities (multi-company management, i18n, notifications, email integration, tasks, printer management, document templates), plus 8 Phase 2/3 modules (POS, Projects & Job Costing, Contracts & Agreements, Warehouse Management, Service Orders, Fixed Assets, Communications, Intercompany & Consolidation). Multi-company architecture with companyId on every table. AI Gateway service enforces token quotas from day one. First customer: founding company (dogfooding).

**Development approach:** All coding performed exclusively using Claude Opus 4.6. TypeScript/Node.js full-stack.
