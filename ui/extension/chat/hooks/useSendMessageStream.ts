import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranscriptCache } from '../../transcripts/hooks/useTranscriptCache';
import type { SendMessageMutationParams } from './sendMessageUtils';
import {
  abortAndClearPendingRefs,
  createIdleStreamingState,
  runSendMessageStream,
} from './sendMessageStreamRuntime';
import type {
  StreamingSendResult,
  StreamingState,
  UseSendMessageStreamOptions,
} from './sendMessageStreamTypes';

export type {
  StreamingSendResult,
  StreamingState,
  UseSendMessageStreamOptions,
} from './sendMessageStreamTypes';

interface UseSendMessageStreamResult extends StreamingState {
  sendMessageStream: (params: SendMessageMutationParams) => Promise<StreamingSendResult>;
  cancelPending: () => void;
  reset: () => void;
}

export function useSendMessageStream(
  options: UseSendMessageStreamOptions,
): UseSendMessageStreamResult {
  const queryClient = useQueryClient();
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingSendKeyRef = useRef<string | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const { cacheTranscript } = useTranscriptCache(options.apiClient);
  const [streamingState, setStreamingState] = useState<StreamingState>(createIdleStreamingState());

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const resetState = useCallback(() => {
    setStreamingState(createIdleStreamingState());
  }, []);

  const cancelPending = useCallback(() => {
    abortAndClearPendingRefs({ abortControllerRef, pendingSendKeyRef, activeRequestIdRef });
    resetState();
  }, [resetState]);

  const sendMessageStream = useCallback(
    async (params: SendMessageMutationParams): Promise<StreamingSendResult> =>
      runSendMessageStream({
        params,
        apiClient: options.apiClient,
        pageUrl: options.pageUrl,
        courseCode: options.courseCode,
        cacheTranscript,
        queryClient,
        setStreamingState,
        refs: { abortControllerRef, pendingSendKeyRef, activeRequestIdRef },
        callbacks: {
          onSuccess: options.onSuccess,
          onError: options.onError,
          onStreamStart: options.onStreamStart,
          onStreamDelta: options.onStreamDelta,
          onStreamComplete: options.onStreamComplete,
          onStreamError: options.onStreamError,
        },
      }),
    [cacheTranscript, options, queryClient],
  );

  return { sendMessageStream, ...streamingState, cancelPending, reset: resetState };
}
