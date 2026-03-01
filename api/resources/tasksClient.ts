import type { ApiRequest, ApiRequestOptions } from '../fetcher';
import { validateTaskRecord, validateTaskRecords } from '../validation';

export interface ListTasksParams {
  courseCode?: string;
  includeCompleted?: boolean;
  limit?: number;
}

export interface TaskPayload {
  title?: string;
  description?: string | null;
  completed?: boolean;
  dueDate?: string | null;
  courseCode?: string | null;
  sourceUrl?: string | null;
  sortOrder?: number;
  workflowStatus?: string;
  week?: number | null;
}

export interface TaskOrderItem {
  taskId: string;
  sortOrder: number;
}

export type TasksClient = {
  createTask: (
    task: TaskPayload & { title: string },
    options?: ApiRequestOptions,
  ) => Promise<Record<string, unknown>>;
  listTasks: (params?: ListTasksParams) => Promise<Record<string, unknown>[]>;
  getTask: (taskId: string) => Promise<Record<string, unknown>>;
  updateTask: (
    taskId: string,
    task: TaskPayload,
    options?: ApiRequestOptions,
  ) => Promise<Record<string, unknown>>;
  deleteTask: (taskId: string) => Promise<void>;
  toggleTaskCompleted: (taskId: string) => Promise<Record<string, unknown>>;
  reorderTasks: (taskOrders: TaskOrderItem[]) => Promise<void>;
};

const DEFAULT_LIST_LIMIT = 100;
const MIN_LIST_LIMIT = 1;
const MAX_LIST_LIMIT = 500;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function resolveListLimit(limit: unknown): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) {
    return DEFAULT_LIST_LIMIT;
  }
  const normalized = Math.trunc(limit);
  if (normalized < MIN_LIST_LIMIT) {
    return MIN_LIST_LIMIT;
  }
  if (normalized > MAX_LIST_LIMIT) {
    return MAX_LIST_LIMIT;
  }
  return normalized;
}

async function createTaskRequest(
  apiRequest: ApiRequest,
  task: TaskPayload & { title: string },
  options?: ApiRequestOptions,
): Promise<Record<string, unknown>> {
  const raw = await apiRequest<unknown>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(task),
    ...options,
  });
  return validateTaskRecord(raw, 'createTask');
}

async function listTasksRequest(
  apiRequest: ApiRequest,
  params: ListTasksParams = {},
): Promise<Record<string, unknown>[]> {
  const { courseCode, includeCompleted = true, limit } = params;
  const queryParams = new URLSearchParams();
  if (isNonEmptyString(courseCode)) queryParams.set('courseCode', courseCode);
  if (includeCompleted === false) queryParams.set('includeCompleted', 'false');

  queryParams.set('limit', String(resolveListLimit(limit)));

  const query = queryParams.toString();
  const endpoint = `/api/tasks${query.length > 0 ? `?${query}` : ''}`;
  const raw = await apiRequest<unknown>(endpoint, {
    method: 'GET',
  });
  return validateTaskRecords(raw, 'listTasks');
}

async function getTaskRequest(
  apiRequest: ApiRequest,
  taskId: string,
): Promise<Record<string, unknown>> {
  if (!isNonEmptyString(taskId)) {
    throw new Error('taskId is required to get a task');
  }
  const raw = await apiRequest<unknown>(`/api/tasks/${taskId}`, {
    method: 'GET',
  });
  return validateTaskRecord(raw, 'getTask');
}

async function updateTaskRequest(
  apiRequest: ApiRequest,
  taskId: string,
  task: TaskPayload,
  options?: ApiRequestOptions,
): Promise<Record<string, unknown>> {
  if (!isNonEmptyString(taskId)) {
    throw new Error('taskId is required to update a task');
  }
  const raw = await apiRequest<unknown>(`/api/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(task),
    ...options,
  });
  return validateTaskRecord(raw, 'updateTask');
}

async function deleteTaskRequest(apiRequest: ApiRequest, taskId: string): Promise<void> {
  if (!isNonEmptyString(taskId)) {
    throw new Error('taskId is required to delete a task');
  }
  return apiRequest<void>(`/api/tasks/${taskId}`, {
    method: 'DELETE',
  });
}

async function toggleTaskCompletedRequest(
  apiRequest: ApiRequest,
  taskId: string,
): Promise<Record<string, unknown>> {
  if (!isNonEmptyString(taskId)) {
    throw new Error('taskId is required to toggle completion');
  }
  const raw = await apiRequest<unknown>(`/api/tasks/${taskId}/toggle`, {
    method: 'PATCH',
  });
  return validateTaskRecord(raw, 'toggleTaskCompleted');
}

async function reorderTasksRequest(
  apiRequest: ApiRequest,
  taskOrders: TaskOrderItem[],
): Promise<void> {
  if (!Array.isArray(taskOrders) || taskOrders.length === 0) {
    throw new Error('taskOrders array is required');
  }
  for (const item of taskOrders) {
    if (
      !isNonEmptyString(item.taskId) ||
      typeof item.sortOrder !== 'number' ||
      !Number.isFinite(item.sortOrder)
    ) {
      throw new Error('Each task order must include taskId and numeric sortOrder');
    }
  }
  return apiRequest<void>('/api/tasks/reorder', {
    method: 'PUT',
    body: JSON.stringify({ taskOrders }),
  });
}

/**
 * Create tasks API client
 *
 * Follows the same pattern as notesClient.ts for consistency.
 * Provides CRUD operations for study tasks.
 */
export function createTasksClient(apiRequest: ApiRequest): TasksClient {
  return {
    createTask: async (task, options) => createTaskRequest(apiRequest, task, options),
    listTasks: async (params) => listTasksRequest(apiRequest, params),
    getTask: async (taskId) => getTaskRequest(apiRequest, taskId),
    updateTask: async (taskId, task, options) =>
      updateTaskRequest(apiRequest, taskId, task, options),
    deleteTask: async (taskId) => deleteTaskRequest(apiRequest, taskId),
    toggleTaskCompleted: async (taskId) => toggleTaskCompletedRequest(apiRequest, taskId),
    reorderTasks: async (taskOrders) => reorderTasksRequest(apiRequest, taskOrders),
  };
}
