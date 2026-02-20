/**
 * Tasks Service
 *
 * Platform-agnostic service layer for task management.
 * Wraps API client with domain logic and error handling.
 *
 * Design principles:
 * - No browser globals (pure TypeScript)
 * - Dependency injection for testability
 * - Clean domain model transformation
 */

import type { Task, CreateTaskInput, UpdateTaskInput } from '../domain/Task.ts';
import { normalizeTask, taskToPayload } from '../domain/Task.ts';
import { AppError, ErrorCodes } from '../errors';
import { createLogger, type Logger } from '../utils/logger';

export interface TaskRequestOptions {
  signal?: AbortSignal;
  expectedUpdatedAt?: string | null;
}

export interface TasksService {
  listTasks(params?: {
    courseCode?: string | null;
    includeCompleted?: boolean;
    limit?: number;
  }): Promise<Task[]>;
  getTask(taskId: string): Promise<Task>;
  createTask(input: CreateTaskInput, options?: TaskRequestOptions): Promise<Task>;
  updateTask(taskId: string, changes: UpdateTaskInput, options?: TaskRequestOptions): Promise<Task>;
  deleteTask(taskId: string): Promise<void>;
  toggleCompleted(taskId: string): Promise<Task>;
  reorderTasks(taskOrders: Array<{ taskId: string; sortOrder: number }>): Promise<void>;
}

export interface TasksServiceDependencies {
  logger?: Logger;
}

export interface TasksApiClient {
  listTasks(params?: {
    courseCode?: string;
    includeCompleted?: boolean;
    limit?: number;
  }): Promise<Array<Record<string, unknown>>>;
  getTask(taskId: string): Promise<Record<string, unknown>>;
  createTask(
    payload: Record<string, unknown> & { title: string },
    options?: { signal?: AbortSignal },
  ): Promise<Record<string, unknown>>;
  updateTask(
    taskId: string,
    payload: Record<string, unknown>,
    options?: { signal?: AbortSignal; ifUnmodifiedSince?: string },
  ): Promise<Record<string, unknown>>;
  deleteTask(taskId: string): Promise<void>;
  toggleTaskCompleted(taskId: string): Promise<Record<string, unknown>>;
  reorderTasks(taskOrders: Array<{ taskId: string; sortOrder: number }>): Promise<void>;
}

const defaultLogger = createLogger('TasksService');

function buildListTasks(apiClient: TasksApiClient, logger: Logger): TasksService['listTasks'] {
  return async (params = {}): Promise<Task[]> => {
    try {
      const { courseCode, includeCompleted = true, limit = 100 } = params;
      const rawTasks = await apiClient.listTasks({
        ...(courseCode !== undefined && courseCode !== null && courseCode.length > 0
          ? { courseCode }
          : {}),
        includeCompleted,
        limit,
      });
      return rawTasks.map(normalizeTask);
    } catch (error) {
      logger.error('Failed to list tasks', { error, params });
      throw wrapError(error, 'Failed to load tasks');
    }
  };
}

function buildGetTask(apiClient: TasksApiClient, logger: Logger): TasksService['getTask'] {
  return async (taskId: string): Promise<Task> => {
    if (taskId.length === 0) {
      throw new AppError('Task ID is required', ErrorCodes.VALIDATION_ERROR);
    }
    try {
      const raw = await apiClient.getTask(taskId);
      return normalizeTask(raw);
    } catch (error) {
      logger.error('Failed to get task', { error, taskId });
      throw wrapError(error, 'Failed to load task');
    }
  };
}

function buildCreateTask(apiClient: TasksApiClient, logger: Logger): TasksService['createTask'] {
  return async (input: CreateTaskInput, options?: TaskRequestOptions): Promise<Task> => {
    if (input.title.trim().length === 0) {
      throw new AppError('Task title is required', ErrorCodes.VALIDATION_ERROR);
    }

    try {
      const trimmedDescription = input.description?.trim();
      const payload = {
        title: input.title.trim(),
        description:
          trimmedDescription !== undefined && trimmedDescription.length > 0
            ? trimmedDescription
            : null,
        dueDate: input.dueDate ?? null,
        courseCode: input.courseCode ?? null,
        sourceUrl: input.sourceUrl ?? null,
        week: input.week ?? null,
      };

      const raw = await apiClient.createTask(payload, {
        ...(options?.signal !== undefined ? { signal: options.signal } : {}),
      });

      const task = normalizeTask(raw);
      logger.debug('Task created', { taskId: task.id });
      return task;
    } catch (error) {
      logger.error('Failed to create task', { error, input });
      throw wrapError(error, 'Failed to create task');
    }
  };
}

