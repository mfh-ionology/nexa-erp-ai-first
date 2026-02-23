-- CreateEnum
CREATE TYPE "field_visibility" AS ENUM ('VISIBLE', 'READ_ONLY', 'HIDDEN');

-- DropIndex
DROP INDEX "uq_sharing_rule_no_target";

-- DropIndex
DROP INDEX "uq_user_company_role_global";

-- CreateTable
CREATE TABLE "access_groups" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
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
    "resource_code" VARCHAR(100) NOT NULL,
    "can_access" BOOLEAN NOT NULL DEFAULT false,
    "can_new" BOOLEAN NOT NULL DEFAULT false,
    "can_view" BOOLEAN NOT NULL DEFAULT false,
    "can_edit" BOOLEAN NOT NULL DEFAULT false,
    "can_delete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "access_group_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_group_field_overrides" (
    "id" TEXT NOT NULL,
    "access_group_id" TEXT NOT NULL,
    "resource_code" VARCHAR(100) NOT NULL,
    "field_path" VARCHAR(255) NOT NULL,
    "visibility" "field_visibility" NOT NULL,

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
CREATE INDEX "idx_access_groups_company_active" ON "access_groups"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_access_groups_company_code" ON "access_groups"("company_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_access_group_permissions_group_resource" ON "access_group_permissions"("access_group_id", "resource_code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_access_group_field_overrides_group_resource_field" ON "access_group_field_overrides"("access_group_id", "resource_code", "field_path");

-- CreateIndex
CREATE INDEX "idx_user_access_groups_user_company" ON "user_access_groups"("user_id", "company_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_access_groups_user_group_company" ON "user_access_groups"("user_id", "access_group_id", "company_id");

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

-- Re-create partial unique indexes (Prisma cannot represent WHERE clauses in schema,
-- so they get dropped on every migration and must be re-added as raw SQL)
CREATE UNIQUE INDEX "uq_sharing_rule_no_target" ON "register_sharing_rules" ("entity_type", "source_company_id") WHERE "target_company_id" IS NULL;
CREATE UNIQUE INDEX "uq_user_company_role_global" ON "user_company_roles" ("user_id") WHERE "company_id" IS NULL;
