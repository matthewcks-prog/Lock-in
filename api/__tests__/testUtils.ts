import { vi } from 'vitest';
import type { AuthClient } from '../auth';

export const backendUrl = 'http://example.test';

export function resetEnv(): void {
  vi.restoreAllMocks();
  vi.useRealTimers();
}

export function createAuthStub(token: string | null = 'token'): AuthClient {
  return {
    signUpWithEmail: vi.fn(),
    signInWithEmail: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
    getSession: vi.fn(),
    getCurrentUser: vi.fn(),
    getValidAccessToken: vi.fn().mockResolvedValue(token),
    getAccessToken: vi.fn().mockResolvedValue(token),
    onSessionChanged: vi.fn().mockReturnValue(() => {}),
  };
}

export function getHeaderValue(headers: HeadersInit | undefined, name: string): string | undefined {
  if (headers === undefined) {
    return undefined;
  }
  if (headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }
  if (Array.isArray(headers)) {
    const match = headers.find(([key]) => key === name);
    return typeof match?.[1] === 'string' ? match[1] : undefined;
  }
  if (typeof headers === 'object' && headers !== null) {
    const record = headers as Record<string, string>;
    return typeof record[name] === 'string' ? record[name] : undefined;
  }
  return undefined;
}
