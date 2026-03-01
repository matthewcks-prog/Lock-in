import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StorageAdapter } from '../types';
import { TERMS_CONSENT_STORAGE_KEY, resolvePolicyLinks, useTermsConsent } from '../termsConsent';

function createStorageAdapter(overrides: Partial<StorageAdapter> = {}): StorageAdapter {
  return {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    getLocal: vi.fn().mockResolvedValue(null),
    setLocal: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createAuthStub(session: unknown): NonNullable<typeof window.LockInAuth> {
  return {
    signUpWithEmail: vi.fn(),
    signInWithEmail: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn().mockResolvedValue(session),
    getCurrentUser: vi.fn(),
    getValidAccessToken: vi.fn(),
    getAccessToken: vi.fn(),
    onSessionChanged: vi.fn().mockReturnValue(() => undefined),
  };
}

function ConsentHarness({
  storage,
  isOpen = true,
}: {
  storage: StorageAdapter;
  isOpen?: boolean;
}): JSX.Element {
  const consent = useTermsConsent({ isOpen, storage, enforceInTests: true });
  const state = consent.isLoading ? 'loading' : consent.requiresConsent ? 'required' : 'accepted';

  return (
    <div>
      <p data-testid="consent-state">{state}</p>
      <p data-testid="terms-link">{consent.policyLinks.termsOfService}</p>
    </div>
  );
}

afterEach(() => {
  delete window.LOCKIN_CONFIG;
  delete window.LockInAuth;
  vi.restoreAllMocks();
});

describe('termsConsent', () => {
  it('resolves default policy links when runtime config is missing', () => {
    const links = resolvePolicyLinks();
    expect(links.termsOfService).toBe(
      'https://github.com/matthewcks-prog/Lock-in/blob/main/TERMS.md',
    );
    expect(links.privacyPolicy).toBe(
      'https://github.com/matthewcks-prog/Lock-in/blob/main/PRIVACY.md',
    );
  });

  it('reads custom policy links from runtime config', () => {
    window.LOCKIN_CONFIG = {
      REPO_URL: 'https://github.com/acme/lockin-fork',
      POLICY_LINKS: {
        TERMS_OF_SERVICE: 'https://example.com/terms',
        PRIVACY_POLICY: 'https://example.com/privacy',
      },
    };

    const links = resolvePolicyLinks();
    expect(links.termsOfService).toBe('https://example.com/terms');
    expect(links.privacyPolicy).toBe('https://example.com/privacy');
  });

  it('marks consent as accepted when local storage already has the timestamp', async () => {
    const storage = createStorageAdapter({
      getLocal: vi.fn().mockResolvedValue('2026-02-28T00:00:00.000Z'),
    });

    render(<ConsentHarness storage={storage} />);

    await waitFor(() => {
      expect(screen.getByTestId('consent-state')).toHaveTextContent('accepted');
    });
  });

  it('requires consent when no stored timestamp and no authenticated session exist', async () => {
    const storage = createStorageAdapter({
      getLocal: vi.fn().mockResolvedValue(null),
    });

    render(<ConsentHarness storage={storage} />);

    await waitFor(() => {
      expect(screen.getByTestId('consent-state')).toHaveTextContent('required');
    });
  });

  it('treats existing authenticated sessions as consented and persists timestamp', async () => {
    const setLocal = vi.fn().mockResolvedValue(undefined);
    const storage = createStorageAdapter({
      getLocal: vi.fn().mockResolvedValue(null),
      setLocal,
    });

    window.LockInAuth = createAuthStub({ accessToken: 'token-123', user: { id: 'user-1' } });

    render(<ConsentHarness storage={storage} />);

    await waitFor(() => {
      expect(screen.getByTestId('consent-state')).toHaveTextContent('accepted');
    });

    expect(setLocal).toHaveBeenCalledTimes(1);
    expect(setLocal).toHaveBeenCalledWith(
      TERMS_CONSENT_STORAGE_KEY,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    );
  });
});
