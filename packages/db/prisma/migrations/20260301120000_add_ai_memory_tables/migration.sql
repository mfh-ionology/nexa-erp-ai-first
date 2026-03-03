-- CreateTable
CREATE TABLE "ai_memories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "importance" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    "last_accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversation_summaries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "topics" TEXT[],
    "decisions_count" INTEGER NOT NULL DEFAULT 0,
    "actions_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_conversation_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_memory_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "enabled_categories" TEXT[] DEFAULT ARRAY['PREFERENCE', 'WORKFLOW', 'ENTITY_CONTEXT', 'DECISION', 'INSTRUCTION']::TEXT[],
    "retention_days" INTEGER NOT NULL DEFAULT 365,
    "max_memories" INTEGER NOT NULL DEFAULT 500,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_memory_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_ai_memories_user_company_category" ON "ai_memories"("user_id", "company_id", "category");

-- CreateIndex
CREATE INDEX "idx_ai_memories_user_company_importance" ON "ai_memories"("user_id", "company_id", "importance" DESC);

-- CreateIndex
CREATE INDEX "idx_ai_memories_user_company_accessed" ON "ai_memories"("user_id", "company_id", "last_accessed_at");

-- CreateIndex
CREATE INDEX "idx_ai_conv_summaries_user_company_created" ON "ai_conversation_summaries"("user_id", "company_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_ai_memory_settings_user_company" ON "ai_memory_settings"("user_id", "company_id");

-- AddForeignKey
ALTER TABLE "ai_memories" ADD CONSTRAINT "ai_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_memories" ADD CONSTRAINT "ai_memories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversation_summaries" ADD CONSTRAINT "ai_conversation_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversation_summaries" ADD CONSTRAINT "ai_conversation_summaries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversation_summaries" ADD CONSTRAINT "ai_conversation_summaries_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_memory_settings" ADD CONSTRAINT "ai_memory_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_memory_settings" ADD CONSTRAINT "ai_memory_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
