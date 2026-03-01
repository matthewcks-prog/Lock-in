/**
 * TaskBoardView Component
 *
 * Full Kanban board view for tasks.
 * Three columns: Backlog → In Progress → Done.
 * Native HTML5 drag-and-drop moves tasks between workflow statuses.
 *
 * Moving a task to the "Done" column marks it as completed.
 * Moving a task out of "Done" marks it as incomplete.
 */

import { useMemo, useCallback, useState } from 'react';
import type { Task, TaskWorkflowStatus, UpdateTaskInput } from '@core/domain/Task';
import { TASK_WORKFLOW_STATUSES } from '@core/domain/Task';
import { TaskColumn } from './TaskColumn';

export interface TaskBoardViewProps {
  tasks: Task[];
  isLoading: boolean;
  onUpdateTask: (taskId: string, changes: UpdateTaskInput) => Promise<Task | undefined>;
  onToggleComplete?: ((taskId: string) => void) | undefined;
  onEditTask?: ((taskId: string) => void) | undefined;
  onDelete?: ((taskId: string) => void) | undefined;
}

/**
 * Group tasks by their workflowStatus
 */
function groupByStatus(tasks: Task[]): Record<TaskWorkflowStatus, Task[]> {
  const groups: Record<TaskWorkflowStatus, Task[]> = {
    backlog: [],
    in_progress: [],
    done: [],
  };

  for (const task of tasks) {
    const status = task.workflowStatus ?? 'backlog';
    const bucket = groups[status] ?? groups.backlog;
    bucket.push(task);
  }

  return groups;
}

function TaskBoardLoading(): JSX.Element {
  return (
    <div className="lockin-board-loading">
      <span className="lockin-inline-spinner" aria-hidden="true" />
      <span>Loading tasks…</span>
    </div>
  );
}

function dropTask(
  tasks: Task[],
  taskId: string,
  targetStatus: TaskWorkflowStatus,
  onUpdateTask: TaskBoardViewProps['onUpdateTask'],
): void {
  const task = tasks.find((t) => t.id === taskId);
  if (task === undefined || task.workflowStatus === targetStatus) {
    return;
  }

  const changes: UpdateTaskInput = { workflowStatus: targetStatus };

  // Sync completed state with workflow status
  if (targetStatus === 'done') {
    changes.completed = true;
  } else if (task.workflowStatus === 'done') {
    changes.completed = false;
  }

  void onUpdateTask(taskId, changes).catch(() => {
    // Rollback is handled inside useTasksList.updateTask
  });
}

function BoardColumns({
  grouped,
  dragOverColumn,
  onToggleComplete,
  onEditTask,
  onDelete,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  grouped: Record<TaskWorkflowStatus, Task[]>;
  dragOverColumn: TaskWorkflowStatus | null;
  onToggleComplete: TaskBoardViewProps['onToggleComplete'];
  onEditTask: TaskBoardViewProps['onEditTask'];
  onDelete: TaskBoardViewProps['onDelete'];
  onDragOver: (status: TaskWorkflowStatus) => void;
  onDragLeave: () => void;
  onDrop: (taskId: string, status: TaskWorkflowStatus) => void;
}): JSX.Element {
  return (
    <div className="lockin-board">
      {TASK_WORKFLOW_STATUSES.map((status) => (
        <TaskColumn
          key={status}
          status={status}
          tasks={grouped[status]}
          isOver={dragOverColumn === status}
          onToggleComplete={onToggleComplete}
          onEditTask={onEditTask}
          onDelete={onDelete}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        />
      ))}
    </div>
  );
}

export function TaskBoardView({
  tasks,
  isLoading,
  onUpdateTask,
  onToggleComplete,
  onEditTask,
  onDelete,
}: TaskBoardViewProps): JSX.Element {
  const [dragOverColumn, setDragOverColumn] = useState<TaskWorkflowStatus | null>(null);

  const grouped = useMemo(() => groupByStatus(tasks), [tasks]);

  const handleDragOver = useCallback((status: TaskWorkflowStatus): void => {
    setDragOverColumn(status);
  }, []);

  const handleDragLeave = useCallback((): void => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(
    (taskId: string, targetStatus: TaskWorkflowStatus): void => {
      setDragOverColumn(null);
      dropTask(tasks, taskId, targetStatus, onUpdateTask);
    },
    [tasks, onUpdateTask],
  );

  if (isLoading && tasks.length === 0) {
    return <TaskBoardLoading />;
  }

  return (
    <BoardColumns
      grouped={grouped}
      dragOverColumn={dragOverColumn}
      onToggleComplete={onToggleComplete}
      onEditTask={onEditTask}
      onDelete={onDelete}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    />
  );
}
