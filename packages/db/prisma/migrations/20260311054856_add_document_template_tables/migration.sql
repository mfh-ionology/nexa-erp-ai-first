-- CreateEnum
CREATE TYPE "document_type" AS ENUM ('SALES_INVOICE', 'CREDIT_NOTE', 'CASH_RECEIPT', 'PROFORMA_INVOICE', 'CUSTOMER_STATEMENT', 'SALES_ORDER', 'SALES_QUOTE', 'DELIVERY_NOTE', 'PURCHASE_ORDER', 'GOODS_RECEIPT_NOTE', 'SUPPLIER_REMITTANCE', 'PAYSLIP', 'P45', 'P60');

-- CreateTable
CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "document_type" "document_type" NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "html_template" TEXT NOT NULL,
    "header_html" TEXT,
    "footer_html" TEXT,
    "css_styles" TEXT,
    "page_size" VARCHAR(20) NOT NULL DEFAULT 'A4',
    "orientation" VARCHAR(20) NOT NULL DEFAULT 'portrait',
    "margin_top" DECIMAL(5,1) NOT NULL DEFAULT 20,
    "margin_bottom" DECIMAL(5,1) NOT NULL DEFAULT 20,
    "margin_left" DECIMAL(5,1) NOT NULL DEFAULT 15,
    "margin_right" DECIMAL(5,1) NOT NULL DEFAULT 15,
    "show_logo" BOOLEAN NOT NULL DEFAULT true,
    "logo_position" VARCHAR(20) NOT NULL DEFAULT 'top-left',
    "show_bank_details" BOOLEAN NOT NULL DEFAULT true,
    "show_vat_number" BOOLEAN NOT NULL DEFAULT true,
    "show_company_reg" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_template_versions" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "language_code" VARCHAR(10),
    "branch_code" VARCHAR(50),
    "number_series_id" TEXT,
    "access_group" VARCHAR(50),
    "customer_group_id" TEXT,
    "html_override" TEXT,
    "css_override" TEXT,
    "header_override" TEXT,
    "footer_override" TEXT,
    "email_subject" VARCHAR(500),
    "email_body" TEXT,
    "reply_to_email" VARCHAR(255),
    "cc_emails" VARCHAR(500),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_document_templates_company_type_active" ON "document_templates"("company_id", "document_type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_document_templates_company_type_name" ON "document_templates"("company_id", "document_type", "name");

-- CreateIndex
CREATE INDEX "idx_doc_template_versions_template_active_priority" ON "document_template_versions"("template_id", "is_active", "priority");

-- CreateIndex
CREATE INDEX "idx_doc_template_versions_language" ON "document_template_versions"("language_code");

-- CreateIndex
CREATE INDEX "idx_doc_template_versions_branch" ON "document_template_versions"("branch_code");

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_template_versions" ADD CONSTRAINT "document_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "document_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
