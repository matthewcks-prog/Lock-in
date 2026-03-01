import type { ApiClient, StudySummaryDepth } from '@api/client';
import type { TranscriptResult } from '@core/transcripts/types';
import {
  useCallback,
  useMemo,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';

export type SummaryStatus = 'idle' | 'loading' | 'success' | 'error';

export interface StudySummaryState {
  status: SummaryStatus;
  markdown: string;
  error: string | null;
  depth: StudySummaryDepth;
  chunked: boolean;
  chunkCount: number;
  generatedAt: number | null;
}

export interface TranscriptSnapshot {
  transcript: TranscriptResult;
  fingerprint: string;
}

const HASH_SHIFT_BITS = 5;
const HASH_RADIX = 36;
const FINGERPRINT_PREVIEW_CHARS = 1200;
const DEFAULT_GOAL = 'weekly review';

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << HASH_SHIFT_BITS) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(HASH_RADIX);
}

export function createIdleSummaryState(depth: StudySummaryDepth): StudySummaryState {
  return {
    status: 'idle',
    markdown: '',
    error: null,
    depth,
    chunked: false,
    chunkCount: 1,
    generatedAt: null,
  };
}

function buildTranscriptFingerprint(transcript: TranscriptResult): string {
  const text = transcript.plainText;
  const seed = [
    transcript.segments.length,
    text.length,
    text.slice(0, FINGERPRINT_PREVIEW_CHARS),
    text.slice(-FINGERPRINT_PREVIEW_CHARS),
  ].join('|');
  return hashString(seed);
}

export function buildSummaryKey(
  videoId: string,
  depth: StudySummaryDepth,
  fingerprint: string,
): string {
  return `${videoId}:${depth}:${fingerprint}`;
}

function resolveWeekTopic({
  week,
  topic,
}: {
  week: number | null | undefined;
  topic: string | null | undefined;
}): string {
  if (typeof topic === 'string' && topic.trim().length > 0) return topic.trim();
  if (typeof week === 'number' && Number.isFinite(week)) return `Week ${week}`;
  return '';
}

function resolveCourseName({
  courseName,
  courseCode,
}: {
  courseName: string | null | undefined;
  courseCode: string | null | undefined;
}): string {
  if (typeof courseName === 'string' && courseName.trim().length > 0) return courseName.trim();
  if (typeof courseCode === 'string' && courseCode.trim().length > 0) return courseCode.trim();
  return '';
}

function setLoadingSummary(
  setSummaryByKey: Dispatch<SetStateAction<Record<string, StudySummaryState>>>,
  key: string,
  depth: StudySummaryDepth,
): void {
  setSummaryByKey((prev) => ({
    ...prev,
    [key]: { ...createIdleSummaryState(depth), status: 'loading' },
  }));
}

function setErrorSummary(
  setSummaryByKey: Dispatch<SetStateAction<Record<string, StudySummaryState>>>,
  key: string,
  depth: StudySummaryDepth,
  message: string,
): void {
  setSummaryByKey((prev) => ({
    ...prev,
    [key]: { ...createIdleSummaryState(depth), status: 'error', error: message },
  }));
}

function setSuccessSummary({
  setSummaryByKey,
  key,
  depth,
  markdown,
  chunked,
  chunkCount,
}: {
  setSummaryByKey: Dispatch<SetStateAction<Record<string, StudySummaryState>>>;
  key: string;
  depth: StudySummaryDepth;
  markdown: string;
  chunked: boolean;
  chunkCount: number;
}): void {
  setSummaryByKey((prev) => ({
    ...prev,
    [key]: {
      status: 'success',
      markdown,
      error: null,
      depth,
      chunked,
      chunkCount,
      generatedAt: Date.now(),
    },
  }));
}

function canReuseExistingSummary({
  force,
  summary,
}: {
  force: boolean | undefined;
  summary: StudySummaryState | undefined;
}): boolean {
  return force !== true && summary?.status === 'success' && summary.markdown.length > 0;
}

async function requestSummary({
  apiClient,
  transcript,
  depth,
  courseName,
  lectureTitle,
  weekTopic,
  goal,
}: {
  apiClient: NonNullable<ApiClient>;
  transcript: TranscriptResult;
  depth: StudySummaryDepth;
  courseName: string;
  lectureTitle: string;
  weekTopic: string;
  goal: string;
}): Promise<{ markdown: string; chunked: boolean; chunkCount: number }> {
  const response = await apiClient.generateStudySummary({
    transcript,
    depth,
    courseName,
    lectureTitle,
    weekTopic,
    goal,
    includeJson: true,
  });

  const markdown = response?.data?.markdown ?? '';
  if (response.success !== true || markdown.length === 0) {
    throw new Error(response.error?.message ?? 'No summary was generated.');
  }

  return {
    markdown,
    chunked: response.data?.chunked ?? false,
    chunkCount: response.data?.chunkCount ?? 1,
  };
}

