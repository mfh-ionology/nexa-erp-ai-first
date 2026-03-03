# Nexa ERP Scale Blueprint & Partitioning Design

**Version:** 1.0  
**Date:** 2025-11-25  
**Phase:** C6  
**Status:** Design Document

---

## 1. Current Architecture (v1)

### Overview

Nexa ERP v1 operates as a single-tenant-aware application on a monolithic database architecture:

- **Primary Data Store:** Single Neon Postgres cluster (`neondb`) serving all tenants and all data domains
- **Application Layer:** Single Vercel project (`nexa-erp-reset`) hosting the Next.js application (`apps/web`)
- **ORM & Migrations:** Prisma for database access, schema management, and migrations
- **Multi-Tenancy:** Logical multi-tenancy implemented via `tenantId` foreign key in all core tables

### Critical Data Domains

All data domains currently reside in the single logical database cluster:

1. **Ledger / Finance**
   - General Ledger (GL accounts, journal entries, balances)
   - Accounts Receivable (customer invoices, payments, credit notes)
   - Accounts Payable (supplier bills, payments, credit notes)
   - Bank transactions and reconciliations
   - Tax calculations and VAT/MTD compliance
   - Financial reporting and period closes

2. **Inventory / WMS**
   - Inventory items (SKUs, variants, categories)
   - Warehouses and locations
   - Stock movements (receipts, issues, transfers, adjustments)
   - Lot/batch tracking
   - Inventory valuations and costing

3. **Manufacturing**
   - Bills of Materials (BOM)
   - Work orders and production runs
   - Material consumption and yield tracking
   - Work-in-progress (WIP) accounting

4. **Supply Chain**
   - Suppliers and vendor management
   - Purchase orders (POs)
   - Advanced Shipping Notices (ASNs)
   - Shipments and delivery tracking

5. **POS**
   - Stores and locations
   - Tills/terminals
   - POS sales transactions
   - Payment processing (cash, card, digital)

6. **CRM / Sales**
   - Leads and opportunities
   - Quotes and estimates
   - Sales orders
   - Customer relationship data

7. **Projects / PSA**
   - Projects and project hierarchies
   - Tasks and task assignments
   - Time entries
   - Expense tracking
   - Project billing and invoicing

8. **HR / Payroll**
   - Employees and employee records
   - Departments and teams
   - Payroll schedules and runs
   - Payroll transactions and payslips

9. **Workflow Engine**
   - Workflow definitions
   - Workflow instances and state
   - Approval chains and transitions

10. **Custom Fields**
    - Custom field definitions per entity type
    - Custom field values attached to records

11. **AI Logs**
    - `AIEngineLog` table tracking AI interactions and usage
    - Per-tenant AI profile data

12. **Events / Outbox**
    - Internal event tables for async processing
    - Event sourcing and audit trails

13. **DMS / E-Sign**
    - Documents and document metadata
    - Document versions
    - Document attachments (blobs)
    - Signature requests and signature events

14. **Internal Chat + Calls**
    - Chat workspaces and channels
    - Chat messages and threads
    - Call sessions and participants
    - Media attachments

15. **Reference Data**
    - Currencies (`Currency`)
    - Foreign exchange rates (`FxRate`)
    - Time zones (`TimeZoneRef`)
    - Tax regimes and rates (`TaxRegime`, `TaxRate`)

### Current Limitations

- **Single Point of Scale:** All tenants share the same database cluster, limiting horizontal scalability
- **No Data Residency Control:** All tenant data resides in a single region/cluster
- **No Hot/Cold Separation:** Historical and active data coexist in the same tables
- **No Domain Isolation:** All domains compete for the same database resources

---

## 2. Target Partitioning & Sharding Strategy

### Partition Keys

**Primary Logical Key: `tenantId`**
- All business tables include `tenantId` as a mandatory foreign key
- Partitioning decisions are made at the tenant level
- Ensures complete tenant isolation and data residency compliance

**Secondary Keys:**
- **Region:** `Tenant.region` field (e.g., "GB", "US", "EU", "APAC") determines regional routing
- **Vertical:** `Tenant.vertical` field (e.g., "healthcare", "retail", "manufacturing") may influence partition placement for vertical-specific optimizations

