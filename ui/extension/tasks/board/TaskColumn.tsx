/**
 * TaskColumn Component
 *
 * A droppable Kanban column for the Tasks board.
 */

import { useCallback } from 'react';
import type { Task, TaskWorkflowStatus } from '@core/domain/Task';
import { TASK_WORKFLOW_STATUS_LABELS } from '@core/domain/Task';
import { TaskBoardCard } from './TaskBoardCard';

export interface TaskColumnProps {
  status: TaskWorkflowStatus;
  tasks: Task[];
  isOver?: boolean | undefined;
  onToggleComplete?: ((taskId: string) => void) | undefined;
  onEditTask?: ((taskId: string) => void) | undefined;
  onDelete?: ((taskId: string) => void) | undefined;
  onDragOver?: ((status: TaskWorkflowStatus) => void) | undefined;
  onDragLeave?: (() => void) | undefined;
  onDrop?: ((taskId: string, status: TaskWorkflowStatus) => void) | undefined;
}

function ColumnCardList({
  tasks,
  onToggleComplete,
  onEditTask,
  onDelete,
}: {
  tasks: Task[];
  onToggleComplete: TaskColumnProps['onToggleComplete'];
  onEditTask: TaskColumnProps['onEditTask'];
  onDelete: TaskColumnProps['onDelete'];
}): JSX.Element {
  if (tasks.length === 0) {
    return <div className="lockin-board-column-empty">Drop tasks here</div>;
  }
  return (
    <>
      {tasks.map((task) => (
        <TaskBoardCard
          key={task.id ?? `temp-${task.title}`}
          task={task}
          onToggleComplete={onToggleComplete}
          onEditTask={onEditTask}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

function useDragHandlers(
  status: TaskWorkflowStatus,
  onDragOver: TaskColumnProps['onDragOver'],
  onDragLeave: TaskColumnProps['onDragLeave'],
  onDrop: TaskColumnProps['onDrop'],
): {
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
} {
  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      onDragOver?.(status);
    },
    [status, onDragOver],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      const related = e.relatedTarget as HTMLElement | null;
      if (related !== null && e.currentTarget.contains(related)) {
        return;
      }
      onDragLeave?.();
    },
    [onDragLeave],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData('text/plain');
      if (taskId !== '') {
        onDrop?.(taskId, status);
      }
    },
    [status, onDrop],
  );

  return { handleDragOver, handleDragLeave, handleDrop };
}

export function TaskColumn({
  status,
  tasks,
  isOver,
  onToggleComplete,
  onEditTask,
  onDelete,
  onDragOver,
  onDragLeave,
  onDrop,
}: TaskColumnProps): JSX.Element {
  const drag = useDragHandlers(status, onDragOver, onDragLeave, onDrop);

  return (
    <div className="lockin-board-column">
      <div className="lockin-board-column-header">
        <span className="lockin-board-column-title">{TASK_WORKFLOW_STATUS_LABELS[status]}</span>
        <span className="lockin-board-column-count">{tasks.length}</span>
      </div>
      <div
        className={`lockin-board-column-body${isOver === true ? ' is-over' : ''}`}
        onDragOver={drag.handleDragOver}
        onDragLeave={drag.handleDragLeave}
        onDrop={drag.handleDrop}
      >
        <ColumnCardList
          tasks={tasks}
          onToggleComplete={onToggleComplete}
          onEditTask={onEditTask}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
