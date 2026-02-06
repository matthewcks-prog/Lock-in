/**
 * Extract section ID from Echo360 URL
 * URL format: /section/{sectionId}/* or /section/{sectionId}
 */
export function extractSectionId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(
      /\/section\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    );
    const sectionId = match?.[1];
    return sectionId ? sectionId.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function buildSyllabusUrl(baseUrl: string, sectionId: string): string {
  return `${baseUrl}/section/${encodeURIComponent(sectionId)}/syllabus`;
}

export function buildLessonPageUrl(baseUrl: string, lessonId: string): string {
  return `${baseUrl}/lesson/${encodeURIComponent(lessonId)}/classroom`;
}
