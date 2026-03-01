/**
 * TasksPanel Component
 *
 * Main panel for task management in the Lock-in sidebar.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Task, TasksViewMode, UpdateTaskInput } from '@core/domain/Task';
import type { TasksService } from '@core/services/tasksService';
import { Toast, useToast } from '../components';
import { useTasksList } from '../../hooks/useTasksList';
import { useTasksViewMode } from '../../hooks/useTasksViewMode';
import { TasksList } from './TasksList';
import { TaskEditPanel } from './TaskEditPanel';
import { TaskFilterBar } from './TaskFilterBar';
import { useTasksPanelActions } from './useTasksPanelActions';
import { TasksPanelHeader } from './TasksPanelHeader';
import { TaskBoardView } from './board/TaskBoardView';

function applyDropdownFilters(
  tasks: Task[],
  selectedCourse: string | null,
  selectedWeek: number | null,
): Task[] {
  let result = tasks;
  if (selectedCourse !== null) {
    result = result.filter((t) => t.courseCode === selectedCourse);
  }
  if (selectedWeek !== null) {
    result = result.filter((t) => t.week === selectedWeek);
  }
  return result;
}

function computeStats(tasks: Task[]): { total: number; completed: number; active: number } {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  return { total, completed, active: total - completed };
}

function voidAsync(fn: (id: string) => Promise<void>): (id: string) => void {
  return (id: string): void => {
    void fn(id);
  };
}

function BoardViewWithEditOverlay({
  filteredTasks,
  isLoading,
  updateTask,
  onToggleComplete,
  onStartEdit,
  onDelete,
  editingTask,
  onUpdateTask,
  onStopEdit,
  deletingTaskId,
}: {
  filteredTasks: Task[];
  isLoading: boolean;
  updateTask: (taskId: string, changes: UpdateTaskInput) => Promise<Task | undefined>;
  onToggleComplete: (id: string) => void;
  onStartEdit: (taskId: string) => void;
  onDelete: (id: string) => void;
  editingTask: Task | null;
  onUpdateTask: (taskId: string, changes: UpdateTaskInput) => void;
  onStopEdit: () => void;
  deletingTaskId: string | null;
}): JSX.Element {
  return (
    <>
      <TaskBoardView
        tasks={filteredTasks}
        isLoading={isLoading}
        onUpdateTask={updateTask}
        onToggleComplete={onToggleComplete}
        onEditTask={onStartEdit}
        onDelete={onDelete}
      />
      {editingTask !== null && (
        <div className="lockin-board-edit-overlay">
          <TaskEditPanel
            task={editingTask}
            onSave={onUpdateTask}
            onClose={onStopEdit}
            onToggleComplete={onToggleComplete}
            onDelete={onDelete}
            isDeleting={deletingTaskId === editingTask.id}
          />
        </div>
      )}
    </>
  );
}

export interface TasksPanelProps {
  tasksService: TasksService | null | undefined;
  courseCode: string | null;
  pageUrl: string;
  currentWeek?: number | null;
}

interface PanelCore {
  toast: ReturnType<typeof useToast>['toast'];
  hideToast: () => void;
  viewMode: TasksViewMode;
  setViewMode: (m: TasksViewMode) => void;
  tasks: Task[];
  isLoading: boolean;
  updateTask: (id: string, c: UpdateTaskInput) => Promise<Task | undefined>;
  actions: ReturnType<typeof useTasksPanelActions>;
}

function usePanelCore(props: TasksPanelProps): PanelCore {
  const { tasksService, courseCode, pageUrl } = props;
  const { toast, showToast, hideToast } = useToast();
  const { viewMode, setViewMode } = useTasksViewMode();

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
    void refresh();
  }, [refresh]);

  useEffect(() => actions.cleanup, [actions.cleanup]);

  useEffect(() => {
    if (error !== null && error !== '') {
      showToast(error, 'error');
      clearError();
    }
  }, [error, showToast, clearError]);

  return { toast, hideToast, viewMode, setViewMode, tasks, isLoading, updateTask, actions };
}

interface PanelState extends PanelCore {
  stats: { total: number; completed: number; active: number };
  filteredTasks: Task[];
  selectedCourse: string | null;
  setSelectedCourse: (c: string | null) => void;
  selectedWeek: number | null;
  setSelectedWeek: (w: number | null) => void;
  editingTask: Task | null;
  handleStopEdit: () => void;
}

function usePanelState(props: TasksPanelProps): PanelState {
  const core = usePanelCore(props);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const stats = useMemo(() => computeStats(core.tasks), [core.tasks]);
  const filteredTasks = useMemo(
    () => applyDropdownFilters(core.tasks, selectedCourse, selectedWeek),
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
  };
}

function PanelListView({ s }: { s: PanelState }): JSX.Element {
  return (
    <TasksList
      tasks={s.filteredTasks}
      isLoading={s.isLoading}
      filter={s.actions.filter}
      courseCode={null}
      editingTaskId={s.actions.editingTaskId}
      deletingTaskId={s.actions.deletingTaskId}
      onFilterChange={s.actions.setFilter}
      onToggleComplete={voidAsync(s.actions.handleToggleComplete)}
      onUpdateTask={s.actions.handleUpdateTask}
      onStartEdit={s.actions.handleStartEdit}
      onStopEdit={s.handleStopEdit}
      onDelete={voidAsync(s.actions.handleDelete)}
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

function PanelToast({ s }: { s: PanelState }): JSX.Element | null {
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

export function TasksPanel(props: TasksPanelProps): JSX.Element {
  const { courseCode } = props;
  const s = usePanelState(props);

  return (
    <div className="lockin-tasks-panel">
      <TasksPanelHeader
        courseCode={courseCode}
        stats={s.stats}
        viewMode={s.viewMode}
        onViewModeChange={s.setViewMode}
      />
      <TaskFilterBar
        tasks={s.tasks}
        selectedCourse={s.selectedCourse}
        selectedWeek={s.selectedWeek}
        onCourseChange={s.setSelectedCourse}
        onWeekChange={s.setSelectedWeek}
      />
      <div className="lockin-tasks-body">
        {s.viewMode === 'list' ? (
          <PanelListView s={s} />
        ) : (
          <BoardViewWithEditOverlay
            filteredTasks={s.filteredTasks}
            isLoading={s.isLoading}
            updateTask={s.updateTask}
            onToggleComplete={voidAsync(s.actions.handleToggleComplete)}
            onStartEdit={s.actions.handleStartEdit}
            onDelete={voidAsync(s.actions.handleDelete)}
            editingTask={s.editingTask}
            onUpdateTask={s.actions.handleUpdateTask}
            onStopEdit={s.handleStopEdit}
            deletingTaskId={s.actions.deletingTaskId}
          />
        )}
      </div>
      <PanelToast s={s} />
    </div>
  );
}