### Per-Domain Partitioning Strategy

#### 2.1 Ledger / Finance and Core ERP Tables

**Strategy:** Partition by tenant and region across multiple Postgres clusters or logical schemas

- **Primary Transactional Cluster:** Per-region Postgres clusters (e.g., `neondb-eu-west`, `neondb-us-east`)
- **Partitioning:** Tenants assigned to a region cluster based on `Tenant.region`
- **Tables:** All GL, AR, AP, bank, tax, and financial reporting tables
- **Co-location:** Core ERP tables (inventory, manufacturing, supply chain, POS, CRM, projects, HR) co-located with finance data for transactional consistency
- **Rationale:** Financial data requires ACID guarantees and strong consistency; co-locating related domains reduces cross-cluster joins

**Future Evolution:**
- May split into dedicated finance clusters per region if volume exceeds single-cluster capacity
- Consider read replicas for reporting workloads

#### 2.2 Events / Outbox

**Strategy:** Co-located with domain cluster or dedicated events cluster per region

**Option A (Co-located):**
- Events tables reside in the same regional cluster as the domain that generates them
- Simplifies transactional guarantees (events written in the same transaction as domain changes)

**Option B (Dedicated Events Cluster):**
- Separate events cluster per region for high-volume event streams
- Domain clusters publish events asynchronously to events cluster
- Enables independent scaling of event processing

**Recommendation:** Start with Option A (co-located), migrate to Option B if event volume becomes a bottleneck

#### 2.3 AI Logs

**Strategy:** Per-tenant per-region storage with periodic archiving

- **Hot Storage:** Recent AI logs (last 90 days) stored in regional cluster, partitioned by tenant
- **Cold Storage:** Older logs archived to cheaper storage (e.g., S3-compatible object storage or dedicated archive Postgres cluster)
- **Retention:** Configurable per tenant (default 1 year hot, 7 years cold)
- **Rationale:** AI logs are write-heavy but read-light; archiving reduces primary cluster load

#### 2.4 Chat Messages

**Strategy:** Separate logical database or cluster per region, partitioned by tenant

- **Dedicated Chat Cluster:** Per-region Postgres clusters dedicated to chat data
- **Partitioning:** Chat workspaces, channels, and messages partitioned by `tenantId`
- **Rationale:** Chat messages are high-volume, append-only, and have different access patterns than transactional ERP data
- **Separation Benefits:**
  - Independent scaling of chat infrastructure
  - Different backup/retention policies
  - Reduced impact on core ERP performance

**Tables:**
- `ChatWorkspace` (tenant-scoped)
- `ChatChannel` (tenant-scoped)
- `ChatMembership` (tenant-scoped)
- `ChatMessage` (tenant-scoped, high-volume)

#### 2.5 Call Sessions

**Strategy:** Co-located with chat cluster per region

- **Same Cluster as Chat:** Call sessions share the same regional cluster as chat messages
- **Rationale:** Calls and chat are related communication domains with similar access patterns
- **Tables:**
  - `ChatCallSession` (tenant-scoped)
  - `ChatCallParticipant` (tenant-scoped)

#### 2.6 DMS Documents and Versions

**Strategy:** Metadata in DB per tenant-region, blobs in object storage per region

- **Metadata Storage:** Document metadata (`Document`, `DocumentVersion`, `DocumentAttachment` metadata) stored in regional cluster, partitioned by tenant
- **Blob Storage:** Actual file contents stored in object storage (e.g., AWS S3, Cloudflare R2) per region
- **Rationale:** Documents can be large; separating metadata from blobs optimizes database size and enables CDN distribution
- **Object Storage Structure:**
  - Per-region buckets (e.g., `nexa-dms-eu-west`, `nexa-dms-us-east`)
  - Per-tenant prefixes within buckets (e.g., `tenant-{tenantId}/documents/{documentId}/{versionId}`)

