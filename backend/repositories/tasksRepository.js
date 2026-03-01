// backend/repositories/tasksRepository.js

const { supabase } = require('../db/supabaseClient');
const { ConflictError } = require('../errors');

/**
 * Repository for tasks CRUD operations.
 *
 * Design principles:
 * - Optimistic locking via updated_at for conflict detection
 * - Efficient queries with proper filtering
 * - Sorted by sort_order for manual reordering support
 */
const SUPABASE_NO_ROWS_CODE = 'PGRST116';

function createNotFoundError(message = 'Task not found') {
  const error = new Error(message);
  error.status = 404;
  return error;
}

function isNoRowsFoundError(error) {
  return error?.code === SUPABASE_NO_ROWS_CODE;
}

/**
 * Create a new task
 */
async function createTask({
  userId,
  title,
  description = null,
  completed = false,
  dueDate = null,
  courseCode = null,
  sourceUrl = null,
  sortOrder = 0,
  workflowStatus = 'backlog',
  week = null,
}) {
  const insertData = {
    user_id: userId,
    title,
    description,
    completed,
    due_date: dueDate,
    course_code: courseCode,
    source_url: sourceUrl,
    sort_order: sortOrder,
    workflow_status: workflowStatus,
    week,
  };

  const { data, error } = await supabase.from('tasks').insert(insertData).select().single();

  if (error) {
    console.error('Error creating task:', error);
    throw error;
  }
  return data;
}

/**
 * List tasks for a user with filtering options
 */
async function listTasks({ userId, courseCode = null, includeCompleted = true, limit = 100 }) {
  let query = supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('completed', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (courseCode) {
    query = query.eq('course_code', courseCode);
  }

  if (!includeCompleted) {
    query = query.eq('completed', false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Get a single task by ID for a user
 */
async function getTask({ userId, taskId }) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .eq('user_id', userId)
    .single();

  if (error) {
    if (isNoRowsFoundError(error)) {
      return null; // Not found
    }
    throw error;
  }
  return data;
}

/**
 * Update a task with optimistic locking support
 */

async function resolveUpdateNoRows({ userId, taskId, ifUnmodifiedSince }) {
  const existing = await getTask({ userId, taskId });
  if (!existing) {
    throw createNotFoundError();
  }

  if (ifUnmodifiedSince) {
    throw new ConflictError(
      'Task was modified by another session. Please refresh and try again.',
      existing.updated_at,
    );
  }

  throw createNotFoundError();
}

/**
 * Build update data object from provided fields
 */
function buildUpdateData({
  title,
  description,
  completed,
  dueDate,
  courseCode,
  sourceUrl,
  sortOrder,
  workflowStatus,
  week,
}) {
  const updateData = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (completed !== undefined) updateData.completed = completed;
  if (dueDate !== undefined) updateData.due_date = dueDate;
  if (courseCode !== undefined) updateData.course_code = courseCode;
  if (sourceUrl !== undefined) updateData.source_url = sourceUrl;
  if (sortOrder !== undefined) updateData.sort_order = sortOrder;
  if (workflowStatus !== undefined) updateData.workflow_status = workflowStatus;
  if (week !== undefined) updateData.week = week;
  return updateData;
}

async function updateTask({
  userId,
  taskId,
  title,
  description,
  completed,
  dueDate,
  courseCode,
  sourceUrl,
  sortOrder,
  workflowStatus,
  week,
  ifUnmodifiedSince = null,
}) {
  const updateData = buildUpdateData({
    title,
    description,
    completed,
    dueDate,
    courseCode,
    sourceUrl,
    sortOrder,
    workflowStatus,
    week,
  });

  // Skip update if no fields provided
  if (Object.keys(updateData).length === 0) {
    return getTask({ userId, taskId });
  }

  let query = supabase.from('tasks').update(updateData).eq('id', taskId).eq('user_id', userId);
  if (typeof ifUnmodifiedSince === 'string' && ifUnmodifiedSince.length > 0) {
    query = query.eq('updated_at', ifUnmodifiedSince);
  }

  const { data, error } = await query.select().single();

  if (error) {
    if (isNoRowsFoundError(error)) {
      await resolveUpdateNoRows({ userId, taskId, ifUnmodifiedSince });
    }
    throw error;
  }
  return data;
}

/**
 * Toggle task completion status
 */
async function toggleTaskCompleted({ userId, taskId }) {
  const existing = await getTask({ userId, taskId });
  if (!existing) {
    throw createNotFoundError();
  }

  return updateTask({
    userId,
    taskId,
    completed: !existing.completed,
  });
}

/**
 * Delete a task
 */
async function deleteTask({ userId, taskId }) {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId).eq('user_id', userId);

  if (error) throw error;
  return true;
}

/**
 * Batch update sort order for multiple tasks
 * Used for drag-and-drop reordering
 */
async function reorderTasks({ userId, taskOrders }) {
  // taskOrders is an array of { taskId, sortOrder }
  const updates = taskOrders.map(({ taskId, sortOrder }) =>
    supabase
      .from('tasks')
      .update({ sort_order: sortOrder })
      .eq('id', taskId)
      .eq('user_id', userId)
      .select('id')
      .single(),
  );

  const results = await Promise.all(updates);
  const errors = results.map((r) => r.error).filter(Boolean);
  if (errors.length > 0) {
    throw errors[0];
  }

  return true;
}

/**
 * Get the next sort order value for new tasks
 */
async function getNextSortOrder({ userId, courseCode = null }) {
  let query = supabase
    .from('tasks')
    .select('sort_order')
    .eq('user_id', userId)
    .eq('completed', false)
    .order('sort_order', { ascending: false })
    .limit(1);

  if (courseCode) {
    query = query.eq('course_code', courseCode);
  }

  const { data, error } = await query;
  if (error) throw error;

  if (data && data.length > 0) {
    const currentSort = Number(data[0].sort_order);
    return Number.isFinite(currentSort) ? currentSort + 1 : 0;
  }
  return 0;
}

module.exports = {
  createTask,
  listTasks,
  getTask,
  updateTask,
  toggleTaskCompleted,
  deleteTask,
  reorderTasks,
  getNextSortOrder,
  ConflictError,
};
