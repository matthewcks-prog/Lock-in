import { useCallback, useRef, useState } from 'react';
import type { Task, CreateTaskInput, UpdateTaskInput } from '../../core/domain/Task.ts';
import type { TasksService } from '../../core/services/tasksService.ts';

interface UseTasksListOptions {
  tasksService: TasksService | null | undefined;
  limit?: number;
}

interface UseTasksListReturn {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<Task | undefined>;
  updateTask: (taskId: string, changes: UpdateTaskInput) => Promise<Task | undefined>;
  toggleCompleted: (taskId: string) => Promise<Task | undefined>;
  deleteTask: (taskId: string) => Promise<void>;
  clearError: () => void;
}

function getErrorMessage(err: unknown): string {
  const record = typeof err === 'object' && err !== null ? (err as Record<string, unknown>) : null;
  if (err instanceof Error && err.message !== '') {
    return err.message;
  }
  if (typeof record?.['message'] === 'string') {
    return record['message'];
  }
  return '';
}

function sortByCompletion(tasks: Task[]): Task[] {
  const incomplete = tasks.filter((t) => !t.completed);
  const complete = tasks.filter((t) => t.completed);
  return [...incomplete, ...complete];
}

function replaceTask(tasks: Task[], taskId: string, replacement: Task): Task[] {
  return tasks.map((t) => (t.id === taskId ? replacement : t));
}

function buildToggleChanges(task: Task): UpdateTaskInput {
  const newCompleted = !task.completed;
  const newWorkflowStatus = newCompleted
    ? 'done'
    : task.workflowStatus === 'done'
      ? 'backlog'
      : (task.workflowStatus ?? 'backlog');
  return { completed: newCompleted, workflowStatus: newWorkflowStatus };
}

function applyOptimisticToggle(task: Task): Task {
  const newCompleted = !task.completed;
  return {
    ...task,
    completed: newCompleted,
    completedAt: newCompleted ? new Date().toISOString() : null,
    workflowStatus: newCompleted
      ? ('done' as const)
      : task.workflowStatus === 'done'
        ? ('backlog' as const)
        : task.workflowStatus,
  };
}

function errorOrDefault(err: unknown, fallback: string): string {
  const msg = getErrorMessage(err);
  return msg !== '' ? msg : fallback;
}

type SetTasks = React.Dispatch<React.SetStateAction<Task[]>>;
type SetError = React.Dispatch<React.SetStateAction<string | null>>;
type SetLoading = React.Dispatch<React.SetStateAction<boolean>>;

interface RefreshCtx {
  svc: TasksService;
  limit: number;
  isRefreshingRef: React.MutableRefObject<boolean>;
  lastParamsRef: React.MutableRefObject<string>;
  setTasks: SetTasks;
  setIsLoading: SetLoading;
  setError: SetError;
}

async function performRefresh(ctx: RefreshCtx): Promise<void> {
  const fp = JSON.stringify({ limit: ctx.limit });
  if (ctx.isRefreshingRef.current && ctx.lastParamsRef.current === fp) {
    return;
  }
  ctx.isRefreshingRef.current = true;
  ctx.lastParamsRef.current = fp;
  ctx.setIsLoading(true);
  ctx.setError(null);
  try {
    const list = await ctx.svc.listTasks({ limit: ctx.limit, includeCompleted: true });
    ctx.setTasks(list);
  } catch (err: unknown) {
    ctx.setError(errorOrDefault(err, 'Failed to load tasks'));
  } finally {
    ctx.setIsLoading(false);
    ctx.isRefreshingRef.current = false;
  }
}

interface MutCtx {
  svc: TasksService;
  setTasks: SetTasks;
  setError: SetError;
}

async function performCreate(ctx: MutCtx, input: CreateTaskInput): Promise<Task | undefined> {
  try {
    const task = await ctx.svc.createTask(input);
    ctx.setTasks((prev) => sortByCompletion([task, ...prev]));
    return task;
  } catch (err: unknown) {
    ctx.setError(errorOrDefault(err, 'Failed to create task'));
    throw err;
  }
}

async function performUpdate(
  ctx: MutCtx,
  taskId: string,
  changes: UpdateTaskInput,
): Promise<Task | undefined> {
  let originalTask: Task | undefined;
  ctx.setTasks((prev) =>
    prev.map((t) => {
      if (t.id === taskId) {
        originalTask = t;
        return { ...t, ...changes };
      }
      return t;
    }),
  );
  try {
    const updated = await ctx.svc.updateTask(taskId, changes);
    ctx.setTasks((prev) => replaceTask(prev, taskId, updated));
    return updated;
  } catch (err: unknown) {
    if (originalTask !== undefined) {
      ctx.setTasks((prev) => replaceTask(prev, taskId, originalTask!));
    }
    ctx.setError(errorOrDefault(err, 'Failed to update task'));
    throw err;
  }
}

