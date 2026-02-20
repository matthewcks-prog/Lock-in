/**
 * TasksPanelHeader Component
 *
 * Header for the tasks panel showing context, stats, and view mode toggle.
 */

import { List, LayoutGrid } from 'lucide-react';
import type { TasksViewMode } from '@core/domain/Task';

export interface TasksPanelHeaderProps {
  courseCode: string | null;
  stats: {
    total: number;
    completed: number;
    active: number;
  };
  viewMode?: TasksViewMode | undefined;
  onViewModeChange?: ((mode: TasksViewMode) => void) | undefined;
}

export function TasksPanelHeader({
  courseCode,
  stats,
  viewMode,
  onViewModeChange,
}: TasksPanelHeaderProps): JSX.Element {
  return (
    <div className="lockin-tasks-header">
      <div className="lockin-tasks-header-left">
        <h2 className="lockin-tasks-title">
          {courseCode !== null && courseCode.length > 0 ? courseCode : 'Tasks'}
        </h2>
      </div>

      <div className="lockin-tasks-header-right">
        <div className="lockin-tasks-stats">
          <span className="lockin-tasks-stat">{stats.active} active</span>
          {stats.completed > 0 && (
            <span className="lockin-tasks-stat lockin-tasks-stat-completed">
              {stats.completed} done
            </span>
          )}
        </div>

        {viewMode !== undefined && onViewModeChange !== undefined && (
          <div className="lockin-tasks-view-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={`lockin-tasks-view-btn${viewMode === 'list' ? ' is-active' : ''}`}
              onClick={() => onViewModeChange('list')}
              aria-label="List view"
              title="List view"
            >
              <List size={14} strokeWidth={2} />
            </button>
            <button
              type="button"
              className={`lockin-tasks-view-btn${viewMode === 'board' ? ' is-active' : ''}`}
              onClick={() => onViewModeChange('board')}
              aria-label="Board view"
              title="Board view"
            >
              <LayoutGrid size={14} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
