/**
 * TaskItem Component
 *
 * iPhone Notes-style checklist item with inline editing.
 */

import { useCallback } from 'react';
import { Check, Circle, Trash2, ChevronRight } from 'lucide-react';
import type { Task, UpdateTaskInput } from '@core/domain/Task';
import { TaskEditPanel } from './TaskEditPanel';

export interface TaskItemProps {
  task: Task;
  isEditing: boolean;
  onToggleComplete: () => void;
  onUpdateTask: (taskId: string, changes: UpdateTaskInput) => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

const ICON_SIZE = 16;
const ICON_SIZE_SMALL = 14;
const DESC_PREVIEW_LENGTH = 60;

function TaskMetaRow({
  description,
  dueDate,
}: {
  description: string | null;
  dueDate: string | null;
}): JSX.Element | null {
  const hasDesc = description !== null && description !== '';
  const hasDue = dueDate !== null && dueDate !== '';
  if (!hasDesc && !hasDue) {
    return null;
  }
  return (
    <div className="lockin-task-meta-row">
      {hasDesc && (
        <span className="lockin-task-desc-preview">
          {description!.length > DESC_PREVIEW_LENGTH
            ? description!.slice(0, DESC_PREVIEW_LENGTH) + '…'
            : description}
        </span>
      )}
      {hasDue && (
        <span className="lockin-task-due-badge">
          {new Date(dueDate!).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      )}
    </div>
  );
}

function TaskCheckbox({
  completed,
  onClick,
}: {
  completed: boolean;
  onClick: (e: React.MouseEvent) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      className="lockin-task-checkbox"
      onClick={onClick}
      aria-label={completed ? 'Mark as incomplete' : 'Mark as complete'}
      aria-pressed={completed}
    >
      {completed ? (
        <Check className="lockin-task-check-icon" size={ICON_SIZE} strokeWidth={2.5} />
      ) : (
        <Circle className="lockin-task-circle-icon" size={ICON_SIZE} strokeWidth={1.5} />
      )}
    </button>
  );
}

function TaskContent({ task }: { task: Task }): JSX.Element {
  return (
    <div className="lockin-task-content">
      <span className="lockin-task-title">{task.title !== '' ? task.title : 'Untitled task'}</span>
      <TaskMetaRow description={task.description} dueDate={task.dueDate} />
      {task.courseCode !== null && task.courseCode !== '' && (
        <span className="lockin-task-badge">{task.courseCode}</span>
      )}
    </div>
  );
}

function TaskActions({
  hasId,
  isDeleting,
  onDeleteClick,
}: {
  hasId: boolean;
  isDeleting: boolean;
  onDeleteClick: (e: React.MouseEvent) => void;
}): JSX.Element {
  return (
    <div className="lockin-task-actions">
      {hasId && (
        <button
          type="button"
          className="lockin-task-delete-btn"
          onClick={onDeleteClick}
          disabled={isDeleting}
          aria-label="Delete task"
        >
          {isDeleting ? (
            <span className="lockin-inline-spinner" aria-hidden="true" />
          ) : (
            <Trash2 size={ICON_SIZE_SMALL} strokeWidth={2} />
          )}
        </button>
      )}
      <ChevronRight size={ICON_SIZE_SMALL} className="lockin-task-expand-icon" strokeWidth={1.5} />
    </div>
  );
}

function CollapsedTaskView({
  task,
  isDeleting,
  onCheckboxClick,
  onDeleteClick,
  onItemClick,
}: {
  task: Task;
  isDeleting: boolean;
  onCheckboxClick: (e: React.MouseEvent) => void;
  onDeleteClick: (e: React.MouseEvent) => void;
  onItemClick: () => void;
}): JSX.Element {
  const hasId = task.id !== null && task.id !== '';
  return (
    <div
      className={`lockin-task-item${task.completed ? ' is-completed' : ''}`}
      onClick={onItemClick}
      role="listitem"
    >
      <TaskCheckbox completed={task.completed} onClick={onCheckboxClick} />
      <TaskContent task={task} />
      <TaskActions hasId={hasId} isDeleting={isDeleting} onDeleteClick={onDeleteClick} />
    </div>
  );
}

function EditingView({
  task,
  onUpdateTask,
  onStopEdit,
  onToggleComplete,
  onDelete,
  isDeleting,
}: {
  task: Task;
  onUpdateTask: (taskId: string, changes: UpdateTaskInput) => void;
  onStopEdit: () => void;
  onToggleComplete: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}): JSX.Element {
  return (
    <TaskEditPanel
      task={task}
      onSave={onUpdateTask}
      onClose={onStopEdit}
      onToggleComplete={(taskId: string): void => {
        if (taskId !== '') {
          onToggleComplete();
        }
      }}
      onDelete={(taskId: string): void => {
        if (taskId !== '') {
          onDelete();
        }
      }}
      isDeleting={isDeleting}
    />
  );
}

function stopAndCall(e: React.MouseEvent, fn: () => void): void {
  e.stopPropagation();
  fn();
}

export function TaskItem({
  task,
  isEditing,
  onToggleComplete,
  onUpdateTask,
  onStartEdit,
  onStopEdit,
  onDelete,
  isDeleting,
}: TaskItemProps): JSX.Element {
  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent): void => stopAndCall(e, onToggleComplete),
    [onToggleComplete],
  );
  const handleDeleteClick = useCallback(
    (e: React.MouseEvent): void => stopAndCall(e, onDelete),
    [onDelete],
  );
  const handleItemClick = useCallback((): void => {
    if (!isEditing) {
      onStartEdit();
    }
  }, [isEditing, onStartEdit]);

  if (isEditing) {
    return (
      <EditingView
        task={task}
        onUpdateTask={onUpdateTask}
        onStopEdit={onStopEdit}
        onToggleComplete={onToggleComplete}
        onDelete={onDelete}
        isDeleting={isDeleting}
      />
    );
  }

  return (
    <CollapsedTaskView
      task={task}
      isDeleting={isDeleting}
      onCheckboxClick={handleCheckboxClick}
      onDeleteClick={handleDeleteClick}
      onItemClick={handleItemClick}
    />
  );
}
