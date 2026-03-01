import { z } from 'zod';
import { parseWithSchema } from './validationUtils';

/**
 * Study Response Schema
 *
 * Validates the assistant's markdown response.
 * Single required field: 'content' (the LLM's natural language output).
 */
export const StudyResponseSchema = z.object({
  /** The assistant's response content (markdown) */
  content: z.string(),
});

export const ApiResponseSchema = z
  .object({
    success: z.boolean(),
    data: StudyResponseSchema.optional(),
    error: z
      .object({
        message: z.string(),
        code: z.string().optional(),
      })
      .optional(),
    chatId: z.string().optional(),
    chatTitle: z.string().optional(),
  })
  .passthrough();

export function validateLockinResponse(
  value: unknown,
  field = 'lockinResponse',
): {
  success: boolean;
  data?: z.infer<typeof StudyResponseSchema>;
  error?: { message: string; code?: string };
  chatId?: string;
  chatTitle?: string;
} {
  const result = parseWithSchema(ApiResponseSchema, value, field);
  const response: {
    success: boolean;
    data?: z.infer<typeof StudyResponseSchema>;
    error?: { message: string; code?: string };
    chatId?: string;
    chatTitle?: string;
  } = { success: result.success };

  if (result.data !== undefined) {
    response.data = result.data;
  }
  if (result.error !== undefined) {
    const error: { message: string; code?: string } = { message: result.error.message };
    if (typeof result.error.code === 'string') {
      error.code = result.error.code;
    }
    response.error = error;
  }
  if (typeof result.chatId === 'string') {
    response.chatId = result.chatId;
  }
  if (typeof result.chatTitle === 'string') {
    response.chatTitle = result.chatTitle;
  }

  return response;
}
