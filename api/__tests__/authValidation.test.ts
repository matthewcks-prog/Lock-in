import { describe, expect, it } from 'vitest';
import {
  normalizeSession,
  parseStoredAuthSession,
  parseSupabaseSessionPayload,
} from '../auth/sessionValidation';

describe('auth session validation', () => {
  it('parses Supabase session payloads', () => {
    const payload = parseSupabaseSessionPayload(
      {
        access_token: 'token',
        refresh_token: 'refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: 'user-1' },
      },
      'test',
    );

    expect(payload.access_token).toBe('token');
    expect(payload.refresh_token).toBe('refresh');
    expect(payload.user?.id).toBe('user-1');
  });

  it('normalizes Supabase sessions', () => {
    const session = normalizeSession({
      access_token: 'token',
      refresh_token: 'refresh',
      expires_in: 60,
      token_type: 'bearer',
      user: { id: 'user-1' },
    });

    expect(session.accessToken).toBe('token');
    expect(session.refreshToken).toBe('refresh');
    expect(session.tokenType).toBe('bearer');
  });

  it('returns null for invalid stored sessions', () => {
    const parsed = parseStoredAuthSession({ accessToken: 'token' });
    expect(parsed).toBeNull();
  });
});
