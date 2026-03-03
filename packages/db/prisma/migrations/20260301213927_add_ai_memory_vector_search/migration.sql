-- pgvector extension (shared infrastructure — reused by E5b and E5d Knowledge RAG)
-- Must be created BEFORE any vector column references
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable: Add embedding (pgvector) and search_vector (tsvector) columns to ai_memories
ALTER TABLE "ai_memories" ADD COLUMN     "embedding" vector(1536),
ADD COLUMN     "search_vector" tsvector;

-- AlterTable: Add decay_half_life_days to ai_memory_settings (AC6: temporal decay)
ALTER TABLE "ai_memory_settings" ADD COLUMN     "decay_half_life_days" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "ai_skill_overrides" ALTER COLUMN "trigger_phrases_override" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ai_skills" ALTER COLUMN "negative_triggers" DROP DEFAULT,
ALTER COLUMN "context_required" DROP DEFAULT;

-- HNSW index for approximate nearest-neighbour search (pgvector cosine distance)
-- Supports hybrid search (AC4) and MMR re-ranking (AC5)
--
-- HNSW Tuning Decisions (E5b-4 Task 11):
--   m = 16 (connections per node):
--     Default starting point. Higher values (32, 64) increase recall at the cost of
--     memory and build time. At ≤10K memories per user, m=16 provides sufficient recall.
--     Increase to 32 only if recall benchmarks show degradation.
--   ef_construction = 64 (build quality):
--     Controls index build accuracy. Higher values (128, 256) improve recall but
--     slow INSERT operations. 64 is adequate for our scale; increase to 128 if
--     similarity search results show low recall on real data.
--   ef_search (runtime quality):
--     Defaults to 40 (pgvector default). Set per-session via SET hnsw.ef_search = N
--     if query-time recall needs tuning. Not set here as the default is sufficient.
--
-- Benchmark results (E5b-4 Task 11, 2026-03-01):
--   Full pipeline (RRF + temporal decay + MMR 50→20): p95 = 19ms (target: <100ms)
--   Hybrid search RRF fusion (50+50 results): p95 = 0.3ms
--   MMR re-ranking (50 candidates, 1536-dim): p95 = 23ms
--   cosineSimilarity (1536-dim): p95 = 0.002ms
--   Conclusion: m=16, ef_construction=64 meets AC10 with significant headroom.
--   No tuning required at current scale.
CREATE INDEX idx_ai_memories_embedding ON ai_memories
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- GIN index for BM25 keyword search via tsvector
CREATE INDEX idx_ai_memories_search_vector ON ai_memories
  USING gin (search_vector);

-- Auto-update trigger: keeps search_vector in sync with content on INSERT/UPDATE
-- Uses PostgreSQL trigger rather than application-level update for consistency
-- (ensures correctness even for raw SQL updates and batch operations)
CREATE OR REPLACE FUNCTION ai_memories_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', NEW.content);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_memories_search_vector_trigger
  BEFORE INSERT OR UPDATE OF content ON ai_memories
  FOR EACH ROW EXECUTE FUNCTION ai_memories_search_vector_update();

-- Backfill existing rows: populate search_vector for any rows that already exist
UPDATE ai_memories SET search_vector = to_tsvector('english', content);
