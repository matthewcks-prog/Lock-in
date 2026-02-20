/**
 * TasksListParts — Sub-components for TasksList.
 *
 * Extracted to keep TasksList.tsx under the 300-line file limit.
 */

import { Plus } from 'lucide-react';
import type { Task, TaskFilter, UpdateTaskInput } from '@core/domain/Task';
import { TaskItem } from './TaskItem';

const ICON_SIZE = 16;
const TOTAL_WEEKS = 13;

export function FilterTabs({
  filter,
  total,
  activeCount,
  completedCount,
  onFilterChange,
}: {
  filter: TaskFilter;
  total: number;
  activeCount: number;
  completedCount: number;
  onFilterChange: (filter: TaskFilter) => void;
}): JSX.Element {
  return (
    <div className="lockin-tasks-filters">
      <button
        type="button"
        className={`lockin-tasks-filter-btn${filter === 'all' ? ' is-active' : ''}`}
        onClick={(): void => onFilterChange('all')}
      >
        All ({total})
      </button>
      <button
        type="button"
        className={`lockin-tasks-filter-btn${filter === 'active' ? ' is-active' : ''}`}
        onClick={(): void => onFilterChange('active')}
      >
        Active ({activeCount})
      </button>
      <button
        type="button"
        className={`lockin-tasks-filter-btn${filter === 'completed' ? ' is-active' : ''}`}
        onClick={(): void => onFilterChange('completed')}
      >
        Done ({completedCount})
      </button>
    </div>
  );
}

export function WeekSelect({
  week,
  onChange,
}: {
  week: number | null;
  onChange: (w: number | null) => void;
}): JSX.Element {
  return (
    <select
      className="lockin-task-create-week"
      value={week !== null ? String(week) : ''}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>): void => {
        const v = e.target.value;
        onChange(v === '' ? null : Number(v));
      }}
      aria-label="Assign week"
    >
      <option value="">Week</option>
      {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map((w) => (
        <option key={w} value={String(w)}>
          W{w}
        </option>
      ))}
    </select>
  );
}

export function NewTaskInput({
  newTaskTitle,
  newTaskWeek,
  onNewTaskTitleChange,
  onNewTaskWeekChange,
  onNewTaskCancel,
  onKeyDown,
}: {
  newTaskTitle: string;
  newTaskWeek: number | null;
  onNewTaskTitleChange: (title: string) => void;
  onNewTaskWeekChange: (week: number | null) => void;
  onNewTaskCancel: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}): JSX.Element {
  return (
    <div className="lockin-task-item is-new is-editing">
      <span className="lockin-task-checkbox lockin-task-checkbox-placeholder">
        <Plus size={ICON_SIZE} strokeWidth={1.5} />
      </span>
      <input
        type="text"
        className="lockin-task-input"
        value={newTaskTitle}
        onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
          onNewTaskTitleChange(e.target.value)
        }
        onKeyDown={onKeyDown}
        onBlur={(): void => {
          if (newTaskTitle.trim() === '') {
            onNewTaskCancel();
          }
        }}
        placeholder="Add a task..."
        autoFocus
        aria-label="New task title"
      />
      <WeekSelect week={newTaskWeek} onChange={onNewTaskWeekChange} />
    </div>
  );
}

export function EmptyState({
  filter,
  totalCount,
  courseCode,
}: {
  filter: TaskFilter;
  totalCount: number;
  courseCode: string | null;
}): JSX.Element | null {
  if (filter === 'all' && totalCount === 0) {
    return (
      <>
        <p>No tasks yet</p>
        <p className="lockin-tasks-empty-hint">
          Click &quot;Add task&quot; to create your first study task
        </p>
      </>
    );
  }
  if (filter === 'active') {
    return <p>No active tasks — you&apos;re all caught up! 🎉</p>;
  }
  if (filter === 'completed') {
    return <p>No completed tasks yet</p>;
  }
  if (filter === 'course') {
    return <p>No tasks for {courseCode}</p>;
  }
  return null;
}

