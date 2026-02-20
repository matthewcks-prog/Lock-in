/**
 * TasksModal Component
 *
 * Fullscreen overlay for task management.
 * Provides both List and Board (Kanban) views with a toggle.
 * Follows the FeedbackModal pattern for open/close behavior.
 */

import { useEffect, useCallback, useMemo, useState } from 'react';
import type { Task, TasksViewMode, UpdateTaskInput } from '@core/domain/Task';
import type { TasksService } from '@core/services/tasksService';
import { Toast, useToast } from '@shared/ui/components';
import { useTasksList } from '../../hooks/useTasksList';
import { useTasksViewMode } from '../../hooks/useTasksViewMode';
import { TasksList } from './TasksList';
import { TaskFilterBar } from './TaskFilterBar';
import { useTasksPanelActions } from './useTasksPanelActions';
import { ModalHeader, ModalBoardView } from './TasksModalParts';
import type { StorageAdapter } from '../sidebar/types';

export interface TasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasksService: TasksService | null | undefined;
  courseCode: string | null;
  pageUrl: string;
  currentWeek?: number | null;
  storage?: StorageAdapter;
}

function computeStats(tasks: Task[]): { total: number; completed: number; active: number } {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  return { total, completed, active: total - completed };
}

function filterByDropdowns(tasks: Task[], course: string | null, week: number | null): Task[] {
  let result = tasks;
  if (course !== null) {
    result = result.filter((t) => t.courseCode === course);
  }
  if (week !== null) {
    result = result.filter((t) => t.week === week);
  }
  return result;
}

function useModalKeyboard(isOpen: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return (): void => {
      document.removeEventListener('keydown', handler);
    };
  }, [isOpen, onClose]);
}

function voidToggle(fn: (id: string) => Promise<void>): (id: string) => void {
  return (id: string): void => {
    void fn(id);
  };
}

function voidDelete(fn: (id: string) => Promise<void>): (id: string) => void {
  return (id: string): void => {
    void fn(id);
  };
}

interface ModalCore {
  toast: ReturnType<typeof useToast>['toast'];
  hideToast: () => void;
  viewMode: TasksViewMode;
  setViewMode: (m: TasksViewMode) => void;
  tasks: Task[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  updateTask: (id: string, c: UpdateTaskInput) => Promise<Task | undefined>;
  actions: ReturnType<typeof useTasksPanelActions>;
}

function useModalCore(props: TasksModalProps): ModalCore {
  const { tasksService, courseCode, pageUrl, storage, isOpen } = props;
  const { toast, showToast, hideToast } = useToast();
  const storageOpts = storage !== undefined && storage !== null ? { storage } : {};
  const { viewMode, setViewMode } = useTasksViewMode(storageOpts);

  const {
    tasks,
    isLoading,
    error,
    refresh,
    createTask,
    updateTask,
    toggleCompleted,
    deleteTask,
    clearError,
  } = useTasksList({ tasksService });

  const actions = useTasksPanelActions({
    createTask,
    updateTask,
    toggleCompleted,
    deleteTask,
    courseCode,
    sourceUrl: pageUrl,
  });

  useEffect(() => {
    if (isOpen) {
      void refresh();
    }
  }, [isOpen, refresh]);

  useEffect(() => actions.cleanup, [actions.cleanup]);

  useEffect(() => {
    if (error !== null && error !== '') {
      showToast(error, 'error');
      clearError();
    }
  }, [error, showToast, clearError]);

  return {
    toast,
    hideToast,
    viewMode,
    setViewMode,
    tasks,
    isLoading,
    refresh,
    updateTask,
    actions,
  };
}

interface ModalState extends ModalCore {
  stats: { total: number; completed: number; active: number };
  filteredTasks: Task[];
  selectedCourse: string | null;
  setSelectedCourse: (c: string | null) => void;
  selectedWeek: number | null;
  setSelectedWeek: (w: number | null) => void;
  editingTask: Task | null;
  handleStopEdit: () => void;
  handleBackdropClick: (e: React.MouseEvent) => void;
}

function useModalState(props: TasksModalProps): ModalState {
  const core = useModalCore(props);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const stats = useMemo(() => computeStats(core.tasks), [core.tasks]);
  const filteredTasks = useMemo(
    () => filterByDropdowns(core.tasks, selectedCourse, selectedWeek),
    [core.tasks, selectedCourse, selectedWeek],
  );

  const editingTask =
    core.actions.editingTaskId !== null && core.actions.editingTaskId !== ''
      ? (core.tasks.find((t) => t.id === core.actions.editingTaskId) ?? null)
      : null;

  const handleStopEdit = useCallback((): void => {
    if (core.actions.editingTaskId !== null && core.actions.editingTaskId !== '') {
      core.actions.handleTitleBlur(core.actions.editingTaskId);
    }
  }, [core.actions]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent): void => {
      if (e.target === e.currentTarget) {
        props.onClose();
      }
    },
    [props],
  );

