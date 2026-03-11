/**
 * React Query hooks for the Task API.
 *
 * - useMyTasks: current user's tasks (list query)
 * - useEntityTasks: tasks linked to a specific entity
 * - useTask: single task detail
 * - useCreateTask: create mutation
 * - useUpdateTask: update mutation
 * - useChangeTaskStatus: status transition mutation
 * - useAddAssignee / useRemoveAssignee: assignee mutations
 * - useDeleteTask: soft-delete mutation
 * - useBatchCompleteStatus: batch complete selected tasks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useI18n } from '@nexa/i18n';

import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';

import {
  getMyTasks,
  listTasks,
  getTask,
  createTask,
  updateTask,
  changeTaskStatus,
  addAssignee,
  removeAssignee,
  deleteTask,
} from '../api/task-api';
import type {
  Task,
  TaskStatus,
  TaskListResponse,
  CreateTaskInput,
  UpdateTaskInput,
  TaskListParams,
} from '../types';

// ---------------------------------------------------------------------------
// useMyTasks — current user's assigned tasks
// ---------------------------------------------------------------------------

export function useMyTasks(params: TaskListParams = {}) {
  const query = useQuery<TaskListResponse>({
    queryKey: queryKeys.tasks.my(params as Record<string, unknown>),
    queryFn: () => getMyTasks(params),
  });

  return {
    tasks: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  };
}

// ---------------------------------------------------------------------------
// useEntityTasks — tasks linked to a specific entity
// ---------------------------------------------------------------------------

export function useEntityTasks(entityType: string, entityId: string) {
  const query = useQuery<TaskListResponse>({
    queryKey: queryKeys.tasks.byEntity(entityType, entityId),
    queryFn: () => listTasks({ entityType, entityId }),
    enabled: !!entityType && !!entityId,
  });

  return {
    tasks: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  };
}

// ---------------------------------------------------------------------------
// useTask — single task detail
// ---------------------------------------------------------------------------

export function useTask(id: string | null | undefined) {
  const query = useQuery<Task>({
    queryKey: queryKeys.tasks.detail(id ?? ''),
    queryFn: () => getTask(id!),
    enabled: !!id,
  });

  return {
    task: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}

// ---------------------------------------------------------------------------
// useCreateTask — create mutation
// ---------------------------------------------------------------------------

export function useCreateTask() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast({ title: t('tasks.toast.created') });
    },
    onError: () => {
      toast({ title: t('tasks.toast.createFailed'), variant: 'destructive' });
    },
  });
}

// ---------------------------------------------------------------------------
// useUpdateTask — update mutation
// ---------------------------------------------------------------------------

export function useUpdateTask() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) => updateTask(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast({ title: t('tasks.toast.updated') });
    },
    onError: () => {
      toast({ title: t('tasks.toast.updateFailed'), variant: 'destructive' });
    },
  });
}

// ---------------------------------------------------------------------------
// useChangeTaskStatus — status transition mutation
// ---------------------------------------------------------------------------

export function useChangeTaskStatus() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      changeTaskStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast({ title: t('tasks.toast.statusChanged') });
    },
    onError: () => {
      toast({ title: t('tasks.toast.statusChangeFailed'), variant: 'destructive' });
    },
  });
}

// ---------------------------------------------------------------------------
// useAddAssignee — add assignee mutation
// ---------------------------------------------------------------------------

export function useAddAssignee() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, userId }: { taskId: string; userId: string }) =>
      addAssignee(taskId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
    onError: () => {
      toast({ title: t('tasks.toast.assigneeFailed'), variant: 'destructive' });
    },
  });
}

// ---------------------------------------------------------------------------
// useRemoveAssignee — remove assignee mutation
// ---------------------------------------------------------------------------

export function useRemoveAssignee() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, userId }: { taskId: string; userId: string }) =>
      removeAssignee(taskId, userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    },
    onError: () => {
      toast({ title: t('tasks.toast.assigneeFailed'), variant: 'destructive' });
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteTask — soft-delete mutation
// ---------------------------------------------------------------------------

export function useDeleteTask() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast({ title: t('tasks.toast.deleted') });
    },
    onError: () => {
      toast({ title: t('tasks.toast.deleteFailed'), variant: 'destructive' });
    },
  });
}

// ---------------------------------------------------------------------------
// useBatchCompleteStatus — batch complete selected tasks
// ---------------------------------------------------------------------------

export function useBatchCompleteStatus() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskIds: string[]) => {
      const results = await Promise.allSettled(
        taskIds.map((id) => changeTaskStatus(id, 'COMPLETED')),
      );
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0 && failures.length < taskIds.length) {
        throw new Error(`${failures.length}/${taskIds.length} failed`);
      }
      if (failures.length === taskIds.length) {
        throw new Error('All tasks failed to complete');
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast({ title: t('tasks.toast.statusChanged') });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast({ title: t('tasks.toast.statusChangeFailed'), variant: 'destructive' });
    },
  });
}

// ---------------------------------------------------------------------------
// useBatchCancelStatus — batch cancel selected tasks
// ---------------------------------------------------------------------------

export function useBatchCancelStatus() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskIds: string[]) => {
      const results = await Promise.allSettled(
        taskIds.map((id) => changeTaskStatus(id, 'CANCELLED')),
      );
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0 && failures.length < taskIds.length) {
        throw new Error(`${failures.length}/${taskIds.length} failed`);
      }
      if (failures.length === taskIds.length) {
        throw new Error('All tasks failed to cancel');
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast({ title: t('tasks.toast.statusChanged') });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      toast({ title: t('tasks.toast.statusChangeFailed'), variant: 'destructive' });
    },
  });
}
