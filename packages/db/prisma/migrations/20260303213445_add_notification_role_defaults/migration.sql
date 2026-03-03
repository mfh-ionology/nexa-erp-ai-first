-- CreateTable
CREATE TABLE "notification_role_defaults" (
    "id" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "notification_template_id" TEXT NOT NULL,
    "enable_in_app" BOOLEAN NOT NULL DEFAULT true,
    "enable_email" BOOLEAN NOT NULL DEFAULT true,
    "enable_push" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_role_defaults_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_notification_role_defaults_role" ON "notification_role_defaults"("role");

-- CreateIndex
CREATE UNIQUE INDEX "uq_notification_role_defaults_role_template" ON "notification_role_defaults"("role", "notification_template_id");

-- AddForeignKey
ALTER TABLE "notification_role_defaults" ADD CONSTRAINT "notification_role_defaults_notification_template_id_fkey" FOREIGN KEY ("notification_template_id") REFERENCES "notification_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
