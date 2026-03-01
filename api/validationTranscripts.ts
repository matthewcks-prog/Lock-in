import { z } from 'zod';
import { parseWithSchema } from './validationUtils';

const OptionalString = z.string().nullable().optional();

export const TranscriptCacheResponseSchema = z
  .object({
    success: z.boolean(),
    fingerprint: OptionalString,
    cachedAt: OptionalString,
  })
  .passthrough();

export function validateTranscriptCacheResponse(
  value: unknown,
  field = 'transcriptCache',
): {
  success: boolean;
  fingerprint?: string;
  cachedAt?: string;
} {
  const result = parseWithSchema(TranscriptCacheResponseSchema, value, field);
  const response: { success: boolean; fingerprint?: string; cachedAt?: string } = {
    success: result.success,
  };
  if (typeof result.fingerprint === 'string') {
    response.fingerprint = result.fingerprint;
  }
  if (typeof result.cachedAt === 'string') {
    response.cachedAt = result.cachedAt;
  }
  return response;
}
