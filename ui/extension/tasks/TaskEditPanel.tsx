/**
 * TaskEditPanel Component
 *
 * Expandable inline editor for a task.
 * Shows: title, description (multi-line), due date, status dropdown, course badge.
 * Status dropdown changes move the task between Kanban columns.
 */

import type { Task, UpdateTaskInput } from '@core/domain/Task';
import { EditHeader, EditFieldsRow, EditFooter } from './TaskEditPanelParts';
import { useTaskEditPanel } from './useTaskEditPanel';

export interface TaskEditPanelProps {
  task: Task;
  onSave: (taskId: string, changes: UpdateTaskInput) => void;
  onClose: () => void;
  onToggleComplete: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  isDeleting: boolean;
}

const TEXTAREA_ROWS = 3;

export function TaskEditPanel(props: TaskEditPanelProps): JSX.Element {
  const { task, onClose, isDeleting } = props;
  const edit = useTaskEditPanel(props);

  return (
    <div className="lockin-task-edit-panel" onKeyDown={edit.handleKeyDown}>
      <EditHeader task={task} onToggle={edit.handleToggle} onClose={onClose} />
      <input
        ref={edit.titleRef}
        type="text"
        className="lockin-task-edit-title"
        value={edit.title}
        onChange={edit.handleTitleChange}
        placeholder="Task title…"
        aria-label="Task title"
      />
      <textarea
        className="lockin-task-edit-description"
        value={edit.description}
        onChange={edit.handleDescriptionChange}
        placeholder="Add notes or details…"
        rows={TEXTAREA_ROWS}
        aria-label="Task description"
      />
      <EditFieldsRow
        task={task}
        workflowStatus={edit.workflowStatus}
        dueDate={edit.dueDate}
        week={edit.week}
        onStatusChange={edit.handleStatusChange}
        onDueDateChange={edit.handleDueDateChange}
        onWeekChange={edit.handleWeekChange}
      />
      <EditFooter task={task} isDeleting={isDeleting} onDelete={edit.handleDeleteClick} />
    </div>
  );
}
