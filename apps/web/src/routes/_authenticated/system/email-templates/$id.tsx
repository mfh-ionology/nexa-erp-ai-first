import { createFileRoute } from '@tanstack/react-router';

import { EmailTemplateEditorPage } from '@/features/communications/email-templates/email-template-editor-page';

export const Route = createFileRoute('/_authenticated/system/email-templates/$id')({
  component: EmailTemplateDetailRoute,
});

/**
 * Extracts `id` from route params and passes to the editor page.
 * ADMIN guard is handled by the parent layout route.
 */
function EmailTemplateDetailRoute() {
  const { id } = Route.useParams();
  return <EmailTemplateEditorPage id={id} />;
}
