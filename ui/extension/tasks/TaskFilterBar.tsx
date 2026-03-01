/**
 * TaskFilterBar Component
 *
 * Shared filter bar for both list and board views.
 * Provides dropdown filters for course/unit and week.
 * Extracts unique values from the task list.
 */

import { useMemo, useCallback } from 'react';
import type { Task } from '@core/domain/Task';

export interface TaskFilterBarProps {
  tasks: Task[];
  selectedCourse: string | null;
  selectedWeek: number | null;
  onCourseChange: (course: string | null) => void;
  onWeekChange: (week: number | null) => void;
}

function CourseSelect({
  courses,
  selectedCourse,
  onChange,
}: {
  courses: string[];
  selectedCourse: string | null;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}): JSX.Element {
  return (
    <select
      className="lockin-task-filter-select"
      value={selectedCourse ?? ''}
      onChange={onChange}
      aria-label="Filter by course"
    >
      <option value="">All Units</option>
      {courses.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

function WeekSelect({
  weeks,
  selectedWeek,
  onChange,
}: {
  weeks: number[];
  selectedWeek: number | null;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}): JSX.Element {
  return (
    <select
      className="lockin-task-filter-select"
      value={selectedWeek !== null ? String(selectedWeek) : ''}
      onChange={onChange}
      aria-label="Filter by week"
    >
      <option value="">All Weeks</option>
      {weeks.map((w) => (
        <option key={w} value={String(w)}>
          Week {w}
        </option>
      ))}
    </select>
  );
}

export function TaskFilterBar({
  tasks,
  selectedCourse,
  selectedWeek,
  onCourseChange,
  onWeekChange,
}: TaskFilterBarProps): JSX.Element {
  const courses = useMemo(() => {
    const set = new Set<string>();
    for (const t of tasks) {
      if (t.courseCode !== null && t.courseCode !== '') {
        set.add(t.courseCode);
      }
    }
    return Array.from(set).sort();
  }, [tasks]);

  const weeks = useMemo(() => {
    const set = new Set<number>();
    for (const t of tasks) {
      if (t.week !== null) {
        set.add(t.week);
      }
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [tasks]);

  const handleCourseChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>): void => {
      const val = e.target.value;
      onCourseChange(val === '' ? null : val);
    },
    [onCourseChange],
  );

  const handleWeekChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>): void => {
      const val = e.target.value;
      onWeekChange(val === '' ? null : Number(val));
    },
    [onWeekChange],
  );

  return (
    <div className="lockin-task-filter-bar">
      <CourseSelect
        courses={courses}
        selectedCourse={selectedCourse}
        onChange={handleCourseChange}
      />
      <WeekSelect weeks={weeks} selectedWeek={selectedWeek} onChange={handleWeekChange} />
    </div>
  );
}
