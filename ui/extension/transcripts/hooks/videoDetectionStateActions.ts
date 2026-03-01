import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { DetectedVideo } from '@core/transcripts/types';

interface VideoDetectionStateBase {
  videos: DetectedVideo[];
  isDetecting: boolean;
  error: string | null;
  detectionHint: string | null;
}

export interface VideoDetectionStateActions {
  resetDetection: () => void;
  setError: (error: string | null) => void;
  setDetecting: (isDetecting: boolean) => void;
  setVideos: (videos: DetectedVideo[]) => void;
}

export function useVideoDetectionStateActions<TState extends VideoDetectionStateBase>(
  setState: Dispatch<SetStateAction<TState>>,
  initialState: TState,
): VideoDetectionStateActions {
  const resetDetection = useCallback(() => {
    setState(initialState);
  }, [initialState, setState]);

  const setError = useCallback(
    (error: string | null) => {
      setState((prev) => ({ ...prev, error }));
    },
    [setState],
  );

  const setDetecting = useCallback(
    (isDetecting: boolean) => {
      setState((prev) => ({ ...prev, isDetecting }));
    },
    [setState],
  );

  const setVideos = useCallback(
    (videos: DetectedVideo[]) => {
      setState((prev) => ({ ...prev, videos }));
    },
    [setState],
  );

  return { resetDetection, setError, setDetecting, setVideos };
}
