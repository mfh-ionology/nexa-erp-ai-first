-- CreateEnum
CREATE TYPE "record_link_type" AS ENUM ('CREATED_FROM', 'FULFILLS', 'PAYMENT_FOR', 'CREDIT_FOR', 'RELATES_TO', 'PARENT_CHILD');

-- CreateTable
CREATE TABLE "record_links" (
    "id" TEXT NOT NULL,
    "source_entity_type" VARCHAR(100) NOT NULL,
    "source_entity_id" TEXT NOT NULL,
    "target_entity_type" VARCHAR(100) NOT NULL,
    "target_entity_id" TEXT NOT NULL,
    "link_type" "record_link_type" NOT NULL,
    "is_system_generated" BOOLEAN NOT NULL DEFAULT false,
    "description" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "record_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_record_links_source" ON "record_links"("source_entity_type", "source_entity_id");

-- CreateIndex
CREATE INDEX "idx_record_links_target" ON "record_links"("target_entity_type", "target_entity_id");

-- CreateIndex
CREATE INDEX "idx_record_links_link_type" ON "record_links"("link_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_record_links_source_target_type" ON "record_links"("source_entity_type", "source_entity_id", "target_entity_type", "target_entity_id", "link_type");
