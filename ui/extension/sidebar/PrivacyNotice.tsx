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

export function PrivacyNotice({ storage = defaultStorage, compact = false }: PrivacyNoticeProps) {
  const [isDismissed, setIsDismissed] = useState(true); // Start hidden, show after check
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkDismissed() {
      try {
        const value = await storage.get(PRIVACY_DISMISSED_KEY);
        // Show if not dismissed OR if version has changed
        setIsDismissed(value === PRIVACY_VERSION);
      } catch {
        setIsDismissed(false);
      } finally {
        setIsLoading(false);
      }
    }
    void checkDismissed();
  }, [storage]);

  const handleDismiss = useCallback(async () => {
    setIsDismissed(true);
    try {
      await storage.set(PRIVACY_DISMISSED_KEY, PRIVACY_VERSION);
    } catch {
      // Silently fail if storage is unavailable
    }
  }, [storage]);

  // Don't render while loading to prevent flash
  if (isLoading) return null;

  // If dismissed, show only the compact footer version when requested
  if (isDismissed && !compact) return null;

  // Compact version for settings/footer
  if (compact) {
    return (
      <div className="lockin-privacy-compact">
        <span className="lockin-privacy-icon">🔒</span>
        <span className="lockin-privacy-text">
          Your data is stored securely.{' '}
          <button
            className="lockin-privacy-link"
            onClick={() => setIsDismissed(false)}
            type="button"
          >
            Learn more
          </button>
        </span>
      </div>
    );
  }

  // Full notice banner
  return (
    <div className="lockin-privacy-notice" role="alert" aria-live="polite">
      <div className="lockin-privacy-content">
        <div className="lockin-privacy-header">
          <span className="lockin-privacy-icon">🔒</span>
          <strong>Privacy Notice</strong>
        </div>
        <p className="lockin-privacy-message">
          We store the source URL (without sensitive parameters like session tokens) and page title
          to show where your summaries came from. Course codes and week numbers are extracted
          locally and only used for organizing your notes.
        </p>
        <ul className="lockin-privacy-list">
          <li>✓ URLs are sanitized to remove session keys and tokens</li>
          <li>✓ Your selections and notes are processed to provide AI assistance</li>
          <li>✓ Error reports (if enabled) contain no personal study content</li>
          <li>✓ No tracking across unrelated sites</li>
        </ul>
      </div>
      <button
        className="lockin-privacy-dismiss"
        onClick={handleDismiss}
        type="button"
        aria-label="Dismiss privacy notice"
      >
        Got it
      </button>
    </div>
  );
}

/**
 * Compact privacy footer for settings sections
 */
export function PrivacyFooter() {
  return (
    <div className="lockin-privacy-footer">
      <span className="lockin-privacy-icon">🔒</span>
      <span className="lockin-privacy-text">
        We store sanitized URLs and page titles to show where your content came from. Course codes
        are extracted locally for organization.
      </span>
    </div>
  );
}
