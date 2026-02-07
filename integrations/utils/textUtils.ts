export function extractCourseCodeFromText(text: string | null | undefined): string | null {
  if (typeof text !== 'string' || text.length === 0) return null;
  const match = text.match(/\b([A-Z]{3}\d{4})\b/i);
  const courseCode = match?.[1];
  return typeof courseCode === 'string' && courseCode.length > 0 ? courseCode.toUpperCase() : null;
}
