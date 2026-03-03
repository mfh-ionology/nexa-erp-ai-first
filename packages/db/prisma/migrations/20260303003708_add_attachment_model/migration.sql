-- DropIndex (Prisma drift handling — raw SQL indexes that Prisma cannot model)
DROP INDEX IF EXISTS "idx_ai_memories_embedding";
DROP INDEX IF EXISTS "idx_ai_memories_search_vector";
DROP INDEX IF EXISTS "uq_ai_usage_tenant_model_date_no_agent";
DROP INDEX IF EXISTS "uq_sharing_rule_no_target";
DROP INDEX IF EXISTS "idx_saved_views_default";
DROP INDEX IF EXISTS "idx_saved_views_favourite";
DROP INDEX IF EXISTS "uq_user_company_role_global";

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" TEXT NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "storage_bucket" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "uploaded_by" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_attachments_entity" ON "attachments"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_attachments_uploaded_by" ON "attachments"("uploaded_by");

-- Re-create raw SQL indexes that Prisma cannot model (partial indexes, pgvector, tsvector)
CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_company_role_global" ON "user_company_roles" ("user_id") WHERE "company_id" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "uq_sharing_rule_no_target" ON "register_sharing_rules" ("entity_type", "source_company_id") WHERE "target_company_id" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "uq_ai_usage_tenant_model_date_no_agent" ON "ai_usage" ("tenant_id", "model_id", "date") WHERE "agent_id" IS NULL;
CREATE INDEX IF NOT EXISTS idx_saved_views_favourite ON saved_views (company_id, created_by) WHERE is_favourite = true;
CREATE INDEX IF NOT EXISTS idx_saved_views_default ON saved_views (company_id, data_view_id) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_ai_memories_embedding ON ai_memories USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_ai_memories_search_vector ON ai_memories USING gin (search_vector);
