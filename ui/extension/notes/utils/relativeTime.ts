const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

export function relativeLabel(iso: string | null | undefined): string {
  if (iso === undefined || iso === null || iso.length === 0) return 'just now';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'just now';
  const delta = Date.now() - date.getTime();
  const minutes = Math.round(delta / MS_PER_MINUTE);
  if (minutes <= 1) return 'just now';
  if (minutes < MINUTES_PER_HOUR) return `${minutes}m ago`;
  const hours = Math.round(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return `${hours}h ago`;
  const days = Math.round(hours / HOURS_PER_DAY);
  return `${days}d ago`;
}
