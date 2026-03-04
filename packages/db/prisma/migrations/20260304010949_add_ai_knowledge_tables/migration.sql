-- CreateTable
CREATE TABLE "ai_knowledge_articles" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "source_ref" TEXT,
    "confidence_score" DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    "is_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_knowledge_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_knowledge_chunks" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "token_count" INTEGER NOT NULL,
    "embedding" vector(1536),
    "search_vector" tsvector,

    CONSTRAINT "ai_knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_training_examples" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "skill_key" TEXT,
    "input_text" TEXT NOT NULL,
    "output_text" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_training_examples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_correction_log" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conversation_id" TEXT,
    "message_id" TEXT,
    "skill_key" TEXT,
    "original_response" TEXT NOT NULL,
    "corrected_response" TEXT NOT NULL,
    "correction_type" TEXT NOT NULL,
    "was_auto_resolved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_correction_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_learning_signals" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "skill_key" TEXT NOT NULL,
    "signal_date" DATE NOT NULL,
    "total_queries" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "correction_count" INTEGER NOT NULL DEFAULT 0,
    "avg_confidence" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_learning_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_ai_knowledge_articles_company_category_active" ON "ai_knowledge_articles"("company_id", "category", "is_active");

-- CreateIndex
CREATE INDEX "idx_ai_knowledge_articles_company_source" ON "ai_knowledge_articles"("company_id", "source");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ai_knowledge_chunks_article_chunk_index" ON "ai_knowledge_chunks"("article_id", "chunk_index");

-- CreateIndex
CREATE INDEX "idx_ai_training_examples_company_skill_active" ON "ai_training_examples"("company_id", "skill_key", "is_active");

-- CreateIndex
CREATE INDEX "idx_ai_correction_log_company_correction_type" ON "ai_correction_log"("company_id", "correction_type");

-- CreateIndex
CREATE INDEX "idx_ai_correction_log_company_skill" ON "ai_correction_log"("company_id", "skill_key");

-- CreateIndex
CREATE INDEX "idx_ai_correction_log_created_at" ON "ai_correction_log"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ai_learning_signals_company_skill_date" ON "ai_learning_signals"("company_id", "skill_key", "signal_date");

-- AddForeignKey
ALTER TABLE "ai_knowledge_articles" ADD CONSTRAINT "ai_knowledge_articles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_knowledge_articles" ADD CONSTRAINT "ai_knowledge_articles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_knowledge_chunks" ADD CONSTRAINT "ai_knowledge_chunks_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "ai_knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_training_examples" ADD CONSTRAINT "ai_training_examples_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_training_examples" ADD CONSTRAINT "ai_training_examples_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_correction_log" ADD CONSTRAINT "ai_correction_log_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_correction_log" ADD CONSTRAINT "ai_correction_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_learning_signals" ADD CONSTRAINT "ai_learning_signals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ==========================================================================
-- Raw SQL: pgvector HNSW index for approximate nearest-neighbour search
-- ==========================================================================
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding ON ai_knowledge_chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ==========================================================================
-- Raw SQL: GIN index for full-text keyword search on tsvector
-- ==========================================================================
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_search_vector ON ai_knowledge_chunks
  USING gin (search_vector);

-- ==========================================================================
-- Raw SQL: Auto-update trigger for search_vector column
-- ==========================================================================
CREATE OR REPLACE FUNCTION ai_knowledge_chunks_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', NEW.content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ai_knowledge_chunks_search_vector_trigger ON ai_knowledge_chunks;
CREATE TRIGGER ai_knowledge_chunks_search_vector_trigger
  BEFORE INSERT OR UPDATE OF content ON ai_knowledge_chunks
  FOR EACH ROW EXECUTE FUNCTION ai_knowledge_chunks_search_vector_update();
