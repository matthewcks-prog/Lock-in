import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useEffect } from 'react';
import type { AiTranscriptionProgressPayload, AiTranscriptionState } from './types';
import { mapStageToStatus, formatAiProgressMessage } from './types';

export function useAiTranscriptionProgressListener(
  activeRequestIdRef: MutableRefObject<string | null>,
  setState: Dispatch<SetStateAction<AiTranscriptionState>>,
): void {
  useEffect(() => {
    const runtime = globalThis.chrome?.runtime;
    if (runtime === undefined) {
      return;
    }

    const listener = (
      message: { type?: string; payload?: AiTranscriptionProgressPayload },
      _sender: chrome.runtime.MessageSender,
    ): void => {
      if (message.type !== 'TRANSCRIBE_MEDIA_AI_PROGRESS') return;
      const payload = message.payload;
      if (payload === undefined) return;
      const requestId = payload?.requestId;
      if (
        requestId === undefined ||
        requestId.length === 0 ||
        requestId !== activeRequestIdRef.current
      ) {
        return;
      }

      setState((prev) => {
        if (prev.requestId !== requestId) return prev;
        const nextStatus = mapStageToStatus(payload.stage, prev.status);
        const progressMessage = formatAiProgressMessage(
          payload.stage,
          payload.message,
          payload.percent,
          prev.progressMessage,
        );
        return {
          ...prev,
          status: nextStatus,
          progressMessage,
          progressPercent:
            typeof payload.percent === 'number' ? payload.percent : prev.progressPercent,
        };
      });
    };

    runtime.onMessage.addListener(listener);
    return () => {
      runtime.onMessage.removeListener(listener);
    };
  }, [activeRequestIdRef, setState]);
}
