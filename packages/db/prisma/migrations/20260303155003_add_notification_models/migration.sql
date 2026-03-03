-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH');

-- CreateEnum
CREATE TYPE "notification_priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('PENDING', 'DELIVERED', 'READ', 'DISMISSED', 'FAILED');

-- DropIndex
DROP INDEX "idx_ai_memories_embedding";

-- DropIndex
DROP INDEX "idx_ai_memories_search_vector";

-- DropIndex
DROP INDEX "uq_ai_usage_tenant_model_date_no_agent";

-- DropIndex
DROP INDEX "uq_sharing_rule_no_target";

-- DropIndex
DROP INDEX "idx_saved_views_default";

-- DropIndex
DROP INDEX "idx_saved_views_favourite";

-- DropIndex
DROP INDEX "uq_user_company_role_global";

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "event_name" VARCHAR(200) NOT NULL,
    "title_template" VARCHAR(500) NOT NULL,
    "body_template" TEXT NOT NULL,
    "default_channels" "notification_channel"[] DEFAULT ARRAY['IN_APP']::"notification_channel"[],
    "default_priority" "notification_priority" NOT NULL DEFAULT 'NORMAL',
    "action_url" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "notification_template_id" TEXT NOT NULL,
    "enable_in_app" BOOLEAN NOT NULL DEFAULT true,
    "enable_email" BOOLEAN NOT NULL DEFAULT true,
    "enable_push" BOOLEAN NOT NULL DEFAULT true,
    "priority_override" "notification_priority",
    "is_muted" BOOLEAN NOT NULL DEFAULT false,
    "mute_until" TIMESTAMP(3),
    "auto_reply_enabled" BOOLEAN NOT NULL DEFAULT false,
    "auto_reply_subject" VARCHAR(500),
    "auto_reply_body" TEXT,
    "auto_reply_start_date" TIMESTAMP(3),
    "auto_reply_end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "template_id" TEXT,
    "title" VARCHAR(500) NOT NULL,
    "body" TEXT NOT NULL,
    "channel" "notification_channel" NOT NULL,
    "priority" "notification_priority" NOT NULL DEFAULT 'NORMAL',
    "action_url" VARCHAR(500),
    "entity_type" VARCHAR(100),
    "entity_id" TEXT,
    "status" "notification_status" NOT NULL DEFAULT 'PENDING',
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_code_key" ON "notification_templates"("code");

-- CreateIndex
CREATE INDEX "idx_notification_templates_event" ON "notification_templates"("event_name");

-- CreateIndex
CREATE INDEX "idx_notification_templates_active" ON "notification_templates"("is_active");

-- CreateIndex
CREATE INDEX "idx_notification_prefs_user" ON "notification_preferences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_notification_prefs_user_template" ON "notification_preferences"("user_id", "notification_template_id");

-- CreateIndex
CREATE INDEX "idx_notifications_user_status" ON "notifications"("user_id", "status");

-- CreateIndex
CREATE INDEX "idx_notifications_user_time" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_notifications_channel_status" ON "notifications"("channel", "status");

-- CreateIndex
CREATE INDEX "idx_notifications_entity" ON "notifications"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_notifications_template" ON "notifications"("template_id");

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_notification_template_id_fkey" FOREIGN KEY ("notification_template_id") REFERENCES "notification_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
