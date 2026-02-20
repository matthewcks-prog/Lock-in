/**
 * TaskEditPanel sub-components.
 *
 * Extracted from TaskEditPanel.tsx to stay within the 300-line file limit.
 * Each sub-component renders one section of the edit panel.
 */

import { X, Check, Circle } from 'lucide-react';
import type { Task, TaskWorkflowStatus } from '@core/domain/Task';
import { TASK_WORKFLOW_STATUSES, TASK_WORKFLOW_STATUS_LABELS } from '@core/domain/Task';

const ICON_SIZE = 16;
const ICON_SIZE_CLOSE = 14;
const TOTAL_WEEKS = 13;
const DATE_SLICE_END = 10;

/* ------------------------------------------------------------------ */
/*  EditHeader                                                         */
/* ------------------------------------------------------------------ */

export function EditHeader({
  task,
  onToggle,
  onClose,
}: {
  task: Task;
  onToggle: (e: React.MouseEvent) => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <div className="lockin-task-edit-header">
      <button
        type="button"
        className="lockin-task-checkbox"
        onClick={onToggle}
        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
      >
        {task.completed ? (
          <Check className="lockin-task-check-icon" size={ICON_SIZE} strokeWidth={2.5} />
        ) : (
          <Circle className="lockin-task-circle-icon" size={ICON_SIZE} strokeWidth={1.5} />
        )}
      </button>
      <button
        type="button"
        className="lockin-task-edit-close"
        onClick={onClose}
        aria-label="Close editor"
      >
        <X size={ICON_SIZE_CLOSE} strokeWidth={2} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Field sub-components                                               */
/* ------------------------------------------------------------------ */

function StatusField({
  taskId,
  workflowStatus,
  onChange,
}: {
  taskId: string | null;
  workflowStatus: TaskWorkflowStatus;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}): JSX.Element {
  return (
    <div className="lockin-task-edit-field">
      <label className="lockin-task-edit-label" htmlFor={`status-${taskId}`}>
        Status
      </label>
      <select
        id={`status-${taskId}`}
        className="lockin-task-edit-select"
        value={workflowStatus}
        onChange={onChange}
      >
        {TASK_WORKFLOW_STATUSES.map((s) => (
          <option key={s} value={s}>
            {TASK_WORKFLOW_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );
}

function DueDateField({
  taskId,
  dueDate,
  onChange,
}: {
  taskId: string | null;
  dueDate: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}): JSX.Element {
  return (
    <div className="lockin-task-edit-field">
      <label className="lockin-task-edit-label" htmlFor={`due-${taskId}`}>
        Due date
      </label>
      <input
        id={`due-${taskId}`}
        type="date"
        className="lockin-task-edit-date"
        value={dueDate !== '' ? dueDate.slice(0, DATE_SLICE_END) : ''}
        onChange={onChange}
        aria-label="Due date"
      />
    </div>
  );
}

function WeekField({
  taskId,
  week,
  onChange,
}: {
  taskId: string | null;
  week: number | null;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}): JSX.Element {
  return (
    <div className="lockin-task-edit-field">
      <label className="lockin-task-edit-label" htmlFor={`week-${taskId}`}>
        Week
      </label>
      <select
        id={`week-${taskId}`}
        className="lockin-task-edit-select"
        value={week !== null ? String(week) : ''}
        onChange={onChange}
      >
        <option value="">None</option>
        {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map((w) => (
          <option key={w} value={String(w)}>
            Week {w}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EditFieldsRow                                                      */
/* ------------------------------------------------------------------ */

export function EditFieldsRow({
  task,
  workflowStatus,
  dueDate,
  week,
  onStatusChange,
  onDueDateChange,
  onWeekChange,
}: {
  task: Task;
  workflowStatus: TaskWorkflowStatus;
  dueDate: string;
  week: number | null;
  onStatusChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onDueDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onWeekChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}): JSX.Element {
  return (
    <div className="lockin-task-edit-fields">
      <StatusField taskId={task.id} workflowStatus={workflowStatus} onChange={onStatusChange} />
      <DueDateField taskId={task.id} dueDate={dueDate} onChange={onDueDateChange} />
      <WeekField taskId={task.id} week={week} onChange={onWeekChange} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EditFooter                                                         */
/* ------------------------------------------------------------------ */

export function EditFooter({
  task,
  isDeleting,
  onDelete,
}: {
  task: Task;
  isDeleting: boolean;
  onDelete: (e: React.MouseEvent) => void;
}): JSX.Element {
  return (
    <div className="lockin-task-edit-footer">
      {task.courseCode !== null && task.courseCode !== '' && (
        <span className="lockin-task-badge">{task.courseCode}</span>
      )}
      <div className="lockin-task-edit-spacer" />
      <button
        type="button"
        className="lockin-task-edit-delete"
        onClick={onDelete}
        disabled={isDeleting}
        aria-label="Delete task"
      >
        {isDeleting ? <span className="lockin-inline-spinner" aria-hidden="true" /> : 'Delete'}
      </button>
    </div>
  );
}