  return {
    ...core,
    stats,
    filteredTasks,
    selectedCourse,
    setSelectedCourse,
    selectedWeek,
    setSelectedWeek,
    editingTask,
    handleStopEdit,
    handleBackdropClick,
  };
}

function ModalListView({ s }: { s: ModalState }): JSX.Element {
  return (
    <TasksList
      tasks={s.filteredTasks}
      isLoading={s.isLoading}
      filter={s.actions.filter}
      courseCode={null}
      editingTaskId={s.actions.editingTaskId}
      deletingTaskId={s.actions.deletingTaskId}
      onFilterChange={s.actions.setFilter}
      onToggleComplete={voidToggle(s.actions.handleToggleComplete)}
      onUpdateTask={s.actions.handleUpdateTask}
      onStartEdit={s.actions.handleStartEdit}
      onStopEdit={s.handleStopEdit}
      onDelete={voidDelete(s.actions.handleDelete)}
      onCreateTask={s.actions.handleCreateTask}
      isCreating={s.actions.isCreating}
      newTaskTitle={s.actions.newTaskTitle}
      newTaskWeek={s.actions.newTaskWeek}
      onNewTaskTitleChange={s.actions.setNewTaskTitle}
      onNewTaskWeekChange={s.actions.setNewTaskWeek}
      onNewTaskSubmit={(): void => {
        void s.actions.handleNewTaskSubmit();
      }}
      onNewTaskCancel={s.actions.handleNewTaskCancel}
    />
  );
}

function ModalViewContent({ s }: { s: ModalState }): JSX.Element {
  if (s.viewMode === 'list') {
    return <ModalListView s={s} />;
  }
  return (
    <ModalBoardView
      filteredTasks={s.filteredTasks}
      isLoading={s.isLoading}
      updateTask={s.updateTask}
      onToggleComplete={voidToggle(s.actions.handleToggleComplete)}
      onStartEdit={s.actions.handleStartEdit}
      onDelete={voidDelete(s.actions.handleDelete)}
      editingTask={s.editingTask}
      onUpdateTask={s.actions.handleUpdateTask}
      onStopEdit={s.handleStopEdit}
      deletingTaskId={s.actions.deletingTaskId}
    />
  );
}

function ModalToast({ s }: { s: ModalState }): JSX.Element | null {
  if (s.toast === undefined || s.toast === null) {
    return null;
  }
  return (
    <Toast
      message={s.toast.message}
      type={s.toast.type}
      isVisible={s.toast.isVisible}
      onDismiss={s.hideToast}
    />
  );
}

export function TasksModal(props: TasksModalProps): JSX.Element | null {
  const { isOpen, onClose, courseCode } = props;
  const s = useModalState(props);

  useModalKeyboard(isOpen, onClose);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="lockin-tasks-modal-backdrop" onClick={s.handleBackdropClick}>
      <div className="lockin-tasks-modal" role="dialog" aria-modal="true" aria-label="Tasks">
        <ModalHeader
          courseCode={courseCode}
          stats={s.stats}
          viewMode={s.viewMode}
          setViewMode={s.setViewMode}
          handleCreateTask={s.actions.handleCreateTask}
          onClose={onClose}
        />
        <TaskFilterBar
          tasks={s.tasks}
          selectedCourse={s.selectedCourse}
          selectedWeek={s.selectedWeek}
          onCourseChange={s.setSelectedCourse}
          onWeekChange={s.setSelectedWeek}
        />
        <div className="lockin-tasks-modal-body">
          <ModalViewContent s={s} />
        </div>
        <ModalToast s={s} />
      </div>
    </div>
  );
}
