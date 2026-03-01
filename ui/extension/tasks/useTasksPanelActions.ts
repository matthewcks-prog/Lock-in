/**
 * useTasksPanel Hook
 *
 * Manages TasksPanel state and actions.
 * Handles inline editing, task creation, and deletion.
 */

import { useCallback, useRef, useState } from 'react';
import type { Task, TaskFilter, CreateTaskInput, UpdateTaskInput } from '@core/domain/Task';

interface UseTasksPanelActionsOptions {
  createTask: (input: CreateTaskInput) => Promise<Task | undefined>;
  updateTask: (taskId: string, changes: UpdateTaskInput) => Promise<Task | undefined>;
  toggleCompleted: (taskId: string) => Promise<Task | undefined>;
  deleteTask: (taskId: string) => Promise<void>;
  courseCode: string | null;
  sourceUrl: string | null;
}

const SAVE_DEBOUNCE_MS = 500;

interface PendingEdit {
  title: string;
  timeoutId: number;
}

interface UseTasksPanelActionsReturn {
  filter: TaskFilter;
  editingTaskId: string | null;
  deletingTaskId: string | null;
  isCreating: boolean;
  newTaskTitle: string;
  newTaskWeek: number | null;
  setFilter: (filter: TaskFilter) => void;
  setNewTaskTitle: (title: string) => void;
  setNewTaskWeek: (week: number | null) => void;
  handleCreateTask: () => void;
  handleNewTaskSubmit: () => Promise<void>;
  handleNewTaskCancel: () => void;
  handleStartEdit: (taskId: string) => void;
  handleTitleChange: (taskId: string, title: string) => void;
  handleTitleBlur: (taskId: string) => void;
  handleToggleComplete: (taskId: string) => Promise<void>;
  handleUpdateTask: (taskId: string, changes: UpdateTaskInput) => void;
  handleDelete: (taskId: string) => Promise<void>;
  cleanup: () => void;
}

function flushPendingEdit(
  pendingEdits: Map<string, PendingEdit>,
  taskId: string,
  updateTask: UseTasksPanelActionsOptions['updateTask'],
): void {
  const pending = pendingEdits.get(taskId);
  if (pending !== undefined) {
    window.clearTimeout(pending.timeoutId);
    if (pending.title.trim() !== '') {
      updateTask(taskId, { title: pending.title.trim() }).catch(() => {});
    }
    pendingEdits.delete(taskId);
  }
}

function scheduleDebouncedSave(
  pendingEditsRef: React.MutableRefObject<Map<string, PendingEdit>>,
  taskId: string,
  title: string,
  updateTask: UseTasksPanelActionsOptions['updateTask'],
): void {
  const existing = pendingEditsRef.current.get(taskId);
  if (existing !== undefined) {
    window.clearTimeout(existing.timeoutId);
  }
  const timeoutId = window.setTimeout(() => {
    const pending = pendingEditsRef.current.get(taskId);
    if (pending !== undefined && pending.title.trim() !== '') {
      updateTask(taskId, { title: pending.title.trim() }).catch(() => {});
    }
    pendingEditsRef.current.delete(taskId);
  }, SAVE_DEBOUNCE_MS);
  pendingEditsRef.current.set(taskId, { title, timeoutId });
}

interface TaskCreationReturn {
  isCreating: boolean;
  newTaskTitle: string;
  newTaskWeek: number | null;
  setNewTaskTitle: (t: string) => void;
  setNewTaskWeek: (w: number | null) => void;
  handleCreateTask: () => void;
  handleNewTaskSubmit: () => Promise<void>;
  handleNewTaskCancel: () => void;
}

