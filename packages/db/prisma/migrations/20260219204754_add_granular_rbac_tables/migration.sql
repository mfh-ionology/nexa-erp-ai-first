/*
  Warnings:

  - Added the required column `created_by` to the `exchange_rates` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_by` to the `exchange_rates` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "resource_type" AS ENUM ('PAGE', 'REPORT', 'SETTING', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "field_visibility" AS ENUM ('VISIBLE', 'READ_ONLY', 'HIDDEN');

-- DropIndex
DROP INDEX "uq_sharing_rule_no_target";

-- DropIndex
DROP INDEX "uq_user_company_role_global";

-- AlterTable
ALTER TABLE "exchange_rates" ADD COLUMN     "created_by" TEXT NOT NULL,
ADD COLUMN     "updated_by" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "resources" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "type" "resource_type" NOT NULL,
    "parent_code" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_groups" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_group_permissions" (
    "id" TEXT NOT NULL,
    "access_group_id" TEXT NOT NULL,
    "resource_code" TEXT NOT NULL,
    "can_access" BOOLEAN NOT NULL DEFAULT false,
    "can_new" BOOLEAN NOT NULL DEFAULT false,
    "can_view" BOOLEAN NOT NULL DEFAULT false,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_group_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_group_field_overrides" (
    "id" TEXT NOT NULL,
    "access_group_id" TEXT NOT NULL,
    "resource_code" TEXT NOT NULL,
    "field_path" TEXT NOT NULL,
    "visibility" "field_visibility" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_group_field_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_access_groups" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_group_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "assigned_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_access_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resources_code_key" ON "resources"("code");

-- CreateIndex
CREATE INDEX "idx_resources_module_sort" ON "resources"("module", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "uq_access_groups_company_code" ON "access_groups"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_access_group_permissions" ON "access_group_permissions"("access_group_id", "resource_code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_access_group_field_overrides" ON "access_group_field_overrides"("access_group_id", "resource_code", "field_path");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_access_groups" ON "user_access_groups"("user_id", "access_group_id", "company_id");

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_parent_code_fkey" FOREIGN KEY ("parent_code") REFERENCES "resources"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_groups" ADD CONSTRAINT "access_groups_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_group_permissions" ADD CONSTRAINT "access_group_permissions_access_group_id_fkey" FOREIGN KEY ("access_group_id") REFERENCES "access_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_group_permissions" ADD CONSTRAINT "access_group_permissions_resource_code_fkey" FOREIGN KEY ("resource_code") REFERENCES "resources"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_group_field_overrides" ADD CONSTRAINT "access_group_field_overrides_access_group_id_fkey" FOREIGN KEY ("access_group_id") REFERENCES "access_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_group_field_overrides" ADD CONSTRAINT "access_group_field_overrides_resource_code_fkey" FOREIGN KEY ("resource_code") REFERENCES "resources"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_access_groups" ADD CONSTRAINT "user_access_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_access_groups" ADD CONSTRAINT "user_access_groups_access_group_id_fkey" FOREIGN KEY ("access_group_id") REFERENCES "access_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_access_groups" ADD CONSTRAINT "user_access_groups_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
