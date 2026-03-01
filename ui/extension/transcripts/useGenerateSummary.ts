/**
 * useGenerateSummary
 *
 * Opens/focuses Summary tool and triggers summary generation for
 * the currently selected transcript context.
 */

import { useCallback } from 'react';
import { useStudyWorkspace } from '../study/StudyWorkspaceContext';
import { useStudySummary } from '../study/StudySummaryContext';

export interface UseGenerateSummaryResult {
  generateSummary: () => void;
  isLoading: boolean;
}

export function useGenerateSummary(): UseGenerateSummaryResult {
  const { openToolTab } = useStudyWorkspace();
  const { generateSummary: generateStudySummary, summaryState } = useStudySummary();

  const generateSummary = useCallback(() => {
    openToolTab('summary');
    void generateStudySummary({ force: true });
  }, [generateStudySummary, openToolTab]);

  return { generateSummary, isLoading: summaryState.status === 'loading' };
}
