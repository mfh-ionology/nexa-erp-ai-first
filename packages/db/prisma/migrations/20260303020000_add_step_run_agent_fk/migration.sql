-- AddForeignKey
ALTER TABLE "ai_automation_step_runs" ADD CONSTRAINT "ai_automation_step_runs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "ai_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
