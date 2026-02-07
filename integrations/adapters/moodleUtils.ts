export const BODY_TEXT_LIMIT = 8000;
export const SECTION_TEXT_LIMIT = 300;
export const MIN_WEEK = 1;
export const MAX_WEEK = 52;
export const DECIMAL_RADIX = 10;
export const WEEK_PATTERN = /^\s*Week\s+(\d{1,2})\s*$/i;
export const WEEK_START_PATTERN = /^\s*Week\s+(\d{1,2})\b/i;

export const META_SELECTORS = [
  'meta[property="og:title"]',
  'meta[name="twitter:title"]',
  'meta[name="title"]',
];

export const HEADING_SELECTORS = [
  'h1',
  'h2',
  '.page-header-headings',
  '.page-header-headings h1',
  '.course-title',
  '.breadcrumb',
  "[data-region='course-header']",
];

export const PRECISE_WEEK_SELECTORS = [
  '[data-region="section-info"] .text-muted',
  '[data-region="section-info"]',
  '.activity-header .text-muted',
  '.page-header-headings .text-muted',
  '.breadcrumb-item.active',
];

export const HEADING_WEEK_SELECTORS = ['h2', 'h3', 'h4', 'strong', '.section-title'];

export function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function parseWeekToken(token: string | undefined): number | null {
  if (!isNonEmptyString(token)) return null;
  const weekNum = parseInt(token, DECIMAL_RADIX);
  if (weekNum >= MIN_WEEK && weekNum <= MAX_WEEK) {
    return weekNum;
  }
  return null;
}

export function extractWeekFromSelectors(
  dom: Document,
  selectors: string[],
  pattern: RegExp,
): number | null {
  for (const selector of selectors) {
    const elements = dom.querySelectorAll(selector);
    for (const el of elements) {
      const text = el.textContent?.trim();
      if (!isNonEmptyString(text)) continue;
      const match = text.match(pattern);
      const week = parseWeekToken(match?.[1]);
      if (week !== null) return week;
    }
  }
  return null;
}
