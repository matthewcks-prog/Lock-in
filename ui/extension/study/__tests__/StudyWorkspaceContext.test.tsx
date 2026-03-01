import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StudyWorkspaceProvider, useStudyWorkspace } from '../StudyWorkspaceContext';

function StudyStateControls(): JSX.Element {
  const { openToolTab } = useStudyWorkspace();
  return (
    <button type="button" onClick={() => openToolTab('transcript')}>
      Open Transcript
    </button>
  );
}

function StudyStateProbe(): JSX.Element {
  const { openToolTabIds, activeToolId } = useStudyWorkspace();
  return <div>{`${openToolTabIds.join(',')}|${activeToolId ?? 'none'}`}</div>;
}

function Harness(): JSX.Element {
  const [isStudyMounted, setIsStudyMounted] = useState(true);
  return (
    <StudyWorkspaceProvider>
      <StudyStateControls />
      <button type="button" onClick={() => setIsStudyMounted((prev) => !prev)}>
        Toggle Study
      </button>
      {isStudyMounted && <StudyStateProbe />}
    </StudyWorkspaceProvider>
  );
}

describe('StudyWorkspaceContext', () => {
  it('preserves open study tabs when study view is toggled off and back on', () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Transcript' }));
    expect(screen.getByText('transcript|transcript')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Study' }));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Study' }));

    expect(screen.getByText('transcript|transcript')).toBeInTheDocument();
  });
});
