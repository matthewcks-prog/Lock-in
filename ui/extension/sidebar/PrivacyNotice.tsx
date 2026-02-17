/**
 * PrivacyNotice Component
 *
 * Displays a transparency notice about data collection and storage.
 * Shown on first use and always available in the footer.
 *
 * This satisfies Chrome Web Store requirements for clear data disclosure.
 */

import { useState, useEffect, useCallback } from 'react';

const PRIVACY_DISMISSED_KEY = 'lockin_privacy_notice_dismissed';
const PRIVACY_VERSION = '1'; // Increment to re-show notice after policy updates
const LOCK_ICON = '\uD83D\uDD12';
const CHECKMARK = '\u2713';

interface PrivacyNoticeProps {
  /** Storage adapter for persisting dismissal state */
  storage?: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
  };
  /** Whether to show as a compact inline version */
  compact?: boolean;
}

/**
 * Default storage adapter using localStorage
 */
const defaultStorage = {
  get: async (key: string): Promise<string | null> => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: async (key: string, value: string): Promise<void> => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Silently fail if localStorage is unavailable
    }
  },
};

function usePrivacyDismissState(storage: NonNullable<PrivacyNoticeProps['storage']>): {
  isDismissed: boolean;
  isLoading: boolean;
  dismissNotice: () => Promise<void>;
  showNotice: () => void;
} {
  const [isDismissed, setIsDismissed] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkDismissed(): Promise<void> {
      try {
        const value = await storage.get(PRIVACY_DISMISSED_KEY);
        setIsDismissed(value === PRIVACY_VERSION);
      } catch {
        setIsDismissed(false);
      } finally {
        setIsLoading(false);
      }
    }
    void checkDismissed();
  }, [storage]);

  const dismissNotice = useCallback(async () => {
    setIsDismissed(true);
    try {
      await storage.set(PRIVACY_DISMISSED_KEY, PRIVACY_VERSION);
    } catch {
      // Silently fail if storage is unavailable
    }
  }, [storage]);

  const showNotice = useCallback(() => {
    setIsDismissed(false);
  }, []);

  return { isDismissed, isLoading, dismissNotice, showNotice };
}

function CompactPrivacyNotice({ onLearnMore }: { onLearnMore: () => void }): JSX.Element {
  return (
    <div className="lockin-privacy-compact">
      <span className="lockin-privacy-icon">{LOCK_ICON}</span>
      <span className="lockin-privacy-text">
        Your data is stored securely.{' '}
        <button className="lockin-privacy-link" onClick={onLearnMore} type="button">
          Learn more
        </button>
      </span>
    </div>
  );
}

function FullPrivacyNotice({ onDismiss }: { onDismiss: () => Promise<void> }): JSX.Element {
  return (
    <div className="lockin-privacy-notice" role="alert" aria-live="polite">
      <div className="lockin-privacy-content">
        <div className="lockin-privacy-header">
          <span className="lockin-privacy-icon">{LOCK_ICON}</span>
          <strong>Privacy Notice</strong>
        </div>
        <p className="lockin-privacy-message">
          We store the source URL (without sensitive parameters like session tokens) and page title
          to show where your summaries came from. Course codes and week numbers are extracted
          locally and only used for organizing your notes.
        </p>
        <ul className="lockin-privacy-list">
          <li>{CHECKMARK} URLs are sanitized to remove session keys and tokens</li>
          <li>{CHECKMARK} Your selections and notes are processed to provide AI assistance</li>
          <li>{CHECKMARK} Error reports (if enabled) contain no personal study content</li>
          <li>{CHECKMARK} No tracking across unrelated sites</li>
        </ul>
      </div>
      <button
        className="lockin-privacy-dismiss"
        onClick={() => {
          void onDismiss();
        }}
        type="button"
        aria-label="Dismiss privacy notice"
      >
        Got it
      </button>
    </div>
  );
}

export function PrivacyNotice({
  storage = defaultStorage,
  compact = false,
}: PrivacyNoticeProps): JSX.Element | null {
  const { isDismissed, isLoading, dismissNotice, showNotice } = usePrivacyDismissState(storage);

  if (isLoading) return null;
  if (isDismissed && !compact) return null;
  if (compact) {
    return <CompactPrivacyNotice onLearnMore={showNotice} />;
  }

  return <FullPrivacyNotice onDismiss={dismissNotice} />;
}

/**
 * Compact privacy footer for settings sections
 */
export function PrivacyFooter(): JSX.Element {
  return (
    <div className="lockin-privacy-footer">
      <span className="lockin-privacy-icon">{LOCK_ICON}</span>
      <span className="lockin-privacy-text">
        We store sanitized URLs and page titles to show where your content came from. Course codes
        are extracted locally for organization.
      </span>
    </div>
  );
}
