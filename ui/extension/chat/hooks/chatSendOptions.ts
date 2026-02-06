import type { ChatAttachment } from '../types';
import type { TranscriptCacheInput } from '../../transcripts/hooks/useTranscriptCache';

export interface SendChatMessageOptions {
  source?: 'selection' | 'followup';
  attachments?: ChatAttachment[];
  attachmentIds?: string[];
  selectionOverride?: string;
  userMessageOverride?: string;
  transcriptContext?: TranscriptCacheInput;
}

export type SendChatOptionsInput = 'selection' | 'followup' | SendChatMessageOptions;

export function coerceSendOptions(options?: SendChatOptionsInput): SendChatMessageOptions {
  if (!options) return {};
  if (typeof options === 'string') {
    return { source: options };
  }
  return options;
}
