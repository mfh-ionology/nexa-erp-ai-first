/* eslint-disable i18next/no-literal-string */
/**
 * SimulationToggle — "Include Simulations" checkbox for reports.
 *
 * When enabled, the report API includes simulation journal entries
 * alongside real postings, allowing what-if analysis.
 */

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface SimulationToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function SimulationToggle({
  checked,
  onChange,
  label = 'Include Simulations',
}: SimulationToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id="include-simulations"
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
      />
      <Label htmlFor="include-simulations" className="cursor-pointer text-sm font-normal">
        {label}
      </Label>
    </div>
  );
}
