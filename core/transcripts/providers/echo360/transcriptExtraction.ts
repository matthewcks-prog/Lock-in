import type { DetectedVideo, TranscriptExtractionResult } from '../../types';
import type { AsyncFetcher } from '../../fetchers/types';
import { parseWebVtt } from '../../webvttParser';
import { log } from '../../utils/echo360Logger';
import { DEFAULT_TIMEOUT_MS, fetchWithRetry, isTimeoutError } from '../../utils/echo360Network';
import { asRecord } from '../../parsers/echo360Parser';
import { resolveEcho360Info } from './resolveInfo';
import { buildTranscriptFileUrl, buildTranscriptUrl } from './urlBuilders';
import {
  buildTranscriptResult,
  cleanText,
  normalizeEcho360TranscriptJson,
} from './transcriptParsing';

const isNonEmptyString = (value: string | null | undefined): value is string =>
  typeof value === 'string' && value.length > 0;

const firstNonEmptyString = (values: Array<string | null | undefined>): string | null => {
  for (const value of values) {
    if (isNonEmptyString(value)) return value;
  }
  return null;
};

type TranscriptAttemptState = {
  hadTimeout: boolean;
  invalidResponseCount: number;
  nonEmptyResponseCount: number;
};

type TranscriptAttemptResult = {
  transcript?: TranscriptExtractionResult['transcript'];
  authRequired?: boolean;
};

function createAttemptState(): TranscriptAttemptState {
  return { hadTimeout: false, invalidResponseCount: 0, nonEmptyResponseCount: 0 };
}

function markInvalidResponse(state: TranscriptAttemptState, hasContent: boolean): void {
  if (hasContent) {
    state.nonEmptyResponseCount += 1;
  }
  state.invalidResponseCount += 1;
}

function resolveBaseUrl(video: DetectedVideo): string {
  if (isNonEmptyString(video.echoBaseUrl)) return video.echoBaseUrl;
  try {
    return new URL(video.embedUrl).origin;
  } catch {
    return '';
  }
}

async function resolveVideoIdentifiers(
  video: DetectedVideo,
  fetcher: AsyncFetcher,
  requestId: string,
): Promise<{ lessonId: string | null; mediaId: string | null; baseUrl: string }> {
  let lessonId: string | null = video.echoLessonId ?? null;
  let mediaId: string | null = video.echoMediaId ?? null;
  let baseUrl = resolveBaseUrl(video);

  if (lessonId === null || mediaId === null) {
    log('info', requestId, 'Resolving missing IDs');
    const resolved = await resolveEcho360Info(video.embedUrl, fetcher, requestId);
    lessonId = firstNonEmptyString([lessonId, resolved?.lessonId]);
    mediaId = firstNonEmptyString([mediaId, resolved?.mediaId]);
    const resolvedBaseUrl = firstNonEmptyString([baseUrl, resolved?.baseUrl]);
    baseUrl = resolvedBaseUrl ?? '';
  }

  return { lessonId, mediaId, baseUrl };
}

function buildAuthRequiredResult(): TranscriptExtractionResult {
  return {
    success: false,
    error: 'Authentication required. Please log in to Echo360.',
    errorCode: 'AUTH_REQUIRED',
    aiTranscriptionAvailable: true,
  };
}

function buildTimeoutResult(): TranscriptExtractionResult {
  return {
    success: false,
    error: 'Request timeout. The server took too long to respond.',
    errorCode: 'TIMEOUT',
    aiTranscriptionAvailable: true,
  };
}

function buildInvalidResponseResult(): TranscriptExtractionResult {
  return {
    success: false,
    error: 'Transcript response was invalid or empty.',
    errorCode: 'INVALID_RESPONSE',
    aiTranscriptionAvailable: true,
  };
}

function buildNoCaptionsResult(): TranscriptExtractionResult {
  return {
    success: false,
    error: 'No captions available for this video.',
    errorCode: 'NO_CAPTIONS',
    aiTranscriptionAvailable: true,
  };
}

function buildParseErrorResult(message: string): TranscriptExtractionResult {
  return {
    success: false,
    error: `Failed to extract transcript: ${message}`,
    errorCode: 'PARSE_ERROR',
    aiTranscriptionAvailable: true,
  };
}

function buildInvalidVideoResult(): TranscriptExtractionResult {
  return {
    success: false,
    error: 'Could not resolve Echo360 video identifiers.',
    errorCode: 'INVALID_VIDEO',
    aiTranscriptionAvailable: true,
  };
}

function buildFinalFailureResult(state: TranscriptAttemptState): TranscriptExtractionResult {
  if (state.hadTimeout) {
    return buildTimeoutResult();
  }
  if (
    state.nonEmptyResponseCount > 0 &&
    state.invalidResponseCount === state.nonEmptyResponseCount
  ) {
    return buildInvalidResponseResult();
  }
  return buildNoCaptionsResult();
}

async function resolveTranscriptInputs(
  video: DetectedVideo,
  fetcher: AsyncFetcher,
  requestId: string,
): Promise<{ lessonId: string; mediaId: string; baseUrl: string } | null> {
  const { lessonId, mediaId, baseUrl } = await resolveVideoIdentifiers(video, fetcher, requestId);

  if (lessonId === null || mediaId === null || baseUrl.length === 0) {
    log('warn', requestId, 'Missing required IDs', { lessonId, mediaId, baseUrl });
    return null;
  }

  log('info', requestId, 'IDs resolved', { lessonId, mediaId, baseUrl });
  return { lessonId, mediaId, baseUrl };
}

