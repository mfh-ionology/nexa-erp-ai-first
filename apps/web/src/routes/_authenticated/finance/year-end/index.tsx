/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { YearEndWizardPage } from '@/features/finance/pages/YearEndWizardPage';

export const Route = createFileRoute('/_authenticated/finance/year-end/')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: YearEndWizardPage,
});
