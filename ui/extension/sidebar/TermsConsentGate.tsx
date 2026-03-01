import { useState } from 'react';
import type { PolicyLinks } from './termsConsent';

interface TermsConsentGateProps {
  isLoading: boolean;
  isOpen: boolean;
  policyLinks: PolicyLinks;
  onAccept: () => Promise<void>;
  onDecline: () => void;
}

interface TermsConsentBodyProps {
  isLoading: boolean;
  policyLinks: PolicyLinks;
}

interface TermsConsentActionsProps {
  isDisabled: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

function TermsConsentBody({ isLoading, policyLinks }: TermsConsentBodyProps): JSX.Element {
  if (isLoading) {
    return <p className="lockin-consent-body">Checking your consent status...</p>;
  }

  return (
    <p className="lockin-consent-body">
      By using Lock-in, you agree to our{' '}
      <a
        className="lockin-consent-link"
        href={policyLinks.termsOfService}
        target="_blank"
        rel="noopener noreferrer"
      >
        Terms of Service
      </a>{' '}
      and{' '}
      <a
        className="lockin-consent-link"
        href={policyLinks.privacyPolicy}
        target="_blank"
        rel="noopener noreferrer"
      >
        Privacy Policy
      </a>
      . Use is for learning support only; not for assessment submissions.
    </p>
  );
}

function TermsConsentActions({
  isDisabled,
  onAccept,
  onDecline,
}: TermsConsentActionsProps): JSX.Element {
  return (
    <div className="lockin-consent-actions">
      <button
        type="button"
        className="lockin-btn-new lockin-consent-btn-primary"
        onClick={onAccept}
        disabled={isDisabled}
      >
        I Accept
      </button>
      <button
        type="button"
        className="lockin-btn-ghost lockin-consent-btn-secondary"
        onClick={onDecline}
        disabled={isDisabled}
      >
        Decline
      </button>
    </div>
  );
}

export function TermsConsentGate(props: TermsConsentGateProps): JSX.Element {
  const { isLoading, isOpen, policyLinks, onAccept, onDecline } = props;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return <></>;

  const handleAcceptClick = (): void => {
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    void onAccept()
      .catch(() => {
        setError('Unable to save your consent. Please try again.');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const isDisabled = isLoading || isSubmitting;
  return (
    <div
      className="lockin-consent-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lockin-consent-title"
    >
      <div className="lockin-consent-modal">
        <h2 id="lockin-consent-title" className="lockin-consent-title">
          Welcome to Lock-in
        </h2>
        <TermsConsentBody isLoading={isLoading} policyLinks={policyLinks} />
        {error !== null && error.length > 0 ? (
          <p className="lockin-consent-error">{error}</p>
        ) : null}
        <TermsConsentActions
          isDisabled={isDisabled}
          onAccept={handleAcceptClick}
          onDecline={onDecline}
        />
      </div>
    </div>
  );
}
