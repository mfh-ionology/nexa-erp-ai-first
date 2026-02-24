/**
 * User avatar dropdown menu for the app header.
 *
 * Trigger: Avatar showing user initials with purple background.
 * Menu content:
 *   - User name + role · company name
 *   - My Profile (placeholder route)
 *   - Preferences (placeholder route)
 *   - Sign Out (clears auth, cache, navigates to /login)
 *
 * All labels via t() translation keys. Keyboard accessible:
 * Escape closes, arrow keys navigate, Enter selects.
 */

import { useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Settings, User } from 'lucide-react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/auth-store';
import { logout as apiLogout } from '@/lib/auth-api';

import { useI18n } from '@nexa/i18n';

export function UserMenu() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const permissions = useAuthStore((s) => s.permissions);
  const logoutStore = useAuthStore((s) => s.logout);

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : 'U';

  const fullName = user ? `${user.firstName} ${user.lastName}` : '';

  const handleSignOut = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Best-effort — clear local state even if API call fails
    }
    logoutStore();
    queryClient.clear();
    await navigate({ to: '/login' });
  }, [logoutStore, queryClient, navigate]);

  const handleNavigateProfile = useCallback(async () => {
    await navigate({ to: '/system/profile' as string });
  }, [navigate]);

  const handleNavigatePreferences = useCallback(async () => {
    await navigate({ to: '/system/preferences' as string });
  }, [navigate]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={t('navigation:userMenu')}
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-[#ede9fe] text-primary text-sm font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/* User info header */}
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold leading-none">{fullName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {permissions?.role ?? ''}{' '}
              {permissions?.companyId ? '·' : ''}{' '}
              {user?.email ?? ''}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Navigation items */}
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={handleNavigateProfile}>
            <User className="size-4" />
            {t('navigation:myProfile')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleNavigatePreferences}>
            <Settings className="size-4" />
            {t('navigation:preferences')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        {/* Sign out */}
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="size-4" />
          {t('common:signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
