import Link from 'next/link';
import { ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-[450px] text-center">
        {/* Icon */}
        <div
          className="animate-fade-in-up mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}
        >
          <ShieldX className="h-8 w-8 text-[#ef4444]" />
        </div>

        {/* 403 Display */}
        <h1
          className="animate-fade-in-up font-serif text-6xl font-bold text-foreground"
          style={{ animationDelay: '50ms' }}
        >
          403
        </h1>

        {/* Description */}
        <p
          className="animate-fade-in-up mt-3 text-base font-medium text-foreground"
          style={{ animationDelay: '100ms' }}
        >
          You do not have permission to access this page
        </p>
        <p
          className="animate-fade-in-up mt-2 text-sm text-muted-foreground"
          style={{ animationDelay: '100ms' }}
        >
          Your administrator can grant access through access group settings.
        </p>
        <p
          className="animate-fade-in-up mt-1 text-sm font-medium text-foreground"
          style={{ animationDelay: '100ms' }}
        >
          Contact your administrator
        </p>

        {/* CTA */}
        <div className="animate-fade-in-up mt-6" style={{ animationDelay: '150ms' }}>
          <Button asChild className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]">
            <Link href="/">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