async function attemptTranscriptExtraction(params: {
  fetcher: AsyncFetcher;
  requestId: string;
  lessonId: string;
  mediaId: string;
  baseUrl: string;
}): Promise<TranscriptExtractionResult> {
  const state = createAttemptState();

  const jsonUrl = buildTranscriptUrl(params.baseUrl, params.lessonId, params.mediaId);
  const jsonResult = await tryJsonTranscript(params.fetcher, jsonUrl, params.requestId, state);
  if (jsonResult?.authRequired === true) {
    return buildAuthRequiredResult();
  }
  if (jsonResult?.transcript !== undefined) {
    return { success: true, transcript: jsonResult.transcript };
  }

  const vttUrl = buildTranscriptFileUrl(params.baseUrl, params.lessonId, params.mediaId, 'vtt');
  const vttResult = await tryVttTranscript(params.fetcher, vttUrl, params.requestId, state);
  if (vttResult?.transcript !== undefined) {
    return { success: true, transcript: vttResult.transcript };
  }

  const textUrl = buildTranscriptFileUrl(params.baseUrl, params.lessonId, params.mediaId, 'text');
  const textResult = await tryTextTranscript(params.fetcher, textUrl, params.requestId, state);
  if (textResult?.transcript !== undefined) {
    return { success: true, transcript: textResult.transcript };
  }

  log('warn', params.requestId, 'No transcript available');
  return buildFinalFailureResult(state);
}

async function tryJsonTranscript(
  fetcher: AsyncFetcher,
  url: string,
  requestId: string,
  state: TranscriptAttemptState,
): Promise<TranscriptAttemptResult | null> {
  log('info', requestId, 'Trying JSON endpoint', { url });
  try {
    const jsonPayload = await fetchWithRetry<unknown>(fetcher, url, {
      requestId,
      responseType: 'json',
      context: 'transcript-json',
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    const transcript = normalizeEcho360TranscriptJson(jsonPayload);
    if (transcript !== null && transcript.segments.length > 0) {
      log('info', requestId, 'JSON transcript extracted', {
        segments: transcript.segments.length,
      });
      return { transcript };
    }
    const payloadRecord = asRecord(jsonPayload);
    const hasTranscriptFields =
      payloadRecord !== null && ('cues' in payloadRecord || 'contentJson' in payloadRecord);
    if (hasTranscriptFields) {
      markInvalidResponse(state, true);
      log('warn', requestId, 'JSON transcript response invalid', { url });
    }
    return null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log('warn', requestId, 'JSON endpoint failed', { error: msg });
    if (msg === 'AUTH_REQUIRED') {
      return { authRequired: true };
    }
    if (isTimeoutError(error)) {
      state.hadTimeout = true;
    }
    return null;
  }
}

async function tryVttTranscript(
  fetcher: AsyncFetcher,
  url: string,
  requestId: string,
  state: TranscriptAttemptState,
): Promise<TranscriptAttemptResult | null> {
  log('info', requestId, 'Trying VTT endpoint', { url });
  try {
    const vttContent = await fetchWithRetry<string>(fetcher, url, {
      requestId,
      responseType: 'text',
      context: 'transcript-vtt',
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    const transcript = parseWebVtt(vttContent);
    if (transcript.segments.length > 0) {
      log('info', requestId, 'VTT transcript extracted', {
        segments: transcript.segments.length,
      });
      return { transcript };
    }
    if (vttContent.trim().length > 0) {
      markInvalidResponse(state, true);
      log('warn', requestId, 'VTT transcript response invalid', { url });
    }
  } catch (error) {
    log('warn', requestId, 'VTT endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    if (isTimeoutError(error)) {
      state.hadTimeout = true;
    }
  }
  return null;
}

async function tryTextTranscript(
  fetcher: AsyncFetcher,
  url: string,
  requestId: string,
  state: TranscriptAttemptState,
): Promise<TranscriptAttemptResult | null> {
  log('info', requestId, 'Trying text endpoint', { url });
  try {
    const textContent = await fetchWithRetry<string>(fetcher, url, {
      requestId,
      responseType: 'text',
      context: 'transcript-text',
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    const plainText = cleanText(textContent);
    if (plainText.length > 0) {
      const transcript = buildTranscriptResult([{ startMs: 0, endMs: null, text: plainText }]);
      log('info', requestId, 'Text transcript extracted');
      return { transcript };
    }
    if (textContent.trim().length > 0) {
      markInvalidResponse(state, true);
      log('warn', requestId, 'Text transcript response invalid', { url });
    }
  } catch (error) {
    log('warn', requestId, 'Text endpoint failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    if (isTimeoutError(error)) {
      state.hadTimeout = true;
    }
  }
  return null;
}

export async function extractEcho360Transcript(
  video: DetectedVideo,
  fetcher: AsyncFetcher,
  requestId: string,
): Promise<TranscriptExtractionResult> {
  try {
    const resolved = await resolveTranscriptInputs(video, fetcher, requestId);
    if (resolved === null) {
      return buildInvalidVideoResult();
    }
    return await attemptTranscriptExtraction({ fetcher, requestId, ...resolved });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log('error', requestId, 'Extraction failed', { error: message });

    if (message === 'AUTH_REQUIRED') {
      return buildAuthRequiredResult();
    }

    if (isTimeoutError(error)) {
      return buildTimeoutResult();
    }

    return buildParseErrorResult(message);
  }
}
