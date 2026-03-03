-- CreateEnum
CREATE TYPE "note_type" AS ENUM ('GENERAL', 'INTERNAL', 'CUSTOMER_VISIBLE', 'SYSTEM');

-- CreateTable
CREATE TABLE "notes" (
    "id" TEXT NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" TEXT NOT NULL,
    "note_type" "note_type" NOT NULL DEFAULT 'GENERAL',
    "classification" VARCHAR(60),
    "title" VARCHAR(200),
    "content" TEXT NOT NULL,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_notes_entity" ON "notes"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_notes_type" ON "notes"("note_type");

-- CreateIndex
CREATE INDEX "idx_notes_pinned" ON "notes"("is_pinned");
