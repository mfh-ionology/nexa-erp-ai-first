# 1. Overview

| Metric | Count |
|--------|-------|
| **Total Prisma Models (ERP)** | 239 |
| **Total Prisma Models (Platform)** | 10 |
| **Total Prisma Enums (ERP)** | 172 |
| **Total Prisma Enums (Platform)** | 5 |
| **Architecture Sections** | 19 (2.8--2.31) |
| **Module Domains** | 18 ERP + 1 Platform |

**Key Architectural Patterns:**

- **Two databases** -- ERP database (per-tenant) + Platform database (central, cross-tenant). Separate Prisma schemas.
- **Database-per-tenant** -- no `tenant_id` columns in any ERP table. Tenant isolation at connection routing level.
- **UUID primary keys** -- `@id @default(uuid())` on all models (except `Currency` and `Country` which use natural keys).
- **snake_case table names** -- all models use `@@map("snake_case_name")` for PostgreSQL table naming.
- **Fixed-point decimals** -- all monetary fields use `Decimal @db.Decimal(precision, scale)`, never `Float`.
- **Soft delete** -- `isActive Boolean @default(true)` on reference entities (Customer, Supplier, Item, etc.). Transactional entities use status enums (DRAFT/POSTED/CANCELLED/VOID).
- **Audit trails** -- `createdAt DateTime @default(now())`, `updatedAt DateTime @updatedAt`, plus `createdBy`/`updatedBy` String fields on transactional entities.
- **Polymorphic linking** -- Attachments, Notes, RecordLinks, and ApprovalRequests use `entityType String` + `entityId String` pattern.
- **Self-referential hierarchies** -- ChartOfAccount, ItemGroup, AssetGroup, ProjectTask, ConsolidationMember, ConferenceRoom, Resource use named `@relation` pairs.
- **Granular RBAC** -- 5 new tables (Resource, AccessGroup, AccessGroupPermission, AccessGroupFieldOverride, UserAccessGroup) provide per-page, per-action, per-field permission control via access groups assigned to users per company. Multiple groups per user with most-permissive-wins conflict resolution. `SUPER_ADMIN` bypasses the matrix. See design doc: `docs/plans/2026-02-19-granular-rbac-access-groups-design.md`.

---
