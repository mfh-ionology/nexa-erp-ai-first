// ---------------------------------------------------------------------------
// AI Usage Tab — Enhanced per-tenant AI usage detail view
// Story: E13b.2 Task 6.2, enhanced in E13b-4 Task 6.1
// ---------------------------------------------------------------------------

import { Brain } from 'lucide-react';

import type { TenantDetail } from '@/types/tenant';
import { TenantAiUsageDetail } from '@/features/ai-usage/components/tenant-ai-usage-detail';

interface AiUsageTabProps {
  tenant: TenantDetail;
}

export function AiUsageTab({ tenant }: AiUsageTabProps) {
  // No quota data available — show placeholder
  if (!tenant.aiQuota) {
    return (
      <div data-testid="ai-usage-tab">
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Brain className="mb-3 size-10 text-muted-foreground/50" />
          <h3 className="text-sm font-semibold text-foreground">AI usage data not available</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            AI quota has not been configured for this tenant yet. Usage tracking will appear here
            once the AI quota record is provisioned.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="ai-usage-tab">
      <TenantAiUsageDetail tenantId={tenant.id} planCode={tenant.plan?.code} />
    </div>
  );
}
