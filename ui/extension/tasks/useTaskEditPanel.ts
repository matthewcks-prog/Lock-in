/**
 * useTaskEditPanel Hook
 *
 * Manages TaskEditPanel local state and debounced saves.
 * Extracted from TaskEditPanel.tsx to keep functions under 50 lines.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Task, TaskWorkflowStatus, UpdateTaskInput } from '@core/domain/Task';
import type { TaskEditPanelProps } from './TaskEditPanel';

const DEBOUNCE_MS = 600;

function hasTaskId(task: Task): boolean {
  return task.id !== null && task.id !== '';
}

function makeDebouncedSave(
  saveTimeoutRef: React.MutableRefObject<number | null>,
  task: Task,
  onSave: TaskEditPanelProps['onSave'],
): (changes: UpdateTaskInput) => void {
  return (changes: UpdateTaskInput): void => {
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = window.setTimeout(() => {
      if (hasTaskId(task)) {
        onSave(task.id!, changes);
      }
      saveTimeoutRef.current = null;
    }, DEBOUNCE_MS);
  };
}

function handleTitleChangeImpl(
  debouncedSave: (c: UpdateTaskInput) => void,
  setTitle: React.Dispatch<React.SetStateAction<string>>,
  e: React.ChangeEvent<HTMLInputElement>,
): void {
  const val = e.target.value;
  setTitle(val);
  debouncedSave({ title: val });
}

function handleDescChangeImpl(
  debouncedSave: (c: UpdateTaskInput) => void,
  setDescription: React.Dispatch<React.SetStateAction<string>>,
  e: React.ChangeEvent<HTMLTextAreaElement>,
): void {
  const val = e.target.value;
  setDescription(val);
  debouncedSave({ description: val !== '' ? val : null });
}

function handleDueDateImpl(
  task: Task,
  onSave: TaskEditPanelProps['onSave'],
  setDueDate: React.Dispatch<React.SetStateAction<string>>,
  e: React.ChangeEvent<HTMLInputElement>,
): void {
  const val = e.target.value;
  setDueDate(val);
  if (hasTaskId(task)) {
    const isoDate = val !== '' ? new Date(val + 'T00:00:00.000Z').toISOString() : null;
    onSave(task.id!, { dueDate: isoDate });
  }
}

function handleStatusImpl(
  task: Task,
  onSave: TaskEditPanelProps['onSave'],
  setWorkflowStatus: React.Dispatch<React.SetStateAction<TaskWorkflowStatus>>,
  e: React.ChangeEvent<HTMLSelectElement>,
): void {
  const newStatus = e.target.value as TaskWorkflowStatus;
  setWorkflowStatus(newStatus);
  if (hasTaskId(task)) {
    const changes: UpdateTaskInput = { workflowStatus: newStatus };
    if (newStatus === 'done') {
      changes.completed = true;
    } else if (task.completed && task.workflowStatus === 'done') {
      changes.completed = false;
    }
    onSave(task.id!, changes);
  }
}

function handleWeekImpl(
  task: Task,
  onSave: TaskEditPanelProps['onSave'],
  setWeek: React.Dispatch<React.SetStateAction<number | null>>,
  e: React.ChangeEvent<HTMLSelectElement>,
): void {
  const val = e.target.value;
  const newWeek = val === '' ? null : Number(val);
  setWeek(newWeek);
  if (hasTaskId(task)) {
    onSave(task.id!, { week: newWeek });
  }
}

export interface TaskEditState {
  title: string;
  description: string;
  dueDate: string;
  workflowStatus: TaskWorkflowStatus;
  week: number | null;
  titleRef: React.RefObject<HTMLInputElement>;
  handleTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDescriptionChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleDueDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleStatusChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleWeekChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  handleToggle: (e: React.MouseEvent) => void;
  handleDeleteClick: (e: React.MouseEvent) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

// eslint-disable-next-line max-lines-per-function -- composition of standalone handlers
export function useTaskEditPanel(props: TaskEditPanelProps): TaskEditState {
  const { task, onSave, onClose, onToggleComplete, onDelete } = props;

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [workflowStatus, setWorkflowStatus] = useState<TaskWorkflowStatus>(
    task.workflowStatus ?? 'backlog',
  );
  const [week, setWeek] = useState<number | null>(task.week ?? null);
  const titleRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (titleRef.current !== null) {
      titleRef.current.focus();
      titleRef.current.selectionStart = titleRef.current.value.length;
    }
    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? '');
    setDueDate(task.dueDate ?? '');
    setWorkflowStatus(task.workflowStatus ?? 'backlog');
    setWeek(task.week ?? null);
  }, [task.title, task.description, task.dueDate, task.workflowStatus, task.week]);

  const debouncedSave = useCallback(
    (changes: UpdateTaskInput): void => {
      makeDebouncedSave(saveTimeoutRef, task, onSave)(changes);
    },
    [task, onSave],
  );

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      handleTitleChangeImpl(debouncedSave, setTitle, e);
    },
    [debouncedSave],
  );

  const handleDescriptionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
      handleDescChangeImpl(debouncedSave, setDescription, e);
    },
    [debouncedSave],
  );

  const handleDueDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      handleDueDateImpl(task, onSave, setDueDate, e);
    },
    [task, onSave],
  );

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>): void => {
      handleStatusImpl(task, onSave, setWorkflowStatus, e);
    },
    [task, onSave],
  );

  const handleWeekChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>): void => {
      handleWeekImpl(task, onSave, setWeek, e);
    },
    [task, onSave],
  );

  const handleToggle = useCallback(
    (e: React.MouseEvent): void => {
      e.stopPropagation();
      if (hasTaskId(task)) {
        onToggleComplete(task.id!);
      }
    },
    [task, onToggleComplete],
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent): void => {
      e.stopPropagation();
      if (hasTaskId(task)) {
        onDelete(task.id!);
      }
    },
    [task, onDelete],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      if (e.key !== 'Escape') {
        return;
      }
      e.preventDefault();
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
        if (hasTaskId(task)) {
          onSave(task.id!, {
            title: title.trim() !== '' ? title.trim() : task.title,
            description: description !== '' ? description : null,
          });
        }
      }
      onClose();
    },
    [onClose, task, title, description, onSave],
  );

  return {
    title,
    description,
    dueDate,
    workflowStatus,
    week,
    titleRef,
    handleTitleChange,
    handleDescriptionChange,
    handleDueDateChange,
    handleStatusChange,
    handleWeekChange,
    handleToggle,
    handleDeleteClick,
    handleKeyDown,
  };
}
