-- CreateEnum
CREATE TYPE "exchange_rate_source" AS ENUM ('BOE', 'ECB', 'MANUAL');

-- CreateEnum
CREATE TYPE "vat_type" AS ENUM ('STANDARD', 'REDUCED', 'ZERO', 'EXEMPT', 'OUTSIDE_SCOPE', 'REVERSE_CHARGE', 'SECOND_HAND');

-- CreateEnum
CREATE TYPE "tag_type" AS ENUM ('CUSTOMER', 'ITEM', 'ORDER', 'GENERAL');

-- CreateEnum
CREATE TYPE "holiday_type" AS ENUM ('PUBLIC', 'COMPANY', 'SPECIAL');

-- CreateEnum
CREATE TYPE "vat_scheme" AS ENUM ('STANDARD', 'FLAT_RATE', 'CASH');

-- CreateEnum
CREATE TYPE "setting_category" AS ENUM ('GENERAL', 'FINANCE', 'AR', 'AP', 'SALES', 'PURCHASING', 'INVENTORY', 'CRM', 'HR', 'MANUFACTURING', 'REPORTING');

-- CreateEnum
CREATE TYPE "setting_value_type" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');

-- CreateEnum
CREATE TYPE "sharing_mode" AS ENUM ('NONE', 'ALL_COMPANIES', 'SELECTED');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'STAFF', 'VIEWER');

-- CreateEnum
CREATE TYPE "view_scope" AS ENUM ('PERSONAL', 'ROLE', 'GLOBAL');

