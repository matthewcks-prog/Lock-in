/**
 * TasksModal sub-components.
 *
 * Extracted from TasksModal.tsx to stay within the 300-line file limit.
 */

import { List, LayoutGrid, Plus, X } from 'lucide-react';
import type { Task, UpdateTaskInput } from '@core/domain/Task';
import { TaskBoardView } from './board/TaskBoardView';
import { TaskEditPanel } from './TaskEditPanel';
import { TasksPanelHeader } from './TasksPanelHeader';

const ICON_SIZE = 16;
const CLOSE_ICON_SIZE = 18;

/* ------------------------------------------------------------------ */
/*  ModalViewToggle                                                    */
/* ------------------------------------------------------------------ */

export function ModalViewToggle({
  viewMode,
  setViewMode,
}: {
  viewMode: string;
  setViewMode: (mode: 'list' | 'board') => void;
}): JSX.Element {
  return (
    <div className="lockin-tasks-view-toggle" role="group" aria-label="View mode">
      <button
        type="button"
        className={`lockin-tasks-view-btn${viewMode === 'list' ? ' is-active' : ''}`}
        onClick={(): void => setViewMode('list')}
        aria-label="List view"
        title="List view"
      >
        <List size={ICON_SIZE} strokeWidth={2} />
      </button>
      <button
        type="button"
        className={`lockin-tasks-view-btn${viewMode === 'board' ? ' is-active' : ''}`}
        onClick={(): void => setViewMode('board')}
        aria-label="Board view"
        title="Board view"
      >
        <LayoutGrid size={ICON_SIZE} strokeWidth={2} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ModalHeader                                                        */
/* ------------------------------------------------------------------ */

export function ModalHeader({
  courseCode,
  stats,
  viewMode,
  setViewMode,
  handleCreateTask,
  onClose,
}: {
  courseCode: string | null;
  stats: { total: number; completed: number; active: number };
  viewMode: string;
  setViewMode: (mode: 'list' | 'board') => void;
  handleCreateTask: () => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <div className="lockin-tasks-modal-header">
      <div className="lockin-tasks-modal-header-left">
        <TasksPanelHeader courseCode={courseCode} stats={stats} />
      </div>
      <div className="lockin-tasks-modal-header-right">
        <ModalViewToggle viewMode={viewMode} setViewMode={setViewMode} />
        {viewMode === 'board' && (
          <button
            type="button"
            className="lockin-tasks-modal-add-btn"
            onClick={handleCreateTask}
            aria-label="Add task"
            title="Add task"
          >
            <Plus size={ICON_SIZE} strokeWidth={2} />
          </button>
        )}
        <button
          type="button"
          className="lockin-tasks-modal-close"
          onClick={onClose}
          aria-label="Close tasks"
        >
          <X size={CLOSE_ICON_SIZE} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ModalBoardView                                                     */
/* ------------------------------------------------------------------ */

export function ModalBoardView({
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