export function TaskItemsList({
  filteredTasks,
  editingTaskId,
  deletingTaskId,
  onToggleComplete,
  onUpdateTask,
  onStartEdit,
  onStopEdit,
  onDelete,
}: {
  filteredTasks: Task[];
  editingTaskId: string | null;
  deletingTaskId: string | null;
  onToggleComplete: (taskId: string) => void;
  onUpdateTask: (taskId: string, changes: UpdateTaskInput) => void;
  onStartEdit: (taskId: string) => void;
  onStopEdit: () => void;
  onDelete: (taskId: string) => void;
}): JSX.Element {
  return (
    <div className="lockin-tasks-items" role="list">
      {filteredTasks.map((task) => (
        <TaskItem
          key={task.id !== null && task.id !== '' ? task.id : 'new'}
          task={task}
          isEditing={editingTaskId === task.id}
          onToggleComplete={(): void => {
            if (task.id !== null && task.id !== '') {
              onToggleComplete(task.id);
            }
          }}
          onUpdateTask={onUpdateTask}
          onStartEdit={(): void => {
            if (task.id !== null && task.id !== '') {
              onStartEdit(task.id);
            }
          }}
          onStopEdit={onStopEdit}
          onDelete={(): void => {
            if (task.id !== null && task.id !== '') {
              onDelete(task.id);
            }
          }}
          isDeleting={deletingTaskId === task.id}
        />
      ))}
    </div>
  );
}

export function CreateSection({
  isCreating,
  newTaskTitle,
  newTaskWeek,
  onNewTaskTitleChange,
  onNewTaskWeekChange,
  onNewTaskCancel,
  onKeyDown,
  onCreateTask,
}: {
  isCreating: boolean;
  newTaskTitle: string;
  newTaskWeek: number | null;
  onNewTaskTitleChange: (title: string) => void;
  onNewTaskWeekChange: (week: number | null) => void;
  onNewTaskCancel: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onCreateTask: () => void;
}): JSX.Element {
  return (
    <div className="lockin-tasks-create">
      {isCreating ? (
        <NewTaskInput
          newTaskTitle={newTaskTitle}
          newTaskWeek={newTaskWeek}
          onNewTaskTitleChange={onNewTaskTitleChange}
          onNewTaskWeekChange={onNewTaskWeekChange}
          onNewTaskCancel={onNewTaskCancel}
          onKeyDown={onKeyDown}
        />
      ) : (
        <button type="button" className="lockin-tasks-add-btn" onClick={onCreateTask}>
          <Plus size={ICON_SIZE} strokeWidth={2} />
          <span>Add task</span>
        </button>
      )}
    </div>
  );
}

interface TasksListBodyProps {
  isLoading: boolean;
  totalCount: number;
  filteredTasks: Task[];
  filter: TaskFilter;
  courseCode: string | null;
  editingTaskId: string | null;
  deletingTaskId: string | null;
  onToggleComplete: (taskId: string) => void;
  onUpdateTask: (taskId: string, changes: UpdateTaskInput) => void;
  onStartEdit: (taskId: string) => void;
  onStopEdit: () => void;
  onDelete: (taskId: string) => void;
}

export function TasksListBody(props: TasksListBodyProps): JSX.Element {
  return (
    <>
      {props.isLoading && props.totalCount === 0 && (
        <div className="lockin-tasks-loading">
          <span className="lockin-inline-spinner" aria-hidden="true" />
          <span>Loading tasks...</span>
        </div>
      )}
      {!props.isLoading && props.filteredTasks.length === 0 && (
        <div className="lockin-tasks-empty">
          <EmptyState
            filter={props.filter}
            totalCount={props.totalCount}
            courseCode={props.courseCode}
          />
        </div>
      )}
      <TaskItemsList
        filteredTasks={props.filteredTasks}
        editingTaskId={props.editingTaskId}
        deletingTaskId={props.deletingTaskId}
        onToggleComplete={props.onToggleComplete}
        onUpdateTask={props.onUpdateTask}
        onStartEdit={props.onStartEdit}
        onStopEdit={props.onStopEdit}
        onDelete={props.onDelete}
      />
    </>
  );
}
