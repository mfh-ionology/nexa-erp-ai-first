-- E5b-2: Skills Registry, Tool Framework & Dynamic Context Assembly
-- IMPORTANT: Column renames use ALTER TABLE RENAME COLUMN to preserve existing data.
-- Prisma would drop+recreate, which destroys data.

-- Step 1: Rename existing columns on ai_skills (data-preserving)
ALTER TABLE "ai_skills" RENAME COLUMN "instructions" TO "skill_content";
ALTER TABLE "ai_skills" RENAME COLUMN "keywords" TO "trigger_phrases";

-- Step 2: Add new columns to ai_skills
ALTER TABLE "ai_skills" ADD COLUMN "module_key" TEXT;
ALTER TABLE "ai_skills" ADD COLUMN "pack_key" TEXT;
ALTER TABLE "ai_skills" ADD COLUMN "negative_triggers" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ai_skills" ADD COLUMN "context_required" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ai_skills" ADD COLUMN "orchestration_pattern" TEXT;
ALTER TABLE "ai_skills" ADD COLUMN "parameters" JSONB;
ALTER TABLE "ai_skills" ADD COLUMN "examples" JSONB;
ALTER TABLE "ai_skills" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "ai_skills" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Step 3: Add index on ai_skills for module lookups
CREATE INDEX "idx_ai_skills_module" ON "ai_skills"("module_key", "is_active");

-- Step 4: Create ai_skill_contexts table
CREATE TABLE "ai_skill_contexts" (
    "id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "context_key" VARCHAR(255) NOT NULL,
    "context_query" TEXT NOT NULL,
    "token_budget" INTEGER NOT NULL DEFAULT 500,
    "cache_ttl_seconds" INTEGER NOT NULL DEFAULT 300,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_skill_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_skill_contexts_skill" ON "ai_skill_contexts"("skill_id");

-- AddForeignKey
ALTER TABLE "ai_skill_contexts" ADD CONSTRAINT "ai_skill_contexts_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "ai_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Create ai_module_knowledge table
CREATE TABLE "ai_module_knowledge" (
    "id" TEXT NOT NULL,
    "module_key" TEXT NOT NULL,
    "knowledge_type" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "content" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_module_knowledge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_module_knowledge" ON "ai_module_knowledge"("module_key", "knowledge_type", "is_active");

-- Step 6: Create ai_skill_overrides table
CREATE TABLE "ai_skill_overrides" (
    "id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "is_active" BOOLEAN,
    "trigger_phrases_override" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priority_override" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_skill_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_skill_override" ON "ai_skill_overrides"("skill_id", "company_id");

-- AddForeignKeys
ALTER TABLE "ai_skill_overrides" ADD CONSTRAINT "ai_skill_overrides_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "ai_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_skill_overrides" ADD CONSTRAINT "ai_skill_overrides_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 7: Create ai_entity_triggers table
CREATE TABLE "ai_entity_triggers" (
    "id" TEXT NOT NULL,
    "module_key" TEXT NOT NULL,
    "trigger_word" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "search_endpoint" TEXT NOT NULL,
    "display_field" TEXT NOT NULL,
    "subtitle_field" TEXT,
    "scope_by" TEXT,
    "icon" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_entity_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX "uq_entity_trigger" ON "ai_entity_triggers"("module_key", "trigger_word");
CREATE INDEX "idx_entity_triggers_active" ON "ai_entity_triggers"("is_active");

-- Re-create partial indexes that Prisma drops during diffing (cannot express WHERE in schema)
-- These were originally created in prior migrations and must be preserved.