**Tables:**
- `Document` (tenant-scoped metadata)
- `DocumentVersion` (tenant-scoped metadata)
- `DocumentAttachment` (tenant-scoped metadata)
- `SignatureRequest` (tenant-scoped)
- `SignatureEvent` (tenant-scoped)

#### 2.7 Reference Data

**Strategy:** Mostly global/shared, replicated read-only across regions

- **Global Tables:** `Currency`, `TimeZoneRef` are global reference data, replicated read-only to all regional clusters
- **Regional Variants:** `FxRate` may have regional variants (e.g., different rates per region), but still replicated
- **Tax Data:** `TaxRegime` and `TaxRate` may be global or region-specific depending on tax jurisdiction requirements
- **Replication:** Reference data updated in a central "reference" cluster, then replicated to all regional clusters via:
  - Prisma migrations applied to all clusters
  - Or: Background sync jobs that replicate changes
- **Rationale:** Reference data is read-heavy, rarely changes, and needed by all tenants; replication ensures low-latency access

### Cross-Tenant Joins

**Design Principle:** No cross-tenant joins in application queries

- **Enforcement:** All application queries must include `tenantId` in WHERE clauses
- **Exceptions:** Only admin/global queries (e.g., tenant management, system-wide analytics) may query across tenants
- **Admin Queries:** Must be explicitly marked and kept out of normal request paths
- **Cross-Tenant Reporting:** Background jobs aggregate tenant data into separate reporting tables or analytics store (e.g., data warehouse, ClickHouse) for cross-tenant analytics

---

## 3. Hot vs Cold Data Strategy

### Hot Data Definition

**Hot data** is data required for current operations, recent transactions, and active dashboards:

- **Finance:** Open invoices, unpaid bills, recent journal entries (last 2 fiscal years), active bank accounts
- **Inventory:** Current stock levels, recent movements (last 12 months), active items
- **Sales/CRM:** Open opportunities, recent quotes (last 6 months), active sales orders
- **Projects:** Active projects, recent time entries (last 12 months), open tasks
- **HR:** Active employees, recent payroll runs (last 2 years)
- **Chat:** Recent messages (last 90 days), active channels
- **Calls:** Recent call sessions (last 90 days)
- **AI Logs:** Recent AI interactions (last 90 days)
- **Workflows:** Active workflow instances, recent completions (last 6 months)
- **DMS:** Recently accessed documents (last 12 months), active signature requests

### Cold Data Definition

**Cold data** is historical data that is rarely accessed but must be retained for compliance, auditing, or reporting:

- **Finance:** Closed ledger periods older than 2 fiscal years, archived invoices/bills older than 7 years (legal retention)
- **Inventory:** Historical movements older than 12 months (unless required for lot/batch tracking)
- **Sales/CRM:** Closed opportunities older than 2 years, archived quotes older than 3 years
- **Projects:** Completed projects older than 3 years, archived time entries older than 7 years
- **HR:** Archived employee records, payroll runs older than 7 years (legal retention)
- **Chat:** Messages older than 90 days (moved to archive after retention window)
- **Calls:** Call sessions older than 90 days
- **AI Logs:** AI interactions older than 90 days (moved to archive)
- **Workflows:** Completed workflows older than 2 years
- **DMS:** Document versions older than 7 years (metadata archived, blobs remain in object storage)

### Hot Data Strategy

**Primary Partitions/Clusters:**
- Hot data remains on primary regional Postgres clusters
- Optimized for transactional workloads (indexes, connection pooling, query optimization)
- Regular backups (daily) with point-in-time recovery (PITR)

**Performance Optimizations:**
- Partitioned tables by date ranges (e.g., monthly partitions for high-volume tables)
- Indexes optimized for recent data access patterns
- Connection pooling tuned for transactional workloads

### Cold Data Strategy

**Archive Storage Options:**

