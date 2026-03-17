/**
 * TanStack Query hook for the AI Setup Wizard status.
 *
 * - useAiSetupStatus: Query for setup checklist completion state
 */

import { useQuery } from '@tanstack/react-query';

import { apiGet } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth-store';

export interface SetupStatus {
  modelsConnected: boolean;
  agentsConfigured: boolean;
  skillsActivated: boolean;
  automationCreated: boolean;
  copilotTested: boolean;
  wizardCompleted: boolean;
  checklistDismissed: boolean;
}

/**
 * Setup wizard status query.
 * Fetches the completion state of each step in the AI setup checklist.
 */
export function useAiSetupStatus() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: queryKeys.aiAdmin.setupStatus(),
    queryFn: async () => {
      const result = await apiGet<SetupStatus>('/ai/admin/setup-status');
      return result.data;
    },
    enabled: isAuthenticated,
  });
}
