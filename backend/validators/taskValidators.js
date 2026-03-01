// backend/validators/taskValidators.js

const { z } = require('zod');

/**
 * Task Validation Schemas
 *
 * Declarative validation for task-related endpoints.
 * Follows the same pattern as noteValidators.js
 */

// UUID validation helper
const uuidSchema = z.string().uuid({ message: 'Must be a valid UUID' });

// Task title limits
const MAX_TASK_TITLE_LENGTH = 500;
const MAX_TASK_DESCRIPTION_LENGTH = 5000;
const MAX_COURSE_CODE_LENGTH = 50;
const MAX_WEEK_NUMBER = 52;
const MAX_LIST_LIMIT = 500;

/**
 * Schema for creating a task
 * POST /api/tasks
 */
const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Task title is required')
    .max(MAX_TASK_TITLE_LENGTH, `Title cannot exceed ${MAX_TASK_TITLE_LENGTH} characters`),
  description: z
    .string()
    .max(
      MAX_TASK_DESCRIPTION_LENGTH,
      `Description cannot exceed ${MAX_TASK_DESCRIPTION_LENGTH} characters`,
    )
    .optional()
    .nullable(),
  dueDate: z.string().datetime({ offset: true }).optional().nullable(),
  courseCode: z.string().max(MAX_COURSE_CODE_LENGTH).optional().nullable(),
  sourceUrl: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
  workflowStatus: z.enum(['backlog', 'in_progress', 'done']).optional(),
  week: z.number().int().min(1).max(MAX_WEEK_NUMBER).optional().nullable(),
});

/**
 * Schema for updating a task
 * PUT /api/tasks/:taskId
 */
const updateTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Task title cannot be empty')
    .max(MAX_TASK_TITLE_LENGTH, `Title cannot exceed ${MAX_TASK_TITLE_LENGTH} characters`)
    .optional(),
  description: z
    .string()
    .max(
      MAX_TASK_DESCRIPTION_LENGTH,
      `Description cannot exceed ${MAX_TASK_DESCRIPTION_LENGTH} characters`,
    )
    .optional()
    .nullable(),
  completed: z.boolean().optional(),
  dueDate: z.string().datetime({ offset: true }).optional().nullable(),
  courseCode: z.string().max(MAX_COURSE_CODE_LENGTH).optional().nullable(),
  sourceUrl: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
  sortOrder: z.number().int().min(0).optional(),
  workflowStatus: z.enum(['backlog', 'in_progress', 'done']).optional(),
  week: z.number().int().min(1).max(MAX_WEEK_NUMBER).optional().nullable(),
});

/**
 * Schema for task ID parameter
 * Used in GET/PUT/DELETE /api/tasks/:taskId
 */
const taskIdParamSchema = z.object({
  taskId: uuidSchema,
});

/**
 * Schema for listing tasks
 * GET /api/tasks
 */
const listTasksSchema = z.object({
  courseCode: z.string().optional(),
  includeCompleted: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
});

/**
 * Schema for toggling task completion
 * PATCH /api/tasks/:taskId/toggle
 */
const toggleTaskSchema = z.object({
  taskId: uuidSchema,
});

/**
 * Schema for reordering tasks
 * PUT /api/tasks/reorder
 */
const reorderTasksSchema = z.object({
  taskOrders: z
    .array(
      z.object({
        taskId: uuidSchema,
        sortOrder: z.number().int().min(0),
      }),
    )
    .min(1, 'At least one task order is required'),
});

module.exports = {
  createTaskSchema,
  updateTaskSchema,
  taskIdParamSchema,
  listTasksSchema,
  toggleTaskSchema,
  reorderTasksSchema,
  MAX_TASK_TITLE_LENGTH,
  MAX_TASK_DESCRIPTION_LENGTH,
  MAX_COURSE_CODE_LENGTH,
  MAX_WEEK_NUMBER,
  MAX_LIST_LIMIT,
};
