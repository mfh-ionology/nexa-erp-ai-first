-- CreateTable
CREATE TABLE "account_mandatory_dimensions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "chart_of_account_id" TEXT NOT NULL,
    "dimension_type_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_mandatory_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_mandatory_dimensions_company_id_idx" ON "account_mandatory_dimensions"("company_id");

-- CreateIndex
CREATE INDEX "account_mandatory_dimensions_chart_of_account_id_idx" ON "account_mandatory_dimensions"("chart_of_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_mandatory_dimensions_chart_of_account_id_dimension__key" ON "account_mandatory_dimensions"("chart_of_account_id", "dimension_type_id");

-- AddForeignKey
ALTER TABLE "account_mandatory_dimensions" ADD CONSTRAINT "account_mandatory_dimensions_chart_of_account_id_fkey" FOREIGN KEY ("chart_of_account_id") REFERENCES "chart_of_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_mandatory_dimensions" ADD CONSTRAINT "account_mandatory_dimensions_dimension_type_id_fkey" FOREIGN KEY ("dimension_type_id") REFERENCES "dimension_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
