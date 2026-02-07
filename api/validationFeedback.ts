import { z } from 'zod';
import { parseWithSchema } from './validationUtils';

const OptionalString = z.string().nullable().optional();
const NullableStringWithDefault = z.string().nullable().optional().default(null);

export const FeedbackContextSchema = z
  .object({
    url: OptionalString,
    courseCode: OptionalString,
    extensionVersion: OptionalString,
    browser: OptionalString,
    page: OptionalString,
  })
  .partial()
  .passthrough();

export const FeedbackRecordSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    type: z.enum(['bug', 'feature', 'question', 'other']),
    message: z.string(),
    context: FeedbackContextSchema.nullable().default(null),
    screenshot_url: NullableStringWithDefault,
    status: z.enum(['open', 'in_progress', 'resolved', 'closed']),
    admin_notes: NullableStringWithDefault,
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();

export const SubmitFeedbackResponseSchema = z
  .object({
    success: z.boolean(),
    id: z.string(),
    message: z.string(),
  })
  .passthrough();

export const ListFeedbackResponseSchema = z
  .object({
    success: z.boolean(),
    data: z.array(FeedbackRecordSchema),
  })
  .passthrough();

export const GetFeedbackResponseSchema = z
  .object({
    success: z.boolean(),
    data: FeedbackRecordSchema,
  })
  .passthrough();

export function validateSubmitFeedbackResponse(
  value: unknown,
  field = 'submitFeedback',
): {
  success: boolean;
  id: string;
  message: string;
} {
  return parseWithSchema(SubmitFeedbackResponseSchema, value, field);
}

export function validateFeedbackListResponse(
  value: unknown,
  field = 'feedbackList',
): {
  success: boolean;
  data: Array<z.infer<typeof FeedbackRecordSchema>>;
} {
  return parseWithSchema(ListFeedbackResponseSchema, value, field);
}

export function validateFeedbackResponse(
  value: unknown,
  field = 'feedback',
): {
  success: boolean;
  data: z.infer<typeof FeedbackRecordSchema>;
} {
  return parseWithSchema(GetFeedbackResponseSchema, value, field);
}
