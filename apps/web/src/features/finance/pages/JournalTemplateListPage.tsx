/* eslint-disable i18next/no-literal-string */
/**
 * FE11: Journal Templates List Page — /finance/templates
 *
 * Uses T1 (EntityListPage) template. Lists journal templates with
 * frequency, next due date, and execute action.
 */

import { useMemo, useState, useCallback } from 'react';
import type { ColumnDef } from '@tanstack/react-table';

import { EntityListPage } from '@/components/templates/entity-list-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Play } from 'lucide-react';

import {
  useJournalTemplates,
  useCreateJournalTemplate,
  useExecuteJournalTemplate,
} from '../hooks/use-journal-templates';
import type { JournalTemplate, JournalTemplateListParams, TemplateFrequency } from '../types';

const FREQUENCY_LABELS: Record<string, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  YEARLY: 'Yearly',
  MANUAL: 'Manual',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function JournalTemplateListPage() {
  const [search, setSearch] = useState('');
  const [params] = useState<JournalTemplateListParams>({});
  const { templates, isLoading } = useJournalTemplates({
    ...params,
    search: search || undefined,
  });
  const createMutation = useCreateJournalTemplate();
  const executeMutation = useExecuteJournalTemplate();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFrequency, setNewFrequency] = useState<TemplateFrequency>('MONTHLY');

  const handleCreateNew = useCallback(() => {
    setNewName('');
    setNewFrequency('MONTHLY');
    setShowCreateDialog(true);
  }, []);

  const handleCreateSubmit = useCallback(() => {
    if (!newName.trim()) return;
    createMutation.mutate(
      {
        name: newName.trim(),
        frequency: newFrequency,
        lines: [],
      },
      {
        onSuccess: () => {
          setShowCreateDialog(false);
        },
      },
    );
  }, [createMutation, newName, newFrequency]);

  const handleExecute = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      executeMutation.mutate(id);
    },
    [executeMutation],
  );

  const columns = useMemo<ColumnDef<JournalTemplate>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Template Name',
        cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
      },
      {
        accessorKey: 'frequency',
        header: 'Frequency',
        cell: ({ getValue }) => {
          const freq = getValue<string>();
          return <Badge variant="outline">{FREQUENCY_LABELS[freq] ?? freq}</Badge>;
        },
      },
      {
        accessorKey: 'nextDueDate',
        header: 'Next Due',
        cell: ({ getValue }) => formatDate(getValue<string | null>()),
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        cell: ({ getValue }) => {
          const active = getValue<boolean>();
          return (
            <Badge variant={active ? 'default' : 'secondary'}>
              {active ? 'Active' : 'Inactive'}
            </Badge>
          );
        },
      },
      {
        id: 'lineCount',
        header: 'Lines',
        cell: ({ row }) => row.original.lines?.length ?? 0,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => handleExecute(e, row.original.id)}
            disabled={!row.original.isActive || executeMutation.isPending}
            title="Execute template"
          >
            {executeMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
          </Button>
        ),
      },
    ],
    [handleExecute, executeMutation.isPending],
  );

  return (
    <>
      <EntityListPage<JournalTemplate>
        title="Journal Templates"
        subtitle="Recurring journal entry templates"
        breadcrumbs={[{ label: 'Finance', path: '/finance' }, { label: 'Templates' }]}
        entityType="journal-template"
        columns={columns}
        data={templates}
        isLoading={isLoading}
        canCreate
        onCreateNew={handleCreateNew}
        getRowId={(row) => row.id}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search templates..."
      />

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Journal Template</DialogTitle>
            <DialogDescription>Define a new recurring journal entry template.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Monthly Depreciation"
              />
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                value={newFrequency}
                onValueChange={(v) => setNewFrequency(v as TemplateFrequency)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSubmit}
              disabled={!newName.trim() || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
