-- CreateEnum (idempotent — view_scope already exists from init migration)
DO $$ BEGIN
  CREATE TYPE "view_scope" AS ENUM ('PERSONAL', 'ROLE', 'GLOBAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
CREATE TYPE "field_data_type" AS ENUM ('STRING', 'NUMBER', 'DATE', 'BOOLEAN', 'ENUM', 'CURRENCY');

-- CreateEnum
CREATE TYPE "lov_type" AS ENUM ('NONE', 'STATIC', 'GLOBAL', 'VIEW_SPECIFIC');

-- CreateEnum
CREATE TYPE "pin_position" AS ENUM ('NONE', 'LEFT', 'RIGHT');

-- CreateEnum
CREATE TYPE "filter_operator" AS ENUM ('EQUALS', 'NOT_EQUALS', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IN', 'NOT_IN', 'IS_EMPTY', 'IS_NOT_EMPTY');

-- DropIndex
DROP INDEX "uq_ai_usage_tenant_model_date_no_agent";

-- DropIndex
DROP INDEX "uq_sharing_rule_no_target";

-- DropIndex
DROP INDEX "uq_user_company_role_global";

-- CreateTable
CREATE TABLE "data_views" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "view_key" VARCHAR(50) NOT NULL,
    "view_name" VARCHAR(100) NOT NULL,
    "entity_table" VARCHAR(100) NOT NULL,
    "id_field" VARCHAR(50) NOT NULL,
    "default_sort_field" VARCHAR(50) NOT NULL,
    "default_sort_dir" VARCHAR(4) NOT NULL DEFAULT 'DESC',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL DEFAULT 'system',
    "updated_by" TEXT NOT NULL DEFAULT 'system',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_view_fields" (
    "id" TEXT NOT NULL,
    "data_view_id" TEXT NOT NULL,
    "field_key" VARCHAR(100) NOT NULL,
    "field_label" VARCHAR(100) NOT NULL,
    "field_type" "field_data_type" NOT NULL,
    "default_visible" BOOLEAN NOT NULL DEFAULT true,
    "default_order" INTEGER NOT NULL,
    "default_width" INTEGER NOT NULL DEFAULT 150,
    "sortable" BOOLEAN NOT NULL DEFAULT true,
    "filterable" BOOLEAN NOT NULL DEFAULT true,
    "advanced_filter_only" BOOLEAN NOT NULL DEFAULT false,
    "pinnable" BOOLEAN NOT NULL DEFAULT true,
    "lov_type" "lov_type" NOT NULL DEFAULT 'NONE',
    "lov_scope" VARCHAR(50),
    "lov_static_values" JSONB,
    "lov_depends_on" VARCHAR(100),
    "lov_search_min" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_view_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "date_range_presets" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "preset_key" VARCHAR(30) NOT NULL,
    "preset_name" VARCHAR(50) NOT NULL,
    "order_in_list" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "date_range_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_column_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "data_view_field_id" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "pinned" "pin_position" NOT NULL DEFAULT 'NONE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_column_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_views" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "data_view_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "group_name" VARCHAR(100) NOT NULL,
    "scope" "view_scope" NOT NULL DEFAULT 'PERSONAL',
    "role_id" TEXT,
    "created_by" TEXT NOT NULL,
    "is_favourite" BOOLEAN NOT NULL DEFAULT false,
    "favourite_order" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "filter_logic" VARCHAR(3) NOT NULL DEFAULT 'AND',
    "sort_config" JSONB NOT NULL,
    "column_config" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_view_conditions" (
    "id" TEXT NOT NULL,
    "saved_view_id" TEXT NOT NULL,
    "data_view_field_id" TEXT NOT NULL,
    "operator" "filter_operator" NOT NULL,
    "value" TEXT,
    "value_list" JSONB,
    "date_preset_id" TEXT,
    "group_id" INTEGER NOT NULL DEFAULT 0,
    "group_logic" VARCHAR(3) NOT NULL DEFAULT 'AND',
    "outer_logic" VARCHAR(3) NOT NULL DEFAULT 'AND',
    "condition_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_view_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_data_views_company_view_key" ON "data_views"("company_id", "view_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_data_view_fields_view_field_key" ON "data_view_fields"("data_view_id", "field_key");

-- CreateIndex
CREATE INDEX "idx_data_view_fields_view_order" ON "data_view_fields"("data_view_id", "default_order");

-- CreateIndex
CREATE UNIQUE INDEX "uq_date_range_presets_company_key" ON "date_range_presets"("company_id", "preset_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_column_prefs_user_field" ON "user_column_preferences"("user_id", "data_view_field_id");

-- CreateIndex
CREATE INDEX "idx_saved_views_company_view_scope" ON "saved_views"("company_id", "data_view_id", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "uq_saved_views_company_view_user_name" ON "saved_views"("company_id", "data_view_id", "created_by", "name");

-- CreateIndex
CREATE INDEX "idx_saved_view_conditions_view_order" ON "saved_view_conditions"("saved_view_id", "condition_order");

-- AddForeignKey
ALTER TABLE "data_views" ADD CONSTRAINT "data_views_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_view_fields" ADD CONSTRAINT "data_view_fields_data_view_id_fkey" FOREIGN KEY ("data_view_id") REFERENCES "data_views"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "date_range_presets" ADD CONSTRAINT "date_range_presets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_column_preferences" ADD CONSTRAINT "user_column_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_column_preferences" ADD CONSTRAINT "user_column_preferences_data_view_field_id_fkey" FOREIGN KEY ("data_view_field_id") REFERENCES "data_view_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_data_view_id_fkey" FOREIGN KEY ("data_view_id") REFERENCES "data_views"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "access_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_view_conditions" ADD CONSTRAINT "saved_view_conditions_saved_view_id_fkey" FOREIGN KEY ("saved_view_id") REFERENCES "saved_views"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_view_conditions" ADD CONSTRAINT "saved_view_conditions_data_view_field_id_fkey" FOREIGN KEY ("data_view_field_id") REFERENCES "data_view_fields"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_view_conditions" ADD CONSTRAINT "saved_view_conditions_date_preset_id_fkey" FOREIGN KEY ("date_preset_id") REFERENCES "date_range_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Re-create partial indexes dropped by Prisma (cannot express WHERE in schema)
CREATE UNIQUE INDEX "uq_sharing_rule_no_target" ON "register_sharing_rules" ("entity_type", "source_company_id") WHERE "target_company_id" IS NULL;
CREATE UNIQUE INDEX "uq_user_company_role_global" ON "user_company_roles" ("user_id") WHERE "company_id" IS NULL;
CREATE UNIQUE INDEX "uq_ai_usage_tenant_model_date_no_agent" ON "ai_usage" ("tenant_id", "model_id", "date") WHERE "agent_id" IS NULL;

-- E7.1 partial indexes for saved_views (favourites and defaults)
CREATE INDEX idx_saved_views_favourite ON saved_views (company_id, created_by) WHERE is_favourite = true;
CREATE INDEX idx_saved_views_default ON saved_views (company_id, data_view_id) WHERE is_default = true;
