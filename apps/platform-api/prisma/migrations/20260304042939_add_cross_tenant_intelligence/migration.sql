-- AlterTable
ALTER TABLE "platform_refresh_tokens" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "industry" VARCHAR(100);

-- CreateTable
CREATE TABLE "tenant_ai_patterns" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "pattern_date" DATE NOT NULL,
    "industry" VARCHAR(100),
    "plan_tier" VARCHAR(30),
    "query_categories" JSONB NOT NULL,
    "skill_usage" JSONB NOT NULL,
    "view_patterns" JSONB NOT NULL,
    "automation_usage" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_ai_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_ai_corrections" (
    "id" TEXT NOT NULL,
    "pattern_date" DATE NOT NULL,
    "industry" VARCHAR(100),
    "correction_type" VARCHAR(100) NOT NULL,
    "skill_key" VARCHAR(200) NOT NULL DEFAULT '',
    "occurrence_count" INTEGER NOT NULL,
    "tenant_count" INTEGER NOT NULL,
    "common_correction" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_ai_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_knowledge_base" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "content" TEXT NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "target_industries" TEXT[],
    "target_plan_tiers" TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_knowledge_base_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_skill_effectiveness" (
    "id" TEXT NOT NULL,
    "skill_key" VARCHAR(200) NOT NULL,
    "measure_date" DATE NOT NULL,
    "tenant_count" INTEGER NOT NULL,
    "total_queries" INTEGER NOT NULL,
    "avg_success_rate" DECIMAL(5,2) NOT NULL,
    "avg_correction_rate" DECIMAL(5,2) NOT NULL,
    "avg_confidence" DECIMAL(3,2) NOT NULL,
    "trend" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_skill_effectiveness_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_ai_insights" (
    "id" TEXT NOT NULL,
    "insight_type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "severity" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'NEW',
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_ai_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_patterns_date" ON "tenant_ai_patterns"("pattern_date");

-- CreateIndex
CREATE INDEX "idx_patterns_industry" ON "tenant_ai_patterns"("industry");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_pattern_date" ON "tenant_ai_patterns"("tenant_id", "pattern_date");

-- CreateIndex
CREATE UNIQUE INDEX "uq_corrections_date_type_skill" ON "tenant_ai_corrections"("pattern_date", "correction_type", "skill_key");

-- CreateIndex
CREATE INDEX "idx_corrections_date_type" ON "tenant_ai_corrections"("pattern_date", "correction_type");

-- CreateIndex
CREATE INDEX "idx_corrections_skill" ON "tenant_ai_corrections"("skill_key");

-- CreateIndex
CREATE INDEX "idx_platform_knowledge_status" ON "platform_knowledge_base"("status", "category");

-- CreateIndex
CREATE INDEX "idx_effectiveness_date" ON "ai_skill_effectiveness"("measure_date");

-- CreateIndex
CREATE UNIQUE INDEX "uq_skill_effectiveness" ON "ai_skill_effectiveness"("skill_key", "measure_date");

-- CreateIndex
CREATE INDEX "idx_insights_type_status" ON "platform_ai_insights"("insight_type", "status");

-- CreateIndex
CREATE INDEX "idx_insights_severity" ON "platform_ai_insights"("severity", "status");

-- CreateIndex
CREATE INDEX "idx_tenants_industry" ON "tenants"("industry");

-- AddForeignKey
ALTER TABLE "tenant_ai_patterns" ADD CONSTRAINT "tenant_ai_patterns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
