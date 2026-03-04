import { createFileRoute } from '@tanstack/react-router';

import { EmailTemplateEditorPage } from '@/features/communications/email-templates/email-template-editor-page';

export const Route = createFileRoute('/_authenticated/system/email-templates/new')({
  component: EmailTemplateCreateRoute,
});

/**
 * Create new email template — renders the editor page in create mode (no id).
 * ADMIN guard is handled by the parent layout route.
 */
function EmailTemplateCreateRoute() {
  return <EmailTemplateEditorPage />;
}
