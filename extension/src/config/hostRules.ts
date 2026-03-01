/**
 * Host and URL matching rules for context-aware compliance messaging.
 *
 * Important: callers should only evaluate the active tab URL when the popup is
 * opened. This module intentionally does not collect or store browsing history.
 */
export const MONASH_MOODLE_HOSTS = [
  'learning.monash.edu',
  'lms.monash.edu',
  'moodle.monash.edu.au',
  'cpw-lms.monash.edu',
] as const;

const MONASH_EDU_SUFFIX = '.monash.edu';
const MOODLE_PATH_PATTERNS: ReadonlyArray<RegExp> = [
  /^\/(my|course|mod|calendar|grade|user|login)(\/|$)/i,
  /^\/local\//i,
];

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/\.$/, '');
}

export function isKnownMonashMoodleHost(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return MONASH_MOODLE_HOSTS.includes(normalized as (typeof MONASH_MOODLE_HOSTS)[number]);
}

export function isMonashEduHost(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return normalized.endsWith(MONASH_EDU_SUFFIX);
}

export function hasMoodleLikePath(pathname: string): boolean {
  return MOODLE_PATH_PATTERNS.some((pattern) => pattern.test(pathname));
}

export function isMonashMoodleUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  const hostname = normalizeHostname(parsed.hostname);
  if (isKnownMonashMoodleHost(hostname)) {
    return true;
  }

  if (isMonashEduHost(hostname) && hasMoodleLikePath(parsed.pathname)) {
    return true;
  }

  return false;
}
