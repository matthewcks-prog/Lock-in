import { z } from 'zod';
import type { AuthSession, AuthUser } from '../../core/domain/types';
import { ValidationError } from '../../core/errors';
import { parseWithSchema } from '../validationUtils';

const SupabaseUserSchema = z
  .object({
    id: z.string(),
    email: z.string().optional(),
  })
  .passthrough()
  .transform((user): AuthUser => {
    const { email, ...rest } = user;
    return typeof email === 'string' ? { ...rest, email } : { ...rest };
  });

const SupabaseSessionSchema = z
  .object({
    access_token: z.string().optional(),
    refresh_token: z.string().optional(),
    expires_in: z.number().int().positive().optional(),
    token_type: z.string().optional(),
    user: SupabaseUserSchema.nullable().optional(),
  })
  .passthrough();

const StoredAuthSessionSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresAt: z.number(),
    tokenType: z.string(),
    user: SupabaseUserSchema.nullable(),
  })
  .passthrough();

export type SupabaseSessionPayload = z.infer<typeof SupabaseSessionSchema>;

const DEFAULT_EXPIRES_IN_SECONDS = 3600;

export function parseSupabaseSessionPayload(value: unknown, field: string): SupabaseSessionPayload {
  return parseWithSchema(SupabaseSessionSchema, value, field);
}

export function normalizeSession(
  data: SupabaseSessionPayload,
  fallbackUser: AuthUser | null = null,
  fallbackRefreshToken: string | null = null,
): AuthSession {
  const accessToken = data.access_token;
  const refreshToken = data.refresh_token ?? fallbackRefreshToken;
  if (
    typeof accessToken !== 'string' ||
    accessToken.length === 0 ||
    typeof refreshToken !== 'string' ||
    refreshToken.length === 0
  ) {
    throw new ValidationError('Supabase session payload missing tokens', 'session');
  }

  const expiresIn =
    typeof data.expires_in === 'number' ? data.expires_in : DEFAULT_EXPIRES_IN_SECONDS;
  const expiresAt = Date.now() + expiresIn * 1000;

  return {
    accessToken,
    refreshToken,
    expiresAt,
    tokenType:
      typeof data.token_type === 'string' && data.token_type.length > 0
        ? data.token_type
        : 'bearer',
    user: data.user ?? fallbackUser ?? null,
  };
}

export function parseStoredAuthSession(value: unknown): AuthSession | null {
  const parsed = StoredAuthSessionSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  return parsed.data;
}
