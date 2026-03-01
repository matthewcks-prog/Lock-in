import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGenerateSummary } from '../useGenerateSummary';

const openToolTab = vi.fn();
const generateSummary = vi.fn();

vi.mock('../../study/StudyWorkspaceContext', () => ({
  useStudyWorkspace: () => ({
    openToolTab,
  }),
}));

vi.mock('../../study/StudySummaryContext', () => ({
  useStudySummary: () => ({
    generateSummary,
    summaryState: { status: 'idle' },
  }),
}));

describe('useGenerateSummary', () => {
  beforeEach(() => {
    openToolTab.mockReset();
    generateSummary.mockReset();
  });

  it('opens summary tab and triggers summary generation', () => {
    const { result } = renderHook(() => useGenerateSummary());

    act(() => {
      result.current.generateSummary();
    });

    expect(openToolTab).toHaveBeenCalledWith('summary');
    expect(generateSummary).toHaveBeenCalledWith({ force: true });
  });
});