-- CreateTable
CREATE TABLE "currencies" (
    "code" VARCHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "minor_unit" INTEGER NOT NULL DEFAULT 2,
    "round_total" INTEGER NOT NULL DEFAULT 2,
    "round_vat" INTEGER NOT NULL DEFAULT 2,
    "round_line" INTEGER NOT NULL DEFAULT 2,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "countries" (
    "code" VARCHAR(2) NOT NULL,
    "iso3_code" VARCHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "default_currency_code" VARCHAR(3),
    "region" TEXT,
    "vat_prefix" TEXT,
    "date_format" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL,
    "rate_date" DATE NOT NULL,
    "buy_rate" DECIMAL(18,8) NOT NULL,
    "sell_rate" DECIMAL(18,8) NOT NULL,
    "mid_rate" DECIMAL(18,8) NOT NULL,
    "source" "exchange_rate_source" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cost_centre" TEXT,
    "manager_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_terms" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "due_days" INTEGER NOT NULL,
    "discount_percent" DECIMAL(5,2),
    "discount_days" INTEGER,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vat_codes" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "type" "vat_type" NOT NULL,
    "sales_account_code" TEXT,
    "purchase_account_code" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vat_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag_type" "tag_type" NOT NULL,
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_holidays" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "country_code" VARCHAR(2) NOT NULL,
    "holiday_type" "holiday_type" NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "registration_number" TEXT,
    "vat_number" TEXT,
    "utr_number" TEXT,
    "nature_of_business" TEXT,
    "base_currency_code" VARCHAR(3) NOT NULL DEFAULT 'GBP',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "address_line_1" TEXT,
    "address_line_2" TEXT,
    "city" TEXT,
    "county" TEXT,
    "postcode" TEXT,
    "country_code" VARCHAR(2) NOT NULL DEFAULT 'GB',
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "week_start" INTEGER NOT NULL DEFAULT 1,
    "date_format" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "decimal_separator" TEXT NOT NULL DEFAULT '.',
    "thousands_separator" TEXT NOT NULL DEFAULT ',',
    "vat_scheme" "vat_scheme" NOT NULL DEFAULT 'STANDARD',
    "default_language" TEXT NOT NULL DEFAULT 'en',
    "tax_agent_name" TEXT,
    "tax_agent_phone" TEXT,
    "tax_agent_email" TEXT,
    "logo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "company_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "value_type" "setting_value_type" NOT NULL,
    "category" "setting_category" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "register_sharing_rules" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "sharing_mode" "sharing_mode" NOT NULL,
    "source_company_id" TEXT NOT NULL,
    "target_company_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "register_sharing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_company_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT,
    "role" "user_role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_company_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "enabled_modules" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "number_series" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "next_value" INTEGER NOT NULL DEFAULT 1,
    "padding" INTEGER NOT NULL DEFAULT 5,
    "suffix" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "number_series_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_exchange_rates_company_id" ON "exchange_rates"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_exchange_rates_company_currency_date" ON "exchange_rates"("company_id", "currency_code", "rate_date");

-- CreateIndex
CREATE INDEX "idx_departments_company_active" ON "departments"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_departments_company_code" ON "departments"("company_id", "code");

-- CreateIndex
CREATE INDEX "idx_payment_terms_company_active" ON "payment_terms"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_payment_terms_company_code" ON "payment_terms"("company_id", "code");

-- CreateIndex
CREATE INDEX "idx_vat_codes_company_active" ON "vat_codes"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_vat_codes_company_code" ON "vat_codes"("company_id", "code");

-- CreateIndex
CREATE INDEX "idx_tags_company_active" ON "tags"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tags_company_code_type" ON "tags"("company_id", "code", "tag_type");

-- CreateIndex
CREATE INDEX "idx_bank_holidays_company_active" ON "bank_holidays"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_bank_holidays_company_date_country" ON "bank_holidays"("company_id", "date", "country_code");

-- CreateIndex
CREATE INDEX "idx_company_profiles_base_currency_code" ON "company_profiles"("base_currency_code");

-- CreateIndex
CREATE INDEX "idx_company_profiles_country_code" ON "company_profiles"("country_code");

-- CreateIndex
CREATE INDEX "idx_company_profiles_is_default" ON "company_profiles"("is_default");

-- CreateIndex
CREATE INDEX "idx_system_settings_company_category" ON "system_settings"("company_id", "category");

-- CreateIndex
CREATE UNIQUE INDEX "uq_system_settings_company_key" ON "system_settings"("company_id", "key");

-- CreateIndex
CREATE INDEX "idx_sharing_rules_source_entity" ON "register_sharing_rules"("source_company_id", "entity_type");

-- CreateIndex
CREATE INDEX "idx_sharing_rules_target_entity" ON "register_sharing_rules"("target_company_id", "entity_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_sharing_rule" ON "register_sharing_rules"("entity_type", "source_company_id", "target_company_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_user_company_role" ON "user_company_roles"("user_id", "company_id");

-- CreateIndex
CREATE INDEX "idx_users_company_id" ON "users"("company_id");

-- CreateIndex
CREATE INDEX "idx_users_is_active" ON "users"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_user_revoked" ON "refresh_tokens"("user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_refresh_tokens_token_hash" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_number_series_company_id" ON "number_series"("company_id");

-- CreateIndex
CREATE INDEX "idx_number_series_company_active" ON "number_series"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_number_series_company_entity" ON "number_series"("company_id", "entity_type");

-- AddForeignKey
ALTER TABLE "countries" ADD CONSTRAINT "countries_default_currency_code_fkey" FOREIGN KEY ("default_currency_code") REFERENCES "currencies"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_currency_code_fkey" FOREIGN KEY ("currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_terms" ADD CONSTRAINT "payment_terms_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vat_codes" ADD CONSTRAINT "vat_codes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_holidays" ADD CONSTRAINT "bank_holidays_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_holidays" ADD CONSTRAINT "bank_holidays_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_base_currency_code_fkey" FOREIGN KEY ("base_currency_code") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_profiles" ADD CONSTRAINT "company_profiles_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_sharing_rules" ADD CONSTRAINT "register_sharing_rules_source_company_id_fkey" FOREIGN KEY ("source_company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "register_sharing_rules" ADD CONSTRAINT "register_sharing_rules_target_company_id_fkey" FOREIGN KEY ("target_company_id") REFERENCES "company_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_company_roles" ADD CONSTRAINT "user_company_roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_company_roles" ADD CONSTRAINT "user_company_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "number_series" ADD CONSTRAINT "number_series_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial unique index: only one global role (company_id IS NULL) per user
CREATE UNIQUE INDEX "uq_user_company_role_global" ON "user_company_roles" ("user_id") WHERE "company_id" IS NULL;

-- Partial unique index: prevent duplicate ALL_COMPANIES/NONE rules per entityType + sourceCompanyId
CREATE UNIQUE INDEX "uq_sharing_rule_no_target" ON "register_sharing_rules" ("entity_type", "source_company_id") WHERE "target_company_id" IS NULL;
