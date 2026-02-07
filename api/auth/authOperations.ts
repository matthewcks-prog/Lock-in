import type { AuthSession, AuthUser } from '../../core/domain/types';
import type { FetchLike } from '../fetcher';
import { createAuthError, parseErrorResponse } from './authErrors';
import { normalizeSession, parseSupabaseSessionPayload } from './sessionValidation';

type AuthOperationDeps = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  fetcher: FetchLike;
  assertConfig: () => void;
  writeStorage: (session: AuthSession) => Promise<void>;
  clearStorage: () => Promise<void>;
  notify: (session: AuthSession | null) => void;
};

async function parseRefreshErrorMessage(response: Response): Promise<string> {
  let errorMessage = 'Failed to refresh session';
  try {
    const errorBody: unknown = await response.json();
    if (typeof errorBody === 'object' && errorBody !== null) {
      const record = errorBody as Record<string, unknown>;
      if (typeof record['error_description'] === 'string') {
        errorMessage = record['error_description'];
      } else if (typeof record['message'] === 'string') {
        errorMessage = record['message'];
      }
    }
  } catch (_) {
    // ignore parse errors
  }
  return errorMessage;
}

export function createSignInWithEmail(deps: AuthOperationDeps) {
  return async (email: string, password: string): Promise<AuthSession> => {
    deps.assertConfig();

    const response = await deps.fetcher(`${deps.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: deps.supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const parsed = await parseErrorResponse(response, 'Failed to sign in');
      throw createAuthError(parsed.message, parsed.code, parsed.details);
    }

    const data = parseSupabaseSessionPayload(await response.json(), 'signInWithEmail');
    const session = normalizeSession(data);
    await deps.writeStorage(session);
    deps.notify(session);
    return session;
  };
}

export function createSignUpWithEmail(deps: AuthOperationDeps) {
  return async (email: string, password: string): Promise<AuthSession> => {
    deps.assertConfig();

    const response = await deps.fetcher(`${deps.supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        apikey: deps.supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const parsed = await parseErrorResponse(response, 'Failed to create account');
      throw createAuthError(parsed.message, parsed.code, parsed.details);
    }

    const data = parseSupabaseSessionPayload(await response.json(), 'signUpWithEmail');
    const accessToken = data.access_token;
    const refreshToken = data.refresh_token;
    if (
      typeof accessToken !== 'string' ||
      accessToken.length === 0 ||
      typeof refreshToken !== 'string' ||
      refreshToken.length === 0
    ) {
      throw createAuthError(
        'Check your email to confirm your account, then sign in.',
        'EMAIL_CONFIRMATION_REQUIRED',
        data,
      );
    }

    const session = normalizeSession(data);
    await deps.writeStorage(session);
    deps.notify(session);
    return session;
  };
}

export function createRefreshSession(deps: AuthOperationDeps) {
  return async (
    refreshToken: string,
    existingUser: AuthUser | null = null,
  ): Promise<AuthSession> => {
    deps.assertConfig();

    if (refreshToken.length === 0) {
      throw new Error('Missing refresh token');
    }

    const response = await deps.fetcher(
      `${deps.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
      {
        method: 'POST',
        headers: {
          apikey: deps.supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
    );

    if (!response.ok) {
      await deps.clearStorage();
      throw new Error(await parseRefreshErrorMessage(response));
    }

    const data = parseSupabaseSessionPayload(await response.json(), 'refreshSession');
    const normalizedRefreshToken =
      typeof data.refresh_token === 'string' && data.refresh_token.length > 0
        ? data.refresh_token
        : refreshToken;
    const session = normalizeSession(
      { ...data, refresh_token: normalizedRefreshToken },
      existingUser,
    );
    await deps.writeStorage(session);
    deps.notify(session);
    return session;
  };
}
