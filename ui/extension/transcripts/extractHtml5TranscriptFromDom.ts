/**
 * HTML5 transcript extraction from DOM textTracks.
 */

import type {
  DetectedVideo,
  TranscriptExtractionResult,
  TranscriptResult,
} from '@core/transcripts/types';

const CUE_WAIT_TIMEOUT_MS = 1500;
const CUE_POLL_INTERVAL_MS = 100;

function resolveDomUrl(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  try {
    return new URL(candidate, document.baseURI).toString();
  } catch {
    return null;
  }
}

function getCandidateMediaUrl(videoEl: HTMLVideoElement): string | null {
  const candidate =
    videoEl.currentSrc ||
    videoEl.getAttribute('src') ||
    videoEl.src ||
    videoEl.querySelector('source')?.getAttribute('src') ||
    videoEl.querySelector('source')?.src;
  return resolveDomUrl(candidate);
}

function findHtml5VideoElement(video: DetectedVideo): HTMLVideoElement | null {
  if (video.domId) {
    const byId = document.getElementById(video.domId);
    if (byId instanceof HTMLVideoElement) return byId;
  }

  if (video.domSelector) {
    const bySelector = document.querySelector(video.domSelector);
    if (bySelector instanceof HTMLVideoElement) return bySelector;
  }

  if (video.mediaUrl) {
    const candidates = Array.from(
      document.querySelectorAll('video')
    ) as HTMLVideoElement[];
    for (const candidate of candidates) {
      const candidateUrl = getCandidateMediaUrl(candidate);
      if (candidateUrl && candidateUrl === video.mediaUrl) {
        return candidate;
      }
    }
  }

  return null;
}

function getCueText(cue: TextTrackCue): string {
  if ('text' in cue) {
    const text = (cue as VTTCue).text;
    return typeof text === 'string' ? text : '';
  }
  return '';
}

function buildTranscriptFromCues(
  cues: TextTrackCueList,
  durationSeconds: number
): TranscriptResult | null {
  const segments: TranscriptResult['segments'] = [];
  const textParts: string[] = [];

  for (const cue of Array.from(cues)) {
    const text = getCueText(cue).trim();
    if (!text) continue;

    segments.push({
      startMs: Math.round(cue.startTime * 1000),
      endMs: Math.round(cue.endTime * 1000),
      text,
    });
    textParts.push(text);
  }

  if (segments.length === 0) return null;

  const lastSegment = segments[segments.length - 1];
  const fallbackDurationMs =
    typeof lastSegment.endMs === 'number' ? lastSegment.endMs : lastSegment.startMs;
  const durationMs =
    Number.isFinite(durationSeconds) && durationSeconds > 0
      ? Math.round(durationSeconds * 1000)
      : fallbackDurationMs;

  return {
    plainText: textParts.join('\n'),
    segments,
    durationMs,
  };
}

async function waitForTrackCues(
  track: TextTrack,
  timeoutMs: number
): Promise<TextTrackCueList | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const cues = track.cues;
    if (cues && cues.length > 0) {
      return cues;
    }
    await new Promise((resolve) => setTimeout(resolve, CUE_POLL_INTERVAL_MS));
  }

  const cues = track.cues;
  if (cues && cues.length > 0) return cues;
  return null;
}

export async function extractHtml5TranscriptFromDom(
  video: DetectedVideo
): Promise<TranscriptExtractionResult | null> {
  const videoEl = findHtml5VideoElement(video);
  if (!videoEl) {
    return null;
  }

  const captionTracks = Array.from(videoEl.textTracks || []).filter(
    (track) => track.kind === 'captions' || track.kind === 'subtitles'
  );

  if (captionTracks.length === 0) {
    return null;
  }

  const deadline = Date.now() + CUE_WAIT_TIMEOUT_MS;

  for (const track of captionTracks) {
    const previousMode = track.mode;
    if (track.mode === 'disabled') {
      track.mode = 'hidden';
    }

    try {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) break;

      const cues = await waitForTrackCues(track, remainingMs);
      if (!cues || cues.length === 0) continue;

      const transcript = buildTranscriptFromCues(cues, videoEl.duration);
      if (transcript) {
        return { success: true, transcript };
      }
    } finally {
      if (previousMode === 'disabled') {
        track.mode = previousMode;
      }
    }
  }

  return null;
}
