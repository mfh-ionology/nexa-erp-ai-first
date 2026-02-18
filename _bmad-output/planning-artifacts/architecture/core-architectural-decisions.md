# Core Architectural Decisions

## Decision Priority Analysis

**Already Decided (from PRD, vision, user directives):**
- TypeScript strict mode, Node.js 22 LTS, PostgreSQL, React, Prisma ORM
- Database-per-tenant with no tenant_id columns
- Single base currency + FX rates (not dual-base)
- UK payroll via external API (Staffology/PayRun.io)
- All coding via Claude Opus 4.6
- Docker/Kubernetes deployment
- RBAC with 5 roles + module gating

**Critical Decisions (made in this section):**
1. Application architecture: Modular monolith vs microservices
2. Data modeling approach and monetary value representation
3. Database-per-tenant Prisma implementation
4. Authentication and session management
5. API design and event architecture
6. Frontend state management and component patterns
7. AI orchestration architecture

**Deferred Decisions (Post-MVP):**
- Cloud provider selection (AWS vs GCP vs Azure) — deploy-time decision
- CDN and edge caching strategy — needed at scale
- Database read replicas — needed when >50 concurrent users per tenant
- Multi-region deployment — needed for data residency beyond UK

## 1. Application Architecture

**Decision: Modular Monolith (not microservices)**

The 11 ERP modules are deployed as a single Fastify application, but organised internally as independent domain modules with clear boundaries. Each module is a Fastify plugin with its own routes, services, repositories, and validation schemas.

**Rationale:**
- ERP modules are deeply interconnected (invoice approval triggers GL posting + stock update + AR update). Microservices would turn every cross-module operation into distributed transactions.
- Single database per tenant means no data isolation benefit from microservices.
- Simpler deployment, monitoring, and debugging for MVP.
- Can extract modules to services later if needed (plugin boundaries make this possible).

**Module Plugin Structure:**
```
apps/api/src/modules/
├── system/           # Company profile, currencies, departments, countries, payment terms, VAT codes, tags, settings
│   ├── routes/       # Fastify route handlers
│   ├── services/     # Business logic
│   ├── repositories/ # Database access (Prisma)
│   └── schemas/      # Zod schemas for validation + OpenAPI
├── finance/          # GL, journals, periods, bank rec
│   ├── routes/
│   ├── services/
│   ├── repositories/
│   └── schemas/
├── ar/               # Customers, invoices, payments, credit notes
├── ap/               # Suppliers, bills, payment runs
├── sales/            # Quotes, orders, shipments
├── purchasing/       # POs, goods receipt
├── inventory/        # Items, stock movements, warehouses
├── crm/              # Contacts, accounts, activities, leads
├── hr/               # Employees, leave, payroll
├── manufacturing/    # BOMs, work orders, routing
└── reporting/        # Report generation, export
```

Each module registers as a Fastify plugin:
```typescript
// modules/ar/index.ts
export default async function arModule(fastify: FastifyInstance) {
  // Register sub-routes
  fastify.register(customerRoutes, { prefix: '/customers' });
  fastify.register(invoiceRoutes, { prefix: '/invoices' });
  fastify.register(paymentRoutes, { prefix: '/payments' });
  // Module-level hooks, decorators, etc.
}
```

## 2. Data Architecture

### 2.1 Monetary Value Representation

**Decision: Prisma Decimal type (not integer minor units)**

All monetary values stored as PostgreSQL `DECIMAL(19,4)` — 19 digits total, 4 decimal places. This provides:
- Exact arithmetic without floating-point errors (NFR38)
- Readable values in the database (£1234.56 not 123456)
- 4 decimal places for currency conversion intermediate calculations and unit prices
- Prisma's `Decimal` type maps directly

> **✅ DECISION CONFIRMED — Decimal Precision:** **DECIMAL(19,4).** No conversion code at every boundary (display, API, calculations), Prisma Decimal handles natively, 4 decimal places support FX intermediate calculations. Faster development, fewer money bugs. Minor units rejected: conversion overhead at every layer slows development and introduces bug surface.

### 2.2 Database-per-Tenant Implementation

**Decision: Prisma client factory with connection pool per tenant**

```typescript
// Simplified concept
class TenantDatabaseManager {
  private clients: Map<string, PrismaClient> = new Map();

  async getClient(tenantId: string): Promise<PrismaClient> {
    if (!this.clients.has(tenantId)) {
      const dbUrl = await this.resolveTenantDbUrl(tenantId);
      const client = new PrismaClient({ datasources: { db: { url: dbUrl } } });
      await client.$connect();
      this.clients.set(tenantId, client);
    }
    return this.clients.get(tenantId)!;
  }
}
```

**Key design points:**
- Tenant resolved from JWT claims (sub-domain or tenant header) at middleware level
- PrismaClient instance cached per tenant with LRU eviction for idle tenants
- All connections route through PgBouncer (transaction-mode pooling)
- PrismaClient pool size per tenant: 5 (but PgBouncer multiplexes to ~20 real PG connections total)
- Maximum concurrent tenants in memory: ~500+ (PgBouncer handles connection multiplexing, not the app)
- MVP: Single tenant, single PrismaClient — zero routing overhead, PgBouncer still in stack for production parity
- Migrations applied per-tenant via CLI tool (direct to PostgreSQL, bypassing PgBouncer for DDL operations)

### 2.3 Schema Design Principles

| Principle | Implementation |
|-----------|---------------|
| **companyId on every table** | `companyId String @map("company_id")` FK to Company on ALL tables (transactional AND master data). Every query MUST scope by companyId. See project-context.md §1 for RegisterSharingRule pattern for shared entities. |
| **Typed fields over JSON** | All queryable, reportable, and validated fields as Prisma columns. JSON only for truly custom/extensible attributes. |
| **Foreign keys everywhere** | Every relationship enforced at DB level. No orphaned records. |
| **`isActive` on reference entities** | `isActive Boolean @default(true) @map("is_active")` on all reference/lookup entities. Controls LOV visibility without deletion. See §2.3.1. |
| **Soft delete for non-financial** | `deletedAt: DateTime?` on non-financial entities (e.g., duplicate contacts, test data). Financial entities are NEVER deleted. |
| **Status enums** | All transactional entities use typed status enum (DRAFT, APPROVED, POSTED, CANCELLED). Maps to legacy OKFlag. |
| **Timestamps** | `createdAt`, `updatedAt` on every table. `createdBy`, `updatedBy` for user attribution. |
| **Fixed-point decimal** | `Decimal(19,4)` for all monetary. `Decimal(10,6)` for exchange rates. `Decimal(10,4)` for quantities. |
| **Translation keys for all UI text** | All user-facing strings (labels, messages, placeholders, validation errors) use i18n translation keys via `t('key')`. English-only for MVP but system ready for any language. See project-context.md §3. |

### 2.3.1 Active/Inactive Pattern (Reference Entity Visibility)

**Problem:** Deleting a customer, payment term, or warehouse breaks foreign keys on existing transactions. But retired records should not appear in dropdowns when creating new records.

**Solution:** Every reference entity (entities picked from LOVs/dropdowns) has an `isActive` boolean field. Deactivating a record hides it from selection lists without deleting it.

**Which entities get `isActive`:**

| Entity Type | `isActive` | Why |
|------------|-----------|-----|
| **Reference/lookup entities** | ✅ YES | These are "things you pick from a list" |
| Customer, Supplier, Contact | ✅ | Customers go dormant, suppliers change |
| InventoryItem, ItemGroup | ✅ | Products discontinued, groups retired |
| ChartOfAccount (GL accounts) | ✅ | Accounts retired but historical entries remain |
| PaymentTerms, VATCode, Currency | ✅ | Terms changed, VAT codes retired |
| Warehouse, Location | ✅ | Branches closed, bins decommissioned |
| Employee | ✅ | Employees leave but payroll history stays |
| CrmAccount, CrmContact | ✅ | Contacts go cold but activity history stays |
| BillOfMaterials | ✅ | Old BOMs superseded but production history stays |
| NumberSeries | ✅ | Series retired when format changes |
| **Transactional entities** | ❌ NO | These use status enums instead |
| Invoice, Bill, Payment | ❌ | Use DRAFT/APPROVED/POSTED/CANCELLED |
| SalesOrder, PurchaseOrder | ❌ | Use lifecycle status |
| JournalEntry | ❌ | Use DRAFT/POSTED |
| StockMovement | ❌ | Use COMPLETED/VOIDED |
| AuditLog | ❌ | Append-only, never modified |

**Prisma pattern:**
```prisma
model Customer {
  id        String   @id @default(uuid())
  name      String
  isActive  Boolean  @default(true) @map("is_active")
  // ... other fields
  @@map("customers")
  @@index([isActive], map: "idx_customers_active")
}
```

**Query patterns:**
```typescript
// LOV/dropdown query (new record creation) — FILTER active only
async findForDropdown(): Promise<CustomerOption[]> {
  return this.db.customer.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

// Detail/report query — NO active filter (show referenced entity even if inactive)
async findById(id: string): Promise<Customer | null> {
  return this.db.customer.findUnique({ where: { id } });
}

// List query (admin view) — optional filter, default to active
async findAll(includeInactive = false): Promise<Customer[]> {
  return this.db.customer.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { name: 'asc' },
  });
}
```

**UI patterns:**
- Dropdowns/LOVs: Only show `isActive: true` records
- List pages: Default to active, toggle "Show inactive" (greyed out styling for inactive)
- Detail pages: Always show the referenced entity, display "(Inactive)" badge if deactivated
- Deactivate action: Confirm dialog — "This will hide [Customer X] from selection lists. Existing records referencing this customer are not affected."
- Reactivate action: Simple toggle — no side effects, immediately available in LOVs again

**AI pattern:**
- When AI creates records, only suggest active entities ("Create invoice for..." only shows active customers)
- When AI queries, include inactive for completeness ("Show all invoices for Acme Corp" works even if Acme is inactive)
- AI should flag if user references an inactive entity: "Acme Corp is currently inactive. Would you like to reactivate them first?"

### 2.4 Double-Entry Enforcement

**Decision: PostgreSQL CHECK constraint on journal_lines table**

```sql
-- Ensure every journal entry balances
ALTER TABLE journal_lines ADD CONSTRAINT balanced_entry
  CHECK (
    (SELECT SUM(debit - credit) FROM journal_lines jl
     WHERE jl.journal_entry_id = journal_entry_id) = 0
  );
```

In practice, this will be implemented as a PostgreSQL trigger function that fires AFTER INSERT on `journal_lines` and verifies the parent `journal_entry` balances to zero. Prisma handles this transparently — the application creates journal lines within a transaction, and the trigger validates balance before commit.

### 2.5 Period Locking

**Decision: Database trigger preventing modifications to locked periods**

```sql
CREATE OR REPLACE FUNCTION prevent_locked_period_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM financial_periods
    WHERE period_start <= NEW.transaction_date
      AND period_end >= NEW.transaction_date
      AND is_locked = true
  ) THEN
    RAISE EXCEPTION 'Cannot modify transactions in a locked financial period';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Applied to all financial tables (journal_entries, journal_lines, customer_invoices, supplier_bills, payments).

### 2.6 Immutable Audit Trail

**Decision: Append-only audit_log table with DB-level protection**

```sql
-- Prevent any UPDATE or DELETE on audit_log
CREATE RULE no_update_audit AS ON UPDATE TO audit_log DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO audit_log DO INSTEAD NOTHING;
```

Audit records include: entity_type, entity_id, action (CREATE/UPDATE/DELETE/APPROVE/POST), before_data (JSONB), after_data (JSONB), user_id, is_ai_action (boolean), ai_confidence (decimal), timestamp, correlation_id.

### 2.7 Caching Strategy

**Decision: Redis for hot data, AI context, and sessions**

| Cache Layer | Technology | TTL | Use Case |
|-------------|-----------|-----|----------|
| API response cache | Redis | 30s-5min | Frequently accessed lists (customers, items, accounts) |
| AI context cache | Redis | Session lifetime | User context, recent activity, preferences for AI orchestration |
| Session/refresh tokens | Redis | Configurable (30min-7days) | JWT refresh token storage for revocation |
| Exchange rates | Redis | 24h | Daily exchange rate feeds |
| Report cache | Redis | 15min | Generated report data for repeated access |
| Database query cache | Prisma (in-process) | Request-scoped | Prisma's built-in query batching within a request |

### 2.8 Number Series

**Decision: Database sequence with configurable prefix per entity**

```sql
-- number_series table
CREATE TABLE number_series (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL UNIQUE,  -- 'INVOICE', 'PO', 'SO', etc.
  prefix VARCHAR(20) NOT NULL,              -- 'INV-', 'PO-', 'SO-'
  next_value INTEGER NOT NULL DEFAULT 1,
  padding INTEGER NOT NULL DEFAULT 5,       -- zero-pad width
  UNIQUE(entity_type)
);

-- Atomic increment function (gap-free)
CREATE OR REPLACE FUNCTION next_number(p_entity_type VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_prefix VARCHAR;
  v_next INTEGER;
  v_padding INTEGER;
BEGIN
  UPDATE number_series
  SET next_value = next_value + 1
  WHERE entity_type = p_entity_type
  RETURNING prefix, next_value - 1, padding
  INTO v_prefix, v_next, v_padding;

  RETURN v_prefix || LPAD(v_next::TEXT, v_padding, '0');
END;
$$ LANGUAGE plpgsql;
```

This produces: INV-00001, PO-00001, SO-00001, etc. Gap-free via `SELECT ... FOR UPDATE` semantics of the UPDATE statement.

### 2.9 Saved Views, Filters & Column Preferences

**Problem:** ERP users live in list views — invoices, customers, stock movements, purchase orders. Without personalised views, they reconfigure columns, filters, and sorting 20+ times a day. An accountant checking overdue invoices, a sales manager filtering by region, a warehouse lead viewing low-stock items — each needs their own lens on the same data.

**Decision: User-configurable table views with saved filters, column selection, and favourites**

This is cross-cutting infrastructure. Every list page across all 10 modules uses the same view system.

**Data Model:**

```prisma
model SavedView {
  id          String    @id @default(uuid())
  userId      String    @map("user_id")
  entityType  String    @map("entity_type")     // 'customer_invoices', 'customers', 'stock_movements'
  name        String                             // 'Highest Dues', 'Today's Invoices', 'London Region'
  isDefault   Boolean   @default(false) @map("is_default")    // user's default view for this entity
  isFavourite Boolean   @default(false) @map("is_favourite")  // appears in global favourites bar
  columns     Json      @db.JsonB               // visible columns + order
  filters     Json      @db.JsonB               // filter conditions array
  sorting     Json      @db.JsonB               // sort configuration
  scope       ViewScope @default(PERSONAL)      // who can see this view
  roleId      String?   @map("role_id")         // if scope = ROLE, which role
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  user        User      @relation(fields: [userId], references: [id])

  @@map("saved_views")
  @@unique([userId, entityType, name], map: "uq_saved_views_user_entity_name")
  @@index([userId, entityType], map: "idx_saved_views_user_entity")
  @@index([isFavourite, userId], map: "idx_saved_views_favourites")
}

enum ViewScope {
  PERSONAL    // only the creator sees it
  ROLE        // all users with that role see it (e.g., MANAGER default view)
  GLOBAL      // all users see it (admin-created)
}
```

**JSON field structures:**

```typescript
// columns — which columns visible + display order
interface ViewColumns {
  visible: string[];   // ['invoiceNumber', 'customerName', 'totalAmount', 'status', 'dueDate']
  order: string[];     // same fields in display order (left to right)
}

// filters — multi-condition filter with typed operators
interface ViewFilters {
  logic: 'AND' | 'OR';
  conditions: ViewFilterCondition[];
}

interface ViewFilterCondition {
  field: string;                    // 'status', 'totalAmount', 'transactionDate', 'customer.region'
  operator: FilterOperator;
  value: string | string[] | null;  // serialised — parsed by type at runtime
}

type FilterOperator =
  | 'eq'        // equals
  | 'neq'       // not equals
  | 'gt'        // greater than
  | 'gte'       // greater than or equal
  | 'lt'        // less than
  | 'lte'       // less than or equal
  | 'contains'  // string contains (ILIKE)
  | 'startsWith'
  | 'in'        // value in list
  | 'notIn'
  | 'between'   // range (dates, amounts)
  | 'isNull'
  | 'isNotNull';

// sorting — multi-field sort
interface ViewSorting {
  fields: { field: string; direction: 'asc' | 'desc' }[];
}
```

**Backend: Generic filter-to-Prisma converter (`api/src/core/views/`):**

```typescript
// Converts saved view filters into Prisma where clauses — works for ANY entity
function buildPrismaWhere(filters: ViewFilters, entityMeta: EntityMetadata): Record<string, unknown> {
  const conditions = filters.conditions.map(c => {
    const prismaField = entityMeta.resolveField(c.field); // handles nested: 'customer.region' → { customer: { region: ... } }
    return mapOperator(prismaField, c.operator, c.value, entityMeta.fieldType(c.field));
  });
  return filters.logic === 'AND' ? { AND: conditions } : { OR: conditions };
}

// Converts saved view sorting into Prisma orderBy
function buildPrismaOrderBy(sorting: ViewSorting): Record<string, string>[] {
  return sorting.fields.map(s => ({ [s.field]: s.direction }));
}
```

Each module registers its **entity metadata** — the list of filterable fields, their types, and display labels:
```typescript
// modules/ar/views/invoice.view-meta.ts
export const invoiceViewMeta: EntityMetadata = {
  entityType: 'customer_invoices',
  fields: [
    { key: 'invoiceNumber',   label: 'Invoice #',     type: 'string',  filterable: true, sortable: true },
    { key: 'customerName',    label: 'Customer',       type: 'string',  filterable: true, sortable: true, resolve: 'customer.name' },
    { key: 'status',          label: 'Status',         type: 'enum',    filterable: true, sortable: true, options: ['DRAFT','APPROVED','POSTED','CANCELLED'] },
    { key: 'totalAmount',     label: 'Amount',         type: 'decimal', filterable: true, sortable: true },
    { key: 'currencyCode',    label: 'Currency',       type: 'string',  filterable: true, sortable: false },
    { key: 'transactionDate', label: 'Date',           type: 'date',    filterable: true, sortable: true },
    { key: 'dueDate',         label: 'Due Date',       type: 'date',    filterable: true, sortable: true },
    { key: 'isOverdue',       label: 'Overdue',        type: 'boolean', filterable: true, sortable: true, computed: true },
    { key: 'region',          label: 'Region',         type: 'string',  filterable: true, sortable: true, resolve: 'customer.region' },
    { key: 'createdAt',       label: 'Created',        type: 'datetime',filterable: true, sortable: true },
  ],
  defaultColumns: ['invoiceNumber', 'customerName', 'totalAmount', 'status', 'dueDate'],
  defaultSort: [{ field: 'transactionDate', direction: 'desc' }],
};
```

**API endpoints (`api/src/core/views/views.routes.ts`):**

```
GET    /api/v1/views?entityType=customer_invoices       # List saved views for this entity
POST   /api/v1/views                                     # Create saved view
PATCH  /api/v1/views/:id                                 # Update (rename, change filters, toggle favourite)
DELETE /api/v1/views/:id                                  # Delete saved view
GET    /api/v1/views/favourites                           # All user's favourites across all entities
POST   /api/v1/views/:id/set-default                     # Set as default view for this entity
GET    /api/v1/views/defaults?entityType=customer_invoices # Get default view (user → role → system fallback)
```

**Default view resolution order:**
1. User's personal default for this entity (if set)
2. Role-based default for this entity (set by admin)
3. System default (defined in entity metadata — `defaultColumns` + `defaultSort`)

**Frontend: Enhanced DataTable component (`web/src/components/data-table/`):**

```
┌─────────────────────────────────────────────────────────────────────┐
│ Invoices                        [★ Highest Dues ▾] [⚙ Columns] [🔍 Filter]  │
│                                                                       │
│ Quick filters: [All] [Overdue] [★ Highest Dues] [★ Today's] [+ Save view]  │
├──────────┬────────────┬──────────┬──────────┬──────────┬─────────────┤
│ Invoice# │ Customer   │ Amount ▼ │ Status   │ Due Date │ Actions     │
├──────────┼────────────┼──────────┼──────────┼──────────┼─────────────┤
│ INV-0042 │ Acme Corp  │ £31,000  │ OVERDUE  │ 01/02/26 │ ⋮           │
│ INV-0039 │ BlueStar   │ £12,400  │ APPROVED │ 15/02/26 │ ⋮           │
│ ...      │            │          │          │          │             │
└──────────┴────────────┴──────────┴──────────┴──────────┴─────────────┘
                                                    Page 1 of 12  [< >]
```

Component structure:
```
web/src/components/data-table/
├── data-table.tsx                # Main component (wraps TanStack Table)
├── data-table-toolbar.tsx        # View selector, column toggle, filter button
├── data-table-column-toggle.tsx  # Column visibility checkboxes + drag reorder
├── data-table-filter-panel.tsx   # Advanced filter builder (field + operator + value)
├── data-table-filter-row.tsx     # Single filter condition row
├── data-table-view-selector.tsx  # Saved views dropdown with ★ favourites
├── data-table-save-view.tsx      # Save/rename view dialog
├── data-table-pagination.tsx     # Cursor-based pagination controls
└── use-data-table-views.ts       # Hook: load/save/apply views, manages state
```

**User workflow example (David the accountant):**

1. Opens Invoices → sees default view (all invoices, sorted by date desc)
2. Clicks **Filter** → Advanced filter panel slides out
3. Adds condition: `Status` `equals` `APPROVED` + `Due Date` `less than` `today`
4. Adds condition: sorts by `Amount` descending
5. Clicks **Apply** → table updates showing only overdue approved invoices, highest first
6. Clicks **Save View** → names it "Highest Dues"
7. Clicks the **★** star → marked as favourite
8. Next day: clicks ★ in top nav → "Highest Dues" → instantly back to that exact view
9. Creates another: `Date` `equals` `today`, sort by `Created` desc → saves as "Today's Invoices" → stars it
10. Both views now appear as quick-filter chips above the table AND in the global favourites

**Mobile integration:**
- Mobile list views use the same saved views (fetched from API)
- Simplified filter UI (bottom sheet instead of side panel)
- Favourites accessible from mobile tab bar → "More" → "Saved Views"
- Column selection simplified on mobile (fewer columns visible by default)

**AI integration:**
- "Show me overdue invoices sorted by amount" → AI applies filter conditions, user can save the result as a view
- "Save this as my Highest Dues view" → AI calls the save view API
- "Show me my Highest Dues" → AI loads the saved view by name

### 2.10 System Module — Foundation Entities & Settings

The System module is the **foundation layer** that all other modules depend on. It holds company configuration, reference data (currencies, departments, payment terms, VAT codes, countries), and system-wide settings. In the legacy HansaWorld system, this is the "System" module containing 9 registers and ~60 settings screens.

**Legacy → Nexa Mapping:**

**Registers (from legacy System module):**

| Legacy Register | Legacy Entity | Fields | Nexa Target | Module | MVP? |
|----------------|--------------|--------|-------------|--------|------|
| Companies | CompVc (part of CUVc) | ~170 | **Company** | system | YES |
| Persons | UserVc | ~90 | **User** (already in auth) | auth/system | YES |
| Accounts | AccVc | 23 | **ChartOfAccount** | finance | YES |
| Tags/Objects | ObjVc | 6 | **Tag** | system | YES |
| Currencies | CurncyCodeVc | 31 | **Currency** | system | YES |
| Exchange Rates | ERVc | 7 | **ExchangeRate** | system | YES |
| Form Templates | FormDefVc | 5 | **DocumentTemplate** | system | P1 |
| Activities | ActVc | 80+ | **CrmActivity** | crm | P1 |
| Single Token Login | — | — | JWT auth (already designed) | auth | N/A |

**Settings (from legacy System module — classified for Nexa):**

| Legacy Setting | Nexa Equivalent | Storage | MVP? | Notes |
|---------------|-----------------|---------|------|-------|
| Company Info | Company model | DB | YES | Name, reg number, VAT, address, logo |
| Company Timezone | Company.timezone | DB | YES | IANA timezone string |
| Company Date and Numeric Format | Company.locale fields | DB | YES | Date format, decimal separator |
| Company Org. Numbers | Company.registrationNumber | DB | YES | Companies House number |
| Base Currency | Company.baseCurrencyCode | DB | YES | FK to Currency |
| Base Currency Rates | ExchangeRate model | DB | YES | Daily rates table |
| Number Series Defaults | NumberSeries model | DB | YES | Already designed in §2.8 |
| Departments | Department model | DB | YES | Reference entity |
| Countries | Country model | DB | YES | ISO codes, currency defaults |
| Locking / Global Locking | PeriodLock (already in §2.5) | DB | YES | Period-based transaction locks |
| Access Groups | Role + Permission (already in §3) | DB | YES | RBAC with 5 roles |
| Password Security | Auth config (already in §3) | DB | YES | Password rules, MFA |
| VAT Reg. Number Masks | VatCode.validationMask | DB | YES | Regex per country |
| Sub-ledger Control Accounts | **DEPRECATED** → `AccountMapping` (§2.13) | DB | YES | `SubLedgerControl` replaced by `AccountMapping` (27 mapping types with dept scoping). See §2.13. |
| Round Off / Currency Round Off | RoundingRule model | DB | YES | Per-currency rounding |
| Bank Holidays | BankHoliday model | DB | YES | Calendar for payment terms |
| Special Days | BankHoliday (merged) | DB | P1 | Special day types |
| Weeks | Company.weekStart | DB | YES | First day of week |
| Sales Groups | SalesGroup model | DB | P1 | Can live in Sales module |
| KPIs | AI-driven (§6.8 Daily Briefing) | Computed | P1 | Real-time, not static config |
| Discount Options | DiscountRule model | DB | P1 | Sales module |
| Configuration | SystemSetting key-value | DB | YES | Catch-all for tenant settings |
| Optional Features | ModuleToggle (existing) | DB | YES | Already designed |
| Tax Agent Info | Company.taxAgentFields | DB | P1 | Accountant/agent details |
| Nature of Business | Company.natureOfBusiness | DB | YES | SIC code |
| Journaling | Audit trail (§2.6) | DB | YES | Already designed |
| Auto Actions | AI Agent triggers (§6.3) | DB | P1 | Replaced by agent system |
| Automatic Exchange Rates | ExchangeRate service (BoE API) | Code | P1 | Scheduled job |
| Locking Exceptions | PeriodLockException model | DB | P2 | Override locks per user |
| Form Settings / Page Setup | DocumentTemplate model | DB | P2 | Print/PDF layout |
| Printer Settings / Printers | N/A | — | NO | Cloud — PDF download/email |
| Backup Settings / Remote Backups | N/A | — | NO | Cloud infrastructure |
| Cloud Security / Services | N/A | — | NO | Cloud infrastructure |
| Fingerprint Devices | Mobile biometric (§5) | Code | YES | Already in Expo |
| Display Groups / Styles | Theme system (CSS) | Code | P2 | Tailwind/Shadcn |
| Internet Enablers | N/A | — | NO | Cloud-native |
| Languages | i18n framework | Code | P2 | English-first for UK MVP |
| Values in Text | i18n framework | Code | P2 | Number-to-words per locale |
| Opened Record History | Audit trail (§2.6) | DB | YES | Already designed |
| Persons' Costs | Employee.costRate | DB | P1 | HR module |
| Reporting Periods (old) | FinancialPeriod (§2.5) | DB | YES | Already designed |
| Standard ID Client | N/A | — | NO | Legacy-specific |
| Task Manager Access | RBAC (§3) | DB | YES | Already designed |
| Global/User Warnings on UnOKed Records | Approval workflow rules | DB | P1 | Part of OKFlag pattern |
| Single Functions | N/A | — | NO | Legacy UI concept |

**MVP System Module Prisma Models:**

```prisma
// ═══════════════════════════════════════════════
// SYSTEM MODULE — Foundation Entities
// ═══════════════════════════════════════════════

model Company {
  id                    String   @id @default(uuid())
  name                  String                           // Trading name
  legalName             String?  @map("legal_name")      // Registered name if different
  registrationNumber    String?  @map("registration_no") // Companies House number
  vatNumber             String?  @map("vat_number")      // GB VAT registration
  utrNumber             String?  @map("utr_number")      // HMRC Unique Taxpayer Reference
  natureOfBusiness      String?  @map("nature_of_business") // SIC code
  baseCurrencyCode      String   @default("GBP") @map("base_currency") @db.VarChar(3) // FK to Currency
  isDefault             Boolean  @default(false) @map("is_default") // The "main" company
  isActive              Boolean  @default(true) @map("is_active")

  // Address
  addressLine1          String?  @map("address_line_1")
  addressLine2          String?  @map("address_line_2")
  city                  String?
  county                String?
  postcode              String?
  countryCode           String   @default("GB") @map("country_code") // FK to Country

  // Contact
  phone                 String?
  email                 String?
  website               String?

  // Configuration
  timezone              String   @default("Europe/London")
  weekStart             Int      @default(1) @map("week_start") // 1=Monday (ISO)
  dateFormat            String   @default("DD/MM/YYYY") @map("date_format")
  decimalSeparator      String   @default(".") @map("decimal_separator")
  thousandsSeparator    String   @default(",") @map("thousands_separator")
  vatScheme             String   @default("STANDARD") @map("vat_scheme") // STANDARD, FLAT_RATE, CASH
  defaultLanguage       String   @default("en") @map("default_language") // i18n: company default locale

  // Tax Agent (accountant details)
  taxAgentName          String?  @map("tax_agent_name")
  taxAgentPhone         String?  @map("tax_agent_phone")
  taxAgentEmail         String?  @map("tax_agent_email")

  // Branding
  logoUrl               String?  @map("logo_url")

  createdAt             DateTime @default(now()) @map("created_at")
  updatedAt             DateTime @updatedAt @map("updated_at")

  @@map("companies")
}

// Multi-Company: Register sharing between companies within a tenant
model RegisterSharingRule {
  id              String       @id @default(uuid())
  entityType      String       @map("entity_type")     // 'Customer', 'Item', 'Supplier', 'ChartOfAccount'
  sharingMode     SharingMode  @map("sharing_mode")
  sourceCompanyId String       @map("source_company_id")
  targetCompanyId String?      @map("target_company_id") // null if ALL_COMPANIES

  sourceCompany   Company      @relation("SharingSource", fields: [sourceCompanyId], references: [id])
  targetCompany   Company?     @relation("SharingTarget", fields: [targetCompanyId], references: [id])

  @@map("register_sharing_rules")
  @@unique([entityType, sourceCompanyId, targetCompanyId], map: "uq_sharing_rule")
}

enum SharingMode {
  NONE             // Default — company-only access
  ALL_COMPANIES    // Visible to all companies in tenant
  SELECTED         // Visible only to specified target company
}

// Multi-Company: Per-company RBAC (global role + per-company exceptions)
model UserCompanyRole {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  companyId String?  @map("company_id")  // NULL = global role (applies to all companies)
  role      UserRole

  user      User     @relation(fields: [userId], references: [id])
  company   Company? @relation(fields: [companyId], references: [id])

  @@map("user_company_roles")
  @@unique([userId, companyId], map: "uq_user_company_role")
}

// RBAC resolution: 1) company-specific role, 2) global role (companyId=NULL), 3) no access

model Currency {
  code                  String   @id @db.VarChar(3)      // ISO 4217: GBP, USD, EUR
  name                  String                           // "British Pound Sterling"
  symbol                String                           // "£"
  minorUnit             Int      @default(2)             // Decimal places (2 for GBP, 0 for JPY)
  isActive              Boolean  @default(true)

  // Rounding rules (per-currency override)
  roundTotal            Int      @default(2)             // Decimals for totals
  roundVat              Int      @default(2)             // Decimals for VAT
  roundLine             Int      @default(2)             // Decimals for line items

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  exchangeRates         ExchangeRate[]

  @@map("currencies")
}

model ExchangeRate {
  id                    String   @id @default(uuid())
  currencyCode          String   @db.VarChar(3)          // Foreign currency
  rateDate              DateTime @db.Date                 // Effective date
  buyRate               Decimal  @db.Decimal(18, 8)      // Buy rate (foreign → base)
  sellRate              Decimal  @db.Decimal(18, 8)      // Sell rate (base → foreign)
  midRate               Decimal  @db.Decimal(18, 8)      // Mid-market rate
  source                String   @default("MANUAL")      // BOE, ECB, MANUAL

  createdAt             DateTime @default(now())

  currency              Currency @relation(fields: [currencyCode], references: [code])

  @@unique([currencyCode, rateDate])
  @@index([rateDate])
  @@map("exchange_rates")
}

model Country {
  code                  String   @id @db.VarChar(2)      // ISO 3166-1 alpha-2: GB, US, DE
  iso3Code              String   @db.VarChar(3)          // ISO 3166-1 alpha-3: GBR, USA, DEU
  name                  String                           // "United Kingdom"
  defaultCurrencyCode   String?  @db.VarChar(3)          // FK to Currency
  region                String?                          // EU, EEA, Rest of World
  vatPrefix             String?                          // "GB" for UK VAT numbers
  dateFormat            String?                          // Country default date format
  isActive              Boolean  @default(true)

  createdAt             DateTime @default(now())

  @@map("countries")
}

model Department {
  id                    String   @id @default(uuid())
  code                  String   @unique                 // "FIN", "SALES", "OPS"
  name                  String                           // "Finance"
  costCentre            String?                          // GL cost centre code
  managerId             String?                          // FK to User
  isActive              Boolean  @default(true)

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@map("departments")
}

model PaymentTerms {
  id                    String   @id @default(uuid())
  code                  String   @unique                 // "NET30", "COD", "NET14"
  name                  String                           // "Net 30 Days"
  dueDays               Int                              // 30
  discountPercent       Decimal? @db.Decimal(5, 2)       // 2.00 (for 2% early pay)
  discountDays          Int?                             // 10 (2/10 Net 30)
  isDefault             Boolean  @default(false)
  isActive              Boolean  @default(true)

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@map("payment_terms")
}

model VatCode {
  id                    String   @id @default(uuid())
  code                  String   @unique                 // "S", "R", "Z", "E", "OS", "RC"
  name                  String                           // "Standard Rate"
  rate                  Decimal  @db.Decimal(5, 2)       // 20.00
  type                  VatType                          // Enum
  salesAccountCode      String?                          // GL account for sales VAT
  purchaseAccountCode   String?                          // GL account for purchase VAT
  isDefault             Boolean  @default(false)         // Default for new items/invoices
  isActive              Boolean  @default(true)

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@map("vat_codes")
}

enum VatType {
  STANDARD              // 20%
  REDUCED               // 5%
  ZERO                  // 0%
  EXEMPT                // Not VAT-registered items
  OUTSIDE_SCOPE         // Outside UK VAT scope
  REVERSE_CHARGE        // B2B cross-border
  SECOND_HAND           // Margin scheme
}

model Tag {
  id                    String   @id @default(uuid())
  code                  String                           // "PREMIUM", "VIP", "OVERDUE"
  name                  String                           // "Premium Customer"
  tagType               String                           // "customer", "item", "order", "general"
  color                 String   @default("#6366F1")     // Hex colour for UI badges
  isActive              Boolean  @default(true)

  createdAt             DateTime @default(now())

  @@unique([code, tagType])
  @@map("tags")
}

model BankHoliday {
  id                    String   @id @default(uuid())
  name                  String                           // "Christmas Day"
  date                  DateTime @db.Date                // 2026-12-25
  countryCode           String   @db.VarChar(2)          // "GB"
  holidayType           String   @default("PUBLIC")      // PUBLIC, COMPANY, SPECIAL
  isRecurring           Boolean  @default(false)         // Same date every year

  createdAt             DateTime @default(now())

  @@unique([date, countryCode])
  @@map("bank_holidays")
}

// ──────────────────────────────────────────────────────────────────
// DEPRECATED: SubLedgerControl → replaced by AccountMapping (§2.13)
// The 5-row, 5-field model cannot represent the 27+ mapping types
// needed for full GL wiring (HansaWorld AccBlock = 62+ fields).
// AccountMapping supports department-scoped overrides.
// DROP this model in the Story 4 migration.
// ──────────────────────────────────────────────────────────────────
// model SubLedgerControl {
//   id                    String   @id @default(uuid())
//   subLedgerType         String   @unique
//   controlAccountCode    String
//   roundingAccountCode   String?
//   exchangeGainCode      String?
//   exchangeLossCode      String?
//   createdAt             DateTime @default(now())
//   updatedAt             DateTime @updatedAt
//   @@map("sub_ledger_controls")
// }

model SystemSetting {
  id                    String   @id @default(uuid())
  key                   String   @unique                 // "invoice.autoApproveBelow", "ar.interestRate"
  value                 String                           // JSON-serialised value
  valueType             String   @default("STRING")      // STRING, NUMBER, BOOLEAN, JSON
  category              String   @default("general")     // "general", "finance", "ar", "ap", "inventory"
  description           String?                          // Human-readable description

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([category])
  @@map("system_settings")
}
```

**Seed Data (provisioned per new tenant):**

```typescript
// Essential reference data seeded during tenant provisioning

// UK VAT Codes
const UK_VAT_CODES = [
  { code: 'S',  name: 'Standard Rate',    rate: 20.00, type: 'STANDARD' },
  { code: 'R',  name: 'Reduced Rate',     rate: 5.00,  type: 'REDUCED' },
  { code: 'Z',  name: 'Zero Rate',        rate: 0.00,  type: 'ZERO' },
  { code: 'E',  name: 'Exempt',           rate: 0.00,  type: 'EXEMPT' },
  { code: 'OS', name: 'Outside Scope',    rate: 0.00,  type: 'OUTSIDE_SCOPE' },
  { code: 'RC', name: 'Reverse Charge',   rate: 0.00,  type: 'REVERSE_CHARGE' },
];

// Common Currencies
const CURRENCIES = [
  { code: 'GBP', name: 'British Pound Sterling', symbol: '£',  minorUnit: 2 },
  { code: 'USD', name: 'US Dollar',              symbol: '$',  minorUnit: 2 },
  { code: 'EUR', name: 'Euro',                   symbol: '€',  minorUnit: 2 },
];

// UK Payment Terms
const PAYMENT_TERMS = [
  { code: 'COD',   name: 'Cash on Delivery',   dueDays: 0 },
  { code: 'NET7',  name: 'Net 7 Days',         dueDays: 7 },
  { code: 'NET14', name: 'Net 14 Days',        dueDays: 14 },
  { code: 'NET30', name: 'Net 30 Days',        dueDays: 30, isDefault: true },
  { code: 'NET60', name: 'Net 60 Days',        dueDays: 60 },
  { code: 'EOM',   name: 'End of Month',       dueDays: 30 },
];

// Number Series
const NUMBER_SERIES = [
  { entityType: 'INVOICE',         prefix: 'INV-',  nextValue: 1, padding: 5 },
  { entityType: 'CREDIT_NOTE',     prefix: 'CN-',   nextValue: 1, padding: 5 },
  { entityType: 'SALES_ORDER',     prefix: 'SO-',   nextValue: 1, padding: 5 },
  { entityType: 'SALES_QUOTE',     prefix: 'QT-',   nextValue: 1, padding: 5 },
  { entityType: 'PURCHASE_ORDER',  prefix: 'PO-',   nextValue: 1, padding: 5 },
  { entityType: 'BILL',            prefix: 'BIL-',  nextValue: 1, padding: 5 },
  { entityType: 'JOURNAL',         prefix: 'JE-',   nextValue: 1, padding: 5 },
  { entityType: 'PAYMENT',         prefix: 'PAY-',  nextValue: 1, padding: 5 },
  { entityType: 'SHIPMENT',        prefix: 'SHP-',  nextValue: 1, padding: 5 },
  { entityType: 'GOODS_RECEIPT',   prefix: 'GRN-',  nextValue: 1, padding: 5 },
  { entityType: 'EMPLOYEE',        prefix: 'EMP-',  nextValue: 1, padding: 4 },
  { entityType: 'CUSTOMER',        prefix: 'CUS-',  nextValue: 1, padding: 5 },
  { entityType: 'SUPPLIER',        prefix: 'SUP-',  nextValue: 1, padding: 5 },
];

// UK Bank Holidays (2026)
const UK_BANK_HOLIDAYS_2026 = [
  { name: "New Year's Day",       date: '2026-01-01', isRecurring: true },
  { name: 'Good Friday',          date: '2026-04-03', isRecurring: false },
  { name: 'Easter Monday',        date: '2026-04-06', isRecurring: false },
  { name: 'Early May Bank Holiday', date: '2026-05-04', isRecurring: false },
  { name: 'Spring Bank Holiday',  date: '2026-05-25', isRecurring: false },
  { name: 'Summer Bank Holiday',  date: '2026-08-31', isRecurring: false },
  { name: 'Christmas Day',        date: '2026-12-25', isRecurring: true },
  { name: 'Boxing Day',           date: '2026-12-26', isRecurring: true },
];

// Sub-Ledger Control Accounts (using FRS 102 defaults)
const SUB_LEDGER_CONTROLS = [
  { subLedgerType: 'AR',      controlAccountCode: '1100' },
  { subLedgerType: 'AP',      controlAccountCode: '2100' },
  { subLedgerType: 'STOCK',   controlAccountCode: '1200' },
  { subLedgerType: 'PAYROLL', controlAccountCode: '2200' },
  { subLedgerType: 'VAT',     controlAccountCode: '2201' },
];

// Countries (top trading partners for UK SMEs)
const COUNTRIES = [
  { code: 'GB', iso3Code: 'GBR', name: 'United Kingdom',  defaultCurrencyCode: 'GBP', region: 'UK',    vatPrefix: 'GB' },
  { code: 'IE', iso3Code: 'IRL', name: 'Ireland',         defaultCurrencyCode: 'EUR', region: 'EU',    vatPrefix: 'IE' },
  { code: 'US', iso3Code: 'USA', name: 'United States',   defaultCurrencyCode: 'USD', region: 'ROW' },
  { code: 'DE', iso3Code: 'DEU', name: 'Germany',         defaultCurrencyCode: 'EUR', region: 'EU',    vatPrefix: 'DE' },
  { code: 'FR', iso3Code: 'FRA', name: 'France',          defaultCurrencyCode: 'EUR', region: 'EU',    vatPrefix: 'FR' },
  { code: 'NL', iso3Code: 'NLD', name: 'Netherlands',     defaultCurrencyCode: 'EUR', region: 'EU',    vatPrefix: 'NL' },
  { code: 'BE', iso3Code: 'BEL', name: 'Belgium',         defaultCurrencyCode: 'EUR', region: 'EU',    vatPrefix: 'BE' },
  { code: 'ES', iso3Code: 'ESP', name: 'Spain',           defaultCurrencyCode: 'EUR', region: 'EU',    vatPrefix: 'ES' },
  { code: 'IT', iso3Code: 'ITA', name: 'Italy',           defaultCurrencyCode: 'EUR', region: 'EU',    vatPrefix: 'IT' },
  { code: 'CN', iso3Code: 'CHN', name: 'China',           defaultCurrencyCode: 'CNY', region: 'ROW' },
  { code: 'IN', iso3Code: 'IND', name: 'India',           defaultCurrencyCode: 'INR', region: 'ROW' },
  { code: 'AE', iso3Code: 'ARE', name: 'United Arab Emirates', defaultCurrencyCode: 'AED', region: 'ROW' },
  // Full ISO list loaded from static file during initial provisioning
];
```

**System Module API Routes:**

```
POST/GET/PATCH   /api/v1/company-profile        # Single-row company config
GET/POST         /api/v1/currencies              # Currency CRUD
GET/POST         /api/v1/exchange-rates           # FX rates (manual + auto)
GET              /api/v1/exchange-rates/latest    # Latest rate for a currency
GET/POST         /api/v1/countries                # Country list
GET/POST         /api/v1/departments              # Department CRUD
GET/POST         /api/v1/payment-terms            # Payment terms CRUD
GET/POST         /api/v1/vat-codes                # VAT code CRUD
GET/POST         /api/v1/tags                     # Tag CRUD
GET/POST         /api/v1/bank-holidays            # Bank holiday CRUD
GET/POST         /api/v1/number-series            # Number series config
GET/PATCH        /api/v1/sub-ledger-controls      # Sub-ledger account mapping
GET/POST/PATCH   /api/v1/system-settings          # Key-value settings
```

All system module list endpoints support:
- `?isActive=true` filter (LOV queries — default for dropdown/select)
- `?includeInactive=true` (admin list views)
- Saved views (§2.9) for admin screens

**AI Integration:**

System module entities are available as AI tool parameters. Examples:
- "Set up a new currency for Japanese Yen" → AI calls `POST /api/v1/currencies` with `{ code: 'JPY', name: 'Japanese Yen', symbol: '¥', minorUnit: 0 }`
- "Add NET45 payment terms" → AI calls `POST /api/v1/payment-terms`
- "What's today's USD to GBP rate?" → AI calls `GET /api/v1/exchange-rates/latest?currency=USD`
- "Update company VAT number to GB123456789" → AI calls `PATCH /api/v1/company-profile`
- "Show me all active departments" → AI calls `GET /api/v1/departments?isActive=true`

**Build Sequence:**

System module is **Story 1b** — built immediately after the database package (Story 1) and before the API server foundation (Story 2). All other modules depend on system reference data (currencies on invoices, payment terms on customers, VAT codes on line items, departments on employees).

### 2.11 Technics Module — Legacy Mapping & Triage

The HansaWorld **Technics** module contains server administration, synchronisation, telephony, and hardware-integration features. Most are desktop/server-specific and do not apply to a cloud-native SaaS ERP. This section catalogues everything and classifies each as **MVP**, **P1**, **P2**, or **Not Needed**.

**Technics Registers — Legacy → Nexa Mapping**

| Legacy Register | HAL Source | Fields | Nexa Mapping | Priority |
|----------------|-----------|--------|-------------|----------|
| GlobalUserVc | datadef8.hal | 27 fields (Code, Name, AccessGroup, emailAddr, LangCode, TypeOfUser, etc.) | **Already covered** by `User` model in RBAC (§3). Global user concept maps to platform-level user management. | MVP (done) |
| ODBCEventVc | datadef2.hal | 7 fields (Code, Event, Type, RecordTyp, Sequence) | **Not Needed** — ODBC is desktop-era technology. Nexa uses REST API + event bus for integrations. | Not Needed |
| FaxQueVc | datadef1.hal | 8 fields (FaxNo, Address, DocName, Contact, TransDate) | **Not Needed** — Fax is obsolete. Nexa uses email for document delivery. | Not Needed |
| HobSignaturesVc | datadef10.hal | 5 fields (Signature, ProtVer, Name, Product, Status) | **Not Needed** — HansaWorld product licensing signatures. Nexa uses its own subscription management. | Not Needed |
| HALRulesVc | datadef9.hal | 4 fields (Filename, FileOnClient, Math, RequireRestart) | **Not Needed** — HAL runtime extension mechanism. Nexa uses TypeScript modules, not HAL plugins. | Not Needed |
| EmailAliasVc | datadef5.hal | 8 fields (Pop3Serv, InternalName, MatchText, Priority) | **Mapped to email routing** — Nexa uses transactional email (SendGrid/SES). Inbound email parsing for bill ingestion (FR32) uses a dedicated adapter, not alias routing. | P1 (partial) |
| EmailAddrVc | datadef11.hal | 4 fields (SerNr, AddrName, AddrCode, Math) | **Mapped to Contact model** — Email addresses stored on Customer, Supplier, Employee, User entities directly. No separate email address register needed. | MVP (done) |
| EmailRecipVc | datadef11.hal | 3 fields + matrix (DocType, ContactCode, ContactName) | **Mapped to Document Templates** — Nexa §2.12 (below) handles per-document-type email recipients via template rules. | P1 |
| LoginActionVc | datadef11.hal | Automation rules triggered on login | **Mapped to login hooks** — Nexa can run BullMQ jobs on `user.login` event (e.g., refresh dashboard data, check for alerts). | P1 |
| TimedImportVc | datadef11.hal | Scheduled file imports | **Mapped to BullMQ** — Scheduled jobs for bank feed imports, HMRC polling, etc. Already designed in worker architecture. | MVP (done) |
| TimedMaintVc | datadef11.hal | 12 fields (SerNr, RequestedBy, ApprovedBy, Date, OKFlag) | **Mapped to BullMQ** — Maintenance windows and scheduled tasks handled by BullMQ cron jobs + admin dashboard. | P1 |
| MobileDeviceVc | datadef11.hal | Device registration for sync | **Mapped to push notifications** — Expo push tokens stored on User model for mobile notifications. No separate device register needed. | MVP (done) |
| PollRegWithSyncVc | datadef11.hal | Register sync polling | **Not Needed** — HansaWorld-specific client-server sync. Nexa uses real-time WebSocket + REST API. | Not Needed |
| PositionAlertVc | datadef10.hal | GPS-based alerts | **Not Needed** — Geofencing not in MVP scope. Could be P2 for field workforce tracking. | P2 |
| RegArchiveVc | datadef10.hal | Archive old register data | **Mapped to data archival** — Nexa uses PostgreSQL partitioning for old data + S3 for cold storage. No separate register needed. | P2 |
| BiometricSignVc | datadef11.hal | Biometric signature storage | **Not Needed** — Specialised hardware integration. Nexa uses standard digital signatures (TOTP MFA + e-signatures via DocuSign P2). | Not Needed |
| RemoteAccessVc | datadef11.hal | Remote device access | **Not Needed** — HansaWorld server management. Nexa is cloud-native with standard HTTPS access. | Not Needed |
| EmailValidationVc | datadef11.hal | 8 fields (Email, Status, Language) | **Mapped to email verification** — Nexa validates email addresses during user/customer creation via format validation + optional verification email. | MVP (done) |

**Technics Settings — Legacy → Nexa Mapping**

| Legacy Setting | Nexa Mapping | Priority | Notes |
|---------------|-------------|----------|-------|
| Access to Functions from Web | RBAC module-level gating (§3) | MVP (done) | Already in RBAC guard middleware |
| AI Link | AI Orchestrator (§6) | MVP (done) | Nexa's AI infrastructure replaces this |
| Alarms | Notification service (BullMQ + WebSocket) | P1 | Alert rules configurable in admin |
| Archives | Data archival policy (PostgreSQL + S3) | P2 | Not MVP; partition old data later |
| Biometric Signatures | Not Needed | — | Hardware-specific |
| Client Integration | Not Needed | — | Desktop client concept; Nexa is web/mobile |
| CRM Limitations | RBAC + CRM module config | MVP (done) | Per-role CRM access in RBAC |
| Database Log | Audit trail (§3.4 AuditLog) | MVP (done) | Immutable audit log replaces DB log |
| Database Status | Health endpoints + admin dashboard | MVP (done) | `/health` + `/ready` endpoints |
| Escape Sequences | Not Needed | — | Terminal printer control codes |
| Fax Settings | Not Needed | — | Fax is obsolete |
| Fields Settings | **Dynamic field visibility** | P1 | Per-role field show/hide rules on forms |
| Global CRM Settings | CRM module config (SystemSetting) | P1 | Key-value settings per module |
| HAL Rules | Not Needed | — | HAL-specific extension mechanism |
| Item Buttons / Item Tile Labels | **UI customisation** | P2 | Custom action buttons and labels on item cards |
| Limited Access | RBAC per-register access (§3) | MVP (done) | Role-based entity-level access |
| Local Machines / Local Settings | Not Needed | — | Desktop-specific machine config |
| Logging Control | Structured logging config (§8 Observability) | MVP (done) | Winston log levels per module |
| Login Actions | Login event hooks (BullMQ) | P1 | Run tasks on `user.login` event |
| Login Shortcuts | **User dashboard shortcuts** | P1 | Configurable quick-action buttons on dashboard |
| Macro | **Automation rules** | P2 | User-defined automation triggers (if/then rules) |
| Mailboxes / Mailbox Browse | Email integration (transactional email) | P1 | SendGrid/SES; no POP3/IMAP inbox management |
| Mobile Devices | Push notification tokens (Expo) | MVP (done) | Token stored on User model |
| MS Exchange | Not Needed | — | Nexa uses generic SMTP/API email, not Exchange-specific |
| Navigation Links / Web Nav Links | **Module navigation config** | MVP (done) | React Router + sidebar config already designed |
| ODBC Links | Not Needed | — | Desktop-era database connectivity |
| Password Server | Auth service (JWT + Argon2id) (§3) | MVP (done) | Modern auth replaces password server |
| Receipt Printer Texts per Machine | **Document Templates** (§2.12 below) | P1 | Receipt/printer templates per location |
| Register Observations | **Entity change subscriptions** | P2 | Watch specific records for changes; notify via WebSocket |
| Report Specifications | **Document Templates** (§2.12 below) | MVP | Core feature — see next section |
| Relational DB Registers/Settings | Not Needed | — | Internal HansaWorld DB engine config |
| Secondary Servers | Not Needed | — | Single cloud deployment; horizontal scaling via containers |
| Serial Printer | Not Needed | — | Legacy hardware integration |
| Shared Blocks / Shared Registers | Not Needed | — | Internal HansaWorld data sharing mechanism |
| SIP Servers | Not Needed | — | VoIP integration; not in scope |
| Sync Settings / Sync Serial Numbers / Sync DB ID | Not Needed | — | HansaWorld multi-server sync; Nexa is single-source cloud |
| System Logs | Structured logging + log aggregation | MVP (done) | Winston → stdout → log aggregation (CloudWatch/Loki) |
| TAPI Gateway | Not Needed | — | Telephony hardware integration |
| Timed Imports / Timed Maintenances / Timed Operations | BullMQ cron jobs | MVP (done) | Already designed as BullMQ workers |
| User Actions | Audit trail + activity logging | MVP (done) | AuditLog + CrmActivity models |
| Web Client Settings | **Tenant UI preferences** | P1 | Theme, language, date format, landing page per user |

**Triage Summary:**
- **Already covered in MVP**: 18 items (RBAC, auth, audit, logging, BullMQ jobs, email, mobile, navigation)
- **P1 (post-MVP)**: 10 items (dynamic fields, login hooks, dashboard shortcuts, web client settings, alarms, email routing, mailboxes, CRM settings, receipt templates, timed maintenance)
- **P2 (future)**: 5 items (macros/automation, register observations, item buttons/labels, archives, geofencing)
- **Not Needed**: 27 items (fax, ODBC, SIP, TAPI, serial printers, HAL rules, biometrics, desktop-specific, sync, secondary servers)

### 2.12 Document Templates & PDF Generation

HansaWorld's `FormDefVc` register provides configurable document templates (invoices, receipts, statements, POs, delivery notes) with multi-version selection based on document type, language, customer, branch, user group, and number series. This is a critical business feature — every ERP user expects to customise their printed/emailed documents with company branding, layout preferences, and conditional content.

**Legacy Architecture (FormDefVc):**

| Legacy Component | HAL Source | Purpose |
|-----------------|-----------|---------|
| FormDefVc | datadef4.hal | Template definitions with matrix of versions (LangCode, UserGroup, FPCode, Typ, PrintGroupCode) |
| RcVc | datadef3.hal | Runtime report specification (media, language, form parameters) |
| GetInvoiceFormCode() | RemoteTools9.hal | Version selection logic: Document Type → Language → User Group → Print Group |
| DoInvFormTool3.hal | Documents/ | Invoice form rendering (130+ form files in Documents/) |

**Legacy Selection Hierarchy:**
1. **Document Type** — Cash invoice, credit note, interest invoice, project invoice, standard invoice → each has its own base form name
2. **Language** — Exact match on customer/invoice language code, fallback to default
3. **User Group** — Role-based form version (e.g., managers see different layout)
4. **Print Group / Number Series** — Organisational or branch-based selection
5. **Type Flags (Typ bitmask)** — Fine-grained control via OKFlag matching

**Nexa Architecture:**

Nexa replaces the HAL form system with a modern HTML-to-PDF pipeline using React Email templates and Puppeteer/Playwright for PDF rendering. Templates are stored in the database (not as HAL files) and rendered server-side.

**Prisma Models:**

```prisma
enum DocumentType {
  SALES_INVOICE
  CREDIT_NOTE
  CASH_RECEIPT
  PROFORMA_INVOICE
  CUSTOMER_STATEMENT
  SALES_ORDER
  SALES_QUOTE
  DELIVERY_NOTE
  PURCHASE_ORDER
  GOODS_RECEIPT_NOTE
  SUPPLIER_REMITTANCE
  PAYSLIP
  P45
  P60
}

model DocumentTemplate {
  id              String         @id @default(cuid())
  name            String                          // e.g., "Standard Invoice", "Cash Receipt"
  documentType    DocumentType                    // Which document this template generates
  description     String?
  isDefault       Boolean        @default(false)  // Default template for this document type
  isActive        Boolean        @default(true)

  // Template content (HTML with Handlebars/Mustache placeholders)
  htmlTemplate    String         @db.Text         // HTML template body
  headerHtml      String?        @db.Text         // Optional header override
  footerHtml      String?        @db.Text         // Optional footer override
  cssStyles       String?        @db.Text         // Custom CSS for this template

  // Page settings
  pageSize        String         @default("A4")   // A4, A5, Letter, Custom
  orientation     String         @default("portrait") // portrait, landscape
  marginTop       Decimal        @default(20)     @db.Decimal(5,1) // mm
  marginBottom    Decimal        @default(20)     @db.Decimal(5,1)
  marginLeft      Decimal        @default(15)     @db.Decimal(5,1)
  marginRight     Decimal        @default(15)     @db.Decimal(5,1)

  // Branding
  showLogo        Boolean        @default(true)
  logoPosition    String         @default("top-left") // top-left, top-center, top-right
  showBankDetails Boolean        @default(true)
  showVatNumber   Boolean        @default(true)
  showCompanyReg  Boolean        @default(true)

  // Metadata
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  createdBy       String

  // Relations
  versions        DocumentTemplateVersion[]

  @@unique([documentType, name])
  @@index([documentType, isActive])
}

model DocumentTemplateVersion {
  id              String         @id @default(cuid())
  templateId      String
  template        DocumentTemplate @relation(fields: [templateId], references: [id])

  // Selection criteria (all optional — more specific = higher priority)
  languageCode    String?                         // e.g., "en", "fr", "ar"
  branchCode      String?                         // Branch/department code
  numberSeriesId  String?                         // Specific number series
  accessGroup     String?                         // User role/access group
  customerGroupId String?                         // Customer classification

  // Version-specific overrides
  htmlOverride    String?        @db.Text         // Override base template HTML
  cssOverride     String?        @db.Text         // Override base template CSS
  headerOverride  String?        @db.Text
  footerOverride  String?        @db.Text

  // Email settings for this version
  emailSubject    String?                         // e.g., "Invoice {{invoiceNumber}} from {{companyName}}"
  emailBody       String?        @db.Text         // Email body template (HTML)
  replyToEmail    String?                         // Override reply-to address
  ccEmails        String?                         // Comma-separated CC addresses

  priority        Int            @default(0)      // Higher = checked first
  isActive        Boolean        @default(true)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([templateId, isActive, priority])
  @@index([languageCode])
  @@index([branchCode])
}
```

**Version Selection Algorithm:**

When a user clicks "Print Invoice" or "Email Statement", the system selects the best template version:

```typescript
// modules/system/services/document-template.service.ts
async function selectTemplateVersion(
  documentType: DocumentType,
  context: {
    languageCode?: string;    // From invoice/customer language
    branchCode?: string;      // From invoice branch or user branch
    numberSeriesId?: string;  // From document number series
    accessGroup?: string;     // From current user's role
    customerGroupId?: string; // From customer classification
  }
): Promise<DocumentTemplateVersion> {
  // 1. Find active template for this document type
  const template = await findActiveTemplate(documentType);

  // 2. Score each version against context (more matches = higher score)
  const versions = template.versions
    .filter(v => v.isActive)
    .map(v => ({
      version: v,
      score: calculateMatchScore(v, context),
    }))
    .sort((a, b) => {
      // Primary: match score (descending)
      if (b.score !== a.score) return b.score - a.score;
      // Secondary: explicit priority (descending)
      return b.version.priority - a.version.priority;
    });

  // 3. Return best match, or base template if no version matches
  return versions[0]?.version ?? template;
}

function calculateMatchScore(version: DocumentTemplateVersion, context: Context): number {
  let score = 0;
  // Each matching criterion adds to score; null criteria are wildcards
  if (version.languageCode && version.languageCode === context.languageCode) score += 10;
  if (version.branchCode && version.branchCode === context.branchCode) score += 8;
  if (version.numberSeriesId && version.numberSeriesId === context.numberSeriesId) score += 6;
  if (version.accessGroup && version.accessGroup === context.accessGroup) score += 4;
  if (version.customerGroupId && version.customerGroupId === context.customerGroupId) score += 2;
  // Penalise mismatches (non-null criterion that doesn't match)
  if (version.languageCode && version.languageCode !== context.languageCode) score -= 20;
  if (version.branchCode && version.branchCode !== context.branchCode) score -= 16;
  return score;
}
```

**PDF Generation Pipeline:**

```
User clicks "Print" / "Email"
  │
  ├─ 1. Select template version (algorithm above)
  ├─ 2. Load data context:
  │     ├─ Document data (invoice lines, totals, VAT breakdown)
  │     ├─ Company data (Company: name, address, logo, bank details, VAT number)
  │     ├─ Customer/Supplier data (name, address, VAT number)
  │     └─ Metadata (date, number, currency, exchange rate)
  ├─ 3. Render HTML (Handlebars template engine)
  │     ├─ Merge template HTML + version overrides
  │     ├─ Inject data into {{placeholders}}
  │     └─ Apply CSS styles
  ├─ 4. Generate PDF (Puppeteer headless Chrome)
  │     ├─ page.setContent(renderedHtml)
  │     ├─ page.pdf({ format, margins, header, footer })
  │     └─ Return PDF buffer
  ├─ 5. Output:
  │     ├─ Preview → return PDF to browser (inline display)
  │     ├─ Download → return PDF as attachment
  │     ├─ Email → queue email with PDF attachment (BullMQ)
  │     └─ Store → save to S3/MinIO for document archive
  └─ 6. Audit log: who generated what, when, which version selected
```

**Architecture Location:**

```
api/src/
  modules/
    system/
      services/
        document-template.service.ts    # Template CRUD + version selection
        pdf-generator.service.ts         # HTML → PDF conversion (Puppeteer)
      routes/
        document-template.routes.ts      # Admin: manage templates
      templates/                         # Default HTML templates (seeded)
        invoice.html
        credit-note.html
        statement.html
        sales-order.html
        delivery-note.html
        purchase-order.html
        receipt.html
        payslip.html
        p45.html
        p60.html
  workers/
    pdf-generate.worker.ts              # BullMQ worker for async PDF generation
    email-send.worker.ts                # BullMQ worker for email delivery (already planned)
```

**API Endpoints:**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/document-templates` | List all templates (with filters) |
| GET | `/api/v1/document-templates/:id` | Get template with versions |
| POST | `/api/v1/document-templates` | Create template |
| PATCH | `/api/v1/document-templates/:id` | Update template |
| POST | `/api/v1/document-templates/:id/versions` | Add version to template |
| PATCH | `/api/v1/document-templates/:id/versions/:versionId` | Update version |
| DELETE | `/api/v1/document-templates/:id/versions/:versionId` | Remove version |
| POST | `/api/v1/document-templates/:id/preview` | Preview PDF with sample data |
| POST | `/api/v1/documents/generate` | Generate document PDF for a specific record |
| POST | `/api/v1/documents/email` | Generate and email document |
| POST | `/api/v1/documents/batch-generate` | Batch generate (e.g., all customer statements) |

**Seed Data (MVP Templates):**

10 default templates seeded per tenant:
1. **Standard Invoice** (SALES_INVOICE) — UK-standard layout with logo, company details, line items, VAT summary, bank details, payment terms
2. **Credit Note** (CREDIT_NOTE) — Similar to invoice with "CREDIT NOTE" header, reference to original invoice
3. **Cash Receipt** (CASH_RECEIPT) — Compact receipt format for POS/cash sales
4. **Proforma Invoice** (PROFORMA_INVOICE) — "PROFORMA" watermark, no GL posting
5. **Customer Statement** (CUSTOMER_STATEMENT) — Aging bands, opening/closing balance, list of transactions
6. **Sales Order Confirmation** (SALES_ORDER) — Order details, delivery address, expected ship date
7. **Sales Quote** (SALES_QUOTE) — Quote details with validity period and terms
8. **Delivery Note** (DELIVERY_NOTE) — Shipping details, packing list, no prices
9. **Purchase Order** (PURCHASE_ORDER) — Supplier details, delivery requirements, authorised by
10. **Payslip** (PAYSLIP) — HMRC-compliant format: gross, deductions, NI, tax, net, YTD figures

**Template Placeholder Reference:**

Templates use Handlebars syntax. Common placeholders available across all templates:

| Placeholder | Source | Example |
|------------|--------|---------|
| `{{company.name}}` | Company | "Acme Ltd" |
| `{{company.address}}` | Company | "123 High Street, London EC1A 1BB" |
| `{{company.vatNumber}}` | Company | "GB 123 456 789" |
| `{{company.companyNumber}}` | Company | "12345678" |
| `{{company.bankName}}` | Company | "Barclays Bank" |
| `{{company.bankSortCode}}` | Company | "20-00-00" |
| `{{company.bankAccountNumber}}` | Company | "12345678" |
| `{{company.logoUrl}}` | Company (S3 URL) | Logo image |
| `{{document.number}}` | Invoice/Order/etc. | "INV-00042" |
| `{{document.date}}` | Document | "15/02/2026" |
| `{{document.dueDate}}` | Document | "17/03/2026" |
| `{{customer.name}}` | Customer/Supplier | "Widget Corp Ltd" |
| `{{customer.address}}` | Customer/Supplier | Full formatted address |
| `{{customer.vatNumber}}` | Customer/Supplier | "GB 987 654 321" |
| `{{lines}}` | Line items array | `{{#each lines}}...{{/each}}` |
| `{{line.description}}` | Line item | "Widget Type A" |
| `{{line.quantity}}` | Line item | "100" |
| `{{line.unitPrice}}` | Line item (formatted) | "£50.00" |
| `{{line.vatRate}}` | Line item | "20%" |
| `{{line.lineTotal}}` | Line item (formatted) | "£5,000.00" |
| `{{totals.subtotal}}` | Calculated | "£5,000.00" |
| `{{totals.vatAmount}}` | Calculated | "£1,000.00" |
| `{{totals.total}}` | Calculated | "£6,000.00" |
| `{{totals.amountDue}}` | Calculated (total - payments) | "£6,000.00" |
| `{{currency.code}}` | Document currency | "GBP" |
| `{{currency.symbol}}` | Document currency | "£" |
| `{{paymentTerms.name}}` | Payment terms | "Net 30" |
| `{{formatDate date "DD/MM/YYYY"}}` | Helper function | Formatted date |
| `{{formatMoney amount currency}}` | Helper function | "£1,234.56" |

**AI Integration:**

- "Print invoice INV-00042" → AI calls `POST /api/v1/documents/generate` with `{ documentType: 'SALES_INVOICE', recordId: 'xxx' }` → returns PDF URL
- "Email all outstanding statements to customers" → AI calls `POST /api/v1/documents/batch-generate` with `{ documentType: 'CUSTOMER_STATEMENT', filter: 'outstanding' }`
- "Change the invoice template to show bank details on the right side" → admin UI / AI guidance for template editing

**Build Sequence:**

Document Templates is **Story 5b** — built after the web frontend shell (Story 5) since the template editor is an admin UI feature. The PDF generation service is part of the system module backend (Story 1b) but the full template editor and preview requires the frontend. Default templates are seeded with the database (Story 1).

### 2.13 Finance Module — GL, Banking & Budgets

The architecture already establishes foundational concepts for the Finance module: `ChartOfAccount` is referenced as a target for `AccVc`, `FinancialPeriod` is described in section 2.5, `JournalEntry` appears in the double-entry enforcement pattern (section 2.4), and `SubLedgerControl` exists with 5 fields in section 2.10. This section replaces and expands those concepts into full Prisma models, adds banking (bank accounts, imported transactions, reconciliation), budgeting, and defines the GL posting template pattern that every sub-module uses to create journal entries.

The HansaWorld deep dive (Module 1: NL) revealed 20+ registers, 30+ settings screens, 22 maintenance routines, and critically the `AccBlock` with 62+ account mapping fields — the central wiring diagram that tells the system which GL account to debit/credit for every sub-ledger event. The existing `SubLedgerControl` model (5 fields, 5 rows) cannot represent this. This section introduces `AccountMapping` as the replacement.

**Legacy-to-Nexa Mapping:**

| Legacy Entity | HAL Source | Fields | Nexa Model | Notes |
|---------------|-----------|--------|------------|-------|
| AccVc | datadef1.hal | 22+2 | **ChartOfAccount** | Account number, type, normal balance, control flags, classification |
| AccBlock (settings) | 62+ fields | 62+ | **AccountMapping** | Replaces `SubLedgerControl`. One row per mapping type, optionally scoped by department |
| AccClassVc | datadef11.hal | 4 | **AccountClassification** | Groups accounts for FRS 102 reporting layout |
| TRVc | NL transactions | varies | **JournalEntry** + **JournalLine** | Header/line pattern. Source tracking for sub-ledger postings |
| AccPeriodVc | datadef4.hal | 5+4 | **FinancialPeriod** | Year, period number, lock state, year-end flag |
| BankVc | datadef3.hal | 35 | **BankAccount** | Bank details, GL link, reconciliation state |
| BankTRVc | datadef9.hal | 35 | **BankTransaction** | Imported statement lines, matching status |
| BankRecVc | datadef5.hal | 23+18 | **BankReconciliation** + **BankReconciliationLine** | Period-end reconciliation with line-level matching |
| Bud1Vc / Bud2Vc | NL budgets | varies | **Budget** + **BudgetLine** | Budget sets with per-period, per-account amounts |
| BudgetClassBlock | settings | varies | Absorbed into Budget.budgetType enum | Classification simplified to enum |
| MakeTransFrom* (23 files) | hal/RActions/ | — | GL posting templates (code pattern) | Each sub-module defines its debit/credit mapping via AccountMapping lookups |

**Prisma Models:**

```prisma
// ═══════════════════════════════════════════════════════════════
// FINANCE MODULE — GL, Banking & Budgets (§2.13)
// ═══════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────
// ENUMS
// ───────────────────────────────────────────────────────────────

enum AccountType {
  ASSET
  LIABILITY
  EQUITY
  REVENUE
  EXPENSE
}

enum NormalBalance {
  DEBIT
  CREDIT
}

enum AccountMappingType {
  AR_CONTROL                // Accounts receivable control
  AP_CONTROL                // Accounts payable control
  STOCK                     // Inventory / stock on hand
  STOCK_COST                // Cost of goods sold
  STOCK_VARIANCE            // Stock price/usage variance
  SALES_REVENUE             // Default sales revenue
  PURCHASE_EXPENSE          // Default purchase expense
  VAT_OUTPUT                // VAT collected (output)
  VAT_INPUT                 // VAT reclaimable (input)
  EXCHANGE_GAIN             // Realised FX gain
  EXCHANGE_LOSS             // Realised FX loss
  ROUNDING                  // Rounding differences
  BANK_CHARGES              // Bank fees and charges
  DISCOUNT_GIVEN            // Settlement discount given (AR)
  DISCOUNT_RECEIVED         // Settlement discount received (AP)
  INTEREST_INCOME           // Interest earned
  INTEREST_EXPENSE          // Interest charged
  DEPRECIATION_EXPENSE      // Fixed asset depreciation charge
  ACCUMULATED_DEPRECIATION  // Fixed asset accumulated depreciation
  ASSET_DISPOSAL_GAIN       // Profit on disposal
  ASSET_DISPOSAL_LOSS       // Loss on disposal
  WIP                       // Work in progress (manufacturing)
  PRODUCTION_OVERHEAD       // Production overhead absorption
  PAYROLL_EXPENSE           // Payroll gross pay expense
  PAYROLL_LIABILITY         // PAYE/NI/pension liability
  RETENTION                 // Retention held (construction)
  CASH_IN_TRANSIT           // Cash in transit between accounts
}

enum JournalSource {
  MANUAL
  AR_INVOICE
  AR_CREDIT_NOTE
  AR_PAYMENT
  AP_BILL
  AP_CREDIT_NOTE
  AP_PAYMENT
  BANK_PAYMENT
  BANK_RECEIPT
  BANK_TRANSFER
  STOCK_MOVEMENT
  STOCK_REVALUATION
  GOODS_RECEIPT
  SHIPMENT
  DEPRECIATION
  PAYROLL
  PRODUCTION
  VAT_ADJUSTMENT
  YEAR_END
  OPENING_BALANCE
}

enum JournalStatus {
  DRAFT
  POSTED
  REVERSED
}

enum PeriodStatus {
  OPEN
  CLOSED
  LOCKED
}

enum BankImportSource {
  CSV
  OFX
  QIF
  OPEN_BANKING
  MANUAL
}

enum ReconciliationMatchStatus {
  UNMATCHED
  MATCHED
  RECONCILED
}

enum ReconciliationStatus {
  IN_PROGRESS
  COMPLETED
}

enum BudgetStatus {
  DRAFT
  APPROVED
  LOCKED
}

enum BudgetType {
  REVENUE
  EXPENSE
  CAPITAL
  FULL            // Covers all account types
}

// ───────────────────────────────────────────────────────────────
// CHART OF ACCOUNTS
// ───────────────────────────────────────────────────────────────

model ChartOfAccount {
  id                  String              @id @default(uuid())
  code                String              @unique               // "1100", "4000", "5000"
  name                String                                    // "Trade Debtors", "Sales Revenue"
  accountType         AccountType         @map("account_type")
  normalBalance       NormalBalance       @map("normal_balance")

  // Hierarchy
  parentCode          String?             @map("parent_code")   // Self-ref for grouping
  parent              ChartOfAccount?     @relation("AccountHierarchy", fields: [parentCode], references: [code])
  children            ChartOfAccount[]    @relation("AccountHierarchy")

  // Classification
  classificationId    String?             @map("classification_id")
  classification      AccountClassification? @relation(fields: [classificationId], references: [id])

  // Flags
  isPostable          Boolean             @default(true)  @map("is_postable")   // Only leaf accounts receive postings
  isControl           Boolean             @default(false) @map("is_control")    // Sub-ledger control (AR, AP, Bank)
  isBankAccount       Boolean             @default(false) @map("is_bank_account")
  isSystemAccount     Boolean             @default(false) @map("is_system_account") // Protected from deletion
  isActive            Boolean             @default(true)  @map("is_active")

  // Defaults
  taxCode             String?             @map("tax_code")         // Default VatCode
  departmentCode      String?             @map("department_code")  // If department-specific
  currencyCode        String?             @map("currency_code") @db.VarChar(3) // If foreign-currency account

  // Balances (cached, updated on posting)
  openingBalance      Decimal             @default(0) @map("opening_balance") @db.Decimal(19, 4)
  currentBalance      Decimal             @default(0) @map("current_balance") @db.Decimal(19, 4)

  // Audit
  createdAt           DateTime            @default(now()) @map("created_at")
  updatedAt           DateTime            @updatedAt      @map("updated_at")
  createdBy           String              @map("created_by")
  updatedBy           String              @map("updated_by")

  // Relations
  journalLines        JournalLine[]
  bankAccount         BankAccount?
  budgetLines         BudgetLine[]

  @@index([accountType], map: "idx_chart_of_accounts_account_type")
  @@index([parentCode], map: "idx_chart_of_accounts_parent_code")
  @@index([classificationId], map: "idx_chart_of_accounts_classification_id")
  @@index([isActive, isPostable], map: "idx_chart_of_accounts_active_postable")
  @@map("chart_of_accounts")
}

// ───────────────────────────────────────────────────────────────
// ACCOUNT CLASSIFICATION (FRS 102 reporting groups)
// ───────────────────────────────────────────────────────────────

model AccountClassification {
  id                  String              @id @default(uuid())
  code                String              @unique               // "CA", "FA", "CL", "LTL", "EQ", "REV", "COGS", "OPEX"
  name                String                                    // "Current Assets", "Fixed Assets"
  accountType         AccountType         @map("account_type")  // Which account type this groups
  sortOrder           Int                 @map("sort_order")    // Display order on financial statements
  reportSection       String              @map("report_section") // "BALANCE_SHEET" or "PROFIT_AND_LOSS"
  isActive            Boolean             @default(true) @map("is_active")

  createdAt           DateTime            @default(now()) @map("created_at")
  updatedAt           DateTime            @updatedAt      @map("updated_at")

  accounts            ChartOfAccount[]

  @@index([reportSection, sortOrder], map: "idx_account_classifications_report_sort")
  @@map("account_classifications")
}

// ───────────────────────────────────────────────────────────────
// ACCOUNT MAPPING (replaces SubLedgerControl)
// Central wiring diagram: sub-ledger event → GL account
// ───────────────────────────────────────────────────────────────

model AccountMapping {
  id                  String              @id @default(uuid())
  mappingType         AccountMappingType  @map("mapping_type")  // What kind of posting
  accountCode         String              @map("account_code")  // FK to ChartOfAccount.code
  departmentCode      String?             @map("department_code") // Optional scope to department/cost centre
  description         String?                                   // Human-readable note

  isActive            Boolean             @default(true) @map("is_active")
  createdAt           DateTime            @default(now()) @map("created_at")
  updatedAt           DateTime            @updatedAt      @map("updated_at")
  createdBy           String              @map("created_by")
  updatedBy           String              @map("updated_by")

  @@unique([mappingType, departmentCode], map: "uq_account_mappings_type_dept")
  @@index([mappingType], map: "idx_account_mappings_type")
  @@map("account_mappings")
}

// ───────────────────────────────────────────────────────────────
// FINANCIAL PERIODS
// ───────────────────────────────────────────────────────────────

model FinancialPeriod {
  id                  String              @id @default(uuid())
  year                Int                                       // Financial year (e.g. 2026)
  periodNumber        Int                 @map("period_number") // 1-12 (or 13 for year-end adjustments)
  name                String                                    // "Jan 2026", "Year-End Adj 2026"
  startDate           DateTime            @map("start_date") @db.Date
  endDate             DateTime            @map("end_date")   @db.Date

  // Lock state
  status              PeriodStatus        @default(OPEN)
  lockedAt            DateTime?           @map("locked_at")
  lockedBy            String?             @map("locked_by")

  // Flags
  isYearEnd           Boolean             @default(false) @map("is_year_end")

  createdAt           DateTime            @default(now()) @map("created_at")
  updatedAt           DateTime            @updatedAt      @map("updated_at")

  // Relations
  journalEntries      JournalEntry[]
  budgetLines         BudgetLine[]

  @@unique([year, periodNumber], map: "uq_financial_periods_year_period")
  @@index([startDate, endDate], map: "idx_financial_periods_date_range")
  @@index([status], map: "idx_financial_periods_status")
  @@map("financial_periods")
}

// ───────────────────────────────────────────────────────────────
// JOURNAL ENTRIES (GL transactions)
// ───────────────────────────────────────────────────────────────

model JournalEntry {
  id                  String              @id @default(uuid())
  entryNumber         String              @unique @map("entry_number") // "JE-00001" via NumberSeries
  transactionDate     DateTime            @map("transaction_date") @db.Date
  description         String

  // Source tracking
  source              JournalSource                             // Which module created this
  sourceId            String?             @map("source_id")     // FK to source document (invoice, bill, etc.)
  sourceReference     String?             @map("source_reference") // Human-readable ref (e.g. "INV-00042")
  isAutoGenerated     Boolean             @default(false) @map("is_auto_generated")

  // Status
  status              JournalStatus       @default(DRAFT)
  postedAt            DateTime?           @map("posted_at")
  postedBy            String?             @map("posted_by")

  // Reversal
  reversalOfId        String?             @map("reversal_of_id")
  reversalOf          JournalEntry?       @relation("JournalReversal", fields: [reversalOfId], references: [id])
  reversedBy          JournalEntry?       @relation("JournalReversal")

  // Period
  periodId            String              @map("period_id")
  period              FinancialPeriod     @relation(fields: [periodId], references: [id])

  // Audit
  createdAt           DateTime            @default(now()) @map("created_at")
  updatedAt           DateTime            @updatedAt      @map("updated_at")
  createdBy           String              @map("created_by")
  updatedBy           String              @map("updated_by")

  // Relations
  lines               JournalLine[]

  @@index([transactionDate], map: "idx_journal_entries_transaction_date")
  @@index([source, sourceId], map: "idx_journal_entries_source")
  @@index([status], map: "idx_journal_entries_status")
  @@index([periodId], map: "idx_journal_entries_period_id")
  @@map("journal_entries")
}

model JournalLine {
  id                  String              @id @default(uuid())
  journalEntryId      String              @map("journal_entry_id")
  journalEntry        JournalEntry        @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)

  lineNumber          Int                 @map("line_number")   // Ordering within the entry

  // Account
  accountCode         String              @map("account_code")
  account             ChartOfAccount      @relation(fields: [accountCode], references: [code])

  // Amounts (base currency)
  debit               Decimal             @default(0) @db.Decimal(19, 4)
  credit              Decimal             @default(0) @db.Decimal(19, 4)

  description         String?

  // Dimensions
  departmentCode      String?             @map("department_code")
  tagCode             String?             @map("tag_code")      // Cost object / dimension

  // Multi-currency (if line is in foreign currency)
  currencyCode        String?             @map("currency_code") @db.VarChar(3)
  foreignAmount       Decimal?            @map("foreign_amount") @db.Decimal(19, 4) // Amount in foreign currency
  exchangeRate        Decimal?            @map("exchange_rate")  @db.Decimal(18, 8)

  createdAt           DateTime            @default(now()) @map("created_at")

  // Reconciliation link
  bankReconciliationLines BankReconciliationLine[]

  @@index([journalEntryId], map: "idx_journal_lines_journal_entry_id")
  @@index([accountCode], map: "idx_journal_lines_account_code")
  @@index([departmentCode], map: "idx_journal_lines_department_code")
  @@map("journal_lines")
}

// ───────────────────────────────────────────────────────────────
// BANK ACCOUNTS
// ───────────────────────────────────────────────────────────────

model BankAccount {
  id                  String              @id @default(uuid())
  code                String              @unique               // "BARCLAYS-GBP", "HSBC-EUR"
  name                String                                    // "Barclays Business Current"
  bankName            String              @map("bank_name")     // "Barclays"

  // UK bank details
  accountNumber       String?             @map("account_number")  // 8-digit UK account number
  sortCode            String?             @map("sort_code")       // 6-digit sort code (XX-XX-XX)
  iban                String?                                     // International
  swift               String?                                     // SWIFT/BIC code

  // Currency
  currencyCode        String              @default("GBP") @map("currency_code") @db.VarChar(3)

  // GL link
  glAccountCode       String              @unique @map("gl_account_code")
  glAccount           ChartOfAccount      @relation(fields: [glAccountCode], references: [code])

  // State
  isDefault           Boolean             @default(false) @map("is_default")
  isActive            Boolean             @default(true)  @map("is_active")

  // Cached balances
  currentBalance      Decimal             @default(0) @map("current_balance") @db.Decimal(19, 4)
  lastReconciledDate  DateTime?           @map("last_reconciled_date") @db.Date
  lastReconciledBalance Decimal?          @map("last_reconciled_balance") @db.Decimal(19, 4)

  // Audit
  createdAt           DateTime            @default(now()) @map("created_at")
  updatedAt           DateTime            @updatedAt      @map("updated_at")
  createdBy           String              @map("created_by")
  updatedBy           String              @map("updated_by")

  // Relations
  transactions        BankTransaction[]
  reconciliations     BankReconciliation[]

  @@index([currencyCode], map: "idx_bank_accounts_currency_code")
  @@map("bank_accounts")
}

// ───────────────────────────────────────────────────────────────
// BANK TRANSACTIONS (imported statement lines)
// ───────────────────────────────────────────────────────────────

model BankTransaction {
  id                  String              @id @default(uuid())
  bankAccountId       String              @map("bank_account_id")
  bankAccount         BankAccount         @relation(fields: [bankAccountId], references: [id])

  // Transaction data
  transactionDate     DateTime            @map("transaction_date") @db.Date
  valueDate           DateTime?           @map("value_date") @db.Date  // When funds actually cleared
  description         String
  reference           String?                                   // Bank reference / cheque number

  // Amount: positive = money in (credit to bank), negative = money out (debit to bank)
  amount              Decimal             @db.Decimal(19, 4)
  runningBalance      Decimal?            @map("running_balance") @db.Decimal(19, 4) // Statement running balance

  // Import metadata
  importBatchId       String?             @map("import_batch_id")   // Groups lines from same import
  importSource        BankImportSource    @default(MANUAL) @map("import_source")
  externalId          String?             @map("external_id")       // De-duplication key from bank feed

  // Matching
  matchStatus         ReconciliationMatchStatus @default(UNMATCHED) @map("match_status")
  matchedJournalLineId String?            @map("matched_journal_line_id") // FK when matched to GL
  matchConfidence     Decimal?            @map("match_confidence") @db.Decimal(5, 2) // AI match confidence %
  matchedAt           DateTime?           @map("matched_at")
  matchedBy           String?             @map("matched_by")       // User or "AI"

  createdAt           DateTime            @default(now()) @map("created_at")

  // Relations
  reconciliationLines BankReconciliationLine[]

  @@unique([bankAccountId, externalId], map: "uq_bank_transactions_account_external")
  @@index([bankAccountId, transactionDate], map: "idx_bank_transactions_account_date")
  @@index([matchStatus], map: "idx_bank_transactions_match_status")
  @@index([importBatchId], map: "idx_bank_transactions_import_batch")
  @@map("bank_transactions")
}

// ───────────────────────────────────────────────────────────────
// BANK RECONCILIATION
// ───────────────────────────────────────────────────────────────

model BankReconciliation {
  id                  String              @id @default(uuid())
  bankAccountId       String              @map("bank_account_id")
  bankAccount         BankAccount         @relation(fields: [bankAccountId], references: [id])

  // Reconciliation period
  periodEndDate       DateTime            @map("period_end_date") @db.Date
  statementBalance    Decimal             @map("statement_balance") @db.Decimal(19, 4) // Per bank statement
  ledgerBalance       Decimal             @map("ledger_balance")   @db.Decimal(19, 4) // Per GL
  difference          Decimal             @default(0) @map("difference") @db.Decimal(19, 4) // Must reach zero

  // Status
  status              ReconciliationStatus @default(IN_PROGRESS)
  completedAt         DateTime?           @map("completed_at")
  completedBy         String?             @map("completed_by")

  // Audit
  createdAt           DateTime            @default(now()) @map("created_at")
  updatedAt           DateTime            @updatedAt      @map("updated_at")
  createdBy           String              @map("created_by")
  updatedBy           String              @map("updated_by")

  // Relations
  lines               BankReconciliationLine[]

  @@unique([bankAccountId, periodEndDate], map: "uq_bank_reconciliations_account_period")
  @@index([status], map: "idx_bank_reconciliations_status")
  @@map("bank_reconciliations")
}

model BankReconciliationLine {
  id                    String              @id @default(uuid())
  reconciliationId      String              @map("reconciliation_id")
  reconciliation        BankReconciliation  @relation(fields: [reconciliationId], references: [id], onDelete: Cascade)

  bankTransactionId     String              @map("bank_transaction_id")
  bankTransaction       BankTransaction     @relation(fields: [bankTransactionId], references: [id])

  matchedJournalLineId  String?             @map("matched_journal_line_id")
  matchedJournalLine    JournalLine?        @relation(fields: [matchedJournalLineId], references: [id])

  isMatched             Boolean             @default(false) @map("is_matched")
  matchedAt             DateTime?           @map("matched_at")
  matchedBy             String?             @map("matched_by")

  createdAt             DateTime            @default(now()) @map("created_at")

  @@index([reconciliationId], map: "idx_bank_recon_lines_reconciliation_id")
  @@index([bankTransactionId], map: "idx_bank_recon_lines_bank_transaction_id")
  @@map("bank_reconciliation_lines")
}

// ───────────────────────────────────────────────────────────────
// BUDGETS
// ───────────────────────────────────────────────────────────────

model Budget {
  id                  String              @id @default(uuid())
  name                String                                    // "FY2026 Revenue Budget"
  financialYear       Int                 @map("financial_year")
  budgetType          BudgetType          @map("budget_type")
  status              BudgetStatus        @default(DRAFT)
  description         String?

  approvedAt          DateTime?           @map("approved_at")
  approvedBy          String?             @map("approved_by")

  createdAt           DateTime            @default(now()) @map("created_at")
  updatedAt           DateTime            @updatedAt      @map("updated_at")
  createdBy           String              @map("created_by")
  updatedBy           String              @map("updated_by")

  // Relations
  lines               BudgetLine[]

  @@unique([name, financialYear], map: "uq_budgets_name_year")
  @@index([financialYear, status], map: "idx_budgets_year_status")
  @@map("budgets")
}

model BudgetLine {
  id                  String              @id @default(uuid())
  budgetId            String              @map("budget_id")
  budget              Budget              @relation(fields: [budgetId], references: [id], onDelete: Cascade)

  accountCode         String              @map("account_code")
  account             ChartOfAccount      @relation(fields: [accountCode], references: [code])

  periodId            String              @map("period_id")
  period              FinancialPeriod     @relation(fields: [periodId], references: [id])

  amount              Decimal             @db.Decimal(19, 4)    // Budgeted amount for this account+period

  // Optional dimensions
  departmentCode      String?             @map("department_code")
  tagCode             String?             @map("tag_code")

  createdAt           DateTime            @default(now()) @map("created_at")
  updatedAt           DateTime            @updatedAt      @map("updated_at")

  @@unique([budgetId, accountCode, periodId, departmentCode], map: "uq_budget_lines_composite")
  @@index([budgetId], map: "idx_budget_lines_budget_id")
  @@index([accountCode], map: "idx_budget_lines_account_code")
  @@index([periodId], map: "idx_budget_lines_period_id")
  @@map("budget_lines")
}
```

**Relationship to Existing Models (no redefinition needed):**

| Existing Model (from section 2.10) | Relationship to Finance Models |
|------|------|
| `Currency` | `BankAccount.currencyCode` and `JournalLine.currencyCode` reference `Currency.code` |
| `ExchangeRate` | Used by posting services to convert foreign amounts; `JournalLine.exchangeRate` stores the rate used |
| `Department` | `AccountMapping.departmentCode`, `JournalLine.departmentCode`, `BudgetLine.departmentCode` reference `Department.code` |
| `Tag` | `JournalLine.tagCode`, `BudgetLine.tagCode` reference `Tag.code` for cost object dimensions |
| `VatCode` | `ChartOfAccount.taxCode` references `VatCode.code` for default VAT behaviour |
| `NumberSeries` | `JournalEntry.entryNumber` generated via the `JOURNAL` number series (section 2.8) |
| `SubLedgerControl` | **Superseded** by `AccountMapping`. `SubLedgerControl` should be removed from the schema in Story 4. |

**Note on SubLedgerControl deprecation:** The existing `SubLedgerControl` model (5 rows: AR, AP, STOCK, PAYROLL, VAT) is replaced by `AccountMapping` which supports 27 mapping types with optional department scoping. The seed data migration should create `AccountMapping` rows for all types using FRS 102 defaults, and the `SubLedgerControl` model should be dropped.

---

**GL Posting Template Pattern:**

Every sub-module that creates financial transactions uses the same pattern: look up the relevant `AccountMapping` rows to determine which GL accounts to debit and credit, then create a `JournalEntry` with balanced `JournalLine` records. This replaces the 23 `MakeTransFrom*` files in the legacy HAL codebase.

```typescript
// Conceptual pattern — each sub-module service implements its own variant.
// modules/finance/services/gl-posting.service.ts

interface PostingLine {
  mappingType: AccountMappingType;  // Which account mapping to look up
  debit?: Decimal;
  credit?: Decimal;
  description: string;
  departmentCode?: string;
  tagCode?: string;
  currencyCode?: string;
  foreignAmount?: Decimal;
  exchangeRate?: Decimal;
}

async function createGlPosting(params: {
  transactionDate: Date;
  description: string;
  source: JournalSource;
  sourceId: string;
  sourceReference: string;
  lines: PostingLine[];
  createdBy: string;
}): Promise<JournalEntry> {
  return prisma.$transaction(async (tx) => {
    // 1. Resolve period from transaction date
    const period = await resolvePeriod(tx, params.transactionDate);
    if (period.status !== 'OPEN') {
      throw new PeriodLockError(period);
    }

    // 2. Resolve account codes from AccountMapping
    const resolvedLines = await Promise.all(
      params.lines.map(async (line) => {
        const mapping = await tx.accountMapping.findFirst({
          where: {
            mappingType: line.mappingType,
            departmentCode: line.departmentCode ?? null,
            isActive: true,
          },
        });
        // Fall back to mapping without department scope
        const fallback = mapping ?? await tx.accountMapping.findFirst({
          where: {
            mappingType: line.mappingType,
            departmentCode: null,
            isActive: true,
          },
        });
        if (!fallback) {
          throw new MissingAccountMappingError(line.mappingType);
        }
        return { ...line, accountCode: fallback.accountCode };
      })
    );

    // 3. Validate balance (sum of debits must equal sum of credits)
    const totalDebit = resolvedLines.reduce((sum, l) => sum.plus(l.debit ?? 0), new Decimal(0));
    const totalCredit = resolvedLines.reduce((sum, l) => sum.plus(l.credit ?? 0), new Decimal(0));
    if (!totalDebit.equals(totalCredit)) {
      throw new UnbalancedEntryError(totalDebit, totalCredit);
    }

    // 4. Generate entry number via NumberSeries
    const entryNumber = await nextNumber(tx, 'JOURNAL');

    // 5. Create journal entry + lines in single transaction
    const entry = await tx.journalEntry.create({
      data: {
        entryNumber,
        transactionDate: params.transactionDate,
        description: params.description,
        source: params.source,
        sourceId: params.sourceId,
        sourceReference: params.sourceReference,
        isAutoGenerated: true,
        status: 'POSTED',
        postedAt: new Date(),
        postedBy: params.createdBy,
        periodId: period.id,
        createdBy: params.createdBy,
        updatedBy: params.createdBy,
        lines: {
          create: resolvedLines.map((line, idx) => ({
            lineNumber: idx + 1,
            accountCode: line.accountCode,
            debit: line.debit ?? 0,
            credit: line.credit ?? 0,
            description: line.description,
            departmentCode: line.departmentCode,
            tagCode: line.tagCode,
            currencyCode: line.currencyCode,
            foreignAmount: line.foreignAmount,
            exchangeRate: line.exchangeRate,
          })),
        },
      },
      include: { lines: true },
    });

    // 6. Update cached balances on ChartOfAccount (async, non-blocking)
    // Emitted as event: GL_ENTRY_POSTED → balance recalculation subscriber
    await emitEvent('GL_ENTRY_POSTED', { entryId: entry.id });

    return entry;
  });
}
```

**Example posting templates by sub-module:**

| Sub-Module Event | Debit (AccountMapping) | Credit (AccountMapping) |
|------------------|----------------------|------------------------|
| AR Invoice posted | `AR_CONTROL` | `SALES_REVENUE` + `VAT_OUTPUT` |
| AR Payment received | `BANK` (direct account) | `AR_CONTROL` |
| AP Bill posted | `PURCHASE_EXPENSE` + `VAT_INPUT` | `AP_CONTROL` |
| AP Payment sent | `AP_CONTROL` | `BANK` (direct account) |
| Goods receipt (stock) | `STOCK` | `STOCK_COST` (accrual) |
| Stock revaluation | `STOCK_VARIANCE` | `STOCK` |
| Depreciation run | `DEPRECIATION_EXPENSE` | `ACCUMULATED_DEPRECIATION` |
| Payroll posting | `PAYROLL_EXPENSE` | `PAYROLL_LIABILITY` + `BANK` |
| FX gain realised | `BANK` / `AR_CONTROL` | `EXCHANGE_GAIN` |
| FX loss realised | `EXCHANGE_LOSS` | `BANK` / `AR_CONTROL` |
| Settlement discount given | `DISCOUNT_GIVEN` | `AR_CONTROL` |

---

**Bank Reconciliation Workflow:**

The reconciliation process matches imported bank statement lines (`BankTransaction`) against GL entries (`JournalLine` on the bank's GL account). This is one of the AI-assisted workflows where the AI agent suggests matches based on amount, date proximity, and description similarity.

```
1. IMPORT
   User uploads CSV/OFX file OR Open Banking feed delivers transactions
   → BankTransaction records created with matchStatus = UNMATCHED
   → De-duplication via externalId (NFR33: no duplicate bank transactions)

2. AUTO-MATCH (AI-assisted)
   For each UNMATCHED BankTransaction:
   a. Find JournalLine candidates on the bank's GL account
      within +/- 5 days of transaction date
   b. Score by: exact amount match (high), date match (medium),
      description similarity via embedding (medium), reference match (high)
   c. If confidence >= 95%: auto-match (matchStatus → MATCHED)
   d. If confidence 60-94%: suggest to user for review
   e. If confidence < 60%: leave UNMATCHED

3. MANUAL REVIEW
   User sees: unmatched bank transactions | suggested matches | matched items
   User can: accept suggestion, reject suggestion, manually match,
             create new GL entry for unmatched items (e.g., bank charges)

4. RECONCILE
   User creates BankReconciliation for a period end date
   → System calculates: statementBalance vs ledgerBalance
   → All MATCHED items within the period become RECONCILED
   → difference must reach zero before completion
   → On completion: status → COMPLETED, BankAccount.lastReconciledDate updated

5. PERIOD CLOSE
   Once reconciliation is COMPLETED for a period, the financial period
   can be locked (section 2.5 trigger prevents further modifications)
```

---

**Seed Data (FRS 102 defaults for AccountMapping):**

```typescript
const ACCOUNT_MAPPINGS: Array<{ mappingType: string; accountCode: string; description: string }> = [
  { mappingType: 'AR_CONTROL',               accountCode: '1100', description: 'Trade Debtors' },
  { mappingType: 'AP_CONTROL',               accountCode: '2100', description: 'Trade Creditors' },
  { mappingType: 'STOCK',                    accountCode: '1200', description: 'Stock' },
  { mappingType: 'STOCK_COST',               accountCode: '5000', description: 'Cost of Sales' },
  { mappingType: 'STOCK_VARIANCE',           accountCode: '5010', description: 'Stock Variance' },
  { mappingType: 'SALES_REVENUE',            accountCode: '4000', description: 'Sales' },
  { mappingType: 'PURCHASE_EXPENSE',         accountCode: '5001', description: 'Purchases' },
  { mappingType: 'VAT_OUTPUT',               accountCode: '2201', description: 'VAT Liability' },
  { mappingType: 'VAT_INPUT',                accountCode: '2202', description: 'VAT Recoverable' },
  { mappingType: 'EXCHANGE_GAIN',            accountCode: '4900', description: 'Exchange Rate Gains' },
  { mappingType: 'EXCHANGE_LOSS',            accountCode: '8200', description: 'Exchange Rate Losses' },
  { mappingType: 'ROUNDING',                 accountCode: '8210', description: 'Rounding Differences' },
  { mappingType: 'BANK_CHARGES',             accountCode: '7901', description: 'Bank Charges' },
  { mappingType: 'DISCOUNT_GIVEN',           accountCode: '4010', description: 'Discounts Allowed' },
  { mappingType: 'DISCOUNT_RECEIVED',        accountCode: '5020', description: 'Discounts Received' },
  { mappingType: 'INTEREST_INCOME',          accountCode: '4800', description: 'Interest Received' },
  { mappingType: 'INTEREST_EXPENSE',         accountCode: '7900', description: 'Interest Paid' },
  { mappingType: 'DEPRECIATION_EXPENSE',     accountCode: '8100', description: 'Depreciation' },
  { mappingType: 'ACCUMULATED_DEPRECIATION', accountCode: '0051', description: 'Accumulated Depreciation' },
  { mappingType: 'ASSET_DISPOSAL_GAIN',      accountCode: '4910', description: 'Profit on Disposal' },
  { mappingType: 'ASSET_DISPOSAL_LOSS',      accountCode: '8110', description: 'Loss on Disposal' },
  { mappingType: 'WIP',                      accountCode: '1300', description: 'Work in Progress' },
  { mappingType: 'PRODUCTION_OVERHEAD',      accountCode: '5100', description: 'Production Overheads' },
  { mappingType: 'PAYROLL_EXPENSE',          accountCode: '7000', description: 'Wages and Salaries' },
  { mappingType: 'PAYROLL_LIABILITY',        accountCode: '2210', description: 'PAYE/NI Liability' },
  { mappingType: 'RETENTION',               accountCode: '2300', description: 'Retention Creditors' },
  { mappingType: 'CASH_IN_TRANSIT',          accountCode: '1150', description: 'Cash in Transit' },
];
```

**Account Classification seed data (FRS 102):**

```typescript
const ACCOUNT_CLASSIFICATIONS = [
  { code: 'FA',   name: 'Fixed Assets',              accountType: 'ASSET',     sortOrder: 1,  reportSection: 'BALANCE_SHEET' },
  { code: 'CA',   name: 'Current Assets',            accountType: 'ASSET',     sortOrder: 2,  reportSection: 'BALANCE_SHEET' },
  { code: 'CL',   name: 'Current Liabilities',       accountType: 'LIABILITY', sortOrder: 3,  reportSection: 'BALANCE_SHEET' },
  { code: 'LTL',  name: 'Long-Term Liabilities',     accountType: 'LIABILITY', sortOrder: 4,  reportSection: 'BALANCE_SHEET' },
  { code: 'EQ',   name: 'Equity',                    accountType: 'EQUITY',    sortOrder: 5,  reportSection: 'BALANCE_SHEET' },
  { code: 'REV',  name: 'Revenue',                   accountType: 'REVENUE',   sortOrder: 1,  reportSection: 'PROFIT_AND_LOSS' },
  { code: 'COGS', name: 'Cost of Sales',             accountType: 'EXPENSE',   sortOrder: 2,  reportSection: 'PROFIT_AND_LOSS' },
  { code: 'OPEX', name: 'Operating Expenses',        accountType: 'EXPENSE',   sortOrder: 3,  reportSection: 'PROFIT_AND_LOSS' },
  { code: 'OI',   name: 'Other Income',              accountType: 'REVENUE',   sortOrder: 4,  reportSection: 'PROFIT_AND_LOSS' },
  { code: 'FIN',  name: 'Finance Costs',             accountType: 'EXPENSE',   sortOrder: 5,  reportSection: 'PROFIT_AND_LOSS' },
  { code: 'TAX',  name: 'Taxation',                  accountType: 'EXPENSE',   sortOrder: 6,  reportSection: 'PROFIT_AND_LOSS' },
];
```

---

**Build Sequence Note:**

These models belong to **Story 4: Finance module (GL)** in the build sequence (see architecture section 8). Story 4 is described as: "First business module. Proves the entire architecture: routes -> services -> repositories -> events -> audit. Chart of accounts, journals, periods, trial balance."

Implementation order within Story 4:

1. **Schema migration** -- Add all models from this section. Drop `SubLedgerControl`. Run `prisma migrate dev`.
2. **Seed data** -- FRS 102 chart of accounts template (~70 accounts), account classifications, account mappings.
3. **ChartOfAccount CRUD** -- Accounts list, create, update, deactivate. Tree view for hierarchy. Validation: cannot deactivate accounts with current-year postings; cannot delete system accounts.
4. **FinancialPeriod management** -- Auto-generate periods for a financial year. Lock/unlock with authorization check.
5. **JournalEntry CRUD** -- Manual journal entry creation (DRAFT -> POSTED). Balanced entry enforcement via DB trigger (section 2.4). Reversal workflow.
6. **GL Posting service** -- The `createGlPosting()` pattern above. Unit-tested with each posting template.
7. **Trial Balance report** -- Sum debits/credits per account for a period range. First report to validate the GL works end-to-end.
8. **BankAccount CRUD** -- Bank account setup linked to GL accounts.
9. **BankTransaction import** -- CSV/OFX file parsing, de-duplication, import batch tracking.
10. **Bank reconciliation** -- Manual matching UI, AI-suggested matches (can be stubbed in Story 4, enhanced in Story 6+ when AI layer is built).
11. **Budget CRUD** -- Budget creation, line entry per account per period, approval workflow.

**Dependencies:** Story 4 depends on Story 1 (database package with NumberSeries, core entities), Story 1b (system module entities: Department, VatCode, Currency), Story 2 (API server, auth, RBAC), and Story 3 (event bus, audit trail).

### 2.14 Inventory Module -- Items, Stock & Warehousing

The Inventory module is the physical-goods backbone of Nexa ERP. It manages the item master (products, services, non-stock items), warehouse locations, stock movements, costing, and real-time stock balances. Every sales order shipment, purchase order receipt, manufacturing consumption/output, and manual adjustment flows through this module as a `StockMovement` record, making it the single source of truth for quantity-on-hand and inventory valuation.

The module supports four costing methods (FIFO, Weighted Average, Standard Cost, Last Purchase Price), optional serial number and batch/lot tracking with best-before dates, multi-warehouse stock segregation, and a comprehensive item classification hierarchy via `ItemGroup`.

**Design decisions:**

- **Header-only stock movements.** Unlike the legacy StockMovVc which uses a header + matrix (line items) pattern, Nexa models each stock movement as a single-item record. Multi-item transfers are represented as multiple `StockMovement` rows sharing a common `reference`. This simplifies costing calculations, serial/batch tracking per line, and reversal logic.
- **StockBalance as a maintained table.** Rather than computing on-hand quantities from the full movement history on every query, a `StockBalance` row per item-warehouse pair is maintained transactionally. Every posted `StockMovement` updates the corresponding balance atomically within the same database transaction.
- **ItemGroup as the GL account default hub.** Mirroring the legacy ITVc pattern, `ItemGroup` carries default GL account codes (sales, COGS, stock) and VAT codes. Items inherit these defaults but can override them individually.

---

#### Legacy-to-Nexa Entity Mapping

| Legacy Register | Legacy Key | Fields | Nexa Model | Notes |
|---|---|---|---|---|
| INVc | artikel5 | 211 + 2 array | `InventoryItem` | Core item master; ~50 typed columns for MVP, remainder in JSON metadata |
| ITVc | ITVc2 | 67 + 2 array | `ItemGroup` | GL account defaults hub (30 AccVc refs in legacy) |
| LocationVc | location2 | 55 | `Warehouse` | Warehouse / stock location |
| StockMovVc | stockmov1 | 110 + 26 array | `StockMovement` | Flattened to single-item rows (no line-item child table) |
| StockReservVc | -- | 17 | P1: `StockReservation` | Stock reservation against orders |
| StockTakeVc | -- | 11 + 19 array | P1: `StockCount` | Physical inventory / cycle count |
| INTransferVc | -- | -- | Via `StockMovement` | Inter-warehouse transfers modelled as paired TRANSFER_IN / TRANSFER_OUT movements |
| BarcodeVc | -- | -- | P1: `ItemBarcode` | Multi-barcode per item |
| ItemHistVc | -- | -- | Derived from `StockMovement` query | No separate history table needed |
| -- (new) | -- | -- | `StockBalance` | Maintained item-warehouse balance (no legacy equivalent) |
| -- (new) | -- | -- | `SerialNumber` | Per-unit serial tracking (P1 stub) |
| -- (new) | -- | -- | `UnitOfMeasure` | UOM reference table (P1 stub for multi-UOM conversion) |

---

#### Prisma Schema

```prisma
// ─────────────────────────────────────────────
// Inventory Module — Enums
// ─────────────────────────────────────────────

enum ItemType {
  STOCK
  SERVICE
  NON_STOCK
  KIT

  @@map("item_type")
}

enum CostingMethod {
  FIFO
  WEIGHTED_AVERAGE
  STANDARD
  LAST_PURCHASE

  @@map("costing_method")
}

enum StockMovementType {
  GOODS_RECEIPT
  GOODS_ISSUE
  TRANSFER_IN
  TRANSFER_OUT
  ADJUSTMENT_IN
  ADJUSTMENT_OUT
  RETURN_IN
  RETURN_OUT
  PRODUCTION_IN
  PRODUCTION_OUT
  OPENING_BALANCE
  SCRAP

  @@map("stock_movement_type")
}

enum StockMovementStatus {
  DRAFT
  POSTED
  REVERSED

  @@map("stock_movement_status")
}

enum StockMovementSourceType {
  PURCHASE_ORDER
  SALES_ORDER
  MANUAL
  PRODUCTION
  TRANSFER
  RETURN

  @@map("stock_movement_source_type")
}

enum SerialNumberStatus {
  AVAILABLE
  RESERVED
  SOLD
  RETURNED
  QUARANTINE

  @@map("serial_number_status")
}

// ─────────────────────────────────────────────
// ItemGroup — Classification & GL Account Defaults
// ─────────────────────────────────────────────

model ItemGroup {
  id        String   @id @default(uuid())
  code      String   @unique @db.VarChar(20)
  name      String   @db.VarChar(100)

  // Hierarchy
  parentGroupId String?   @map("parent_group_id")
  parentGroup   ItemGroup?  @relation("ItemGroupHierarchy", fields: [parentGroupId], references: [id])
  childGroups   ItemGroup[] @relation("ItemGroupHierarchy")

  // GL Account Defaults (inherited by items unless overridden)
  defaultSalesAccountCode     String? @map("default_sales_account_code") @db.VarChar(20)
  defaultCostOfGoodsAccountCode String? @map("default_cost_of_goods_account_code") @db.VarChar(20)
  defaultStockAccountCode     String? @map("default_stock_account_code") @db.VarChar(20)
  defaultPurchaseAccountCode  String? @map("default_purchase_account_code") @db.VarChar(20)
  defaultWipAccountCode       String? @map("default_wip_account_code") @db.VarChar(20)

  // Tax Defaults
  defaultVatCodeId String? @map("default_vat_code_id") @db.VarChar(20)

  // Costing
  defaultCostingMethod CostingMethod? @map("default_costing_method")

  // Standard fields
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  // Relations
  items InventoryItem[]

  @@map("item_groups")
  @@index([parentGroupId], map: "idx_item_groups_parent_group_id")
  @@index([code], map: "idx_item_groups_code")
}

// ─────────────────────────────────────────────
// Warehouse — Stock Locations
// ─────────────────────────────────────────────

model Warehouse {
  id           String  @id @default(uuid())
  code         String  @unique @db.VarChar(20)
  name         String  @db.VarChar(100)

  // Address
  addressLine1 String? @map("address_line_1") @db.VarChar(200)
  addressLine2 String? @map("address_line_2") @db.VarChar(200)
  city         String? @db.VarChar(100)
  county       String? @db.VarChar(100)
  postcode     String? @db.VarChar(20)
  countryCode  String  @default("GB") @map("country_code") @db.VarChar(2)

  // Contact
  contactName  String? @map("contact_name") @db.VarChar(100)
  contactPhone String? @map("contact_phone") @db.VarChar(30)
  contactEmail String? @map("contact_email") @db.VarChar(200)

  // Flags
  isDefault Boolean @default(false) @map("is_default")
  isActive  Boolean @default(true) @map("is_active")

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  // Relations
  defaultForItems InventoryItem[] @relation("DefaultWarehouse")
  stockMovements  StockMovement[]
  stockBalances   StockBalance[]
  serialNumbers   SerialNumber[]

  @@map("warehouses")
  @@index([code], map: "idx_warehouses_code")
}

// ─────────────────────────────────────────────
// InventoryItem — Item Master
// ─────────────────────────────────────────────

model InventoryItem {
  id   String @id @default(uuid())

  // ── Identity ──
  code            String   @unique @db.VarChar(40)
  name            String   @db.VarChar(200)
  description     String?  @db.Text
  barcode         String?  @db.VarChar(60)
  alternativeCode String?  @map("alternative_code") @db.VarChar(40)
  gtinNumber      String?  @map("gtin_number") @db.VarChar(60)

  // ── Classification ──
  itemType       ItemType @default(STOCK) @map("item_type")
  groupId        String?  @map("group_id")
  group          ItemGroup? @relation(fields: [groupId], references: [id])
  brand          String?  @db.VarChar(60)
  classification String?  @db.VarChar(60)

  // ── Unit of Measure ──
  unitOfMeasure          String @default("EACH") @map("unit_of_measure") @db.VarChar(20)
  secondaryUnitOfMeasure String? @map("secondary_unit_of_measure") @db.VarChar(20)
  unitConversionFactor   Decimal? @map("unit_conversion_factor") @db.Decimal(10, 4)

  // ── Pricing (all money fields Decimal 19,4) ──
  costPrice            Decimal? @map("cost_price") @db.Decimal(19, 4)
  sellingPrice1        Decimal? @map("selling_price_1") @db.Decimal(19, 4)
  sellingPrice2        Decimal? @map("selling_price_2") @db.Decimal(19, 4)
  sellingPrice3        Decimal? @map("selling_price_3") @db.Decimal(19, 4)
  lastPurchasePrice    Decimal? @map("last_purchase_price") @db.Decimal(19, 4)
  weightedAveragePrice Decimal? @map("weighted_average_price") @db.Decimal(19, 4)
  standardCost         Decimal? @map("standard_cost") @db.Decimal(19, 4)
  markup               Decimal? @db.Decimal(10, 4)
  currencyCode         String   @default("GBP") @map("currency_code") @db.VarChar(3)

  // ── Stock Control ──
  minStockLevel        Decimal? @map("min_stock_level") @db.Decimal(10, 4)
  maxStockLevel        Decimal? @map("max_stock_level") @db.Decimal(10, 4)
  reorderPoint         Decimal? @map("reorder_point") @db.Decimal(10, 4)
  reorderQuantity      Decimal? @map("reorder_quantity") @db.Decimal(10, 4)
  leadTimeDays         Int?     @map("lead_time_days")
  defaultWarehouseId   String?  @map("default_warehouse_id")
  defaultWarehouse     Warehouse? @relation("DefaultWarehouse", fields: [defaultWarehouseId], references: [id])

  // ── Physical Dimensions ──
  weight  Decimal? @db.Decimal(10, 4)
  volume  Decimal? @db.Decimal(10, 4)
  length  Decimal? @db.Decimal(10, 4)
  width   Decimal? @db.Decimal(10, 4)
  height  Decimal? @db.Decimal(10, 4)

  // ── Costing ──
  costingMethod CostingMethod @default(WEIGHTED_AVERAGE) @map("costing_method")

  // ── Tax ──
  vatCodeId String? @map("vat_code_id") @db.VarChar(20)
  hsCode    String? @map("hs_code") @db.VarChar(20)

  // ── Serial / Batch Tracking ──
  serialNumberRequired     Boolean @default(false) @map("serial_number_required")
  batchTrackingEnabled     Boolean @default(false) @map("batch_tracking_enabled")
  bestBeforeTrackingEnabled Boolean @default(false) @map("best_before_tracking_enabled")

  // ── GL Account Overrides (inherit from ItemGroup if null) ──
  salesAccountCode       String? @map("sales_account_code") @db.VarChar(20)
  costOfGoodsAccountCode String? @map("cost_of_goods_account_code") @db.VarChar(20)
  stockAccountCode       String? @map("stock_account_code") @db.VarChar(20)

  // ── Lifecycle Flags ──
  purchaseItem  Boolean @default(true) @map("purchase_item")
  salesItem     Boolean @default(true) @map("sales_item")
  notForSale    Boolean @default(false) @map("not_for_sale")
  discontinued  Boolean @default(false)

  // ── Extended Metadata (fields acceptable as JSON) ──
  // Stores: dimensions detail, alternate barcodes, variant masks,
  //         pricing rules, customs/compliance, secondary UOM detail
  metadata Json? @db.JsonB

  // ── Standard Fields ──
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  // ── Relations ──
  stockMovements StockMovement[]
  stockBalances  StockBalance[]
  serialNumbers  SerialNumber[]

  @@map("inventory_items")
  @@index([code], map: "idx_inventory_items_code")
  @@index([barcode], map: "idx_inventory_items_barcode")
  @@index([groupId], map: "idx_inventory_items_group_id")
  @@index([itemType], map: "idx_inventory_items_item_type")
  @@index([defaultWarehouseId], map: "idx_inventory_items_default_warehouse_id")
  @@index([discontinued, isActive], map: "idx_inventory_items_lifecycle")
}

// ─────────────────────────────────────────────
// StockMovement — Core Stock Transaction
// ─────────────────────────────────────────────

model StockMovement {
  id              String @id @default(uuid())
  movementNumber  String @unique @map("movement_number") @db.VarChar(30)

  // ── Movement Classification ──
  movementType StockMovementType @map("movement_type")
  status       StockMovementStatus @default(DRAFT)

  // ── Item & Location ──
  itemId      String    @map("item_id")
  item        InventoryItem @relation(fields: [itemId], references: [id])
  warehouseId String    @map("warehouse_id")
  warehouse   Warehouse @relation(fields: [warehouseId], references: [id])

  // ── Quantities (positive = in, negative = out) ──
  quantity  Decimal @db.Decimal(10, 4)

  // ── Costing at Time of Movement ──
  unitCost  Decimal @default(0) @map("unit_cost") @db.Decimal(19, 4)
  totalCost Decimal @default(0) @map("total_cost") @db.Decimal(19, 4)

  // ── Dates ──
  transactionDate DateTime @map("transaction_date")
  postedDate      DateTime? @map("posted_date")

  // ── Source Traceability ──
  sourceType StockMovementSourceType? @map("source_type")
  sourceId   String?                  @map("source_id")
  reference  String?                  @db.VarChar(100)
  description String?                 @db.VarChar(500)

  // ── Serial / Batch (denormalised for query speed) ──
  serialNumber   String?   @map("serial_number") @db.VarChar(60)
  batchNumber    String?   @map("batch_number") @db.VarChar(60)
  bestBeforeDate DateTime? @map("best_before_date")

  // ── Reversal ──
  reversedById   String?        @map("reversed_by_id")
  reversedBy     StockMovement? @relation("StockMovementReversal", fields: [reversedById], references: [id])
  reversalOf     StockMovement? @relation("StockMovementReversal")

  // ── Currency ──
  currencyCode String @default("GBP") @map("currency_code") @db.VarChar(3)

  // ── Standard Fields ──
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  @@map("stock_movements")
  @@index([itemId], map: "idx_stock_movements_item_id")
  @@index([warehouseId], map: "idx_stock_movements_warehouse_id")
  @@index([movementType], map: "idx_stock_movements_movement_type")
  @@index([status], map: "idx_stock_movements_status")
  @@index([transactionDate], map: "idx_stock_movements_transaction_date")
  @@index([sourceType, sourceId], map: "idx_stock_movements_source")
  @@index([serialNumber], map: "idx_stock_movements_serial_number")
  @@index([batchNumber], map: "idx_stock_movements_batch_number")
  @@index([movementNumber], map: "idx_stock_movements_movement_number")
}

// ─────────────────────────────────────────────
// StockBalance — Maintained Item-Warehouse Balance
// ─────────────────────────────────────────────

model StockBalance {
  id String @id @default(uuid())

  // ── Composite Key (logical) ──
  itemId      String    @map("item_id")
  item        InventoryItem @relation(fields: [itemId], references: [id])
  warehouseId String    @map("warehouse_id")
  warehouse   Warehouse @relation(fields: [warehouseId], references: [id])

  // ── Quantities ──
  quantityOnHand     Decimal @default(0) @map("quantity_on_hand") @db.Decimal(10, 4)
  quantityReserved   Decimal @default(0) @map("quantity_reserved") @db.Decimal(10, 4)
  quantityOnOrder    Decimal @default(0) @map("quantity_on_order") @db.Decimal(10, 4)
  quantityAvailable  Decimal @default(0) @map("quantity_available") @db.Decimal(10, 4)

  // ── Valuation ──
  costValue          Decimal @default(0) @map("cost_value") @db.Decimal(19, 4)
  currencyCode       String  @default("GBP") @map("currency_code") @db.VarChar(3)

  // ── Tracking ──
  lastMovementDate   DateTime? @map("last_movement_date")
  lastCountDate      DateTime? @map("last_count_date")

  // ── Standard Fields ──
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([itemId, warehouseId], map: "uq_stock_balances_item_warehouse")
  @@map("stock_balances")
  @@index([itemId], map: "idx_stock_balances_item_id")
  @@index([warehouseId], map: "idx_stock_balances_warehouse_id")
  @@index([quantityOnHand], map: "idx_stock_balances_quantity_on_hand")
}

// ─────────────────────────────────────────────
// SerialNumber — Per-Unit Tracking (P1 Stub)
// ─────────────────────────────────────────────

model SerialNumber {
  id           String @id @default(uuid())
  serialNumber String @map("serial_number") @db.VarChar(60)

  // ── Item & Location ──
  itemId      String    @map("item_id")
  item        InventoryItem @relation(fields: [itemId], references: [id])
  warehouseId String?   @map("warehouse_id")
  warehouse   Warehouse? @relation(fields: [warehouseId], references: [id])

  // ── Status ──
  status SerialNumberStatus @default(AVAILABLE)

  // ── Batch / Lot ──
  batchNumber    String?   @map("batch_number") @db.VarChar(60)
  bestBeforeDate DateTime? @map("best_before_date")

  // ── Provenance ──
  purchaseDate   DateTime? @map("purchase_date")
  supplierId     String?   @map("supplier_id")

  // ── Standard Fields ──
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  @@unique([serialNumber, itemId], map: "uq_serial_numbers_serial_item")
  @@map("serial_numbers")
  @@index([itemId], map: "idx_serial_numbers_item_id")
  @@index([warehouseId], map: "idx_serial_numbers_warehouse_id")
  @@index([status], map: "idx_serial_numbers_status")
  @@index([batchNumber], map: "idx_serial_numbers_batch_number")
}

// ─────────────────────────────────────────────
// UnitOfMeasure — UOM Reference (P1 Stub)
// ─────────────────────────────────────────────

model UnitOfMeasure {
  id           String @id @default(uuid())
  code         String @unique @db.VarChar(20)
  name         String @db.VarChar(60)
  abbreviation String @db.VarChar(10)

  // ── Conversion ──
  // Base UOM has baseUomId = null, conversionFactor = 1
  baseUomId        String?  @map("base_uom_id")
  baseUom          UnitOfMeasure? @relation("UomConversion", fields: [baseUomId], references: [id])
  derivedUoms      UnitOfMeasure[] @relation("UomConversion")
  conversionFactor Decimal  @default(1) @map("conversion_factor") @db.Decimal(10, 4)

  // ── Standard Fields ──
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  @@map("units_of_measure")
  @@index([code], map: "idx_units_of_measure_code")
}
```

---

#### Legacy Movement Type Mapping

The legacy StockMovVc uses a single `StockMovType` set field with 13 values. Nexa maps these to a more explicit enum and pairs them with a `sourceType` for full traceability:

| Legacy Value | Legacy Meaning | Nexa `movementType` | Nexa `sourceType` |
|---|---|---|---|
| 0 | Normal Transfer | `TRANSFER_IN` / `TRANSFER_OUT` | `TRANSFER` |
| 1 | Sale (via Invoice) | `GOODS_ISSUE` | `SALES_ORDER` |
| 2 | Purchase (via Bill) | `GOODS_RECEIPT` | `PURCHASE_ORDER` |
| 3 | Production Output | `PRODUCTION_IN` | `PRODUCTION` |
| 4 | Production Consumption | `PRODUCTION_OUT` | `PRODUCTION` |
| 5 | Adjustment (+) | `ADJUSTMENT_IN` | `MANUAL` |
| 6 | Adjustment (-) | `ADJUSTMENT_OUT` | `MANUAL` |
| 7 | Opening Balance | `OPENING_BALANCE` | `MANUAL` |
| 8 | Return from Customer | `RETURN_IN` | `RETURN` |
| 9 | Return to Supplier | `RETURN_OUT` | `RETURN` |
| 10 | Internal Consumption | `GOODS_ISSUE` | `MANUAL` |
| 11 | Quality Hold | `ADJUSTMENT_OUT` | `MANUAL` |
| 12 | Scrap / Write-off | `SCRAP` | `MANUAL` |

---

#### Costing Methods

Nexa supports four inventory costing methods, configurable per item (with a group-level default). The costing method determines how `unitCost` is calculated when goods are issued.

**1. FIFO (First In, First Out)**

Each goods receipt creates a cost layer recording the quantity received and the unit cost at that time. When goods are issued, the oldest unconsumed cost layer is consumed first. The `unitCost` on the outbound `StockMovement` reflects the cost layer(s) consumed.

- The service layer maintains a `FifoCostLayer` working table (or equivalent logic) tracking remaining quantity per receipt.
- If an item has `serialNumberRequired = true`, FIFO can operate per serial number (each serial carries its own purchase cost).
- FIFO per warehouse is supported: cost layers are scoped to the warehouse where goods were received.
- Produces the most accurate cost-of-goods-sold for rising-price environments.

**2. Weighted Average (WA)**

The weighted average cost is recalculated on every goods receipt:

```
newWAC = (existingQty * existingWAC + receivedQty * receivedUnitCost) / (existingQty + receivedQty)
```

- The current WAC is stored on `InventoryItem.weightedAveragePrice` and updated atomically when a `GOODS_RECEIPT` movement is posted.
- Goods issues use the current WAC as the `unitCost`.
- WA per warehouse is supported by maintaining the WAC calculation at the `StockBalance` level (the `costValue / quantityOnHand` ratio).
- Simplest to implement; recommended as the default for most UK SMEs.

**3. Standard Cost**

A predetermined cost is set on `InventoryItem.standardCost`. All goods issues use this fixed cost regardless of actual purchase prices. Variances between actual purchase price and standard cost are posted to a purchase price variance GL account (configured on `ItemGroup.defaultWipAccountCode` or a dedicated variance account).

- Standard cost is typically reviewed and updated periodically (monthly or quarterly).
- Useful for manufacturing environments where stable costing simplifies BOM cost rollups.

**4. Last Purchase Price**

The `unitCost` for goods issues is set to `InventoryItem.lastPurchasePrice`, which is updated automatically whenever a `GOODS_RECEIPT` from a purchase order is posted.

- Simplest method; no cost layers or running averages.
- Suitable for low-volume or drop-ship items where cost volatility is acceptable.

**GL posting pattern for stock movements:**

| Movement | Debit | Credit |
|---|---|---|
| Goods Receipt (purchase) | Stock Account | GRN Accrual / AP |
| Goods Issue (sale) | COGS Account | Stock Account |
| Adjustment In | Stock Account | Inventory Adjustment Account |
| Adjustment Out | Inventory Adjustment Account | Stock Account |
| Transfer (out) | In-Transit Account | Stock Account (from) |
| Transfer (in) | Stock Account (to) | In-Transit Account |
| Scrap | Scrap / Write-off Account | Stock Account |

---

#### Stock Movement Flow

All stock quantity changes follow a consistent two-phase flow:

```
1. CREATE movement (status = DRAFT)
   ├─ Validate: item exists, warehouse active, quantity sign matches type
   ├─ If serial-tracked: validate serial number exists / is available
   └─ If batch-tracked: validate batch number

2. POST movement (status = DRAFT → POSTED)
   ├─ Calculate unitCost based on item's costingMethod
   ├─ Update StockBalance.quantityOnHand (atomic increment/decrement)
   ├─ Update StockBalance.costValue
   ├─ Update StockBalance.lastMovementDate
   ├─ If WA costing: recalculate InventoryItem.weightedAveragePrice
   ├─ If last-purchase costing + receipt: update InventoryItem.lastPurchasePrice
   ├─ If serial-tracked: update SerialNumber.status and warehouseId
   ├─ Generate GL journal entry (debit/credit per table above)
   └─ All updates within a single database transaction

3. REVERSE movement (status = POSTED → REVERSED)
   ├─ Create a new contra-movement (opposite quantity, same cost)
   ├─ Link via reversedById
   ├─ Reverse StockBalance updates
   ├─ Reverse GL journal entry
   └─ If serial-tracked: revert SerialNumber.status
```

**Inter-warehouse transfers** create two linked movements: a `TRANSFER_OUT` (negative quantity from source warehouse) and a `TRANSFER_IN` (positive quantity to destination warehouse), sharing the same `reference` value. Both are posted atomically in a single transaction.

**Automated movement creation:** Stock movements are not always created manually. The following modules create movements automatically:

- **Purchasing:** Goods Receipt Note (GRN) posting creates `GOODS_RECEIPT` movements.
- **Sales:** Shipment/delivery confirmation creates `GOODS_ISSUE` movements.
- **Manufacturing:** Work order material consumption creates `PRODUCTION_OUT`; finished goods receipt creates `PRODUCTION_IN`.
- **Returns:** Customer return processing creates `RETURN_IN`; supplier return creates `RETURN_OUT`.

---

#### Available-to-Promise (ATP) Calculation

```
quantityAvailable = quantityOnHand - quantityReserved
```

The `quantityOnOrder` field tracks inbound quantities from approved but not-yet-received purchase orders and production orders. The full ATP check across all warehouses is:

```
ATP = SUM(quantityOnHand) - SUM(quantityReserved) + SUM(quantityOnOrder)
```

This is computed at query time from `StockBalance` rows rather than stored as a single field, allowing warehouse-level filtering.

---

#### Build Sequence

The Inventory module sits in **Tier 1 (Core Business)** and depends on Tier 0 foundation modules plus Finance for GL posting. Recommended story sequencing:

| Story | Scope | Dependencies |
|---|---|---|
| 9.1 | `ItemGroup` CRUD + seed data | Tier 0 complete |
| 9.2 | `Warehouse` CRUD + seed data | Tier 0 complete |
| 9.3 | `UnitOfMeasure` CRUD + seed data | Tier 0 complete |
| 9.4 | `InventoryItem` CRUD (all field groups) | 9.1, 9.2, 9.3 |
| 9.5 | `StockMovement` create/post/reverse + `StockBalance` maintenance | 9.4, Finance GL posting |
| 9.6 | Costing engine (FIFO layers, WA recalc, standard cost, last purchase) | 9.5 |
| 9.7 | Stock movement GL integration (journal entry generation) | 9.5, Finance GL |
| 9.8 | Inter-warehouse transfers (paired movements) | 9.5 |
| 9.9 | ATP query API | 9.5 |
| 9.10 | Inventory valuation report | 9.6 |
| P1 | `SerialNumber` tracking, `StockReservation`, `StockCount` (cycle count), multi-barcode | 9.5 |

**Cross-module integration points:**
- **Finance (section 2.10):** GL account references on `ItemGroup` and `InventoryItem`; journal entries from stock movements.
- **Sales (section 2.12):** Sales order fulfilment triggers `GOODS_ISSUE` movements; ATP checks during order entry.
- **Purchasing (section 2.13):** GRN posting triggers `GOODS_RECEIPT` movements; updates `lastPurchasePrice`.
- **Manufacturing (section 2.15):** BOM consumption triggers `PRODUCTION_OUT`; finished goods trigger `PRODUCTION_IN`.

---

*End of section 2.14*

### 2.15 Sales Ledger Module — Customers, Invoices & Payments (AR)

The Sales Ledger (Accounts Receivable) module manages the full customer lifecycle: customer master data, sales invoices, credit notes, payment receipts, payment allocation, credit control, and aging. It is the primary revenue-side sub-ledger, posting balanced journal entries into the General Ledger on every financial event (invoice approval, payment receipt, credit note, write-off). In the legacy HansaWorld system, this spans CUVc (313 fields), IVVc (100+ fields), ARVc (aging), ARPayVc (payments), DelAddrVc (delivery addresses), ContactVc (contacts), and LetVc (dunning letters).

Nexa consolidates and modernises these into a clean relational schema with proper type safety, structured addresses, multi-currency support, and full GL integration. Credit notes are modelled as invoices with type `CREDIT_NOTE` rather than a separate entity, simplifying allocation logic and reporting. The module sits in `apps/api/src/modules/ar/` as a Fastify plugin.

---

**Legacy to Nexa Mapping:**

| Legacy Register | HAL Source | Fields | Nexa Model(s) | Notes |
|----------------|-----------|--------|--------------|-------|
| CUVc | datadef1.hal | 313 | **Customer**, **CustomerAddress**, **CustomerContact** | Unified customer/supplier in legacy; Nexa separates Customer (AR) and Supplier (AP). ~40 MVP fields from 313. |
| IVVc | datadef2.hal | 100+ lines/header | **CustomerInvoice**, **CustomerInvoiceLine** | InvType mapped to `InvoiceType` enum. OKFlag mapped to `InvoiceStatus`. Credit notes are invoices with type `CREDIT_NOTE`. |
| ARVc | datadef1.hal | 11 | Computed (aging query) | Not stored; aging calculated on-demand from outstanding invoices. |
| ARPayVc | datadef1.hal | 15 | **CustomerPayment**, **PaymentAllocation** | Payment entity + separate allocation junction for multi-invoice matching. |
| ARInstallVc | datadef1.hal | 7 | P2 (instalment plans) | Not MVP. |
| DelAddrVc | datadef2.hal | ~20 | **CustomerAddress** | Multiple typed addresses per customer. |
| ContactVc | datadef3.hal | 32 | **CustomerContact** | Multiple contacts per customer with primary flag. |
| LetVc | — | — | P1 (dunning letters) | Dunning automation designed but deferred to P1. |
| IVCashVc | datadef6.hal | 141 | **CustomerInvoice** (type=CASH) | Cash invoices are invoices with `invoiceType: CASH` and immediate payment. |

---

**Prisma Models:**

```prisma
// ═══════════════════════════════════════════════
// SALES LEDGER (AR) MODULE — Customers, Invoices & Payments
// ═══════════════════════════════════════════════

// ───────────────────────────────────────────────
// Enums
// ───────────────────────────────────────────────

enum CustomerType {
  COMPANY
  INDIVIDUAL

  @@map("customer_type")
}

enum AddressType {
  BILLING
  SHIPPING
  REGISTERED
  OTHER

  @@map("address_type")
}

enum InvoiceType {
  STANDARD
  CASH
  CREDIT_NOTE
  DEBIT_NOTE
  PROFORMA

  @@map("invoice_type")
}

enum InvoiceStatus {
  DRAFT
  APPROVED
  POSTED
  CANCELLED
  VOID

  @@map("invoice_status")
}

enum PaymentMethod {
  BANK_TRANSFER
  CARD
  CASH
  CHEQUE
  DIRECT_DEBIT

  @@map("payment_method")
}

enum PaymentStatus {
  DRAFT
  POSTED
  CANCELLED

  @@map("payment_status")
}

// ───────────────────────────────────────────────
// 1. Customer (reference entity — isActive pattern)
// ───────────────────────────────────────────────

model Customer {
  id                      String        @id @default(uuid())

  // Identity
  code                    String        @unique                           // e.g., "ACME001"
  name                    String                                          // Trading / display name
  legalName               String?       @map("legal_name")                // Registered legal name if different
  customerType            CustomerType  @default(COMPANY) @map("customer_type")
  category                String?       @db.VarChar(50)                   // Freeform classification

  // Contact
  phone                   String?       @db.VarChar(30)
  mobile                  String?       @db.VarChar(30)
  email                   String?       @db.VarChar(255)
  website                 String?       @db.VarChar(255)
  fax                     String?       @db.VarChar(30)

  // Primary address (always present; additional addresses in CustomerAddress)
  addressLine1            String?       @map("address_line_1")
  addressLine2            String?       @map("address_line_2")
  city                    String?
  county                  String?
  postcode                String?       @db.VarChar(15)
  countryCode             String        @default("GB") @map("country_code") @db.VarChar(3)

  // Billing (bill-to parent for group invoicing)
  invoiceToCustomerId     String?       @map("invoice_to_customer_id")    // FK self — bill-to parent
  invoiceToCustomer       Customer?     @relation("BillToParent", fields: [invoiceToCustomerId], references: [id])
  billToChildren          Customer[]    @relation("BillToParent")

  // Payment & currency defaults
  paymentTermsId          String?       @map("payment_terms_id")          // FK to PaymentTerms
  currencyCode            String        @default("GBP") @map("currency_code") @db.VarChar(3)

  // Credit management
  creditLimit             Decimal?      @map("credit_limit") @db.Decimal(19, 4)
  creditLimitDays         Int?          @map("credit_limit_days")         // Max days overdue before block
  onHold                  Boolean       @default(false) @map("on_hold")   // Manual credit hold
  blocked                 Boolean       @default(false)                   // Fully blocked — no transactions

  // AR configuration
  chargeInterest          Boolean       @default(false) @map("charge_interest")
  sendReminders           Boolean       @default(true) @map("send_reminders")
  sendStatements          Boolean       @default(true) @map("send_statements")

  // Sales defaults
  defaultSalesPersonId    String?       @map("default_sales_person_id")   // FK to User
  salesGroupCode          String?       @map("sales_group_code") @db.VarChar(20)
  priceListId             String?       @map("price_list_id")             // FK to PriceList (Sales/CRM module)
  discountPercent         Decimal?      @map("discount_percent") @db.Decimal(5, 2)
  regionCode              String?       @map("region_code") @db.VarChar(20)

  // Tax
  vatNumber               String?       @map("vat_number") @db.VarChar(20)  // e.g., "GB123456789"
  vatCodeId               String?       @map("vat_code_id")                 // FK to VatCode — default VAT code
  taxExempt               Boolean       @default(false) @map("tax_exempt")

  // GL account overrides (defaults come from SubLedgerControl)
  defaultRevenueAccountCode String?     @map("default_revenue_account_code") @db.VarChar(20)
  defaultArAccountCode      String?     @map("default_ar_account_code") @db.VarChar(20)

  // Notes
  internalNotes           String?       @map("internal_notes") @db.Text

  // Custom / extensible (user-defined fields before Custom Fields infrastructure)
  customField1            String?       @map("custom_field_1")
  customField2            String?       @map("custom_field_2")
  customField3            String?       @map("custom_field_3")
  customField4            String?       @map("custom_field_4")
  customField5            String?       @map("custom_field_5")

  // Standard fields
  isActive                Boolean       @default(true) @map("is_active")
  createdAt               DateTime      @default(now()) @map("created_at")
  updatedAt               DateTime      @updatedAt @map("updated_at")
  createdBy               String        @map("created_by")
  updatedBy               String        @map("updated_by")

  // Relations
  addresses               CustomerAddress[]
  contacts                CustomerContact[]
  invoices                CustomerInvoice[]
  payments                CustomerPayment[]

  @@map("customers")
  @@index([isActive], map: "idx_customers_active")
  @@index([code], map: "idx_customers_code")
  @@index([name], map: "idx_customers_name")
  @@index([regionCode], map: "idx_customers_region")
  @@index([defaultSalesPersonId], map: "idx_customers_salesperson")
  @@index([invoiceToCustomerId], map: "idx_customers_bill_to")
}

// ───────────────────────────────────────────────
// 2. CustomerAddress (multiple addresses per customer)
// ───────────────────────────────────────────────

model CustomerAddress {
  id                      String        @id @default(uuid())
  customerId              String        @map("customer_id")
  customer                Customer      @relation(fields: [customerId], references: [id])

  addressType             AddressType   @map("address_type")
  isDefault               Boolean       @default(false) @map("is_default")  // Default for this type

  addressLine1            String        @map("address_line_1")
  addressLine2            String?       @map("address_line_2")
  city                    String
  county                  String?
  postcode                String        @db.VarChar(15)
  countryCode             String        @default("GB") @map("country_code") @db.VarChar(3)

  // Address-level contact
  contactName             String?       @map("contact_name")
  contactPhone            String?       @map("contact_phone") @db.VarChar(30)
  contactEmail            String?       @map("contact_email") @db.VarChar(255)

  isActive                Boolean       @default(true) @map("is_active")
  createdAt               DateTime      @default(now()) @map("created_at")
  updatedAt               DateTime      @updatedAt @map("updated_at")

  @@map("customer_addresses")
  @@index([customerId, addressType], map: "idx_customer_addresses_type")
  @@index([customerId, isDefault], map: "idx_customer_addresses_default")
}

// ───────────────────────────────────────────────
// 3. CustomerContact (multiple contacts per customer)
// ───────────────────────────────────────────────

model CustomerContact {
  id                      String        @id @default(uuid())
  customerId              String        @map("customer_id")
  customer                Customer      @relation(fields: [customerId], references: [id])

  firstName               String        @map("first_name")
  lastName                String        @map("last_name")
  jobTitle                String?       @map("job_title")
  department              String?

  phone                   String?       @db.VarChar(30)
  mobile                  String?       @db.VarChar(30)
  email                   String?       @db.VarChar(255)

  isPrimary               Boolean       @default(false) @map("is_primary")
  isActive                Boolean       @default(true) @map("is_active")
  createdAt               DateTime      @default(now()) @map("created_at")
  updatedAt               DateTime      @updatedAt @map("updated_at")

  @@map("customer_contacts")
  @@index([customerId], map: "idx_customer_contacts_customer")
  @@index([customerId, isPrimary], map: "idx_customer_contacts_primary")
  @@index([email], map: "idx_customer_contacts_email")
}

// ───────────────────────────────────────────────
// 4. CustomerInvoice (transactional — status enum, no isActive)
// ───────────────────────────────────────────────

model CustomerInvoice {
  id                      String         @id @default(uuid())

  // Identification
  invoiceNumber           String         @unique @map("invoice_number")    // From NumberSeries: "INV-00001"
  invoiceType             InvoiceType    @default(STANDARD) @map("invoice_type")

  // Customer reference (denormalised name for reporting performance)
  customerId              String         @map("customer_id")
  customer                Customer       @relation(fields: [customerId], references: [id])
  customerName            String         @map("customer_name")             // Snapshot at creation
  customerCode            String         @map("customer_code")             // Snapshot at creation

  // Dates
  invoiceDate             DateTime       @map("invoice_date") @db.Date
  dueDate                 DateTime       @map("due_date") @db.Date
  transactionDate         DateTime       @map("transaction_date") @db.Date // GL posting date (may differ from invoice date)

  // Address snapshots (frozen at invoice creation — immune to customer address changes)
  billingAddress           Json?         @map("billing_address") @db.JsonB  // { line1, line2, city, county, postcode, countryCode }
  shippingAddress          Json?         @map("shipping_address") @db.JsonB // { line1, line2, city, county, postcode, countryCode }

  // Financial totals (all Decimal 19,4)
  subtotal                Decimal        @default(0) @db.Decimal(19, 4)
  discountAmount          Decimal        @default(0) @map("discount_amount") @db.Decimal(19, 4)
  discountPercent         Decimal        @default(0) @map("discount_percent") @db.Decimal(5, 2)
  vatAmount               Decimal        @default(0) @map("vat_amount") @db.Decimal(19, 4)
  totalAmount             Decimal        @default(0) @map("total_amount") @db.Decimal(19, 4)
  paidAmount              Decimal        @default(0) @map("paid_amount") @db.Decimal(19, 4)
  outstandingAmount       Decimal        @default(0) @map("outstanding_amount") @db.Decimal(19, 4)

  // Currency
  currencyCode            String         @default("GBP") @map("currency_code") @db.VarChar(3)
  exchangeRate            Decimal        @default(1) @map("exchange_rate") @db.Decimal(10, 6)

  // Terms
  paymentTermsId          String?        @map("payment_terms_id")          // FK to PaymentTerms

  // Status & lifecycle
  status                  InvoiceStatus  @default(DRAFT)

  // GL integration
  journalEntryId          String?        @unique @map("journal_entry_id")  // FK to JournalEntry (set on POSTED)

  // Source documents
  salesOrderId            String?        @map("sales_order_id")            // FK to SalesOrder (if created from SO)
  quotationId             String?        @map("quotation_id")              // FK to SalesQuote

  // Customer reference / PO number
  customerReference       String?        @map("customer_reference")        // Customer's PO number

  // Control flags
  isExported              Boolean        @default(false) @map("is_exported")
  isDisputed              Boolean        @default(false) @map("is_disputed")
  noInterest              Boolean        @default(false) @map("no_interest")    // Override: skip interest charges
  noReminder              Boolean        @default(false) @map("no_reminder")    // Override: skip dunning

  // Financial period
  periodId                String?        @map("period_id")                 // FK to FinancialPeriod

  // Notes
  notes                   String?        @db.Text
  internalNotes           String?        @map("internal_notes") @db.Text

  // Standard fields
  createdAt               DateTime       @default(now()) @map("created_at")
  updatedAt               DateTime       @updatedAt @map("updated_at")
  createdBy               String         @map("created_by")
  updatedBy               String         @map("updated_by")

  // Relations
  lines                   CustomerInvoiceLine[]
  allocations             PaymentAllocation[]

  @@map("customer_invoices")
  @@index([customerId], map: "idx_customer_invoices_customer")
  @@index([status], map: "idx_customer_invoices_status")
  @@index([invoiceDate], map: "idx_customer_invoices_date")
  @@index([dueDate], map: "idx_customer_invoices_due_date")
  @@index([invoiceType], map: "idx_customer_invoices_type")
  @@index([periodId], map: "idx_customer_invoices_period")
  @@index([salesOrderId], map: "idx_customer_invoices_sales_order")
  @@index([customerId, status, dueDate], map: "idx_customer_invoices_aging")
}

// ───────────────────────────────────────────────
// 5. CustomerInvoiceLine
// ───────────────────────────────────────────────

model CustomerInvoiceLine {
  id                      String         @id @default(uuid())
  invoiceId               String         @map("invoice_id")
  invoice                 CustomerInvoice @relation(fields: [invoiceId], references: [id], onDelete: Cascade)

  lineNumber              Int            @map("line_number")               // 1-based display order

  // Item reference (optional — service lines may not have an item)
  itemId                  String?        @map("item_id")                   // FK to InventoryItem
  description             String                                           // Line description (freeform or from item)

  // Quantities & pricing
  quantity                Decimal        @db.Decimal(10, 4)
  unitPrice               Decimal        @map("unit_price") @db.Decimal(19, 4)
  discountPercent         Decimal        @default(0) @map("discount_percent") @db.Decimal(5, 2)
  lineTotal               Decimal        @map("line_total") @db.Decimal(19, 4)  // qty * unitPrice * (1 - discount/100)

  // Tax
  vatCodeId               String?        @map("vat_code_id")               // FK to VatCode
  vatRate                 Decimal        @default(0) @map("vat_rate") @db.Decimal(5, 2) // Snapshot of rate at time of creation
  vatAmount               Decimal        @default(0) @map("vat_amount") @db.Decimal(19, 4)

  // GL account (revenue account for this line)
  accountCode             String?        @map("account_code") @db.VarChar(20)  // FK to ChartOfAccount.code

  // Dimensions / cost tracking
  departmentCode          String?        @map("department_code") @db.VarChar(20)
  tagCode                 String?        @map("tag_code") @db.VarChar(20)

  // Unit of measure
  unitOfMeasure           String?        @map("unit_of_measure") @db.VarChar(20)

  createdAt               DateTime       @default(now()) @map("created_at")
  updatedAt               DateTime       @updatedAt @map("updated_at")

  @@map("customer_invoice_lines")
  @@index([invoiceId], map: "idx_customer_invoice_lines_invoice")
  @@index([itemId], map: "idx_customer_invoice_lines_item")
  @@unique([invoiceId, lineNumber], map: "uq_customer_invoice_lines_number")
}

// ───────────────────────────────────────────────
// 6. CustomerPayment (transactional — status enum, no isActive)
// ───────────────────────────────────────────────

model CustomerPayment {
  id                      String         @id @default(uuid())

  // Identification
  paymentNumber           String         @unique @map("payment_number")    // From NumberSeries: "RCT-00001"

  // Customer
  customerId              String         @map("customer_id")
  customer                Customer       @relation(fields: [customerId], references: [id])

  // Payment details
  paymentDate             DateTime       @map("payment_date") @db.Date
  amount                  Decimal        @db.Decimal(19, 4)
  currencyCode            String         @default("GBP") @map("currency_code") @db.VarChar(3)
  exchangeRate            Decimal        @default(1) @map("exchange_rate") @db.Decimal(10, 6)

  // Bank
  bankAccountId           String?        @map("bank_account_id")           // FK to BankAccount

  // Method & reference
  paymentMethod           PaymentMethod  @map("payment_method")
  reference               String?                                          // Cheque number, BACS ref, etc.
  description             String?

  // Status
  status                  PaymentStatus  @default(DRAFT)

  // GL integration
  journalEntryId          String?        @unique @map("journal_entry_id")  // FK to JournalEntry (set on POSTED)

  // Standard fields
  createdAt               DateTime       @default(now()) @map("created_at")
  updatedAt               DateTime       @updatedAt @map("updated_at")
  createdBy               String         @map("created_by")
  updatedBy               String         @map("updated_by")

  // Relations
  allocations             PaymentAllocation[]

  @@map("customer_payments")
  @@index([customerId], map: "idx_customer_payments_customer")
  @@index([status], map: "idx_customer_payments_status")
  @@index([paymentDate], map: "idx_customer_payments_date")
  @@index([bankAccountId], map: "idx_customer_payments_bank")
}

// ───────────────────────────────────────────────
// 7. PaymentAllocation (junction — links payments to invoices)
// ───────────────────────────────────────────────

model PaymentAllocation {
  id                      String         @id @default(uuid())

  // Links
  paymentId               String         @map("payment_id")
  payment                 CustomerPayment @relation(fields: [paymentId], references: [id])
  invoiceId               String         @map("invoice_id")
  invoice                 CustomerInvoice @relation(fields: [invoiceId], references: [id])

  // Allocation amount
  amount                  Decimal        @db.Decimal(19, 4)                // Amount of this payment applied to this invoice

  // FX gain/loss (when payment currency rate differs from invoice currency rate)
  exchangeDifference      Decimal        @default(0) @map("exchange_difference") @db.Decimal(19, 4)

  createdAt               DateTime       @default(now()) @map("created_at")
  createdBy               String         @map("created_by")

  @@map("payment_allocations")
  @@index([paymentId], map: "idx_payment_allocations_payment")
  @@index([invoiceId], map: "idx_payment_allocations_invoice")
  @@unique([paymentId, invoiceId], map: "uq_payment_allocations_payment_invoice")
}

// ───────────────────────────────────────────────
// 8. CustomerStatement (NOT a stored entity)
// ───────────────────────────────────────────────
// Customer statements are generated on-demand by querying
// CustomerInvoice (outstanding) + CustomerPayment (recent)
// for a given customer and date range. The output is rendered
// as PDF via the DocumentTemplate system (type: CUSTOMER_STATEMENT).
//
// No Prisma model needed. Implementation:
//   - Service: apps/api/src/modules/ar/services/statement.service.ts
//   - Endpoint: GET /api/v1/ar/customers/:id/statement?from=&to=
//   - Returns: PDF stream or JSON data for UI rendering
```

---

**Invoice Lifecycle:**

```
                 ┌────────────────────────────────────────────┐
                 │            INVOICE LIFECYCLE               │
                 └────────────────────────────────────────────┘

  ┌─────────┐    Approve     ┌──────────┐    Post (GL)    ┌──────────┐
  │  DRAFT  │ ─────────────► │ APPROVED │ ──────────────► │  POSTED  │
  └─────────┘                └──────────┘                 └──────────┘
       │                          │                            │
       │ Cancel                   │ Cancel                     │ Receive payments
       ▼                          ▼                            ▼
  ┌───────────┐             ┌───────────┐              ┌─────────────┐
  │ CANCELLED │             │ CANCELLED │              │  POSTED     │
  └───────────┘             └───────────┘              │  (partial)  │
                                                       └──────┬──────┘
                                                              │ Fully paid
                                                              ▼
                                                       ┌─────────────┐
                                                       │  POSTED     │
                                                       │  (paid)     │
                                                       └─────────────┘

  Credit Note (type=CREDIT_NOTE) follows the same lifecycle.
  VOID is for posted invoices that must be reversed (creates reversal JE).
```

**State transition rules:**

| From | To | Trigger | Side Effects |
|------|-----|---------|-------------|
| DRAFT | APPROVED | User approval or auto-approve (if `totalAmount < SystemSetting.invoiceAutoApproveThreshold`) | Validates: at least 1 line, totals recalculated, due date set from payment terms if blank. |
| DRAFT | CANCELLED | User cancellation | None. Draft invoices have no GL impact. |
| APPROVED | POSTED | Post action (manual or batch) | **Creates JournalEntry**: Debit AR control account (from SubLedgerControl), Credit revenue account(s) per line. Credit VAT output account per line VAT amount. Sets `outstandingAmount = totalAmount`. Sets `journalEntryId`. Emits `invoice.posted` event. |
| APPROVED | CANCELLED | User cancellation before posting | None. No GL reversal needed. |
| POSTED | VOID | Void action (for corrections) | **Creates reversal JournalEntry** (mirror of original with swapped debits/credits). Sets `outstandingAmount = 0`. Original JE remains for audit trail. Emits `invoice.voided` event. |

**GL posting on invoice approval/post (POSTED transition):**

```
Journal Entry: "Sales Invoice INV-00042"
  DocRef: AR:INV-00042
  Date: transactionDate
  Period: periodId

  Lines:
    DR  1100 Accounts Receivable (AR control)     £1,200.00
    CR  4000 Sales Revenue (from line 1 accountCode)  £500.00
    CR  4000 Sales Revenue (from line 2 accountCode)  £500.00
    CR  2200 VAT Output (from VatCode)                £200.00
                                                   ─────────
    Balance:                                          £0.00 ✓
```

The AR control account code comes from `SubLedgerControl` where `subLedgerType = 'AR'`. Revenue account codes come from the invoice line `accountCode`, falling back to `Customer.defaultRevenueAccountCode`, then to `SystemSetting('ar.defaultRevenueAccount')`. VAT account comes from the `VatCode.salesAccountCode`.

---

**Credit Management Workflow:**

```
  New Invoice/Order Created
          │
          ▼
  ┌───────────────────────┐
  │ Check Credit Status   │
  │                       │
  │ 1. Customer.blocked?  │──── Yes ──► BLOCK: "Customer is blocked"
  │ 2. Customer.onHold?   │──── Yes ──► WARN: "Customer on credit hold"
  │ 3. Credit limit set?  │──── No ───► ALLOW (no limit configured)
  └───────────┬───────────┘
              │ Yes
              ▼
  ┌───────────────────────────────────────────┐
  │ Calculate exposure:                       │
  │   outstanding = SUM(outstandingAmount)    │
  │                 from all POSTED invoices  │
  │   pending     = SUM(totalAmount)          │
  │                 from DRAFT+APPROVED       │
  │   thisInvoice = current invoice total     │
  │   exposure    = outstanding + pending     │
  │                 + thisInvoice             │
  └───────────────┬───────────────────────────┘
                  │
                  ▼
  ┌───────────────────────────────────────┐
  │ exposure > Customer.creditLimit?      │
  │                                       │
  │ Yes ──► WARN or BLOCK (configurable)  │
  │         SystemSetting:                │
  │         'ar.creditLimitAction'        │
  │         = 'WARN' | 'BLOCK'           │
  │                                       │
  │ No  ──► ALLOW                         │
  └───────────────────────────────────────┘
```

Credit checks run at two points:
1. **Invoice creation/approval** -- called from `InvoiceService.approve()`.
2. **Sales order confirmation** -- called from `SalesOrderService.confirm()` (Sales module invokes AR credit check via internal service call).

The `CreditCheckService` (in `apps/api/src/modules/ar/services/credit-check.service.ts`) is a shared service consumed by both AR and Sales modules. It returns a `CreditCheckResult` with `{ allowed: boolean, reason?: string, exposure: Decimal, limit: Decimal }`.

**Aging buckets** (for credit management dashboards and reporting):

| Bucket | Days Overdue | Description |
|--------|-------------|-------------|
| Current | Not yet due | Invoice due date is in the future |
| 1-30 | 1-30 days past due | First reminder territory |
| 31-60 | 31-60 days past due | Second reminder |
| 61-90 | 61-90 days past due | Formal notice |
| 91+ | >90 days past due | Escalation / collection |

Aging is computed on-demand (not stored), querying `customer_invoices` where `status = 'POSTED'` and `outstandingAmount > 0`, bucketed by `CURRENT_DATE - due_date`.

---

**Payment Allocation Workflow:**

```
  Customer Payment Received (e.g., £2,500)
          │
          ▼
  ┌──────────────────────────────────────┐
  │ 1. Create CustomerPayment            │
  │    paymentNumber: "RCT-00015"       │
  │    amount: £2,500                    │
  │    status: DRAFT                     │
  └──────────────┬───────────────────────┘
                 │
                 ▼
  ┌──────────────────────────────────────┐
  │ 2. Allocate to invoices              │
  │    (user selects or AI suggests)     │
  │                                      │
  │    INV-00042  £1,200  ──► allocate £1,200  (fully paid)
  │    INV-00039  £1,800  ──► allocate £1,300  (partially paid)
  │                                      │
  │    Total allocated: £2,500           │
  │    Unallocated: £0                   │
  └──────────────┬───────────────────────┘
                 │
                 ▼
  ┌──────────────────────────────────────┐
  │ 3. Post payment (status → POSTED)    │
  │                                      │
  │  For each allocation:                │
  │    Update invoice.paidAmount         │
  │    Update invoice.outstandingAmount  │
  │    If outstandingAmount = 0:         │
  │      invoice remains POSTED          │
  │      (paidAmount = totalAmount       │
  │       signals fully paid)            │
  │                                      │
  │  Create JournalEntry:               │
  │    DR  1200 Bank Account  £2,500     │
  │    CR  1100 AR Control    £2,500     │
  │                                      │
  │  If FX difference on allocation:     │
  │    DR/CR Exchange Gain/Loss account  │
  │                                      │
  │  Emit: payment.posted event          │
  └──────────────────────────────────────┘
```

**On-account payments** (unallocated): A payment can be posted without full allocation. The unallocated portion stays as a credit balance on the customer account. Later allocation is done via a separate `POST /api/v1/ar/payments/:id/allocate` endpoint.

**Payment reversal**: Reversal creates a mirror JournalEntry (swap DR/CR), restores `invoice.outstandingAmount` and `invoice.paidAmount` on all linked allocations, and sets `PaymentStatus.CANCELLED` on the payment. Allocation records are soft-deleted (not physically removed) for audit trail.

**Multi-currency payments**: When a payment in a foreign currency is allocated to an invoice in the same foreign currency but at a different exchange rate, the `PaymentAllocation.exchangeDifference` captures the realised FX gain or loss. This is posted to the exchange gain/loss accounts from `SubLedgerControl`.

---

**Build Sequence Note:**

The AR module is scheduled for **Story 9+** in the implementation plan, making it one of the first business modules built after the Finance foundation (GL, Chart of Accounts, Journal Entries, Financial Periods). The build order is:

1. **Stories 1-3**: Foundation (monorepo, database package with GL schema, auth/RBAC)
2. **Stories 4-6**: Finance core (GL posting service, period management, bank accounts)
3. **Stories 7-8**: System module entities (currencies, payment terms, VAT codes, number series, document templates)
4. **Stories 9-11**: **AR module** (Customer CRUD, invoice lifecycle, payment receipts, credit notes, aging, credit checks)
5. **Stories 12+**: AP module (mirrors AR patterns), then Sales, Purchasing, Inventory

AR depends on:
- `JournalEntry` / `JournalLine` (Finance GL) -- for posting
- `FinancialPeriod` (Finance) -- for period assignment and lock enforcement
- `NumberSeries` (System) -- for invoice/payment number generation
- `PaymentTerms` (System) -- for due date calculation
- `VatCode` (System) -- for tax calculation
- `SubLedgerControl` (System) -- for AR control account resolution
- `ChartOfAccount` (Finance) -- for revenue and VAT account validation
- `DocumentTemplate` (System) -- for invoice/statement PDF generation
- `BankAccount` (Finance/Banking) -- for payment receipt bank reference

AR is consumed by:
- **Sales module** -- creates invoices from sales orders; calls credit check service
- **POS module** -- creates cash invoices (type=CASH) with immediate payment
- **Reporting module** -- queries AR data for aging reports, debtor analysis, revenue reports
- **AI module** -- subscribes to `invoice.posted`, `payment.posted`, `invoice.overdue` events for briefings and anomaly detection

### 2.16 Sales Orders Module — Quotes, Orders & Dispatch

The Sales Orders module manages the full quote-to-invoice lifecycle: creating quotations, converting accepted quotes into sales orders, dispatching/shipping goods, and handing off to the AR module for invoicing. It is the operational backbone of the order-to-cash process and interacts heavily with Inventory (stock reservation, availability checks, warehouse allocation), AR (invoice creation from fulfilled orders), Finance/GL (revenue recognition via AR), and CRM (salesperson attribution, opportunity linkage).

In the legacy HansaWorld system, this maps to the SO (Sales Orders) module containing ORVc (Sales Orders, 165 header + 66 array fields), QTVc (Quotations, 148 header + 57 array fields), DispatchVc (Dispatch/Shipment), and COVc (Blanket/Contract Orders, 102 + 44 fields). The PreQTVc (Pre-Quotations), ORProgVc (Standing Orders), and EDIORVc (EDI Orders) registers are deferred to P2/P3.

---

#### Legacy-to-Nexa Mapping

| Legacy Register | Legacy Entity | Fields | Nexa Target Model(s) | Priority | Notes |
|----------------|--------------|--------|----------------------|----------|-------|
| ORVc | Sales Orders | 165 + 66 | **SalesOrder** + **SalesOrderLine** | MVP | Core transactional entity. Currently SKELETON in target -- needs full build-out. |
| QTVc | Quotations | 148 + 57 | **SalesQuote** + **SalesQuoteLine** | MVP | Validity tracking, win probability, conversion to order. |
| DispatchVc | Dispatch/Shipment | ~60 | **Dispatch** + **DispatchLine** | MVP | Physical shipment record. Updates shipped quantities on order lines. |
| COVc | Blanket/Contract Orders | 102 + 44 | Deferred | P2 | Standing/blanket orders with scheduled releases. |
| PreQTVc | Pre-Quotations | ~80 | Deferred | P2 | Early-stage inquiry before formal quote. |
| ORProgVc | Standing/Recurring Orders | ~40 | Deferred | P2 | Scheduled order generation. |
| EDIORVc | EDI Sales Orders | ~50 | Deferred | P3 | Electronic data interchange inbound orders. |
| RetVc | Customer Returns/RMA | 50+ | Deferred | P1 | Return merchandise authorization. |
| QTSettBlock | Quote Settings | 6+ fields | **SalesModuleSetting** (JSON or typed) | MVP | Quote validity days, require classification, prevent overbilling. |
| DispatchDefBlock | Dispatch Defaults | ~4 fields | **SalesModuleSetting** | MVP | Default shipping method, auto-print settings. |
| SalesCodeBlock | Sales Dept GL Mapping | ~8 fields | **SalesGroup** + GL account FKs | P1 | Maps sales departments to revenue GL accounts. |

#### Key Legacy Field Mappings (ORVc Header)

| HAL Field | HAL Type | Nexa Field | Nexa Model | Strategy |
|-----------|----------|-----------|------------|----------|
| SerNr | M4Long | orderNumber | SalesOrder | DIRECT (auto via NumberSeries) |
| OrdDate | M4Date | orderDate | SalesOrder | DIRECT |
| CustCode | M4Code(20) | customerId | SalesOrder | FK to Customer |
| InvoiceToCode | M4Code(20) | billToCustomerId | SalesOrder | FK self-ref on Customer |
| Addr0-3 | M4Str(60) | billingAddress | SalesOrder | JSON snapshot |
| ShipAddr0-3 | M4Str(60) | shippingAddress | SalesOrder | JSON snapshot |
| CustOrdNr | M4Str(60) | customerReference | SalesOrder | DIRECT |
| SalesMan | M4UStr(60) | salesPersonId | SalesOrder | FK to User |
| PayDeal | M4Code(3) | paymentTermsId | SalesOrder | FK to PaymentTerms |
| ShipMode | M4Code(5) | shippingMethodId | SalesOrder | FK to ShippingMethod |
| CurncyCode | M4Code(5) | currencyCode | SalesOrder | FK to Currency |
| PriceList | M4Code(20) | priceListId | SalesOrder | FK to PriceList |
| Location | M4Code(10) | warehouseId | SalesOrder | FK to Warehouse |
| OrderStatus + OKFlag + ShipFlag + InvFlag + Closed | Various | status | SalesOrder | TRANSFORM to SalesOrderStatus enum |
| DiscPerc | M4Qty | discountPercent | SalesOrder | DIRECT |
| DespatchDate | M4Date | expectedShipDate | SalesOrder | DIRECT |
| PlanShipDate | M4Date | promisedDeliveryDate | SalesOrder | DIRECT |
| Sum0-4 | M4Val | subtotal/vatAmount/totalAmount | SalesOrder | DECOMPOSE into typed fields |
| TotGP | M4Val | grossProfit | SalesOrder | Computed, stored for reporting |
| AcceptanceStatus | M4Int | approvalStatus | SalesOrder | TRANSFORM to enum |
| SalesGroup | M4UStr(30) | salesGroupCode | SalesOrder | FK to SalesGroup |
| Region | M4Code(20) | regionCode | SalesOrder | FK to Region |
| OrderClass | M4Code(5) | orderClassCode | SalesOrder | Classification tag |

#### Key Legacy Field Mappings (ORVc Lines)

| HAL Field | HAL Type | Nexa Field | Nexa Model | Strategy |
|-----------|----------|-----------|------------|----------|
| ArtCode | M4Code(20) | itemId | SalesOrderLine | FK to Item |
| Quant | M4UVal | quantity | SalesOrderLine | DIRECT |
| Price | M423Val | unitPrice | SalesOrderLine | DIRECT |
| Sum | M4Val | lineTotal | SalesOrderLine | DIRECT |
| vRebate | M41Val | discountPercent | SalesOrderLine | DIRECT |
| SalesAcc | M4Code(10) | revenueAccountId | SalesOrderLine | FK to GlAccount |
| Shipd1 + Shipd2 | M4UVal | quantityShipped | SalesOrderLine | SUM(Shipd1+Shipd2) |
| Invd | M4UVal | quantityInvoiced | SalesOrderLine | DIRECT |
| Spec | M4Str(100) | description | SalesOrderLine | DIRECT |
| VATCode | M4Code(10) | vatCodeId | SalesOrderLine | FK to VatCode |
| SerialNr | M4Str(60) | serialNumber | SalesOrderLine | DIRECT |
| Location | M4Code(10) | warehouseId | SalesOrderLine | FK to Warehouse (line-level override) |

---

#### Prisma Schema

```prisma
// ═══════════════════════════════════════════════
// SALES ORDERS MODULE — Quotes, Orders & Dispatch
// ═══════════════════════════════════════════════

// ─── Enums ───────────────────────────────────

enum SalesQuoteStatus {
  DRAFT
  SENT
  ACCEPTED
  REJECTED
  EXPIRED
  CONVERTED
  CANCELLED

  @@map("sales_quote_status")
}

enum SalesOrderStatus {
  DRAFT
  APPROVED
  IN_PROGRESS
  PARTIALLY_SHIPPED
  FULLY_SHIPPED
  PARTIALLY_INVOICED
  FULLY_INVOICED
  CLOSED
  CANCELLED

  @@map("sales_order_status")
}

enum SalesOrderLineStatus {
  OPEN
  PARTIALLY_FULFILLED
  FULFILLED
  CANCELLED

  @@map("sales_order_line_status")
}

enum DispatchStatus {
  DRAFT
  PICKED
  PACKED
  SHIPPED
  DELIVERED
  CANCELLED

  @@map("dispatch_status")
}

// ─── Sales Quote (Transactional) ─────────────

model SalesQuote {
  id                    String           @id @default(uuid())
  quoteNumber           String           @unique @map("quote_number")           // Auto via NumberSeries "QT-00001"
  quoteDate             DateTime         @map("quote_date") @db.Date
  validUntilDate        DateTime?        @map("valid_until_date") @db.Date      // From QTSettBlock validity days
  expiryNotified        Boolean          @default(false) @map("expiry_notified") // Flag: expiry reminder sent

  // Customer
  customerId            String           @map("customer_id")
  customerName          String           @map("customer_name")                  // Denormalised snapshot at creation
  billToCustomerId      String?          @map("bill_to_customer_id")           // Alternate billing entity

  // Addresses (JSON snapshots — frozen at quote time)
  billingAddress        Json?            @map("billing_address")               // { line1, line2, city, county, postcode, country }
  shippingAddress       Json?            @map("shipping_address")

  // Financial totals
  subtotal              Decimal          @default(0) @map("subtotal") @db.Decimal(19, 4)
  discountPercent       Decimal          @default(0) @map("discount_percent") @db.Decimal(5, 2)
  discountAmount        Decimal          @default(0) @map("discount_amount") @db.Decimal(19, 4)
  vatAmount             Decimal          @default(0) @map("vat_amount") @db.Decimal(19, 4)
  totalAmount           Decimal          @default(0) @map("total_amount") @db.Decimal(19, 4)

  // Currency
  currencyCode          String           @default("GBP") @map("currency_code") @db.VarChar(3)
  exchangeRate          Decimal          @default(1) @map("exchange_rate") @db.Decimal(10, 6)

  // Sales attribution
  salesPersonId         String?          @map("sales_person_id")               // FK to User (salesperson)
  salesGroupCode        String?          @map("sales_group_code")              // FK to SalesGroup
  priceListId           String?          @map("price_list_id")                 // FK to PriceList

  // Status & lifecycle
  status                SalesQuoteStatus @default(DRAFT)
  convertedToOrderId    String?          @unique @map("converted_to_order_id") // FK to SalesOrder (1:1 when converted)
  rejectionReason       String?          @map("rejection_reason")
  winProbability        Decimal?         @map("win_probability") @db.Decimal(5, 2) // 0.00-100.00, links to CRM opportunity

  // CRM linkage
  opportunityId         String?          @map("opportunity_id")                // FK to CrmOpportunity (optional)

  // Notes
  notes                 String?                                                // Internal notes
  customerNotes         String?          @map("customer_notes")                // Shown on printed quote

  // Audit
  createdAt             DateTime         @default(now()) @map("created_at")
  updatedAt             DateTime         @updatedAt @map("updated_at")
  createdBy             String           @map("created_by")
  updatedBy             String           @map("updated_by")

  // Relations
  lines                 SalesQuoteLine[]
  // convertedOrder     SalesOrder?      @relation("QuoteToOrder", fields: [convertedToOrderId], references: [id])

  @@map("sales_quotes")
  @@index([customerId], map: "idx_sales_quotes_customer")
  @@index([status], map: "idx_sales_quotes_status")
  @@index([quoteDate], map: "idx_sales_quotes_date")
  @@index([salesPersonId], map: "idx_sales_quotes_salesperson")
  @@index([validUntilDate, status], map: "idx_sales_quotes_expiry")
}

model SalesQuoteLine {
  id                    String           @id @default(uuid())
  quoteId               String           @map("quote_id")
  lineNumber            Int              @map("line_number")                   // Sequential: 1, 2, 3...

  // Item
  itemId                String           @map("item_id")                       // FK to Item
  description           String                                                 // Defaults from Item, editable
  quantity              Decimal          @map("quantity") @db.Decimal(10, 4)
  unitPrice             Decimal          @map("unit_price") @db.Decimal(19, 4)
  discountPercent       Decimal          @default(0) @map("discount_percent") @db.Decimal(5, 2)
  lineTotal             Decimal          @map("line_total") @db.Decimal(19, 4) // (qty * unitPrice) * (1 - disc%)

  // Tax
  vatCodeId             String           @map("vat_code_id")                   // FK to VatCode
  vatAmount             Decimal          @default(0) @map("vat_amount") @db.Decimal(19, 4)

  // Warehouse (for availability check at quote time)
  warehouseId           String?          @map("warehouse_id")                  // FK to Warehouse

  // Audit
  createdAt             DateTime         @default(now()) @map("created_at")
  updatedAt             DateTime         @updatedAt @map("updated_at")

  // Relations
  quote                 SalesQuote       @relation(fields: [quoteId], references: [id], onDelete: Cascade)

  @@map("sales_quote_lines")
  @@unique([quoteId, lineNumber], map: "uq_sales_quote_lines_quote_line")
  @@index([itemId], map: "idx_sales_quote_lines_item")
}

// ─── Sales Order (Transactional) ─────────────

model SalesOrder {
  id                    String           @id @default(uuid())
  orderNumber           String           @unique @map("order_number")          // Auto via NumberSeries "SO-00001"
  orderDate             DateTime         @map("order_date") @db.Date
  requestedDeliveryDate DateTime?        @map("requested_delivery_date") @db.Date
  promisedDeliveryDate  DateTime?        @map("promised_delivery_date") @db.Date
  expectedShipDate      DateTime?        @map("expected_ship_date") @db.Date   // Maps to legacy DespatchDate

  // Customer
  customerId            String           @map("customer_id")                   // FK to Customer
  customerName          String           @map("customer_name")                 // Denormalised snapshot
  billToCustomerId      String?          @map("bill_to_customer_id")          // Alternate billing entity (InvoiceToCode)
  customerReference     String?          @map("customer_reference")            // Customer's own PO/ref number (CustOrdNr)

  // Addresses (JSON snapshots — frozen at order time)
  billingAddress        Json?            @map("billing_address")
  shippingAddress       Json?            @map("shipping_address")

  // Financial totals
  subtotal              Decimal          @default(0) @map("subtotal") @db.Decimal(19, 4)
  discountPercent       Decimal          @default(0) @map("discount_percent") @db.Decimal(5, 2)
  discountAmount        Decimal          @default(0) @map("discount_amount") @db.Decimal(19, 4)
  vatAmount             Decimal          @default(0) @map("vat_amount") @db.Decimal(19, 4)
  totalAmount           Decimal          @default(0) @map("total_amount") @db.Decimal(19, 4)
  grossProfit           Decimal?         @map("gross_profit") @db.Decimal(19, 4)  // Computed: revenue - COGS

  // Currency
  currencyCode          String           @default("GBP") @map("currency_code") @db.VarChar(3)
  exchangeRate          Decimal          @default(1) @map("exchange_rate") @db.Decimal(10, 6)

  // Sales attribution
  salesPersonId         String?          @map("sales_person_id")               // FK to User (salesperson)
  salesGroupCode        String?          @map("sales_group_code")              // FK to SalesGroup
  priceListId           String?          @map("price_list_id")                 // FK to PriceList
  regionCode            String?          @map("region_code")                   // FK to Region
  orderClassCode        String?          @map("order_class_code")              // Classification (legacy OrderClass)
  commissionPercent     Decimal?         @map("commission_percent") @db.Decimal(5, 2)

  // Status & lifecycle
  status                SalesOrderStatus @default(DRAFT)
  approvalStatus        String?          @map("approval_status")               // For multi-step approval workflows
  approvedBy            String?          @map("approved_by")                   // User who approved
  approvedAt            DateTime?        @map("approved_at")

  // Source / linkage
  quoteId               String?          @map("quote_id")                      // FK to SalesQuote (if converted from quote)
  paymentTermsId        String?          @map("payment_terms_id")              // FK to PaymentTerms
  warehouseId           String?          @map("warehouse_id")                  // Default warehouse for this order
  shippingMethodId      String?          @map("shipping_method_id")            // FK to ShippingMethod
  projectId             String?          @map("project_id")                    // FK to Project (if job-costed)

  // Tax
  taxInclusive          Boolean          @default(false) @map("tax_inclusive") // Prices include VAT?

  // Notes
  internalNotes         String?          @map("internal_notes")                // Staff-only
  customerNotes         String?          @map("customer_notes")                // Shown on printout/PDF

  // Audit
  createdAt             DateTime         @default(now()) @map("created_at")
  updatedAt             DateTime         @updatedAt @map("updated_at")
  createdBy             String           @map("created_by")
  updatedBy             String           @map("updated_by")

  // Relations
  lines                 SalesOrderLine[]
  dispatches            Dispatch[]

  @@map("sales_orders")
  @@index([customerId], map: "idx_sales_orders_customer")
  @@index([status], map: "idx_sales_orders_status")
  @@index([orderDate], map: "idx_sales_orders_date")
  @@index([salesPersonId], map: "idx_sales_orders_salesperson")
  @@index([quoteId], map: "idx_sales_orders_quote")
  @@index([orderNumber], map: "idx_sales_orders_number")
  @@index([customerId, status], map: "idx_sales_orders_customer_status")
}

model SalesOrderLine {
  id                    String              @id @default(uuid())
  orderId               String              @map("order_id")
  lineNumber            Int                 @map("line_number")                // Sequential: 1, 2, 3...

  // Item
  itemId                String              @map("item_id")                    // FK to Item
  description           String                                                  // Defaults from Item, editable
  quantity              Decimal             @map("quantity") @db.Decimal(10, 4)
  unitPrice             Decimal             @map("unit_price") @db.Decimal(19, 4)
  discountPercent       Decimal             @default(0) @map("discount_percent") @db.Decimal(5, 2)
  lineTotal             Decimal             @map("line_total") @db.Decimal(19, 4)

  // Tax
  vatCodeId             String              @map("vat_code_id")                // FK to VatCode
  vatAmount             Decimal             @default(0) @map("vat_amount") @db.Decimal(19, 4)

  // Revenue posting
  revenueAccountId      String?             @map("revenue_account_id")         // FK to GlAccount (sales account)

  // Warehouse
  warehouseId           String?             @map("warehouse_id")               // FK to Warehouse (line-level override)

  // Fulfillment tracking — the core of partial fulfillment
  quantityShipped       Decimal             @default(0) @map("quantity_shipped") @db.Decimal(10, 4)
  quantityInvoiced      Decimal             @default(0) @map("quantity_invoiced") @db.Decimal(10, 4)
  quantityOutstanding   Decimal             @default(0) @map("quantity_outstanding") @db.Decimal(10, 4) // = quantity - quantityShipped

  // Line-level delivery date (optional override of header)
  requestedDate         DateTime?           @map("requested_date") @db.Date

  // Line status
  status                SalesOrderLineStatus @default(OPEN)

  // Serial/batch tracking
  serialNumber          String?             @map("serial_number")
  batchNumber           String?             @map("batch_number")

  // Audit
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")

  // Relations
  order                 SalesOrder          @relation(fields: [orderId], references: [id], onDelete: Cascade)
  dispatchLines         DispatchLine[]

  @@map("sales_order_lines")
  @@unique([orderId, lineNumber], map: "uq_sales_order_lines_order_line")
  @@index([itemId], map: "idx_sales_order_lines_item")
  @@index([status], map: "idx_sales_order_lines_status")
  @@index([orderId, status], map: "idx_sales_order_lines_order_status")
}

// ─── Dispatch / Shipment (Transactional) ─────

model Dispatch {
  id                    String           @id @default(uuid())
  dispatchNumber        String           @unique @map("dispatch_number")       // Auto via NumberSeries "DN-00001"
  dispatchDate          DateTime         @map("dispatch_date") @db.Date

  // Source order
  salesOrderId          String           @map("sales_order_id")                // FK to SalesOrder
  customerId            String           @map("customer_id")                   // FK to Customer (denorm for queries)

  // Shipping details
  shippingAddress       Json?            @map("shipping_address")              // Snapshot from order (or overridden)
  shippingMethodId      String?          @map("shipping_method_id")            // FK to ShippingMethod
  carrierName           String?          @map("carrier_name")                  // Free-text carrier
  trackingNumber        String?          @map("tracking_number")
  estimatedDelivery     DateTime?        @map("estimated_delivery") @db.Date
  actualDelivery        DateTime?        @map("actual_delivery") @db.Date

  // Status
  status                DispatchStatus   @default(DRAFT)

  // Warehouse (dispatch origin)
  warehouseId           String?          @map("warehouse_id")                  // FK to Warehouse

  // Notes
  notes                 String?

  // Audit
  createdAt             DateTime         @default(now()) @map("created_at")
  updatedAt             DateTime         @updatedAt @map("updated_at")
  createdBy             String           @map("created_by")
  updatedBy             String           @map("updated_by")

  // Relations
  salesOrder            SalesOrder       @relation(fields: [salesOrderId], references: [id])
  lines                 DispatchLine[]

  @@map("dispatches")
  @@index([salesOrderId], map: "idx_dispatches_sales_order")
  @@index([customerId], map: "idx_dispatches_customer")
  @@index([dispatchDate], map: "idx_dispatches_date")
  @@index([status], map: "idx_dispatches_status")
}

model DispatchLine {
  id                    String           @id @default(uuid())
  dispatchId            String           @map("dispatch_id")
  salesOrderLineId      String           @map("sales_order_line_id")           // FK to SalesOrderLine being fulfilled

  // Item (denormalised for dispatch note printing)
  itemId                String           @map("item_id")                       // FK to Item
  description           String                                                  // Snapshot from order line

  // Quantities
  quantity              Decimal          @map("quantity") @db.Decimal(10, 4)   // Quantity being shipped in this dispatch

  // Serial/batch (if applicable)
  serialNumber          String?          @map("serial_number")
  batchNumber           String?          @map("batch_number")

  // Warehouse
  warehouseId           String?          @map("warehouse_id")                  // FK to Warehouse (can differ per line)

  // Audit
  createdAt             DateTime         @default(now()) @map("created_at")
  updatedAt             DateTime         @updatedAt @map("updated_at")

  // Relations
  dispatch              Dispatch         @relation(fields: [dispatchId], references: [id], onDelete: Cascade)
  salesOrderLine        SalesOrderLine   @relation(fields: [salesOrderLineId], references: [id])

  @@map("dispatch_lines")
  @@index([salesOrderLineId], map: "idx_dispatch_lines_order_line")
  @@index([itemId], map: "idx_dispatch_lines_item")
}

// ─── Shipping Method (Reference) ─────────────

model ShippingMethod {
  id                    String           @id @default(uuid())
  code                  String           @unique                                // "ROYAL_MAIL", "DPD", "COLLECT"
  name                  String                                                  // "Royal Mail Tracked 48"
  carrier               String?                                                 // Carrier name for grouping
  estimatedDays         Int?             @map("estimated_days")                // Default transit days
  isActive              Boolean          @default(true) @map("is_active")

  createdAt             DateTime         @default(now()) @map("created_at")
  updatedAt             DateTime         @updatedAt @map("updated_at")

  @@map("shipping_methods")
  @@index([isActive], map: "idx_shipping_methods_active")
}
```

---

#### Quote-to-Invoice Lifecycle

```
                    ┌─────────────┐
                    │   DRAFT     │  User creates quote with lines
                    │  SalesQuote │
                    └──────┬──────┘
                           │ send()
                           ▼
                    ┌─────────────┐
                    │    SENT     │  Quote emailed/shared with customer
                    │             │  validUntilDate tracked
                    └──┬───┬───┬──┘
                       │   │   │
            accept()   │   │   │ reject()           expire (scheduled job)
                       │   │   │
                       ▼   │   ▼                           ▼
              ┌────────┐   │  ┌──────────┐         ┌───────────┐
              │ACCEPTED│   │  │ REJECTED │         │  EXPIRED  │
              └───┬────┘   │  └──────────┘         └───────────┘
                  │        │
     convertToOrder()      │ cancel()
                  │        │
                  ▼        ▼
         ┌──────────────┐ ┌───────────┐
         │    CONVERTED │ │ CANCELLED │
         │  (immutable) │ └───────────┘
         └───────┬──────┘
                 │ Creates SalesOrder with quoteId FK
                 ▼
         ┌──────────────┐
         │    DRAFT     │  SalesOrder created (lines copied from quote)
         │  SalesOrder  │
         └──────┬───────┘
                │ approve()  [REQ-OR-040: OROK permission]
                │            [Credit limit check: REQ-OR-005/006/007/008]
                │            [Validation: customer, items, payment terms, etc.]
                ▼
         ┌──────────────┐
         │   APPROVED   │  Locked for editing. Stock reservations created.
         │              │  Planned payments created. CRM activity logged.
         └──────┬───────┘
                │ createDispatch()  (one or more dispatches per order)
                ▼
         ┌──────────────────┐
         │   IN_PROGRESS    │  At least one dispatch created
         │                  │
         └──────┬───────────┘
                │ Dispatch lines ship against order lines
                │
         ┌──────┴───────────────────────────┐
         │                                  │
         ▼                                  ▼
  ┌──────────────────┐            ┌─────────────────┐
  │PARTIALLY_SHIPPED │            │  FULLY_SHIPPED   │  All lines: qtyShipped = qty
  │ (some lines open)│            │                  │
  └──────────────────┘            └────────┬─────────┘
                                           │
                │ createInvoice() — AR module creates CustomerInvoice from order
                │
         ┌──────┴───────────────────────────┐
         │                                  │
         ▼                                  ▼
  ┌────────────────────┐          ┌─────────────────┐
  │PARTIALLY_INVOICED  │          │  FULLY_INVOICED  │  All lines: qtyInvoiced = qty
  └────────────────────┘          └────────┬─────────┘
                                           │ close()
                                           ▼
                                  ┌─────────────────┐
                                  │     CLOSED       │  Final state. Immutable.
                                  └─────────────────┘

  At any pre-shipped state:
         cancel() ──────────────► CANCELLED (releases reservations, deletes planned payments)
```

**Status Transition Rules (mapped from legacy OKFlag/ShipFlag/InvFlag/Closed):**

| Legacy State | Legacy Fields | Nexa Status | Transition Guard |
|-------------|---------------|-------------|------------------|
| Draft | OKFlag=0, Closed=0 | DRAFT | Editable. No stock impact. |
| Approved | OKFlag=1 | APPROVED | OROK permission required. Credit limit checked. |
| Partially Shipped | ShipFlag=1 | PARTIALLY_SHIPPED | Computed from line quantities. |
| Fully Shipped | ShipFlag=2 | FULLY_SHIPPED | All lines: quantityShipped >= quantity. |
| Partially Invoiced | InvFlag partial | PARTIALLY_INVOICED | At least one invoice exists, not all lines invoiced. |
| Fully Invoiced | InvFlag=1 | FULLY_INVOICED | All lines: quantityInvoiced >= quantity. |
| Closed | Closed=1 | CLOSED | Manual close or auto-close when fully invoiced. |
| Cancelled | (delete in legacy) | CANCELLED | Only from DRAFT or APPROVED. Shipped orders cannot be cancelled. |

---

#### Partial Fulfillment Logic

The system supports partial shipment and partial invoicing at the line level. Each `SalesOrderLine` tracks three quantity counters that drive the fulfillment pipeline:

```
quantity (ordered)
  └── quantityShipped (sum of all DispatchLine.quantity for this order line)
        └── quantityInvoiced (sum of all CustomerInvoiceLine.quantity for this order line)

quantityOutstanding = quantity - quantityShipped
```

**Rules:**

1. **Creating a Dispatch:** When a `DispatchLine` is confirmed (Dispatch status transitions to SHIPPED), the corresponding `SalesOrderLine.quantityShipped` is incremented by `DispatchLine.quantity`. The `quantityOutstanding` is recalculated as `quantity - quantityShipped`.

2. **Line Status Derivation:**
   - `OPEN`: quantityShipped = 0
   - `PARTIALLY_FULFILLED`: 0 < quantityShipped < quantity
   - `FULFILLED`: quantityShipped >= quantity
   - `CANCELLED`: Manually cancelled (remaining outstanding qty released)

3. **Order Status Derivation** (computed from line statuses):
   - `PARTIALLY_SHIPPED`: At least one line has quantityShipped > 0, but not all lines are fully shipped.
   - `FULLY_SHIPPED`: Every non-cancelled line has quantityShipped >= quantity.
   - `PARTIALLY_INVOICED`: At least one line has quantityInvoiced > 0, but not all lines are fully invoiced.
   - `FULLY_INVOICED`: Every non-cancelled line has quantityInvoiced >= quantity.

4. **Over-shipment Prevention** (REQ-OR-023): `DispatchLine.quantity` cannot cause `SalesOrderLine.quantityShipped` to exceed `SalesOrderLine.quantity` unless a system setting explicitly allows over-shipment.

5. **Over-invoicing Prevention** (from QTSettBlock): `CustomerInvoiceLine.quantity` cannot cause `SalesOrderLine.quantityInvoiced` to exceed `SalesOrderLine.quantityShipped` (cannot invoice unshipped goods) or exceed `SalesOrderLine.quantity` (cannot invoice more than ordered).

6. **Shipped Row Protection** (REQ-OR-013, REQ-OR-014): Once `quantityShipped > 0` on a line, the line quantity cannot be reduced below `quantityShipped`, and shipped lines cannot be deleted.

7. **Invoicing from Orders:** The AR module creates `CustomerInvoice` records referencing the `SalesOrder`. Each `CustomerInvoiceLine` references a `SalesOrderLine` and specifies the quantity being invoiced. The AR module updates `SalesOrderLine.quantityInvoiced` when the invoice is approved/posted. The Sales Orders module does not own invoices -- it only tracks `quantityInvoiced` as a read-back from AR.

**Quantity flow example (10 units ordered, shipped in two batches, invoiced in one):**

```
SalesOrderLine: quantity=10, quantityShipped=0, quantityInvoiced=0, status=OPEN
  │
  ├── Dispatch #1: DispatchLine.quantity=6  → quantityShipped=6,  status=PARTIALLY_FULFILLED
  ├── Dispatch #2: DispatchLine.quantity=4  → quantityShipped=10, status=FULFILLED
  │
  └── Invoice #1:  InvoiceLine.quantity=10  → quantityInvoiced=10
       Order status → FULLY_INVOICED → auto-close
```

---

#### Stock Availability Check Workflow

Before approving a sales order (DRAFT -> APPROVED), the system performs stock availability checks:

```
1. For each SalesOrderLine:
   a. Resolve warehouse: line.warehouseId ?? order.warehouseId ?? company default
   b. Query Inventory module:
      - quantityOnHand (physical stock in warehouse for item)
      - quantityReserved (already reserved for other orders)
      - quantityOnOrder (expected from open purchase orders)
      - quantityAvailable = onHand - reserved + onOrder (ATP)

2. Compare line.quantity against quantityAvailable:
   - SUFFICIENT: quantity <= quantityAvailable → proceed
   - INSUFFICIENT: quantity > quantityAvailable → warning or block

3. Behaviour depends on system setting (SalesModuleSetting):
   - "Warn" mode (default): Show warning with availability details, allow user override
   - "Block" mode: Prevent approval until stock is available
   - "Auto-reserve" mode: Create stock reservation record (StockReservation) on approval

4. On approval (status → APPROVED):
   - Create StockReservation records (one per order line) in Inventory module
   - Increment Item.quantityReserved in the relevant warehouse
   - Legacy: REQ-OR-051 UpdateStockResFromOR

5. On cancellation (status → CANCELLED):
   - Release all StockReservation records for this order
   - Decrement Item.quantityReserved
```

**Available-to-Promise (ATP) Calculation:**

```
ATP = quantityOnHand
    - quantityReserved (existing SO reservations)
    - quantityAllocated (in-progress dispatches not yet shipped)
    + quantityOnOrder (open PO lines not yet received)
```

This ATP value is shown in real-time on the sales order line entry screen, helping the salesperson promise accurate delivery dates.

---

#### Business Rules from Legacy (REQ-OR-* from CODE_REQUIREMENTS.md)

Key rules that the Sales Orders service layer must enforce:

| Rule ID | Rule | Implementation |
|---------|------|----------------|
| REQ-OR-001 | Customer code required | Validate `customerId` is present and non-empty |
| REQ-OR-002 | Customer must exist | FK constraint + service-level lookup |
| REQ-OR-003 | Customer must not be blocked | Check `Customer.isActive = true` |
| REQ-OR-005-008 | Credit limit check (3 modes) | Service: compare customer AR balance + order total vs credit limit |
| REQ-OR-009 | Order date must be in valid accounting period | Check against PeriodLock (section 2.5) |
| REQ-OR-013 | Cannot change shipped rows | Guard: if `quantityShipped > 0`, reject line edits |
| REQ-OR-014 | Quantity cannot go below shipped | Validate `newQuantity >= quantityShipped` |
| REQ-OR-015 | Negative quantities blocked | Validate `quantity > 0` |
| REQ-OR-016 | Item must exist and allow sales | Check `Item.isActive` and `Item.allowSales` |
| REQ-OR-018 | Order class required (if setting enabled) | Conditional validation from SalesModuleSetting |
| REQ-OR-019 | Customer order number required (if setting) | Conditional validation |
| REQ-OR-024 | Minimum gross profit check | Compare line GP% against setting threshold |
| REQ-OR-040 | OROK permission to approve | RBAC permission check |
| REQ-OR-041 | UnOKOR permission to un-approve | RBAC permission check |
| REQ-OR-050 | Stock ordered-out update on approve | Increment `Item.quantityOnOrder` |
| REQ-OR-051 | Stock reservation on approve | Create `StockReservation` records |
| REQ-OR-052 | CRM activity on approve | Create `CrmActivity` follow-up |
| REQ-OR-053 | Planned payment on approve | Create payment schedule entry |
| REQ-OR-060 | Cannot delete if down-payments exist | Guard against deletion |
| REQ-OR-061 | Cannot delete if shipped | Guard: `quantityShipped > 0` blocks delete |
| REQ-OR-066 | Delete planned payments on order delete | Cascade cleanup |

---

#### Build Sequence & Dependencies

Sales Orders is targeted for **Story 9+** in the implementation roadmap. It has hard dependencies on:

| Dependency | Module | Must Be Complete | Reason |
|-----------|--------|-------------------|--------|
| Customer model | AR / System | Full CRUD | Orders reference `customerId` FK |
| Item model | Inventory | Full CRUD + stock queries | Lines reference `itemId` FK, ATP queries |
| Warehouse / Location | Inventory | Reference data | Orders and dispatch reference `warehouseId` |
| PaymentTerms | System / Finance | Reference data | Orders reference `paymentTermsId` FK |
| VatCode | System / Finance | Reference data | Lines reference `vatCodeId` FK |
| NumberSeries | System (section 2.8) | Functional | Auto-numbering for SO-, QT-, DN- prefixes |
| PeriodLock | Finance (section 2.5) | Functional | Order date validation against locked periods |
| StockReservation | Inventory | Model + service | Reservation create/release on approve/cancel |
| CustomerInvoice | AR | Model + create API | Invoice-from-order flow (AR owns invoice creation) |
| GlAccount | Finance/GL | Reference data | Line-level `revenueAccountId` FK |
| ShippingMethod | Sales Orders (self) | Reference data | Seeded as part of this module |
| User (salesperson) | Auth / System | Reference data | `salesPersonId` FK |

**Recommended build order within the Sales Orders module:**

1. ShippingMethod reference entity (seed data: Royal Mail, DPD, DHL, Collect, etc.)
2. SalesQuote + SalesQuoteLine (CRUD, status transitions, expiry job)
3. SalesOrder + SalesOrderLine (CRUD, approval with credit limit + stock checks)
4. Quote-to-Order conversion service
5. Dispatch + DispatchLine (CRUD, ship confirmation, quantity rollup to order lines)
6. Invoice-from-Order integration (coordinate with AR module for `CustomerInvoice` creation)
7. Stock reservation integration (coordinate with Inventory module)
8. Reports: Order backlog, shipment summary, quote conversion rate

### 2.17 Purchasing & AP Module — Suppliers, POs, Bills & Payments

The Purchasing & Accounts Payable module manages the full **procure-to-pay** lifecycle: supplier management, purchase order creation and approval, goods receipt against POs, supplier bill (purchase invoice) recording, three-way matching, and outward payment processing including BACS batch runs. In the legacy HansaWorld system this spans two register families (PO and PL) totalling 8 registers with 400+ fields, 4 settings blocks, and tight integration with Inventory (stock receipts), Finance GL (double-entry postings), and Banking (payment settlement).

Nexa consolidates these into 10 purpose-built models following the database-per-tenant pattern (no tenant_id columns). The module depends on Foundation entities from the System module (Currency, PaymentTerms, VatCode, Country) and Finance module (ChartOfAccount, JournalEntry, FiscalPeriod, BankAccount).

---

**Legacy → Nexa Mapping:**

**Registers:**

| Legacy Register | HAL Entity | Fields | Nexa Model | MVP? | Notes |
|----------------|-----------|--------|------------|------|-------|
| VEVc | Vendor/Supplier | 50 header | **Supplier** | YES | Standalone supplier register; CUVc dual-role fields mapped here |
| POVc | Purchase Order | 96 header + 50 array | **PurchaseOrder** + **PurchaseOrderLine** | YES | Full PO lifecycle with approval |
| IPVc | Goods Receipt (Inward Purchase) | ~40 fields | **GoodsReceipt** + **GoodsReceiptLine** | YES | Stock receipt against PO |
| PUVc | Purchase Invoice/Bill | 73 header + 84 array | **SupplierBill** + **SupplierBillLine** | YES | Supplier bill with 3-way match |
| OPVc | Outward Payment | ~60 fields | **SupplierPayment** + **SupplierPaymentAllocation** | YES | Payment with multi-bill allocation |
| POQTVc | Purchase Quotation | ~80 fields | **PurchaseQuotation** | P1 | RFQ/quotation from suppliers |
| POCOVc | Purchase Contract | ~60 fields | **PurchaseContract** | P2 | Blanket/framework agreements |
| RetPUVc | Returns to Supplier | ~40 fields | **SupplierReturn** | P1 | Debit notes / return processing |

**Settings:**

| Legacy Setting Block | Fields | Nexa Mapping | Priority | Notes |
|---------------------|--------|-------------|----------|-------|
| POSettingBlock | ~20 | SystemSetting (category: 'purchasing') | YES | PO-from-PU rules, default supplier warnings, auto-numbering |
| APAccBlock | ~40 | SubLedgerControl ('AP') + SystemSetting (category: 'ap') | YES | AP control account, cost accounts, VAT accounts, rate gain/loss accounts |
| OPTBlock | ~30 | SystemSetting (category: 'ap_payments') | YES | Payment defaults, bank fees, SEPA/BACS config, batch booking |
| VITBlock | ~25 | SystemSetting (category: 'ap_bills') | YES | Vendor invoice settings, auto-VAT calc, approval thresholds |

---

**Prisma Models:**

```prisma
// ═══════════════════════════════════════════════
// PURCHASING & AP MODULE — Suppliers, POs, Bills & Payments
// ═══════════════════════════════════════════════

// -----------------------------------------------
// Enums
// -----------------------------------------------

enum SupplierType {
  COMPANY
  INDIVIDUAL
}

enum SupplierStatus {
  ACTIVE
  ON_HOLD
  BLOCKED
  TERMINATED
}

enum PurchaseOrderStatus {
  DRAFT
  APPROVED
  SENT
  PARTIALLY_RECEIVED
  FULLY_RECEIVED
  PARTIALLY_INVOICED
  FULLY_INVOICED
  CLOSED
  CANCELLED
}

enum PurchaseOrderLineStatus {
  OPEN
  PARTIALLY_RECEIVED
  RECEIVED
  CANCELLED
}

enum GoodsReceiptStatus {
  DRAFT
  POSTED
  CANCELLED
}

enum SupplierBillStatus {
  DRAFT
  APPROVED
  POSTED
  PARTIALLY_PAID
  PAID
  CANCELLED
}

enum MatchStatus {
  UNMATCHED
  PARTIALLY_MATCHED
  FULLY_MATCHED
}

enum SupplierPaymentStatus {
  DRAFT
  APPROVED
  SENT
  COMPLETED
  CANCELLED
}

enum PaymentMethod {
  BACS
  BANK_TRANSFER
  CHEQUE
  DIRECT_DEBIT
  CARD
}

enum BacsRunStatus {
  DRAFT
  APPROVED
  SUBMITTED
  COMPLETED
  FAILED
}

// -----------------------------------------------
// 1. Supplier (reference entity)
// -----------------------------------------------

model Supplier {
  id                    String         @id @default(uuid())
  code                  String         @unique                   // "SUP-00001" via NumberSeries
  name                  String                                   // Trading name
  legalName             String?        @map("legal_name")        // Registered company name
  supplierType          SupplierType   @default(COMPANY) @map("supplier_type")
  groupCode             String?        @map("group_code")        // Supplier classification group

  // Contact
  phone                 String?
  mobile                String?
  email                 String?
  website               String?
  contactPerson         String?        @map("contact_person")    // Primary contact name

  // Address
  addressLine1          String?        @map("address_line_1")
  addressLine2          String?        @map("address_line_2")
  city                  String?
  county                String?
  postcode              String?
  countryCode           String         @default("GB") @map("country_code") @db.VarChar(2)

  // Banking
  bankName              String?        @map("bank_name")
  bankAccountNumber     String?        @map("bank_account_number")
  bankSortCode          String?        @map("bank_sort_code")    // UK sort code "12-34-56"
  bankIban              String?        @map("bank_iban")
  bankSwift             String?        @map("bank_swift")

  // Terms & Currency
  paymentTermsId        String?        @map("payment_terms_id") // FK to PaymentTerms
  currencyCode          String         @default("GBP") @map("currency_code") @db.VarChar(3)
  shippingMethod        String?        @map("shipping_method")

  // Financial
  creditLimit           Decimal?       @map("credit_limit") @db.Decimal(19, 4)
  onAccount             Decimal        @default(0) @map("on_account") @db.Decimal(19, 4) // Current prepayment balance

  // Tax
  vatNumber             String?        @map("vat_number")        // Supplier VAT registration
  vatCodeId             String?        @map("vat_code_id")       // FK to VatCode — default VAT code
  vatNotDeductible      Boolean        @default(false) @map("vat_not_deductible")

  // GL Defaults
  defaultApAccountCode  String?        @map("default_ap_account_code")   // Override AP control account
  defaultCostAccountCode String?       @map("default_cost_account_code") // Default expense/cost account

  // Control
  status                SupplierStatus @default(ACTIVE)
  onHold                Boolean        @default(false) @map("on_hold")     // Payments paused
  isActive              Boolean        @default(true) @map("is_active")    // Soft delete

  // Notes
  notes                 String?                                  // Internal notes
  warningText           String?        @map("warning_text")      // Pop-up warning on PO entry

  // Custom Fields
  customField1          String?        @map("custom_field_1")
  customField2          String?        @map("custom_field_2")
  customField3          String?        @map("custom_field_3")
  customField4          String?        @map("custom_field_4")
  customField5          String?        @map("custom_field_5")

  // Audit
  createdAt             DateTime       @default(now()) @map("created_at")
  updatedAt             DateTime       @updatedAt @map("updated_at")
  createdBy             String         @map("created_by")
  updatedBy             String         @map("updated_by")

  // Relations
  purchaseOrders        PurchaseOrder[]
  goodsReceipts         GoodsReceipt[]
  bills                 SupplierBill[]
  payments              SupplierPayment[]

  @@index([code], map: "idx_suppliers_code")
  @@index([name], map: "idx_suppliers_name")
  @@index([status], map: "idx_suppliers_status")
  @@index([groupCode], map: "idx_suppliers_group_code")
  @@map("suppliers")
}

// -----------------------------------------------
// 2. Purchase Order (transactional)
// -----------------------------------------------

model PurchaseOrder {
  id                    String              @id @default(uuid())
  orderNumber           String              @unique @map("order_number")  // "PO-00001" via NumberSeries
  orderDate             DateTime            @map("order_date") @db.Date
  expectedDeliveryDate  DateTime?           @map("expected_delivery_date") @db.Date

  // Supplier
  supplierId            String              @map("supplier_id")
  supplierName          String              @map("supplier_name")         // Denormalised for display
  supplierRef           String?             @map("supplier_ref")          // Supplier's own reference

  // Delivery address (where goods are received)
  deliveryAddressLine1  String?             @map("delivery_address_line_1")
  deliveryAddressLine2  String?             @map("delivery_address_line_2")
  deliveryCity          String?             @map("delivery_city")
  deliveryCounty        String?             @map("delivery_county")
  deliveryPostcode      String?             @map("delivery_postcode")
  deliveryCountryCode   String?             @map("delivery_country_code") @db.VarChar(2)

  // Financial
  subtotal              Decimal             @default(0) @db.Decimal(19, 4)
  discountAmount        Decimal             @default(0) @map("discount_amount") @db.Decimal(19, 4)
  vatAmount             Decimal             @default(0) @map("vat_amount") @db.Decimal(19, 4)
  totalAmount           Decimal             @default(0) @map("total_amount") @db.Decimal(19, 4)

  // Currency
  currencyCode          String              @default("GBP") @map("currency_code") @db.VarChar(3)
  exchangeRate          Decimal             @default(1) @map("exchange_rate") @db.Decimal(18, 8)

  // Status & Workflow
  status                PurchaseOrderStatus @default(DRAFT)
  paymentTermsId        String?             @map("payment_terms_id")     // FK to PaymentTerms

  // Notes
  internalNotes         String?             @map("internal_notes")       // Not shown to supplier
  supplierNotes         String?             @map("supplier_notes")       // Printed on PO

  // Approval
  approvedBy            String?             @map("approved_by")
  approvedAt            DateTime?           @map("approved_at")

  // Audit
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")
  createdBy             String              @map("created_by")
  updatedBy             String              @map("updated_by")

  // Relations
  supplier              Supplier            @relation(fields: [supplierId], references: [id])
  lines                 PurchaseOrderLine[]
  goodsReceipts         GoodsReceipt[]
  bills                 SupplierBill[]

  @@index([supplierId], map: "idx_purchase_orders_supplier_id")
  @@index([status], map: "idx_purchase_orders_status")
  @@index([orderDate], map: "idx_purchase_orders_order_date")
  @@index([orderNumber], map: "idx_purchase_orders_order_number")
  @@map("purchase_orders")
}

// -----------------------------------------------
// 3. Purchase Order Line
// -----------------------------------------------

model PurchaseOrderLine {
  id                    String                   @id @default(uuid())
  orderId               String                   @map("order_id")
  lineNumber            Int                      @map("line_number")

  // Item
  itemId                String?                  @map("item_id")           // FK to Item (null for non-stock lines)
  description           String                                             // Item description / free-text line
  quantity              Decimal                  @db.Decimal(10, 4)
  unitPrice             Decimal                  @map("unit_price") @db.Decimal(19, 4)
  discountPercent       Decimal                  @default(0) @map("discount_percent") @db.Decimal(5, 2)
  lineTotal             Decimal                  @map("line_total") @db.Decimal(19, 4)
  vatCodeId             String?                  @map("vat_code_id")       // FK to VatCode
  vatAmount             Decimal                  @default(0) @map("vat_amount") @db.Decimal(19, 4)

  // Warehouse
  warehouseId           String?                  @map("warehouse_id")      // FK to Warehouse — receiving location

  // Fulfilment tracking
  quantityReceived      Decimal                  @default(0) @map("quantity_received") @db.Decimal(10, 4)
  quantityInvoiced      Decimal                  @default(0) @map("quantity_invoiced") @db.Decimal(10, 4)
  quantityOutstanding   Decimal                  @default(0) @map("quantity_outstanding") @db.Decimal(10, 4) // = quantity - quantityReceived

  // Line-level dates
  requestedDate         DateTime?                @map("requested_date") @db.Date

  // GL
  accountCode           String?                  @map("account_code")      // Expense/cost GL account

  // Status
  status                PurchaseOrderLineStatus  @default(OPEN)

  // Audit
  createdAt             DateTime                 @default(now()) @map("created_at")
  updatedAt             DateTime                 @updatedAt @map("updated_at")

  // Relations
  order                 PurchaseOrder            @relation(fields: [orderId], references: [id])
  goodsReceiptLines     GoodsReceiptLine[]
  billLines             SupplierBillLine[]

  @@unique([orderId, lineNumber], map: "uq_po_line_number")
  @@index([orderId], map: "idx_purchase_order_lines_order_id")
  @@index([itemId], map: "idx_purchase_order_lines_item_id")
  @@map("purchase_order_lines")
}

// -----------------------------------------------
// 4. Goods Receipt (transactional)
// -----------------------------------------------

model GoodsReceipt {
  id                    String             @id @default(uuid())
  receiptNumber         String             @unique @map("receipt_number") // "GRN-00001" via NumberSeries
  receiptDate           DateTime           @map("receipt_date") @db.Date

  // Source
  purchaseOrderId       String?            @map("purchase_order_id")     // FK to PurchaseOrder (null for non-PO receipts)
  supplierId            String             @map("supplier_id")

  // Warehouse
  warehouseId           String             @map("warehouse_id")          // FK to Warehouse — primary receiving location

  // Status
  status                GoodsReceiptStatus @default(DRAFT)

  // Notes
  notes                 String?

  // GL posting
  journalEntryId        String?            @map("journal_entry_id")      // FK to JournalEntry (Dr Stock, Cr GRN Accrual)

  // Audit
  createdAt             DateTime           @default(now()) @map("created_at")
  updatedAt             DateTime           @updatedAt @map("updated_at")
  createdBy             String             @map("created_by")
  updatedBy             String             @map("updated_by")

  // Relations
  purchaseOrder         PurchaseOrder?     @relation(fields: [purchaseOrderId], references: [id])
  supplier              Supplier           @relation(fields: [supplierId], references: [id])
  lines                 GoodsReceiptLine[]

  @@index([purchaseOrderId], map: "idx_goods_receipts_purchase_order_id")
  @@index([supplierId], map: "idx_goods_receipts_supplier_id")
  @@index([receiptDate], map: "idx_goods_receipts_receipt_date")
  @@index([status], map: "idx_goods_receipts_status")
  @@map("goods_receipts")
}

// -----------------------------------------------
// 5. Goods Receipt Line
// -----------------------------------------------

model GoodsReceiptLine {
  id                    String         @id @default(uuid())
  goodsReceiptId        String         @map("goods_receipt_id")
  purchaseOrderLineId   String?        @map("purchase_order_line_id")   // FK to PurchaseOrderLine

  // Item
  itemId                String?        @map("item_id")                  // FK to Item
  description           String

  // Quantities & Cost
  quantityReceived      Decimal        @map("quantity_received") @db.Decimal(10, 4)
  unitCost              Decimal        @map("unit_cost") @db.Decimal(19, 4) // Actual landed cost

  // Traceability
  serialNumber          String?        @map("serial_number")
  batchNumber           String?        @map("batch_number")
  bestBeforeDate        DateTime?      @map("best_before_date") @db.Date

  // Warehouse (line-level override)
  warehouseId           String?        @map("warehouse_id")             // FK to Warehouse

  // Quality
  inspectionRequired    Boolean        @default(false) @map("inspection_required")
  inspectionStatus      String?        @map("inspection_status")        // PENDING, PASSED, FAILED

  // Audit
  createdAt             DateTime       @default(now()) @map("created_at")
  updatedAt             DateTime       @updatedAt @map("updated_at")

  // Relations
  goodsReceipt          GoodsReceipt      @relation(fields: [goodsReceiptId], references: [id])
  purchaseOrderLine     PurchaseOrderLine? @relation(fields: [purchaseOrderLineId], references: [id])

  @@index([goodsReceiptId], map: "idx_goods_receipt_lines_goods_receipt_id")
  @@index([purchaseOrderLineId], map: "idx_goods_receipt_lines_po_line_id")
  @@index([itemId], map: "idx_goods_receipt_lines_item_id")
  @@map("goods_receipt_lines")
}

// -----------------------------------------------
// 6. Supplier Bill (purchase invoice — transactional)
// -----------------------------------------------

model SupplierBill {
  id                    String             @id @default(uuid())
  billNumber            String             @unique @map("bill_number")  // "BIL-00001" via NumberSeries (internal ref)
  supplierInvoiceNumber String?            @map("supplier_invoice_number") // The supplier's own invoice reference

  // Supplier
  supplierId            String             @map("supplier_id")
  supplierName          String             @map("supplier_name")        // Denormalised

  // Dates
  billDate              DateTime           @map("bill_date") @db.Date   // Date on supplier's invoice
  dueDate               DateTime           @map("due_date") @db.Date    // Calculated from payment terms
  transactionDate       DateTime           @map("transaction_date") @db.Date // GL posting date

  // Financial
  subtotal              Decimal            @default(0) @db.Decimal(19, 4)
  discountAmount        Decimal            @default(0) @map("discount_amount") @db.Decimal(19, 4)
  vatAmount             Decimal            @default(0) @map("vat_amount") @db.Decimal(19, 4)
  totalAmount           Decimal            @default(0) @map("total_amount") @db.Decimal(19, 4)
  paidAmount            Decimal            @default(0) @map("paid_amount") @db.Decimal(19, 4)
  outstandingAmount     Decimal            @default(0) @map("outstanding_amount") @db.Decimal(19, 4)

  // Currency
  currencyCode          String             @default("GBP") @map("currency_code") @db.VarChar(3)
  exchangeRate          Decimal            @default(1) @map("exchange_rate") @db.Decimal(18, 8)

  // Status & Matching
  status                SupplierBillStatus @default(DRAFT)
  matchStatus           MatchStatus        @default(UNMATCHED) @map("match_status")

  // GL posting
  journalEntryId        String?            @map("journal_entry_id")    // FK to JournalEntry
  periodId              String?            @map("period_id")           // FK to FiscalPeriod

  // PO reference (for 3-way match)
  purchaseOrderId       String?            @map("purchase_order_id")   // FK to PurchaseOrder

  // Payment terms
  paymentTermsId        String?            @map("payment_terms_id")    // FK to PaymentTerms

  // Notes
  notes                 String?

  // Audit
  createdAt             DateTime           @default(now()) @map("created_at")
  updatedAt             DateTime           @updatedAt @map("updated_at")
  createdBy             String             @map("created_by")
  updatedBy             String             @map("updated_by")

  // Relations
  supplier              Supplier           @relation(fields: [supplierId], references: [id])
  purchaseOrder         PurchaseOrder?     @relation(fields: [purchaseOrderId], references: [id])
  lines                 SupplierBillLine[]
  paymentAllocations    SupplierPaymentAllocation[]

  @@index([supplierId], map: "idx_supplier_bills_supplier_id")
  @@index([status], map: "idx_supplier_bills_status")
  @@index([dueDate], map: "idx_supplier_bills_due_date")
  @@index([billDate], map: "idx_supplier_bills_bill_date")
  @@index([purchaseOrderId], map: "idx_supplier_bills_purchase_order_id")
  @@index([matchStatus], map: "idx_supplier_bills_match_status")
  @@index([outstandingAmount], map: "idx_supplier_bills_outstanding_amount")
  @@map("supplier_bills")
}

// -----------------------------------------------
// 7. Supplier Bill Line
// -----------------------------------------------

model SupplierBillLine {
  id                    String         @id @default(uuid())
  billId                String         @map("bill_id")
  lineNumber            Int            @map("line_number")

  // Item
  itemId                String?        @map("item_id")                  // FK to Item (null for non-stock / expense lines)
  description           String

  // Amounts
  quantity              Decimal        @db.Decimal(10, 4)
  unitPrice             Decimal        @map("unit_price") @db.Decimal(19, 4)
  lineTotal             Decimal        @map("line_total") @db.Decimal(19, 4)
  vatCodeId             String?        @map("vat_code_id")             // FK to VatCode
  vatAmount             Decimal        @default(0) @map("vat_amount") @db.Decimal(19, 4)

  // GL
  accountCode           String         @map("account_code")            // Expense/cost GL account (required)

  // 3-way match references
  purchaseOrderLineId   String?        @map("purchase_order_line_id")  // FK to PurchaseOrderLine
  goodsReceiptLineId    String?        @map("goods_receipt_line_id")   // FK to GoodsReceiptLine

  // Audit
  createdAt             DateTime       @default(now()) @map("created_at")
  updatedAt             DateTime       @updatedAt @map("updated_at")

  // Relations
  bill                  SupplierBill        @relation(fields: [billId], references: [id])
  purchaseOrderLine     PurchaseOrderLine?  @relation(fields: [purchaseOrderLineId], references: [id])

  @@unique([billId, lineNumber], map: "uq_bill_line_number")
  @@index([billId], map: "idx_supplier_bill_lines_bill_id")
  @@index([purchaseOrderLineId], map: "idx_supplier_bill_lines_po_line_id")
  @@index([accountCode], map: "idx_supplier_bill_lines_account_code")
  @@map("supplier_bill_lines")
}

// -----------------------------------------------
// 8. Supplier Payment (transactional)
// -----------------------------------------------

model SupplierPayment {
  id                    String                @id @default(uuid())
  paymentNumber         String                @unique @map("payment_number") // "PAY-00001" via NumberSeries
  paymentDate           DateTime              @map("payment_date") @db.Date

  // Supplier
  supplierId            String                @map("supplier_id")

  // Bank
  bankAccountId         String                @map("bank_account_id")    // FK to BankAccount

  // Financial
  amount                Decimal               @db.Decimal(19, 4)        // Total payment amount
  currencyCode          String                @default("GBP") @map("currency_code") @db.VarChar(3)
  exchangeRate          Decimal               @default(1) @map("exchange_rate") @db.Decimal(18, 8)

  // Payment details
  paymentMethod         PaymentMethod         @default(BACS) @map("payment_method")
  reference             String?                                          // Cheque number, BACS ref, etc.
  remittanceAdvice      String?               @map("remittance_advice")  // Free-text remittance note

  // Status
  status                SupplierPaymentStatus @default(DRAFT)

  // GL posting
  journalEntryId        String?               @map("journal_entry_id")  // FK to JournalEntry (Dr AP, Cr Bank)

  // BACS batch
  bacsRunId             String?               @map("bacs_run_id")       // FK to BacsRun (if part of batch)

  // Audit
  createdAt             DateTime              @default(now()) @map("created_at")
  updatedAt             DateTime              @updatedAt @map("updated_at")
  createdBy             String                @map("created_by")
  updatedBy             String                @map("updated_by")

  // Relations
  supplier              Supplier              @relation(fields: [supplierId], references: [id])
  bacsRun               BacsRun?              @relation(fields: [bacsRunId], references: [id])
  allocations           SupplierPaymentAllocation[]

  @@index([supplierId], map: "idx_supplier_payments_supplier_id")
  @@index([paymentDate], map: "idx_supplier_payments_payment_date")
  @@index([status], map: "idx_supplier_payments_status")
  @@index([bacsRunId], map: "idx_supplier_payments_bacs_run_id")
  @@index([bankAccountId], map: "idx_supplier_payments_bank_account_id")
  @@map("supplier_payments")
}

// -----------------------------------------------
// 9. Supplier Payment Allocation
// -----------------------------------------------

model SupplierPaymentAllocation {
  id                    String         @id @default(uuid())
  paymentId             String         @map("payment_id")
  billId                String         @map("bill_id")

  // Allocation
  amount                Decimal        @db.Decimal(19, 4)               // Amount of this payment applied to this bill
  exchangeDifference    Decimal        @default(0) @map("exchange_difference") @db.Decimal(19, 4) // FX gain/loss on settlement

  // Audit
  createdAt             DateTime       @default(now()) @map("created_at")

  // Relations
  payment               SupplierPayment @relation(fields: [paymentId], references: [id])
  bill                  SupplierBill    @relation(fields: [billId], references: [id])

  @@unique([paymentId, billId], map: "uq_payment_bill_allocation")
  @@index([paymentId], map: "idx_supplier_payment_allocations_payment_id")
  @@index([billId], map: "idx_supplier_payment_allocations_bill_id")
  @@map("supplier_payment_allocations")
}

// -----------------------------------------------
// 10. BACS Run (batch payment run — P1 stub)
// -----------------------------------------------

model BacsRun {
  id                    String        @id @default(uuid())
  runNumber             String        @unique @map("run_number")  // Auto-generated
  runDate               DateTime      @map("run_date") @db.Date

  // Bank
  bankAccountId         String        @map("bank_account_id")     // FK to BankAccount — paying bank

  // Totals
  totalAmount           Decimal       @default(0) @map("total_amount") @db.Decimal(19, 4)
  paymentCount          Int           @default(0) @map("payment_count")

  // Status
  status                BacsRunStatus @default(DRAFT)

  // File
  fileReference         String?       @map("file_reference")      // BACS file path or reference ID
  submittedAt           DateTime?     @map("submitted_at")

  // Audit
  createdAt             DateTime      @default(now()) @map("created_at")
  updatedAt             DateTime      @updatedAt @map("updated_at")
  createdBy             String        @map("created_by")
  updatedBy             String        @map("updated_by")

  // Relations
  payments              SupplierPayment[]

  @@index([runDate], map: "idx_bacs_runs_run_date")
  @@index([status], map: "idx_bacs_runs_status")
  @@map("bacs_runs")
}
```

---

**PO → GRN → Bill → Payment Lifecycle:**

The procure-to-pay lifecycle follows a strict document chain where each step references and validates against the previous one:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ Purchase Order   │────►│ Goods Receipt    │────►│ Supplier Bill   │────►│ Supplier Payment │
│ (PurchaseOrder)  │     │ (GoodsReceipt)   │     │ (SupplierBill)  │     │ (SupplierPayment)│
│                  │     │                  │     │                  │     │                  │
│ DRAFT            │     │ DRAFT            │     │ DRAFT            │     │ DRAFT            │
│ APPROVED         │     │ POSTED ──────────┼─GL─►│ APPROVED         │     │ APPROVED         │
│ SENT             │     │                  │     │ POSTED ──────────┼─GL─►│ SENT             │
│ PARTIALLY_RECVD  │     │ Dr Stock/Cost    │     │ Dr Cost/Expense  │     │ COMPLETED ───────┼─GL─►
│ FULLY_RECEIVED   │     │ Cr GRN Accrual   │     │ Dr VAT Input     │     │                  │
│ PARTIALLY_INVOIC │     │                  │     │ Cr AP Control    │     │ Dr AP Control    │
│ FULLY_INVOICED   │     │                  │     │ Cr GRN Accrual   │     │ Cr Bank          │
│ CLOSED           │     │                  │     │                  │     │ +/- FX Gain/Loss │
└─────────────────┘     └──────────────────┘     └─────────────────┘     └──────────────────┘
```

**Step 1 — Purchase Order:** User creates PO in DRAFT, optionally routes through approval workflow. Once APPROVED, status moves to SENT when transmitted to supplier (email/PDF). The PO remains open until all lines are received and invoiced.

**Step 2 — Goods Receipt (GRN):** When goods arrive, a GoodsReceipt is created against the PO. Partial receipts are supported (receive 50 of 100 ordered). On posting, the GRN creates a journal entry debiting Stock (or Cost) and crediting GRN Accrual. The PO line's `quantityReceived` is incremented; if all lines are fully received, the PO status advances to `FULLY_RECEIVED`.

**Step 3 — Supplier Bill:** The supplier sends their invoice, which is entered as a SupplierBill. It references the PO for three-way matching. On posting, the bill creates a journal entry debiting Cost/Expense accounts (per line), debiting VAT Input, and crediting AP Control. The GRN Accrual is reversed through the crediting AP Control entry. The PO line's `quantityInvoiced` is incremented.

**Step 4 — Supplier Payment:** Payment is raised against one or more outstanding bills via SupplierPaymentAllocation. On completion, the payment creates a journal entry debiting AP Control and crediting the Bank account. Any exchange rate difference between the bill rate and payment rate is posted to FX Gain/Loss accounts. The bill's `paidAmount` and `outstandingAmount` are updated; when outstanding reaches zero, status moves to PAID.

**Key Business Rules:**

- A PO can have multiple GRNs (partial deliveries over time)
- A GRN can only reference one PO (but a PO can have many GRNs)
- A bill can reference one PO for matching, but non-PO bills (direct expense) are allowed (`purchaseOrderId` is nullable)
- A single payment can be allocated across multiple bills (batch payment)
- A single bill can be paid by multiple payments (partial payment)
- PO quantities cannot be over-received without explicit override (system setting `ap.allowOverReceipt`)
- Bills cannot be posted to a locked fiscal period

---

**Three-Way Matching Logic:**

Three-way matching validates that what was ordered (PO), what was received (GRN), and what was invoiced (Bill) are consistent. This is a core procurement control for UK SMEs.

**Match Dimensions:**

| Dimension | PO Source | GRN Source | Bill Source | Match Rule |
|-----------|----------|-----------|------------|------------|
| Quantity | `PurchaseOrderLine.quantity` | `GoodsReceiptLine.quantityReceived` | `SupplierBillLine.quantity` | Bill qty <= GRN qty <= PO qty |
| Unit Price | `PurchaseOrderLine.unitPrice` | n/a | `SupplierBillLine.unitPrice` | Bill price within tolerance of PO price |
| Line Total | `PurchaseOrderLine.lineTotal` | n/a | `SupplierBillLine.lineTotal` | Derived from qty x price |
| Item | `PurchaseOrderLine.itemId` | `GoodsReceiptLine.itemId` | `SupplierBillLine.itemId` | Must match across all three |

**Matching Algorithm:**

1. When a SupplierBillLine is linked to a `purchaseOrderLineId`, the system looks up the corresponding PurchaseOrderLine and all GoodsReceiptLines against that PO line.
2. **Quantity check:** `billLine.quantity` must be <= sum of `grnLine.quantityReceived` for that PO line. If the supplier invoices for more than was received, the match fails.
3. **Price check:** `billLine.unitPrice` must be within a configurable tolerance of `poLine.unitPrice` (system setting `ap.priceMatchTolerancePercent`, default 0%). Price variances within tolerance are auto-approved; outside tolerance requires manual approval.
4. **Match status** is set at the bill level:
   - `UNMATCHED` — No PO reference, or lines not yet linked
   - `PARTIALLY_MATCHED` — Some bill lines matched, others pending
   - `FULLY_MATCHED` — All bill lines pass quantity and price checks

**Price Variance Handling:**

When the bill unit price differs from the PO unit price, the difference is posted to a Purchase Price Variance (PPV) account (configured in SystemSetting `ap.priceVarianceAccountCode`). This ensures the stock/cost is valued at the PO price while the actual supplier charge is recorded accurately.

**Override Controls:**

- Users with `ap.approve_mismatch` permission can approve bills that fail matching
- All match overrides are recorded in the audit trail with reason
- System setting `ap.requireMatchBeforePosting` (default: true) controls whether unmatched bills can be posted

---

**BACS Payment Run Workflow:**

BACS (Bankers' Automated Clearing Services) is the standard UK payment method for batch supplier payments. Nexa supports BACS runs as a P1 feature with MVP stubs.

**Workflow:**

```
1. CREATE RUN         User selects bank account, date, and filters for due bills
                      ↓
2. SELECT BILLS       System proposes all approved bills with due date <= run date
                      User reviews and includes/excludes individual bills
                      ↓
3. GENERATE PAYMENTS  System creates one SupplierPayment per supplier (aggregating bills)
                      Each payment's allocations link to the included bills
                      BacsRun.paymentCount and .totalAmount are calculated
                      ↓
4. APPROVE RUN        Manager reviews the run summary (total, count, per-supplier breakdown)
                      Status: DRAFT → APPROVED
                      ↓
5. GENERATE FILE      System generates a Standard 18 BACS file (or BACS IP CSV)
                      File contains: sort code, account number, amount, reference per payment
                      BacsRun.fileReference is set
                      ↓
6. SUBMIT TO BANK     File is uploaded to the bank's BACS portal (manual step)
                      Status: APPROVED → SUBMITTED
                      ↓
7. CONFIRM COMPLETION Once bank confirms processing (typically T+2 working days):
                      Status: SUBMITTED → COMPLETED
                      All SupplierPayments in the run move to COMPLETED
                      GL journal entries are posted (Dr AP Control, Cr Bank)
                      SupplierBill.paidAmount and .outstandingAmount are updated
```

**BACS File Format:** Standard 18 layout with VOL1 header, HDR1/HDR2 labels, contra record (paying bank), and detail records (one per payment). Nexa generates this file programmatically; the user downloads it for upload to their bank portal.

**Validation Rules:**
- All suppliers in the run must have valid UK bank details (sort code + account number)
- Suppliers with IBAN-only banking details are flagged for SEPA/CHAPS instead
- Maximum 999,999 items per BACS file (BACS limit)
- Individual payment amounts must not exceed the bank's per-transaction limit

---

**API Routes:**

```
# Suppliers
GET/POST         /api/v1/suppliers                      # List + create
GET/PATCH/DELETE /api/v1/suppliers/:id                   # Read, update, soft-delete
GET              /api/v1/suppliers/:id/purchase-history   # PO + bill history for supplier
GET              /api/v1/suppliers/:id/balance            # Current AP balance

# Purchase Orders
GET/POST         /api/v1/purchase-orders                 # List + create
GET/PATCH        /api/v1/purchase-orders/:id              # Read, update
POST             /api/v1/purchase-orders/:id/approve      # Approval workflow
POST             /api/v1/purchase-orders/:id/send         # Mark as sent to supplier
POST             /api/v1/purchase-orders/:id/close        # Close PO
POST             /api/v1/purchase-orders/:id/cancel       # Cancel PO

# Goods Receipts
GET/POST         /api/v1/goods-receipts                  # List + create
GET/PATCH        /api/v1/goods-receipts/:id               # Read, update (draft only)
POST             /api/v1/goods-receipts/:id/post          # Post GRN (creates GL entry + stock movement)
POST             /api/v1/goods-receipts/:id/cancel        # Cancel posted GRN (reversal)

# Supplier Bills
GET/POST         /api/v1/supplier-bills                  # List + create
GET/PATCH        /api/v1/supplier-bills/:id               # Read, update (draft only)
POST             /api/v1/supplier-bills/:id/approve       # Approval workflow
POST             /api/v1/supplier-bills/:id/post          # Post bill (creates GL entry)
POST             /api/v1/supplier-bills/:id/match         # Run 3-way matching
GET              /api/v1/supplier-bills/aging              # AP aging report

# Supplier Payments
GET/POST         /api/v1/supplier-payments               # List + create
GET/PATCH        /api/v1/supplier-payments/:id            # Read, update (draft only)
POST             /api/v1/supplier-payments/:id/approve    # Approval workflow
POST             /api/v1/supplier-payments/:id/complete   # Mark completed (creates GL entry)
POST             /api/v1/supplier-payments/:id/cancel     # Cancel payment

# BACS Runs (P1)
GET/POST         /api/v1/bacs-runs                       # List + create
GET/PATCH        /api/v1/bacs-runs/:id                    # Read, update
POST             /api/v1/bacs-runs/:id/approve            # Approve run
POST             /api/v1/bacs-runs/:id/generate-file      # Generate BACS file
POST             /api/v1/bacs-runs/:id/submit             # Mark as submitted
POST             /api/v1/bacs-runs/:id/complete           # Confirm completion
```

All list endpoints support:
- `?status=DRAFT,APPROVED` filter (comma-separated status list)
- `?supplierId=xxx` filter
- `?dateFrom=2026-01-01&dateTo=2026-12-31` date range
- `?search=xxx` full-text search on number, supplier name, reference
- Pagination: `?page=1&pageSize=25`
- Sorting: `?sortBy=billDate&sortDir=desc`
- Saved views (as per section 2.9)

---

**AI Integration:**

Purchasing & AP module entities are available as AI tool parameters. Examples:

- "Create a PO for 200 units of WIDGET-001 from Acme Supplies" → AI calls `POST /api/v1/purchase-orders` with supplier lookup + line item creation
- "What bills are overdue?" → AI calls `GET /api/v1/supplier-bills?status=POSTED&dueDateTo=2026-02-15&sortBy=dueDate`
- "How much do we owe Smith & Co?" → AI calls `GET /api/v1/suppliers/:id/balance`
- "Run a BACS payment for all bills due this week" → AI proposes a BACS run (requires user confirmation per explicit-permission rules)
- "Match bill BIL-00342 against its PO" → AI calls `POST /api/v1/supplier-bills/:id/match`
- "Show AP aging summary" → AI calls `GET /api/v1/supplier-bills/aging`

---

**Build Sequence:**

The Purchasing & AP module is targeted for **Story 9+** in the implementation sequence. It depends on:

- **Story 1/1b:** Database package + System module (Currency, PaymentTerms, VatCode, NumberSeries, Country)
- **Story 4/5:** Finance GL module (ChartOfAccount, JournalEntry, FiscalPeriod, SubLedgerControl)
- **Story 6/7:** Inventory module (Item, Warehouse, StockMovement — required for GRN posting)
- **Story 8:** Banking module (BankAccount — required for payments)

Recommended implementation order within the module:
1. **Supplier** entity (reference data, CRUD, import)
2. **PurchaseOrder** + **PurchaseOrderLine** (PO lifecycle, approval workflow)
3. **GoodsReceipt** + **GoodsReceiptLine** (stock receipt, GL posting, PO quantity updates)
4. **SupplierBill** + **SupplierBillLine** (bill entry, GL posting, 3-way matching)
5. **SupplierPayment** + **SupplierPaymentAllocation** (payment processing, multi-bill allocation, FX handling)
6. **BacsRun** (P1 — batch payment file generation)

P1 entities (PurchaseQuotation, SupplierReturn) and P2 entities (PurchaseContract) are deferred beyond MVP but their FK slots and enum values are reserved in the schema above.

### 2.18 Fixed Assets Module — Asset Register, Depreciation & Disposal

The Fixed Assets module is a **completely new module** not present in the original Nexa architecture or PRD. It was discovered during the HansaWorld deep dive (12+ registers in the AT2 family) and is essential for any ERP targeting UK SMEs. Every business with capital equipment, vehicles, furniture, or IT hardware must track asset values, calculate depreciation for both management accounts and HMRC capital allowances, handle disposals with gain/loss calculations, and produce the Fixed Asset Note for statutory accounts. Without this module, users would need a separate spreadsheet or tool — breaking the "single source of truth" promise.

Key capabilities: asset register with full lifecycle tracking, automated monthly depreciation runs, dual-basis depreciation (book value for management accounts vs fiscal value for HMRC), asset disposal with gain/loss GL postings, asset transfers between departments/cost centres, and integration with the Finance GL via auto-generated journal entries.

**Legacy → Nexa Mapping:**

| Legacy Register | HAL Source | Fields | Nexa Model | Priority | Notes |
|----------------|-----------|--------|------------|----------|-------|
| AT2ClassVc | Asset classes/types | ~12 | **AssetClass** | P1 | Reference entity — GL account mappings per class |
| AT2GroupVc | Asset group hierarchy | ~6 | **AssetGroup** | P1 | Optional grouping for reporting |
| DprModVc | Depreciation methods | ~8 | **DepreciationMethod** | P1 | SL, DB, UoP, SYD |
| AT2UnitVc | Individual asset units | 40+ | **FixedAsset** | P1 | Main register — identity, classification, ownership, financials, depreciation config |
| AT2DprVc | Depreciation records | 25+ | **DepreciationEntry** | P1 | Monthly depreciation journal records |
| AT2WrofVc | Asset write-off/disposal | ~15 | **AssetDisposal** | P1 | Sale, scrap, write-off, trade-in |
| AT2MovVc | Asset movement (dept transfer) | ~10 | **AssetTransfer** | P1 | Department/cost centre reassignment |
| AT2TransVc | Asset transaction log | ~12 | **AssetTransaction** | P1 | Audit trail for all asset events |
| AT2PUVc | Asset purchase/acquisition | ~20 | FixedAsset lifecycle | P1 | Acquisition fields absorbed into FixedAsset + PO integration |
| InvBalVc | Asset quantity balance | ~8 | FixedAsset.status + queries | P1 | Active/disposed counts derived from FixedAsset status |

**Key Legacy Field Coverage (AT2UnitVc → FixedAsset):**

| Legacy Field Group | Legacy Fields | Nexa Coverage |
|-------------------|--------------|---------------|
| Identity | InventoryNr, Description, SerialNr, WarrantyNr, ContractNr | assetNumber, description, serialNumber, warrantyNumber, contractNumber |
| Classification | AT2Code, Objects | assetClassId, assetGroupId, tags (via Tag relation) |
| Ownership | Department, ResponsiblePerson, Vendor | departmentId, responsiblePersonId, supplierId |
| Financial (Book) | PurchaseValue, SalvageValue, InsuranceValue | purchaseValue, salvageValue, insuranceValue |
| Financial (Fiscal) | PurchVal2, FiscalValue, LandValue | fiscalPurchaseValue, fiscalSalvageValue (dual-basis) |
| Depreciation (Book) | StartingDate1, Model1, InitialDepreciation1 | depreciationMethodId, depreciationStartDate, accumulatedDepreciation |
| Depreciation (Fiscal) | StartingDate2, Model2, InitialDepreciation2 | fiscalDepreciationMethodId, fiscalDepreciationStartDate, fiscalAccumulatedDepreciation |
| Lifecycle | PurchaseDate, ProductionDate, EndDate, UsedFromDate, Active | purchaseDate, inServiceDate, endDate, status |

**GL Account Mappings (per AssetClass):**

| Account Purpose | Example GL Code | Debit/Credit | Usage |
|----------------|----------------|-------------|-------|
| Asset Account | 1200 | Debit on acquisition | Capitalised cost of the asset |
| Accumulated Depreciation | 1210 | Credit monthly | Running total of depreciation charged |
| Depreciation Expense | 7100 | Debit monthly | P&L charge for the period |
| Disposal Gain | 4900 | Credit on disposal | Proceeds > book value |
| Disposal Loss | 7900 | Debit on disposal | Proceeds < book value |
| WIP / Capital Investment | 1250 | Debit during construction | Assets under construction before capitalisation |

**Prisma Models:**

```prisma
// ═══════════════════════════════════════════════
// FIXED ASSETS MODULE — Asset Register, Depreciation & Disposal
// ═══════════════════════════════════════════════

// ── Enums ────────────────────────────────────

enum DepreciationMethodType {
  STRAIGHT_LINE
  DECLINING_BALANCE
  UNITS_OF_PRODUCTION
  SUM_OF_YEARS_DIGITS

  @@map("depreciation_method_type")
}

enum FixedAssetStatus {
  ACTIVE
  FULLY_DEPRECIATED
  DISPOSED
  WRITTEN_OFF
  UNDER_CONSTRUCTION

  @@map("fixed_asset_status")
}

enum DisposalType {
  SALE
  SCRAP
  WRITE_OFF
  TRADE_IN

  @@map("disposal_type")
}

enum AssetTransactionType {
  ACQUISITION
  DEPRECIATION
  TRANSFER
  REVALUATION
  DISPOSAL
  ADJUSTMENT

  @@map("asset_transaction_type")
}

enum DepreciationEntryStatus {
  DRAFT
  POSTED

  @@map("depreciation_entry_status")
}

enum AssetDisposalStatus {
  DRAFT
  APPROVED
  POSTED
  CANCELLED

  @@map("asset_disposal_status")
}

enum AssetTransferStatus {
  DRAFT
  APPROVED
  POSTED
  CANCELLED

  @@map("asset_transfer_status")
}

// ── Reference Entities ───────────────────────

model DepreciationMethod {
  id              String                  @id @default(uuid())
  code            String                  @unique               // "SL", "DB25", "UOP"
  name            String                                        // "Straight Line", "25% Declining Balance"
  methodType      DepreciationMethodType  @map("method_type")   // Calculation algorithm
  annualRate      Decimal?                @map("annual_rate") @db.Decimal(8, 4) // For declining balance (e.g., 25.0000 = 25%)
  description     String?

  isActive        Boolean                 @default(true) @map("is_active")
  createdAt       DateTime                @default(now()) @map("created_at")
  updatedAt       DateTime                @updatedAt @map("updated_at")

  // Relations
  bookAssets      FixedAsset[]            @relation("BookDepreciationMethod")
  fiscalAssets    FixedAsset[]            @relation("FiscalDepreciationMethod")

  @@map("depreciation_methods")
}

model AssetGroup {
  id              String       @id @default(uuid())
  code            String       @unique                          // "VEH", "IT", "FURN"
  name            String                                        // "Vehicles", "IT Equipment", "Furniture"
  parentGroupId   String?      @map("parent_group_id")          // Self-ref for hierarchy
  parentGroup     AssetGroup?  @relation("AssetGroupHierarchy", fields: [parentGroupId], references: [id])
  childGroups     AssetGroup[] @relation("AssetGroupHierarchy")

  isActive        Boolean      @default(true) @map("is_active")
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  // Relations
  assets          FixedAsset[]

  @@index([parentGroupId], map: "idx_asset_groups_parent_group_id")
  @@map("asset_groups")
}

model AssetClass {
  id                                String              @id @default(uuid())
  code                              String              @unique              // "COMP", "VEH-CAR", "FURN-OFF"
  name                              String                                   // "Computer Equipment", "Motor Cars"
  description                       String?

  // Default depreciation settings (applied to new assets in this class)
  defaultUsefulLifeMonths           Int                 @map("default_useful_life_months")  // e.g., 60 (5 years)
  defaultDepreciationMethodId       String              @map("default_depreciation_method_id")
  defaultSalvagePercent             Decimal             @default(0) @map("default_salvage_percent") @db.Decimal(5, 2) // e.g., 10.00 = 10%

  // GL Account Codes (FK to ChartOfAccount.code — validated at application layer)
  assetAccountCode                  String              @map("asset_account_code")                   // Dr on acquisition (e.g., 1200)
  accumulatedDepreciationAccountCode String             @map("accumulated_depreciation_account_code") // Cr monthly (e.g., 1210)
  depreciationExpenseAccountCode    String              @map("depreciation_expense_account_code")     // Dr monthly (e.g., 7100)
  disposalGainAccountCode           String              @map("disposal_gain_account_code")            // Cr on profitable disposal (e.g., 4900)
  disposalLossAccountCode           String              @map("disposal_loss_account_code")            // Dr on loss-making disposal (e.g., 7900)
  wipAccountCode                    String?             @map("wip_account_code")                     // Dr during construction (e.g., 1250)

  isActive                          Boolean             @default(true) @map("is_active")
  createdAt                         DateTime            @default(now()) @map("created_at")
  updatedAt                         DateTime            @updatedAt @map("updated_at")

  // Relations
  assets                            FixedAsset[]

  @@map("asset_classes")
}

// ── Main Asset Register ──────────────────────

model FixedAsset {
  id                          String            @id @default(uuid())
  assetNumber                 String            @unique @map("asset_number")          // Auto from NumberSeries (e.g., "FA-00001")
  description                 String                                                  // "Dell Latitude 5540 Laptop"
  serialNumber                String?           @map("serial_number")                 // Manufacturer serial
  warrantyNumber              String?           @map("warranty_number")               // Warranty/contract ref
  contractNumber              String?           @map("contract_number")               // Maintenance contract ref

  // Classification
  assetClassId                String            @map("asset_class_id")
  assetClass                  AssetClass        @relation(fields: [assetClassId], references: [id])
  assetGroupId                String?           @map("asset_group_id")
  assetGroup                  AssetGroup?       @relation(fields: [assetGroupId], references: [id])

  // Ownership & Location
  departmentId                String?           @map("department_id")                 // FK to Department
  responsiblePersonId         String?           @map("responsible_person_id")          // FK to User
  supplierId                  String?           @map("supplier_id")                   // FK to Supplier (who it was purchased from)
  location                    String?                                                 // Physical location text ("Building A, Floor 2, Room 204")

  // Lifecycle Dates
  purchaseDate                DateTime?         @map("purchase_date") @db.Date        // Date purchased
  inServiceDate               DateTime?         @map("in_service_date") @db.Date      // Date placed in service (depreciation may start here)
  endDate                     DateTime?         @map("end_date") @db.Date             // Disposal/retirement date

  // Financial — Book Basis (management accounts)
  purchaseValue               Decimal           @map("purchase_value") @db.Decimal(19, 4)         // Original capitalised cost
  salvageValue                Decimal           @default(0) @map("salvage_value") @db.Decimal(19, 4)  // Estimated residual value
  insuranceValue              Decimal           @default(0) @map("insurance_value") @db.Decimal(19, 4) // Insured replacement value

  // Financial — Fiscal/Tax Basis (HMRC capital allowances)
  fiscalPurchaseValue         Decimal?          @map("fiscal_purchase_value") @db.Decimal(19, 4)   // Tax-basis cost (may differ from book)
  fiscalSalvageValue          Decimal?          @default(0) @map("fiscal_salvage_value") @db.Decimal(19, 4)

  // Depreciation Config — Book Basis
  depreciationMethodId        String            @map("depreciation_method_id")
  depreciationMethod          DepreciationMethod @relation("BookDepreciationMethod", fields: [depreciationMethodId], references: [id])
  usefulLifeMonths            Int               @map("useful_life_months")                        // e.g., 60
  depreciationStartDate       DateTime?         @map("depreciation_start_date") @db.Date          // When book depreciation begins
  accumulatedDepreciation     Decimal           @default(0) @map("accumulated_depreciation") @db.Decimal(19, 4) // Running total

  // Depreciation Config — Fiscal/Tax Basis (optional — for dual-basis)
  fiscalDepreciationMethodId  String?           @map("fiscal_depreciation_method_id")
  fiscalDepreciationMethod    DepreciationMethod? @relation("FiscalDepreciationMethod", fields: [fiscalDepreciationMethodId], references: [id])
  fiscalUsefulLifeMonths      Int?              @map("fiscal_useful_life_months")
  fiscalDepreciationStartDate DateTime?         @map("fiscal_depreciation_start_date") @db.Date
  fiscalAccumulatedDepreciation Decimal?        @default(0) @map("fiscal_accumulated_depreciation") @db.Decimal(19, 4)

  // Computed Values (updated by depreciation service after each run)
  currentBookValue            Decimal           @default(0) @map("current_book_value") @db.Decimal(19, 4)        // purchaseValue - accumulatedDepreciation
  currentFiscalValue          Decimal?          @default(0) @map("current_fiscal_value") @db.Decimal(19, 4)      // fiscalPurchaseValue - fiscalAccumulatedDepreciation

  // Status & Notes
  status                      FixedAssetStatus  @default(ACTIVE)
  notes                       String?           @db.Text

  // Standard Fields
  isActive                    Boolean           @default(true) @map("is_active")
  createdAt                   DateTime          @default(now()) @map("created_at")
  updatedAt                   DateTime          @updatedAt @map("updated_at")
  createdBy                   String            @map("created_by")
  updatedBy                   String            @map("updated_by")

  // Relations
  depreciationEntries         DepreciationEntry[]
  disposals                   AssetDisposal[]
  transfersFrom               AssetTransfer[]   @relation("TransferFromAsset")
  transactions                AssetTransaction[]

  @@index([assetClassId], map: "idx_fixed_assets_asset_class_id")
  @@index([assetGroupId], map: "idx_fixed_assets_asset_group_id")
  @@index([departmentId], map: "idx_fixed_assets_department_id")
  @@index([status], map: "idx_fixed_assets_status")
  @@index([supplierId], map: "idx_fixed_assets_supplier_id")
  @@map("fixed_assets")
}

// ── Transactional Entities ───────────────────

model DepreciationEntry {
  id                        String                    @id @default(uuid())
  fixedAssetId              String                    @map("fixed_asset_id")
  fixedAsset                FixedAsset                @relation(fields: [fixedAssetId], references: [id])
  periodId                  String                    @map("period_id")             // FK to FinancialPeriod
  depreciationDate          DateTime                  @map("depreciation_date") @db.Date

  // Book Basis
  bookDepreciationAmount    Decimal                   @map("book_depreciation_amount") @db.Decimal(19, 4)    // This period's charge
  bookAccumulatedTotal      Decimal                   @map("book_accumulated_total") @db.Decimal(19, 4)     // Running total after this entry
  bookValue                 Decimal                   @map("book_value") @db.Decimal(19, 4)                  // Remaining book value

  // Fiscal/Tax Basis
  fiscalDepreciationAmount  Decimal                   @default(0) @map("fiscal_depreciation_amount") @db.Decimal(19, 4)
  fiscalAccumulatedTotal    Decimal                   @default(0) @map("fiscal_accumulated_total") @db.Decimal(19, 4)
  fiscalValue               Decimal                   @default(0) @map("fiscal_value") @db.Decimal(19, 4)

  // GL Integration
  journalEntryId            String?                   @map("journal_entry_id")      // FK to JournalEntry (Dr Depreciation Expense, Cr Accumulated Depreciation)

  // Status
  status                    DepreciationEntryStatus   @default(DRAFT)
  isAutoGenerated           Boolean                   @default(true) @map("is_auto_generated") // true = batch run, false = manual entry

  // Standard Fields
  createdAt                 DateTime                  @default(now()) @map("created_at")
  updatedAt                 DateTime                  @updatedAt @map("updated_at")
  createdBy                 String                    @map("created_by")
  updatedBy                 String                    @map("updated_by")

  @@index([fixedAssetId, periodId], map: "idx_depreciation_entries_asset_period")
  @@index([periodId], map: "idx_depreciation_entries_period_id")
  @@index([status], map: "idx_depreciation_entries_status")
  @@unique([fixedAssetId, periodId], map: "uq_depreciation_entries_asset_period") // One entry per asset per period
  @@map("depreciation_entries")
}

model AssetDisposal {
  id                      String                @id @default(uuid())
  fixedAssetId            String                @map("fixed_asset_id")
  fixedAsset              FixedAsset            @relation(fields: [fixedAssetId], references: [id])

  disposalDate            DateTime              @map("disposal_date") @db.Date
  disposalType            DisposalType          @map("disposal_type")                  // SALE, SCRAP, WRITE_OFF, TRADE_IN

  // Financial
  saleProceeds            Decimal               @default(0) @map("sale_proceeds") @db.Decimal(19, 4)          // 0 for scrap/write-off
  bookValueAtDisposal     Decimal               @map("book_value_at_disposal") @db.Decimal(19, 4)             // NBV at disposal date
  gainOrLoss              Decimal               @map("gain_or_loss") @db.Decimal(19, 4)                       // saleProceeds - bookValueAtDisposal

  // Buyer (optional — for sales/trade-ins)
  buyerName               String?               @map("buyer_name")
  buyerReference          String?               @map("buyer_reference")                // Invoice or receipt ref

  // GL Integration
  journalEntryId          String?               @map("journal_entry_id")               // FK to JournalEntry

  // Status & Notes
  status                  AssetDisposalStatus   @default(DRAFT)
  notes                   String?               @db.Text

  // Standard Fields
  createdAt               DateTime              @default(now()) @map("created_at")
  updatedAt               DateTime              @updatedAt @map("updated_at")
  createdBy               String                @map("created_by")
  updatedBy               String                @map("updated_by")

  @@index([fixedAssetId], map: "idx_asset_disposals_fixed_asset_id")
  @@index([disposalDate], map: "idx_asset_disposals_disposal_date")
  @@index([status], map: "idx_asset_disposals_status")
  @@map("asset_disposals")
}

model AssetTransfer {
  id                      String                @id @default(uuid())
  fixedAssetId            String                @map("fixed_asset_id")
  fixedAsset              FixedAsset            @relation("TransferFromAsset", fields: [fixedAssetId], references: [id])

  transferDate            DateTime              @map("transfer_date") @db.Date
  fromDepartmentId        String                @map("from_department_id")             // FK to Department
  toDepartmentId          String                @map("to_department_id")               // FK to Department
  fromLocation            String?               @map("from_location")                  // Previous physical location
  toLocation              String?               @map("to_location")                    // New physical location
  reason                  String?                                                      // Reason for transfer

  // Status & Approval
  status                  AssetTransferStatus   @default(DRAFT)
  approvedBy              String?               @map("approved_by")
  approvedAt              DateTime?             @map("approved_at")

  // Standard Fields
  createdAt               DateTime              @default(now()) @map("created_at")
  updatedAt               DateTime              @updatedAt @map("updated_at")
  createdBy               String                @map("created_by")
  updatedBy               String                @map("updated_by")

  @@index([fixedAssetId], map: "idx_asset_transfers_fixed_asset_id")
  @@index([transferDate], map: "idx_asset_transfers_transfer_date")
  @@index([status], map: "idx_asset_transfers_status")
  @@map("asset_transfers")
}

model AssetTransaction {
  id                      String                  @id @default(uuid())
  fixedAssetId            String                  @map("fixed_asset_id")
  fixedAsset              FixedAsset              @relation(fields: [fixedAssetId], references: [id])

  transactionDate         DateTime                @map("transaction_date") @db.Date
  transactionType         AssetTransactionType    @map("transaction_type")           // ACQUISITION, DEPRECIATION, TRANSFER, etc.
  amount                  Decimal                 @map("amount") @db.Decimal(19, 4)  // Financial impact of this transaction
  description             String                                                     // Human-readable description of what happened
  journalEntryId          String?                 @map("journal_entry_id")            // FK to JournalEntry (if GL posting was made)

  // Standard Fields (audit trail — no updatedAt/updatedBy; these are append-only)
  createdAt               DateTime                @default(now()) @map("created_at")
  createdBy               String                  @map("created_by")

  @@index([fixedAssetId, transactionDate], map: "idx_asset_transactions_asset_date")
  @@index([transactionType], map: "idx_asset_transactions_type")
  @@map("asset_transactions")
}
```

**Depreciation Calculation Logic:**

The depreciation service calculates the monthly charge based on the method assigned to each asset. All formulas operate on monthly granularity.

**1. Straight Line (STRAIGHT_LINE)**

The most common method for UK SMEs. Spreads the depreciable amount evenly across the useful life.

```
depreciableAmount = purchaseValue - salvageValue
monthlyDepreciation = depreciableAmount / usefulLifeMonths

Example:
  Laptop purchased for £1,200, salvage £0, useful life 36 months
  Monthly depreciation = (£1,200 - £0) / 36 = £33.33
  After 36 months: accumulatedDepreciation = £1,200, currentBookValue = £0
```

**2. Declining Balance (DECLINING_BALANCE)**

Accelerated method — higher charges in early years, diminishing over time. Common for vehicles and technology that lose value rapidly.

```
annualRate = depreciationMethod.annualRate (e.g., 25.0000 = 25%)
monthlyRate = annualRate / 12 / 100
monthlyDepreciation = currentBookValue * monthlyRate

Example:
  Van purchased for £20,000, 25% declining balance
  Month 1: £20,000 * (25/12/100) = £416.67 → bookValue = £19,583.33
  Month 2: £19,583.33 * (25/12/100) = £407.99 → bookValue = £19,175.34
  ...diminishing each month

Floor rule: depreciation stops when currentBookValue <= salvageValue
```

**3. Units of Production (UNITS_OF_PRODUCTION)**

Depreciation based on actual usage rather than time. Requires periodic usage updates.

```
depreciableAmount = purchaseValue - salvageValue
depreciationPerUnit = depreciableAmount / totalEstimatedUnits
periodDepreciation = depreciationPerUnit * unitsUsedThisPeriod

Example:
  Printing press, £50,000, estimated 1,000,000 pages, salvage £5,000
  Per page: (£50,000 - £5,000) / 1,000,000 = £0.045
  Month produced 8,000 pages: 8,000 * £0.045 = £360.00
```

**4. Sum of Years' Digits (SUM_OF_YEARS_DIGITS)**

Accelerated method that applies a decreasing fraction each year.

```
sumOfYears = n * (n + 1) / 2  (where n = useful life in years)
yearFraction = remainingYears / sumOfYears
annualDepreciation = depreciableAmount * yearFraction
monthlyDepreciation = annualDepreciation / 12

Example:
  Machine, £10,000, 5 years, salvage £1,000
  sumOfYears = 5 * 6 / 2 = 15
  Year 1: (£10,000 - £1,000) * 5/15 = £3,000 → £250/month
  Year 2: £9,000 * 4/15 = £2,400 → £200/month
  Year 3: £9,000 * 3/15 = £1,800 → £150/month
```

**Common Rules (all methods):**

- Depreciation never reduces `currentBookValue` below `salvageValue`
- Depreciation does not run for assets with status `FULLY_DEPRECIATED`, `DISPOSED`, or `WRITTEN_OFF`
- Depreciation does not run for assets with status `UNDER_CONSTRUCTION` (not yet capitalised)
- If the remaining depreciable amount for a period is less than the calculated amount, the charge is capped at the remaining amount
- All calculations use `Decimal(19, 4)` — no floating-point arithmetic

**Monthly Depreciation Run Workflow:**

The depreciation run is a batch process executed monthly (typically at month-end), creating DepreciationEntry records and corresponding GL journal entries for all eligible assets.

```
1. USER/SCHEDULER triggers depreciation run for a specific FinancialPeriod
   └── Validate: period exists, period is not locked, period not already fully run

2. QUERY all FixedAssets WHERE:
   └── status = ACTIVE
   └── depreciationStartDate <= periodEndDate
   └── No existing DepreciationEntry for this asset + period (unique constraint)

3. FOR EACH eligible asset:
   a. CALCULATE book depreciation amount using asset's depreciationMethod
   b. CALCULATE fiscal depreciation amount using asset's fiscalDepreciationMethod (if dual-basis)
   c. APPLY floor rule: cap at (currentBookValue - salvageValue) if needed
   d. CREATE DepreciationEntry (status: DRAFT)
      - bookDepreciationAmount, bookAccumulatedTotal, bookValue
      - fiscalDepreciationAmount, fiscalAccumulatedTotal, fiscalValue
   e. CREATE AssetTransaction (type: DEPRECIATION)

4. REVIEW step: user reviews DRAFT entries (can adjust manual overrides)

5. POST step: user approves → batch transitions DRAFT → POSTED
   a. For each POSTED entry, CREATE JournalEntry:
      - Dr: depreciationExpenseAccountCode (from AssetClass)  [amount]
      - Cr: accumulatedDepreciationAccountCode (from AssetClass)  [amount]
   b. UPDATE FixedAsset:
      - accumulatedDepreciation += bookDepreciationAmount
      - currentBookValue = purchaseValue - accumulatedDepreciation
      - fiscalAccumulatedDepreciation += fiscalDepreciationAmount (if applicable)
      - currentFiscalValue = fiscalPurchaseValue - fiscalAccumulatedDepreciation
   c. If currentBookValue <= salvageValue → set status = FULLY_DEPRECIATED

6. EMIT events:
   - depreciation.run.completed (periodId, assetCount, totalAmount)
   - Per asset: depreciation.entry.posted (fixedAssetId, amount)
```

**Asset Disposal Workflow:**

When an asset is sold, scrapped, written off, or traded in, the disposal process removes it from the active register and generates the appropriate GL entries to record the gain or loss.

```
1. USER creates AssetDisposal (status: DRAFT)
   - Select asset, disposal type, date, sale proceeds (if any)
   - System auto-calculates:
     a. Run any remaining depreciation up to disposal date (pro-rata)
     b. bookValueAtDisposal = currentBookValue after final depreciation
     c. gainOrLoss = saleProceeds - bookValueAtDisposal

2. REVIEW: user verifies the gain/loss calculation

3. APPROVE → POST: creates GL journal entry

   Example — Sale of laptop for £200, book value £150:

   JournalEntry:
   ┌───────────────────────────────────┬──────────┬──────────┐
   │ Account                          │ Debit    │ Credit   │
   ├───────────────────────────────────┼──────────┼──────────┤
   │ Bank / Accounts Receivable       │ £200.00  │          │  ← Sale proceeds
   │ Accumulated Depreciation (1210)  │ £1,050.00│          │  ← Remove accum. depr.
   │ Asset Account (1200)             │          │ £1,200.00│  ← Remove original cost
   │ Disposal Gain (4900)             │          │ £50.00   │  ← Gain on sale
   └───────────────────────────────────┴──────────┴──────────┘
   (If loss: Disposal Loss account debited instead of Gain credited)

4. UPDATE FixedAsset:
   - status = DISPOSED (or WRITTEN_OFF for write-offs)
   - endDate = disposalDate
   - isActive = false

5. CREATE AssetTransaction (type: DISPOSAL)

6. EMIT events:
   - asset.disposed (fixedAssetId, disposalType, gainOrLoss)
```

**Example — Scrap of fully depreciated printer (book value £0, no proceeds):**

```
JournalEntry:
┌───────────────────────────────────┬──────────┬──────────┐
│ Account                          │ Debit    │ Credit   │
├───────────────────────────────────┼──────────┼──────────┤
│ Accumulated Depreciation (1210)  │ £500.00  │          │  ← Remove accum. depr.
│ Asset Account (1200)             │          │ £500.00  │  ← Remove original cost
└───────────────────────────────────┴──────────┴──────────┘
(No gain/loss entry — proceeds = book value = £0)
```

**Dual-Basis Depreciation (Book vs Tax — HMRC):**

UK SMEs must maintain two depreciation calculations for assets:

1. **Book Depreciation** (management accounts): The company chooses its own depreciation policy based on expected useful life and accounting standards (FRS 102). This appears in the P&L as "Depreciation" expense and on the balance sheet under "Fixed Assets". The book values drive management decisions and statutory accounts.

2. **Fiscal/Tax Depreciation** (HMRC capital allowances): HMRC does not accept book depreciation as a tax-deductible expense. Instead, companies claim **capital allowances** at rates set by HMRC:
   - **Annual Investment Allowance (AIA)**: 100% first-year deduction up to the AIA limit (currently £1,000,000)
   - **Writing Down Allowance (WDA)**: 18% declining balance for main pool, 6% for special rate pool
   - **Full Expensing**: 100% first-year for qualifying plant and machinery (from April 2023)
   - **Small Pools Allowance**: Write off pools below £1,000

The dual-basis fields in FixedAsset (`fiscalPurchaseValue`, `fiscalDepreciationMethodId`, `fiscalUsefulLifeMonths`, `fiscalAccumulatedDepreciation`, `currentFiscalValue`) allow each asset to carry both calculations simultaneously. The DepreciationEntry records both `bookDepreciationAmount` and `fiscalDepreciationAmount` each period.

**Corporation Tax Computation Impact:**

```
  Book profit (before tax)                         £100,000
  Add back: Book depreciation (not tax-deductible)  +£15,000
  Less: Capital allowances claimed                  -£22,000
                                                   ─────────
  Taxable profit                                    £93,000
```

This adjustment is a standard part of the UK corporation tax computation. By tracking both bases per-asset, Nexa can auto-generate the depreciation add-back and capital allowance figures for the accountant preparing the tax return.

**Asset Acquisition Workflow (PO Integration):**

```
1. PURCHASE ORDER created in Purchasing module (for capital item)
   └── PO line flagged as "Capital expenditure" (not expensed)

2. GOODS RECEIPT confirms physical receipt of the asset

3. SUPPLIER INVOICE posted in AP module
   └── Instead of expensing to P&L, the cost is capitalised:
       Dr: Asset Account (1200) or WIP Account (1250)
       Cr: Accounts Payable

4. FIXED ASSET record created (manual or auto from flagged PO):
   - purchaseValue populated from invoice amount
   - assetClassId determines GL accounts and default depreciation
   - depreciationStartDate set (typically inServiceDate)
   - status = ACTIVE (or UNDER_CONSTRUCTION if WIP)

5. CREATE AssetTransaction (type: ACQUISITION)

6. EMIT event: asset.acquired (fixedAssetId, purchaseValue)
```

**Build Sequence Note:**

Fixed Assets is a **Phase 1 (P1)** module, built as part of **Stories 9+** after the Finance (GL) foundation is complete. Dependencies:

- **Depends on Finance module** (Story 4): JournalEntry, JournalLine, FinancialPeriod, ChartOfAccount — all depreciation and disposal GL postings create journal entries
- **Depends on System module** (Story 1b): Department, NumberSeries (for FA-XXXXX asset numbers), User (responsible person)
- **Depends on Purchasing/AP** (Story 9+): Supplier entity, PO integration for acquisition workflow
- **No modules depend on Fixed Assets**: It is a leaf-node in the dependency graph — safe to build last in the module sequence

Recommended build order within the Fixed Assets module:
1. Reference entities first: DepreciationMethod, AssetGroup, AssetClass (with GL account validation)
2. FixedAsset register with CRUD, NumberSeries integration, search/filter
3. Monthly depreciation run service (batch calculation + GL posting)
4. Asset disposal workflow (gain/loss calculation + GL posting)
5. Asset transfer (department reassignment)
6. AssetTransaction audit trail (populated by all above operations)
7. Reports: Asset Register, Depreciation Schedule, Disposal Report, Fixed Asset Note (for statutory accounts)

### 2.19 Pricing Module — Price Lists, Quantity Breaks & Discounts

The Pricing Module provides a centralised price resolution engine consumed by Sales Orders, Invoices, Quotes, and POS transactions. It replaces the HansaWorld Price List register system (PLDefVc, PLVc, PLQVc) with a structured, auditable model that supports fixed pricing, quantity-break discounts, customer-specific overrides, formula-based pricing, and time-windowed validity. Rebates (RebVc) and multi-buy deals (MultiBuyRebVc) are stubbed at P1 with full tier support, ready for P2 promotion engine expansion.

The module follows a "most-specific-wins" resolution strategy: a customer+item price always beats a generic list price, and quantity breaks refine within a given list entry. A `noOtherPricing` flag allows hard stops in the chain for contracted prices.

---

#### Legacy-to-Nexa Mapping

| HansaWorld Register / Field | Nexa Model / Field | Notes |
|---|---|---|
| PLDefVc (Price List Definitions) | `PriceList` | Code, currency, VAT-inclusive flag, validity dates, price type |
| PLDefVc.Code | `PriceList.code` | Unique identifier |
| PLDefVc.CurncyCode | `PriceList.currencyCode` | FK to Currency reference |
| PLDefVc.InclVAT | `PriceList.includesVat` | Boolean |
| PLDefVc.StartDate / EndDate | `PriceList.startDate` / `endDate` | Nullable validity window |
| PLDefVc.StartTime / EndTime | Deferred to P2 | Time-of-day pricing (POS happy-hour) |
| PLDefVc.DepPrice (0/1/2) | `PriceList.priceType` enum | FIXED / QUANTITY_BREAK / CUSTOMER_SPECIFIC |
| PLDefVc.PLReplCode | `PriceList.replacementPriceListId` | Self-FK for seasonal fallback |
| PLVc (Price List Entries) | `PriceListEntry` | Item price per list, optional customer scope |
| PLVc.CustCode | `PriceListEntry.customerId` | Nullable — when set, customer-specific |
| PLVc.NoOtherPricing | `PriceListEntry.noOtherPricing` | Hard stop flag |
| PLQVc (Quantity Breaks) | `QuantityBreak` | Volume-discount tiers per entry |
| RebVc (Rebates) | `Rebate` + `RebateTier` | P1 stub with full tier model |
| MultiBuyRebVc | Deferred to P2 | Multi-buy / bundle deals |
| PromotionVc | Deferred to P2 | Promotional campaigns |
| INVc.InPrice | `InventoryItem.costPrice` | Fallback base price |
| INVc.UPrice1 | `InventoryItem.salesPrice` | Selling Price 1 (default) |
| INVc.CalcPrice | `PriceListEntry` formula fields | Formula pricing method |
| INVc.PriceFactor | `PriceListEntry.priceFactor` | Multiplier for unit conversion |

---

#### Prisma Schema

```prisma
// ─────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────

enum PriceType {
  FIXED
  QUANTITY_BREAK
  CUSTOMER_SPECIFIC

  @@map("price_type")
}

enum FormulaBaseSource {
  COST_PRICE
  SALES_PRICE_1
  SALES_PRICE_2
  SALES_PRICE_3
  LAST_PURCHASE_PRICE
  WEIGHTED_AVERAGE
  BASE_PRICE_LIST

  @@map("formula_base_source")
}

enum RebateType {
  PERCENTAGE
  FIXED_AMOUNT
  TIERED

  @@map("rebate_type")
}

// ─────────────────────────────────────────────
// Models
// ─────────────────────────────────────────────

model PriceList {
  id                      String    @id @default(uuid())
  code                    String    @unique
  name                    String
  description             String?
  currencyCode            String    @map("currency_code")
  includesVat             Boolean   @default(false) @map("includes_vat")
  priceType               PriceType @default(FIXED) @map("price_type")
  startDate               DateTime? @map("start_date")
  endDate                 DateTime? @map("end_date")
  isDefault               Boolean   @default(false) @map("is_default")
  replacementPriceListId  String?   @map("replacement_price_list_id")
  isActive                Boolean   @default(true) @map("is_active")
  createdAt               DateTime  @default(now()) @map("created_at")
  updatedAt               DateTime  @updatedAt @map("updated_at")

  // Relations
  replacementPriceList    PriceList?       @relation("PriceListReplacement", fields: [replacementPriceListId], references: [id])
  replacedByLists         PriceList[]      @relation("PriceListReplacement")
  entries                 PriceListEntry[]

  @@map("price_lists")
  @@index([code], map: "idx_price_lists_code")
  @@index([currencyCode], map: "idx_price_lists_currency_code")
  @@index([isActive], map: "idx_price_lists_is_active")
  @@index([startDate, endDate], map: "idx_price_lists_validity")
}

model PriceListEntry {
  id               String    @id @default(uuid())
  priceListId      String    @map("price_list_id")
  itemId           String    @map("item_id")
  customerId       String?   @map("customer_id")
  price            Decimal   @db.Decimal(19, 4)
  minQuantity      Decimal   @default(0) @db.Decimal(10, 4) @map("min_quantity")
  noOtherPricing   Boolean   @default(false) @map("no_other_pricing")
  startDate        DateTime? @map("start_date")
  endDate          DateTime? @map("end_date")
  isActive         Boolean   @default(true) @map("is_active")

  // Formula pricing fields (nullable — only used when formula-based)
  formulaBaseSource  FormulaBaseSource? @map("formula_base_source")
  formulaPercent     Decimal?           @db.Decimal(10, 4) @map("formula_percent")
  formulaAddition1   Decimal?           @db.Decimal(19, 4) @map("formula_addition_1")
  formulaRounding    Int?               @map("formula_rounding")
  formulaAddition2   Decimal?           @db.Decimal(19, 4) @map("formula_addition_2")
  priceFactor        Decimal?           @db.Decimal(10, 4) @map("price_factor")

  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  // Relations
  priceList        PriceList       @relation(fields: [priceListId], references: [id])
  quantityBreaks   QuantityBreak[]

  @@map("price_list_entries")
  @@unique([priceListId, itemId, customerId], map: "uq_price_list_entries_list_item_cust")
  @@index([priceListId], map: "idx_price_list_entries_price_list_id")
  @@index([itemId], map: "idx_price_list_entries_item_id")
  @@index([customerId], map: "idx_price_list_entries_customer_id")
  @@index([startDate, endDate], map: "idx_price_list_entries_validity")
}

model QuantityBreak {
  id                String   @id @default(uuid())
  priceListEntryId  String   @map("price_list_entry_id")
  fromQuantity      Decimal  @db.Decimal(10, 4) @map("from_quantity")
  toQuantity        Decimal? @db.Decimal(10, 4) @map("to_quantity")
  price             Decimal  @db.Decimal(19, 4)
  discountPercent   Decimal? @db.Decimal(5, 2) @map("discount_percent")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  // Relations
  priceListEntry    PriceListEntry @relation(fields: [priceListEntryId], references: [id], onDelete: Cascade)

  @@map("quantity_breaks")
  @@index([priceListEntryId], map: "idx_quantity_breaks_price_list_entry_id")
  @@index([fromQuantity], map: "idx_quantity_breaks_from_quantity")
}

model Rebate {
  id              String     @id @default(uuid())
  code            String     @unique
  name            String
  description     String?
  rebateType      RebateType @map("rebate_type")
  customerId      String?    @map("customer_id")
  itemGroupCode   String?    @map("item_group_code")
  discountPercent Decimal?   @db.Decimal(5, 2) @map("discount_percent")
  fixedAmount     Decimal?   @db.Decimal(19, 4) @map("fixed_amount")
  startDate       DateTime?  @map("start_date")
  endDate         DateTime?  @map("end_date")
  isActive        Boolean    @default(true) @map("is_active")
  createdAt       DateTime   @default(now()) @map("created_at")
  updatedAt       DateTime   @updatedAt @map("updated_at")

  // Relations
  tiers           RebateTier[]

  @@map("rebates")
  @@index([code], map: "idx_rebates_code")
  @@index([customerId], map: "idx_rebates_customer_id")
  @@index([itemGroupCode], map: "idx_rebates_item_group_code")
  @@index([isActive], map: "idx_rebates_is_active")
  @@index([startDate, endDate], map: "idx_rebates_validity")
}

model RebateTier {
  id              String   @id @default(uuid())
  rebateId        String   @map("rebate_id")
  fromAmount      Decimal  @db.Decimal(19, 4) @map("from_amount")
  toAmount        Decimal? @db.Decimal(19, 4) @map("to_amount")
  discountPercent Decimal  @db.Decimal(5, 2) @map("discount_percent")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  // Relations
  rebate          Rebate @relation(fields: [rebateId], references: [id], onDelete: Cascade)

  @@map("rebate_tiers")
  @@index([rebateId], map: "idx_rebate_tiers_rebate_id")
  @@index([fromAmount], map: "idx_rebate_tiers_from_amount")
}
```

---

#### Price Resolution Algorithm

The price resolution engine is the single entry point for all modules that need a unit price. It accepts an item, an optional customer, an optional quantity, and a transaction date, then walks the hierarchy from most-specific to least-specific, returning the first match.

```typescript
interface PriceResolutionInput {
  itemId: string;
  customerId?: string;
  quantity: Decimal;
  transactionDate: Date;
  currencyCode: string;
  priceListCode?: string;        // explicit list override (e.g. from Sales Order header)
}

interface ResolvedPrice {
  unitPrice: Decimal;
  source: PriceSource;
  priceListId?: string;
  priceListEntryId?: string;
  quantityBreakId?: string;
  rebateId?: string;
  formulaApplied: boolean;
  includesVat: boolean;
}

type PriceSource =
  | 'CUSTOMER_ITEM_SPECIFIC'     // Level 1
  | 'QUANTITY_BREAK'             // Level 2
  | 'PRICE_LIST_ITEM'            // Level 3
  | 'FORMULA'                    // Level 3b (formula-derived from base)
  | 'VENDOR_PURCHASE_PRICE'      // Level 4
  | 'ITEM_BASE_PRICE'            // Level 5
  | 'REBATE_ADJUSTED';           // Level 6 (post-resolution adjustment)

async function resolvePrice(input: PriceResolutionInput): Promise<ResolvedPrice> {
  const { itemId, customerId, quantity, transactionDate, currencyCode, priceListCode } = input;
  const now = transactionDate;

  // Helper: check date validity on a list or entry
  const isDateValid = (start?: Date | null, end?: Date | null): boolean =>
    (!start || start <= now) && (!end || end >= now);

  // ── LEVEL 1: Customer + Item specific price ──────────────────────
  if (customerId) {
    const customerEntry = await findPriceListEntry({
      itemId,
      customerId,
      currencyCode,
      priceListCode,
      date: now,
    });

    if (customerEntry) {
      const price = applyFormula(customerEntry) ?? customerEntry.price;

      // If noOtherPricing is set, return immediately — no further resolution
      if (customerEntry.noOtherPricing) {
        return {
          unitPrice: price,
          source: 'CUSTOMER_ITEM_SPECIFIC',
          priceListId: customerEntry.priceListId,
          priceListEntryId: customerEntry.id,
          formulaApplied: !!customerEntry.formulaBaseSource,
          includesVat: customerEntry.priceList.includesVat,
        };
      }

      // Check quantity breaks within this customer-specific entry
      const qtyBreak = findQuantityBreak(customerEntry.quantityBreaks, quantity);
      if (qtyBreak) {
        return {
          unitPrice: qtyBreak.price ?? applyDiscount(price, qtyBreak.discountPercent),
          source: 'QUANTITY_BREAK',
          priceListId: customerEntry.priceListId,
          priceListEntryId: customerEntry.id,
          quantityBreakId: qtyBreak.id,
          formulaApplied: false,
          includesVat: customerEntry.priceList.includesVat,
        };
      }

      return {
        unitPrice: price,
        source: 'CUSTOMER_ITEM_SPECIFIC',
        priceListId: customerEntry.priceListId,
        priceListEntryId: customerEntry.id,
        formulaApplied: !!customerEntry.formulaBaseSource,
        includesVat: customerEntry.priceList.includesVat,
      };
    }
  }

  // ── LEVEL 2-3: Item in price list (no customer scope) ───────────
  const genericEntry = await findPriceListEntry({
    itemId,
    customerId: null,   // generic entries only
    currencyCode,
    priceListCode,
    date: now,
  });

  if (genericEntry) {
    const basePrice = applyFormula(genericEntry) ?? genericEntry.price;

    // Check quantity breaks
    const qtyBreak = findQuantityBreak(genericEntry.quantityBreaks, quantity);
    if (qtyBreak) {
      return {
        unitPrice: qtyBreak.price ?? applyDiscount(basePrice, qtyBreak.discountPercent),
        source: 'QUANTITY_BREAK',
        priceListId: genericEntry.priceListId,
        priceListEntryId: genericEntry.id,
        quantityBreakId: qtyBreak.id,
        formulaApplied: false,
        includesVat: genericEntry.priceList.includesVat,
      };
    }

    return {
      unitPrice: basePrice,
      source: genericEntry.formulaBaseSource ? 'FORMULA' : 'PRICE_LIST_ITEM',
      priceListId: genericEntry.priceListId,
      priceListEntryId: genericEntry.id,
      formulaApplied: !!genericEntry.formulaBaseSource,
      includesVat: genericEntry.priceList.includesVat,
    };
  }

  // ── LEVEL 3b: Replacement (fallback) price list ──────────────────
  if (priceListCode) {
    const currentList = await findPriceList(priceListCode);
    if (currentList?.replacementPriceListId) {
      const fallbackResult = await resolvePrice({
        ...input,
        priceListCode: currentList.replacementPriceList!.code,
      });
      if (fallbackResult.source !== 'ITEM_BASE_PRICE') {
        return fallbackResult;
      }
    }
  }

  // ── LEVEL 4: Vendor purchase price (last purchase price) ─────────
  const item = await findInventoryItem(itemId);
  if (item.lastPurchasePrice && item.lastPurchasePrice.greaterThan(0)) {
    return {
      unitPrice: item.lastPurchasePrice,
      source: 'VENDOR_PURCHASE_PRICE',
      formulaApplied: false,
      includesVat: false,
    };
  }

  // ── LEVEL 5: Item base price (salesPrice or costPrice) ──────────
  const fallbackPrice = item.salesPrice ?? item.costPrice;
  return {
    unitPrice: fallbackPrice ?? new Decimal(0),
    source: 'ITEM_BASE_PRICE',
    formulaApplied: false,
    includesVat: false,
  };
}

// ── Post-resolution: Rebate application ─────────────────────────────
async function applyRebates(
  resolved: ResolvedPrice,
  itemId: string,
  customerId: string | undefined,
  lineTotal: Decimal,
  transactionDate: Date,
): Promise<ResolvedPrice> {
  const rebate = await findApplicableRebate({
    customerId,
    itemId,
    date: transactionDate,
  });

  if (!rebate) return resolved;

  let discount = new Decimal(0);

  switch (rebate.rebateType) {
    case 'PERCENTAGE':
      discount = resolved.unitPrice.mul(rebate.discountPercent!).div(100);
      break;
    case 'FIXED_AMOUNT':
      discount = rebate.fixedAmount!;
      break;
    case 'TIERED': {
      const tier = rebate.tiers.find(
        (t) => lineTotal.gte(t.fromAmount) && (!t.toAmount || lineTotal.lte(t.toAmount)),
      );
      if (tier) {
        discount = resolved.unitPrice.mul(tier.discountPercent).div(100);
      }
      break;
    }
  }

  return {
    ...resolved,
    unitPrice: resolved.unitPrice.sub(discount),
    rebateId: rebate.id,
    source: 'REBATE_ADJUSTED',
  };
}
```

**Key helper functions** (not shown in full):

| Function | Purpose |
|---|---|
| `findPriceListEntry(...)` | Queries `PriceListEntry` joined to `PriceList`, filtering by item, optional customer, currency, date validity, and `isActive`. Orders by specificity (customer entries first, then by price list priority). |
| `findQuantityBreak(breaks, qty)` | Given a sorted array of `QuantityBreak` rows, returns the tier where `fromQuantity <= qty` and (`toQuantity IS NULL` or `toQuantity >= qty`). |
| `applyFormula(entry)` | If `formulaBaseSource` is set, fetches the base value from the item or a base price list, then computes: `baseValue * (formulaPercent / 100) + formulaAddition1`, rounds to `formulaRounding` decimal places, then adds `formulaAddition2`. Returns the computed price. |
| `applyDiscount(price, pct)` | Returns `price * (1 - pct / 100)`. |

---

#### Formula Pricing

Formula pricing allows a price list entry to derive its price dynamically from a base value rather than storing a fixed amount. This is the Nexa equivalent of HansaWorld's `CalcPrice` method on INVc.

**Formula:**

```
resolvedPrice = round(baseValue × (formulaPercent / 100) + formulaAddition1, formulaRounding) + formulaAddition2
```

**Base value sources** (from `FormulaBaseSource` enum):

| Source | Description |
|---|---|
| `COST_PRICE` | `InventoryItem.costPrice` — current cost |
| `SALES_PRICE_1` | `InventoryItem.salesPrice` — standard selling price |
| `SALES_PRICE_2` | Reserved for secondary price field (P2) |
| `SALES_PRICE_3` | Reserved for tertiary price field (P2) |
| `LAST_PURCHASE_PRICE` | `InventoryItem.lastPurchasePrice` — most recent vendor cost |
| `WEIGHTED_AVERAGE` | Computed weighted average cost from stock movements |
| `BASE_PRICE_LIST` | Price from another price list (identified by `replacementPriceListId`) |

**Example:** A trade price list might set `formulaBaseSource = SALES_PRICE_1`, `formulaPercent = 80` (80% of retail), `formulaAddition1 = 0`, `formulaRounding = 2`, `formulaAddition2 = 0`. This produces prices at a 20% discount off retail, automatically tracking any retail price changes.

When `formulaBaseSource` is `null`, the entry uses the fixed `price` field directly.

---

#### Integration with Sales Orders, Invoices & POS

The price resolution engine is invoked at the **line-item level** whenever a user adds or modifies a line on a Sales Order, Quote, Invoice, or POS transaction.

**Sales Order / Quote flow:**

1. User selects an item on a Sales Order line.
2. The front-end calls `resolvePrice({ itemId, customerId: order.customerId, quantity, transactionDate: order.orderDate, currencyCode: order.currencyCode, priceListCode: order.priceListCode })`.
3. The resolved `unitPrice` is written to `SalesOrderLine.unitPrice`. The `source` and `priceListEntryId` are stored on the line for audit traceability.
4. If `quantity` changes, price is re-resolved (quantity breaks may shift the tier).
5. On order confirmation, the resolved price is locked — subsequent price list changes do not retroactively alter confirmed orders.

**Invoice flow:**

1. Invoices created from Sales Orders inherit the locked line prices.
2. Standalone invoices (manual entry) trigger the same `resolvePrice` call.
3. The `includesVat` flag from the resolved price list determines whether VAT is backed out or added on the invoice line.

**POS flow:**

1. POS scans/selects an item; `resolvePrice` is called with `customerId` from the POS customer (if assigned) and `quantity = 1`.
2. Quantity adjustments re-trigger resolution for quantity-break support.
3. P2 multi-buy and promotional deals will hook into the resolution chain after level 5, before rebates.

**Purchasing context:**

Purchase Orders do **not** use the sales price resolution engine. Vendor pricing is managed via Supplier Price Lists (a separate concern in the Purchasing module, mapping from legacy VEVc purchase price fields). However, `VENDOR_PURCHASE_PRICE` (level 4) in the sales resolution chain uses `InventoryItem.lastPurchasePrice` as a fallback for items without explicit sales pricing.

**Audit fields on transaction lines:**

| Field | Type | Purpose |
|---|---|---|
| `priceSource` | `PriceSource` enum | Which level resolved the price |
| `priceListEntryId` | `String?` FK | The specific entry used |
| `priceLockedAt` | `DateTime?` | When the price was confirmed/locked |

---

#### Build Sequence & Dependencies

**Story 9+: Pricing Module**

| Dependency | Direction | Detail |
|---|---|---|
| Inventory (`InventoryItem`) | Pricing depends on | Item base prices (`costPrice`, `salesPrice`, `lastPurchasePrice`), item group codes |
| Currency (reference data) | Pricing depends on | `currencyCode` on `PriceList` |
| Customer (CRM/Sales) | Pricing depends on | `customerId` on `PriceListEntry` and `Rebate` for customer-specific pricing |
| Sales Orders | Consumes Pricing | Calls `resolvePrice` on line-item entry |
| Sales Quotes | Consumes Pricing | Calls `resolvePrice` for quote line pricing |
| Customer Invoices (AR) | Consumes Pricing | Inherits from Sales Order or calls `resolvePrice` for standalone invoices |
| POS Transactions | Consumes Pricing | Calls `resolvePrice` at register |

**Implementation order:**

1. **Schema migration** — Create `PriceList`, `PriceListEntry`, `QuantityBreak`, `Rebate`, `RebateTier` tables.
2. **Seed data** — Default price list (isDefault = true) seeded per tenant during onboarding.
3. **Price resolution service** — `PricingService.resolvePrice()` with full hierarchy, formula engine, and rebate post-processing.
4. **CRUD APIs** — Price list management endpoints (admin/manager role).
5. **Sales Order integration** — Wire `resolvePrice` into Sales Order line creation/update.
6. **Invoice integration** — Wire into standalone invoice line entry.
7. **POS integration** — Wire into POS item scan/add.
8. **P2 extensions** — Multi-buy deals (`MultiBuyRebVc`), promotions (`PromotionVc`), time-of-day pricing.

---

*End of section 2.19*

### 2.20 Cross-Cutting Data Infrastructure -- Attachments, Notes, Links & Approvals

Every ERP module needs a common set of supporting capabilities: attaching files to records, adding notes and comments, linking related documents across modules, tracking activities, and enforcing configurable approval workflows. Rather than each module implementing its own version of these features, Nexa provides a shared cross-cutting data infrastructure layer that any entity in the system can use.

These models are module-agnostic. An `Attachment` row can belong to a customer invoice, a purchase order, a fixed asset, or an employee record -- the same table, the same API surface, the same storage pipeline. This eliminates duplication, ensures consistency, and allows features like "show all attachments for this record" to work identically everywhere.

---

#### Polymorphic Linking Pattern

All cross-cutting entities use a **polymorphic linking pattern** based on two columns: `entityType` (a string identifying the Prisma model name, e.g. `"CustomerInvoice"`, `"SalesOrder"`, `"Employee"`) and `entityId` (the UUID of the target record).

**Why this approach instead of separate junction tables?**

With 10 MVP modules and dozens of entity types, creating a dedicated junction table for every combination (e.g. `customer_invoice_attachments`, `sales_order_attachments`, `purchase_order_attachments`, etc.) would produce an unmanageable proliferation of tables -- easily 50+ junction tables for attachments alone, multiplied again for notes, record links, and approval requests. The polymorphic pattern keeps the schema flat: one `attachments` table serves the entire system.

The trade-off is the loss of database-level foreign key enforcement on `entityId`. Nexa compensates for this through:

1. **Application-layer validation** -- the service layer validates that the referenced entity exists before creating the cross-cutting record.
2. **Composite index on `[entityType, entityId]`** -- efficient lookups for "all attachments for this invoice" queries.
3. **Enum-like constraint on `entityType`** -- the application maintains a registry of valid entity type strings, preventing typos and invalid references.
4. **Cascade-aware deletion** -- when an entity is deleted (soft or hard), its cross-cutting records are cleaned up via the event bus (see Build Sequence below).

This is a well-established pattern used by major ERP platforms and is the pragmatic choice for a system where any record type can participate in attachments, notes, links, and approvals.

---

#### Legacy-to-Nexa Entity Mapping

| Legacy Register | Legacy Key | Fields | Nexa Model | Notes |
|---|---|---|---|---|
| Attach2Vc | -- | SerNr, FileName, FileSize, Type, Storage, ContentId | `Attachment` | Polymorphic via entityType + entityId |
| NotepadVc | -- | SerNr, FromRecidStr, Classification, NoteType, Math | `Note` | Rich text content; polymorphic link |
| RLinkVc | -- | FromRecidStr, ToRecidStr, Comment, LinkType | `RecordLink` | Bidirectional cross-module navigation |
| AcceptanceRulesVc | -- | Register, Type, OKApproved + matrix rows | `ApprovalRule` + `ApprovalRuleLevel` | Configurable multi-level approval matrix |
| -- (new) | -- | -- | `ApprovalRequest` | Transactional approval instance (no direct legacy equivalent) |
| ActVc | -- | 80+ fields | `Activity` | Cross-cutting CRM/calendar entity; P1 full build, MVP stub here |

---

#### Prisma Schema

```prisma
// ─────────────────────────────────────────────
// Cross-Cutting Module — Enums
// ─────────────────────────────────────────────

enum NoteType {
  GENERAL
  INTERNAL
  CUSTOMER_VISIBLE
  SYSTEM

  @@map("note_type")
}

enum RecordLinkType {
  CREATED_FROM
  FULFILLS
  PAYMENT_FOR
  CREDIT_FOR
  RELATES_TO
  PARENT_CHILD

  @@map("record_link_type")
}

enum ApprovalScopeType {
  PER_RECORD
  PER_LINE

  @@map("approval_scope_type")
}

enum ApproverType {
  SPECIFIC_USER
  ROLE
  DEPARTMENT_MANAGER
  CUSTOM

  @@map("approver_type")
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
  ESCALATED
  FORWARDED

  @@map("approval_status")
}

enum ActivityType {
  MEETING
  CALL
  EMAIL
  TODO
  NOTE
  FOLLOW_UP

  @@map("activity_type")
}

enum ActivityStatus {
  PLANNED
  IN_PROGRESS
  COMPLETED
  CANCELLED

  @@map("activity_status")
}

enum ActivityPriority {
  LOW
  NORMAL
  HIGH
  URGENT

  @@map("activity_priority")
}

// ─────────────────────────────────────────────
// Attachment — File Attachments (Polymorphic)
// ─────────────────────────────────────────────

model Attachment {
  id            String   @id @default(uuid())

  // ── Polymorphic Link ──
  entityType    String   @map("entity_type") @db.VarChar(100)
  entityId      String   @map("entity_id")

  // ── File Metadata ──
  fileName      String   @map("file_name") @db.VarChar(200)
  fileSize      Int      @map("file_size")
  mimeType      String   @map("mime_type") @db.VarChar(100)

  // ── Storage Location ──
  storageKey    String   @map("storage_key") @db.VarChar(500)
  storageBucket String   @map("storage_bucket") @db.VarChar(100)

  // ── Optional Description ──
  description   String?  @db.VarChar(500)

  // ── Upload Tracking ──
  uploadedBy    String   @map("uploaded_by")
  uploadedAt    DateTime @default(now()) @map("uploaded_at")

  // ── Standard Fields ──
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@map("attachments")
  @@index([entityType, entityId], map: "idx_attachments_entity")
  @@index([uploadedBy], map: "idx_attachments_uploaded_by")
}

// ─────────────────────────────────────────────
// Note — Polymorphic Notes & Comments
// ─────────────────────────────────────────────

model Note {
  id             String   @id @default(uuid())

  // ── Polymorphic Link ──
  entityType     String   @map("entity_type") @db.VarChar(100)
  entityId       String   @map("entity_id")

  // ── Content ──
  noteType       NoteType @default(GENERAL) @map("note_type")
  classification String?  @db.VarChar(60)
  title          String?  @db.VarChar(200)
  content        String   @db.Text

  // ── Flags ──
  isPinned       Boolean  @default(false) @map("is_pinned")

  // ── Standard Fields ──
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")
  createdBy      String   @map("created_by")
  updatedBy      String   @map("updated_by")

  @@map("notes")
  @@index([entityType, entityId], map: "idx_notes_entity")
  @@index([noteType], map: "idx_notes_note_type")
  @@index([isPinned], map: "idx_notes_is_pinned")
}

// ─────────────────────────────────────────────
// RecordLink — Cross-Module Document Navigation
// ─────────────────────────────────────────────

model RecordLink {
  id               String         @id @default(uuid())

  // ── Source (from) ──
  sourceEntityType String         @map("source_entity_type") @db.VarChar(100)
  sourceEntityId   String         @map("source_entity_id")

  // ── Target (to) ──
  targetEntityType String         @map("target_entity_type") @db.VarChar(100)
  targetEntityId   String         @map("target_entity_id")

  // ── Link Classification ──
  linkType         RecordLinkType @map("link_type")
  description      String?        @db.VarChar(500)

  // ── Standard Fields ──
  createdAt        DateTime       @default(now()) @map("created_at")
  createdBy        String         @map("created_by")

  @@map("record_links")
  @@index([sourceEntityType, sourceEntityId], map: "idx_record_links_source")
  @@index([targetEntityType, targetEntityId], map: "idx_record_links_target")
  @@index([linkType], map: "idx_record_links_link_type")
}

// ─────────────────────────────────────────────
// ApprovalRule — Configurable Approval Workflow Definition
// ─────────────────────────────────────────────

model ApprovalRule {
  id                     String            @id @default(uuid())

  // ── Scope ──
  entityType             String            @map("entity_type") @db.VarChar(100)
  name                   String            @db.VarChar(200)
  description            String?           @db.Text

  // ── Behaviour ──
  scopeType              ApprovalScopeType @map("scope_type")
  requireOkAfterApproval Boolean           @default(false) @map("require_ok_after_approval")

  // ── Standard Fields ──
  isActive               Boolean           @default(true) @map("is_active")
  createdAt              DateTime          @default(now()) @map("created_at")
  updatedAt              DateTime          @updatedAt @map("updated_at")
  createdBy              String            @map("created_by")
  updatedBy              String            @map("updated_by")

  // ── Relations ──
  levels                 ApprovalRuleLevel[]
  requests               ApprovalRequest[]

  @@map("approval_rules")
  @@index([entityType], map: "idx_approval_rules_entity_type")
  @@index([isActive], map: "idx_approval_rules_is_active")
}

// ─────────────────────────────────────────────
// ApprovalRuleLevel — Escalation Steps Within a Rule
// ─────────────────────────────────────────────

model ApprovalRuleLevel {
  id               String       @id @default(uuid())

  // ── Parent Rule ──
  approvalRuleId   String       @map("approval_rule_id")
  approvalRule     ApprovalRule @relation(fields: [approvalRuleId], references: [id], onDelete: Cascade)

  // ── Level Ordering ──
  levelOrder       Int          @map("level_order")

  // ── Threshold ──
  amountThreshold  Decimal?     @map("amount_threshold") @db.Decimal(19, 4)

  // ── Approver Configuration ──
  approverType     ApproverType @map("approver_type")
  approverId       String?      @map("approver_id")
  approverRole     String?      @map("approver_role") @db.VarChar(100)

  // ── Escalation ──
  timeoutHours     Int?         @map("timeout_hours")
  autoEscalate     Boolean      @default(false) @map("auto_escalate")

  // ── Standard Fields ──
  createdAt        DateTime     @default(now()) @map("created_at")
  updatedAt        DateTime     @updatedAt @map("updated_at")

  // ── Relations ──
  requests         ApprovalRequest[]

  @@map("approval_rule_levels")
  @@index([approvalRuleId, levelOrder], map: "idx_approval_rule_levels_rule_order")
}

// ─────────────────────────────────────────────
// ApprovalRequest — Transactional Approval Instance
// ─────────────────────────────────────────────

model ApprovalRequest {
  id                   String             @id @default(uuid())

  // ── Rule Reference ──
  approvalRuleId       String             @map("approval_rule_id")
  approvalRule         ApprovalRule       @relation(fields: [approvalRuleId], references: [id])
  approvalRuleLevelId  String             @map("approval_rule_level_id")
  approvalRuleLevel    ApprovalRuleLevel  @relation(fields: [approvalRuleLevelId], references: [id])

  // ── Target Entity (polymorphic) ──
  entityType           String             @map("entity_type") @db.VarChar(100)
  entityId             String             @map("entity_id")

  // ── Requester ──
  requestedById        String             @map("requested_by_id")
  requestedAt          DateTime           @default(now()) @map("requested_at")

  // ── Current Assignment ──
  currentAssigneeId    String             @map("current_assignee_id")

  // ── Status ──
  status               ApprovalStatus     @default(PENDING)

  // ── Decision ──
  decidedAt            DateTime?          @map("decided_at")
  decidedById          String?            @map("decided_by_id")
  rejectionReason      String?            @map("rejection_reason") @db.Text
  notes                String?            @db.Text

  // ── Standard Fields ──
  createdAt            DateTime           @default(now()) @map("created_at")
  updatedAt            DateTime           @updatedAt @map("updated_at")

  @@map("approval_requests")
  @@index([entityType, entityId], map: "idx_approval_requests_entity")
  @@index([currentAssigneeId, status], map: "idx_approval_requests_assignee_status")
  @@index([approvalRuleId], map: "idx_approval_requests_rule_id")
  @@index([approvalRuleLevelId], map: "idx_approval_requests_level_id")
  @@index([status], map: "idx_approval_requests_status")
  @@index([requestedById], map: "idx_approval_requests_requested_by")
}

// ─────────────────────────────────────────────
// Activity — Cross-Cutting CRM / Calendar Entity
// ─────────────────────────────────────────────

model Activity {
  id              String          @id @default(uuid())

  // ── Classification ──
  activityType    ActivityType    @map("activity_type")
  subject         String          @db.VarChar(300)
  description     String?         @db.Text

  // ── Scheduling ──
  startDate       DateTime        @map("start_date")
  endDate         DateTime?       @map("end_date")
  startTime       String?         @map("start_time") @db.VarChar(5)
  endTime         String?         @map("end_time") @db.VarChar(5)
  allDay          Boolean         @default(false) @map("all_day")

  // ── Status & Priority ──
  status          ActivityStatus  @default(PLANNED)
  priority        ActivityPriority @default(NORMAL)

  // ── Polymorphic Link (optional — ties activity to any record) ──
  entityType      String?         @map("entity_type") @db.VarChar(100)
  entityId        String?         @map("entity_id")

  // ── Contact Info ──
  customerId      String?         @map("customer_id")
  contactName     String?         @map("contact_name") @db.VarChar(200)
  contactPhone    String?         @map("contact_phone") @db.VarChar(30)
  contactEmail    String?         @map("contact_email") @db.VarChar(200)

  // ── Assignment ──
  assignedToId    String          @map("assigned_to_id")

  // ── Recurring ──
  isRecurring     Boolean         @default(false) @map("is_recurring")
  recurrenceRule  String?         @map("recurrence_rule") @db.VarChar(500)
  parentActivityId String?        @map("parent_activity_id")
  parentActivity  Activity?       @relation("ActivityRecurrence", fields: [parentActivityId], references: [id])
  childActivities Activity[]      @relation("ActivityRecurrence")

  // ── External Calendar Sync ──
  externalId      String?         @map("external_id") @db.VarChar(500)
  externalSource  String?         @map("external_source") @db.VarChar(50)

  // ── Privacy ──
  isPrivate       Boolean         @default(false) @map("is_private")

  // ── Standard Fields ──
  createdAt       DateTime        @default(now()) @map("created_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")
  createdBy       String          @map("created_by")
  updatedBy       String          @map("updated_by")

  @@map("activities")
  @@index([activityType], map: "idx_activities_activity_type")
  @@index([status], map: "idx_activities_status")
  @@index([startDate], map: "idx_activities_start_date")
  @@index([assignedToId], map: "idx_activities_assigned_to_id")
  @@index([entityType, entityId], map: "idx_activities_entity")
  @@index([customerId], map: "idx_activities_customer_id")
  @@index([parentActivityId], map: "idx_activities_parent_activity_id")
  @@index([externalId, externalSource], map: "idx_activities_external")
}
```

---

#### Attachment Upload & Download Flow

File attachments use an object storage backend (S3 or MinIO for self-hosted deployments). The API never streams file content through the application server for uploads or downloads -- it uses **pre-signed URLs** to let the browser interact directly with object storage.

**Upload flow:**

```
1. Client → POST /api/attachments/presign
   Body: { entityType, entityId, fileName, mimeType, fileSize }
   ├─ Validate: entityType is a known entity, entityId exists
   ├─ Validate: file size within configured max (default 50 MB)
   ├─ Validate: mimeType is in allowlist (no executables)
   ├─ Generate storageKey: "{tenantId}/{entityType}/{entityId}/{uuid}-{fileName}"
   └─ Return: { uploadUrl (pre-signed PUT), storageKey, expiresIn }

2. Client → PUT uploadUrl (direct to S3/MinIO)
   ├─ Browser uploads file bytes directly
   └─ S3 validates Content-Type and Content-Length against pre-signed params

3. Client → POST /api/attachments/confirm
   Body: { storageKey, entityType, entityId, fileName, fileSize, mimeType }
   ├─ Verify object exists in storage
   ├─ Create Attachment row in database
   └─ Return: { id, fileName, fileSize, mimeType, uploadedAt }
```

**Download flow:**

```
1. Client → GET /api/attachments/{id}/download
   ├─ Look up Attachment row
   ├─ Verify caller has read access to the parent entity
   ├─ Generate pre-signed GET URL (60-minute expiry)
   └─ Return: { downloadUrl, fileName, mimeType }

2. Client → GET downloadUrl (direct from S3/MinIO)
   └─ Browser streams file directly from object storage
```

**Deletion:** Deleting an `Attachment` row marks the storage object for asynchronous cleanup. A background job periodically sweeps orphaned objects from the bucket. This avoids blocking the delete API call on S3 operations and handles transient storage failures gracefully.

**Virus scanning (P1):** For production deployments, a post-upload Lambda/webhook triggers ClamAV or equivalent scanning. The `Attachment` row carries a `scanStatus` metadata field (added in P1) that blocks download until scanning completes.

---

#### Approval Workflow Engine

The approval system is rule-driven: administrators configure `ApprovalRule` records that define which entity types require approval, how many levels of approval exist, and what conditions trigger each level. At runtime, the engine evaluates these rules and creates transactional `ApprovalRequest` records.

**Rule evaluation flow:**

```
1. Entity submitted for approval (e.g., Purchase Order total > 0)
   ├─ Query: SELECT active ApprovalRules WHERE entityType = "PurchaseOrder"
   ├─ If no rules found → entity proceeds without approval
   └─ If rule found → determine starting level

2. Determine starting level
   ├─ Load ApprovalRuleLevels ORDER BY levelOrder ASC
   ├─ If rule has amountThreshold levels:
   │   └─ Find first level WHERE amountThreshold <= entity amount
   ├─ If no threshold match → start at levelOrder = 1
   └─ Resolve approver:
       ├─ SPECIFIC_USER → use approverId directly
       ├─ ROLE → look up users with matching role, assign to first available
       ├─ DEPARTMENT_MANAGER → resolve from entity's department hierarchy
       └─ CUSTOM → invoke registered callback (extensibility hook)

3. Create ApprovalRequest
   ├─ status = PENDING
   ├─ currentAssigneeId = resolved approver
   ├─ Emit event: "approval.requested" via event bus
   └─ Notify assignee (email / in-app notification)
```

**Decision handling:**

```
Approver decides → PATCH /api/approval-requests/{id}

  APPROVED:
   ├─ Check: are there higher levels remaining?
   │   YES → escalate to next level:
   │   │   ├─ Create new ApprovalRequest at next levelOrder
   │   │   ├─ Mark current request status = APPROVED
   │   │   └─ Emit: "approval.escalated"
   │   NO → approval complete:
   │       ├─ Mark request status = APPROVED
   │       ├─ If requireOkAfterApproval → mark entity as approved
   │       └─ Emit: "approval.completed"

  REJECTED:
   ├─ Mark request status = REJECTED
   ├─ Store rejectionReason
   ├─ Emit: "approval.rejected"
   └─ Notify original requester

  FORWARDED:
   ├─ Mark request status = FORWARDED
   ├─ Create new ApprovalRequest at same level with new assignee
   └─ Emit: "approval.forwarded"

  CANCELLED:
   ├─ Only the original requester can cancel
   ├─ Mark status = CANCELLED
   └─ Emit: "approval.cancelled"
```

**Auto-escalation:** When `autoEscalate = true` and `timeoutHours` is set on a level, a scheduled job checks for stale pending requests. If a request has been pending longer than `timeoutHours`, the engine automatically escalates to the next level (or marks as timed-out if no further levels exist). The event `"approval.auto_escalated"` is emitted.

**Activity integration:** Each approval state change (requested, approved, rejected, forwarded, cancelled) creates an `Activity` record linked to the entity under review. This provides a full audit trail visible in the entity's activity timeline.

---

#### Record Link Creation

Record links provide bidirectional cross-module navigation. When a user views a Sales Order, they can see all related documents -- the Customer Invoice created from it, the Shipment that fulfilled it, the Payment that settled the invoice.

**Automatic link creation:**

When a document is created from another document (the most common pattern in ERP), the service layer automatically creates a `RecordLink` row:

| Action | Source | Target | LinkType |
|---|---|---|---|
| Invoice created from Sales Order | SalesOrder | CustomerInvoice | `CREATED_FROM` |
| Shipment created from Sales Order | SalesOrder | Shipment | `FULFILLS` |
| Payment applied to Invoice | Payment | CustomerInvoice | `PAYMENT_FOR` |
| Credit Note against Invoice | CreditNote | CustomerInvoice | `CREDIT_FOR` |
| GRN created from Purchase Order | PurchaseOrder | GoodsReceiptNote | `CREATED_FROM` |
| Supplier Payment for Bill | SupplierPayment | SupplierInvoice | `PAYMENT_FOR` |
| Return created from Invoice | CustomerInvoice | ReturnOrder | `RELATES_TO` |
| Sub-assembly linked to parent | ParentBOM | ChildBOM | `PARENT_CHILD` |

**Manual link creation:** Users can also manually create `RELATES_TO` links between any two records for ad-hoc cross-referencing (e.g., linking a customer complaint note to a specific batch of inventory items).

**Bidirectional querying:** The API provides a single endpoint that queries both directions:

```
GET /api/record-links?entityType=SalesOrder&entityId={id}
```

This returns links where the Sales Order appears as either `sourceEntityType/sourceEntityId` OR `targetEntityType/targetEntityId`, giving a complete picture of all related documents regardless of which side created the link.

**Link integrity:** When a record is soft-deleted, its record links remain visible (with a visual indicator that the target is archived). When a record is hard-deleted (rare in ERP), its record links are cascade-deleted via the event bus cleanup handler.

---

#### Build Sequence

The cross-cutting infrastructure is part of **Tier 0 (Foundation)** and must be available before any business module creates records that need attachments, notes, links, or approvals.

| Story | Scope | Dependencies |
|---|---|---|
| 1.1 | `Attachment` model + S3/MinIO presign upload/download API | Tier 0 storage config (Story 1 seed) |
| 1.2 | `Note` model + CRUD API (create, list, update, delete, pin/unpin) | Tier 0 complete |
| 1.3 | `RecordLink` model + CRUD API + bidirectional query endpoint | Tier 0 complete |
| 1.4 | `ApprovalRule` + `ApprovalRuleLevel` admin CRUD + seed data | Tier 0 complete |
| 1.5 | `ApprovalRequest` workflow engine (submit, approve, reject, forward, cancel) | 1.4, Event bus (Story 3) |
| 1.6 | Approval auto-escalation scheduled job | 1.5 |
| 1.7 | `Activity` model + CRUD API (MVP stub -- full CRM build in Phase 2) | Tier 0 complete |
| 1.8 | Activity integration with approval events (auto-create activity on state change) | 1.5, 1.7 |

**Integration with Story 1 (Seed) and Story 3 (Event Bus):**

- **Story 1 (Tenant seed):** When a new tenant database is provisioned, the seed process creates default `ApprovalRule` records for common entity types (Purchase Orders over a configurable threshold, Supplier Payments, etc.) with sensible defaults that the tenant administrator can customise.
- **Story 3 (Event bus):** The event bus is the backbone for approval workflow side-effects. Approval state-change events (`approval.requested`, `approval.completed`, `approval.rejected`, etc.) are published to the bus, allowing any module to react -- for example, the Purchasing module listens for `approval.completed` on Purchase Orders to automatically transition the PO status from `PENDING_APPROVAL` to `APPROVED`. Entity deletion events trigger cascade cleanup of attachments (storage object cleanup), notes, record links, and pending approval requests.

**Cross-module integration points:**

- **All modules:** Attachments, notes, and record links are available to every entity via the polymorphic pattern. No module-specific schema changes are needed to enable these features on a new entity type.
- **Finance (section 2.10):** Journal entries can have attachments (receipts, invoices) and notes (auditor comments).
- **Sales (section 2.12) / Purchasing (section 2.13):** Automatic record link creation when downstream documents (invoices, GRNs, shipments) are generated from orders.
- **HR/Payroll:** Approval workflows for expense claims, leave requests, and payroll runs.
- **Manufacturing:** Approval workflows for production orders above cost thresholds; attachments for quality inspection photos and certificates.

---

*End of section 2.20*

### 2.21 CRM Module --- Leads, Campaigns, Opportunities & Pipeline

The CRM Module manages the full pre-sales lifecycle: capturing and qualifying leads, running marketing campaigns, tracking sales opportunities through configurable pipeline stages, and logging all customer-facing activities. It bridges the gap between marketing (lead generation, campaigns) and transactional sales (quotations, orders) by providing visibility into the sales funnel before a deal converts into a formal sales document.

In the legacy HansaWorld system, CRM spans several registers with a notably different architectural approach. Leads are not a separate register --- they are Contact records (CUVc) where `CUType = 0` and `LeadType != 0`, viewed through a specialised Lead window. "Conversion" simply flips a flag on the same record. Opportunities (OYVc) are full quotation-like documents with line items, pricing, tax calculations, and approval workflows --- essentially quotations with CRM metadata. Activities (ActVc) are a cross-cutting entity shared by CRM, calendar, and project management.

Nexa takes a cleaner architectural approach: **Leads** are a dedicated entity with their own table and lifecycle, separate from Customers. **Opportunities** are lightweight pipeline-tracking entities that *link to* Sales Quotes (from section 2.16) rather than duplicating the quotation data model. **Activities** use the cross-cutting `Activity` model from section 2.20 --- the CRM module extends it with CRM-specific lookup tables (Activity Types for CRM, auto-creation rules) but does not create a separate activity table. **Pipeline Views** are configurable Kanban boards stored as JSON configuration, supporting both system-level defaults and per-user overrides.

---

#### Legacy-to-Nexa Mapping

| Legacy Entity | HAL Source | Fields | Nexa Model | Notes |
|---|---|---|---|---|
| CUVc (CUType=0, LeadType!=0) | CULeadVcWAction.hal, LeadTools.hal | ~55 header | **CrmLead** | Separate entity in Nexa (not a Customer flag). Conversion creates a Customer record + back-reference. |
| CampaignVc | CampaignVcRAction.hal, CampaignVcWAction.hal | ~6 header + matrix rows | **CrmCampaign** + **CrmCampaignRecipient** | Header/detail pattern. Recipients reference either Lead or Customer. |
| OYVc | OYVcWAction.hal, OYVcRAction.hal, OYDsm.hal | 178 header + 66 row | **CrmOpportunity** | Lightweight entity. Line-item detail lives on linked SalesQuote (section 2.16). |
| ActVc | CRMTools.hal, PipelineOverviewWAction.hal | 80+ | **Activity** (section 2.20) | Cross-cutting entity; CRM adds lookup tables and auto-creation rules. |
| PipelinOverviewBlock | PipelineOverviewWAction.hal | ~7 per row | **CrmPipelineView** + **CrmPipelineColumn** | System + per-user configurable Kanban board. |
| UserPipelinOverviewVc | PipelineOverviewWAction.hal | ~4 header + rows | **CrmPipelineView** (with `userId`) | Per-user overrides stored as separate view records. |
| LeadStatusVc | Lookup register | Code + Comment | **CrmLeadStatus** | Configurable lead lifecycle stages. |
| LeadSourceVc | Lookup register | Code + Comment | **CrmLeadSource** | Lead origin tracking. |
| IndustryVc | Lookup register | Code + Comment | **CrmIndustry** | Industry/sector classification. |
| CampaignStatusVc / kCampaignStatus | Enum + lookup | 3 values | `CrmCampaignStatus` enum | Mapped to DRAFT/ACTIVE/COMPLETED/CANCELLED. |
| MediaTypeVc | Lookup register | Code + Comment | **CrmMediaType** | Campaign channel classification. |
| ActTypeVc | Lookup register | Code + settings | **CrmActivityType** | CRM-specific activity type configuration. |
| ActTypeGrVc | Lookup register | Code + defaults | **CrmActivityTypeGroup** | Grouping of activity types. |
| kLeadRating | Enum | Cold/Warm/Hot | `CrmLeadRating` enum | Extended with NONE for unqualified leads. |
| kAcceptanceState | Enum | 6 values | Uses cross-cutting `ApprovalStatus` (section 2.20) | Opportunity approval via shared approval engine. |
| OYClassSClass | Lookup | Code | **CrmOpportunityClass** | Opportunity categorisation. |
| UserASTVc | Per-user setting | 30+ event types | **CrmActivityAutoRule** | Simplified event-driven auto-creation (MVP: key events only). |
| ContactRelVc | Lookup register | From/To/Type | Deferred to P1 | Contact-to-company relationship links. |

---

#### Prisma Schema

```prisma
// =====================================================
// CRM MODULE -- Leads, Campaigns, Opportunities & Pipeline
// =====================================================

// -------------------------------------------------
// Enums
// -------------------------------------------------

enum CrmLeadRating {
  NONE
  COLD
  WARM
  HOT

  @@map("crm_lead_rating")
}

enum CrmLeadLifecycle {
  NEW
  CONTACTED
  QUALIFIED
  UNQUALIFIED
  CONVERTED
  LOST

  @@map("crm_lead_lifecycle")
}

enum CrmCampaignStatus {
  DRAFT
  ACTIVE
  COMPLETED
  CANCELLED

  @@map("crm_campaign_status")
}

enum CrmCampaignRecipientType {
  LEAD
  CUSTOMER

  @@map("crm_campaign_recipient_type")
}

enum CrmOpportunityStatus {
  OPEN
  WON
  LOST
  CANCELLED

  @@map("crm_opportunity_status")
}

enum CrmPipelineEntityType {
  LEAD
  OPPORTUNITY
  ACTIVITY
  SALES_QUOTE
  SALES_ORDER

  @@map("crm_pipeline_entity_type")
}

enum CrmActivityAutoTrigger {
  SALES_ORDER_CREATED
  SALES_ORDER_APPROVED
  INVOICE_POSTED
  PAYMENT_RECEIVED
  OPPORTUNITY_WON
  OPPORTUNITY_LOST
  LEAD_CONVERTED
  EMAIL_SENT
  EMAIL_RECEIVED

  @@map("crm_activity_auto_trigger")
}

// -------------------------------------------------
// Lead Status (Reference -- configurable stages)
// -------------------------------------------------

model CrmLeadStatus {
  id          String    @id @default(uuid())
  code        String    @unique @db.VarChar(20)     // e.g., "NEW", "CONTACTED", "QUALIFIED"
  name        String    @db.VarChar(100)             // Display name
  description String?   @db.VarChar(500)             // Guidance text for users
  sortOrder   Int       @map("sort_order")           // Display ordering
  colour      String?   @db.VarChar(7)               // Hex colour for UI badges, e.g., "#FF6B00"
  isDefault   Boolean   @default(false) @map("is_default")  // Assigned to new leads automatically
  isClosedWon Boolean   @default(false) @map("is_closed_won")  // Marks lead as converted
  isClosedLost Boolean  @default(false) @map("is_closed_lost") // Marks lead as lost/dead

  isActive    Boolean   @default(true) @map("is_active")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  // Relations
  leads       CrmLead[]

  @@map("crm_lead_statuses")
  @@index([isActive, sortOrder], map: "idx_crm_lead_statuses_active_sort")
}

// -------------------------------------------------
// Lead Source (Reference -- where leads come from)
// -------------------------------------------------

model CrmLeadSource {
  id          String    @id @default(uuid())
  code        String    @unique @db.VarChar(20)     // e.g., "WEBSITE", "REFERRAL", "TRADE_SHOW"
  name        String    @db.VarChar(100)
  description String?   @db.VarChar(500)

  isActive    Boolean   @default(true) @map("is_active")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  // Relations
  leads       CrmLead[]

  @@map("crm_lead_sources")
  @@index([isActive], map: "idx_crm_lead_sources_active")
}

// -------------------------------------------------
// Industry (Reference -- sector classification)
// -------------------------------------------------

model CrmIndustry {
  id          String    @id @default(uuid())
  code        String    @unique @db.VarChar(20)     // e.g., "RETAIL", "MFGR", "FINSERV"
  name        String    @db.VarChar(100)
  description String?   @db.VarChar(500)

  isActive    Boolean   @default(true) @map("is_active")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  // Relations
  leads       CrmLead[]

  @@map("crm_industries")
  @@index([isActive], map: "idx_crm_industries_active")
}

// -------------------------------------------------
// Media Type (Reference -- campaign channels)
// -------------------------------------------------

model CrmMediaType {
  id          String    @id @default(uuid())
  code        String    @unique @db.VarChar(20)     // e.g., "EMAIL", "SOCIAL", "PRINT", "WEBINAR"
  name        String    @db.VarChar(100)
  description String?   @db.VarChar(500)

  isActive    Boolean   @default(true) @map("is_active")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  // Relations
  campaigns   CrmCampaign[]

  @@map("crm_media_types")
  @@index([isActive], map: "idx_crm_media_types_active")
}

// -------------------------------------------------
// Opportunity Class (Reference -- opportunity categorisation)
// -------------------------------------------------

model CrmOpportunityClass {
  id          String    @id @default(uuid())
  code        String    @unique @db.VarChar(20)     // e.g., "NEW_BIZ", "UPSELL", "RENEWAL"
  name        String    @db.VarChar(100)
  description String?   @db.VarChar(500)

  isActive    Boolean   @default(true) @map("is_active")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  // Relations
  opportunities CrmOpportunity[]

  @@map("crm_opportunity_classes")
  @@index([isActive], map: "idx_crm_opportunity_classes_active")
}

// -------------------------------------------------
// CRM Activity Type (Reference -- CRM-specific activity classification)
// -------------------------------------------------

model CrmActivityType {
  id              String    @id @default(uuid())
  code            String    @unique @db.VarChar(20)   // e.g., "CALL_OUT", "DEMO", "SITE_VISIT"
  name            String    @db.VarChar(100)
  description     String?   @db.VarChar(500)
  groupId         String?   @map("group_id")          // FK to CrmActivityTypeGroup
  defaultDuration Int?      @map("default_duration")   // Default duration in minutes
  isCalendarTime  Boolean   @default(false) @map("is_calendar_time") // Blocks calendar time?

  isActive        Boolean   @default(true) @map("is_active")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  // Relations
  group           CrmActivityTypeGroup? @relation(fields: [groupId], references: [id])
  autoRules       CrmActivityAutoRule[]

  @@map("crm_activity_types")
  @@index([isActive], map: "idx_crm_activity_types_active")
  @@index([groupId], map: "idx_crm_activity_types_group")
}

// -------------------------------------------------
// CRM Activity Type Group (Reference -- grouping of activity types)
// -------------------------------------------------

model CrmActivityTypeGroup {
  id          String    @id @default(uuid())
  code        String    @unique @db.VarChar(20)     // e.g., "PHONE", "MEETING", "ADMIN"
  name        String    @db.VarChar(100)
  description String?   @db.VarChar(500)

  isActive    Boolean   @default(true) @map("is_active")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  // Relations
  activityTypes CrmActivityType[]

  @@map("crm_activity_type_groups")
  @@index([isActive], map: "idx_crm_activity_type_groups_active")
}

// -------------------------------------------------
// Lead (Transactional -- full lifecycle entity)
// -------------------------------------------------

model CrmLead {
  id                    String           @id @default(uuid())
  leadNumber            String           @unique @map("lead_number")            // Auto via NumberSeries "LD-000001"

  // -- Company / Person Info --
  companyName           String?          @map("company_name") @db.VarChar(200)  // Organisation name (nullable for individual leads)
  contactFirstName      String           @map("contact_first_name") @db.VarChar(100)
  contactLastName       String           @map("contact_last_name") @db.VarChar(100)
  jobTitle              String?          @map("job_title") @db.VarChar(100)

  // -- Contact Details --
  email                 String?          @db.VarChar(255)
  phone                 String?          @db.VarChar(30)
  mobile                String?          @db.VarChar(30)
  website               String?          @db.VarChar(255)

  // -- Address --
  addressLine1          String?          @map("address_line_1")
  addressLine2          String?          @map("address_line_2")
  city                  String?
  county                String?
  postcode              String?          @db.VarChar(15)
  countryCode           String           @default("GB") @map("country_code") @db.VarChar(3)

  // -- Classification & Qualification --
  statusId              String?          @map("status_id")                      // FK to CrmLeadStatus
  lifecycle             CrmLeadLifecycle @default(NEW)                         // Hard lifecycle stage
  sourceId              String?          @map("source_id")                      // FK to CrmLeadSource
  industryId            String?          @map("industry_id")                    // FK to CrmIndustry
  rating                CrmLeadRating    @default(NONE)                        // Cold/Warm/Hot qualification
  itemInterest          String?          @map("item_interest") @db.VarChar(200) // Product/service interest (free text or item classification)

  // -- Assignment --
  salesPersonId         String?          @map("sales_person_id")                // FK to User
  referralPartnerId     String?          @map("referral_partner_id")            // FK to Customer (referring partner)

  // -- Financial Defaults (applied on conversion) --
  currencyCode          String           @default("GBP") @map("currency_code") @db.VarChar(3)
  estimatedValue        Decimal?         @map("estimated_value") @db.Decimal(19, 4) // Estimated deal value

  // -- Conversion Tracking --
  convertedCustomerId   String?          @unique @map("converted_customer_id")  // FK to Customer (set on conversion)
  convertedAt           DateTime?        @map("converted_at")                   // Timestamp of conversion
  convertedBy           String?          @map("converted_by")                   // User who converted

  // -- Notes --
  description           String?          @db.Text                               // Main description / notes
  warningText           String?          @map("warning_text") @db.VarChar(500)  // Warning displayed on access

  // -- Tags / Custom --
  tags                  String?          @db.VarChar(500)                        // Comma-separated tags
  customFields          Json?            @map("custom_fields")                   // User-defined field values

  // -- Standard Fields --
  isActive              Boolean          @default(true) @map("is_active")
  createdAt             DateTime         @default(now()) @map("created_at")
  updatedAt             DateTime         @updatedAt @map("updated_at")
  createdBy             String           @map("created_by")
  updatedBy             String           @map("updated_by")

  // -- Relations --
  status                CrmLeadStatus?   @relation(fields: [statusId], references: [id])
  source                CrmLeadSource?   @relation(fields: [sourceId], references: [id])
  industry              CrmIndustry?     @relation(fields: [industryId], references: [id])
  opportunities         CrmOpportunity[]
  campaignRecipients    CrmCampaignRecipient[]

  @@map("crm_leads")
  @@index([lifecycle], map: "idx_crm_leads_lifecycle")
  @@index([rating], map: "idx_crm_leads_rating")
  @@index([statusId], map: "idx_crm_leads_status")
  @@index([sourceId], map: "idx_crm_leads_source")
  @@index([industryId], map: "idx_crm_leads_industry")
  @@index([salesPersonId], map: "idx_crm_leads_salesperson")
  @@index([isActive], map: "idx_crm_leads_active")
  @@index([convertedCustomerId], map: "idx_crm_leads_converted_customer")
  @@index([companyName], map: "idx_crm_leads_company")
  @@index([email], map: "idx_crm_leads_email")
  @@index([createdAt], map: "idx_crm_leads_created")
}

// -------------------------------------------------
// Campaign (Transactional -- marketing campaign)
// -------------------------------------------------

model CrmCampaign {
  id                  String              @id @default(uuid())
  campaignNumber      String              @unique @map("campaign_number")       // Auto via NumberSeries "CMP-000001"

  // -- Campaign Info --
  name                String              @db.VarChar(200)
  description         String?             @db.Text
  mediaTypeId         String?             @map("media_type_id")                 // FK to CrmMediaType
  status              CrmCampaignStatus   @default(DRAFT)

  // -- Schedule --
  startDate           DateTime?           @map("start_date") @db.Date
  endDate             DateTime?           @map("end_date") @db.Date

  // -- Budget --
  budget              Decimal?            @db.Decimal(19, 4)                     // Planned spend
  actualCost          Decimal?            @map("actual_cost") @db.Decimal(19, 4) // Actual spend

  // -- Ownership --
  ownerId             String?             @map("owner_id")                       // FK to User (campaign owner)

  // -- Notes --
  notes               String?             @db.Text

  // -- Standard Fields --
  isActive            Boolean             @default(true) @map("is_active")
  createdAt           DateTime            @default(now()) @map("created_at")
  updatedAt           DateTime            @updatedAt @map("updated_at")
  createdBy           String              @map("created_by")
  updatedBy           String              @map("updated_by")

  // -- Relations --
  mediaType           CrmMediaType?       @relation(fields: [mediaTypeId], references: [id])
  recipients          CrmCampaignRecipient[]
  opportunities       CrmOpportunity[]

  @@map("crm_campaigns")
  @@index([status], map: "idx_crm_campaigns_status")
  @@index([mediaTypeId], map: "idx_crm_campaigns_media_type")
  @@index([ownerId], map: "idx_crm_campaigns_owner")
  @@index([startDate, endDate], map: "idx_crm_campaigns_dates")
  @@index([isActive], map: "idx_crm_campaigns_active")
}

// -------------------------------------------------
// Campaign Recipient (Junction -- links campaigns to leads/customers)
// -------------------------------------------------

model CrmCampaignRecipient {
  id              String                      @id @default(uuid())
  campaignId      String                      @map("campaign_id")
  recipientType   CrmCampaignRecipientType    @map("recipient_type")  // LEAD or CUSTOMER

  // Polymorphic reference: one of these will be set based on recipientType
  leadId          String?                     @map("lead_id")         // FK to CrmLead (when recipientType = LEAD)
  customerId      String?                     @map("customer_id")     // FK to Customer (when recipientType = CUSTOMER)

  // -- Response Tracking --
  contacted       Boolean                     @default(false)         // Has been contacted in this campaign
  contactedAt     DateTime?                   @map("contacted_at")
  responded       Boolean                     @default(false)         // Has responded
  respondedAt     DateTime?                   @map("responded_at")
  response        String?                     @db.VarChar(500)        // Response notes

  // -- Standard Fields --
  createdAt       DateTime                    @default(now()) @map("created_at")
  updatedAt       DateTime                    @updatedAt @map("updated_at")

  // -- Relations --
  campaign        CrmCampaign                 @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  lead            CrmLead?                    @relation(fields: [leadId], references: [id])

  @@map("crm_campaign_recipients")
  @@unique([campaignId, recipientType, leadId], map: "uq_crm_campaign_recipients_lead")
  @@unique([campaignId, recipientType, customerId], map: "uq_crm_campaign_recipients_customer")
  @@index([campaignId], map: "idx_crm_campaign_recipients_campaign")
  @@index([leadId], map: "idx_crm_campaign_recipients_lead")
  @@index([customerId], map: "idx_crm_campaign_recipients_customer")
  @@index([contacted], map: "idx_crm_campaign_recipients_contacted")
}

// -------------------------------------------------
// Opportunity (Transactional -- sales pipeline tracking)
// -------------------------------------------------

model CrmOpportunity {
  id                      String                 @id @default(uuid())
  opportunityNumber       String                 @unique @map("opportunity_number")   // Auto via NumberSeries "OPP-000001"

  // -- Opportunity Info --
  name                    String                 @db.VarChar(300)                     // Deal name / subject
  description             String?                @db.Text

  // -- Classification --
  classId                 String?                @map("class_id")                     // FK to CrmOpportunityClass
  status                  CrmOpportunityStatus   @default(OPEN)
  priority                String?                @db.VarChar(20)                      // FREE_TEXT or enum in app layer

  // -- Customer / Lead Reference --
  // An opportunity can be linked to a Lead (pre-conversion) OR a Customer (post-conversion), or both
  leadId                  String?                @map("lead_id")                      // FK to CrmLead
  customerId              String?                @map("customer_id")                  // FK to Customer
  contactName             String?                @map("contact_name") @db.VarChar(200)
  contactEmail            String?                @map("contact_email") @db.VarChar(255)
  contactPhone            String?                @map("contact_phone") @db.VarChar(30)

  // -- Sales Attribution --
  salesPersonId           String?                @map("sales_person_id")              // FK to User
  salesGroupCode          String?                @map("sales_group_code") @db.VarChar(20)

  // -- Financial --
  estimatedValue          Decimal?               @map("estimated_value") @db.Decimal(19, 4)  // Expected deal value
  currencyCode            String                 @default("GBP") @map("currency_code") @db.VarChar(3)
  weightedValue           Decimal?               @map("weighted_value") @db.Decimal(19, 4)   // estimatedValue * probability / 100

  // -- Probability & Timing --
  probability             Decimal?               @db.Decimal(5, 2)                    // 0.00 - 100.00 win probability
  expectedCloseDate       DateTime?              @map("expected_close_date") @db.Date // When we expect to close
  actualCloseDate         DateTime?              @map("actual_close_date") @db.Date   // When it actually closed (won/lost)
  nextFollowUpDate        DateTime?              @map("next_follow_up_date") @db.Date // Next action date

  // -- Outcome --
  lossReason              String?                @map("loss_reason") @db.VarChar(500) // Reason for loss (when status = LOST)
  winNotes                String?                @map("win_notes") @db.VarChar(500)   // Notes on win (when status = WON)

  // -- Linked Documents --
  salesQuoteId            String?                @map("sales_quote_id")               // FK to SalesQuote (section 2.16)
  salesOrderId            String?                @map("sales_order_id")               // FK to SalesOrder (section 2.16)
  campaignId              String?                @map("campaign_id")                  // FK to CrmCampaign (originating campaign)

  // -- Notes --
  internalNotes           String?                @map("internal_notes") @db.Text

  // -- Standard Fields --
  isActive                Boolean                @default(true) @map("is_active")
  createdAt               DateTime               @default(now()) @map("created_at")
  updatedAt               DateTime               @updatedAt @map("updated_at")
  createdBy               String                 @map("created_by")
  updatedBy               String                 @map("updated_by")

  // -- Relations --
  class                   CrmOpportunityClass?   @relation(fields: [classId], references: [id])
  lead                    CrmLead?               @relation(fields: [leadId], references: [id])
  campaign                CrmCampaign?           @relation(fields: [campaignId], references: [id])
  stageHistory            CrmOpportunityStageLog[]

  @@map("crm_opportunities")
  @@index([status], map: "idx_crm_opportunities_status")
  @@index([classId], map: "idx_crm_opportunities_class")
  @@index([leadId], map: "idx_crm_opportunities_lead")
  @@index([customerId], map: "idx_crm_opportunities_customer")
  @@index([salesPersonId], map: "idx_crm_opportunities_salesperson")
  @@index([expectedCloseDate], map: "idx_crm_opportunities_close_date")
  @@index([probability], map: "idx_crm_opportunities_probability")
  @@index([campaignId], map: "idx_crm_opportunities_campaign")
  @@index([isActive], map: "idx_crm_opportunities_active")
  @@index([status, salesPersonId], map: "idx_crm_opportunities_status_salesperson")
  @@index([status, expectedCloseDate], map: "idx_crm_opportunities_pipeline")
}

// -------------------------------------------------
// Opportunity Stage Log (Audit trail for pipeline movement)
// -------------------------------------------------

model CrmOpportunityStageLog {
  id              String            @id @default(uuid())
  opportunityId   String            @map("opportunity_id")

  // -- Stage Change --
  fromStatus      CrmOpportunityStatus? @map("from_status")       // null for initial creation
  toStatus        CrmOpportunityStatus  @map("to_status")
  fromProbability Decimal?          @map("from_probability") @db.Decimal(5, 2)
  toProbability   Decimal?          @map("to_probability") @db.Decimal(5, 2)

  // -- Context --
  reason          String?           @db.VarChar(500)               // Why the stage changed
  changedAt       DateTime          @default(now()) @map("changed_at")
  changedBy       String            @map("changed_by")

  // -- Relations --
  opportunity     CrmOpportunity    @relation(fields: [opportunityId], references: [id], onDelete: Cascade)

  @@map("crm_opportunity_stage_logs")
  @@index([opportunityId], map: "idx_crm_opp_stage_logs_opportunity")
  @@index([changedAt], map: "idx_crm_opp_stage_logs_changed_at")
}

// -------------------------------------------------
// Pipeline View (Configuration -- Kanban board definition)
// -------------------------------------------------

model CrmPipelineView {
  id              String    @id @default(uuid())
  name            String    @db.VarChar(100)                         // View/tab name, e.g., "Sales Pipeline"
  description     String?   @db.VarChar(500)

  // -- Scope --
  isSystemDefault Boolean   @default(false) @map("is_system_default") // System-level default view (admin-configured)
  userId          String?   @map("user_id")                          // FK to User (null = system-level, set = per-user override)

  // -- Display --
  sortOrder       Int       @default(0) @map("sort_order")           // Tab ordering

  // -- Standard Fields --
  isActive        Boolean   @default(true) @map("is_active")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  createdBy       String    @map("created_by")
  updatedBy       String    @map("updated_by")

  // -- Relations --
  columns         CrmPipelineColumn[]

  @@map("crm_pipeline_views")
  @@index([userId], map: "idx_crm_pipeline_views_user")
  @@index([isSystemDefault], map: "idx_crm_pipeline_views_system_default")
  @@index([isActive], map: "idx_crm_pipeline_views_active")
}

// -------------------------------------------------
// Pipeline Column (Configuration -- single column in a Kanban board)
// -------------------------------------------------

model CrmPipelineColumn {
  id              String                @id @default(uuid())
  viewId          String                @map("view_id")             // FK to CrmPipelineView

  // -- Column Definition --
  name            String                @db.VarChar(100)            // Column display name, e.g., "New Leads"
  entityType      CrmPipelineEntityType @map("entity_type")        // Which register this column pulls from
  filterField     String?               @map("filter_field") @db.VarChar(100) // Primary filter field (e.g., "status", "rating", "lifecycle")
  filterValue     String?               @map("filter_value") @db.VarChar(200) // Primary filter value (e.g., "NEW", "HOT", "OPEN")
  filterField2    String?               @map("filter_field_2") @db.VarChar(100) // Secondary filter
  filterValue2    String?               @map("filter_value_2") @db.VarChar(200) // Secondary filter value
  sortOrder       Int                   @map("sort_order")          // Column ordering (left to right)
  colour          String?               @db.VarChar(7)              // Hex colour for column header, e.g., "#2ECC71"

  // -- Display Options --
  showAmounts     Boolean               @default(false) @map("show_amounts")    // Show monetary totals in column
  maxItems        Int?                  @map("max_items")                        // Limit items shown (null = no limit)

  // -- Standard Fields --
  createdAt       DateTime              @default(now()) @map("created_at")
  updatedAt       DateTime              @updatedAt @map("updated_at")

  // -- Relations --
  view            CrmPipelineView       @relation(fields: [viewId], references: [id], onDelete: Cascade)

  @@map("crm_pipeline_columns")
  @@unique([viewId, sortOrder], map: "uq_crm_pipeline_columns_view_sort")
  @@index([viewId], map: "idx_crm_pipeline_columns_view")
  @@index([entityType], map: "idx_crm_pipeline_columns_entity_type")
}

// -------------------------------------------------
// Activity Auto-Creation Rules (Configuration -- event-driven activity generation)
// -------------------------------------------------

model CrmActivityAutoRule {
  id                  String                  @id @default(uuid())

  // -- Trigger --
  trigger             CrmActivityAutoTrigger                          // Which business event triggers activity creation
  activityTypeId      String                  @map("activity_type_id") // FK to CrmActivityType (type of activity to create)

  // -- Scope --
  userId              String?                 @map("user_id")         // FK to User (null = applies to all users)

  // -- Behaviour --
  isEnabled           Boolean                 @default(true) @map("is_enabled")
  autoComplete        Boolean                 @default(false) @map("auto_complete")  // Mark activity as done immediately on creation
  defaultSubject      String?                 @map("default_subject") @db.VarChar(300) // Template for activity subject

  // -- Standard Fields --
  createdAt           DateTime                @default(now()) @map("created_at")
  updatedAt           DateTime                @updatedAt @map("updated_at")
  createdBy           String                  @map("created_by")
  updatedBy           String                  @map("updated_by")

  // -- Relations --
  activityType        CrmActivityType         @relation(fields: [activityTypeId], references: [id])

  @@map("crm_activity_auto_rules")
  @@unique([trigger, userId], map: "uq_crm_activity_auto_rules_trigger_user")
  @@index([trigger], map: "idx_crm_activity_auto_rules_trigger")
  @@index([isEnabled], map: "idx_crm_activity_auto_rules_enabled")
  @@index([userId], map: "idx_crm_activity_auto_rules_user")
}

// -------------------------------------------------
// CRM Module Settings (JSON-typed module configuration)
// -------------------------------------------------

model CrmModuleSetting {
  id          String    @id @default(uuid())
  key         String    @unique @db.VarChar(100)    // Setting key, e.g., "crm.defaultLeadRating"
  value       Json                                   // Setting value (typed in application layer)
  description String?   @db.VarChar(500)

  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  updatedBy   String    @map("updated_by")

  @@map("crm_module_settings")
}
```

---

#### Lead Lifecycle

```
                  +------------------+
                  |       NEW        |  Lead captured (web form, import, manual entry)
                  |     CrmLead      |  lifecycle = NEW, rating = NONE
                  +--------+---------+
                           |
                           | Salesperson reviews, makes initial contact
                           v
                  +------------------+
                  |    CONTACTED     |  First outreach made
                  |                  |  lifecycle = CONTACTED
                  +--------+---------+
                           |
                   +-------+-------+
                   |               |
                   v               v
          +----------------+  +------------------+
          |   QUALIFIED    |  |   UNQUALIFIED    |  Not a fit (budget, timing, need)
          |   rating set   |  |   lifecycle =    |  lifecycle = UNQUALIFIED
          |  (COLD/WARM/   |  |   UNQUALIFIED    |
          |    HOT)        |  +------------------+
          +--------+-------+
                   |
          +--------+--------+
          |                 |
          v                 v
  +--------------+   +--------------+
  | Create       |   |     LOST     |  Lead went cold / chose competitor
  | Opportunity  |   | lifecycle =  |
  | (optional)   |   |    LOST      |
  +--------------+   +--------------+
          |
          v
  +------------------+
  |    CONVERTED     |  CreateCustomerFromLead service:
  |  lifecycle =     |    1. Create Customer record (AR module)
  |  CONVERTED       |    2. Copy address, contact, financial defaults
  |                  |    3. Set lead.convertedCustomerId = new customer ID
  |                  |    4. Set lead.convertedAt, lead.convertedBy
  |                  |    5. Emit "lead.converted" event
  |                  |    6. Open Customer record in UI
  +------------------+
```

**Key design difference from HansaWorld:** In HansaWorld, conversion changes `CUType` from `0` to `1` on the same record. In Nexa, conversion creates a new `Customer` record in the AR module and updates the `CrmLead` with a back-reference (`convertedCustomerId`). The lead record is preserved with full history. This is cleaner for the database-per-tenant architecture, provides better audit trail, and avoids the complexity of overloaded entity types.

**Conversion defaults** (applied to new Customer from CrmModuleSetting):
- `crm.conversion.defaultCustomerCategory` -- Customer category assigned on conversion
- `crm.conversion.defaultPaymentTermsId` -- Default payment terms for new customers
- `crm.conversion.defaultCreditLimit` -- Initial credit limit
- `crm.conversion.defaultRegionCode` -- Sales region

---

#### Campaign Management Workflow

```
  +------------------+
  |      DRAFT       |  Campaign created with name, description, media type
  |   CrmCampaign    |  Recipients added (mix of Leads and Customers)
  +--------+---------+
           |
           | activate()  -- validates at least 1 recipient
           v
  +------------------+
  |      ACTIVE      |  Campaign is running
  |                  |  Recipients can be contacted, responses tracked
  |                  |  Activities auto-created per CrmActivityAutoRule
  +--------+---------+
           |
           | complete()
           v
  +------------------+
  |    COMPLETED     |  Campaign finished
  |                  |  Final metrics calculated:
  |                  |    - Total recipients
  |                  |    - Contacted count
  |                  |    - Response count
  |                  |    - Conversion count (leads -> customers)
  +------------------+

  At any pre-completed state:
    cancel() --> CANCELLED
```

**Campaign metrics** are computed on-demand from `CrmCampaignRecipient` aggregation (not stored on the header). The API endpoint `GET /api/v1/crm/campaigns/:id/metrics` returns:

```
{
  totalRecipients: number,
  leadsCount: number,
  customersCount: number,
  contactedCount: number,
  respondedCount: number,
  contactRate: number,       // contacted / total * 100
  responseRate: number,      // responded / contacted * 100
  leadsConverted: number,    // recipients whose lead.lifecycle = CONVERTED
  estimatedRevenue: Decimal  // SUM of linked opportunities' estimatedValue
}
```

---

#### Opportunity Pipeline Workflow

```
  +------------------+
  |       OPEN       |  Opportunity created (manually or from Lead)
  |  CrmOpportunity  |  probability starts at default (e.g., 10%)
  +--------+---------+
           |
           | Track progress:
           |   - Update probability as deal advances
           |   - Set expectedCloseDate
           |   - Create/link SalesQuote (section 2.16)
           |   - Log Activities (section 2.20)
           |   - Drag on Pipeline Kanban
           |
           +--------+-----------+
           |                    |
           v                    v
  +------------------+   +------------------+
  |       WON        |   |       LOST       |
  |  probability =   |   |  probability =   |
  |     100.00       |   |      0.00        |
  |  actualCloseDate |   |  actualCloseDate |
  |     = today      |   |     = today      |
  |  Convert to      |   |  lossReason      |
  |  Sales Order     |   |     recorded     |
  +------------------+   +------------------+

  At any state:
    cancel() --> CANCELLED (deal abandoned, no win/loss attribution)
```

**Opportunity-to-Sales conversion chain:**

```
CrmOpportunity (CRM)
    |
    +--> Create SalesQuote (Sales Orders module, section 2.16)
    |      Copies: customer, contact, currency, salesperson
    |      Sets: SalesQuote.opportunityId = this opportunity
    |      Sets: CrmOpportunity.salesQuoteId = new quote
    |
    +--> SalesQuote accepted --> Create SalesOrder (section 2.16)
    |      Sets: CrmOpportunity.salesOrderId = new order
    |      Sets: CrmOpportunity.status = WON, probability = 100
    |
    +--> OR: Direct win without quote (manual status change)
           Sets: status = WON, actualCloseDate = today
           Emits: "opportunity.won" event
```

**Weighted pipeline calculation** (for forecasting reports):

```
weightedValue = estimatedValue * (probability / 100)

Pipeline Forecast = SUM(weightedValue)
                    WHERE status = OPEN
                    AND expectedCloseDate BETWEEN @startDate AND @endDate
                    GROUP BY salesPersonId, MONTH(expectedCloseDate)
```

---

#### Pipeline Kanban Configuration

The Pipeline Overview is a configurable Kanban-style board that aggregates entities from across the CRM module (and optionally Sales) into visual columns. Each column is defined by an entity type and filter criteria.

**System-level configuration** (set by administrator):

```
View: "Sales Pipeline"
  Column 1: name="New Leads",      entityType=LEAD,        filterField="lifecycle", filterValue="NEW",       colour="#3498DB"
  Column 2: name="Qualified",      entityType=LEAD,        filterField="lifecycle", filterValue="QUALIFIED", colour="#2ECC71"
  Column 3: name="Proposal Sent",  entityType=OPPORTUNITY, filterField="status",    filterValue="OPEN",      colour="#F39C12"
  Column 4: name="Negotiation",    entityType=SALES_QUOTE, filterField="status",    filterValue="SENT",      colour="#E67E22"
  Column 5: name="Won",            entityType=OPPORTUNITY, filterField="status",    filterValue="WON",       colour="#27AE60"
  Column 6: name="Lost",           entityType=OPPORTUNITY, filterField="status",    filterValue="LOST",      colour="#E74C3C"
```

**Per-user overrides:** Users can create their own `CrmPipelineView` records (with `userId` set) that override the system defaults for their session. If no user-level view exists, the system default is shown.

**Drag-and-drop behaviour:**

| Source Column EntityType | Target Column EntityType | Action |
|---|---|---|
| LEAD | Different LEAD column | Updates `CrmLead.lifecycle` or `CrmLead.rating` to match target filter |
| OPPORTUNITY | Different OPPORTUNITY column | Updates `CrmOpportunity.status` to match target filter; logs `CrmOpportunityStageLog` |
| ACTIVITY | Different ACTIVITY column | Updates `Activity.status` (cross-cutting model) |
| LEAD | OPPORTUNITY column | Creates new `CrmOpportunity` from the Lead |

---

#### Activity Integration (Cross-Cutting Reference)

The CRM module does **not** define its own Activity model. It uses the cross-cutting `Activity` model from section 2.20, which provides polymorphic linking to any entity (`entityType` + `entityId`). CRM extends Activity with:

1. **CRM-specific Activity Types** (`CrmActivityType` + `CrmActivityTypeGroup`) -- these map to the `Activity.activityType` field via application-layer validation. The cross-cutting `ActivityType` enum (MEETING, CALL, EMAIL, TODO, NOTE, FOLLOW_UP) covers the base cases. CRM Activity Types add granularity (e.g., "Outbound Cold Call", "Product Demo", "Site Visit") stored in the `CrmActivityType` reference table and referenced by auto-creation rules.

2. **Auto-creation rules** (`CrmActivityAutoRule`) -- event-driven activity creation. When a business event occurs (e.g., sales order approved), the CRM event handler checks for matching `CrmActivityAutoRule` records and creates `Activity` records with:
   - `entityType` = source entity type (e.g., "SalesOrder")
   - `entityId` = source entity ID
   - `activityType` = mapped from `CrmActivityType` to cross-cutting enum
   - `subject` = template from `CrmActivityAutoRule.defaultSubject`
   - `assignedToId` = user who triggered the event (or configured assignee)
   - `status` = COMPLETED if `autoComplete = true`, otherwise PLANNED

3. **Activity timeline queries** -- the API provides `GET /api/v1/crm/leads/:id/activities` (and similar for opportunities, campaigns) which queries `Activity` where `entityType = "CrmLead"` and `entityId = :id`, ordered by `startDate DESC`.

---

#### Business Rules

- **BR-CRM-001:** Lead number is mandatory and auto-generated from the CRM Number Series on creation. Manual override is not permitted.
- **BR-CRM-002:** A Lead must have at least `contactFirstName` and `contactLastName` populated. `companyName` is optional (individual leads are permitted).
- **BR-CRM-003:** Lead rating (COLD/WARM/HOT) can only be set when lifecycle is CONTACTED or QUALIFIED. New leads default to NONE.
- **BR-CRM-004:** Lead conversion requires lifecycle = QUALIFIED. Leads in NEW, CONTACTED, UNQUALIFIED, or LOST states cannot be converted.
- **BR-CRM-005:** Lead conversion creates a new Customer record in the AR module (section 2.15). The `CrmLead.convertedCustomerId` is set to the new Customer's ID. The lead record is preserved (not deleted or merged).
- **BR-CRM-006:** A Lead can only be converted once. If `convertedCustomerId` is already set, conversion is blocked.
- **BR-CRM-007:** Campaign activation (`DRAFT -> ACTIVE`) requires at least one recipient in the `CrmCampaignRecipient` table.
- **BR-CRM-008:** Campaign recipients must be unique per campaign. The same Lead or Customer cannot appear twice in the same campaign.
- **BR-CRM-009:** Campaign status transitions are strictly ordered: DRAFT -> ACTIVE -> COMPLETED. CANCELLED can be reached from DRAFT or ACTIVE but not from COMPLETED.
- **BR-CRM-010:** Opportunity creation from a Lead copies `companyName`, `contactFirstName`, `contactLastName`, `email`, `phone`, `currencyCode`, and `salesPersonId` to the new Opportunity.
- **BR-CRM-011:** When an Opportunity status changes to WON, `probability` is automatically set to 100.00, `actualCloseDate` is set to today, and `weightedValue` is recalculated. The event `"opportunity.won"` is emitted.
- **BR-CRM-012:** When an Opportunity status changes to LOST, `probability` is automatically set to 0.00, `actualCloseDate` is set to today, `weightedValue` is set to 0, and `lossReason` is required. The event `"opportunity.lost"` is emitted.
- **BR-CRM-013:** `weightedValue` is computed as `estimatedValue * probability / 100` and stored for efficient pipeline reporting queries.
- **BR-CRM-014:** Opportunity stage changes are logged in `CrmOpportunityStageLog` with before/after status, before/after probability, reason, and the user who made the change.
- **BR-CRM-015:** Pipeline drag-and-drop operations validate that the target column's filter criteria are compatible with the entity being dragged. Invalid transitions (e.g., dragging a LOST opportunity to WON) are permitted but trigger the standard status-change business rules (BR-CRM-011/012).
- **BR-CRM-016:** Activity auto-creation rules (`CrmActivityAutoRule`) are evaluated on the event bus. When a matching trigger fires, the CRM service creates an `Activity` record linked to the source entity. If `autoComplete` is true, the activity is created with status = COMPLETED.
- **BR-CRM-017:** Deleting a Lead that has been converted (`convertedCustomerId` is set) is blocked. The lead must be soft-deleted (`isActive = false`) instead.
- **BR-CRM-018:** Opportunity approval (when required) uses the cross-cutting approval engine from section 2.20. The `ApprovalRule` is configured with `entityType = "CrmOpportunity"`. Opportunities pending approval cannot be converted to Sales Quotes or Orders.
- **BR-CRM-019:** Email-to-customer lookup: when creating an Activity from an inbound email, the system searches `Customer.email` and `CustomerContact.email` to auto-link the activity to the matching customer. If no match is found, it searches `CrmLead.email`.
- **BR-CRM-020:** Campaign budget tracking is informational only (no hard enforcement). `actualCost` is manually updated; it does not auto-aggregate from linked transactions.

---

#### Number Series Configuration

The CRM module registers the following number series entries in the system-level `NumberSeries` table (section 2.8). These are seeded during tenant provisioning and configurable by the administrator.

| Series Key | Prefix | Example | Description |
|---|---|---|---|
| `CRM_LEAD` | LD- | LD-000001 | Lead sequential numbers |
| `CRM_OPPORTUNITY` | OPP- | OPP-000001 | Opportunity sequential numbers |
| `CRM_CAMPAIGN` | CMP- | CMP-000001 | Campaign sequential numbers |

Activity numbers are managed by the cross-cutting Activity module (section 2.20) and are not CRM-specific.

---

#### Cross-Module Integration Points

| Integration | From | To | Mechanism | Notes |
|---|---|---|---|---|
| Lead to Customer | CRM | AR (section 2.15) | `LeadConversionService` creates Customer | Copies address, contact, financial defaults |
| Lead to Opportunity | CRM | CRM | `OpportunityService.createFromLead()` | Copies lead data to opportunity fields |
| Opportunity to Quote | CRM | Sales Orders (section 2.16) | `QuoteService.createFromOpportunity()` | Sets `SalesQuote.opportunityId`; back-fills `CrmOpportunity.salesQuoteId` |
| Opportunity to Order | CRM | Sales Orders (section 2.16) | Via Quote conversion chain | `CrmOpportunity.salesOrderId` set when quote converts to order |
| Campaign to Activities | CRM | Cross-Cutting (section 2.20) | Event bus: `campaign.activated` | Creates follow-up activities for campaign recipients |
| Activity auto-creation | Any module | CRM + Cross-Cutting | Event bus subscribers | `CrmActivityAutoRule` matched against business events |
| Opportunity approval | CRM | Cross-Cutting (section 2.20) | `ApprovalRule` with `entityType = "CrmOpportunity"` | Blocks conversion until approved |
| Pipeline view data | CRM | Sales Orders, AR | Read-only queries | Pipeline columns can display SalesQuote and SalesOrder entities |
| Credit check on conversion | CRM | AR (section 2.15) | `CreditCheckService` | Optional credit limit set during lead conversion |

---

#### Reports (MVP Scope)

| Report | Description | Key Filters | Output |
|---|---|---|---|
| Lead List | All leads with status, source, rating, salesperson | Date range, status, source, industry, rating, salesperson | Tabular with drill-down |
| Lead Conversion | Leads converted to customers over time | Date range, source, salesperson | Conversion rate, avg time to convert |
| Pipeline Forecast | Open opportunities by expected close month | Salesperson, class, min probability, date range | Monthly buckets with estimated and weighted values |
| Campaign Performance | Campaign metrics (contact rate, response rate, conversions) | Campaign, date range, media type | Summary stats + recipient detail |
| Salesperson Activity | Activities logged by salesperson over time | Date range, salesperson, activity type | Count by type, period-over-period comparison |

**Deferred to P1:**
- Quotation Pipeline Report (probability-weighted forecasting aligned with section 2.16)
- Salesman Results Report (revenue attribution from closed opportunities)
- Full campaign ROI analysis (linking campaign spend to closed opportunity revenue)

---

#### Build Sequence & Dependencies

The CRM module is targeted for **Story 9+** in the implementation roadmap, after the Sales Orders module foundation is in place (since Opportunities link to Sales Quotes).

| Dependency | Module | Must Be Complete | Reason |
|---|---|---|---|
| Customer model | AR (section 2.15) | Full CRUD | Lead conversion creates Customer records |
| Activity model | Cross-Cutting (section 2.20) | Full CRUD | CRM logs activities via cross-cutting model |
| NumberSeries | System (section 2.8) | Functional | Auto-numbering for LD-, OPP-, CMP- prefixes |
| User (salesperson) | Auth / System | Reference data | `salesPersonId` FK on Leads, Opportunities |
| SalesQuote model | Sales Orders (section 2.16) | Full CRUD | Opportunity-to-Quote conversion |
| ApprovalRule engine | Cross-Cutting (section 2.20) | Functional | Opportunity approval workflows |
| Event bus | System (Story 3) | Functional | Activity auto-creation, cross-module events |

**Recommended build order within the CRM module:**

1. Reference entities: CrmLeadStatus, CrmLeadSource, CrmIndustry, CrmMediaType, CrmOpportunityClass, CrmActivityType, CrmActivityTypeGroup (seed data included)
2. CrmModuleSetting (seed defaults for conversion, pipeline, number series)
3. CrmLead + full lifecycle (CRUD, status transitions, validation rules BR-CRM-001 through BR-CRM-006)
4. Lead conversion service (integration with AR Customer creation)
5. CrmCampaign + CrmCampaignRecipient (CRUD, status transitions, recipient management, metrics endpoint)
6. CrmOpportunity + CrmOpportunityStageLog (CRUD, probability tracking, win/loss handling, weighted value calculation)
7. Opportunity-to-Quote integration (coordinate with Sales Orders module)
8. CrmActivityAutoRule + event bus subscribers (auto-activity creation for key business events)
9. CrmPipelineView + CrmPipelineColumn (admin configuration CRUD, user override support)
10. Pipeline Kanban API (aggregation endpoint, drag-and-drop state change handlers)
11. Reports: Lead List, Lead Conversion, Pipeline Forecast, Campaign Performance, Salesperson Activity

---

*End of section 2.21*

---

*End of section 2.21*

### 2.22 HR & Payroll Module --- Employees, Contracts, Leave, Appraisals & UK Payroll

The HR & Payroll module is the most regulation-heavy module in Nexa ERP, combining HansaWorld's mature HRM entity model with a purpose-built UK payroll engine that HansaWorld lacks entirely. The module manages the full employee lifecycle: employee master data, employment contracts with immutable change history, leave entitlements and requests, performance appraisals, skills evaluations, onboarding/offboarding checklists, training plans, job positions, and benefits. Layered on top is a complete UK payroll engine covering PAYE, National Insurance, student loan deductions, pension auto-enrolment, statutory payments (SSP, SMP, SPP, ShPP, SAP), HMRC Real Time Information (RTI) submissions, and payslip generation.

In the legacy HansaWorld system, HR spans 21 registers, 4 settings blocks, and 6 reports. The employment contract lifecycle with immutable change history is well designed and carried forward. Employees are not a separate register --- they are Contact records (CUVc) where `EmployeeType != 0`. The payroll register (HRMPayrollVc) is nothing more than a simple payment-type + amount list with no tax calculation, NI, RTI, or statutory pay support.

Nexa takes a significantly enhanced approach: **Employees** are promoted to a first-class entity with their own table, linking to the system-wide Contact model for shared address/phone data but adding HR-specific fields (NI number, tax code, pension details). **Employment Contracts** follow HansaWorld's excellent immutable change pattern --- approved contracts cannot be edited; all modifications create `ContractChange` records that overlay onto the original contract for reporting. **UK Payroll** is a complete new build: `PayrollRun` is a batch header; `PayrollLine` is the per-employee calculation result. The engine calculates PAYE, NI, student loans, pension contributions, and statutory payments based on current HMRC thresholds stored in `TaxYearConfig`. All monetary fields use `Decimal(19, 4)` for precision; tax thresholds and rates use `Decimal(10, 6)` for percentage precision. **Leave management** is enhanced from HansaWorld with UK statutory entitlements (28 days for full-time) and a proper balance-tracking model. The module sits in `apps/api/src/modules/hr/` as a Fastify plugin.

**Phase 1 (MVP):** Employee management, Employment contracts with change history, UK Payroll engine, Leave management, Checklists.
**Phase 2:** Skills & Training, Performance management, Job positions, Benefits management.
**Phase 3:** Recruitment/ATS, Time & Attendance, Employee self-service.

---

#### Legacy-to-Nexa Mapping

| Legacy Entity | HAL Source | Fields | Nexa Model | Notes |
|---|---|---|---|---|
| CUVc (Employee type) | datadef1.hal | 313 (subset) | **Employee** | Promoted from Contact subtype to first-class entity. ~30 HR-specific fields from 313. |
| HRMCOVc | HRMCOVcRAction.hal | 22+9 matrix | **EmploymentContract** + **ContractBenefit** | Contract header + benefit rows as separate model. |
| HRMCOChangeVc | HRMCOChangeVcRAction.hal | 17 | **ContractChange** | Immutable change history per contract. |
| HRMCOClassVc | HRMCOClassVcRAction.hal | 2 | **ContractClass** | Lookup: contract classification. |
| HRMCOTypeVc | HRMCOTypeVcRAction.hal | 2 | **ContractType** | Lookup: permanent, fixed-term, casual, etc. |
| HRMPAVc | HRMPAVcRAction.hal | 9+4 matrix | **PerformanceAppraisal** + **AppraisalLine** | Appraisal header + factor/rating rows. |
| HRMPACVc | HRMPACVcRAction.hal | 2 | **AppraisalCategory** | Lookup: appraisal category. |
| HRMPFVc | HRMPFVcRAction.hal | 2 | **PerformanceFactor** | Lookup: what is evaluated. |
| HRMPRVc | HRMPRVcRAction.hal | 2 | **PerformanceRating** | Lookup: rating scale values. |
| HRMSEVc | HRMSEVcRAction.hal | 10+4 matrix | **SkillsEvaluation** + **SkillsEvaluationLine** | Skills assessment header + skill/rating rows. |
| HRMSkillVc | HRMSkillVcRAction.hal | 2 | **Skill** | Lookup: skill/competency definitions. |
| HRMRatingVc | HRMRatingVcRAction.hal | 2 | **SkillRating** | Lookup: proficiency levels (also used for training status). |
| HRMBenefitTypeVc | HRMBenefitTypeVcRAction.hal | 7 | **BenefitType** | Lookup: benefit templates with defaults. |
| HRMResidencyTypeVc | HRMResidencyTypeVcRAction.hal | 2 | **ResidencyType** | Lookup: visa/residency classifications. |
| HRMCheckListVc | HRMChecklistVcRAction.hal | 11+6 matrix | **Checklist** + **ChecklistItem** | Onboarding/offboarding with checkpoint tracking. |
| CheckPointVc | --- | 2 | **Checkpoint** | Lookup: reusable checklist task templates. |
| HRMJPVc | HRMPOVcRAction.hal | 5+2 matrix | **JobPosition** + **PositionIncumbent** | Org structure positions. |
| HRMPayrollVc | HRMPayrollVcRAction.hal | 11+3 matrix | Absorbed into **PayrollRun** + **PayrollLine** | Legacy is basic; Nexa replaces with full UK engine. |
| HRMPymtTypeVc | HRMPymtTypeVcRAction.hal | 4 | **PaymentType** | Lookup: payment/deduction type codes. |
| TrainingPlanVc | TrainingPlanVcRAction.hal | 15 | **TrainingPlan** | Training session scheduling. |
| JobTitleVc | --- | 2 | **JobTitle** | Lookup: job title codes. |
| EmplPSVc | --- | 13 | Absorbed into user preferences (JSON) | Report personalisation settings. |
| --- (new) | --- | --- | **PayrollRun** | Monthly payroll batch header (UK engine). |
| --- (new) | --- | --- | **PayrollLine** | Per-employee payroll calculation result. |
| --- (new) | --- | --- | **TaxYearConfig** | HMRC annual thresholds and rates. |
| --- (new) | --- | --- | **StatutoryPayment** | SSP, SMP, SPP, ShPP, SAP tracking. |
| --- (new) | --- | --- | **PensionEnrolment** | Auto-enrolment status and contributions. |
| --- (new) | --- | --- | **HMRCSubmission** | FPS/EPS submission tracking. |
| --- (new) | --- | --- | **PayslipDocument** | Generated payslip PDF references. |
| --- (new) | --- | --- | **LeaveEntitlement** | Annual leave allocation per employee. |
| --- (new) | --- | --- | **LeaveRequest** | Leave booking with approval workflow. |
| --- (new) | --- | --- | **LeaveBalance** | Calculated leave balance tracking. |

---

#### Prisma Schema

```prisma
// =====================================================
// HR & PAYROLL MODULE -- Employees, Contracts, Leave,
// Appraisals & UK Payroll
// =====================================================

// -------------------------------------------------
// Enums
// -------------------------------------------------

enum EmployeeStatus {
  ACTIVE
  ON_LEAVE
  SUSPENDED
  TERMINATED
  RETIRED

  @@map("employee_status")
}

enum Gender {
  MALE
  FEMALE
  OTHER
  PREFER_NOT_TO_SAY

  @@map("gender")
}

enum MaritalStatus {
  SINGLE
  MARRIED
  CIVIL_PARTNERSHIP
  DIVORCED
  WIDOWED
  SEPARATED
  OTHER

  @@map("marital_status")
}

enum SalaryFrequency {
  MONTHLY
  YEARLY
  WEEKLY
  FORTNIGHTLY
  HOURLY

  @@map("salary_frequency")
}

enum ContractStatus {
  DRAFT
  APPROVED
  TERMINATED

  @@map("contract_status")
}

enum TerminationReason {
  RESIGNATION
  NON_RENEWAL
  DISMISSAL_OPERATIONAL
  DISMISSAL_MISCONDUCT
  DISMISSAL_INCAPACITY
  DISMISSAL_RETIREMENT
  DEATH
  TRANSFER_DEPARTMENT
  TRANSFER_COUNTRY
  END_OF_INTERNSHIP
  TRIAL_PERIOD_FAILED
  DISMISSAL_NON_PERFORMANCE
  REDUNDANCY
  MUTUAL_AGREEMENT

  @@map("termination_reason")
}

enum ContractChangeReason {
  NEW
  PROMOTION
  TRANSFER
  DEMOTION
  SALARY_REVIEW
  ROLE_CHANGE
  DEPARTMENT_CHANGE
  OTHER

  @@map("contract_change_reason")
}

enum BenefitFrequency {
  ONE_OFF
  WEEKLY
  FORTNIGHTLY
  MONTHLY
  QUARTERLY
  YEARLY

  @@map("benefit_frequency")
}

enum JobPositionStatus {
  OPENING
  VACANT
  FILLED
  CANCELLED

  @@map("job_position_status")
}

enum ChecklistType {
  ONBOARDING
  OFFBOARDING
  OTHER

  @@map("checklist_type")
}

enum ChecklistItemStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  NOT_APPLICABLE

  @@map("checklist_item_status")
}

enum AppraisalStatus {
  DRAFT
  APPROVED

  @@map("appraisal_status")
}

enum SkillsEvalStatus {
  DRAFT
  APPROVED
  TERMINATED

  @@map("skills_eval_status")
}

enum TrainingStatus {
  SCHEDULED
  IN_PROGRESS
  COMPLETED
  CANCELLED
  CLOSED

  @@map("training_status")
}

enum LeaveType {
  ANNUAL
  SICK
  MATERNITY
  PATERNITY
  SHARED_PARENTAL
  ADOPTION
  BEREAVEMENT
  COMPASSIONATE
  JURY_SERVICE
  UNPAID
  STUDY
  OTHER

  @@map("leave_type")
}

enum LeaveRequestStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
  TAKEN

  @@map("leave_request_status")
}

enum LeaveCalculationBase {
  CALENDAR_DAYS
  WORKING_HOURS

  @@map("leave_calculation_base")
}

// -- UK Payroll Enums ----------------------------------------

enum TaxBasis {
  CUMULATIVE             // Normal cumulative calculation
  WEEK1_MONTH1           // Non-cumulative (Week 1 / Month 1)
  EMERGENCY              // Emergency tax code

  @@map("tax_basis")
}

enum NICategory {
  A                      // Standard employee
  B                      // Married women/widows (reduced rate)
  C                      // Over state pension age
  F                      // Freeport (standard)
  H                      // Apprentice under 25
  I                      // Freeport (married women)
  J                      // Deferment
  L                      // Freeport (over pension age)
  M                      // Under 21
  S                      // Freeport (under 21)
  V                      // Veterans (first 12 months)
  Z                      // Under 21 deferment

  @@map("ni_category")
}

enum StudentLoanPlan {
  PLAN_1                 // Pre-2012 (England/Wales), Scotland, NI
  PLAN_2                 // Post-2012 (England/Wales)
  PLAN_4                 // Scotland (post-2023)
  PLAN_5                 // Post-2023 (England/Wales)
  POSTGRADUATE           // Postgraduate loan

  @@map("student_loan_plan")
}

enum StatutoryPayType {
  SSP                    // Statutory Sick Pay
  SMP                    // Statutory Maternity Pay
  SPP                    // Statutory Paternity Pay
  ShPP                   // Shared Parental Pay
  SAP                    // Statutory Adoption Pay
  SPBP                   // Statutory Parental Bereavement Pay

  @@map("statutory_pay_type")
}

enum PensionSchemeType {
  DEFINED_CONTRIBUTION
  DEFINED_BENEFIT
  NEST
  SMART_PENSION
  OTHER

  @@map("pension_scheme_type")
}

enum PensionEnrolmentStatus {
  ELIGIBLE_JOBHOLDER
  NON_ELIGIBLE_JOBHOLDER
  ENTITLED_WORKER
  ENROLLED
  OPTED_IN
  OPTED_OUT
  CEASED_MEMBERSHIP

  @@map("pension_enrolment_status")
}

enum PensionContributionMethod {
  RELIEF_AT_SOURCE       // Provider claims basic rate relief
  NET_PAY                // Deducted before tax

  @@map("pension_contribution_method")
}

enum PayrollRunStatus {
  DRAFT                  // Being prepared
  CALCULATED             // Engine has run calculations
  REVIEWED               // Manager has reviewed
  APPROVED               // Authorised for payment
  PAID                   // BACS/payments sent
  POSTED                 // GL journal entries created
  CANCELLED

  @@map("payroll_run_status")
}

enum PayrollFrequency {
  WEEKLY
  FORTNIGHTLY
  FOUR_WEEKLY
  MONTHLY

  @@map("payroll_frequency")
}

enum PayrollLineType {
  GROSS_PAY
  OVERTIME
  BONUS
  COMMISSION
  ALLOWANCE
  BENEFIT_IN_KIND
  SALARY_SACRIFICE
  PAYE_TAX
  EMPLOYEE_NI
  EMPLOYER_NI
  STUDENT_LOAN
  POSTGRAD_LOAN
  EMPLOYEE_PENSION
  EMPLOYER_PENSION
  SSP
  SMP
  SPP
  ShPP
  SAP
  SPBP
  ATTACHMENT_OF_EARNINGS
  COURT_ORDER
  OTHER_DEDUCTION
  OTHER_ADDITION
  NET_PAY

  @@map("payroll_line_type")
}

enum HMRCSubmissionType {
  FPS                    // Full Payment Submission (per pay run)
  EPS                    // Employer Payment Summary (monthly adjustments)
  EARLIER_YEAR_UPDATE    // EYU (corrections to previous tax year)
  P45                    // Leaver notification
  P46                    // New starter without P45

  @@map("hmrc_submission_type")
}

enum HMRCSubmissionStatus {
  DRAFT
  GENERATED
  SUBMITTED
  ACCEPTED
  REJECTED
  ERROR

  @@map("hmrc_submission_status")
}

// -------------------------------------------------
// Employee (first-class entity)
// -------------------------------------------------

model Employee {
  id                    String              @id @default(uuid())

  // -- Identity --
  employeeNumber        String              @unique @map("employee_number")       // "EMP-00001" via NumberSeries
  title                 String?             @db.VarChar(20)                        // Mr, Mrs, Ms, Dr, etc.
  firstName             String              @map("first_name") @db.VarChar(100)
  middleName            String?             @map("middle_name") @db.VarChar(100)
  lastName              String              @map("last_name") @db.VarChar(100)
  preferredName         String?             @map("preferred_name") @db.VarChar(100) // Known-as name
  dateOfBirth           DateTime            @map("date_of_birth") @db.Date
  gender                Gender?
  maritalStatus         MaritalStatus?      @map("marital_status")

  // -- Contact --
  personalEmail         String?             @map("personal_email") @db.VarChar(200)
  workEmail             String?             @map("work_email") @db.VarChar(200)
  personalPhone         String?             @map("personal_phone") @db.VarChar(30)
  workPhone             String?             @map("work_phone") @db.VarChar(30)

  // -- Address --
  addressLine1          String?             @map("address_line_1") @db.VarChar(200)
  addressLine2          String?             @map("address_line_2") @db.VarChar(200)
  city                  String?             @db.VarChar(100)
  county                String?             @db.VarChar(100)
  postcode              String?             @db.VarChar(20)
  countryCode           String              @default("GB") @map("country_code") @db.VarChar(2)

  // -- UK Tax & Payroll --
  niNumber              String?             @map("ni_number") @db.VarChar(9)       // National Insurance number (format: QQ 12 34 56 A)
  taxCode               String?             @map("tax_code") @db.VarChar(10)       // PAYE tax code (e.g., "1257L")
  taxBasis              TaxBasis            @default(CUMULATIVE) @map("tax_basis")
  niCategory            NICategory          @default(A) @map("ni_category")
  studentLoanPlan       StudentLoanPlan?    @map("student_loan_plan")
  hasPostgradLoan       Boolean             @default(false) @map("has_postgrad_loan")
  starterDeclaration    String?             @map("starter_declaration") @db.VarChar(1) // A, B, or C (P46 statement)
  previousPayYTD        Decimal             @default(0) @map("previous_pay_ytd") @db.Decimal(19, 4)    // Brought-forward taxable pay from P45
  previousTaxYTD        Decimal             @default(0) @map("previous_tax_ytd") @db.Decimal(19, 4)    // Brought-forward tax deducted from P45
  directorFlag          Boolean             @default(false) @map("director_flag")   // Affects NI calculation method
  directorStartDate     DateTime?           @map("director_start_date") @db.Date

  // -- Employment --
  departmentCode        String?             @map("department_code") @db.VarChar(20)
  jobTitleCode          String?             @map("job_title_code") @db.VarChar(20)
  startDate             DateTime            @map("start_date") @db.Date
  terminationDate       DateTime?           @map("termination_date") @db.Date
  continuousServiceDate DateTime?           @map("continuous_service_date") @db.Date  // May differ from startDate (TUPE transfers)
  status                EmployeeStatus      @default(ACTIVE)
  managerId             String?             @map("manager_id")                       // Self-ref: reporting manager
  manager               Employee?           @relation("EmployeeManager", fields: [managerId], references: [id])
  directReports         Employee[]          @relation("EmployeeManager")

  // -- Residency & Right to Work --
  nationality           String?             @db.VarChar(2)                            // ISO country code
  residencyTypeCode     String?             @map("residency_type_code") @db.VarChar(20)
  rightToWorkExpiry     DateTime?           @map("right_to_work_expiry") @db.Date
  rightToWorkDocRef     String?             @map("right_to_work_doc_ref") @db.VarChar(100)

  // -- Bank Details (for payroll) --
  bankAccountName       String?             @map("bank_account_name") @db.VarChar(100)
  bankSortCode          String?             @map("bank_sort_code") @db.VarChar(8)     // "XX-XX-XX"
  bankAccountNumber     String?             @map("bank_account_number") @db.VarChar(8)
  bankBuildingSocRef    String?             @map("bank_building_soc_ref") @db.VarChar(20)

  // -- Standard Fields --
  isActive              Boolean             @default(true) @map("is_active")
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")
  createdBy             String              @map("created_by")
  updatedBy             String              @map("updated_by")

  // -- Relations --
  contracts             EmploymentContract[]
  leaveEntitlements     LeaveEntitlement[]
  leaveRequests         LeaveRequest[]
  leaveBalances         LeaveBalance[]
  appraisalsAsEmployee  PerformanceAppraisal[] @relation("AppraisalEmployee")
  appraisalsAsReviewer  PerformanceAppraisal[] @relation("AppraisalReviewer")
  skillsEvaluations     SkillsEvaluation[]
  checklists            Checklist[]
  trainingPlansAsTrainee TrainingPlan[]     @relation("TraineeEmployee")
  trainingPlansAsTrainer TrainingPlan[]     @relation("TrainerEmployee")
  pensionEnrolment      PensionEnrolment?
  payrollLines          PayrollLine[]
  payslipDocuments      PayslipDocument[]
  statutoryPayments     StatutoryPayment[]
  positionIncumbents    PositionIncumbent[]

  @@map("employees")
  @@index([status], map: "idx_employees_status")
  @@index([departmentCode], map: "idx_employees_department_code")
  @@index([managerId], map: "idx_employees_manager_id")
  @@index([niNumber], map: "idx_employees_ni_number")
  @@index([lastName, firstName], map: "idx_employees_name")
  @@index([startDate], map: "idx_employees_start_date")
  @@index([isActive, status], map: "idx_employees_active_status")
}

// -------------------------------------------------
// Job Title (Reference -- lookup)
// -------------------------------------------------

model JobTitle {
  id                    String              @id @default(uuid())
  code                  String              @unique @db.VarChar(20)
  title                 String              @db.VarChar(200)
  isActive              Boolean             @default(true) @map("is_active")
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")

  @@map("job_titles")
  @@index([isActive], map: "idx_job_titles_active")
}

// -------------------------------------------------
// Contract Class (Reference -- lookup)
// -------------------------------------------------

model ContractClass {
  id                    String              @id @default(uuid())
  code                  String              @unique @db.VarChar(20)
  name                  String              @db.VarChar(100)
  isActive              Boolean             @default(true) @map("is_active")
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")

  @@map("contract_classes")
  @@index([isActive], map: "idx_contract_classes_active")
}

// -------------------------------------------------
// Contract Type (Reference -- lookup)
// -------------------------------------------------

model ContractType {
  id                    String              @id @default(uuid())
  code                  String              @unique @db.VarChar(20)
  name                  String              @db.VarChar(100)     // Permanent, Fixed-Term, Zero-Hours, Casual, Apprentice, Agency
  isActive              Boolean             @default(true) @map("is_active")
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")

  @@map("contract_types")
  @@index([isActive], map: "idx_contract_types_active")
}

// -------------------------------------------------
// Residency Type (Reference -- visa/work permit classification)
// -------------------------------------------------

model ResidencyType {
  id                    String              @id @default(uuid())
  code                  String              @unique @db.VarChar(20)
  name                  String              @db.VarChar(100)     // British Citizen, Settled Status, Pre-Settled, Tier 2, etc.
  isActive              Boolean             @default(true) @map("is_active")
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")

  @@map("residency_types")
  @@index([isActive], map: "idx_residency_types_active")
}

// -------------------------------------------------
// Employment Contract (Transactional -- lifecycle entity)
// -------------------------------------------------

model EmploymentContract {
  id                    String              @id @default(uuid())
  contractNumber        String              @unique @map("contract_number")         // "CTR-00001" via NumberSeries

  // -- Dates --
  transactionDate       DateTime            @map("transaction_date") @db.Date       // Creation date
  startDate             DateTime            @map("start_date") @db.Date             // Contract start (mandatory)
  endDate               DateTime?           @map("end_date") @db.Date               // Contract end (fixed-term; mandatory on termination)
  trialEndDate          DateTime?           @map("trial_end_date") @db.Date         // Probation end

  // -- Employee --
  employeeId            String              @map("employee_id")
  employee              Employee            @relation(fields: [employeeId], references: [id])

  // -- Role --
  jobTitleCode          String?             @map("job_title_code") @db.VarChar(20)
  jobTitleDescription   String?             @map("job_title_description") @db.VarChar(200)

  // -- Compensation --
  salaryFrequency       SalaryFrequency     @default(MONTHLY) @map("salary_frequency")
  grossSalary           Decimal             @map("gross_salary") @db.Decimal(19, 4)
  currencyCode          String              @default("GBP") @map("currency_code") @db.VarChar(3)
  hoursPerWeek          Decimal?            @map("hours_per_week") @db.Decimal(5, 2) // Contractual hours
  workHoursPerDay       Decimal?            @map("work_hours_per_day") @db.Decimal(5, 2) // For leave calculation

  // -- Classification --
  contractClassCode     String?             @map("contract_class_code") @db.VarChar(20)
  contractTypeCode      String?             @map("contract_type_code") @db.VarChar(20)
  departmentCode        String?             @map("department_code") @db.VarChar(20)
  leaveSchemeCode       String?             @map("leave_scheme_code") @db.VarChar(20)

  // -- Manager --
  superiorId            String?             @map("superior_id")                      // Manager employee ID

  // -- Status --
  status                ContractStatus      @default(DRAFT)
  terminationReason     TerminationReason?  @map("termination_reason")
  terminationDetails    String?             @map("termination_details") @db.Text
  noticeGivenDate       DateTime?           @map("notice_given_date") @db.Date
  noticePeriodWeeks     Int?                @map("notice_period_weeks")

  // -- Renewal / History --
  previousContractId    String?             @map("previous_contract_id")            // FK to previous/renewed contract
  previousContract      EmploymentContract? @relation("ContractRenewal", fields: [previousContractId], references: [id])
  renewedContracts      EmploymentContract[] @relation("ContractRenewal")

  // -- Notes --
  comment               String?             @db.Text

  // -- Standard Fields --
  approvedAt            DateTime?           @map("approved_at")
  approvedBy            String?             @map("approved_by")
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")
  createdBy             String              @map("created_by")
  updatedBy             String              @map("updated_by")

  // -- Relations --
  changes               ContractChange[]
  benefits              ContractBenefit[]

  @@map("employment_contracts")
  @@index([employeeId], map: "idx_employment_contracts_employee_id")
  @@index([status], map: "idx_employment_contracts_status")
  @@index([departmentCode], map: "idx_employment_contracts_department")
  @@index([startDate], map: "idx_employment_contracts_start_date")
  @@index([employeeId, status], map: "idx_employment_contracts_employee_active")
  @@index([previousContractId], map: "idx_employment_contracts_previous")
}

// -------------------------------------------------
// Contract Change (Immutable change history)
// -------------------------------------------------

model ContractChange {
  id                    String                @id @default(uuid())
  changeNumber          Int                   @map("change_number")               // Sequential per contract (1, 2, 3...)

  // -- Parent --
  contractId            String                @map("contract_id")
  contract              EmploymentContract    @relation(fields: [contractId], references: [id])

  // -- Change Details --
  effectiveDate         DateTime              @map("effective_date") @db.Date     // When this change takes effect
  reason                ContractChangeReason  @default(OTHER)
  description           String?               @db.Text                            // Free-text explanation

  // -- Changed Fields (nullable = unchanged) --
  jobTitleCode          String?               @map("job_title_code") @db.VarChar(20)
  jobTitleDescription   String?               @map("job_title_description") @db.VarChar(200)
  salaryFrequency       SalaryFrequency?      @map("salary_frequency")
  grossSalary           Decimal?              @map("gross_salary") @db.Decimal(19, 4)
  currencyCode          String?               @map("currency_code") @db.VarChar(3)
  hoursPerWeek          Decimal?              @map("hours_per_week") @db.Decimal(5, 2)
  departmentCode        String?               @map("department_code") @db.VarChar(20)
  contractClassCode     String?               @map("contract_class_code") @db.VarChar(20)
  leaveSchemeCode       String?               @map("leave_scheme_code") @db.VarChar(20)
  trialEndDate          DateTime?             @map("trial_end_date") @db.Date
  superiorId            String?               @map("superior_id")
  comment               String?               @db.Text

  // -- Approval --
  status                ContractStatus        @default(DRAFT)                     // DRAFT -> APPROVED
  approvedAt            DateTime?             @map("approved_at")
  approvedBy            String?               @map("approved_by")

  // -- Standard Fields --
  createdAt             DateTime              @default(now()) @map("created_at")
  updatedAt             DateTime              @updatedAt @map("updated_at")
  createdBy             String                @map("created_by")
  updatedBy             String                @map("updated_by")

  @@map("contract_changes")
  @@unique([contractId, changeNumber], map: "uq_contract_change_number")
  @@index([contractId], map: "idx_contract_changes_contract_id")
  @@index([contractId, effectiveDate], map: "idx_contract_changes_effective")
}

// -------------------------------------------------
// Benefit Type (Reference -- benefit templates with defaults)
// -------------------------------------------------

model BenefitType {
  id                    String              @id @default(uuid())
  code                  String              @unique @db.VarChar(20)
  name                  String              @db.VarChar(200)
  classification        String?             @db.VarChar(50)      // Health, Pension, Car, Phone, Gym, etc.
  terms                 String?             @db.Text
  defaultAmount         Decimal?            @map("default_amount") @db.Decimal(19, 4)
  defaultCurrencyCode   String              @default("GBP") @map("default_currency_code") @db.VarChar(3)
  defaultFrequency      BenefitFrequency?   @map("default_frequency")
  isTaxable             Boolean             @default(true) @map("is_taxable")      // P11D benefit-in-kind
  isActive              Boolean             @default(true) @map("is_active")
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")

  // -- Relations --
  contractBenefits      ContractBenefit[]

  @@map("benefit_types")
  @@index([isActive], map: "idx_benefit_types_active")
}

// -------------------------------------------------
// Contract Benefit (Row-level benefits on contracts)
// -------------------------------------------------

model ContractBenefit {
  id                    String              @id @default(uuid())

  // -- Parent --
  contractId            String              @map("contract_id")
  contract              EmploymentContract  @relation(fields: [contractId], references: [id], onDelete: Cascade)

  // -- Benefit --
  benefitTypeId         String              @map("benefit_type_id")
  benefitType           BenefitType         @relation(fields: [benefitTypeId], references: [id])

  // -- Details --
  amount                Decimal             @db.Decimal(19, 4)
  currencyCode          String              @default("GBP") @map("currency_code") @db.VarChar(3)
  frequency             BenefitFrequency
  startDate             DateTime?           @map("start_date") @db.Date
  endDate               DateTime?           @map("end_date") @db.Date

  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")

  @@map("contract_benefits")
  @@index([contractId], map: "idx_contract_benefits_contract_id")
  @@index([benefitTypeId], map: "idx_contract_benefits_benefit_type_id")
}

// -------------------------------------------------
// Appraisal Category (Reference -- lookup)
// -------------------------------------------------

model AppraisalCategory {
  id                    String              @id @default(uuid())
  code                  String              @unique @db.VarChar(20)
  name                  String              @db.VarChar(100)
  isActive              Boolean             @default(true) @map("is_active")
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")

  @@map("appraisal_categories")
  @@index([isActive], map: "idx_appraisal_categories_active")
}

// -------------------------------------------------
// Performance Factor (Reference -- what is evaluated)
// -------------------------------------------------

model PerformanceFactor {
  id                    String              @id @default(uuid())
  code                  String              @unique @db.VarChar(20)
  name                  String              @db.VarChar(200)     // "Communication", "Technical Skills", "Leadership"
  isActive              Boolean             @default(true) @map("is_active")
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")

  @@map("performance_factors")
  @@index([isActive], map: "idx_performance_factors_active")
}

// -------------------------------------------------
// Performance Rating (Reference -- rating scale)
// -------------------------------------------------

model PerformanceRating {
  id                    String              @id @default(uuid())
  code                  String              @unique @db.VarChar(20)
  name                  String              @db.VarChar(100)     // "Exceeds", "Meets", "Below", "Unsatisfactory"
  numericValue          Int?                @map("numeric_value") // For sorting/aggregation: 5, 4, 3, 2, 1
  isActive              Boolean             @default(true) @map("is_active")
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")

  @@map("performance_ratings")
  @@index([isActive], map: "idx_performance_ratings_active")
}

// -------------------------------------------------
// Performance Appraisal (Transactional -- factor + rating matrix)
// -------------------------------------------------

model PerformanceAppraisal {
  id                    String              @id @default(uuid())

  // -- Dates --
  appraisalDate         DateTime            @map("appraisal_date") @db.Date

  // -- Participants --
  employeeId            String              @map("employee_id")
  employee              Employee            @relation("AppraisalEmployee", fields: [employeeId], references: [id])
  reviewerId            String              @map("reviewer_id")
  reviewer              Employee            @relation("AppraisalReviewer", fields: [reviewerId], references: [id])

  // -- Classification --
  categoryCode          String?             @map("category_code") @db.VarChar(20)  // FK to AppraisalCategory

  // -- Status --
  status                AppraisalStatus     @default(DRAFT)
  comment               String?             @db.Text

  // -- Standard Fields --
  approvedAt            DateTime?           @map("approved_at")
  approvedBy            String?             @map("approved_by")
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")
  createdBy             String              @map("created_by")
  updatedBy             String              @map("updated_by")

  // -- Relations --
  lines                 AppraisalLine[]

  @@map("performance_appraisals")
  @@index([employeeId], map: "idx_appraisals_employee_id")
  @@index([reviewerId], map: "idx_appraisals_reviewer_id")
  @@index([appraisalDate], map: "idx_appraisals_date")
}

// -------------------------------------------------
// Appraisal Line (factor + rating row)
// -------------------------------------------------

model AppraisalLine {
  id                    String              @id @default(uuid())

  appraisalId           String              @map("appraisal_id")
  appraisal             PerformanceAppraisal @relation(fields: [appraisalId], references: [id], onDelete: Cascade)

  performanceFactorCode String              @map("performance_factor_code") @db.VarChar(20)
  performanceFactorName String?             @map("performance_factor_name") @db.VarChar(200) // Denormalised for history
  performanceRatingCode String              @map("performance_rating_code") @db.VarChar(20)
  performanceRatingName String?             @map("performance_rating_name") @db.VarChar(200) // Denormalised for history
  comment               String?             @db.Text

  @@map("appraisal_lines")
  @@index([appraisalId], map: "idx_appraisal_lines_appraisal_id")
}

// -------------------------------------------------
// Skill (Reference -- competency definitions)
// -------------------------------------------------

model Skill {
  id                    String              @id @default(uuid())
  code                  String              @unique @db.VarChar(20)
  name                  String              @db.VarChar(200)     // "TypeScript", "Project Management", "First Aid"
  category              String?             @db.VarChar(50)      // "Technical", "Soft Skills", "Compliance", etc.
  isActive              Boolean             @default(true) @map("is_active")
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")

  @@map("skills")
  @@index([isActive], map: "idx_skills_active")
}

// -------------------------------------------------
// Skill Rating (Reference -- proficiency levels)
// -------------------------------------------------

model SkillRating {
  id                    String              @id @default(uuid())
  code                  String              @unique @db.VarChar(20)
  name                  String              @db.VarChar(100)     // "Novice", "Competent", "Proficient", "Expert"
  numericValue          Int?                @map("numeric_value") // For sorting: 1, 2, 3, 4, 5
  isActive              Boolean             @default(true) @map("is_active")
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")

  @@map("skill_ratings")
  @@index([isActive], map: "idx_skill_ratings_active")
}

// -------------------------------------------------
// Skills Evaluation (Transactional -- skill + rating matrix)
// -------------------------------------------------

model SkillsEvaluation {
  id                    String              @id @default(uuid())

  // -- Dates --
  evaluationDate        DateTime            @map("evaluation_date") @db.Date

  // -- Employee --
  employeeId            String              @map("employee_id")
  employee              Employee            @relation(fields: [employeeId], references: [id])

  // -- Evaluator --
  evaluatorId           String              @map("evaluator_id")   // Supervisor who conducted evaluation

  // -- Context (snapshot from contract at time of evaluation) --
  jobTitleCode          String?             @map("job_title_code") @db.VarChar(20)
  jobTitleDescription   String?             @map("job_title_description") @db.VarChar(200)

  // -- Status --
  status                SkillsEvalStatus    @default(DRAFT)

  // -- Standard Fields --
  approvedAt            DateTime?           @map("approved_at")
  approvedBy            String?             @map("approved_by")
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")
  createdBy             String              @map("created_by")
  updatedBy             String              @map("updated_by")

  // -- Relations --
  lines                 SkillsEvaluationLine[]

  @@map("skills_evaluations")
  @@index([employeeId], map: "idx_skills_evaluations_employee_id")
  @@index([evaluationDate], map: "idx_skills_evaluations_date")
  @@index([employeeId, evaluationDate], map: "idx_skills_evaluations_employee_date")
  @@index([status], map: "idx_skills_evaluations_status")
}

// -------------------------------------------------
// Skills Evaluation Line (skill + rating row)
// -------------------------------------------------

model SkillsEvaluationLine {
  id                    String              @id @default(uuid())

  evaluationId          String              @map("evaluation_id")
  evaluation            SkillsEvaluation    @relation(fields: [evaluationId], references: [id], onDelete: Cascade)

  skillCode             String              @map("skill_code") @db.VarChar(20)
  skillName             String?             @map("skill_name") @db.VarChar(200)      // Denormalised
  ratingCode            String              @map("rating_code") @db.VarChar(20)
  ratingName            String?             @map("rating_name") @db.VarChar(200)      // Denormalised
  comment               String?             @db.Text

  @@map("skills_evaluation_lines")
  @@index([evaluationId], map: "idx_skills_eval_lines_evaluation_id")
  @@index([skillCode], map: "idx_skills_eval_lines_skill_code")
}

// -------------------------------------------------
// Checkpoint (Reference -- reusable checklist task templates)
// -------------------------------------------------

model Checkpoint {
  id                    String              @id @default(uuid())
  code                  String              @unique @db.VarChar(20)
  name                  String              @db.VarChar(200)     // "Issue laptop", "Set up email", "Return access card"
  defaultListType       ChecklistType?      @map("default_list_type") // Suggest for onboarding or offboarding
  isActive              Boolean             @default(true) @map("is_active")
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")

  @@map("checkpoints")
  @@index([isActive], map: "idx_checkpoints_active")
}

// -------------------------------------------------
// Checklist (Transactional -- onboarding / offboarding)
// -------------------------------------------------

model Checklist {
  id                    String              @id @default(uuid())

  // -- Employee --
  employeeId            String              @map("employee_id")
  employee              Employee            @relation(fields: [employeeId], references: [id])

  // -- Type --
  listType              ChecklistType       @default(ONBOARDING) @map("list_type")

  // -- Context --
  startDate             DateTime            @map("start_date") @db.Date
  jobTitleCode          String?             @map("job_title_code") @db.VarChar(20)
  jobTitleDescription   String?             @map("job_title_description") @db.VarChar(200)
  departmentCode        String?             @map("department_code") @db.VarChar(20)
  office                String?             @db.VarChar(100)
  superiorId            String?             @map("superior_id")

  // -- Offboarding specific --
  lastWorkingDay        DateTime?           @map("last_working_day") @db.Date
  lastEmploymentDay     DateTime?           @map("last_employment_day") @db.Date

  // -- Status --
  status                AppraisalStatus     @default(DRAFT)     // Reuses DRAFT/APPROVED pattern
  approvedAt            DateTime?           @map("approved_at")
  approvedBy            String?             @map("approved_by")

  // -- Standard Fields --
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")
  createdBy             String              @map("created_by")
  updatedBy             String              @map("updated_by")

  // -- Relations --
  items                 ChecklistItem[]

  @@map("checklists")
  @@index([employeeId], map: "idx_checklists_employee_id")
  @@index([listType], map: "idx_checklists_list_type")
}

// -------------------------------------------------
// Checklist Item (task row with status tracking)
// -------------------------------------------------

model ChecklistItem {
  id                    String              @id @default(uuid())

  checklistId           String              @map("checklist_id")
  checklist             Checklist           @relation(fields: [checklistId], references: [id], onDelete: Cascade)

  sortOrder             Int                 @map("sort_order")
  checkpointCode        String?             @map("checkpoint_code") @db.VarChar(20)  // FK to Checkpoint template
  description           String              @db.VarChar(500)                          // Task description (mandatory)
  responsibleId         String?             @map("responsible_id")                    // Employee responsible for task
  responsibleName       String?             @map("responsible_name") @db.VarChar(200) // Denormalised
  status                ChecklistItemStatus @default(PENDING)
  completedDate         DateTime?           @map("completed_date") @db.Date           // Auto-set when status = COMPLETED
  notes                 String?             @db.Text

  @@map("checklist_items")
  @@index([checklistId], map: "idx_checklist_items_checklist_id")
}

// -------------------------------------------------
// Job Position (Transactional -- organisational structure)
// -------------------------------------------------

model JobPosition {
  id                    String              @id @default(uuid())

  // -- Details --
  title                 String              @db.VarChar(200)
  departmentCode        String              @map("department_code") @db.VarChar(20)
  startDate             DateTime            @map("start_date") @db.Date
  endDate               DateTime?           @map("end_date") @db.Date
  headcount             Int                 @default(1)                               // Number of positions available

  // -- Status --
  status                JobPositionStatus   @default(OPENING)
  approvedAt            DateTime?           @map("approved_at")
  approvedBy            String?             @map("approved_by")

  // -- Standard Fields --
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")
  createdBy             String              @map("created_by")
  updatedBy             String              @map("updated_by")

  // -- Relations --
  incumbents            PositionIncumbent[]

  @@map("job_positions")
  @@index([departmentCode], map: "idx_job_positions_department")
  @@index([status], map: "idx_job_positions_status")
  @@index([startDate], map: "idx_job_positions_start_date")
}

// -------------------------------------------------
// Position Incumbent (Junction -- position <-> employee)
// -------------------------------------------------

model PositionIncumbent {
  id                    String              @id @default(uuid())

  positionId            String              @map("position_id")
  position              JobPosition         @relation(fields: [positionId], references: [id], onDelete: Cascade)

  employeeId            String              @map("employee_id")
  employee              Employee            @relation(fields: [employeeId], references: [id])

  startDate             DateTime            @map("start_date") @db.Date
  endDate               DateTime?           @map("end_date") @db.Date

  @@map("position_incumbents")
  @@index([positionId], map: "idx_position_incumbents_position_id")
  @@index([employeeId], map: "idx_position_incumbents_employee_id")
  @@unique([positionId, employeeId, startDate], map: "uq_position_incumbent")
}

// -------------------------------------------------
// Training Plan (Transactional -- scheduling & tracking)
// -------------------------------------------------

model TrainingPlan {
  id                    String              @id @default(uuid())

  // -- Primary Trainee --
  employeeId            String              @map("employee_id")
  employee              Employee            @relation("TraineeEmployee", fields: [employeeId], references: [id])

  // -- Training Details --
  topic                 String              @db.VarChar(300)                        // Mandatory
  description           String?             @db.Text
  trainerId             String?             @map("trainer_id")
  trainer               Employee?           @relation("TrainerEmployee", fields: [trainerId], references: [id])

  // -- Schedule --
  trainingDate          DateTime?           @map("training_date") @db.Date
  startTime             DateTime?           @map("start_time") @db.Time
  endTime               DateTime?           @map("end_time") @db.Time              // Mandatory if startTime set
  durationHours         Decimal?            @map("duration_hours") @db.Decimal(5, 2)

  // -- Status --
  status                TrainingStatus      @default(SCHEDULED)

  // -- Notes --
  comment               String?             @db.Text

  // -- Standard Fields --
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")
  createdBy             String              @map("created_by")
  updatedBy             String              @map("updated_by")

  @@map("training_plans")
  @@index([employeeId], map: "idx_training_plans_employee_id")
  @@index([trainerId], map: "idx_training_plans_trainer_id")
  @@index([trainingDate], map: "idx_training_plans_date")
  @@index([status], map: "idx_training_plans_status")
}

// -------------------------------------------------
// Payment Type (Reference -- payroll line item types)
// -------------------------------------------------

model PaymentType {
  id                    String              @id @default(uuid())
  code                  String              @unique @db.VarChar(20)
  name                  String              @db.VarChar(200)     // "Basic Salary", "Overtime", "Bonus", "Travel Allowance"
  classification        String?             @map("classification") @db.VarChar(20) // ADDITION, DEDUCTION, EMPLOYER_COST
  accountCode           String?             @map("account_code") @db.VarChar(20)   // Default GL account
  isTaxable             Boolean             @default(true) @map("is_taxable")
  isNIable              Boolean             @default(true) @map("is_niable")
  isPensionable         Boolean             @default(true) @map("is_pensionable")
  isActive              Boolean             @default(true) @map("is_active")
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")

  @@map("payment_types")
  @@index([isActive], map: "idx_payment_types_active")
}

// -------------------------------------------------
// Leave Entitlement (Transactional -- annual allocation per employee)
// -------------------------------------------------

model LeaveEntitlement {
  id                    String              @id @default(uuid())

  employeeId            String              @map("employee_id")
  employee              Employee            @relation(fields: [employeeId], references: [id])

  leaveType             LeaveType           @map("leave_type")
  leaveYear             Int                 @map("leave_year")                      // Tax year or calendar year
  entitlementDays       Decimal             @map("entitlement_days") @db.Decimal(5, 2) // Pro-rated for part-year joiners
  carriedForwardDays    Decimal             @default(0) @map("carried_forward_days") @db.Decimal(5, 2)
  adjustmentDays        Decimal             @default(0) @map("adjustment_days") @db.Decimal(5, 2) // Manual adjustments
  calculationBase       LeaveCalculationBase @default(CALENDAR_DAYS) @map("calculation_base")

  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")
  createdBy             String              @map("created_by")
  updatedBy             String              @map("updated_by")

  @@map("leave_entitlements")
  @@unique([employeeId, leaveType, leaveYear], map: "uq_leave_entitlement")
  @@index([employeeId], map: "idx_leave_entitlements_employee_id")
  @@index([leaveYear], map: "idx_leave_entitlements_year")
}

// -------------------------------------------------
// Leave Request (Transactional -- booking with approval)
// -------------------------------------------------

model LeaveRequest {
  id                    String              @id @default(uuid())

  employeeId            String              @map("employee_id")
  employee              Employee            @relation(fields: [employeeId], references: [id])

  leaveType             LeaveType           @map("leave_type")
  startDate             DateTime            @map("start_date") @db.Date
  endDate               DateTime            @map("end_date") @db.Date
  startHalfDay          Boolean             @default(false) @map("start_half_day")  // PM only on start date
  endHalfDay            Boolean             @default(false) @map("end_half_day")    // AM only on end date
  totalDays             Decimal             @map("total_days") @db.Decimal(5, 2)    // Calculated
  totalHours            Decimal?            @map("total_hours") @db.Decimal(7, 2)   // If hours-based

  // -- Status --
  status                LeaveRequestStatus  @default(PENDING)
  reason                String?             @db.Text
  rejectionReason       String?             @map("rejection_reason") @db.Text

  // -- Approval --
  approvedById          String?             @map("approved_by_id")
  approvedAt            DateTime?           @map("approved_at")

  // -- Standard Fields --
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")
  createdBy             String              @map("created_by")
  updatedBy             String              @map("updated_by")

  @@map("leave_requests")
  @@index([employeeId], map: "idx_leave_requests_employee_id")
  @@index([status], map: "idx_leave_requests_status")
  @@index([startDate, endDate], map: "idx_leave_requests_dates")
  @@index([employeeId, leaveType, startDate], map: "idx_leave_requests_employee_type_date")
}

// -------------------------------------------------
// Leave Balance (Maintained -- updated on request approval)
// -------------------------------------------------

model LeaveBalance {
  id                    String              @id @default(uuid())

  employeeId            String              @map("employee_id")
  employee              Employee            @relation(fields: [employeeId], references: [id])

  leaveType             LeaveType           @map("leave_type")
  leaveYear             Int                 @map("leave_year")
  totalEntitlement      Decimal             @map("total_entitlement") @db.Decimal(5, 2)   // entitlement + carried + adjustment
  usedDays              Decimal             @default(0) @map("used_days") @db.Decimal(5, 2)
  pendingDays           Decimal             @default(0) @map("pending_days") @db.Decimal(5, 2)   // Approved but not yet taken
  remainingDays         Decimal             @map("remaining_days") @db.Decimal(5, 2)              // Calculated: total - used - pending

  updatedAt             DateTime            @updatedAt @map("updated_at")

  @@map("leave_balances")
  @@unique([employeeId, leaveType, leaveYear], map: "uq_leave_balance")
  @@index([employeeId], map: "idx_leave_balances_employee_id")
}

// -------------------------------------------------
// Tax Year Config (HMRC thresholds -- seeded annually)
// -------------------------------------------------

model TaxYearConfig {
  id                    String              @id @default(uuid())
  taxYear               String              @unique @map("tax_year") @db.VarChar(9)  // "2025-2026"
  startDate             DateTime            @map("start_date") @db.Date              // 6 April
  endDate               DateTime            @map("end_date") @db.Date                // 5 April

  // -- Personal Allowance --
  personalAllowance     Decimal             @map("personal_allowance") @db.Decimal(19, 4)         // e.g., 12,570
  personalAllowanceTaper Decimal            @map("personal_allowance_taper") @db.Decimal(19, 4)   // Income above which PA reduces (100k)

  // -- Income Tax Bands (stored as JSON for flexibility) --
  incomeTaxBands        Json                @map("income_tax_bands")
  // Format: [{ "name": "Basic", "lowerLimit": 0, "upperLimit": 37700, "rate": 0.20 }, ...]

  // -- Scottish Tax Bands (if applicable) --
  scottishTaxBands      Json?               @map("scottish_tax_bands")

  // -- NI Thresholds --
  niPrimaryThreshold    Decimal             @map("ni_primary_threshold") @db.Decimal(19, 4)       // Employee NI starts
  niSecondaryThreshold  Decimal             @map("ni_secondary_threshold") @db.Decimal(19, 4)     // Employer NI starts
  niUpperEarningsLimit  Decimal             @map("ni_upper_earnings_limit") @db.Decimal(19, 4)    // Employee NI drops to 2%
  niLowerEarningsLimit  Decimal             @map("ni_lower_earnings_limit") @db.Decimal(19, 4)    // Qualifying earnings floor
  niEmployeeMainRate    Decimal             @map("ni_employee_main_rate") @db.Decimal(10, 6)      // e.g., 0.08
  niEmployeeReducedRate Decimal             @map("ni_employee_reduced_rate") @db.Decimal(10, 6)   // Above UEL: e.g., 0.02
  niEmployerRate        Decimal             @map("ni_employer_rate") @db.Decimal(10, 6)           // e.g., 0.138
  niEmploymentAllowance Decimal             @map("ni_employment_allowance") @db.Decimal(19, 4)    // Annual employer NI relief

  // -- NI Category-specific rates (JSON for flexibility) --
  niCategoryRates       Json                @map("ni_category_rates")
  // Format: { "A": { "employeeMain": 0.08, "employeeReduced": 0.02, "employer": 0.138 }, ... }

  // -- Student Loan Thresholds --
  studentLoanThresholds Json                @map("student_loan_thresholds")
  // Format: { "PLAN_1": { "annualThreshold": 22015, "rate": 0.09 }, "PLAN_2": { ... }, ... }

  // -- Statutory Pay Rates --
  sspWeeklyRate         Decimal             @map("ssp_weekly_rate") @db.Decimal(10, 4)
  sspQualifyingDays     Int                 @default(3) @map("ssp_qualifying_days")               // Waiting days
  sspLowerEarningsLimit Decimal             @map("ssp_lower_earnings_limit") @db.Decimal(19, 4)

  smpWeeklyRate         Decimal             @map("smp_weekly_rate") @db.Decimal(10, 4)
  smpHigherRateWeeks    Int                 @default(6) @map("smp_higher_rate_weeks")             // 90% pay period
  smpHigherRate         Decimal             @map("smp_higher_rate") @db.Decimal(10, 6)            // 0.90 (90%)
  smpTotalWeeks         Int                 @default(39) @map("smp_total_weeks")

  sppWeeklyRate         Decimal             @map("spp_weekly_rate") @db.Decimal(10, 4)
  sppTotalWeeks         Int                 @default(2) @map("spp_total_weeks")

  shppWeeklyRate        Decimal             @map("shpp_weekly_rate") @db.Decimal(10, 4)
  shppMaxWeeks          Int                 @default(37) @map("shpp_max_weeks")

  sapWeeklyRate         Decimal             @map("sap_weekly_rate") @db.Decimal(10, 4)
  sapTotalWeeks         Int                 @default(39) @map("sap_total_weeks")

  // -- Pension Auto-Enrolment --
  pensionAutoEnrolmentLowerQE   Decimal     @map("pension_ae_lower_qe") @db.Decimal(19, 4)       // Lower qualifying earnings
  pensionAutoEnrolmentUpperQE   Decimal     @map("pension_ae_upper_qe") @db.Decimal(19, 4)       // Upper qualifying earnings
  pensionAutoEnrolmentTrigger   Decimal     @map("pension_ae_trigger") @db.Decimal(19, 4)        // Earnings trigger for auto-enrolment
  pensionMinEmployeeRate        Decimal     @map("pension_min_employee_rate") @db.Decimal(10, 6)  // e.g., 0.05
  pensionMinEmployerRate        Decimal     @map("pension_min_employer_rate") @db.Decimal(10, 6)  // e.g., 0.03
  pensionMinTotalRate           Decimal     @map("pension_min_total_rate") @db.Decimal(10, 6)     // e.g., 0.08

  // -- National Minimum/Living Wage --
  minimumWageRates      Json                @map("minimum_wage_rates")
  // Format: { "23+": 11.44, "21-22": 11.44, "18-20": 8.60, "under18": 6.40, "apprentice": 6.40 }

  // -- Metadata --
  isActive              Boolean             @default(true) @map("is_active")
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")

  // -- Relations --
  payrollRuns           PayrollRun[]

  @@map("tax_year_configs")
  @@index([taxYear], map: "idx_tax_year_config_tax_year")
  @@index([isActive], map: "idx_tax_year_config_active")
}

// -------------------------------------------------
// Pension Enrolment (auto-enrolment tracking per employee)
// -------------------------------------------------

model PensionEnrolment {
  id                    String                  @id @default(uuid())

  employeeId            String                  @unique @map("employee_id")
  employee              Employee                @relation(fields: [employeeId], references: [id])

  // -- Scheme --
  schemeType            PensionSchemeType        @default(NEST) @map("scheme_type")
  schemeName            String?                 @map("scheme_name") @db.VarChar(200)
  schemeReference       String?                 @map("scheme_reference") @db.VarChar(100)   // Provider member ID
  contributionMethod    PensionContributionMethod @default(RELIEF_AT_SOURCE) @map("contribution_method")

  // -- Enrolment Status --
  status                PensionEnrolmentStatus  @default(ELIGIBLE_JOBHOLDER)
  assessmentDate        DateTime?               @map("assessment_date") @db.Date
  enrolmentDate         DateTime?               @map("enrolment_date") @db.Date
  optOutDate            DateTime?               @map("opt_out_date") @db.Date
  optOutWindowEnd       DateTime?               @map("opt_out_window_end") @db.Date         // 1 month after enrolment
  reEnrolmentDueDate    DateTime?               @map("re_enrolment_due_date") @db.Date      // Every 3 years

  // -- Contribution Rates --
  employeeRate          Decimal                 @map("employee_rate") @db.Decimal(10, 6)     // e.g., 0.05 (5%)
  employerRate          Decimal                 @map("employer_rate") @db.Decimal(10, 6)     // e.g., 0.03 (3%)
  salarySacrifice       Boolean                 @default(false) @map("salary_sacrifice")     // Pre-tax deduction

  // -- Standard Fields --
  createdAt             DateTime                @default(now()) @map("created_at")
  updatedAt             DateTime                @updatedAt @map("updated_at")
  createdBy             String                  @map("created_by")
  updatedBy             String                  @map("updated_by")

  @@map("pension_enrolments")
  @@index([status], map: "idx_pension_enrolments_status")
  @@index([reEnrolmentDueDate], map: "idx_pension_enrolments_re_enrolment_due")
}

// -------------------------------------------------
// Payroll Run (Transactional -- monthly/weekly batch header)
// -------------------------------------------------

model PayrollRun {
  id                    String              @id @default(uuid())
  runNumber             String              @unique @map("run_number")              // "PR-2026-01" via NumberSeries

  // -- Period --
  taxYearConfigId       String              @map("tax_year_config_id")
  taxYearConfig         TaxYearConfig       @relation(fields: [taxYearConfigId], references: [id])
  taxPeriod             Int                 @map("tax_period")                      // 1-12 (monthly) or 1-52 (weekly)
  frequency             PayrollFrequency    @default(MONTHLY)
  payDate               DateTime            @map("pay_date") @db.Date              // Date employees are paid
  periodStartDate       DateTime            @map("period_start_date") @db.Date
  periodEndDate         DateTime            @map("period_end_date") @db.Date

  // -- Totals (calculated) --
  totalGrossPay         Decimal             @default(0) @map("total_gross_pay") @db.Decimal(19, 4)
  totalPAYE             Decimal             @default(0) @map("total_paye") @db.Decimal(19, 4)
  totalEmployeeNI       Decimal             @default(0) @map("total_employee_ni") @db.Decimal(19, 4)
  totalEmployerNI       Decimal             @default(0) @map("total_employer_ni") @db.Decimal(19, 4)
  totalStudentLoan      Decimal             @default(0) @map("total_student_loan") @db.Decimal(19, 4)
  totalPensionEmployee  Decimal             @default(0) @map("total_pension_employee") @db.Decimal(19, 4)
  totalPensionEmployer  Decimal             @default(0) @map("total_pension_employer") @db.Decimal(19, 4)
  totalStatutoryPay     Decimal             @default(0) @map("total_statutory_pay") @db.Decimal(19, 4)
  totalNetPay           Decimal             @default(0) @map("total_net_pay") @db.Decimal(19, 4)
  employeeCount         Int                 @default(0) @map("employee_count")

  // -- Status --
  status                PayrollRunStatus    @default(DRAFT)
  calculatedAt          DateTime?           @map("calculated_at")
  approvedAt            DateTime?           @map("approved_at")
  approvedBy            String?             @map("approved_by")
  paidAt                DateTime?           @map("paid_at")
  postedAt              DateTime?           @map("posted_at")

  // -- GL Integration --
  journalEntryId        String?             @map("journal_entry_id")               // FK to JournalEntry (set on POSTED)

  // -- Bank --
  bankAccountId         String?             @map("bank_account_id")                // Paying bank account

  // -- Standard Fields --
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")
  createdBy             String              @map("created_by")
  updatedBy             String              @map("updated_by")

  // -- Relations --
  lines                 PayrollLine[]
  hmrcSubmissions       HMRCSubmission[]
  payslipDocuments      PayslipDocument[]

  @@map("payroll_runs")
  @@index([taxYearConfigId, taxPeriod], map: "idx_payroll_runs_year_period")
  @@index([status], map: "idx_payroll_runs_status")
  @@index([payDate], map: "idx_payroll_runs_pay_date")
  @@unique([taxYearConfigId, taxPeriod, frequency], map: "uq_payroll_run_period")
}

// -------------------------------------------------
// Payroll Line (per-employee calculation result)
// -------------------------------------------------

model PayrollLine {
  id                    String              @id @default(uuid())

  // -- Parent --
  payrollRunId          String              @map("payroll_run_id")
  payrollRun            PayrollRun          @relation(fields: [payrollRunId], references: [id], onDelete: Cascade)

  // -- Employee --
  employeeId            String              @map("employee_id")
  employee              Employee            @relation(fields: [employeeId], references: [id])

  // -- Line Detail --
  lineType              PayrollLineType     @map("line_type")
  paymentTypeCode       String?             @map("payment_type_code") @db.VarChar(20)  // FK to PaymentType (for additions/deductions)
  description           String              @db.VarChar(200)
  amount                Decimal             @db.Decimal(19, 4)                          // Positive = addition, Negative = deduction
  rate                  Decimal?            @db.Decimal(10, 6)                          // Rate used (e.g., tax rate, NI rate)
  units                 Decimal?            @db.Decimal(10, 2)                          // Hours, days, etc.

  // -- Tax Calculation Context --
  taxableFlag           Boolean             @default(true) @map("taxable_flag")
  niableFlag            Boolean             @default(true) @map("niable_flag")
  pensionableFlag       Boolean             @default(true) @map("pensionable_flag")

  // -- YTD Accumulators (snapshot at time of this payrun) --
  grossPayYTD           Decimal?            @map("gross_pay_ytd") @db.Decimal(19, 4)
  taxablePayYTD         Decimal?            @map("taxable_pay_ytd") @db.Decimal(19, 4)
  taxPaidYTD            Decimal?            @map("tax_paid_ytd") @db.Decimal(19, 4)
  niablePayYTD          Decimal?            @map("niable_pay_ytd") @db.Decimal(19, 4)
  employeeNIYTD         Decimal?            @map("employee_ni_ytd") @db.Decimal(19, 4)
  employerNIYTD         Decimal?            @map("employer_ni_ytd") @db.Decimal(19, 4)
  pensionEmployeeYTD    Decimal?            @map("pension_employee_ytd") @db.Decimal(19, 4)
  pensionEmployerYTD    Decimal?            @map("pension_employer_ytd") @db.Decimal(19, 4)
  studentLoanYTD        Decimal?            @map("student_loan_ytd") @db.Decimal(19, 4)

  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")

  @@map("payroll_lines")
  @@index([payrollRunId], map: "idx_payroll_lines_run_id")
  @@index([employeeId], map: "idx_payroll_lines_employee_id")
  @@index([payrollRunId, employeeId], map: "idx_payroll_lines_run_employee")
  @@index([lineType], map: "idx_payroll_lines_line_type")
}

// -------------------------------------------------
// Statutory Payment (SSP, SMP, SPP, ShPP, SAP tracking)
// -------------------------------------------------

model StatutoryPayment {
  id                    String              @id @default(uuid())

  employeeId            String              @map("employee_id")
  employee              Employee            @relation(fields: [employeeId], references: [id])

  paymentType           StatutoryPayType    @map("payment_type")

  // -- Qualifying Period --
  startDate             DateTime            @map("start_date") @db.Date
  endDate               DateTime?           @map("end_date") @db.Date
  totalWeeksEntitled    Int                 @map("total_weeks_entitled")
  weeksUsed             Int                 @default(0) @map("weeks_used")
  weeklyRate            Decimal             @map("weekly_rate") @db.Decimal(10, 4)

  // -- SSP-specific --
  waitingDaysServed     Int?                @map("waiting_days_served")              // SSP: 3 qualifying days
  linkedPeriod          Boolean             @default(false) @map("linked_period")    // SSP: linked sickness

  // -- SMP/SPP/ShPP/SAP-specific --
  qualifyingWeekDate    DateTime?           @map("qualifying_week_date") @db.Date    // EWC - 15 weeks (SMP)
  expectedDate          DateTime?           @map("expected_date") @db.Date           // Expected week of childbirth / placement
  averageWeeklyEarnings Decimal?            @map("average_weekly_earnings") @db.Decimal(19, 4)

  // -- KIT/SPLIT Days --
  kitDaysUsed           Int?                @map("kit_days_used")                    // SMP: 10 KIT days allowed
  splitDaysUsed         Int?                @map("split_days_used")                  // ShPP: 20 SPLIT days allowed

  // -- Status --
  isActive              Boolean             @default(true) @map("is_active")

  // -- Standard Fields --
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")
  createdBy             String              @map("created_by")
  updatedBy             String              @map("updated_by")

  @@map("statutory_payments")
  @@index([employeeId], map: "idx_statutory_payments_employee_id")
  @@index([paymentType], map: "idx_statutory_payments_type")
  @@index([employeeId, paymentType, isActive], map: "idx_statutory_payments_employee_active")
}

// -------------------------------------------------
// HMRC Submission (FPS / EPS / P45 tracking)
// -------------------------------------------------

model HMRCSubmission {
  id                    String                @id @default(uuid())

  // -- Type --
  submissionType        HMRCSubmissionType    @map("submission_type")

  // -- Reference --
  payrollRunId          String?               @map("payroll_run_id")
  payrollRun            PayrollRun?           @relation(fields: [payrollRunId], references: [id])
  taxYear               String                @map("tax_year") @db.VarChar(9)         // "2025-2026"
  taxPeriod             Int?                  @map("tax_period")

  // -- Employer --
  employerPAYERef       String                @map("employer_paye_ref") @db.VarChar(20) // e.g., "123/A456"
  accountsOfficeRef     String                @map("accounts_office_ref") @db.VarChar(20)

  // -- Status --
  status                HMRCSubmissionStatus  @default(DRAFT)

  // -- Submission Details --
  xmlPayload            String?               @map("xml_payload") @db.Text              // Generated RTI XML
  submittedAt           DateTime?             @map("submitted_at")
  responseCode          String?               @map("response_code") @db.VarChar(50)
  responseMessage       String?               @map("response_message") @db.Text
  hmrcCorrelationId     String?               @map("hmrc_correlation_id") @db.VarChar(100)  // HMRC tracking ID
  errorDetails          String?               @map("error_details") @db.Text

  // -- EPS-specific fields --
  noPaymentDates        Json?                 @map("no_payment_dates")                   // EPS: periods with no employees paid
  recoveredSSP          Decimal?              @map("recovered_ssp") @db.Decimal(19, 4)
  recoveredSMP          Decimal?              @map("recovered_smp") @db.Decimal(19, 4)
  nicCompensation       Decimal?              @map("nic_compensation") @db.Decimal(19, 4)

  // -- Standard Fields --
  createdAt             DateTime              @default(now()) @map("created_at")
  updatedAt             DateTime              @updatedAt @map("updated_at")
  createdBy             String                @map("created_by")
  updatedBy             String                @map("updated_by")

  @@map("hmrc_submissions")
  @@index([payrollRunId], map: "idx_hmrc_submissions_payroll_run_id")
  @@index([submissionType, taxYear], map: "idx_hmrc_submissions_type_year")
  @@index([status], map: "idx_hmrc_submissions_status")
}

// -------------------------------------------------
// Payslip Document (generated PDF reference)
// -------------------------------------------------

model PayslipDocument {
  id                    String              @id @default(uuid())
  payslipNumber         String              @unique @map("payslip_number")          // "PSL-2026-01-001" via NumberSeries

  // -- References --
  payrollRunId          String              @map("payroll_run_id")
  payrollRun            PayrollRun          @relation(fields: [payrollRunId], references: [id])
  employeeId            String              @map("employee_id")
  employee              Employee            @relation(fields: [employeeId], references: [id])

  // -- Payslip Summary --
  payDate               DateTime            @map("pay_date") @db.Date
  taxPeriod             Int                 @map("tax_period")
  grossPay              Decimal             @map("gross_pay") @db.Decimal(19, 4)
  totalDeductions       Decimal             @map("total_deductions") @db.Decimal(19, 4)
  netPay                Decimal             @map("net_pay") @db.Decimal(19, 4)

  // -- Document --
  documentTemplateId    String?             @map("document_template_id")            // FK to DocumentTemplate (for PDF generation)
  fileReference         String?             @map("file_reference") @db.VarChar(500) // S3 key or local path
  generatedAt           DateTime?           @map("generated_at")

  // -- Distribution --
  emailedAt             DateTime?           @map("emailed_at")
  downloadedAt          DateTime?           @map("downloaded_at")

  // -- Standard Fields --
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")
  createdBy             String              @map("created_by")
  updatedBy             String              @map("updated_by")

  @@map("payslip_documents")
  @@index([payrollRunId], map: "idx_payslip_documents_payroll_run_id")
  @@index([employeeId], map: "idx_payslip_documents_employee_id")
  @@index([payDate], map: "idx_payslip_documents_pay_date")
  @@unique([payrollRunId, employeeId], map: "uq_payslip_run_employee")
}

// -------------------------------------------------
// HR Module Settings (JSON-typed module configuration)
// -------------------------------------------------

model HrModuleSetting {
  id          String    @id @default(uuid())
  key         String    @unique @db.VarChar(100)    // Setting key, e.g., "hr.leaveCarryForwardMaxDays"
  value       Json                                   // Setting value (typed in application layer)
  description String?   @db.VarChar(500)

  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  updatedBy   String    @map("updated_by")

  @@map("hr_module_settings")
}
```

---

#### Employment Contract Lifecycle

```
                 +------------------------------------------------------+
                 |          EMPLOYMENT CONTRACT LIFECYCLE                |
                 +------------------------------------------------------+

  +----------+    Approve     +-----------+    Contract Changes    +--------------+
  |  DRAFT   | ------------> | APPROVED  | --------------------> |  APPROVED    |
  +----------+               +-----------+    (immutable records)  |  (modified)  |
       |                          |                               +------+-------+
       | Delete                   | Terminate                            | Terminate
       v                          v                                      v
  (removed)                 +--------------+                      +--------------+
                            |  TERMINATED  |                      |  TERMINATED  |
                            +--------------+                      +--------------+
                                   |
                                   | Cascades:
                                   +-- Close all open TrainingPlans (status -> CLOSED)
                                   +-- Mark SkillsEvaluations as TERMINATED
                                   +-- Auto-create OFFBOARDING Checklist

  Contract Changes create immutable records. The latest approved change
  "overlays" onto the contract -- reports and queries always use:
    FindLatestChange(contractId, asOfDate) -> effective values for salary,
    department, job title, etc.
```

**Contract Change Overlay Logic:**

When reporting or displaying an employment contract, the system finds the latest approved `ContractChange` with `effectiveDate <= reportDate` and overlays its non-null fields onto the original contract values. This means the "current" salary for an employee is not necessarily what is on the contract header but the latest change record's `grossSalary`. This pattern is critical for:

1. **Payroll calculation** -- Uses the effective salary as of the pay period end date.
2. **Org charts** -- Uses the effective department as of today.
3. **Point-in-time reporting** -- Can answer "what was this employee's salary on 1 Jan 2025?" by finding the latest change before that date.
4. **Audit trail** -- Every change is preserved with date, reason, and approver.

---

#### UK Payroll Processing Workflow

```
  +---------------------------------------------------------------------+
  |                     MONTHLY PAYROLL RUN                              |
  +---------------------------------------------------------------------+

  Step 1: CREATE RUN
  +---------------------------------------------------------------------+
  | PayrollRun created for tax period (e.g., Month 10, 2025-2026)       |
  | Status: DRAFT                                                        |
  | System identifies all ACTIVE employees in scope                      |
  +-------------------------------+-------------------------------------+
                                  |
  Step 2: CALCULATE               v
  +---------------------------------------------------------------------+
  | For each employee:                                                   |
  |                                                                      |
  | a. Determine gross pay from contract (with change overlay)           |
  | b. Add variable pay: overtime, bonus, commission, allowances         |
  | c. Deduct salary sacrifice (pre-tax: pension, cycle-to-work)         |
  | d. Calculate PAYE tax:                                               |
  |    - Look up tax code -> annual free pay                             |
  |    - Calculate cumulative taxable pay (gross YTD - free pay YTD)     |
  |    - Apply tax bands from TaxYearConfig                              |
  |    - Cumulative tax due - tax paid YTD = this period's PAYE         |
  |    - Handle Week1/Month1 (non-cumulative) and emergency codes       |
  | e. Calculate National Insurance:                                     |
  |    - Apply NICategory-specific thresholds and rates                  |
  |    - Employee NI: earnings between PT and UEL at main rate,         |
  |      earnings above UEL at reduced rate                              |
  |    - Employer NI: earnings above ST at employer rate                 |
  |    - Director annual method (if directorFlag)                        |
  | f. Calculate student loan deduction:                                 |
  |    - Apply threshold and rate for the employee's loan plan           |
  | g. Calculate pension contribution:                                   |
  |    - Qualifying earnings = gross between lower QE and upper QE       |
  |    - Employee contribution = qualifying x employeeRate               |
  |    - Employer contribution = qualifying x employerRate               |
  |    - Handle relief-at-source vs net-pay method                       |
  | h. Calculate statutory pay (if applicable):                          |
  |    - SSP, SMP, SPP, ShPP, SAP with qualifying rules                |
  | i. Calculate net pay:                                                |
  |    Net = Gross - PAYE - Employee NI - Student Loan                   |
  |         - Employee Pension - Salary Sacrifice                        |
  |         - Other Deductions + Statutory Pay                           |
  |                                                                      |
  | PayrollLine records created for each calculation component           |
  | YTD accumulators snapshotted on each line                            |
  | Status: CALCULATED                                                   |
  +-------------------------------+-------------------------------------+
                                  |
  Step 3: REVIEW                  v
  +---------------------------------------------------------------------+
  | Payroll manager reviews:                                             |
  | - Exceptions report (new starters, leavers, large variances)         |
  | - Comparison to previous period                                      |
  | - Individual employee drill-down                                     |
  | Status: REVIEWED                                                     |
  +-------------------------------+-------------------------------------+
                                  |
  Step 4: APPROVE                 v
  +---------------------------------------------------------------------+
  | Authorised approver confirms payroll                                 |
  | Requires 'hr.payroll.approve' permission                             |
  | Status: APPROVED                                                     |
  +-------------------------------+-------------------------------------+
                                  |
  Step 5: PAY                     v
  +---------------------------------------------------------------------+
  | Generate BACS file for net pay to employee bank accounts             |
  | Generate payslip PDFs (PayslipDocument)                              |
  | Email payslips to employees                                          |
  | Status: PAID                                                         |
  +-------------------------------+-------------------------------------+
                                  |
  Step 6: POST TO GL              v
  +---------------------------------------------------------------------+
  | Create JournalEntry via GL Posting Template:                         |
  |   DR  7000  Wages & Salaries (gross pay)                             |
  |   DR  7001  Employer NI Expense                                      |
  |   DR  7002  Employer Pension Expense                                 |
  |   CR  2210  PAYE/NI Liability                                        |
  |   CR  2211  Pension Liability                                        |
  |   CR  2212  Student Loan Liability                                   |
  |   CR  1200  Bank (net pay)                                           |
  | Status: POSTED                                                       |
  +-------------------------------+-------------------------------------+
                                  |
  Step 7: RTI SUBMISSION          v
  +---------------------------------------------------------------------+
  | Generate FPS (Full Payment Submission) XML:                          |
  | - Per-employee: NI number, tax code, gross pay, tax deducted,       |
  |   NI contributions, student loan, pension, statutory pay, etc.      |
  | Submit to HMRC Gateway (on or before pay date)                       |
  | HMRCSubmission record tracks: SUBMITTED -> ACCEPTED/REJECTED        |
  |                                                                      |
  | At period end, generate EPS if:                                      |
  | - Recovering statutory pay                                           |
  | - Claiming Employment Allowance                                      |
  | - No employees paid in a period                                      |
  +---------------------------------------------------------------------+
```

---

#### Business Rules

- **BR-EMP-001:** Employee number is mandatory and auto-generated from the HR Number Series on creation. Manual override is not permitted.
- **BR-EMP-002:** An Employee must have `firstName`, `lastName`, and `dateOfBirth` populated. NI number format (if provided) must match the pattern `QQ 12 34 56 A`.
- **BR-EMP-003:** An Employee's status transitions are: ACTIVE -> ON_LEAVE, ACTIVE -> SUSPENDED, ACTIVE -> TERMINATED, ACTIVE -> RETIRED. Terminated/retired employees cannot be reactivated.
- **BR-EMP-004:** Bank details (sortCode, accountNumber) are required before an employee can be included in a payroll run.
- **BR-CTR-001:** Only one active (APPROVED, non-TERMINATED) employment contract per employee at a time.
- **BR-CTR-002:** StartDate is mandatory on all contracts.
- **BR-CTR-003:** Termination requires TerminationReason, EndDate, and TerminationDetails (all mandatory).
- **BR-CTR-004:** Approved contracts cannot be deleted; they can only be terminated.
- **BR-CTR-005:** Contract changes can only be created from an APPROVED contract.
- **BR-CTR-006:** Changes are immutable once approved; they cannot be edited or deleted.
- **BR-CTR-007:** Termination cascades: close all open training plans for the employee (status -> CLOSED), mark all skills evaluations as TERMINATED, and auto-create an OFFBOARDING checklist.
- **BR-CTR-008:** Draft contracts can be freely edited and deleted.
- **BR-CTR-009:** Notice period must comply with UK statutory minimum (1 week per year of service, minimum 1 week, maximum 12 weeks).
- **BR-CTR-010:** Fixed-term contracts (contractTypeCode = 'FIXED') must have an EndDate.
- **BR-APR-001:** At least one appraisal line (factor + rating) is required when approving a Performance Appraisal.
- **BR-APR-002:** Both Employee and Reviewer must be valid, active employees.
- **BR-APR-003:** Employee and Reviewer must be different persons.
- **BR-APR-004:** Approved appraisals cannot be deleted.
- **BR-SKL-001:** At least one skill line (skill + rating) is required when approving a Skills Evaluation.
- **BR-SKL-002:** TerminatedFlag is automatically set when the employee's contract is terminated.
- **BR-SKL-003:** Auto-populate from the latest evaluation for the same employee (if one exists) when creating a new evaluation.
- **BR-CHK-001:** At least one checklist item is required when approving a Checklist.
- **BR-CHK-002:** ListType is auto-detected from the employee's contract termination status. If the employee has a terminated contract, the checklist defaults to OFFBOARDING.
- **BR-CHK-003:** CompletedDate is auto-set to the current date when a checklist item status is changed to COMPLETED.
- **BR-CHK-004:** Duplicating a checklist clears the employee-specific data and resets all item statuses to PENDING.
- **BR-TRN-001:** Employee and Topic are mandatory on training plans.
- **BR-TRN-002:** Trainer and Employee cannot be the same person.
- **BR-TRN-003:** EndTime is mandatory if StartTime is set.
- **BR-TRN-004:** Double-booking detection: the system checks for time conflicts across all training plans for the same person (as trainee or trainer). Overlapping time slots are rejected.
- **BR-TRN-005:** Training plans are auto-closed (status -> CLOSED) when the employee's contract is terminated.
- **BR-LEV-001:** UK statutory minimum leave entitlement is 28 days (5.6 weeks) including bank holidays for full-time employees.
- **BR-LEV-002:** Pro-rata entitlement for part-time workers is calculated based on the hoursPerWeek ratio.
- **BR-LEV-003:** Pro-rata entitlement for mid-year joiners is calculated based on remaining months in the leave year.
- **BR-LEV-004:** Leave request cannot exceed the remaining balance in LeaveBalance.
- **BR-LEV-005:** Overlapping leave requests for the same employee are rejected.
- **BR-LEV-006:** A manager cannot approve their own leave requests. Leave approval must be performed by a different user.
- **BR-LEV-007:** Approved leave requests update LeaveBalance: pendingDays increases, remainingDays decreases.
- **BR-LEV-008:** When an approved leave request is marked as TAKEN, LeaveBalance updates: usedDays increases, pendingDays decreases.
- **BR-LEV-009:** Carry-forward days are capped at the system setting `hr.leaveCarryForwardMaxDays` (default: 5 days).
- **BR-PAY-001:** Once a payroll run is APPROVED, it cannot be modified. Corrections must be made via the next payroll run or a supplementary run.
- **BR-PAY-002:** PAYE is calculated cumulatively (unless the employee has Week1/Month1 tax basis).
- **BR-PAY-003:** National Insurance is calculated per pay period (not cumulative), except for directors where the annual method applies.
- **BR-PAY-004:** Directors may use the NI annual method: pro-rata to the period during the year, then true-up at year end.
- **BR-PAY-005:** Student loan deduction applies when the employee's earnings exceed the plan-specific threshold per period.
- **BR-PAY-006:** Pension auto-enrolment: eligible jobholders (aged 22+ to state pension age, earning above the trigger) must be enrolled automatically.
- **BR-PAY-007:** Pension opt-out window is 1 calendar month from the enrolment date. Contributions paid during this window must be refunded if the employee opts out.
- **BR-PAY-008:** Re-enrolment of opted-out employees is required every 3 years.
- **BR-PAY-009:** SSP is payable after 3 qualifying days, for up to 28 weeks, only if average weekly earnings (AWE) are at or above the lower earnings limit (LEL).
- **BR-PAY-010:** SMP is payable at 90% of AWE for the first 6 weeks (higher rate), then at the statutory rate or 90% of AWE (whichever is lower) for the remaining weeks.
- **BR-PAY-011:** FPS (Full Payment Submission) must be submitted to HMRC on or before the payment date.
- **BR-PAY-012:** EPS (Employer Payment Summary) is due by the 19th of the following tax month.
- **BR-PAY-013:** Tax code changes from HMRC must be applied from the effective date specified. The system recalculates on the next payroll run.
- **BR-PAY-014:** National Minimum Wage: the system must flag if the calculated hourly rate for any employee falls below the NMW threshold for their age band.
- **BR-PAY-015:** Salary sacrifice cannot reduce an employee's effective pay below the National Minimum Wage.
- **BR-PAY-016:** P45 must be generated within 14 days of employment ending.
- **BR-PAY-017:** Payroll run status transitions are strictly ordered: DRAFT -> CALCULATED -> REVIEWED -> APPROVED -> PAID -> POSTED. CANCELLED can be reached from DRAFT or CALCULATED only.
- **BR-PAY-018:** GL posting creates a balanced journal entry (debits = credits). The PayrollRun.journalEntryId is set and the status transitions to POSTED.
- **BR-JP-001:** Job Position EndDate must be greater than or equal to StartDate.
- **BR-JP-002:** A position's headcount determines the maximum number of active PositionIncumbent records.

---

#### Number Series Configuration

The HR & Payroll module registers the following number series entries in the system-level `NumberSeries` table (section 2.8). These are seeded during tenant provisioning and configurable by the administrator.

| Series Key | Prefix | Example | Description |
|---|---|---|---|
| `EMPLOYEE` | EMP- | EMP-00001 | Employee sequential numbers |
| `CONTRACT` | CTR- | CTR-00001 | Employment contract sequential numbers |
| `PAYROLL_RUN` | PR- | PR-2026-01 | Payroll run numbers (includes tax year and period for readability) |
| `PAYSLIP` | PSL- | PSL-2026-01-001 | Payslip numbers (includes payroll run reference and per-employee sequence) |

---

#### Settings / Module Configuration

The `HrModuleSetting` table stores all configurable parameters for the HR & Payroll module. Settings are seeded during tenant provisioning with sensible UK defaults and managed by administrators via the HR Settings UI.

| Setting Key | Default Value | Description |
|---|---|---|
| `hr.leaveCalculationBase` | `"CALENDAR_DAYS"` | How leave is calculated: CALENDAR_DAYS or WORKING_HOURS |
| `hr.leaveCarryForwardMaxDays` | `5` | Maximum annual leave days that can be carried forward to next year |
| `hr.defaultLeaveEntitlementDays` | `28` | UK statutory default for full-time employees (including bank holidays) |
| `hr.trainingPlan.defaultStatus` | `"SCHEDULED"` | Default status for new training plans |
| `hr.trainingPlan.completedStatus` | `"COMPLETED"` | Status code meaning "completed" |
| `hr.trainingPlan.closedStatus` | `"CLOSED"` | Status applied when auto-closing due to contract termination |
| `hr.payroll.defaultFrequency` | `"MONTHLY"` | Default payroll frequency for new payroll runs |
| `hr.payroll.bacsServiceUserNumber` | `null` | BACS service user number for payment file generation |
| `hr.payroll.bacsSortCode` | `null` | BACS originating sort code |
| `hr.payroll.employerPAYERef` | `null` | HMRC PAYE reference (e.g., "123/A456") |
| `hr.payroll.accountsOfficeRef` | `null` | HMRC Accounts Office reference |
| `hr.payroll.glExpenseAccount` | `"7000"` | Default GL account for payroll expense (wages & salaries) |
| `hr.payroll.glEmployerNIAccount` | `"7001"` | Default GL account for employer NI expense |
| `hr.payroll.glEmployerPensionAccount` | `"7002"` | Default GL account for employer pension expense |
| `hr.payroll.glPAYELiabilityAccount` | `"2210"` | Default GL account for PAYE/NI liability |
| `hr.payroll.glPensionLiabilityAccount` | `"2211"` | Default GL account for pension liability |
| `hr.payroll.glStudentLoanAccount` | `"2212"` | Default GL account for student loan liability |
| `hr.pension.defaultSchemeType` | `"NEST"` | Default pension scheme for auto-enrolment |
| `hr.pension.defaultContributionMethod` | `"RELIEF_AT_SOURCE"` | Default contribution method |
| `hr.pension.defaultEmployeeRate` | `0.05` | Default employee pension contribution rate (5%) |
| `hr.pension.defaultEmployerRate` | `0.03` | Default employer pension contribution rate (3%) |
| `hr.contract.autoCreateOffboardingChecklist` | `true` | Auto-create offboarding checklist on contract termination |
| `hr.contract.requireApprovalForTermination` | `true` | Whether contract termination requires separate approval |
| `hr.noticePeriod.defaultWeeks` | `4` | Default notice period in weeks (when not set on contract) |

---

#### Cross-Module Integration Points

| Integration | From | To | Mechanism | Notes |
|---|---|---|---|---|
| Department reference | HR | System (section 2.10) | `Department.code` referenced by Employee, Contract, JobPosition | HR reads |
| Currency reference | HR | System (section 2.10) | `Currency.code` referenced by Contract, Benefit, PayrollRun | HR reads |
| Number series | HR | System (section 2.8) | `NumberSeries` for EMP-, CTR-, PR-, PSL- prefixes | HR reads/writes |
| GL posting | HR | Finance (section 2.13) | `JournalEntry` + `JournalLine` created on payroll POSTED | HR writes |
| GL account mapping | HR | Finance (section 2.13) | `AccountMapping` lookups for payroll GL accounts | HR reads |
| Financial period validation | HR | Finance (section 2.13) | `FinancialPeriod` validation for payroll posting date | HR reads |
| Bank account reference | HR | Finance (section 2.13) | `BankAccount` for BACS payment file generation | HR reads |
| CRM activities | HR | Cross-Cutting (section 2.20) | Activities linked to contracts, appraisals via record links | HR writes |
| Document templates | HR | Document Templates (section 2.12) | Payslip PDF, contract PDF, P45/P60 via template engine | HR reads |
| Approval workflow | HR | Cross-Cutting (section 2.20) | `ApprovalRule` for contract approval, leave approval, payroll approval | HR reads/writes |

---

#### Reports (MVP Scope)

| Report | Description | Key Filters | Output |
|---|---|---|---|
| Employee List | All employees with department, status, start date | Department, status, date range | Tabular with drill-down |
| Employment Contract List | Contracts with change overlay, filtering by department/class/status | Contract number, employee, department, class, job title, date range, include terminated | Summary or detailed (with changes) |
| Employment Contract Data | Detailed single-contract report with full change history | Contract number or range | Full contract detail with all changes overlaid |
| Skills Evaluation Report | Competency report by employee or by skill, point-in-time | Employee, skill, rating, as-of date, current employees only | By Employee (skill list) or By Skill (employee list) |
| Employee Statistics | Multi-section employee profile (contracts, changes, appraisals, leave) | Employee, date period | Configurable sections per user |
| Employee Training | Training plans with participants and status | Employee, topic, status, trainer, date period | Training detail with all participants |
| Leave Balance | Current leave balances by employee and type | Employee, leave year, leave type | Entitlement, used, pending, remaining |
| Payroll Summary | Payroll run totals by period | Tax year, period, frequency | Gross, PAYE, NI, pension, net totals |
| P45/P60 Generation | Statutory forms for leavers/year-end | Employee, tax year | PDF document via DocumentTemplate |

**Deferred to P2:**
- Gender Pay Gap Report (average/median pay analysis by gender)
- Headcount Trends Report (joiners, leavers, headcount over time)
- Absence Analysis Report (Bradford Factor, absence patterns)
- Skills Gap Analysis (required vs actual skills by department/role)

---

#### Build Sequence & Dependencies

The HR & Payroll module is targeted for a later story in the implementation sequence due to its dependency on multiple foundation modules.

| Dependency | Module | Must Be Complete | Reason |
|---|---|---|---|
| Department model | System (section 2.10) | Full CRUD | departmentCode FK on Employee, Contract, JobPosition |
| Currency model | System (section 2.10) | Reference data | currencyCode FK on Contract, Benefit |
| NumberSeries | System (section 2.8) | Functional | Auto-numbering for EMP-, CTR-, PR-, PSL- prefixes |
| User (auth) | Auth / System | Reference data | createdBy, updatedBy, approvedBy on all entities |
| JournalEntry model | Finance (section 2.13) | Full CRUD | Payroll GL posting creates journal entries |
| AccountMapping | Finance (section 2.13) | Reference data | GL account lookups for payroll posting |
| FinancialPeriod | Finance (section 2.13) | Functional | Validates payroll posting dates |
| BankAccount | Finance (section 2.13) | Reference data | BACS payment file references paying bank |
| DocumentTemplate | Document Templates (section 2.12) | Functional | Payslip PDF, contract PDF, P45/P60 generation |
| ApprovalRule engine | Cross-Cutting (section 2.20) | Functional | Contract approval, leave approval, payroll approval workflows |
| Event bus | System (Story 3) | Functional | Termination cascade, auto-checklist creation |

**Recommended build order within the HR & Payroll module:**

1. Reference entities: JobTitle, ContractClass, ContractType, BenefitType, ResidencyType, Skill, SkillRating, PerformanceFactor, PerformanceRating, AppraisalCategory, Checkpoint, PaymentType (seed data included)
2. HrModuleSetting (seed defaults for leave, training, payroll, pension)
3. Employee (full CRUD, import from legacy contacts, validation rules BR-EMP-001 through BR-EMP-004)
4. EmploymentContract + ContractChange + ContractBenefit (full lifecycle, change overlay, termination cascade: BR-CTR-001 through BR-CTR-010)
5. LeaveEntitlement + LeaveRequest + LeaveBalance (entitlement calculation, balance tracking, approval: BR-LEV-001 through BR-LEV-009)
6. Checklist + ChecklistItem (onboarding/offboarding, checkpoint templates, status tracking: BR-CHK-001 through BR-CHK-004)
7. PerformanceAppraisal + AppraisalLine (factor/rating matrix, approval: BR-APR-001 through BR-APR-004)
8. SkillsEvaluation + SkillsEvaluationLine (skill/rating matrix, auto-populate, termination cascade: BR-SKL-001 through BR-SKL-003)
9. TrainingPlan (scheduling, double-booking detection, termination auto-close: BR-TRN-001 through BR-TRN-005)
10. JobPosition + PositionIncumbent (organisational structure: BR-JP-001, BR-JP-002)
11. TaxYearConfig (seed HMRC annual thresholds and rates)
12. PayrollRun + PayrollLine (UK payroll engine core calculations: BR-PAY-001 through BR-PAY-005)
13. PensionEnrolment (auto-enrolment assessment, opt-out tracking: BR-PAY-006 through BR-PAY-008)
14. StatutoryPayment (SSP, SMP, SPP, ShPP, SAP with qualifying rules: BR-PAY-009, BR-PAY-010)
15. HMRCSubmission (FPS, EPS, P45 generation and submission: BR-PAY-011, BR-PAY-012, BR-PAY-016)
16. PayslipDocument (PDF via DocumentTemplate, email distribution)
17. BACS file generation (net pay payment file for employee bank accounts)
18. GL posting (JournalEntry creation from approved payroll runs: BR-PAY-018)

---

*End of section 2.22*

---

*End of section 2.22*

### 2.23 Production & MRP Module -- Recipes, Work Orders, Operations, Machines & Planning

The Production & MRP module is the manufacturing backbone of Nexa ERP. It manages the full production lifecycle: defining bills of materials (recipes/BOMs), planning production via MRP, creating and executing work orders, tracking operations on the shop floor, consuming materials, receiving finished goods into stock, and posting WIP and production GL transactions. Every material consumption and finished goods receipt flows through this module as stock movements coordinated with the Inventory module, while cost roll-ups and WIP postings integrate with the Finance GL.

The module supports two production modes: **simple production** (direct material consumption on completion, no routing) and **routed production** (operations-based, with per-operation material consumption and cost tracking). The MRP engine generates production plans from demand forecasts and stock projections, which are then converted to production orders through a configurable approval workflow. Recipes serve a dual purpose beyond manufacturing: they drive BOM explosion in sales invoices, sales orders, quotations, purchase orders, and other documents -- a critical feature for UK SME manufacturers selling assembled goods.

The HansaWorld legacy system implements this across 13 registers (ProdVc, ProdOrderVc, ProdPlanVc, ProdPlanCompVc, ProdOperationVc, RecVc, RoutingVc, StdOperationVc, ProdMachineEqVc, ProdItemVc, ProdSwitchTimeVc, AutoProdVc, ProdClassVc), 9 settings blocks, 18 reports, and 6 maintenance routines. The Nexa module consolidates and modernises these into a clean, event-driven architecture while preserving all essential business logic.

**Design decisions:**

- **Single status enum per entity.** The legacy system maintains three redundant status fields (`PRStatusFlag`, `DoneFlag`, `FinnishedFlag`) for backward compatibility. Nexa uses a single `status` enum per entity with named values replacing numeric codes (e.g., `CREATED`, `STARTED`, `FINISHED` instead of 0, 2, 3).
- **Recipe as a first-class multi-purpose entity.** Recipes serve both manufacturing BOMs and document-level BOM explosion (invoices, orders, quotes). The `Recipe` model is designed to support both use cases with explicit input/output row typing and sub-recipe support.
- **Operation-level granularity for GL posting.** Nexa supports both production-level and operation-level GL transaction generation (configurable via production settings), preserving the legacy `ProdAccBlock.ProdTransaction` toggle for accumulated cost handling across multi-step operations.
- **Shift-aware scheduling via MachineShift.** Machine availability is modelled as repeating shift patterns rather than calendar entries, matching the legacy `MachineShiftVc` approach while enabling future enhancement with holiday calendars.
- **Activity-based time registration.** Multi-worker shop floor time tracking integrates with the cross-cutting Activity model (section 2.20), converting logged work time into production costs via a configurable hourly rate.

---

#### Legacy-to-Nexa Entity Mapping

| Legacy Entity | HAL Source | Fields | Nexa Model | Notes |
|---|---|---|---|---|
| RecVc | datadef*.hal | Code + 9 row fields | `Recipe` + `RecipeLine` | BOM template; supports multi-output, sub-recipes, material tags, best-before |
| ProdOrderVc | datadef*.hal | 22 header + 5 row | `ProductionOrder` + `ProductionOrderLine` | Work order with lifecycle, queue management, material reservation |
| ProdVc | datadef*.hal | 51 header + 22 row | `Production` + `ProductionLine` | Execution record; simple or routed; WIP posting; disassembly mode |
| ProdOperationVc | datadef*.hal | 23 header + 15 row | `ProductionOperation` + `ProductionOperationLine` | Per-step execution within routed production; partial completion; cascade cancel |
| RoutingVc | datadef*.hal | 3 header + 9 row | `Routing` + `RoutingStep` | Operation sequence template with time estimates |
| StdOperationVc | datadef*.hal | 11 header + 2 row | `StandardOperation` + `StandardOperationMaterial` | Reusable operation template with material associations |
| ProdPlanVc | datadef*.hal | 7 header + 7 row | `ProductionPlan` + `ProductionPlanLine` | Period-based MRP plan with approval workflow |
| ProdPlanCompVc | datadef*.hal | 9 fields | `ProductionPlanComponent` | Auto-generated material requirements from approved plans |
| ProdMachineEqVc | datadef*.hal | 2 fields | `Machine` (references FixedAsset) | Machine register; links to Fixed Assets for cost rates |
| ProdItemVc | datadef*.hal | 2 header + 2 row | `MachineItemDefault` | Item-to-machine mapping with default recipes |
| ProdSwitchTimeVc | datadef*.hal | 2 fields | `MachineSwitchTime` | Changeover time records per machine |
| ProdClassVc | datadef*.hal | 1 field | `ProductionClass` | Classification for productions and orders |
| AutoProdVc | datadef*.hal | 4 fields | `AutoProductionRule` | Automatic production triggers from stock movements |
| MachineShiftVc | settings | 3 row fields | `MachineShift` | Shift schedule per machine for scheduling engine |
| MachineGroupsBlock | settings | Code + DefStr | `MachineGroup` | Machine grouping with membership validation |
| ProdSettingsBlock | settings | 21 fields | `ProductionSetting` (module settings) | Module-wide configuration |
| ProdAccBlock | settings | 4 fields | `AccountMapping` (Finance, section 2.13) | Production GL account mappings (WIP, CompUsage, ProdControl) |
| ProdSerBlock / ProdOrdSerBlock / ProdPlanSerBlock | settings | 4 row fields each | `NumberSeries` (System, section 2.8) | Separate number series for Recipe, ProdOrder, ProdPlan |

---

#### Prisma Schema

```prisma
// =============================================================
// PRODUCTION & MRP MODULE -- Recipes, Work Orders, Operations,
// Machines & Planning (S2.23)
// =============================================================

// -------------------------------------------------------------
// ENUMS
// -------------------------------------------------------------

enum ProductionOrderStatus {
  CREATED
  RELEASED
  STARTED
  FINISHED
  CANCELLED

  @@map("production_order_status")
}

enum ProductionStatus {
  CREATED
  STARTED
  FINISHED
  CANCELLED
  FINISHED_DISCARDED

  @@map("production_status")
}

enum ProductionOperationStatus {
  CREATED
  STARTED
  FINISHED
  CANCELLED
  FINISHED_DISCARDED

  @@map("production_operation_status")
}

enum ProductionPlanStatus {
  DRAFT
  APPROVED
  CLOSED

  @@map("production_plan_status")
}

enum ProductionPlanPeriodType {
  MONTHLY
  WEEKLY

  @@map("production_plan_period_type")
}

enum ProductionPlanLineType {
  NORMAL
  SUBRECIPE

  @@map("production_plan_line_type")
}

enum RecipeLineDirection {
  INPUT
  OUTPUT

  @@map("recipe_line_direction")
}

enum ProductionGlMode {
  FROM_PRODUCTION
  FROM_OPERATIONS

  @@map("production_gl_mode")
}

enum QuantityMode {
  PER_UNIT
  ABSOLUTE

  @@map("quantity_mode")
}

enum ProductionPlanGenerationMode {
  DIRECT_PRODUCTION
  VIA_PRODUCTION_ORDER

  @@map("production_plan_generation_mode")
}

// -------------------------------------------------------------
// RECIPE / BOM -- Template defining input/output materials
// -------------------------------------------------------------

model Recipe {
  id               String   @id @default(uuid())
  code             String   @unique @db.VarChar(30)
  name             String   @db.VarChar(200)
  description      String?  @db.Text

  // Default routing for operation-based production
  defaultRoutingId String?  @map("default_routing_id")
  defaultRouting   Routing? @relation(fields: [defaultRoutingId], references: [id])

  // Lifecycle
  isClosed         Boolean  @default(false) @map("is_closed")

  // Standard fields
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  // Relations
  lines              RecipeLine[]
  productionOrders   ProductionOrder[]
  productions        Production[]
  productionPlanLines ProductionPlanLine[]
  machineItemDefaults MachineItemDefault[]

  @@map("recipes")
  @@index([code], map: "idx_recipes_code")
  @@index([isClosed], map: "idx_recipes_closed")
}

model RecipeLine {
  id          String  @id @default(uuid())
  recipeId    String  @map("recipe_id")
  lineNumber  Int     @map("line_number")

  // Item
  itemId      String  @map("item_id")    // FK to InventoryItem
  description String? @db.VarChar(200)

  // Direction: INPUT = component consumed, OUTPUT = finished good produced
  direction   RecipeLineDirection

  // Quantities (per unit of production)
  inputQty    Decimal @default(0) @map("input_qty") @db.Decimal(10, 4)
  outputQty   Decimal @default(0) @map("output_qty") @db.Decimal(10, 4)

  // Costing
  standardCost Decimal @default(0) @map("standard_cost") @db.Decimal(19, 4)
  relativeValue Decimal @default(0) @map("relative_value") @db.Decimal(10, 4) // Multi-output cost allocation

  // Material tag (links row to StandardOperation materials for routed production)
  materialTag  String? @map("material_tag") @db.VarChar(30)

  // Sub-recipe support
  isSubRecipe  Boolean @default(false) @map("is_sub_recipe")

  // Best-before calculation
  bestBeforeDays Int?   @map("best_before_days")

  // GL account override for component usage
  componentUsageAccountCode String? @map("component_usage_account_code") @db.VarChar(20)

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  recipe Recipe @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  @@map("recipe_lines")
  @@unique([recipeId, lineNumber], map: "uq_recipe_lines_recipe_line")
  @@index([itemId], map: "idx_recipe_lines_item")
  @@index([recipeId, direction], map: "idx_recipe_lines_recipe_direction")
}

// -------------------------------------------------------------
// ROUTING -- Sequence of operations template
// -------------------------------------------------------------

model Routing {
  id          String   @id @default(uuid())
  code        String   @unique @db.VarChar(30)
  name        String?  @db.VarChar(200)

  // Standard fields
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  // Relations
  steps              RoutingStep[]
  recipes            Recipe[]
  productionOrders   ProductionOrder[]
  productions        Production[]

  @@map("routings")
  @@index([code], map: "idx_routings_code")
}

model RoutingStep {
  id          String  @id @default(uuid())
  routingId   String  @map("routing_id")
  sequence    Int     // Must be > 0; determines execution order
  subSequence Int     @default(0) @map("sub_sequence") // Parallel operations within same sequence

  // Operation reference
  standardOperationId String? @map("standard_operation_id")
  standardOperation   StandardOperation? @relation(fields: [standardOperationId], references: [id])

  // Machine / work centre
  machineId      String? @map("machine_id")
  machine        Machine? @relation(fields: [machineId], references: [id])
  machineGroupId String? @map("machine_group_id")
  machineGroup   MachineGroup? @relation(fields: [machineGroupId], references: [id])

  // Description
  description String? @db.VarChar(200)

  // Time estimates (override StandardOperation defaults)
  runTimeMinutes   Int? @map("run_time_minutes")
  setupTimeMinutes Int? @map("setup_time_minutes")
  queueTimeMinutes Int? @map("queue_time_minutes")
  moveTimeMinutes  Int? @map("move_time_minutes")

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  routing Routing @relation(fields: [routingId], references: [id], onDelete: Cascade)

  @@map("routing_steps")
  @@unique([routingId, sequence, subSequence], map: "uq_routing_steps_sequence")
  @@index([routingId, sequence], map: "idx_routing_steps_sequence")
  @@index([standardOperationId], map: "idx_routing_steps_std_operation")
  @@index([machineId], map: "idx_routing_steps_machine")
}

// -------------------------------------------------------------
// STANDARD OPERATION -- Reusable operation template
// -------------------------------------------------------------

model StandardOperation {
  id          String  @id @default(uuid())
  code        String  @unique @db.VarChar(30)
  name        String? @db.VarChar(200)

  // Default machine / group
  defaultMachineId      String? @map("default_machine_id")
  defaultMachine        Machine? @relation("StdOpDefaultMachine", fields: [defaultMachineId], references: [id])
  defaultMachineGroupId String? @map("default_machine_group_id")
  defaultMachineGroup   MachineGroup? @relation("StdOpDefaultMachineGroup", fields: [defaultMachineGroupId], references: [id])

  // Standard time estimates
  runTimeMinutes   Int @default(0) @map("run_time_minutes")
  setupTimeMinutes Int @default(0) @map("setup_time_minutes")
  queueTimeMinutes Int @default(0) @map("queue_time_minutes")
  moveTimeMinutes  Int @default(0) @map("move_time_minutes")
  batchTimeMinutes Int @default(0) @map("batch_time_minutes")

  // Duration estimate (for multi-day operations)
  durationDays     Int @default(0) @map("duration_days")

  // Display grouping
  displayGroup     String? @map("display_group") @db.VarChar(30)

  // Standard fields
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  // Relations
  materials    StandardOperationMaterial[]
  routingSteps RoutingStep[]
  productionOperations ProductionOperation[]

  @@map("standard_operations")
  @@index([code], map: "idx_standard_operations_code")
}

model StandardOperationMaterial {
  id                  String @id @default(uuid())
  standardOperationId String @map("standard_operation_id")
  materialTag         String @map("material_tag") @db.VarChar(30)
  standardQty         Decimal @default(0) @map("standard_qty") @db.Decimal(10, 4)

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  standardOperation StandardOperation @relation(fields: [standardOperationId], references: [id], onDelete: Cascade)

  @@map("standard_operation_materials")
  @@unique([standardOperationId, materialTag], map: "uq_std_op_materials_tag")
}

// -------------------------------------------------------------
// MACHINE / WORK CENTRE
// -------------------------------------------------------------

model Machine {
  id          String  @id @default(uuid())
  code        String  @unique @db.VarChar(30)
  name        String? @db.VarChar(200)

  // Link to Fixed Asset for cost rates (IdleCost, RunCost)
  fixedAssetId String? @unique @map("fixed_asset_id") // FK to FixedAsset

  // Machine group membership
  machineGroupId String? @map("machine_group_id")
  machineGroup   MachineGroup? @relation(fields: [machineGroupId], references: [id])

  // Cost rates (per hour, sourced from FixedAsset or entered directly)
  idleCostPerHour Decimal @default(0) @map("idle_cost_per_hour") @db.Decimal(19, 4)
  runCostPerHour  Decimal @default(0) @map("run_cost_per_hour") @db.Decimal(19, 4)

  // Dimension tags (for GL posting)
  dimensionTags String? @map("dimension_tags") @db.VarChar(200)

  // Default warehouse/location
  defaultWarehouseId String? @map("default_warehouse_id")

  // Lifecycle
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  // Relations
  shifts              MachineShift[]
  switchTimes         MachineSwitchTime[]
  routingSteps        RoutingStep[]
  productionOrders    ProductionOrder[]
  productions         Production[]
  productionOperations ProductionOperation[]
  stdOpDefault        StandardOperation[] @relation("StdOpDefaultMachine")
  machineItemDefaults MachineItemDefault[]

  @@map("machines")
  @@index([code], map: "idx_machines_code")
  @@index([machineGroupId], map: "idx_machines_group")
  @@index([fixedAssetId], map: "idx_machines_fixed_asset")
}

model MachineGroup {
  id   String @id @default(uuid())
  code String @unique @db.VarChar(30)
  name String? @db.VarChar(200)

  // Standard fields
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  // Relations
  machines            Machine[]
  routingSteps        RoutingStep[]
  stdOpDefaultGroup   StandardOperation[] @relation("StdOpDefaultMachineGroup")
  productionOperations ProductionOperation[]

  @@map("machine_groups")
  @@index([code], map: "idx_machine_groups_code")
}

model MachineShift {
  id        String @id @default(uuid())
  machineId String @map("machine_id")

  // Shift pattern
  dayOffset      Int  @map("day_offset")        // 0 = Monday, 6 = Sunday (or offset from schedule start)
  startTimeMinutes Int @map("start_time_minutes") // Minutes from midnight (e.g. 480 = 08:00)
  endTimeMinutes   Int @map("end_time_minutes")   // Minutes from midnight (e.g. 1020 = 17:00)
  repeatCount    Int  @default(1) @map("repeat_count") // Number of times to repeat this pattern

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  machine Machine @relation(fields: [machineId], references: [id], onDelete: Cascade)

  @@map("machine_shifts")
  @@index([machineId, dayOffset], map: "idx_machine_shifts_machine_day")
}

model MachineSwitchTime {
  id        String @id @default(uuid())
  machineId String @map("machine_id")

  // From/to context (item, recipe, or machine-level)
  fromItemId String? @map("from_item_id")
  toItemId   String? @map("to_item_id")

  // Changeover duration
  switchTimeMinutes Int @map("switch_time_minutes")

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  machine Machine @relation(fields: [machineId], references: [id], onDelete: Cascade)

  @@map("machine_switch_times")
  @@index([machineId], map: "idx_machine_switch_times_machine")
}

// -------------------------------------------------------------
// MACHINE-ITEM DEFAULTS -- Maps items to machines and recipes
// -------------------------------------------------------------

model MachineItemDefault {
  id       String @id @default(uuid())
  itemId   String @map("item_id") // FK to InventoryItem

  // Default machine for this item
  defaultMachineId String? @map("default_machine_id")
  defaultMachine   Machine? @relation(fields: [defaultMachineId], references: [id])

  // Default recipe for this item-machine combination
  defaultRecipeId String? @map("default_recipe_id")
  defaultRecipe   Recipe? @relation(fields: [defaultRecipeId], references: [id])

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("machine_item_defaults")
  @@unique([itemId, defaultMachineId], map: "uq_machine_item_defaults_item_machine")
  @@index([itemId], map: "idx_machine_item_defaults_item")
}

// -------------------------------------------------------------
// PRODUCTION CLASS -- Classification reference
// -------------------------------------------------------------

model ProductionClass {
  id   String @id @default(uuid())
  code String @unique @db.VarChar(20)
  name String? @db.VarChar(100)

  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  // Relations
  productionOrders ProductionOrder[]
  productions      Production[]

  @@map("production_classes")
  @@index([code], map: "idx_production_classes_code")
}

// -------------------------------------------------------------
// AUTO PRODUCTION RULE -- Triggered from stock movements
// -------------------------------------------------------------

model AutoProductionRule {
  id             String  @id @default(uuid())
  fromItemId     String  @map("from_item_id")  // FK to InventoryItem (input)
  toItemId       String  @map("to_item_id")    // FK to InventoryItem (output)
  isDefault      Boolean @default(false) @map("is_default") // One default per toItemId
  conversionFactor Decimal @default(1) @map("conversion_factor") @db.Decimal(10, 4)

  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  @@map("auto_production_rules")
  @@unique([fromItemId, toItemId], map: "uq_auto_prod_rules_from_to")
  @@index([toItemId], map: "idx_auto_prod_rules_to_item")
}

// -------------------------------------------------------------
// PRODUCTION ORDER -- Work order planning and tracking
// -------------------------------------------------------------

model ProductionOrder {
  id              String  @id @default(uuid())
  orderNumber     String  @unique @map("order_number") @db.VarChar(30) // Auto via NumberSeries "WO-00001"

  // Status lifecycle
  status          ProductionOrderStatus @default(CREATED)

  // Recipe & routing
  recipeId        String? @map("recipe_id")
  recipe          Recipe? @relation(fields: [recipeId], references: [id])
  recipeName      String? @map("recipe_name") @db.VarChar(200) // Denormalised snapshot
  routingId       String? @map("routing_id")
  routing         Routing? @relation(fields: [routingId], references: [id])

  // Machine & location
  machineId       String? @map("machine_id")
  machine         Machine? @relation(fields: [machineId], references: [id])
  warehouseId     String? @map("warehouse_id") // FK to Warehouse

  // Quantities
  orderedQty      Decimal @map("ordered_qty") @db.Decimal(10, 4)
  finishedQty     Decimal @default(0) @map("finished_qty") @db.Decimal(10, 4)
  discardedQty    Decimal @default(0) @map("discarded_qty") @db.Decimal(10, 4)

  // Scheduling
  plannedStartDate DateTime? @map("planned_start_date")
  plannedEndDate   DateTime? @map("planned_end_date")
  startDate       DateTime? @map("start_date")
  startTime       DateTime? @map("start_time")
  endDate         DateTime? @map("end_date")
  endTime         DateTime? @map("end_time")
  dueDate         DateTime? @map("due_date")
  durationDays    Int?      @map("duration_days")
  setupTimeMinutes Int?     @map("setup_time_minutes")

  // Queue management
  queuePosition   Int?     @map("queue_position") // Position in machine queue; null = not queued

  // Classification
  productionClassId String? @map("production_class_id")
  productionClass   ProductionClass? @relation(fields: [productionClassId], references: [id])

  // Attribution
  responsiblePersonId String? @map("responsible_person_id") // FK to User
  dimensionTags       String? @map("dimension_tags") @db.VarChar(200)

  // Source linkage
  salesOrderId    String? @map("sales_order_id")    // FK to SalesOrder (make-to-order)
  productionPlanLineId String? @map("production_plan_line_id") // FK to ProductionPlanLine

  // Material reservation flag
  materialsReserved Boolean @default(false) @map("materials_reserved")

  // Notes / instructions
  comment         String? @db.VarChar(500)
  instructions    String? @db.Text

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  // Relations
  lines       ProductionOrderLine[]
  productions Production[]

  @@map("production_orders")
  @@index([orderNumber], map: "idx_production_orders_number")
  @@index([status], map: "idx_production_orders_status")
  @@index([machineId, queuePosition], map: "idx_production_orders_machine_queue")
  @@index([recipeId], map: "idx_production_orders_recipe")
  @@index([dueDate, status], map: "idx_production_orders_due_active")
  @@index([salesOrderId], map: "idx_production_orders_sales_order")
  @@index([productionPlanLineId], map: "idx_production_orders_plan_line")
}

model ProductionOrderLine {
  id          String  @id @default(uuid())
  orderId     String  @map("order_id")
  lineNumber  Int     @map("line_number")

  // Item
  itemId      String  @map("item_id")    // FK to InventoryItem
  description String? @db.VarChar(200)

  // Quantities (per unit of production)
  inputQty    Decimal @default(0) @map("input_qty") @db.Decimal(10, 4)
  outputQty   Decimal @default(0) @map("output_qty") @db.Decimal(10, 4)

  // Dimension tags
  dimensionTags String? @map("dimension_tags") @db.VarChar(200)

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  order ProductionOrder @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@map("production_order_lines")
  @@unique([orderId, lineNumber], map: "uq_production_order_lines_order_line")
  @@index([itemId], map: "idx_production_order_lines_item")
}

// -------------------------------------------------------------
// PRODUCTION -- Execution record (actual manufacturing event)
// -------------------------------------------------------------

model Production {
  id              String  @id @default(uuid())
  productionNumber String @unique @map("production_number") @db.VarChar(30) // Auto via NumberSeries "PR-00001"

  // Status lifecycle
  status          ProductionStatus @default(CREATED)

  // Recipe & routing
  recipeId        String? @map("recipe_id")
  recipe          Recipe? @relation(fields: [recipeId], references: [id])
  recipeCode      String? @map("recipe_code") @db.VarChar(30) // Denormalised snapshot
  recipeName      String? @map("recipe_name") @db.VarChar(200)
  routingId       String? @map("routing_id")
  routing         Routing? @relation(fields: [routingId], references: [id])

  // Machine & location
  machineId       String? @map("machine_id")
  machine         Machine? @relation(fields: [machineId], references: [id])
  warehouseId     String? @map("warehouse_id") // FK to Warehouse

  // Quantities
  plannedQty      Decimal @map("planned_qty") @db.Decimal(10, 4)
  totalProductionOrderQty Decimal? @map("total_production_order_qty") @db.Decimal(10, 4)

  // Quantity mode
  quantityMode    QuantityMode @default(PER_UNIT) @map("quantity_mode")

  // Timing
  productionDate  DateTime? @map("production_date")
  startDate       DateTime? @map("start_date")
  startTime       DateTime? @map("start_time")
  endTime         DateTime? @map("end_time")
  breakTimeMinutes Int?     @map("break_time_minutes")
  totalIdleTimeMinutes Int? @map("total_idle_time_minutes")

  // Weight tracking
  totalInputWeight  Decimal? @map("total_input_weight") @db.Decimal(10, 4)
  totalOutputWeight Decimal? @map("total_output_weight") @db.Decimal(10, 4)

  // Accumulated cost (from operations)
  accumulatedCost Decimal @default(0) @map("accumulated_cost") @db.Decimal(19, 4)

  // Disassembly mode
  isDisassembly   Boolean @default(false) @map("is_disassembly")

  // Quality
  inspectorId     String? @map("inspector_id") // FK to User (QC inspector)
  discardReasonCode String? @map("discard_reason_code") @db.VarChar(30) // Standard Problem code

  // Classification
  productionClassId String? @map("production_class_id")
  productionClass   ProductionClass? @relation(fields: [productionClassId], references: [id])

  // Attribution
  responsiblePersonId String? @map("responsible_person_id") // FK to User
  dimensionTags       String? @map("dimension_tags") @db.VarChar(200)

  // Source linkage
  productionOrderId String? @map("production_order_id")
  productionOrder   ProductionOrder? @relation(fields: [productionOrderId], references: [id])
  salesOrderId      String? @map("sales_order_id") // FK to SalesOrder

  // Auto-create operations from routing on save
  autoCreateOperations Boolean @default(false) @map("auto_create_operations")

  // Notes
  comment         String? @db.VarChar(500)

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  // Relations
  lines      ProductionLine[]
  operations ProductionOperation[]

  @@map("productions")
  @@index([productionNumber], map: "idx_productions_number")
  @@index([status], map: "idx_productions_status")
  @@index([recipeId], map: "idx_productions_recipe")
  @@index([productionOrderId], map: "idx_productions_production_order")
  @@index([machineId], map: "idx_productions_machine")
  @@index([productionDate], map: "idx_productions_date")
  @@index([salesOrderId], map: "idx_productions_sales_order")
}

model ProductionLine {
  id            String  @id @default(uuid())
  productionId  String  @map("production_id")
  lineNumber    Int     @map("line_number")

  // Item
  itemId        String  @map("item_id")    // FK to InventoryItem
  description   String? @db.VarChar(200)

  // Quantities
  inputQty      Decimal @default(0) @map("input_qty") @db.Decimal(10, 4)
  outputQty     Decimal @default(0) @map("output_qty") @db.Decimal(10, 4)
  actualQty     Decimal? @map("actual_qty") @db.Decimal(10, 4) // Updated by operations

  // Costing
  unitCost      Decimal @default(0) @map("unit_cost") @db.Decimal(19, 4)
  extraCost     Decimal @default(0) @map("extra_cost") @db.Decimal(19, 4) // Labour, overhead
  fifoValue     Decimal @default(0) @map("fifo_value") @db.Decimal(19, 4)

  // Multi-output cost allocation
  relativeValue Decimal @default(0) @map("relative_value") @db.Decimal(10, 4)

  // Material tag (links to StandardOperation material for routed production)
  materialTag   String? @map("material_tag") @db.VarChar(30)

  // Serial / batch tracking
  serialNumber  String? @map("serial_number") @db.VarChar(60)
  batchNumber   String? @map("batch_number") @db.VarChar(60)
  bestBeforeDate DateTime? @map("best_before_date")

  // Weight
  weight        Decimal? @db.Decimal(10, 4)

  // Unit conversion
  conversionCoefficient Decimal? @map("conversion_coefficient") @db.Decimal(10, 4)

  // Dimension tags
  dimensionTags String? @map("dimension_tags") @db.VarChar(200)

  // Position in warehouse
  positionCode  String? @map("position_code") @db.VarChar(30)

  // Disassembly reference (original production row for disassembly variance)
  originalProductionLineId String? @map("original_production_line_id")
  originalFifoValue        Decimal? @map("original_fifo_value") @db.Decimal(19, 4)

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  production Production @relation(fields: [productionId], references: [id], onDelete: Cascade)

  @@map("production_lines")
  @@unique([productionId, lineNumber], map: "uq_production_lines_production_line")
  @@index([itemId], map: "idx_production_lines_item")
  @@index([serialNumber], map: "idx_production_lines_serial")
  @@index([batchNumber], map: "idx_production_lines_batch")
}

// -------------------------------------------------------------
// PRODUCTION OPERATION -- Per-step execution in routed production
// -------------------------------------------------------------

model ProductionOperation {
  id              String  @id @default(uuid())
  operationNumber String  @unique @map("operation_number") @db.VarChar(30) // Auto-generated

  // Parent references
  productionId    String  @map("production_id")
  production      Production @relation(fields: [productionId], references: [id])
  productionOrderId String? @map("production_order_id")

  // Sequence
  sequence        Int     // Execution order (must be > 0)
  subSequence     Int     @default(0) @map("sub_sequence") // Parallel operations

  // Status
  status          ProductionOperationStatus @default(CREATED)

  // Standard operation reference
  standardOperationId String? @map("standard_operation_id")
  standardOperation   StandardOperation? @relation(fields: [standardOperationId], references: [id])

  // Machine
  machineId       String? @map("machine_id")
  machine         Machine? @relation(fields: [machineId], references: [id])
  machineGroupId  String? @map("machine_group_id")
  machineGroup    MachineGroup? @relation(fields: [machineGroupId], references: [id])

  // Location
  warehouseId     String? @map("warehouse_id") // FK to Warehouse

  // Quantities
  plannedQty      Decimal @map("planned_qty") @db.Decimal(10, 4)
  actualQty       Decimal @default(0) @map("actual_qty") @db.Decimal(10, 4)

  // Quantity mode (inherited from Production)
  quantityMode    QuantityMode @default(PER_UNIT) @map("quantity_mode")

  // Time tracking
  startDate       DateTime? @map("start_date")
  startTime       DateTime? @map("start_time")
  endDate         DateTime? @map("end_date")
  endTime         DateTime? @map("end_time")
  completionDate  DateTime? @map("completion_date")

  // Time estimates and actuals (in minutes)
  runTimeMinutes   Int? @map("run_time_minutes")
  setupTimeMinutes Int? @map("setup_time_minutes")
  queueTimeMinutes Int? @map("queue_time_minutes")
  moveTimeMinutes  Int? @map("move_time_minutes")
  batchTimeMinutes Int? @map("batch_time_minutes")

  // Description
  description     String? @db.VarChar(200)

  // Display grouping
  displayGroup    String? @map("display_group") @db.VarChar(30)

  // Child operation (created for partial completion remainder)
  parentOperationId String? @map("parent_operation_id")
  parentOperation   ProductionOperation? @relation("OperationPartialCompletion", fields: [parentOperationId], references: [id])
  childOperations   ProductionOperation[] @relation("OperationPartialCompletion")

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  // Relations
  lines ProductionOperationLine[]

  @@map("production_operations")
  @@index([productionId], map: "idx_prod_operations_production")
  @@index([productionId, status], map: "idx_prod_operations_production_status")
  @@index([sequence, productionId, status], map: "idx_prod_operations_sequence")
  @@index([machineId], map: "idx_prod_operations_machine")
  @@index([standardOperationId], map: "idx_prod_operations_std_operation")
  @@index([parentOperationId], map: "idx_prod_operations_parent")
}

model ProductionOperationLine {
  id              String  @id @default(uuid())
  operationId     String  @map("operation_id")
  lineNumber      Int     @map("line_number")

  // Item
  itemId          String  @map("item_id")    // FK to InventoryItem
  description     String? @db.VarChar(200)

  // Material tag
  materialTag     String? @map("material_tag") @db.VarChar(30)

  // Quantities
  inputQty        Decimal @default(0) @map("input_qty") @db.Decimal(10, 4)
  outputQty       Decimal @default(0) @map("output_qty") @db.Decimal(10, 4)
  actualInputQty  Decimal @default(0) @map("actual_input_qty") @db.Decimal(10, 4)
  actualOutputQty Decimal @default(0) @map("actual_output_qty") @db.Decimal(10, 4)

  // Costing
  unitCost        Decimal @default(0) @map("unit_cost") @db.Decimal(19, 4)
  fifoValue       Decimal @default(0) @map("fifo_value") @db.Decimal(19, 4)
  relativeValue   Decimal @default(0) @map("relative_value") @db.Decimal(10, 4)

  // Unit conversion
  conversionCoefficient Decimal? @map("conversion_coefficient") @db.Decimal(10, 4)

  // Serial / batch
  serialNumber    String? @map("serial_number") @db.VarChar(60)
  batchNumber     String? @map("batch_number") @db.VarChar(60)

  // Dimension tags
  dimensionTags   String? @map("dimension_tags") @db.VarChar(200)

  // Position
  positionCode    String? @map("position_code") @db.VarChar(30)

  // Discard tracking
  isDiscarded     Boolean @default(false) @map("is_discarded")
  discardReasonCode String? @map("discard_reason_code") @db.VarChar(30)

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  operation ProductionOperation @relation(fields: [operationId], references: [id], onDelete: Cascade)

  @@map("production_operation_lines")
  @@unique([operationId, lineNumber], map: "uq_prod_op_lines_operation_line")
  @@index([itemId], map: "idx_prod_op_lines_item")
  @@index([serialNumber], map: "idx_prod_op_lines_serial")
}

// -------------------------------------------------------------
// PRODUCTION PLAN -- MRP period-based planning
// -------------------------------------------------------------

model ProductionPlan {
  id              String  @id @default(uuid())
  planNumber      String  @unique @map("plan_number") @db.VarChar(30) // Auto via NumberSeries "PP-00001"

  // Period
  periodType      ProductionPlanPeriodType @default(MONTHLY) @map("period_type")
  startDate       DateTime @map("start_date") @db.Date
  endDate         DateTime @map("end_date") @db.Date

  // Status & approval
  status          ProductionPlanStatus @default(DRAFT)
  approvedDate    DateTime? @map("approved_date")
  approvedBy      String?   @map("approved_by") // FK to User

  // Earliest production date across all lines
  earliestProductionDate DateTime? @map("earliest_production_date")

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  // Relations
  lines      ProductionPlanLine[]
  components ProductionPlanComponent[]

  @@map("production_plans")
  @@index([planNumber], map: "idx_production_plans_number")
  @@index([status], map: "idx_production_plans_status")
  @@index([startDate, endDate], map: "idx_production_plans_period")
}

model ProductionPlanLine {
  id          String  @id @default(uuid())
  planId      String  @map("plan_id")
  lineNumber  Int     @map("line_number")

  // Item to produce
  itemId      String  @map("item_id")    // FK to InventoryItem
  recipeId    String? @map("recipe_id")
  recipe      Recipe? @relation(fields: [recipeId], references: [id])

  // Quantities
  suggestedQty Decimal @default(0) @map("suggested_qty") @db.Decimal(10, 4) // MRP-calculated
  plannedQty   Decimal @default(0) @map("planned_qty") @db.Decimal(10, 4)   // User-adjusted

  // Scheduling
  productionStartDate DateTime? @map("production_start_date")

  // Line type
  lineType    ProductionPlanLineType @default(NORMAL) @map("line_type")

  // Link to created Production Order (null until generated)
  productionOrderId String? @map("production_order_id")

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  plan ProductionPlan @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@map("production_plan_lines")
  @@unique([planId, lineNumber], map: "uq_production_plan_lines_plan_line")
  @@index([itemId], map: "idx_production_plan_lines_item")
  @@index([productionOrderId], map: "idx_production_plan_lines_prod_order")
}

// -------------------------------------------------------------
// PRODUCTION PLAN COMPONENT -- Auto-generated material requirements
// -------------------------------------------------------------

model ProductionPlanComponent {
  id          String  @id @default(uuid())
  planId      String  @map("plan_id")

  // Component
  itemId      String  @map("item_id")    // FK to InventoryItem
  itemName    String? @map("item_name") @db.VarChar(200) // Denormalised

  // Period context
  startDate   DateTime @map("start_date") @db.Date
  endDate     DateTime @map("end_date") @db.Date
  neededDate  DateTime? @map("needed_date") @db.Date

  // Quantities
  suggestedQty Decimal @default(0) @map("suggested_qty") @db.Decimal(10, 4)
  plannedQty   Decimal @default(0) @map("planned_qty") @db.Decimal(10, 4)

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  plan ProductionPlan @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@map("production_plan_components")
  @@index([planId], map: "idx_prod_plan_components_plan")
  @@index([itemId], map: "idx_prod_plan_components_item")
  @@index([neededDate], map: "idx_prod_plan_components_needed_date")
}

// -------------------------------------------------------------
// PRODUCTION SETTING -- Module-wide configuration
// (stored in system_settings table with module = 'PRODUCTION')
// Shown here as a model for documentation; may be implemented
// as typed JSON in the SystemSetting model per section 2.10.
// -------------------------------------------------------------

model ProductionSetting {
  id    String @id @default(uuid())
  key   String @unique @db.VarChar(60)
  value String @db.Text

  // Standard fields
  updatedAt DateTime @updatedAt @map("updated_at")
  updatedBy String   @map("updated_by")

  @@map("production_settings")
}

// Production settings keys and their types/descriptions:
//
// autoCalcMachineCost        Boolean   Auto-calculate cost from machine run/idle times
// machineCostItemId          String    Item ID used for machine cost line in production rows
// defaultMachineId           String    Default machine for new Productions/Orders
// defaultQuantityMode        String    "PER_UNIT" or "ABSOLUTE" -- default for new records
// createStockDepOnDiscard    Boolean   Create Stock Depreciation from discarded productions
// autoCreateWip              Boolean   Auto-create WIP GL transactions on Started status
// includeTimeCostItems       Boolean   Include labour/setup/move/queue cost items in operations
// labourCostItemId           String    Item ID for labour/run time cost
// setupCostItemId            String    Item ID for setup time cost
// moveCostItemId             String    Item ID for move time cost
// queueCostItemId            String    Item ID for queue time cost
// enforceSequentialOps       Boolean   Require previous operations completed before next
// addWorkCostFromActivities  Boolean   Add work cost from time-registered activities
// workCostPerHour            Decimal   Cost per hour for work time calculation
// addDiscardedCostToNext     Boolean   Roll discarded production costs into subsequent good production
// defaultActivityTypeId      String    Default Activity Type for production time registration
// setupActivityTypeId        String    Activity Type for setup time registration
// planGenerationMode         String    "DIRECT_PRODUCTION" or "VIA_PRODUCTION_ORDER"
// productionGlMode           String    "FROM_PRODUCTION" or "FROM_OPERATIONS"
// componentUsageAccountCode  String    Default Component Usage GL account
// productionControlAccountCode String  Default Production Control GL account
// wipAccountCode             String    Default WIP GL account
// discardedAccountCode       String    Default Discarded Production GL account
```

---

#### Business Rules

**1. Production Order Lifecycle**

```
Created (CREATED) --> Released (RELEASED) --> Started (STARTED) --> Finished (FINISHED)
                                                    |
                                                    +---> Cancelled (CANCELLED)
```

- **CREATED -> RELEASED:** Machine is required (unless routing is specified). Validates recipe exists and is not closed, warehouse is active, responsible person is set, and machine-item compatibility via `MachineItemDefault`.
- **RELEASED -> STARTED:** Auto-sets `startDate`/`startTime` to current timestamp. Order is placed in machine queue (`queuePosition`). Material reservations are created in Inventory module.
- **STARTED -> FINISHED:** All child Productions must be complete. Auto-sets `endDate`/`endTime`. Removes order from machine queue.
- **Any non-FINISHED -> CANCELLED:** Releases all material reservations. Removes from machine queue. Cannot cancel if any child Production has `status = FINISHED`.
- **Queue management:** Active orders (RELEASED or STARTED) are placed in a machine queue ordered by `queuePosition`. Reordering shifts other orders up/down.
- **Stock impact:** Active orders (CREATED through STARTED) generate planned stock quantities: input items are reserved/on-order, output items contribute to expected supply. Updated via the Inventory module's `quantityOnOrder` field on `StockBalance`.

**2. Production Lifecycle**

```
Created (CREATED) --> Started (STARTED) --> Finished (FINISHED)
                            |
                            +---> Cancelled (CANCELLED)
                            |
                            +---> Finished & Discarded (FINISHED_DISCARDED)
```

- **CREATED:** Default state. Row quantities set from recipe. No stock impact.
- **CREATED -> STARTED:** Auto-sets `startDate`/`startTime`. If `autoCreateWip` setting is enabled, creates WIP GL transaction (Debit WIP, Credit Stock for input materials). Updates parent Production Order to STARTED. Creates stock reservations.
- **STARTED -> FINISHED:** Requires at least one output row with `outputQty > 0`. Creates GL transaction: Stock debit (output), Component Usage credit (inputs), Stock Gain balancing entry. Updates serial numbers, item cost prices, and item history. Updates parent Production Order `finishedQty`. Validates: all items exist, serial numbers available, stock levels sufficient (if over-ship prevention enabled).
- **STARTED -> CANCELLED:** If `autoCreateWip`, reverses the WIP transaction. Only allowed if no operations are finished/discarded.
- **STARTED -> FINISHED_DISCARDED:** Requires `discardReasonCode` (Standard Problem). Creates Stock Depreciation record if `createStockDepOnDiscard` setting is enabled. Posts to Discarded Account instead of Stock Gain. Still updates stock (output removed, inputs consumed).
- **Un-OK (Reversal):** Status can be reverted from FINISHED/FINISHED_DISCARDED back to CREATED (requires `UnOKAll` permission). Reverses stock movements, serial numbers, cost prices. Deletes associated GL transaction. Flags stock recalculation.

**3. Material Consumption (Issue/Backflush)**

- **Direct Issue (no routing):** Materials are consumed when Production reaches FINISHED/FINISHED_DISCARDED. Row `inputQty` represents quantity consumed per unit (PER_UNIT mode) or absolute quantity (ABSOLUTE mode). Actual stock deduction = `inputQty * plannedQty` (PER_UNIT) or `inputQty` (ABSOLUTE).
- **With Routing (operations-based):** Materials are consumed per-operation when each Production Operation finishes. Each operation has its own material rows mapped via `materialTag`. The Production itself does not directly consume stock -- operations do. Batch-finish of all remaining operations is supported.

**4. Operation Sequencing and Partial Completion**

- Operations are executed in `sequence` order. The `enforceSequentialOps` setting determines whether all operations in previous sequences must be completed before the next can start.
- `subSequence` allows parallel operations within the same sequence step.
- When an operation completes fewer items than planned (`actualQty < plannedQty`), a child operation is automatically created for the remainder, linked via `parentOperationId`.
- `actualQty` cannot exceed `plannedQty`. Total `actualQty` across all sub-operations for a sequence cannot exceed the Production's `plannedQty`.
- Cancelling any operation cascades: ALL operations for that production are cancelled, and the parent Production is cancelled.

**5. Recipe/BOM Explosion**

- Recipes define input items (`direction = INPUT`, `inputQty > 0`) and output items (`direction = OUTPUT`, `outputQty > 0`).
- Items can have a default recipe (stored on `InventoryItem.metadata`).
- Sub-recipes (`isSubRecipe = true`) are recursively expanded during production and document explosion.
- `materialTag` on recipe lines maps components to specific StandardOperation materials for routed production.
- `relativeValue` distributes cost across multiple output items proportionally.
- **Cross-document explosion:** The same Recipe entity drives BOM explosion in sales invoices, sales orders, quotations, purchase orders, cash invoices, stock depreciations, returns, and budget lines. Component rows are identified by a `structuredItemComponent` row type in the target document.
- **Maximum producible quantity:** Calculated as `min(stock[component] / inputQty[component])` across all stocked components, rounded down.

**6. Cost Roll-up and Variance Tracking**

- **Standard cost roll-up:** Sums `inputQty * (unitCost + extraCost)` for all input rows. Output row `unitCost = total input cost / output quantity`.
- **Machine cost:** If `autoCalcMachineCost` is enabled, machine idle and run costs are calculated from the Machine's hourly rates and added as a dedicated cost item line.
- **Work cost from activities:** When `addWorkCostFromActivities` is enabled, Activity time is converted to cost: `extraCost += (workTimeMinutes / 60) * workCostPerHour / plannedQty`. Supports concurrent multi-worker cost aggregation.
- **Discarded cost roll-up:** When `addDiscardedCostToNext` is enabled, costs from FINISHED_DISCARDED productions are accumulated and added to the next good production on the same Production Order.
- **Disassembly variance:** In disassembly mode, the original FIFO value is compared to the recalculated cost; variance is posted to the Disassembly Variance GL account.
- **Accumulated cost across operations:** For multi-sequence operations, costs from all previous sequences' finished operations are accumulated and distributed to output rows using `relativeValue`.

**7. WIP GL Posting Pattern**

When `autoCreateWip` is enabled, two-phase WIP transactions are generated:

| Event | Debit | Credit | Condition |
|---|---|---|---|
| Production Started | WIP Account | Stock Account (per input material) | `autoCreateWip = true` |
| Production Finished | Stock Account (per output) | WIP Account (reversal) | `autoCreateWip = true` |
| Production Cancelled | Stock Account (reversal) | WIP Account (reversal) | `autoCreateWip = true`, reverses Start entries |

When `productionGlMode = FROM_OPERATIONS`, GL entries are generated per-operation:

| Event | Debit | Credit | Notes |
|---|---|---|---|
| Operation Finished (intermediate, no output rows) | WIP Account | Stock Account + Component Usage | Non-final operation |
| Operation Finished (final, has output rows) | Stock Account (output) | WIP Account + Stock Gain | Final operation resolves WIP |
| Operation Finished+Discarded | Discarded Account | WIP Account (reversal per row) | Discarded final operation |

**Standard Production GL Posting (no WIP):**

| Event | Debit | Credit | Notes |
|---|---|---|---|
| Stocked input consumed | Stock Account | (per item, per ItemGroup account override) | |
| Component Usage posting | Component Usage Account | Production Control Account | If accounts configured |
| Stocked output received | Stock Account | Stock Gain Account | |
| Non-stocked item | Production Work Cost Account | | Debit or credit depending on direction |
| Extra costs (labour, overhead) | Production Work Cost Account | | |
| Discarded output | Discarded Account | (replaces Stock Gain) | Status = FINISHED_DISCARDED |

**Account Resolution Priority:** (1) Item Group account overrides, (2) Warehouse/Location stock account, (3) Default accounts from `AccountMapping`.

**8. Quality Control Linkage**

- QC records can be created from Productions or individual Production Operations (manual action).
- The `discardReasonCode` (Standard Problem) is required when status = FINISHED_DISCARDED.
- QC hold/release is modelled via the cross-cutting Activity or a future dedicated QC module. For MVP, the inspector field and discard reason provide basic quality tracking.

**9. Multi-Worker Time Registration**

- Workers scan a Production Order barcode to start/stop time registration.
- The system creates Activity records (cross-cutting, section 2.20) tracking start/end times per worker per production.
- Multiple workers can work on the same Production Order simultaneously.
- When multiple activities overlap, `workCostPerHour` is applied to each worker's time independently, and total work cost is accumulated on the Production.
- Setup time is tracked as a separate Activity Type from production run time.
- Work cost is calculated as: `totalWorkCost = SUM(activityDurationHours * workCostPerHour)` across all linked activities.

**10. Production Plan and MRP Logic**

- **Plan Generation (MRP):** Gathers demand from Sales Forecasts; calculates maximum stock levels; projects current stock forward through the planning horizon; nets demand against stock + existing plans; generates `ProductionPlanLine` records with `suggestedQty`.
- **Plan Approval:** User reviews, adjusts `plannedQty`, then approves (status -> APPROVED). Approval triggers component explosion via `ProductionPlanComponent` generation, recursively expanding sub-recipes and aggregating quantities by item and needed date.
- **Plan Closure / Un-approval:** Deletes `ProductionPlanComponent` records. Requires `ProdPlanOK` permission.
- **Order Generation:** Converts approved plan lines (where `productionOrderId` is null) into Production Orders, linking the order back to the plan line. Filtered by date range.
- **Period Constraints:** Monthly plans: `startDate` must be 1st of month. Weekly plans: `startDate` must be Monday. Only one plan per item per overlapping period is allowed.

---

#### Number Series Configuration

The following number series are registered in the System module's `NumberSeries` entity (section 2.8):

| Entity | Prefix | Example | Notes |
|---|---|---|---|
| Recipe | `RC-` | `RC-00001` | Recipe/BOM codes |
| ProductionOrder | `WO-` | `WO-00001` | Work order numbers |
| Production | `PR-` | `PR-00001` | Production execution numbers |
| ProductionPlan | `PP-` | `PP-00001` | Production plan numbers |
| ProductionOperation | `OP-` | `OP-00001` | Operation tracking numbers |

Each series supports date-range-based sub-ranges with overlap validation, matching the legacy `ProdSerBlock`, `ProdOrdSerBlock`, and `ProdPlanSerBlock` patterns.

---

#### Build Sequence & Dependencies

Production & MRP is targeted for **Tier 2 (Advanced Business)** and depends on core modules being complete.

| Story | Scope | Dependencies |
|---|---|---|
| 23.1 | `ProductionClass`, `MachineGroup`, `Machine`, `MachineShift` reference CRUD + seed | Tier 0, Fixed Assets (2.18) for Machine-FixedAsset link |
| 23.2 | `StandardOperation` + `StandardOperationMaterial` CRUD | 23.1 |
| 23.3 | `Routing` + `RoutingStep` CRUD | 23.1, 23.2 |
| 23.4 | `Recipe` + `RecipeLine` CRUD (incl. sub-recipe validation, closure) | Inventory (2.14) for item FK |
| 23.5 | `ProductionOrder` + `ProductionOrderLine` CRUD with lifecycle transitions, queue mgmt | 23.1, 23.3, 23.4, NumberSeries (2.8) |
| 23.6 | `Production` + `ProductionLine` CRUD with lifecycle, direct-issue consumption | 23.4, 23.5, Inventory stock movements (2.14) |
| 23.7 | Operation creation from routing: `ProductionOperation` + `ProductionOperationLine` | 23.3, 23.6 |
| 23.8 | Operation-level material consumption (backflush) + partial completion | 23.7, Inventory (2.14) |
| 23.9 | Production GL posting (standard mode) + WIP posting | 23.6, Finance GL (2.13), AccountMapping |
| 23.10 | Operation-level GL posting (FROM_OPERATIONS mode) + accumulated cost | 23.8, 23.9 |
| 23.11 | Cost roll-up engine: machine cost, work cost, disassembly variance | 23.6, 23.7, Fixed Assets (2.18) |
| 23.12 | `ProductionPlan` + `ProductionPlanLine` + `ProductionPlanComponent` with MRP logic | 23.4, 23.5 |
| 23.13 | Plan-to-order conversion + shift-aware scheduling engine | 23.5, 23.12, MachineShift |
| 23.14 | Recipe explosion in sales/purchase documents (cross-module) | 23.4, Sales Orders (2.16), Purchasing (2.17) |
| 23.15 | `MachineSwitchTime`, `MachineItemDefault`, `AutoProductionRule` | 23.1, 23.4, Inventory (2.14) |
| 23.16 | Activity-based time registration (multi-worker) | 23.6, Cross-cutting Activities (2.20) |
| 23.17 | Reports: Production Order List, Production Queue, Production Statistics, Max Producible Qty, Recipe Cost Comparison | 23.6, 23.7, 23.12 |

**Cross-module integration points:**

- **Inventory (section 2.14):** PRODUCTION_IN / PRODUCTION_OUT stock movements; StockBalance updates; serial/batch tracking; planned quantities from active orders.
- **Finance GL (section 2.13):** GL journal entries via AccountMapping for production, WIP, component usage, discarded, and disassembly variance accounts. `JournalSource = PRODUCTION`.
- **Fixed Assets (section 2.18):** Machine -> FixedAsset link for cost rates (IdleCost, RunCost per hour). Machine dimension tags inherited for GL posting.
- **Sales Orders (section 2.16):** Production Order -> Sales Order linkage for make-to-order. Recipe explosion into SalesOrderLine component rows. Maximum producible quantity for ATP checks.
- **Purchasing AP (section 2.17):** MRP component requirements feed purchase order suggestions. Recipe explosion into PurchaseOrderLine component rows.
- **Cross-Cutting (section 2.20):** Activity records for time registration; RecordLink between Production/Operation/Order entities; Attachments and Notes on all production entities; Approval workflows for Production Plan approval.
- **System (section 2.8/2.10):** NumberSeries for all production document numbering; SystemSetting for ProductionSetting key-value pairs.

---

*End of section 2.23*

---

*End of section 2.23*

### 2.24 POS Module -- Terminals, Sessions, Sales, Payments & Cashup

The Point of Sale module provides retail transaction processing for UK SMEs operating physical or pop-up shops. It manages the complete POS lifecycle: terminal configuration, shift session management, item scanning/entry, multi-tender payment, receipt generation, and end-of-day cashup with GL posting. Every action is recorded in an immutable audit journal for regulatory compliance.

In the legacy HansaWorld system, POS spans IVCashVc (141 header fields + row arrays), POSEventVc (session events), POSBalanceVc (cashup balances), POSJournalVc (audit trail), POSButtonsVc (touchscreen layout with 162 button types), DrawerVc (cash drawers), CashVc (cash in/out), CashupHistVc (cashup linkage), CashierBalVc (cashier balances), POSSalesVc (sync statistics), POSerBlock (offline serial blocks), and the RestAccVc register (restaurant/bar mode -- deferred to P2). Configuration is centralised in CashierDefBlock (~40 settings) with per-machine overrides in LocalMachineBlock.

Nexa normalises the legacy structure by separating the monolithic IVCashVc into distinct `POSSale` (header), `POSSaleLine` (items), and `POSPayment` (tenders) models, enabling unlimited split payments without the legacy's two-payment-field ceiling. The 162 button types are consolidated into logical action groups within a flexible `POSButtonLayout` configuration system. Offline capability is supported through serial number block pre-allocation. The module sits in `apps/api/src/modules/pos/` as a Fastify plugin.

---

**Legacy-to-Nexa Mapping:**

| Legacy Register | HAL Source | Fields | Nexa Model(s) | Priority | Notes |
|----------------|-----------|--------|--------------|----------|-------|
| LocalMachineVc / LocalMachineBlock | datadef6.hal | ~15 | **POSTerminal** | MVP | Terminal/machine configuration with drawer assignment |
| DrawerVc | datadef6.hal | 1 | **CashDrawer** | MVP | Cash drawer register, expanded with location and float tracking |
| POSEventVc | datadef6.hal | 8+idx | **POSSession** | MVP | Open/close session events unified into single session entity with open/close timestamps |
| IVCashVc (header) | datadef6.hal | 141 | **POSSale** | MVP | Cash invoice header; ~30 MVP fields from 141 |
| IVCashVc (rows) | datadef6.hal | 9 | **POSSaleLine** | MVP | Line items; payment rows extracted to POSPayment |
| PMBlock / RestPMBlock | settings | varies | **POSPaymentMethod** | MVP | Payment mode definitions with type classification |
| IVCashVc (CashValue/RecValue/RecValue2) | datadef6.hal | 6 | **POSPayment** | MVP | Normalised payment tenders; unlimited split payments replace legacy 2-field limit |
| POSBalanceVc | datadef6.hal | 8 | **POSCashup** + **POSCashupLine** | MVP | End-of-shift cashup with per-payment-method breakdown |
| POSJournalVc | datadef6.hal | 14 | **POSJournalEntry** | MVP | Immutable audit trail of all POS actions |
| POSButtonsVc | datadef6.hal | 5+5 | **POSButtonLayout** + **POSButton** | MVP | Button page/grid configuration, 162 types consolidated to logical groups |
| CashVc | datadef6.hal | 12+2 | **POSCashMovement** | MVP | Cash in (float), cash out, write-off transactions |
| POSerBlock | settings | 4 | **POSSerialBlock** | MVP | Offline serial number pre-allocation ranges |
| CashierDefBlock | settings | ~40 | POS settings in **SystemSetting** | MVP | POS configuration stored as typed system settings per tenant |
| POSSalesVc | datadef6.hal | 2 | Deferred | P2 | Sync statistics; replaced by event-driven sync |
| CashupHistVc | datadef6.hal | 5 | Derived query | -- | Cashup-to-transaction linkage computed from POSSale.sessionId + cashup date range |
| CashierBalVc | datadef6.hal | 4 | Derived query | -- | Cashier balance computed on demand from POSPayment aggregation |
| RestAccVc | datadef6.hal | 100+ | Deferred | P2 | Restaurant/bar tab mode (service charges, table management, kitchen printing) |

---

**Prisma Models:**

```prisma
// ===============================================
// POS MODULE -- Terminals, Sessions, Sales, Payments & Cashup
// ===============================================

// -----------------------------------------------
// Enums
// -----------------------------------------------

enum POSTerminalStatus {
  ACTIVE
  INACTIVE
  MAINTENANCE

  @@map("pos_terminal_status")
}

enum POSSessionStatus {
  OPEN
  CLOSED

  @@map("pos_session_status")
}

enum POSSaleStatus {
  IN_PROGRESS       // Being built (items being scanned/added)
  SUSPENDED         // Parked for later retrieval
  COMPLETED         // Paid and finished
  VOIDED            // Invalidated (entire sale cancelled after completion)

  @@map("pos_sale_status")
}

enum POSSaleType {
  SALE              // Standard sale (positive amounts)
  RETURN            // Return / credit (negative amounts)

  @@map("pos_sale_type")
}

enum POSSaleLineStatus {
  ACTIVE
  VOIDED            // Individual line voided (ovst flag in legacy)

  @@map("pos_sale_line_status")
}

enum POSPaymentMethodType {
  CASH
  CREDIT_CARD
  DEBIT_CARD
  GIFT_VOUCHER
  CHEQUE
  ON_ACCOUNT        // Post to customer AR
  LOYALTY_POINTS
  MOBILE_PAYMENT    // Covers Swish, M-Pesa, Apple Pay, Google Pay etc.
  QR_PAYMENT
  OTHER

  @@map("pos_payment_method_type")
}

enum POSCashMovementType {
  CASH_IN            // Float / petty cash deposit
  CASH_OUT           // Cash removal from drawer
  WRITE_OFF          // Cashup discrepancy write-off

  @@map("pos_cash_movement_type")
}

enum POSCashupStatus {
  DRAFT              // Cashup in progress, counts being entered
  COMPLETED          // Cashup finalised
  POSTED             // GL transaction created

  @@map("pos_cashup_status")
}

enum POSJournalAction {
  ADD_ITEM
  VOID_ITEM
  DELETE_ITEM
  CHANGE_PRICE
  CHANGE_QUANTITY
  APPLY_DISCOUNT
  PAYMENT_CASH
  PAYMENT_CARD
  PAYMENT_OTHER
  FINISH_SALE
  VOID_SALE
  PRINT_RECEIPT
  PRINT_RECEIPT_COPY
  PRINT_X_REPORT
  PRINT_Z_REPORT
  OPEN_DRAWER
  OPEN_SESSION
  CLOSE_SESSION
  LOGIN
  LOGOUT
  RETURN_ITEM
  RETURN_SALE
  SUSPEND_SALE
  RESUME_SALE
  TRANSFER_TO_INVOICE
  CASH_IN
  CASH_OUT
  PRICE_LOOKUP
  STARTUP
  SHUTDOWN

  @@map("pos_journal_action")
}

enum POSButtonActionType {
  // Item selection
  ITEM                    // Add specific item by code
  ITEM_GROUP              // Navigate to item group page
  ITEM_SEARCH             // Open item search dialog
  BARCODE_SCAN            // Activate barcode scanner

  // Payment
  CASH_PAYMENT            // Cash tender
  CARD_PAYMENT            // Credit/debit card tender
  GIFT_VOUCHER_PAYMENT    // Gift voucher tender
  ON_ACCOUNT_PAYMENT      // Post to customer account
  LOYALTY_PAYMENT         // Loyalty points tender
  MOBILE_PAYMENT          // Mobile payment tender
  QR_PAYMENT              // QR code payment
  FULL_PAYMENT            // One-touch full payment (default tender)
  SPLIT_PAYMENT           // Open split payment panel

  // Transaction control
  FINISH                  // Complete the sale
  FINISH_AND_PRINT        // Complete and print receipt
  VOID_LINE               // Void selected line
  DELETE_LINE             // Delete selected line
  AMEND_LINE              // Edit line price/qty
  RETURN                  // Switch to return mode
  RETURN_AGAINST_INVOICE  // Return against specific sale number
  RETURN_REASON           // Set return reason code
  SUSPEND                 // Park the current sale
  RESUME                  // Resume a suspended sale

  // Navigation
  GOTO_PAGE               // Navigate to another button page
  LEVEL_TOP               // Return to main button page

  // Modifiers
  QUANTITY                // Set quantity for next item
  DISCOUNT                // Apply line or sale discount
  PRICE_OVERRIDE          // Override price (requires permission)

  // Session & cash
  OPEN_SESSION            // Open shift
  CLOSE_SESSION           // Close shift
  OPEN_DRAWER             // Pop the cash drawer
  CASH_IN                 // Register cash float deposit
  CASH_OUT                // Register cash removal

  // Reports
  X_REPORT                // Print X-report (interim, non-resetting)
  Z_REPORT                // Print Z-report (end-of-day)
  CASHUP                  // Trigger cashup process

  // Customer
  CUSTOMER_SEARCH         // Look up / assign customer
  LOYALTY_CARD            // Scan loyalty card
  EDIT_CUSTOMER           // Edit customer record in-place

  // Transfers
  TRANSFER_TO_INVOICE     // Transfer sale to AR invoice
  TRANSFER_TO_ORDER       // Transfer sale to sales order

  // Printing
  PRINT_RECEIPT           // Print/reprint receipt
  GIFT_RECEIPT            // Print gift receipt (no prices)
  EMAIL_RECEIPT           // Email digital receipt

  @@map("pos_button_action_type")
}

// -----------------------------------------------
// 1. POSTerminal (reference entity -- isActive pattern)
// -----------------------------------------------

model POSTerminal {
  id                    String              @id @default(uuid())

  // Identity
  code                  String              @unique                             // "TILL-01", "POP-UP-A"
  name                  String                                                  // "Main Till", "Pop-up Stand"
  status                POSTerminalStatus   @default(ACTIVE)

  // Location
  locationCode          String?             @map("location_code") @db.VarChar(20)  // Warehouse/store location
  branchId              String?             @map("branch_id")                      // FK to Branch (if multi-branch)

  // Drawer assignment
  defaultDrawerId       String?             @map("default_drawer_id")              // FK to CashDrawer
  defaultDrawer         CashDrawer?         @relation("DefaultDrawer", fields: [defaultDrawerId], references: [id])

  // Defaults (override tenant-level POS settings)
  defaultCustomerId     String?             @map("default_customer_id")            // Walk-in customer override
  defaultPriceListId    String?             @map("default_price_list_id")          // FK to PriceList
  buttonLayoutGroupCode String?             @map("button_layout_group_code") @db.VarChar(20) // Button group to use
  pricesIncludeVat      Boolean             @default(true) @map("prices_include_vat")

  // Offline capability
  serialBlockId         String?             @map("serial_block_id")                // FK to POSSerialBlock

  // Hardware (metadata for receipt formatting)
  receiptPrinterType    String?             @map("receipt_printer_type") @db.VarChar(50)
  receiptWidth          Int?                @map("receipt_width")                  // Characters per line (e.g. 40, 48)

  // Standard fields
  isActive              Boolean             @default(true) @map("is_active")
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")
  createdBy             String              @map("created_by")
  updatedBy             String              @map("updated_by")

  // Relations
  sessions              POSSession[]
  sales                 POSSale[]
  journalEntries        POSJournalEntry[]
  cashMovements         POSCashMovement[]

  @@map("pos_terminals")
  @@index([isActive], map: "idx_pos_terminals_active")
  @@index([code], map: "idx_pos_terminals_code")
  @@index([locationCode], map: "idx_pos_terminals_location")
}

// -----------------------------------------------
// 2. CashDrawer (reference entity)
// -----------------------------------------------

model CashDrawer {
  id                    String              @id @default(uuid())
  code                  String              @unique                             // "DRAWER-01", "DRAWER-02"
  name                  String                                                  // "Main Drawer", "Till 2 Drawer"

  // Location
  locationCode          String?             @map("location_code") @db.VarChar(20)

  // Float
  defaultFloat          Decimal             @default(0) @map("default_float") @db.Decimal(19, 4)  // Standard opening float

  // Standard fields
  isActive              Boolean             @default(true) @map("is_active")
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")
  createdBy             String              @map("created_by")
  updatedBy             String              @map("updated_by")

  // Relations (inverse)
  defaultForTerminals   POSTerminal[]       @relation("DefaultDrawer")
  sessions              POSSession[]
  cashMovements         POSCashMovement[]
  cashups               POSCashup[]

  @@map("cash_drawers")
  @@index([isActive], map: "idx_cash_drawers_active")
}

// -----------------------------------------------
// 3. POSSession (transactional -- status enum)
// -----------------------------------------------

model POSSession {
  id                    String              @id @default(uuid())
  sessionNumber         String              @unique @map("session_number")       // From NumberSeries: "SESS-00001"

  // Terminal & drawer
  terminalId            String              @map("terminal_id")
  terminal              POSTerminal         @relation(fields: [terminalId], references: [id])
  drawerId              String              @map("drawer_id")
  drawer                CashDrawer          @relation(fields: [drawerId], references: [id])

  // Timing
  openedAt              DateTime            @map("opened_at")                    // Session start time
  closedAt              DateTime?           @map("closed_at")                    // Session end time (null while open)

  // Users
  openedBy              String              @map("opened_by")                    // User who opened the session
  closedBy              String?             @map("closed_by")                    // User who closed the session
  members               String[]            @map("members")                      // All user IDs active during session (multi-user support)

  // Opening float (snapshot at session open)
  openingFloat          Decimal             @default(0) @map("opening_float") @db.Decimal(19, 4)

  // Status
  status                POSSessionStatus    @default(OPEN)

  // Standard fields
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")

  // Relations
  sales                 POSSale[]
  cashMovements         POSCashMovement[]
  cashup                POSCashup?

  @@map("pos_sessions")
  @@index([terminalId, status], map: "idx_pos_sessions_terminal_status")
  @@index([drawerId, status], map: "idx_pos_sessions_drawer_status")
  @@index([openedAt], map: "idx_pos_sessions_opened_at")
  @@index([openedBy], map: "idx_pos_sessions_opened_by")
  @@unique([terminalId, drawerId, status], map: "uq_pos_sessions_one_open_per_terminal_drawer")
  // Partial unique index enforced at application layer: only one OPEN session per terminal+drawer
}

// -----------------------------------------------
// 4. POSPaymentMethod (reference entity)
// -----------------------------------------------

model POSPaymentMethod {
  id                    String                  @id @default(uuid())
  code                  String                  @unique                         // "CASH", "VISA", "AMEX", "GIFT"
  name                  String                                                  // "Cash", "Visa", "American Express"
  methodType            POSPaymentMethodType    @map("method_type")             // Classification

  // GL account for this payment method
  glAccountCode         String?                 @map("gl_account_code") @db.VarChar(20) // FK to ChartOfAccount.code

  // Configuration
  requiresReference     Boolean                 @default(false) @map("requires_reference")   // e.g. card auth code
  opensDrawer           Boolean                 @default(false) @map("opens_drawer")          // Pop drawer on this tender?
  allowsOverTender      Boolean                 @default(false) @map("allows_over_tender")    // Can customer pay more (change given)?
  allowsPartialTender   Boolean                 @default(true) @map("allows_partial_tender")  // Can be part of split payment?

  // Currency (for foreign currency payment methods)
  currencyCode          String                  @default("GBP") @map("currency_code") @db.VarChar(3)

  // Display
  sortOrder             Int                     @default(0) @map("sort_order")
  colour                String?                 @db.VarChar(7)                  // Hex colour for button: "#4CAF50"

  // Standard fields
  isActive              Boolean                 @default(true) @map("is_active")
  createdAt             DateTime                @default(now()) @map("created_at")
  updatedAt             DateTime                @updatedAt @map("updated_at")
  createdBy             String                  @map("created_by")
  updatedBy             String                  @map("updated_by")

  // Relations
  payments              POSPayment[]
  cashupLines           POSCashupLine[]

  @@map("pos_payment_methods")
  @@index([isActive, sortOrder], map: "idx_pos_payment_methods_active_sort")
  @@index([methodType], map: "idx_pos_payment_methods_type")
}

// -----------------------------------------------
// 5. POSSale (transactional -- the core POS transaction)
// -----------------------------------------------

model POSSale {
  id                    String              @id @default(uuid())

  // Identification
  saleNumber            String              @unique @map("sale_number")         // From NumberSeries: "CS-00001" (Cash Sale)
  saleType              POSSaleType         @default(SALE) @map("sale_type")

  // Session & terminal context
  sessionId             String              @map("session_id")
  session               POSSession          @relation(fields: [sessionId], references: [id])
  terminalId            String              @map("terminal_id")
  terminal              POSTerminal         @relation(fields: [terminalId], references: [id])

  // Customer (optional -- walk-in sales use default customer)
  customerId            String?             @map("customer_id")                 // FK to Customer (AR module)
  customerName          String?             @map("customer_name")               // Snapshot at sale time
  customerCode          String?             @map("customer_code")               // Snapshot

  // Timing
  startedAt             DateTime            @map("started_at")                  // When sale was initiated
  completedAt           DateTime?           @map("completed_at")                // When payment was finalised

  // Sales attribution
  salesPersonId         String?             @map("sales_person_id")             // FK to User (defaults to session opener)
  priceListId           String?             @map("price_list_id")               // FK to PriceList

  // Financial totals (all Decimal 19,4)
  subtotal              Decimal             @default(0) @db.Decimal(19, 4)       // Sum of line totals (excl VAT)
  discountAmount        Decimal             @default(0) @map("discount_amount") @db.Decimal(19, 4) // Sale-level discount
  vatAmount             Decimal             @default(0) @map("vat_amount") @db.Decimal(19, 4)
  totalAmount           Decimal             @default(0) @map("total_amount") @db.Decimal(19, 4)    // Grand total (incl VAT)
  totalTendered         Decimal             @default(0) @map("total_tendered") @db.Decimal(19, 4)  // Sum of all payments
  changeGiven           Decimal             @default(0) @map("change_given") @db.Decimal(19, 4)    // Overpayment returned
  grossProfit           Decimal?            @map("gross_profit") @db.Decimal(19, 4)                // Revenue - cost

  // Currency
  currencyCode          String              @default("GBP") @map("currency_code") @db.VarChar(3)
  exchangeRate          Decimal             @default(1) @map("exchange_rate") @db.Decimal(10, 6)

  // Tax
  pricesIncludeVat      Boolean             @default(true) @map("prices_include_vat")

  // Quantities (aggregate)
  totalQuantity         Decimal             @default(0) @map("total_quantity") @db.Decimal(10, 4)
  lineCount             Int                 @default(0) @map("line_count")

  // Status & lifecycle
  status                POSSaleStatus       @default(IN_PROGRESS)

  // Return reference (if this is a return against a previous sale)
  returnAgainstSaleId   String?             @map("return_against_sale_id")       // FK self
  returnAgainstSale     POSSale?            @relation("SaleReturn", fields: [returnAgainstSaleId], references: [id])
  returns               POSSale[]           @relation("SaleReturn")
  returnReasonCode      String?             @map("return_reason_code") @db.VarChar(20)

  // Void metadata
  voidedAt              DateTime?           @map("voided_at")
  voidedBy              String?             @map("voided_by")
  voidReason            String?             @map("void_reason")

  // Stock location
  warehouseId           String?             @map("warehouse_id")                 // FK to Warehouse (stock deduction source)

  // AR transfer (if sale was converted to a proper invoice)
  transferredInvoiceId  String?             @map("transferred_invoice_id")       // FK to CustomerInvoice
  isTransferred         Boolean             @default(false) @map("is_transferred")

  // Stock deduction tracking
  stockDeducted         Boolean             @default(false) @map("stock_deducted") // Updated by deferred stock maintenance

  // Offline sync
  offlineUuid           String?             @unique @map("offline_uuid")         // UUID for offline-created sales
  isSynced              Boolean             @default(true) @map("is_synced")     // False if created offline, true once synced

  // Notes
  notes                 String?             @db.Text

  // Standard fields
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")
  createdBy             String              @map("created_by")
  updatedBy             String              @map("updated_by")

  // Relations
  lines                 POSSaleLine[]
  payments              POSPayment[]

  @@map("pos_sales")
  @@index([sessionId], map: "idx_pos_sales_session")
  @@index([terminalId], map: "idx_pos_sales_terminal")
  @@index([customerId], map: "idx_pos_sales_customer")
  @@index([status], map: "idx_pos_sales_status")
  @@index([completedAt], map: "idx_pos_sales_completed_at")
  @@index([saleType], map: "idx_pos_sales_type")
  @@index([sessionId, status], map: "idx_pos_sales_session_status")
  @@index([stockDeducted], map: "idx_pos_sales_stock_deducted")
}

// -----------------------------------------------
// 6. POSSaleLine (line items within a sale)
// -----------------------------------------------

model POSSaleLine {
  id                    String              @id @default(uuid())
  saleId                String              @map("sale_id")
  sale                  POSSale             @relation(fields: [saleId], references: [id], onDelete: Cascade)

  lineNumber            Int                 @map("line_number")                  // 1-based sequential

  // Item reference
  itemId                String?             @map("item_id")                      // FK to InventoryItem (null for freeform lines)
  itemCode              String?             @map("item_code") @db.VarChar(50)    // Snapshot of item code at sale time
  description           String                                                    // Item name / freeform description

  // Quantities & pricing
  quantity              Decimal             @db.Decimal(10, 4)                   // Negative for returns
  unitPrice             Decimal             @map("unit_price") @db.Decimal(19, 4)
  unitCost              Decimal?            @map("unit_cost") @db.Decimal(19, 4) // Cost at time of sale (for GP calc)
  discountPercent       Decimal             @default(0) @map("discount_percent") @db.Decimal(5, 2)
  discountAmount        Decimal             @default(0) @map("discount_amount") @db.Decimal(19, 4)
  lineTotal             Decimal             @map("line_total") @db.Decimal(19, 4) // qty * unitPrice - discount

  // Tax
  vatCodeId             String?             @map("vat_code_id")                  // FK to VatCode
  vatRate               Decimal             @default(0) @map("vat_rate") @db.Decimal(5, 2)  // Snapshot of rate
  vatAmount             Decimal             @default(0) @map("vat_amount") @db.Decimal(19, 4)

  // GL account (revenue account for this line)
  accountCode           String?             @map("account_code") @db.VarChar(20)  // FK to ChartOfAccount.code

  // Status
  status                POSSaleLineStatus   @default(ACTIVE)
  voidedAt              DateTime?           @map("voided_at")
  voidedBy              String?             @map("voided_by")
  voidReasonCode        String?             @map("void_reason_code") @db.VarChar(20)

  // Serial/batch tracking
  serialNumber          String?             @map("serial_number")
  batchNumber           String?             @map("batch_number")

  // Dimensions
  departmentCode        String?             @map("department_code") @db.VarChar(20)
  tagCode               String?             @map("tag_code") @db.VarChar(20)

  // Audit
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")

  @@map("pos_sale_lines")
  @@unique([saleId, lineNumber], map: "uq_pos_sale_lines_sale_line")
  @@index([saleId], map: "idx_pos_sale_lines_sale")
  @@index([itemId], map: "idx_pos_sale_lines_item")
  @@index([status], map: "idx_pos_sale_lines_status")
}

// -----------------------------------------------
// 7. POSPayment (payment tenders against a sale)
// -----------------------------------------------

model POSPayment {
  id                    String              @id @default(uuid())
  saleId                String              @map("sale_id")
  sale                  POSSale             @relation(fields: [saleId], references: [id], onDelete: Cascade)

  lineNumber            Int                 @map("line_number")                  // 1-based sequential (payment order)

  // Payment method
  paymentMethodId       String              @map("payment_method_id")
  paymentMethod         POSPaymentMethod    @relation(fields: [paymentMethodId], references: [id])

  // Amount
  amount                Decimal             @db.Decimal(19, 4)                   // Amount tendered in this payment method
  currencyCode          String              @default("GBP") @map("currency_code") @db.VarChar(3)
  exchangeRate          Decimal             @default(1) @map("exchange_rate") @db.Decimal(10, 6)
  baseAmount            Decimal             @db.Decimal(19, 4) @map("base_amount") // Amount in base currency

  // Card/reference details
  reference             String?                                                  // Auth code, cheque number, voucher code
  cardLastFour          String?             @map("card_last_four") @db.VarChar(4) // Last 4 digits for display

  // Timestamp
  paidAt                DateTime            @map("paid_at")                      // When this tender was processed

  // Audit
  createdAt             DateTime            @default(now()) @map("created_at")

  @@map("pos_payments")
  @@unique([saleId, lineNumber], map: "uq_pos_payments_sale_line")
  @@index([saleId], map: "idx_pos_payments_sale")
  @@index([paymentMethodId], map: "idx_pos_payments_method")
  @@index([paidAt], map: "idx_pos_payments_paid_at")
}

// -----------------------------------------------
// 8. POSCashMovement (float, cash out, write-off)
// -----------------------------------------------

model POSCashMovement {
  id                    String                @id @default(uuid())
  movementNumber        String                @unique @map("movement_number")   // From NumberSeries: "CM-00001"

  // Context
  terminalId            String                @map("terminal_id")
  terminal              POSTerminal           @relation(fields: [terminalId], references: [id])
  drawerId              String                @map("drawer_id")
  drawer                CashDrawer            @relation(fields: [drawerId], references: [id])
  sessionId             String?               @map("session_id")
  session               POSSession?           @relation(fields: [sessionId], references: [id])

  // Movement details
  movementType          POSCashMovementType   @map("movement_type")
  amount                Decimal               @db.Decimal(19, 4)                // Always positive; type indicates direction
  reason                String?                                                  // Reason for the movement

  // GL account (for write-offs or specific cash-out destinations)
  accountCode           String?               @map("account_code") @db.VarChar(20)

  // Payment method (for cashup write-off by payment method)
  paymentMethodId       String?               @map("payment_method_id")          // FK to POSPaymentMethod

  // Timing
  transactionDate       DateTime              @map("transaction_date") @db.Date
  transactionTime       DateTime              @map("transaction_time")

  // Approval (for cash-out over threshold)
  approvedBy            String?               @map("approved_by")

  // Status
  isConfirmed           Boolean               @default(true) @map("is_confirmed")

  // Standard fields
  createdAt             DateTime              @default(now()) @map("created_at")
  updatedAt             DateTime              @updatedAt @map("updated_at")
  createdBy             String                @map("created_by")
  updatedBy             String                @map("updated_by")

  @@map("pos_cash_movements")
  @@index([terminalId, drawerId], map: "idx_pos_cash_movements_terminal_drawer")
  @@index([sessionId], map: "idx_pos_cash_movements_session")
  @@index([movementType], map: "idx_pos_cash_movements_type")
  @@index([transactionDate], map: "idx_pos_cash_movements_date")
}

// -----------------------------------------------
// 9. POSCashup (end-of-shift reconciliation)
// -----------------------------------------------

model POSCashup {
  id                    String              @id @default(uuid())
  cashupNumber          String              @unique @map("cashup_number")       // From NumberSeries: "CU-00001"

  // Session link (1:1 -- one cashup per session)
  sessionId             String              @unique @map("session_id")
  session               POSSession          @relation(fields: [sessionId], references: [id])

  // Drawer
  drawerId              String              @map("drawer_id")
  drawer                CashDrawer          @relation(fields: [drawerId], references: [id])

  // Timing
  cashupDate            DateTime            @map("cashup_date") @db.Date
  cashupTime            DateTime            @map("cashup_time")

  // Calculated totals (system-computed from sales + cash movements in the session)
  expectedCash          Decimal             @default(0) @map("expected_cash") @db.Decimal(19, 4)     // Opening float + cash sales - cash out + cash in - change given
  expectedTotal         Decimal             @default(0) @map("expected_total") @db.Decimal(19, 4)    // Total across all payment methods
  totalSales            Decimal             @default(0) @map("total_sales") @db.Decimal(19, 4)       // Gross sales amount
  totalReturns          Decimal             @default(0) @map("total_returns") @db.Decimal(19, 4)     // Total returns/refunds
  netSales              Decimal             @default(0) @map("net_sales") @db.Decimal(19, 4)         // totalSales - totalReturns
  totalVat              Decimal             @default(0) @map("total_vat") @db.Decimal(19, 4)
  saleCount             Int                 @default(0) @map("sale_count")
  returnCount           Int                 @default(0) @map("return_count")
  voidCount             Int                 @default(0) @map("void_count")

  // Counted totals (entered by cashier)
  countedCash           Decimal?            @map("counted_cash") @db.Decimal(19, 4)
  countedTotal          Decimal?            @map("counted_total") @db.Decimal(19, 4)

  // Variance
  cashVariance          Decimal?            @map("cash_variance") @db.Decimal(19, 4)    // countedCash - expectedCash
  totalVariance         Decimal?            @map("total_variance") @db.Decimal(19, 4)   // countedTotal - expectedTotal

  // Status & GL
  status                POSCashupStatus     @default(DRAFT)
  journalEntryId        String?             @unique @map("journal_entry_id")    // FK to JournalEntry (set on POSTED)

  // Write-off account for variances
  writeOffAccountCode   String?             @map("write_off_account_code") @db.VarChar(20)

  // Standard fields
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")
  createdBy             String              @map("created_by")
  updatedBy             String              @map("updated_by")

  // Relations
  lines                 POSCashupLine[]

  @@map("pos_cashups")
  @@index([cashupDate], map: "idx_pos_cashups_date")
  @@index([status], map: "idx_pos_cashups_status")
  @@index([drawerId], map: "idx_pos_cashups_drawer")
}

// -----------------------------------------------
// 10. POSCashupLine (per-payment-method breakdown)
// -----------------------------------------------

model POSCashupLine {
  id                    String              @id @default(uuid())
  cashupId              String              @map("cashup_id")
  cashup                POSCashup           @relation(fields: [cashupId], references: [id], onDelete: Cascade)

  // Payment method
  paymentMethodId       String              @map("payment_method_id")
  paymentMethod         POSPaymentMethod    @relation(fields: [paymentMethodId], references: [id])

  // System-calculated expected amount for this payment method
  expectedAmount        Decimal             @default(0) @map("expected_amount") @db.Decimal(19, 4)

  // Cashier-counted amount
  countedAmount         Decimal?            @map("counted_amount") @db.Decimal(19, 4)

  // Variance
  variance              Decimal?            @db.Decimal(19, 4)                   // countedAmount - expectedAmount

  // Transaction counts
  transactionCount      Int                 @default(0) @map("transaction_count")

  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")

  @@map("pos_cashup_lines")
  @@unique([cashupId, paymentMethodId], map: "uq_pos_cashup_lines_cashup_method")
  @@index([cashupId], map: "idx_pos_cashup_lines_cashup")
}

// -----------------------------------------------
// 11. POSJournalEntry (immutable audit trail)
// -----------------------------------------------

model POSJournalEntry {
  id                    String              @id @default(uuid())

  // When & where
  transactionDate       DateTime            @map("transaction_date") @db.Date
  transactionTime       DateTime            @map("transaction_time")
  terminalId            String              @map("terminal_id")
  terminal              POSTerminal         @relation(fields: [terminalId], references: [id])
  drawerId              String?             @map("drawer_id") @db.VarChar(50)

  // What action
  action                POSJournalAction

  // Source reference
  sourceType            String              @map("source_type") @db.VarChar(30)  // "POSSale", "POSSession", "POSCashMovement"
  sourceId              String              @map("source_id")                    // FK to source record
  sourceLineNumber      Int?                @map("source_line_number")           // Line number within source (for item-level actions)

  // Snapshot data at time of action
  itemCode              String?             @map("item_code") @db.VarChar(50)
  itemDescription       String?             @map("item_description")
  quantity              Decimal?            @db.Decimal(10, 4)
  price                 Decimal?            @db.Decimal(19, 4)
  amount                Decimal?            @db.Decimal(19, 4)

  // Who
  userId                String              @map("user_id")                      // User who performed the action
  approvedBy            String?             @map("approved_by")                  // Supervisor who authorised (for restricted actions)

  // Immutable -- no updatedAt
  createdAt             DateTime            @default(now()) @map("created_at")

  @@map("pos_journal_entries")
  @@index([transactionDate], map: "idx_pos_journal_entries_date")
  @@index([terminalId, transactionDate], map: "idx_pos_journal_entries_terminal_date")
  @@index([sourceType, sourceId], map: "idx_pos_journal_entries_source")
  @@index([action], map: "idx_pos_journal_entries_action")
  @@index([userId], map: "idx_pos_journal_entries_user")
  @@index([drawerId, terminalId, transactionDate], map: "idx_pos_journal_entries_drawer_terminal_date")
}

// -----------------------------------------------
// 12. POSButtonLayout (button page configuration)
// -----------------------------------------------

model POSButtonLayout {
  id                    String              @id @default(uuid())
  groupCode             String              @map("group_code") @db.VarChar(20)   // Button group: "DEFAULT", "RETAIL", "CAFE"
  page                  Int                                                       // Page number (1-based)
  label                 String                                                    // Page title: "Main Menu", "Drinks"

  // Standard fields
  isActive              Boolean             @default(true) @map("is_active")
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")
  createdBy             String              @map("created_by")
  updatedBy             String              @map("updated_by")

  // Relations
  buttons               POSButton[]

  @@map("pos_button_layouts")
  @@unique([groupCode, page], map: "uq_pos_button_layouts_group_page")
  @@index([groupCode], map: "idx_pos_button_layouts_group")
}

// -----------------------------------------------
// 13. POSButton (individual button within a layout page)
// -----------------------------------------------

model POSButton {
  id                    String              @id @default(uuid())
  layoutId              String              @map("layout_id")
  layout                POSButtonLayout     @relation(fields: [layoutId], references: [id], onDelete: Cascade)

  // Position on the grid
  position              Int                                                       // 0-based position in the grid (row-major order)

  // Action
  actionType            POSButtonActionType @map("action_type")                   // What this button does
  actionCode            String?             @map("action_code") @db.VarChar(50)   // Context: item code, page number, payment method code

  // Display
  label                 String                                                    // Button label text
  colour                String?             @db.VarChar(7)                        // Hex colour: "#FF5722"
  icon                  String?             @db.VarChar(50)                       // Icon name/reference
  size                  Int                 @default(1)                           // Grid span (1 = single, 2 = double-width)

  // Behaviour
  autoFinish            Boolean             @default(false) @map("auto_finish")   // Auto-complete sale after this action?

  // Standard fields
  isActive              Boolean             @default(true) @map("is_active")
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")

  @@map("pos_buttons")
  @@unique([layoutId, position], map: "uq_pos_buttons_layout_position")
  @@index([layoutId], map: "idx_pos_buttons_layout")
  @@index([actionType], map: "idx_pos_buttons_action_type")
}

// -----------------------------------------------
// 14. POSSerialBlock (offline serial number pre-allocation)
// -----------------------------------------------

model POSSerialBlock {
  id                    String              @id @default(uuid())
  terminalCode          String              @map("terminal_code") @db.VarChar(20) // Terminal this block is assigned to
  seriesType            String              @map("series_type") @db.VarChar(30)   // "POS_SALE", "POS_SESSION"

  // Range
  rangeStart            Int                 @map("range_start")                   // Inclusive start
  rangeEnd              Int                 @map("range_end")                     // Inclusive end
  nextNumber            Int                 @map("next_number")                   // Current pointer within range
  validFrom             DateTime            @map("valid_from") @db.Date
  validTo               DateTime            @map("valid_to") @db.Date

  // Status
  isExhausted           Boolean             @default(false) @map("is_exhausted")  // All numbers in range used
  isActive              Boolean             @default(true) @map("is_active")

  // Standard fields
  createdAt             DateTime            @default(now()) @map("created_at")
  updatedAt             DateTime            @updatedAt @map("updated_at")
  createdBy             String              @map("created_by")
  updatedBy             String              @map("updated_by")

  @@map("pos_serial_blocks")
  @@unique([terminalCode, seriesType, rangeStart], map: "uq_pos_serial_blocks_terminal_series_start")
  @@index([terminalCode, seriesType, isExhausted], map: "idx_pos_serial_blocks_terminal_active")
}
```

---

**Business Rules:**

| Rule ID | Rule | Implementation |
|---------|------|----------------|
| POS-001 | Session must be open before sales can be recorded | Validate `POSSession.status = OPEN` for the terminal; reject sale creation if no open session (configurable via `pos.requireOpenSession` setting) |
| POS-002 | Only one open session per terminal+drawer combination | Enforced by unique constraint `uq_pos_sessions_one_open_per_terminal_drawer` (application-layer partial: only when status = OPEN) |
| POS-003 | A user cannot belong to two open sessions simultaneously | Application-layer check: query `POSSession` where `status = OPEN` and `members` contains the user ID |
| POS-004 | Session must be closed before cashup can run | `POSCashup` creation requires `POSSession.status = CLOSED` |
| POS-005 | Voiding a completed sale requires supervisor approval | If `POSSale.status = COMPLETED`, void action requires `approvedBy` to be set on the journal entry; RBAC permission `pos.void_sale` checked |
| POS-006 | Returns require a customer when `pos.requireReturnCustomer` is enabled | Conditional validation: if setting enabled and `saleType = RETURN`, `customerId` must be non-null |
| POS-007 | Returns require a reason code when `pos.requireReturnReason` is enabled | Conditional validation: if setting enabled and `saleType = RETURN`, `returnReasonCode` must be non-null |
| POS-008 | Item scanning behaviour configurable: new row vs. increment quantity | When `pos.newRowInsteadOfIncrementQuantity` is false (default), scanning a duplicate item code increments the existing line's quantity; when true, a new line is created |
| POS-009 | Sale total must equal sum of payment amounts (minus change) | On sale completion: `totalAmount = SUM(POSPayment.amount) - changeGiven`; only cash-type payment methods can generate change |
| POS-010 | Change can only be given for payment methods with `allowsOverTender = true` | When a tender exceeds the remaining balance, change is only generated if the `POSPaymentMethod.allowsOverTender` flag is set; otherwise reject the overpayment |
| POS-011 | Cashup GL posting creates balanced journal entry | Debit: bank/cash accounts per payment method (from `POSPaymentMethod.glAccountCode`); Credit: POS clearing account (from `AccountMapping` type `POS_CLEARING`). Variances posted to write-off account |
| POS-012 | GL posting is deferred to cashup, not per-sale | Individual POSSale records do not create journal entries; all GL impact is batched at cashup for the session period |
| POS-013 | Stock deduction is deferred for performance | `POSSale.stockDeducted = false` on creation; a scheduled maintenance job (`POSStockUpdateService`) processes undeducted sales and creates `StockMovement` records. Configurable interval via `pos.stockUpdateInterval` setting |
| POS-014 | Voided lines do not contribute to sale totals | When `POSSaleLine.status = VOIDED`, the line is excluded from subtotal/vatAmount/totalAmount recalculation |
| POS-015 | Suspended sales can be resumed on any terminal in the same location | Resume action queries `POSSale` where `status = SUSPENDED` and optionally filters by `warehouseId`; sale is reassigned to the resuming session |
| POS-016 | Z-report resets counters; X-report does not | Z-report is generated at cashup and increments the Z-report sequence number stored in `SystemSetting('pos.lastZReportNumber')`; X-report is an interim read-only summary |
| POS-017 | Every significant POS action creates an immutable journal entry | `POSJournalEntry` records are created via `StorePOSJournalEntry()` service; records have no `updatedAt` and no delete/update operations are exposed |
| POS-018 | Offline terminals use pre-allocated serial number blocks | When disconnected, the terminal draws sale numbers from `POSSerialBlock.nextNumber` within the assigned range; on reconnection, sales are synced and `offlineUuid` prevents duplicates |
| POS-019 | Auto-finish configurable per sale | When `pos.autoFinishAfterPayment` setting is enabled and total tendered covers the sale total, the sale is automatically completed without requiring a separate Finish action |
| POS-020 | Transfer to Invoice creates a proper AR invoice | `TransferToInvoice` service creates a `CustomerInvoice` (type = CASH) in the AR module with lines mirroring the POSSale lines; sets `POSSale.transferredInvoiceId` and `isTransferred = true` |

---

**Session & Sale Lifecycle:**

```
                 SESSION LIFECYCLE
  ┌──────────────────────────────────────────────┐
  │                                              │
  │  openSession()                               │
  │       │                                      │
  │       ▼                                      │
  │  ┌──────────┐   closeSession()  ┌──────────┐ │
  │  │   OPEN   │ ────────────────► │  CLOSED  │ │
  │  └──────────┘                   └──────────┘ │
  │       │                              │       │
  │       │ (1..n sales created)         │       │
  │       │                              │       │
  │       │                         runCashup()  │
  │       │                              │       │
  │       │                              ▼       │
  │       │                       ┌───────────┐  │
  │       │                       │  POSCashup │  │
  │       │                       │  (DRAFT)   │  │
  │       │                       └─────┬─────┘  │
  │       │                             │        │
  │       │                       finaliseCashup()│
  │       │                             │        │
  │       │                             ▼        │
  │       │                       ┌───────────┐  │
  │       │                       │  POSCashup │  │
  │       │                       │  (POSTED)  │  │
  │       │                       │  → GL JE   │  │
  │       │                       └───────────┘  │
  └──────────────────────────────────────────────┘


              SALE LIFECYCLE

  ┌──────────────┐
  │ IN_PROGRESS  │  Items being scanned/added
  └──────┬───────┘
         │
    ┌────┴─────────────────────┐
    │                          │
    │ suspend()                │ addPayment() (covers total)
    ▼                          ▼
  ┌───────────┐          ┌───────────┐
  │ SUSPENDED │          │ COMPLETED │  Sale finalised, receipt generated
  └─────┬─────┘          └─────┬─────┘
        │                      │
   resume()               voidSale() (supervisor)
        │                      │
        ▼                      ▼
  ┌──────────────┐       ┌──────────┐
  │ IN_PROGRESS  │       │  VOIDED  │  Invalidated, GL impact reversed at cashup
  └──────────────┘       └──────────┘
```

---

**Payment Flow (Split Payment Example):**

```
  Sale total: £47.50
       │
       ├── POSPayment #1: GIFT_VOUCHER   £10.00   (ref: "GV-2026-001")
       ├── POSPayment #2: DEBIT_CARD     £20.00   (ref: "AUTH-8832", last4: "4521")
       └── POSPayment #3: CASH           £20.00   (tendered)
                                                    → change: £2.50

  Validation:
    £10.00 + £20.00 + £20.00 = £50.00 (totalTendered)
    £50.00 - £47.50 = £2.50 (changeGiven)
    Only CASH has allowsOverTender = true, so change is permitted
```

---

**Z-Report / Cashup Calculation:**

```
  CASHUP CALCULATION (for a closed session)

  1. SALES TOTALS
     totalSales    = SUM(POSSale.totalAmount)  WHERE saleType = SALE   AND status = COMPLETED
     totalReturns  = SUM(POSSale.totalAmount)  WHERE saleType = RETURN AND status = COMPLETED
     netSales      = totalSales - ABS(totalReturns)
     totalVat      = SUM(POSSale.vatAmount)    WHERE status = COMPLETED

  2. PAYMENT BREAKDOWN (per POSPaymentMethod)
     For each payment method:
       expectedAmount = SUM(POSPayment.baseAmount)
                        WHERE POSPayment.sale.sessionId = this session
                        AND POSPayment.sale.status IN (COMPLETED)
                        GROUP BY paymentMethodId

  3. CASH CALCULATION
     expectedCash  = session.openingFloat
                   + SUM(cash payments received)
                   - SUM(change given on cash payments)
                   + SUM(POSCashMovement WHERE type = CASH_IN)
                   - SUM(POSCashMovement WHERE type = CASH_OUT)

  4. VARIANCE
     cashVariance  = countedCash  - expectedCash
     totalVariance = countedTotal - expectedTotal

  5. GL POSTING (on cashup finalisation)
     For each payment method with expectedAmount > 0:
       DR  POSPaymentMethod.glAccountCode      expectedAmount
     CR  AccountMapping(POS_CLEARING)          netSales + totalVat
     If cashVariance != 0:
       DR/CR  writeOffAccountCode              ABS(cashVariance)
```

---

**GL Posting at Cashup:**

```
Journal Entry: "POS Cashup CU-00042 — Session SESS-00123"
  DocRef: POS:CU-00042
  Source: POS_CASHUP
  Date: cashupDate
  Period: (resolved from cashupDate)

  Lines:
    DR  1000 Cash in Hand                  £520.00   (cash payments net of change)
    DR  1010 Card Clearing Account         £340.00   (card payments)
    DR  1020 Gift Voucher Liability         £40.00   (gift vouchers redeemed)
    CR  4000 Sales Revenue                 £750.00   (net sales excl VAT)
    CR  2201 VAT Output                    £150.00   (total VAT)
    DR  8300 Cash Discrepancy               £0.50    (write-off: counted < expected)
    CR  1000 Cash in Hand                   £0.50    (adjust cash to counted)
                                          ────────
    Balance:                                £0.00 ✓
```

---

**Number Series Configuration:**

| Series Code | Prefix | Example | Used By | Notes |
|------------|--------|---------|---------|-------|
| POS_SESSION | SESS- | SESS-00001 | POSSession.sessionNumber | Sequential per tenant |
| POS_SALE | CS- | CS-00001 | POSSale.saleNumber | "Cash Sale"; supports offline blocks via POSSerialBlock |
| POS_CASHUP | CU- | CU-00001 | POSCashup.cashupNumber | Sequential per tenant |
| POS_CASH_MOVEMENT | CM- | CM-00001 | POSCashMovement.movementNumber | Sequential per tenant |

---

**POS Settings (stored in SystemSetting, prefix `pos.`):**

| Setting Key | Type | Default | Legacy Source | Purpose |
|------------|------|---------|---------------|---------|
| pos.defaultCustomerId | String | (required) | DefCustCode | Walk-in customer for anonymous sales |
| pos.requireOpenSession | Boolean | true | RequireOpenSession | Enforce session before selling |
| pos.newRowInsteadOfIncrementQuantity | Boolean | false | NewRowInsteadIncreaseQty | Scan behaviour |
| pos.requireReturnCustomer | Boolean | false | RequireReturnCustomer | Require customer on returns |
| pos.requireReturnReason | Boolean | true | RequireReturnReason | Require reason code on returns |
| pos.autoFinishAfterPayment | Boolean | true | IVCashAutoFinish | Auto-complete when fully paid |
| pos.pricesIncludeVat | Boolean | true | RestBasePriceInclVAT | Default VAT-inclusive pricing |
| pos.cashupStartFromLastBalance | Boolean | true | StartFromLastPOSBal | Cashup period calculation |
| pos.printZReportAtCashup | Boolean | true | PrintZReportatCashup | Auto-generate Z-report |
| pos.writeOffAccountCode | String | "8300" | WriteOffAcc | GL account for cashup variances |
| pos.emailReceipts | Boolean | false | EmailIVCash | Enable digital receipt emails |
| pos.defaultButtonGroupCode | String | "DEFAULT" | POSButtonGroup | Default button layout group |
| pos.stockUpdateInterval | Int | 300 | UpdStockMaintTime | Seconds between deferred stock update runs |
| pos.maxCashOutWithoutApproval | Decimal | 100.00 | (new) | Cash-out threshold requiring supervisor approval |

---

**Offline Sync Workflow:**

```
  ONLINE MODE (default)
  ─────────────────────
  Terminal → API server → NumberSeries.nextNumber() → sale saved to DB

  OFFLINE MODE (disconnected)
  ───────────────────────────
  1. SETUP: Admin assigns POSSerialBlock to terminal
     (e.g., rangeStart=10001, rangeEnd=10500, seriesType="POS_SALE")

  2. OFFLINE OPERATION:
     Terminal creates sales locally with:
       - saleNumber from POSSerialBlock.nextNumber (incremented locally)
       - offlineUuid = crypto.randomUUID()
       - isSynced = false

  3. RECONNECTION:
     Terminal uploads all unsynced sales:
       - Server validates offlineUuid uniqueness (idempotent)
       - Server validates saleNumber falls within assigned block range
       - POSSale.isSynced set to true
       - POSSerialBlock.nextNumber updated to last used + 1
       - If block exhausted: POSSerialBlock.isExhausted = true

  4. CONFLICT RESOLUTION:
     - Serial number collisions are impossible (disjoint ranges per terminal)
     - Duplicate uploads detected via offlineUuid
     - Stock conflicts resolved at deferred stock update (POS-013)
```

---

**POS-to-Invoice Transfer:**

When a customer requires a formal VAT invoice instead of a POS receipt, the sale can be transferred to the AR module:

```
  POSSale (status = COMPLETED)
       │
       │ transferToInvoice()
       │
       ▼
  ┌─────────────────────────────────────────────┐
  │ 1. Create CustomerInvoice:                  │
  │    invoiceType: CASH                        │
  │    customerId: from POSSale                 │
  │    invoiceDate: POSSale.completedAt         │
  │    status: POSTED (immediate)               │
  │                                             │
  │ 2. Create CustomerInvoiceLine per           │
  │    POSSaleLine (ACTIVE only):               │
  │    itemId, description, qty, price, VAT     │
  │                                             │
  │ 3. Create CustomerPayment:                  │
  │    Allocated 1:1 against the invoice        │
  │    paymentMethod from POSPayment records    │
  │    paidAmount = totalAmount (fully paid)     │
  │                                             │
  │ 4. Update POSSale:                          │
  │    transferredInvoiceId = invoice.id         │
  │    isTransferred = true                     │
  │                                             │
  │ 5. GL posting follows AR invoice lifecycle   │
  │    (not duplicated in POS cashup)           │
  └─────────────────────────────────────────────┘

  NOTE: Transferred sales are excluded from POS cashup GL posting
  to avoid double-counting. The AR module handles their GL impact.
```

---

**Cross-Module Dependencies:**

| Dependency | Module | Relationship | Notes |
|-----------|--------|-------------|-------|
| Customer | AR (section 2.15) | POSSale.customerId FK | Walk-in customer is default; named customer for returns, loyalty, on-account |
| CustomerInvoice | AR (section 2.15) | POSSale.transferredInvoiceId FK | Transfer-to-invoice creates AR invoice with type CASH |
| InventoryItem | Inventory (section 2.14) | POSSaleLine.itemId FK | Item lookup, pricing, stock deduction |
| StockMovement | Inventory (section 2.14) | Deferred creation | Stock deduction via scheduled maintenance job |
| Warehouse | Inventory (section 2.14) | POSSale.warehouseId FK | Stock location for deduction |
| ChartOfAccount | Finance GL (section 2.13) | POSPaymentMethod.glAccountCode, cashup GL posting | Payment method accounts, revenue, VAT accounts |
| JournalEntry | Finance GL (section 2.13) | POSCashup.journalEntryId FK | Cashup creates balanced GL entry |
| AccountMapping | Finance GL (section 2.13) | New type: POS_CLEARING | POS clearing account for cashup postings |
| VatCode | System (section 2.10) | POSSaleLine.vatCodeId FK | Tax rate lookup and calculation |
| NumberSeries | System (section 2.8) | Session, sale, cashup, cash movement numbers | Auto-numbering for all POS documents |
| PriceList | Pricing (section 2.19) | POSTerminal.defaultPriceListId, POSSale.priceListId | Price resolution for items |
| User | Auth / System | Session members, salesPersonId, journal userId | RBAC permissions, audit attribution |
| DocumentTemplate | System (section 2.12) | Receipt template | POS receipt formatting via template engine |
| SystemSetting | System (section 2.10) | pos.* settings | Tenant-level POS configuration |

---

**Required Addition to AccountMappingType Enum (section 2.13):**

The Finance module's `AccountMappingType` enum requires a new entry:

```prisma
enum AccountMappingType {
  // ... existing values ...
  POS_CLEARING              // POS sales clearing account (credited at cashup)
}
```

With seed data:
```typescript
{ mappingType: 'POS_CLEARING', accountCode: '4050', description: 'POS Sales Clearing' }
```

---

**Required Addition to JournalSource Enum (section 2.13):**

```prisma
enum JournalSource {
  // ... existing values ...
  POS_CASHUP                // POS end-of-session cashup posting
}
```

---

**Build Sequence Note:**

The POS module is targeted for **post-MVP Phase 1** in the implementation roadmap. It depends on:

1. **Stories 1-3**: Foundation (monorepo, database, auth/RBAC)
2. **Stories 4-6**: Finance core (GL, account mappings, journal entries)
3. **Stories 7-8**: System module (currencies, VAT codes, number series, payment terms, document templates)
4. **Stories 9-11**: AR module (Customer CRUD, invoice lifecycle -- needed for transfer-to-invoice and walk-in customer)
5. **Inventory module**: Item master, stock movements (needed for item lookup and deferred stock deduction)
6. **Pricing module**: Price lists (needed for item price resolution)

**Recommended build order within the POS module:**

1. **Schema migration** -- Add all POS models. Add `POS_CLEARING` to `AccountMappingType`, `POS_CASHUP` to `JournalSource`. Run `prisma migrate dev`.
2. **Seed data** -- Default payment methods (Cash, Visa, Mastercard, Amex, Debit), default button layout (1 main page + payment page), account mapping for POS_CLEARING.
3. **POSTerminal + CashDrawer CRUD** -- Terminal setup, drawer assignment, serial block allocation.
4. **POSPaymentMethod CRUD** -- Payment method configuration with GL account linkage.
5. **POSSession service** -- Open/close session with validation rules (POS-001, POS-002, POS-003).
6. **POSSale + POSSaleLine + POSPayment services** -- Core sale lifecycle: create sale, add items, apply discounts, tender payments, complete sale (POS-008, POS-009, POS-010, POS-014, POS-019).
7. **POSJournalEntry service** -- Audit trail recording for all POS actions (POS-017).
8. **POSCashMovement service** -- Cash in/out/float management (POS-004).
9. **POSCashup service** -- End-of-session cashup calculation, variance detection, GL posting (POS-011, POS-012, POS-016).
10. **Returns & voids** -- Return flow with reason codes, void with supervisor approval (POS-005, POS-006, POS-007).
11. **POSButtonLayout + POSButton CRUD** -- Button configuration UI.
12. **Receipt generation** -- Digital receipt via DocumentTemplate system, email delivery.
13. **Transfer-to-Invoice** -- AR integration for formal invoice generation (POS-020).
14. **Deferred stock update** -- Scheduled job for stock deduction (POS-013).
15. **Offline support** -- POSSerialBlock management, sync service, conflict resolution (POS-018).
16. **Reports** -- X-report, Z-report, electronic journal, audit trail report, sales by item/terminal/cashier.

---

*End of section 2.24*

### 2.25 Projects & Job Costing Module — Projects, Time Recording, Billing & Profitability

HansaWorld's "Job Costing" module (product family 25) conflates two fundamentally different domains: a Hotel/Reservations system (the overwhelming majority of the HAL source code, centred on `JobVc`, `ShopBaskVc`, `ResVc`, check-in/check-out workflows, folio billing) and a Project Management/Time Billing system (a separate set of records: `PRVc`, `TBIVVc`, `TBBUVc`, `ActVc`). For Nexa ERP, **only the Project Management side is implemented**. The hotel/reservations system is excluded entirely as it is not relevant to UK SME ERP requirements.

The Projects module enables UK SMEs to track project costs, record time and expenses against projects, apply rate cards for billing, generate invoices (both time-and-materials and fixed-price), and analyse project profitability. It integrates with CRM (activities linked to projects), Sales Orders (orders allocated to projects), Purchasing/AP (costs allocated to projects), HR (employee time recording), Finance/GL (project P&L posting), and AR (project invoice generation).

**Design decisions:**

- **Single Project entity with task hierarchy.** Rather than the legacy flat `PRVc` register (code + name + currency only), Nexa provides a richer `Project` model with budgets, dates, customer linkage, and a `ProjectTask` child table for work breakdown structure. Tasks are optional -- small projects can operate without them.
- **Unified ProjectTransaction for cost accumulation.** The legacy `TBIVVc` record tracks transactions from 7 source registers (timesheets, vendor invoices, expenses, shipments, activities, returns, service orders). Nexa replaces this with a single `ProjectTransaction` model that accumulates costs from all sources, each transaction referencing its source type and source document ID.
- **Timesheet as first-class entity.** Time recording is modelled as a `Timesheet` (header per employee per period) with `TimesheetEntry` lines (daily/hourly entries against projects/tasks). This replaces the implicit timesheet-to-project link in the legacy system and enables weekly/fortnightly approval workflows.
- **ProjectRateCard for billing rates.** The legacy `GetProjectPrice()` / `GetTimeClassPrice()` functions resolve rates from item price lists with project-specific overrides. Nexa simplifies this into a `ProjectRateCard` model that defines explicit billing rates per role, per item, or per employee, with effective date ranges.

---

#### Legacy-to-Nexa Mapping

| Legacy Register | Legacy Key | Fields | Nexa Model | Priority | Notes |
|---|---|---|---|---|---|
| PRVc | Project register | 3 (Code, Name, CurncyCode) | **Project** + **ProjectTask** | MVP | Enriched with budget, dates, status, customer, manager. Task hierarchy is new. |
| TBIVVc | Project transaction (invoiced) | 12 | **ProjectTransaction** | MVP | Unified cost accumulation from all sources. Tracks invoiced vs uninvoiced. |
| TBBUVc | Project budget | 8 + rows | **ProjectBudget** + **ProjectBudgetLine** | MVP | Budget by cost category with item-level breakdown. |
| PRSOINVc | Project-to-SO link | 6 (COMMENTED OUT in legacy) | FK on SalesOrder.projectId | MVP | Already defined in SalesOrder model (section 2.16). |
| ActVc (TodoFlag=8) | Activity/project task | subset | **CrmActivity** with projectId FK | MVP | Reuses CRM Activity model with project linkage. |
| ProjInfoRepVc | Report config | 1 | N/A | -- | Report configuration handled by Reporting module settings. |
| -- (new) | -- | -- | **Timesheet** + **TimesheetEntry** | MVP | First-class time recording. No direct legacy equivalent (was implicit). |
| -- (new) | -- | -- | **ProjectExpense** | MVP | Expense recording against projects. |
| -- (new) | -- | -- | **ProjectRateCard** | MVP | Billing rate cards. Replaces legacy GetProjectPrice()/GetTimeClassPrice(). |
| -- (new) | -- | -- | **ProjectInvoiceSchedule** | P1 | Scheduled billing milestones for fixed-price projects. |
| JobVc | Reservation/Job | 98+ | **EXCLUDED** | -- | Hotel/reservations system. Not relevant. |
| ShopBaskVc | Folio/Basket | 20+ | **EXCLUDED** | -- | Hotel charge accumulation. Not relevant. |
| ResVc | Resource/Room | 6+ | **EXCLUDED** | -- | Hotel resources. Not relevant. |
| ResTypeVc | Resource Type | 7+ | **EXCLUDED** | -- | Hotel room types. Not relevant. |
| ResUsageVc | Room Package | 6+ rows | **EXCLUDED** | -- | Hotel packages. Not relevant. |
| ReservationStatusVc | Res. Status | 2 | **EXCLUDED** | -- | Hotel status workflow. Not relevant. |
| ReserSeqVc | Status Sequence | -- | **EXCLUDED** | -- | Hotel status transitions. Not relevant. |
| JobPriceVc | Daily Price Breakdown | 22+ rows | **EXCLUDED** | -- | Hotel per-day pricing. Not relevant. |
| PriceRulesVc | Pricing Rules | 8+ | **EXCLUDED** | -- | Hotel pricing rules. Not relevant. |
| CClassDVc | Class Discount | -- | **EXCLUDED** | -- | Hotel classification discounts. Not relevant. |
| FollowUpVc | Follow-Up | 8 | **EXCLUDED** | -- | Hotel follow-ups. Not relevant. |
| GuestObserVc | Guest Observation | 7 | **EXCLUDED** | -- | Hotel guest preferences. Not relevant. |
| ExcursionrsVc | Event History | 6 | **EXCLUDED** | -- | Hotel excursions. Not relevant. |
| HCUDVc | Hotel Customer Deal | 2 | **EXCLUDED** | -- | Hotel deal terms. Not relevant. |
| HotelBlock | Hotel Settings | 30+ | **EXCLUDED** | -- | Hotel configuration. Not relevant. |
| HotelDownPayBlock | Hotel Downpay | 8 | **EXCLUDED** | -- | Hotel deposits. Not relevant. |
| HotelShiftsBlock | Shift Config | 10 | **EXCLUDED** | -- | Hotel shifts. Not relevant. |
| BookOrgBlock | Booking Origin | 2 rows | **EXCLUDED** | -- | Hotel booking channels. Not relevant. |

#### Key Legacy Field Mappings (PRVc -> Project)

| HAL Field | HAL Type | Nexa Field | Nexa Model | Strategy |
|-----------|----------|-----------|------------|----------|
| Code | String | projectNumber | Project | DIRECT (auto via NumberSeries "PRJ-00001") |
| Name | String | name | Project | DIRECT |
| CurncyCode | String | currencyCode | Project | DIRECT (default GBP) |
| -- (new) | -- | customerId | Project | NEW: FK to Customer |
| -- (new) | -- | projectManagerId | Project | NEW: FK to User |
| -- (new) | -- | status | Project | NEW: ProjectStatus enum |
| -- (new) | -- | billingMethod | Project | NEW: TIME_AND_MATERIALS or FIXED_PRICE |
| -- (new) | -- | budgetAmount | Project | NEW: overall budget cap |

#### Key Legacy Field Mappings (TBIVVc -> ProjectTransaction)

| HAL Field | HAL Type | Nexa Field | Nexa Model | Strategy |
|-----------|----------|-----------|------------|----------|
| SerNr | LongInt | id | ProjectTransaction | UUID (replaces serial) |
| PRCode | String | projectId | ProjectTransaction | FK to Project |
| oVc | Integer | sourceType | ProjectTransaction | TRANSFORM to ProjectTransactionSourceType enum |
| TransDate | Date | transactionDate | ProjectTransaction | DIRECT |
| ArtCode | String | itemId | ProjectTransaction | FK to InventoryItem (optional) |
| Sum | Val | costAmount / billableAmount | ProjectTransaction | DECOMPOSE into cost and billable amounts |
| InvQty | Val | quantity | ProjectTransaction | DIRECT |
| Invoice | LongInt | invoiceId | ProjectTransaction | FK to CustomerInvoice (when invoiced) |
| EMCode | String | employeeId | ProjectTransaction | FK to Employee |
| CurncyCode | String | currencyCode | ProjectTransaction | DIRECT |

---

#### Prisma Schema

```prisma
// ═══════════════════════════════════════════════════════════════
// PROJECTS & JOB COSTING MODULE — Projects, Time Recording,
// Billing & Profitability (section 2.25)
// ═══════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────
// ENUMS
// ───────────────────────────────────────────────────────────────

enum ProjectStatus {
  DRAFT
  ACTIVE
  ON_HOLD
  COMPLETED
  CANCELLED
  ARCHIVED

  @@map("project_status")
}

enum ProjectBillingMethod {
  TIME_AND_MATERIALS
  FIXED_PRICE
  NON_BILLABLE

  @@map("project_billing_method")
}

enum ProjectTaskStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  CANCELLED

  @@map("project_task_status")
}

enum TimesheetStatus {
  DRAFT
  SUBMITTED
  APPROVED
  REJECTED

  @@map("timesheet_status")
}

enum ProjectExpenseStatus {
  DRAFT
  SUBMITTED
  APPROVED
  REJECTED
  INVOICED

  @@map("project_expense_status")
}

enum ProjectTransactionSourceType {
  TIMESHEET           // From TimesheetEntry (legacy oVc=1)
  VENDOR_INVOICE      // From SupplierBill (legacy oVc=2)
  EXPENSE             // From ProjectExpense (legacy oVc=3)
  GOODS_RECEIPT       // From GoodsReceipt/Shipment (legacy oVc=4)
  ACTIVITY            // From CrmActivity (legacy oVc=5)
  PURCHASE_ORDER      // From PurchaseOrder
  MANUAL              // Manual cost entry

  @@map("project_transaction_source_type")
}

enum ProjectTransactionStatus {
  PENDING             // Awaiting approval
  APPROVED            // Cost confirmed
  INVOICED            // Billed to customer
  WRITTEN_OFF         // Non-recoverable cost

  @@map("project_transaction_status")
}

enum ProjectRateType {
  ROLE                // Rate per role/job title
  EMPLOYEE            // Rate per specific employee
  ITEM                // Rate per item/service code
  TASK                // Rate per project task

  @@map("project_rate_type")
}

enum ProjectInvoiceScheduleStatus {
  PENDING
  INVOICED
  CANCELLED

  @@map("project_invoice_schedule_status")
}

// ───────────────────────────────────────────────────────────────
// Project — Core Project Entity
// ───────────────────────────────────────────────────────────────

model Project {
  id                        String                @id @default(uuid())
  projectNumber             String                @unique @map("project_number")          // Auto via NumberSeries "PRJ-00001"

  // ── Identity ──
  name                      String                @db.VarChar(200)
  description               String?               @db.Text

  // ── Customer ──
  customerId                String?               @map("customer_id")                     // FK to Customer (billable projects)
  customerName              String?               @map("customer_name") @db.VarChar(200)  // Denormalised snapshot

  // ── Ownership ──
  projectManagerId          String?               @map("project_manager_id")              // FK to User
  departmentCode            String?               @map("department_code") @db.VarChar(20) // FK to Department

  // ── Dates ──
  startDate                 DateTime?             @map("start_date") @db.Date
  endDate                   DateTime?             @map("end_date") @db.Date
  actualStartDate           DateTime?             @map("actual_start_date") @db.Date
  actualEndDate             DateTime?             @map("actual_end_date") @db.Date

  // ── Status & Billing ──
  status                    ProjectStatus         @default(DRAFT)
  billingMethod             ProjectBillingMethod   @default(TIME_AND_MATERIALS)

  // ── Budget (header-level summary) ──
  budgetAmount              Decimal               @default(0) @map("budget_amount") @db.Decimal(19, 4)
  budgetHours               Decimal               @default(0) @map("budget_hours") @db.Decimal(10, 2)

  // ── Actuals (maintained counters, updated transactionally) ──
  actualCost                Decimal               @default(0) @map("actual_cost") @db.Decimal(19, 4)
  actualRevenue             Decimal               @default(0) @map("actual_revenue") @db.Decimal(19, 4)
  actualHours               Decimal               @default(0) @map("actual_hours") @db.Decimal(10, 2)
  invoicedAmount            Decimal               @default(0) @map("invoiced_amount") @db.Decimal(19, 4)
  uninvoicedAmount          Decimal               @default(0) @map("uninvoiced_amount") @db.Decimal(19, 4)

  // ── Currency ──
  currencyCode              String                @default("GBP") @map("currency_code") @db.VarChar(3)
  exchangeRate              Decimal               @default(1) @map("exchange_rate") @db.Decimal(10, 6)

  // ── Classification ──
  tagCode                   String?               @map("tag_code") @db.VarChar(20)       // FK to Tag (cost object dimension)
  categoryCode              String?               @map("category_code") @db.VarChar(50)  // Free classification

  // ── Pricing ──
  defaultRateCardId         String?               @map("default_rate_card_id")            // FK to ProjectRateCard
  priceListId               String?               @map("price_list_id")                   // FK to PriceList (fallback pricing)

  // ── Notes ──
  notes                     String?               @db.Text
  customerReference         String?               @map("customer_reference") @db.VarChar(100) // Customer's own PO/ref

  // ── Completion ──
  percentComplete           Decimal               @default(0) @map("percent_complete") @db.Decimal(5, 2) // 0.00-100.00

  // ── Audit ──
  createdAt                 DateTime              @default(now()) @map("created_at")
  updatedAt                 DateTime              @updatedAt @map("updated_at")
  createdBy                 String                @map("created_by")
  updatedBy                 String                @map("updated_by")

  // ── Relations ──
  tasks                     ProjectTask[]
  transactions              ProjectTransaction[]
  budgets                   ProjectBudget[]
  expenses                  ProjectExpense[]
  rateCards                 ProjectRateCard[]
  invoiceSchedules          ProjectInvoiceSchedule[]

  @@map("projects")
  @@index([customerId], map: "idx_projects_customer")
  @@index([status], map: "idx_projects_status")
  @@index([projectManagerId], map: "idx_projects_manager")
  @@index([departmentCode], map: "idx_projects_department")
  @@index([startDate, endDate], map: "idx_projects_dates")
  @@index([tagCode], map: "idx_projects_tag")
}

// ───────────────────────────────────────────────────────────────
// ProjectTask — Work Breakdown Structure
// ───────────────────────────────────────────────────────────────

model ProjectTask {
  id                        String                @id @default(uuid())
  projectId                 String                @map("project_id")
  parentTaskId              String?               @map("parent_task_id")                  // Self-ref for hierarchy

  // ── Identity ──
  taskNumber                Int                   @map("task_number")                     // Sequential within project
  name                      String                @db.VarChar(200)
  description               String?               @db.Text

  // ── Dates ──
  plannedStartDate          DateTime?             @map("planned_start_date") @db.Date
  plannedEndDate            DateTime?             @map("planned_end_date") @db.Date
  actualStartDate           DateTime?             @map("actual_start_date") @db.Date
  actualEndDate             DateTime?             @map("actual_end_date") @db.Date

  // ── Budget ──
  budgetHours               Decimal               @default(0) @map("budget_hours") @db.Decimal(10, 2)
  budgetAmount              Decimal               @default(0) @map("budget_amount") @db.Decimal(19, 4)

  // ── Actuals (maintained counters) ──
  actualHours               Decimal               @default(0) @map("actual_hours") @db.Decimal(10, 2)
  actualCost                Decimal               @default(0) @map("actual_cost") @db.Decimal(19, 4)

  // ── Status ──
  status                    ProjectTaskStatus     @default(NOT_STARTED)
  percentComplete           Decimal               @default(0) @map("percent_complete") @db.Decimal(5, 2)

  // ── Assignment ──
  assignedToId              String?               @map("assigned_to_id")                  // FK to User

  // ── Sort ──
  sortOrder                 Int                   @default(0) @map("sort_order")

  // ── Billable override ──
  isBillable                Boolean               @default(true) @map("is_billable")      // Override project billing method

  // ── Audit ──
  createdAt                 DateTime              @default(now()) @map("created_at")
  updatedAt                 DateTime              @updatedAt @map("updated_at")

  // ── Relations ──
  project                   Project               @relation(fields: [projectId], references: [id], onDelete: Cascade)
  parentTask                ProjectTask?          @relation("TaskHierarchy", fields: [parentTaskId], references: [id])
  childTasks                ProjectTask[]         @relation("TaskHierarchy")
  timesheetEntries          TimesheetEntry[]
  transactions              ProjectTransaction[]

  @@map("project_tasks")
  @@unique([projectId, taskNumber], map: "uq_project_tasks_project_number")
  @@index([projectId], map: "idx_project_tasks_project")
  @@index([parentTaskId], map: "idx_project_tasks_parent")
  @@index([status], map: "idx_project_tasks_status")
  @@index([assignedToId], map: "idx_project_tasks_assigned")
}

// ───────────────────────────────────────────────────────────────
// Timesheet — Employee Time Recording (Header)
// ───────────────────────────────────────────────────────────────

model Timesheet {
  id                        String                @id @default(uuid())
  timesheetNumber           String                @unique @map("timesheet_number")        // Auto via NumberSeries "TS-00001"

  // ── Employee ──
  employeeId                String                @map("employee_id")                     // FK to Employee
  employeeName              String                @map("employee_name") @db.VarChar(200)  // Denormalised snapshot

  // ── Period ──
  periodStartDate           DateTime              @map("period_start_date") @db.Date      // Monday of the week (or period start)
  periodEndDate             DateTime              @map("period_end_date") @db.Date        // Sunday (or period end)

  // ── Totals (maintained counters) ──
  totalHours                Decimal               @default(0) @map("total_hours") @db.Decimal(10, 2)
  totalBillableHours        Decimal               @default(0) @map("total_billable_hours") @db.Decimal(10, 2)
  totalCostAmount           Decimal               @default(0) @map("total_cost_amount") @db.Decimal(19, 4)
  totalBillableAmount       Decimal               @default(0) @map("total_billable_amount") @db.Decimal(19, 4)

  // ── Status ──
  status                    TimesheetStatus       @default(DRAFT)
  submittedAt               DateTime?             @map("submitted_at")
  approvedAt                DateTime?             @map("approved_at")
  approvedBy                String?               @map("approved_by")                     // FK to User (approver)
  rejectionReason           String?               @map("rejection_reason")

  // ── Notes ──
  notes                     String?               @db.Text

  // ── Audit ──
  createdAt                 DateTime              @default(now()) @map("created_at")
  updatedAt                 DateTime              @updatedAt @map("updated_at")
  createdBy                 String                @map("created_by")
  updatedBy                 String                @map("updated_by")

  // ── Relations ──
  entries                   TimesheetEntry[]

  @@map("timesheets")
  @@unique([employeeId, periodStartDate], map: "uq_timesheets_employee_period")
  @@index([employeeId], map: "idx_timesheets_employee")
  @@index([status], map: "idx_timesheets_status")
  @@index([periodStartDate, periodEndDate], map: "idx_timesheets_period")
  @@index([approvedBy], map: "idx_timesheets_approver")
}

// ───────────────────────────────────────────────────────────────
// TimesheetEntry — Individual Time Entry Line
// ───────────────────────────────────────────────────────────────

model TimesheetEntry {
  id                        String                @id @default(uuid())
  timesheetId               String                @map("timesheet_id")

  // ── Project & Task ──
  projectId                 String                @map("project_id")                      // FK to Project (required)
  taskId                    String?               @map("task_id")                         // FK to ProjectTask (optional)

  // ── Time ──
  entryDate                 DateTime              @map("entry_date") @db.Date
  hours                     Decimal               @map("hours") @db.Decimal(6, 2)         // e.g. 7.50
  startTime                 DateTime?             @map("start_time") @db.Time(0)          // Optional clock-in time
  endTime                   DateTime?             @map("end_time") @db.Time(0)            // Optional clock-out time
  breakMinutes              Int                   @default(0) @map("break_minutes")       // Break duration in minutes

  // ── Billing ──
  isBillable                Boolean               @default(true) @map("is_billable")
  billingRate               Decimal?              @map("billing_rate") @db.Decimal(19, 4)  // Rate at time of entry (from rate card)
  billableAmount            Decimal               @default(0) @map("billable_amount") @db.Decimal(19, 4) // hours * billingRate

  // ── Cost ──
  costRate                  Decimal?              @map("cost_rate") @db.Decimal(19, 4)    // Employee cost rate
  costAmount                Decimal               @default(0) @map("cost_amount") @db.Decimal(19, 4) // hours * costRate

  // ── Item/Activity ──
  itemId                    String?               @map("item_id")                         // FK to InventoryItem (service item for billing)
  activityTypeCode          String?               @map("activity_type_code") @db.VarChar(20) // Time class / activity type

  // ── Description ──
  description               String?               @db.Text                                // Work performed narrative

  // ── Invoice tracking ──
  isInvoiced                Boolean               @default(false) @map("is_invoiced")
  invoiceId                 String?               @map("invoice_id")                      // FK to CustomerInvoice (when billed)

  // ── Audit ──
  createdAt                 DateTime              @default(now()) @map("created_at")
  updatedAt                 DateTime              @updatedAt @map("updated_at")

  // ── Relations ──
  timesheet                 Timesheet             @relation(fields: [timesheetId], references: [id], onDelete: Cascade)
  task                      ProjectTask?          @relation(fields: [taskId], references: [id])

  @@map("timesheet_entries")
  @@unique([timesheetId, entryDate, projectId, taskId], map: "uq_timesheet_entries_date_project_task")
  @@index([projectId], map: "idx_timesheet_entries_project")
  @@index([taskId], map: "idx_timesheet_entries_task")
  @@index([entryDate], map: "idx_timesheet_entries_date")
  @@index([isInvoiced], map: "idx_timesheet_entries_invoiced")
  @@index([invoiceId], map: "idx_timesheet_entries_invoice")
}

// ───────────────────────────────────────────────────────────────
// ProjectExpense — Expense Claims Against Projects
// ───────────────────────────────────────────────────────────────

model ProjectExpense {
  id                        String                @id @default(uuid())

  // ── Project & Task ──
  projectId                 String                @map("project_id")                      // FK to Project
  taskId                    String?               @map("task_id")                         // FK to ProjectTask (optional)

  // ── Employee ──
  employeeId                String                @map("employee_id")                     // FK to Employee (who incurred)
  employeeName              String                @map("employee_name") @db.VarChar(200)  // Denormalised snapshot

  // ── Expense Detail ──
  expenseDate               DateTime              @map("expense_date") @db.Date
  description               String                @db.VarChar(500)
  itemId                    String?               @map("item_id")                         // FK to InventoryItem (expense category item)

  // ── Amounts ──
  quantity                  Decimal               @default(1) @map("quantity") @db.Decimal(10, 4)
  unitPrice                 Decimal               @map("unit_price") @db.Decimal(19, 4)
  totalAmount               Decimal               @map("total_amount") @db.Decimal(19, 4) // quantity * unitPrice
  vatCodeId                 String?               @map("vat_code_id")                     // FK to VatCode
  vatAmount                 Decimal               @default(0) @map("vat_amount") @db.Decimal(19, 4)

  // ── Currency ──
  currencyCode              String                @default("GBP") @map("currency_code") @db.VarChar(3)
  exchangeRate              Decimal               @default(1) @map("exchange_rate") @db.Decimal(10, 6)
  baseAmount                Decimal               @default(0) @map("base_amount") @db.Decimal(19, 4) // totalAmount in base currency

  // ── Billing ──
  isBillable                Boolean               @default(true) @map("is_billable")
  markupPercent             Decimal               @default(0) @map("markup_percent") @db.Decimal(5, 2) // Markup for rebilling
  billableAmount            Decimal               @default(0) @map("billable_amount") @db.Decimal(19, 4) // totalAmount * (1 + markup%)

  // ── Status & Invoice ──
  status                    ProjectExpenseStatus  @default(DRAFT)
  submittedAt               DateTime?             @map("submitted_at")
  approvedAt                DateTime?             @map("approved_at")
  approvedBy                String?               @map("approved_by")
  rejectionReason           String?               @map("rejection_reason")
  isInvoiced                Boolean               @default(false) @map("is_invoiced")
  invoiceId                 String?               @map("invoice_id")                      // FK to CustomerInvoice (when billed)

  // ── Receipt ──
  receiptAttachmentId       String?               @map("receipt_attachment_id")            // FK to attachment/file storage

  // ── Audit ──
  createdAt                 DateTime              @default(now()) @map("created_at")
  updatedAt                 DateTime              @updatedAt @map("updated_at")
  createdBy                 String                @map("created_by")
  updatedBy                 String                @map("updated_by")

  @@map("project_expenses")
  @@index([projectId], map: "idx_project_expenses_project")
  @@index([taskId], map: "idx_project_expenses_task")
  @@index([employeeId], map: "idx_project_expenses_employee")
  @@index([status], map: "idx_project_expenses_status")
  @@index([expenseDate], map: "idx_project_expenses_date")
  @@index([isInvoiced], map: "idx_project_expenses_invoiced")
}

// ───────────────────────────────────────────────────────────────
// ProjectTransaction — Unified Cost Accumulation
// (Replaces legacy TBIVVc with multi-source tracking)
// ───────────────────────────────────────────────────────────────

model ProjectTransaction {
  id                        String                        @id @default(uuid())

  // ── Project & Task ──
  projectId                 String                        @map("project_id")                // FK to Project
  taskId                    String?                       @map("task_id")                   // FK to ProjectTask (optional)

  // ── Source Tracking ──
  sourceType                ProjectTransactionSourceType  @map("source_type")
  sourceId                  String                        @map("source_id")                 // UUID of source document
  sourceReference           String?                       @map("source_reference") @db.VarChar(100) // Human-readable ref (e.g. "TS-00015 line 3")

  // ── Transaction Detail ──
  transactionDate           DateTime                      @map("transaction_date") @db.Date
  description               String                        @db.VarChar(500)
  itemId                    String?                       @map("item_id")                   // FK to InventoryItem
  employeeId                String?                       @map("employee_id")               // FK to Employee

  // ── Quantities ──
  quantity                  Decimal                       @default(0) @map("quantity") @db.Decimal(10, 4)
  unitOfMeasure             String?                       @map("unit_of_measure") @db.VarChar(20)

  // ── Cost (what it cost the business) ──
  costRate                  Decimal                       @default(0) @map("cost_rate") @db.Decimal(19, 4)
  costAmount                Decimal                       @default(0) @map("cost_amount") @db.Decimal(19, 4)

  // ── Billing (what to charge the customer) ──
  isBillable                Boolean                       @default(true) @map("is_billable")
  billingRate               Decimal                       @default(0) @map("billing_rate") @db.Decimal(19, 4)
  billableAmount            Decimal                       @default(0) @map("billable_amount") @db.Decimal(19, 4)

  // ── Currency ──
  currencyCode              String                        @default("GBP") @map("currency_code") @db.VarChar(3)
  exchangeRate              Decimal                       @default(1) @map("exchange_rate") @db.Decimal(10, 6)
  baseCostAmount            Decimal                       @default(0) @map("base_cost_amount") @db.Decimal(19, 4)
  baseBillableAmount        Decimal                       @default(0) @map("base_billable_amount") @db.Decimal(19, 4)

  // ── Status & Invoicing ──
  status                    ProjectTransactionStatus      @default(PENDING)
  invoiceId                 String?                       @map("invoice_id")                // FK to CustomerInvoice
  invoicedAt                DateTime?                     @map("invoiced_at")

  // ── GL Posting ──
  journalEntryId            String?                       @map("journal_entry_id")          // FK to JournalEntry (when posted to GL)

  // ── Audit ──
  createdAt                 DateTime                      @default(now()) @map("created_at")
  updatedAt                 DateTime                      @updatedAt @map("updated_at")
  createdBy                 String                        @map("created_by")
  updatedBy                 String                        @map("updated_by")

  // ── Relations ──
  project                   Project                       @relation(fields: [projectId], references: [id])
  task                      ProjectTask?                  @relation(fields: [taskId], references: [id])

  @@map("project_transactions")
  @@index([projectId], map: "idx_project_transactions_project")
  @@index([taskId], map: "idx_project_transactions_task")
  @@index([sourceType, sourceId], map: "idx_project_transactions_source")
  @@index([transactionDate], map: "idx_project_transactions_date")
  @@index([status], map: "idx_project_transactions_status")
  @@index([invoiceId], map: "idx_project_transactions_invoice")
  @@index([employeeId], map: "idx_project_transactions_employee")
  @@index([isBillable, status], map: "idx_project_transactions_billable_status")
}

// ───────────────────────────────────────────────────────────────
// ProjectBudget — Budget Header (per project, per revision)
// (Replaces legacy TBBUVc)
// ───────────────────────────────────────────────────────────────

model ProjectBudget {
  id                        String                @id @default(uuid())
  projectId                 String                @map("project_id")                      // FK to Project

  // ── Budget Identity ──
  revisionNumber            Int                   @map("revision_number")                 // 1, 2, 3... for budget revisions
  name                      String                @db.VarChar(200)                        // "Original Budget", "Revision 2", etc.
  isActive                  Boolean               @default(true) @map("is_active")        // Only one active budget per project

  // ── Budget Period ──
  budgetDate                DateTime              @map("budget_date") @db.Date
  startDate                 DateTime?             @map("start_date") @db.Date
  endDate                   DateTime?             @map("end_date") @db.Date

  // ── Category Flags (legacy BudTime/BudStocked/BudMaterial/BudOther) ──
  includeLabour             Boolean               @default(true) @map("include_labour")
  includeMaterials          Boolean               @default(true) @map("include_materials")
  includeExpenses           Boolean               @default(true) @map("include_expenses")
  includeOther              Boolean               @default(true) @map("include_other")

  // ── Totals (maintained from lines) ──
  totalAmount               Decimal               @default(0) @map("total_amount") @db.Decimal(19, 4)
  totalHours                Decimal               @default(0) @map("total_hours") @db.Decimal(10, 2)

  // ── Currency ──
  currencyCode              String                @default("GBP") @map("currency_code") @db.VarChar(3)

  // ── Notes ──
  notes                     String?               @db.Text

  // ── Audit ──
  createdAt                 DateTime              @default(now()) @map("created_at")
  updatedAt                 DateTime              @updatedAt @map("updated_at")
  createdBy                 String                @map("created_by")
  updatedBy                 String                @map("updated_by")

  // ── Relations ──
  project                   Project               @relation(fields: [projectId], references: [id], onDelete: Cascade)
  lines                     ProjectBudgetLine[]

  @@map("project_budgets")
  @@unique([projectId, revisionNumber], map: "uq_project_budgets_project_revision")
  @@index([projectId], map: "idx_project_budgets_project")
  @@index([isActive], map: "idx_project_budgets_active")
}

// ───────────────────────────────────────────────────────────────
// ProjectBudgetLine — Budget Line Items
// ───────────────────────────────────────────────────────────────

model ProjectBudgetLine {
  id                        String                @id @default(uuid())
  budgetId                  String                @map("budget_id")

  // ── Line Detail ──
  lineNumber                Int                   @map("line_number")
  taskId                    String?               @map("task_id")                         // FK to ProjectTask (optional)
  itemId                    String?               @map("item_id")                         // FK to InventoryItem
  description               String                @db.VarChar(500)

  // ── Category ──
  costCategory              String                @map("cost_category") @db.VarChar(30)   // "LABOUR", "MATERIALS", "EXPENSES", "OTHER"

  // ── Amounts ──
  quantity                  Decimal               @default(0) @map("quantity") @db.Decimal(10, 4)
  unitRate                  Decimal               @default(0) @map("unit_rate") @db.Decimal(19, 4)
  budgetAmount              Decimal               @default(0) @map("budget_amount") @db.Decimal(19, 4) // quantity * unitRate
  budgetHours               Decimal               @default(0) @map("budget_hours") @db.Decimal(10, 2)  // For labour lines

  // ── Audit ──
  createdAt                 DateTime              @default(now()) @map("created_at")
  updatedAt                 DateTime              @updatedAt @map("updated_at")

  // ── Relations ──
  budget                    ProjectBudget         @relation(fields: [budgetId], references: [id], onDelete: Cascade)

  @@map("project_budget_lines")
  @@unique([budgetId, lineNumber], map: "uq_project_budget_lines_budget_line")
  @@index([budgetId], map: "idx_project_budget_lines_budget")
  @@index([taskId], map: "idx_project_budget_lines_task")
  @@index([costCategory], map: "idx_project_budget_lines_category")
}

// ───────────────────────────────────────────────────────────────
// ProjectRateCard — Billing Rate Definitions
// (Replaces legacy GetProjectPrice / GetTimeClassPrice)
// ───────────────────────────────────────────────────────────────

model ProjectRateCard {
  id                        String                @id @default(uuid())
  projectId                 String                @map("project_id")                      // FK to Project

  // ── Identity ──
  name                      String                @db.VarChar(200)                        // "Standard Rates 2026", "Discounted Rates"
  isDefault                 Boolean               @default(false) @map("is_default")

  // ── Validity ──
  effectiveFrom             DateTime              @map("effective_from") @db.Date
  effectiveTo               DateTime?             @map("effective_to") @db.Date           // Null = no expiry

  // ── Currency ──
  currencyCode              String                @default("GBP") @map("currency_code") @db.VarChar(3)

  // ── Status ──
  isActive                  Boolean               @default(true) @map("is_active")

  // ── Notes ──
  notes                     String?               @db.Text

  // ── Audit ──
  createdAt                 DateTime              @default(now()) @map("created_at")
  updatedAt                 DateTime              @updatedAt @map("updated_at")
  createdBy                 String                @map("created_by")
  updatedBy                 String                @map("updated_by")

  // ── Relations ──
  project                   Project               @relation(fields: [projectId], references: [id], onDelete: Cascade)
  entries                   ProjectRateCardEntry[]

  @@map("project_rate_cards")
  @@index([projectId], map: "idx_project_rate_cards_project")
  @@index([isActive], map: "idx_project_rate_cards_active")
  @@index([effectiveFrom, effectiveTo], map: "idx_project_rate_cards_dates")
}

model ProjectRateCardEntry {
  id                        String                @id @default(uuid())
  rateCardId                String                @map("rate_card_id")

  // ── Rate Definition ──
  rateType                  ProjectRateType       @map("rate_type")
  referenceCode             String                @map("reference_code") @db.VarChar(100) // Role code, employee ID, item code, or task ID depending on rateType

  // ── Rates ──
  billingRate               Decimal               @map("billing_rate") @db.Decimal(19, 4) // Rate charged to customer
  costRate                  Decimal?              @map("cost_rate") @db.Decimal(19, 4)    // Internal cost rate (for margin calc)

  // ── Description ──
  description               String?               @db.VarChar(200)                        // "Senior Developer", "Project Manager", etc.

  // ── Audit ──
  createdAt                 DateTime              @default(now()) @map("created_at")
  updatedAt                 DateTime              @updatedAt @map("updated_at")

  // ── Relations ──
  rateCard                  ProjectRateCard       @relation(fields: [rateCardId], references: [id], onDelete: Cascade)

  @@map("project_rate_card_entries")
  @@unique([rateCardId, rateType, referenceCode], map: "uq_rate_card_entries_type_ref")
  @@index([rateCardId], map: "idx_rate_card_entries_card")
  @@index([rateType], map: "idx_rate_card_entries_type")
}

// ───────────────────────────────────────────────────────────────
// ProjectInvoiceSchedule — Fixed-Price Milestone Billing
// ───────────────────────────────────────────────────────────────

model ProjectInvoiceSchedule {
  id                        String                            @id @default(uuid())
  projectId                 String                            @map("project_id")              // FK to Project

  // ── Milestone ──
  milestoneNumber           Int                               @map("milestone_number")
  description               String                            @db.VarChar(500)
  scheduledDate             DateTime                          @map("scheduled_date") @db.Date

  // ── Amount ──
  amount                    Decimal                           @map("amount") @db.Decimal(19, 4)
  percentOfTotal            Decimal?                          @map("percent_of_total") @db.Decimal(5, 2) // e.g. 25.00 for 25%

  // ── Status ──
  status                    ProjectInvoiceScheduleStatus      @default(PENDING)
  invoiceId                 String?                           @map("invoice_id")              // FK to CustomerInvoice (when invoiced)
  invoicedAt                DateTime?                         @map("invoiced_at")

  // ── Audit ──
  createdAt                 DateTime                          @default(now()) @map("created_at")
  updatedAt                 DateTime                          @updatedAt @map("updated_at")
  createdBy                 String                            @map("created_by")
  updatedBy                 String                            @map("updated_by")

  // ── Relations ──
  project                   Project                           @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@map("project_invoice_schedules")
  @@unique([projectId, milestoneNumber], map: "uq_project_invoice_schedules_milestone")
  @@index([projectId], map: "idx_project_invoice_schedules_project")
  @@index([status], map: "idx_project_invoice_schedules_status")
  @@index([scheduledDate], map: "idx_project_invoice_schedules_date")
}
```

---

#### Project Lifecycle

```
                    ┌─────────────┐
                    │    DRAFT    │  Project created, budget prepared
                    │   Project   │  Tasks defined (optional)
                    └──────┬──────┘  Rate cards configured
                           │ activate()
                           ▼
                    ┌─────────────┐
                    │   ACTIVE    │  Time/expenses can be recorded
                    │             │  Transactions accumulate
                    └──┬───┬───┬──┘  Invoices can be generated
                       │   │   │
          onHold()     │   │   │ complete()
                       │   │   │
                       ▼   │   ▼
              ┌────────┐   │  ┌──────────────┐
              │ON_HOLD │   │  │  COMPLETED   │  All work finished
              └───┬────┘   │  │              │  Final invoice generated
                  │        │  └──────┬───────┘  P&L report finalised
           resume()        │         │
                  │        │         │ archive()
                  └────┐   │         │
                       │   │         ▼
                       ▼   │  ┌──────────────┐
                    ACTIVE │  │  ARCHIVED    │  Historical record only
                           │  └──────────────┘
                           │
                    cancel()
                           │
                           ▼
                    ┌──────────────┐
                    │  CANCELLED   │  Write off uninvoiced costs
                    └──────────────┘

  At any pre-completed state:
         cancel() ──────► CANCELLED (writes off uninvoiced amounts)
```

---

#### Timesheet Approval Workflow

```
                    ┌─────────────┐
                    │    DRAFT    │  Employee enters time daily
                    │  Timesheet  │  Lines added/edited freely
                    └──────┬──────┘
                           │ submit()
                           │ [Validates: all entries have project,
                           │  hours > 0, dates within period]
                           ▼
                    ┌─────────────┐
                    │  SUBMITTED  │  Locked for editing
                    │             │  Manager notified
                    └──┬───────┬──┘
                       │       │
            approve()  │       │ reject(reason)
                       │       │
                       ▼       ▼
              ┌────────┐  ┌──────────┐
              │APPROVED│  │ REJECTED │  Returns to DRAFT
              └───┬────┘  └──────────┘  with rejection reason
                  │
                  │ [Post-approval side effects:]
                  │   1. Create ProjectTransaction per entry
                  │   2. Update Project.actualHours/actualCost
                  │   3. Update ProjectTask.actualHours/actualCost
                  │   4. Emit timesheet.approved event
                  ▼
           Transactions created
           (available for invoicing)
```

---

#### T&M Invoice Generation Workflow

```
1. User selects Project (status = ACTIVE)
2. System queries uninvoiced ProjectTransactions:
   - WHERE projectId = :id
   - AND isBillable = true
   - AND status = APPROVED
   - AND invoiceId IS NULL
   - ORDER BY transactionDate, sourceType

3. System groups by cost category:
   ┌───────────────────────────────────────────┐
   │  Labour (TIMESHEET)                       │
   │    2026-02-01  8h @ £85/hr    = £680.00  │
   │    2026-02-02  7.5h @ £85/hr  = £637.50  │
   │    2026-02-03  6h @ £120/hr   = £720.00  │
   ├───────────────────────────────────────────┤
   │  Expenses (EXPENSE)                       │
   │    2026-02-01  Travel          = £145.00  │
   │    2026-02-02  Software        = £299.00  │
   ├───────────────────────────────────────────┤
   │  Materials (GOODS_RECEIPT)                │
   │    2026-02-03  Components      = £1,200   │
   └───────────────────────────────────────────┘
   Subtotal: £3,681.50

4. User reviews, adjusts if needed, confirms

5. System creates CustomerInvoice (AR module):
   - invoiceType = NORMAL
   - customerId = project.customerId
   - projectId = project.id
   - Lines from grouped transactions

6. System updates:
   - Each ProjectTransaction: status → INVOICED, invoiceId set
   - Each TimesheetEntry: isInvoiced → true, invoiceId set
   - Each ProjectExpense: isInvoiced → true, invoiceId set
   - Project.invoicedAmount += invoice total
   - Project.uninvoicedAmount -= invoice total
```

---

#### Fixed-Price Milestone Billing Workflow

```
1. User sets up ProjectInvoiceSchedule entries:
   Milestone 1: "Requirements Complete"     25%  £5,000   2026-03-01
   Milestone 2: "Development Complete"      50%  £10,000  2026-05-01
   Milestone 3: "UAT Complete"              15%  £3,000   2026-06-01
   Milestone 4: "Go Live"                   10%  £2,000   2026-07-01
                                           ───   ───────
                                           100%  £20,000

2. When milestone reached:
   - User marks milestone as ready
   - System creates CustomerInvoice for milestone amount
   - ProjectInvoiceSchedule: status → INVOICED, invoiceId set
   - Project.invoicedAmount += milestone amount

3. Costs still tracked via ProjectTransaction (for P&L)
   but invoicing follows the schedule, not actual costs.
```

---

#### Project P&L / Profitability Calculation

```
Revenue:
  Invoiced Amount        (sum of CustomerInvoice totals linked to project)
+ Uninvoiced WIP         (sum of billable ProjectTransactions not yet invoiced)
= Total Revenue

Costs:
  Labour Costs           (sum of ProjectTransaction where sourceType = TIMESHEET)
+ Material Costs         (sum of ProjectTransaction where sourceType IN (GOODS_RECEIPT, PURCHASE_ORDER))
+ Expense Costs          (sum of ProjectTransaction where sourceType = EXPENSE)
+ Other Costs            (sum of ProjectTransaction where sourceType IN (VENDOR_INVOICE, ACTIVITY, MANUAL))
= Total Costs

Profitability:
  Gross Profit           = Total Revenue - Total Costs
  Gross Margin %         = (Gross Profit / Total Revenue) * 100
  Budget Variance        = Budget Amount - Total Costs
  Budget Utilisation %   = (Total Costs / Budget Amount) * 100
  Hours Variance         = Budget Hours - Actual Hours
```

---

#### Business Rules

| Rule ID | Rule | Implementation |
|---------|------|----------------|
| PRJ-001 | Project number required and unique | Enforced by `@unique` constraint and NumberSeries auto-generation |
| PRJ-002 | Customer required for billable projects | Validate: if `billingMethod != NON_BILLABLE` then `customerId` must be set |
| PRJ-003 | End date must be after start date | Validate: `endDate > startDate` (when both set) |
| PRJ-004 | Only ACTIVE projects accept time/expense entries | Guard: check `project.status = ACTIVE` before creating TimesheetEntry or ProjectExpense |
| PRJ-005 | Budget amount must be positive | Validate: `budgetAmount >= 0` |
| PRJ-006 | Cannot delete project with transactions | Guard: if `ProjectTransaction.count > 0`, reject deletion |
| PRJ-007 | Cannot complete project with uninvoiced billable transactions | Warn (not block): if `uninvoicedAmount > 0` when status -> COMPLETED |
| PRJ-008 | Only one active budget per project | Validate: when setting `ProjectBudget.isActive = true`, deactivate all others for same project |
| TS-001 | Timesheet period cannot overlap with existing timesheet for same employee | Enforced by `@@unique([employeeId, periodStartDate])` |
| TS-002 | Entry date must fall within timesheet period | Validate: `periodStartDate <= entryDate <= periodEndDate` |
| TS-003 | Hours must be positive and <= 24 | Validate: `0 < hours <= 24` |
| TS-004 | Cannot edit SUBMITTED or APPROVED timesheet | Guard: reject edits if `status IN (SUBMITTED, APPROVED)` |
| TS-005 | Rejection returns timesheet to DRAFT | Transition: SUBMITTED -> REJECTED resets status to DRAFT |
| TS-006 | Approval creates ProjectTransactions | Side effect: for each entry, create ProjectTransaction with sourceType = TIMESHEET |
| TS-007 | Project must be ACTIVE for time entry | Validate: referenced project must have `status = ACTIVE` |
| TS-008 | Billable rate resolved from rate card | Service: lookup ProjectRateCard entries by employee/role/item, fall back to PriceList |
| EXP-001 | Expense must reference an ACTIVE project | Validate: `project.status = ACTIVE` |
| EXP-002 | Approval creates ProjectTransaction | Side effect: create ProjectTransaction with sourceType = EXPENSE |
| EXP-003 | Total amount = quantity * unitPrice | Computed field, validated on save |
| EXP-004 | Base amount calculated from exchange rate | Computed: `baseAmount = totalAmount * exchangeRate` |
| EXP-005 | Billable amount includes markup | Computed: `billableAmount = totalAmount * (1 + markupPercent / 100)` |
| INV-001 | T&M invoice includes only APPROVED, uninvoiced transactions | Filter: `status = APPROVED AND invoiceId IS NULL AND isBillable = true` |
| INV-002 | Fixed-price invoice follows milestone schedule | Invoice amount from `ProjectInvoiceSchedule.amount`, not from transaction totals |
| INV-003 | Invoicing updates Project.invoicedAmount and uninvoicedAmount | Side effect: atomic counter updates within invoice creation transaction |
| INV-004 | Cannot invoice transactions from ON_HOLD project | Guard: project must be ACTIVE or COMPLETED |
| INV-005 | Multi-currency: invoice in project currency | Invoice created in `project.currencyCode`, with exchange rate at invoice date |

---

#### Rate Resolution Logic

The billing rate for a time entry is resolved using a waterfall pattern:

```
1. Check ProjectRateCard for project (active, within effective dates):
   a. EMPLOYEE rate matching timesheetEntry.employeeId
   b. TASK rate matching timesheetEntry.taskId
   c. ITEM rate matching timesheetEntry.itemId
   d. ROLE rate matching employee's role/job title

2. If no rate card match, fall back to:
   a. Project.priceListId -> PriceList item prices
   b. Item standard price (InventoryItem.basePrice for service items)

3. If still no rate, use employee's default cost rate (from HR/Employee record)

4. Cost rate follows similar waterfall:
   a. ProjectRateCardEntry.costRate (if defined)
   b. Employee's cost rate from HR module
   c. Zero (if no cost rate available)
```

---

#### Number Series Configuration

| Document Type | Prefix | Example | NumberSeries Code |
|---|---|---|---|
| Project | PRJ- | PRJ-00001 | PROJECT |
| Timesheet | TS- | TS-00001 | TIMESHEET |

These are seeded into the `NumberSeries` table (section 2.8) during module initialisation. The `nextNumber()` function generates the next sequential number within a database transaction to prevent duplicates under concurrent creation.

---

#### Cross-Module Integration

| Module | Integration Point | Direction | Mechanism |
|--------|-------------------|-----------|-----------|
| **CRM** | CrmActivity with `projectId` FK | Bidirectional | Activities can be logged against projects; project creation can create CRM activity |
| **Sales Orders** | SalesOrder.`projectId` FK | SO -> Projects | Sales orders allocated to projects; revenue attributed to project P&L |
| **AR (Invoicing)** | CustomerInvoice created from project transactions | Projects -> AR | Project invoice generation calls AR invoice creation API |
| **AP / Purchasing** | SupplierBill / PurchaseOrder with project allocation | AP -> Projects | Costs from bills/POs create ProjectTransactions |
| **Inventory** | GoodsReceipt with project allocation | Inventory -> Projects | Material issues create ProjectTransactions (sourceType = GOODS_RECEIPT) |
| **HR** | Employee record for timesheet employee, cost rates | HR -> Projects | Employee cost rate used for project costing |
| **Finance / GL** | JournalEntry for project cost/revenue postings | Projects -> GL | Project transactions post to GL via AccountMapping (WIP, revenue, cost accounts) |
| **Reporting** | Project P&L, timesheet analysis, budget vs actual | Projects -> Reporting | Query ProjectTransaction, ProjectBudget for reports |
| **System** | NumberSeries for PRJ- and TS- prefixes | System -> Projects | Auto-numbering |
| **System** | Department, Tag dimensions | System -> Projects | Cost object tagging on projects and transactions |

---

#### GL Posting Pattern for Project Transactions

When a ProjectTransaction is created from an approved timesheet or expense:

```
T&M Project — Time Entry Posted:
  DR  WIP Account (from AccountMapping: WIP)              £680.00
  CR  Labour Cost Accrual Account                          £680.00
  (Tags: project tag code, department code)

T&M Project — Invoice Generated:
  DR  AR Control (from AccountMapping: AR_CONTROL)         £680.00
  CR  Revenue Account (from AccountMapping: SALES_REVENUE) £680.00

  DR  Labour Cost Accrual Account                          £544.00  (at cost rate)
  CR  WIP Account (from AccountMapping: WIP)               £544.00

Fixed-Price Project — Milestone Invoice:
  DR  AR Control (from AccountMapping: AR_CONTROL)         £5,000
  CR  Revenue Account (from AccountMapping: SALES_REVENUE) £5,000
```

---

#### Build Sequence & Dependencies

The Projects & Job Costing module is targeted for **Story 9+** in the implementation plan. It has dependencies on:

| Dependency | Module | Must Be Complete | Reason |
|-----------|--------|-------------------|--------|
| Customer model | AR / System | Full CRUD | Projects reference `customerId` FK for billing |
| Employee model | HR | Full CRUD | Timesheets reference `employeeId` FK |
| Item model | Inventory | Full CRUD | Rate cards and transactions reference `itemId` FK |
| NumberSeries | System (section 2.8) | Functional | Auto-numbering for PRJ- and TS- prefixes |
| PeriodLock | Finance (section 2.5) | Functional | Transaction date validation against locked periods |
| CustomerInvoice | AR | Model + create API | Project invoice generation flow |
| JournalEntry | Finance/GL | Model + posting service | GL posting for project WIP and revenue |
| GlAccount | Finance/GL | Reference data | Account resolution via AccountMapping |
| Department / Tag | System | Reference data | Cost dimension tagging |
| User (project manager) | Auth / System | Reference data | `projectManagerId` FK |
| PriceList | Pricing (section 2.19) | Reference data | Fallback rate resolution |
| CrmActivity | CRM | Model | Activity-to-project linkage |

**Recommended build order within the Projects module:**

1. Project + ProjectTask (CRUD, status transitions, task hierarchy)
2. ProjectBudget + ProjectBudgetLine (budget creation, revision management)
3. ProjectRateCard + ProjectRateCardEntry (rate definitions, waterfall resolution)
4. Timesheet + TimesheetEntry (CRUD, submit/approve workflow, rate resolution)
5. ProjectExpense (CRUD, submit/approve workflow, markup calculation)
6. ProjectTransaction (auto-creation from approved timesheets/expenses, manual entries)
7. Project P&L service (profitability calculation, budget vs actual comparison)
8. T&M invoice generation (uninvoiced transaction query, AR invoice creation)
9. ProjectInvoiceSchedule + fixed-price milestone billing
10. Reports: Project P&L, timesheet summary, budget vs actual, utilisation

---

*End of section 2.25*

### 2.26 Contracts & Agreements Module — Recurring Contracts, Rentals & Loan Agreements

The Contracts & Agreements module manages three distinct but related sub-domains of recurring revenue and financial obligation: **Agreements (Rentals)** for periodic hire/rental billing with item-level dispatch and return tracking, **Standard Contracts** for subscription and recurring-invoice arrangements with configurable billing periods and batch renewal, and **Loan Agreements** for structured lending with algorithmically-generated repayment schedules and GL integration. Together these capabilities allow UK SMEs to manage any ongoing financial arrangement that spans multiple billing periods -- from equipment hire and software subscriptions to structured finance.

In the legacy HansaWorld system, this spans three separate module registrations: `typStdRentals` (53) with AgreementVc (132+ fields), RentResVc, RentChrgVc, and a rich dispatch/off-hire lifecycle; `typStdContracts` (48) with COVc (102+ header + 44 line fields) and batch invoice/renew/cancel maintenances; and Loan Management with LoanAgreementVc (50+ fields), LoanAgreementSchedVc (schedule rows), and LoanAgreementTypeVc (templates). Nexa consolidates and modernises these into a unified module at `apps/api/src/modules/contracts/` with three service sub-domains, shared customer/item integration, and full GL posting via the Finance module. The HansaWorld-specific service contract variant (COCUServiceVc) is not carried forward as a separate entity -- its functionality is absorbed into the standard Contract model with a classification flag.

---

**Legacy-to-Nexa Mapping:**

| Legacy Register | HAL Source | Fields | Nexa Model(s) | Priority | Notes |
|----------------|-----------|--------|--------------|----------|-------|
| AgreementVc | RAction, WAction | 132+ | **Agreement**, **AgreementLine** | P1 | Parent rental/hire agreement. InvoiceBase/GroupInvoice modes mapped to enums. |
| RentResVc | ChargeAgreeMn | 27 | **AgreementLine** | P1 | Rental reservations become agreement line items with dispatch/return tracking. |
| RentChrgVc | ChargeAgreeMn, AgreeInvMn | 24 | **AgreementCharge** | P1 | Computed period charges. InvNr=-1 indicates uninvoiced. |
| AgreeTypeVc | ChargeAgreeMn | 4 | **AgreementType** | P1 | Template with period type, length, bank holiday handling, min charge qty. |
| RentINVc | — | — | Item (extended flags) | P2 | Rental-specific item config absorbed into Item.allowRental flag. |
| AuthCustVc | RAction | 7 | P2 (Customer authorization) | P2 | Credit/authorization limits per customer -- deferred. |
| CustRentStatVc | RAction | 4 | Computed (queries) | P2 | Running rental statistics calculated on-demand, not stored. |
| AdvPriceRecVc | ChargeAgreeMn | — | P2 (Pricing module integration) | P2 | Date-based advanced pricing -- handled via Pricing module (section 2.19). |
| COVc | Contract.hal | 102 + 44 | **Contract**, **ContractLine** | P1 | Standard subscription/recurring contract. |
| COCUServiceVc | HWContractForm | — | Contract (class=SERVICE) | — | HW-specific; absorbed into Contract with classification. |
| LoanAgreementVc | RAction, WAction | 50+ | **LoanAgreement**, **LoanAgreementItem** | P1 | Loan agreement with multi-status lifecycle. |
| LoanAgreementTypeVc | LoanTools | 16 | **LoanAgreementType** | P1 | Template/defaults for loan agreements. |
| LoanAgreementSchedVc | SchedTools | 10 | **LoanScheduleRow** | P1 | Generated repayment schedule rows. |
| RentQTVc | — | — | SalesQuote (linked) | P2 | Rental quotations linked to agreements -- use existing SalesQuote. |
| DispatchVc | AgreementMn | — | Dispatch (Sales module) | P1 | Physical dispatch reuses Sales module Dispatch entity with agreementId FK. |
| OffHireVc | AgreementMn | — | **OffHire** | P1 | Return/end-of-rental record. |

---

**Prisma Models:**

```prisma
// ===============================================
// CONTRACTS & AGREEMENTS MODULE
// Recurring Contracts, Rentals & Loan Agreements
// ===============================================

// --- Enums ---

enum AgreementStatus {
  DRAFT
  ACTIVE
  CLOSED
  CANCELLED

  @@map("agreement_status")
}

enum AgreementInvoiceBase {
  PER_CHARGE         // Each charge becomes an invoice row
  PER_LINE           // Charges grouped per agreement line
  PER_AGREEMENT      // All charges summed into one invoice row

  @@map("agreement_invoice_base")
}

enum AgreementInvoiceGrouping {
  PER_AGREEMENT      // One invoice per agreement
  PER_CUSTOMER       // Group multiple agreements for same customer into one invoice
  SPLIT_BY_SITE      // Split invoices by site/location

  @@map("agreement_invoice_grouping")
}

enum ChargePeriodType {
  DAYS               // Charge per day
  MONTHS             // Charge per month
  FIXED              // Flat charge per period (regardless of duration)

  @@map("charge_period_type")
}

enum BankHolidayHandling {
  IGNORE             // Charge all days including bank holidays
  EXCLUDE_GLOBAL     // Exclude bank holidays using global calendar
  EXCLUDE_BY_COUNTRY // Exclude bank holidays per customer country

  @@map("bank_holiday_handling")
}

enum AgreementChargeCategory {
  RENTAL             // Time-based rental charge
  CONSUMABLE         // Chargeable/consumable item

  @@map("agreement_charge_category")
}

enum AgreementChargeStatus {
  UNINVOICED         // Not yet included on an invoice
  INVOICED           // Included on a generated invoice

  @@map("agreement_charge_status")
}

enum OffHireStatus {
  DRAFT
  CONFIRMED
  CANCELLED

  @@map("off_hire_status")
}

enum ContractStatus {
  DRAFT
  ACTIVE
  RENEWED
  CANCELLED
  EXPIRED

  @@map("contract_status")
}

enum ContractPeriodType {
  DAYS
  MONTHS

  @@map("contract_period_type")
}

enum LoanAgreementStatus {
  NEW
  APPROVED
  SIGNED              // Schedule generated on transition to SIGNED
  ACTIVE              // GL transaction created on transition to ACTIVE
  DISBURSED
  PAUSED
  CANCELLED
  FINISHED

  @@map("loan_agreement_status")
}

enum LoanScheduleType {
  ANNUITY             // Equal monthly payments (PMT formula)
  LINEAR              // Equal principal, declining interest
  LINEAR_EQUAL        // Equal principal, equally-spread interest
  BULLET              // Interest-only, full principal at end

  @@map("loan_schedule_type")
}

enum LoanInterestRateMethod {
  MONTHLY             // Rate is already monthly (multiply by 12 for annual)
  ANNUAL              // Rate is annual (divide by 12 for monthly)

  @@map("loan_interest_rate_method")
}

enum LoanDayCountConvention {
  THIRTY_360          // 30 days/month, 360 days/year
  ACTUAL              // Actual days in month/year

  @@map("loan_day_count_convention")
}

enum LoanScheduleRowType {
  INVOICE             // Normal repayment invoice row
  CREDIT_INVOICE      // Credit/refund row
  BUYOUT              // Early settlement row
  DISBURSEMENT        // Disbursement row

  @@map("loan_schedule_row_type")
}

// --- Sub-domain 1: Agreements (Rentals) ---

// Reference: AgreementType (template for rental agreements)
model AgreementType {
  id                    String                @id @default(uuid())
  code                  String                @unique                              // "DAILY-HIRE", "MONTHLY-RENTAL"
  name                  String                                                     // "Daily Equipment Hire"
  periodType            ChargePeriodType      @map("period_type")                  // Days, Months, or Fixed
  periodLength          Int                   @map("period_length")                // Number of days/months per charging period
  bankHolidayHandling   BankHolidayHandling   @default(IGNORE) @map("bank_holiday_handling")
  minimumChargeQuantity Decimal               @default(0) @map("minimum_charge_quantity") @db.Decimal(10, 4)
  chargeForFirstDay     Boolean               @default(true) @map("charge_for_first_day")

  isActive              Boolean               @default(true) @map("is_active")
  createdAt             DateTime              @default(now()) @map("created_at")
  updatedAt             DateTime              @updatedAt @map("updated_at")

  // Relations
  agreements            Agreement[]

  @@map("agreement_types")
}

// Transactional: Agreement (parent rental/hire record)
model Agreement {
  id                      String                      @id @default(uuid())
  agreementNumber         String                      @unique @map("agreement_number") // Auto from NumberSeries "AGR-00001"
  agreementDate           DateTime                    @map("agreement_date") @db.Date
  transactionDate         DateTime                    @map("transaction_date") @db.Date

  // Customer
  customerId              String                      @map("customer_id")              // FK to Customer
  customerName            String                      @map("customer_name")            // Denormalised snapshot
  customerCode            String                      @map("customer_code")            // Snapshot

  // Addresses (JSON snapshots)
  billingAddress          Json?                       @map("billing_address") @db.JsonB
  shippingAddress         Json?                       @map("shipping_address") @db.JsonB

  // Agreement type and dates
  agreementTypeId         String?                     @map("agreement_type_id")        // FK to AgreementType
  agreementType           AgreementType?              @relation(fields: [agreementTypeId], references: [id])
  startDate               DateTime                    @map("start_date") @db.Date
  endDate                 DateTime?                   @map("end_date") @db.Date
  cancelDate              DateTime?                   @map("cancel_date") @db.Date
  lastInvoiceDate         DateTime?                   @map("last_invoice_date") @db.Date

  // Currency
  currencyCode            String                      @default("GBP") @map("currency_code") @db.VarChar(3)
  exchangeRate            Decimal                     @default(1) @map("exchange_rate") @db.Decimal(10, 6)

  // Sales attribution
  salesPersonId           String?                     @map("sales_person_id")          // FK to User
  departmentCode          String?                     @map("department_code") @db.VarChar(20)
  locationCode            String?                     @map("location_code") @db.VarChar(20)
  siteCode                String?                     @map("site_code") @db.VarChar(20)

  // Customer contact
  ourContact              String?                     @map("our_contact")
  clientContact           String?                     @map("client_contact")

  // Tax
  vatCodeId               String?                     @map("vat_code_id")              // FK to VatCode (default)
  taxInclusive            Boolean                     @default(false) @map("tax_inclusive")

  // Payment & pricing
  paymentTermsId          String?                     @map("payment_terms_id")         // FK to PaymentTerms
  priceListId             String?                     @map("price_list_id")            // FK to PriceList
  discountCode            String?                     @map("discount_code") @db.VarChar(20)

  // Invoice control
  invoiceBase             AgreementInvoiceBase        @default(PER_CHARGE) @map("invoice_base")
  invoiceGrouping         AgreementInvoiceGrouping    @default(PER_AGREEMENT) @map("invoice_grouping")
  includePeriodOnInvoice  Boolean                     @default(true) @map("include_period_on_invoice")
  includeItemOnInvoice    Boolean                     @default(true) @map("include_item_on_invoice")
  invoiceComment          String?                     @map("invoice_comment") @db.Text

  // Status & lifecycle
  status                  AgreementStatus             @default(DRAFT)
  isApproved              Boolean                     @default(false) @map("is_approved") // OKFlag equivalent

  // Notes
  internalNotes           String?                     @map("internal_notes") @db.Text

  // Standard fields
  createdAt               DateTime                    @default(now()) @map("created_at")
  updatedAt               DateTime                    @updatedAt @map("updated_at")
  createdBy               String                      @map("created_by")
  updatedBy               String                      @map("updated_by")

  // Relations
  lines                   AgreementLine[]
  charges                 AgreementCharge[]
  offHires                OffHire[]

  @@map("agreements")
  @@index([customerId], map: "idx_agreements_customer")
  @@index([status], map: "idx_agreements_status")
  @@index([startDate, endDate], map: "idx_agreements_dates")
  @@index([salesPersonId], map: "idx_agreements_salesperson")
  @@index([agreementTypeId], map: "idx_agreements_type")
  @@index([isApproved, status], map: "idx_agreements_approved_status")
}

// Transactional: AgreementLine (rental reservation / line item)
model AgreementLine {
  id                    String            @id @default(uuid())
  agreementId           String            @map("agreement_id")
  agreement             Agreement         @relation(fields: [agreementId], references: [id], onDelete: Cascade)
  lineNumber            Int               @map("line_number")                    // 1-based display order

  // Item
  itemId                String            @map("item_id")                        // FK to Item (the rental item)
  description           String                                                   // Defaults from Item, editable
  invoiceItemId         String?           @map("invoice_item_id")               // FK to Item (may differ: charge a different item code on invoice)
  serialNumber          String?           @map("serial_number")

  // Quantities
  quantity              Decimal           @map("quantity") @db.Decimal(10, 4)    // Rental quantity
  quantityDispatched    Decimal           @default(0) @map("quantity_dispatched") @db.Decimal(10, 4)
  invoiceQuantity       Decimal           @default(1) @map("invoice_quantity") @db.Decimal(10, 4) // Multiplier for invoice

  // Pricing
  unitPrice             Decimal           @map("unit_price") @db.Decimal(19, 4)
  discountPercent       Decimal           @default(0) @map("discount_percent") @db.Decimal(5, 2)

  // Charging period (line-level overrides)
  startInvoicing        DateTime?         @map("start_invoicing") @db.Date      // When to start charging this line
  endInvoicing          DateTime?         @map("end_invoicing") @db.Date        // When to stop charging this line
  lastChargeDate        DateTime?         @map("last_charge_date") @db.Date     // Last date charges were computed

  // Site / cost tracking
  siteCode              String?           @map("site_code") @db.VarChar(20)
  tagCode               String?           @map("tag_code") @db.VarChar(20)      // Cost centre / tracking object
  customerOrderNumber   String?           @map("customer_order_number")

  // Audit
  createdAt             DateTime          @default(now()) @map("created_at")
  updatedAt             DateTime          @updatedAt @map("updated_at")

  // Relations
  charges               AgreementCharge[]

  @@map("agreement_lines")
  @@unique([agreementId, lineNumber], map: "uq_agreement_lines_number")
  @@index([itemId], map: "idx_agreement_lines_item")
  @@index([agreementId], map: "idx_agreement_lines_agreement")
}

// Transactional: AgreementCharge (computed rental charges)
model AgreementCharge {
  id                    String                    @id @default(uuid())
  agreementId           String                    @map("agreement_id")
  agreement             Agreement                 @relation(fields: [agreementId], references: [id])
  agreementLineId       String                    @map("agreement_line_id")
  agreementLine         AgreementLine             @relation(fields: [agreementLineId], references: [id])

  // Period
  chargeDate            DateTime                  @map("charge_date") @db.Date       // Transaction date of the charge
  periodFrom            DateTime                  @map("period_from") @db.Date       // Charge period start
  periodTo              DateTime                  @map("period_to") @db.Date         // Charge period end

  // Category
  chargeCategory        AgreementChargeCategory   @default(RENTAL) @map("charge_category")

  // Item & pricing
  itemCode              String                    @map("item_code")                  // Invoice item code
  description           String                                                       // Item description
  originalItemCode      String?                   @map("original_item_code")         // Original rental item (if differs from invoice item)
  serialNumber          String?                   @map("serial_number")

  // Quantities & amounts
  quantity              Decimal                   @map("quantity") @db.Decimal(10, 4) // Charge quantity (days/months/units)
  itemQuantity          Decimal                   @default(1) @map("item_quantity") @db.Decimal(10, 4) // Item quantity multiplier
  unitPrice             Decimal                   @map("unit_price") @db.Decimal(19, 4)
  discountPercent       Decimal                   @default(0) @map("discount_percent") @db.Decimal(5, 2)
  amount                Decimal                   @map("amount") @db.Decimal(19, 4)  // Calculated: qty * itemQty * price * (1 - disc/100)

  // Currency
  currencyCode          String                    @default("GBP") @map("currency_code") @db.VarChar(3)

  // Site / cost tracking
  siteCode              String?                   @map("site_code") @db.VarChar(20)
  tagCode               String?                   @map("tag_code") @db.VarChar(20)
  customerOrderNumber   String?                   @map("customer_order_number")

  // Invoice linkage
  status                AgreementChargeStatus     @default(UNINVOICED)
  invoiceId             String?                   @map("invoice_id")                 // FK to CustomerInvoice (set when invoiced)
  invoiceLineNumber     Int?                      @map("invoice_line_number")        // Row number on the invoice

  // Audit
  createdAt             DateTime                  @default(now()) @map("created_at")
  createdBy             String                    @map("created_by")

  @@map("agreement_charges")
  @@index([agreementId], map: "idx_agreement_charges_agreement")
  @@index([agreementLineId], map: "idx_agreement_charges_line")
  @@index([status], map: "idx_agreement_charges_status")
  @@index([invoiceId], map: "idx_agreement_charges_invoice")
  @@index([agreementId, status], map: "idx_agreement_charges_agreement_status")
}

// Transactional: OffHire (return / end-of-rental)
model OffHire {
  id                    String            @id @default(uuid())
  offHireNumber         String            @unique @map("off_hire_number")         // Auto from NumberSeries "OH-00001"
  offHireDate           DateTime          @map("off_hire_date") @db.Date

  // Agreement reference
  agreementId           String            @map("agreement_id")
  agreement             Agreement         @relation(fields: [agreementId], references: [id])

  // Customer (denormalised)
  customerId            String            @map("customer_id")
  customerName          String            @map("customer_name")

  // Status
  status                OffHireStatus     @default(DRAFT)

  // Notes
  notes                 String?           @db.Text

  // Audit
  createdAt             DateTime          @default(now()) @map("created_at")
  updatedAt             DateTime          @updatedAt @map("updated_at")
  createdBy             String            @map("created_by")
  updatedBy             String            @map("updated_by")

  // Relations
  lines                 OffHireLine[]

  @@map("off_hires")
  @@index([agreementId], map: "idx_off_hires_agreement")
  @@index([customerId], map: "idx_off_hires_customer")
  @@index([offHireDate], map: "idx_off_hires_date")
  @@index([status], map: "idx_off_hires_status")
}

model OffHireLine {
  id                    String            @id @default(uuid())
  offHireId             String            @map("off_hire_id")
  offHire               OffHire           @relation(fields: [offHireId], references: [id], onDelete: Cascade)
  lineNumber            Int               @map("line_number")

  // Item
  itemId                String            @map("item_id")                        // FK to Item
  description           String
  serialNumber          String?           @map("serial_number")
  quantity              Decimal           @map("quantity") @db.Decimal(10, 4)    // Quantity being returned

  // Audit
  createdAt             DateTime          @default(now()) @map("created_at")
  updatedAt             DateTime          @updatedAt @map("updated_at")

  @@map("off_hire_lines")
  @@unique([offHireId, lineNumber], map: "uq_off_hire_lines_number")
  @@index([itemId], map: "idx_off_hire_lines_item")
}

// --- Sub-domain 2: Standard Contracts ---

// Reference: ContractClass (classification categories)
model ContractClass {
  id                    String            @id @default(uuid())
  code                  String            @unique                                // "MAINT", "SLA", "SUB"
  name                  String                                                   // "Maintenance Contract", "SLA", "Subscription"
  description           String?

  isActive              Boolean           @default(true) @map("is_active")
  createdAt             DateTime          @default(now()) @map("created_at")
  updatedAt             DateTime          @updatedAt @map("updated_at")

  // Relations
  contracts             Contract[]

  @@map("contract_classes")
}

// Transactional: Contract (subscription / recurring-invoice contract)
model Contract {
  id                      String              @id @default(uuid())
  contractNumber          String              @unique @map("contract_number")    // Auto from NumberSeries "CON-00001"
  contractDate            DateTime            @map("contract_date") @db.Date

  // Customer
  customerId              String              @map("customer_id")                // FK to Customer
  customerName            String              @map("customer_name")              // Denormalised snapshot
  customerCode            String              @map("customer_code")

  // Addresses (JSON snapshots)
  billingAddress          Json?               @map("billing_address") @db.JsonB
  shippingAddress         Json?               @map("shipping_address") @db.JsonB

  // Period configuration
  startDate               DateTime            @map("start_date") @db.Date
  endDate                 DateTime?           @map("end_date") @db.Date
  periodLength            Int                 @map("period_length")              // Number of days/months per billing period
  periodType              ContractPeriodType  @map("period_type")                // DAYS or MONTHS
  invoiceDaysBefore       Int                 @default(0) @map("invoice_days_before") // How many days before period start to generate invoice
  lastInvoiceDate         DateTime?           @map("last_invoice_date") @db.Date

  // Classification
  contractClassId         String?             @map("contract_class_id")          // FK to ContractClass
  contractClass           ContractClass?      @relation(fields: [contractClassId], references: [id])

  // Currency
  currencyCode            String              @default("GBP") @map("currency_code") @db.VarChar(3)
  exchangeRate            Decimal             @default(1) @map("exchange_rate") @db.Decimal(10, 6)

  // Sales attribution
  salesPersonId           String?             @map("sales_person_id")            // FK to User
  departmentCode          String?             @map("department_code") @db.VarChar(20)
  locationCode            String?             @map("location_code") @db.VarChar(20)
  ourContact              String?             @map("our_contact")
  clientContact           String?             @map("client_contact")

  // Tax
  vatCodeId               String?             @map("vat_code_id")                // FK to VatCode (default)
  taxInclusive            Boolean             @default(false) @map("tax_inclusive")

  // Payment
  paymentTermsId          String?             @map("payment_terms_id")           // FK to PaymentTerms
  priceListId             String?             @map("price_list_id")              // FK to PriceList

  // Financial totals (calculated from lines)
  subtotal                Decimal             @default(0) @map("subtotal") @db.Decimal(19, 4)
  vatAmount               Decimal             @default(0) @map("vat_amount") @db.Decimal(19, 4)
  totalAmount             Decimal             @default(0) @map("total_amount") @db.Decimal(19, 4)

  // Status & lifecycle
  status                  ContractStatus      @default(DRAFT)
  isApproved              Boolean             @default(false) @map("is_approved") // OKFlag equivalent
  renewedFromContractId   String?             @map("renewed_from_contract_id")   // FK self -- link to predecessor
  renewedToContractId     String?             @map("renewed_to_contract_id")     // FK self -- link to successor

  // Notes
  invoiceComment          String?             @map("invoice_comment") @db.Text
  internalNotes           String?             @map("internal_notes") @db.Text

  // Standard fields
  createdAt               DateTime            @default(now()) @map("created_at")
  updatedAt               DateTime            @updatedAt @map("updated_at")
  createdBy               String              @map("created_by")
  updatedBy               String              @map("updated_by")

  // Relations
  lines                   ContractLine[]

  @@map("contracts")
  @@index([customerId], map: "idx_contracts_customer")
  @@index([status], map: "idx_contracts_status")
  @@index([startDate, endDate], map: "idx_contracts_dates")
  @@index([contractClassId], map: "idx_contracts_class")
  @@index([salesPersonId], map: "idx_contracts_salesperson")
  @@index([isApproved, status], map: "idx_contracts_approved_status")
  @@index([renewedFromContractId], map: "idx_contracts_renewed_from")
}

// Transactional: ContractLine (contract line items)
model ContractLine {
  id                    String            @id @default(uuid())
  contractId            String            @map("contract_id")
  contract              Contract          @relation(fields: [contractId], references: [id], onDelete: Cascade)
  lineNumber            Int               @map("line_number")

  // Item
  itemId                String?           @map("item_id")                        // FK to Item (optional for service lines)
  description           String

  // Quantities & pricing
  quantity              Decimal           @map("quantity") @db.Decimal(10, 4)
  unitPrice             Decimal           @map("unit_price") @db.Decimal(19, 4)
  basePrice             Decimal?          @map("base_price") @db.Decimal(19, 4)  // Price before adjustments
  priceFactor           Decimal           @default(1) @map("price_factor") @db.Decimal(10, 4) // Price multiplier
  discountPercent       Decimal           @default(0) @map("discount_percent") @db.Decimal(5, 2)
  lineTotal             Decimal           @map("line_total") @db.Decimal(19, 4)

  // Tax
  vatCodeId             String?           @map("vat_code_id")                    // FK to VatCode
  vatAmount             Decimal           @default(0) @map("vat_amount") @db.Decimal(19, 4)

  // Invoice control
  invoiceAfterDate      DateTime?         @map("invoice_after_date") @db.Date   // Staggered billing: do not invoice before this date
  lastInvoiceId         String?           @map("last_invoice_id")               // FK to CustomerInvoice (most recent invoice for this line)
  lastInvoiceDate       DateTime?         @map("last_invoice_date") @db.Date

  // GL account (revenue account for this line)
  accountCode           String?           @map("account_code") @db.VarChar(20)  // FK to ChartOfAccount.code

  // Audit
  createdAt             DateTime          @default(now()) @map("created_at")
  updatedAt             DateTime          @updatedAt @map("updated_at")

  @@map("contract_lines")
  @@unique([contractId, lineNumber], map: "uq_contract_lines_number")
  @@index([itemId], map: "idx_contract_lines_item")
  @@index([contractId], map: "idx_contract_lines_contract")
}

// --- Sub-domain 3: Loan Agreements ---

// Reference: LoanAgreementType (template/defaults)
model LoanAgreementType {
  id                      String                    @id @default(uuid())
  code                    String                    @unique                        // "EQUIP-LOAN", "VEHICLE-HP"
  name                    String                                                   // "Equipment Loan"

  // Default schedule settings
  scheduleType            LoanScheduleType          @map("schedule_type")
  defaultMonths           Int                       @map("default_months")         // Default number of instalment months
  defaultInterestRate     Decimal                   @map("default_interest_rate") @db.Decimal(8, 4) // e.g., 5.5000 = 5.5%
  interestRateMethod      LoanInterestRateMethod    @default(ANNUAL) @map("interest_rate_method")

  // Day-count convention
  daysInYearConvention    LoanDayCountConvention    @default(THIRTY_360) @map("days_in_year_convention")
  daysInMonthConvention   LoanDayCountConvention    @default(THIRTY_360) @map("days_in_month_convention")

  // Defaults
  defaultDepositPercent   Decimal                   @default(0) @map("default_deposit_percent") @db.Decimal(5, 2)
  defaultOverdueRate      Decimal                   @default(0) @map("default_overdue_rate") @db.Decimal(8, 4)
  defaultLateFeeDays      Int                       @default(0) @map("default_late_fee_days")
  defaultMaxMonthlyPayment Decimal                  @default(0) @map("default_max_monthly_payment") @db.Decimal(19, 4)
  defaultPaymentTermsId   String?                   @map("default_payment_terms_id") // FK to PaymentTerms

  isActive                Boolean                   @default(true) @map("is_active")
  createdAt               DateTime                  @default(now()) @map("created_at")
  updatedAt               DateTime                  @updatedAt @map("updated_at")

  // Relations
  loanAgreements          LoanAgreement[]

  @@map("loan_agreement_types")
}

// Transactional: LoanAgreement
model LoanAgreement {
  id                        String                    @id @default(uuid())
  loanNumber                String                    @unique @map("loan_number")  // Auto from NumberSeries "LA-00001"
  transactionDate           DateTime                  @map("transaction_date") @db.Date
  agreedDate                DateTime?                 @map("agreed_date") @db.Date // Formal agreement date

  // Customer
  customerId                String                    @map("customer_id")          // FK to Customer
  customerName              String                    @map("customer_name")        // Denormalised snapshot
  customerCode              String                    @map("customer_code")
  invoiceToCustomerId       String?                   @map("invoice_to_customer_id") // FK to Customer (alternate billing)

  // Type and defaults
  loanAgreementTypeId       String?                   @map("loan_agreement_type_id")
  loanAgreementType         LoanAgreementType?        @relation(fields: [loanAgreementTypeId], references: [id])

  // Sales attribution
  salesPersonId             String?                   @map("sales_person_id")      // FK to User
  ourContact                String?                   @map("our_contact")
  clientContact             String?                   @map("client_contact")

  // Schedule configuration
  scheduleType              LoanScheduleType          @map("schedule_type")
  months                    Int                                                    // Number of instalment months
  monthlyPaymentDay         Int                       @default(1) @map("monthly_payment_day") // Day of month for payments (1-28)

  // Dates
  startDate                 DateTime                  @map("start_date") @db.Date
  endDate                   DateTime?                 @map("end_date") @db.Date    // Calculated: startDate + months
  firstInterestDate         DateTime?                 @map("first_interest_date") @db.Date
  firstInvoiceDate          DateTime?                 @map("first_invoice_date") @db.Date

  // Financial
  principalAmount           Decimal                   @map("principal_amount") @db.Decimal(19, 4) // Total loan amount (InvSum4)
  interestRate              Decimal                   @map("interest_rate") @db.Decimal(8, 4)     // e.g., 5.5000 = 5.5%
  interestRateMethod        LoanInterestRateMethod    @map("interest_rate_method")
  overdueRate               Decimal                   @default(0) @map("overdue_rate") @db.Decimal(8, 4)
  maxMonthlyPayment         Decimal                   @default(0) @map("max_monthly_payment") @db.Decimal(19, 4) // Cap for annuity

  // Deposit
  depositAmount             Decimal                   @default(0) @map("deposit_amount") @db.Decimal(19, 4)
  depositPercent            Decimal                   @default(0) @map("deposit_percent") @db.Decimal(5, 2)

  // Day-count convention
  daysInYearConvention      LoanDayCountConvention    @default(THIRTY_360) @map("days_in_year_convention")
  daysInMonthConvention     LoanDayCountConvention    @default(THIRTY_360) @map("days_in_month_convention")

  // Late fees
  lateFeeDays               Int                       @default(0) @map("late_fee_days")

  // Currency
  currencyCode              String                    @default("GBP") @map("currency_code") @db.VarChar(3)
  exchangeRate              Decimal                   @default(1) @map("exchange_rate") @db.Decimal(10, 6)

  // GL account codes
  loanAssetAccountCode      String?                   @map("loan_asset_account_code") @db.VarChar(20) // Debit on activation
  arAccountCode             String?                   @map("ar_account_code") @db.VarChar(20)         // Credit on activation
  arAccountTagCode          String?                   @map("ar_account_tag_code") @db.VarChar(20)     // Object/cost centre for AR

  // Rounding
  interestRoundingDecimals  Int                       @default(2) @map("interest_rounding_decimals")
  principalRoundingDecimals Int                       @default(2) @map("principal_rounding_decimals")

  // Payment
  paymentTermsId            String?                   @map("payment_terms_id")     // FK to PaymentTerms
  tagCode                   String?                   @map("tag_code") @db.VarChar(20) // Tracking object

  // Status
  status                    LoanAgreementStatus       @default(NEW)

  // GL Integration
  activationJournalEntryId  String?                   @unique @map("activation_journal_entry_id") // FK to JournalEntry (set on ACTIVE)

  // Notes
  internalNotes             String?                   @map("internal_notes") @db.Text

  // Standard fields
  createdAt                 DateTime                  @default(now()) @map("created_at")
  updatedAt                 DateTime                  @updatedAt @map("updated_at")
  createdBy                 String                    @map("created_by")
  updatedBy                 String                    @map("updated_by")

  // Relations
  scheduleRows              LoanScheduleRow[]
  items                     LoanAgreementItem[]

  @@map("loan_agreements")
  @@index([customerId], map: "idx_loan_agreements_customer")
  @@index([status], map: "idx_loan_agreements_status")
  @@index([startDate, endDate], map: "idx_loan_agreements_dates")
  @@index([loanAgreementTypeId], map: "idx_loan_agreements_type")
  @@index([salesPersonId], map: "idx_loan_agreements_salesperson")
}

// Transactional: LoanAgreementItem (line items on the loan)
model LoanAgreementItem {
  id                    String            @id @default(uuid())
  loanAgreementId       String            @map("loan_agreement_id")
  loanAgreement         LoanAgreement     @relation(fields: [loanAgreementId], references: [id], onDelete: Cascade)
  lineNumber            Int               @map("line_number")

  // Item
  itemId                String?           @map("item_id")                        // FK to Item
  description           String

  // Amounts
  quantity              Decimal           @map("quantity") @db.Decimal(10, 4)
  unitPrice             Decimal           @map("unit_price") @db.Decimal(19, 4)
  discountPercent       Decimal           @default(0) @map("discount_percent") @db.Decimal(5, 2)
  priceFactor           Decimal           @default(1) @map("price_factor") @db.Decimal(10, 4)
  lineTotal             Decimal           @map("line_total") @db.Decimal(19, 4)

  // Invoice tracking
  invoicedDate          DateTime?         @map("invoiced_date") @db.Date
  invoicedAmount        Decimal           @default(0) @map("invoiced_amount") @db.Decimal(19, 4)

  // Audit
  createdAt             DateTime          @default(now()) @map("created_at")
  updatedAt             DateTime          @updatedAt @map("updated_at")

  @@map("loan_agreement_items")
  @@unique([loanAgreementId, lineNumber], map: "uq_loan_agreement_items_number")
  @@index([itemId], map: "idx_loan_agreement_items_item")
}

// Transactional: LoanScheduleRow (generated repayment schedule)
model LoanScheduleRow {
  id                    String                  @id @default(uuid())
  loanAgreementId       String                  @map("loan_agreement_id")
  loanAgreement         LoanAgreement           @relation(fields: [loanAgreementId], references: [id], onDelete: Cascade)
  rowNumber             Int                     @map("row_number")                // Sequential: 1, 2, 3...

  // Row type
  rowType               LoanScheduleRowType     @default(INVOICE) @map("row_type")

  // Period
  invoiceDate           DateTime                @map("invoice_date") @db.Date
  periodFrom            DateTime                @map("period_from") @db.Date
  periodTo              DateTime                @map("period_to") @db.Date

  // Amounts
  interestAmount        Decimal                 @map("interest_amount") @db.Decimal(19, 4)
  principalAmount       Decimal                 @map("principal_amount") @db.Decimal(19, 4)
  feesAmount            Decimal                 @default(0) @map("fees_amount") @db.Decimal(19, 4)
  totalAmount           Decimal                 @map("total_amount") @db.Decimal(19, 4)       // interest + principal + fees
  balanceAfter          Decimal                 @map("balance_after") @db.Decimal(19, 4)      // Remaining balance after this payment

  // Invoice linkage (set when invoice is generated from this schedule row)
  invoiceId             String?                 @map("invoice_id")                             // FK to CustomerInvoice
  invoicedDate          DateTime?               @map("invoiced_date") @db.Date
  invoicedAmount        Decimal?                @map("invoiced_amount") @db.Decimal(19, 4)

  // Audit
  createdAt             DateTime                @default(now()) @map("created_at")

  @@map("loan_schedule_rows")
  @@unique([loanAgreementId, rowNumber], map: "uq_loan_schedule_rows_number")
  @@index([loanAgreementId], map: "idx_loan_schedule_rows_agreement")
  @@index([invoiceDate], map: "idx_loan_schedule_rows_invoice_date")
  @@index([invoiceId], map: "idx_loan_schedule_rows_invoice")
}
```

---

**Business Rules:**

**Agreement (Rental) Lifecycle:**

```
                 ┌────────────────────────────────────────────────┐
                 │        AGREEMENT (RENTAL) LIFECYCLE            │
                 └────────────────────────────────────────────────┘

  ┌─────────┐   approve()    ┌──────────┐
  │  DRAFT  │ ──────────────►│  ACTIVE  │  (isApproved = true)
  └─────────┘                └──────────┘
       │                      │       │
       │ cancel()             │       │ close() (all items returned)
       ▼                      │       ▼
  ┌───────────┐               │  ┌──────────┐
  │ CANCELLED │               │  │  CLOSED  │  (AgreeStatus = 2)
  └───────────┘               │  └──────────┘
                              │
            ┌─────────────────┴──────────────────────┐
            │   Recurring Operations (while ACTIVE)  │
            │                                        │
            │  1. Charge Agreement (batch)            │
            │     → Creates AgreementCharge records   │
            │                                        │
            │  2. Generate Invoices (batch)           │
            │     → Creates CustomerInvoice from      │
            │       UNINVOICED charges                │
            │                                        │
            │  3. Dispatch items → Sales.Dispatch     │
            │  4. Off-Hire → return items             │
            └────────────────────────────────────────┘
```

**Agreement Status Transition Rules:**

| From | To | Trigger | Side Effects |
|------|-----|---------|-------------|
| DRAFT | ACTIVE | approve() | Validates: customer exists + not blocked, at least 1 line, startDate set. Sets isApproved=true. Optionally triggers auto-dispatch if system setting enabled. Emits `agreement.approved`. |
| DRAFT | CANCELLED | cancel() | None. Draft agreements have no financial impact. |
| ACTIVE | CLOSED | close() | Validates: all items off-hired/returned. Final charges generated if needed. Sets status=CLOSED. Emits `agreement.closed`. |
| ACTIVE | CANCELLED | cancel() | Validates: no uninvoiced charges pending (must invoice or void first). Sets cancelDate. Emits `agreement.cancelled`. |

**Fields editable when ACTIVE/approved:** `endDate`, `cancelDate`, `salesPersonId`, `clientContact`, `invoiceComment`, `startDate`. All other fields are protected after approval.

**Agreement Charging Logic (batch operation):**

```
1. DETERMINE charge period per line:
   Start = MAX(lastChargeDate, startInvoicing, agreement.startDate)
   End   = MIN(batchChargeDate, endInvoicing, agreement.endDate)

2. CALCULATE quantity by period type:
   DAYS:     quantity = invoiceQuantity * numberOfDays
             (optionally exclude bank holidays per AgreementType.bankHolidayHandling)
   MONTHS:   quantity = ROUND(dateDiff / 30, 0)
   FIXED:    quantity = invoiceQuantity

3. APPLY minimum charge (from AgreementType.minimumChargeQuantity)

4. RESOLVE price via PriceList or line unitPrice

5. CREATE AgreementCharge with status=UNINVOICED
   amount = quantity * itemQuantity * unitPrice * (1 - discountPercent/100)

6. UPDATE AgreementLine.lastChargeDate = chargeDate

7. EMIT: agreement.charged (agreementId, chargeCount, totalAmount)
```

**Agreement Invoice Generation (batch operation):**

```
1. FIND all AgreementCharges WHERE status = UNINVOICED for target agreements

2. GROUP charges per agreement's invoiceGrouping:
   PER_AGREEMENT:  One invoice per agreement
   PER_CUSTOMER:   Merge charges from multiple agreements for same customer
   SPLIT_BY_SITE:  Separate invoices per siteCode

3. BUILD invoice rows per agreement's invoiceBase:
   PER_CHARGE:     Each AgreementCharge becomes one CustomerInvoiceLine
   PER_LINE:       Charges grouped by agreementLineId (one row per line)
   PER_AGREEMENT:  All charges summed into one CustomerInvoiceLine

4. RESOLVE VAT code (cascade):
   Item VAT code → Customer default VAT code → System default

5. RESOLVE sales account (cascade):
   Item sales account → Agreement line account → System default

6. CREATE CustomerInvoice (via AR module) with computed rows

7. UPDATE AgreementCharge records:
   status = INVOICED, invoiceId = new invoice ID, invoiceLineNumber = row#

8. UPDATE Agreement.lastInvoiceDate

9. EMIT: agreement.invoiced (agreementId, invoiceId, totalAmount)
```

---

**Standard Contract Lifecycle:**

```
  ┌─────────┐   approve()    ┌──────────┐
  │  DRAFT  │ ──────────────►│  ACTIVE  │
  └─────────┘                └──────────┘
       │                      │      │
       │ cancel()             │      │ expires (endDate reached)
       ▼                      │      ▼
  ┌───────────┐               │  ┌──────────┐
  │ CANCELLED │               │  │ EXPIRED  │
  └───────────┘               │  └──────────┘
                              │
                     renew()  │
                              ▼
                        ┌──────────┐
                        │ RENEWED  │  (new Contract created)
                        │ (closed) │  renewedToContractId = new.id
                        └──────────┘

  Batch Operations (while ACTIVE):
    1. Create Invoices — generates CustomerInvoice per period
    2. Renew Contracts — extends with new Contract record
    3. Update Contracts — batch price/field changes
    4. Cancel Unpaid — cancels contracts with overdue invoices
```

**Contract Status Transition Rules:**

| From | To | Trigger | Side Effects |
|------|-----|---------|-------------|
| DRAFT | ACTIVE | approve() | Validates: customer, at least 1 line, startDate/endDate, periodLength set. Sets isApproved=true. Emits `contract.approved`. |
| DRAFT | CANCELLED | cancel() | None. |
| ACTIVE | RENEWED | renew() | Creates new Contract record (copy lines, advance dates by periodLength). Sets renewedToContractId on old, renewedFromContractId on new. Emits `contract.renewed`. |
| ACTIVE | EXPIRED | expiry job | Triggered by scheduled job when endDate < today and no renewal. Emits `contract.expired`. |
| ACTIVE | CANCELLED | cancel() | Validates: no uninvoiced periods pending. Emits `contract.cancelled`. |

**Contract Invoice Creation Logic:**

```
1. FOR EACH active contract WHERE next invoice is due:
   nextInvoiceDate = lastInvoiceDate + periodLength (in days or months)
   If nextInvoiceDate - invoiceDaysBefore <= today: eligible

2. FOR EACH eligible contract line:
   Skip if line.invoiceAfterDate > today (staggered billing)
   Skip if line already invoiced for this period (lastInvoiceId check)

3. CREATE CustomerInvoice (via AR module):
   One invoice per contract
   Lines from contract lines with quantity * unitPrice * priceFactor * (1 - disc%)

4. UPDATE ContractLine: lastInvoiceId, lastInvoiceDate

5. UPDATE Contract.lastInvoiceDate

6. EMIT: contract.invoiced (contractId, invoiceId, totalAmount)
```

---

**Loan Agreement Lifecycle:**

```
                 ┌────────────────────────────────────────────────┐
                 │          LOAN AGREEMENT LIFECYCLE              │
                 └────────────────────────────────────────────────┘

  ┌─────────┐   approve()   ┌──────────┐   sign()    ┌──────────┐
  │   NEW   │ ─────────────►│ APPROVED │ ───────────►│  SIGNED  │
  └─────────┘               └──────────┘             └──────────┘
       │                         │                        │
       │ cancel()                │ cancel()               │ Generates schedule
       ▼                         ▼                        │ (LoanScheduleRow records)
  ┌───────────┐            ┌───────────┐                  │
  │ CANCELLED │            │ CANCELLED │                  │ activate()
  └───────────┘            └───────────┘                  ▼
                                                    ┌──────────┐
                                                    │  ACTIVE  │
                                                    └──────────┘
                                                         │
                                 Creates GL transaction: │
                                 Dr: Loan Asset Account  │
                                 Cr: AR Account          │
                                 Amount: principalAmount │
                                                         │
                                                    disburse()
                                                         │
                                                         ▼
                                                    ┌────────────┐
                                                    │ DISBURSED  │
                                                    └────────────┘
                                                         │
                                    Invoice per schedule  │
                                    row (principal +      │
                                    interest + fees)      │
                                                         │
                              ┌──────────────────────────┤
                              │                          │
                         pause()                    All rows
                              │                    invoiced
                              ▼                          │
                        ┌──────────┐                     ▼
                        │  PAUSED  │              ┌────────────┐
                        └──────────┘              │  FINISHED  │
                              │                   └────────────┘
                         resume()
                              │
                              ▼
                        ┌────────────┐
                        │ DISBURSED  │
                        └────────────┘
```

**Loan Agreement Status Transition Rules:**

| From | To | Trigger | Side Effects |
|------|-----|---------|-------------|
| NEW | APPROVED | approve() | Validates: customer, principalAmount > 0, interestRate set, months > 0, scheduleType set. Emits `loan.approved`. |
| APPROVED | SIGNED | sign() | **Generates repayment schedule** (LoanScheduleRow records). Schedule persisted to database. Schedule algorithm determined by scheduleType. Emits `loan.signed`. |
| SIGNED | ACTIVE | activate() | **Creates GL Transaction**: Debit loanAssetAccountCode, Credit arAccountCode for principalAmount. Sets activationJournalEntryId. Emits `loan.activated`. |
| ACTIVE | DISBURSED | disburse() | Creates Purchase Invoice (via AP) to disburse funds to customer. If customer is not already a supplier, creates Supplier record. Emits `loan.disbursed`. |
| DISBURSED | PAUSED | pause() | Suspends scheduled invoicing. Emits `loan.paused`. |
| PAUSED | DISBURSED | resume() | Resumes scheduled invoicing. Emits `loan.resumed`. |
| DISBURSED | FINISHED | auto (all schedule rows invoiced) | All LoanScheduleRow records have invoiceId set. Emits `loan.finished`. |
| NEW/APPROVED | CANCELLED | cancel() | No financial impact (no GL entries exist yet). Emits `loan.cancelled`. |

**Schedule Generation Algorithms (triggered on NEW -> SIGNED):**

All algorithms calculate monthly payments and generate one LoanScheduleRow per instalment month. The monthly interest rate is derived from `interestRate` using `interestRateMethod`:

- MONTHLY: `monthlyRate = interestRate / 100`
- ANNUAL: `monthlyRate = (interestRate / 100) / 12`

**1. Annuity (ANNUITY):** Equal monthly payments using the PMT formula.

```
PMT = principal * (r + r / ((1+r)^n - 1))
  where r = monthlyRate, n = months

For each month:
  Interest  = remainingBalance * monthlyRate
  Principal = PMT - Interest
  Balance   = Balance - Principal
Last month: adjust principal to zero-out balance exactly

If maxMonthlyPayment > 0 and PMT > maxMonthlyPayment: cap at maxMonthlyPayment
  (extends effective loan duration)
```

**2. Linear (LINEAR):** Equal principal payments with declining interest.

```
monthlyPrincipal = principalAmount / months  (constant)

For each month:
  Interest = remainingBalance * monthlyRate  (declining)
  Total    = monthlyPrincipal + Interest
  Balance  = Balance - monthlyPrincipal
```

**3. Linear Equal (LINEAR_EQUAL):** Equal principal payments with equally-spread interest. Two-pass algorithm:

```
Pass 1: Calculate total interest over loan life using Linear method
Pass 2: monthlyInterest = totalInterest / months  (constant)
         monthlyPrincipal = principalAmount / months  (constant)
```

**4. Bullet (BULLET):** Interest-only payments with full principal at end.

```
Months 1 to (n-1):
  Interest  = principalAmount * monthlyRate  (constant)
  Principal = 0
  Balance   = principalAmount (unchanged)

Last month:
  Interest  = principalAmount * monthlyRate
  Principal = principalAmount  (full repayment)
  Balance   = 0
```

**Partial first period:** If startDate to firstInvoiceDate is not a full month, pro-rated interest is calculated and spread across all months.

**Rounding:** Interest rounded to `interestRoundingDecimals`, principal rounded to `principalRoundingDecimals`. Round-off differences accumulated and adjusted in the final month.

**Loan Deposit Calculation (bi-directional):**

```
Change depositPercent → depositAmount = principalAmount * depositPercent / 100
Change depositAmount  → depositPercent = depositAmount / principalAmount * 100
Change principalAmount → depositAmount = principalAmount * depositPercent / 100
```

**Loan GL Transaction on Activation:**

```
Journal Entry: "Loan Agreement LA-00042 Activation"
  DocRef: LOAN:LA-00042
  Date: transactionDate
  Period: current open period

  Lines:
    DR  loanAssetAccountCode     [principalAmount]    ← Loan asset
    CR  arAccountCode            [principalAmount]    ← Accounts Receivable
                                 ──────────────────
    Balance:                     0.00 ✓

If status is reversed from ACTIVE: the GL transaction is deleted/reversed.
```

**Loan Invoice Creation (per schedule row):**

```
1. Find next uninvoiced LoanScheduleRow (earliest invoiceDate without invoiceId)

2. Create CustomerInvoice (via AR module):
   Line 1: PrincipalItem   → principalAmount  (from LoanInvoiceSettings)
   Line 2: InterestItem    → interestAmount   (from LoanInvoiceSettings)
   Line 3: Fees            → feesAmount       (if applicable)
   Payment terms from LoanInvoiceSettings
   Sales account from LoanInvoiceSettings
   VAT code from LoanInvoiceSettings

3. Update LoanScheduleRow:
   invoiceId = new invoice ID
   invoicedDate = today
   invoicedAmount = totalAmount

4. If all schedule rows invoiced: transition status to FINISHED

5. EMIT: loan.invoiced (loanAgreementId, scheduleRowNumber, invoiceId)
```

---

**Number Series Configuration:**

| Series Code | Prefix | Entity | Example |
|-------------|--------|--------|---------|
| `AGREEMENT` | AGR- | Agreement | AGR-00001 |
| `OFF_HIRE` | OH- | OffHire | OH-00001 |
| `CONTRACT` | CON- | Contract | CON-00001 |
| `LOAN_AGREEMENT` | LA- | LoanAgreement | LA-00001 |

These integrate with the existing NumberSeries infrastructure (section 2.8). Each series is tenant-configurable and uses the standard concurrent-safe sequential counter pattern.

---

**Cross-Module Dependencies:**

The Contracts & Agreements module depends on and is consumed by several other modules:

| Dependency | Module | Relationship |
|-----------|--------|-------------|
| Customer | AR (section 2.15) | Agreements, Contracts, and Loan Agreements all reference customerId FK. Customer paste logic copies address, payment terms, VAT, pricing defaults. |
| Item | Inventory (section 2.14) | Agreement lines and contract lines reference itemId FK. Items must have appropriate flags (allowRental, allowSales). |
| CustomerInvoice | AR (section 2.15) | All three sub-domains generate invoices via the AR module. Charges/schedule rows link to invoiceId. |
| JournalEntry | Finance/GL (section 2.13) | Loan activation creates GL transactions. Invoice posting triggers standard AR GL flow. |
| FinancialPeriod | Finance (section 2.13) | GL transactions require valid open periods. |
| NumberSeries | System (section 2.8) | Auto-numbering for AGR-, CON-, LA-, OH- prefixes. |
| PaymentTerms | System | Default payment terms from customer or type templates. |
| VatCode | System | VAT code resolution on invoice generation. |
| PriceList | Pricing (section 2.19) | Price resolution for agreement lines and contract lines. |
| Dispatch | Sales Orders (section 2.16) | Physical dispatch of rented items reuses Sales module Dispatch entity. |
| Supplier | AP (section 2.17) | Loan disbursement may create a Supplier record for the customer. |
| ChartOfAccount | Finance/GL (section 2.13) | Loan GL accounts, revenue accounts on contract/agreement invoice lines. |

**Consumed by:**

- **Reporting module** -- queries for contract value, rental revenue, loan portfolio reports
- **AI module** -- subscribes to `agreement.charged`, `contract.invoiced`, `loan.activated`, `loan.finished` events for briefings and anomaly detection
- **Dashboard** -- active agreement count, contract renewal pipeline, loan portfolio health

---

**Build Sequence Note:**

Contracts & Agreements is a **Phase 1 (P1)** module, targeted for **Stories 9+** after the AR and Sales foundations are complete. Recommended build order within the module:

1. **Reference entities**: AgreementType, ContractClass, LoanAgreementType (CRUD + seed data)
2. **Standard Contracts** (simplest sub-domain): Contract + ContractLine CRUD, approval, batch invoice creation, renewal/cancel
3. **Agreements (Rentals)**: Agreement + AgreementLine CRUD, approval, charge calculation service, invoice generation, OffHire
4. **Loan Agreements**: LoanAgreement + LoanAgreementItem CRUD, multi-status lifecycle, schedule generation algorithms (4 types), GL posting on activation, disbursement, per-schedule-row invoicing
5. **Reports**: Agreement invoice info, contract list, invoiceable contracts, loan schedule, contract worth

---

*End of section 2.26*

### 2.27 Warehouse Management -- Locations, Bins, Zones, Picking & Logistics

This section extends the core Inventory module (section 2.14) with warehouse management system (WMS) capabilities. While 2.14 defines the `Warehouse` model for basic multi-location stock tracking and the `StockMovement` flow for quantity changes, this section adds the physical warehouse layer: bin/shelf positions with dimensional capacity, functional zones (pick area, pallet area, delivery area), real-time position-in-stock tracking, picking lists driven by delivery orders, and an optional forklift task queue for automated warehouse operations. All WMS features are opt-in per warehouse via a `positionTrackingEnabled` flag -- UK SMEs with simple stockrooms can operate without position complexity, while distribution-heavy tenants gain full bin-level visibility.

**Critical terminology note:** The legacy HansaWorld codebase uses the "WH" prefix for two unrelated domains -- Warehouse Management (WHM*) and Withholding Tax (WHCertificate*, WHIT*, WHVE*, WHTax*). All withholding tax models belong in the AP/Finance module and are explicitly excluded from this section.

---

#### Legacy-to-Nexa Entity Mapping

| HansaWorld Register | Legacy Key | Fields | Nexa Model | Notes |
|---|---|---|---|---|
| LocationVc (WHM fields) | location2 | 55 + WHM fields | `WarehouseWmsConfig` | WMS config fields extracted from Warehouse; extends 2.14 `Warehouse` |
| PosVc | pos1 | 10 | `BinPosition` | Physical shelf/bin with dimensional capacity and status lifecycle |
| LocAreaVc | locarea1 | 2 | `WarehouseZone` | Functional zones within a warehouse (pick, pallet, delivery, etc.) |
| LocGrVc | locgr1 | 1 | `WarehouseGroup` | Reporting/filtering groups of warehouses |
| PISVc | pis1 | 10+ | `PositionStock` | Item x position x warehouse ledger -- the critical tracking record |
| ForkLiftVc | forklift1 | 4 | `Forklift` | Physical forklift truck register (optional advanced feature) |
| ForkLiftQueVc | forkliftque1 | 17 | `ForkliftTask` | Priority-based work queue for forklift operations (optional) |
| NT7000ConnVc | -- | 4 | `WarehouseWmsConfig` fields | External system connection folded into WMS config |
| NT7000NumbersVc | -- | 2 | Runtime counter, not persisted | Replaced by application-level task sequencing |
| -- (derived) | -- | -- | `PickingList` / `PickingLine` | Picking documents generated from deliveries |
| StockMovVc.FrPosCode/ToPosCode | -- | per row | `StockMovement` extension fields | From/To position references on stock movements |

**Models excluded from this section (different domain):**

| Legacy Register | Domain | Covered In |
|---|---|---|
| WHCertificateVc | Withholding Tax certificates | AP/Finance |
| WHITVc | Withholding Tax per item | AP/Finance |
| WHVEVc | Withholding Tax per vendor | AP/Finance |
| WHCalcFormVc | Withholding Tax calc formulae | AP/Finance |
| WHTaxBlock | Withholding Tax settings | AP/Finance |

---

#### Prisma Schema

```prisma
// ─────────────────────────────────────────────
// Warehouse Management — Enums
// ─────────────────────────────────────────────

enum BinPositionStatus {
  FREE
  OCCUPIED
  RESERVED
  ERROR

  @@map("bin_position_status")
}

enum ForkliftSystemMode {
  NONE
  SEMI_AUTOMATED
  FULL_CONFIRMATION

  @@map("forklift_system_mode")
}

enum ForkliftTaskType {
  MANUAL_PICK
  DELIVERY
  STOCK_MOVEMENT

  @@map("forklift_task_type")
}

enum ForkliftTaskStatus {
  PENDING
  SENT
  IN_PROGRESS
  COMPLETED
  ERROR
  WAITING_CONVEYOR

  @@map("forklift_task_status")
}

enum ForkliftTaskPriority {
  DEFAULT
  EXPRESS
  EXPRESS_DELIVERY

  @@map("forklift_task_priority")
}

enum PickingListStatus {
  DRAFT
  IN_PROGRESS
  COMPLETED
  CANCELLED

  @@map("picking_list_status")
}

enum PickingLineStatus {
  PENDING
  PICKED
  SHORT_PICKED
  CANCELLED

  @@map("picking_line_status")
}

// ─────────────────────────────────────────────
// WarehouseGroup — Reporting Groups of Warehouses
// ─────────────────────────────────────────────

model WarehouseGroup {
  id   String @id @default(uuid())
  code String @unique @db.VarChar(20)
  name String @db.VarChar(100)

  // Standard fields
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  // Relations
  wmsConfigs WarehouseWmsConfig[]

  @@map("warehouse_groups")
  @@index([code], map: "idx_warehouse_groups_code")
}

// ─────────────────────────────────────────────
// WarehouseZone — Functional Areas Within a Warehouse
// ─────────────────────────────────────────────

model WarehouseZone {
  id   String @id @default(uuid())
  code String @unique @db.VarChar(20)
  name String @db.VarChar(100)

  // Zone behaviour
  demandPickOrder Boolean @default(false) @map("demand_pick_order")

  // Standard fields
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  // Relations
  binPositions  BinPosition[]
  positionStock PositionStock[]

  // Inverse zone references from WMS config
  wmsConfigsPalletZone   WarehouseWmsConfig[] @relation("PalletZone")
  wmsConfigsPickZone     WarehouseWmsConfig[] @relation("PickZone")
  wmsConfigsDeliveryZone WarehouseWmsConfig[] @relation("DeliveryZone")

  @@map("warehouse_zones")
  @@index([code], map: "idx_warehouse_zones_code")
}

// ─────────────────────────────────────────────
// WarehouseWmsConfig — WMS Configuration per Warehouse
// ─────────────────────────────────────────────
//
// Extends the core Warehouse model (section 2.14) with WMS-specific
// configuration. One-to-one with Warehouse. Only created when
// positionTrackingEnabled is turned on.

model WarehouseWmsConfig {
  id          String @id @default(uuid())
  warehouseId String @unique @map("warehouse_id")

  // ── Opt-in Flag ──
  positionTrackingEnabled Boolean @default(false) @map("position_tracking_enabled")

  // ── Warehouse Group ──
  warehouseGroupId String? @map("warehouse_group_id")
  warehouseGroup   WarehouseGroup? @relation(fields: [warehouseGroupId], references: [id])

  // ── Default Zones ──
  palletZoneId   String? @map("pallet_zone_id")
  palletZone     WarehouseZone? @relation("PalletZone", fields: [palletZoneId], references: [id])
  pickZoneId     String? @map("pick_zone_id")
  pickZone       WarehouseZone? @relation("PickZone", fields: [pickZoneId], references: [id])
  deliveryZoneId String? @map("delivery_zone_id")
  deliveryZone   WarehouseZone? @relation("DeliveryZone", fields: [deliveryZoneId], references: [id])

  // ── Special Positions (conveyor/staging points) ──
  goodsReceiptPositionId  String? @map("goods_receipt_position_id") @db.VarChar(40)
  productionPositionId    String? @map("production_position_id") @db.VarChar(40)
  wrappingPositionId      String? @map("wrapping_position_id") @db.VarChar(40)
  deliveryPositionId      String? @map("delivery_position_id") @db.VarChar(40)

  // ── Forklift System ──
  forkliftSystemMode      ForkliftSystemMode @default(NONE) @map("forklift_system_mode")
  maxForkliftsPickMode    Int     @default(0) @map("max_forklifts_pick_mode")

  // ── Automation Settings ──
  autoApproveStockMovements Boolean @default(false) @map("auto_approve_stock_movements")
  highestPositionFirst      Boolean @default(false) @map("highest_position_first")

  // ── External System Integration ──
  externalSystemIp   String? @map("external_system_ip") @db.VarChar(45)
  externalSystemPort Int?    @map("external_system_port")

  // ── GL Override ──
  stockAccountCode String? @map("stock_account_code") @db.VarChar(20)

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  // Relations
  binPositions   BinPosition[]
  positionStock  PositionStock[]
  forklifts      Forklift[]
  forkliftTasks  ForkliftTask[]
  pickingLists   PickingList[]

  @@map("warehouse_wms_configs")
  @@index([warehouseId], map: "idx_warehouse_wms_configs_warehouse_id")
  @@index([warehouseGroupId], map: "idx_warehouse_wms_configs_warehouse_group_id")
}

// ─────────────────────────────────────────────
// BinPosition — Physical Shelf/Bin Within a Warehouse
// ─────────────────────────────────────────────

model BinPosition {
  id   String @id @default(uuid())
  code String @db.VarChar(40)

  // ── Parent References ──
  warehouseWmsConfigId String @map("warehouse_wms_config_id")
  warehouseWmsConfig   WarehouseWmsConfig @relation(fields: [warehouseWmsConfigId], references: [id])

  zoneId String? @map("zone_id")
  zone   WarehouseZone? @relation(fields: [zoneId], references: [id])

  // ── Status Lifecycle ──
  status BinPositionStatus @default(FREE)

  // ── Dimensional Capacity (millimetres) ──
  maxWidth  Decimal? @map("max_width") @db.Decimal(10, 2)
  maxHeight Decimal? @map("max_height") @db.Decimal(10, 2)
  maxDepth  Decimal? @map("max_depth") @db.Decimal(10, 2)
  maxWeight Decimal? @map("max_weight") @db.Decimal(10, 4)

  // ── Picking ──
  pickOrder Int @default(0) @map("pick_order")

  // ── Flags ──
  isClosed Boolean @default(false) @map("is_closed")
  comment  String? @db.VarChar(200)

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  // Relations
  positionStock     PositionStock[]
  forkliftTasksFrom ForkliftTask[] @relation("TaskFromPosition")
  forkliftTasksTo   ForkliftTask[] @relation("TaskToPosition")

  @@unique([code, warehouseWmsConfigId], map: "uq_bin_positions_code_warehouse")
  @@map("bin_positions")
  @@index([warehouseWmsConfigId], map: "idx_bin_positions_warehouse_wms_config_id")
  @@index([zoneId], map: "idx_bin_positions_zone_id")
  @@index([status], map: "idx_bin_positions_status")
  @@index([status, isClosed], map: "idx_bin_positions_status_active")
  @@index([zoneId, status, isClosed], map: "idx_bin_positions_zone_status")
  @@index([pickOrder], map: "idx_bin_positions_pick_order")
}

// ─────────────────────────────────────────────
// PositionStock — Item x Position x Warehouse Ledger
// ─────────────────────────────────────────────
//
// The critical WMS tracking record. Each row represents a quantity of
// a specific item (optionally a specific variant) held at a specific
// bin position within a warehouse. Updated atomically alongside
// StockMovement posting when position tracking is enabled.

model PositionStock {
  id String @id @default(uuid())

  // ── Composite Key (logical) ──
  itemId               String @map("item_id")
  binPositionId        String @map("bin_position_id")
  binPosition          BinPosition @relation(fields: [binPositionId], references: [id])
  warehouseWmsConfigId String @map("warehouse_wms_config_id")
  warehouseWmsConfig   WarehouseWmsConfig @relation(fields: [warehouseWmsConfigId], references: [id])

  // ── Zone (denormalised from BinPosition for query performance) ──
  zoneId String? @map("zone_id")
  zone   WarehouseZone? @relation(fields: [zoneId], references: [id])

  // ── Quantities ──
  quantityOnHand    Decimal @default(0) @map("quantity_on_hand") @db.Decimal(10, 4)
  quantityInTransit Decimal @default(0) @map("quantity_in_transit") @db.Decimal(10, 4)
  quantityRemaining Decimal @default(0) @map("quantity_remaining") @db.Decimal(10, 4)

  // ── Variant (optional) ──
  variantCode String? @map("variant_code") @db.VarChar(40)

  // ── Picking (denormalised from BinPosition for sorted queries) ──
  pickOrder Int @default(0) @map("pick_order")

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@unique([itemId, binPositionId, variantCode], map: "uq_position_stock_item_position_variant")
  @@map("position_stock")
  @@index([itemId], map: "idx_position_stock_item_id")
  @@index([binPositionId], map: "idx_position_stock_bin_position_id")
  @@index([warehouseWmsConfigId], map: "idx_position_stock_warehouse_wms_config_id")
  @@index([zoneId], map: "idx_position_stock_zone_id")
  @@index([itemId, warehouseWmsConfigId], map: "idx_position_stock_item_warehouse")
  @@index([quantityOnHand], map: "idx_position_stock_quantity_on_hand")
  @@index([pickOrder], map: "idx_position_stock_pick_order")
}

// ─────────────────────────────────────────────
// PickingList — Picking Document for Delivery Fulfilment
// ─────────────────────────────────────────────

model PickingList {
  id               String @id @default(uuid())
  pickingNumber    String @unique @map("picking_number") @db.VarChar(30)

  // ── Source ──
  warehouseWmsConfigId String @map("warehouse_wms_config_id")
  warehouseWmsConfig   WarehouseWmsConfig @relation(fields: [warehouseWmsConfigId], references: [id])
  deliveryId           String @map("delivery_id")
  salesOrderId         String? @map("sales_order_id")

  // ── Status ──
  status PickingListStatus @default(DRAFT)

  // ── Dates ──
  createdDate  DateTime @default(now()) @map("created_date")
  startedDate  DateTime? @map("started_date")
  completedDate DateTime? @map("completed_date")

  // ── Assignment ──
  assignedToUserId String? @map("assigned_to_user_id")

  // ── Totals (denormalised) ──
  totalLines     Int @default(0) @map("total_lines")
  completedLines Int @default(0) @map("completed_lines")

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  // Relations
  lines PickingLine[]

  @@map("picking_lists")
  @@index([warehouseWmsConfigId], map: "idx_picking_lists_warehouse_wms_config_id")
  @@index([deliveryId], map: "idx_picking_lists_delivery_id")
  @@index([status], map: "idx_picking_lists_status")
  @@index([assignedToUserId], map: "idx_picking_lists_assigned_to")
  @@index([pickingNumber], map: "idx_picking_lists_picking_number")
}

// ─────────────────────────────────────────────
// PickingLine — Individual Line on a Picking List
// ─────────────────────────────────────────────

model PickingLine {
  id            String @id @default(uuid())
  pickingListId String @map("picking_list_id")
  pickingList   PickingList @relation(fields: [pickingListId], references: [id], onDelete: Cascade)

  // ── Item ──
  itemId       String  @map("item_id")
  itemCode     String  @map("item_code") @db.VarChar(40)
  itemName     String  @map("item_name") @db.VarChar(200)
  variantCode  String? @map("variant_code") @db.VarChar(40)

  // ── Quantities ──
  quantityRequired Decimal @map("quantity_required") @db.Decimal(10, 4)
  quantityPicked   Decimal @default(0) @map("quantity_picked") @db.Decimal(10, 4)

  // ── Position ──
  fromBinPositionId String? @map("from_bin_position_id")
  fromPositionCode  String? @map("from_position_code") @db.VarChar(40)

  // ── Linked Stock Movement ──
  stockMovementId String? @map("stock_movement_id")

  // ── Status ──
  status PickingLineStatus @default(PENDING)

  // ── Picking Sequence ──
  pickSequence Int @default(0) @map("pick_sequence")

  // ── Serial / Batch (for tracked items) ──
  serialNumber String? @map("serial_number") @db.VarChar(60)
  batchNumber  String? @map("batch_number") @db.VarChar(60)

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("picking_lines")
  @@index([pickingListId], map: "idx_picking_lines_picking_list_id")
  @@index([itemId], map: "idx_picking_lines_item_id")
  @@index([status], map: "idx_picking_lines_status")
  @@index([fromBinPositionId], map: "idx_picking_lines_from_bin_position_id")
  @@index([pickSequence], map: "idx_picking_lines_pick_sequence")
}

// ─────────────────────────────────────────────
// Forklift — Physical Forklift Truck Register (Optional)
// ─────────────────────────────────────────────

model Forklift {
  id   String @id @default(uuid())
  code String @db.VarChar(20)

  // ── Parent ──
  warehouseWmsConfigId String @map("warehouse_wms_config_id")
  warehouseWmsConfig   WarehouseWmsConfig @relation(fields: [warehouseWmsConfigId], references: [id])

  // ── Details ──
  name    String? @db.VarChar(100)
  comment String? @db.VarChar(200)

  // ── Flags ──
  isActive Boolean @default(true) @map("is_active")

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  // Relations
  tasks ForkliftTask[]

  @@unique([code, warehouseWmsConfigId], map: "uq_forklifts_code_warehouse")
  @@map("forklifts")
  @@index([warehouseWmsConfigId], map: "idx_forklifts_warehouse_wms_config_id")
  @@index([isActive], map: "idx_forklifts_is_active")
}

// ─────────────────────────────────────────────
// ForkliftTask — Priority-Based Work Queue (Optional)
// ─────────────────────────────────────────────
//
// The forklift task queue is the heart of automated warehouse operations.
// Each task represents a physical movement instruction: move item X from
// position A to position B. Tasks are prioritised (express first), typed
// (manual pick, delivery, stock movement), and tracked through a status
// lifecycle. This is an optional advanced feature -- only active when
// WarehouseWmsConfig.forkliftSystemMode != NONE.

model ForkliftTask {
  id       String @id @default(uuid())
  taskNumber String @unique @map("task_number") @db.VarChar(30)

  // ── Parent ──
  warehouseWmsConfigId String @map("warehouse_wms_config_id")
  warehouseWmsConfig   WarehouseWmsConfig @relation(fields: [warehouseWmsConfigId], references: [id])

  // ── Classification ──
  taskType ForkliftTaskType @map("task_type")
  priority ForkliftTaskPriority @default(DEFAULT)
  status   ForkliftTaskStatus @default(PENDING)

  // ── Movement Details ──
  itemId      String  @map("item_id")
  itemCode    String  @map("item_code") @db.VarChar(40)
  quantity    Decimal @db.Decimal(10, 4)
  isFullPallet Boolean @default(false) @map("is_full_pallet")

  // ── From / To Positions ──
  fromPositionId String? @map("from_position_id")
  fromPosition   BinPosition? @relation("TaskFromPosition", fields: [fromPositionId], references: [id])
  toPositionId   String? @map("to_position_id")
  toPosition     BinPosition? @relation("TaskToPosition", fields: [toPositionId], references: [id])

  // ── Source Document References ──
  stockMovementId String? @map("stock_movement_id")
  deliveryId      String? @map("delivery_id")

  // ── Assignment ──
  forkliftId String? @map("forklift_id")
  forklift   Forklift? @relation(fields: [forkliftId], references: [id])

  // ── Tracking ──
  attempts     Int      @default(0)
  isDone       Boolean  @default(false) @map("is_done")
  completedAt  DateTime? @map("completed_at")
  errorMessage String?  @map("error_message") @db.VarChar(500)

  // ── Zone (denormalised for queue queries) ──
  zoneCode String? @map("zone_code") @db.VarChar(20)

  // ── External System ──
  externalSystemId String? @map("external_system_id") @db.VarChar(40)
  comment          String? @db.VarChar(200)

  // Standard fields
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  @@map("forklift_tasks")
  @@index([warehouseWmsConfigId], map: "idx_forklift_tasks_warehouse_wms_config_id")
  @@index([status], map: "idx_forklift_tasks_status")
  @@index([status, taskType], map: "idx_forklift_tasks_status_type")
  @@index([priority, status], map: "idx_forklift_tasks_priority_status")
  @@index([forkliftId], map: "idx_forklift_tasks_forklift_id")
  @@index([stockMovementId], map: "idx_forklift_tasks_stock_movement_id")
  @@index([deliveryId], map: "idx_forklift_tasks_delivery_id")
  @@index([externalSystemId], map: "idx_forklift_tasks_external_system_id")
  @@index([isDone, status], map: "idx_forklift_tasks_completion")
}
```

**Extension fields on existing models (section 2.14):**

The following fields are added to the existing `StockMovement` model (section 2.14) when WMS is active. These are nullable and only populated when the source/destination warehouse has `positionTrackingEnabled = true`:

```prisma
// Added to StockMovement (section 2.14)
model StockMovement {
  // ... existing fields from 2.14 ...

  // ── WMS Position Tracking (nullable, only when position tracking enabled) ──
  fromBinPositionId String? @map("from_bin_position_id")
  toBinPositionId   String? @map("to_bin_position_id")
  forkliftQueued    Boolean @default(false) @map("forklift_queued")
  isManualPick      Boolean @default(false) @map("is_manual_pick")
}
```

The following fields are added to the existing `InventoryItem` model (section 2.14) for items with warehouse management relevance:

```prisma
// Added to InventoryItem (section 2.14)
model InventoryItem {
  // ... existing fields from 2.14 ...

  // ── WMS Pallet Configuration (nullable, only for pallet-managed items) ──
  preferredZoneCode    String?  @map("preferred_zone_code") @db.VarChar(20)
  preferredPickZoneCode String? @map("preferred_pick_zone_code") @db.VarChar(20)
  quantityPerPallet    Decimal? @map("quantity_per_pallet") @db.Decimal(10, 4)
  palletWidth          Decimal? @map("pallet_width") @db.Decimal(10, 2)
  palletHeight         Decimal? @map("pallet_height") @db.Decimal(10, 2)
  palletDepth          Decimal? @map("pallet_depth") @db.Decimal(10, 2)
  maxPalletsInPickArea Int?     @map("max_pallets_in_pick_area")
}
```

---

#### Business Rules

**BR-WMS-001: Position Tracking is Opt-in per Warehouse**
Position tracking is controlled by `WarehouseWmsConfig.positionTrackingEnabled`. When disabled, all WMS features (bin positions, position stock, forklift queue) are inactive for that warehouse. Stock movements at non-position-tracked warehouses operate exactly as defined in section 2.14. Enabling position tracking creates the `WarehouseWmsConfig` record; disabling it is only permitted if no `PositionStock` records with non-zero quantities exist.

**BR-WMS-002: Bin Position Status Lifecycle**
Bin positions follow a strict status lifecycle:

```
FREE (0)  ──>  OCCUPIED (1)  ──>  RESERVED (2)  ──>  ERROR (3)
                     │                                    │
                     └──── (when fully emptied) ──> FREE (0)
                                                          │
                                            ERROR (3) ──> FREE (0)
                                            (manual resolution only)
```

- A position transitions from FREE to OCCUPIED when the first `PositionStock` record is created at that position with a non-zero quantity.
- A position transitions back to FREE only when all `PositionStock.quantityRemaining` values at that position sum to zero.
- RESERVED status is set when a position is assigned as the destination of a pending stock movement or forklift task but goods have not yet arrived.
- ERROR status is set when a discrepancy is detected (e.g. stock count mismatch, failed forklift operation). ERROR positions require manual resolution before returning to FREE.
- Special positions (goods receipt, production, wrapping, delivery -- as configured on `WarehouseWmsConfig`) are exempt from automatic status changes.

**BR-WMS-003: Dimension Checking Before Placement**
Before placing an item at a bin position, the system validates that the item's pallet dimensions fit within the position's capacity:

1. The item's `palletWidth` must not exceed `BinPosition.maxWidth`.
2. The item's `palletHeight` must not exceed `BinPosition.maxHeight`.
3. The item's `palletDepth` must not exceed `BinPosition.maxDepth`.
4. If other items already occupy the position, their cumulative dimensions (calculated from `PositionStock` quantities and the respective items' `quantityPerPallet` values) are added to the incoming item's dimensions before comparison.
5. If any dimension field is null on either the item or the position, that dimension check is skipped (permissive default).

**BR-WMS-004: Find Free Position Algorithm**
When a free position is needed (e.g. for goods receipt placement, pick area replenishment), the system searches in the following priority order:

1. Positions in the specified target zone, with `status = FREE`, `isClosed = false`, dimensions fit, excluding special positions (goods receipt, production, wrapping, delivery).
2. If no position found in the target zone, search all positions in the warehouse with `status = FREE`, excluding the delivery zone.
3. If looking specifically in the delivery zone, fall back to the configured `deliveryPositionId`.
4. The `highestPositionFirst` flag on `WarehouseWmsConfig` controls search direction (ascending vs descending by position code).
5. Positions already assigned as destinations on pending stock movements or forklift tasks are excluded from the search.

**BR-WMS-005: Pick Order Propagation**
When `BinPosition.pickOrder` is changed, the new value must be propagated to all `PositionStock` records at that position. The denormalised `PositionStock.pickOrder` field exists to support efficient sorted queries during picking list generation without requiring a join.

**BR-WMS-006: Pick Area Replenishment**
Automated replenishment of the pick area follows this logic:

1. Iterate through `PositionStock` records for the warehouse.
2. For each item, determine the pick zone (item's `preferredPickZoneCode` or warehouse's default `pickZoneId`).
3. Skip items already in the pick zone, delivery zone, pallet zone, or at special positions.
4. Skip items without pallet dimension data.
5. Check whether the item already exists in the pick zone.
6. Limit the number of pallets per item in the pick zone using `InventoryItem.maxPalletsInPickArea`.
7. Find a free position in the pick zone (applying dimension checking per BR-WMS-003).
8. Create a `StockMovement` with `forkliftQueued = true` to trigger the forklift task queue.

**BR-WMS-007: Forklift Task Queue Priority**
When `WarehouseWmsConfig.forkliftSystemMode` is not NONE, stock movements with `forkliftQueued = true` generate `ForkliftTask` entries. Task dispatch follows this priority hierarchy:

1. EXPRESS tasks (priority = EXPRESS) are dispatched before DEFAULT tasks.
2. Within each priority level: MANUAL_PICK tasks first, then DELIVERY tasks, then STOCK_MOVEMENT tasks.
3. The number of concurrent forklifts in pick mode is limited by `maxForkliftsPickMode`.
4. Tasks originating from conveyor positions (goods receipt, production) check for conflicting pending tasks from the same conveyor -- if another task is already pending from the same source, the new task enters WAITING_CONVEYOR status.

**BR-WMS-008: Warehouse Closure with Stock Check**
A warehouse cannot be deactivated (set `isActive = false` on the core `Warehouse` model) if any `PositionStock` records have non-zero `quantityOnHand`. This mirrors the legacy rule that prevents closing a location with stock.

**BR-WMS-009: Position Deletion Guard**
A `BinPosition` can only be deleted if its `status = FREE` and no `PositionStock` records reference it. Positions with status OCCUPIED, RESERVED, or ERROR cannot be deleted.

**BR-WMS-010: Picking List Generation from Delivery**
When a delivery (shipment) is created, a `PickingList` can be generated automatically or on demand. Each delivery line that references a position-tracked warehouse creates a `PickingLine`. The `fromPositionCode` and `pickSequence` are determined by the `FindPositionWithItem` algorithm:

1. If the required quantity equals a full pallet (`quantityPerPallet`), search the item's pick zone first, then other zones.
2. If a partial quantity, search the pick zone first for an exact quantity match, then for partially-filled pallets.
3. Exclude special positions (goods receipt, production, wrapping, delivery).
4. Assign `pickSequence` based on the position's `pickOrder` value.

**BR-WMS-011: Stock Movement Position Tracking Integration**
When a `StockMovement` is posted at a position-tracked warehouse:

1. The `fromBinPositionId` and/or `toBinPositionId` must reference valid, non-closed `BinPosition` records.
2. Posting updates the corresponding `PositionStock` records atomically within the same transaction as the `StockBalance` update (section 2.14).
3. If the source position's `PositionStock.quantityRemaining` reaches zero, the bin position status is evaluated for transition back to FREE (per BR-WMS-002).
4. If the destination position was FREE, it transitions to OCCUPIED.

**BR-WMS-012: Forklift Task Confirmation (Full Confirmation Mode)**
When `forkliftSystemMode = FULL_CONFIRMATION`:

1. Each forklift task must be explicitly confirmed by the operator before the next task is dispatched to that forklift.
2. The operator confirms the picked quantity; if it differs from the requested quantity, an error code is returned (quantity mismatch, serial number error, or position error).
3. On successful confirmation, the linked stock movement is approved (OKFlag equivalent), triggering the actual stock update.
4. The operator can then route the pallet to the wrapping station or directly to the delivery area.

---

#### Warehouse Operations Workflows

**Goods Receipt to Position Flow:**

```
Purchase Order Receipt (GRN)
  │
  ├─ Stock Movement created (GOODS_RECEIPT, toBinPositionId = goodsReceiptPositionId)
  │
  ├─ Item lands at intake/conveyor position
  │
  ├─ MoveToPosition logic finds a free position in the item's preferred zone
  │     └─ Dimension check (BR-WMS-003)
  │     └─ Creates new Stock Movement (TRANSFER_IN/TRANSFER_OUT pair)
  │     └─ If forklift system active: ForkliftTask created (type=STOCK_MOVEMENT)
  │
  └─ PositionStock record created/updated at destination position
```

**Sales Order Delivery with Picking Flow:**

```
Sales Order confirmed
  │
  ├─ Delivery (Shipment) created
  │
  ├─ PickingList generated (BR-WMS-010)
  │     └─ PickingLines with positions and pick sequence
  │
  ├─ Warehouse operator picks items by pick sequence
  │     └─ Confirms quantity per line
  │     └─ If forklift system: ForkliftTask per pick (type=MANUAL_PICK or DELIVERY)
  │
  ├─ Items move through wrapping station (optional)
  │
  ├─ Items arrive at delivery area
  │
  └─ Delivery confirmed → Stock Movements posted → PositionStock updated
```

**Pick Area Replenishment Flow:**

```
Scheduled or on-demand trigger (BR-WMS-006)
  │
  ├─ Scan PositionStock for items in bulk storage zones
  │
  ├─ For each eligible item:
  │     ├─ Check current pick area stock vs maxPalletsInPickArea
  │     ├─ Find free position in pick zone (dimension check)
  │     └─ Create Stock Movement with forkliftQueued = true
  │
  └─ ForkliftTasks created → Forklifts move pallets to pick area
```

---

#### Reports

| Report | Description | Key Filters |
|---|---|---|
| Items at Positions | Lists items stored at specific bin positions with quantities | Position range, zone, warehouse, item group, position status |
| Position History | Audit trail of goods receipt and stock movements per position | Position range, date range, movement type |
| Position Errors | Lists all positions in ERROR status with current contents | Position range, zone, warehouse |
| Forklift Queue | Current forklift task queue with status and priority | Forklift, warehouse, status filter |
| Forklift Queue Errors | Tasks in ERROR status requiring resolution | Warehouse |
| Item Location Status | Cross-warehouse stock analysis with sales history | Item range, warehouse range, months of history |
| Picking List | Printable picking document per delivery | Delivery number |
| Pallet Label | Barcode label for pallets (stock movement number, item, position) | Stock movement number |

---

#### Build Sequence & Dependencies

This module is a **Phase 2 / Phase 3** extension to the core Inventory module (section 2.14). It is not required for MVP but is essential for warehouse-heavy UK SMEs. The forklift queue system is a Phase 3 / premium feature.

| Story | Scope | Dependencies | Phase |
|---|---|---|---|
| W-1 | `WarehouseGroup` and `WarehouseZone` CRUD + seed data | Tier 0 complete | P2 |
| W-2 | `WarehouseWmsConfig` CRUD, `positionTrackingEnabled` toggle | W-1, Warehouse (2.14) | P2 |
| W-3 | `BinPosition` CRUD with status lifecycle, dimensional capacity | W-2 | P2 |
| W-4 | `PositionStock` tracking -- create/update on stock movement posting | W-3, StockMovement (2.14) | P2 |
| W-5 | StockMovement extension fields (`fromBinPositionId`, `toBinPositionId`) | W-4 | P2 |
| W-6 | Find Free Position algorithm + dimension checking (BR-WMS-003, BR-WMS-004) | W-3 | P2 |
| W-7 | `PickingList` / `PickingLine` generation from deliveries | W-4, Sales/Delivery module | P2 |
| W-8 | Pick area replenishment automation (BR-WMS-006) | W-6, InventoryItem WMS fields | P2 |
| W-9 | Items at Positions report, Position History report, Position Error report | W-4 | P2 |
| W-10 | `Forklift` register CRUD | W-2 | P3 |
| W-11 | `ForkliftTask` queue with priority dispatch (BR-WMS-007) | W-10, W-5 | P3 |
| W-12 | Forklift operator UI -- task acceptance, quantity confirmation, pallet routing | W-11 | P3 |
| W-13 | External warehouse automation API (generic replacement for NT7000) | W-11 | P3 |
| W-14 | Barcode scanning integration (goods receipt and production) | W-5 | P3 |
| W-15 | Pallet label printing | W-5 | P3 |

**Cross-module integration points:**

- **Inventory (section 2.14):** `StockMovement` posting triggers `PositionStock` updates when position tracking is enabled. `StockBalance` and `PositionStock` are updated in the same transaction.
- **Sales / Delivery:** Delivery creation triggers `PickingList` generation. Delivery confirmation posts stock movements with position references.
- **Purchasing / Goods Receipt:** GRN posting creates stock movements targeting the goods receipt position. MoveToPosition logic distributes items to free positions.
- **Manufacturing:** Production output routes to the production position. Barcode scanning triggers conveyor/forklift operations.
- **Stock Take:** Position-level stock counting via `PositionStock` comparison. Serial number tracking at position level for items with `serialNumberRequired = true`.
- **Returns:** Customer and supplier returns are assigned to positions, with stock movements carrying `toBinPositionId` for the return destination.

---

#### Key Design Differences from HansaWorld

| Aspect | HansaWorld | Nexa |
|---|---|---|
| WMS config storage | Migrated block fields on LocationVc + separate MainWHMBlock | Clean `WarehouseWmsConfig` one-to-one with `Warehouse` |
| Forklift system | Hardcoded NT7000 vendor integration | Generic `ForkliftTask` queue with pluggable external system API |
| Conveyor types | Hardcoded purchase/production/delivery/wrapper conveyors | Configurable special position IDs on `WarehouseWmsConfig` |
| Position-in-Stock | PISVc with implicit schema | Explicit `PositionStock` model with typed fields and indexes |
| Zone/area concept | Simple LocAreaVc with code + demandPickOrder | `WarehouseZone` with name, active flag, and typed zone references on config |
| Picking lists | Report-only (PickingListRn) | First-class `PickingList` / `PickingLine` models with status tracking |
| Full pallet concept | Derived from QtyonPallet comparison | Explicit `isFullPallet` flag on `ForkliftTask`, `quantityPerPallet` on item |
| Position tracking opt-in | `RequirePos` flag on LocationVc | `positionTrackingEnabled` on `WarehouseWmsConfig` with guard rails |

---

*End of section 2.27*

---

*End of section 2.27*

### 2.28 Intercompany & Consolidation -- Multi-Entity Transactions & Group Reporting

> **Phase:** P2/P3 (post-MVP). This section defines the target architecture for intercompany transactions and group consolidation. It is NOT part of the 11-module MVP build sequence. Implementation depends on completion of all MVP stories (Stories 0-9+) and specifically requires mature Finance GL (Story 4), Sales Orders (Story 5), and Purchasing & AP (Story 5b) modules.

The fundamental architectural challenge for this module is the **database-per-tenant** design decision. HansaWorld implements intercompany and consolidation within a single database, using in-process company context switching (`SetCompany()` / `ResetCompany()`). All companies share the same database, so intercompany transaction mirroring is a same-process, same-database operation with implicit ACID guarantees. Nexa's database-per-tenant model means each company is an isolated PostgreSQL database with no shared state. Intercompany transactions therefore require **API-based cross-tenant communication** (not direct database access), and consolidation reporting requires an **aggregation service** that reads from multiple tenant databases. Transaction atomicity across companies must be achieved via the **saga pattern** with compensating transactions rather than database-level transactions.

This module introduces three service layers:

1. **Intercompany Transaction Service** -- Handles cross-tenant transaction mirroring (NL journal entries) and cross-tenant document creation (PO-to-SO flow). Uses an event-driven saga pattern with explicit correlation tracking and compensating actions on failure.
2. **Consolidation Aggregation Service** -- Reads financial data from multiple tenant databases to produce consolidated Balance Sheet and P&L reports. Runs at the **platform level** (not within a single tenant database) because it must access data across tenant boundaries.
3. **Group Administration Service** -- Manages corporate group structure, membership, ownership percentages, and shared register configuration. The group metadata is stored in a **platform-level database** (separate from any tenant) since it spans multiple tenants.

---

**Legacy-to-Nexa Mapping:**

| Legacy Entity | HAL Source | Fields | Nexa Model | Phase | Notes |
|---|---|---|---|---|---|
| ICTRuleVc | InterCompanyTool.hal | SerNr, AccNumber, DC, Objects, ToCompany, ToAccNumber, CorAccNumber, Comment + 5 more | **IntercompanyRule** | P2 | Transaction mirroring rules. In Nexa, `toTenantId` replaces `ToCompany` integer |
| -- (implicit in TRVc flow) | InterCompanyTool.hal | -- | **IntercompanyTransaction** | P2 | Cross-tenant transaction tracking with saga state. No direct legacy equivalent -- HansaWorld handled this implicitly via context switching |
| DaughterCompBlock | DaugterTool.hal | CompCode, CompName, StartDate, EndDate | **ConsolidationGroup** + **ConsolidationMember** | P2 | Group structure. Nexa separates group definition from membership |
| ConsolidationBlock | ConsRn.hal, ConsEn.hal | ConsCrncy, MotherCode | Absorbed into **ConsolidationGroup** | P2 | Group-level consolidation settings |
| OwnerPrcVc | DaugterTool.hal | Date, Prc | **OwnershipPercentage** | P2 | Date-based ownership history per member |
| AccVc.ConsAccNumber, AccVc.Conspr | AcConsRn.hal, ConsRn.hal | 3 fields | **ConsolidationAccountMap** | P2 | Maps tenant accounts to group consolidation accounts |
| AccElimVc | AccElimMn.hal | Code, Comment, Register, NrSeries + row matrix | **EliminationTemplate** + **EliminationEntry** | P3 | Template-based elimination entry generation |
| BaseERVc | ConsTrialEn.hal | Date, Rate1, Rate2 | **ConsolidationExchangeRate** | P2 | Separate P&L and Balance Sheet consolidation rates |
| ShareVcSetBlock | ShareVcSetBlockAction.hal | VcName, InCompany, ForCompanies | **SharedRegisterConfig** | P3 | Shared master data configuration. Nexa uses API-based data federation, not shared DB tables |
| POCreateInterCompanyOR() | InterCompanyTools.hal | -- | Intercompany PO-to-SO saga (code pattern) | P2 | PO approval triggers cross-tenant SO creation via saga |
| CreateIntercompanyTransactionsFromTR() | InterCompanyTool.hal | -- | Intercompany NL mirroring saga (code pattern) | P2 | Journal save triggers cross-tenant mirrored journal via saga |

**Settings:**

| Legacy Setting | Fields | Nexa Mapping | Phase | Notes |
|---|---|---|---|---|
| ModuleBlock.InterCompany | 1 (boolean) | SystemSetting (category: 'intercompany', key: 'enabled') | P2 | Per-tenant feature flag |
| ConsolidationBlock | 2 | Absorbed into ConsolidationGroup | P2 | Group-level, not tenant-level |
| DaughterCompBlock | 4 per row | ConsolidationMember rows | P2 | Group-level membership registry |
| ShareVcSetBlock | 3 per row | SharedRegisterConfig rows | P3 | Platform-level shared data config |
| Vendor.ePORcvPref + ePORcvToCompanyCode | 2 | Supplier.intercompanyMode + Supplier.intercompanyTenantId | P2 | Extended onto existing Supplier model (section 2.17) |
| AccVc.ConsAccNumber + AccVc.Conspr | 2 | ConsolidationAccountMap (separate model) | P2 | Kept separate to avoid polluting per-tenant ChartOfAccount |

---

**Prisma Models:**

```prisma
// =================================================================
// INTERCOMPANY & CONSOLIDATION MODULE (section 2.28)
// Phase P2/P3 -- NOT part of MVP
//
// IMPORTANT: Models marked [PLATFORM] live in the platform-level
// database, not in individual tenant databases. Models marked
// [TENANT] live in each tenant's own database.
// =================================================================

// -----------------------------------------------------------------
// ENUMS
// -----------------------------------------------------------------

// [TENANT]
enum IntercompanyRuleDirection {
  DEBIT
  CREDIT

  @@map("intercompany_rule_direction")
}

// [PLATFORM]
enum IntercompanyTransactionStatus {
  INITIATED          // Saga started, source journal posted
  TARGET_PENDING     // Awaiting target tenant processing
  TARGET_POSTED      // Target journal successfully posted
  COMPLETED          // Both sides confirmed
  FAILED             // Target posting failed, compensation needed
  COMPENSATED        // Source journal reversed after target failure
  CANCELLED          // Manually cancelled by user

  @@map("intercompany_transaction_status")
}

// [PLATFORM]
enum IntercompanyTransactionType {
  NL_MIRROR          // NL journal mirroring (rule-based)
  PO_TO_SO           // Purchase order to sales order
  INVOICE_MIRROR     // Invoice mirroring (future)

  @@map("intercompany_transaction_type")
}

// [PLATFORM]
enum ConsolidationMemberStatus {
  ACTIVE
  SUSPENDED          // Temporarily excluded from consolidation
  REMOVED            // Historically included but no longer

  @@map("consolidation_member_status")
}

// [TENANT]
enum EliminationOutputType {
  JOURNAL            // Creates a JournalEntry (TRVc equivalent)
  SIMULATION         // Creates a draft/what-if entry (SMVc equivalent)

  @@map("elimination_output_type")
}

// [PLATFORM]
enum ConsolidationRunStatus {
  IN_PROGRESS
  COMPLETED
  FAILED

  @@map("consolidation_run_status")
}

// [PLATFORM]
enum SharedRegisterType {
  CUSTOMER
  SUPPLIER
  ITEM
  CHART_OF_ACCOUNT

  @@map("shared_register_type")
}

// -----------------------------------------------------------------
// INTERCOMPANY RULES [TENANT]
// Defines how NL transactions in this tenant should be mirrored
// to other tenants. Stored per-tenant because rules are defined
// from the perspective of the originating company.
// -----------------------------------------------------------------

model IntercompanyRule {
  id                  String                      @id @default(uuid())
  code                String                      @unique               // Auto-generated serial, e.g. "ICR-001"

  // Source matching criteria (in this tenant)
  sourceAccountCode   String                      @map("source_account_code")   // Account number to match
  direction           IntercompanyRuleDirection                                  // Debit or Credit
  sourceObjects       String?                     @map("source_objects")         // Dimension filter (normalised); null = catch-all
  fiscalYear          Int?                        @map("fiscal_year")            // Optional year scope; null = all years

  // Target tenant
  targetTenantId      String                      @map("target_tenant_id")       // UUID of the target tenant (not company code)

  // Target account mapping (in the target tenant's chart of accounts)
  targetAccountCode   String                      @map("target_account_code")    // Mirror account in target
  targetObjects       String?                     @map("target_objects")          // Objects in target
  contraAccountCode   String                      @map("contra_account_code")    // Balancing (contra) account in target
  contraObjects       String?                     @map("contra_objects")          // Contra account objects

  // Metadata
  comment             String?                                                    // Comment placed on mirrored transaction
  isActive            Boolean                     @default(true) @map("is_active")

  // Audit
  createdAt           DateTime                    @default(now()) @map("created_at")
  updatedAt           DateTime                    @updatedAt      @map("updated_at")
  createdBy           String                      @map("created_by")
  updatedBy           String                      @map("updated_by")

  @@index([sourceAccountCode, direction], map: "idx_ic_rules_account_direction")
  @@index([sourceAccountCode, direction, fiscalYear], map: "idx_ic_rules_account_direction_year")
  @@index([targetTenantId], map: "idx_ic_rules_target_tenant")
  @@index([isActive], map: "idx_ic_rules_active")
  @@map("intercompany_rules")
}

// -----------------------------------------------------------------
// INTERCOMPANY TRANSACTION [PLATFORM]
// Tracks the saga state of cross-tenant transactions. Stored at
// platform level because it references two different tenant DBs.
// This is the saga coordination record.
// -----------------------------------------------------------------

model IntercompanyTransaction {
  id                    String                          @id @default(uuid())
  correlationId         String                          @unique @map("correlation_id")  // Idempotency key for the saga

  transactionType       IntercompanyTransactionType     @map("transaction_type")
  status                IntercompanyTransactionStatus   @default(INITIATED)

  // Source (originating tenant)
  sourceTenantId        String                          @map("source_tenant_id")
  sourceDocumentType    String                          @map("source_document_type")    // "JournalEntry", "PurchaseOrder", etc.
  sourceDocumentId      String                          @map("source_document_id")      // UUID in source tenant DB
  sourceDocumentRef     String?                         @map("source_document_ref")     // Human-readable ref, e.g. "JE-00042"

  // Target (destination tenant)
  targetTenantId        String                          @map("target_tenant_id")
  targetDocumentType    String?                         @map("target_document_type")    // "JournalEntry", "SalesOrder", etc.
  targetDocumentId      String?                         @map("target_document_id")      // UUID in target tenant DB (set on completion)
  targetDocumentRef     String?                         @map("target_document_ref")     // Human-readable ref, e.g. "SO-00018"

  // Intercompany rule that triggered this (for NL_MIRROR type)
  ruleId                String?                         @map("rule_id")                 // IntercompanyRule.id from source tenant

  // Currency
  currencyCode          String                          @map("currency_code") @db.VarChar(3)
  amount                Decimal                         @map("amount") @db.Decimal(19, 4)  // Primary amount for audit trail
  exchangeRate          Decimal?                        @map("exchange_rate") @db.Decimal(19, 8)

  // Saga state
  initiatedAt           DateTime                        @default(now()) @map("initiated_at")
  completedAt           DateTime?                       @map("completed_at")
  failedAt              DateTime?                       @map("failed_at")
  failureReason         String?                         @map("failure_reason")
  compensatedAt         DateTime?                       @map("compensated_at")
  retryCount            Int                             @default(0) @map("retry_count")
  lastRetryAt           DateTime?                       @map("last_retry_at")

  // Audit
  createdBy             String                          @map("created_by")

  @@index([sourceTenantId, status], map: "idx_ic_txns_source_status")
  @@index([targetTenantId, status], map: "idx_ic_txns_target_status")
  @@index([status], map: "idx_ic_txns_status")
  @@index([correlationId], map: "idx_ic_txns_correlation")
  @@index([initiatedAt], map: "idx_ic_txns_initiated_at")
  @@map("intercompany_transactions")
}

// -----------------------------------------------------------------
// CONSOLIDATION GROUP [PLATFORM]
// Defines a corporate group for consolidated reporting.
// Stored at platform level because it spans multiple tenants.
// -----------------------------------------------------------------

model ConsolidationGroup {
  id                    String                @id @default(uuid())
  name                  String                @unique                             // "Acme Holdings Group"
  code                  String                @unique                             // "ACME-GRP"

  // Parent company
  motherTenantId        String                @map("mother_tenant_id")            // Tenant ID of the parent company

  // Consolidation settings
  consolidationCurrency String               @map("consolidation_currency") @db.VarChar(3)  // Group reporting currency code
  fiscalYearEnd         Int                   @map("fiscal_year_end")             // Month number (1-12) when fiscal year ends

  // Status
  isActive              Boolean               @default(true) @map("is_active")

  // Audit
  createdAt             DateTime              @default(now()) @map("created_at")
  updatedAt             DateTime              @updatedAt      @map("updated_at")
  createdBy             String                @map("created_by")
  updatedBy             String                @map("updated_by")

  // Relations
  members               ConsolidationMember[]
  exchangeRates         ConsolidationExchangeRate[]
  consolidationRuns     ConsolidationRun[]
  sharedRegisters       SharedRegisterConfig[]

  @@index([motherTenantId], map: "idx_cons_groups_mother_tenant")
  @@index([isActive], map: "idx_cons_groups_active")
  @@map("consolidation_groups")
}

// -----------------------------------------------------------------
// CONSOLIDATION MEMBER [PLATFORM]
// Links a tenant to a consolidation group with date-based eligibility.
// -----------------------------------------------------------------

model ConsolidationMember {
  id                    String                      @id @default(uuid())

  groupId               String                      @map("group_id")
  group                 ConsolidationGroup          @relation(fields: [groupId], references: [id], onDelete: Cascade)

  tenantId              String                      @map("tenant_id")               // Tenant ID of the subsidiary company
  tenantName            String                      @map("tenant_name")             // Cached display name
  tenantCode            String                      @map("tenant_code")             // Cached company code for reporting

  // Eligibility period
  startDate             DateTime                    @map("start_date") @db.Date      // Included in consolidation from this date
  endDate               DateTime?                   @map("end_date") @db.Date        // Excluded after this date (null = indefinite)

  // Hierarchy
  parentMemberId        String?                     @map("parent_member_id")         // For grand-daughter relationships
  parentMember          ConsolidationMember?        @relation("MemberHierarchy", fields: [parentMemberId], references: [id])
  childMembers          ConsolidationMember[]       @relation("MemberHierarchy")

  // Status
  status                ConsolidationMemberStatus   @default(ACTIVE)

  // Audit
  createdAt             DateTime                    @default(now()) @map("created_at")
  updatedAt             DateTime                    @updatedAt      @map("updated_at")
  createdBy             String                      @map("created_by")
  updatedBy             String                      @map("updated_by")

  // Relations
  ownershipHistory      OwnershipPercentage[]

  @@unique([groupId, tenantId], map: "uq_cons_members_group_tenant")
  @@index([groupId, status], map: "idx_cons_members_group_status")
  @@index([tenantId], map: "idx_cons_members_tenant")
  @@index([parentMemberId], map: "idx_cons_members_parent")
  @@map("consolidation_members")
}

// -----------------------------------------------------------------
// OWNERSHIP PERCENTAGE [PLATFORM]
// Date-based ownership history for each group member.
// The most recent record on or before the report date is used.
// If no record exists, defaults to 100%.
// -----------------------------------------------------------------

model OwnershipPercentage {
  id                    String                @id @default(uuid())

  memberId              String                @map("member_id")
  member                ConsolidationMember   @relation(fields: [memberId], references: [id], onDelete: Cascade)

  effectiveDate         DateTime              @map("effective_date") @db.Date     // Date this percentage takes effect
  percentage            Decimal               @map("percentage") @db.Decimal(7, 4) // e.g. 75.0000 for 75%

  // Audit
  createdAt             DateTime              @default(now()) @map("created_at")
  updatedAt             DateTime              @updatedAt      @map("updated_at")
  createdBy             String                @map("created_by")

  @@unique([memberId, effectiveDate], map: "uq_ownership_pct_member_date")
  @@index([memberId, effectiveDate], map: "idx_ownership_pct_member_date")
  @@map("ownership_percentages")
}

// -----------------------------------------------------------------
// CONSOLIDATION ACCOUNT MAP [TENANT]
// Maps a tenant's chart of accounts to group consolidation accounts.
// Stored per-tenant because each subsidiary maps its own accounts.
// Kept separate from ChartOfAccount to avoid polluting the core
// finance model with consolidation-specific fields.
// -----------------------------------------------------------------

model ConsolidationAccountMap {
  id                      String              @id @default(uuid())

  accountCode             String              @map("account_code")                  // FK to ChartOfAccount.code in this tenant
  consolidationAccountCode String             @map("consolidation_account_code")    // Target account code in the mother company
  applyOwnershipPct       Boolean             @default(false) @map("apply_ownership_pct") // If true, ownership % is applied to balances

  // Audit
  createdAt               DateTime            @default(now()) @map("created_at")
  updatedAt               DateTime            @updatedAt      @map("updated_at")
  createdBy               String              @map("created_by")
  updatedBy               String              @map("updated_by")

  @@unique([accountCode], map: "uq_cons_account_map_account")
  @@index([consolidationAccountCode], map: "idx_cons_account_map_cons_code")
  @@map("consolidation_account_maps")
}

// -----------------------------------------------------------------
// CONSOLIDATION EXCHANGE RATE [PLATFORM]
// Separate exchange rates for Balance Sheet vs P&L consolidation.
// Stored at group level because they apply to the entire group.
// -----------------------------------------------------------------

model ConsolidationExchangeRate {
  id                    String                @id @default(uuid())

  groupId               String                @map("group_id")
  group                 ConsolidationGroup    @relation(fields: [groupId], references: [id], onDelete: Cascade)

  fromCurrency          String                @map("from_currency") @db.VarChar(3)  // Subsidiary currency
  toCurrency            String                @map("to_currency") @db.VarChar(3)    // Group consolidation currency

  effectiveDate         DateTime              @map("effective_date") @db.Date

  // Separate rates by financial statement section
  balanceSheetRate      Decimal               @map("balance_sheet_rate") @db.Decimal(19, 8)  // Closing rate for BS items
  profitAndLossRate     Decimal               @map("profit_and_loss_rate") @db.Decimal(19, 8) // Average rate for P&L items

  // Audit
  createdAt             DateTime              @default(now()) @map("created_at")
  updatedAt             DateTime              @updatedAt      @map("updated_at")
  createdBy             String                @map("created_by")

  @@unique([groupId, fromCurrency, toCurrency, effectiveDate], map: "uq_cons_fx_rates_group_pair_date")
  @@index([groupId, effectiveDate], map: "idx_cons_fx_rates_group_date")
  @@index([fromCurrency, toCurrency, effectiveDate], map: "idx_cons_fx_rates_pair_date")
  @@map("consolidation_exchange_rates")
}

// -----------------------------------------------------------------
// ELIMINATION TEMPLATE [TENANT]
// Defines reusable elimination entry templates for intra-group
// balance elimination. Stored per-tenant (in the mother company)
// because eliminations are posted to the mother's GL.
// -----------------------------------------------------------------

model EliminationTemplate {
  id                    String                @id @default(uuid())
  code                  String                @unique                             // "ELIM-AR-AP", "ELIM-IC-SALES"
  name                  String                                                    // "AR/AP Intercompany Elimination"
  description           String?

  // Output configuration
  outputType            EliminationOutputType @default(JOURNAL) @map("output_type")
  numberSeriesCode      String?               @map("number_series_code")          // NumberSeries.code for generated journals

  // Status
  isActive              Boolean               @default(true) @map("is_active")

  // Audit
  createdAt             DateTime              @default(now()) @map("created_at")
  updatedAt             DateTime              @updatedAt      @map("updated_at")
  createdBy             String                @map("created_by")
  updatedBy             String                @map("updated_by")

  // Relations
  entries               EliminationEntry[]

  @@index([isActive], map: "idx_elim_templates_active")
  @@map("elimination_templates")
}

// -----------------------------------------------------------------
// ELIMINATION ENTRY [TENANT]
// Individual elimination row pairs within a template.
// Each entry defines two accounts whose intra-group balances
// should net to zero, with any difference posted to a target account.
// -----------------------------------------------------------------

model EliminationEntry {
  id                    String                @id @default(uuid())

  templateId            String                @map("template_id")
  template              EliminationTemplate   @relation(fields: [templateId], references: [id], onDelete: Cascade)

  lineNumber            Int                   @map("line_number")                 // Ordering within the template

  // Account pair to compare
  account1Code          String                @map("account1_code")               // First account (e.g. IC Receivable)
  account1Objects       String?               @map("account1_objects")             // Dimension filter for account 1
  account2Code          String                @map("account2_code")               // Second account (e.g. IC Payable)
  account2Objects       String?               @map("account2_objects")             // Dimension filter for account 2

  // Target account for the elimination difference
  targetAccountCode     String                @map("target_account_code")          // Where the balancing entry posts

  // Audit
  createdAt             DateTime              @default(now()) @map("created_at")
  updatedAt             DateTime              @updatedAt      @map("updated_at")

  @@unique([templateId, lineNumber], map: "uq_elim_entries_template_line")
  @@index([templateId], map: "idx_elim_entries_template")
  @@map("elimination_entries")
}

// -----------------------------------------------------------------
// CONSOLIDATION RUN [PLATFORM]
// Tracks execution of consolidation report/export runs.
// Records which members were included, rates used, and results.
// -----------------------------------------------------------------

model ConsolidationRun {
  id                    String                    @id @default(uuid())

  groupId               String                    @map("group_id")
  group                 ConsolidationGroup        @relation(fields: [groupId], references: [id])

  // Report parameters
  reportType            String                    @map("report_type")               // "BALANCE_SHEET", "PROFIT_AND_LOSS", "TRIAL_BALANCE"
  periodStartDate       DateTime                  @map("period_start_date") @db.Date
  periodEndDate         DateTime                  @map("period_end_date") @db.Date

  // Execution state
  status                ConsolidationRunStatus    @default(IN_PROGRESS)
  membersIncluded       Int                       @default(0) @map("members_included")  // Count of members processed
  startedAt             DateTime                  @default(now()) @map("started_at")
  completedAt           DateTime?                 @map("completed_at")
  failureReason         String?                   @map("failure_reason")

  // Output reference
  outputJournalId       String?                   @map("output_journal_id")         // If consolidation creates a journal in mother
  outputJournalRef      String?                   @map("output_journal_ref")        // Human-readable ref

  // Audit
  createdBy             String                    @map("created_by")

  @@index([groupId, periodEndDate], map: "idx_cons_runs_group_period")
  @@index([status], map: "idx_cons_runs_status")
  @@map("consolidation_runs")
}

// -----------------------------------------------------------------
// SHARED REGISTER CONFIG [PLATFORM]
// Defines which master data registers are shared across tenants
// within a consolidation group. In Nexa, "sharing" means the
// platform provides a federated API that proxies reads to the
// source tenant's database -- not a shared physical table.
// -----------------------------------------------------------------

model SharedRegisterConfig {
  id                    String                @id @default(uuid())

  groupId               String                @map("group_id")
  group                 ConsolidationGroup    @relation(fields: [groupId], references: [id], onDelete: Cascade)

  registerType          SharedRegisterType    @map("register_type")               // Which entity type is shared
  sourceTenantId        String                @map("source_tenant_id")            // Tenant that owns the master data
  targetTenantIds       String[]              @map("target_tenant_ids")           // Tenants that can read this data

  // Sync configuration
  syncDirection         String                @default("READ_ONLY") @map("sync_direction")  // READ_ONLY or BIDIRECTIONAL
  lastSyncAt            DateTime?             @map("last_sync_at")

  // Status
  isActive              Boolean               @default(true) @map("is_active")

  // Audit
  createdAt             DateTime              @default(now()) @map("created_at")
  updatedAt             DateTime              @updatedAt      @map("updated_at")
  createdBy             String                @map("created_by")

  @@unique([groupId, registerType, sourceTenantId], map: "uq_shared_reg_group_type_source")
  @@index([groupId, isActive], map: "idx_shared_reg_group_active")
  @@index([sourceTenantId], map: "idx_shared_reg_source_tenant")
  @@map("shared_register_configs")
}
```

---

**Cross-Tenant Communication Architecture:**

The intercompany module relies on three communication patterns, all operating across tenant database boundaries:

```
Pattern 1: SAGA -- Intercompany NL Transaction Mirroring
==========================================================

Tenant A (Source)                  Platform Bus                  Tenant B (Target)
     |                                 |                              |
     | 1. Journal posted               |                              |
     |    (MANUAL or sub-ledger)       |                              |
     |                                 |                              |
     | 2. IC rules matched             |                              |
     |    (account + direction)        |                              |
     |                                 |                              |
     | 3. Create IC Transaction        |                              |
     |    (status: INITIATED)          |                              |
     |-------------------------------->|                              |
     |    IC_TRANSACTION_INITIATED     |                              |
     |                                 |----------------------------->|
     |                                 |  4. Validate target accounts |
     |                                 |     Build mirrored journal   |
     |                                 |     (reversed debits/credits |
     |                                 |      + contra entry)         |
     |                                 |                              |
     |                                 |     5. Post target journal   |
     |                                 |<-----------------------------|
     |                                 |    IC_TARGET_POSTED          |
     |<--------------------------------|                              |
     |  6. Update IC Transaction       |                              |
     |     (status: COMPLETED,         |                              |
     |      targetDocumentId set)      |                              |
     |                                 |                              |

Failure path (step 5 fails):
     |                                 |<-----------------------------|
     |                                 |    IC_TARGET_FAILED          |
     |<--------------------------------|                              |
     |  7. IC Transaction -> FAILED    |                              |
     |  8. Compensate: reverse source  |                              |
     |     journal OR flag for review  |                              |
     |  9. IC Transaction -> COMPENSATED                              |


Pattern 2: SAGA -- Intercompany PO-to-SO
==========================================================

Tenant A (Buyer)                   Platform Bus                  Tenant B (Seller)
     |                                 |                              |
     | 1. PO approved                  |                              |
     |    (Supplier.intercompanyMode   |                              |
     |     = INTERNAL)                 |                              |
     |                                 |                              |
     | 2. Create IC Transaction        |                              |
     |    (type: PO_TO_SO,             |                              |
     |     status: INITIATED)          |                              |
     |-------------------------------->|                              |
     |    IC_PO_APPROVED               |                              |
     |                                 |----------------------------->|
     |                                 |  3. Look up Customer by      |
     |                                 |     VAT number of Tenant A   |
     |                                 |  4. Create Sales Order:      |
     |                                 |     - Map header fields      |
     |                                 |     - Map PO lines to SO     |
     |                                 |     - Attach PO PDF          |
     |                                 |     - Set probability 100%   |
     |                                 |                              |
     |                                 |  5. SO created successfully  |
     |                                 |<-----------------------------|
     |                                 |    IC_SO_CREATED             |
     |<--------------------------------|                              |
     |  6. Update IC Transaction       |                              |
     |     (COMPLETED, SO ref stored)  |                              |
     |  7. Store SO reference on PO    |                              |
     |     for cross-reference         |                              |


Pattern 3: AGGREGATION -- Consolidation Reporting
==========================================================

Platform Consolidation Service
     |
     | 1. Load ConsolidationGroup + active ConsolidationMembers
     |
     | 2. For each member (checking startDate/endDate eligibility):
     |    |
     |    | 3a. Connect to member's tenant database (read-only)
     |    | 3b. Load ConsolidationAccountMap from member tenant
     |    | 3c. For each mapped account:
     |    |     - Fetch account balances for the report period
     |    |     - Apply consolidation account mapping
     |    |     - Look up OwnershipPercentage for report date
     |    |     - Apply ownership percentage if flagged
     |    |
     |    | 3d. Look up ConsolidationExchangeRate for member's currency
     |    |     - BS accounts: use balanceSheetRate (closing rate)
     |    |     - P&L accounts: use profitAndLossRate (average rate)
     |    |
     |    | 3e. Convert amounts to group consolidation currency
     |    |
     |    | 4. Recursively process child members (grand-daughters)
     |
     | 5. Aggregate all member results into consolidated totals
     |
     | 6. Apply elimination templates (if requested):
     |    - For each EliminationEntry: compare account pair balances
     |    - Generate elimination journal entries
     |
     | 7. Create ConsolidationRun record
     | 8. Optionally create output journal in mother tenant
     |
     | 9. Return consolidated report data
```

---

**Business Rules:**

| # | Rule | Source | Enforcement |
|---|------|--------|-------------|
| BR-1 | **Circular reference prevention** -- A tenant cannot be both parent and child of the same tenant within a consolidation group. Before adding a ConsolidationMember, the service must walk the parentMemberId chain and verify no circular path exists. | DaughterCompBlockCheck (error 2246) | Application layer (ConsolidationGroupService.addMember) |
| BR-2 | **Ownership percentage time-series** -- The applicable ownership percentage for a given report date is the most recent OwnershipPercentage record where `effectiveDate <= reportDate`. If no record exists, default to 100%. | GetOwnerPrc() in DaugterTool.hal | ConsolidationAggregationService.getOwnershipPct() |
| BR-3 | **Member date range filtering** -- A ConsolidationMember is only included in a consolidation run if the report date falls within `[startDate, endDate]`. If `endDate` is null, the member is included indefinitely. If `reportDate < startDate`, the member is skipped. | DaugterTool.hal date checks | ConsolidationAggregationService.getEligibleMembers() |
| BR-4 | **Account type determines exchange rate** -- Balance Sheet accounts (ASSET, LIABILITY, EQUITY) use `ConsolidationExchangeRate.balanceSheetRate` (closing rate). P&L accounts (REVENUE, EXPENSE) use `ConsolidationExchangeRate.profitAndLossRate` (average rate). | GetFullCurncyPLConsolidationRate / GetFullCurncyBalConsolidationRate | ConsolidationAggregationService.convertCurrency() |
| BR-5 | **Elimination must span full months** -- Date ranges for elimination template execution must start on the 1st of a month and end on the last day of a month. Reject with a validation error if not. | AccElimMn.hal (error 1163) | EliminationService.validateDateRange() |
| BR-6 | **Transaction lock date respected** -- Intercompany NL transactions cannot be created in the target tenant if the target transaction date falls on or before the target tenant's transaction lock date (`DBLockBlock.TRLock`). The saga must fail gracefully with a clear error. | InterCompanyTool.hal lock date check | IntercompanyTransactionService, checked during target journal creation |
| BR-7 | **Debit/credit reversal in target** -- When mirroring an NL transaction to the target tenant, amounts are REVERSED: a debit in the source becomes a credit in the target's mirror account, and vice versa. The contra entry maintains the original direction to balance. | CreateIntercompanyTransactionsFromTR() | IntercompanyMirrorService.buildTargetJournal() |
| BR-8 | **Double-entry in target** -- Each intercompany NL rule match produces exactly TWO rows in the target journal: Row 1 (mirror) uses `targetAccountCode` with reversed amounts; Row 2 (contra) uses `contraAccountCode` with original-direction amounts. The target journal must balance. | InterCompanyTool.hal lines 160-260 | IntercompanyMirrorService.buildTargetJournal() |
| BR-9 | **Object matching hierarchy** -- When matching IntercompanyRules, rules WITH `sourceObjects` specified are matched first. Only if no object-specific rule matches should rules with null `sourceObjects` (catch-all) be considered. | InterCompanyTool.hal two-pass matching | IntercompanyRuleMatcherService.matchRules() |
| BR-10 | **VAT number matching for PO-to-SO** -- When creating a Sales Order in the target tenant from an intercompany PO, the Customer is looked up by matching the originating tenant's VAT registration number. If no matching Customer is found, the saga fails with a descriptive error. | CopyPOHeadertoORHeader in InterCompanyTools.hal | IntercompanyPOtoSOService.resolveCustomer() |
| BR-11 | **Saga idempotency** -- Each IntercompanyTransaction has a unique `correlationId`. If the same correlationId is submitted twice (e.g. due to retry), the service must return the existing transaction rather than create a duplicate. This prevents double-posting on network retries. | New requirement (distributed systems best practice) | IntercompanyTransactionService.initiateTransaction() |
| BR-12 | **Consolidation account mapping required** -- An account in a subsidiary is only included in consolidation if it has a corresponding `ConsolidationAccountMap` row. Unmapped accounts are silently excluded from consolidated totals (matching HansaWorld behaviour where accounts without `ConsAccNumber` are skipped). | ConsRn.hal account iteration | ConsolidationAggregationService.aggregateBalances() |
| BR-13 | **Cross-currency consolidation** -- When the source and target tenants use different base currencies, the intercompany mirroring service must convert amounts using the exchange rate valid on the transaction date. If source `baseCurrency1` equals target `baseCurrency2`, cross-currency mapping applies. | InterCompanyTool.hal currency handling | IntercompanyMirrorService.handleCurrencyConversion() |
| BR-14 | **Elimination output modes** -- Elimination templates support two output types: JOURNAL (creates a real `JournalEntry` in the mother tenant's GL) and SIMULATION (creates a draft/what-if entry that does not affect balances). The output type is configured per template. | AccElimVc.Register (0=TRVc, 1=SMVc) | EliminationService.executeTemplate() |
| BR-15 | **Self-company exclusion** -- A ConsolidationGroup's `motherTenantId` cannot also appear as a ConsolidationMember in the same group (the mother is implicitly included). This prevents double-counting. | Implicit in HansaWorld (mother is separate from daughters) | ConsolidationGroupService.addMember() validation |

---

**Supplier Model Extension (amends section 2.17):**

The existing `Supplier` model (section 2.17) requires two additional fields for intercompany PO-to-SO support. These fields are added in Phase P2 via a migration:

```prisma
// Add to existing Supplier model in section 2.17
// These fields are null/NONE for standard suppliers

  // Intercompany configuration (P2)
  intercompanyMode      IntercompanySupplierMode  @default(NONE) @map("intercompany_mode")
  intercompanyTenantId  String?                   @map("intercompany_tenant_id")  // Target tenant for IC SO creation
```

```prisma
// New enum (added in P2 migration)
enum IntercompanySupplierMode {
  NONE                // Standard external supplier
  DEFAULT             // Standard with default receipt
  INTERNAL            // Internal company -- triggers IC PO-to-SO flow

  @@map("intercompany_supplier_mode")
}
```

---

**JournalSource Extension (amends section 2.13):**

The `JournalSource` enum in section 2.13 requires one additional value for intercompany-generated journals:

```prisma
// Add to JournalSource enum in section 2.13
  INTERCOMPANY        // Generated by intercompany mirroring saga
```

---

**Platform vs. Tenant Database Separation:**

| Model | Database | Rationale |
|---|---|---|
| IntercompanyRule | Tenant | Rules are defined per-tenant (from the originating company's perspective) |
| IntercompanyTransaction | Platform | References two tenant IDs; saga coordination must be tenant-independent |
| ConsolidationGroup | Platform | Spans multiple tenants; group identity is above any single tenant |
| ConsolidationMember | Platform | Links tenants to groups |
| OwnershipPercentage | Platform | Belongs to ConsolidationMember (platform) |
| ConsolidationAccountMap | Tenant | Each subsidiary maps its own accounts; per-tenant data |
| ConsolidationExchangeRate | Platform | Group-level rates shared across members |
| EliminationTemplate | Tenant | Templates live in the mother company's tenant database |
| EliminationEntry | Tenant | Rows within a template; same database as template |
| ConsolidationRun | Platform | Tracks cross-tenant aggregation runs |
| SharedRegisterConfig | Platform | Defines cross-tenant data federation |

---

**Key Differences from Legacy HansaWorld:**

1. **No context switching** -- HansaWorld uses `SetCompany()` / `ResetCompany()` to switch between companies within the same database process. Nexa uses authenticated API calls between tenant services, with the platform bus coordinating message delivery.

2. **Explicit saga state** -- HansaWorld's intercompany transactions are implicitly atomic (same database). Nexa tracks saga state explicitly via `IntercompanyTransaction` with status progression: `INITIATED -> TARGET_PENDING -> TARGET_POSTED -> COMPLETED`. Failures are recorded with `failureReason` and can trigger compensating actions.

3. **No shared database tables** -- HansaWorld's `ShareVcSetBlock` shares actual database tables between companies. Nexa's `SharedRegisterConfig` defines a federated read pattern where the platform API proxies requests to the source tenant's database. The consuming tenant sees the data as if it were local, but it is always read from the source.

4. **Consolidation as a platform service** -- HansaWorld runs consolidation reports by iterating daughter companies within the same process/database. Nexa's consolidation aggregation service runs at the platform level, connecting to each member tenant's database to read balances, then assembling the consolidated view.

5. **Consolidation account mapping as a separate model** -- HansaWorld adds `ConsAccNumber` and `Conspr` directly to the account register (`AccVc`). Nexa keeps consolidation mapping in a dedicated `ConsolidationAccountMap` model to maintain clean separation between core finance and consolidation concerns. This avoids schema changes to the MVP finance models and allows consolidation to be deployed independently.

---

**Build Sequence Note:**

This module is NOT part of the MVP build sequence (Stories 0-9+). It forms its own Phase 2/3 epic:

- **Phase P2:** ConsolidationGroup, ConsolidationMember, OwnershipPercentage, ConsolidationAccountMap, ConsolidationExchangeRate, IntercompanyRule, IntercompanyTransaction, platform bus integration, NL mirroring saga, PO-to-SO saga, basic consolidated Balance Sheet and P&L reports.
- **Phase P3:** EliminationTemplate/Entry, SharedRegisterConfig, Consolidated Trial Balance export, multi-level (grand-daughter) recursive consolidation, ConsolidationRun audit trail, advanced elimination workflows.

**Dependencies:** Requires completed MVP modules -- specifically Story 4 (Finance GL with JournalEntry, ChartOfAccount), Story 5 (Sales Orders), Story 5b (Purchasing & AP with Supplier, PurchaseOrder), Story 3 (event bus), and platform-level tenant management infrastructure.

---

*End of section 2.28*

### 2.29 Communications Module — Internal Chat, Email, Conferencing & Notifications

The Communications module provides the messaging and notification backbone for Nexa ERP: internal real-time chat between users, outbound/inbound email integrated with business documents, conference rooms for persistent team knowledge-sharing, and a per-user notification system that routes alerts across channels (in-app, email, push). Every other module depends on Communications for transactional emails (sending invoices, purchase orders, statements, payslips) and for surfacing system events to the right people at the right time.

In the legacy HansaWorld system, this maps to MailVc (internal + external mail, 62 header + 5 array fields), ConfVc (dual-purpose mailbox/conference register, 53 header fields), EMailQueVc (outbound SMTP queue, 31 header + 2 array fields), ChatLogVc (chat history), ExtChatUsersVc (live-chat operators), MailReadVc (per-recipient status tracking), MailFilterVc (mail rules), MailTextVc (document-to-email templates), HtmlTemplateVc (HTML email formatting), ConfSignVc (email signatures), ConfAutoReplyVc (auto-reply configuration), AutoReplyListVc (rate limiting), ConfSubVc (conference subscriptions), and ConfAccVc (conference access control). The Anna2 AI chatbot subsystem (Anna2ContextVc, Anna2ChatNodeVc, AIChatVc, TalkBotIntentVc, ScoredIntentVc) demonstrates a sophisticated decision-tree + LLM hybrid for conversational business actions — Nexa replaces the local llama model with its cloud-based AI Engine (FR1-FR10) using Claude API with function calling, but preserves the core pattern of AI-driven record creation, entity lookup, and document emailing through natural language.

**Excluded from Nexa:** Skype integration (deprecated), fax queue (FaxQueVc), frameset-based web chat (HBS Div), local LLM inference (Anna2 used local llama — Nexa uses Claude via the AI Engine), complex license-tier enforcement (Level 1/2/3 user types), and Asterisk/VOIP/PBX integration (noted as future extension in P3).

---

#### Legacy-to-Nexa Mapping

| Legacy Register | Legacy Entity | Fields | Nexa Target Model(s) | Priority | Notes |
|----------------|--------------|--------|----------------------|----------|-------|
| MailVc | Internal + External Mail | 62 + 5 | **EmailMessage** + **EmailRecipient** | MVP | Unified message store for internal and external email. Legacy combined header/row pattern split into separate models. |
| EMailQueVc | Outbound Email Queue | 31 + 2 | **EmailQueue** | MVP | BullMQ-backed outbound queue replacing legacy polling queue. Status tracking through send lifecycle. |
| MailReadVc | Per-Recipient Status | 5 | **EmailReadStatus** (embedded in EmailRecipient) | MVP | Read/unread/deleted status per recipient. Legacy 13-state enum simplified. |
| MailTextVc | Document-to-Email Templates | 5 | **EmailTemplate** | MVP | Template-based email generation from business documents. Merged with HtmlTemplateVc. |
| HtmlTemplateVc | HTML Email Templates | 2 + files | **EmailTemplate** (combined) | MVP | HTML body templates with file assets. Merged into EmailTemplate with `bodyHtml` field. |
| ConfVc (Class=5) | User Mailbox | 53 | **Not needed** — user inbox is implicit from EmailRecipient queries | MVP | Legacy dual-purpose register split. User mailbox is a virtual view, not a separate entity. |
| ConfVc (Class=0-4,6) | Conferences/Channels | 53 | **ConferenceRoom** | MVP | Shared discussion spaces for teams. Simplified from 7 classes to typed enum. |
| ConfAccVc | Conference Access | 3 | **ConferenceAccess** | MVP | Per-user access control on conference rooms. Legacy 10-level enum simplified. |
| ConfSignVc | Email Signature | 3 + files | **EmailSignature** (field on User or separate model) | MVP | Per-user HTML/plain-text signature. |
| ConfAutoReplyVc | Auto-Reply Config | 7 | **AutoReplyConfig** (embedded in NotificationPreference or separate) | MVP | Out-of-office / auto-reply with rate limiting. |
| AutoReplyListVc | Auto-Reply Rate Limiter | 4 | Handled by Redis rate-limit key | MVP | Max 3 auto-replies per sender per day. Redis TTL replaces register-based counting. |
| ConfSubVc | Conference Subscription | 3 | **ConferenceAccess** (subscription flag) | MVP | Merged into access model with `isSubscribed` field. |
| MailFilterVc | Mail Filter Rules | 3 | Deferred | P2 | Rule-based mail filtering. Low priority for MVP. |
| MailFolderVc | Mail Folders | 2 | Deferred | P2 | Sub-folder organisation within mailbox. Tag-based organisation preferred for MVP. |
| ChatLogVc | Chat Log | 3 + rows | **ChatMessage** | MVP | Real-time internal chat messages. |
| ExtChatUsersVc | Live Chat Operators | 6 | Deferred | P2 | Web live-chat operator assignment. |
| SMSVc | SMS Messages | 10 | Deferred | P2 | SMS integration via third-party API (Twilio/MessageBird). |
| Anna2ContextVc | AI Chat Context | rows | AI Engine context store (Redis) | MVP | Conversation context managed by AI Engine (section 2.1), not Communications module. |
| Anna2ChatNodeVc | AI Decision Tree Nodes | 10+ | AI Engine function-calling schema | MVP | Replaced by Claude function definitions. No decision tree needed. |
| LocalMailVc | Local/Internal Mail | 6 + rows | **ChatMessage** (for direct messages) | MVP | Internal-only messaging absorbed into chat system. |
| PBXConnectionVc | Asterisk PBX | 5 | Deferred | P3 | VOIP integration. Future extension via cloud PBX API (Twilio, Vonage). |
| SipTrunk2Vc | SIP Trunk Config | 4 | Deferred | P3 | SIP trunking. Future extension. |

---

#### Prisma Schema

```prisma
// ═══════════════════════════════════════════════
// COMMUNICATIONS MODULE — Chat, Email, Conferencing & Notifications
// ═══════════════════════════════════════════════

// ─── Enums ───────────────────────────────────

enum ChatChannelType {
  DIRECT            // 1:1 direct message between two users
  GROUP             // Multi-user group chat
  AI_ASSISTANT      // User ↔ AI Engine conversation (FR1-FR7)

  @@map("chat_channel_type")
}

enum EmailMessageStatus {
  DRAFT
  SENT
  QUEUED
  FAILED
  BOUNCED

  @@map("email_message_status")
}

enum EmailRecipientType {
  FROM
  TO
  CC
  BCC

  @@map("email_recipient_type")
}

enum EmailRecipientStatus {
  UNREAD
  READ
  DELETED
  ARCHIVED

  @@map("email_recipient_status")
}

enum EmailQueueStatus {
  PENDING
  PROCESSING
  SENT
  FAILED
  RETRYING

  @@map("email_queue_status")
}

enum EmailDirection {
  INBOUND
  OUTBOUND

  @@map("email_direction")
}

enum ConferenceRoomType {
  DISCUSSION        // General team discussion (legacy kConfClassConference)
  ANNOUNCEMENTS     // One-to-many news/announcements (legacy kConfClassNews + Billboard)
  KNOWLEDGE_BASE    // Document library / wiki-style (legacy kConfClassLibrary)

  @@map("conference_room_type")
}

enum ConferenceAccessLevel {
  FULL              // Read + write + delete (legacy kAccessLevelFull)
  READ_WRITE        // Read + write, no delete
  READ_ONLY         // Read only (legacy kAccessLevelReadOnly)
  NONE              // No access (legacy kAccessLevelNone)

  @@map("conference_access_level")
}

enum NotificationChannel {
  IN_APP
  EMAIL
  PUSH

  @@map("notification_channel")
}

enum NotificationPriority {
  LOW
  NORMAL
  HIGH
  URGENT

  @@map("notification_priority")
}

enum NotificationStatus {
  PENDING
  DELIVERED
  READ
  DISMISSED
  FAILED

  @@map("notification_status")
}

// ─── Chat Channel ────────────────────────────

model ChatChannel {
  id              String          @id @default(uuid())
  name            String?         @db.VarChar(200)           // Null for DIRECT channels
  channelType     ChatChannelType @map("channel_type")
  topic           String?         @db.VarChar(500)           // Channel topic / description

  // AI assistant channel metadata
  aiSessionId     String?         @map("ai_session_id")     // Links to AI Engine session context (FR7)

  // Lifecycle
  isArchived      Boolean         @default(false) @map("is_archived")

  // Audit
  createdAt       DateTime        @default(now()) @map("created_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")
  createdBy       String          @map("created_by")

  // Relations
  participants    ChatParticipant[]
  messages        ChatMessage[]

  @@map("chat_channels")
  @@index([channelType], map: "idx_chat_channels_type")
  @@index([createdBy], map: "idx_chat_channels_created_by")
  @@index([isArchived], map: "idx_chat_channels_archived")
}

// ─── Chat Participant ────────────────────────

model ChatParticipant {
  id              String          @id @default(uuid())
  channelId       String          @map("channel_id")
  userId          String          @map("user_id")            // FK to User

  // Read tracking
  lastReadAt      DateTime?       @map("last_read_at")       // Timestamp of last-read message
  lastReadMessageId String?       @map("last_read_message_id") // ID of last-read message

  // Participant state
  isMuted         Boolean         @default(false) @map("is_muted")
  isPinned        Boolean         @default(false) @map("is_pinned")

  // Audit
  joinedAt        DateTime        @default(now()) @map("joined_at")
  leftAt          DateTime?       @map("left_at")

  // Relations
  channel         ChatChannel     @relation(fields: [channelId], references: [id], onDelete: Cascade)

  @@map("chat_participants")
  @@unique([channelId, userId], map: "uq_chat_participants_channel_user")
  @@index([userId], map: "idx_chat_participants_user")
  @@index([userId, lastReadAt], map: "idx_chat_participants_user_read")
}

// ─── Chat Message ────────────────────────────

model ChatMessage {
  id              String          @id @default(uuid())
  channelId       String          @map("channel_id")
  senderId        String          @map("sender_id")          // FK to User (or "system" for AI)

  // Content
  content         String          @db.Text                   // Message text (Markdown supported)
  contentHtml     String?         @map("content_html") @db.Text // Pre-rendered HTML (optional)

  // Reply threading
  parentMessageId String?         @map("parent_message_id")  // For threaded replies
  parentMessage   ChatMessage?    @relation("ChatMessageThread", fields: [parentMessageId], references: [id])
  replies         ChatMessage[]   @relation("ChatMessageThread")

  // AI metadata (for AI_ASSISTANT channels)
  isAiGenerated   Boolean         @default(false) @map("is_ai_generated")
  aiConfidence    Decimal?        @map("ai_confidence") @db.Decimal(5, 4) // 0.0000-1.0000 (FR10)
  aiActionTaken   String?         @map("ai_action_taken") @db.VarChar(200) // e.g. "created SalesOrder SO-00042"

  // Polymorphic link to ERP entity (when message references a business record)
  entityType      String?         @map("entity_type") @db.VarChar(100)
  entityId        String?         @map("entity_id")

  // Edit/delete
  isEdited        Boolean         @default(false) @map("is_edited")
  editedAt        DateTime?       @map("edited_at")
  isDeleted       Boolean         @default(false) @map("is_deleted") // Soft delete
  deletedAt       DateTime?       @map("deleted_at")

  // Audit
  createdAt       DateTime        @default(now()) @map("created_at")
  updatedAt       DateTime        @updatedAt @map("updated_at")

  // Relations
  channel         ChatChannel     @relation(fields: [channelId], references: [id], onDelete: Cascade)

  @@map("chat_messages")
  @@index([channelId, createdAt], map: "idx_chat_messages_channel_time")
  @@index([senderId], map: "idx_chat_messages_sender")
  @@index([parentMessageId], map: "idx_chat_messages_parent")
  @@index([channelId, isDeleted], map: "idx_chat_messages_channel_active")
  @@index([entityType, entityId], map: "idx_chat_messages_entity")
}

// ─── Email Message ───────────────────────────

model EmailMessage {
  id                  String             @id @default(uuid())
  messageNumber       String             @unique @map("message_number")       // Auto via NumberSeries "EM-00001"
  subject             String             @db.VarChar(500)
  bodyText            String?            @map("body_text") @db.Text           // Plain text body
  bodyHtml            String?            @map("body_html") @db.Text           // HTML body

  // Direction & status
  direction           EmailDirection
  status              EmailMessageStatus @default(DRAFT)

  // External email metadata
  externalMessageId   String?            @map("external_message_id") @db.VarChar(500) // RFC 5322 Message-ID
  inReplyTo           String?            @map("in_reply_to") @db.VarChar(500) // RFC 5322 In-Reply-To
  threadId            String?            @map("thread_id") @db.VarChar(500)   // Conversation threading

  // Template reference (when generated from a document)
  emailTemplateId     String?            @map("email_template_id")            // FK to EmailTemplate
  sourceEntityType    String?            @map("source_entity_type") @db.VarChar(100) // e.g. "CustomerInvoice"
  sourceEntityId      String?            @map("source_entity_id")             // UUID of the source document

  // Email properties
  priority            Int                @default(0)                           // 0=normal, 1=high
  isHtml              Boolean            @default(true) @map("is_html")
  hasAttachments      Boolean            @default(false) @map("has_attachments")

  // Auto-reply protection (maps to legacy AutoSubmitted, IsBounce, IsList)
  isAutoGenerated     Boolean            @default(false) @map("is_auto_generated")
  isBounce            Boolean            @default(false) @map("is_bounce")
  isMailingList        Boolean            @default(false) @map("is_mailing_list")

  // Tags
  tags                String[]           @default([])                          // Flexible tagging

  // Acceptance workflow (maps to legacy RequireAcceptance)
  requiresAcceptance  Boolean            @default(false) @map("requires_acceptance")

  // Audit
  sentAt              DateTime?          @map("sent_at")
  createdAt           DateTime           @default(now()) @map("created_at")
  updatedAt           DateTime           @updatedAt @map("updated_at")
  createdBy           String             @map("created_by")
  updatedBy           String             @map("updated_by")

  // Relations
  recipients          EmailRecipient[]
  queueEntry          EmailQueue?

  @@map("email_messages")
  @@index([status], map: "idx_email_messages_status")
  @@index([direction], map: "idx_email_messages_direction")
  @@index([sentAt], map: "idx_email_messages_sent_at")
  @@index([createdBy], map: "idx_email_messages_created_by")
  @@index([sourceEntityType, sourceEntityId], map: "idx_email_messages_source_entity")
  @@index([threadId], map: "idx_email_messages_thread")
  @@index([externalMessageId], map: "idx_email_messages_external_id")
}

// ─── Email Recipient ─────────────────────────

model EmailRecipient {
  id                  String               @id @default(uuid())
  emailMessageId      String               @map("email_message_id")
  recipientType       EmailRecipientType   @map("recipient_type")

  // Address (internal user or external email)
  userId              String?              @map("user_id")                     // FK to User (if internal)
  emailAddress        String               @map("email_address") @db.VarChar(320) // Always populated
  displayName         String?              @map("display_name") @db.VarChar(200)

  // Per-recipient status (maps to legacy MailReadVc)
  status              EmailRecipientStatus @default(UNREAD)
  readAt              DateTime?            @map("read_at")

  // Acceptance status (for mails with requiresAcceptance)
  acceptanceStatus    String?              @map("acceptance_status") @db.VarChar(20) // PENDING, ACCEPTED, REJECTED, POSTPONED

  // Audit
  createdAt           DateTime             @default(now()) @map("created_at")
  updatedAt           DateTime             @updatedAt @map("updated_at")

  // Relations
  emailMessage        EmailMessage         @relation(fields: [emailMessageId], references: [id], onDelete: Cascade)

  @@map("email_recipients")
  @@index([emailMessageId], map: "idx_email_recipients_message")
  @@index([userId, status], map: "idx_email_recipients_user_status")
  @@index([emailAddress], map: "idx_email_recipients_address")
  @@index([userId, recipientType], map: "idx_email_recipients_user_type")
}

// ─── Email Queue ─────────────────────────────

model EmailQueue {
  id                  String           @id @default(uuid())
  emailMessageId      String           @unique @map("email_message_id")       // 1:1 with EmailMessage

  // Queue metadata
  status              EmailQueueStatus @default(PENDING)
  priority            Int              @default(0)                             // Higher = process first
  attempts            Int              @default(0)                             // Retry count
  maxAttempts         Int              @default(3) @map("max_attempts")
  lastError           String?          @map("last_error") @db.Text            // Last failure reason
  nextRetryAt         DateTime?        @map("next_retry_at")                  // Exponential backoff

  // SMTP tracking
  smtpResponse        String?          @map("smtp_response") @db.VarChar(500)
  deliveredAt         DateTime?        @map("delivered_at")
  bouncedAt           DateTime?        @map("bounced_at")

  // Processing
  queuedAt            DateTime         @default(now()) @map("queued_at")
  processedAt         DateTime?        @map("processed_at")

  // Relations
  emailMessage        EmailMessage     @relation(fields: [emailMessageId], references: [id])

  @@map("email_queue")
  @@index([status, priority], map: "idx_email_queue_status_priority")
  @@index([nextRetryAt], map: "idx_email_queue_retry")
  @@index([queuedAt], map: "idx_email_queue_queued_at")
}

// ─── Email Template ──────────────────────────

model EmailTemplate {
  id                  String           @id @default(uuid())
  code                String           @unique                                 // "INVOICE_SEND", "STATEMENT_SEND", "ORDER_CONFIRM"
  name                String           @db.VarChar(200)                        // Human-readable name
  description         String?          @db.Text

  // Scope: which document type this template serves
  documentType        String           @map("document_type") @db.VarChar(100) // "CustomerInvoice", "SalesOrder", "PurchaseOrder", etc.

  // Template content (Handlebars/React Email compatible)
  subjectTemplate     String           @map("subject_template") @db.VarChar(500) // e.g. "Invoice {{invoiceNumber}} from {{companyName}}"
  bodyHtmlTemplate    String           @map("body_html_template") @db.Text    // HTML template with merge fields
  bodyTextTemplate    String?          @map("body_text_template") @db.Text    // Plain text fallback

  // Opening/closing text blocks (maps to legacy MailTextVc FirstTxt/LastTxt)
  openingTextCode     String?          @map("opening_text_code") @db.VarChar(60) // Reference to StandardText
  closingTextCode     String?          @map("closing_text_code") @db.VarChar(60) // Reference to StandardText

  // Language support
  languageCode        String           @default("en") @map("language_code") @db.VarChar(5)

  // Behaviour flags
  attachPdf           Boolean          @default(true) @map("attach_pdf")      // Auto-attach PDF of source document
  autoSend            Boolean          @default(false) @map("auto_send")      // Send immediately without draft

  // Status
  isActive            Boolean          @default(true) @map("is_active")

  // Audit
  createdAt           DateTime         @default(now()) @map("created_at")
  updatedAt           DateTime         @updatedAt @map("updated_at")
  createdBy           String           @map("created_by")
  updatedBy           String           @map("updated_by")

  @@map("email_templates")
  @@index([documentType, languageCode], map: "idx_email_templates_doc_lang")
  @@index([code], map: "idx_email_templates_code")
  @@index([isActive], map: "idx_email_templates_active")
}

// ─── Email Alias ─────────────────────────────

model EmailAlias {
  id                  String           @id @default(uuid())
  aliasAddress        String           @unique @map("alias_address") @db.VarChar(320) // e.g. "accounts@company.com"
  targetUserId        String?          @map("target_user_id")                 // FK to User (individual)
  targetConferenceId  String?          @map("target_conference_id")           // FK to ConferenceRoom (shared)
  description         String?          @db.VarChar(200)
  isActive            Boolean          @default(true) @map("is_active")

  // Audit
  createdAt           DateTime         @default(now()) @map("created_at")
  updatedAt           DateTime         @updatedAt @map("updated_at")

  @@map("email_aliases")
  @@index([isActive], map: "idx_email_aliases_active")
  @@index([targetUserId], map: "idx_email_aliases_user")
  @@index([targetConferenceId], map: "idx_email_aliases_conference")
}

// ─── Email Signature ─────────────────────────

model EmailSignature {
  id                  String           @id @default(uuid())
  userId              String           @unique @map("user_id")               // FK to User (one signature per user)
  name                String           @db.VarChar(100)                      // "Default", "Formal", etc.
  bodyHtml            String           @map("body_html") @db.Text            // Rich HTML signature
  bodyText            String?          @map("body_text") @db.Text            // Plain text fallback
  isDefault           Boolean          @default(true) @map("is_default")

  // Audit
  createdAt           DateTime         @default(now()) @map("created_at")
  updatedAt           DateTime         @updatedAt @map("updated_at")

  @@map("email_signatures")
  @@index([userId], map: "idx_email_signatures_user")
}

// ─── Conference Room ─────────────────────────

model ConferenceRoom {
  id                  String              @id @default(uuid())
  name                String              @unique @db.VarChar(200)            // "Engineering", "Finance Team", "Company News"
  description         String?             @db.Text
  roomType            ConferenceRoomType  @map("room_type")

  // Hierarchy (folders / sub-conferences)
  parentRoomId        String?             @map("parent_room_id")             // FK self-ref for nested rooms
  parentRoom          ConferenceRoom?     @relation("ConferenceHierarchy", fields: [parentRoomId], references: [id])
  childRooms          ConferenceRoom[]    @relation("ConferenceHierarchy")

  // Configuration
  isClosed            Boolean             @default(false) @map("is_closed")  // Closed conferences accept no new posts
  defaultHtmlMode     Boolean             @default(true) @map("default_html_mode")

  // Retention policy (maps to legacy MaxMail / MaxReadDays)
  maxMessages         Int?                @map("max_messages")               // Null = use system default
  maxAgeDays          Int?                @map("max_age_days")               // Null = use system default

  // Audit
  createdAt           DateTime            @default(now()) @map("created_at")
  updatedAt           DateTime            @updatedAt @map("updated_at")
  createdBy           String              @map("created_by")
  updatedBy           String              @map("updated_by")

  // Relations
  accessRules         ConferenceAccess[]

  @@map("conference_rooms")
  @@index([roomType], map: "idx_conference_rooms_type")
  @@index([parentRoomId], map: "idx_conference_rooms_parent")
  @@index([isClosed], map: "idx_conference_rooms_closed")
}

// ─── Conference Access ───────────────────────

model ConferenceAccess {
  id                  String               @id @default(uuid())
  conferenceRoomId    String               @map("conference_room_id")
  userId              String               @map("user_id")                    // FK to User
  accessLevel         ConferenceAccessLevel @map("access_level") @default(READ_ONLY)

  // Subscription (maps to legacy ConfSubVc — merged here)
  isSubscribed        Boolean              @default(true) @map("is_subscribed") // Receive notifications for new posts

  // Audit
  createdAt           DateTime             @default(now()) @map("created_at")
  updatedAt           DateTime             @updatedAt @map("updated_at")
  grantedBy           String               @map("granted_by")                // User who granted access

  // Relations
  conferenceRoom      ConferenceRoom       @relation(fields: [conferenceRoomId], references: [id], onDelete: Cascade)

  @@map("conference_access")
  @@unique([conferenceRoomId, userId], map: "uq_conference_access_room_user")
  @@index([userId], map: "idx_conference_access_user")
  @@index([accessLevel], map: "idx_conference_access_level")
}

// ─── Notification Template ───────────────────

model NotificationTemplate {
  id                  String             @id @default(uuid())
  code                String             @unique                               // "INVOICE_APPROVED", "ORDER_SHIPPED", "APPROVAL_REQUIRED"
  name                String             @db.VarChar(200)
  description         String?            @db.Text

  // Event binding
  eventName           String             @map("event_name") @db.VarChar(200)  // Event bus event: "invoice.approved", "order.shipped"

  // Template content (Handlebars)
  titleTemplate       String             @map("title_template") @db.VarChar(500) // "Invoice {{invoiceNumber}} approved"
  bodyTemplate        String             @map("body_template") @db.Text        // "Your invoice {{invoiceNumber}} for {{customerName}} has been approved."

  // Channel defaults (which channels fire by default — users can override)
  defaultChannels     NotificationChannel[] @default([IN_APP]) @map("default_channels")
  defaultPriority     NotificationPriority  @default(NORMAL) @map("default_priority")

  // Deep link
  actionUrl           String?            @map("action_url") @db.VarChar(500)  // "/invoices/{{entityId}}" — template for navigation

  // Status
  isActive            Boolean            @default(true) @map("is_active")

  // Audit
  createdAt           DateTime           @default(now()) @map("created_at")
  updatedAt           DateTime           @updatedAt @map("updated_at")

  @@map("notification_templates")
  @@index([eventName], map: "idx_notification_templates_event")
  @@index([isActive], map: "idx_notification_templates_active")
}

// ─── Notification Preference ─────────────────

model NotificationPreference {
  id                      String               @id @default(uuid())
  userId                  String               @map("user_id")                // FK to User
  notificationTemplateId  String               @map("notification_template_id") // FK to NotificationTemplate

  // Channel overrides (user can enable/disable per channel per notification type)
  enableInApp             Boolean              @default(true) @map("enable_in_app")
  enableEmail             Boolean              @default(true) @map("enable_email")
  enablePush              Boolean              @default(true) @map("enable_push")

  // Priority override
  priorityOverride        NotificationPriority? @map("priority_override")

  // Mute / schedule
  isMuted                 Boolean              @default(false) @map("is_muted")
  muteUntil               DateTime?            @map("mute_until")

  // Auto-reply (maps to legacy ConfAutoReplyVc — per-user out-of-office)
  autoReplyEnabled        Boolean              @default(false) @map("auto_reply_enabled")
  autoReplySubject        String?              @map("auto_reply_subject") @db.VarChar(500)
  autoReplyBody           String?              @map("auto_reply_body") @db.Text
  autoReplyStartDate      DateTime?            @map("auto_reply_start_date")
  autoReplyEndDate        DateTime?            @map("auto_reply_end_date")

  // Audit
  createdAt               DateTime             @default(now()) @map("created_at")
  updatedAt               DateTime             @updatedAt @map("updated_at")

  @@map("notification_preferences")
  @@unique([userId, notificationTemplateId], map: "uq_notification_prefs_user_template")
  @@index([userId], map: "idx_notification_prefs_user")
}

// ─── Notification (Transactional Instance) ───

model Notification {
  id                  String               @id @default(uuid())
  userId              String               @map("user_id")                    // FK to User (recipient)
  templateId          String?              @map("template_id")               // FK to NotificationTemplate (null for ad-hoc)

  // Content (resolved from template at send time)
  title               String               @db.VarChar(500)
  body                String               @db.Text
  channel             NotificationChannel
  priority            NotificationPriority @default(NORMAL)

  // Deep link
  actionUrl           String?              @map("action_url") @db.VarChar(500)

  // Polymorphic link to source entity
  entityType          String?              @map("entity_type") @db.VarChar(100)
  entityId            String?              @map("entity_id")

  // Status
  status              NotificationStatus   @default(PENDING)
  deliveredAt         DateTime?            @map("delivered_at")
  readAt              DateTime?            @map("read_at")
  dismissedAt         DateTime?            @map("dismissed_at")

  // Audit
  createdAt           DateTime             @default(now()) @map("created_at")
  updatedAt           DateTime             @updatedAt @map("updated_at")

  @@map("notifications")
  @@index([userId, status], map: "idx_notifications_user_status")
  @@index([userId, createdAt], map: "idx_notifications_user_time")
  @@index([channel, status], map: "idx_notifications_channel_status")
  @@index([entityType, entityId], map: "idx_notifications_entity")
  @@index([templateId], map: "idx_notifications_template")
}

// ─── Mass Mail Campaign ──────────────────────

model MassMailCampaign {
  id                  String           @id @default(uuid())
  name                String           @db.VarChar(200)
  description         String?          @db.Text

  // Template
  emailTemplateId     String           @map("email_template_id")             // FK to EmailTemplate
  subject             String           @db.VarChar(500)

  // Targeting (maps to legacy MassMailMn filters)
  targetFilter        Json             @map("target_filter")                 // { customerCategory, region, tags, etc. }

  // Execution
  totalRecipients     Int              @default(0) @map("total_recipients")
  sentCount           Int              @default(0) @map("sent_count")
  failedCount         Int              @default(0) @map("failed_count")
  scheduledAt         DateTime?        @map("scheduled_at")                  // Null = manual trigger
  startedAt           DateTime?        @map("started_at")
  completedAt         DateTime?        @map("completed_at")

  // Status
  status              String           @default("DRAFT") @db.VarChar(20)     // DRAFT, SCHEDULED, RUNNING, COMPLETED, CANCELLED

  // Audit
  createdAt           DateTime         @default(now()) @map("created_at")
  updatedAt           DateTime         @updatedAt @map("updated_at")
  createdBy           String           @map("created_by")
  updatedBy           String           @map("updated_by")

  @@map("mass_mail_campaigns")
  @@index([status], map: "idx_mass_mail_campaigns_status")
  @@index([scheduledAt], map: "idx_mass_mail_campaigns_scheduled")
}
```

---

#### Document-to-Email Pipeline

A core UK SME workflow: the user clicks "Email Invoice" (or "Email Order", "Email Statement") and the system composes an email from the business document using the appropriate template, generates a PDF attachment, and queues it for delivery. This maps directly to the legacy `CreateMailFromIVD`, `CreateMailFromORD`, `CreateMailFromQTD`, and `CreateMailFromAct` patterns.

```
1. User action: "Email this invoice" (UI button or AI command via FR1)
   │
   ├─ Resolve EmailTemplate WHERE documentType = "CustomerInvoice"
   │   AND languageCode = customer.preferredLanguage ?? "en"
   │
   ├─ Resolve recipient email address:
   │   Customer.email → Contact.email (with role "Accounts") → fallback
   │
   ├─ Merge template fields:
   │   { invoiceNumber, customerName, totalAmount, dueDate, companyName, ... }
   │
   ├─ Generate PDF (via Document Templates §2.12):
   │   POST /api/documents/generate { templateCode: "INVOICE", entityId }
   │   └─ Returns: PDF binary + storageKey
   │
   ├─ Create EmailMessage record:
   │   { direction: OUTBOUND, status: DRAFT, sourceEntityType: "CustomerInvoice",
   │     sourceEntityId, subject: resolved, bodyHtml: resolved }
   │
   ├─ Create EmailRecipient rows:
   │   [ { type: FROM, emailAddress: companyEmail },
   │     { type: TO,   emailAddress: customerEmail, userId: null } ]
   │
   ├─ Attach PDF via Attachment model (§2.20):
   │   { entityType: "EmailMessage", entityId, fileName: "INV-00042.pdf" }
   │
   ├─ If template.autoSend OR user confirms:
   │   └─ Set status = QUEUED, create EmailQueue entry
   │       └─ BullMQ email-send worker picks up and delivers via SMTP
   │
   └─ Create RecordLink (§2.20):
       { source: "CustomerInvoice", target: "EmailMessage", type: RELATES_TO }
       Create Activity (§2.20):
       { type: EMAIL, subject: "Invoice emailed", entityType: "CustomerInvoice" }
```

**Supported document types for email pipeline (MVP):**

| Document Type | Template Code | Legacy Function | PDF Attached |
|--------------|--------------|-----------------|-------------|
| CustomerInvoice | `INVOICE_SEND` | `CreateMailFromIVD` | Yes |
| CustomerStatement | `STATEMENT_SEND` | (via IVToMailMn batch) | Yes |
| SalesQuote | `QUOTE_SEND` | `CreateMailFromQTD` | Yes |
| SalesOrder | `ORDER_CONFIRM` | `CreateMailFromORD` | Yes |
| PurchaseOrder | `PO_SEND` | (new) | Yes |
| CreditNote | `CREDIT_NOTE_SEND` | (via CreateMailFromIVD variant) | Yes |
| Payslip | `PAYSLIP_SEND` | (new) | Yes |

**Batch emailing (maps to legacy IVToMailMn):**

The system supports batch email generation for invoice runs. The maintenance job iterates a filtered set of invoices (by date range, customer category, classification), groups them per customer (optionally attaching multiple invoices to a single email), creates EmailMessage + EmailQueue entries for each, and processes them through the BullMQ email-send worker. Progress is tracked via the batch job status API.

---

#### Auto-Reply System

Auto-reply maps directly from the legacy ConfAutoReplyVc + AutoReplyListVc pattern. When a user enables auto-reply (via NotificationPreference.autoReplyEnabled), inbound emails to that user trigger an automatic response.

```
Inbound email arrives for user X:
  │
  ├─ Check: NotificationPreference.autoReplyEnabled == true
  │   AND now() BETWEEN autoReplyStartDate AND autoReplyEndDate
  │
  ├─ Anti-loop guards (MUST ALL pass):
  │   ├─ EmailMessage.isAutoGenerated == false
  │   ├─ EmailMessage.isBounce == false
  │   ├─ EmailMessage.isMailingList == false
  │   └─ Sender is not the user themselves
  │
  ├─ Rate limiting (Redis key: "autoreply:{userId}:{senderEmail}:{date}"):
  │   ├─ INCREMENT counter
  │   ├─ If counter > 3 → SKIP (max 3 auto-replies per sender per day)
  │   └─ SET TTL to end-of-day
  │
  └─ If all checks pass:
      ├─ Create EmailMessage { direction: OUTBOUND, isAutoGenerated: true,
      │   subject: autoReplySubject, bodyHtml: autoReplyBody }
      ├─ Create EmailQueue entry
      └─ BullMQ processes delivery
```

---

#### Chat & AI Chatbot Integration

The chat system provides real-time internal messaging via WebSocket (Socket.io, already specified in the architecture for AI chat). The `AI_ASSISTANT` channel type connects to the AI Engine (FR1-FR7), enabling conversational ERP operations.

**AI chatbot capabilities (replacing legacy Anna2):**

| Capability | Legacy Anna2 Function | Nexa Implementation |
|-----------|----------------------|---------------------|
| Create sales order | `A2CProc_OR_Create` | AI Engine function call → SalesOrder.create API |
| Add item to order | `A2CProc_OR_AddItem` | AI Engine function call → SalesOrderLine.create API |
| Email order to customer | `A2CProc_OR_Email` | AI Engine function call → document-to-email pipeline |
| List deliverable orders | `A2CProc_OR_GetDeliverable` | AI Engine function call → SalesOrder.list API (filtered) |
| Check delivery date | `A2CProc_OR_PlannedDelivery` | AI Engine function call → SalesOrder.get API |
| Create quotation | `A2CProc_QT_AddItem` | AI Engine function call → SalesQuote.create API |
| Email quotation | `A2CProc_QT_Email` | AI Engine function call → document-to-email pipeline |
| Look up customer | (via ValidateCUVc) | AI Engine function call → Customer.search API |
| Look up item | (via ValidateItem + AI_ScoreTaggedCodes) | AI Engine function call → Item.search API |

**Key architectural differences from Anna2:**

1. **No local LLM** — Anna2 used `llama-2-7b-chat` via `LLM_Init`. Nexa uses Claude API with function calling. The intent-scoring and entity-matching done locally by Anna2 is handled natively by Claude's function-calling capability.
2. **No decision tree** — Anna2's node-based decision tree (`Anna2ChatNodeVc`) with node stacks and try-counts is replaced by Claude's contextual conversation management. The AI Engine maintains session context in Redis (not Base64-encoded register rows).
3. **Confidence scoring** — Anna2 used a 0.8 cutoff on `AI_ScoreIntents`. Nexa exposes `ChatMessage.aiConfidence` (FR10) so the UI can display confidence indicators and require user confirmation for lower-confidence actions (FR6).
4. **Audit trail** — Every AI action is logged in `ChatMessage.aiActionTaken` and in the system audit log (FR9), providing full traceability of AI-initiated business operations.

---

#### Notification Routing

The notification system converts event bus events into user-facing notifications across multiple channels. When a business event fires (e.g., `invoice.approved`, `approval.requested`, `order.shipped`), the notification service resolves the target users, applies their preferences, and dispatches through the appropriate channel.

```
Event bus emits: "invoice.approved" { invoiceId, invoiceNumber, approvedBy }
  │
  ├─ Look up NotificationTemplate WHERE eventName = "invoice.approved"
  │
  ├─ Resolve target users:
  │   └─ Invoice creator (createdBy) + assigned salesperson
  │
  ├─ For each target user:
  │   ├─ Look up NotificationPreference for this user + template
  │   ├─ If user has muted this notification type → SKIP
  │   ├─ If muteUntil > now() → SKIP
  │   │
  │   ├─ Merge template: title = "Invoice INV-00042 approved"
  │   │                  body = "Your invoice for Acme Ltd has been approved by Jane Smith."
  │   │                  actionUrl = "/invoices/{{invoiceId}}"
  │   │
  │   ├─ Channel routing (based on preference + template defaults):
  │   │   ├─ IN_APP → Create Notification record (status: PENDING)
  │   │   │           → Push via WebSocket to connected client
  │   │   ├─ EMAIL  → Create EmailMessage + EmailQueue entry
  │   │   └─ PUSH   → Enqueue BullMQ job → Expo Push API
  │   │
  │   └─ All channels create Notification records for unified history
  │
  └─ Done
```

---

#### Mail Search

Mail search maps from the legacy `SearchMailRn` report with its rich filtering capabilities. Nexa implements this as an API endpoint with full-text search backed by PostgreSQL `tsvector` or an external search index (Typesense/Meilisearch) for larger datasets.

**Search filters (maps to legacy SearchMailRn):**

| Filter | Legacy | Nexa Implementation |
|--------|--------|---------------------|
| Date range | Mail date + creation date | `sentAt` / `createdAt` BETWEEN range |
| Sender/recipient | Mode 0/1/2 (sender/recipient/any) | Query EmailRecipient by recipientType + emailAddress |
| Text search | Body + subject | Full-text search on `subject` + `bodyText` |
| Tag filter | Tag set intersection | `tags` array overlap query (`&&` operator) |
| Read/unread | MailReadVc status | EmailRecipient.status = UNREAD / READ |
| Has attachments | Attachment presence | `hasAttachments` boolean + join to Attachment |
| Direction | (implicit in legacy) | `direction` = INBOUND / OUTBOUND |

---

#### Business Rules

| Rule ID | Rule | Implementation |
|---------|------|----------------|
| BR-COM-001 | Email recipient address must be valid | Service-layer validation: internal userId must exist, external address must pass RFC 5322 format check |
| BR-COM-002 | Duplicate recipients not allowed per message | Unique constraint on (emailMessageId, emailAddress, recipientType) enforced in service |
| BR-COM-003 | Cannot un-send a queued/sent email | Guard: if EmailQueue.status IN (PROCESSING, SENT), reject status change back to DRAFT |
| BR-COM-004 | Auto-reply must not loop | Check isAutoGenerated, isBounce, isMailingList flags before sending auto-reply |
| BR-COM-005 | Auto-reply rate limited to 3 per sender per day | Redis counter with TTL per (userId, senderEmail, date) |
| BR-COM-006 | Conference name must be unique | Unique constraint on ConferenceRoom.name |
| BR-COM-007 | Conference access inherits from parent | Service walks parentRoomId chain; child access cannot exceed parent access level |
| BR-COM-008 | Closed conference rejects new posts | Guard: check ConferenceRoom.isClosed before creating EmailMessage with conference recipient |
| BR-COM-009 | Email signature appended once | Service tracks signature insertion; prevents double-append on re-queue |
| BR-COM-010 | Document-to-email requires valid template | Validate EmailTemplate exists for documentType before composing; fall back to system default |
| BR-COM-011 | Mass mail requires explicit user confirmation | Campaign status must transition DRAFT -> SCHEDULED -> RUNNING; no auto-start |
| BR-COM-012 | Chat messages are soft-deleted | ChatMessage.isDeleted = true; content retained for audit but hidden from UI |
| BR-COM-013 | AI chatbot actions require user confirmation | AI Engine must surface proposed action to user (FR6) before executing create/modify/delete operations |
| BR-COM-014 | Notification preferences cascade from template defaults | If user has no NotificationPreference for a template, use NotificationTemplate.defaultChannels |
| BR-COM-015 | Email attachments use S3 presign flow | All file attachments go through the Attachment upload pipeline (§2.20), never stored inline |
| BR-COM-016 | Mail acceptance requires explicit action | When requiresAcceptance = true, EmailRecipient.acceptanceStatus must be set by recipient; system cannot auto-accept |
| BR-COM-017 | Conference retention policy enforced by scheduled job | Background job (BullMQ cron) purges messages exceeding maxMessages or maxAgeDays per ConferenceRoom |

---

#### Build Sequence & Dependencies

Communications is a supporting module that spans the entire system. The email pipeline is needed as soon as any module sends transactional emails (invoices, statements, purchase orders), and the notification system is needed as soon as approval workflows generate events.

| Story | Scope | Dependencies |
|-------|-------|-------------|
| COM-1 | ChatChannel + ChatParticipant + ChatMessage models + CRUD API + WebSocket real-time delivery | Story 1 (database), Story 2 (auth, API server), Story 3 (event bus, WebSocket) |
| COM-2 | AI_ASSISTANT channel type integration with AI Engine | COM-1, AI Engine (FR1-FR7) |
| COM-3 | EmailMessage + EmailRecipient + EmailSignature models + CRUD API (compose, inbox view) | Story 1, Story 2 |
| COM-4 | EmailTemplate model + seed default templates (7 document types) | COM-3, Document Templates (§2.12) |
| COM-5 | EmailQueue + BullMQ email-send worker + SMTP integration | COM-3, BullMQ (Story 3) |
| COM-6 | Document-to-email pipeline (invoice, order, quote, PO, statement, credit note, payslip) | COM-4, COM-5, Document Templates (§2.12), relevant business modules |
| COM-7 | EmailAlias model + inbound email routing | COM-3 |
| COM-8 | ConferenceRoom + ConferenceAccess models + CRUD API + post/reply | COM-3 |
| COM-9 | Auto-reply system (NotificationPreference auto-reply fields + rate limiting) | COM-3, Redis |
| COM-10 | NotificationTemplate + NotificationPreference + Notification models + routing engine | Story 3 (event bus), COM-3, BullMQ |
| COM-11 | MassMailCampaign model + batch email job | COM-5, COM-4 |
| COM-12 | Mail search API (full-text search on subject/body, filters) | COM-3 |

**Cross-module integration points:**

- **All modules:** Any module can send emails via the document-to-email pipeline by providing an EmailTemplate and calling the email composition service.
- **Finance / AR / AP:** Invoice, statement, and payment emails. Batch invoice emailing (legacy IVToMailMn). Supplier bill ingestion via inbound email (FR32).
- **Sales:** Quote and order confirmation emails. AI chatbot can create and email quotes/orders.
- **Purchasing:** Purchase order emails to suppliers.
- **HR/Payroll:** Payslip distribution via email. Leave request notifications.
- **Manufacturing:** Production order notifications and quality alert emails.
- **System (§2.10):** User-related notifications (password reset, account activation, role changes).
- **Approvals (§2.20):** Approval requested/completed/rejected events trigger notifications.
- **AI Engine (FR1-FR10):** AI_ASSISTANT chat channels provide the conversational interface. AI-initiated emails flow through the same pipeline.

---

#### Future Extensions (P2/P3)

| Extension | Priority | Notes |
|-----------|----------|-------|
| Mail folder organisation | P2 | Sub-folders within user inbox (currently tag-based) |
| Mail filter rules engine | P2 | Configurable rules for auto-filing, auto-tagging, auto-forwarding |
| Web live chat (customer support) | P2 | External chat widget connecting visitors to internal operators |
| SMS integration | P2 | Twilio/MessageBird API adapter for SMS notifications |
| VOIP/PBX integration | P3 | Cloud PBX API (Twilio Voice, Vonage) replacing legacy Asterisk |
| Email delivery analytics | P2 | Open tracking, click tracking, bounce analysis |
| Conference message threading | P2 | Full threaded discussions within conference rooms |
| Email import (IMAP sync) | P2 | Pull external inbox into Nexa for unified mailbox view |

---

*End of section 2.29*

---

*End of section 2.29*

### 2.30 Service Orders, Timekeeper & Quotation Extensions

The Service Orders subsystem manages the full lifecycle of repair and service jobs for UK SMEs that sell, install, or maintain equipment. It covers the creation of service orders (SVOs), assignment of technician work orders, recording of labour and spare parts via work sheets, warranty tracking through a known serial number registry, and structured fault coding. The module generates invoices from completed service work and integrates with Inventory (spare parts consumption), Purchasing (parts procurement), CRM (activity logging), and AR (invoice creation).

The Timekeeper subsystem provides lightweight time-and-attendance tracking by reusing the existing `Activity` model (section 2.20) with a dedicated `WORK_HOURS` activity type and a clock-in/clock-out pattern. It avoids creating a parallel attendance register, instead storing each clock-in session as an `Activity` record with start/end times. A separate `TargetTime` model defines expected working hours per employee per period for variance reporting.

The Quotation Extensions section documents conversion operations on the existing `SalesQuote` model (section 2.16) for quote-to-order, quote-to-invoice, quote-to-production-order, and quote-to-budget workflows. These are service-layer operations, not new Prisma models.

In the legacy HansaWorld system, Service Orders maps to the SVO module containing SVOVc (81 header + 28 array fields), WOVc (Work Orders, 50+ header + 14 array fields), WSVc (Work Sheets, 60+ header + 22 array fields), WSIVVc (Work Sheet Transactions), SVOSerVc (Known Serial Numbers, 50+ fields), SVGMVc (Service Stock Transactions), and StandProblemVc/StdProblemModVc (fault codes). Timekeeper uses ActVc with `TodoFlag = kTodoFlagWorkHours (4)` and TargTimeVc. Quotation conversion uses QTVc operations (QTDsm.hal) with permission-gated transformations to ORVc, IVVc, ProdVc, and TBBUVc.

---

#### Legacy-to-Nexa Mapping

| Legacy Register | Legacy Entity | Fields | Nexa Target Model(s) | Priority | Notes |
|----------------|--------------|--------|----------------------|----------|-------|
| SVOVc | Service Orders | 81 + 28 | **ServiceOrder** + **ServiceOrderLine** | MVP | Core SVO header + line items. Status model replaces 4 boolean flags. |
| WOVc | Work Orders | 50 + 14 | **WorkOrder** + **WorkOrderLine** | MVP | Technician instructions linked to SVO. |
| WSVc | Work Sheets | 60 + 22 | **WorkSheet** + **WorkSheetLine** | MVP | Labour hours + parts recording. |
| WSIVVc | Work Sheet Transactions | 40+ | Derived from **WorkSheetLine** queries | MVP | No separate model needed; WorkSheetLine captures invoicing type. |
| SVOSerVc | Known Serial Numbers | 50+ | **KnownSerialNumber** | MVP | Warranty tracking per serialised item. |
| SVOSerHistVc | Serial Number History | 6 | Audit trail via `AuditLog` + **KnownSerialNumber** | P1 | Derived from existing audit infrastructure. |
| SVGMVc | Service Stock Transactions | 30+ | Via `StockMovement` (section 2.14) | MVP | Service parts movement uses existing inventory movement model with `sourceType = SERVICE_ORDER`. |
| StandProblemVc | Standard Problems | 5 | **FaultCode** | MVP | Structured fault/problem classification. |
| StdProblemModVc | Standard Problem Modifiers | 2 | **FaultCodeModifier** | MVP | Refinement of fault codes. |
| SVOTextVc | Serial Number Notes | 3 | `notes` field on **KnownSerialNumber** | MVP | Free-text per serial. |
| TargTimeVc | Target Time | 7 + 5 | **TargetTime** + **TargetTimeLine** | MVP | Expected hours per employee per period. |
| ActVc (clock-in) | Timekeeper Activities | Subset | **Activity** (section 2.20) with `WORK_HOURS` type | MVP | Reuses existing Activity model. |
| GSXSettingsBlock | Apple GSX Integration | 14 | Not applicable | -- | Vendor-specific; excluded from Nexa. |
| QTVc operations | Quote Conversions | -- | Service-layer operations on **SalesQuote** | MVP | No new models; business logic only. |

---

#### Prisma Schema

```prisma
// ═══════════════════════════════════════════════
// SERVICE ORDERS, TIMEKEEPER & QUOTATION EXTENSIONS
// ═══════════════════════════════════════════════

// ─── Enums ───────────────────────────────────

enum ServiceOrderStatus {
  DRAFT
  OPEN
  IN_PROGRESS
  ON_HOLD
  COMPLETED
  INVOICED
  CANCELLED

  @@map("service_order_status")
}

enum ServiceLineItemType {
  PLAIN           // Not yet classified
  INVOICEABLE     // Chargeable to customer
  WARRANTY        // Covered under warranty, no charge
  CONTRACT        // Covered under service contract

  @@map("service_line_item_type")
}

enum ServiceLineItemKind {
  MAIN_ITEM       // Primary item being serviced
  SUB_ITEM        // Accessory / sub-component

  @@map("service_line_item_kind")
}

enum WorkOrderStatus {
  OPEN
  IN_PROGRESS
  CLOSED

  @@map("work_order_status")
}

enum WorkSheetStatus {
  DRAFT
  SUBMITTED
  APPROVED
  INVOICED
  REJECTED

  @@map("work_sheet_status")
}

enum WarrantyStatus {
  UNKNOWN
  UNDER_WARRANTY
  OUT_OF_WARRANTY
  EXPIRED
  CONTRACT_COVERED

  @@map("warranty_status")
}

// Extend ActivityType enum (from section 2.20) with:
//   WORK_HOURS    — Timekeeper clock-in/clock-out session
// This requires adding WORK_HOURS to the existing ActivityType enum in 2.20-cross-cutting.md

// ─── Service Order (Transactional — Header) ──

model ServiceOrder {
  id                    String               @id @default(uuid())
  svoNumber             String               @unique @map("svo_number")             // Auto via NumberSeries "SVO-00001"
  transactionDate       DateTime             @map("transaction_date") @db.Date
  registrationDate      DateTime?            @map("registration_date") @db.Date      // Auto-set on first save
  registrationTime      String?              @map("registration_time") @db.VarChar(5)

  // Customer
  customerId            String               @map("customer_id")                     // FK to Customer
  customerName          String               @map("customer_name")                   // Denormalised snapshot
  billToCustomerId      String?              @map("bill_to_customer_id")             // Alternate billing entity

  // Addresses (JSON snapshots)
  billingAddress        Json?                @map("billing_address")                 // { line1, line2, city, county, postcode, country }
  shippingAddress       Json?                @map("shipping_address")
  serviceAddress        Json?                @map("service_address")                 // On-site service location

  // Contacts
  internalContact       String?              @map("internal_contact") @db.VarChar(100)
  customerContact       String?              @map("customer_contact") @db.VarChar(200)
  customerPhone         String?              @map("customer_phone") @db.VarChar(30)

  // Customer complaint description
  complaintDescription  String?              @map("complaint_description") @db.Text
  // Technician comments
  technicianNotes       String?              @map("technician_notes") @db.Text
  // General notes
  notes                 String?              @db.Text

  // Classification
  orderClass            String?              @map("order_class") @db.VarChar(20)     // Service order classification
  customerReference     String?              @map("customer_reference") @db.VarChar(100) // Customer's own order number
  confirmationNumber    String?              @map("confirmation_number") @db.VarChar(40)

  // Assignment
  technicianId          String?              @map("technician_id")                   // FK to User (assigned technician)
  salesPersonId         String?              @map("sales_person_id")                 // FK to User (salesperson)
  salesGroupCode        String?              @map("sales_group_code") @db.VarChar(20)

  // Service location
  serviceLocationId     String?              @map("service_location_id")             // FK to Warehouse (service workshop)

  // Scheduling
  plannedDeliveryDate   DateTime?            @map("planned_delivery_date") @db.Date

  // Financial totals
  subtotal              Decimal              @default(0) @map("subtotal") @db.Decimal(19, 4)
  vatAmount             Decimal              @default(0) @map("vat_amount") @db.Decimal(19, 4)
  totalCost             Decimal              @default(0) @map("total_cost") @db.Decimal(19, 4)
  totalPrice            Decimal              @default(0) @map("total_price") @db.Decimal(19, 4)

  // Currency
  currencyCode          String               @default("GBP") @map("currency_code") @db.VarChar(3)
  exchangeRate          Decimal              @default(1) @map("exchange_rate") @db.Decimal(10, 6)

  // Pricing
  priceListId           String?              @map("price_list_id")                   // FK to PriceList
  vatRegistrationNumber String?              @map("vat_registration_number") @db.VarChar(30)
  taxInclusive          Boolean              @default(false) @map("tax_inclusive")

  // Payment
  paymentTermsId        String?              @map("payment_terms_id")                // FK to PaymentTerms

  // Status & lifecycle
  status                ServiceOrderStatus   @default(DRAFT)

  // Audit
  createdAt             DateTime             @default(now()) @map("created_at")
  updatedAt             DateTime             @updatedAt @map("updated_at")
  createdBy             String               @map("created_by")
  updatedBy             String               @map("updated_by")

  // Relations
  lines                 ServiceOrderLine[]
  workOrders            WorkOrder[]
  workSheets            WorkSheet[]

  @@map("service_orders")
  @@index([customerId], map: "idx_service_orders_customer")
  @@index([status], map: "idx_service_orders_status")
  @@index([transactionDate], map: "idx_service_orders_date")
  @@index([technicianId], map: "idx_service_orders_technician")
  @@index([salesPersonId], map: "idx_service_orders_salesperson")
  @@index([orderClass], map: "idx_service_orders_class")
  @@index([svoNumber], map: "idx_service_orders_number")
  @@index([plannedDeliveryDate], map: "idx_service_orders_planned_delivery")
}

// ─── Service Order Line (Transactional — Row) ─

model ServiceOrderLine {
  id                    String               @id @default(uuid())
  serviceOrderId        String               @map("service_order_id")
  lineNumber            Int                  @map("line_number")                     // Sequential: 1, 2, 3...

  // Item
  itemId                String               @map("item_id")                         // FK to InventoryItem
  description           String                                                       // Defaults from Item, editable
  quantity              Decimal              @map("quantity") @db.Decimal(10, 4)

  // Pricing
  unitCost              Decimal              @default(0) @map("unit_cost") @db.Decimal(19, 4)
  unitPrice             Decimal              @default(0) @map("unit_price") @db.Decimal(19, 4)
  maxCost               Decimal?             @map("max_cost") @db.Decimal(19, 4)     // Maximum cost allowed (warranty cap)
  lineTotal             Decimal              @default(0) @map("line_total") @db.Decimal(19, 4)

  // Tax
  vatCodeId             String?              @map("vat_code_id")                     // FK to VatCode
  revenueAccountId      String?              @map("revenue_account_id")              // FK to GlAccount

  // Service classification
  itemType              ServiceLineItemType  @default(PLAIN) @map("item_type")       // Plain/Invoiceable/Warranty/Contract
  itemKind              ServiceLineItemKind  @default(MAIN_ITEM) @map("item_kind")   // Main Item or Sub-Item

  // Serial number of the item being serviced
  serialNumber          String?              @map("serial_number") @db.VarChar(100)
  secondarySerialNumber String?              @map("secondary_serial_number") @db.VarChar(100) // IMEI or alternate ID
  parentSerialNumber    String?              @map("parent_serial_number") @db.VarChar(100)    // For sub-assemblies

  // Fault coding
  faultCodeId           String?              @map("fault_code_id")                   // FK to FaultCode
  faultCodeModifierId   String?              @map("fault_code_modifier_id")          // FK to FaultCodeModifier
  diagnosticCode        String?              @map("diagnostic_code") @db.VarChar(200)

  // Linked contract
  contractId            String?              @map("contract_id")                     // FK to service contract (P2)

  // Fulfillment tracking
  quantityWorkOrdered   Decimal              @default(0) @map("quantity_work_ordered") @db.Decimal(10, 4)
  quantityInvoiced      Decimal              @default(0) @map("quantity_invoiced") @db.Decimal(10, 4)

  // Row-level scheduling
  plannedDeliveryDate   DateTime?            @map("planned_delivery_date") @db.Date

  // Dimension tags
  dimensionTags         String?              @map("dimension_tags") @db.VarChar(120)  // Cost objects

  // Audit
  createdAt             DateTime             @default(now()) @map("created_at")
  updatedAt             DateTime             @updatedAt @map("updated_at")

  // Relations
  serviceOrder          ServiceOrder         @relation(fields: [serviceOrderId], references: [id], onDelete: Cascade)

  @@map("service_order_lines")
  @@unique([serviceOrderId, lineNumber], map: "uq_service_order_lines_order_line")
  @@index([itemId], map: "idx_service_order_lines_item")
  @@index([serialNumber], map: "idx_service_order_lines_serial")
  @@index([itemType], map: "idx_service_order_lines_item_type")
  @@index([faultCodeId], map: "idx_service_order_lines_fault_code")
}

// ─── Work Order (Transactional — Technician Instructions) ─

model WorkOrder {
  id                    String               @id @default(uuid())
  woNumber              String               @unique @map("wo_number")               // Auto via NumberSeries "WO-00001"
  serviceOrderId        String               @map("service_order_id")                // FK to ServiceOrder (parent)
  transactionDate       DateTime             @map("transaction_date") @db.Date

  // Customer (denormalised from SVO)
  customerId            String               @map("customer_id")                     // FK to Customer
  customerName          String               @map("customer_name") @db.VarChar(200)
  customerContact       String?              @map("customer_contact") @db.VarChar(200)
  customerReference     String?              @map("customer_reference") @db.VarChar(100)

  // Assignment
  technicianId          String?              @map("technician_id")                   // FK to User (assigned technician/employee)
  technicianName        String?              @map("technician_name") @db.VarChar(200)

  // Scheduling
  plannedDate           DateTime?            @map("planned_date") @db.Date
  plannedWorkHours      Decimal?             @map("planned_work_hours") @db.Decimal(6, 2)

  // Instructions
  comments              String?              @db.Text

  // Status
  status                WorkOrderStatus      @default(OPEN)

  // Currency (inherited from SVO)
  currencyCode          String               @default("GBP") @map("currency_code") @db.VarChar(3)
  exchangeRate          Decimal              @default(1) @map("exchange_rate") @db.Decimal(10, 6)

  // Dimension tags
  dimensionTags         String?              @map("dimension_tags") @db.VarChar(120)

  // Audit
  createdAt             DateTime             @default(now()) @map("created_at")
  updatedAt             DateTime             @updatedAt @map("updated_at")
  createdBy             String               @map("created_by")
  updatedBy             String               @map("updated_by")

  // Relations
  serviceOrder          ServiceOrder         @relation(fields: [serviceOrderId], references: [id])
  lines                 WorkOrderLine[]
  workSheets            WorkSheet[]

  @@map("work_orders")
  @@index([serviceOrderId], map: "idx_work_orders_service_order")
  @@index([technicianId], map: "idx_work_orders_technician")
  @@index([status], map: "idx_work_orders_status")
  @@index([plannedDate], map: "idx_work_orders_planned_date")
  @@index([customerId], map: "idx_work_orders_customer")
}

model WorkOrderLine {
  id                    String               @id @default(uuid())
  workOrderId           String               @map("work_order_id")
  lineNumber            Int                  @map("line_number")

  // Item/task
  itemId                String?              @map("item_id")                         // FK to InventoryItem (spare part or service item)
  description           String                                                       // Task description or part name
  quantity              Decimal              @default(1) @map("quantity") @db.Decimal(10, 4)

  // Serial of serviced item
  serialNumber          String?              @map("serial_number") @db.VarChar(100)

  // Scheduling
  plannedWorkHours      Decimal?             @map("planned_work_hours") @db.Decimal(6, 2)

  // Classification
  itemType              ServiceLineItemType  @default(INVOICEABLE) @map("item_type")
  faultCodeId           String?              @map("fault_code_id")                   // FK to FaultCode

  // Cost limits
  maxCost               Decimal?             @map("max_cost") @db.Decimal(19, 4)

  // Dimension tags
  dimensionTags         String?              @map("dimension_tags") @db.VarChar(120)

  // Audit
  createdAt             DateTime             @default(now()) @map("created_at")
  updatedAt             DateTime             @updatedAt @map("updated_at")

  // Relations
  workOrder             WorkOrder            @relation(fields: [workOrderId], references: [id], onDelete: Cascade)

  @@map("work_order_lines")
  @@unique([workOrderId, lineNumber], map: "uq_work_order_lines_wo_line")
  @@index([itemId], map: "idx_work_order_lines_item")
}

// ─── Work Sheet (Transactional — Labour & Parts Recording) ─

model WorkSheet {
  id                    String               @id @default(uuid())
  wsNumber              String               @unique @map("ws_number")               // Auto via NumberSeries "WS-00001"
  serviceOrderId        String               @map("service_order_id")                // FK to ServiceOrder
  workOrderId           String?              @map("work_order_id")                   // FK to WorkOrder (optional, can be direct from SVO)
  transactionDate       DateTime             @map("transaction_date") @db.Date

  // Employee / technician
  technicianId          String               @map("technician_id")                   // FK to User
  technicianName        String               @map("technician_name") @db.VarChar(200)

  // Customer (denormalised)
  customerId            String               @map("customer_id")                     // FK to Customer
  customerName          String               @map("customer_name") @db.VarChar(200)

  // Status
  status                WorkSheetStatus      @default(DRAFT)

  // Financial totals
  labourTotal           Decimal              @default(0) @map("labour_total") @db.Decimal(19, 4)
  partsTotal            Decimal              @default(0) @map("parts_total") @db.Decimal(19, 4)
  totalAmount           Decimal              @default(0) @map("total_amount") @db.Decimal(19, 4)

  // Currency
  currencyCode          String               @default("GBP") @map("currency_code") @db.VarChar(3)
  exchangeRate          Decimal              @default(1) @map("exchange_rate") @db.Decimal(10, 6)

  // Service context
  serviceLocationId     String?              @map("service_location_id")             // FK to Warehouse
  priceListId           String?              @map("price_list_id")

  // Comments
  comments              String?              @db.Text

  // Dimension tags
  dimensionTags         String?              @map("dimension_tags") @db.VarChar(120)

  // Stock update
  stockUpdated          Boolean              @default(false) @map("stock_updated")   // Parts deducted from inventory

  // Audit
  createdAt             DateTime             @default(now()) @map("created_at")
  updatedAt             DateTime             @updatedAt @map("updated_at")
  createdBy             String               @map("created_by")
  updatedBy             String               @map("updated_by")

  // Relations
  serviceOrder          ServiceOrder         @relation(fields: [serviceOrderId], references: [id])
  workOrder             WorkOrder?           @relation(fields: [workOrderId], references: [id])
  lines                 WorkSheetLine[]

  @@map("work_sheets")
  @@index([serviceOrderId], map: "idx_work_sheets_service_order")
  @@index([workOrderId], map: "idx_work_sheets_work_order")
  @@index([technicianId], map: "idx_work_sheets_technician")
  @@index([status], map: "idx_work_sheets_status")
  @@index([transactionDate], map: "idx_work_sheets_date")
}

model WorkSheetLine {
  id                    String               @id @default(uuid())
  workSheetId           String               @map("work_sheet_id")
  lineNumber            Int                  @map("line_number")

  // Item (labour service item or spare part)
  itemId                String               @map("item_id")                         // FK to InventoryItem
  description           String
  quantity              Decimal              @map("quantity") @db.Decimal(10, 4)     // Hours for labour, units for parts

  // Pricing
  unitPrice             Decimal              @default(0) @map("unit_price") @db.Decimal(19, 4)
  discountPercent       Decimal              @default(0) @map("discount_percent") @db.Decimal(5, 2)
  lineTotal             Decimal              @default(0) @map("line_total") @db.Decimal(19, 4)

  // Tax
  vatCodeId             String?              @map("vat_code_id")                     // FK to VatCode
  revenueAccountId      String?              @map("revenue_account_id")              // FK to GlAccount

  // Invoicing classification
  itemType              ServiceLineItemType  @default(INVOICEABLE) @map("item_type")
  quantityInvoiced      Decimal              @default(0) @map("quantity_invoiced") @db.Decimal(10, 4)
  invoiceId             String?              @map("invoice_id")                      // FK to CustomerInvoice when invoiced

  // Serial tracking
  serialNumber          String?              @map("serial_number") @db.VarChar(100)

  // Dimension tags
  dimensionTags         String?              @map("dimension_tags") @db.VarChar(120)

  // Audit
  createdAt             DateTime             @default(now()) @map("created_at")
  updatedAt             DateTime             @updatedAt @map("updated_at")

  // Relations
  workSheet             WorkSheet            @relation(fields: [workSheetId], references: [id], onDelete: Cascade)

  @@map("work_sheet_lines")
  @@unique([workSheetId, lineNumber], map: "uq_work_sheet_lines_ws_line")
  @@index([itemId], map: "idx_work_sheet_lines_item")
  @@index([itemType], map: "idx_work_sheet_lines_item_type")
  @@index([invoiceId], map: "idx_work_sheet_lines_invoice")
}

// ─── Known Serial Number (Reference — Warranty Registry) ─

model KnownSerialNumber {
  id                    String               @id @default(uuid())

  // Identity
  serialNumber          String               @map("serial_number") @db.VarChar(100)
  secondarySerialNumber String?              @map("secondary_serial_number") @db.VarChar(100) // IMEI or alternate device ID
  itemId                String               @map("item_id")                         // FK to InventoryItem
  itemName              String               @map("item_name") @db.VarChar(200)      // Denormalised

  // Customer / Supplier provenance
  customerId            String?              @map("customer_id")                     // FK to Customer (current owner)
  customerName          String?              @map("customer_name") @db.VarChar(200)
  supplierId            String?              @map("supplier_id")                     // FK to Supplier (original vendor)

  // Sale & warranty
  soldDate              DateTime?            @map("sold_date") @db.Date
  purchaseDate          DateTime?            @map("purchase_date") @db.Date
  salesPrice            Decimal?             @map("sales_price") @db.Decimal(19, 4)
  costPrice             Decimal?             @map("cost_price") @db.Decimal(19, 4)
  warrantyStartDate     DateTime?            @map("warranty_start_date") @db.Date
  warrantyEndDate       DateTime?            @map("warranty_end_date") @db.Date
  warrantyStatus        WarrantyStatus       @default(UNKNOWN) @map("warranty_status")

  // Hierarchy (sub-assemblies)
  parentSerialNumber    String?              @map("parent_serial_number") @db.VarChar(100) // MotherNr equivalent

  // Documentation links
  imageUrl              String?              @map("image_url") @db.VarChar(500)
  manualUrl             String?              @map("manual_url") @db.VarChar(500)
  productDescription    String?              @map("product_description") @db.Text

  // Notes (replaces SVOTextVc)
  notes                 String?              @db.Text

  // Audit
  createdAt             DateTime             @default(now()) @map("created_at")
  updatedAt             DateTime             @updatedAt @map("updated_at")
  createdBy             String               @map("created_by")
  updatedBy             String               @map("updated_by")

  @@unique([serialNumber, itemId], map: "uq_known_serial_numbers_serial_item")
  @@map("known_serial_numbers")
  @@index([itemId], map: "idx_known_serial_numbers_item")
  @@index([customerId], map: "idx_known_serial_numbers_customer")
  @@index([supplierId], map: "idx_known_serial_numbers_supplier")
  @@index([warrantyStatus], map: "idx_known_serial_numbers_warranty_status")
  @@index([warrantyEndDate], map: "idx_known_serial_numbers_warranty_end")
  @@index([parentSerialNumber], map: "idx_known_serial_numbers_parent")
}

// ─── Fault Code (Reference — Structured Problem Classification) ─

model FaultCode {
  id                    String               @id @default(uuid())
  code                  String               @unique @db.VarChar(40)
  shortDescription      String               @map("short_description") @db.VarChar(200)
  longDescription       String?              @map("long_description") @db.Text
  classification        String?              @db.VarChar(100)                        // Category/grouping

  isActive              Boolean              @default(true) @map("is_active")
  createdAt             DateTime             @default(now()) @map("created_at")
  updatedAt             DateTime             @updatedAt @map("updated_at")
  createdBy             String               @map("created_by")
  updatedBy             String               @map("updated_by")

  @@map("fault_codes")
  @@index([classification], map: "idx_fault_codes_classification")
  @@index([isActive], map: "idx_fault_codes_active")
}

model FaultCodeModifier {
  id                    String               @id @default(uuid())
  code                  String               @unique @db.VarChar(40)
  description           String               @db.VarChar(200)

  isActive              Boolean              @default(true) @map("is_active")
  createdAt             DateTime             @default(now()) @map("created_at")
  updatedAt             DateTime             @updatedAt @map("updated_at")
  createdBy             String               @map("created_by")
  updatedBy             String               @map("updated_by")

  @@map("fault_code_modifiers")
}

// ─── Target Time (Reference — Expected Hours per Employee) ─

model TargetTime {
  id                    String               @id @default(uuid())
  employeeId            String               @map("employee_id")                     // FK to User
  periodStart           DateTime             @map("period_start") @db.Date           // Period start date
  periodEnd             DateTime             @map("period_end") @db.Date             // Period end date
  description           String?              @db.VarChar(200)
  totalTargetHours      Decimal              @map("total_target_hours") @db.Decimal(8, 2)

  // Audit
  createdAt             DateTime             @default(now()) @map("created_at")
  updatedAt             DateTime             @updatedAt @map("updated_at")
  createdBy             String               @map("created_by")
  updatedBy             String               @map("updated_by")

  // Relations
  lines                 TargetTimeLine[]

  @@map("target_times")
  @@unique([employeeId, periodStart], map: "uq_target_times_employee_period")
  @@index([employeeId], map: "idx_target_times_employee")
  @@index([periodStart], map: "idx_target_times_period")
}

model TargetTimeLine {
  id                    String               @id @default(uuid())
  targetTimeId          String               @map("target_time_id")
  lineNumber            Int                  @map("line_number")

  activityTypeCode      String?              @map("activity_type_code") @db.VarChar(20) // Activity type for this target
  description           String?              @db.VarChar(200)
  workingDays           Int                  @default(0) @map("working_days")
  targetHours           Decimal              @default(0) @map("target_hours") @db.Decimal(8, 2)

  // Audit
  createdAt             DateTime             @default(now()) @map("created_at")
  updatedAt             DateTime             @updatedAt @map("updated_at")

  // Relations
  targetTime            TargetTime           @relation(fields: [targetTimeId], references: [id], onDelete: Cascade)

  @@map("target_time_lines")
  @@unique([targetTimeId, lineNumber], map: "uq_target_time_lines_tt_line")
}
```

---

#### Service Order Lifecycle

```
                    ┌─────────────┐
                    │    DRAFT    │  User creates SVO with customer + lines
                    └──────┬──────┘
                           │ open()
                           ▼
                    ┌─────────────┐
                    │    OPEN     │  Ready for work order / work sheet creation
                    └──┬──────┬──┘
                       │      │
        createWorkOrder()    │  createWorkSheet() (if no WO needed)
                       │      │
                       ▼      ▼
                    ┌─────────────┐
                    │ IN_PROGRESS │  At least one WO or WS exists
                    │             │  May also transition here via direct WS creation
                    └──┬──────┬──┘
                       │      │
                       │      │ putOnHold()
                       │      ▼
                       │  ┌──────────┐
                       │  │ ON_HOLD  │  Awaiting parts, customer response, etc.
                       │  └────┬─────┘
                       │       │ resume()
                       │       ▼
                       │  (back to IN_PROGRESS)
                       │
                       │ complete() — requires all WOs closed + all WS approved
                       ▼
                    ┌─────────────┐
                    │  COMPLETED  │  All work done; ready for invoicing
                    └──────┬──────┘
                           │ createInvoice() — generates CustomerInvoice from
                           │    INVOICEABLE work sheet lines
                           ▼
                    ┌─────────────┐
                    │  INVOICED   │  Invoice(s) created. Final state.
                    └─────────────┘

  At any pre-completed state:
         cancel() ──────────────► CANCELLED
```

**Status Transition Rules (mapped from legacy DoneMark/InvFlag/WOMark/WSMark):**

| Legacy State | Legacy Fields | Nexa Status | Transition Guard |
|-------------|---------------|-------------|------------------|
| New | All flags 0/false | DRAFT | Editable. No linked records. |
| Open | DoneMark=0, WOMark=0 | OPEN | Customer validated. Lines entered. |
| In Progress | WOMark=1 or WSMark=1 | IN_PROGRESS | At least one WO or WS linked. |
| Completed | DoneMark=1 | COMPLETED | All WOs closed; all open WS approved; `CompletingServiceOrders` permission. |
| Invoiced | InvMark=1, InvFlag>0 | INVOICED | Invoice created from SVO. |
| -- | -- | CANCELLED | Only from DRAFT/OPEN. Blocked if linked WO/WS/invoices exist. |

---

#### Warranty Auto-Classification

When a serial number is entered on a `ServiceOrderLine`, the system automatically determines the `itemType`:

```
1. Look up KnownSerialNumber by serialNumber + itemId
2. If found AND warrantyEndDate >= today:
   → Set itemType = WARRANTY
   → Set maxCost from warranty terms (if applicable)
3. If found AND contractId is valid:
   → Set itemType = CONTRACT
4. If found AND warrantyEndDate < today (or no warranty):
   → Set itemType = INVOICEABLE
5. If not found:
   → Set itemType = PLAIN (user must classify manually)

For SUB_ITEM lines (itemKind = SUB_ITEM):
   → Inherit itemType from the parent MAIN_ITEM line
```

---

#### Service-to-Invoice Generation

The SVO-to-invoice operation collects all INVOICEABLE work sheet lines across all work sheets linked to the service order and generates a `CustomerInvoice` (AR module):

```
1. Pre-conditions:
   - ServiceOrder.status = COMPLETED
   - Permission: UserCanAction("SVOToInv")
   - At least one WorkSheetLine with itemType = INVOICEABLE and quantityInvoiced < quantity

2. Process:
   - Gather all eligible WorkSheetLines (INVOICEABLE, not yet fully invoiced)
   - Create CustomerInvoice with:
     - customerId from ServiceOrder (or billToCustomerId if set)
     - billingAddress from ServiceOrder
     - Each eligible WorkSheetLine becomes a CustomerInvoiceLine
   - Update WorkSheetLine.quantityInvoiced and WorkSheetLine.invoiceId
   - Update ServiceOrder.status = INVOICED

3. WARRANTY and CONTRACT lines are excluded from invoicing
   (they may generate separate supplier claims or contract usage records)
```

---

#### Service Order Operations Menu

The following operations are available from a service order record, each gated by a specific RBAC permission:

| Operation | Permission | Target | Description |
|-----------|-----------|--------|-------------|
| Create Work Order | -- | WorkOrder | Creates WO linked to SVO; copies customer, items, serial numbers |
| Create Work Sheet | DisallowWSFromSVO (inverted) | WorkSheet | Creates WS linked to SVO (or SVO+WO) |
| Create Invoice | SVOToInv | CustomerInvoice | Generates invoice from completed INVOICEABLE lines |
| Create Activity | -- | Activity | Logs CRM activity linked to SVO |
| Create Quotation | -- | SalesQuote | Creates quote from SVO (for pre-approval of repair costs) |
| Create Purchase Order | SVOToPO | PurchaseOrder | Orders spare parts needed for service |
| Create Stock Movement | SVOToSVGM | StockMovement | Records parts movement in/out of service workshop |
| Complete SVO | CompletingServiceOrders | -- | Marks SVO as completed (all WOs must be closed) |

---

#### Deletion Protection

A `ServiceOrder` cannot be deleted if any of the following linked records exist:
- Work Orders (any status)
- Work Sheets (any status)
- Invoices (any `WorkSheetLine.invoiceId` is set)
- Activities with `entityType = 'ServiceOrder'` and matching `entityId`

If deletion is attempted, the service layer returns an error listing the blocking records.

---

#### Timekeeper — Clock-In/Clock-Out via Activity Model

The Timekeeper subsystem reuses the existing `Activity` model (section 2.20) rather than creating a separate attendance register. Clock-in/out sessions are stored as Activity records with `activityType = WORK_HOURS`.

**Required enum extension** (in section 2.20 `ActivityType`):
```prisma
enum ActivityType {
  MEETING
  CALL
  EMAIL
  TODO
  NOTE
  FOLLOW_UP
  WORK_HOURS      // ← Added for Timekeeper clock-in/clock-out
  @@map("activity_type")
}
```

**Clock-In Process:**

```
POST /api/attendance/clock-in

1. Check user has Timekeeper role or AllowNoClockInOut is not set
2. Search for existing open WORK_HOURS Activity for this user today:
   - activityType = WORK_HOURS
   - assignedToId = currentUser
   - startDate = today
   - status = IN_PROGRESS
3. If open activity found → return error "Already clocked in"
4. Create new Activity:
   - activityType = WORK_HOURS
   - subject = "Clock In"
   - startDate = today
   - startTime = currentTime (HH:MM)
   - endTime = null
   - status = IN_PROGRESS
   - assignedToId = currentUser
   - entityType = "Timekeeper"
5. Return the created Activity
```

**Clock-Out Process:**

```
PUT /api/attendance/clock-out

1. Find open WORK_HOURS Activity for current user:
   - activityType = WORK_HOURS
   - assignedToId = currentUser
   - status = IN_PROGRESS
2. If no open activity → return error "Not clocked in"
3. Update the Activity:
   - endTime = currentTime (HH:MM)
   - endDate = today (may differ from startDate for overnight shifts)
   - status = COMPLETED
4. Calculate duration:
   - If endDate = startDate: duration = endTime - startTime
   - If endDate > startDate: duration = (midnight - startTime) + endTime
     (overnight shift handling)
5. Store duration in Activity.description or a computed field
6. Return the updated Activity
```

**Break Handling:**

```
POST /api/attendance/break

1. Clock out current session (same as clock-out process)
2. Immediately create new clock-in Activity
3. This produces two Activity records:
   - Session 1: startTime=09:00, endTime=12:30, status=COMPLETED
   - Session 2: startTime=12:30, endTime=null, status=IN_PROGRESS
4. Break duration is the gap between sessions (implicit, not stored)
```

**Automatic Clock-Out on Logout:**
- If user has the Timekeeper role with mandatory clock-in enforcement, the system automatically triggers clock-out when the user logs out or their session expires.

**Hours Worked Query:**
```
GET /api/attendance/hours?employeeId={id}&from={date}&to={date}

1. Query Activity records:
   - activityType = WORK_HOURS
   - assignedToId = employeeId
   - startDate between from and to
   - status = COMPLETED
2. Sum durations per day
3. Compare against TargetTime for variance:
   - actual vs target hours
   - actual vs target working days
4. Return breakdown by day with totals and variance
```

---

#### TargetTime — Expected Hours Configuration

The `TargetTime` model defines how many hours an employee is expected to work in a given period. Each `TargetTimeLine` can break the target down by activity type (e.g., 20 hours for service calls, 10 hours for administration).

**Usage:**
- HR or management creates `TargetTime` records per employee per month/period
- The hours worked report compares actual clock-in/out durations against target hours
- Variance (actual - target) is calculated per employee, per period, and optionally per activity type

---

#### Quotation Conversion Extensions

The following conversion operations act on the existing `SalesQuote` model defined in section 2.16. They are service-layer operations, not new Prisma models.

**1. Quote-to-Order (Primary Path)**

```
POST /api/sales/quotes/{id}/convert-to-order

Pre-conditions:
  - SalesQuote.status IN (DRAFT, SENT, ACCEPTED)
  - SalesQuote.convertedToOrderId IS NULL (not already converted)
  - ApprovalStatus passed (if approval workflow enabled)
  - Permission: UserCanAction("QTToOrd")

Process:
  1. Create SalesOrder from SalesQuote:
     - Copy: customerId, customerName, billToCustomerId, billingAddress,
       shippingAddress, currencyCode, exchangeRate, salesPersonId,
       salesGroupCode, priceListId, paymentTermsId, notes, customerNotes
     - Set: SalesOrder.quoteId = SalesQuote.id
     - Set: SalesOrder.orderDate = today
     - Set: SalesOrder.status = DRAFT
  2. Copy all SalesQuoteLines to SalesOrderLines:
     - Copy: itemId, description, quantity, unitPrice, discountPercent,
       lineTotal, vatCodeId, warehouseId
  3. Create DocumentLink between SalesQuote and SalesOrder
  4. Update SalesQuote:
     - Set: convertedToOrderId = newOrder.id
     - Set: status = CONVERTED
  5. Return the new SalesOrder
```

**2. Quote-to-Invoice (Direct — no order stage)**

```
POST /api/sales/quotes/{id}/convert-to-invoice

Pre-conditions:
  - SalesQuote.status IN (DRAFT, SENT, ACCEPTED)
  - Permission: UserCanAction("QTToIV")
  - DisallowInvoiceMoreThanQuoted setting enforced

Process:
  1. Create CustomerInvoice from SalesQuote:
     - Copy header fields (customer, addresses, currency, pricing)
     - Copy all SalesQuoteLines to CustomerInvoiceLines
  2. Create DocumentLink between SalesQuote and CustomerInvoice
  3. Update SalesQuote.status = CONVERTED
  4. Return the new CustomerInvoice
```

**3. Quote-to-Production-Order (Make-to-Order)**

```
POST /api/sales/quotes/{id}/convert-to-production-order

Pre-conditions:
  - SalesQuote.status IN (DRAFT, SENT, ACCEPTED)
  - At least one SalesQuoteLine references an item with a BOM/recipe
  - Permission: UserCanAction("QTToProd")

Process:
  1. For each SalesQuoteLine where Item has a BOM:
     - Create ProductionOrder with:
       - itemId from quote line
       - quantity from quote line
       - BOM exploded from item recipe
  2. Create DocumentLink between SalesQuote and ProductionOrder(s)
  3. Optionally: update SalesQuoteLine cost prices with actual
     production costs (DoUpdCstFromProdOrd pattern)
  4. Return the created ProductionOrder(s)
```

**4. Quote-to-Budget (Project Costing)**

```
POST /api/sales/quotes/{id}/convert-to-budget

Pre-conditions:
  - SalesQuote.status IN (DRAFT, SENT, ACCEPTED)
  - SalesQuote has a projectId or one is specified in the request
  - Permission: UserCanAction("QTToBudget")

Process:
  1. Create ProjectBudget from SalesQuote:
     - Copy all SalesQuoteLines as budget line items
     - Set budget amounts from quote line totals
  2. Link budget to the specified project
  3. Create DocumentLink between SalesQuote and ProjectBudget
  4. Update SalesQuote.status = ACCEPTED (Rejected = 2 equivalent)
  5. Return the new ProjectBudget
```

**Common Conversion Rules:**
- All conversions create a `DocumentLink` record for audit trail traceability (see section 2.20 Attachment/Link infrastructure).
- Currency rates are refreshed to current rates at conversion time, with the quote's original rates preserved on the quote record.
- The quote becomes immutable after conversion (status = CONVERTED). To create another order from the same requirements, duplicate the quote first.
- The `DisallowInvoiceMoreThanQuoted` setting (from `SalesModuleSetting`) prevents invoicing more quantity than was quoted across all conversions from a given quote.

---

#### Number Series Configuration

The following number series must be configured in the NumberSeries system (section 2.8) for this module:

| Series Code | Prefix | Example | Register |
|------------|--------|---------|----------|
| SVO | SVO- | SVO-00001 | ServiceOrder.svoNumber |
| WO | WO- | WO-00001 | WorkOrder.woNumber |
| WS | WS- | WS-00001 | WorkSheet.wsNumber |

These follow the same auto-increment pattern as SO-, QT-, and DN- series defined in section 2.16.

---

#### Access Control Rights

| Right | Purpose | Module |
|-------|---------|--------|
| CompletingServiceOrders | Required to set status = COMPLETED on a ServiceOrder | Service Orders |
| SVOToInv | Create CustomerInvoice from ServiceOrder | Service Orders |
| SVOToPO | Create PurchaseOrder from ServiceOrder (spare parts) | Service Orders |
| SVOToSVGM | Create StockMovement from ServiceOrder | Service Orders |
| DisallowWSFromSVO | Block WorkSheet creation from ServiceOrder (inverted logic: if set, WS creation is blocked) | Service Orders |
| QTToOrd | Convert SalesQuote to SalesOrder | Quotations |
| QTToIV | Convert SalesQuote to CustomerInvoice | Quotations |
| QTToProd | Convert SalesQuote to ProductionOrder | Quotations |
| QTToBudget | Convert SalesQuote to ProjectBudget | Quotations |

---

#### Cross-Module Integration Points

| Integration | Source Module | Target Module | Mechanism |
|-------------|-------------|---------------|-----------|
| SVO to Invoice | Service Orders | AR (section 2.15) | Service-to-invoice generation from INVOICEABLE work sheet lines |
| SVO to PO | Service Orders | Purchasing (section 2.17) | Spare parts procurement from service order lines |
| SVO to Stock | Service Orders | Inventory (section 2.14) | `StockMovement` with `sourceType = SERVICE_ORDER` for parts in/out |
| SVO to Activity | Service Orders | CRM (section 2.20) | Activity records with `entityType = 'ServiceOrder'` |
| SVO to Quote | Service Orders | Sales (section 2.16) | Create SalesQuote for repair cost pre-approval |
| Serial Lookup | Service Orders | Inventory (section 2.14) | KnownSerialNumber cross-references SerialNumber for stock status |
| Clock-In/Out | Timekeeper | CRM (section 2.20) | Activity records with `activityType = WORK_HOURS` |
| Hours Reporting | Timekeeper | HR | TargetTime compared to actual Activity durations |
| Quote to Order | Quotations | Sales (section 2.16) | SalesQuote to SalesOrder conversion |
| Quote to Invoice | Quotations | AR (section 2.15) | SalesQuote to CustomerInvoice (direct path) |
| Quote to Production | Quotations | Manufacturing | SalesQuote to ProductionOrder for BOM items |
| Quote to Budget | Quotations | Projects (P2) | SalesQuote to ProjectBudget for project costing |

---

#### Build Sequence & Dependencies

Service Orders, Timekeeper, and Quotation Extensions are targeted for **Story 9+** in the implementation roadmap. They depend on earlier modules being complete.

| Story | Scope | Dependencies |
|-------|-------|-------------|
| 9+.1 | FaultCode + FaultCodeModifier CRUD + seed data | Tier 0 complete |
| 9+.2 | KnownSerialNumber CRUD | InventoryItem (section 2.14), Customer (section 2.15) |
| 9+.3 | ServiceOrder + ServiceOrderLine CRUD + status transitions | Customer, InventoryItem, PaymentTerms, NumberSeries, VatCode |
| 9+.4 | WorkOrder + WorkOrderLine CRUD | ServiceOrder (9+.3) |
| 9+.5 | WorkSheet + WorkSheetLine CRUD + stock update on approval | ServiceOrder (9+.3), WorkOrder (9+.4), StockMovement (section 2.14) |
| 9+.6 | Service-to-invoice generation | WorkSheet (9+.5), CustomerInvoice (section 2.15) |
| 9+.7 | Warranty auto-classification (serial lookup + itemType assignment) | KnownSerialNumber (9+.2), ServiceOrderLine (9+.3) |
| 9+.8 | TargetTime + TargetTimeLine CRUD | User/Employee (Tier 0) |
| 9+.9 | Timekeeper clock-in/clock-out API (Activity-based) | Activity model (section 2.20), TargetTime (9+.8) |
| 9+.10 | Quote-to-Order conversion service | SalesQuote + SalesOrder (section 2.16) |
| 9+.11 | Quote-to-Invoice conversion service | SalesQuote (section 2.16), CustomerInvoice (section 2.15) |
| 9+.12 | Quote-to-ProductionOrder conversion service | SalesQuote (section 2.16), Manufacturing module |
| 9+.13 | Quote-to-Budget conversion service | SalesQuote (section 2.16), Projects module (P2) |
| 9+.14 | Reports: SVO status, employee time vs target, quote conversion rate | All above |

---

*End of section 2.30*

---

*End of section 2.30*

## 3. Authentication & Security

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Auth method** | JWT (access + refresh tokens) | Stateless API auth, works with database-per-tenant routing. Access token (15min), refresh token (7 days) in httpOnly cookie. |
| **Password hashing** | Argon2id | OWASP recommended, memory-hard (resistant to GPU attacks). More secure than bcrypt. |
| **MFA** | TOTP (RFC 6238) | Google Authenticator / Authy compatible. Required for ADMIN and above (NFR10). |
| **Session management** | Stateless JWT + Redis for refresh token revocation | JWT contains: userId, tenantId, role, modules[]. Redis stores refresh tokens for revocation. |
| **API security** | Helmet + CORS + rate limiting (per tenant) | Rate limit: 100 req/min per user, 5000 req/min per tenant. Failed login: 5 attempts / 15min (NFR15). |
| **Encryption** | AES-256 at rest, TLS 1.3 in transit | Per NFR8. Integration credentials encrypted with per-tenant key. |
| **CSRF** | Double-submit cookie pattern | Not needed for pure API (JWT in header), but required if using httpOnly cookies for auth. |
| **Input sanitisation** | Zod validation on all inputs + parameterised queries (Prisma) | No raw SQL. Zod validates shape and type. Prisma prevents SQL injection. |

**Auth Flow:**
1. User submits credentials → API validates against argon2 hash
2. If MFA enabled → return MFA challenge token
3. User submits TOTP code → API verifies
4. API issues: access JWT (15min, in response body) + refresh JWT (7d, httpOnly cookie)
5. Frontend stores access JWT in memory (not localStorage)
6. On 401 → frontend calls /auth/refresh with cookie → new access JWT
7. On logout → refresh token revoked in Redis

**Tenant Resolution Flow:**
1. JWT contains `tenantId` claim
2. Fastify `onRequest` hook extracts tenantId
3. TenantDatabaseManager returns cached PrismaClient for that tenant
4. Request-scoped decorator provides `request.db` (the tenant's PrismaClient)

## 4. API & Communication Patterns

### 4.1 API Design

**Decision: REST with OpenAPI (not GraphQL)**

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Style** | RESTful with resource-oriented URLs | ERP operations map naturally to resources. `/api/v1/invoices`, `/api/v1/customers/{id}/payments`. |
| **Versioning** | URL-based: `/api/v1/` | Simple, explicit. Breaking changes get new version. |
| **Documentation** | Auto-generated OpenAPI via @fastify/swagger | Route schemas (Zod → JSON Schema) auto-generate docs (NFR45). |
| **Pagination** | Cursor-based for lists | Better performance than offset for large datasets. `?cursor=xxx&limit=50`. |
| **Filtering** | Query parameters with standard operators | `?status=DRAFT&customer_id=xxx&created_after=2026-01-01`. |
| **Error format** | Standardised JSON error response | `{ error: { code: "PERIOD_LOCKED", message: "...", details: {...} } }` |

### 4.2 Event Architecture

**Decision: In-process typed event bus (for MVP monolith)**

```typescript
// Typed event definitions
interface BusinessEvents {
  'invoice.created': { invoiceId: string; customerId: string; amount: Decimal };
  'invoice.approved': { invoiceId: string; journalEntryId: string };
  'invoice.posted': { invoiceId: string };
  'payment.received': { paymentId: string; invoiceId: string; amount: Decimal };
  'stock.movement': { itemId: string; warehouseId: string; quantity: Decimal; type: string };
  'order.confirmed': { orderId: string; lineItems: OrderLine[] };
  // ... per module
}

// Type-safe event bus
class EventBus {
  emit<K extends keyof BusinessEvents>(event: K, data: BusinessEvents[K]): void;
  on<K extends keyof BusinessEvents>(event: K, handler: (data: BusinessEvents[K]) => void): void;
}
```

**Event flow on invoice approval (example):**
1. AR module: `invoice.approved` emitted
2. Finance module subscriber: Creates GL journal entry (debit AR, credit Revenue)
3. Audit module subscriber: Logs approval action
4. AI context subscriber: Updates customer context (new outstanding balance)
5. Notification subscriber: Queues email to customer (if auto-send enabled)

**Future migration path:** Replace in-process EventBus with Redis Streams or NATS when moving to distributed architecture. Event interface stays the same.

### 4.3 Real-Time Communication

**Decision: WebSockets via Socket.io for AI chat and notifications**

| Use Case | Protocol | Implementation |
|----------|----------|---------------|
| AI conversational interface | WebSocket (Socket.io) | Streaming responses from Claude API to frontend. Bi-directional for multi-turn conversations. |
| Notifications/alerts | WebSocket (Socket.io) | Real-time alerts (stock low, payment received, approval needed). |
| Data refresh | HTTP polling (React Query) | List/detail views use React Query's refetch interval (30s). Not WebSocket — simpler, sufficient for ERP. |

## 5. Frontend Architecture (Web + Mobile)

**Platform Strategy:**

| Platform | Technology | Primary Use | Target Device |
|----------|-----------|-------------|---------------|
| **Web** | Vite + React 19 | Full ERP — complex forms, data tables, reports, admin | Desktop, tablet |
| **Mobile** | React Native + Expo | AI-first — chat, briefings, approvals, scanning | Phone |
| **Shared** | `packages/api-client` + `packages/shared` | Typed API client, Zod schemas, types, constants | Both |

Both platforms are first-class citizens, not one a degraded version of the other. The mobile app is **AI-first by design** — the conversational interface IS the primary mobile experience, with one-tap approvals and push notification actions. The web app provides the full ERP power user experience.

**Push Notifications (Mobile):**
- Expo Push Notifications for approval requests, briefing alerts, stock alerts, payment received
- Actionable notifications: "Invoice INV-00042 ready for approval" → tap to approve directly
- Background: BullMQ job → Expo Push API → device

### 5.1 State Management

**Decision: TanStack Query (server state) + Zustand (client state)**

| Concern | Tool | Rationale |
|---------|------|-----------|
| Server data (CRUD) | TanStack Query (React Query) | Caching, background refetch, optimistic updates, pagination. Handles 90% of ERP state. |
| UI state | Zustand | Sidebar open/closed, active module, modal state, user preferences. Lightweight, no boilerplate. |
| Form state | React Hook Form + Zod resolver | Complex ERP forms (80+ fields for invoices). Validation, dirty tracking, field-level errors. |
| AI chat state | Zustand + WebSocket | Conversation history, streaming responses, context. |

### 5.2 Component Architecture

**Decision: Feature-based organisation with shared component library**

```
apps/web/src/
├── features/
│   ├── finance/
│   │   ├── components/     # Module-specific components
│   │   ├── hooks/          # Module-specific hooks (useJournalEntries, etc.)
│   │   ├── pages/          # Route pages
│   │   └── api.ts          # API client functions for this module
│   ├── ar/
│   ├── ap/
│   ├── sales/
│   ├── inventory/
│   ├── crm/
│   ├── hr/
│   ├── manufacturing/
│   ├── reporting/
│   └── admin/
├── components/
│   ├── ui/                 # Shadcn UI components (button, input, table, etc.)
│   ├── forms/              # Reusable form patterns (address form, line items table)
│   ├── layout/             # App shell, sidebar, header, breadcrumbs
│   ├── ai/                 # AI components: confidence indicators, briefing cards
│   ├── copilot/            # Co-Pilot drawer: chat, history, presets, input
│   └── header/             # App header: unified search/AI input, chat button
├── hooks/                  # Global hooks (useAuth, useTenant, useAI)
├── lib/                    # API client, auth helpers, formatters
└── stores/                 # Zustand stores
```

### 5.2.1 Standardised Page Templates

All screens follow one of 8 standardised page templates. Developers select the correct template and populate with module-specific content — no custom page layouts.

| Template | Component | Usage |
|----------|-----------|-------|
| T1: Entity List | `<EntityListPage>` | ~30 screens (Invoice List, Customer List, etc.) |
| T2: Record Detail | `<RecordDetailPage>` | ~30 screens (Customer Detail, Item Detail, etc.) |
| T3: Header+Lines Document | `<HeaderLinesPage>` | ~18 screens (Invoice, SO, PO, Journal, Credit Note, DN, etc.) |
| T4: Briefing | `<BriefingPage>` | 1 screen (AI briefing home) |
| T5: Board/Kanban | `<BoardPage>` | ~3 screens (CRM Pipeline, Production Schedule) |
| T6: Wizard | `<WizardPage>` | ~5 screens (Setup, Payroll Run, Month-End Close) |
| T7: Settings | `<SettingsPage>` | ~12 screens (Company/Module Settings) |
| T8: Report | `<ReportPage>` | ~15 screens (Trial Balance, Aged Debtors, P&L, etc.) |

**ActionBar component** — standardised across all record screens (T2, T3, T5, T6, T7, T8):
- **Always visible:** Primary action(s) (max 2, status-driven), Attachments (with count badge), Links (with count badge), More Actions overflow (⋯)
- **Overflow menu (⋯):** Grouped sections — Document Actions, Status Actions, Record Actions, AI Actions, History. Sections hide when no valid actions exist for current entity status.
- **Status-driven:** Only valid state machine transitions appear. Actions are hidden (not disabled) when inapplicable.

See UX Design Specification §Standardised Screen Templates for full wireframes, action bar rules, and responsive behaviour matrix.

```
apps/web/src/components/
├── templates/             # Page template components
│   ├── EntityListPage.tsx
│   ├── RecordDetailPage.tsx
│   ├── HeaderLinesPage.tsx
│   ├── BriefingPage.tsx
│   ├── BoardPage.tsx
│   ├── WizardPage.tsx
│   ├── SettingsPage.tsx
│   └── ReportPage.tsx
├── action-bar/            # ActionBar system
│   ├── ActionBar.tsx      # Main component
│   ├── OverflowMenu.tsx   # Grouped overflow dropdown
│   └── action-config.ts   # Status→actions mapping per entity type
```

### 5.3 Routing

**Decision: React Router v7 with lazy-loaded module routes**

```typescript
// Lazy-loaded per module — only loads code for active module
const financeRoutes = lazy(() => import('./features/finance/routes'));
const arRoutes = lazy(() => import('./features/ar/routes'));
// ... etc

// Module gating at route level
<Route element={<ModuleGuard module="finance" />}>
  <Route path="/finance/*" element={<Suspense><FinanceRoutes /></Suspense>} />
</Route>
```

Code splitting per module ensures users only download the code for modules they have access to.

### 5.4 Dual Interface Pattern (AI + Traditional)

Every entity has both:
1. **AI path**: User issues intent via header Search/AI input or Co-Pilot drawer → AI creates/queries via API → presents result for approval in main content area
2. **Traditional path**: Direct form/list view accessible one click from sidebar

Both paths use the same API endpoints and React Query cache. The AI components call the same API client functions.

**AI Interaction Model: Co-Pilot Dock (Concept D)**

Two connected AI entry points:
- **Header bar:** Unified "Search or Ask Nexa anything..." input (Cmd+K to focus). Handles entity search, page navigation, and AI commands. AI commands open the Co-Pilot drawer.
- **Co-Pilot drawer:** Collapsible right-side panel (380px). Contains chat conversation, chat history selector, role-based preset prompts, and text input. Drawer slides in/out; main content resizes.

AI-created records (invoices, POs, etc.) render in the **main content area** with confidence indicators — NOT inside the drawer. The drawer shows a summary and link.

```
┌───────────────────────────────────────────────────────────┐
│  [≡ Logo]  [🔍 Search or Ask Nexa...]  [💬] [🔔] [👤]       │
├──────────┬──────────────────────┬─────────────────────────┤
│ Sidebar  │  Main Content Area   │  Co-Pilot Drawer        │
│          │  (forms, lists, etc.)│  (collapsible, 380px)   │
│ -Finance │                      │                         │
│ -AR      │  ← Resizes when  →  │  Chat history selector  │
│ -AP      │    drawer opens      │  AI conversation        │
│ -Sales   │                      │  Preset prompts         │
│ -...     │                      │  Input area             │
└──────────┴──────────────────────┴─────────────────────────┘
```

See UX Design Specification §AI Interaction Model — Co-Pilot Dock for full drawer layout, behaviour rules, and responsive strategy.

```
apps/web/src/components/
├── copilot/               # Co-Pilot drawer system
│   ├── CopilotDrawer.tsx  # Main drawer container (collapse/expand)
│   ├── CopilotChat.tsx    # Conversation thread (messages, streaming)
│   ├── ChatHistory.tsx    # Previous conversations selector
│   ├── QuickPrompts.tsx   # Role-based preset prompt chips
│   └── CopilotInput.tsx   # Text input + file drop + voice
├── header/                # Header bar
│   ├── AppHeader.tsx      # Main header component
│   ├── UnifiedSearch.tsx  # Search/AI unified input (Cmd+K)
│   └── SearchResults.tsx  # Autocomplete dropdown
```

## 6. AI Infrastructure & Orchestration

The AI layer is not a chatbot bolted onto an ERP — it is a **managed AI platform** embedded in the application. Every AI interaction is traceable, versioned, auditable, and cost-tracked. The platform consists of 7 subsystems:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AI INFRASTRUCTURE                            │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  Model    │  │  Prompt  │  │  Agent   │  │  Skill   │           │
│  │ Registry  │  │ Manager  │  │ Registry │  │ Registry │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│       │              │             │              │                  │
│       └──────────────┴──────┬──────┴──────────────┘                  │
│                             │                                        │
│                    ┌────────┴────────┐                               │
│                    │  Orchestrator   │  ← Routes intent to agent     │
│                    └────────┬────────┘                               │
│                             │                                        │
│       ┌─────────────────────┼─────────────────────┐                  │
│       │                     │                     │                  │
│  ┌────┴─────┐  ┌───────────┴──────┐  ┌──────────┴───┐              │
│  │ Context  │  │   Guardrails     │  │  Tool        │              │
│  │ Engine   │  │ (approval rules) │  │  Executor    │              │
│  └──────────┘  └──────────────────┘  └──────────────┘              │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │  Observability: Conversation Log │ Feedback │ Evals │ Cost │     │
│  └──────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.1 Model Registry

Every AI model the system can use is registered with its capabilities, costs, and routing rules. This enables cost optimization (simple tasks → cheaper model) and fallback chains.

```prisma
model AiModel {
  id              String    @id @default(uuid())
  name            String    @unique                // 'claude-opus-4-6', 'claude-sonnet-4-5'
  provider        String                           // 'anthropic', 'openai', 'google', etc.
  modelId         String    @map("model_id")       // API model ID: 'claude-opus-4-6'
  displayName     String    @map("display_name")   // 'Claude Opus 4.6'
  maxInputTokens  Int       @map("max_input_tokens")
  maxOutputTokens Int       @map("max_output_tokens")
  costPerMInput   Decimal   @map("cost_per_m_input") @db.Decimal(10, 4)   // cost per 1M input tokens
  costPerMOutput  Decimal   @map("cost_per_m_output") @db.Decimal(10, 4)  // cost per 1M output tokens
  capabilities    Json      @db.JsonB              // ['tool_use', 'vision', 'long_context']
  isActive        Boolean   @default(true) @map("is_active")
  isDefault       Boolean   @default(false) @map("is_default")  // default model for new agents
  config          Json      @db.JsonB              // { temperature, topP, maxRetries, timeout }
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  fallbackModelId String?   @map("fallback_model_id")
  routingTags     String[]  @map("routing_tags")   // ['cheap', 'fast', 'reasoning', 'vision', 'standard']

  fallbackModel   AiModel?  @relation("ModelFallback", fields: [fallbackModelId], references: [id])
  fallbackedBy    AiModel[] @relation("ModelFallback")
  agents          AiAgent[]
  messages        AiMessage[]

  @@map("ai_models")
}
```

**Model routing strategy (intent-based via `routingTags`):**

Agents request capabilities (tags), not specific models. The AI Gateway resolves the best active model matching the requested tags, respecting cost constraints and preferred provider.

| Tag | Primary Model | Fallback Model | Use Case |
|-----|--------------|----------------|----------|
| `reasoning`, `complex` | Claude Opus 4.6 | Claude Sonnet 4.5 | Complex financial analysis, multi-step operations, evaluations |
| `standard`, `chat` | Claude Sonnet 4.5 | GPT-4o | Standard record creation, queries, conversational chat |
| `cheap`, `fast` | Claude Haiku 4.5 | GPT-4o-mini | Simple lookups, classification, field extraction, bulk operations |
| `structured_output` | GPT-4o | Claude Sonnet 4.5 | Tasks requiring guaranteed JSON schema output |
| `briefing` | Claude Sonnet 4.5 | GPT-4o | Daily briefing generation (async, latency less critical) |
| `vision` | Claude Sonnet 4.5 | GPT-4o | Document understanding, image analysis |

Cross-provider fallback: if Anthropic is unavailable, Claude models fall back to OpenAI equivalents and vice versa.

### 6.1b Provider Adapter Interface

Every LLM provider the system can use implements a single `LLMProvider` interface. The AI Gateway resolves which adapter to call based on the `AiModel.provider` field. Adding a new provider = one new adapter file, zero changes to the core interface or gateway logic.

**Core interface (never changes):**

```typescript
// packages/ai-gateway/src/providers/llm-provider.interface.ts

interface LLMProvider {
  readonly providerId: string;  // 'anthropic', 'openai', 'google', etc.
  complete(request: LLMRequest): Promise<LLMResponse>;
  stream(request: LLMRequest): AsyncIterable<LLMStreamChunk>;
  capabilities(): ProviderCapability[];
  validateModel(modelId: string): boolean;
  estimateTokens(messages: Message[], tools?: Tool[]): Promise<number>;
}

interface LLMRequest {
  model: string;
  messages: Message[];
  tools?: Tool[];
  maxOutputTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  providerOptions?: Record<string, unknown>;  // extensibility escape hatch
}

interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  model: string;
  provider: string;
  finishReason: 'stop' | 'tool_use' | 'max_tokens' | 'error';
  providerMetadata?: Record<string, unknown>;  // provider-specific response data
}

type ProviderCapability =
  | 'completion' | 'streaming' | 'tool_use' | 'vision'
  | 'structured_output' | 'extended_thinking' | 'long_context' | 'embeddings'
  | string;  // extensible — new capabilities don't need type changes
```

**Extensibility via `providerOptions`:** When a provider adds new features, only the adapter is updated. The core interface and AI Gateway never change. Examples:

- Anthropic extended thinking: `providerOptions: { extended_thinking: { budget_tokens: 10000 } }`
- OpenAI structured output: `providerOptions: { response_format: { type: 'json_schema', schema: {...} } }`

Provider-specific response data returns in `providerMetadata` (e.g., thinking content, parsed structured output).

**Provider Registry:**

```typescript
// packages/ai-gateway/src/providers/provider-registry.ts
class ProviderRegistry {
  private adapters = new Map<string, LLMProvider>();
  register(adapter: LLMProvider): void { ... }
  get(providerId: string): LLMProvider { ... }
  listProviders(): { id: string; capabilities: string[] }[] { ... }
}
```

**Credential Resolution (BYOK):**

Vendor keys by default. Enterprise tier tenants can optionally configure their own API keys per provider (stored encrypted in `TenantProviderCredential` in Platform DB). Resolution order: (1) tenant BYOK key if configured, (2) vendor platform key. When BYOK is used, usage is recorded for audit but not billed against the tenant's token quota.

**Fallback Chains:**

Each `AiModel` has an optional `fallbackModelId`. When the primary model fails (rate limit, 5xx, timeout >10s), the gateway retries with the fallback model. Fallback usage is recorded with `fallbackUsed: true` and `fallbackFrom` in the usage record.

**Updated AI Gateway Flow:**

```
ERP module → aiGateway.complete()
  → quota check (Platform API)
  → resolve AiModel from DB (get provider + modelId)
  → resolve credentials (vendor key OR tenant BYOK key)
  → providerRegistry.get(provider).complete(request)
  → normalize response to LLMResponse
  → usage record (with provider, model, cost, isByok, fallback info)
  → return LLMResponse
```

### 6.2 Prompt Management

Prompts are **database-stored, versioned, and parameterised**. They are NOT hardcoded in application code. This enables prompt iteration without deployments, A/B testing, and full audit trail of what the AI was told.

```prisma
model AiPrompt {
  id              String        @id @default(uuid())
  name            String        @unique              // 'invoice-creator', 'bank-matcher', 'daily-briefing'
  description     String
  category        String                             // 'record-creation', 'query', 'analysis', 'briefing', 'skill'
  systemPrompt    String        @map("system_prompt") @db.Text   // the system message
  userTemplate    String        @map("user_template") @db.Text   // user message template with {{parameters}}
  parameters      Json          @db.JsonB            // parameter definitions — see below
  outputFormat    Json?         @db.JsonB            // expected output structure (for structured output)
  activeVersion   Int           @default(1) @map("active_version")
  isActive        Boolean       @default(true) @map("is_active")
  createdBy       String        @map("created_by")
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")

  versions        AiPromptVersion[]
  agents          AiAgent[]

  @@map("ai_prompts")
}

model AiPromptVersion {
  id              String    @id @default(uuid())
  promptId        String    @map("prompt_id")
  version         Int
  systemPrompt    String    @map("system_prompt") @db.Text
  userTemplate    String    @map("user_template") @db.Text
  parameters      Json      @db.JsonB
  changeReason    String?   @map("change_reason")
  createdBy       String    @map("created_by")
  createdAt       DateTime  @default(now()) @map("created_at")

  prompt          AiPrompt  @relation(fields: [promptId], references: [id])

  @@map("ai_prompt_versions")
  @@unique([promptId, version], map: "uq_prompt_version")
}
```

**Parameter system — linking prompt placeholders to database queries:**

```typescript
// Parameter definition stored in AiPrompt.parameters JSON
interface PromptParameter {
  name: string;           // 'customer', 'overdueInvoices', 'currentPeriod'
  type: 'entity' | 'query' | 'context' | 'user_input' | 'computed';
  source: ParameterSource;
}

// How to resolve each parameter type
type ParameterSource =
  | { type: 'entity'; entityType: string; idFrom: string }        // fetch single record by ID
  | { type: 'query'; entityType: string; where: Record<string, unknown>; select: string[] }  // fetch list
  | { type: 'context'; key: string }                              // from Redis context (user prefs, recent activity)
  | { type: 'user_input'; description: string }                   // from the user's message
  | { type: 'computed'; function: string }                        // computed at runtime (e.g., 'currentDate', 'currentPeriod')
```

**Example prompt: "Invoice Creator"**
```
System: You are an invoice creation assistant for {{companyName}}.
You help create sales invoices. The customer's data and recent order
history are provided. Pre-fill all fields you can from context.
Always use the customer's default payment terms and VAT code.

User template: Create an invoice for {{customer.name}}.
Recent orders: {{recentOrders}}
Customer payment terms: {{customer.paymentTerms}}
Customer VAT registration: {{customer.vatNumber}}
User's request: {{userMessage}}

Parameters:
- customer:      { type: 'entity', entityType: 'Customer', idFrom: 'intent.customerId' }
- recentOrders:  { type: 'query', entityType: 'SalesOrder', where: { customerId: '$customer.id', status: 'CONFIRMED' }, select: ['orderNumber', 'items', 'total'] }
- companyName:   { type: 'context', key: 'tenant.companyName' }
- userMessage:   { type: 'user_input', description: 'The user message that triggered this agent' }
```

**Prompt lifecycle:** DRAFT → ACTIVE → ARCHIVED. Only one ACTIVE version per prompt at a time. Changing a prompt creates a new version; the previous remains in `ai_prompt_versions` for audit and rollback.

### 6.3 Agent Registry

An agent combines a **model + prompt + tools + guardrails** into a named, reusable unit. Agents are triggered from chat intent, UI buttons, scheduled jobs, or business events.

```prisma
model AiAgent {
  id              String        @id @default(uuid())
  name            String        @unique              // 'invoice-creator', 'bank-matcher'
  displayName     String        @map("display_name") // 'Invoice Creator', 'Bank Statement Matcher'
  description     String
  modelId         String?       @map("model_id")    // explicit model, OR use routingTags for intent-based resolution
  routingTags     String[]      @map("routing_tags") // alternative to modelId — ['cheap', 'tool_use']
  promptId        String        @map("prompt_id")
  tools           Json          @db.JsonB            // list of tool names this agent can use
  guardrails      Json          @db.JsonB            // rules for this agent — see below
  triggerConfig   Json          @db.JsonB            // how this agent is activated — see below
  maxTurns        Int           @default(10) @map("max_turns")   // max conversation turns
  isActive        Boolean       @default(true) @map("is_active")
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")

  model           AiModel?      @relation(fields: [modelId], references: [id])
  prompt          AiPrompt      @relation(fields: [promptId], references: [id])
  conversations   AiConversation[]

  @@map("ai_agents")
}
```

**Trigger configuration — how agents get activated:**

```typescript
interface AgentTriggerConfig {
  triggers: AgentTrigger[];
}

type AgentTrigger =
  | { type: 'chat_intent'; keywords: string[]; examples: string[] }     // matched from chat
  | { type: 'ui_button'; pageRoute: string; buttonId: string }          // button on a specific page
  | { type: 'schedule'; cron: string }                                  // cron schedule (e.g., briefings)
  | { type: 'event'; eventName: string }                                // triggered by business event
  | { type: 'api'; endpoint: string }                                   // direct API call
```

**Guardrail configuration:**

```typescript
interface AgentGuardrails {
  canRead: string[];           // entities this agent can query: ['customers', 'invoices', 'stock']
  canWrite: string[];          // entities this agent can create/update: ['invoices'] (empty = read-only)
  requiresApproval: boolean;   // if true, all write actions staged for user approval
  maxAmountWithoutApproval?: string;  // e.g., '10000' — auto-approve below this, require approval above
  blockedOperations: string[]; // e.g., ['delete', 'period_close'] — never allow these
  dataScope: 'own' | 'module' | 'all';  // data access scope based on user role
}
```

**Core agents (MVP):**

| Agent | Model | Trigger | Purpose |
|-------|-------|---------|---------|
| Chat Router | Sonnet | Every chat message | Intent recognition → routes to specialist agent |
| Invoice Creator | Sonnet | Chat + UI button on invoice page | Pre-fills invoices from context |
| Bank Matcher | Sonnet | Event (bank feed sync complete) | Matches transactions to invoices/bills |
| Daily Briefing | Sonnet | Schedule (cron per user) | Generates role-based daily briefings |
| Report Narrator | Sonnet | Chat + UI button on reports | Explains financial reports in plain English |
| Record Query | Haiku | Chat intent (questions) | Answers data questions ("how many overdue?") |
| Reorder Advisor | Sonnet | Event (stock below reorder point) | Suggests POs for low stock items |
| Document Processor | Sonnet | Event (email with attachment) + UI upload + mobile camera | AI document understanding → extract structured fields from financial documents (invoices, receipts, expenses, credit notes) with confidence scoring |
| View Creator | Haiku | Chat intent ("show me overdue invoices") | Creates/applies saved views from NL |
| Payroll Preparer | Opus | UI button + schedule | Reviews payroll calculations, flags exceptions |

**Orchestration flow:**

```
User message → Chat Router agent (intent recognition)
                    │
                    ├── Recognises intent: "create invoice for Acme"
                    ├── Selects agent: Invoice Creator
                    ├── Resolves parameters: fetch Customer(Acme), fetch recentOrders
                    ├── Builds prompt: system + user template with resolved params
                    ├── Calls AI Gateway with model/routing tags + prompt + tools (provider-agnostic)
                    ├── Claude returns tool_use: create_invoice({...})
                    ├── Guardrail check: requiresApproval=true → stage, don't execute
                    └── Return to user: "Here's the invoice I've prepared. [Approve] [Edit] [Cancel]"
```

### 6.4 Skill Registry

Skills are **reusable capabilities** that produce structured outputs (documents, files, analysis). They extend what agents can do beyond CRUD operations. Inspired by [Anthropic Skills](https://github.com/anthropics/skills) — each skill is a set of instructions + tools that Claude follows for a specific task.

```prisma
model AiSkill {
  id              String    @id @default(uuid())
  name            String    @unique                // 'generate-pdf-invoice', 'excel-report', 'email-drafter'
  displayName     String    @map("display_name")   // 'PDF Invoice Generator'
  description     String
  category        String                           // 'document', 'analysis', 'communication', 'financial'
  instructions    String    @db.Text               // SKILL.md content — Claude follows these
  keywords        String[]                         // trigger keywords from chat: ['pdf', 'generate invoice', 'print']
  inputSchema     Json      @db.JsonB              // Zod-compatible schema for required inputs
  outputType      String    @map("output_type")    // 'file:pdf', 'file:xlsx', 'file:csv', 'text', 'structured'
  requiredTools   String[]  @map("required_tools") // tools the skill needs: ['create_pdf', 'query_invoices']
  isActive        Boolean   @default(true) @map("is_active")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  @@map("ai_skills")
}
```

**MVP skills:**

| Skill | Category | Output | Trigger Examples |
|-------|----------|--------|-----------------|
| **PDF Invoice** | document | PDF file | "Print invoice INV-00042", "Send invoice to Acme" |
| **Excel Report** | document | XLSX file | "Export AR aging to Excel", "Download stock report" |
| **CSV Export** | document | CSV file | "Export customer list", "Download transactions" |
| **P&L Report** | financial | PDF + structured data | "Generate P&L for January", "Show profit and loss" |
| **Balance Sheet** | financial | PDF + structured data | "Generate balance sheet" |
| **VAT Return Prep** | financial | Structured data | "Prepare VAT return for Q4" |
| **Email Drafter** | communication | Email content | "Chase Acme on overdue invoice", "Send statement to BlueStar" |
| **Payslip Generator** | document | PDF file | "Generate payslips for February" |
| **BACS File** | financial | BACS file | "Generate BACS payment file for supplier run" |
| **Data Analyser** | analysis | Text + charts | "Analyse spending trends", "Compare Q1 vs Q2 revenue" |
| **Document Extractor** | document | Structured data + draft record | "Process this invoice", "Scan receipt", "Upload bill" |
| **Onboarding Checklist** | communication | Structured data | "Start onboarding for new employee Ahmed" |

**Skill execution flow:**

```
User: "Export AR aging to Excel"
  → Chat Router: intent = skill, skill = 'excel-report'
  → Skill loaded: instructions + required tools
  → Agent executes with skill instructions as additional system context
  → Tool calls: query_ar_aging() → format_excel() → save_file()
  → Returns: "Here's your AR Aging report. [Download XLSX]"
```

Skills can be **composed** — a monthly close agent might use: P&L skill + Balance Sheet skill + VAT Return skill + Email Drafter skill in sequence.

### 6.5 Context Engine

The context engine provides every AI interaction with **business awareness**. Without it, every chat message starts from zero. With it, the AI knows who you are, what you've been doing, and what's happening in the business.

```typescript
interface UserContext {
  // Identity
  user: { id: string; name: string; role: string; modules: string[] };
  tenant: { id: string; companyName: string; baseCurrency: string; vatScheme: string };

  // Recent activity (from Redis, updated on every action)
  recentEntities: { type: string; id: string; name: string; accessedAt: string }[];  // last 20 entities viewed
  recentActions: { action: string; entity: string; timestamp: string }[];             // last 50 actions

  // Business state (refreshed periodically)
  alerts: { type: string; message: string; severity: string; entityId?: string }[];   // overdue, low stock, etc.
  pendingApprovals: { type: string; count: number }[];                                 // items awaiting approval
  currentPeriod: { start: string; end: string; isLocked: boolean };

  // Preferences (from user settings)
  preferences: { briefingTime?: string; defaultModule?: string; dateFormat?: string };
}
```

Stored in **Redis** with key pattern `{tenantId}:context:{userId}`. Updated incrementally on each action (event bus subscriber). Full refresh via background job every 15 minutes.

### 6.6 Observability & Audit

Every AI interaction is logged for audit, quality measurement, cost tracking, and feedback collection.

```prisma
model AiConversation {
  id          String    @id @default(uuid())
  userId      String    @map("user_id")
  agentId     String?   @map("agent_id")         // null for general chat routed through multiple agents
  channel     String                              // 'web_chat', 'mobile_chat', 'api', 'scheduled'
  status      String    @default("active")        // 'active', 'completed', 'abandoned'
  startedAt   DateTime  @default(now()) @map("started_at")
  endedAt     DateTime? @map("ended_at")

  messages    AiMessage[]
  agent       AiAgent?  @relation(fields: [agentId], references: [id])

  @@map("ai_conversations")
  @@index([userId, startedAt], map: "idx_conversations_user_time")
}

model AiMessage {
  id              String    @id @default(uuid())
  conversationId  String    @map("conversation_id")
  role            String                          // 'user', 'assistant', 'system', 'tool'
  content         String    @db.Text              // message content
  toolCalls       Json?     @db.JsonB             // tool_use calls made
  toolResults     Json?     @db.JsonB             // tool results returned
  modelId         String?   @map("model_id")      // which model was used
  promptVersionId String?   @map("prompt_version_id")  // which prompt version
  inputTokens     Int?      @map("input_tokens")
  outputTokens    Int?      @map("output_tokens")
  latencyMs       Int?      @map("latency_ms")
  confidence      Decimal?  @db.Decimal(3, 2)     // 0.00-1.00 confidence score
  createdAt       DateTime  @default(now()) @map("created_at")

  conversation    AiConversation @relation(fields: [conversationId], references: [id])
  model           AiModel?       @relation(fields: [modelId], references: [id])
  feedback        AiFeedback?

  @@map("ai_messages")
  @@index([conversationId, createdAt], map: "idx_messages_conversation_time")
}
```

**Cost tracking (aggregated daily per tenant):**

```prisma
model AiUsage {
  id              String    @id @default(uuid())
  tenantId        String    @map("tenant_id")
  modelId         String    @map("model_id")
  agentId         String?   @map("agent_id")
  date            DateTime  @db.Date
  requestCount    Int       @default(0) @map("request_count")
  inputTokens     Int       @default(0) @map("input_tokens")
  outputTokens    Int       @default(0) @map("output_tokens")
  totalCost       Decimal   @default(0) @map("total_cost") @db.Decimal(10, 4)

  @@map("ai_usage")
  @@unique([tenantId, modelId, agentId, date], map: "uq_usage_tenant_model_agent_date")
}
```

### 6.7 Feedback & Evaluation

User feedback closes the loop — when a user edits an AI-generated record, the diff tells us what the AI got wrong. Over time, this data improves prompts.

```prisma
model AiFeedback {
  id              String    @id @default(uuid())
  messageId       String    @unique @map("message_id")
  userId          String    @map("user_id")
  rating          String                          // 'positive', 'negative', 'neutral'
  editedFields    Json?     @db.JsonB             // { field: 'amount', aiValue: '1200', userValue: '1250' }
  wasApproved     Boolean   @map("was_approved")  // did user approve without changes?
  comment         String?   @db.Text
  createdAt       DateTime  @default(now()) @map("created_at")

  message         AiMessage @relation(fields: [messageId], references: [id])

  @@map("ai_feedback")
  @@index([userId, createdAt], map: "idx_feedback_user_time")
}
```

**Eval framework (runs periodically on stored conversations):**

| Eval Type | What It Measures | Method |
|-----------|-----------------|--------|
| **Accuracy** | % of AI records approved without edits | `COUNT(wasApproved=true) / COUNT(*)` per agent |
| **Field accuracy** | Which fields get edited most | Aggregate `editedFields` across feedback records |
| **Response quality** | User satisfaction | `positive / (positive + negative)` ratio per agent |
| **Latency** | Response time by agent and model | P50, P95, P99 from `AiMessage.latencyMs` |
| **Cost efficiency** | Cost per successful action | `totalCost / approvedActions` per agent |
| **Prompt regression** | Quality change after prompt update | Compare accuracy metrics between prompt versions |
| **Hallucination rate** | AI references non-existent data | Tool result validation — did the referenced entity exist? |

**Eval results stored for trending:**

```prisma
model AiEval {
  id              String    @id @default(uuid())
  agentId         String    @map("agent_id")
  promptVersion   Int       @map("prompt_version")
  evalDate        DateTime  @map("eval_date") @db.Date
  sampleSize      Int       @map("sample_size")
  accuracy        Decimal   @db.Decimal(5, 2)     // 92.50%
  approvalRate    Decimal   @map("approval_rate") @db.Decimal(5, 2)
  avgLatencyMs    Int       @map("avg_latency_ms")
  avgCostPerAction Decimal  @map("avg_cost_per_action") @db.Decimal(10, 4)
  metrics         Json      @db.JsonB              // additional metrics
  createdAt       DateTime  @default(now()) @map("created_at")

  @@map("ai_evals")
  @@index([agentId, evalDate], map: "idx_evals_agent_date")
}
```

**Admin AI dashboard:**
- Model usage and costs per tenant (daily/monthly)
- Agent accuracy scores with trend lines
- Prompt version comparison (A vs B accuracy)
- Most-edited fields per agent (prompt improvement targets)
- Latency percentiles
- User satisfaction ratings
- Hallucination incidents

### 6.8 Daily Briefing Engine

- Background job (BullMQ) runs at configurable time per user
- Uses the "Daily Briefing" agent with Sonnet model
- Queries across modules: overdue invoices, low stock, pending approvals, upcoming deadlines
- Context engine provides role-specific data
- Generates personalised briefing using the briefing prompt
- Pushes via WebSocket notification (web) and push notification (mobile)
- Each briefing item has a one-tap action path (approve, chase, review)

### 6.9 Guardrail Architecture

```
Every AI action passes through the guardrail chain:

User request → Agent → Tool call proposed
                            │
                     ┌──────┴──────┐
                     │ Guardrail   │
                     │ Chain       │
                     │             │
                     │ 1. Permission check (does user's role allow this?)
                     │ 2. Module access check (is this module enabled?)
                     │ 3. Data scope check (can user see this entity?)
                     │ 4. Operation check (is this op blocked for this agent?)
                     │ 5. Amount check (below auto-approve threshold?)
                     │ 6. Financial safety (is this a write to financial data?)
                     │    → YES: Stage for approval, NEVER auto-execute
                     │    → NO: Execute if all other checks pass
                     └─────────────┘
                            │
                     ┌──────┴──────┐
                     │ Approved?   │
                     │ Auto / User │
                     └──────┬──────┘
                            │
                     Execute + Audit Log + AI Feedback capture
```

**Immutable rule (NFR16):** AI NEVER executes financial write operations (create/approve/post invoices, journal entries, payments, payroll) without explicit user approval. This is hardcoded in the guardrail chain, not configurable. Read operations are always allowed.

### 6.10 Document Understanding Pipeline

The document understanding pipeline transforms unstructured financial documents (purchase invoices, receipts, expense claims, credit notes) into structured ERP records. This is a core AI capability — not a simple OCR integration — because it combines visual extraction with business context matching.

**Architecture:**

```
Document Input (email attachment / web upload / mobile camera)
         │
    ┌────┴────┐
    │ Ingest  │  Validate format (PDF/JPEG/PNG/TIFF), orientation correction,
    │ Layer   │  quality check (DPI, readability), virus scan, store original
    └────┬────┘
         │
    ┌────┴────┐
    │ Extract │  AI-powered field extraction (Claude Vision / Sonnet):
    │ Layer   │  supplier name, invoice number, date, line items, amounts,
    │         │  VAT rates, payment terms, bank details, currency
    └────┬────┘  Each field gets a confidence score (0-100%)
         │
    ┌────┴────┐
    │ Match   │  Context engine lookups:
    │ Layer   │  • Match supplier by name/VAT reg/bank details → existing Supplier record
    │         │  • Match line items to InventoryItem by description/code
    │         │  • Match to open PO (if PO reference found)
    │         │  • Resolve GL accounts from supplier defaults or item category
    └────┬────┘
         │
    ┌────┴────┐
    │ Create  │  Generate draft SupplierBill or Expense record:
    │ Layer   │  • All fields populated from extraction + matching
    │         │  • Low-confidence fields flagged for review
    │         │  • Original document linked as Attachment
    └────┬────┘
         │
    User Review → Approve / Correct → Post
                       │
                  Corrections stored → improve future extraction for this supplier
```

**Prisma models:**

```prisma
model DocumentIngestion {
  id                String                @id @default(uuid())
  tenantId          String                @map("tenant_id")
  sourceType        DocumentSourceType    @map("source_type")     // EMAIL, UPLOAD, CAMERA
  sourceReference   String?               @map("source_reference") // email message-id, upload session
  originalFileName  String                @map("original_file_name")
  mimeType          String                @map("mime_type")        // application/pdf, image/jpeg, etc.
  fileSize          Int                   @map("file_size")        // bytes
  storageKey        String                @map("storage_key")      // S3/MinIO key for original file
  status            DocumentIngestionStatus @default(PENDING)
  documentType      DocumentType?         @map("document_type")    // PURCHASE_INVOICE, RECEIPT, EXPENSE, CREDIT_NOTE (detected or user-specified)
  extractionResult  Json?                 @db.JsonB @map("extraction_result")  // full extraction output with field-level confidence
  overallConfidence Decimal?              @db.Decimal(5,2) @map("overall_confidence") // 0.00-100.00
  matchedSupplierId String?              @map("matched_supplier_id")
  createdRecordType String?              @map("created_record_type") // 'SupplierBill' | 'Expense'
  createdRecordId   String?              @map("created_record_id")
  processedAt       DateTime?            @map("processed_at")
  reviewedBy        String?              @map("reviewed_by")
  reviewedAt        DateTime?            @map("reviewed_at")
  corrections       Json?                @db.JsonB                 // user corrections for learning
  createdAt         DateTime             @default(now()) @map("created_at")
  updatedAt         DateTime             @updatedAt @map("updated_at")

  attachment        Attachment?          @relation(fields: [storageKey], references: [storageKey])

  @@index([tenantId, status])
  @@index([tenantId, createdAt])
  @@index([matchedSupplierId])
  @@map("document_ingestions")
}

enum DocumentSourceType {
  EMAIL
  UPLOAD
  CAMERA
  @@map("document_source_type")
}

enum DocumentIngestionStatus {
  PENDING           // Received, awaiting processing
  PROCESSING        // AI extraction in progress
  EXTRACTED         // Fields extracted, awaiting matching
  MATCHED           // Matched to supplier/PO, draft record created
  REVIEW            // Requires user review (low confidence or new supplier)
  APPROVED          // User approved, record posted
  REJECTED          // User rejected the extraction
  FAILED            // Processing failed (unreadable, unsupported format)
  @@map("document_ingestion_status")
}

enum DocumentType {
  PURCHASE_INVOICE
  RECEIPT
  EXPENSE_CLAIM
  CREDIT_NOTE
  @@map("document_type")
}

model SupplierExtractionProfile {
  id              String    @id @default(uuid())
  tenantId        String    @map("tenant_id")
  supplierId      String    @map("supplier_id")
  fieldMappings   Json      @db.JsonB @map("field_mappings")  // learned field positions/patterns per supplier
  avgConfidence   Decimal   @db.Decimal(5,2) @map("avg_confidence")
  documentCount   Int       @default(0) @map("document_count")
  lastUpdated     DateTime  @updatedAt @map("last_updated")
  createdAt       DateTime  @default(now()) @map("created_at")

  @@unique([tenantId, supplierId])
  @@map("supplier_extraction_profiles")
}
```

**Extraction result schema (JSON stored in `extractionResult`):**

```typescript
interface DocumentExtractionResult {
  documentType: DocumentType;
  documentTypeConfidence: number;     // 0-100
  fields: {
    supplierName: ExtractedField<string>;
    invoiceNumber: ExtractedField<string>;
    invoiceDate: ExtractedField<string>;      // ISO date
    dueDate: ExtractedField<string | null>;
    currency: ExtractedField<string>;          // ISO 4217
    subtotal: ExtractedField<string>;          // Decimal as string
    vatAmount: ExtractedField<string>;
    totalAmount: ExtractedField<string>;
    paymentTerms: ExtractedField<string | null>;
    supplierVatNumber: ExtractedField<string | null>;
    bankDetails: ExtractedField<BankDetails | null>;
    poReference: ExtractedField<string | null>;
  };
  lineItems: Array<{
    description: ExtractedField<string>;
    quantity: ExtractedField<string>;
    unitPrice: ExtractedField<string>;
    vatRate: ExtractedField<string>;
    lineTotal: ExtractedField<string>;
    matchedItemId?: string;                    // if matched to InventoryItem
  }>;
}

interface ExtractedField<T> {
  value: T;
  confidence: number;     // 0-100
  source: 'extracted' | 'matched' | 'default' | 'user_corrected';
  boundingBox?: { x: number; y: number; width: number; height: number }; // pixel coords on original
}
```

**Model routing for document understanding:**

| Task | Model | Rationale |
|------|-------|-----------|
| Document type classification | Haiku 4.5 | Simple classification, fast, cheap |
| Field extraction from standard invoices | Sonnet 4.5 (Vision) | Needs visual understanding + structured output |
| Complex/multi-page document extraction | Opus 4.6 (Vision) | Multi-page, tables, handwriting |
| Supplier matching + GL account resolution | Context Engine | Database lookups, no LLM needed |
| Confidence scoring + review flagging | Business rules | Threshold-based, no LLM needed |

**Business rules:**
- Documents with overall confidence < 70% are auto-flagged for REVIEW
- New suppliers (no match found) always flagged for REVIEW — user must confirm or create supplier
- PO-matched invoices with amount variance > 5% flagged for REVIEW
- All approved documents create an immutable Attachment link to the original file
- User corrections update the SupplierExtractionProfile for future learning
- Maximum file size: 10MB per document
- Supported formats: PDF, JPEG, PNG, TIFF

**Phase 2 — Document Knowledge Base (FR169-FR170):**

The knowledge base extends the pipeline with vector storage for non-transactional company documents:

- Uses pgvector extension (already noted in tech stack as "pgvector potential")
- Company documents (handbooks, policies, contracts) chunked and embedded
- Employee queries via the AI chat use RAG: query → embed → vector search → context → Claude response with source citations
- Separate from the transactional document pipeline — different ingestion path, no draft record creation
- Architecture: `api/src/modules/document-knowledge/` with `embedding.service.ts`, `chunking.service.ts`, `rag.service.ts`

## 7. Infrastructure & Deployment

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Containerisation** | Docker (multi-stage builds) | Single Dockerfile per app (web, api). Multi-stage for small production images. |
| **Orchestration** | Docker Compose (local/MVP), Kubernetes (production) | Compose for local dev and single-server MVP. K8s when scaling to multiple tenants. |
| **CI/CD** | GitHub Actions | Standard, well-supported. Build → test → lint → docker build → deploy. |
| **Environments** | Local, Staging, Production | Local: Docker Compose with hot reload. Staging: mirrors production. Production: blue/green deploy. |
| **Monitoring** | Structured JSON logs + Prometheus metrics + health endpoints | Correlation IDs in every log entry. `/health` and `/ready` endpoints. Grafana dashboards. |
| **Secrets management** | Environment variables (MVP), Vault/AWS Secrets Manager (production) | Per-tenant integration credentials encrypted in DB. Application secrets in env vars. |
| **Backups** | pg_dump daily + WAL archiving for PITR | Point-in-time recovery (NFR19, NFR20). Per-tenant backup possible. |
| **Domain/TLS** | Caddy or NGINX reverse proxy + Let's Encrypt | Automatic TLS certificate management. |

**Local Development Setup (Docker Compose):**
```yaml
services:
  postgres:
    image: postgres:17
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    command: postgres -c max_connections=200
  pgbouncer:
    image: edoburu/pgbouncer:1.25.1-p0
    ports: ["6432:5432"]  # edoburu image listens on 5432 internally
    depends_on: [postgres]
    environment:
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/nexa_dev
      POOL_MODE: transaction
      MAX_CLIENT_CONN: 1000
      DEFAULT_POOL_SIZE: 20
      MIN_POOL_SIZE: 5
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  api:
    build: ./apps/api
    ports: ["3001:3001"]
    depends_on: [pgbouncer, redis]
    environment:
      DATABASE_URL: postgres://postgres:postgres@pgbouncer:5432/nexa_dev  # Via PgBouncer (listens on 5432), not direct PG
  web:
    build: ./apps/web
    ports: ["3000:3000"]
```

**Connection Architecture:**
```
App (PrismaClient per tenant) → PgBouncer (:6432, transaction pooling) → PostgreSQL (:5432)
                                     │
                                     ├── Multiplexes connections (1000 app → 20 real PG connections)
                                     ├── Transaction-mode pooling (releases connection after each txn)
                                     └── Transparent to Prisma (just a connection string change)
```

**Why PgBouncer from day 1:** Database-per-tenant means connection count scales with tenants. Without PgBouncer, 200 tenants × 5 connections = 1,000 PostgreSQL connections (server falls over). PgBouncer multiplexes this to ~20-50 real connections. Adding it later requires changing every connection string and testing under load — structural, not feature work.

## Decision Impact Analysis

**Implementation Sequence (decisions build on each other):**

1. Monorepo scaffold (Turborepo + pnpm) → foundation for everything
2. Database package (Prisma schema, PostgreSQL, Docker Compose) → data layer
3. API server (Fastify, auth, tenant routing, RBAC) → backend foundation
4. Event bus + audit trail → cross-cutting infrastructure
5. First module (Finance/GL) → proves the modular architecture
6. Frontend shell (Vite + React, routing, state management) → UI foundation
7. AI orchestration layer (Claude API, tools, WebSocket) → differentiator
8. Remaining modules (AR → AP → Sales → Purchasing → Inventory → CRM → HR → Manufacturing → Reporting)

**Cross-Component Dependencies:**

```
Prisma Schema ← defines → All Module Repositories
Event Bus ← used by → All Modules (publish) + AI Layer (subscribe)
Auth/RBAC ← gates → All API Routes + Frontend Routes
Audit Trail ← logs from → All Financial Operations + AI Actions
Tenant Routing ← provides → PrismaClient to All Requests
AI Tools ← defined by → All Modules, consumed by AI Orchestration
Zod Schemas ← shared → Frontend validation + API validation + OpenAPI
Number Series ← used by → All transactional document creation
```
