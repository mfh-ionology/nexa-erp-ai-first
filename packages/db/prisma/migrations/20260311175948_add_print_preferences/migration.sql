-- CreateEnum
CREATE TYPE "print_action" AS ENUM ('AUTO_DOWNLOAD', 'BROWSER_PRINT', 'NONE');

-- CreateTable
CREATE TABLE "print_preferences" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "document_type" "document_type" NOT NULL,
    "action" "print_action" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "print_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_print_preferences_company_user" ON "print_preferences"("company_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_print_preferences_company_user_doctype" ON "print_preferences"("company_id", "user_id", "document_type");

-- AddForeignKey
ALTER TABLE "print_preferences" ADD CONSTRAINT "print_preferences_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_preferences" ADD CONSTRAINT "print_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
