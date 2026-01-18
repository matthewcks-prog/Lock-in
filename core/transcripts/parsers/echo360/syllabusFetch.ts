import type { AsyncFetcher } from '../../fetchers/types';
import type { DetectedVideo } from '../../types';
import { log } from '../../utils/echo360Logger';
import { DEFAULT_TIMEOUT_MS, fetchWithRetry } from '../../utils/echo360Network';
import { extractSectionId, buildSyllabusUrl } from './urlUtils';
import { parseSyllabusResponse, validateSyllabusResponse } from './syllabusParser';

const SYLLABUS_CACHE_TTL_MS = 5 * 60 * 1000;
const syllabusCache = new Map<string, { data: DetectedVideo[]; timestamp: number }>();

/**
 * Fetch videos from Echo360 syllabus API
 */
export async function fetchVideosFromSyllabus(
  pageUrl: string,
  fetcher: AsyncFetcher,
  requestId: string,
): Promise<DetectedVideo[]> {
  const sectionId = extractSectionId(pageUrl);
  if (!sectionId) {
    log('info', requestId, 'Not a section page, skipping syllabus fetch');
    return [];
  }

  let baseUrl = '';
  try {
    baseUrl = new URL(pageUrl).origin;
  } catch {
    log('warn', requestId, 'Invalid page URL for syllabus fetch', { pageUrl });
    return [];
  }

  const cacheKey = `${baseUrl}|${sectionId}`;
  const cached = syllabusCache.get(cacheKey);
  if (cached) {
    const ageMs = Date.now() - cached.timestamp;
    if (ageMs < SYLLABUS_CACHE_TTL_MS) {
      log('debug', requestId, 'Syllabus cache hit', { sectionId, baseUrl, ageMs });
      return cached.data;
    }
    syllabusCache.delete(cacheKey);
    log('debug', requestId, 'Syllabus cache expired', { sectionId, baseUrl, ageMs });
  } else {
    log('debug', requestId, 'Syllabus cache miss', { sectionId, baseUrl });
  }

  try {
    const syllabusUrl = buildSyllabusUrl(baseUrl, sectionId);

    log('info', requestId, 'Fetching syllabus API', { syllabusUrl, sectionId });

    const syllabusData = await fetchWithRetry<unknown>(fetcher, syllabusUrl, {
      requestId,
      responseType: 'json',
      context: 'syllabus',
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    const videos = parseSyllabusResponse(syllabusData, baseUrl, requestId);
    if (validateSyllabusResponse(syllabusData)) {
      syllabusCache.set(cacheKey, { data: videos, timestamp: Date.now() });
    }
    return videos;
  } catch (error) {
    log('warn', requestId, 'Failed to fetch syllabus', {
      error: error instanceof Error ? error.message : String(error),
    });
    syllabusCache.delete(cacheKey);
    return [];
  }
}
