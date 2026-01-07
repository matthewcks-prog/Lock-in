(() => {
// Panopto resolver helpers for the background service worker.

const NetworkUtils =
  typeof self !== "undefined" && self.LockInNetworkUtils
    ? self.LockInNetworkUtils
    : null;
const { fetchWithRetry, fetchWithCredentials, fetchHtmlWithRedirectInfo } =
  NetworkUtils || {};

function getConfigValue(key, fallback) {
  if (typeof self === "undefined" || !self.LOCKIN_CONFIG) {
    return fallback;
  }
  const value = self.LOCKIN_CONFIG[key];
  return value === undefined || value === null || value === ""
    ? fallback
    : value;
}

/**
 * Extract CaptionUrl from Panopto embed HTML
 */
function extractCaptionVttUrl(html) {
  const patterns = [
    /"CaptionUrl"\s*:\s*\[\s*"([^"]+)"/i,
    /"CaptionUrl"\s*:\s*"([^"]+)"/i,
    /"Captions"\s*:\s*\[\s*\{[^}]*"Url"\s*:\s*"([^"]+)"/i,
    /"Captions"\s*:\s*\[\s*\{[^}]*"VttUrl"\s*:\s*"([^"]+)"/i,
    /"Captions"\s*:\s*\[\s*\{[^}]*"CaptionUrl"\s*:\s*"([^"]+)"/i,
    /"TranscriptUrl"\s*:\s*"([^"]+)"/i,
    /((?:https?:)?\/\/[^"'\s]+GetCaptionVTT\.ashx\?[^"'\s]+)/i,
    /((?:\/)?Panopto\/Pages\/Transcription\/GetCaptionVTT\.ashx\?[^"'\s]+)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return decodeEscapedUrl(match[1]);
    }
  }

  return null;
}

/**
 * Helper to decode escaped URLs from Panopto JSON
 */
function decodeEscapedUrl(url) {
  return url
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\\\//g, "/")
    .replace(/\\\\/g, "\\")
    .replace(/\\"/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x2F;/gi, "/")
    .replace(/&#x3D;/gi, "=")
    .replace(/&#39;/g, "'")
    .trim();
}

function resolveCaptionUrl(captionUrl, baseUrl) {
  const decoded = decodeEscapedUrl(captionUrl);
  try {
    return new URL(decoded, baseUrl).toString();
  } catch {
    return decoded;
  }
}

function extractPanoptoInfoFromHtml(html, baseUrl) {
  const candidates = new Set();
  const urlMatches = html.match(/(?:https?:)?\/\/[^\s"'<>]+/gi) || [];
  const escapedMatches = html.match(/https?:\\\/\\\/[^\s"'<>]+/gi) || [];
  const encodedMatches = html.match(/https?%3A%2F%2F[^\s"'<>]+/gi) || [];

  [...urlMatches, ...escapedMatches, ...encodedMatches].forEach((match) => {
    if (match.toLowerCase().includes("panopto")) {
      candidates.add(match);
    }
  });

  for (const candidate of candidates) {
    const normalized = normalizePanoptoCandidateUrl(candidate, baseUrl);
    if (normalized) {
      const info = extractPanoptoInfoFromUrl(normalized);
      if (info) return { info, url: normalized };
      try {
        const decoded = decodeURIComponent(normalized);
        if (decoded !== normalized) {
          const decodedInfo = extractPanoptoInfoFromUrl(decoded);
          if (decodedInfo) return { info: decodedInfo, url: decoded };
        }
      } catch {
        // Ignore decode errors
      }
    }
  }

  return null;
}

async function resolvePanoptoInfoFromWrapperUrl(url) {
  try {
    const { html, finalUrl } = await fetchHtmlWithRedirectInfo(url);
    const directInfo = extractPanoptoInfoFromUrl(finalUrl);
    if (directInfo) {
      return { info: directInfo, authRequired: false, finalUrl };
    }

    const fromHtml = extractPanoptoInfoFromHtml(html, finalUrl || url);
    if (fromHtml) {
      return { info: fromHtml.info, authRequired: false, finalUrl: fromHtml.url };
    }

    return { info: null, authRequired: false, finalUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "AUTH_REQUIRED") {
      return { info: null, authRequired: true };
    }
    return { info: null, authRequired: false };
  }
}

// Panopto Media Resolver (V2)
const PANOPTO_RESOLVER_TIMEOUT_MS = 15000;
const PANOPTO_RESOLVER_RANGE_HEADER = "bytes=0-0";
const PANOPTO_MEDIA_EXTENSIONS = [".mp4", ".m4a", ".mp3"];
const PANOPTO_MEDIA_HINTS = ["/podcast/", "podcast", "download"];

function parseBooleanConfig(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["1", "true", "yes", "on", "debug", "trace"].includes(normalized);
  }
  return false;
}

function isPanoptoResolverDebugEnabled() {
  const direct = getConfigValue("DEBUG_PANOPTO_RESOLVER", null);
  if (direct !== null) return parseBooleanConfig(direct);
  const legacy = getConfigValue("DEBUG_PANOPTO", null);
  if (legacy !== null) return parseBooleanConfig(legacy);
  const debug = getConfigValue("DEBUG", null);
  if (debug !== null) return parseBooleanConfig(debug);
  const level = getConfigValue("LOG_LEVEL", "");
  return (
    typeof level === "string" &&
    ["debug", "trace"].includes(level.toLowerCase())
  );
}

function truncateUrl(value) {
  if (!value || typeof value !== "string") return "";
  if (value.length <= 120) return value;
  return `${value.slice(0, 120)}...`;
}

function createPanoptoResolverLogger(jobId, debugEnabled) {
  const prefix = "[Lock-in PanoptoResolver]";
  const startMs = Date.now();

  const log = (level, step, data, always) => {
    if (!always && !debugEnabled) return;
    const elapsedMs =
      data && typeof data.elapsedMs === "number"
        ? data.elapsedMs
        : Date.now() - startMs;
    const status = data && data.status ? ` status=${data.status}` : "";
    const url = data && data.url ? ` url=${truncateUrl(data.url)}` : "";
    const finalUrl =
      data && data.finalUrl ? ` finalUrl=${truncateUrl(data.finalUrl)}` : "";
    const meta = data && data.meta ? data.meta : null;
    const line = `${prefix} jobId=${jobId} step=${step}${status}${url}${finalUrl} ms=${elapsedMs}`;
    if (meta) {
      console[level](line, meta);
    } else {
      console[level](line);
    }
  };

  return {
    debug: (step, data) => log("debug", step, data, false),
    info: (step, data) => log("info", step, data, true),
    warn: (step, data) => log("warn", step, data, true),
    error: (step, data) => log("error", step, data, true),
    isDebugEnabled: () => debugEnabled,
  };
}

function extractPanoptoInfoFromUrl(url) {
  if (!url) return null;
  const match = url.match(
    /https?:\/\/([^/]+)\/Panopto\/Pages\/(?:Embed|Viewer)\.aspx\?.*\bid=([a-f0-9-]+)/i
  );
  if (match) {
    return { tenant: match[1], deliveryId: match[2] };
  }

  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname;
    if (!host.includes("panopto")) return null;
    const id = urlObj.searchParams.get("id");
    if (id) {
      return { tenant: host, deliveryId: id };
    }
  } catch {
    // Ignore parse errors
  }

  try {
    const decoded = decodeURIComponent(url);
    if (decoded !== url) {
      return extractPanoptoInfoFromUrl(decoded);
    }
  } catch {
    // Ignore decode errors
  }

  return null;
}

function buildPanoptoViewerUrl(tenant, deliveryId) {
  if (!tenant || !deliveryId) return null;
  return `https://${tenant}/Panopto/Pages/Viewer.aspx?id=${encodeURIComponent(
    deliveryId
  )}`;
}

function buildPanoptoEmbedUrl(tenant, deliveryId) {
  if (!tenant || !deliveryId) return null;
  return `https://${tenant}/Panopto/Pages/Embed.aspx?id=${encodeURIComponent(
    deliveryId
  )}`;
}

function buildPanoptoPodcastDownloadUrl(tenant, deliveryId) {
  if (!tenant || !deliveryId) return null;
  const url = new URL(
    `https://${tenant}/Panopto/Podcast/Download/${encodeURIComponent(
      deliveryId
    )}.mp4`
  );
  url.searchParams.set("mediaTargetType", "videoPodcast");
  return url.toString();
}

function looksLikePanoptoMediaUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.startsWith("blob:") || lower.startsWith("data:")) {
    return false;
  }
  if (lower.includes(".m3u8")) {
    return false;
  }
  if (PANOPTO_MEDIA_EXTENSIONS.some((ext) => lower.includes(ext))) {
    return true;
  }
  return PANOPTO_MEDIA_HINTS.some((hint) => lower.includes(hint));
}

function normalizePanoptoCandidateUrl(rawUrl, baseUrl) {
  if (!rawUrl) return null;
  const decoded = decodeEscapedUrl(rawUrl);
  if (!decoded || decoded.startsWith("javascript:")) return null;
  try {
    return new URL(decoded, baseUrl).toString();
  } catch {
    return decoded;
  }
}

function extractPanoptoMediaCandidatesFromHtml(html, baseUrl) {
  const candidates = [];
  const seen = new Set();
  let podcastDisabled = false;
  let downloadEnabled = false;
  let disabledReason = null;

  const addCandidate = (rawUrl, source) => {
    const normalized = normalizePanoptoCandidateUrl(rawUrl, baseUrl);
    if (!normalized || !looksLikePanoptoMediaUrl(normalized)) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push({ url: normalized, source });
  };

  const urlPatterns = [
    { regex: /"PodcastUrl"\s*:\s*"([^"]+)"/gi, source: "html:PodcastUrl" },
    {
      regex: /"PodcastDownloadUrl"\s*:\s*"([^"]+)"/gi,
      source: "html:PodcastDownloadUrl",
    },
    { regex: /"DownloadUrl"\s*:\s*"([^"]+)"/gi, source: "html:DownloadUrl" },
    { regex: /"StreamUrl"\s*:\s*"([^"]+)"/gi, source: "html:StreamUrl" },
    { regex: /"IosStreamUrl"\s*:\s*"([^"]+)"/gi, source: "html:IosStreamUrl" },
    { regex: /"Mp4Url"\s*:\s*"([^"]+)"/gi, source: "html:Mp4Url" },
    { regex: /"VideoUrl"\s*:\s*"([^"]+)"/gi, source: "html:VideoUrl" },
  ];

  for (const pattern of urlPatterns) {
    for (const match of html.matchAll(pattern.regex)) {
      if (match[1]) {
        addCandidate(match[1], pattern.source);
      }
    }
  }

  const ogPatterns = [
    /<meta[^>]+property=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["']/gi,
    /<meta[^>]+name=["']og:video(?::secure_url)?["'][^>]+content=["']([^"']+)["']/gi,
  ];
  for (const pattern of ogPatterns) {
    for (const match of html.matchAll(pattern)) {
      if (match[1]) {
        addCandidate(match[1], "html:og:video");
      }
    }
  }

  for (const match of html.matchAll(
    /data-(?:podcast|download|stream|video)-url=["']([^"']+)["']/gi
  )) {
    if (match[1]) {
      addCandidate(match[1], "html:data-url");
    }
  }

  for (const match of html.matchAll(
    /href=["']([^"']*\/Podcast\/[^"']+)["']/gi
  )) {
    if (match[1]) {
      addCandidate(match[1], "html:podcast-link");
    }
  }

  const disabledPatterns = [
    {
      regex: /"PodcastDownloadEnabled"\s*:\s*false/i,
      reason: "podcast-download-disabled",
    },
    { regex: /"DownloadEnabled"\s*:\s*false/i, reason: "download-disabled" },
    { regex: /"DownloadsEnabled"\s*:\s*false/i, reason: "downloads-disabled" },
    { regex: /"AllowDownload"\s*:\s*false/i, reason: "allow-download-false" },
    {
      regex: /data-download-enabled=["']false["']/i,
      reason: "data-download-enabled-false",
    },
  ];
  const enabledPatterns = [
    /"PodcastDownloadEnabled"\s*:\s*true/i,
    /"DownloadEnabled"\s*:\s*true/i,
    /"DownloadsEnabled"\s*:\s*true/i,
    /"AllowDownload"\s*:\s*true/i,
    /data-download-enabled=["']true["']/i,
  ];

  for (const entry of disabledPatterns) {
    if (entry.regex.test(html)) {
      podcastDisabled = true;
      disabledReason = entry.reason;
      break;
    }
  }

  if (enabledPatterns.some((pattern) => pattern.test(html))) {
    downloadEnabled = true;
  }

  return { candidates, podcastDisabled, disabledReason, downloadEnabled };
}

function panoptoRuntimeProbe() {
  const candidates = [];
  const seen = new Set();
  let podcastDisabled = false;
  let downloadEnabled = false;
  let disabledReason = null;

  const decodeEscaped = (value) =>
    value
      .replace(/\\u([0-9a-fA-F]{4})/g, (_m, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      )
      .replace(/\\\//g, "/")
      .replace(/\\\\/g, "\\")
      .replace(/\\"/g, '"')
      .trim();

  const normalizeUrl = (rawUrl) => {
    if (!rawUrl) return null;
    const decoded = decodeEscaped(rawUrl);
    if (!decoded || decoded.startsWith("javascript:")) return null;
    try {
      return new URL(decoded, window.location.href).toString();
    } catch {
      return decoded;
    }
  };

  const looksLikeMediaUrl = (url) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    if (lower.startsWith("blob:") || lower.startsWith("data:")) return false;
    if (lower.includes(".m3u8")) return false;
    if ([".mp4", ".m4a", ".mp3"].some((ext) => lower.includes(ext))) {
      return true;
    }
    return ["/podcast/", "podcast", "download"].some((hint) =>
      lower.includes(hint)
    );
  };

  const addCandidate = (rawUrl, source) => {
    const normalized = normalizeUrl(rawUrl);
    if (!normalized || !looksLikeMediaUrl(normalized)) return;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    candidates.push({ url: normalized, source });
  };

  const metaTags = document.querySelectorAll(
    'meta[property="og:video"], meta[property="og:video:secure_url"], meta[name="og:video"], meta[name="og:video:secure_url"]'
  );
  metaTags.forEach((meta) => {
    const content = meta.getAttribute("content");
    if (content) {
      addCandidate(content, "runtime:og:video");
    }
  });

  const dataUrlNodes = document.querySelectorAll(
    "[data-podcast-url], [data-download-url], [data-stream-url], [data-video-url]"
  );
  dataUrlNodes.forEach((node) => {
    const attrs = [
      "data-podcast-url",
      "data-download-url",
      "data-stream-url",
      "data-video-url",
    ];
    attrs.forEach((attr) => {
      const value = node.getAttribute(attr);
      if (value) {
        addCandidate(value, "runtime:data-url");
      }
    });
  });

  const anchors = document.querySelectorAll("a[href]");
  anchors.forEach((anchor) => {
    const href = anchor.getAttribute("href");
    if (href && /podcast|download/i.test(href)) {
      addCandidate(href, "runtime:link");
    }
  });

  const downloadControls = document.querySelectorAll(
    '[aria-label*="Download" i], [title*="Download" i], [data-tooltip*="Download" i]'
  );
  downloadControls.forEach((control) => {
    const ariaDisabled = control.getAttribute("aria-disabled");
    const isDisabled =
      control.hasAttribute("disabled") || ariaDisabled === "true";
    if (isDisabled && !podcastDisabled) {
      podcastDisabled = true;
      disabledReason = "download-control-disabled";
    }
  });

  const rootObjects = [
    { name: "Panopto", value: window.Panopto },
    { name: "panopto", value: window.panopto },
    { name: "PanoptoViewer", value: window.PanoptoViewer },
    { name: "__PANOPTO_STATE__", value: window.__PANOPTO_STATE__ },
    { name: "__INITIAL_STATE__", value: window.__INITIAL_STATE__ },
  ];

  const visited = new WeakSet();
  const maxDepth = 4;
  let inspected = 0;
  const maxNodes = 1500;

  const scan = (value, path, depth) => {
    if (!value || typeof value !== "object") return;
    if (visited.has(value)) return;
    if (inspected > maxNodes) return;
    visited.add(value);
    inspected += 1;
    if (depth > maxDepth) return;

    Object.keys(value).forEach((key) => {
      try {
        const next = value[key];
        const nextPath = `${path}.${key}`;
        if (typeof next === "string") {
          if (looksLikeMediaUrl(next)) {
            addCandidate(next, `runtime:${nextPath}`);
          }
        } else if (typeof next === "boolean") {
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes("download") || lowerKey.includes("podcast")) {
            if (next === false && !podcastDisabled) {
              podcastDisabled = true;
              disabledReason = `state:${nextPath}`;
            }
            if (next === true) {
              downloadEnabled = true;
            }
          }
        } else if (typeof next === "object" && next) {
          scan(next, nextPath, depth + 1);
        }
      } catch {
        // Ignore access errors
      }
    });
  };

  rootObjects.forEach((root) => {
    if (root.value && typeof root.value === "object") {
      scan(root.value, root.name, 0);
    }
  });

  if (typeof performance !== "undefined" && performance.getEntriesByType) {
    const entries = performance.getEntriesByType("resource");
    for (let i = 0; i < entries.length && candidates.length < 20; i += 1) {
      const entry = entries[i];
      if (
        entry &&
        typeof entry.name === "string" &&
        looksLikeMediaUrl(entry.name)
      ) {
        addCandidate(entry.name, "runtime:perf");
      }
    }
  }

  return {
    pageUrl: window.location.href,
    candidates,
    podcastDisabled,
    downloadEnabled,
    disabledReason,
  };
}

function executeScriptInTab(tabId, func) {
  return new Promise((resolve, reject) => {
    if (
      typeof chrome === "undefined" ||
      !chrome.scripting ||
      typeof chrome.scripting.executeScript !== "function"
    ) {
      reject(new Error("chrome.scripting.executeScript unavailable"));
      return;
    }
    chrome.scripting.executeScript(
      {
        target: { tabId, allFrames: true },
        world: "MAIN",
        func,
      },
      (results) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(results || []);
      }
    );
  });
}

async function runPanoptoRuntimeProbe(tabId, logger) {
  if (!tabId) {
    logger.debug("runtime-probe", {
      status: "skipped",
      meta: { reason: "no-tab-id" },
    });
    return { candidates: [], podcastDisabled: false, downloadEnabled: false };
  }

  const started = Date.now();
  try {
    const results = await executeScriptInTab(tabId, panoptoRuntimeProbe);
    const candidates = [];
    let podcastDisabled = false;
    let downloadEnabled = false;
    let disabledReason = null;
    let frameCount = 0;

    results.forEach((entry) => {
      const data = entry && entry.result ? entry.result : null;
      if (!data || !data.candidates) return;
      const pageUrl = typeof data.pageUrl === "string" ? data.pageUrl : "";
      if (pageUrl && !pageUrl.includes("panopto")) return;
      frameCount += 1;
      data.candidates.forEach((candidate) => {
        if (!candidate || !candidate.url) return;
        candidates.push({
          url: candidate.url,
          source: candidate.source || "runtime",
          frameUrl: pageUrl,
        });
      });
      if (data.podcastDisabled) {
        podcastDisabled = true;
        disabledReason = data.disabledReason || disabledReason;
      }
      if (data.downloadEnabled) {
        downloadEnabled = true;
      }
    });

    logger.debug("runtime-probe", {
      status: "ok",
      elapsedMs: Date.now() - started,
      meta: {
        frameCount,
        candidateCount: candidates.length,
        podcastDisabled,
        downloadEnabled,
      },
    });

    return { candidates, podcastDisabled, downloadEnabled, disabledReason };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn("runtime-probe", {
      status: "error",
      elapsedMs: Date.now() - started,
      meta: { error: message },
    });
    return {
      candidates: [],
      podcastDisabled: false,
      downloadEnabled: false,
      error: message,
    };
  }
}

function scorePanoptoCandidate(candidate) {
  const url = candidate && candidate.url ? candidate.url : "";
  const source = candidate && candidate.source ? candidate.source : "";
  const lower = url.toLowerCase();
  let score = 0;
  if (lower.includes("/podcast/")) score += 5;
  if (lower.includes("podcast")) score += 3;
  if (lower.includes("download")) score += 2;
  if (lower.includes(".mp4")) score += 3;
  if (lower.includes(".m4a")) score += 2;
  if (lower.includes(".mp3")) score += 1;
  if (lower.includes(".m3u8")) score -= 10;
  if (source.includes("og:video")) score -= 1;
  return score;
}

function dedupeAndSortPanoptoCandidates(candidates) {
  const seen = new Set();
  const unique = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.url)) continue;
    seen.add(candidate.url);
    unique.push(candidate);
  }
  return unique.sort(
    (a, b) => scorePanoptoCandidate(b) - scorePanoptoCandidate(a)
  );
}

function isAuthStatus(status) {
  return status === 401 || status === 403;
}

async function probePanoptoMediaUrl(url, logger) {
  const started = Date.now();
  try {
    const response = await fetchWithRetry(
      url,
      {
        method: "GET",
        credentials: "include",
        redirect: "follow",
        headers: {
          Range: PANOPTO_RESOLVER_RANGE_HEADER,
          Accept: "video/*,audio/*,*/*",
        },
      },
      1,
      PANOPTO_RESOLVER_TIMEOUT_MS
    );

    const status = response.status;
    const contentType = response.headers.get("content-type") || "";
    const contentRange = response.headers.get("content-range") || "";
    const finalUrl = response.url || url;

    if (response.body && typeof response.body.cancel === "function") {
      try {
        response.body.cancel();
      } catch {
        // Ignore stream cancel errors
      }
    }

    logger.debug("range-probe", {
      url,
      finalUrl,
      elapsedMs: Date.now() - started,
      meta: {
        status,
        contentType,
        contentRange,
      },
    });

    if (isAuthStatus(status)) {
      return {
        ok: false,
        status,
        errorCode: "AUTH_REQUIRED",
        finalUrl,
        contentType,
      };
    }

    if (!response.ok) {
      return { ok: false, status, finalUrl, contentType };
    }

    if (contentType.toLowerCase().includes("text/html")) {
      return {
        ok: false,
        status,
        errorCode: "AUTH_REQUIRED",
        finalUrl,
        contentType,
      };
    }

    return { ok: true, status, finalUrl, contentType };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.debug("range-probe", {
      status: "error",
      url,
      elapsedMs: Date.now() - started,
      meta: { error: message },
    });
    return { ok: false, error: message };
  }
}

const PanoptoMediaResolver = {
  async resolve({ tenant, deliveryId, viewerUrl, embedUrl, tabId, jobId }) {
    const resolvedJobId =
      jobId || `panopto-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const debugEnabled = isPanoptoResolverDebugEnabled();
    const logger = createPanoptoResolverLogger(resolvedJobId, debugEnabled);
    const debugPayload = {
      jobId: resolvedJobId,
      candidates: [],
      signals: {},
    };

    let resolvedTenant = tenant;
    let resolvedDeliveryId = deliveryId;
    let resolvedViewerUrl = viewerUrl;
    let resolvedEmbedUrl = embedUrl;

    if (!resolvedViewerUrl || !resolvedTenant || !resolvedDeliveryId) {
      const info = extractPanoptoInfoFromUrl(embedUrl || viewerUrl);
      if (info) {
        resolvedTenant = resolvedTenant || info.tenant;
        resolvedDeliveryId = resolvedDeliveryId || info.deliveryId;
      }
    }

    if (!resolvedViewerUrl && resolvedTenant && resolvedDeliveryId) {
      resolvedViewerUrl = buildPanoptoViewerUrl(
        resolvedTenant,
        resolvedDeliveryId
      );
    }

    if (!resolvedEmbedUrl && resolvedTenant && resolvedDeliveryId) {
      resolvedEmbedUrl = buildPanoptoEmbedUrl(
        resolvedTenant,
        resolvedDeliveryId
      );
    }

    const primaryUrl = resolvedViewerUrl || resolvedEmbedUrl;
    if (!primaryUrl) {
      return {
        ok: false,
        errorCode: "INVALID_VIDEO",
        message: "Panopto viewer URL not available.",
      };
    }

    logger.info("start", { status: "begin", url: primaryUrl });

    let podcastDisabled = false;
    let downloadEnabled = false;
    let disabledReason = null;
    let authRequired = false;

    const candidates = [];
    const collectFromHtml = async (url, step) => {
      const started = Date.now();
      try {
        const html = await fetchWithCredentials(url);
        const result = extractPanoptoMediaCandidatesFromHtml(html, url);
        candidates.push(...result.candidates);
        if (result.podcastDisabled) {
          podcastDisabled = true;
          disabledReason = result.disabledReason || disabledReason;
        }
        if (result.downloadEnabled) {
          downloadEnabled = true;
        }
        logger.debug(step, {
          status: "ok",
          url,
          elapsedMs: Date.now() - started,
          meta: {
            candidateCount: result.candidates.length,
            podcastDisabled: result.podcastDisabled,
            downloadEnabled: result.downloadEnabled,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === "AUTH_REQUIRED") {
          authRequired = true;
        }
        logger.debug(step, {
          status: "error",
          url,
          elapsedMs: Date.now() - started,
          meta: { error: message },
        });
      }
    };

    if (resolvedViewerUrl) {
      await collectFromHtml(resolvedViewerUrl, "viewer-html");
    }
    if (resolvedEmbedUrl && resolvedEmbedUrl !== resolvedViewerUrl) {
      await collectFromHtml(resolvedEmbedUrl, "embed-html");
    }

    if (candidates.length === 0) {
      const runtime = await runPanoptoRuntimeProbe(tabId, logger);
      candidates.push(...runtime.candidates);
      if (runtime.podcastDisabled) {
        podcastDisabled = true;
        disabledReason = runtime.disabledReason || disabledReason;
      }
      if (runtime.downloadEnabled) {
        downloadEnabled = true;
      }
    }

    if (resolvedTenant && resolvedDeliveryId) {
      const podcastDownloadUrl = buildPanoptoPodcastDownloadUrl(
        resolvedTenant,
        resolvedDeliveryId
      );
      if (podcastDownloadUrl) {
        candidates.push({
          url: podcastDownloadUrl,
          source: "derived:podcast-download",
        });
      }
    }

    const orderedCandidates = dedupeAndSortPanoptoCandidates(candidates);
    debugPayload.candidates = orderedCandidates.map((candidate) => ({
      url: truncateUrl(candidate.url),
      source: candidate.source,
    }));
    debugPayload.signals = {
      podcastDisabled,
      downloadEnabled,
      disabledReason,
      authRequired,
      viewerUrl: truncateUrl(resolvedViewerUrl),
      embedUrl: truncateUrl(resolvedEmbedUrl),
    };

    if (orderedCandidates.length === 0) {
      if (podcastDisabled) {
        logger.warn("resolve", {
          status: "podcast-disabled",
          url: primaryUrl,
          meta: { disabledReason },
        });
        return {
          ok: false,
          errorCode: "PODCAST_DISABLED",
          message:
            "Panopto downloads are disabled for this video. Ask your instructor to enable podcast downloads.",
        };
      }
      if (authRequired) {
        return {
          ok: false,
          errorCode: "AUTH_REQUIRED",
          message:
            "Authentication required. Please log in to Panopto and try again.",
        };
      }
      return {
        ok: false,
        errorCode: "NOT_AVAILABLE",
        message:
          "No downloadable media URL found. This video may not allow downloads.",
      };
    }

    for (const candidate of orderedCandidates) {
      const probe = await probePanoptoMediaUrl(candidate.url, logger);
      if (probe.ok) {
        logger.info("resolve", {
          status: "ok",
          url: candidate.url,
          finalUrl: probe.finalUrl,
        });
        return {
          ok: true,
          mediaUrl: probe.finalUrl || candidate.url,
          mime: probe.contentType || null,
          method: candidate.source || "unknown",
        };
      }

      if (probe.errorCode === "AUTH_REQUIRED") {
        logger.warn("resolve", {
          status: "auth-required",
          url: candidate.url,
        });
        return {
          ok: false,
          errorCode: "AUTH_REQUIRED",
          message:
            "Authentication required to access this Panopto download. Please log in and try again.",
        };
      }

      if (probe.status === 403 && podcastDisabled) {
        logger.warn("resolve", {
          status: "podcast-disabled",
          url: candidate.url,
          meta: { disabledReason },
        });
        return {
          ok: false,
          errorCode: "PODCAST_DISABLED",
          message:
            "Panopto downloads are disabled for this video. Ask your instructor to enable podcast downloads.",
        };
      }
    }

    if (podcastDisabled) {
      return {
        ok: false,
        errorCode: "PODCAST_DISABLED",
        message:
          "Panopto downloads are disabled for this video. Ask your instructor to enable podcast downloads.",
      };
    }

    return {
      ok: false,
      errorCode: "NOT_ALLOWED",
      message:
        "Panopto denied access to the download URL. Downloads may be disabled for your account.",
    };
  },
};

if (typeof self !== "undefined") {
  self.LockInPanoptoResolver = {
    extractCaptionVttUrl,
    resolveCaptionUrl,
    extractPanoptoInfoFromHtml,
    resolvePanoptoInfoFromWrapperUrl,
    extractPanoptoInfoFromUrl,
    buildPanoptoViewerUrl,
    buildPanoptoEmbedUrl,
    PanoptoMediaResolver,
  };
}
})();
