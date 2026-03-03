'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/users', label: 'Users', icon: Users },
  { href: '/users/sarah-chen', label: 'User Detail', icon: UserCircle },
];

export function ErpNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex items-center gap-1 rounded-xl border border-border bg-card p-1.5 shadow-sm"
      aria-label="Main navigation"
    >
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-[#7c3aed] text-white shadow-sm'
                : 'text-muted-foreground hover:bg-[#f5f3ff] hover:text-foreground',
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
