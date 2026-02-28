import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { StudyToolId } from '../studyToolRegistry';
import {
  closeStudyToolTab,
  focusStudyToolTab,
  INITIAL_STUDY_TABS_STATE,
  openStudyToolTab,
  type StudyTabsState,
} from '../studyTabsState';
import { ToolPanelLayout, type ToolPanelTab } from '../ToolPanelLayout';

const TEST_TOOL_TABS: Record<StudyToolId, ToolPanelTab<StudyToolId>> = {
  transcript: { id: 'transcript', title: 'Transcript', closeable: true },
  summary: { id: 'summary', title: 'Summary', closeable: true },
};

function Harness(): JSX.Element {
  const [state, setState] = useState<StudyTabsState>(INITIAL_STUDY_TABS_STATE);
  const openTool = (toolId: StudyToolId): void => {
    setState((prev) => openStudyToolTab(prev, toolId));
  };

  return (
    <div>
      <button type="button" onClick={() => openTool('transcript')}>
        Open Transcript
      </button>
      <button type="button" onClick={() => openTool('summary')}>
        Open Summary
      </button>
      <ToolPanelLayout
        ariaLabel="Study tools tabs"
        idPrefix="lockin-study-tool-test"
        tabs={state.openToolIds.map((toolId) => TEST_TOOL_TABS[toolId])}
        activeTabId={state.activeToolId}
        onActivateTab={(toolId) => setState((prev) => focusStudyToolTab(prev, toolId))}
        onCloseTab={(toolId) => setState((prev) => closeStudyToolTab(prev, toolId))}
        emptyState={<div data-testid="empty-state">Open a study tool to continue.</div>}
        renderContent={(toolId) => (
          <div data-testid={`${toolId}-content`}>
            <div data-testid={`${toolId}-scroll`}>{toolId} content</div>
          </div>
        )}
        renderActions={(toolId) =>
          toolId === 'transcript' ? (
            <div data-testid="transcript-actions-bar">Transcript actions</div>
          ) : null
        }
      />
    </div>
  );
}

describe('ToolPanelLayout', () => {
  it('opening a study tool creates a tab', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Transcript' }));
    expect(screen.getByRole('tab', { name: 'Transcript' })).toBeInTheDocument();
  });

  it('closing a tab removes it', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Transcript' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close Transcript' }));

    expect(screen.queryByRole('tab', { name: 'Transcript' })).not.toBeInTheDocument();
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('changing active tab swaps visible content', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Transcript' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Summary' }));

    expect(screen.getByTestId('summary-content')).toBeVisible();
    expect(screen.getByTestId('transcript-content')).not.toBeVisible();

    fireEvent.click(screen.getByRole('tab', { name: 'Transcript' }));
    expect(screen.getByTestId('transcript-content')).toBeVisible();
    expect(screen.getByTestId('summary-content')).not.toBeVisible();
  });

  it('keeps actions rendered outside the scrollable content region', () => {
    const { container } = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Transcript' }));

    const contentShell = container.querySelector('.lockin-study-tool-panel-content');
    const actionsBar = screen.getByTestId('transcript-actions-bar');
    const transcriptScroll = screen.getByTestId('transcript-scroll');

    expect(transcriptScroll).toBeInTheDocument();
    expect(actionsBar).toBeVisible();
    expect(contentShell?.contains(actionsBar)).toBe(false);
  });
});
