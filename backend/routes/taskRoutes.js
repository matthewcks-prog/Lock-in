// backend/routes/taskRoutes.js

const express = require('express');
const { requireSupabaseUser } = require('../middleware/authMiddleware');
const tasksController = require('../controllers/tasks/crud');
const { validate, validateQuery, validateParams } = require('../validators/middleware');
const {
  createTaskSchema,
  updateTaskSchema,
  taskIdParamSchema,
  listTasksSchema,
  reorderTasksSchema,
} = require('../validators/taskValidators');

const router = express.Router();

// All task routes require authentication
router.use(requireSupabaseUser);

// POST /api/tasks - Create a new task
router.post('/tasks', validate(createTaskSchema), tasksController.createTask);

// GET /api/tasks - List tasks with optional filtering
router.get('/tasks', validateQuery(listTasksSchema), tasksController.listTasks);

// PUT /api/tasks/reorder - Reorder multiple tasks (must be before :taskId routes)
router.put('/tasks/reorder', validate(reorderTasksSchema), tasksController.reorderTasks);

// GET /api/tasks/:taskId - Get a single task
router.get('/tasks/:taskId', validateParams(taskIdParamSchema), tasksController.getTask);

// PUT /api/tasks/:taskId - Update a task
router.put(
  '/tasks/:taskId',
  validateParams(taskIdParamSchema),
  validate(updateTaskSchema),
  tasksController.updateTask,
);

// DELETE /api/tasks/:taskId - Delete a task
router.delete('/tasks/:taskId', validateParams(taskIdParamSchema), tasksController.deleteTask);

// PATCH /api/tasks/:taskId/toggle - Toggle task completion
router.patch(
  '/tasks/:taskId/toggle',
  validateParams(taskIdParamSchema),
  tasksController.toggleCompleted,
);

module.exports = router;
