import type { TranscriptResult, TranscriptSegment } from '../../types';
import type { UnknownRecord } from '../../types/echo360Types';
import { asRecord } from '../../parsers/echo360Parser';

export function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeSpeaker(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const trimmed = raw.trim();
  const match = trimmed.match(/^speaker\s*(\d+)$/i);
  const speakerIndex = match?.[1];
  if (speakerIndex) {
    const idx = parseInt(speakerIndex, 10);
    return idx === 0 ? 'Speaker' : `Speaker ${idx}`;
  }
  return trimmed;
}

function normalizeConfidence(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw >= 0 && raw <= 1 ? raw : raw > 1 && raw <= 100 ? raw / 100 : undefined;
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const value = obj['average'] ?? obj['avg'] ?? obj['raw'] ?? obj['score'];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value >= 0 && value <= 1 ? value : value > 1 && value <= 100 ? value / 100 : undefined;
    }
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
  if (!payload) return null;

  let cuesValue: unknown = payload['cues'];

  if (!Array.isArray(cuesValue) && payload['contentJson']) {
    try {
      const contentJson =
        typeof payload['contentJson'] === 'string'
          ? JSON.parse(payload['contentJson'])
          : payload['contentJson'];
      cuesValue = (contentJson as Record<string, unknown>)?.['cues'];
    } catch {
      return null;
    }
  }

  if (!Array.isArray(cuesValue)) return null;
  const cues = cuesValue
    .map((cue) => asRecord(cue))
    .filter((cue): cue is UnknownRecord => Boolean(cue));
  if (cues.length === 0 && cuesValue.length > 0) return null;
  return cues;
}

/**
 * Parse Echo360 JSON transcript response
 */
export function normalizeEcho360TranscriptJson(raw: unknown): TranscriptResult | null {
  const cues = extractEcho360TranscriptCues(raw);
  if (!cues || cues.length === 0) return null;

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
    if (!text) continue;

    const segment: TranscriptSegment = {
      startMs,
      endMs,
      text,
    };
    const speaker = normalizeSpeaker(record['speaker']);
    if (speaker) {
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
