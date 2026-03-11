/**
 * CreateTaskDialog — modal form for creating a new task.
 *
 * Replicated from v0 reference `CreateTaskDialog` with adaptations:
 *   - React Hook Form + Zod validation (title 1–255 chars)
 *   - useCreateTask() mutation wired to API
 *   - i18n for all labels
 *   - EntityLinkChip when pre-filled from a panel context
 *   - UserMultiSelect for assignees
 *   - "Create" and "Create & Add Another" buttons
 *   - 560px max-w, animate-step-in animation
 */

import { useCallback, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

import { useI18n } from '@nexa/i18n';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { TaskPriority } from '../types';
import { useCreateTask } from '../hooks/use-tasks';
import { EntityLinkChip } from './EntityLinkChip';
import { UserMultiSelect } from './UserMultiSelect';

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const createTaskSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']),
  dueDate: z.date().optional(),
  assigneeIds: z.array(z.string()).optional(),
});

type CreateTaskFormValues = z.infer<typeof createTaskSchema>;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType?: string;
  entityId?: string;
  entityLabel?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateTaskDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityLabel,
}: CreateTaskDialogProps) {
  const { t } = useI18n();
  const createTask = useCreateTask();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateTaskFormValues>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'NORMAL',
      assigneeIds: [],
    },
  });

  const dueDate = watch('dueDate');

  const resetForm = useCallback(() => {
    reset({
      title: '',
      description: '',
      priority: 'NORMAL',
      dueDate: undefined,
      assigneeIds: [],
    });
  }, [reset]);

  const doCreate = useCallback(
    async (values: CreateTaskFormValues, keepOpen: boolean) => {
      await createTask.mutateAsync({
        title: values.title,
        description: values.description || undefined,
        priority: values.priority as TaskPriority,
        dueDate: values.dueDate ? values.dueDate.toISOString() : undefined,
        entityType: entityType || undefined,
        entityId: entityId || undefined,
        assigneeIds:
          values.assigneeIds && values.assigneeIds.length > 0 ? values.assigneeIds : undefined,
      });
      resetForm();
      if (!keepOpen) {
        onOpenChange(false);
      }
    },
    [createTask, entityType, entityId, resetForm, onOpenChange],
  );

  const onSubmitClose = handleSubmit((values) => doCreate(values, false));
  const onSubmitKeepOpen = handleSubmit((values) => doCreate(values, true));

  const handleClose = useCallback(
    (v: boolean) => {
      if (!v) resetForm();
      onOpenChange(v);
    },
    [onOpenChange, resetForm],
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] animate-step-in">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg">{t('tasks.create.title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmitClose} className="flex flex-col gap-4 pt-2">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('tasks.create.titleField')} <span className="text-[#ef4444]">*</span>
            </Label>
            <Input
              {...register('title')}
              placeholder="Chase Acme Ltd for outstanding payment"
              className="focus-visible:ring-[#7c3aed]/30"
            />
            {errors.title && (
              <p className="text-xs text-[#ef4444]">{t('tasks.create.titleRequired')}</p>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('tasks.create.description')}
            </Label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Follow up on invoice INV-00234 which is 15 days overdue..."
              className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-[#7c3aed]/30"
            />
          </div>

          {/* Priority + Due Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('tasks.create.priority')}
              </Label>
              <Controller
                name="priority"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="focus:ring-[#7c3aed]/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="URGENT">{t('tasks.priority.urgent')}</SelectItem>
                      <SelectItem value="HIGH">{t('tasks.priority.high')}</SelectItem>
                      <SelectItem value="NORMAL">{t('tasks.priority.normal')}</SelectItem>
                      <SelectItem value="LOW">{t('tasks.priority.low')}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('tasks.create.dueDate')}
              </Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className={`justify-start text-left font-normal focus:ring-[#7c3aed]/30 ${
                      !dueDate ? 'text-muted-foreground' : ''
                    }`}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'dd MMM yyyy') : t('tasks.create.pickDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={(date) => {
                      setValue('dueDate', date ?? undefined);
                      setCalendarOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Assignees */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('tasks.create.assignees')}
            </Label>
            <Controller
              name="assigneeIds"
              control={control}
              render={({ field }) => (
                <UserMultiSelect
                  value={field.value ?? []}
                  onChange={field.onChange}
                  disabled={createTask.isPending}
                />
              )}
            />
          </div>

          {/* Linked Record */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('tasks.create.linkedRecord')}
            </Label>
            {entityType && entityId ? (
              <EntityLinkChip entityType={entityType} entityId={entityId} label={entityLabel} />
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-[#f5f3ff] p-2.5 text-sm text-foreground">
                <span className="flex-1">{t('tasks.create.noLinkedRecord')}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleClose(false)}
              className="text-muted-foreground"
              disabled={createTask.isPending}
            >
              {t('tasks.detail.cancel')}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onSubmitKeepOpen}
              className="border-border hover:bg-[#f5f3ff]"
              disabled={createTask.isPending}
            >
              {t('tasks.create.submitAndAnother')}
            </Button>
            <Button
              type="submit"
              className="bg-[#7c3aed] text-white hover:bg-[#5b21b6]"
              disabled={createTask.isPending}
            >
              {t('tasks.create.submit')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
