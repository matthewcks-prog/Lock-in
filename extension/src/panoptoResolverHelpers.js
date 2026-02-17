(() => {
  function getConfigValue(key, fallback) {
    if (typeof self === 'undefined' || !self.LOCKIN_CONFIG) {
      return fallback;
    }
    const value = self.LOCKIN_CONFIG[key];
    return value === undefined || value === null || value === '' ? fallback : value;
  }

  function decodeEscapedUrl(url) {
    return url
      .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\\\//g, '/')
      .replace(/\\\\/g, '\\')
      .replace(/\\"/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x2F;/gi, '/')
      .replace(/&#x3D;/gi, '=')
      .replace(/&#39;/g, "'")
      .trim();
  }

  const PANOPTO_MEDIA_EXTENSIONS = ['.mp4', '.m4a', '.mp3'],
    PANOPTO_MEDIA_HINTS = ['/podcast/', 'podcast', 'download'],
    MAX_TRUNCATED_URL_LENGTH = 120,
    PODCAST_PATH_CANDIDATE_SCORE = 3;

  function parseBooleanConfig(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return ['1', 'true', 'yes', 'on', 'debug', 'trace'].includes(normalized);
    }
    return false;
  }

  function isPanoptoResolverDebugEnabled() {
    const direct = getConfigValue('DEBUG_PANOPTO_RESOLVER', null);
    if (direct !== null) return parseBooleanConfig(direct);
    const legacy = getConfigValue('DEBUG_PANOPTO', null);
    if (legacy !== null) return parseBooleanConfig(legacy);
    const debug = getConfigValue('DEBUG', null);
    if (debug !== null) return parseBooleanConfig(debug);
    const level = getConfigValue('LOG_LEVEL', '');
    return typeof level === 'string' && ['debug', 'trace'].includes(level.toLowerCase());
  }

  function truncateUrl(value) {
    if (!value || typeof value !== 'string') return '';
    if (value.length <= MAX_TRUNCATED_URL_LENGTH) return value;
    return `${value.slice(0, MAX_TRUNCATED_URL_LENGTH)}...`;
  }

  function createPanoptoResolverLogger(jobId, debugEnabled) {
    const prefix = '[Lock-in PanoptoResolver]';
    const startMs = Date.now();

    const log = (level, step, data, always) => {
      if (!always && !debugEnabled) return;
      const elapsedMs =
        data && typeof data.elapsedMs === 'number' ? data.elapsedMs : Date.now() - startMs;
      const status = data && data.status ? ` status=${data.status}` : '';
      const url = data && data.url ? ` url=${truncateUrl(data.url)}` : '';
      const finalUrl = data && data.finalUrl ? ` finalUrl=${truncateUrl(data.finalUrl)}` : '';
      const meta = data && data.meta ? data.meta : null;
      const line = `${prefix} jobId=${jobId} step=${step}${status}${url}${finalUrl} ms=${elapsedMs}`;
      if (meta) {
        console[level](line, meta);
      } else {
        console[level](line);
      }
    };

    return {
      debug: (step, data) => log('debug', step, data, false),
      info: (step, data) => log('info', step, data, true),
      warn: (step, data) => log('warn', step, data, true),
      error: (step, data) => log('error', step, data, true),
      isDebugEnabled: () => debugEnabled,
    };
  }

  function buildPanoptoPodcastDownloadUrl(tenant, deliveryId) {
    if (!tenant || !deliveryId) return null;
    const url = new URL(
      `https://${tenant}/Panopto/Podcast/Download/${encodeURIComponent(deliveryId)}.mp4`,
    );
    url.searchParams.set('mediaTargetType', 'videoPodcast');
    return url.toString();
  }

  function looksLikePanoptoMediaUrl(url) {
    if (!url) return false;
    const lower = url.toLowerCase();
    if (lower.startsWith('blob:') || lower.startsWith('data:')) {
      return false;
    }
    if (lower.includes('.m3u8')) {
      return false;
    }
    if (PANOPTO_MEDIA_EXTENSIONS.some((ext) => lower.includes(ext))) {
      return true;
    }
    return PANOPTO_MEDIA_HINTS.some((hint) => lower.includes(hint));
  }

  function normalizePanoptoCandidateUrl(rawUrl, baseUrl) {
    if (!rawUrl) return null;
    let cleaned = rawUrl;
    if (rawUrl.includes('\\u')) {
      cleaned = decodeEscapedUrl(rawUrl);
    }

    try {
      const url = new URL(cleaned, baseUrl);
      url.hash = '';
      return url.toString();
    } catch {
      return null;
    }
  }

  function extractUrlCandidatesFromHtml(html, baseUrl) {
    const candidates = [];
    const urlMatches = html.match(/https?:\/\/[^"'\\s<>]+/gi) || [];
    for (const match of urlMatches) {
      if (!looksLikePanoptoMediaUrl(match)) continue;
      const normalized = normalizePanoptoCandidateUrl(match, baseUrl);
      if (normalized) {
        candidates.push({ url: normalized, source: 'html:url' });
      }
    }
    return candidates;
  }

  function extractJsonCandidatesFromHtml(html, baseUrl) {
    const candidates = [];
    const jsonMatches = html.match(/"(?:DownloadUrl|downloadUrl)"\s*:\s*"([^"]+)"/gi) || [];
    for (const match of jsonMatches) {
      const [, urlRaw] = match.match(/"([^"]+)"/) || [];
      if (!urlRaw) continue;
      const decoded = decodeEscapedUrl(urlRaw);
      if (!looksLikePanoptoMediaUrl(decoded)) continue;
      const normalized = normalizePanoptoCandidateUrl(decoded, baseUrl);
      if (normalized) {
        candidates.push({ url: normalized, source: 'html:json' });
      }
    }
    return candidates;
  }

  function resolveDownloadFlags(html) {
    const podcastDisabled = /PodcastDownloadEnabled\s*:\s*false/i.test(html);
    const downloadEnabled = /DownloadEnabled\s*:\s*true/i.test(html);
    return {
      podcastDisabled,
      downloadEnabled,
      disabledReason: podcastDisabled ? 'Podcast downloads disabled' : null,
    };
  }

  function extractPanoptoMediaCandidatesFromHtml(html, baseUrl) {
    if (!html || typeof html !== 'string') {
      return {
        candidates: [],
        podcastDisabled: false,
        downloadEnabled: false,
        disabledReason: null,
      };
    }
    const candidates = [
      ...extractUrlCandidatesFromHtml(html, baseUrl),
      ...extractJsonCandidatesFromHtml(html, baseUrl),
    ];
    const flags = resolveDownloadFlags(html);
    return { candidates, ...flags };
  }

  function scorePanoptoCandidate(candidate) {
    if (!candidate?.url) return 0;
    const url = candidate.url.toLowerCase();
    let score = 0;
    if (url.includes('/podcast/')) score += PODCAST_PATH_CANDIDATE_SCORE;
    if (url.includes('download')) score += 2;
    if (url.endsWith('.mp4')) score += 2;
    if (url.endsWith('.m4a') || url.endsWith('.mp3')) score += 1;
    if (candidate.source && candidate.source.includes('derived')) score += 1;
    return score;
  }

  function dedupeAndSortPanoptoCandidates(candidates) {
    const seen = new Set();
    const deduped = [];
    for (const candidate of candidates) {
      const url = candidate?.url;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      deduped.push(candidate);
    }
    return deduped.sort((a, b) => scorePanoptoCandidate(b) - scorePanoptoCandidate(a));
  }

  function resolvePanoptoContextUrl({ providedUrl, tenant, deliveryId, urlBuilder }) {
    if (providedUrl) return providedUrl;
    if (!tenant || !deliveryId || typeof urlBuilder !== 'function') {
      return null;
    }
    return urlBuilder(tenant, deliveryId);
  }

  function resolvePanoptoContext({
    tenant,
    deliveryId,
    viewerUrl,
    embedUrl,
    extractor,
    viewerUrlBuilder,
    embedUrlBuilder,
  }) {
    const info = typeof extractor === 'function' ? extractor(embedUrl || viewerUrl || '') : null;
    const resolvedTenant = tenant || info?.tenant || null;
    const resolvedDeliveryId = deliveryId || info?.deliveryId || null;
    const resolvedViewerUrl = resolvePanoptoContextUrl({
      providedUrl: viewerUrl,
      tenant: resolvedTenant,
      deliveryId: resolvedDeliveryId,
      urlBuilder: viewerUrlBuilder,
    });
    const resolvedEmbedUrl = resolvePanoptoContextUrl({
      providedUrl: embedUrl,
      tenant: resolvedTenant,
      deliveryId: resolvedDeliveryId,
      urlBuilder: embedUrlBuilder,
    });
    return {
      resolvedTenant,
      resolvedDeliveryId,
      resolvedViewerUrl,
      resolvedEmbedUrl,
      primaryUrl: resolvedViewerUrl || resolvedEmbedUrl,
    };
  }

  if (typeof self !== 'undefined') {
    self.LockInPanoptoResolverHelpers = {
      getConfigValue,
      decodeEscapedUrl,
      parseBooleanConfig,
      isPanoptoResolverDebugEnabled,
      truncateUrl,
      createPanoptoResolverLogger,
      buildPanoptoPodcastDownloadUrl,
      looksLikePanoptoMediaUrl,
      normalizePanoptoCandidateUrl,
      extractPanoptoMediaCandidatesFromHtml,
      scorePanoptoCandidate,
      dedupeAndSortPanoptoCandidates,
      resolvePanoptoContext,
    };
  }
})();
