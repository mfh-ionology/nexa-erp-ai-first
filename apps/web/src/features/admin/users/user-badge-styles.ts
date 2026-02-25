import type { UserRole } from './api/types';

export const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  SUPER_ADMIN: 'bg-[#ede9fe] text-[#7c3aed] border-[#c4b5fd]',
  ADMIN: 'bg-[#dbeafe] text-[#3b82f6] border-[#93c5fd]',
  MANAGER: 'bg-[#d1fae5] text-[#10b981] border-[#6ee7b7]',
  STAFF: 'bg-secondary text-secondary-foreground border-transparent',
  VIEWER: 'bg-muted text-muted-foreground border-transparent',
};

export const STATUS_BADGE_STYLES = {
  active: 'bg-[#d1fae5] text-[#10b981] border-[#6ee7b7]',
  inactive: 'bg-muted text-muted-foreground border-transparent',
} as const;
