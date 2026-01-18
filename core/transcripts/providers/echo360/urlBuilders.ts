/**
 * Build lesson info API URL to get medias
 * Format: /api/ui/echoplayer/lessons/{lessonId}
 */
export function buildLessonInfoUrl(baseUrl: string, lessonId: string): string {
  return `${baseUrl}/api/ui/echoplayer/lessons/${encodeURIComponent(lessonId)}`;
}

/**
 * Build transcript JSON API URL
 * Format: /api/ui/echoplayer/lessons/{lessonId}/medias/{mediaId}/transcript
 */
export function buildTranscriptUrl(baseUrl: string, lessonId: string, mediaId: string): string {
  return `${baseUrl}/api/ui/echoplayer/lessons/${encodeURIComponent(lessonId)}/medias/${encodeURIComponent(mediaId)}/transcript`;
}

/**
 * Build transcript file URL (VTT or text format)
 */
export function buildTranscriptFileUrl(
  baseUrl: string,
  lessonId: string,
  mediaId: string,
  format: 'vtt' | 'text',
): string {
  return `${baseUrl}/api/ui/echoplayer/lessons/${encodeURIComponent(lessonId)}/medias/${encodeURIComponent(mediaId)}/transcript-file?format=${format}`;
}

/**
 * Build lesson classroom page URL
 */
export function buildClassroomUrl(baseUrl: string, lessonId: string): string {
  return `${baseUrl}/lesson/${encodeURIComponent(lessonId)}/classroom`;
}
