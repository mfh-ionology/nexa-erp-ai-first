-- CreateTable
CREATE TABLE "bank_reconciliation_rules" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "match_type" VARCHAR(20) NOT NULL,
    "match_pattern" TEXT NOT NULL,
    "target_account_code" VARCHAR(20) NOT NULL,
    "description" TEXT,
    "vat_code" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "bank_reconciliation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bank_reconciliation_rules_company_id_idx" ON "bank_reconciliation_rules"("company_id");
