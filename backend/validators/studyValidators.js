const { z } = require('zod');

const MAX_TRANSCRIPT_TEXT_LENGTH = 800000;
const MAX_TRANSCRIPT_SEGMENTS = 20000;
const MAX_SEGMENT_TEXT_LENGTH = 5000;
const MAX_CONTEXT_TEXT_LENGTH = 200;
const MAX_EXAM_FOCUS_AREAS = 12;
const MAX_SPEAKER_TEXT_LENGTH = 120;

const summaryDepthSchema = z.enum(['brief', 'standard', 'detailed']);

const transcriptSegmentSchema = z.object({
  startMs: z.coerce.number().int().nonnegative(),
  endMs: z.coerce.number().int().nonnegative().nullable(),
  text: z.string().min(1).max(MAX_SEGMENT_TEXT_LENGTH),
  speaker: z.string().max(MAX_SPEAKER_TEXT_LENGTH).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const transcriptSchema = z.object({
  plainText: z.string().min(1).max(MAX_TRANSCRIPT_TEXT_LENGTH),
  segments: z.array(transcriptSegmentSchema).min(1).max(MAX_TRANSCRIPT_SEGMENTS),
  durationMs: z.coerce.number().int().nonnegative().optional(),
});

const optionalTextSchema = z.string().max(MAX_CONTEXT_TEXT_LENGTH).optional().nullable();

const examFocusAreasSchema = z
  .array(z.string().min(1).max(MAX_CONTEXT_TEXT_LENGTH))
  .max(MAX_EXAM_FOCUS_AREAS);

const generateStudySummarySchema = z.object({
  transcript: transcriptSchema,
  depth: summaryDepthSchema.optional().default('standard'),
  courseName: optionalTextSchema,
  lectureTitle: optionalTextSchema,
  weekTopic: optionalTextSchema,
  goal: optionalTextSchema,
  examFocusAreas: examFocusAreasSchema.optional().default([]),
  includeJson: z.boolean().optional().default(true),
});

module.exports = {
  summaryDepthSchema,
  generateStudySummarySchema,
};
