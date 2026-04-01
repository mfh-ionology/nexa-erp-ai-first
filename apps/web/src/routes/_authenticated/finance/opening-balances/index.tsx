/* eslint-disable i18next/no-literal-string */
import { createFileRoute } from '@tanstack/react-router';

import { createModuleBeforeLoad } from '@/lib/route-guards';
import { OpeningBalancesPage } from '@/features/finance/pages/OpeningBalancesPage';

export const Route = createFileRoute('/_authenticated/finance/opening-balances/')({
  beforeLoad: createModuleBeforeLoad('finance'),
  component: OpeningBalancesPage,
});
