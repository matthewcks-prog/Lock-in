import { z } from 'zod';
import { parseWithSchema } from './validationUtils';

export const StudySummaryDepthSchema = z.enum(['brief', 'standard', 'detailed']);

export const StudySummaryDataSchema = z
  .object({
    markdown: z.string(),
    depth: StudySummaryDepthSchema,
    chunked: z.boolean(),
    chunkCount: z.number().int().min(1),
  })
  .passthrough();

export const StudySummaryResponseSchema = z
  .object({
    success: z.boolean(),
    data: StudySummaryDataSchema.optional(),
    error: z
      .object({
        message: z.string(),
      })
      .optional(),
  })
  .passthrough();

export type StudySummaryDepth = z.infer<typeof StudySummaryDepthSchema>;

export interface StudySummaryData {
  markdown: string;
  depth: StudySummaryDepth;
  chunked: boolean;
  chunkCount: number;
}

export interface StudySummaryResponse {
  success: boolean;
  data?: StudySummaryData;
  error?: { message: string };
}

export function validateStudySummaryResponse(
  value: unknown,
  field = 'studySummary',
): StudySummaryResponse {
  const parsed = parseWithSchema(StudySummaryResponseSchema, value, field);
  const response: StudySummaryResponse = { success: parsed.success };

  if (parsed.data !== undefined) {
    response.data = {
      markdown: parsed.data.markdown,
      depth: parsed.data.depth,
      chunked: parsed.data.chunked,
      chunkCount: parsed.data.chunkCount,
    };
  }
  if (parsed.error?.message !== undefined) {
    response.error = { message: parsed.error.message };
  }
  return response;
}
