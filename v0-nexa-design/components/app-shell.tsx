'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Landmark,
  FileText,
  Receipt,
  ShoppingCart,
  Package,
  Warehouse,
  Users as UsersIcon,
  Briefcase,
  Factory,
  BarChart3,
  Settings,
  Shield,
  Search,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Menu,
  Sparkles,
  Sun,
  Brain,
  Zap,
  MessageCircle,
  Cpu,
  Bot,
  Workflow,
  BookOpen,
  Globe,
  CheckSquare,
  Mail,
  Printer,
  FileStack,
  BellRing,
  MonitorCog,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { CopilotDrawer } from '@/components/ai/copilot-drawer';
import { NotificationBell } from '@/components/notifications/notification-bell';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Main',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/finance', label: 'Finance', icon: Landmark },
      { href: '/invoices', label: 'AR', icon: FileText },
      { href: '/ap', label: 'AP', icon: Receipt },
      { href: '/tasks', label: 'My Tasks', icon: CheckSquare },
    ],
  },
  {
    title: 'Operations',
    items: [
      { href: '/sales', label: 'Sales', icon: ShoppingCart },
      { href: '/purchasing', label: 'Purchasing', icon: CreditCard },
      { href: '/inventory', label: 'Inventory', icon: Warehouse },
    ],
  },
  {
    title: 'Other',
    items: [
      { href: '/crm', label: 'CRM', icon: Briefcase },
      { href: '/hr', label: 'HR & Payroll', icon: UsersIcon },
      { href: '/manufacturing', label: 'Manufacturing', icon: Factory },
      { href: '/reporting', label: 'Reporting', icon: BarChart3 },
    ],
  },
  {
    title: 'AI',
    items: [
      { href: '/ai/briefing', label: 'Morning Briefing', icon: Sun },
      { href: '/ai/memory', label: 'My Memory', icon: Brain },
      { href: '/ai/skills', label: 'Skills', icon: Zap },
      { href: '/ai/configuration', label: 'Configuration', icon: Cpu },
      { href: '/ai/agents-skills', label: 'Agents & Skills', icon: Bot },
      { href: '/ai/automations', label: 'Automations', icon: Workflow },
      { href: '/ai/knowledge', label: 'Knowledge Base', icon: BookOpen },
      { href: '/ai/intelligence', label: 'Intelligence', icon: Globe },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/system/notification-preferences', label: 'Notifications', icon: BellRing },
      { href: '/system/email-templates/invoice-overdue', label: 'Email Templates', icon: Mail },
      { href: '/system/document-templates', label: 'Document Templates', icon: FileStack },
      { href: '/system/print-preferences', label: 'Print Preferences', icon: Printer },
      { href: '/platform/dashboard', label: 'Platform Admin', icon: MonitorCog },
    ],
  },
  {
    title: 'Admin',
    items: [
      { href: '/settings', label: 'System Settings', icon: Settings },
      { href: '/users', label: 'Users', icon: UsersIcon },
      { href: '/access-groups', label: 'Access Groups', icon: Shield },
    ],
  },
];

function isActivePath(href: string, pathname: string) {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {navGroups.map((group, groupIdx) => (
        <div key={group.title} className={cn(groupIdx > 0 && 'mt-4')}>
          {(group.title === 'Admin' || group.title === 'AI' || group.title === 'System') && (
            <div className="mx-2 mb-3 border-t border-border" />
          )}
          <span className="mb-1.5 block px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.title}
          </span>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActivePath(item.href, pathname);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-[#7c3aed] text-white shadow-sm'
                      : 'text-muted-foreground hover:bg-[#f5f3ff] hover:text-foreground',
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function NexaLogo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#7c3aed]">
        <span className="text-sm font-bold text-white">N</span>
      </div>
      <span className="font-serif text-base font-bold text-foreground">Nexa ERP</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Top Header Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="border-b border-border px-4 py-3">
                <SheetTitle className="text-base">
                  <NexaLogo />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Mobile navigation">
                <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
              </nav>
            </SheetContent>
          </Sheet>

          {/* Logo - visible on mobile */}
          <div className="lg:hidden">
            <NexaLogo />
          </div>
        </div>

        {/* Centre search */}
        <div className="mx-4 hidden max-w-[400px] flex-1 items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-1.5 sm:flex">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search or ask Nexa anything..."
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground md:block">Mon, 17 Feb 2026</span>
          <CopilotDrawer />
          <NotificationBell />
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#7c3aed] text-xs font-semibold text-white">
              SC
            </div>
            <span className="hidden text-sm font-medium text-foreground sm:block">Sarah</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        <aside
          className={cn(
            'hidden shrink-0 flex-col border-r border-border bg-card transition-all duration-200 lg:flex',
            collapsed ? 'w-16' : 'w-64',
          )}
        >
          {/* Company switcher */}
          <div
            className={cn('shrink-0 border-b border-border', collapsed ? 'px-2 py-3' : 'px-4 py-3')}
          >
            {collapsed ? (
              <div className="flex h-8 w-full items-center justify-center rounded-lg bg-accent text-xs font-bold text-foreground">
                MM
              </div>
            ) : (
              <button className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent">
                <span className="text-sm font-medium text-foreground truncate max-w-[170px]">
                  Meridian Manufacturing Ltd
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Desktop Navigation */}
          <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Main navigation">
            {collapsed ? (
              /* Collapsed: icon-only links */
              <>
                {navGroups.map((group, groupIdx) => (
                  <div key={group.title} className={cn(groupIdx > 0 && 'mt-3')}>
                    {(group.title === 'Admin' ||
                      group.title === 'AI' ||
                      group.title === 'System') && (
                      <div className="mx-1 mb-3 border-t border-border" />
                    )}
                    <div className="flex flex-col gap-0.5">
                      {group.items.map((item) => {
                        const active = isActivePath(item.href, pathname);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            title={item.label}
                            className={cn(
                              'flex h-9 w-full items-center justify-center rounded-lg transition-colors',
                              active
                                ? 'bg-[#7c3aed] text-white shadow-sm'
                                : 'text-muted-foreground hover:bg-[#f5f3ff] hover:text-foreground',
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            ) : (
              /* Expanded: full links */
              <NavLinks pathname={pathname} />
            )}
          </nav>

          {/* Collapse toggle */}
          <div className="shrink-0 border-t border-border p-2">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex h-8 w-full items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-background p-6">{children}</main>
      </div>
    </div>
  );
}
