-- CreateEnum
CREATE TYPE "account_type" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "normal_balance" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "journal_status" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "journal_source" AS ENUM ('MANUAL', 'AR_INVOICE', 'AR_CREDIT_NOTE', 'AR_PAYMENT', 'AP_BILL', 'AP_CREDIT_NOTE', 'AP_PAYMENT', 'BANK_PAYMENT', 'BANK_RECEIPT', 'BANK_TRANSFER', 'STOCK_MOVEMENT', 'STOCK_REVALUATION', 'GOODS_RECEIPT', 'SHIPMENT', 'DEPRECIATION', 'PAYROLL', 'PRODUCTION', 'VAT_ADJUSTMENT', 'YEAR_END', 'OPENING_BALANCE');

-- CreateEnum
CREATE TYPE "period_status" AS ENUM ('OPEN', 'CLOSED', 'LOCKED');

-- CreateEnum
CREATE TYPE "budget_status" AS ENUM ('DRAFT', 'APPROVED', 'LOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "reconciliation_status" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "account_classifications" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" TEXT NOT NULL,
    "account_type" "account_type" NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "report_section" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chart_of_accounts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" TEXT NOT NULL,
    "account_type" "account_type" NOT NULL,
    "normal_balance" "normal_balance" NOT NULL,
    "parent_code" VARCHAR(20),
    "classification_id" TEXT,
    "is_postable" BOOLEAN NOT NULL DEFAULT true,
    "is_control" BOOLEAN NOT NULL DEFAULT false,
    "is_bank_account" BOOLEAN NOT NULL DEFAULT false,
    "is_system_account" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "tax_code" VARCHAR(20),
    "department_code" VARCHAR(20),
    "currency_code" VARCHAR(3),
    "opening_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "current_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_periods" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "period_number" INTEGER NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "period_status" NOT NULL DEFAULT 'OPEN',
    "closed_at" TIMESTAMP(3),
    "closed_by" TEXT,
    "locked_at" TIMESTAMP(3),
    "locked_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_mappings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "mapping_type" VARCHAR(50) NOT NULL,
    "account_code" VARCHAR(20) NOT NULL,
    "department_code" VARCHAR(20),
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "entry_number" VARCHAR(20) NOT NULL,
    "transaction_date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "source" "journal_source" NOT NULL,
    "source_id" TEXT,
    "source_reference" TEXT,
    "is_auto_generated" BOOLEAN NOT NULL DEFAULT false,
    "status" "journal_status" NOT NULL DEFAULT 'DRAFT',
    "posted_at" TIMESTAMP(3),
    "posted_by" TEXT,
    "reversal_of_id" TEXT,
    "period_id" TEXT NOT NULL,
    "total_debit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_credit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "template_id" TEXT,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "journal_entry_id" TEXT NOT NULL,
    "line_number" INTEGER NOT NULL,
    "account_code" VARCHAR(20) NOT NULL,
    "company_id" TEXT NOT NULL,
    "description" TEXT,
    "debit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "credit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "vat_code" VARCHAR(20),
    "currency_code" VARCHAR(3),
    "foreign_amount" DECIMAL(19,4),
    "exchange_rate" DECIMAL(18,8),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimension_types" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_single_select" BOOLEAN NOT NULL DEFAULT true,
    "allow_manual_entry" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dimension_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimension_values" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "dimension_type_id" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dimension_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimension_requirements" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "dimension_type_id" TEXT NOT NULL,
    "account_code_from" VARCHAR(20) NOT NULL,
    "account_code_to" VARCHAR(20) NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dimension_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_line_dimensions" (
    "id" TEXT NOT NULL,
    "journal_line_id" TEXT NOT NULL,
    "dimension_value_id" TEXT NOT NULL,

    CONSTRAINT "journal_line_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimension_defaults" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "dimension_type_id" TEXT NOT NULL,
    "dimension_value_id" TEXT NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dimension_defaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dimension_balances" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "account_code" VARCHAR(20) NOT NULL,
    "dimension_type_id" TEXT NOT NULL,
    "dimension_value_id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "total_debit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "total_credit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dimension_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_code" VARCHAR(6),
    "account_number" VARCHAR(8),
    "iban" VARCHAR(34),
    "swift_bic" VARCHAR(11),
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'GBP',
    "gl_account_code" VARCHAR(20) NOT NULL,
    "current_balance" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "last_reconciled_date" DATE,
    "open_banking_status" VARCHAR(20) NOT NULL DEFAULT 'DISCONNECTED',
    "open_banking_provider" VARCHAR(50),
    "open_banking_conn_id" TEXT,
    "open_banking_last_sync" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "external_id" TEXT,
    "transaction_date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "reference" TEXT,
    "type" VARCHAR(20),
    "import_batch_id" TEXT,
    "imported_at" TIMESTAMP(3),
    "is_matched" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_reconciliations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "bank_account_id" TEXT NOT NULL,
    "statement_date" DATE NOT NULL,
    "statement_balance" DECIMAL(19,4) NOT NULL,
    "gl_balance" DECIMAL(19,4),
    "difference" DECIMAL(19,4),
    "status" "reconciliation_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "completed_at" TIMESTAMP(3),
    "completed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "bank_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_reconciliation_lines" (
    "id" TEXT NOT NULL,
    "reconciliation_id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_reconciliation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transaction_matches" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "bank_transaction_id" TEXT NOT NULL,
    "journal_line_id" TEXT,
    "match_type" VARCHAR(20) NOT NULL,
    "confidence" DECIMAL(5,2),
    "matched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matched_by" TEXT,

    CONSTRAINT "bank_transaction_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fiscal_year" INTEGER NOT NULL,
    "budget_type" VARCHAR(20) NOT NULL DEFAULT 'ANNUAL',
    "status" "budget_status" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "original_budget_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_lines" (
    "id" TEXT NOT NULL,
    "budget_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "account_code" VARCHAR(20) NOT NULL,
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

    CONSTRAINT "budget_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vat_returns" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "box_1" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "box_2" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "box_3" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "box_4" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "box_5" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "box_6" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "box_7" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "box_8" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "box_9" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "calculated_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "submitted_by" TEXT,
    "hmrc_submission_id" TEXT,
    "hmrc_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "vat_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_templates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "frequency" VARCHAR(20) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "template_lines" JSONB NOT NULL,
    "last_executed_at" TIMESTAMP(3),
    "next_due_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "journal_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_classifications_company_id_idx" ON "account_classifications"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_classifications_company_id_code_key" ON "account_classifications"("company_id", "code");

-- CreateIndex
CREATE INDEX "chart_of_accounts_company_id_idx" ON "chart_of_accounts"("company_id");

-- CreateIndex
CREATE INDEX "chart_of_accounts_company_id_parent_code_idx" ON "chart_of_accounts"("company_id", "parent_code");

-- CreateIndex
CREATE INDEX "chart_of_accounts_company_id_account_type_idx" ON "chart_of_accounts"("company_id", "account_type");

-- CreateIndex
CREATE UNIQUE INDEX "chart_of_accounts_company_id_code_key" ON "chart_of_accounts"("company_id", "code");

-- CreateIndex
CREATE INDEX "financial_periods_company_id_idx" ON "financial_periods"("company_id");

-- CreateIndex
CREATE INDEX "financial_periods_company_id_start_date_end_date_idx" ON "financial_periods"("company_id", "start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "financial_periods_company_id_fiscal_year_period_number_key" ON "financial_periods"("company_id", "fiscal_year", "period_number");

-- CreateIndex
CREATE INDEX "account_mappings_company_id_idx" ON "account_mappings"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_mappings_company_id_mapping_type_department_code_key" ON "account_mappings"("company_id", "mapping_type", "department_code");

-- CreateIndex
CREATE INDEX "journal_entries_company_id_idx" ON "journal_entries"("company_id");

-- CreateIndex
CREATE INDEX "journal_entries_company_id_transaction_date_idx" ON "journal_entries"("company_id", "transaction_date");

-- CreateIndex
CREATE INDEX "journal_entries_company_id_status_idx" ON "journal_entries"("company_id", "status");

-- CreateIndex
CREATE INDEX "journal_entries_company_id_source_idx" ON "journal_entries"("company_id", "source");

-- CreateIndex
CREATE INDEX "journal_entries_source_id_idx" ON "journal_entries"("source_id");

-- CreateIndex
CREATE INDEX "journal_entries_reversal_of_id_idx" ON "journal_entries"("reversal_of_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_company_id_entry_number_key" ON "journal_entries"("company_id", "entry_number");

-- CreateIndex
CREATE INDEX "journal_lines_journal_entry_id_idx" ON "journal_lines"("journal_entry_id");

-- CreateIndex
CREATE INDEX "journal_lines_company_id_account_code_idx" ON "journal_lines"("company_id", "account_code");

-- CreateIndex
CREATE INDEX "dimension_types_company_id_idx" ON "dimension_types"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "dimension_types_company_id_code_key" ON "dimension_types"("company_id", "code");

-- CreateIndex
CREATE INDEX "dimension_values_company_id_idx" ON "dimension_values"("company_id");

-- CreateIndex
CREATE INDEX "dimension_values_dimension_type_id_idx" ON "dimension_values"("dimension_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "dimension_values_dimension_type_id_code_company_id_key" ON "dimension_values"("dimension_type_id", "code", "company_id");

-- CreateIndex
CREATE INDEX "dimension_requirements_company_id_idx" ON "dimension_requirements"("company_id");

-- CreateIndex
CREATE INDEX "dimension_requirements_dimension_type_id_idx" ON "dimension_requirements"("dimension_type_id");

-- CreateIndex
CREATE INDEX "journal_line_dimensions_journal_line_id_idx" ON "journal_line_dimensions"("journal_line_id");

-- CreateIndex
CREATE INDEX "journal_line_dimensions_dimension_value_id_idx" ON "journal_line_dimensions"("dimension_value_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_line_dimensions_journal_line_id_dimension_value_id_key" ON "journal_line_dimensions"("journal_line_id", "dimension_value_id");

-- CreateIndex
CREATE INDEX "dimension_defaults_company_id_idx" ON "dimension_defaults"("company_id");

-- CreateIndex
CREATE INDEX "dimension_defaults_company_id_entity_type_entity_id_idx" ON "dimension_defaults"("company_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "dimension_balances_company_id_idx" ON "dimension_balances"("company_id");

-- CreateIndex
CREATE INDEX "dimension_balances_company_id_account_code_period_id_idx" ON "dimension_balances"("company_id", "account_code", "period_id");

-- CreateIndex
CREATE UNIQUE INDEX "dimension_balances_company_id_account_code_dimension_type_i_key" ON "dimension_balances"("company_id", "account_code", "dimension_type_id", "dimension_value_id", "period_id");

-- CreateIndex
CREATE INDEX "bank_accounts_company_id_idx" ON "bank_accounts"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_accounts_company_id_gl_account_code_key" ON "bank_accounts"("company_id", "gl_account_code");

-- CreateIndex
CREATE INDEX "bank_transactions_company_id_idx" ON "bank_transactions"("company_id");

-- CreateIndex
CREATE INDEX "bank_transactions_bank_account_id_idx" ON "bank_transactions"("bank_account_id");

-- CreateIndex
CREATE INDEX "bank_transactions_bank_account_id_is_matched_idx" ON "bank_transactions"("bank_account_id", "is_matched");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_bank_account_id_external_id_key" ON "bank_transactions"("bank_account_id", "external_id");

-- CreateIndex
CREATE INDEX "bank_reconciliations_company_id_idx" ON "bank_reconciliations"("company_id");

-- CreateIndex
CREATE INDEX "bank_reconciliations_bank_account_id_idx" ON "bank_reconciliations"("bank_account_id");

-- CreateIndex
CREATE INDEX "bank_reconciliation_lines_reconciliation_id_idx" ON "bank_reconciliation_lines"("reconciliation_id");

-- CreateIndex
CREATE INDEX "bank_transaction_matches_company_id_idx" ON "bank_transaction_matches"("company_id");

-- CreateIndex
CREATE INDEX "bank_transaction_matches_bank_transaction_id_idx" ON "bank_transaction_matches"("bank_transaction_id");

-- CreateIndex
CREATE INDEX "budgets_company_id_idx" ON "budgets"("company_id");

-- CreateIndex
CREATE INDEX "budgets_company_id_fiscal_year_idx" ON "budgets"("company_id", "fiscal_year");

-- CreateIndex
CREATE INDEX "budget_lines_budget_id_idx" ON "budget_lines"("budget_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_lines_budget_id_account_code_key" ON "budget_lines"("budget_id", "account_code");

-- CreateIndex
CREATE INDEX "vat_returns_company_id_idx" ON "vat_returns"("company_id");

-- CreateIndex
CREATE INDEX "vat_returns_company_id_period_start_period_end_idx" ON "vat_returns"("company_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "journal_templates_company_id_idx" ON "journal_templates"("company_id");

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_classification_id_fkey" FOREIGN KEY ("classification_id") REFERENCES "account_classifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_company_id_parent_code_fkey" FOREIGN KEY ("company_id", "parent_code") REFERENCES "chart_of_accounts"("company_id", "code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "account_mappings" ADD CONSTRAINT "account_mappings_company_id_account_code_fkey" FOREIGN KEY ("company_id", "account_code") REFERENCES "chart_of_accounts"("company_id", "code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "financial_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "journal_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_company_id_account_code_fkey" FOREIGN KEY ("company_id", "account_code") REFERENCES "chart_of_accounts"("company_id", "code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "dimension_values" ADD CONSTRAINT "dimension_values_dimension_type_id_fkey" FOREIGN KEY ("dimension_type_id") REFERENCES "dimension_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dimension_values" ADD CONSTRAINT "dimension_values_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "dimension_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dimension_requirements" ADD CONSTRAINT "dimension_requirements_dimension_type_id_fkey" FOREIGN KEY ("dimension_type_id") REFERENCES "dimension_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_line_dimensions" ADD CONSTRAINT "journal_line_dimensions_journal_line_id_fkey" FOREIGN KEY ("journal_line_id") REFERENCES "journal_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_line_dimensions" ADD CONSTRAINT "journal_line_dimensions_dimension_value_id_fkey" FOREIGN KEY ("dimension_value_id") REFERENCES "dimension_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dimension_defaults" ADD CONSTRAINT "dimension_defaults_dimension_type_id_fkey" FOREIGN KEY ("dimension_type_id") REFERENCES "dimension_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dimension_defaults" ADD CONSTRAINT "dimension_defaults_dimension_value_id_fkey" FOREIGN KEY ("dimension_value_id") REFERENCES "dimension_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dimension_balances" ADD CONSTRAINT "dimension_balances_dimension_type_id_fkey" FOREIGN KEY ("dimension_type_id") REFERENCES "dimension_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dimension_balances" ADD CONSTRAINT "dimension_balances_dimension_value_id_fkey" FOREIGN KEY ("dimension_value_id") REFERENCES "dimension_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_company_id_gl_account_code_fkey" FOREIGN KEY ("company_id", "gl_account_code") REFERENCES "chart_of_accounts"("company_id", "code") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_bank_account_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliation_lines" ADD CONSTRAINT "bank_reconciliation_lines_reconciliation_id_fkey" FOREIGN KEY ("reconciliation_id") REFERENCES "bank_reconciliations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transaction_matches" ADD CONSTRAINT "bank_transaction_matches_bank_transaction_id_fkey" FOREIGN KEY ("bank_transaction_id") REFERENCES "bank_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_original_budget_id_fkey" FOREIGN KEY ("original_budget_id") REFERENCES "budgets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_company_id_account_code_fkey" FOREIGN KEY ("company_id", "account_code") REFERENCES "chart_of_accounts"("company_id", "code") ON DELETE NO ACTION ON UPDATE NO ACTION;
