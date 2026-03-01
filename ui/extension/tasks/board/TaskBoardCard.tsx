/**
 * TaskBoardCard Component
 *
 * Draggable card for the Tasks Kanban board.
 */

import { useCallback } from 'react';
import { GripVertical, Check, Circle, Trash2 } from 'lucide-react';
import type { Task } from '@core/domain/Task';

export interface TaskBoardCardProps {
  task: Task;
  onToggleComplete?: ((taskId: string) => void) | undefined;
  onEditTask?: ((taskId: string) => void) | undefined;
  onDelete?: ((taskId: string) => void) | undefined;
}

const PREVIEW_MAX_LENGTH = 50;
const ICON_SIZE_SMALL = 11;
const ICON_SIZE_CARD = 12;

function CardMeta({
  courseCode,
  dueDate,
}: {
  courseCode: string | null;
  dueDate: string | null;
}): JSX.Element | null {
  const hasCourse = courseCode !== null && courseCode !== '';
  const hasDue = dueDate !== null && dueDate !== '';
  if (!hasCourse && !hasDue) {
    return null;
  }
  return (
    <div className="lockin-board-card-meta">
      {hasCourse && <span className="lockin-note-badge">{courseCode}</span>}
      {hasDue && (
        <span className="lockin-note-badge lockin-note-badge-week">
          {new Date(dueDate!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
      )}
    </div>
  );
}

function CardActions({
  task,
  canInteract,
  onDelete,
  onToggleComplete,
}: {
  task: Task;
  canInteract: boolean;
  onDelete: TaskBoardCardProps['onDelete'];
  onToggleComplete: TaskBoardCardProps['onToggleComplete'];
}): JSX.Element | null {
  if (!canInteract) {
    return null;
  }
  return (
    <>
      {onDelete !== undefined && (
        <button
          type="button"
          className="lockin-board-card-delete"
          onClick={(e: React.MouseEvent): void => {
            e.stopPropagation();
            onDelete(task.id!);
          }}
          aria-label="Delete task"
        >
          <Trash2 size={ICON_SIZE_SMALL} strokeWidth={2} />
        </button>
      )}
      {onToggleComplete !== undefined && (
        <button
          type="button"
          className="lockin-board-card-check"
          onClick={(e: React.MouseEvent): void => {
            e.stopPropagation();
            onToggleComplete(task.id!);
          }}
          aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {task.completed ? (
            <Check size={ICON_SIZE_CARD} strokeWidth={2.5} />
          ) : (
            <Circle size={ICON_SIZE_CARD} strokeWidth={1.5} />
          )}
        </button>
      )}
    </>
  );
}

function CardBody({
  task,
  canInteract,
  onDelete,
  onToggleComplete,
}: {
  task: Task;
  canInteract: boolean;
  onDelete: TaskBoardCardProps['onDelete'];
  onToggleComplete: TaskBoardCardProps['onToggleComplete'];
}): JSX.Element {
  const titleDisplay = task.title !== '' ? task.title : 'Untitled task';
  const hasDescription = task.description !== null && task.description !== '';
  return (
    <>
      <div className="lockin-board-card-top">
        <span className="lockin-board-card-grip">
          <GripVertical size={ICON_SIZE_CARD} strokeWidth={2} />
        </span>
        <span className="lockin-board-card-title">{titleDisplay}</span>
        <CardActions
          task={task}
          canInteract={canInteract}
          onDelete={onDelete}
          onToggleComplete={onToggleComplete}
        />
      </div>
      {hasDescription && (
        <div className="lockin-board-card-preview">
          {task.description!.length > PREVIEW_MAX_LENGTH
            ? task.description!.slice(0, PREVIEW_MAX_LENGTH) + '…'
            : task.description}
        </div>
      )}
      <CardMeta courseCode={task.courseCode} dueDate={task.dueDate} />
    </>
  );
}

export function TaskBoardCard({
  task,
  onToggleComplete,
  onEditTask,
  onDelete,
}: TaskBoardCardProps): JSX.Element {
  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      if (task.id !== null && task.id !== '') {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }
    },
    [task.id],
  );

  const handleCardClick = useCallback(
    (e: React.MouseEvent): void => {
      const target = e.target as HTMLElement;
      if (
        target.closest('.lockin-board-card-check') !== null ||
        target.closest('.lockin-board-card-delete') !== null
      ) {
        return;
      }
      if (onEditTask !== undefined && task.id !== null && task.id !== '') {
        onEditTask(task.id);
      }
    },
    [onEditTask, task.id],
  );

  const className = `lockin-board-card${task.completed ? ' is-completed' : ''}`;
  const canInteract = task.id !== null && task.id !== '';

  return (
    <div
      className={className}
      draggable={canInteract}
      onDragStart={handleDragStart}
      onClick={handleCardClick}
    >
      <CardBody
        task={task}
        canInteract={canInteract}
        onDelete={onDelete}
        onToggleComplete={onToggleComplete}
      />
    </div>
  );
}
