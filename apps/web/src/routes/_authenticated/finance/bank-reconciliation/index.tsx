import { createFileRoute } from '@tanstack/react-router';

function BankReconciliationListPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Bank Reconciliation</h1>
      <p className="text-muted-foreground">
        Select a bank account to start or continue reconciliation.
      </p>
    </div>
  );
}

export const Route = createFileRoute('/_authenticated/finance/bank-reconciliation/')({
  component: BankReconciliationListPage,
});
