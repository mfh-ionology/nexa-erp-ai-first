'use client';

import { useState } from 'react';
import { Bell, FileText, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

type Priority = 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW';

interface Notification {
  id: string;
  icon: typeof FileText;
  iconColor: string;
  title: string;
  description: string;
  timeAgo: string;
  read: boolean;
  priority: Priority;
}

const priorityBorder: Record<Priority, string> = {
  URGENT: 'border-l-[3px] border-l-[#ef4444]',
  HIGH: 'border-l-[3px] border-l-[#f59e0b]',
  NORMAL: '',
  LOW: '',
};

const initialNotifications: Notification[] = [
  {
    id: '1',
    icon: FileText,
    iconColor: '#7c3aed',
    title: 'Invoice INV-00234 approved',
    description: 'Sarah approved your invoice',
    timeAgo: '5 min ago',
    read: false,
    priority: 'NORMAL',
  },
  {
    id: '2',
    icon: AlertTriangle,
    iconColor: '#f59e0b',
    title: 'Payment overdue: CUST-00045',
    description: 'Acme Ltd has \u00a312,400 overdue',
    timeAgo: '1h ago',
    read: false,
    priority: 'HIGH',
  },
  {
    id: '3',
    icon: CheckCircle,
    iconColor: '#10b981',
    title: 'Payroll run completed',
    description: 'March payroll processed \u2014 24 slips',
    timeAgo: 'Yesterday',
    read: true,
    priority: 'NORMAL',
  },
  {
    id: '4',
    icon: FileText,
    iconColor: '#3b82f6',
    title: 'Credit note CN-00045 created',
    description: 'Auto-generated from return RET-0012',
    timeAgo: '2 days ago',
    read: true,
    priority: 'LOW',
  },
];

export function NotificationBell() {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [open, setOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const newNotifs = notifications.filter((n) => !n.read);
  const earlierNotifs = notifications.filter((n) => n.read);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const dismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell
            className={`h-4 w-4 ${unreadCount > 0 ? 'animate-[pulse_2s_ease-in-out_1]' : ''}`}
          />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#ef4444] text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0" sideOffset={8}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs font-medium text-[#7c3aed] hover:underline"
            >
              Mark All Read
            </button>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {/* New */}
          {newNotifs.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                New
              </p>
              {newNotifs.map((notif) => {
                const Icon = notif.icon;
                return (
                  <div
                    key={notif.id}
                    className={`group flex gap-3 px-4 py-3 transition-colors hover:bg-[#f5f3ff]/50 ${priorityBorder[notif.priority]}`}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: notif.iconColor }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{notif.title}</p>
                      <p className="text-xs text-muted-foreground">{notif.description}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{notif.timeAgo}</p>
                    </div>
                    <button
                      onClick={() => dismiss(notif.id)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                      aria-label="Dismiss"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {/* Earlier */}
          {earlierNotifs.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Earlier
              </p>
              {earlierNotifs.map((notif) => {
                const Icon = notif.icon;
                return (
                  <div
                    key={notif.id}
                    className={`group flex gap-3 px-4 py-3 opacity-70 transition-colors hover:bg-[#f5f3ff]/30 hover:opacity-100 ${priorityBorder[notif.priority]}`}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" style={{ color: notif.iconColor }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{notif.title}</p>
                      <p className="text-xs text-muted-foreground">{notif.description}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{notif.timeAgo}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 self-start mt-0.5">
                      Read
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {notifications.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">All caught up! No notifications.</p>
            </div>
          )}
        </div>
        <div className="border-t border-border px-4 py-2.5">
          <a
            href="/system/notification-preferences"
            className="text-xs font-medium text-[#7c3aed] hover:underline"
          >
            {'View All Notifications \u2192'}
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
