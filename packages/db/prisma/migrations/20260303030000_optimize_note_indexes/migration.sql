-- DropIndex (standalone indexes replaced by composite)
DROP INDEX IF EXISTS "idx_notes_entity";
DROP INDEX IF EXISTS "idx_notes_pinned";

-- CreateIndex (composite covering the primary query pattern: entity lookup + soft-delete filter)
CREATE INDEX "idx_notes_entity_active" ON "notes"("entity_type", "entity_id", "deleted_at");
