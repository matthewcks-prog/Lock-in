import { z } from 'zod';

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; issues?: z.ZodIssue[]; fallback: T };

const SettingsSchema = z
  .object({
    preferredLanguage: z.string().min(1).optional(),
  })
  .passthrough();

const SessionSchema = z
  .object({
    chatId: z.string().min(1).optional().nullable(),
    selection: z.string().optional().nullable(),
    origin: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
    isClosed: z.boolean().optional(),
    chatHistory: z.array(z.unknown()).optional(),
    updatedAt: z.number().optional(),
  })
  .passthrough()
  .transform((data) => ({
    ...data,
    chatHistory: Array.isArray(data.chatHistory) ? data.chatHistory : [],
  }));

const AuthSessionSchema = z
  .object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    expiresAt: z.number(),
    tokenType: z.string().min(1),
    user: z.record(z.unknown()).nullable().optional(),
  })
  .passthrough();

const SupabaseTokenResponseSchema = z
  .object({
    access_token: z.string().optional(),
    refresh_token: z.string().optional(),
    expires_in: z.number().int().positive().optional(),
    token_type: z.string().optional(),
    user: z.record(z.unknown()).nullable().optional(),
  })
  .passthrough();

const TranscriptJobSchema = z
  .object({
    id: z.string().nullable().optional(),
    status: z.string().optional(),
    error: z.unknown().optional(),
    transcript: z.unknown().optional(),
    cached: z.boolean().optional(),
    fingerprint: z.string().optional(),
    mediaUrl: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();

const TranscriptJobResponseSchema = z
  .object({
    success: z.boolean(),
    job: TranscriptJobSchema.optional(),
    jobId: z.string().optional(),
  })
  .passthrough();

const TranscriptJobListResponseSchema = z
  .object({
    success: z.boolean(),
    jobs: z.array(TranscriptJobSchema).optional(),
    count: z.number().optional(),
    limit: z.number().optional(),
  })
  .passthrough();

const TranscriptCancelAllResponseSchema = z
  .object({
    success: z.boolean(),
    canceledCount: z.number().optional(),
    canceledIds: z.array(z.string()).optional(),
  })
  .passthrough();

function safeParse<T>(
  schema: z.ZodType<T>,
  value: unknown,
  error: string,
  fallback: T,
): ValidationResult<T> {
  const result = schema.safeParse(value);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  return {
    ok: false,
    error,
    issues: result.error.issues,
    fallback,
  };
}

export function createRuntimeValidators() {
  return {
    validateSettings: (value: unknown) =>
      safeParse(SettingsSchema, value, 'Invalid settings payload', {}),
    validateSession: (value: unknown) =>
      safeParse(SessionSchema, value, 'Invalid session payload', {
        chatHistory: [],
      }),
    validateAuthSession: (value: unknown) =>
      safeParse(AuthSessionSchema, value, 'Invalid auth session payload', {
        accessToken: '',
        refreshToken: '',
        expiresAt: 0,
        tokenType: 'bearer',
        user: null,
      }),
    validateSupabaseTokenResponse: (value: unknown) =>
      safeParse(SupabaseTokenResponseSchema, value, 'Invalid Supabase token response', {}),
    validateTranscriptJobResponse: (value: unknown) =>
      safeParse(TranscriptJobResponseSchema, value, 'Invalid transcript job response', {
        success: false,
      }),
    validateTranscriptJob: (value: unknown) =>
      safeParse(TranscriptJobSchema, value, 'Invalid transcript job payload', {}),
    validateTranscriptJobListResponse: (value: unknown) =>
      safeParse(TranscriptJobListResponseSchema, value, 'Invalid transcript job list response', {
        success: false,
        jobs: [],
      }),
    validateTranscriptCancelAllResponse: (value: unknown) =>
      safeParse(
        TranscriptCancelAllResponseSchema,
        value,
        'Invalid transcript bulk cancel response',
        { success: false, canceledIds: [] },
      ),
  };
}

export type RuntimeValidators = ReturnType<typeof createRuntimeValidators>;
