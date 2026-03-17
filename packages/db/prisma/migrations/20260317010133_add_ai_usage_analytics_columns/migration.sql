/*
  Warnings:

  - A unique constraint covering the columns `[tenant_id,model_id,agent_id,user_id,module_id,request_type,date]` on the table `ai_usage` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "uq_ai_usage_tenant_model_agent_date";

-- AlterTable
ALTER TABLE "ai_usage" ADD COLUMN     "latency_ms" INTEGER,
ADD COLUMN     "module_id" TEXT,
ADD COLUMN     "request_type" VARCHAR(20) NOT NULL DEFAULT 'chat',
ADD COLUMN     "user_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "uq_ai_usage_tenant_model_agent_user_module_type_date" ON "ai_usage"("tenant_id", "model_id", "agent_id", "user_id", "module_id", "request_type", "date");

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
