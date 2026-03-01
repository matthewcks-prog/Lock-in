/**
 * Content Safety Filter
 *
 * Pre-flight filter that redacts sensitive patterns before sending user text
 * to an LLM. Implements privacy-by-design: data minimisation + redaction.
 *
 * Categories:
 * - Emails, phone numbers, student/employee IDs
 * - API keys (OpenAI, Azure, GitHub, AWS, generic Bearer/JWT)
 * - File paths, URLs with sensitive query params
 * - Credit card numbers, SSNs
 *
 * @module core/services/contentSafetyFilter
 */

export interface SensitiveMatch {
  /** What category the match belongs to */
  category: string;
  /** The original matched text (first/last chars shown, rest masked) */
  preview: string;
  /** Start index in the original string */
  start: number;
  /** End index in the original string */
  end: number;
}

export interface ContentSafetyResult {
  /** Whether any sensitive content was detected */
  hasSensitiveContent: boolean;
  /** The redacted version of the input text */
  redactedText: string;
  /** List of detected sensitive patterns */
  matches: SensitiveMatch[];
  /** Human-readable summary of what was found */
  summary: string;
}

// --- Constants -------------------------------------------------------------

/** Minimum digit count to treat a phone number match as real */
const MIN_PHONE_DIGITS = 7;
/** Minimum length for student/employee ID matches */
const MIN_ID_LENGTH = 7;
/** Minimum digit count for credit card matches */
const MIN_CC_DIGITS = 13;
/** Minimum length for Azure key matches */
const MIN_AZURE_KEY_LENGTH = 32;
/** Values this short get fully masked */
const MASK_SHORT_THRESHOLD = 8;
/** Number of leading visible chars in mask */
const MASK_PREFIX_LEN = 3;
/** Number of trailing visible chars in mask */
const MASK_SUFFIX_LEN = 2;
/** Total visible chars (prefix + suffix) */
const MASK_TOTAL_VISIBLE = 5;
/** Maximum star characters in mask */
const MASK_MAX_STARS = 20;

// --- Pattern definitions ---------------------------------------------------

interface PatternDef {
  category: string;
  pattern: RegExp;
  redact: string;
}

const PATTERNS: PatternDef[] = [
  // API Keys -- specific providers
  {
    category: 'OpenAI API Key',
    pattern: /sk-[A-Za-z0-9_-]{20,}/g,
    redact: '[REDACTED_OPENAI_KEY]',
  },
  {
    category: 'Azure Key',
    pattern: /[0-9a-f]{32}/gi,
    redact: '[REDACTED_AZURE_KEY]',
  },
  {
    category: 'GitHub Token',
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
    redact: '[REDACTED_GITHUB_TOKEN]',
  },
  {
    category: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/g,
    redact: '[REDACTED_AWS_KEY]',
  },

  // JWT / Bearer tokens
  {
    category: 'JWT Token',
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    redact: '[REDACTED_JWT]',
  },
  {
    category: 'Bearer Token',
    pattern: /Bearer\s+[A-Za-z0-9_.-]{20,}/gi,
    redact: '[REDACTED_BEARER]',
  },

  // Personal identifiers
  {
    category: 'Email Address',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    redact: '[REDACTED_EMAIL]',
  },
  {
    category: 'Phone Number',
    pattern: /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g,
    redact: '[REDACTED_PHONE]',
  },
  {
    category: 'Student/Employee ID',
    pattern: /\b\d{7,10}\b/g,
    redact: '[REDACTED_ID]',
  },

  // Credit card (basic Luhn-plausible patterns)
  {
    category: 'Credit Card Number',
    pattern: /\b(?:\d[ -]*?){13,19}\b/g,
    redact: '[REDACTED_CC]',
  },

  // File paths (Windows + Unix)
  {
    category: 'File Path',
    pattern: /(?:[A-Z]:\\[\w\\.-]+|\/(?:home|Users|var|tmp|etc)\/[\w/.-]+)/g,
    redact: '[REDACTED_PATH]',
  },

  // Connection strings
  {
    category: 'Connection String',
    pattern: /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^\s"']+/gi,
    redact: '[REDACTED_CONNECTION_STRING]',
  },
];

// --- Public API ------------------------------------------------------------

/**
 * Scan text for sensitive content and return redacted version + match details.
 * Pure function  no side effects.
 */
export function scanContent(text: string): ContentSafetyResult {
  if (text === '' || text.trim().length === 0) {
    return {
      hasSensitiveContent: false,
      redactedText: text,
      matches: [],
      summary: '',
    };
  }

  const allMatches: SensitiveMatch[] = [];
  let redacted = text;

  for (const { category, pattern, redact } of PATTERNS) {
    // Clone regex to reset lastIndex
    const re = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;

    while ((match = re.exec(text)) !== null) {
      const original = match[0];
      // Skip very short matches (likely false positives from phone/ID patterns)
      if (category === 'Phone Number' && original.replace(/\D/g, '').length < MIN_PHONE_DIGITS)
        continue;
      if (category === 'Student/Employee ID' && original.length < MIN_ID_LENGTH) continue;
      if (category === 'Credit Card Number' && original.replace(/\D/g, '').length < MIN_CC_DIGITS)
        continue;
      // Skip azure key pattern if it is too short or likely a hex color
      if (category === 'Azure Key' && original.length < MIN_AZURE_KEY_LENGTH) continue;

      allMatches.push({
        category,
        preview: maskPreview(original),
        start: match.index,
        end: match.index + original.length,
      });

      // Use split+join for TS target compat (replaceAll requires es2021)
      redacted = redacted.split(original).join(redact);
    }
  }

  // Deduplicate overlapping matches (keep first per position)
  const deduped = deduplicateMatches(allMatches);

  const categories = [...new Set(deduped.map((m) => m.category))];
  const summary =
    deduped.length > 0
      ? `Detected ${deduped.length} sensitive item(s): ${categories.join(', ')}`
      : '';

  return {
    hasSensitiveContent: deduped.length > 0,
    redactedText: redacted,
    matches: deduped,
    summary,
  };
}

//  Helpers

/** Show first few and last few chars, mask the rest */
function maskPreview(value: string): string {
  if (value.length <= MASK_SHORT_THRESHOLD) return '***';
  const visible = value.slice(0, MASK_PREFIX_LEN);
  const masked = '*'.repeat(Math.min(value.length - MASK_TOTAL_VISIBLE, MASK_MAX_STARS));
  const tail = value.slice(-MASK_SUFFIX_LEN);
  return `${visible}${masked}${tail}`;
}

/** Remove overlapping matches (keep the longer / earlier one) */
function deduplicateMatches(matches: SensitiveMatch[]): SensitiveMatch[] {
  if (matches.length <= 1) return matches;

  const sorted = [...matches].sort((a, b) => {
    const startDiff = a.start - b.start;
    return startDiff !== 0 ? startDiff : b.end - a.end;
  });
  const first = sorted[0];
  if (first === undefined) return matches;
  const result: SensitiveMatch[] = [first];

  for (let i = 1; i < sorted.length; i++) {
    const prev = result[result.length - 1];
    const curr = sorted[i];
    if (prev !== undefined && curr !== undefined && curr.start >= prev.end) {
      result.push(curr);
    }
    // else: overlapping -- skip the shorter/later match
  }

  return result;
}
