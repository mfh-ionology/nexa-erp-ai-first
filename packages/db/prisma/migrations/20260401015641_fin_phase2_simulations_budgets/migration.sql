-- CreateEnum
CREATE TYPE "simulation_status" AS ENUM ('ACTIVE', 'TRANSFERRED', 'INVALID');

-- AlterTable
ALTER TABLE "budgets" ADD COLUMN     "budget_version_id" TEXT;

-- CreateTable
CREATE TABLE "simulations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "entry_number" VARCHAR(20) NOT NULL,
    "transaction_date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "status" "simulation_status" NOT NULL DEFAULT 'ACTIVE',
    "period_id" TEXT NOT NULL,
    "total_debit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_credit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "transferred_to_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "simulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_lines" (
    "id" TEXT NOT NULL,
    "simulation_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "account_code" VARCHAR(20) NOT NULL,
    "company_id" TEXT NOT NULL,
    "description" TEXT,
    "debit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "credit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "vat_code" VARCHAR(20),
    "dimension_values" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "simulation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_versions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "version_number" INTEGER NOT NULL,
    "version_name" VARCHAR(100) NOT NULL,
    "copied_from_version_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "budget_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_keys" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "pct_1" DECIMAL(7,4) NOT NULL,
    "pct_2" DECIMAL(7,4) NOT NULL,
    "pct_3" DECIMAL(7,4) NOT NULL,
    "pct_4" DECIMAL(7,4) NOT NULL,
    "pct_5" DECIMAL(7,4) NOT NULL,
    "pct_6" DECIMAL(7,4) NOT NULL,
    "pct_7" DECIMAL(7,4) NOT NULL,
    "pct_8" DECIMAL(7,4) NOT NULL,
    "pct_9" DECIMAL(7,4) NOT NULL,
    "pct_10" DECIMAL(7,4) NOT NULL,
    "pct_11" DECIMAL(7,4) NOT NULL,
    "pct_12" DECIMAL(7,4) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "budget_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_line_dimensions" (
    "id" TEXT NOT NULL,
    "budget_line_id" TEXT NOT NULL,
    "dimension_type_id" TEXT NOT NULL,
    "dimension_value_id" TEXT NOT NULL,
    "period_1" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "period_2" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "period_3" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "period_4" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "period_5" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "period_6" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "period_7" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "period_8" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "period_9" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "period_10" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "period_11" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "period_12" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_line_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "simulations_company_id_idx" ON "simulations"("company_id");

-- CreateIndex
CREATE INDEX "simulations_company_id_status_idx" ON "simulations"("company_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "simulations_company_id_entry_number_key" ON "simulations"("company_id", "entry_number");

-- CreateIndex
CREATE INDEX "simulation_lines_simulation_id_idx" ON "simulation_lines"("simulation_id");

-- CreateIndex
CREATE INDEX "simulation_lines_company_id_account_code_idx" ON "simulation_lines"("company_id", "account_code");

-- CreateIndex
CREATE INDEX "budget_versions_company_id_idx" ON "budget_versions"("company_id");

-- CreateIndex
CREATE INDEX "budget_versions_company_id_fiscal_year_idx" ON "budget_versions"("company_id", "fiscal_year");

-- CreateIndex
CREATE UNIQUE INDEX "budget_versions_company_id_fiscal_year_version_number_key" ON "budget_versions"("company_id", "fiscal_year", "version_number");

-- CreateIndex
CREATE INDEX "budget_keys_company_id_idx" ON "budget_keys"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_keys_company_id_name_key" ON "budget_keys"("company_id", "name");

-- CreateIndex
CREATE INDEX "budget_line_dimensions_budget_line_id_idx" ON "budget_line_dimensions"("budget_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_line_dimensions_budget_line_id_dimension_type_id_dim_key" ON "budget_line_dimensions"("budget_line_id", "dimension_type_id", "dimension_value_id");

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_budget_version_id_fkey" FOREIGN KEY ("budget_version_id") REFERENCES "budget_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "financial_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulations" ADD CONSTRAINT "simulations_transferred_to_id_fkey" FOREIGN KEY ("transferred_to_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_lines" ADD CONSTRAINT "simulation_lines_simulation_id_fkey" FOREIGN KEY ("simulation_id") REFERENCES "simulations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_lines" ADD CONSTRAINT "simulation_lines_company_id_account_code_fkey" FOREIGN KEY ("company_id", "account_code") REFERENCES "chart_of_accounts"("company_id", "code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "budget_versions" ADD CONSTRAINT "budget_versions_copied_from_version_id_fkey" FOREIGN KEY ("copied_from_version_id") REFERENCES "budget_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_line_dimensions" ADD CONSTRAINT "budget_line_dimensions_budget_line_id_fkey" FOREIGN KEY ("budget_line_id") REFERENCES "budget_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_line_dimensions" ADD CONSTRAINT "budget_line_dimensions_dimension_type_id_fkey" FOREIGN KEY ("dimension_type_id") REFERENCES "dimension_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_line_dimensions" ADD CONSTRAINT "budget_line_dimensions_dimension_value_id_fkey" FOREIGN KEY ("dimension_value_id") REFERENCES "dimension_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