type GenerateSummaryActionArgs = {
  apiClient: ApiClient | null;
  depth: StudySummaryDepth;
  selectedVideoId: string | null;
  selectedVideoTitle: string;
  selectedTranscript: TranscriptSnapshot | undefined;
  summaryByKey: Record<string, StudySummaryState>;
  setSummaryByKey: Dispatch<SetStateAction<Record<string, StudySummaryState>>>;
  requestTokenByKeyRef: MutableRefObject<Record<string, string>>;
  courseCode: string | null | undefined;
  courseName: string | null | undefined;
  week: number | null | undefined;
  topic: string | null | undefined;
  goal: string | null | undefined;
  options: { force?: boolean } | undefined;
};

async function runGenerateSummaryAction(args: GenerateSummaryActionArgs): Promise<void> {
  const {
    apiClient,
    depth,
    selectedVideoId,
    selectedVideoTitle,
    selectedTranscript,
    summaryByKey,
    setSummaryByKey,
    requestTokenByKeyRef,
    courseCode,
    courseName,
    week,
    topic,
    goal,
    options,
  } = args;

  if (selectedVideoId === null || selectedTranscript === undefined) return;
  const key = buildSummaryKey(selectedVideoId, depth, selectedTranscript.fingerprint);
  if (canReuseExistingSummary({ force: options?.force, summary: summaryByKey[key] })) return;

  if (apiClient?.generateStudySummary === undefined) {
    setErrorSummary(setSummaryByKey, key, depth, 'Summary generation is currently unavailable.');
    return;
  }

  const token = `${Date.now()}-${Math.random().toString(HASH_RADIX).slice(2)}`;
  requestTokenByKeyRef.current[key] = token;
  setLoadingSummary(setSummaryByKey, key, depth);

  try {
    const result = await requestSummary({
      apiClient,
      transcript: selectedTranscript.transcript,
      depth,
      courseName: resolveCourseName({ courseName, courseCode }),
      lectureTitle: selectedVideoTitle,
      weekTopic: resolveWeekTopic({ week, topic }),
      goal: goal ?? DEFAULT_GOAL,
    });
    if (requestTokenByKeyRef.current[key] !== token) return;
    setSuccessSummary({ setSummaryByKey, key, depth, ...result });
  } catch (error) {
    if (requestTokenByKeyRef.current[key] !== token) return;
    const message = error instanceof Error ? error.message : 'Failed to generate summary.';
    setErrorSummary(setSummaryByKey, key, depth, message);
  }
}

export function useSelectedSummary({
  selectedVideoId,
  depth,
  transcriptByVideoId,
  summaryByKey,
}: {
  selectedVideoId: string | null;
  depth: StudySummaryDepth;
  transcriptByVideoId: Record<string, TranscriptSnapshot>;
  summaryByKey: Record<string, StudySummaryState>;
}): {
  selectedTranscript: TranscriptSnapshot | undefined;
  selectedSummaryState: StudySummaryState;
} {
  return useMemo(() => {
    const selectedTranscript =
      selectedVideoId !== null ? transcriptByVideoId[selectedVideoId] : undefined;
    if (selectedVideoId === null || selectedTranscript === undefined) {
      return { selectedTranscript, selectedSummaryState: createIdleSummaryState(depth) };
    }
    const key = buildSummaryKey(selectedVideoId, depth, selectedTranscript.fingerprint);
    return {
      selectedTranscript,
      selectedSummaryState: summaryByKey[key] ?? createIdleSummaryState(depth),
    };
  }, [depth, selectedVideoId, summaryByKey, transcriptByVideoId]);
}

export function useRegisterTranscript(
  setTranscriptByVideoId: Dispatch<SetStateAction<Record<string, TranscriptSnapshot>>>,
): (videoId: string, transcript: TranscriptResult) => void {
  return useCallback(
    (videoId: string, transcript: TranscriptResult) => {
      const fingerprint = buildTranscriptFingerprint(transcript);
      setTranscriptByVideoId((prev) => {
        const existing = prev[videoId];
        if (existing !== undefined && existing.fingerprint === fingerprint) return prev;
        return { ...prev, [videoId]: { transcript, fingerprint } };
      });
    },
    [setTranscriptByVideoId],
  );
}

export function useGenerateSummaryAction(
  args: Omit<GenerateSummaryActionArgs, 'options'>,
): (options?: { force?: boolean }) => Promise<void> {
  return useCallback(
    async (options?: { force?: boolean }) => {
      await runGenerateSummaryAction({ ...args, options });
    },
    [args],
  );
}
