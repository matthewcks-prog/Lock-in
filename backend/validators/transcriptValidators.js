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
  videoId: z.string().min(1, 'Video ID is required').max(500, 'Video ID too long'),
  videoUrl: z.string().url('Invalid video URL').max(2000, 'URL too long'),
  provider: z
    .enum(['panopto', 'youtube', 'vimeo', 'custom'], {
      errorMap: () => ({ message: 'Provider must be one of: panopto, youtube, vimeo, custom' }),
    })
    .optional()
    .default('custom'),
  metadata: z
    .object({
      title: z.string().max(500).optional(),
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
  totalChunks: z.coerce.number().int().min(1, 'At least one chunk required'),
  checksum: z.string().optional(),
});

/**
 * Schema for caching a transcript
 * POST /api/transcripts/cache
 */
const cacheTranscriptSchema = z.object({
  videoId: z.string().min(1, 'Video ID is required').max(500),
  videoUrl: z.string().url('Invalid video URL').max(2000),
  transcript: z.object({
    segments: z
      .array(
        z.object({
          start: z.number().min(0),
          end: z.number().min(0),
          text: z.string(),
        }),
      )
      .min(1, 'At least one segment required'),
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
