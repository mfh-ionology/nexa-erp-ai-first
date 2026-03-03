# Production Schema Status — ep-mute-mode-... (app.nexaai.co.uk)

**Date:** 2025-01-27 19:15:00  
**Database:** Production Neon cluster (ep-mute-mode-abgfrh1w-pooler.eu-west-2.aws.neon.tech)  
**Prisma Version:** 6.16.2  
**Schema File:** `apps/web/prisma/schema.prisma`

## Current Status

### Migration Status

```bash
pnpm dlx prisma@6.16.2 migrate status
```

**Result:** ✅ "Database schema is up to date!"  
**Migrations Found:** 9 migrations in `prisma/migrations/`  
**All migrations marked as applied:** Yes

### Schema Mismatch Analysis

**Issue Identified:** Production database uses **snake_case** column names, while `schema.prisma` expects **camelCase** column names.

**Key Mismatches:**

1. **AIProfile table:**
   - Production: `user_id`, `tenant_id`, `answer_style`, `experience_level`, `created_at`, `updated_at`
   - Schema expects: `userId`, `tenantId`, `answerStyle`, `experienceLevel`, `createdAt`, `updatedAt`
   - Missing `@map` directives in schema.prisma

2. **TenantIntegrationConfig table:**
   - Production: `tenant_id`, `accounting_provider`, `crm_provider`, `connection_status`, `last_sync_at`, `created_at`, `updated_at`
   - Schema expects: `tenantId`, `accountingProvider`, `crmProvider`, `connectionStatus`, `lastSyncAt`, `createdAt`, `updatedAt`
   - Missing `@map` directives in schema.prisma

3. **Index/Constraint Names:**
   - Production: `AIProfile_user_id_key`, `TenantIntegrationConfig_tenant_id_key`
   - Schema expects: `AIProfile_userId_key`, `TenantIntegrationConfig_tenantId_key`

### Schema Diff Summary

**Total operations in diff:** ~154 operations

**Operations include:**
- Drop foreign keys (many tables)
- Drop indexes (snake_case naming)
- Drop columns (snake_case)
- Add columns (camelCase)
- Create indexes (camelCase naming)
- Drop and recreate some tables (chat, DMS models)

**Critical Issue:** The diff includes DROP TABLE operations for:
- `chat_call_session`
- `chat_channel`
- `chat_membership`
- `chat_message`
- `chat_workspace`
- `document`
- `document_attachment`
- `document_version`
- `signature_event`
- `signature_request`

These tables may contain production data and should NOT be dropped.

## Root Cause

The migrations were created with snake_case column names (see `20250101000000_task_b_external_plumbing/migration.sql`), but `schema.prisma` was later updated to use camelCase without `@map` directives. This creates a mismatch between:
- What migrations created (snake_case)
- What schema.prisma expects (camelCase)
- What production database has (snake_case from migrations)

## Strategy Selection

**Chosen Strategy: Case C — Schema is significantly different**

**Reasoning:**
1. Production has snake_case columns from original migrations
2. Schema.prisma expects camelCase columns without @map directives
3. Need to create a safe migration that renames columns/indexes without data loss
4. Need to handle chat/DMS tables carefully (may have production data)

**Plan:**
1. Generate migration diff using `prisma migrate diff`
2. Edit the migration SQL to:
   - Replace DROP COLUMN + ADD COLUMN with ALTER TABLE ... RENAME COLUMN
   - Replace DROP INDEX + CREATE INDEX with ALTER INDEX ... RENAME TO
   - Remove DROP TABLE operations for chat/DMS tables (keep existing structure)
   - Ensure all operations are non-destructive
3. Create new migration: `20250127_prod_schema_sync_camelcase`
4. Apply migration using `migrate deploy`
5. Verify schema alignment

## Next Steps

1. Generate safe migration SQL
2. Review and edit migration to ensure no data loss
3. Apply migration to production
4. Verify schema alignment
5. Test write operations in production

