/* eslint-disable i18next/no-literal-string */
/**
 * Bank Reconciliation Rules Management — /finance/bank-recon-rules
 *
 * CRUD page for managing reconciliation rules that auto-match bank transactions
 * to GL accounts for quick journal creation.
 */

import { useState } from 'react';
import { Plus, Pencil, Trash2, Wand2, Check, X, Loader2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/templates/page-header';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import {
  useReconRules,
  useCreateReconRule,
  useDeleteReconRule,
} from '../hooks/use-bank-recon-rules';
import { updateReconRule } from '../api/bank-recon-rules-api';
import type { BankReconRule, CreateRuleInput, UpdateRuleInput } from '../api/bank-recon-rules-api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '@/lib/query-keys';

// ---------------------------------------------------------------------------
// Match type labels
// ---------------------------------------------------------------------------

const MATCH_TYPE_LABELS: Record<string, string> = {
  EXACT: 'Exact Match',
  STARTS_WITH: 'Starts With',
  CONTAINS: 'Contains',
  REGEX: 'Regex',
};

// ---------------------------------------------------------------------------
// Rule Form Dialog
// ---------------------------------------------------------------------------

interface RuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: BankReconRule | null; // null = create, non-null = edit
  onSubmit: (data: CreateRuleInput | UpdateRuleInput) => void;
  isPending: boolean;
}

function RuleFormDialog({ open, onOpenChange, rule, onSubmit, isPending }: RuleFormDialogProps) {
  const isEdit = !!rule;

  const [name, setName] = useState(rule?.name ?? '');
  const [matchType, setMatchType] = useState<string>(rule?.matchType ?? 'EXACT');
  const [matchPattern, setMatchPattern] = useState(rule?.matchPattern ?? '');
  const [targetAccountCode, setTargetAccountCode] = useState(rule?.targetAccountCode ?? '');
  const [description, setDescription] = useState(rule?.description ?? '');
  const [vatCode, setVatCode] = useState(rule?.vatCode ?? '');
  const [isActive, setIsActive] = useState(rule?.isActive ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name,
      matchType: matchType as CreateRuleInput['matchType'],
      matchPattern,
      targetAccountCode,
      description: description || undefined,
      vatCode: vatCode || undefined,
      isActive,
    };
    onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Rule' : 'New Reconciliation Rule'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the rule settings for auto-matching bank transactions.'
              : 'Create a rule to automatically match bank transactions to GL accounts.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rule-name">Rule Name</Label>
            <Input
              id="rule-name"
              placeholder="e.g. Rent Payment"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="match-type">Match Type</Label>
              <Select value={matchType} onValueChange={setMatchType}>
                <SelectTrigger id="match-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXACT">Exact Match</SelectItem>
                  <SelectItem value="STARTS_WITH">Starts With</SelectItem>
                  <SelectItem value="CONTAINS">Contains</SelectItem>
                  <SelectItem value="REGEX">Regex</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="target-account">Target Account</Label>
              <Input
                id="target-account"
                placeholder="e.g. 6000"
                value={targetAccountCode}
                onChange={(e) => setTargetAccountCode(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="match-pattern">Match Pattern</Label>
            <Input
              id="match-pattern"
              placeholder="e.g. DIRECT DEBIT - LANDLORD"
              value={matchPattern}
              onChange={(e) => setMatchPattern(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="Default journal description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vat-code">VAT Code (optional)</Label>
              <Input
                id="vat-code"
                placeholder="e.g. T1"
                value={vatCode}
                onChange={(e) => setVatCode(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch id="is-active" checked={isActive} onCheckedChange={setIsActive} />
            <Label htmlFor="is-active">Active</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function BankReconRulesPage() {
  const { data: rules, isLoading } = useReconRules();
  const createMutation = useCreateReconRule();
  const deleteMutation = useDeleteReconRule();
  const queryClient = useQueryClient();

  // Update mutation (inline, since useUpdateReconRule needs id upfront)
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRuleInput }) =>
      updateReconRule(id, input),
    onSuccess: () => {
      toast.success('Rule updated');
      void queryClient.invalidateQueries({
        queryKey: queryKeys.finance.bankReconRules(),
      });
    },
    onError: () => {
      toast.error('Failed to update rule');
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<BankReconRule | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleCreate = () => {
    setEditingRule(null);
    setDialogOpen(true);
  };

  const handleEdit = (rule: BankReconRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  };

  const handleSubmit = (data: CreateRuleInput | UpdateRuleInput) => {
    if (editingRule) {
      updateMutation.mutate(
        { id: editingRule.id, input: data as UpdateRuleInput },
        {
          onSuccess: () => setDialogOpen(false),
        },
      );
    } else {
      createMutation.mutate(data as CreateRuleInput, {
        onSuccess: () => setDialogOpen(false),
      });
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id, {
      onSuccess: () => setDeleteConfirmId(null),
    });
  };

  const breadcrumbs = [{ label: 'Finance', path: '/finance' }, { label: 'Reconciliation Rules' }];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Reconciliation Rules" breadcrumbs={breadcrumbs} isLoading />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reconciliation Rules"
        subtitle="Auto-match bank transactions to GL accounts"
        breadcrumbs={breadcrumbs}
        actionBarSlot={
          <Button onClick={handleCreate}>
            <Plus className="mr-2 size-4" />
            New Rule
          </Button>
        }
      />

      {!rules || rules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wand2 className="mb-4 size-12 text-muted-foreground/50" />
            <p className="mb-2 text-lg font-medium">No reconciliation rules</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Create rules to automatically match bank transactions to GL accounts.
            </p>
            <Button onClick={handleCreate} variant="outline">
              <Plus className="mr-2 size-4" />
              Create First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              {rules.length} rule{rules.length !== 1 ? 's' : ''} configured
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3">Rule Name</th>
                    <th className="text-left p-3">Match Type</th>
                    <th className="text-left p-3">Pattern</th>
                    <th className="text-left p-3">Target Account</th>
                    <th className="text-left p-3">VAT Code</th>
                    <th className="text-center p-3">Active</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 font-medium">{rule.name}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {MATCH_TYPE_LABELS[rule.matchType] ?? rule.matchType}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-xs max-w-[200px] truncate">
                        {rule.matchPattern}
                      </td>
                      <td className="p-3 font-mono text-xs">{rule.targetAccountCode}</td>
                      <td className="p-3 text-xs">{rule.vatCode ?? '\u2014'}</td>
                      <td className="p-3 text-center">
                        {rule.isActive ? (
                          <Check className="size-4 text-green-600 mx-auto" />
                        ) : (
                          <X className="size-4 text-muted-foreground mx-auto" />
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(rule)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmId(rule.id)}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <RuleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        rule={editingRule}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this reconciliation rule? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
