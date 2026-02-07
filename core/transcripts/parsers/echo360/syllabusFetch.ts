import type { AsyncFetcher } from '../../fetchers/types';
import type { DetectedVideo } from '../../types';
import { log } from '../../utils/echo360Logger';
import { DEFAULT_TIMEOUT_MS, fetchWithRetry } from '../../utils/echo360Network';
import { extractSectionId, buildSyllabusUrl } from './urlUtils';
import { parseSyllabusResponse, validateSyllabusResponse } from './syllabusParser';

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const SYLLABUS_CACHE_TTL_MINUTES = 5;
const SYLLABUS_CACHE_TTL_MS =
  SYLLABUS_CACHE_TTL_MINUTES * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
const syllabusCache = new Map<string, { data: DetectedVideo[]; timestamp: number }>();

function getCachedSyllabus(
  cacheKey: string,
  requestId: string,
  baseUrl: string,
  sectionId: string,
): DetectedVideo[] | null {
  const cached = syllabusCache.get(cacheKey);
  if (cached === undefined) {
    log('debug', requestId, 'Syllabus cache miss', { sectionId, baseUrl });
    return null;
  }

  const ageMs = Date.now() - cached.timestamp;
  if (ageMs < SYLLABUS_CACHE_TTL_MS) {
    log('debug', requestId, 'Syllabus cache hit', { sectionId, baseUrl, ageMs });
    return cached.data;
  }

  syllabusCache.delete(cacheKey);
  log('debug', requestId, 'Syllabus cache expired', { sectionId, baseUrl, ageMs });
  return null;
}

function updateSyllabusCache(cacheKey: string, videos: DetectedVideo[]): void {
  syllabusCache.set(cacheKey, { data: videos, timestamp: Date.now() });
}

function resolveBaseUrl(pageUrl: string, requestId: string): string | null {
  try {
    return new URL(pageUrl).origin;
  } catch {
    log('warn', requestId, 'Invalid page URL for syllabus fetch', { pageUrl });
    return null;
  }
}

async function fetchAndCacheSyllabus(params: {
  baseUrl: string;
  sectionId: string;
  cacheKey: string;
  fetcher: AsyncFetcher;
  requestId: string;
}): Promise<DetectedVideo[]> {
  try {
    const syllabusUrl = buildSyllabusUrl(params.baseUrl, params.sectionId);

    log('info', params.requestId, 'Fetching syllabus API', {
      syllabusUrl,
      sectionId: params.sectionId,
    });

    const syllabusData = await fetchWithRetry<unknown>(params.fetcher, syllabusUrl, {
      requestId: params.requestId,
      responseType: 'json',
      context: 'syllabus',
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
    const videos = parseSyllabusResponse(syllabusData, params.baseUrl, params.requestId);
    if (validateSyllabusResponse(syllabusData)) {
      updateSyllabusCache(params.cacheKey, videos);
    }
    return videos;
  } catch (error) {
    log('warn', params.requestId, 'Failed to fetch syllabus', {
      error: error instanceof Error ? error.message : String(error),
    });
    syllabusCache.delete(params.cacheKey);
    return [];
  }
}

/**
 * Fetch videos from Echo360 syllabus API
 */
export async function fetchVideosFromSyllabus(
  pageUrl: string,
  fetcher: AsyncFetcher,
  requestId: string,
): Promise<DetectedVideo[]> {
  const sectionId = extractSectionId(pageUrl);
  if (sectionId === null) {
    log('info', requestId, 'Not a section page, skipping syllabus fetch');
    return [];
  }

  const baseUrl = resolveBaseUrl(pageUrl, requestId);
  if (baseUrl === null) return [];

  const cacheKey = `${baseUrl}|${sectionId}`;
  const cached = getCachedSyllabus(cacheKey, requestId, baseUrl, sectionId);
  if (cached !== null) return cached;

  return fetchAndCacheSyllabus({ baseUrl, sectionId, cacheKey, fetcher, requestId });
}
