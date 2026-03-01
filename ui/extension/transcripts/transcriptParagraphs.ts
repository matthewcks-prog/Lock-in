/**
 * Transcript Paragraph Grouping
 *
 * Groups flat TranscriptSegment[] into readable paragraph blocks using:
 *  - Silence gaps (>= GAP_THRESHOLD_MS, with sentence-boundary awareness)
 *  - Speaker changes
 *  - Max block duration / character length caps
 *
 * Pure function – no I/O, no browser globals.
 */

import type { TranscriptSegment } from '@core/transcripts/types';

// ─── Thresholds ───────────────────────────────────────────────────────────────

/** Gap between segments that triggers a paragraph break (if sentence-complete). */
const GAP_THRESHOLD_MS = 2_500;

/**
 * Gap that forces a break even mid-sentence (clear content boundary).
 * 5 s matches common subtitle / closed-caption practice.
 */
const HARD_GAP_THRESHOLD_MS = 5_000;

/** Maximum block duration before forcing a break (at the next sentence end). */
const MAX_BLOCK_DURATION_MS = 60_000;

/** Maximum character count for a block before forcing a break at the next sentence end. */
const MAX_BLOCK_CHARS = 600;

/** Regex: segment text ends with sentence-closing punctuation. */
const SENTENCE_END_RE = /[.!?…"'」』»)\]]+\s*$/u;

// ─── Types ────────────────────────────────────────────────────────────────────

/** A grouped block of transcript text suitable for paragraph-style rendering. */
export type TranscriptParagraph = {
  /** Start time of the first segment in this block (ms). */
  startMs: number;
  /** Concatenated, space-separated text of all segments in this block. */
  text: string;
  /** Speaker label from the first segment (undefined when none present). */
  speaker: string | undefined;
  /** Individual segments that make up this paragraph (enables search + seek). */
  segments: TranscriptSegment[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gapMs(prev: TranscriptSegment, next: TranscriptSegment): number {
  const prevEnd = typeof prev.endMs === 'number' ? prev.endMs : prev.startMs;
  return next.startMs - prevEnd;
}

function speakerChanged(prev: TranscriptSegment, next: TranscriptSegment): boolean {
  // Only split on speaker change when speaker data is explicitly present
  const prevSpeaker = prev.speaker ?? '';
  const nextSpeaker = next.speaker ?? '';
  return prevSpeaker !== '' && nextSpeaker !== '' && prevSpeaker !== nextSpeaker;
}

function isSentenceComplete(text: string): boolean {
  return SENTENCE_END_RE.test(text.trimEnd());
}

function shouldStartNewParagraph(
  prev: TranscriptSegment,
  next: TranscriptSegment,
  currentText: string,
  blockStartMs: number,
): boolean {
  // 1. Speaker change → always break
  if (speakerChanged(prev, next)) return true;

  const gap = gapMs(prev, next);

  // 2. Hard gap (≥ 5 s) → break regardless of sentence completion
  if (gap >= HARD_GAP_THRESHOLD_MS) return true;

  // 3. Soft gap (≥ 2.5 s) → break only when the sentence is complete
  if (gap >= GAP_THRESHOLD_MS && isSentenceComplete(prev.text)) return true;

  // 4. Max duration cap → break at the next sentence boundary
  const blockDuration = next.startMs - blockStartMs;
  if (blockDuration >= MAX_BLOCK_DURATION_MS && isSentenceComplete(prev.text)) return true;

  // 5. Max character cap → break at the next sentence boundary
  if (currentText.length >= MAX_BLOCK_CHARS && isSentenceComplete(prev.text)) return true;

  return false;
}

function flushParagraph(segments: TranscriptSegment[], text: string): TranscriptParagraph {
  // Caller guarantees segments is non-empty
  const head = segments[0]!;
  return {
    startMs: head.startMs,
    text,
    speaker: head.speaker,
    segments,
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Convert a flat array of TranscriptSegments into paragraph blocks.
 *
 * Grouping heuristics (in priority order):
 *  1. Speaker change
 *  2. Hard silence gap (≥ 5 s)
 *  3. Soft silence gap (≥ 2.5 s) AND sentence-complete
 *  4. Max block duration (60 s) AND sentence-complete
 *  5. Max character count (600) AND sentence-complete
 */
export function buildTranscriptParagraphs(
  segments: readonly TranscriptSegment[],
): TranscriptParagraph[] {
  const first = segments[0];
  if (first === undefined) return [];

  const paragraphs: TranscriptParagraph[] = [];
  let currentSegments: TranscriptSegment[] = [first];
  let currentText = first.text.trim();

  for (let i = 1; i < segments.length; i++) {
    // i is within bounds and currentSegments is always non-empty
    const next = segments[i]!;
    const prev = currentSegments[currentSegments.length - 1]!;
    const blockStartMs = currentSegments[0]!.startMs;

    if (shouldStartNewParagraph(prev, next, currentText, blockStartMs)) {
      paragraphs.push(flushParagraph(currentSegments, currentText));
      currentSegments = [next];
      currentText = next.text.trim();
    } else {
      currentSegments = [...currentSegments, next];
      currentText = `${currentText} ${next.text.trim()}`;
    }
  }

  // Flush the final block
  paragraphs.push(flushParagraph(currentSegments, currentText));

  return paragraphs;
}
