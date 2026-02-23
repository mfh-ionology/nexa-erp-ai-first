-- CreateEnum
CREATE TYPE "resource_type" AS ENUM ('PAGE', 'REPORT', 'SETTING', 'MAINTENANCE');

-- CreateTable
CREATE TABLE "resources" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "module" VARCHAR(50) NOT NULL,
    "type" "resource_type" NOT NULL,
    "parent_code" VARCHAR(100),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "icon" VARCHAR(100),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resources_code_key" ON "resources"("code");

-- CreateIndex
CREATE INDEX "idx_resources_module_sort" ON "resources"("module", "sort_order");

-- CreateIndex
CREATE INDEX "idx_resources_type" ON "resources"("type");

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_parent_code_fkey" FOREIGN KEY ("parent_code") REFERENCES "resources"("code") ON DELETE SET NULL ON UPDATE CASCADE;
