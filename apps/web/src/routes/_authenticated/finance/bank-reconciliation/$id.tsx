/* eslint-disable i18next/no-literal-string */
import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { BankReconciliationPage } from '@/features/finance/pages/bank-reconciliation-page';
import { useBankAccounts } from '@/features/finance/hooks/use-bank-accounts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const Route = createFileRoute('/_authenticated/finance/bank-reconciliation/$id')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: BankReconciliationRoute,
});

/**
 * Extracts `id` (bank account ID) from route params and passes to the page.
 * Adds a bank account selector dropdown for quick switching.
 */
function BankReconciliationRoute() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: bankAccountsData } = useBankAccounts();
  const bankAccounts = bankAccountsData?.data ?? [];

  const handleAccountChange = (newId: string) => {
    if (newId !== id) {
      void navigate({
        to: '/finance/bank-reconciliation/$id' as string,
        params: { id: newId },
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Bank account selector */}
      {bankAccounts.length > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Bank Account:</span>
          <Select value={id} onValueChange={handleAccountChange}>
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder="Select bank account" />
            </SelectTrigger>
            <SelectContent>
              {bankAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.name} — {account.glAccountCode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <BankReconciliationPage bankAccountId={id} />
    </div>
  );
}
