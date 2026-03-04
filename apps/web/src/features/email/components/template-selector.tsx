/* eslint-disable i18next/no-literal-string */
/**
 * TemplateSelector — dropdown for switching email templates.
 *
 * Fetches available templates for a document type from the API.
 * "Reset to Template" ghost button repopulates subject/body with
 * the selected template's rendered output.
 *
 * E10-3 Task 5.5
 */

import { RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

export interface EmailTemplateOption {
  id: string;
  code: string;
  name: string;
  description?: string | null;
}

interface TemplateSelectorProps {
  templates: EmailTemplateOption[];
  isLoading: boolean;
  selectedTemplateId: string | undefined;
  onTemplateChange: (templateId: string) => void;
  onResetToTemplate: () => void;
  disabled?: boolean;
}

export function TemplateSelector({
  templates,
  isLoading,
  selectedTemplateId,
  onTemplateChange,
  onResetToTemplate,
  disabled = false,
}: TemplateSelectorProps) {
  if (isLoading) {
    return <Skeleton className="h-9 w-full" />;
  }

  if (templates.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Select value={selectedTemplateId} onValueChange={onTemplateChange} disabled={disabled}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Select template" />
          </SelectTrigger>
          <SelectContent>
            {templates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onResetToTemplate}
        disabled={disabled}
        className="gap-1 text-xs text-muted-foreground hover:text-[#7c3aed]"
      >
        <RotateCcw className="size-3" />
        Reset to Template
      </Button>
    </div>
  );
}
