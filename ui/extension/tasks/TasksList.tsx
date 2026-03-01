/**
 * TasksList Component
 *
 * Renders a list of tasks with filtering and inline creation.
 */

import { useCallback, useMemo } from 'react';
import type { Task, TaskFilter, UpdateTaskInput } from '@core/domain/Task';
import { FilterTabs, CreateSection, TasksListBody } from './TasksListParts';

export interface TasksListProps {
  tasks: Task[];
  isLoading: boolean;
  filter: TaskFilter;
  courseCode: string | null;
  editingTaskId: string | null;
  deletingTaskId: string | null;
  onFilterChange: (filter: TaskFilter) => void;
  onToggleComplete: (taskId: string) => void;
  onUpdateTask: (taskId: string, changes: UpdateTaskInput) => void;
  onStartEdit: (taskId: string) => void;
  onStopEdit: () => void;
  onDelete: (taskId: string) => void;
  onCreateTask: () => void;
  isCreating: boolean;
  newTaskTitle: string;
  newTaskWeek: number | null;
  onNewTaskTitleChange: (title: string) => void;
  onNewTaskWeekChange: (week: number | null) => void;
  onNewTaskSubmit: () => void;
  onNewTaskCancel: () => void;
}

function filterTasks(tasks: Task[], filter: TaskFilter, courseCode: string | null): Task[] {
  switch (filter) {
    case 'active':
      return tasks.filter((t) => !t.completed);
    case 'completed':
      return tasks.filter((t) => t.completed);
    case 'course':
      if (courseCode !== null && courseCode !== '') {
        return tasks.filter((t) => t.courseCode === courseCode);
      }
      return tasks;
    case 'all':
      return tasks;
  }
}

function handleNewTaskKey(
  e: React.KeyboardEvent<HTMLInputElement>,
  title: string,
  onSubmit: () => void,
  onCancel: () => void,
): void {
  if (e.key === 'Enter' && title.trim() !== '') {
    e.preventDefault();
    onSubmit();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    onCancel();
  }
}

export function TasksList(props: TasksListProps): JSX.Element {
  const { tasks, isLoading, filter, courseCode, newTaskTitle } = props;

  const filteredTasks = useMemo(
    () => filterTasks(tasks, filter, courseCode),
    [tasks, filter, courseCode],
  );
  const activeCount = useMemo(() => tasks.filter((t) => !t.completed).length, [tasks]);
  const completedCount = useMemo(() => tasks.filter((t) => t.completed).length, [tasks]);

  const handleNewTaskKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      handleNewTaskKey(e, newTaskTitle, props.onNewTaskSubmit, props.onNewTaskCancel);
    },
    [newTaskTitle, props.onNewTaskSubmit, props.onNewTaskCancel],
  );

  return (
    <div className="lockin-tasks-list">
      <FilterTabs
        filter={filter}
        total={tasks.length}
        activeCount={activeCount}
        completedCount={completedCount}
        onFilterChange={props.onFilterChange}
      />
      <CreateSection
        isCreating={props.isCreating}
        newTaskTitle={newTaskTitle}
        newTaskWeek={props.newTaskWeek}
        onNewTaskTitleChange={props.onNewTaskTitleChange}
        onNewTaskWeekChange={props.onNewTaskWeekChange}
        onNewTaskCancel={props.onNewTaskCancel}
        onKeyDown={handleNewTaskKeyDown}
        onCreateTask={props.onCreateTask}
      />
      <TasksListBody
        isLoading={isLoading}
        totalCount={tasks.length}
        filteredTasks={filteredTasks}
        filter={filter}
        courseCode={courseCode}
        editingTaskId={props.editingTaskId}
        deletingTaskId={props.deletingTaskId}
        onToggleComplete={props.onToggleComplete}
        onUpdateTask={props.onUpdateTask}
        onStartEdit={props.onStartEdit}
        onStopEdit={props.onStopEdit}
        onDelete={props.onDelete}
      />
    </div>
  );
}
