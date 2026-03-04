-- CreateEnum
CREATE TYPE "email_message_status" AS ENUM ('DRAFT', 'QUEUED', 'SENT', 'FAILED', 'BOUNCED');

-- CreateEnum
CREATE TYPE "email_direction" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "email_recipient_type" AS ENUM ('FROM', 'TO', 'CC', 'BCC');

-- CreateEnum
CREATE TYPE "email_recipient_status" AS ENUM ('UNREAD', 'READ', 'DELETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "email_queue_status" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'RETRYING');

-- CreateTable
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "message_number" TEXT NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "body_text" TEXT,
    "body_html" TEXT,
    "direction" "email_direction" NOT NULL,
    "status" "email_message_status" NOT NULL DEFAULT 'DRAFT',
    "external_message_id" VARCHAR(500),
    "in_reply_to" VARCHAR(500),
    "thread_id" VARCHAR(500),
    "email_template_id" TEXT,
    "source_entity_type" VARCHAR(100),
    "source_entity_id" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_html" BOOLEAN NOT NULL DEFAULT true,
    "has_attachments" BOOLEAN NOT NULL DEFAULT false,
    "is_auto_generated" BOOLEAN NOT NULL DEFAULT false,
    "is_bounce" BOOLEAN NOT NULL DEFAULT false,
    "is_mailing_list" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "company_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_recipients" (
    "id" TEXT NOT NULL,
    "email_message_id" TEXT NOT NULL,
    "recipient_type" "email_recipient_type" NOT NULL,
    "user_id" TEXT,
    "email_address" VARCHAR(320) NOT NULL,
    "display_name" VARCHAR(200),
    "status" "email_recipient_status" NOT NULL DEFAULT 'UNREAD',
    "read_at" TIMESTAMP(3),
    "acceptance_status" VARCHAR(20),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_queue" (
    "id" TEXT NOT NULL,
    "email_message_id" TEXT NOT NULL,
    "status" "email_queue_status" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "next_retry_at" TIMESTAMP(3),
    "smtp_response" VARCHAR(500),
    "delivered_at" TIMESTAMP(3),
    "bounced_at" TIMESTAMP(3),
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "email_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_signatures" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "body_html" TEXT NOT NULL,
    "body_text" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_message_number_key" ON "email_messages"("message_number");

-- CreateIndex
CREATE INDEX "idx_email_messages_status" ON "email_messages"("status");

-- CreateIndex
CREATE INDEX "idx_email_messages_direction" ON "email_messages"("direction");

-- CreateIndex
CREATE INDEX "idx_email_messages_sent_at" ON "email_messages"("sent_at");

-- CreateIndex
CREATE INDEX "idx_email_messages_created_by" ON "email_messages"("created_by");

-- CreateIndex
CREATE INDEX "idx_email_messages_source_entity" ON "email_messages"("source_entity_type", "source_entity_id");

-- CreateIndex
CREATE INDEX "idx_email_messages_thread" ON "email_messages"("thread_id");

-- CreateIndex
CREATE INDEX "idx_email_messages_external_id" ON "email_messages"("external_message_id");

-- CreateIndex
CREATE INDEX "idx_email_messages_company" ON "email_messages"("company_id");

-- CreateIndex
CREATE INDEX "idx_email_recipients_message" ON "email_recipients"("email_message_id");

-- CreateIndex
CREATE INDEX "idx_email_recipients_user_status" ON "email_recipients"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_email_recipients_address" ON "email_recipients"("email_address");

-- CreateIndex
CREATE INDEX "idx_email_recipients_user_type" ON "email_recipients"("user_id", "recipient_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_email_recipients_message_address_type" ON "email_recipients"("email_message_id", "email_address", "recipient_type");

-- CreateIndex
CREATE UNIQUE INDEX "email_queue_email_message_id_key" ON "email_queue"("email_message_id");

-- CreateIndex
CREATE INDEX "idx_email_queue_status_priority" ON "email_queue"("status", "priority");

-- CreateIndex
CREATE INDEX "idx_email_queue_retry" ON "email_queue"("next_retry_at");

-- CreateIndex
CREATE INDEX "idx_email_queue_queued_at" ON "email_queue"("queued_at");

-- CreateIndex
CREATE INDEX "idx_email_signatures_user" ON "email_signatures"("user_id");

-- CreateIndex
CREATE INDEX "idx_email_signatures_user_default" ON "email_signatures"("user_id", "is_default");

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_recipients" ADD CONSTRAINT "email_recipients_email_message_id_fkey" FOREIGN KEY ("email_message_id") REFERENCES "email_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_recipients" ADD CONSTRAINT "email_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_email_message_id_fkey" FOREIGN KEY ("email_message_id") REFERENCES "email_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_signatures" ADD CONSTRAINT "email_signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
