-- CreateEnum
CREATE TYPE "tenant_status" AS ENUM ('PROVISIONING', 'ACTIVE', 'SUSPENDED', 'READ_ONLY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "billing_status" AS ENUM ('CURRENT', 'GRACE', 'OVERDUE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "enforcement_action" AS ENUM ('NONE', 'WARNING', 'READ_ONLY', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "platform_role" AS ENUM ('PLATFORM_ADMIN', 'PLATFORM_VIEWER');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "display_name" TEXT NOT NULL,
    "legal_name" TEXT,
    "status" "tenant_status" NOT NULL DEFAULT 'PROVISIONING',
    "plan_id" TEXT NOT NULL,
    "billing_status" "billing_status" NOT NULL DEFAULT 'CURRENT',
    "region" VARCHAR(30) NOT NULL DEFAULT 'uk-south',
    "db_host" TEXT NOT NULL,
    "db_name" TEXT NOT NULL,
    "db_port" INTEGER NOT NULL DEFAULT 5432,
    "sandbox_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_activity_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "display_name" TEXT NOT NULL,
    "max_users" INTEGER NOT NULL,
    "max_companies" INTEGER NOT NULL,
    "monthly_ai_token_allowance" BIGINT NOT NULL,
    "ai_hard_limit" BOOLEAN NOT NULL DEFAULT true,
    "enabled_modules" JSONB NOT NULL,
    "api_rate_limit" INTEGER NOT NULL DEFAULT 1000,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_module_overrides" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "module_key" VARCHAR(50) NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "reason" TEXT,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_module_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_feature_flags" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "feature_key" VARCHAR(100) NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_ai_quotas" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "tokens_used" BIGINT NOT NULL DEFAULT 0,
    "token_allowance" BIGINT NOT NULL,
    "soft_limit_pct" INTEGER NOT NULL DEFAULT 80,
    "hard_limit_pct" INTEGER NOT NULL DEFAULT 100,
    "burst_allowance" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_ai_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_ai_usage" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" VARCHAR(100) NOT NULL,
    "feature_key" VARCHAR(100) NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "prompt_tokens" INTEGER NOT NULL,
    "completion_tokens" INTEGER NOT NULL,
    "total_tokens" INTEGER NOT NULL,
    "cost_estimate" DECIMAL(10,6) NOT NULL,
    "request_id" VARCHAR(100) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_billing" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT,
    "subscription_status" VARCHAR(30),
    "current_period_end" TIMESTAMP(3),
    "grace_period_days" INTEGER NOT NULL DEFAULT 14,
    "last_payment_at" TIMESTAMP(3),
    "dunning_level" INTEGER NOT NULL DEFAULT 0,
    "enforcement_action" "enforcement_action" NOT NULL DEFAULT 'NONE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_billing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role" "platform_role" NOT NULL,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_audit_log" (
    "id" TEXT NOT NULL,
    "platform_user_id" TEXT NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "target_type" VARCHAR(50),
    "target_id" TEXT,
    "details" JSONB,
    "ip_address" VARCHAR(45) NOT NULL,
    "user_agent" VARCHAR(500),
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impersonation_sessions" (
    "id" TEXT NOT NULL,
    "platform_user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "actions_log" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_code_key" ON "tenants"("code");

-- CreateIndex
CREATE INDEX "idx_tenants_status" ON "tenants"("status");

-- CreateIndex
CREATE INDEX "idx_tenants_plan_id" ON "tenants"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_module_overrides_tenant_module" ON "tenant_module_overrides"("tenant_id", "module_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_feature_flags_tenant_feature" ON "tenant_feature_flags"("tenant_id", "feature_key");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_ai_quotas_tenant_id_key" ON "tenant_ai_quotas"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_ai_usage_request_id_key" ON "tenant_ai_usage"("request_id");

-- CreateIndex
CREATE INDEX "idx_tenant_ai_usage_tenant_timestamp" ON "tenant_ai_usage"("tenant_id", "timestamp");

-- CreateIndex
CREATE INDEX "idx_tenant_ai_usage_tenant_feature" ON "tenant_ai_usage"("tenant_id", "feature_key");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_billing_tenant_id_key" ON "tenant_billing"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_users_email_key" ON "platform_users"("email");

-- CreateIndex
CREATE INDEX "idx_platform_audit_log_user_timestamp" ON "platform_audit_log"("platform_user_id", "timestamp");

-- CreateIndex
CREATE INDEX "idx_platform_audit_log_target" ON "platform_audit_log"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "idx_impersonation_sessions_tenant_started" ON "impersonation_sessions"("tenant_id", "started_at");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_module_overrides" ADD CONSTRAINT "tenant_module_overrides_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_feature_flags" ADD CONSTRAINT "tenant_feature_flags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_ai_quotas" ADD CONSTRAINT "tenant_ai_quotas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_ai_usage" ADD CONSTRAINT "tenant_ai_usage_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_billing" ADD CONSTRAINT "tenant_billing_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_audit_log" ADD CONSTRAINT "platform_audit_log_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
