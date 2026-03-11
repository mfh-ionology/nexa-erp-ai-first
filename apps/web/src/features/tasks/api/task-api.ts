/**
 * Task API client functions.
 *
 * Endpoints from E11.1 task routes:
 *   GET    /tasks              — list tasks with filters
 *   GET    /tasks/my           — current user's assigned tasks
 *   GET    /tasks/:id          — task detail with assignees
 *   POST   /tasks              — create task
 *   PATCH  /tasks/:id          — update task fields
 *   PATCH  /tasks/:id/status   — status transition
 *   POST   /tasks/:id/assignees        — add assignee
 *   DELETE /tasks/:id/assignees/:userId — remove assignee
 *   DELETE /tasks/:id          — soft-delete task
 */

import { apiGet, apiPost, apiPatch, apiDelete, buildQueryString } from '@/lib/api-client';

import type {
  Task,
  TaskStatus,
  TaskListResponse,
  CreateTaskInput,
  UpdateTaskInput,
  TaskListParams,
} from '../types';

// ---------------------------------------------------------------------------
// List tasks (general — with filters)
// ---------------------------------------------------------------------------

export async function listTasks(params: TaskListParams = {}): Promise<TaskListResponse> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const result = await apiGet<TaskListResponse>(`/tasks${qs}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// My tasks (current user's assigned tasks)
// ---------------------------------------------------------------------------

export async function getMyTasks(params: TaskListParams = {}): Promise<TaskListResponse> {
  const qs = buildQueryString(params as Record<string, unknown>);
  const result = await apiGet<TaskListResponse>(`/tasks/my${qs}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// Get single task
// ---------------------------------------------------------------------------

export async function getTask(id: string): Promise<Task> {
  const result = await apiGet<Task>(`/tasks/${encodeURIComponent(id)}`);
  return result.data;
}

// ---------------------------------------------------------------------------
// Create task
// ---------------------------------------------------------------------------

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const result = await apiPost<Task>('/tasks', input);
  return result.data;
}

// ---------------------------------------------------------------------------
// Update task (title, description, priority, dueDate)
// ---------------------------------------------------------------------------

export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
  const result = await apiPatch<Task>(`/tasks/${encodeURIComponent(id)}`, input);
  return result.data;
}

// ---------------------------------------------------------------------------
// Change task status
// ---------------------------------------------------------------------------

export async function changeTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  const result = await apiPatch<Task>(`/tasks/${encodeURIComponent(id)}/status`, { status });
  return result.data;
}

// ---------------------------------------------------------------------------
// Add assignee
// ---------------------------------------------------------------------------

export async function addAssignee(taskId: string, userId: string): Promise<void> {
  await apiPost(`/tasks/${encodeURIComponent(taskId)}/assignees`, { userId });
}

// ---------------------------------------------------------------------------
// Remove assignee
// ---------------------------------------------------------------------------

export async function removeAssignee(taskId: string, userId: string): Promise<void> {
  await apiDelete(`/tasks/${encodeURIComponent(taskId)}/assignees/${encodeURIComponent(userId)}`);
}

// ---------------------------------------------------------------------------
// Delete task (soft-delete)
// ---------------------------------------------------------------------------

export async function deleteTask(id: string): Promise<void> {
  await apiDelete(`/tasks/${encodeURIComponent(id)}`);
}