function useTaskCreation(
  options: Pick<UseTasksPanelActionsOptions, 'createTask' | 'courseCode' | 'sourceUrl'>,
): TaskCreationReturn {
  const { createTask, courseCode, sourceUrl } = options;
  const [isCreating, setIsCreating] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskWeek, setNewTaskWeek] = useState<number | null>(null);

  const handleCreateTask = useCallback((): void => {
    setIsCreating(true);
    setNewTaskTitle('');
    setNewTaskWeek(null);
  }, []);

  const handleNewTaskSubmit = useCallback(async (): Promise<void> => {
    const title = newTaskTitle.trim();
    if (title === '') {
      setIsCreating(false);
      setNewTaskTitle('');
      return;
    }
    try {
      await createTask({ title, courseCode, sourceUrl, week: newTaskWeek });
      setNewTaskTitle('');
      setNewTaskWeek(null);
    } catch {
      // Error is handled by the hook
    }
  }, [newTaskTitle, newTaskWeek, createTask, courseCode, sourceUrl]);

  const handleNewTaskCancel = useCallback((): void => {
    setIsCreating(false);
    setNewTaskTitle('');
    setNewTaskWeek(null);
  }, []);

  return {
    isCreating,
    newTaskTitle,
    newTaskWeek,
    setNewTaskTitle,
    setNewTaskWeek,
    handleCreateTask,
    handleNewTaskSubmit,
    handleNewTaskCancel,
  };
}

interface TaskEditingReturn {
  editingTaskId: string | null;
  pendingEditsRef: React.MutableRefObject<Map<string, PendingEdit>>;
  handleStartEdit: (taskId: string) => void;
  handleTitleChange: (taskId: string, title: string) => void;
  handleTitleBlur: (taskId: string) => void;
  handleUpdateTask: (taskId: string, changes: UpdateTaskInput) => void;
  cleanup: () => void;
}

function useTaskEditing(updateTask: UseTasksPanelActionsOptions['updateTask']): TaskEditingReturn {
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const pendingEditsRef = useRef<Map<string, PendingEdit>>(new Map());

  const handleStartEdit = useCallback((taskId: string): void => {
    setEditingTaskId(taskId);
  }, []);

  const handleTitleChange = useCallback(
    (taskId: string, title: string): void => {
      scheduleDebouncedSave(pendingEditsRef, taskId, title, updateTask);
    },
    [updateTask],
  );

  const handleTitleBlur = useCallback(
    (taskId: string): void => {
      flushPendingEdit(pendingEditsRef.current, taskId, updateTask);
      setEditingTaskId(null);
    },
    [updateTask],
  );

  const handleUpdateTask = useCallback(
    (taskId: string, changes: UpdateTaskInput): void => {
      updateTask(taskId, changes).catch(() => {});
    },
    [updateTask],
  );

  const cleanup = useCallback((): void => {
    pendingEditsRef.current.forEach((pending) => {
      window.clearTimeout(pending.timeoutId);
    });
    pendingEditsRef.current.clear();
  }, []);

  return {
    editingTaskId,
    pendingEditsRef,
    handleStartEdit,
    handleTitleChange,
    handleTitleBlur,
    handleUpdateTask,
    cleanup,
  };
}

function useTaskDeletion(
  toggleCompleted: UseTasksPanelActionsOptions['toggleCompleted'],
  deleteTask: UseTasksPanelActionsOptions['deleteTask'],
): {
  deletingTaskId: string | null;
  handleToggleComplete: (taskId: string) => Promise<void>;
  handleDelete: (taskId: string) => Promise<void>;
} {
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  const handleToggleComplete = useCallback(
    async (taskId: string): Promise<void> => {
      try {
        await toggleCompleted(taskId);
      } catch {
        // Error handled by hook
      }
    },
    [toggleCompleted],
  );

  const handleDelete = useCallback(
    async (taskId: string): Promise<void> => {
      setDeletingTaskId(taskId);
      try {
        await deleteTask(taskId);
      } catch {
        // Error handled by hook
      } finally {
        setDeletingTaskId(null);
      }
    },
    [deleteTask],
  );

  return { deletingTaskId, handleToggleComplete, handleDelete };
}

export function useTasksPanelActions(
  options: UseTasksPanelActionsOptions,
): UseTasksPanelActionsReturn {
  const [filter, setFilter] = useState<TaskFilter>('all');
  const creation = useTaskCreation(options);
  const editing = useTaskEditing(options.updateTask);
  const deletion = useTaskDeletion(options.toggleCompleted, options.deleteTask);

  return {
    filter,
    setFilter,
    ...creation,
    editingTaskId: editing.editingTaskId,
    handleStartEdit: editing.handleStartEdit,
    handleTitleChange: editing.handleTitleChange,
    handleTitleBlur: editing.handleTitleBlur,
    handleUpdateTask: editing.handleUpdateTask,
    cleanup: editing.cleanup,
    ...deletion,
  };
}
