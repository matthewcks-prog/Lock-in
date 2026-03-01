/**
 * useGenerateSummary
 *
 * Stub hook that wires the "Generate summary" call-site.
 * Real generation logic (backend call, streaming, etc.) will replace the
 * placeholder body without requiring any changes to consuming components.
 */

import { useCallback, useState } from 'react';

export interface UseGenerateSummaryResult {
  generateSummary: () => void;
  isLoading: boolean;
}

export function useGenerateSummary(): UseGenerateSummaryResult {
  // Kept as useState so that future loading state wires in without API change.
  const [isLoading] = useState(false);

  const generateSummary = useCallback(() => {
    // TODO: replace with real summary-generation call
    console.log('Generate summary – coming soon');
  }, []);

  return { generateSummary, isLoading };
}
