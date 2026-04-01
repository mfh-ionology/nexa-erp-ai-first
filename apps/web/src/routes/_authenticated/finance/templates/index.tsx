/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { JournalTemplateListPage } from '@/features/finance/pages/JournalTemplateListPage';

export const Route = createFileRoute('/_authenticated/finance/templates/')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: JournalTemplateListPage,
});
