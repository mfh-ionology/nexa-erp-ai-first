-- CreateTable
CREATE TABLE "platform_knowledge_responses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "article_version" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "tenant_article_id" TEXT,
    "responded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_knowledge_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_knowledge_responses_tenant" ON "platform_knowledge_responses"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_knowledge_responses_article" ON "platform_knowledge_responses"("article_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tenant_knowledge_response" ON "platform_knowledge_responses"("tenant_id", "article_id");

-- AddForeignKey
ALTER TABLE "platform_knowledge_responses" ADD CONSTRAINT "platform_knowledge_responses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_knowledge_responses" ADD CONSTRAINT "platform_knowledge_responses_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "platform_knowledge_base"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
