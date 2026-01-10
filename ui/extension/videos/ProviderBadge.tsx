/**
 * ProviderBadge Component
 *
 * Displays a colored badge indicating the video provider.
 * Extracted from transcript-specific code for reuse.
 */

interface ProviderBadgeProps {
  /** Provider identifier (panopto, echo360, html5, youtube, unknown) */
  provider: string;
}

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  panopto: { bg: '#1e3a5f', text: '#ffffff' },
  echo360: { bg: '#b45309', text: '#ffffff' },
  html5: { bg: '#2f6f44', text: '#ffffff' },
  youtube: { bg: '#cc0000', text: '#ffffff' },
  unknown: { bg: '#6b7280', text: '#ffffff' },
};

export function ProviderBadge({ provider }: ProviderBadgeProps) {
  const colors = BADGE_COLORS[provider] || BADGE_COLORS.unknown;
  const label = provider.charAt(0).toUpperCase() + provider.slice(1);

  return (
    <span
      className="lockin-video-provider-badge"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {label}
    </span>
  );
}
