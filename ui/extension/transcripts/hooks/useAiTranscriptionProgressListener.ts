import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useEffect } from 'react';
import type { AiTranscriptionProgressPayload, AiTranscriptionState } from './types';
import { mapStageToStatus, formatAiProgressMessage } from './types';

export function useAiTranscriptionProgressListener(
  activeRequestIdRef: MutableRefObject<string | null>,
  setState: Dispatch<SetStateAction<AiTranscriptionState>>,
) {
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) {
      return;
    }

    const listener = (
      message: { type?: string; payload?: AiTranscriptionProgressPayload },
      _sender: chrome.runtime.MessageSender,
    ) => {
      if (!message || message.type !== 'TRANSCRIBE_MEDIA_AI_PROGRESS') return;
      const payload = message.payload || {};
      if (!payload.requestId || payload.requestId !== activeRequestIdRef.current) {
        return;
      }

      setState((prev) => {
        if (prev.requestId !== payload.requestId) return prev;
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

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [activeRequestIdRef, setState]);
}
