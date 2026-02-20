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

/**
 * Create a new task
 */
async function svcCreateTask(services, { userId, payload } = {}) {
  if (!userId) {
    throw new ValidationError('User context missing');
  }

  const { title, description, dueDate, courseCode, sourceUrl, workflowStatus, week } = payload;

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
  { userId, courseCode, includeCompleted = true, limit = 100 } = {},
) {
  if (!userId) {
    throw new ValidationError('User context missing');
  }

  return services.tasksRepo.listTasks({
    userId,
    courseCode: courseCode || null,
    includeCompleted,
    limit,
  });
}

/**
 * Get a single task
 */
async function svcGetTask(services, { userId, taskId } = {}) {
  if (!userId) {
    throw new ValidationError('User context missing');
  }
  if (!taskId) {
    throw new ValidationError('Task ID is required');
  }

  const task = await services.tasksRepo.getTask({ userId, taskId });
  if (!task) {
    throw new NotFoundError('Task not found');
  }
  return task;
}

/**
 * Update a task
 */
async function svcUpdateTask(services, { userId, taskId, payload, ifUnmodifiedSince = null } = {}) {
  if (!userId) {
    throw new ValidationError('User context missing');
  }
  if (!taskId) {
    throw new ValidationError('Task ID is required');
  }

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
  } = payload;

  // Validate title if provided
  if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
    throw new ValidationError('Task title cannot be empty');
  }

  const task = await services.tasksRepo.updateTask({
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

  services.logger.debug({ taskId, userId }, 'Task updated');
  return task;
}

/**
 * Toggle task completion status
 */
async function svcToggleCompleted(services, { userId, taskId } = {}) {
  if (!userId) {
    throw new ValidationError('User context missing');
  }
  if (!taskId) {
    throw new ValidationError('Task ID is required');
  }

  const task = await services.tasksRepo.toggleTaskCompleted({ userId, taskId });
  services.logger.debug({ taskId, userId, completed: task.completed }, 'Task completion toggled');
  return task;
}

/**
 * Delete a task
 */
async function svcDeleteTask(services, { userId, taskId } = {}) {
  if (!userId) {
    throw new ValidationError('User context missing');
  }
  if (!taskId) {
    throw new ValidationError('Task ID is required');
  }

  await services.tasksRepo.deleteTask({ userId, taskId });
  services.logger.info({ taskId, userId }, 'Task deleted');
}

/**
 * Reorder tasks (for drag-and-drop)
 */
async function svcReorderTasks(services, { userId, taskOrders } = {}) {
  if (!userId) {
    throw new ValidationError('User context missing');
  }
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
