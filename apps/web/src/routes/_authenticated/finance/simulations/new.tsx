import { createFileRoute } from '@tanstack/react-router';

import { SimulationForm } from '@/features/finance/simulations/SimulationForm';

export const Route = createFileRoute('/_authenticated/finance/simulations/new')({
  component: SimulationForm,
});
