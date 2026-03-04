import { createFileRoute } from '@tanstack/react-router';

import { EmailTemplateListPage } from '@/features/communications/email-templates/email-template-list-page';

export const Route = createFileRoute('/_authenticated/system/email-templates/')({
  component: EmailTemplateListPage,
});
