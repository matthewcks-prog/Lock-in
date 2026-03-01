// backend/validators/transcriptValidators.js

const { z } = require('zod');

/**
 * Transcript Validation Schemas
 *
 * Declarative Zod validation for transcript-related endpoints.
 * Applied via validate() middleware in routes.
 */

// UUID validation helper
const uuidSchema = z.string().uuid({ message: 'Must be a valid UUID' });
const MAX_VIDEO_ID_LENGTH = 500;
const MAX_URL_LENGTH = 2000;
const MIN_TOTAL_CHUNKS = 1;
const MIN_SEGMENT_TIME = 0;

/**
 * Schema for job ID parameter
 * Used in GET/POST/PUT /api/transcripts/jobs/:id
 */
const jobIdParamSchema = z.object({
  id: uuidSchema,
});

/**
 * Schema for creating a transcript job
 * POST /api/transcripts/jobs
 */
const createJobSchema = z.object({
  videoId: z.string().min(1, 'Video ID is required').max(MAX_VIDEO_ID_LENGTH, 'Video ID too long'),
  videoUrl: z.string().url('Invalid video URL').max(MAX_URL_LENGTH, 'URL too long'),
  provider: z
    .enum(['panopto', 'youtube', 'vimeo', 'custom'], {
      errorMap: () => ({ message: 'Provider must be one of: panopto, youtube, vimeo, custom' }),
    })
    .optional()
    .default('custom'),
  metadata: z
    .object({
      title: z.string().max(MAX_VIDEO_ID_LENGTH).optional(),
      duration: z.number().positive().optional(),
    })
    .passthrough()
    .optional(),
});

/**
 * Schema for finalizing a transcript job
 * POST /api/transcripts/jobs/:id/finalize
 */
const finalizeJobSchema = z.object({
  totalChunks: z.coerce.number().int().min(MIN_TOTAL_CHUNKS, 'At least one chunk required'),
  checksum: z.string().optional(),
});

/**
 * Schema for caching a transcript
 * POST /api/transcripts/cache
 */
const cacheTranscriptSchema = z.object({
  videoId: z.string().min(1, 'Video ID is required').max(MAX_VIDEO_ID_LENGTH),
  videoUrl: z.string().url('Invalid video URL').max(MAX_URL_LENGTH),
  transcript: z.object({
    segments: z
      .array(
        z.object({
          start: z.number().min(MIN_SEGMENT_TIME),
          end: z.number().min(MIN_SEGMENT_TIME),
          text: z.string(),
        }),
      )
      .min(MIN_TOTAL_CHUNKS, 'At least one segment required'),
    language: z.string().optional(),
    source: z.string().optional(),
  }),
  provider: z.string().optional(),
});

module.exports = {
  jobIdParamSchema,
  createJobSchema,
  finalizeJobSchema,
  cacheTranscriptSchema,
};