function buildUpdateTask(apiClient: TasksApiClient, logger: Logger): TasksService['updateTask'] {
  return async (
    taskId: string,
    changes: UpdateTaskInput,
    options?: TaskRequestOptions,
  ): Promise<Task> => {
    if (taskId.length === 0) {
      throw new AppError('Task ID is required', ErrorCodes.VALIDATION_ERROR);
    }

    if (changes.title !== undefined && changes.title.trim().length === 0) {
      throw new AppError('Task title cannot be empty', ErrorCodes.VALIDATION_ERROR);
    }

    try {
      const payload = taskToPayload(changes);
      const raw = await apiClient.updateTask(taskId, payload, {
        ...(options?.signal !== undefined ? { signal: options.signal } : {}),
        ...(options?.expectedUpdatedAt !== undefined && options.expectedUpdatedAt !== null
          ? { ifUnmodifiedSince: options.expectedUpdatedAt }
          : {}),
      });

      const task = normalizeTask(raw);
      logger.debug('Task updated', { taskId });
      return task;
    } catch (error) {
      logger.error('Failed to update task', { error, taskId, changes });
      throw wrapError(error, 'Failed to update task');
    }
  };
}

function buildDeleteTask(apiClient: TasksApiClient, logger: Logger): TasksService['deleteTask'] {
  return async (taskId: string): Promise<void> => {
    if (taskId.length === 0) {
      throw new AppError('Task ID is required', ErrorCodes.VALIDATION_ERROR);
    }

    try {
      await apiClient.deleteTask(taskId);
      logger.debug('Task deleted', { taskId });
    } catch (error) {
      logger.error('Failed to delete task', { error, taskId });
      throw wrapError(error, 'Failed to delete task');
    }
  };
}

function buildToggleCompleted(
  apiClient: TasksApiClient,
  logger: Logger,
): TasksService['toggleCompleted'] {
  return async (taskId: string): Promise<Task> => {
    if (taskId.length === 0) {
      throw new AppError('Task ID is required', ErrorCodes.VALIDATION_ERROR);
    }

    try {
      const raw = await apiClient.toggleTaskCompleted(taskId);
      const task = normalizeTask(raw);
      logger.debug('Task completion toggled', { taskId, completed: task.completed });
      return task;
    } catch (error) {
      logger.error('Failed to toggle task completion', { error, taskId });
      throw wrapError(error, 'Failed to toggle task');
    }
  };
}

function buildReorderTasks(
  apiClient: TasksApiClient,
  logger: Logger,
): TasksService['reorderTasks'] {
  return async (taskOrders: Array<{ taskId: string; sortOrder: number }>): Promise<void> => {
    if (taskOrders.length === 0) {
      return;
    }

    try {
      await apiClient.reorderTasks(taskOrders);
      logger.debug('Tasks reordered', { count: taskOrders.length });
    } catch (error) {
      logger.error('Failed to reorder tasks', { error, taskOrders });
      throw wrapError(error, 'Failed to reorder tasks');
    }
  };
}

/**
 * Create tasks service instance
 */
export function createTasksService(
  apiClient: TasksApiClient,
  deps: TasksServiceDependencies = {},
): TasksService {
  const logger = deps.logger ?? defaultLogger;

  return {
    listTasks: buildListTasks(apiClient, logger),
    getTask: buildGetTask(apiClient, logger),
    createTask: buildCreateTask(apiClient, logger),
    updateTask: buildUpdateTask(apiClient, logger),
    deleteTask: buildDeleteTask(apiClient, logger),
    toggleCompleted: buildToggleCompleted(apiClient, logger),
    reorderTasks: buildReorderTasks(apiClient, logger),
  };
}

/**
 * Wrap errors in AppError for consistent handling
 */
function wrapError(error: unknown, message: string): AppError {
  if (error instanceof AppError) {
    return error;
  }
  const originalMessage = error instanceof Error ? error.message : String(error);
  const options: { cause?: Error } = {};
  if (error instanceof Error) {
    options.cause = error;
  }
  return new AppError(`${message}: ${originalMessage}`, ErrorCodes.INTERNAL_ERROR, options);
}
