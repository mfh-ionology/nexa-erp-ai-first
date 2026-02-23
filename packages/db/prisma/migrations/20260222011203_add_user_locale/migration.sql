-- DropIndex
DROP INDEX "uq_sharing_rule_no_target";

-- DropIndex
DROP INDEX "uq_user_company_role_global";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "locale" VARCHAR(10) NOT NULL DEFAULT 'en';

-- Re-create partial unique indexes (PostgreSQL WHERE clauses not expressible in Prisma schema)
CREATE UNIQUE INDEX "uq_sharing_rule_no_target" ON "register_sharing_rules" ("entity_type", "source_company_id") WHERE "target_company_id" IS NULL;
CREATE UNIQUE INDEX "uq_user_company_role_global" ON "user_company_roles" ("user_id") WHERE "company_id" IS NULL;
