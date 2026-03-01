import type { TranscriptResult, TranscriptSegment } from '../../types';
import type { UnknownRecord } from '../../types/echo360Types';
import { asRecord } from '../../parsers/echo360Parser';

export function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeSpeaker(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  const match = trimmed.match(/^speaker\s*(\d+)$/i);
  const speakerIndex = match?.[1];
  if (speakerIndex !== undefined && speakerIndex.length > 0) {
    const idx = parseInt(speakerIndex, 10);
    return idx === 0 ? 'Speaker' : `Speaker ${idx}`;
  }
  return trimmed;
}

const CONFIDENCE_KEYS = ['average', 'avg', 'raw', 'score'] as const;

function normalizeConfidenceValue(value: number): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  if (value >= 0 && value <= 1) return value;
  if (value > 1 && value <= 100) return value / 100;
  return undefined;
}

function readConfidenceFromRecord(record: Record<string, unknown>): number | undefined {
  for (const key of CONFIDENCE_KEYS) {
    const value = record[key];
    if (typeof value === 'number') {
      const normalized = normalizeConfidenceValue(value);
      if (normalized !== undefined) return normalized;
    }
  }
  return undefined;
}

function normalizeConfidence(raw: unknown): number | undefined {
  if (typeof raw === 'number') return normalizeConfidenceValue(raw);
  if (raw !== null && typeof raw === 'object') {
    return readConfidenceFromRecord(raw as Record<string, unknown>);
  }
  return undefined;
}

export function buildTranscriptResult(segments: TranscriptSegment[]): TranscriptResult {
  const plainText = segments
    .map((s) => s.text)
    .join(' ')
    .trim();
  const lastSegment = segments[segments.length - 1];
  const result: TranscriptResult = {
    plainText,
    segments,
  };
  const durationMs = lastSegment?.endMs ?? lastSegment?.startMs;
  if (typeof durationMs === 'number') {
    result.durationMs = durationMs;
  }
  return result;
}

/**
 * Extract transcript cues from Echo360 JSON payloads.
 */
function extractEcho360TranscriptCues(raw: unknown): UnknownRecord[] | null {
  const payload = asRecord(raw);
  if (payload === null) return null;

  let cuesValue: unknown = payload['cues'];

  if (!Array.isArray(cuesValue) && payload['contentJson'] !== undefined) {
    try {
      const contentJson =
        typeof payload['contentJson'] === 'string'
          ? (JSON.parse(payload['contentJson']) as unknown)
          : payload['contentJson'];
      cuesValue = (contentJson as Record<string, unknown>)?.['cues'];
    } catch {
      return null;
    }
  }

  if (!Array.isArray(cuesValue)) return null;
  const cues = cuesValue
    .map((cue) => asRecord(cue))
    .filter((cue): cue is UnknownRecord => cue !== null);
  if (cues.length === 0 && cuesValue.length > 0) return null;
  return cues;
}

/**
 * Parse Echo360 JSON transcript response
 */
export function normalizeEcho360TranscriptJson(raw: unknown): TranscriptResult | null {
  const cues = extractEcho360TranscriptCues(raw);
  if (cues === null || cues.length === 0) return null;

  const segments: TranscriptSegment[] = [];

  for (const record of cues) {
    const startMs = Math.max(
      0,
      Math.round(
        typeof record['startMs'] === 'number'
          ? record['startMs']
          : typeof record['start'] === 'number'
            ? record['start']
            : 0,
      ),
    );
    const endMs = Math.max(
      startMs,
      Math.round(
        typeof record['endMs'] === 'number'
          ? record['endMs']
          : typeof record['end'] === 'number'
            ? record['end']
            : startMs,
      ),
    );

    const text = cleanText(String(record['content'] ?? record['text'] ?? ''));
    if (text.length === 0) continue;

    const segment: TranscriptSegment = {
      startMs,
      endMs,
      text,
    };
    const speaker = normalizeSpeaker(record['speaker']);
    if (speaker !== undefined) {
      segment.speaker = speaker;
    }
    const confidence = normalizeConfidence(record['confidence']);
    if (confidence !== undefined) {
      segment.confidence = confidence;
    }
    segments.push(segment);
  }

  return segments.length > 0 ? buildTranscriptResult(segments) : null;
}
