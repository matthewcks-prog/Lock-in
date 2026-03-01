// backend/services/tasks/tasksService.js

const { ValidationError, NotFoundError } = require('../../errors');
const { logger: baseLogger } = require('../../observability');
const tasksRepo = require('../../repositories/tasksRepository');

/**
 * Tasks Service
 *
 * Business logic for task management.
 * Controllers delegate to this service - no direct repo access.
 *
 * Design principles:
 * - Validation at service boundary
 * - Dependency injection for testability
 * - Clean separation from HTTP layer
 */

function createTasksService(deps = {}) {
  const services = {
    tasksRepo: deps.tasksRepo ?? tasksRepo,
    logger: deps.logger ?? baseLogger,
  };

  return {
    createTask: (args) => svcCreateTask(services, args),
    listTasks: (args) => svcListTasks(services, args),
    getTask: (args) => svcGetTask(services, args),
    updateTask: (args) => svcUpdateTask(services, args),
    toggleCompleted: (args) => svcToggleCompleted(services, args),
    deleteTask: (args) => svcDeleteTask(services, args),
    reorderTasks: (args) => svcReorderTasks(services, args),
  };
}

const LIST_TASKS_DEFAULT_LIMIT = 100;
const LIST_TASKS_MAX_LIMIT = 500;
const HTTP_STATUS_NOT_FOUND = 404;

function ensureUserContext(userId) {
  if (!userId) {
    throw new ValidationError('User context missing');
  }
}

function ensureTaskId(taskId) {
  if (!taskId || typeof taskId !== 'string') {
    throw new ValidationError('Task ID is required');
  }
}

function normalizeListLimit(limit) {
  if (!Number.isFinite(limit)) {
    return LIST_TASKS_DEFAULT_LIMIT;
  }
  const normalized = Math.trunc(limit);
  if (normalized < 1) {
    return 1;
  }
  if (normalized > LIST_TASKS_MAX_LIMIT) {
    return LIST_TASKS_MAX_LIMIT;
  }
  return normalized;
}

function remapUpdateError(error, taskId) {
  if (error?.code === 'CONFLICT' || error?.name === 'ConflictError') {
    return error;
  }
  if (error?.status === HTTP_STATUS_NOT_FOUND) {
    return new NotFoundError('Task', taskId);
  }
  return error;
}

/**
 * Create a new task
 */
async function svcCreateTask(services, { userId, payload } = {}) {
  ensureUserContext(userId);
  const input = payload ?? {};
  const { title, description, dueDate, courseCode, sourceUrl, workflowStatus, week } = input;

  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new ValidationError('Task title is required');
  }

  // Get next sort order for proper ordering
  const sortOrder = await services.tasksRepo.getNextSortOrder({
    userId,
    courseCode: courseCode || null,
  });

  const task = await services.tasksRepo.createTask({
    userId,
    title: title.trim(),
    description: description?.trim() || null,
    dueDate: dueDate || null,
    courseCode: courseCode || null,
    sourceUrl: sourceUrl || null,
    sortOrder,
    workflowStatus: workflowStatus || 'backlog',
    week: week ?? null,
  });

  services.logger.info({ taskId: task.id, userId }, 'Task created');
  return task;
}

/**
 * List tasks for a user
 */
async function svcListTasks(
  services,
  { userId, courseCode, includeCompleted = true, limit = LIST_TASKS_DEFAULT_LIMIT } = {},
) {
  ensureUserContext(userId);

  return services.tasksRepo.listTasks({
    userId,
    courseCode: courseCode || null,
    includeCompleted: includeCompleted !== false,
    limit: normalizeListLimit(limit),
  });
}

/**
 * Get a single task
 */
async function svcGetTask(services, { userId, taskId } = {}) {
  ensureUserContext(userId);
  ensureTaskId(taskId);

  const task = await services.tasksRepo.getTask({ userId, taskId });
  if (!task) {
    throw new NotFoundError('Task', taskId);
  }
  return task;
}

/**
 * Update a task
 */
async function svcUpdateTask(services, { userId, taskId, payload, ifUnmodifiedSince = null } = {}) {
  ensureUserContext(userId);
  ensureTaskId(taskId);
  const input = payload ?? {};

  const {
    title,
    description,
    completed,
    dueDate,
    courseCode,
    sourceUrl,
    sortOrder,
    workflowStatus,
    week,
  } = input;

  // Validate title if provided
  if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
    throw new ValidationError('Task title cannot be empty');
  }

  let task;
  try {
    task = await services.tasksRepo.updateTask({
      userId,
      taskId,
      title: title?.trim(),
      description: description !== undefined ? description?.trim() || null : undefined,
      completed,
      dueDate,
      courseCode,
      sourceUrl,
      sortOrder,
      workflowStatus,
      week,
      ifUnmodifiedSince,
    });
  } catch (error) {
    throw remapUpdateError(error, taskId);
  }

  services.logger.debug({ taskId, userId }, 'Task updated');
  return task;
}

/**
 * Toggle task completion status
 */
async function svcToggleCompleted(services, { userId, taskId } = {}) {
  ensureUserContext(userId);
  ensureTaskId(taskId);

  const task = await services.tasksRepo.toggleTaskCompleted({ userId, taskId });
  services.logger.debug({ taskId, userId, completed: task.completed }, 'Task completion toggled');
  return task;
}

/**
 * Delete a task
 */
async function svcDeleteTask(services, { userId, taskId } = {}) {
  ensureUserContext(userId);
  ensureTaskId(taskId);

  await services.tasksRepo.deleteTask({ userId, taskId });
  services.logger.info({ taskId, userId }, 'Task deleted');
}

/**
 * Reorder tasks (for drag-and-drop)
 */
async function svcReorderTasks(services, { userId, taskOrders } = {}) {
  ensureUserContext(userId);
  if (!Array.isArray(taskOrders) || taskOrders.length === 0) {
    throw new ValidationError('Task orders array is required');
  }

  // Validate each order item
  for (const item of taskOrders) {
    if (!item.taskId || typeof item.sortOrder !== 'number') {
      throw new ValidationError('Each task order must have taskId and sortOrder');
    }
  }

  await services.tasksRepo.reorderTasks({ userId, taskOrders });
  services.logger.debug({ userId, count: taskOrders.length }, 'Tasks reordered');
}

// Default instance for convenience
const tasksService = createTasksService();

module.exports = {
  createTasksService,
  tasksService,
};
