'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Cpu,
  Receipt,
  HeadphonesIcon,
  ScrollText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { href: '/platform/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/platform/tenants', label: 'Tenants', icon: Building2 },
  { href: '/platform/ai-usage', label: 'AI Usage', icon: Cpu },
  { href: '/platform/billing', label: 'Billing', icon: Receipt },
  { href: '/platform/support', label: 'Support Console', icon: HeadphonesIcon },
  { href: '/platform/audit-log', label: 'Audit Log', icon: ScrollText },
  { href: '/platform/settings', label: 'Settings', icon: Settings },
];

function isActive(href: string, pathname: string) {
  if (href === '/platform/dashboard')
    return pathname === '/platform/dashboard' || pathname === '/platform';
  return pathname.startsWith(href);
}

export function PlatformAdminShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#312e81] bg-[#1e1b4b] px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7c3aed]">
            <span className="text-sm font-bold text-white">P</span>
          </div>
          <span className="font-serif text-base font-bold text-white">PLATFORM ADMIN</span>
        </div>
        <div className="mx-4 hidden max-w-[400px] flex-1 items-center gap-2 rounded-lg border border-[#312e81] bg-[#312e81]/50 px-3 py-1.5 sm:flex">
          <Search className="h-4 w-4 shrink-0 text-[#a5b4fc]" />
          <input
            type="text"
            placeholder="Search tenants, users..."
            className="w-full bg-transparent text-sm text-white placeholder:text-[#a5b4fc] outline-none"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-[#a5b4fc] md:block">j.smith@nexa.app</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7c3aed] text-xs font-semibold text-white">
            JS
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            'hidden shrink-0 flex-col border-r border-[#312e81] bg-[#1e1b4b] transition-all duration-200 lg:flex',
            collapsed ? 'w-16' : 'w-60',
          )}
        >
          <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label="Platform admin navigation">
            <div className="flex flex-col gap-0.5">
              {navItems.map((item) => {
                const active = isActive(item.href, pathname);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                      collapsed ? 'justify-center' : '',
                      active
                        ? 'bg-[#7c3aed] text-white shadow-sm'
                        : 'text-[#c7d2fe] hover:bg-[#312e81] hover:text-white',
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    {!collapsed && item.label}
                  </Link>
                );
              })}
            </div>
          </nav>
          <div className="shrink-0 border-t border-[#312e81] p-2">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex h-8 w-full items-center justify-center rounded-lg text-[#a5b4fc] transition-colors hover:bg-[#312e81] hover:text-white"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-[#f8fafc] p-6">{children}</main>
      </div>
    </div>
  );
}