async function performToggle(ctx: MutCtx, taskId: string): Promise<Task | undefined> {
  let originalTask: Task | undefined;
  ctx.setTasks((prev) => {
    const mapped = prev.map((t) => {
      if (t.id === taskId) {
        originalTask = t;
        return applyOptimisticToggle(t);
      }
      return t;
    });
    return sortByCompletion(mapped);
  });
  try {
    const changes =
      originalTask !== undefined ? buildToggleChanges(originalTask) : { completed: true };
    const updated = await ctx.svc.updateTask(taskId, changes);
    ctx.setTasks((prev) => sortByCompletion(replaceTask(prev, taskId, updated)));
    return updated;
  } catch (err: unknown) {
    if (originalTask !== undefined) {
      ctx.setTasks((prev) => sortByCompletion(replaceTask(prev, taskId, originalTask!)));
    }
    ctx.setError(errorOrDefault(err, 'Failed to toggle task'));
    throw err;
  }
}

async function performDelete(ctx: MutCtx, taskId: string): Promise<void> {
  let deletedTask: Task | undefined;
  let deletedIndex = -1;
  ctx.setTasks((prev) => {
    deletedIndex = prev.findIndex((t) => t.id === taskId);
    if (deletedIndex >= 0) {
      deletedTask = prev[deletedIndex];
    }
    return prev.filter((t) => t.id !== taskId);
  });
  try {
    await ctx.svc.deleteTask(taskId);
  } catch (err: unknown) {
    if (deletedTask !== undefined) {
      ctx.setTasks((prev) => {
        const newList = [...prev];
        if (deletedIndex >= 0 && deletedIndex <= newList.length) {
          newList.splice(deletedIndex, 0, deletedTask!);
        } else {
          newList.unshift(deletedTask!);
        }
        return newList;
      });
    }
    ctx.setError(errorOrDefault(err, 'Failed to delete task'));
    throw err;
  }
}

interface TaskMutations {
  createTask: (input: CreateTaskInput) => Promise<Task | undefined>;
  updateTask: (taskId: string, changes: UpdateTaskInput) => Promise<Task | undefined>;
  toggleCompleted: (taskId: string) => Promise<Task | undefined>;
  deleteTask: (taskId: string) => Promise<void>;
}

function useTasksMutations(
  tasksService: TasksService | null | undefined,
  setTasks: SetTasks,
  setError: SetError,
): TaskMutations {
  const createTask = useCallback(
    async (input: CreateTaskInput): Promise<Task | undefined> => {
      if (tasksService === null || tasksService === undefined) {
        setError('Tasks service not available');
        return undefined;
      }
      return performCreate({ svc: tasksService, setTasks, setError }, input);
    },
    [tasksService, setTasks, setError],
  );

  const updateTask = useCallback(
    async (taskId: string, changes: UpdateTaskInput): Promise<Task | undefined> => {
      if (tasksService === null || tasksService === undefined || taskId === '') {
        return undefined;
      }
      return performUpdate({ svc: tasksService, setTasks, setError }, taskId, changes);
    },
    [tasksService, setTasks, setError],
  );

  const toggleCompleted = useCallback(
    async (taskId: string): Promise<Task | undefined> => {
      if (tasksService === null || tasksService === undefined || taskId === '') {
        return undefined;
      }
      return performToggle({ svc: tasksService, setTasks, setError }, taskId);
    },
    [tasksService, setTasks, setError],
  );

  const deleteTask = useCallback(
    async (taskId: string): Promise<void> => {
      if (tasksService === null || tasksService === undefined || taskId === '') {
        return;
      }
      await performDelete({ svc: tasksService, setTasks, setError }, taskId);
    },
    [tasksService, setTasks, setError],
  );

  return { createTask, updateTask, toggleCompleted, deleteTask };
}

export function useTasksList(options: UseTasksListOptions): UseTasksListReturn {
  const { tasksService, limit = 100 } = options;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRefreshingRef = useRef(false);
  const lastParamsRef = useRef<string>('');

  const refresh = useCallback(async (): Promise<void> => {
    if (tasksService !== null && tasksService !== undefined) {
      await performRefresh({
        svc: tasksService,
        limit,
        isRefreshingRef,
        lastParamsRef,
        setTasks,
        setIsLoading,
        setError,
      });
    }
  }, [limit, tasksService]);

  const mutations = useTasksMutations(tasksService, setTasks, setError);
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  return { tasks, isLoading, error, refresh, ...mutations, clearError };
}
