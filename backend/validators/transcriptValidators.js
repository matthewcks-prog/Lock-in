const { z } = require('zod');

const MAX_FINGERPRINT_LENGTH = 255;
const MAX_URL_LENGTH = 2000;
const MAX_PROVIDER_LENGTH = 64;
const MAX_LANGUAGE_HINT_LENGTH = 24;
const MAX_CHECKSUM_LENGTH = 256;
const MAX_TRANSCRIPT_TEXT_LENGTH = 800000;
const MAX_TRANSCRIPT_SEGMENTS = 20000;
const MAX_SEGMENT_TEXT_LENGTH = 5000;
const MAX_SPEAKER_LENGTH = 120;

const uuidSchema = z.string().uuid({ message: 'Must be a valid UUID' });
const positiveIntSchema = z.coerce.number().int().positive();
const nonNegativeIntSchema = z.coerce.number().int().nonnegative();

const fingerprintSchema = z
  .string()
  .trim()
  .min(1, 'Fingerprint is required')
  .max(MAX_FINGERPRINT_LENGTH, 'Fingerprint too long');

const providerSchema = z
  .string()
  .trim()
  .min(1, 'Provider is required')
  .max(MAX_PROVIDER_LENGTH, 'Provider too long');

const mediaUrlSchema = z.string().url('Invalid media URL').max(MAX_URL_LENGTH, 'URL too long');

const jobIdParamSchema = z.object({
  id: uuidSchema,
});

const createJobSchema = z.object({
  fingerprint: fingerprintSchema,
  mediaUrl: mediaUrlSchema,
  mediaUrlNormalized: mediaUrlSchema.optional(),
  durationMs: nonNegativeIntSchema.nullable().optional(),
  provider: providerSchema.optional().default('unknown'),
  expectedTotalChunks: positiveIntSchema.optional(),
});

const finalizeJobSchema = z
  .object({
    expectedTotalChunks: positiveIntSchema.optional(),
    totalChunks: positiveIntSchema.optional(),
    checksum: z.string().trim().max(MAX_CHECKSUM_LENGTH).optional(),
    languageHint: z.string().trim().min(1).max(MAX_LANGUAGE_HINT_LENGTH).optional(),
    maxMinutes: z.coerce.number().positive().optional(),
  })
  .transform((data) => ({
    expectedTotalChunks: data.expectedTotalChunks ?? data.totalChunks,
    checksum: data.checksum,
    languageHint: data.languageHint,
    maxMinutes: data.maxMinutes,
  }));

const transcriptSegmentSchema = z
  .object({
    startMs: nonNegativeIntSchema,
    endMs: nonNegativeIntSchema.nullable().optional(),
    text: z.string().trim().min(1, 'Segment text is required').max(MAX_SEGMENT_TEXT_LENGTH),
    speaker: z.string().trim().max(MAX_SPEAKER_LENGTH).optional(),
    confidence: z.coerce.number().min(0).max(1).optional(),
  })
  .superRefine((segment, context) => {
    if (segment.endMs !== null && segment.endMs !== undefined && segment.endMs < segment.startMs) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endMs'],
        message: 'endMs must be greater than or equal to startMs',
      });
    }
  });

const transcriptSchema = z.object({
  plainText: z
    .string()
    .trim()
    .min(1, 'Transcript text is required')
    .max(MAX_TRANSCRIPT_TEXT_LENGTH),
  segments: z.array(transcriptSegmentSchema).min(1).max(MAX_TRANSCRIPT_SEGMENTS),
  durationMs: nonNegativeIntSchema.optional(),
});

const transcriptMetaSchema = z.object({
  mediaUrl: mediaUrlSchema.optional(),
  mediaUrlNormalized: mediaUrlSchema.optional(),
  etag: z.string().trim().max(MAX_CHECKSUM_LENGTH).optional(),
  lastModified: z.string().trim().max(MAX_CHECKSUM_LENGTH).optional(),
  durationMs: nonNegativeIntSchema.nullable().optional(),
});

const cacheTranscriptSchema = z.object({
  fingerprint: fingerprintSchema,
  provider: providerSchema,
  transcript: transcriptSchema,
  meta: transcriptMetaSchema.optional(),
});

module.exports = {
  jobIdParamSchema,
  createJobSchema,
  finalizeJobSchema,
  cacheTranscriptSchema,
};
