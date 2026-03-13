/*
  Warnings:

  - The old unique constraint on [company_id, entity_type] has been replaced with
    two partial unique indexes to support date-range sub-ranges while preserving
    the one-default-per-entity-type constraint.

*/
-- DropIndex
DROP INDEX "uq_number_series_company_entity";

-- AlterTable
ALTER TABLE "number_series" ADD COLUMN     "sub_range_prefix" TEXT,
ADD COLUMN     "valid_from" TIMESTAMP(3),
ADD COLUMN     "valid_to" TIMESTAMP(3);

-- Partial unique index: enforce one default (null valid_from) series per company+entityType.
-- PostgreSQL treats NULLs as distinct in regular unique indexes, so a standard index on
-- (company_id, entity_type, valid_from) would allow multiple rows with NULL valid_from.
CREATE UNIQUE INDEX "uq_number_series_company_entity_default" ON "number_series"("company_id", "entity_type") WHERE "valid_from" IS NULL;

-- Partial unique index: enforce one series per company+entityType+validFrom for date-range sub-ranges.
CREATE UNIQUE INDEX "uq_number_series_company_entity_range" ON "number_series"("company_id", "entity_type", "valid_from") WHERE "valid_from" IS NOT NULL;
