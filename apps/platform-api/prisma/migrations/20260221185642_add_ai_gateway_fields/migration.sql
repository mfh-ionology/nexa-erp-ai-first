/*
  Warnings:

  - Added the required column `provider` to the `tenant_ai_usage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "tenant_ai_usage" ADD COLUMN     "fallback_from" VARCHAR(100),
ADD COLUMN     "fallback_used" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_byok" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "latency_ms" INTEGER,
ADD COLUMN     "provider" VARCHAR(50) NOT NULL DEFAULT 'unknown';

-- Remove the default after backfilling existing rows
ALTER TABLE "tenant_ai_usage" ALTER COLUMN "provider" DROP DEFAULT;

-- CreateTable
CREATE TABLE "tenant_provider_credentials" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "provider_id" VARCHAR(50) NOT NULL,
    "encrypted_key" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_provider_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_provider_credentials_tenant_provider" ON "tenant_provider_credentials"("tenant_id", "provider_id");

-- AddForeignKey
ALTER TABLE "tenant_provider_credentials" ADD CONSTRAINT "tenant_provider_credentials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
