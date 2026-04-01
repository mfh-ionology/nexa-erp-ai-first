import { createFileRoute } from '@tanstack/react-router';

import { SimulationList } from '@/features/finance/simulations/SimulationList';

export const Route = createFileRoute('/_authenticated/finance/simulations/')({
  component: SimulationList,
});
