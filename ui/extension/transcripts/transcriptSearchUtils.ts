/**
 * Transcript text search utilities.
 *
 * Pure functions – no browser globals, no I/O.
 */

/** Escape a string so it is safe to use as a literal RegExp pattern. */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Split text into alternating non-match / match pairs for highlight rendering. */
export function splitHighlight(
  text: string,
  query: string,
): Array<{ match: boolean; part: string }> {
  if (query.trim().length === 0) return [{ match: false, part: text }];

  const re = new RegExp(`(${escapeRegex(query)})`, 'gi');
  const parts = text.split(re);

  const lowerQuery = query.toLowerCase();
  return parts
    .filter((p) => p.length > 0)
    .map((part) => ({ match: part.toLowerCase() === lowerQuery, part }));
}

/** Return indices of all paragraphs whose text contains the query (case-insensitive). */
export function findMatchingIndices(texts: string[], query: string): number[] {
  if (query.trim().length === 0) return [];
  const lower = query.toLowerCase();
  return texts.reduce<number[]>((acc, text, i) => {
    if (text.toLowerCase().includes(lower)) acc.push(i);
    return acc;
  }, []);
}
