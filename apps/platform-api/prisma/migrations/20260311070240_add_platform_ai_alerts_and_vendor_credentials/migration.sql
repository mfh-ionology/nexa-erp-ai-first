-- CreateEnum
CREATE TYPE "ai_alert_type" AS ENUM ('QUOTA_WARNING', 'QUOTA_EXCEEDED', 'USAGE_SPIKE');

-- CreateTable
CREATE TABLE "vendor_provider_credentials" (
    "id" TEXT NOT NULL,
    "provider_id" VARCHAR(50) NOT NULL,
    "display_name" TEXT NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_provider_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_ai_alerts" (
    "id" TEXT NOT NULL,
    "type" "ai_alert_type" NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "usage_pct" DOUBLE PRECISION NOT NULL,
    "threshold" DOUBLE PRECISION,
    "daily_tokens" BIGINT,
    "rolling_avg_tokens" BIGINT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_by" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_ai_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_provider_credentials_provider_id_key" ON "vendor_provider_credentials"("provider_id");

-- CreateIndex
CREATE INDEX "idx_platform_ai_alerts_tenant_created" ON "platform_ai_alerts"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_platform_ai_alerts_type_ack" ON "platform_ai_alerts"("type", "acknowledged");

-- AddForeignKey
ALTER TABLE "platform_ai_alerts" ADD CONSTRAINT "platform_ai_alerts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
