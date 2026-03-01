/**
 * Task domain model (UI agnostic).
 *
 * Represents study tasks within the Lock-in sidebar.
 * Designed for iPhone Notes-style simplicity with study context.
 */

/**
 * Task status for tracking edit/save state
 */
export type TaskStatus = 'idle' | 'editing' | 'saving' | 'saved' | 'error';

/**
 * Filter options for task lists
 */
export type TaskFilter = 'all' | 'active' | 'completed' | 'course';

/**
 * Task priority levels (for future use)
 */
export type TaskPriority = 'low' | 'medium' | 'high';

/**
 * Workflow status for Kanban board columns
 */
export type TaskWorkflowStatus = 'backlog' | 'in_progress' | 'done';

export const TASK_WORKFLOW_STATUSES: readonly TaskWorkflowStatus[] = [
  'backlog',
  'in_progress',
  'done',
] as const;

export const TASK_WORKFLOW_STATUS_LABELS: Record<TaskWorkflowStatus, string> = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  done: 'Done',
};

export function isTaskWorkflowStatus(value: unknown): value is TaskWorkflowStatus {
  return (
    value === TASK_WORKFLOW_STATUSES[0] ||
    value === TASK_WORKFLOW_STATUSES[1] ||
    value === TASK_WORKFLOW_STATUSES[2]
  );
}

/**
 * View mode for tasks panel
 */
export type TasksViewMode = 'list' | 'board';

/**
 * Core task domain model
 */
export interface Task {
  /** Unique identifier (null for unsaved tasks) */
  id: string | null;
  /** Task title (required) */
  title: string;
  /** Optional description or notes */
  description: string | null;
  /** Whether the task is completed */
  completed: boolean;
  /** Timestamp when task was completed (ISO string) */
  completedAt: string | null;
  /** Optional due date (ISO string) */
  dueDate: string | null;
  /** Course code for filtering (e.g., 'FIT1045') */
  courseCode: string | null;
  /** URL where task was created */
  sourceUrl: string | null;
  /** Sort order for manual ordering */
  sortOrder: number;
  /** Kanban board workflow status */
  workflowStatus: TaskWorkflowStatus;
  /** Study week number (e.g. 1–13), null if unassigned */
  week: number | null;
  /** Creation timestamp (ISO string) */
  createdAt: string | null;
  /** Last update timestamp (ISO string) */
  updatedAt: string | null;
}

/**
 * Input for creating a new task
 */
export interface CreateTaskInput {
  title: string;
  description?: string | null;
  dueDate?: string | null;
  courseCode?: string | null;
  sourceUrl?: string | null;
  workflowStatus?: TaskWorkflowStatus;
  week?: number | null;
}

/**
 * Input for updating an existing task
 */
export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  completed?: boolean;
  dueDate?: string | null;
  courseCode?: string | null;
  sourceUrl?: string | null;
  sortOrder?: number;
  workflowStatus?: TaskWorkflowStatus;
  week?: number | null;
}

/**
 * Create a new task with defaults
 */
export function createEmptyTask(defaults: Partial<Task> = {}): Task {
  return {
    id: null,
    title: '',
    description: null,
    completed: false,
    completedAt: null,
    dueDate: null,
    courseCode: defaults.courseCode ?? null,
    sourceUrl: defaults.sourceUrl ?? null,
    sortOrder: 0,
    workflowStatus: defaults.workflowStatus ?? 'backlog',
    week: defaults.week ?? null,
    createdAt: null,
    updatedAt: null,
    ...defaults,
  };
}

/**
 * Check if a task has unsaved changes
 */
export function isTaskDirty(task: Task, original: Task | null): boolean {
  if (original === null) return task.title.trim().length > 0;
  return (
    task.title !== original.title ||
    task.description !== original.description ||
    task.completed !== original.completed ||
    task.dueDate !== original.dueDate ||
    task.courseCode !== original.courseCode ||
    task.workflowStatus !== original.workflowStatus ||
    task.week !== original.week
  );
}

function rawStr(raw: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'string') return v;
  }
  return null;
}

function rawNum(raw: Record<string, unknown>, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'number') return v;
  }
  return null;
}

function rawBool(raw: Record<string, unknown>, ...keys: string[]): boolean | null {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'boolean') return v;
  }
  return null;
}

function normalizeWorkflowStatus(raw: Record<string, unknown>): TaskWorkflowStatus {
  const status = rawStr(raw, 'workflow_status', 'workflowStatus');
  return isTaskWorkflowStatus(status) ? status : 'backlog';
}

/**
 * Normalize task from API response (snake_case to camelCase)
 */
export function normalizeTask(raw: Record<string, unknown>): Task {
  const id = rawStr(raw, 'id');
  const title = rawStr(raw, 'title');

  return {
    id,
    title: title ?? '',
    description: rawStr(raw, 'description'),
    completed: rawBool(raw, 'completed') ?? false,
    completedAt: rawStr(raw, 'completed_at', 'completedAt'),
    dueDate: rawStr(raw, 'due_date', 'dueDate'),
    courseCode: rawStr(raw, 'course_code', 'courseCode'),
    sourceUrl: rawStr(raw, 'source_url', 'sourceUrl'),
    sortOrder: rawNum(raw, 'sort_order', 'sortOrder') ?? 0,
    workflowStatus: normalizeWorkflowStatus(raw),
    week: rawNum(raw, 'week'),
    createdAt: rawStr(raw, 'created_at', 'createdAt'),
    updatedAt: rawStr(raw, 'updated_at', 'updatedAt'),
  };
}

/**
 * Convert task to API payload (camelCase to snake_case)
 */
export function taskToPayload(task: Partial<Task>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (task.title !== undefined) payload['title'] = task.title;
  if (task.description !== undefined) payload['description'] = task.description;
  if (task.completed !== undefined) payload['completed'] = task.completed;
  if (task.dueDate !== undefined) payload['dueDate'] = task.dueDate;
  if (task.courseCode !== undefined) payload['courseCode'] = task.courseCode;
  if (task.sourceUrl !== undefined) payload['sourceUrl'] = task.sourceUrl;
  if (task.sortOrder !== undefined) payload['sortOrder'] = task.sortOrder;
  if (task.workflowStatus !== undefined) payload['workflowStatus'] = task.workflowStatus;
  if (task.week !== undefined) payload['week'] = task.week;
  return payload;
}
