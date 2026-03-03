import { PlatformAdminShell } from '@/components/platform-admin-shell';

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  return <PlatformAdminShell>{children}</PlatformAdminShell>;
}
