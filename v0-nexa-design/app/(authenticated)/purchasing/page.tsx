import { CreditCard, CheckCircle } from 'lucide-react';

export default function PurchasingPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col items-center text-center py-12">
        <div className="animate-fade-in-up mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#ede9fe]">
          <CreditCard className="h-8 w-8 text-[#7c3aed]" />
        </div>
        <h1
          className="animate-fade-in-up font-serif text-3xl font-bold text-foreground"
          style={{ animationDelay: '50ms' }}
        >
          Purchasing
        </h1>
        <p
          className="animate-fade-in-up mt-3 max-w-md text-sm leading-relaxed text-muted-foreground"
          style={{ animationDelay: '100ms' }}
        >
          Manage purchase orders, goods receipts, and supplier catalogues.
        </p>
        <span
          className="animate-fade-in-up mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          style={{ animationDelay: '100ms' }}
        >
          Coming in a future release
        </span>
        <div
          className="animate-fade-in-up mt-8 w-full max-w-md rounded-xl border border-border bg-card p-6 text-left shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_12px_rgba(124,58,237,0.10)]"
          style={{ animationDelay: '150ms' }}
        >
          <h3 className="mb-4 font-serif text-sm font-semibold text-foreground">
            Planned Features
          </h3>
          <div className="flex flex-col gap-3">
            {[
              'Purchase Orders',
              'Goods Receipt',
              'Supplier Catalogue',
              'Approval Workflows',
              'Spend Analytics',
            ].map((f) => (
              <div key={f} className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 shrink-0 text-[#10b981]" />
                <span className="text-sm text-foreground">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
