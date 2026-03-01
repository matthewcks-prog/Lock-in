// backend/controllers/tasks/crud.js

const HTTP_STATUS = require('../../constants/httpStatus');
const { tasksService } = require('../../services/tasks/tasksService');

/**
 * Tasks CRUD controller - Thin HTTP layer
 *
 * Validation handled by middleware (Zod schemas).
 * Business logic delegated to services.
 */

// POST /api/tasks
async function createTask(req, res, next) {
  try {
    const userId = req.user?.id;
    const task = await tasksService.createTask({ userId, payload: req.body });
    res.status(HTTP_STATUS.CREATED).json(task);
  } catch (err) {
    next(err);
  }
}

// GET /api/tasks
async function listTasks(req, res, next) {
  try {
    const userId = req.user?.id;
    const { courseCode, includeCompleted, limit } = req.query;
    const tasks = await tasksService.listTasks({
      userId,
      courseCode,
      includeCompleted: includeCompleted !== false,
      limit: limit ? Number(limit) : 100,
    });
    res.json(tasks);
  } catch (err) {
    next(err);
  }
}

// GET /api/tasks/:taskId
async function getTask(req, res, next) {
  try {
    const userId = req.user?.id;
    const { taskId } = req.params;
    const task = await tasksService.getTask({ userId, taskId });
    res.json(task);
  } catch (err) {
    next(err);
  }
}

// PUT /api/tasks/:taskId
async function updateTask(req, res, next) {
  try {
    const userId = req.user?.id;
    const { taskId } = req.params;
    const ifUnmodifiedSince = req.headers['if-unmodified-since'];

    const task = await tasksService.updateTask({
      userId,
      taskId,
      payload: req.body,
      ifUnmodifiedSince: typeof ifUnmodifiedSince === 'string' ? ifUnmodifiedSince : null,
    });

    res.json(task);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/tasks/:taskId
async function deleteTask(req, res, next) {
  try {
    const userId = req.user?.id;
    const { taskId } = req.params;
    await tasksService.deleteTask({ userId, taskId });
    res.status(HTTP_STATUS.NO_CONTENT).send();
  } catch (err) {
    next(err);
  }
}

// PATCH /api/tasks/:taskId/toggle
async function toggleCompleted(req, res, next) {
  try {
    const userId = req.user?.id;
    const { taskId } = req.params;
    const task = await tasksService.toggleCompleted({ userId, taskId });
    res.json(task);
  } catch (err) {
    next(err);
  }
}

// PUT /api/tasks/reorder
async function reorderTasks(req, res, next) {
  try {
    const userId = req.user?.id;
    const { taskOrders } = req.body;
    await tasksService.reorderTasks({ userId, taskOrders });
    res.status(HTTP_STATUS.NO_CONTENT).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createTask,
  listTasks,
  getTask,
  updateTask,
  deleteTask,
  toggleCompleted,
  reorderTasks,
};
