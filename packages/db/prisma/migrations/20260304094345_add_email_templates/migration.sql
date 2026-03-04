-- DropIndex
DROP INDEX "idx_knowledge_chunks_embedding";

-- DropIndex
DROP INDEX "idx_knowledge_chunks_search_vector";

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "document_type" VARCHAR(100) NOT NULL,
    "subject_template" VARCHAR(500) NOT NULL,
    "body_html_template" TEXT NOT NULL,
    "body_text_template" TEXT,
    "opening_text_code" VARCHAR(60),
    "closing_text_code" VARCHAR(60),
    "language_code" VARCHAR(5) NOT NULL DEFAULT 'en',
    "attach_pdf" BOOLEAN NOT NULL DEFAULT true,
    "auto_send" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_code_key" ON "email_templates"("code");

-- CreateIndex
CREATE INDEX "idx_email_templates_doctype_lang" ON "email_templates"("document_type", "language_code");

-- CreateIndex
CREATE INDEX "idx_email_templates_active" ON "email_templates"("is_active");

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_email_template_id_fkey" FOREIGN KEY ("email_template_id") REFERENCES "email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
