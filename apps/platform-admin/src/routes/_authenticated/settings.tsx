import { createFileRoute } from '@tanstack/react-router';

import { PlaceholderPage } from '@/components/layout/placeholder-page';

export const Route = createFileRoute('/_authenticated/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <PlaceholderPage
      title="Settings"
      description="Manage platform administrators and global configuration."
      epicReference="Coming in a future epic"
    />
  );
}
