-- CreateEnum
CREATE TYPE "mobile_nav_style" AS ENUM ('CLASSIC_TABS', 'MINIMAL', 'MY_SHORTCUTS');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mobile_nav_style" "mobile_nav_style" NOT NULL DEFAULT 'CLASSIC_TABS';

-- CreateTable
CREATE TABLE "user_favourite_pages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "path" VARCHAR(255) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "icon_key" VARCHAR(50) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_favourite_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_favourite_pages_user_id_company_id_display_order_idx" ON "user_favourite_pages"("user_id", "company_id", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "user_favourite_pages_user_id_company_id_path_key" ON "user_favourite_pages"("user_id", "company_id", "path");

-- AddForeignKey
ALTER TABLE "user_favourite_pages" ADD CONSTRAINT "user_favourite_pages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favourite_pages" ADD CONSTRAINT "user_favourite_pages_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
