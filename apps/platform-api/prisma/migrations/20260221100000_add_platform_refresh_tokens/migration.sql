-- CreateTable
CREATE TABLE "platform_refresh_tokens" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "platform_user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "platform_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_platform_refresh_tokens_token_hash" ON "platform_refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_platform_refresh_tokens_user_revoked" ON "platform_refresh_tokens"("platform_user_id", "revoked_at");

-- AddForeignKey
ALTER TABLE "platform_refresh_tokens" ADD CONSTRAINT "platform_refresh_tokens_platform_user_id_fkey" FOREIGN KEY ("platform_user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
