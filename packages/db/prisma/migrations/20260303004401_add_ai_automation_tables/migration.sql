-- CreateTable
CREATE TABLE "ai_automations" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "trigger_type" TEXT NOT NULL,
    "event_type" VARCHAR(255),
    "chain_from_id" TEXT,
    "chain_next_id" TEXT,
    "notification_config" JSONB,
    "max_token_budget" INTEGER NOT NULL DEFAULT 50000,
    "max_duration_ms" INTEGER NOT NULL DEFAULT 300000,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_automations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_automation_steps" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "agent_id" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "input_config" JSONB NOT NULL,
    "output_config" JSONB NOT NULL,
    "max_turns" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_automation_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_automation_schedules" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "cron_expression" VARCHAR(100) NOT NULL,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Europe/London',
    "next_run_at" TIMESTAMP(3),
    "last_run_at" TIMESTAMP(3),
    "is_paused" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_automation_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_automation_runs" (
    "id" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "triggered_by" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "result" JSONB,
    "error" TEXT,
    "retry_of_run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_automation_step_runs" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "step_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "agent_id" TEXT NOT NULL,
    "model_id" TEXT,
    "input" JSONB,
    "output" JSONB,
    "error" TEXT,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER,
    "turns" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_automation_step_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prompt_variables" (
    "id" TEXT NOT NULL,
    "prompt_id" TEXT NOT NULL,
    "variable_name" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "source_type" TEXT NOT NULL,
    "source_config" JSONB NOT NULL,
    "default_value" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_prompt_variables_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_automations_chain_from_id_key" ON "ai_automations"("chain_from_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_automations_chain_next_id_key" ON "ai_automations"("chain_next_id");

-- CreateIndex
CREATE INDEX "idx_ai_automations_company_active" ON "ai_automations"("company_id", "is_active");

-- CreateIndex
CREATE INDEX "idx_ai_automations_trigger_type" ON "ai_automations"("trigger_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ai_automation_steps_automation_order" ON "ai_automation_steps"("automation_id", "step_order");

-- CreateIndex
CREATE UNIQUE INDEX "ai_automation_schedules_automation_id_key" ON "ai_automation_schedules"("automation_id");

-- CreateIndex
CREATE INDEX "idx_ai_automation_schedules_next_run_paused" ON "ai_automation_schedules"("next_run_at", "is_paused");

-- CreateIndex
CREATE INDEX "idx_ai_automation_runs_automation_created" ON "ai_automation_runs"("automation_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_ai_automation_runs_status" ON "ai_automation_runs"("status");

-- CreateIndex
CREATE INDEX "idx_ai_automation_step_runs_run_created" ON "ai_automation_step_runs"("run_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_ai_prompt_variables_prompt_variable" ON "ai_prompt_variables"("prompt_id", "variable_name");

-- AddForeignKey
ALTER TABLE "ai_automations" ADD CONSTRAINT "ai_automations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_automations" ADD CONSTRAINT "ai_automations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_automations" ADD CONSTRAINT "ai_automations_chain_from_id_fkey" FOREIGN KEY ("chain_from_id") REFERENCES "ai_automations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_automations" ADD CONSTRAINT "ai_automations_chain_next_id_fkey" FOREIGN KEY ("chain_next_id") REFERENCES "ai_automations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_automation_steps" ADD CONSTRAINT "ai_automation_steps_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "ai_automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_automation_steps" ADD CONSTRAINT "ai_automation_steps_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "ai_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_automation_schedules" ADD CONSTRAINT "ai_automation_schedules_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "ai_automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_automation_runs" ADD CONSTRAINT "ai_automation_runs_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "ai_automations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_automation_step_runs" ADD CONSTRAINT "ai_automation_step_runs_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "ai_automation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_automation_step_runs" ADD CONSTRAINT "ai_automation_step_runs_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "ai_automation_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_prompt_variables" ADD CONSTRAINT "ai_prompt_variables_prompt_id_fkey" FOREIGN KEY ("prompt_id") REFERENCES "ai_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
