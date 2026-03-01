import type { ApiClient, StudySummaryDepth } from '@api/client';
import type { TranscriptResult } from '@core/transcripts/types';
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useStudyWorkspace } from './StudyWorkspaceContext';
import {
  useGenerateSummaryAction,
  useRegisterTranscript,
  useSelectedSummary,
  type StudySummaryState,
  type TranscriptSnapshot,
} from './studySummaryRuntime';

interface StudySummaryContextValue {
  depth: StudySummaryDepth;
  setDepth: (depth: StudySummaryDepth) => void;
  summaryState: StudySummaryState;
  hasTranscriptForSelectedVideo: boolean;
  registerTranscript: (videoId: string, transcript: TranscriptResult) => void;
  generateSummary: (options?: { force?: boolean }) => Promise<void>;
}

interface StudySummaryProviderProps {
  children: ReactNode;
  apiClient: ApiClient | null;
  courseCode?: string | null;
  courseName?: string | null;
  week?: number | null;
  topic?: string | null;
  goal?: string | null;
}

const DEFAULT_DEPTH: StudySummaryDepth = 'standard';
const StudySummaryContext = createContext<StudySummaryContextValue | null>(null);

function useStudySummaryValue({
  depth,
  setDepth,
  selectedSummaryState,
  selectedTranscript,
  registerTranscript,
  generateSummary,
}: {
  depth: StudySummaryDepth;
  setDepth: (depth: StudySummaryDepth) => void;
  selectedSummaryState: StudySummaryState;
  selectedTranscript: TranscriptSnapshot | undefined;
  registerTranscript: (videoId: string, transcript: TranscriptResult) => void;
  generateSummary: (options?: { force?: boolean }) => Promise<void>;
}): StudySummaryContextValue {
  return useMemo(
    () => ({
      depth,
      setDepth,
      summaryState: selectedSummaryState,
      hasTranscriptForSelectedVideo: selectedTranscript !== undefined,
      registerTranscript,
      generateSummary,
    }),
    [depth, selectedSummaryState, selectedTranscript, registerTranscript, generateSummary],
  );
}

export function StudySummaryProvider({
  children,
  apiClient,
  courseCode,
  courseName,
  week,
  topic,
  goal,
}: StudySummaryProviderProps): JSX.Element {
  const { selectedVideo } = useStudyWorkspace();
  const [depth, setDepth] = useState<StudySummaryDepth>(DEFAULT_DEPTH);
  const [transcriptByVideoId, setTranscriptByVideoId] = useState<
    Record<string, TranscriptSnapshot>
  >({});
  const [summaryByKey, setSummaryByKey] = useState<Record<string, StudySummaryState>>({});
  const requestTokenByKeyRef = useRef<Record<string, string>>({});
  const selectedVideoId = selectedVideo?.id ?? null;
  const { selectedTranscript, selectedSummaryState } = useSelectedSummary({
    selectedVideoId,
    depth,
    transcriptByVideoId,
    summaryByKey,
  });
  const registerTranscript = useRegisterTranscript(setTranscriptByVideoId);
  const generateSummary = useGenerateSummaryAction({
    apiClient,
    depth,
    selectedVideoId,
    selectedVideoTitle: selectedVideo?.title ?? 'Video',
    selectedTranscript,
    summaryByKey,
    setSummaryByKey,
    requestTokenByKeyRef,
    courseCode,
    courseName,
    week,
    topic,
    goal,
  });
  const value = useStudySummaryValue({
    depth,
    setDepth,
    selectedSummaryState,
    selectedTranscript,
    registerTranscript,
    generateSummary,
  });

  return <StudySummaryContext.Provider value={value}>{children}</StudySummaryContext.Provider>;
}

export function useStudySummary(): StudySummaryContextValue {
  const context = useContext(StudySummaryContext);
  if (context === null) {
    throw new Error('useStudySummary must be used within a StudySummaryProvider');
  }
  return context;
}