1. **Archive Postgres Cluster:**
   - Separate Postgres cluster per region for archived data
   - Lower-cost instance tier (e.g., Neon's archive tier)
   - Tables prefixed with `archive_` (e.g., `archive_journal_entries_2020`)
   - Read-only access for compliance/audit queries

2. **Data Lake / Object Storage:**
   - Parquet files in S3-compatible storage per region
   - Partitioned by tenant and date
   - Queryable via analytics tools (e.g., DuckDB, BigQuery)

3. **Hybrid Approach:**
   - Recent cold data (1-3 years) in archive Postgres cluster
   - Very old data (>3 years) in data lake

**Retention Windows:**
- **Finance:** 7 years (legal requirement in many jurisdictions)
- **HR/Payroll:** 7 years (legal requirement)
- **Chat/Calls:** 90 days hot, 1 year archive, then purge (unless legal hold)
- **AI Logs:** 90 days hot, 1 year archive, then purge
- **DMS:** 7 years (legal requirement for document retention)

**Migration Process:**
- Background jobs identify cold data based on date thresholds
- Data moved to archive storage during maintenance windows
- Application queries automatically route to archive if data not found in hot storage
- Or: Explicit "archive" query mode for compliance/audit use cases

### DMS Blob Storage Strategy

**Object Storage Per Region:**
- Document blobs stored in object storage (S3/R2) per region
- Metadata remains in database (hot or archive)
- **Hot Blobs:** Frequently accessed documents in standard storage tier
- **Cold Blobs:** Documents not accessed in 12+ months moved to cheaper storage tier (e.g., S3 Glacier, R2 Archive)
- **CDN:** Frequently accessed documents cached via CDN for low-latency access

**Rationale:**
- Separates metadata queries (fast, indexed) from blob retrieval (slower, larger)
- Enables independent scaling of blob storage
- Reduces database size and backup costs

---

## 4. Regional Routing

### Tenant Routing

**Routing Key: `Tenant.region`**

Tenants are assigned to a region cluster based on the `Tenant.region` field:

- **EU-WEST:** Tenants with `region = "GB"` or `region = "EU"`
- **US-EAST:** Tenants with `region = "US"`
- **APAC:** Tenants with `region = "APAC"` or `region = "AU"`

**Default Region:** If `Tenant.region` is null or unrecognized, default to `EU-WEST`

**Tenant Assignment:**
- Set during tenant onboarding/setup
- Can be changed via admin interface (requires data migration)
- Once assigned, tenant data remains in that region (data residency requirement)

### Application Routing

**High-Level Plan:**

1. **Edge/Middleware Resolution:**
   - User authenticates via Next.js middleware
   - Session contains `tenantId`
   - Middleware resolves `tenantId → Tenant.region → target cluster`
   - Database connection pool selected based on region

2. **Connection Abstraction:**
   - Prisma Client wrapper or connection manager abstracts cluster selection
   - Application code uses standard Prisma queries
   - Connection manager routes to correct regional cluster based on `tenantId` context

3. **No Cross-Region Writes:**
   - All writes for a tenant go to the tenant's assigned region cluster
   - No synchronous cross-region writes (avoids latency and consistency issues)
   - Cross-region data sync (if needed) handled via async background jobs

**Example Flow:**
```
User Request → Middleware → Extract tenantId → Query Tenant table (cached) → 
Get Tenant.region → Select connection pool for region → Execute query on regional cluster
```

### Data Residency

**Basic Rule:** Tenant data remains in the region assigned to that tenant

- **Compliance:** Supports GDPR, CCPA, and other data residency requirements
- **No Cross-Region Data Transfer:** Tenant data never leaves the assigned region (except for explicit tenant migration)
- **Backup Storage:** Backups also stored within the same region (or approved cross-region backup locations per compliance requirements)
- **Audit:** All data access logged with region information for compliance auditing

**Exceptions:**
- Reference data (currencies, timezones) replicated globally (non-PII)
- Aggregated analytics data may be sent to a central analytics store (anonymized)

---

## 5. Migration Path from Single-Cluster to Sharded

### Phase 1 — Readiness (Current State)

**Objective:** Ensure all queries use `tenantId` as a mandatory filter and confirm no cross-tenant joins

**Tasks:**
1. ✅ **Query Audit:** Tasks B–C5 already enforced tenant scoping in seeds and key APIs
2. ✅ **Prisma Schema:** All business tables include `tenantId` foreign key
3. **Remaining Work:**
   - Audit all Prisma queries in application code to ensure `tenantId` filtering
   - Identify any admin/global queries and mark them explicitly
   - Add integration tests that simulate sharded behavior (fail if cross-tenant query detected)

**Deliverables:**
- List of all Prisma queries with tenant scoping confirmed
- List of admin/global queries (exceptions)
- Integration test suite for tenant isolation

**Timeline:** 1-2 weeks

### Phase 2 — Logical Partitioning

**Objective:** Introduce abstraction layer for multi-cluster database access

**Tasks:**
1. **Connection Abstraction:**
   - Create `DatabaseConnectionManager` that selects cluster based on `tenantId`
   - Wrap Prisma Client to route queries to correct cluster
   - Maintain connection pools per region cluster

2. **Tenant Region Assignment:**
   - Ensure `Tenant.region` field is populated for all existing tenants
   - Default existing tenants to a primary region (e.g., `EU-WEST`)
   - Add admin UI for tenant region assignment

3. **Configuration:**
   - Environment variables for regional cluster connection strings
   - Feature flag to enable/disable multi-cluster routing (start disabled)

4. **Testing:**
   - Unit tests for connection manager
   - Integration tests with multiple clusters (can use separate databases initially)

**Deliverables:**
- `DatabaseConnectionManager` implementation
- Configuration for regional clusters
- Tests passing with multi-cluster abstraction (still pointing to single cluster)

**Timeline:** 2-3 weeks

### Phase 3 — Physical Split

**Objective:** Move a subset of tenants to a second Neon cluster

**Tasks:**
1. **Create Second Cluster:**
   - Provision second Neon Postgres cluster (e.g., `neondb-us-east`)
   - Apply all Prisma migrations to new cluster
   - Seed reference data to new cluster

2. **Tenant Selection:**
   - Select pilot tenants for migration (e.g., test tenants, low-traffic tenants)
   - Update `Tenant.region` for selected tenants

3. **Data Migration:**
   - Export tenant data from original cluster
   - Import tenant data to new cluster
   - Verify data integrity

4. **Application Update:**
   - Enable multi-cluster routing feature flag
   - Route pilot tenants to new cluster
   - Monitor for issues

5. **Rollback Plan:**
   - Ability to route tenants back to original cluster if issues arise
   - Data sync jobs to keep clusters in sync during transition

**Deliverables:**
- Second cluster provisioned and migrated
- Pilot tenants running on new cluster
- Monitoring and alerting for multi-cluster setup

**Timeline:** 3-4 weeks

### Phase 4 — Roll-Out

**Objective:** Gradually move more tenants to regional clusters

**Tasks:**
1. **Gradual Migration:**
   - Migrate tenants in batches (e.g., 10% per week)
   - Prioritize by region (US tenants to US cluster, EU tenants to EU cluster)
   - Monitor performance and errors

2. **Background Jobs:**
   - Tenant re-homing jobs that migrate tenants during maintenance windows
   - Automated data sync and verification

3. **Monitoring:**
   - Per-cluster metrics (connection counts, query performance, error rates)
   - Tenant-level metrics (which cluster, migration status)

4. **Documentation:**
   - Runbooks for tenant migration
   - Troubleshooting guides for multi-cluster issues

**Deliverables:**
- All tenants migrated to appropriate regional clusters
- Automated migration tooling
- Operational runbooks

**Timeline:** 6-8 weeks (depending on tenant count)

### Phase 5 — Archival Layers

**Objective:** Introduce archive pipelines for cold data

**Tasks:**
1. **Archive Infrastructure:**
   - Provision archive Postgres clusters per region (lower-cost tiers)
   - Or: Set up data lake (S3/R2) with partitioning

2. **Archive Jobs:**
   - Background jobs that identify cold data based on date thresholds
   - Jobs that move data to archive storage
   - Jobs that update application to route archive queries

3. **Archive Query Support:**
   - Application support for querying archive data (explicit "archive" mode)
   - Or: Automatic fallback to archive if data not found in hot storage

4. **Retention Policies:**
   - Configurable retention windows per domain
   - Automated purging after retention period (unless legal hold)

**Deliverables:**
- Archive storage provisioned
- Archive jobs running
- Archive query support in application

**Timeline:** 4-6 weeks

### Migration Risks & Mitigations

**Risks:**
1. **Data Loss:** Mitigated by thorough testing, verification scripts, and rollback plans
2. **Downtime:** Mitigated by migrating during maintenance windows and using blue-green deployment
3. **Performance Degradation:** Mitigated by monitoring and gradual roll-out
4. **Cross-Tenant Queries:** Mitigated by query audit and integration tests

**Success Criteria:**
- All tenants migrated to appropriate regional clusters
- No data loss or corruption
- Performance maintained or improved
- Archive pipeline operational

---

## 6. Query Discipline & Tenant Isolation

### Principles

1. **Mandatory Tenant Filtering:**
   - All business queries must include `tenantId` in WHERE clauses
   - No exceptions for normal application code

2. **No Cross-Tenant Joins:**
   - Application code must never join data across tenants
   - All joins must be within the same tenant context

3. **Admin/Global Queries:**
   - Admin queries (tenant management, system-wide analytics) must be explicitly marked
   - Kept out of normal request paths
   - Only accessible via admin-only routes/APIs

### Current State

**Tasks B–C5 Enforcement:**
- ✅ Prisma schema enforces `tenantId` foreign keys
- ✅ Seed scripts use tenant-scoped queries
- ✅ Key APIs (auth, user management) enforce tenant scoping

**Known Exceptions (to be fixed):**
- Review all Prisma queries in application code for tenant scoping
- Identify any admin queries that query across tenants
- Mark exceptions explicitly for future refactoring

### Enforcement Options

**Future Enforcement Mechanisms:**

1. **Code Review Gates:**
   - Checklist for reviewers: "Does this query include tenantId?"
   - Automated PR comments if Prisma queries detected without tenantId

2. **Static Analysis:**
   - ESLint/TypeScript plugin that detects Prisma queries without tenantId
   - Build-time checks that fail if tenant scoping missing

3. **Integration Tests:**
   - Tests that simulate sharded behavior
   - Tests that inject multiple tenant contexts and verify isolation
   - Tests that fail if cross-tenant data is accessible

4. **Runtime Checks:**
   - Middleware that validates all Prisma queries include tenantId
   - Logging/alerting for queries that don't include tenantId (in development/staging)

5. **Prisma Client Wrapper:**
   - Custom Prisma Client wrapper that automatically injects `tenantId` into queries
   - Prevents accidental cross-tenant queries at the ORM level

**Recommended Approach:**
- Start with code review gates and integration tests
- Add static analysis as tooling matures
- Consider Prisma Client wrapper if cross-tenant queries become a recurring issue

---

## 7. Performance & Cost Considerations

### Performance Targets

- **Query Latency:** P95 < 100ms for hot data queries
- **Write Throughput:** Support 1000+ writes/second per regional cluster
- **Read Throughput:** Support 5000+ reads/second per regional cluster
- **Cross-Region Latency:** N/A (no cross-region synchronous operations)

### Cost Optimization

- **Hot Data:** Standard Postgres clusters (optimized for performance)
- **Cold Data:** Archive clusters (lower-cost tiers) or object storage
- **Reference Data:** Replicated read-only (minimal write costs)
- **DMS Blobs:** Object storage with lifecycle policies (move to cheaper tiers over time)

### Scaling Triggers

**Consider splitting clusters when:**
- Connection pool exhaustion (>80% utilization)
- Query latency degradation (P95 > 200ms)
- Storage approaching limits (>80% capacity)
- CPU/Memory consistently high (>70% utilization)

**Consider adding regions when:**
- Latency requirements not met for tenants in new geographic regions
- Data residency requirements demand new regions
- Cost optimization (e.g., moving US tenants to US region reduces cross-Atlantic latency)

---

## 8. Monitoring & Observability

### Key Metrics

**Per-Cluster Metrics:**
- Connection pool utilization
- Query latency (P50, P95, P99)
- Error rates (by error type)
- Storage utilization
- CPU/Memory usage

**Per-Tenant Metrics:**
- Assigned region/cluster
- Query volume and latency
- Data size (hot and cold)
- Migration status (if migrating)

**Cross-Cluster Metrics:**
- Replication lag (for reference data)
- Archive job success/failure rates
- Migration job success/failure rates

### Alerting

**Critical Alerts:**
- Cluster unavailable
- High error rate (>1% of queries failing)
- Storage >90% capacity
- Migration failures

**Warning Alerts:**
- Query latency degradation (P95 > 200ms)
- Connection pool >80% utilization
- Archive job failures

---

## 9. Security & Compliance

### Data Isolation

- **Tenant Isolation:** Enforced at database level via `tenantId` filtering
- **Network Isolation:** Regional clusters in separate VPCs/networks (if supported by provider)
- **Access Control:** Database credentials per cluster, rotated regularly

### Compliance

- **Data Residency:** Tenant data remains in assigned region (GDPR, CCPA compliance)
- **Audit Logging:** All data access logged with tenant and region information
- **Retention:** Configurable retention windows per domain (legal requirements)

### Backup & Disaster Recovery

- **Backups:** Per-cluster backups (daily) with PITR
- **Backup Storage:** Backups stored in same region (or approved cross-region locations)
- **Disaster Recovery:** Ability to restore clusters from backups
- **Cross-Region Replication:** Optional read replicas for disaster recovery (async)

---

## 10. Future Considerations

### Potential Enhancements

1. **Read Replicas:** Add read replicas per region for reporting workloads
2. **Caching Layer:** Redis/Memcached for frequently accessed tenant metadata
3. **GraphQL Federation:** If API evolves to GraphQL, consider federation across regions
4. **Event Sourcing:** Consider event sourcing for audit trails and cross-cluster sync
5. **Multi-Master:** Future consideration for multi-master replication (complex, high risk)

### Limitations

- **Cross-Tenant Analytics:** Requires separate analytics store (data warehouse)
- **Global Reporting:** Aggregated via background jobs, not real-time
- **Tenant Migration:** Requires downtime or complex blue-green migration

---

## Appendix A: Schema Reference

### Key Tables for Partitioning

**Core ERP (Partition by tenant, co-located with finance):**
- `tenants`, `users`
- `accounts`, `journal_entries`, `journal_lines`
- `customer_invoices`, `supplier_bills`
- `bank_transactions`, `bank_accounts`
- `inventory_items`, `warehouses`, `inventory_movements`
- `work_orders`, `boms`
- `purchase_orders`, `suppliers`
- `sales_orders`, `customers`
- `projects`, `tasks`, `time_entries`
- `employees`, `departments`, `payroll_runs`

**Chat/Calls (Separate cluster per region):**
- `chat_workspaces`, `chat_channels`, `chat_memberships`, `chat_messages`
- `chat_call_sessions`, `chat_call_participants`

**DMS (Metadata in DB, blobs in object storage):**
- `documents`, `document_versions`, `document_attachments`
- `signature_requests`, `signature_events`

**Reference Data (Global, replicated):**
- `currencies`, `fx_rates`, `time_zones`, `tax_regimes`, `tax_rates`

**Events/Outbox (Co-located or dedicated):**
- Event tables (if present in schema)

---

## Appendix B: Migration Checklist

### Pre-Migration

- [ ] All queries audited for tenant scoping
- [ ] Integration tests for tenant isolation passing
- [ ] Connection abstraction layer implemented
- [ ] Configuration for regional clusters added
- [ ] Monitoring and alerting configured

### Migration Execution

- [ ] Second cluster provisioned
- [ ] Migrations applied to new cluster
- [ ] Reference data seeded to new cluster
- [ ] Pilot tenants selected and migrated
- [ ] Application routing enabled for pilot tenants
- [ ] Monitoring confirms no issues

### Post-Migration

- [ ] All tenants migrated to appropriate regions
- [ ] Archive infrastructure provisioned
- [ ] Archive jobs running
- [ ] Documentation updated
- [ ] Runbooks created

---

**Document Status:** Complete  
**Next Steps:** Begin Phase 2 (Logical Partitioning) implementation when ready to scale

