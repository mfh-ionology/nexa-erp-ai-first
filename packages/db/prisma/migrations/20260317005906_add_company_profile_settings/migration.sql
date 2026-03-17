-- DropIndex
DROP INDEX "uq_number_series_company_entity_default";

-- DropIndex
DROP INDEX "uq_number_series_company_entity_range";

-- AlterTable
ALTER TABLE "company_profiles" ADD COLUMN     "settings" JSONB;
