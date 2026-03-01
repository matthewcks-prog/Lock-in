import { useCallback, useEffect, useMemo, useState } from 'react';
import { CLIENT_STORAGE_KEYS } from '@core/storage/clientStorageKeys';
import type { StorageAdapter } from './types';

export const TERMS_CONSENT_STORAGE_KEY = CLIENT_STORAGE_KEYS.TERMS_ACCEPTED_AT;

const DEFAULT_REPO_URL = 'https://github.com/matthewcks-prog/Lock-in';

type ConsentStatus = 'loading' | 'required' | 'accepted';

type RuntimePolicyLinks = {
  TERMS_OF_SERVICE?: unknown;
  PRIVACY_POLICY?: unknown;
};

type RuntimeConfig = {
  POLICY_LINKS?: RuntimePolicyLinks;
  REPO_URL?: unknown;
};

interface SessionLike {
  accessToken?: unknown;
  user?: { id?: unknown } | null;
}

export interface PolicyLinks {
  termsOfService: string;
  privacyPolicy: string;
}

export interface UseTermsConsentOptions {
  isOpen: boolean;
  storage: StorageAdapter | undefined;
  enforceInTests?: boolean;
}

export interface UseTermsConsentResult {
  isLoading: boolean;
  requiresConsent: boolean;
  acceptConsent: () => Promise<void>;
  policyLinks: PolicyLinks;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function getRuntimeConfig(): RuntimeConfig {
  if (typeof window === 'undefined' || window.LOCKIN_CONFIG === undefined) {
    return {};
  }
  return window.LOCKIN_CONFIG as RuntimeConfig;
}

function isTestRuntime(): boolean {
  return typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';
}

function resolvePolicyLinks(): PolicyLinks {
  const runtimeConfig = getRuntimeConfig();
  const repoUrl = asNonEmptyString(runtimeConfig.REPO_URL) ?? DEFAULT_REPO_URL;
  const configuredPolicyLinks = runtimeConfig.POLICY_LINKS ?? {};
  const termsOfService =
    asNonEmptyString(configuredPolicyLinks.TERMS_OF_SERVICE) ?? `${repoUrl}/blob/main/TERMS.md`;
  const privacyPolicy =
    asNonEmptyString(configuredPolicyLinks.PRIVACY_POLICY) ?? `${repoUrl}/blob/main/PRIVACY.md`;

  return { termsOfService, privacyPolicy };
}

async function readConsentTimestamp(storage?: StorageAdapter): Promise<string | null> {
  if (storage?.getLocal !== undefined) {
    const value = await storage.getLocal<string>(TERMS_CONSENT_STORAGE_KEY);
    return asNonEmptyString(value);
  }
  if (storage !== undefined) {
    const value = await storage.get<string>(TERMS_CONSENT_STORAGE_KEY);
    return asNonEmptyString(value);
  }
  return null;
}

async function writeConsentTimestamp(
  storage: StorageAdapter | undefined,
  value: string,
): Promise<void> {
  if (storage?.setLocal !== undefined) {
    await storage.setLocal(TERMS_CONSENT_STORAGE_KEY, value);
    return;
  }
  if (storage !== undefined) {
    await storage.set(TERMS_CONSENT_STORAGE_KEY, value);
    return;
  }
  throw new Error('Storage adapter unavailable.');
}

async function hasSignedInSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const getSession = window.LockInAuth?.getSession;
  if (typeof getSession !== 'function') return false;

  try {
    const session = (await getSession()) as SessionLike | null;
    if (session === null || typeof session !== 'object') return false;
    const hasAccessToken = asNonEmptyString(session.accessToken) !== null;
    const hasUserId = asNonEmptyString(session.user?.id) !== null;
    return hasAccessToken || hasUserId;
  } catch {
    return false;
  }
}

function shouldAutoAcceptConsentGate(
  storage: StorageAdapter | undefined,
  enforceInTests: boolean,
): boolean {
  if (isTestRuntime() && !enforceInTests) {
    return true;
  }
  return storage?.getLocal === undefined || storage?.setLocal === undefined;
}

async function resolveInitialConsentStatus(
  storage: StorageAdapter | undefined,
): Promise<ConsentStatus> {
  const acceptedAt = await readConsentTimestamp(storage).catch(() => null);
  if (acceptedAt !== null) {
    return 'accepted';
  }

  const hasSession = await hasSignedInSession();
  if (!hasSession) {
    return 'required';
  }

  try {
    await writeConsentTimestamp(storage, new Date().toISOString());
  } catch {
    // Keep the user unblocked if they have an authenticated legacy session.
  }
  return 'accepted';
}

export function useTermsConsent({
  isOpen,
  storage,
  enforceInTests = false,
}: UseTermsConsentOptions): UseTermsConsentResult {
  const [status, setStatus] = useState<ConsentStatus>('loading');

  useEffect(() => {
    if (!isOpen) return;
    if (shouldAutoAcceptConsentGate(storage, enforceInTests)) {
      setStatus('accepted');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    void resolveInitialConsentStatus(storage).then((nextStatus) => {
      if (!cancelled) {
        setStatus(nextStatus);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [enforceInTests, isOpen, storage]);

  const acceptConsent = useCallback(async () => {
    if (storage?.setLocal === undefined) {
      setStatus('accepted');
      return;
    }
    await writeConsentTimestamp(storage, new Date().toISOString());
    setStatus('accepted');
  }, [storage]);

  const policyLinks = useMemo(() => resolvePolicyLinks(), []);

  return {
    isLoading: status === 'loading',
    requiresConsent: status === 'required',
    acceptConsent,
    policyLinks,
  };
}

export { resolvePolicyLinks };
